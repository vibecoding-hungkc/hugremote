# Trạng thái hiện tại: Chế độ Full màn hình cho Xem nhanh thư mục

## Current Task
Hoàn tất T1–T3.

## Completed
- Đã bổ sung nút `#quick-tree-fullscreen` (trên thanh tiêu đề) và `#quick-file-fullscreen` (trên thanh công cụ khi mở file inline) cùng class `.quick-tree-panel.fullscreen` trên cả `QuickWorkspacePanel.vue` và `analysis/prototypes/prototype.html`.
- Đã chạy `npm run test:ui`, `npm run build`, đồng bộ lên `~/.local/share/hugremote/current` và kiểm chứng trên trình duyệt thật ở `1280x800` & `390x844` (hình thức trực quan xác nhận qua DOM/computed styles/geometry, chưa kiểm tra bằng mắt).
