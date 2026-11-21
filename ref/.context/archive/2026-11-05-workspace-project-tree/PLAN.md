# Workspace project tree

- [x] AC1: Workspace trên desktop có resize bằng kéo cạnh phải và bàn phím; giới hạn độ rộng, nội dung không tràn; chiều rộng vùng chính khớp sidebar. Kiểm tra: browser thao tác + test (`gripHit: true`, kéo `256 -> 384`, reload `width: 384`, `mainPad: 384px`, mobile `390x844` `scrollWidth = clientWidth = 390`).
- [x] AC2: Chỉ còn cấu trúc Project → Terminal/Claude theo từng Project; không còn nút đổi layout. Click/sửa/đóng phiên ở Project khác đổi scope trước khi thao tác. Kiểm tra SSR, browser và test (`modeBtns: 0`, `groups: 4`, `node scripts/test_ui_workspace_sidebar.mjs` 6/6 PASS).
- [x] AC3: Sidebar bỏ card/border dư; chỉ giữ hai cấp đường dẫn dọc của Project và nhóm phiên Terminal/Claude; active hiển thị bằng một dot thay vì card/border. Kiểm tra DOM/CSS và browser desktop/mobile (`projectGuides: 1`, `sessionGuides: 8`, `itemBorder: 0px`, `activeDots: 3`).
- [x] AC4: Prototype cũng dùng một layout cây theo Project và phong cách tương ứng; các thao tác mở rộng/thu gọn, chọn phiên và resize chạy thực. Kiểm tra browser (`groups: 5`, `modes: 0`, collapse/restore + resize `256 -> 280`).
- [x] AC5: typecheck, build và toàn bộ UI tests PASS; không trộn code sửa ID Project chưa hoàn thành. Kiểm tra lệnh và git diff (`npm run build:web` PASS, `npm run test:ui` 108/108 PASS, commit `6e1b95d` pushed to `main` và cập nhật vào `/remote`).
