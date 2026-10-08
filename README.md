# 🐴 HugCode (HugRemote) — Mobile-First Web IDE & Terminal

> **Web IDE, Terminal Đa Cửa Sổ và Trợ lý Lập trình Claude Code tối ưu 100% cho điện thoại di động.**

---

## ⚡ Cài đặt nhanh

### Cách 1: Cài đặt 1 dòng lệnh bằng curl (Khuyên dùng)
```bash
curl -fsSL https://raw.githubusercontent.com/vibecoding-hungkc/hugremote/packaged/install.sh | bash
```
*Script sẽ tự động kiểm tra Node.js >= 18, build frontend/backend, tạo lệnh CLI `hugcode` và cấu hình systemd service chạy ngầm.*

### Cách 2: Chạy trực tiếp qua npm / npx
```bash
# Chạy tức thì không cần cài:
npx hugcode

# Hoặc cài đặt global:
npm install -g hugcode
hugcode
```

### Cách 3: Chạy từ mã nguồn Git
```bash
git clone -b packaged https://github.com/vibecoding-hungkc/hugremote.git
cd hugremote
./install.sh
```

---

## 🚀 Cách sử dụng CLI

```bash
# Khởi chạy mặc định (Port 8099, bind :: dual-stack)
hugcode

# Đổi cổng lắng nghe
hugcode -p 3000

# Chạy với đường dẫn con Subpath (cho Cloudflare Tunnel / Reverse Proxy / Nginx)
hugcode -p 8099 -b /remote

# Tùy chỉnh thư mục Workspace và giới hạn truy cập
hugcode -w ~/my-projects -a ~/
```

### Tùy chọn CLI:
| Tham số | Ý nghĩa | Mặc định |
|---|---|---|
| `-p, --port <number>` | Cổng lắng nghe HTTP & WebSocket | `8099` (hoặc `$PORT`) |
| `-h, --host <ip>` | Địa chỉ IP lắng nghe | `::` (hoặc `$HOST`) |
| `-b, --base-path <path>` | Tiền tố đường dẫn subpath (vd: `/remote`) | `""` (hoặc `$BASE_PATH`) |
| `-w, --workspace <dir>` | Thư mục khởi chạy mặc định | `~/projects` |
| `-a, --allowed-root <dir>` | Thư mục gốc cho phép duyệt file | `~` |
| `-v, --version` | Xem phiên bản | `1.0.0` |
| `--help` | Xem trợ giúp lệnh | |

---

## 📱 Tính năng nổi bật

### 1. Trải nghiệm Mobile-First 100%
- Giao diện thiết kế theo chuẩn iOS Standalone PWA, thích ứng hoàn hảo với tai thỏ (*notch*), Dynamic Island và Home Indicator bar.
- Khóa chống rung lắc vuốt ngang (`touch-action: pan-y`, `overscroll-behavior-x: none`).
- Toàn bộ thao tác file, đổi tên, xác nhận đều dùng Bottom-Sheet Modal vuốt cảm ứng thay cho alert/prompt native trình duyệt.

### 2. Terminal Đa Cửa Sổ & Multi-Server SSH
- Shell PTY thực tế tương tác WebSocket (kết nối PTY host hoặc SSH từ xa qua `~/.ssh/config`).
- Gõ trực tiếp ngay con trỏ terminal trên bàn phím ảo điện thoại.
- Khay phím tắt chuyên dụng cho mobile: `Esc`, `Tab`, `Ctrl+C`, `Enter`, 4 phím điều hướng, kèm bảng phím mở rộng (Ctrl combos, Git macros, shell operators).
- Đổi tên, chỉnh sửa thư mục khởi chạy (`cwd`) và quản lý đa cửa sổ độc lập.

### 3. Trợ lý Lập trình Claude Code AI (Extension Style)
- Giao diện webview chuẩn của extension Claude Code chính thức cho VS Code / code-server.
- Kết nối trực tiếp Claude CLI thật (`claude -p` binary), stream realtime Thinking và Task Execution Cards (Read, Edit Diff, Bash).
- Hỗ trợ đổi Model (`Sonnet`, `Opus`), 4 mức Effort (`Low`, `Medium`, `High`, `Max`).
- Nút bảo vệ quyền (Shield icon) bật/tắt Bypass Permissions (`--dangerously-skip-permissions`) tức thì ngay thanh chat.
- Nút Send tự động chuyển thành nút Stop màu đỏ để ngắt tiến trình bằng `SIGINT`.
- Thanh phím tắt nhanh: `⇧ Enter` (xuống dòng), `Ctrl+C` (copy), `Ctrl+V` (paste).

### 4. Quản lý Tệp & Trình soạn thảo Code
- Quản lý cây thư mục, tạo mới, đổi tên, xóa tệp tin / thư mục an toàn.
- Xem trước Markdown dạng HTML với nút chuyển đổi nhanh giữa Xem và Sửa.
- Highlight cú pháp đa ngôn ngữ (JavaScript, TypeScript, Python, HTML, CSS, JSON, Markdown, Bash).

---

## 🛠️ Quản lý chạy ngầm với Systemd (Linux)

```bash
# Khởi động dịch vụ nền
systemctl --user start hugcode

# Bật tự động khởi động cùng hệ thống
systemctl --user enable hugcode

# Xem trạng thái hoạt động
systemctl --user status hugcode

# Khởi động lại
systemctl --user restart hugcode

# Dừng dịch vụ
systemctl --user stop hugcode
```

---

## 📄 Bản quyền
Phát hành theo giấy phép [MIT](LICENSE).
