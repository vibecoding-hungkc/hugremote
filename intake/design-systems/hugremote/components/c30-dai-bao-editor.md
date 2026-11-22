# C30 — Dải báo trong editor

| Field | Value |
|---|---|
| Mã | C30 |
| Nhóm | phản hồi |
| Mục đích | Báo cho developer biết Claude vừa sửa file đang mở (đã tự tải lại) mà không cắt ngang việc đang làm |
| Màn hình dùng | S8 |
| Persona chạm tới | P-MOBILE, P-DESK (PERSONAS §1.1 — "Duyệt thay đổi Claude vừa làm") |
| Hiện thực prototype | class `.notice` (biến thể `.notice.danger`); render trong `S8()` ở biến `notice` (và `conflict` — xem "Không được làm") |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/EditorNotice.tsx` — props chính: `visible: boolean, variant: 'info' \| 'danger', message: string, onViewDiff?: () => void, onClose: () => void` |

## Giải phẫu

Một dải ngang, flush với mép trái/phải của vùng editor, nằm giữa thanh tab file (`.ehead`/`.tabbar`) và vùng code, theo thứ tự đọc:
1. Icon Claude (`claude-ic`)
2. Câu báo, một dòng: "Claude vừa sửa file này — đã tự tải lại (bạn chưa sửa gì)."
3. Nút **Xem thay đổi** (mở chế độ diff của C17)
4. Nút đóng (✕)

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| hiện | ✓ | Dải hiện ngay dưới thanh tab file, viền dưới 1px tô `--color-primary`; biến mất tự nhiên khi chuyển sang file khác |
| đã đóng | ✓ | Bấm ✕ → dải biến mất, không hiện lại cho tới lần Claude sửa file tiếp theo |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền dải | `--color-surface-raised` |
| Viền dưới (nhấn mạnh) | `--color-primary` |
| Chữ | `--text-sm`, `--color-text` |
| Biểu tượng Claude | `--color-accent-claude` |
| Đệm | `--space-xs` `--space-sm` `--space-md` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| — | Không có biến thể chính thức trong kho C30. Prototype dùng chung class `.notice` cho hộp xung đột file (AC-37: "So sánh · Lấy bản trên máy · Giữ bản của tôi", viền dưới `--color-danger`) — đây là một khối khác về mục đích (xử lý xung đột, không chỉ là báo tin), **không coi là biến thể của C30** cho tới khi được thêm vào `DESIGN-SYSTEM.md §4` (xem phát hiện ở báo cáo cuối). Pha I không tự suy ra biến thể "danger" cho C30 từ việc này. |

## Tiếp cận (a11y)

- Dải có `role` ngầm là thông báo trạng thái không chặn thao tác — không dùng `role="alert"` (tránh ngắt lời trình đọc màn hình liên tục khi Claude sửa nhiều file); dùng `aria-live="polite"`.
- Nút đóng có `aria-label="Đóng thông báo"`.
- Cặp tương phản chữ trên nền: `--color-text` / `--color-surface-raised` (nhóm "thường", `DESIGN-SYSTEM.md §3`).
- Vùng chạm hai nút ≥ `--tap` trên mobile.

## Không được làm

- Không chặn thao tác sửa file khi dải đang hiện — chỉ là thông báo, không phải khoá (khác C13).
- Không tự ẩn theo thời gian như C27 (toast) — người dùng phải chủ động đóng hoặc chuyển file, vì đây là thông tin cần hành động (xem thay đổi), không phải xác nhận việc đã xong.
- Không dùng C30 cho xung đột ghi đè (hai bản cùng sửa một file) — ca đó cần ba lựa chọn tường minh (So sánh/Lấy bản máy/Giữ bản của tôi), nằm ngoài danh sách trạng thái bắt buộc của C30; cần hỏi Authority có tách thành component riêng hay không trước khi hiện thực hoá ở pha I.
