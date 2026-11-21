# Trạng thái hiện tại: Đưa mục Ngôn ngữ vào Cài đặt & Nút Cài đặt chỉ hiện Icon

## Current Task
Hoàn tất T1–T3.

## Completed
- Đã gỡ `LanguageSwitcher` khỏi `SmartHeader.vue` và đưa khối chọn ngôn ngữ `#settings-language-card` vào `SettingsView.vue` (cùng `analysis/prototypes/prototype.html`).
- Đã chuyển nút `#dock-item-settings` ở `BottomDock.vue` và `analysis/prototypes/prototype.html` sang chỉ hiện icon (`ri-settings-3-line`).
- Đã chạy `npm run test:ui`, `npm run build`, đồng bộ lên `~/.local/share/hugremote/current` và kiểm chứng trên trình duyệt thật ở `1280x800` & `390x844` (hình thức trực quan xác nhận qua DOM/computed styles/geometry, chưa kiểm tra bằng mắt).
