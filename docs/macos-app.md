# HugRemote cho macOS — ứng dụng tùy chọn

Bản web vẫn là cách sử dụng chính: `npm start`, CLI và các bản cập nhật web không phụ thuộc Electron. Ứng dụng macOS chỉ thêm một cửa sổ desktop, khởi chạy bản Fastify riêng trên `127.0.0.1` với cổng ngẫu nhiên và giao diện Vue được đóng gói; đóng cửa sổ là dừng backend do app tạo. Không cài service và không thay đổi bản web đang chạy.

## Build trên Mac

Yêu cầu macOS, Node.js 22, npm, Git và Xcode Command Line Tools để biên dịch native `node-pty` (`xcode-select --install`). Chạy từ checkout của repository:

```bash
npm ci
npm ci --prefix desktop
npm run build:macos
node scripts/smoke_macos_app.mjs
node scripts/smoke_macos_gui.mjs
```

File tạo ở `dist/macos-app/HugRemote-darwin-<arch>/HugRemote.app`, với `<arch>` là `arm64` hoặc `x64` theo máy build. `npm run build:macos` không thay đổi lệnh `npm run build` mặc định. Build riêng trên mỗi kiến trúc; không chép `node_modules` từ Linux/Windows vào `.app`.

Có thể chạy workflow **Optional macOS app** bằng GitHub Actions trên `macos-15` và `macos-15-intel`, nhận hai artifact ZIP (Apple Silicon và Intel). Artifact hiện **chưa ký và chưa notarize**. Gatekeeper có thể từ chối chạy khi tải từ Internet; đây là bản thử nghiệm cho người sở hữu, không phải bản phát hành sẵn sàng phân phối rộng rãi. Muốn phát hành cho người dùng cần Developer ID Application, signing các binary lồng trong app, hardened runtime, Apple notarization và kiểm tra Gatekeeper trên máy sạch.

## Bảo mật và dữ liệu

App chạy backend qua Node đi kèm, chỉ nghe `127.0.0.1` với cổng được chọn khi khởi động. Một secret ngẫu nhiên chỉ tồn tại trong phiên app được gửi bằng HttpOnly cookie; request không có cookie bị từ chối. Không dùng `AUTH_MODE=none` của bản web làm cơ chế bảo vệ desktop. Tuy vậy, ứng dụng chạy với quyền của người dùng hiện tại: chỉ cài bản build đáng tin cậy và không cung cấp tệp app cho người khác khi chưa ký/notarize.

App đọc SSH config và cấu hình người dùng từ home macOS hiện tại. Claude CLI không được đóng gói: cài và đăng nhập riêng; app bổ sung các đường dẫn CLI macOS thường dùng vào `PATH`. Nếu bản web đang chạy, app dùng cổng khác và lưu cấu hình người dùng chung. Thoát app để dừng riêng backend của app; bản web không bị dừng.

**Giới hạn kiểm chứng:** Smoke test CI kiểm tra payload Node, native PTY, trang web, `/api/servers` và khởi chạy cửa sổ Electron cho đến khi Vue render. Việc kiểm tra tương tác GUI sâu hơn, Claude CLI, SSH remote và ký/notarization phải chạy trên Mac với môi trường và tài khoản thật trước khi công bố bản phát hành macOS.
