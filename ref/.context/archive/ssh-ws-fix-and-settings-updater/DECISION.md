# Quyết định thiết kế: Sửa lỗi WebSocket SSH trên macOS & Cập nhật Phiên bản nhanh trong Cài đặt

## 2026-11-06
1. **Kết nối SSH & WebSocket trên macOS:**
   - Kết hợp `ssh2` (với `SSH_AUTH_SOCK`, default keys không mã hóa passphrase, `Host *` config inheritance, `tryKeyboard: true`, và connection deduplication) cùng cơ chế **fallback tự động sang `/usr/bin/ssh` qua `node-pty` / `child_process.spawn`**. Khi người dùng trên macOS dùng `ProxyCommand`, `ProxyJump`, Apple Keychain (`UseKeychain yes`), 1Password SSH Agent (`IdentityAgent`) hoặc cấu hình OpenSSH đặc thù mà `ssh2` không hỗ trợ, Terminal WebSocket và lệnh từ xa vẫn hoạt động liền mạch qua binary `ssh` hệ thống.
   - Trong `App.vue` (`handleScopeChanged`), gọi `terminalStore.ensureServerSession()` ngay đầu hàm trước mọi `await` mạng để `TerminalView.vue` luôn có `activeSession` ngay khi chuyển sang SSH server.
2. **Kiểm tra & Cập nhật phiên bản trong màn hình Cài đặt (`#settings-version-card`):**
   - Tách logic kiểm tra phiên bản (`checkSystemVersion`) và thực thi cập nhật (`triggerSystemUpdate`) vào `apps/api/src/services/systemUpdateService.ts`, có thể inject fetcher/runner trong bài test để kiểm thử đơn vị nhanh và tất định.
