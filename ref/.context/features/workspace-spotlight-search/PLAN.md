---
feature: workspace-spotlight-search
description: Gỡ hệ phím tắt 1..9 và tag số ở Workspace; thay bằng một phím tắt duy nhất mở ô tìm kiếm kiểu Spotlight cho dự án, phiên Claude, phiên Terminal.
status: in-progress
created: 2026-11-13
---

# Workspace Spotlight Search

## Scope
- In: xoá shortcutStore, handler keydown trong App.vue, kbd tag + idx badge trong WorkspaceSidebar, card Cài đặt phím tắt trong SettingsView, test cũ liên quan. Thêm SpotlightSearch.vue + util lọc/xếp hạng + 1 phím tắt (Alt+K).
- Out: phím tắt riêng của Terminal/Editor (Esc, Ctrl+C/V, Ctrl+S) giữ nguyên; thanh phím Claude mobile giữ nguyên.

## Acceptance Criteria
- [ ] AC1: Sidebar không còn .dw-idx-badge và .dw-kbd-tag trong DOM — Check: browser DOM query = 0
- [ ] AC2: Cài đặt không còn card phím tắt; Language vẫn còn — Check: browser DOM
- [ ] AC3: Alt+1, Alt+Shift+1, Ctrl+Alt+1, Ctrl+Shift+1, Alt+K cũ (nhãn) không còn; phím số cũ không còn đổi project/session/server — Check: browser gửi phím, so sánh state
- [ ] AC4: ⌘K/Ctrl+Alt+K mở Spotlight, ô search tự focus; Esc hoặc click nền đóng; bấm lại phím tắt đóng — Check: browser
- [ ] AC5: Danh sách gồm Dự án, Claude, Terminal của mọi server trong Workspace, mỗi dòng có tên + server/project — Check: browser đếm dòng so với API
- [ ] AC6: Gõ lọc không phân biệt hoa thường và dấu tiếng Việt, xếp theo độ khớp — Check: unit test util + browser
- [ ] AC7: ↑/↓ di chuyển, Enter mở mục chọn; click cũng mở — Check: browser
- [ ] AC8: Chọn dự án đổi đúng server+project; chọn Claude/Terminal đổi project, tab và phiên active — Check: browser đọc store/tab
- [ ] AC9: Hoạt động từ mọi tab kể cả khi focus trong terminal xterm — Check: browser
- [ ] AC10: Viewport 390x844 không tràn ngang; giao diện đúng theme monochrome, có chiều sâu — Check: scrollWidth<=clientWidth, screenshot
- [ ] AC11: Test cũ cập nhật, test mới pass trên code mới và fail trên code cũ; typecheck+build pass — Check: npm scripts
