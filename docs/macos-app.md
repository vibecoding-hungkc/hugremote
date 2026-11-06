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

File tạo ở `dist/macos-app/HugRemote-darwin-<arch>/HugRemote.app` và bộ cài đặt `dist/macos-app/HugRemote-macOS-<arch>.dmg`, với `<arch>` là `arm64` hoặc `x64` theo máy build. Quá trình build tự động ký ad-hoc (`codesign --sign -`) toàn bộ binary Mach-O lồng bên trong (`node`, `node-pty`, `spawn-helper`), kiểm tra chữ ký nghiêm ngặt bằng `codesign --verify --deep --strict` và đóng gói file `.dmg` có sẵn lối tắt `/Applications` để kéo-thả cài đặt. `npm run build:macos` không thay đổi lệnh `npm run build` mặc định. Build riêng trên mỗi kiến trúc; không chép `node_modules` từ Linux/Windows vào `.app`.

Có thể chạy workflow **Optional macOS app** bằng GitHub Actions trên `macos-15` và `macos-15-intel`, nhận hai bộ cài `.dmg` (`HugRemote-macOS-arm64-dmg` cho Apple Silicon và `HugRemote-macOS-x64-dmg` cho Intel).

## Cài đặt từ file `.dmg` và xử lý cảnh báo Gatekeeper

1. Mở file `HugRemote-macOS-arm64.dmg` hoặc `HugRemote-macOS-x64.dmg`.
2. Kéo `HugRemote.app` thả vào thư mục `Applications`.
3. Do gói `.dmg` trên CI mới được ký ad-hoc (`codesign --sign -`), chưa ký bằng chứng chỉ trả phí **Apple Developer ID Application** và chưa **notarize** với Apple, khi tải qua trình duyệt macOS sẽ gắn thuộc tính cách ly `com.apple.quarantine` và có thể báo `“HugRemote” is damaged and can’t be opened. You should move it to the Trash.` hoặc chặn mở lần đầu. Sau khi kéo vào `Applications`, chạy lệnh sau trong Terminal để gỡ cờ quarantine:

```bash
xattr -cr /Applications/HugRemote.app
```

Sau đó mở `HugRemote` từ `/Applications` hoặc Launchpad bình thường. Muốn phân phối công khai mà không cần gỡ quarantine cần chứng chỉ Developer ID Application, hardened runtime và Apple notarization (`xcrun notarytool` + `xcrun stapler staple`).

## Bảo mật và dữ liệu

App chạy backend qua Node đi kèm, chỉ nghe `127.0.0.1` với cổng được chọn khi khởi động. Một secret ngẫu nhiên chỉ tồn tại trong phiên app được gửi bằng HttpOnly cookie; request không có cookie bị từ chối. Không dùng `AUTH_MODE=none` của bản web làm cơ chế bảo vệ desktop. Tuy vậy, ứng dụng chạy với quyền của người dùng hiện tại: chỉ cài bản build đáng tin cậy và không cung cấp tệp app cho người khác khi chưa ký/notarize.

App đọc SSH config và cấu hình người dùng từ home macOS hiện tại. Claude CLI không được đóng gói: cài và đăng nhập riêng; app bổ sung các đường dẫn CLI macOS thường dùng vào `PATH`. Nếu bản web đang chạy, app dùng cổng khác và lưu cấu hình người dùng chung. Thoát app để dừng riêng backend của app; bản web không bị dừng.

**Giới hạn kiểm chứng:** Smoke test CI kiểm tra payload Node, native PTY, trang web, `/api/servers` và khởi chạy cửa sổ Electron cho đến khi Vue render. Việc kiểm tra tương tác GUI sâu hơn, Claude CLI, SSH remote và ký/notarization phải chạy trên Mac với môi trường và tài khoản thật trước khi công bố bản phát hành macOS.
