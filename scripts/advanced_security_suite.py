import urllib.request
import urllib.error
import urllib.parse
import json
import socket
import sys
import time
import os
import random
from concurrent.futures import ThreadPoolExecutor

BASE_URL = "http://127.0.0.1:8199/remote"
CORRECT_PASSWORD = "PenTest_Password_2026!"
WRONG_PASSWORD = "WrongPassword999!"

adv_results = []

def record(test_id, name, passed, details):
    status = "PASSED" if passed else "FAILED"
    print(f"[{status}] {test_id}: {name}")
    print(f"       Details: {details}\n")
    adv_results.append({
        "id": test_id,
        "name": name,
        "passed": passed,
        "details": details
    })

def make_req(url, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        body = resp.read().decode('utf-8', errors='replace')
        return resp.status, resp.headers, body
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        return e.code, e.headers, body
    except Exception as e:
        return 0, {}, str(e)

print("="*75)
print("RUNNING ADVANCED HUGREMOTE PENTEST SUITE (HIGH DIFFICULTY)")
print(f"Target: {BASE_URL}")
print("="*75 + "\n")

# 1. Helper to get valid session cookie
def get_auth_cookie():
    payload = json.dumps({"password": CORRECT_PASSWORD}).encode('utf-8')
    status, headers, body = make_req(
        f"{BASE_URL}/api/auth/password",
        method="POST",
        data=payload,
        headers={"Content-Type": "application/json", "CF-Connecting-IP": f"198.18.0.{random.randint(2, 250)}"}
    )
    if status == 200:
        return headers.get("Set-Cookie", "").split(";")[0]
    return None

valid_cookie = get_auth_cookie()
if not valid_cookie:
    print("FATAL: Unable to obtain authenticated session cookie.")
    sys.exit(1)

# --------------------------------------------------------------------------
# ADV-01: Symlink Directory Traversal (LFI via Symlink Dereference Escape)
# --------------------------------------------------------------------------
# In /workspace (/home/hermes-admin/projects), create a temporary symlink pointing to /etc/passwd
symlink_name = f"pentest_symlink_{int(time.time())}"
workspace_host_path = "/home/hermes-admin/projects"
symlink_path = os.path.join(workspace_host_path, symlink_name)

try:
    if os.path.islink(symlink_path) or os.path.exists(symlink_path):
        os.unlink(symlink_path)
    os.symlink("/etc/passwd", symlink_path)
    
    # Try reading through the symlink via API
    status, headers, body = make_req(
        f"{BASE_URL}/api/fs/file?serverId=server-local&path={symlink_name}",
        headers={"Cookie": valid_cookie}
    )
    # The server must detect that canonical path is /etc/passwd (outside /workspace) and reject!
    blocked = (status != 200 and "root:" not in body)
    record("ADV-01", "Symlink Escape Protection (fs.realpathSync boundary validation)", blocked, f"Status={status}, body={body[:90]}")
finally:
    if os.path.islink(symlink_path):
        os.unlink(symlink_path)

# --------------------------------------------------------------------------
# ADV-02: Concurrent Race Condition Brute-Force (Stampede Login Flood)
# --------------------------------------------------------------------------
# Send 40 concurrent login requests with bad passwords in parallel within < 100ms
race_ip = f"198.51.100.{random.randint(10, 240)}"
concurrent_count = 40
results_lock = []

def send_attempt(i):
    p = json.dumps({"password": f"BadPass_{i}_{random.randint(1000, 9999)}"}).encode('utf-8')
    st, hd, bd = make_req(
        f"{BASE_URL}/api/auth/password",
        method="POST",
        data=p,
        headers={"Content-Type": "application/json", "CF-Connecting-IP": race_ip}
    )
    return st

with ThreadPoolExecutor(max_workers=20) as executor:
    futures = [executor.submit(send_attempt, i) for i in range(concurrent_count)]
    results_lock = [f.result() for f in futures]

locked_429_count = results_lock.count(429)
rejected_401_count = results_lock.count(401)
success_200_count = results_lock.count(200)

# Once locked, subsequent requests MUST be 429. Zero 200s allowed. 401s cannot exceed 5.
race_safe = (success_200_count == 0 and rejected_401_count <= 5 and locked_429_count >= (concurrent_count - 5))
record("ADV-02", "Concurrent Login Race Condition & Lockout Integrity", race_safe, f"Total={concurrent_count}, 401s={rejected_401_count}, 429s={locked_429_count}, 200s={success_200_count}")

# --------------------------------------------------------------------------
# ADV-03: Session Cookie Signature Forgery & HMAC Tampering
# --------------------------------------------------------------------------
# valid_cookie is e.g. hugremote_session=<id>.<signature>
cookie_val = valid_cookie.split("=")[1]
raw_id, raw_sig = cookie_val.rsplit(".", 1)

tamper_tests = [
    ("Tampered ID + Valid Sig", f"hugremote_session=HACKED_{raw_id}.{raw_sig}"),
    ("Valid ID + Null Sig", f"hugremote_session={raw_id}."),
    ("Valid ID + Missing Sig", f"hugremote_session={raw_id}"),
    ("Valid ID + Garbage Sig", f"hugremote_session={raw_id}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"),
    ("Valid ID + Truncated Sig", f"hugremote_session={raw_id}.{raw_sig[:10]}")
]

all_tampered_rejected = True
tamper_details = []
for label, t_cookie in tamper_tests:
    st, hd, bd = make_req(
        f"{BASE_URL}/api/servers",
        headers={"Cookie": t_cookie}
    )
    if st != 401:
        all_tampered_rejected = False
        tamper_details.append(f"{label} allowed with {st}")
    else:
        tamper_details.append(f"{label}: 401")

record("ADV-03", "Cryptographic HMAC Signature Tampering & Forgery Resistance", all_tampered_rejected, "; ".join(tamper_details))

# --------------------------------------------------------------------------
# ADV-04: Prototype Pollution & Type Confusion via JSON Payload
# --------------------------------------------------------------------------
pollution_payloads = [
    {"__proto__": {"polluted": True}, "password": "abc"},
    {"constructor": {"prototype": {"polluted": True}}, "password": "abc"},
    {"password": ["array_confusion", "attempt"]},
    {"password": {"$ne": None}}
]

pollution_safe = True
details_pol = []
for idx, payload in enumerate(pollution_payloads):
    st, hd, bd = make_req(
        f"{BASE_URL}/api/auth/password",
        method="POST",
        data=json.dumps(payload).encode('utf-8'),
        headers={"Content-Type": "application/json", "CF-Connecting-IP": f"203.0.113.{idx + 10}"}
    )
    # Server must either return 400 (invalid_password) or 401 (wrong password), never 500 or 200
    if st not in [400, 401]:
        pollution_safe = False
    details_pol.append(f"Payload {idx+1}: HTTP {st}")

record("ADV-04", "Prototype Pollution & Input Type Confusion Defenses", pollution_safe, ", ".join(details_pol))

# --------------------------------------------------------------------------
# ADV-05: Denial of Service via Huge Payload (Body Limit Rejection)
# --------------------------------------------------------------------------
# Send a 5MB payload to /api/auth/password
huge_payload = json.dumps({"password": "A" * (5 * 1024 * 1024)}).encode('utf-8')
st, hd, bd = make_req(
    f"{BASE_URL}/api/auth/password",
    method="POST",
    data=huge_payload,
    headers={"Content-Type": "application/json"}
)
# Fastify bodyLimit must reject with 413 Payload Too Large
body_limit_ok = (st == 413)
record("ADV-05", "Denial of Service (DoS): 5MB Oversized Payload Rejection (HTTP 413)", body_limit_ok, f"Status={st}, body={bd[:70]}")

# --------------------------------------------------------------------------
# ADV-06: WebSocket Malformed Frames & Control Fuzzing
# --------------------------------------------------------------------------
def make_ws_frame(payload_bytes, opcode=1):
    mask_key = os.urandom(4)
    length = len(payload_bytes)
    header = bytearray([0x80 | opcode, 0x80 | length])
    header.extend(mask_key)
    masked = bytearray(b ^ mask_key[i % 4] for i, b in enumerate(payload_bytes))
    return bytes(header + masked)

def test_ws_fuzz():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(3.0)
    s.connect(("127.0.0.1", 8199))
    ws_req = (
        f"GET /remote/ws/terminal?serverId=server-local HTTP/1.1\r\n"
        f"Host: 127.0.0.1:8199\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
        f"Sec-WebSocket-Version: 13\r\n"
        f"Origin: http://127.0.0.1:8199\r\n"
        f"Cookie: {valid_cookie}\r\n\r\n"
    )
    s.sendall(ws_req.encode('utf-8'))
    initial = s.recv(4096)
    if b"101 Switching Protocols" not in initial:
        s.close()
        return False, "Handshake failed"

    # Consume initial terminal prompt
    try:
        s.recv(4096)
    except Exception:
        pass

    # Send malformed JSON control frames (fuzzing)
    malformed_json = b'{"type": "resize", "cols": -999999999999999999, "rows": "NaN"}'
    s.sendall(make_ws_frame(malformed_json))
    time.sleep(0.1)

    # Send random binary garbage
    garbage = os.urandom(64)
    s.sendall(make_ws_frame(garbage, opcode=2))
    time.sleep(0.1)

    # Send valid ping to verify server socket is still healthy and responsive
    ping_payload = b'{"type": "ping"}'
    s.sendall(make_ws_frame(ping_payload))

    pong_received = False
    buf = b""
    while True:
        try:
            chunk = s.recv(4096)
            if not chunk:
                break
            buf += chunk
            if b"pong" in buf:
                pong_received = True
                break
        except Exception:
            break
    s.close()
    return pong_received, "Server remained healthy and returned pong after malformed frames & binary fuzzing"

ws_fuzz_passed, ws_fuzz_msg = test_ws_fuzz()
record("ADV-06", "WebSocket Fuzzing: Resilience to Malformed Control Frames & Garbage", ws_fuzz_passed, ws_fuzz_msg)

# --------------------------------------------------------------------------
# ADV-07: Double URL Encoding & Normalization Bypass Attempts
# --------------------------------------------------------------------------
encoding_bypass_tests = [
    ("Double encoded slash", "%252e%252e%252fetc%252fpasswd"),
    ("Overlong UTF-8", "..%c0%af..%c0%afetc/passwd"),
    ("Windows backslash", "..\\..\\etc\\passwd"),
    ("Null byte injection", "safe.txt%00/../../etc/passwd")
]

all_enc_blocked = True
enc_details = []
for label, path_str in encoding_bypass_tests:
    st, hd, bd = make_req(
        f"{BASE_URL}/api/fs/file?serverId=server-local&path={path_str}",
        headers={"Cookie": valid_cookie}
    )
    if st == 200 and "root:" in bd:
        all_enc_blocked = False
        enc_details.append(f"{label} LEAKED")
    else:
        enc_details.append(f"{label}: HTTP {st}")

record("ADV-07", "Path Normalization & Double Encoding Bypass Resistance", all_enc_blocked, "; ".join(enc_details))

# --------------------------------------------------------------------------
# ADV-08: Authoritative Header Priority (CF-Connecting-IP vs Spoofed XFF)
# --------------------------------------------------------------------------
# Send multiple conflicting headers: CF-Connecting-IP=1.2.3.4, X-Forwarded-For=5.6.7.8, X-Real-IP=9.10.11.12
# Exhaust attempts on 1.2.3.4, verify that changing X-Forwarded-For does NOT reset the counter!
cf_target_ip = f"198.51.200.{random.randint(10, 240)}"
# 5 failed attempts
for k in range(5):
    make_req(
        f"{BASE_URL}/api/auth/password",
        method="POST",
        data=json.dumps({"password": "bad"}).encode('utf-8'),
        headers={
            "Content-Type": "application/json",
            "CF-Connecting-IP": cf_target_ip,
            "X-Forwarded-For": f"fake.spoofed.{k}.ip",
            "X-Real-IP": "another.fake.ip"
        }
    )

# 6th attempt with spoofed X-Forwarded-For and X-Real-IP
st_prio, hd_prio, bd_prio = make_req(
    f"{BASE_URL}/api/auth/password",
    method="POST",
    data=json.dumps({"password": CORRECT_PASSWORD}).encode('utf-8'),
    headers={
        "Content-Type": "application/json",
        "CF-Connecting-IP": cf_target_ip,
        "X-Forwarded-For": "bypassed.ip.attempt",
        "X-Real-IP": "bypassed.real.ip"
    }
)
cf_priority_ok = (st_prio == 429)
record("ADV-08", "Authoritative Proxy Header Precedence (CF-Connecting-IP immunity to XFF spoofing)", cf_priority_ok, f"Status={st_prio}, body={bd_prio[:70]}")

print("\n" + "="*75)
adv_passed = sum(1 for r in adv_results if r["passed"])
adv_total = len(adv_results)
print(f"ADVANCED PENTEST RESULTS: {adv_passed}/{adv_total} TESTS PASSED")
print("="*75)

if adv_passed < adv_total:
    sys.exit(1)
sys.exit(0)
