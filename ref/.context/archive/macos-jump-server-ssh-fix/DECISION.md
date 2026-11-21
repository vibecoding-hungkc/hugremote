# Quyết định kỹ thuật: Jump Server & Remote SSH trên macOS

1. **Chuyển `ProxyJump` thành `ProxyCommand` tường minh kèm `-i <keys>` và `StrictHostKeyChecking=no` cho cả `ssh2` lẫn `/usr/bin/ssh`:**
   - Khi OpenSSH thực thi `ProxyJump`, nó tự spawn `ssh -W '[%h]:%p' <jump>` nhưng không truyền `-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null` từ lệnh cha xuống tiến trình con, và cũng không truyền các custom key trong `~/.ssh/` (như `id_jump_tunnel`) nếu người dùng không khai báo stanza `Host` riêng cho IP của Jump Server.
   - Giải pháp: `buildProxyCommandFromJump` tự động đính kèm `-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes` và `-i <key>` cho mọi private key không mã hóa trong `~/.ssh/`. Cả `ssh2` (`createProxyCommandDuplex`) và `/usr/bin/ssh` (`buildNativeSshArgs`) đều sử dụng `ProxyCommand` đã chuẩn hóa này.
2. **Thử toàn bộ danh sách Private Keys trong `ssh2` thông qua `authHandler`:**
   - Thay vì chỉ truyền 1 `privateKey` đầu tiên vào `conn.connect()`, sử dụng `resolveUsablePrivateKeys(target)` thu thập toàn bộ các key hợp lệ và truyền mảng `authHandler` cho `ssh2` để thử lần lượt từng key, sau đó mới tới `agent` và `password`.
3. **Tự động sửa đường dẫn `/Users/<mac_user>` bị rò rỉ sang Remote SSH Server:**
   - Thêm `sanitizeRemoteWorkspacePath()` để mọi đường dẫn `/Users/<localMacUser>` trên SSH server tự động quy về `~` (hoặc `~/...`), đồng thời trong `fsService.listRemote()` tự động fallback về thư mục `$HOME` thực tế trên remote server nếu đường dẫn cấu hình không tồn tại.
