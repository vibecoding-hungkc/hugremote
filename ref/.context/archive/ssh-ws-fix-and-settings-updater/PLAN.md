---
feature: ssh-ws-fix-and-settings-updater
description: Fix macOS WebSocket & SSH server connection issues (SSH agent/default keys/Host * inheritance, native ssh PTY fallback, and non-blocking session initialization) and implement version check + quick update in SettingsView.
status: done
created: 2026-11-06
---
# Sửa lỗi WebSocket với SSH Server trên macOS & Triển khai Cập nhật Phiên bản nhanh trong Cài đặt

## Goal
1. **Khắc phục triệt để lỗi WebSocket khi làm việc với SSH Server trên bản cài macOS (`HugRemote.app`):**
   - **Backend (`sshPool.ts`, `ws.ts`):**
     - `sshPool.getClient()` deduplicate các kết nối SSH đang mở đồng thời (`connecting`), hỗ trợ `SSH_AUTH_SOCK` (bao gồm đọc `launchctl getenv SSH_AUTH_SOCK` trên macOS khi chạy từ GUI app), tự động dò default SSH keys (`~/.ssh/id_ed25519`, `id_ecdsa`, `id_rsa`, `id_dsa`) mà không làm crash khi gặp key mã hóa passphrase, và hỗ trợ `keyboard-interactive`.
     - `sshPool.createShell()` và `sshPool.executeCommand()` tự động fallback sang tiến trình `/usr/bin/ssh` hệ thống (`node-pty` / `child_process.spawn`) khi `ssh2` không thể kết nối trực tiếp (ví dụ host dùng `ProxyCommand`, `ProxyJump`, Apple Keychain `UseKeychain`, 1Password `IdentityAgent`).
     - `ws.ts` gắn listener `message`/`close`/`error` ngay khi nâng cấp WebSocket (trước `await sessionManager.getOrCreateSession`) để không làm rơi gói tin `resize` hoặc treo kết nối khi SSH handshake mất thời gian.
   - **Frontend (`App.vue`, `TerminalView.vue`):**
     - Trong `App.vue` (`handleScopeChanged()`): gọi `terminalStore.ensureServerSession()` ngay đầu hàm (trước `await fileStore.fetchFiles()`) để khi chuyển sang SSH server, `terminalStore.activeSession` có mặt tức thì, không bao giờ bị `null`.
     - Trong `TerminalView.vue`: không bật cờ `isDisconnected = true` khi chủ động đóng socket cũ để chuyển server/session, và tự động đảm bảo `ensureServerSession()` trong `connectWebSocket()`.
2. **Triển khai tính năng Kiểm tra & Update Version nhanh trong màn hình Cài đặt (`SettingsView.vue`, `systemUpdateService.ts`, `api.ts`, `prototype.html`):**
   - Backend cung cấp `GET /api/system/version` và `POST /api/system/update`.
   - Màn hình `Cài đặt` (`SettingsView.vue` và `analysis/prototypes/prototype.html`) có khối **Phiên bản & Cập nhật** (`#settings-version-card`) hiển thị phiên bản hiện tại, trạng thái có bản cập nhật mới (`#version-status-badge`), nút **Kiểm tra** (`#btn-check-update`) và nút **Cập nhật ngay** (`#btn-quick-update`).

## Acceptance Criteria
- [x] AC1: Khi chọn SSH Server trên `App.vue` / `TerminalView.vue`, `terminalStore.ensureServerSession()` được gọi ngay lập tức trước mọi lời gọi mạng SFTP/API, `TerminalView.vue` mở kết nối WebSocket ngay mà không hiện báo lỗi giả `isDisconnected = true` — Evidence: `scripts/test_ssh_ws_and_system_update.ts` PASS.
- [x] AC2: `sshPool` deduplicate các kết nối đồng thời, truyền `agent` (`SSH_AUTH_SOCK`), đọc default keys an toàn (bỏ qua key mã hóa passphrase không có passphrase để tránh throw lỗi đồng bộ), hỗ trợ `keyboard-interactive`, và tự động fallback sang native `ssh` PTY/process khi `ssh2` không kết nối được — Evidence: `scripts/test_ssh_ws_and_system_update.ts` PASS.
- [x] AC3: `ws.ts` gắn trình xử lý `message`/`close`/`error` ngay từ đầu kết nối WebSocket và xếp hàng các bản tin gửi đến trong lúc đang chờ `getOrCreateSession()` — Evidence: `apps/api/src/routes/ws.ts` & `npm run build` PASS.
- [x] AC4: API `GET /api/system/version` và `POST /api/system/update` hoạt động chính xác; màn hình `Cài đặt` (`SettingsView.vue` và `prototype.html`) hiển thị khối `#settings-version-card` với phiên bản hiện tại, báo hiệu khi có phiên bản mới (`#version-status-badge`), nút `#btn-check-update` và nút `#btn-quick-update` — Evidence: `curl -s http://127.0.0.1:8099/remote/api/system/version` và `browser_exec` (`cardWidth: 748` trên desktop, `cardWidth: 358` trên mobile `390x844`).
- [x] AC5: Toàn bộ bài test (`npx tsx scripts/test_ssh_ws_and_system_update.ts`, `npm run test:ui`, `node scripts/test_ui_prototype_shortcuts.mjs`, `npm run build`) đều PASS và kiểm chứng trên trình duyệt thật (`browser_exec`) tại `http://127.0.0.1:8099/remote/`.

## Tasks
- [x] T1: Viết bài test `scripts/test_ssh_ws_and_system_update.ts` và cập nhật `scripts/test_ui_shortcuts_and_universal_folder.mjs` + `scripts/test_ui_prototype_shortcuts.mjs` (xác nhận RED).
- [x] T2: Sửa lỗi SSH & WebSocket trong `sshPool.ts`, `ws.ts`, `App.vue`, `TerminalView.vue`.
- [x] T3: Xây dựng `systemUpdateService.ts`, các route `/api/system/version` & `/api/system/update`, và khối giao diện `#settings-version-card` trong `SettingsView.vue` + `analysis/prototypes/prototype.html`.
- [x] T4: Chạy toàn bộ test, build, cập nhật bản chạy local, kiểm chứng bằng `browser_exec`, merge vào `main` và push.
