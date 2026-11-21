# Trạng thái: Khắc phục lỗi Remote Server qua Jump Server trên bản cài macOS

- [2026-11-08] Phân tích thực nghiệm trên Jump Server `jump@203.0.113.10` và `hermes-admin` (`127.0.0.1:2225`) xác định 5 nguyên nhân gốc rễ:
  1. Tiến trình con `ssh -W` của `ProxyJump` không kế thừa `-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null` và không kế thừa custom key `~/.ssh/id_jump_tunnel` khi chạy trong tiến trình GUI `detached: true` không có `/dev/tty` trên macOS -> lỗi `Host key verification failed` / `Permission denied (publickey)`.
  2. `resolveUsablePrivateKey` trong `sshPool.ts` chỉ trả về 1 key đầu tiên (`id_jump_tunnel` hoặc `id_rsa`) thay vì tất cả các key (`id_ed25519`), khiến `ssh2` báo `All configured authentication methods failed`.
  3. `saveOrUpdateSshConfigHost` (`config.ts`:400) và `POST /api/servers` (`api.ts`:94) gọi `normalizeWorkspacePath` làm biến `~` thành `/Users/<mac_user>` trên macOS và làm mất `ProxyJump` khi lưu server.
  4. `spawnNativeSshExec` bắn `exit` trước khi `stdout` đọc hết dữ liệu trong `claudeService.ts`.
  5. `buildNativeSshArgs` đặt `extraArgs` (`-o BatchMode=yes`) sau hostname và chưa có `ControlMaster=auto`.
