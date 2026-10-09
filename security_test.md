# 🛡️ HugRemote Security & Pentest Audit Report

**Date:** 2026-10-09  
**Target:** HugRemote Web IDE & Terminal (Mode: `AUTH_MODE=password`)  
**Environment:** Docker Container Isolation (`node:22-bookworm-slim`), Cloudflare Tunnel Reverse Proxy Profile  
**Test Suite Script:** `scripts/security_test_suite.py` & `scripts/advanced_security_suite.py`  
**Audit Status:** ✅ **27/27 Tests Passed (100% - 19 Standard + 8 Advanced)**

---

## 1. Executive Summary

Khi đưa **HugRemote** ra Internet thông qua Public Domain (ví dụ qua Cloudflare Tunnel hoặc Nginx Reverse Proxy), hệ thống phải đối mặt với các vectơ tấn công từ Internet như:
- Tấn công dò quét mật khẩu (Brute-Force Attack, Credential Stuffing).
- Tấn công cướp quyền điều khiển terminal qua WebSocket từ trang web độc hại (Cross-Site WebSocket Hijacking - CSWSH).
- Giả mạo IP qua header proxy để qua mặt cơ chế Rate Limiting (IP Spoofing).
- Đọc trộm hoặc can thiệp dữ liệu qua CORS lỏng lẻo (Cross-Origin Resource Sharing Misconfiguration).
- Bypass xác thực thông qua nhầm lẫn đuôi file tĩnh (Extension Spoofing / Suffix Confusion).
- Tấn công phân tích thời gian xử lý mật khẩu (Timing Attacks).
- Đọc hoặc ghi file ngoài phạm vi cho phép (Path Traversal).

Báo cáo này tài liệu hóa chi tiết toàn bộ các lỗ hổng đã được rà soát, bản vá code tương ứng, các bài kiểm thử thâm nhập (Pentest) đã thực thi trong môi trường Docker, và hướng dẫn tự chạy lại bộ test.

---

## 2. Threat Modeling & Vulnerabilities Remediated

### 2.1 Cross-Site WebSocket Hijacking (CSWSH) - [CRITICAL]
- **Vấn đề ban đầu:** Trình duyệt tự động gửi Cookie xác thực khi thực hiện WebSocket handshake (`/ws/terminal`), kể cả khi yêu cầu khởi tạo từ một trang web của kẻ tấn công (`https://evil-attacker.com`). Nếu backend không kiểm tra `Origin` header, kẻ tấn công có thể mở kết nối WebSocket vào terminal của nạn nhân và thực thi mã tùy ý từ xa (RCE).
- **Giải pháp vá:** Bổ sung hàm `isValidWsOrigin(req)` trong `server/src/routes/ws.ts`. Chỉ chấp nhận các kết nối có `Origin` khớp với `Host` hiện tại, `APP_URL` cấu hình, hoặc loopback. Mọi origin khác lập tức bị đóng kết nối với WebSocket Close Code `1008 (Forbidden: Invalid Origin)`.

### 2.2 CORS Reflection Misconfiguration - [HIGH]
- **Vấn đề ban đầu:** `@fastify/cors` cấu hình `origin: true`, tự động phản chiếu bất kỳ `Origin` nào gửi đến và kích hoạt `credentials: true`. Trang web độc hại có thể gửi request `fetch(..., { credentials: 'include' })` để đọc API.
- **Giải pháp vá:** Thay thế cấu hình tĩnh bằng validator hàm động trong `server/src/index.ts`. Chỉ chấp nhận origin cùng domain, origin khai báo trong `APP_URL`, hoặc localhost. Các origin lạ bị từ chối cấp phép CORS.

