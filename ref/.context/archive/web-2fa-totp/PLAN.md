---
feature: web-2fa-totp
description: Integrate optional TOTP 2FA (6-digit Authenticator app + QR SVG + 8 recovery codes) for HugRemote Web with user toggle in SettingsView and verification in AuthGate.
status: done
created: 2026-11-08
---
# Tích hợp Bảo mật 2FA (TOTP Authenticator) tùy chọn Bật/Tắt cho HugRemote Web

## Goal
1. **Hỗ trợ bảo mật 2 lớp (2FA) chuẩn TOTP 6 số (RFC 6238) kèm Mã QR SVG và 8 Mã khôi phục dự phòng (Recovery Codes):**
   - Triển khai hoàn toàn bằng `crypto` thuần của Node.js (`apps/api/src/auth/twoFactorStore.ts` và `apps/api/src/auth/qrSvg.ts`), không phụ thuộc dịch vụ bên thứ ba.
   - Lưu cấu hình 2FA bền vững tại `~/.config/hugremote/two_factor.json` (hoặc `AUTH_2FA_FILE`, quyền `0600`).
2. **Người dùng tùy chọn Bật (`Enabled`) hoặc Tắt (`Disabled`) ngay trong màn hình Cài đặt (`SettingsView.vue` & `prototype.html`):**
   - Khối **Bảo mật 2 lớp · 2FA** (`#settings-2fa-card`) hiển thị trạng thái hiện tại (`#two-factor-status-badge`: `Đang bật` / `Đang tắt`), số mã khôi phục dự phòng còn lại và nút bật/tắt (`#btn-setup-2fa` / `#btn-disable-2fa` / `#btn-regenerate-recovery-codes`).
   - Khi bấm **Thiết lập 2FA**: hiển thị mã QR SVG (`#two-factor-qr-box`), khóa Base32 (`#two-factor-secret-text`), danh sách 8 mã khôi phục dự phòng (`#two-factor-recovery-list`) và ô nhập mã 6 số từ ứng dụng Authenticator (`#two-factor-verify-input` + `#btn-confirm-enable-2fa`). Chỉ khi xác nhận đúng mã 6 số thì 2FA mới chính thức được kích hoạt (`enabled = true`).
   - Khi bấm **Tắt 2FA**: yêu cầu nhập mã 2FA 6 số hiện tại hoặc 1 mã khôi phục dự phòng (`#two-factor-disable-input` + `#btn-confirm-disable-2fa`) để xác thực chủ sở hữu trước khi tắt.
3. **Bảo vệ toàn bộ HTTP API & WebSocket của bản Web khi 2FA đang bật (`middleware.ts`, `routes.ts`, `AuthGate.vue`):**
   - Bản cài Desktop macOS (`HUGREMOTE_DESKTOP_SECRET`) giữ nguyên cơ chế cookie phiên nội bộ.
   - Trên bản Web:
     - Nếu `AUTH_MODE=password` hoặc `google` và `twoFactorStore.isEnabled() === true`: sau khi đăng nhập mật khẩu/Google thành công, phiên được tạo với `twoFactorVerified: false` (`requiresTwoFactor: true`) và `AuthGate.vue` chuyển sang bước nhập mã 2FA 6 số (hoặc mã khôi phục).
     - Nếu `AUTH_MODE=none` nhưng người dùng **bật 2FA**: hệ thống yêu cầu xác thực mã 2FA (`AuthGate.vue` hiển thị trực tiếp màn hình mở khóa bằng mã 2FA) trước khi cho phép truy cập ứng dụng và WebSocket.
   - Tích hợp chống brute-force (`passwordLimiter` / rate limit) cho endpoint `/api/auth/2fa/verify`.

## Acceptance Criteria
- [x] AC1: `twoFactorStore` sinh khóa Base32 chuẩn, tính/kiểm tra mã TOTP 6 số (RFC 6238, cửa sổ ±1 bước 30s), tạo SVG QR code hợp lệ (`<svg ...>`) từ URI `otpauth://totp/...`, và băm/tiêu thụ một lần 8 mã khôi phục dự phòng — Evidence: `npx tsx scripts/test_two_factor_auth.ts` PASS.
- [x] AC2: Các API `/api/auth/2fa/status`, `/api/auth/2fa/setup`, `/api/auth/2fa/enable`, `/api/auth/2fa/verify`, `/api/auth/2fa/disable`, `/api/auth/2fa/recovery-codes` hoạt động đúng; khi `2FA` đang bật, `authGuard` và `requireAuthForWs` chặn truy cập `/api/servers` & `/ws/terminal` (`401`/`403`) cho tới khi phiên hoàn tất `/api/auth/2fa/verify` (kể cả khi `AUTH_MODE=none` lẫn `AUTH_MODE=password`) — Evidence: `npx tsx scripts/test_two_factor_auth.ts` PASS.
- [x] AC3: Màn hình `Cài đặt` (`SettingsView.vue` và `analysis/prototypes/prototype.html`) hiển thị khối `#settings-2fa-card` với đầy đủ luồng Bật 2FA (hiện QR SVG, secret, mã khôi phục, xác nhận mã 6 số) và Tắt 2FA; `AuthGate.vue` hiển thị màn nhập mã 2FA (`#auth-2fa-code`) khi `requiresTwoFactor === true` — Evidence: `node scripts/test_ui_shortcuts_and_universal_folder.mjs && node scripts/test_ui_prototype_shortcuts.mjs` PASS.
- [x] AC4: Không dùng dấu ngoặc đơn giải thích `(...)` trong câu chữ UI mới và đạt kiểm tra monochrome theme (`node scripts/test_ui_monochrome_theme.mjs`) — Evidence: `node scripts/test_ui_monochrome_theme.mjs` PASS.
- [x] AC5: Toàn bộ bộ test (`npm run test:ui`, `npm run test:desktop`, `npm run test:security`, `npm run build`) PASS và kiểm chứng trực tiếp luồng Bật 2FA -> Xác thực 2FA -> Tắt 2FA trên trình duyệt thật (`browser_exec`) tại `http://127.0.0.1:8099/remote/#/settings` — Evidence: `SETUP: {"qrSvgExists": true, "qrRectWidth": 134, "recoveryCount": 8}`, `ENABLED: {"badgeText": "Đang bật", "btnText": "Tắt 2FA"}`, `DISABLED_AGAIN: {"badgeText": "Đang tắt", "btnText": "Thiết lập 2FA"}`, `MOBILE: {"scrollWidth": 390, "clientWidth": 390, "noOverflow": true, "cardWidth": 358}`.

## Tasks
- [x] T1: Viết bài test `scripts/test_two_factor_auth.ts` và cập nhật `scripts/test_ui_shortcuts_and_universal_folder.mjs` + `scripts/test_ui_prototype_shortcuts.mjs` (xác nhận RED).
- [x] T2: Xây dựng `apps/api/src/auth/qrSvg.ts` và `apps/api/src/auth/twoFactorStore.ts`, cập nhật `types.ts`, `sessionStore.ts`, `middleware.ts`, `routes.ts`, `googleOAuth.ts`.
- [x] T3: Cập nhật `apps/web/src/stores/authStore.ts`, `apps/web/src/components/AuthGate.vue`, `apps/web/src/components/SettingsView.vue`, `apps/web/src/i18n/messages.ts` và `analysis/prototypes/prototype.html`.
- [x] T4: Chạy toàn bộ test, build, triển khai lên dịch vụ local, kiểm chứng E2E trên trình duyệt thật bằng `browser_exec`, merge vào `main` và push.
