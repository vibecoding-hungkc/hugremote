---
feature: prototype-shortcut-navigation
description: Prototype bottom Settings menu (shared shortcut block only), thin index in Workspace Sidebar with toggleable shortcut labels, and universal Folder Sidebar with file/folder upload & download.
status: done
created: 2026-11-06
---
# Prototype: Cài đặt phím tắt chung, Thin Index & Folder Sidebar toàn cục có Upload/Download

## Goal
Cập nhật bản prototype (`analysis/prototypes/prototype.html`) theo phản hồi tinh gọn của người dùng:
1. Màn hình `Cài đặt` chỉ hiển thị **khối cài đặt phím tắt dùng chung** (không liệt kê từng Project/Session, không có sắp xếp thứ tự).
2. Cột trái `Workspace Sidebar` chỉ hiển thị **thin index** (`1, 2, 3...`), mặc định ẩn label tổ hợp phím và chỉ hiện label khi nhấn tổ hợp phím bật/tắt label (nhấn lần nữa thì ẩn).
3. Bổ sung **Folder Sidebar** (`#quick-tree-panel`) ở **tất cả các màn hình** (`Files`, `Editor`, `Terminal`, `Claude`, `Git`, `Cài đặt`) và hỗ trợ **Upload / Download file & thư mục** ngay trong Folder Sidebar.

## Scope
- In scope: `analysis/prototypes/prototype.html` và `scripts/test_ui_prototype_shortcuts.mjs`.
- Out of scope: Chưa sửa code ứng dụng Vue/Fastify production cho tới khi người dùng duyệt bản prototype.

## Acceptance Criteria
- [x] AC1: Màn hình `Cài đặt` (`#view-settings`) chỉ hiển thị khối cài đặt phím tắt dùng chung (`#settings-shortcut-card`) gồm bộ phím chuyển nhanh Project (`1..9`), Claude (`1..9`), Terminal (`1..9`), Server (`1..9`) và phím tắt Bật/tắt hiển thị nhãn phím tắt (`Alt+K` mặc định); không có bảng danh sách từng Project/Session và không có nút sắp xếp `↑`/`↓` — Evidence: `browser_exec` xác nhận `cardExists: true`, `rulesCount: 5`, `hasPerProjectList: false`, `hasMoveButtons: 0`.
- [x] AC2: Ở cột trái `Workspace Sidebar`, mỗi Project và Session chỉ hiện **thin index** (`.dw-idx-badge`) bên cạnh tên; nhãn tổ hợp phím (`.dw-kbd-tag`) mặc định ẩn (`display: none`) và chỉ hiển thị khi nhấn tổ hợp phím bật nhãn (`Alt+K`), nhấn lần thứ hai thì ẩn lại — Evidence: `browser_exec` xác nhận `badgeText: "1"`, `kbdDisplayDefault: "none"`, sau lần 1 `Alt+K` `kbdDisplay: "flex"` (`Alt+1`), sau lần 2 `Alt+K` `kbdDisplay: "none"`.
- [x] AC3: Nút mở **Folder Sidebar** (`.quick-tree-trigger[data-quick-panel="files"]`) hiển thị trên thanh Header ở **tất cả 6 màn hình** (`Files`, `Editor`, `Terminal`, `Claude`, `Git`, `Cài đặt`), đóng/mở được ở mọi màn hình — Evidence: `test_ui_prototype_shortcuts.mjs` và `browser_exec` xác nhận mở Folder Sidebar trên cả `view-settings` và `view-files` (`right: 380px`).
- [x] AC4: **Folder Sidebar** (`#quick-tree-panel`) hỗ trợ **Upload và Download file/thư mục** trực tiếp (nút Upload file `#quick-tree-upload-files`, Upload folder `#quick-tree-upload-folder`, Download ZIP `#quick-tree-download-zip` trên thanh công cụ cây thư mục; nút Download/Upload trên từng dòng file/folder trong cây; nút Download `#quick-file-download` khi đang xem file trong sidebar) — Evidence: `browser_exec` xác nhận `hasToolbarUploadFiles: true`, `hasToolbarUploadFolder: true`, `hasToolbarDownloadZip: true`, `rowDownloadBtns: 7`, `rowUploadBtns: 4`, upload tệp `quick-uploaded.txt` và mở trong `#quick-file-workbench` với `#quick-file-download`.
- [x] AC5: Toàn bộ `node scripts/test_ui_prototype_shortcuts.mjs && npm run test:ui` và kiểm tra trình duyệt ở `1280x800` & `390x844` đều PASS — Evidence: `node scripts/test_ui_prototype_shortcuts.mjs && npm run test:ui` exit 0, `scrollWidth == clientWidth == 390` ở `390x844`.

## Tasks
- [x] T1: Cập nhật `scripts/test_ui_prototype_shortcuts.mjs` theo thiết kế tinh gọn mới và xác nhận RED.
- [x] T2: Cập nhật `analysis/prototypes/prototype.html`: rút gọn `#view-settings` chỉ còn khối cài đặt phím tắt dùng chung, làm thin index + toggle label bằng phím tắt trên Workspace Sidebar, đưa nút Folder Sidebar lên tất cả màn hình và bổ sung Upload/Download trong Folder Sidebar.
- [x] T3: Chạy `node scripts/test_ui_prototype_shortcuts.mjs && npm run test:ui` và kiểm chứng trên trình duyệt thật (`browser_exec`).
