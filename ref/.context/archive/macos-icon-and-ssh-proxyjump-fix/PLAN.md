---
feature: macos-icon-and-ssh-proxyjump-fix
description: Use web favicon as macOS .app/.dmg icon and fix ECONNREFUSED when working with remote SSH servers using ProxyJump/ProxyCommand/Include/non-direct SFTP on macOS.
status: done
created: 2026-11-07
---
# Đồng bộ Icon macOS giống Favicon Web & Khắc phục triệt để lỗi Connect Refused với Remote SSH Server

## Goal
1. **Đồng bộ Icon của bản cài macOS (`HugRemote.app` / `.dmg`) giống hệt Favicon của bản Web (`apps/api/public/favicon.svg`):**
   - Từ `apps/api/public/favicon.svg`, tạo bộ icon chuẩn macOS `desktop/icon.icns` (chứa đầy đủ các chunk PNG đa độ phân giải `16x16` đến `1024x1024`: `ic07`, `ic08`, `ic09`, `ic10`, `ic11`, `ic12`, `ic13`, `ic14`) và `desktop/icon.png` (`512x512`).
   - Cấu hình `makePackagerOptions` trong `desktop/packager-options.mjs` truyền `icon` trỏ tới `desktop/icon.icns`, copy `icon.png` vào `shellDir` trong `scripts/build_macos_app.mjs`, và đặt `icon` cho `BrowserWindow` + `app.dock.setIcon(...)` trong `desktop/main.cjs`.
   - Kiểm tra trong `scripts/smoke_macos_app.mjs` trên macOS CI rằng `Contents/Info.plist` và `Contents/Resources/HugRemote.icns` được đóng gói đúng icon của HugRemote.
2. **Khắc phục triệt để lỗi `connect ECONNREFUSED` khi làm việc với Remote Server trên bản cài macOS:**
   - **Phân tích nguyên nhân gốc rễ (Root Cause):**
     - Khi một Remote Server trong `~/.ssh/config` trên macOS (như `hermes-admin`) kết nối qua reverse tunnel / jump host (`HostName 127.0.0.1`, `Port 2225`, `ProxyJump jump@...` hoặc `ProxyCommand ...`), cổng `127.0.0.1:2225` là cổng loopback trên máy Jump Server chứ không phải trên máy Mac!
     - Trước đây `parseSshConfig()` bỏ qua `ProxyJump` / `ProxyCommand` và `sshPool.getClient()` dùng `ssh2` mở kết nối TCP trực tiếp tới `127.0.0.1:2225` trên máy Mac -> dính lỗi `connect ECONNREFUSED 127.0.0.1:2225`.
     - Đồng thời, `fsService` (`listRemote`, `readRemoteFile`, `writeRemoteFile`, `createRemote`, `deleteRemote`, `renameRemote`) và `/api/fs/download`, `/api/fs/upload`, `tempZipService` chỉ gọi `sshPool.getSftp(server)` (bắt buộc `ssh2` phải kết nối trực tiếp thành công) mà không có cơ chế đi qua `ProxyJump`/`ProxyCommand` hay fallback sang `/usr/bin/ssh`.
     - Ngoài ra, `buildNativeSshArgs()` chỉ kiểm tra alias trên `~/.ssh/config` gốc mà quên kiểm tra các file được `Include`, và vẫn truyền `-p <port>` đè lên cấu hình alias.
   - **Giải pháp 3 tầng:**
     - **Tầng 1 (`config.ts`):** `parseSshConfig()` đọc đầy đủ `ProxyJump` và `ProxyCommand`, hỗ trợ nhiều alias trên cùng một dòng `Host`, đóng block khi gặp `Match`, kế thừa cấu hình từ `Host *` theo chuẩn first-match wins của OpenSSH, dùng `os.userInfo().username` làm user mặc định chuẩn OpenSSH, và export `listSshConfigFiles()` + `hasSshHostAlias()`.
     - **Tầng 2 (`sshPool.ts`):**
       - Nạp đầy đủ `PATH` trên macOS (bao gồm `/opt/homebrew/bin`, `/opt/homebrew/sbin`, `/usr/local/bin`, `~/.local/bin`, `~/.orbstack/bin` và login shell `PATH`) cùng `SSH_AUTH_SOCK`.
       - Phân giải cấu hình hiệu lực của host bằng `resolveEffectiveSshConfig(server)` (kết hợp `ssh -G <alias>` của OpenSSH và `ServerConfig`).
       - Khi host có `proxyCommand` hoặc `proxyJump` (hoặc khi kết nối TCP trực tiếp bị `ECONNREFUSED`), `sshPool.getClient()` tự động tạo luồng `sock: Duplex` qua `ProxyCommand` / `ssh -W` để cả `ssh2` lẫn `getSftp()` chạy xuyên qua đường hầm `ProxyJump` / `ProxyCommand`!
       - Trong `buildNativeSshArgs()`, kiểm tra alias trên toàn bộ `listSshConfigFiles()`; khi alias tồn tại trong SSH config thì gọi trực tiếp `ssh <alias>` (hoặc truyền `-J` / `-o ProxyCommand=...` nếu không phải alias).
     - **Tầng 3 (`fsService.ts`, `api.ts`, `tempZipService.ts`):**
       - Bổ sung cơ chế fallback tự động qua `sshPool.executeCommand` (tức `/usr/bin/ssh`) cho toàn bộ thao tác file remote (`listRemote`, `readRemoteFile`, `writeRemoteFile`, `createRemote`, `deleteRemote`, `renameRemote`, `downloadRemoteStream`, `uploadRemoteBuffer`, `createRemoteZip`) khi `sshPool.getSftp(server)` không khả dụng.

