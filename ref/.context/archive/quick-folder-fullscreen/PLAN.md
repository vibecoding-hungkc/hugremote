---
feature: quick-folder-fullscreen
description: Add fullscreen toggle mode to QuickWorkspacePanel (#quick-tree-panel) in both Vue app and prototype.html.
status: done
created: 2026-11-06
---
# Thêm chế độ Full màn hình cho tính năng Xem nhanh thư mục (`#quick-tree-panel`)

## Goal
Bổ sung chế độ mở rộng **Full màn hình** (`fullscreen`) cho bảng Xem nhanh thư mục (`QuickWorkspacePanel.vue` và `#quick-tree-panel` trong `analysis/prototypes/prototype.html`) để người dùng có thể phóng rộng toàn bộ vùng làm việc khi duyệt cây thư mục hoặc xem/chỉnh sửa file nhanh trên cả Desktop và Mobile.

## Scope
- In scope:
  - `apps/web/src/components/QuickWorkspacePanel.vue`
  - `analysis/prototypes/prototype.html`
  - `scripts/test_ui_shortcuts_and_universal_folder.mjs`
  - `scripts/test_ui_prototype_shortcuts.mjs`
- Out of scope: Không tạo tag hay GitHub Release mới.

## Acceptance Criteria
- [x] AC1: Thanh tiêu đề của `QuickWorkspacePanel.vue` (và `#quick-tree-panel` trong `prototype.html`) có nút bật/tắt toàn màn hình `#quick-tree-fullscreen` (`aria-pressed`, đổi icon giữa `ri-fullscreen-line` và `ri-fullscreen-exit-line`), đồng thời thanh công cụ file inline `#quick-file-workbench` cũng có nút `#quick-file-fullscreen` — Evidence: `test_ui_shortcuts_and_universal_folder.mjs` & `test_ui_prototype_shortcuts.mjs` PASS.
- [x] AC2: Khi bật chế độ toàn màn hình (`isFullscreen = true`), `#quick-tree-panel` gắn class `fullscreen`, mở rộng phủ toàn bộ chiều ngang màn hình (`left: 0; right: 0; width: 100% !important; max-width: 100vw !important`), ẩn thanh kéo resize `#quick-tree-resize`; bấm lần nữa thu nhỏ lại đúng kích thước sidebar ban đầu — Evidence: `browser_exec` (`before: {width: 320, left: 960}, fullscreen: {width: 1280, left: 0, resizeBarDisplay: "none"}, restored: {width: 320}`).
- [x] AC3: Toàn bộ bài test (`npm run test:ui`, `node scripts/test_ui_prototype_shortcuts.mjs`, `npm run build`) đều PASS và kiểm chứng trực tiếp trên trình duyệt thật (`browser_exec`) ở cả `1280x800` và `390x844` xác nhận chiều rộng `#quick-tree-panel.fullscreen` bằng đúng chiều rộng viewport (`1280px` trên desktop, `390px` trên mobile).

## Tasks
- [x] T1: Cập nhật `scripts/test_ui_shortcuts_and_universal_folder.mjs` và `scripts/test_ui_prototype_shortcuts.mjs` để kiểm tra nút `#quick-tree-fullscreen` và trạng thái `.fullscreen` (xác nhận RED).
- [x] T2: Triển khai chế độ Full màn hình trên `QuickWorkspacePanel.vue` và `analysis/prototypes/prototype.html` (xác nhận GREEN).
- [x] T3: Build, cập nhật bản chạy local, kiểm chứng trên trình duyệt thật (`browser_exec`), merge vào `main` và push.
