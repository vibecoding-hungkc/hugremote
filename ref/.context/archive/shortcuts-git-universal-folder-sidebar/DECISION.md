# Quyết định thiết kế: Giao diện Git 2 cột, Phím tắt chung, Thin Index & Folder Sidebar toàn cục

## 2026-11-06 — Đồng bộ hoàn toàn ứng dụng Vue với bản Prototype đã duyệt
- **Giao diện Git 2 cột (`GitView.vue`)**:
  - Chuyển từ thanh cuộn ngang `.git-multi-repo-bar` cũ sang bố cục lưới 2 cột `.git-main-grid` giống hệt prototype: cột trái `.git-repos-column` hiển thị danh sách thẻ `.git-repo-card`, cột phải `.git-Active-detail-column` hiển thị toolbar repo đang chọn và khối chia đôi `.git-detail-split` (bên trái `.git-files-box` danh sách file thay đổi + thanh commit, bên phải `.git-diff-box` khung xem nhanh Diff trực tiếp).
  - Tự động nạp Diff của file đầu tiên khi chọn repo có thay đổi để khung `.git-diff-box` luôn hiển thị nội dung ngay trên desktop mà không làm ẩn danh sách file.
  - Trên mobile (`<=860px`), mở danh sách repo trước; khi bấm vào repo sẽ thêm class `.mobile-detail-open` để mở chi tiết repo kèm nút `.git-mobile-back` quay lại danh sách.
- **Phím tắt dùng chung & Thin Index (`shortcutStore.ts`, `SettingsView.vue`, `WorkspaceSidebar.vue`)**:
  - Tổ hợp phím là quy tắc chung theo nhóm (`project`, `claude`, `terminal`, `server`) ghép với số thứ tự `1..9`, cộng với 1 tổ hợp phím bật/tắt hiển thị nhãn phím tắt (`toggleLabelsCombo`, mặc định `Alt+K`).
  - `WorkspaceSidebar.vue` chỉ hiển thị `.dw-idx-badge` mảnh (`1, 2, 3...`), còn `.dw-kbd-tag` mặc định `display: none` và chỉ hiển thị khi `.app-root.shortcut-labels-visible` bật.
- **Folder Sidebar toàn cục & Upload/Download (`SmartHeader.vue`, `App.vue`, `QuickWorkspacePanel.vue`)**:
  - `isQuickPanelActive` trong `App.vue` bằng `isQuickPanelOpen.value` trên mọi tab; khi chuyển sang tab ngoài `terminal`/`claude` mà panel đang ở chế độ `git`, tự chuyển `quickPanelMode` về `'files'`.
  - `QuickWorkspacePanel.vue` tích hợp thanh công cụ `#quick-tree-upload-files`, `#quick-tree-upload-folder`, `#quick-tree-download-zip`, nút `.quick-tree-row-upload` / `.quick-tree-row-download` trên từng dòng cây thư mục, và nút `#quick-file-download` trong `#quick-file-workbench`, gọi trực tiếp `/api/fs/upload` và `/api/fs/download` theo project đang chọn.
