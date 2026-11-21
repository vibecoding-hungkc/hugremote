# Trạng thái: Đồng bộ Icon macOS & Khắc phục lỗi Connect Refused với Remote SSH Server

- [2026-11-07] Bắt đầu feature workflow `macos-icon-and-ssh-proxyjump-fix`.
- [2026-11-07] Đã xác định nguyên nhân gốc rễ của cả 2 vấn đề:
  1. `makePackagerOptions` trong `desktop/packager-options.mjs` chưa khai báo `icon` (`.icns`), khiến `HugRemote.app` dùng icon mặc định của Electron thay vì `favicon.svg` của web.
  2. Remote server `hermes-admin` kết nối qua SSH reverse tunnel (`HostName 127.0.0.1`, `Port 2225`, đi qua `ProxyJump` / `ProxyCommand` trên máy trung gian `203.0.113.10`). `parseSshConfig()` và `sshPool.getClient()` bỏ qua `ProxyJump`/`ProxyCommand` và kết nối TCP trực tiếp vào `127.0.0.1:2225` trên máy Mac, gây lỗi `connect ECONNREFUSED 127.0.0.1:2225` ở cả SFTP (`fsService`), `getClient()` và các lệnh remote.
