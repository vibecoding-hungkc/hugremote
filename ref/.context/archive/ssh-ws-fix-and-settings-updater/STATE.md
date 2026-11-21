# Trạng thái hiện tại: Sửa lỗi WebSocket SSH trên macOS & Cập nhật Phiên bản nhanh trong Cài đặt

## Current Task
Hoàn tất T1–T4.

## Completed
- Đã khắc phục lỗi WebSocket khi làm việc với SSH Server trên macOS (`sshPool.ts`, `ws.ts`, `App.vue`, `TerminalView.vue`).
- Đã triển khai `systemUpdateService.ts`, API `/api/system/version` & `/api/system/update`, và khối `#settings-version-card` trong `SettingsView.vue` + `analysis/prototypes/prototype.html`.
- Đã chạy toàn bộ `npm run test:ui`, `npm run build`, đồng bộ lên bản chạy thật và kiểm chứng bằng `browser_exec` ở `1280x800` & `390x844` (hình thức trực quan xác nhận qua DOM/computed styles/geometry, chưa kiểm tra bằng mắt).
