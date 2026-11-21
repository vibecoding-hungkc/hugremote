# Quyết định kỹ thuật: macos-icon-and-ssh-proxyjump-fix

1. **Đóng gói `.icns` trực tiếp từ `apps/api/public/favicon.svg`:**
   - Render `favicon.svg` ra các ảnh PNG chuẩn (`16, 32, 64, 128, 256, 512, 1024`) và đóng gói thành container Apple ICNS (`desktop/icon.icns`) kèm `desktop/icon.png` (`512x512`).
   - Truyền `icon` vào `@electron/packager` để macOS Finder/Dock/Launchpad nhận đúng `HugRemote.icns`.
2. **Hỗ trợ `ProxyCommand` / `ProxyJump` (`ssh -G`) qua `sock: Duplex` trong `ssh2` + Fallback qua `/usr/bin/ssh` cho cả `fsService`:**
   - Khi host có `ProxyJump` hoặc `ProxyCommand` (từ `~/.ssh/config`, các file `Include` hoặc `ssh -G`), `sshPool.getClient()` khởi chạy tiến trình proxy (ví dụ `ssh -W '[%h]:%p' <jump>` hoặc `ProxyCommand` đã nội suy `%h`, `%p`, `%r`) và bọc `stdin`/`stdout` thành `Duplex` stream truyền vào `conn.connect({ sock })` của `ssh2`.
   - Nếu `ssh2` / SFTP vẫn không kết nối được (ví dụ do khóa lưu trong Apple Keychain `UseKeychain` hoặc 1Password `IdentityAgent`), toàn bộ `fsService` (`listRemote`, `readRemoteFile`, `writeRemoteFile`, `createRemote`, `deleteRemote`, `renameRemote`), `/api/fs/download`, `/api/fs/upload` và `tempZipService` tự động fallback sang thực thi qua `sshPool.executeCommand()` (`/usr/bin/ssh <alias>`).
