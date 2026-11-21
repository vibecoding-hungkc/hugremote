# Decisions — git-history-and-resizable-columns

## 1. Kết hợp `git log --numstat` và `git log --name-status` cho Commit History
- **Bối cảnh:** Người dùng cần xem danh sách commit và trong mỗi commit thấy ngay danh sách các tệp thay đổi kèm trạng thái (`M`, `A`, `D`, `R`) và số dòng thêm/xóa (`+additions`, `-deletions`).
- **Quyết định:** Trong `GitService.getCommitHistory()`, chạy song song `git log --numstat` (lấy thông tin commit + số dòng cộng/trừ từng file) và `git log --name-status` (lấy trạng thái `M`/`A`/`D`/`R` của từng file), ghép theo mã SHA của commit. Cách này hoạt động đồng nhất cho cả Local Git và Remote SSH Git chỉ với 2 lệnh gọn nhẹ mà không phải chạy `git show` cho từng commit một.

## 2. Điều chỉnh độ rộng các cột bằng CSS Custom Properties + Pointer Events
- **Bối cảnh:** Màn hình Git trên Desktop có các cặp cột: (1) Danh sách Repo | Chi tiết Repo, (2) Danh sách tệp đang sửa | Xem nhanh Diff, (3) Danh sách Commit | Chi tiết Commit, và (4) Tệp trong Commit | Diff trong Commit.
- **Quyết định:** Đặt các thanh kéo `.git-col-resizer` giữa các cột trên Desktop (`> 860px`), cập nhật biến CSS (`--git-repos-col-width`, `--git-working-files-col-width`, `--git-history-commits-col-width`, `--git-history-files-col-width`) theo sự kiện kéo chuột/cảm ứng (`pointerdown`/`mousedown` -> `mousemove` -> `mouseup`) có giới hạn `min`/`max` an toàn và lưu vào `localStorage` (`hugremote_git_col_widths`). Trên Mobile (`<= 860px`), tự động ẩn các thanh resizer và dùng chế độ drill-down 1 cột (List -> Detail).
