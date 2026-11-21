# Quyết định thiết kế: Ngôn ngữ trong Cài đặt & Nút Cài đặt chỉ hiện Icon

## 2026-11-06
- Gỡ `<LanguageSwitcher />` khỏi `.smart-header-right` của `SmartHeader.vue` để thanh Top Menu gọn hơn trên cả Desktop và Mobile.
- Đưa phần chọn ngôn ngữ (`#settings-language-card` với các nút chọn `🇻🇳 Tiếng Việt` và `🇺🇸 English`) vào màn hình `SettingsView.vue` (cùng `analysis/prototypes/prototype.html`).
- Ở `BottomDock.vue` và `analysis/prototypes/prototype.html`, nút `#dock-item-settings` bỏ `<span class="dock-label">`, chỉ giữ `<i class="ri-settings-3-line dock-icon"></i>` kèm `title="Cài đặt"` và `aria-label="Cài đặt"`.
