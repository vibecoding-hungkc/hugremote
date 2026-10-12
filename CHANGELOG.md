# 📋 Changelog — HugRemote

## [Unreleased] - feature/telegram

### 🤖 Tính năng mới: Tích hợp Telegram Bot
- **Giao tiếp Claude Code qua Telegram**: Cho phép gửi prompt, nhận phản hồi trực tiếp, theo dõi tiến trình suy nghĩ (thinking) và các thẻ gọi công cụ (tool call cards: Bash, Read, Edit) thời gian thực trên điện thoại.
- **Chế độ Topic (Forum / Threaded Mode)**: Hỗ trợ chia nhánh phiên làm việc theo Topic Telegram — mỗi Topic là một phiên Claude độc lập với ngữ cảnh và thư mục riêng. Root chat đóng vai trò là Control Lobby.
- **Bộ lệnh quản lý phiên đầy đủ**:
  - `/new`: Tạo phiên làm việc mới và tự động gán vào Topic.
  - `/resume`: Khôi phục hoặc chuyển đổi sang phiên làm việc cũ.
  - `/compact`: Nén và tóm tắt ngữ cảnh cuộc hội thoại để tiết kiệm token.
  - `/clear`: Xóa sạch lịch sử tin nhắn của phiên, giữ nguyên thư mục làm việc.
  - `/stop` (alias `/abort`): Huỷ ngay tiến trình Claude đang chạy dở.
  - `/status` (alias `/limits`): Xem thông tin phiên hiện tại và hạn mức quota 5 giờ/tuần của Claude.
  - `/sessions`: Xem danh sách tất cả các phiên làm việc.
- **Thực thi Terminal trực tiếp (`/terminal`)**: Cho phép chạy lệnh Bash trực tiếp trên máy chủ tại thư mục làm việc hiện tại, trả về mã thoát và thời gian thực thi.
- **Tự động lưu log & link File Server**: Nếu output terminal hoặc câu trả lời dài vượt quá giới hạn Telegram (4096 ký tự), bot tự động lưu file log và cung cấp link xem toàn văn qua File Server nội bộ `http://hugtech.buaanvuive.com/file/...`.
- **Bảo mật Zero-Trust**: Whitelist `TELEGRAM_ALLOWED_USERS` chặn đứng người lạ, không tốn tài nguyên khi chưa có token (`TELEGRAM_BOT_TOKEN`).

---

## [v1.0.1] - 2026-10-09

### 🐛 Sửa lỗi (Bug Fixes)
- **Terminal trên macOS/MacBook**: Sửa lỗi không mở được terminal trên máy Mac.
- **Bàn phím Terminal**: Tối ưu nhận diện phím trên macOS, tránh lỗi gõ lặp ký tự.
- **Xem & Sửa file Markdown**: Sửa lỗi không mở được file `.md`, hỗ trợ chuyển đổi mượt mà giữa chế độ xem trước (Preview) và chỉnh sửa (Edit).
- **Giao diện Web IDE**: Sửa lỗi màn hình trắng khi tải giao diện lần đầu.

### ⚡ Cải tiến (Improvements)
- **Thư mục làm việc (Workspace)**: Mặc định mở ngay tại thư mục gốc người dùng (`~`), hiển thị đầy đủ các thư mục trên máy thay vì bắt buộc vào `~/projects`.
- **Cập nhật một chạm**: Tự động nhận diện cấu hình cũ khi chạy cập nhật, nhấn Enter để giữ nguyên mà không cần trả lời lại câu hỏi.
- **Kênh cài đặt Beta**: Thêm script `beta.sh` để cập nhật các bản vá mới nhất trực tiếp từ nhánh `main`.

---

## [v1.0.0] - 2026-10-09

### 🚀 Tính năng chính
- **Mobile-First Web IDE & Terminal**: Trình soạn thảo mã nguồn và terminal đa cửa sổ tối ưu cho điện thoại.
- **Tích hợp Claude Code**: Giao diện chat trực quan với thẻ thực thi lệnh, diff và quản lý phiên làm việc.
- **Xác thực linh hoạt**: Hỗ trợ 3 chế độ (Không mật khẩu, Mật khẩu đổi lần đầu, Google OAuth).
- **Bảo mật**: Phòng vệ truy cập trái phép, bảo vệ an toàn hệ thống tệp và phiên đăng nhập.