### 2.3 Static Extension Spoofing / Path Confusion Bypass - [HIGH]
- **Vấn đề ban đầu:** Hàm `isPublicPath` trong `server/src/auth/middleware.ts` kiểm tra đuôi file `p.endsWith('.png') || p.endsWith('.svg')` để cho phép tải ảnh mà không cần login. Nếu kẻ tấn công gọi `/api/fs/file?path=/etc/shadow&dummy=.png`, logic cũ có nguy cơ bypass `authGuard`.
- **Giải pháp vá:** Tách biệt tuyệt đối luồng API: Mọi đường dẫn bắt đầu bằng `/api/` chỉ cho phép duy nhất 3 endpoint xác thực công khai (`/api/auth/me`, `/api/auth/password`, `/api/auth/logout`), tuyệt đối không áp dụng quy tắc đuôi file tĩnh cho bất kỳ route `/api/` nào.

### 2.4 Timing Attack Resilience - [MEDIUM]
- **Vấn đề ban đầu:** So sánh độ dài mật khẩu trước `crypto.timingSafeEqual` (`password.length === expected.length`). Kẻ tấn công có thể đo thời gian phản hồi để đoán độ dài chính xác của mật khẩu cấu hình.
- **Giải pháp vá:** Chuyển sang băm cả hai giá trị bằng SHA-256 trước khi so sánh (`crypto.createHash('sha256')`). Độ dài 2 mảng byte luôn là 32 bytes cố định, đảm bảo phép so sánh `timingSafeEqual` diễn ra trong thời gian hằng số (O(1)).

### 2.5 Cloudflare Tunnel IP Spoofing & Brute-Force Rate Limiting - [HIGH]
- **Vấn đề ban đầu:** Khi chạy sau Cloudflare Tunnel, việc đọc `X-Forwarded-For` thông thường có thể bị bypass nếu kẻ tấn công liên tục đổi IP trong header client.
- **Giải pháp vá:** Ưu tiên đọc `CF-Connecting-IP` (header do chính Cloudflare gán từ socket client thực tế, client không thể can thiệp). Khóa 15 phút ngay sau 5 lần nhập sai (`HTTP 429 { error: 'locked', retryAfterSeconds: 900 }`).

### 2.6 Security Headers
- **Giải pháp:** Tự động đính kèm các header bảo vệ vào mọi phản hồi HTTP:
  - `X-Content-Type-Options: nosniff` (chống MIME confusion)
  - `X-Frame-Options: SAMEORIGIN` (chống Clickjacking)
  - `Referrer-Policy: strict-origin-when-cross-origin`

---

## 3. Pentest Test Suite (19 Test Cases)

Bộ kiểm thử tự động được xây dựng tại `scripts/security_test_suite.py` nhằm tự động hóa việc tấn công thử nghiệm trên Docker container port `8199`.

