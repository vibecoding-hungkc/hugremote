---
feature: macos-jump-server-ssh-fix
description: Fix all remaining SSH Jump Server (ProxyJump / ProxyCommand / multi-key auth / non-interactive host-key / macOS local workspace leak) issues on macOS desktop build.
status: done
created: 2026-11-08
---
# Khắc phục triệt để lỗi kết nối & làm việc với Remote Server qua Jump Server trên bản cài macOS

## Goal
1. **Khắc phục lỗi `Host key verification failed` & `Permission denied (publickey)` ở chặng Jump Server (`ProxyJump` / `ProxyCommand`) khi chạy từ ứng dụng GUI macOS (`HugRemote.app`, `detached: true`, không có `/dev/tty`):**
   - Khi OpenSSH chạy `ProxyJump`, tiến trình con `ssh -W` mặc định không kế thừa `-o StrictHostKeyChecking=no` và không kế thừa các file key khác trong `~/.ssh/` (như `~/.ssh/id_jump_tunnel`).
   - `buildProxyCommandFromJump()` và `buildNativeSshArgs()` tự động truyền `-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes` cùng tất cả các `-i <key>` hợp lệ có trong `~/.ssh/` (từ `getAvailableSshKeys()`) cho cả chặng Jump Server lẫn chặng Target Server.
   - Bật OpenSSH Connection Multiplexing (`-o ControlMaster=auto -o ControlPath=/tmp/hugremote-ssh-%C -o ControlPersist=10m`) cho native SSH để 5 tác vụ đồng thời (`fs`, `git`, `claude sessions`, `claude models`, `terminal`) dùng chung 1 đường hầm qua Jump Server mà không làm nghẽn `MaxStartups` hoặc `autossh` reverse tunnel.
2. **Khắc phục lỗi `ssh2` chỉ thử duy nhất 1 key đầu tiên (`resolveUsablePrivateKey`) khiến `All configured authentication methods failed` khi máy Mac có nhiều key (`id_jump_tunnel`, `id_rsa`, `id_ed25519`):**
   - Đổi sang `resolveUsablePrivateKeys(target): Buffer[]` trả về toàn bộ các private key không mã hóa trong `target.identityFiles` và `~/.ssh/`.
   - Cấu hình `authHandler` của `ssh2` thử lần lượt tất cả các `publickey` trong danh sách, sau đó tới `agent` (hỗ trợ cả `IdentityAgent` trong `~/.ssh/config` và `ssh-add --apple-load-keychain` trên macOS) và `password` / `keyboard-interactive`.
3. **Khắc phục lỗi rò rỉ đường dẫn macOS `/Users/<mac_user>` sang Remote Linux Server và mất `ProxyJump` khi lưu cấu hình Server:**
   - Thêm `sanitizeRemoteWorkspacePath()` trong `apps/api/src/config.ts` để tự động chuyển `/Users/<mac_user>` (bị lưu nhầm từ các bản cũ) về `~` cho Remote SSH Server trong `parseSshConfig()`, `saveOrUpdateSshConfigHost()`, `POST /api/servers`, `fsService.resolveRemotePath()`, `gitService.ts`, và `claudeService.ts`.
   - Bảo toàn `proxyJump` và `proxyCommand` khi cập nhật server qua `POST /api/servers`, đồng thời cho phép nhập/chỉnh `ProxyJump` ngay trong `ServerModal.vue`.
   - Sửa race condition `stream.on('exit', resolve)` trong `spawnNativeSshExec` và `claudeService.ts` để đảm bảo đọc trọn vẹn `stdout` trước khi đóng stream.
4. **Hỗ trợ "Cập nhật nhanh" ngay trong bản cài macOS (`HugRemote.app`):**
   - Đóng gói kèm thư mục `bin/` và `scripts/` trong `scripts/build_macos_app.mjs` và ưu tiên nạp bản cập nhật mới từ `~/.local/share/hugremote/current` trong `desktop/main.cjs`.

## Acceptance Criteria
- [x] AC1: `buildProxyCommandFromJump` và `buildNativeSshArgs` bao gồm `-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`, truyền đầy đủ `-i <key>` cho các key trong `~/.ssh/` (bao gồm custom key như `id_jump_tunnel`), bật `ControlMaster=auto`, và đặt cờ SSH trước tên host — Evidence: `npx tsx scripts/test_ssh_ws_and_system_update.ts` PASS.
- [x] AC2: `resolveUsablePrivateKeys` trả về tất cả các key hợp lệ trong `~/.ssh/` (không chỉ key đầu tiên) để `ssh2` xác thực thành công khi máy Mac có nhiều key (`id_jump_tunnel` cho jump server, `id_ed25519` cho target server) — Evidence: `npx tsx scripts/test_ssh_ws_and_system_update.ts` PASS & real Jump Server `jump@203.0.113.10` -> `127.0.0.1:2225` live test PASS (`REAL JUMP SERVER FS LIST COUNT: 32`, `REAL JUMP SERVER EXEC: hungpc | hungnd | /home/hungnd`).
- [x] AC3: `parseSshConfig`, `saveOrUpdateSshConfigHost`, `POST /api/servers`, và `fsService.resolveRemotePath` không bao giờ biến `~` của Remote SSH Server thành `/Users/<mac_user>` trên macOS, tự động sửa lại các `# Workspace /Users/<mac_user>` cũ về `~`, và bảo toàn `ProxyJump` / `ProxyCommand` — Evidence: `npx tsx scripts/test_ssh_ws_and_system_update.ts` PASS.
- [x] AC4: `spawnNativeSshExec` đảm bảo phát hết dữ liệu `stdout` trước khi phát `exit`/`close` để `claudeService` và `gitService` không bị mất dữ liệu khi chạy qua Jump Server — Evidence: `npx tsx scripts/test_ssh_ws_and_system_update.ts` PASS.
- [x] AC5: Toàn bộ bộ test (`npm run build`, `npm run test:ui`, `npm run test:desktop`, `npm run test:update`, `npm run test:security`, `npm run test:git`) đều PASS.
