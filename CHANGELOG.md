# 📋 Changelog — HugRemote

Tất cả những thay đổi, bản vá lỗi và tính năng mới của HugRemote sẽ được ghi nhận tại đây.

---

## [v1.0.1] - 2026-10-09

### 🐛 Sửa lỗi (Bug Fixes)
- **macOS / MacBook: Sửa lỗi `posix_spawnp failed` trong Terminal**:
  - Gói `node-pty@1.1.0` trên npm đóng gói binary trợ năng `spawn-helper` cho macOS với quyền `0644` (thiếu quyền thực thi `+x`).
  - Đã thêm hàm `ensureDarwinPtyExecutable()` tự động dò tìm và gán quyền `chmod 0755` cho mọi binary `spawn-helper` (`prebuilds/darwin-arm64`, `prebuilds/darwin-x64`, `build/Release`).
  - Tự động fallback sang `/bin/zsh` hoặc `/bin/sh` an toàn nếu shell mặc định không khởi chạy được.
- **macOS: Tối ưu phím xterm chống lặp ký tự**:
  - Bổ sung cấu hình `macOptionIsMeta: true` và `macOptionClickForcesSelection: true` vào `@xterm/xterm`.
- **Khắc phục lỗi `ReferenceError: watch is not defined`**:
  - Bổ sung import `watch` từ Vue trong `client/src/stores/terminalStore.ts`.
- **Xử lý xung đột đường dẫn đọc/lưu file với Cloudflare Tunnel**:
  - Chuyển router đọc/lưu file từ `/api/file` sang `/api/fs/read` và `/api/fs/save` nhằm tránh bị Cloudflare Tunnel bắt nhầm định tuyến sang dịch vụ khác.
- **Sửa lỗi mở file Markdown (`.md`)**:
  - Hỗ trợ xem trước định dạng Markdown và chỉnh sửa qua CodeMirror, mở liên kết trong tab mới an toàn.

### ⚡ Cải tiến & Tính năng mới (Improvements & New Features)
- **Thư mục Workspace mặc định linh hoạt (`~/`)**:
  - Khi không truyền `--workspace` và biến môi trường `WORKSPACE_ROOT` không được đặt, hệ thống tự động nhận diện thư mục Home (`~` / `os.homedir()`), không còn ép buộc vào `~/projects`.
  - Toàn bộ cây thư mục máy chủ được hiển thị ngay lập tức khi mở Web IDE.
- **Bổ sung script cài đặt `beta.sh`**:
  - Cho phép người dùng cập nhật hoặc cài đặt trực tiếp từ nhánh `main` mới nhất:
    ```bash
    curl -fsSL https://raw.githubusercontent.com/vibecoding-hungkc/hugremote/main/beta.sh | bash
    ```
- **Tự động lưu và phát hiện cấu hình cũ khi Update**:
  - Cả `install.sh` và `beta.sh` tự động nhận diện file `~/.config/hugremote/.env` đã có từ lần cài trước.
  - Người dùng có thể nhấn Enter (`Y`) để bỏ qua các câu hỏi wizard và cập nhật nhanh chóng.
- **Xử lý chuyển nhánh mượt mà trên Shallow Clone Git**:
  - Tự động cấu hình refspec `+refs/heads/*:refs/remotes/origin/*` giúp chuyển đổi giữa tag và nhánh `main` mà không bị lỗi `detached HEAD`.

---

## [v1.0.0] - 2026-10-09

### 🚀 Phiên bản phát hành chính thức đầu tiên
- **Mobile-First Web IDE & Multi-Window Terminal**: Tối ưu 100% cho màn hình cảm ứng điện thoại thông minh, bàn phím trợ năng lập trình.
- **Tích hợp sâu Claude Code Coding Assistant**: Giao diện Chat trực quan với tool-call cards, diff, duyệt cây thư mục chọn session và dashboard theo dõi quota.
- **Hệ thống xác thực 3 chế độ (Auth Modes)**:
  - `none`: Chạy không mật khẩu cho localhost / môi trường đã có Zero Trust.
  - `password`: Mật khẩu khởi tạo `123456`, bắt buộc đổi lần đầu, mã hóa băm PBKDF2-SHA512 an toàn.
  - `google`: Xác thực qua Google OAuth 2.0 whitelist danh sách email.
- **Bảo mật chuyên sâu (Pentest-Hardened)**:
  - Phòng chống CSWSH (Cross-Site WebSocket Hijacking).
  - Khóa chặt CORS domain whitelist.
  - Chống Path Traversal và Symlink Traversal Escape bằng `realpathSync`.
  - Rate limiter bảo vệ brute-force đăng nhập.