## Acceptance Criteria
- [x] AC1: `desktop/icon.icns` và `desktop/icon.png` được sinh từ `apps/api/public/favicon.svg`; `makePackagerOptions` truyền `icon` trỏ tới `desktop/icon.icns` và `desktop/main.cjs` gắn `icon.png` cho `BrowserWindow` + `app.dock` — Evidence: `node scripts/test_desktop_packager_options.mjs` PASS.
- [x] AC2: `parseSshConfig()` phân tích chính xác `ProxyJump`, `ProxyCommand`, nhiều alias trên một dòng `Host`, đóng block khi gặp `Match`, kế thừa `Host *` và nhận diện alias trong cả các file `Include` — Evidence: `npx tsx scripts/test_ssh_ws_and_system_update.ts` PASS.
- [x] AC3: Với một Remote Server cấu hình `HostName 127.0.0.1` + một cổng đóng trên máy local (gây `ECONNREFUSED` nếu kết nối TCP trực tiếp) nhưng có `ProxyCommand` / `ProxyJump` (hoặc qua native `ssh`), cả `sshPool.getClient()`, `sshPool.createShell()`, `sshPool.executeCommand()` và `fsService.listRemote()` / `readRemoteFile()` / `writeRemoteFile()` đều hoạt động thành công mà không bị lỗi `ECONNREFUSED` — Evidence: `npx tsx scripts/test_ssh_ws_and_system_update.ts` PASS.
- [x] AC4: Toàn bộ bộ kiểm thử (`npm run test:desktop`, `npm run test:ui`, `npm run test:update`, `npm run test:security`, `npm run build`) đều PASS.
- [x] AC5: Phát hành bản release mới (`v1.6.9`) lên GitHub, workflow `Optional macOS app` trên GitHub Actions (`macos-15` arm64 & `macos-15-intel` x64) PASS và đính kèm cả 2 file `.dmg` mới vào trang Release.

## Tasks
- [x] T1: Viết bài test RED trong `scripts/test_desktop_packager_options.mjs` và `scripts/test_ssh_ws_and_system_update.ts`.
- [x] T2: Tạo `desktop/icon.png` & `desktop/icon.icns` từ `apps/api/public/favicon.svg`, cập nhật `desktop/packager-options.mjs`, `desktop/main.cjs`, `scripts/build_macos_app.mjs`, `scripts/smoke_macos_app.mjs`.
- [x] T3: Nâng cấp `apps/api/src/config.ts`, `apps/api/src/services/sshPool.ts`, `apps/api/src/services/fsService.ts`, `apps/api/src/routes/api.ts`, `apps/api/src/services/tempZipService.ts`.
- [x] T4: Chạy toàn bộ test suite, build, merge vào `main`, tạo release `v1.6.9` và đính kèm `.dmg` từ macOS CI.
