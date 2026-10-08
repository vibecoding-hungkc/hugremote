# HugCode — Mobile-First Web IDE Prototype

Phiên bản prototype Web IDE & Terminal tối ưu trải nghiệm Mobile-First.

## Tính năng nổi bật
- **Mobile-First UX:** Bottom navigation tab (Files, Editor, Terminal), layout co giãn tự động theo bàn phím ảo (`visualViewport`).
- **File Manager:** Xem cây thư mục, tạo file/thư mục mới, đổi tên, xóa file, breadcrumb cảm ứng.
- **Code Editor (CodeMirror):** Hỗ trợ highlight syntax đa ngôn ngữ, tự động ngắt dòng (line wrapping), thanh phím ảo cho editor (Undo, Redo, Tab, ngoặc nhọn, dấu câu).
- **Web Terminal (xterm.js + node-pty):** PTY shell tương tác thực tế kết nối WebSocket.
- **Virtual Touch Bar (Accessory Keys):** Dãy phím ảo nổi chuyên dụng cho mobile: `[ESC]`, `[TAB]`, `[CTRL]` (latch mode), `[ALT]`, `[↑↓←→]`, `[^C]`, `[|]`, `[~]`, `[/]`, `[-]`.
- **100% Self-Contained:** Toàn bộ vendor assets (xterm, codemirror) được phục vụ local, không phụ thuộc CDN bên ngoài.

## Cách chạy

### Cách 1: Chạy trực tiếp Node.js
```bash
cd /home/hermes-admin/projects/hugcode
npm start
```
Truy cập: `http://127.0.0.1:8099`

### Cách 2: Chạy bằng Docker Compose
```bash
cd /home/hermes-admin/projects/hugcode
docker compose up -d --build
```
Truy cập: `http://localhost:8099`
