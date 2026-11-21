# Quyết định thiết kế: Chế độ Full màn hình cho Xem nhanh thư mục

## 2026-11-06
- Thêm nút `#quick-tree-fullscreen` trên `.quick-tree-header` (hiển thị xuyên suốt khi duyệt cây thư mục lẫn khi xem/sửa file hoặc quản lý Git nhanh) và nút `#quick-file-fullscreen` trên `.quick-file-bar`.
- Khi `isFullscreen` bật, `#quick-tree-panel` thêm class `fullscreen` với CSS `left: 0; right: 0; width: 100% !important; max-width: 100vw !important; border-left: none; z-index: 90;` để chiếm trọn vùng nội dung giữa Header và Bottom Dock trên cả Desktop và Mobile.
