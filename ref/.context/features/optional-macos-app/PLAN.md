# Optional macOS app

## Goal
Đóng gói HugRemote thành ứng dụng macOS tùy chọn, giữ bản web/CLI là phương thức sử dụng chính và không thay đổi cách cài, chạy, cập nhật bản web.

## Scope
- Desktop wrapper mở frontend từ backend HugRemote cục bộ, đóng gói backend, static web, native dependencies và Node runtime phù hợp.
- Build và kiểm chứng gói macOS trên runner macOS nếu có thể; không yêu cầu quyền ký/notarization của người dùng để làm bản thử nghiệm.
- Tài liệu cài đặt, quyền truy cập, giới hạn bản unsigned và quy trình cập nhật.

## Acceptance Criteria
- [ ] AC1: `npm start`, `npm run build`, CLI/web routes và bộ test hiện hữu vẫn chạy; desktop dependencies không thành bắt buộc cho web. Kiểm tra build, test suite, diff manifest.
- [ ] AC2: Desktop khởi chạy backend riêng trên loopback, chỉ tải origin đã kiểm chứng, chặn điều hướng ngoài ý muốn, dọn process khi thoát và báo lỗi khi backend không lên. Kiểm tra test riêng và smoke trên macOS.
- [ ] AC3: App bundle macOS chứa đủ backend, frontend, Node runtime và native modules cho host architecture; smoke app có HTTP/UI tương tác, không cần npm/node được cài sẵn (nếu CI cho phép kiểm tra). Kiểm tra workflow macOS và artifact cụ thể.
- [ ] AC4: README có hướng dẫn build/cài `.app` tùy chọn và giải thích web vẫn là luồng chính; giới hạn unsigned/signing và bảo mật nêu rõ. Kiểm tra links và lệnh build.

## Tasks
1. Đọc code, chọn phương án đóng gói phù hợp native PTY/SSH và macOS runner; ghi DECISION.
2. Viết test trước cho lifecycle/security, xác nhận RED, triển khai desktop wrapper tối thiểu.
3. Build local tests và chạy workflow macOS để có app artifact, kiểm chứng end-to-end trên macOS nếu khả dụng.
4. Viết README/docs và kiểm thử hồi quy bản web; commit trên nhánh, merge/push sau verification.