| Mã Test | Mục Tiêu Kiểm Thử | Kỳ Vọng | Kết Quả Thực Tế | Trạng Thái |
|---|---|---|---|---|
| **AUTH-01-fs** | Truy cập `/api/fs` khi chưa đăng nhập | HTTP 401 Unauthorized | HTTP 401 | ✅ PASSED |
| **AUTH-01-servers** | Truy cập `/api/servers` khi chưa đăng nhập | HTTP 401 Unauthorized | HTTP 401 | ✅ PASSED |
| **AUTH-01-claude** | Truy cập `/api/claude/sessions` khi chưa đăng nhập | HTTP 401 Unauthorized | HTTP 401 | ✅ PASSED |
| **AUTH-02-png** | Gọi `/api/fs.png` để giả mạo đuôi tĩnh | Bị chặn (HTTP 401 / 404) | HTTP 401 | ✅ PASSED |
| **AUTH-02-svg** | Gọi `/api/servers.svg` để giả mạo đuôi tĩnh | Bị chặn (HTTP 401 / 404) | HTTP 401 | ✅ PASSED |
| **AUTH-02-ico** | Gọi `/api/fs/file.ico` để giả mạo đuôi tĩnh | Bị chặn (HTTP 401 / 404) | HTTP 401 | ✅ PASSED |
| **AUTH-03** | Gọi `/api/auth/me` ở trạng thái unauthenticated | Trả về `authenticated: false`, `mode: password` | HTTP 200, `auth=false` | ✅ PASSED |
| **RATE-01** | Nhập sai mật khẩu liên tiếp 5 lần | Lần 1-4 báo `attemptsLeft`, lần 5 trả HTTP 429 `locked` | HTTP 429, retry=900s | ✅ PASSED |
| **RATE-02** | Nhập mật khẩu đúng ngay khi IP đang bị khóa | Phải tiếp tục từ chối HTTP 429 | HTTP 429 `locked` | ✅ PASSED |
| **RATE-03** | IP khác (sạch) đăng nhập mật khẩu đúng | Đăng nhập thành công, không bị ảnh hưởng bởi IP bị khóa | HTTP 200 OK | ✅ PASSED |
| **COOKIE-01** | Kiểm tra cờ an toàn của session cookie | Chứa `HttpOnly`, `SameSite=Lax`, `Secure`, `Path=/remote` | Đủ 4 cờ an toàn | ✅ PASSED |
| **SESS-01** | Dùng Session Cookie hợp lệ gọi API `/api/servers` | Truy cập thành công danh sách server | HTTP 200 OK | ✅ PASSED |
| **SESS-02** | Gọi `/api/auth/logout` và tái sử dụng cookie cũ | Phiên bị hủy trên server, cookie cũ trả về 401 | HTTP 401 Unauthorized | ✅ PASSED |
| **CSWSH-01** | Tấn công CSWSH: Kết nối WS với Cookie hợp lệ nhưng `Origin: evil-attacker.com` | Máy chủ đóng ngay lập tức với WebSocket Code `1008` | WS Close Code 1008 Forbidden | ✅ PASSED |
| **CORS-01** | Gửi OPTIONS Preflight từ `Origin: malicious-website.org` | Server không cấp phát `Access-Control-Allow-Origin` | Header trống / Không phản chiếu | ✅ PASSED |
| **SEC-HEAD-01**| Kiểm tra Security Headers | Có `nosniff`, `SAMEORIGIN`, `strict-origin-when-cross-origin` | Đủ cả 3 header | ✅ PASSED |
| **DIR-TRAV-01**| Gửi path `../../../../etc/passwd` | Không lộ nội dung file hệ thống | Bị từ chối 404/Access denied | ✅ PASSED |
| **DIR-TRAV-02**| Gửi path `/etc/shadow` | Không thể đọc file nhạy cảm ngoài workspace | Bị từ chối 404/Access denied | ✅ PASSED |
| **DIR-TRAV-03**| Gửi path bypass filter `....//....//etc/passwd` | Không thể thoát khỏi root cho phép | Bị từ chối 404/Access denied | ✅ PASSED |

**Tổng kết:** **19/19 Test Cases Đạt Chuẩn.**

---

## 4. Advanced Pentest Suite (Mức Độ Chuyên Sâu - 8 Test Cases)

Bộ kiểm thử cấp cao được xây dựng tại `scripts/advanced_security_suite.py` nhằm đánh giá các kịch bản tấn công phức tạp:

