import urllib.request
import urllib.error
import urllib.parse
import json
import http.client
import sys
import time

BASE_URL = "http://127.0.0.1:8199/remote"
CORRECT_PASSWORD = "PenTest_Password_2026!"
WRONG_PASSWORD = "WrongPassword999!"

results = []

def record(test_id, name, passed, details):
    status = "PASSED" if passed else "FAILED"
    print(f"[{status}] {test_id}: {name}")
    print(f"       Details: {details}\n")
    results.append({
        "id": test_id,
        "name": name,
        "passed": passed,
        "details": details
    })

def make_req(url, method="GET", data=None, headers=None, follow_redirects=False):
    if headers is None:
        headers = {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    
    class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
        def http_error_302(self, req, fp, code, msg, headers):
            return fp
        http_error_301 = http_error_302
        http_error_303 = http_error_302
        http_error_307 = http_error_302
        http_error_308 = http_error_302

    opener = urllib.request.build_opener() if follow_redirects else urllib.request.build_opener(NoRedirectHandler)
    try:
        resp = opener.open(req)
        body = resp.read().decode('utf-8', errors='replace')
        return resp.status, resp.headers, body
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        return e.code, e.headers, body
    except Exception as e:
        return 0, {}, str(e)

print("="*70)
print("RUNNING HUGREMOTE DOCKER SECURITY PENTEST SUITE")
print(f"Target: {BASE_URL}")
print("="*70 + "\n")

# -------------------------------------------------------------
# Test 1: Unauthenticated Endpoint Protection
# -------------------------------------------------------------
endpoints = [
    ("/api/fs", "GET"),
    ("/api/servers", "GET"),
    ("/api/claude/sessions", "GET")
]
for ep, method in endpoints:
    status, headers, body = make_req(f"{BASE_URL}{ep}", method=method)
    passed = (status == 401)
    record(f"AUTH-01-{ep}", f"Block unauthenticated request to {ep}", passed, f"HTTP {status}, body={body[:80]}")

# -------------------------------------------------------------
# Test 2: Extension spoofing / Suffix Confusion Bypass
# -------------------------------------------------------------
spoof_endpoints = [
    "/api/fs.png",
    "/api/servers.svg",
    "/api/fs/file.ico"
]
for ep in spoof_endpoints:
    status, headers, body = make_req(f"{BASE_URL}{ep}")
    # Must either be 401 or 404 (Endpoint not found), NEVER 200 or bypass auth
    passed = (status in [401, 404])
    record(f"AUTH-02-{ep}", f"Extension spoofing bypass attempt on {ep}", passed, f"HTTP {status}, body={body[:80]}")

# -------------------------------------------------------------
# Test 3: Public Auth Status Endpoint (/api/auth/me)
# -------------------------------------------------------------
status, headers, body = make_req(f"{BASE_URL}/api/auth/me")
try:
    me_data = json.loads(body)
    passed = (status == 200 and me_data.get("authenticated") is False and me_data.get("mode") == "password")
    record("AUTH-03", "Public /api/auth/me reports mode=password, authenticated=false", passed, f"HTTP {status}, data={me_data}")
except Exception as e:
    record("AUTH-03", "Public /api/auth/me reports mode=password", False, f"JSON parse error: {e}")

# -------------------------------------------------------------
# Test 4: Rate Limiting & Lockout Mechanism
# -------------------------------------------------------------
import random
unique_suffix = random.randint(10, 250)
test_ip = f"198.51.100.{unique_suffix}"
lockout_success = True
last_resp_text = ""

# Send 4 failed attempts
for i in range(1, 5):
    payload = json.dumps({"password": WRONG_PASSWORD}).encode('utf-8')
    status, headers, body = make_req(
        f"{BASE_URL}/api/auth/password",
        method="POST",
        data=payload,
        headers={"Content-Type": "application/json", "CF-Connecting-IP": test_ip}
    )
    data = json.loads(body) if body else {}
    expected_left = 5 - i
    if status != 401 or data.get("attemptsLeft") != expected_left:
        lockout_success = False
        last_resp_text = f"Attempt {i}: HTTP {status}, body={body}"
        break
    last_resp_text = f"Attempt {i}: attemptsLeft={data.get('attemptsLeft')}"

# 5th failed attempt -> MUST LOCK (429)
payload = json.dumps({"password": WRONG_PASSWORD}).encode('utf-8')
status, headers, body = make_req(
    f"{BASE_URL}/api/auth/password",
    method="POST",
    data=payload,
    headers={"Content-Type": "application/json", "CF-Connecting-IP": test_ip}
)
data = json.loads(body) if body else {}
locked_429 = (status == 429 and data.get("error") == "locked" and data.get("retryAfterSeconds") is not None)
record("RATE-01", "Trigger 429 Lockout after 5 failed attempts", lockout_success and locked_429, f"Status={status}, body={body}")

# 6th attempt with CORRECT password while locked -> MUST STILL REJECT (429)
payload = json.dumps({"password": CORRECT_PASSWORD}).encode('utf-8')
status, headers, body = make_req(
    f"{BASE_URL}/api/auth/password",
    method="POST",
    data=payload,
    headers={"Content-Type": "application/json", "CF-Connecting-IP": test_ip}
)
record("RATE-02", "Reject correct password while IP is locked (429)", (status == 429), f"Status={status}, body={body}")

# -------------------------------------------------------------
# Test 5: Cloudflare Header Precedence & IP Isolation
# -------------------------------------------------------------
# A different IP should NOT be locked out
clean_ip = f"203.0.113.{random.randint(10, 250)}"
payload = json.dumps({"password": CORRECT_PASSWORD}).encode('utf-8')
status, headers, body = make_req(
    f"{BASE_URL}/api/auth/password",
    method="POST",
    data=payload,
    headers={"Content-Type": "application/json", "CF-Connecting-IP": clean_ip}
)
auth_clean_passed = (status == 200 and json.loads(body).get("success") is True)
set_cookie = headers.get("Set-Cookie", "")
record("RATE-03", "Clean IP authenticated successfully despite other IP being locked", auth_clean_passed, f"Status={status}, Set-Cookie present={bool(set_cookie)}")

# -------------------------------------------------------------
# Test 6: Cookie Security Attributes
# -------------------------------------------------------------
has_httponly = "HttpOnly" in set_cookie
has_samesite = "SameSite=Lax" in set_cookie or "SameSite=Strict" in set_cookie
has_secure = "Secure" in set_cookie # APP_URL is https
has_path = "Path=/remote" in set_cookie

cookie_flags_ok = has_httponly and has_samesite and has_secure and has_path
record("COOKIE-01", "Session cookie contains HttpOnly, SameSite, Secure, and Path flags", cookie_flags_ok, f"Cookie: {set_cookie}")

# -------------------------------------------------------------
# Test 7: Authenticated API Access & Session Validation
# -------------------------------------------------------------
session_cookie_header = set_cookie.split(";")[0] if set_cookie else ""
status, headers, body = make_req(
    f"{BASE_URL}/api/servers",
    headers={"Cookie": session_cookie_header}
)
auth_access_ok = (status == 200 and "server-local" in body)
record("SESS-01", "Access protected API with valid session cookie", auth_access_ok, f"Status={status}, servers={body[:60]}")

# -------------------------------------------------------------
# Test 8: Logout & Session Invalidation
# -------------------------------------------------------------
status, headers, body = make_req(
    f"{BASE_URL}/api/auth/logout",
    method="POST",
    headers={"Cookie": session_cookie_header}
)
logout_ok = (status == 200 and json.loads(body).get("success") is True)
logout_set_cookie = headers.get("Set-Cookie", "")

# Verify old session cookie is now revoked on server
status_after, _, _ = make_req(
    f"{BASE_URL}/api/servers",
    headers={"Cookie": session_cookie_header}
)
session_revoked = (status_after == 401)
record("SESS-02", "Server-side session invalidation on logout", logout_ok and session_revoked, f"Logout status={status}, API call with old cookie={status_after}")

# -------------------------------------------------------------
# Test 9: Cross-Site WebSocket Hijacking (CSWSH) Protection
# -------------------------------------------------------------
# Re-login to get a fresh valid cookie
payload = json.dumps({"password": CORRECT_PASSWORD}).encode('utf-8')
_, headers, _ = make_req(
    f"{BASE_URL}/api/auth/password",
    method="POST",
    data=payload,
    headers={"Content-Type": "application/json", "CF-Connecting-IP": "192.168.100.101"}
)
fresh_cookie = headers.get("Set-Cookie", "").split(";")[0]

# Try WebSocket upgrade with MALICIOUS Origin: https://evil-attacker.com
def test_ws_origin(origin_header, cookie_header):
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2.0)
    s.connect(("127.0.0.1", 8199))
    ws_req = (
        f"GET /remote/ws/terminal?serverId=server-local HTTP/1.1\r\n"
        f"Host: 127.0.0.1:8199\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
        f"Sec-WebSocket-Version: 13\r\n"
        f"Origin: {origin_header}\r\n"
        f"Cookie: {cookie_header}\r\n\r\n"
    )
    s.sendall(ws_req.encode('utf-8'))
    initial = s.recv(4096).decode('utf-8', errors='replace')
    close_info = ""
    try:
        frame = s.recv(4096)
        if len(frame) >= 4 and frame[0] == 0x88:
            code = (frame[2] << 8) | frame[3]
            reason = frame[4:].decode('utf-8', errors='replace')
            close_info = f"WS Close Code {code}: {reason}"
    except Exception as e:
        close_info = f"recv error: {e}"
    finally:
        s.close()
    return initial, close_info

