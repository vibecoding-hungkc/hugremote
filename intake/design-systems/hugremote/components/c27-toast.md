# C27 — Toast

| Field | Value |
|---|---|
| Mã | C27 |
| Nhóm | phản hồi |
| Mục đích | Xác nhận ngắn một việc vừa làm xong mà không chặn hay làm gián đoạn thao tác tiếp theo |
| Màn hình dùng | S3, S8, S9, S10 |
| Hiện thực prototype | class `.toast` (`role="status"`, cố định giữa-dưới màn hình, không có lớp phủ phía sau); hàm `toast(msg)` gán `ui.toast`, gọi `renderOverlay()`, tự xoá sau 2600ms bằng `setTimeout` (xem phát hiện: lệch với mô tả "2,4 giây" của `DESIGN-SYSTEM.md §4`); gọi lại từ khắp nơi sau mọi hành động ghi thành công (lưu file, thêm máy, commit, đổi tên, sao chép đường dẫn…) |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/Toast.tsx` — props: `message: ReactNode; durationMs?: number` (giá trị mặc định theo con số Authority chốt — xem phát hiện 2,4s vs 2,6s) + hook `useToast()` cung cấp `showToast(message)` dùng toàn app |

## Giải phẫu

Một dòng [icon tuỳ chọn, ví dụ ✓] [nội dung xác nhận, có thể chứa phần tô đậm như tên file/số lượng] — không có nút đóng, không có hành động.

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| hiện 2,4 giây rồi tự ẩn | ✓ | Nổi lên ngay khi gọi, tự biến mất sau khoảng thời gian cố định (2400 ms — prototype đã chỉnh khớp §4 ngày 2026-11-22); gọi lại trong lúc đang hiện sẽ thay nội dung và đặt lại bộ đếm |
| không chặn thao tác | ✓ | Không có lớp phủ phía sau, `position:fixed` không chiếm luồng layout, không bắt sự kiện click nền — người dùng thao tác tiếp bình thường trong lúc toast còn hiện |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền | `--color-surface-raised` |
| Chữ | `--color-text` |
| Viền | `--color-border` |
| Bo góc | `--radius` |
| Bóng | `--shadow` |
| Cỡ chữ | `--text-sm` |
| Đệm | `--space-sm` `--space-lg` |
| Khoảng cách icon–chữ | `--space-sm` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| — | Một kiểu duy nhất, không có biến thể màu theo loại thông báo — không có toast "lỗi", lỗi luôn dùng khối C5 |

## Tiếp cận (a11y)

`role="status"` (vùng live lịch sự, không ngắt lời trình đọc màn hình đang đọc dở). Không đặt hành động nào bên trong (không có nút) nên không cần quản lý focus. Vị trí cố định giữa-dưới không che các nút chính thường đặt ở trên/hai bên.

## Không được làm

- Không dùng toast để báo lỗi hoặc yêu cầu quyết định — dùng C5 (khối lỗi) hoặc C9 (hộp thoại); toast chỉ xác nhận việc **đã xong, không cần làm gì thêm**.
- Không đặt nút bấm bên trong toast.
- Không để hai toast chồng nhau — toast mới luôn thay thế toast cũ đang hiện.
