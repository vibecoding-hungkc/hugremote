---
feature: settings-language-and-icon-dock
description: Move language switcher from SmartHeader top menu into SettingsView, and make the Settings bottom dock item icon-only without a text label.
status: done
created: 2026-11-06
---
# Đưa mục Ngôn ngữ từ Top Menu vào Cài đặt & Đổi nút Cài đặt ở Bottom Dock sang chỉ hiện Icon

## Goal
1. Loại bỏ nút chọn ngôn ngữ (`LanguageSwitcher`) trên thanh Header trên cùng (`SmartHeader.vue`) và đưa mục chọn ngôn ngữ vào trong màn hình **Cài đặt** (`SettingsView.vue` và đồng bộ `analysis/prototypes/prototype.html`).
2. Đổi nút **Cài đặt** (`#dock-item-settings`) ở `BottomDock.vue` và `analysis/prototypes/prototype.html` thành **chỉ hiển thị icon** (`ri-settings-3-line`), không hiển thị chữ label bên cạnh.

## Scope
- In scope:
  - `apps/web/src/components/SmartHeader.vue`
  - `apps/web/src/components/SettingsView.vue`
  - `apps/web/src/components/BottomDock.vue`
  - `analysis/prototypes/prototype.html`
  - `scripts/test_ui_shortcuts_and_universal_folder.mjs`
  - `scripts/test_ui_prototype_shortcuts.mjs`
- Out of scope: Không tạo tag hay GitHub Release mới.

## Acceptance Criteria
- [x] AC1: `SmartHeader.vue` không còn render nút chọn ngôn ngữ (`.language-flag-btn` / `LanguageSwitcher`) trên thanh Top Menu — Evidence: `test_ui_shortcuts_and_universal_folder.mjs` và `browser_exec` (`headerHasLangBtn: false`).
- [x] AC2: `SettingsView.vue` (và `#view-settings` trong `analysis/prototypes/prototype.html`) có mục cài đặt **Ngôn ngữ** (`#settings-language-card` / `#settings-language-selector`) cho phép chuyển đổi giữa `Tiếng Việt` (`vi`) và `English` (`en`) — Evidence: `test_ui_shortcuts_and_universal_folder.mjs` và `browser_exec` (`hasLangCardInSettings: true`).
- [x] AC3: Nút `#dock-item-settings` trên `BottomDock.vue` (và `#smart-bottom-dock` trong `analysis/prototypes/prototype.html`) chỉ hiển thị icon bánh răng (`ri-settings-3-line`), không có `<span class="dock-label">`, vẫn có `title="Cài đặt"` và `aria-label="Cài đặt"` — Evidence: `browser_exec` (`dockSettingsText: "", dockSettingsHasIcon: true, dockSettingsHasLabelSpan: false, dockSettingsWidth: 54`).
- [x] AC4: Toàn bộ bài test (`npm run test:ui`, `node scripts/test_ui_prototype_shortcuts.mjs`, `npm run build`) đều PASS và ứng dụng thật tại `http://127.0.0.1:8099/remote/` được kiểm chứng trên trình duyệt thật (`browser_exec`).

## Tasks
- [x] T1: Cập nhật `scripts/test_ui_shortcuts_and_universal_folder.mjs` và `scripts/test_ui_prototype_shortcuts.mjs` để kiểm tra AC1–AC3 (xác nhận RED).
- [x] T2: Sửa `SmartHeader.vue`, `SettingsView.vue`, `BottomDock.vue` và `analysis/prototypes/prototype.html`.
- [x] T3: Chạy `npm run test:ui`, `npm run build`, cập nhật bản chạy local, kiểm chứng bằng `browser_exec`, merge vào `main` và push.
