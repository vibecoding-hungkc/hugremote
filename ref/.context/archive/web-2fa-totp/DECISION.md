# Quyết định kỹ thuật: web-2fa-totp

1. **TOTP (RFC 6238) + QR Code SVG thuần Node.js (`crypto`):**
   - Không thêm dependency bên ngoài có nguy cơ chuỗi cung ứng hoặc native build; tự cài đặt Base32 (RFC 4648), HOTP/TOTP SHA-1 6 chữ số chu kỳ 30s (chấp nhận độ lệch ±1 bước thời gian để tránh lỗi lệch đồng hồ điện thoại vài giây) và bộ sinh QR Code chuẩn ISO/IEC 18004 (Byte mode, ECC Level L/M, Reed-Solomon GF(256)) xuất trực tiếp ra chuỗi `<svg>` sắc nét.
2. **Hoạt động độc lập & kết hợp mượt với mọi `AUTH_MODE` trên bản Web:**
   - Khi `twoFactorStore.isEnabled() === false`: hành vi đăng nhập giữ nguyên 100% như trước.
   - Khi `twoFactorStore.isEnabled() === true`:
     - Với `AUTH_MODE=password` hoặc `google`: bước 1 xác thực mật khẩu/Google tạo session tạm (`twoFactorVerified: false`), bước 2 nhập mã TOTP 6 số (hoặc mã dự phòng) nâng cấp session lên `twoFactorVerified: true`.
     - Với `AUTH_MODE=none`: nếu người dùng chủ động bật 2FA trong Cài đặt, truy cập Web sẽ yêu cầu nhập mã 2FA 6 số tại `AuthGate.vue` để tạo session đã xác thực (`twoFactorVerified: true`).
     - Bản cài Desktop macOS (`process.env.HUGREMOTE_DESKTOP_SECRET`) dùng kênh loopback bảo vệ bằng cookie ngẫu nhiên 64-hex nên được miễn bước 2FA Web.
