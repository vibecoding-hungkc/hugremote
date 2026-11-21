# Plan — git-history-and-resizable-columns

## Goal
Triển khai tính năng xem **Lịch sử Commit (`Git History`)**, **theo dõi danh sách tệp thay đổi và Diff trong từng Commit**, **lọc lịch sử theo tệp**, **luồng điều hướng Mobile List -> Detail không xếp chồng cuối trang**, và **cho phép kéo điều chỉnh độ rộng các cột (`Resizable Columns`)** trên cả bản Prototype (`analysis/prototypes/prototype.html`) và ứng dụng thật (`apps/api`, `apps/web`).

## Acceptance Criteria (AC)
- [ ] **AC-1 (Backend Git Commit History & Commit Diff API):** `GitService.getCommitHistory(cwd, options)` và `GitService.getCommitDiff(cwd, hash, file)` cùng các endpoint `GET /api/git/commits` và `GET /api/git/commit-diff` trả về danh sách commit (mã hash, shortHash, ref, subject, author, date, relativeDate, danh sách tệp thay đổi kèm status/additions/deletions), hỗ trợ lọc theo tệp (`file`), tìm kiếm (`search`), và xem diff của từng tệp hoặc toàn bộ tệp trong một commit; chặn fail-closed với `hash` không hợp lệ.
  - *Check:* `npx tsx scripts/test_git_history_and_resizable_columns.ts`
- [ ] **AC-2 (UI 2-Tab Mode & Commit History Inspector):** `GitView.vue` và `analysis/prototypes/prototype.html` có thanh chuyển 2 chế độ (`#git-mode-working` "Thay đổi hiện tại" và `#git-mode-history` "Lịch sử Commit", không có nút "Tất cả"), hiển thị timeline commit (`#git-history-commit-list`), danh sách tệp thay đổi của commit đang chọn (`#git-commit-file-list`), khung diff của tệp trong commit (`#git-commit-diff-body`), và cho phép bấm "Theo dõi tệp" / chọn tệp để lọc lịch sử commit của tệp đó.
  - *Check:* `npx tsx scripts/test_git_history_and_resizable_columns.ts && npm run test:ui`
- [ ] **AC-3 (Mobile List-to-Detail Drill-Down Navigation):** Trên màn hình nhỏ (`<= 860px`), cả tab `Thay đổi hiện tại` (`files` -> `diff`) lẫn tab `Lịch sử Commit` (`commits` -> `files` -> `diff`) đều hiển thị dạng danh sách và bấm để đi vào màn hình detail (kèm nút quay lại `#git-working-mobile-back-files`, `#git-history-mobile-back-commits`, `#git-history-mobile-back-files`), không xếp chồng khung detail ở cuối trang.
  - *Check:* `npx tsx scripts/test_git_history_and_resizable_columns.ts` và `browser_exec` ở viewport `390x844`.
- [ ] **AC-4 (Resizable Columns with Persistence):** Cho phép kéo điều chỉnh độ rộng của các cột trong màn Git (`#git-resizer-repos`, `#git-resizer-working-files`, `#git-resizer-history-commits`, `#git-resizer-history-files`) trên cả `prototype.html` và `GitView.vue`, lưu và khôi phục độ rộng từ `localStorage`.
  - *Check:* `npx tsx scripts/test_git_history_and_resizable_columns.ts` và `browser_exec` kéo thực tế resizer ở viewport `1280x800`.
- [ ] **AC-5 (Build, Full Regression & Live Browser Verification):** `npm run build && npm run test:ui && npm run test:desktop && npm run test:security` PASS (`exit 0`), đồng bộ bản chạy thật tại `http://127.0.0.1:8099/remote/#/git` và kiểm chứng E2E trên trình duyệt thật.
  - *Check:* `npm run build && npm run test:ui && npm run test:desktop && npm run test:security` + `browser_exec`.

## Tasks
- [ ] 1. Viết bài test TDD `scripts/test_git_history_and_resizable_columns.ts` kiểm tra toàn bộ AC-1..AC-4 và chạy xác nhận trạng thái RED.
- [ ] 2. Cập nhật `analysis/prototypes/prototype.html` bổ sung thanh kéo điều chỉnh độ rộng các cột (`#git-resizer-repos`, `#git-resizer-working-files`, `#git-resizer-history-commits`, `#git-resizer-history-files`) kèm lưu `localStorage`.
- [ ] 3. Triển khai `getCommitHistory` và `getCommitDiff` trong `apps/api/src/services/gitService.ts` và routes `/api/git/commits`, `/api/git/commit-diff` trong `apps/api/src/routes/api.ts`.
- [ ] 4. Cập nhật `apps/web/src/stores/gitStore.ts` và `apps/web/src/components/GitView.vue` (2 tab `Thay đổi hiện tại` / `Lịch sử Commit`, theo dõi tệp trong commit, Mobile List->Detail drill-down, và Resizable Columns).
- [ ] 5. Chạy bộ test, build, cập nhật bản chạy thật và kiểm chứng bằng `browser_exec` trên cả Desktop (`1280x800`) và Mobile (`390x844`).
