# 📋 Changelog — HugRemote


## [v1.2.0] - 2026-10-17

### 🚀 Tính năng mới (Major Features)
- **Kết nối Claude Code CLI Project Sessions thực tế (`~/.claude/projects/`)**:
  - Lệnh `/resume` kết nối trực tiếp với danh sách phiên làm việc thật của Claude Code CLI theo project slug.
  - Tự động bóc tách thông tin phiên từ các file JSONL transcript: ID, tóm tắt prompt, số lượng tin nhắn, model, nhánh git và mốc thời gian.
  - Giao diện Claude Session Hub mới với 2 tab riêng biệt: Tab "Phiên Claude CLI (Project)" và Tab "Phiên HugRemote", hỗ trợ tìm kiếm và khôi phục nhanh (Resume) ngữ cảnh đầy đủ vào chat.
- **Thực thi và Autocomplete Slash Commands chuẩn Claude**:
  - Danh sách gợi ý phẳng 22 slash commands chuẩn Claude CLI / Chat khi nhập `/` ở đầu dòng.
  - Sửa lỗi autocomplete: tự động điền lệnh kèm khoảng cách `/command ` và đưa con trỏ chuột ra sau.
  - Hỗ trợ thao tác cảm ứng mobile (`touchstart`), chuột (`mousedown`) và bàn phím (`Enter`, `Tab`).
  - Lệnh `/clear` hoạt động tức thì trên UI và server, dọn sạch hội thoại kèm Action Toast thông báo.

### 🛠️ Khắc phục sự cố Installer (`install.sh` & `beta.sh`)
- **Tự động khởi động lại Systemd Service khi cài đặt lại**: Sửa lỗi `install.sh` và `beta.sh` chỉ chạy `enable --now || start` (vốn là no-op khi service đang active), chuyển sang kiểm tra và gọi `systemctl --user restart hugremote` để tải ngay mã nguồn mới.
- **Tự động nhận diện thư mục cài đặt hiện có**: Nhận diện đường dẫn từ `~/.local/bin/hugremote` hoặc file cấu hình service systemd để cập nhật đúng thư mục mục tiêu.
- **Bảo đảm Git Checkout không bị xung đột**: Tự động stash các thay đổi cục bộ và thực hiện reset hard về tag/ref mục tiêu.
- **Fallback Release Tag linh hoạt**: Tự động truy vấn git ls-remote khi GitHub API bị giới hạn tần suất (rate-limit).

---

## [v1.1.1] - 2026-10-17

### ⚡ Cải tiến giao diện & Sửa lỗi (Improvements & Fixes)
- **Tối giản hiển thị Claude Thinking**: Loại bỏ hoàn toàn dòng chữ mô tả thừa `Phân tích yêu cầu và codebase`, chỉ giữ lại biểu tượng loading xoay tròn và nhãn `Thinking…` (hoặc `✳ Thinking…`) tinh gọn trên mobile.
- **Đồng bộ mã nguồn Release chính thức**: Cập nhật bản phát hành Release mới nhất đồng bộ đầy đủ các commit mới nhất từ nhánh `main`.

---

## [v1.1.0] - 2026-10-17

### 🚀 Tính năng chính mới (Major Features)
- **Tích hợp Telegram Bot**:
  - Giao tiếp và điều khiển Claude Code thời gian thực trực tiếp từ Telegram với streaming output, tool call cards, thinking block.
  - Hỗ trợ chế độ Topic (Forum / Threaded Mode) để quản lý nhiều phiên làm việc Claude độc lập.
  - Lệnh `/terminal` chạy trực tiếp lệnh Bash trên máy chủ.
  - Hỗ trợ xem output dài qua File Server nội bộ và bảo mật whitelist người dùng `TELEGRAM_ALLOWED_USERS`.
- **Hệ thống CLI Cập nhật & Kiểm tra phiên bản (`hugremote update` & `--version`)**:
  - Lệnh `hugremote update` tự động nhận diện kênh cài đặt (kênh Stable theo GitHub Release chính thức mới nhất, kênh Beta theo nhánh `main`).
  - Hỗ trợ các cờ chuyển kênh: `--stable`, `--beta`, và `--force`.
  - Hỗ trợ chuyển đổi thông minh ký tự gạch ngang di động (`—version`, `–version` sang `--version`).
- **Trình cài đặt 1 lệnh tối ưu (One-Command Installer)**:
  - Tự động phát hiện và cài đặt các môi trường còn thiếu (`git`, `build-essential`, `python3`, `Node.js 20 LTS`).
  - Bảng hướng dẫn cài đặt thủ công rõ ràng theo từng hệ điều hành khi chạy trong môi trường không có sudo.
- **Trình duyệt File từ xa qua SFTP (Remote SFTP File Manager)**:
  - Quản lý tệp tin và thư mục từ xa trên máy chủ SSH / Docker container: tạo mới, đổi tên, xóa, mở chỉnh sửa trực tiếp.
- **Bàn phím ảo Laptop 5 hàng tối ưu Mobile**:
  - Tích hợp bàn phím ảo đầy đủ phím chuyên dụng lập trình (Esc, Tab, Ctrl, Alt, Phím điều hướng, Ký tự đặc biệt) ngay trên màn hình cảm ứng di động.
- **Layout Header 2 tầng (Proposal 9)**:
  - Phân tầng hiển thị Server / Project và Session Pill toàn chiều rộng, tối ưu diện tích trên màn hình di động (390px).
- **Tự động dọn dẹp & giải phóng phiên Terminal (Auto Eviction)**:
  - Tự động đóng phiên terminal không hoạt động sau 30 phút, cơ chế LRU tối đa 50 kết nối tránh nghẽn tài nguyên.

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