# Malicious origin -> Connection closed / policy violation (Code 1008)
evil_initial, evil_close = test_ws_origin("https://evil-attacker.com", fresh_cookie)
passed_cswsh = ("1008" in evil_close and "Forbidden" in evil_close)
record("CSWSH-01", "Block WebSocket connection from untrusted origin (https://evil-attacker.com)", passed_cswsh, f"Handshake={evil_initial[:30].strip()}, Close={evil_close}")

# -------------------------------------------------------------
# Test 10: Cross-Origin Resource Sharing (CORS) Restriction
# -------------------------------------------------------------
status, headers, body = make_req(
    f"{BASE_URL}/api/auth/me",
    method="OPTIONS",
    headers={"Origin": "https://malicious-website.org", "Access-Control-Request-Method": "POST"}
)
cors_header = headers.get("Access-Control-Allow-Origin", "")
cors_blocked = (cors_header != "https://malicious-website.org" and cors_header != "*")
record("CORS-01", "Reject CORS preflight / reflect from untrusted origin", cors_blocked, f"Allow-Origin={cors_header}")

# -------------------------------------------------------------
# Test 11: Security Headers (nosniff, SAMEORIGIN, referrer)
# -------------------------------------------------------------
status, headers, body = make_req(f"{BASE_URL}/login")
h_nosniff = headers.get("X-Content-Type-Options") == "nosniff"
h_xfo = headers.get("X-Frame-Options") == "SAMEORIGIN"
h_ref = headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
record("SEC-HEAD-01", "Security headers present (nosniff, SAMEORIGIN, strict-origin-when-cross-origin)", (h_nosniff and h_xfo and h_ref), f"nosniff={h_nosniff}, xfo={h_xfo}, referrer={h_ref}")

# -------------------------------------------------------------
# Test 12: Directory Traversal Attacks on /api/fs
# -------------------------------------------------------------
# Test traversal to /etc/passwd or outside ALLOWED_ROOT (/workspace)
traversal_paths = [
    "../../../../etc/passwd",
    "/etc/shadow",
    "....//....//etc/passwd"
]
for p in traversal_paths:
    url_p = urllib.parse.quote(p)
    status, headers, body = make_req(
        f"{BASE_URL}/api/fs/file?serverId=server-local&path={url_p}",
        headers={"Cookie": fresh_cookie}
    )
    # Must be 400 or 500 with "outside permitted root" / "Access denied", NEVER 200 with file content
    passed = (status != 200 and "root:" not in body)
    record(f"DIR-TRAV-{p}", f"Path traversal attempt for {p}", passed, f"Status={status}, body={body[:80]}")

print("\n" + "="*70)
passed_count = sum(1 for r in results if r["passed"])
total_count = len(results)
print(f"PENTEST RESULTS SUMMARY: {passed_count}/{total_count} TESTS PASSED")
print("="*70)

if passed_count < total_count:
    sys.exit(1)
sys.exit(0)