| Mã Test | Mục Tiêu Tấn Công | Kỹ Thuật Pentest & Kỳ Vọng | Kết Quả Thực Tế | Trạng Thái |
|---|---|---|---|---|
| **ADV-01** | Symlink Directory Traversal (LFI qua liên kết tượng trưng) | Tạo symlink trỏ tới `/etc/passwd`. Gọi API đọc file. Hệ thống phải giải quyết `fs.realpathSync` và chặn đứng. | Không rò rỉ file ngoài root (HTTP 404/Access Denied) | ✅ PASSED |
| **ADV-02** | Concurrent Race Condition (Stampede Login Flood) | Bắn 40 request đăng nhập sai đồng thời qua đa luồng song song (<100ms). Kiểm tra race window của Rate Limiter. | 4 lần 401, 36 lần 429 lock ngay lập tức, 0 lần 200 | ✅ PASSED |
| **ADV-03** | HMAC Signature Forgery & Tampering | Sửa đổi Session ID, xoá Signature, cắt cụt chữ ký HMAC, thay thế bằng chuỗi giả mạo. | 100% request giả mạo bị từ chối 401 Unauthorized | ✅ PASSED |
| **ADV-04** | Prototype Pollution & Input Type Confusion | Bơm `__proto__`, `constructor.prototype`, object và array vào payload JSON đăng nhập. | Bị từ chối HTTP 400 `invalid_password`, prototype sạch | ✅ PASSED |
| **ADV-05** | Denial of Service (DoS): Buffer & Payload Limit | Bơm payload 5MB vào endpoint POST nhằm gây nghẽn Event Loop / tràn bộ nhớ. | Fastify Body Limit ngắt ngay với HTTP 413 Payload Too Large | ✅ PASSED |
| **ADV-06** | WebSocket Protocol Fuzzing & Resilience | Bơm gói tin control resize JSON dị dạng, số âm cực đại, chuỗi NaN và binary rác qua WebSocket. | Terminal không sập, socket duy trì ổn định và phản hồi pong chuẩn | ✅ PASSED |
| **ADV-07** | Path Normalization & Double Encoding | Thử nghiệm double URL encode (`%252e%252e%252f`), Overlong UTF-8, Windows backslash, null byte. | Tất cả bị chặn, không bypass được sandbox thư mục | ✅ PASSED |
| **ADV-08** | Authoritative Header Precedence | Bơm nhiều header xung đột (`CF-Connecting-IP` vs giả mạo `X-Forwarded-For`). Kiểm tra tính bất biến. | Rate limiter khoá chặt theo `CF-Connecting-IP`, miễn nhiễm spoofing | ✅ PASSED |

**Tổng kết Advanced Suite:** **8/8 Test Cases Đạt Chuẩn Tuyệt Đối.**

---

## 5. Hướng Dẫn Tự Chạy Lại Pentest Trong Docker

### Bước 1: Khởi động container Pentest cách ly
```bash
cd /home/hermes-admin/projects/hugcode
docker compose -f docker-compose.security-test.yml up -d --build
```

Container sẽ chạy độc lập tại cổng `8199` với cấu hình:
- `AUTH_MODE=password`
- `AUTH_PASSWORD=PenTest_Password_2026!`
- `APP_URL=https://hugtech.buaanvuive.com/remote`
- `BASE_PATH=/remote`
- `TRUST_PROXY=true`

### Bước 2: Chạy bộ kiểm thử tiêu chuẩn và bộ kiểm thử chuyên sâu
```bash
# 1. Chạy 19 bài kiểm thử tiêu chuẩn
python3 scripts/security_test_suite.py

# 2. Chạy 8 bài kiểm thử chuyên sâu (Symlink, Race condition, HMAC forgery, Fuzzing)
python3 scripts/advanced_security_suite.py
```

### Bước 3: Dọn dẹp container sau khi kiểm thử
```bash
docker compose -f docker-compose.security-test.yml down
```

---

## 6. Khuyến Nghị Khi Đưa Ra Public Domain

1. **Bật Cloudflare Tunnel hoặc Cloudflare Access**:
   - Sử dụng Cloudflare Tunnel (`cloudflared`) để public cổng mà không cần mở port trực tiếp trên router/firewall.
   - Nếu có thể, bật thêm tầng Cloudflare Access (Zero Trust Email OTP / SSO) phía trước để tạo cơ chế xác thực 2 lớp (Defense-in-Depth).
2. **Cấu hình biến môi trường**:
   - Đặt `APP_URL=https://your-domain.com/remote` để kích hoạt cờ `Secure` cho Cookie và whitelist đúng Origin cho CORS/WebSocket.
   - Đặt `AUTH_PASSWORD` có độ dài tối thiểu 16 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
   - Đặt `SESSION_SECRET` ngẫu nhiên dài ít nhất 32 ký tự.
3. **Phân quyền thư mục Docker**:
   - Cấu hình `ALLOWED_ROOT` trỏ vào thư mục dự án (ví dụ `/workspace`), không trỏ vào `/` để tránh việc vô tình duyệt vào các file nhạy cảm của container.
   - Tránh mount thư mục chứa private key SSH nếu không cần thiết.
