# Trạng thái hiện tại: Triển khai Giao diện Git mới, Cài đặt Phím tắt chung, Thin Index & Folder Sidebar toàn cục

## Current Task
Hoàn tất toàn bộ T1–T5.

## Completed
- Đã hoàn tất T1–T5: cập nhật `GitView.vue` (giao diện Git 2 cột mới), tạo `shortcutStore.ts` và `SettingsView.vue`, cập nhật `BottomDock.vue`, `WorkspaceSidebar.vue`, `SmartHeader.vue`, `QuickWorkspacePanel.vue`, `App.vue`, `router.ts`.
- Đã chạy `npm run test:ui`, `npm run build`, đồng bộ lên `~/.local/share/hugremote/current` và kiểm chứng trên trình duyệt thật ở `1280x800` & `390x844` (hình thức trực quan được xác nhận qua thông số DOM/computed styles/geometry, chưa kiểm tra bằng mắt).
