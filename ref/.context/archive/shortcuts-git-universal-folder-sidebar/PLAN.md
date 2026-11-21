---
feature: shortcuts-git-universal-folder-sidebar
description: Implement new 2-column Git UI, bottom Settings menu with shared shortcut rules, thin index with toggleable labels on Workspace Sidebar, and universal Folder Sidebar with upload/download across all screens.
status: done
created: 2026-11-06
---
# Triển khai Giao diện Git mới, Cài đặt Phím tắt chung, Thin Index & Folder Sidebar toàn cục

## Goal
Đưa đầy đủ bản thiết kế đã duyệt trên prototype lên ứng dụng Vue/Fastify chính (`apps/web/src/...`), đồng thời bổ sung giao diện Git 2 cột mới bị thiếu ở feature trước:
1. **Giao diện Git 2 cột mới (`GitView.vue` & `gitStore.ts`)**: Banner tổng quan repo đầu trang + lưới 2 cột (`.git-main-grid`: cột trái `.git-repos-column` danh sách thẻ repo, cột phải `.git-Active-detail-column` chi tiết repo với khối chia đôi `.git-detail-split` gồm `.git-files-box` danh sách file + thanh commit và `.git-diff-box` xem nhanh Diff trực tiếp cạnh nhau trên desktop, chuyển đổi danh sách/chi tiết mượt trên mobile `<=860px`).
2. **Bottom Menu `Cài đặt` & `SettingsView.vue` + `shortcutStore.ts`**: Thêm tab thứ 5 `Cài đặt` (`#dock-item-settings`) ở `BottomDock.vue` và màn hình `SettingsView.vue` chỉ hiển thị duy nhất khối cài đặt phím tắt dùng chung (`#settings-shortcut-card`: Project `Alt + 1..9`, Claude `Alt+Shift + 1..9`, Terminal `Ctrl+Alt + 1..9`, Server `Ctrl+Shift + 1..9`, Hiện/ẩn nhãn `Alt+K`).
3. **Thin Index & Toggleable Labels trên `WorkspaceSidebar.vue`**: Chỉ hiển thị số thứ tự mảnh `1, 2, 3...` (`.dw-idx-badge`) cạnh tên Project, Terminal, Claude; nhãn tổ hợp phím (`.dw-kbd-tag`) mặc định ẩn (`display: none`) và chỉ hiện khi nhấn tổ hợp phím bật nhãn (`Alt+K`), nhấn lần nữa thì tắt.
4. **Folder Sidebar toàn cục ở tất cả màn hình + Upload/Download (`SmartHeader.vue`, `App.vue`, `QuickWorkspacePanel.vue`)**: Đưa nút mở Folder Sidebar (`.quick-tree-trigger[data-quick-panel="files"]`) và nút đóng/mở Workspace Sidebar lên tất cả 6 màn hình (`files`, `editor`, `terminal`, `claude`, `git`, `settings`), đồng thời hỗ trợ Upload tệp, Upload thư mục, Download tệp và Download ZIP thư mục ngay trong `QuickWorkspacePanel.vue`.

## Scope
- In scope:
  - `apps/web/src/components/GitView.vue`, `apps/web/src/stores/gitStore.ts`
  - `apps/web/src/stores/shortcutStore.ts`, `apps/web/src/components/SettingsView.vue`
  - `apps/web/src/app/router.ts`, `apps/web/src/components/BottomDock.vue`, `apps/web/src/App.vue`
  - `apps/web/src/components/WorkspaceSidebar.vue`, `apps/web/src/components/SmartHeader.vue`
  - `apps/web/src/components/QuickWorkspacePanel.vue`
  - `scripts/test_ui_git_mobile_list_details.mjs`, `scripts/test_ui_shortcuts_and_universal_folder.mjs`
- Out of scope: Không tạo tag hay GitHub Release mới (chỉ merge `main`, push `origin/main` và cập nhật bản chạy local để kiểm chứng).

## Acceptance Criteria
- [x] AC1: `GitView.vue` hiển thị đúng giao diện Git 2 cột mới như prototype: banner `.git-scanner-banner` đầu trang, cột trái `.git-repos-column` danh sách thẻ `.git-repo-card`, cột phải `.git-Active-detail-column` gồm toolbar repo đang chọn và khối chia đôi `.git-detail-split` (`.git-files-box` danh sách file + thanh commit và `.git-diff-box` xem nhanh Diff trực tiếp cạnh nhau trên desktop, tự động chọn file đầu tiên để hiện Diff); trên mobile `<=860px` mở danh sách trước, bấm repo sang chi tiết và có nút quay lại — Evidence: `node scripts/test_ui_git_mobile_list_details.mjs` (4 PASS) và `browser_exec` trên `http://127.0.0.1:8099/remote/` (`hasBanner: true, sideBySideColumns: true, sideBySideFilesAndDiff: true`).
- [x] AC2: `BottomDock.vue` có tab thứ 5 `Cài đặt` (`#dock-item-settings`, chỉ giữ vạch gradient mảnh `2px` ở cạnh trên khi active), mở `SettingsView.vue` chỉ hiển thị duy nhất khối cài đặt phím tắt dùng chung (`#settings-shortcut-card`) gồm 5 quy tắc (`project`, `claude`, `terminal`, `server`, `toggleLabels`), không có danh sách từng project và không có nút sắp xếp — Evidence: `node scripts/test_ui_shortcuts_and_universal_folder.mjs` và `browser_exec` (`dockActive: true, cardVisible: true, rules: ["project", "claude", "terminal", "server", "toggleLabels"]`).
- [x] AC3: `WorkspaceSidebar.vue` hiển thị **thin index** (`.dw-idx-badge` chỉ hiện số `1, 2, 3...` đơn sắc) cho từng Project, Terminal session và Claude session; nhãn phím tắt (`.dw-kbd-tag`) mặc định ẩn (`display: none`) và khi nhấn tổ hợp phím bật nhãn (`Alt+K` mặc định) lần 1 thì hiện nhãn, nhấn lần 2 thì ẩn nhãn; nhấn tổ hợp `<prefix>+<1..9>` chuyển nhanh đúng Project / Session / Server — Evidence: `browser_exec` xác nhận `before: {kbdDisplay: "none", kbdText: "Alt+1"}, after_1st_AltK: {kbdDisplay: "flex"}, after_2nd_AltK: {kbdDisplay: "none"}`.
- [x] AC4: Nút mở **Folder Sidebar** (`.quick-tree-trigger[data-quick-panel="files"]`) có mặt trên `SmartHeader.vue` ở tất cả 6 màn hình (`files`, `editor`, `terminal`, `claude`, `git`, `settings`) và `QuickWorkspacePanel.vue` mở được ở mọi màn hình, hỗ trợ Upload tệp (`#quick-tree-upload-files`, `.quick-tree-row-upload`), Upload thư mục (`#quick-tree-upload-folder`), Download tệp (`.quick-tree-row-download`, `#quick-file-download`) và Download ZIP thư mục (`#quick-tree-download-zip`, `.quick-tree-row-download`) — Evidence: `node scripts/test_ui_shortcuts_and_universal_folder.mjs` và `browser_exec` (`quickPanelOpenOnSettings: true, hasUploadFilesBtn: true, hasUploadFolderBtn: true, hasDownloadZipBtn: true, rowDownloadBtns: 30, rowUploadBtns: 10`).
- [x] AC5: Toàn bộ bài test (`node scripts/test_ui_shortcuts_and_universal_folder.mjs`, `npm run test:ui`, `npm run build`) đều PASS, tuân thủ kiểm tra monochrome theme, và ứng dụng thật tại `http://127.0.0.1:8099/remote/` được kiểm chứng trên trình duyệt thật (`browser_exec`) ở cả desktop (`1280x800`) và mobile (`390x844`) không có lỗi console hay tràn ngang (`scrollWidth == clientWidth == 390`).

## Tasks
- [x] T1: Viết bài test tự động `scripts/test_ui_shortcuts_and_universal_folder.mjs` và cập nhật `scripts/test_ui_git_mobile_list_details.mjs` để kiểm tra đủ AC1–AC4 (chạy xác nhận RED).
- [x] T2: Cập nhật `GitView.vue` và `gitStore.ts` sang giao diện Git 2 cột mới (`.git-scanner-banner`, `.git-main-grid`, `.git-repos-column`, `.git-Active-detail-column`, `.git-detail-split` gồm `.git-files-box` + `.git-diff-box` song song).
- [x] T3: Tạo `shortcutStore.ts` và `SettingsView.vue`, cập nhật `router.ts`, `BottomDock.vue`, `WorkspaceSidebar.vue` (thin index + toggleable `.dw-kbd-tag` bằng `Alt+K` + điều hướng phím tắt `1..9`).
- [x] T4: Cập nhật `SmartHeader.vue`, `App.vue`, `QuickWorkspacePanel.vue` để hỗ trợ Folder Sidebar ở tất cả 6 màn hình kèm tính năng Upload tệp/thư mục và Download tệp/ZIP thư mục.
- [x] T5: Chạy toàn bộ test (`npm run test:ui`, `npm run build`), cập nhật bản chạy local, kiểm chứng trên trình duyệt thật (`1280x800` & `390x844`), merge `main` và push `origin/main`.
