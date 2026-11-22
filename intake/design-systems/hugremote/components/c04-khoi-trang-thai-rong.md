# C4 — Khối trạng thái rỗng

| Field | Value |
|---|---|
| Mã | C4 |
| Nhóm | hiển thị |
| Mục đích | Giải thích vì sao một vùng nội dung đang trống và mở lối đi tới việc đầu tiên cần làm, thay vì để trống trơn gây hoang mang |
| Màn hình dùng | S2, S3, S5, S6, S8, S9, S10 |
| Persona chạm tới | P-MOBILE, P-DESK, P-HOST, P-TEAM |
| Hiện thực prototype | class `.empty` (căn giữa, rộng tối đa 460px) + hàm `empty(icon, msg, btns)` (dòng 689) dựng icon lớn muted + một câu `<p>` + vùng nút tuỳ chọn căn giữa |
| Hiện thực pha I | `apps/web/src/components/ui/EmptyState.tsx` — `icon: IconName; message: string; action?: { label: string; onClick: () => void; icon?: IconName }` (tối đa **một** action — xem Không được làm) |

## Giải phẫu

Thứ tự đọc, canh giữa theo chiều dọc: **icon lớn** (32×32, muted — giá trị thô, không có token cỡ icon riêng) → **một câu** giải thích vì sao trống (`--text-base`, `--color-text-muted`) → **đúng một nút hành động chính** (C1 biến thể `.primary`, tuỳ chọn — một số khối rỗng không có hành động, ví dụ S2 khi không còn phiên chạy nhưng cũng không rỗng hẳn).

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| một câu + đúng một nút hành động | ✓ | Icon + câu + nút `.primary` mở việc đầu tiên (vd S3 "Mới có máy này…" + "Thêm máy"; S6 "Dự án … chưa có phiên nào" + hai nút Claude/Terminal mới; S10 "Hỏi Claude điều gì đó…" + gợi ý) |
| chỉ thông tin (biến thể phụ) |  | Chỉ icon + câu, không nút — **chỉ** dùng cho khối con nằm trong vùng đã có hành động chính (vd "Không thấy … trong dự án" của C29, mục "Đang chạy" trống ở S2 khi thẻ Bắt đầu/nút + đã có). Rỗng của cả một màn/vùng luôn dùng trạng thái có một nút (khuôn §5) |

## Token dùng

| Vị trí | Token |
|---|---|
| Chữ câu giải thích | `--color-text-muted` |
| Icon lớn | `--color-text-muted` |
| Đệm khối | `--space-xl` |
| Khoảng cách icon/câu/nút | `--space-lg` |
| Cỡ chữ | `--text-base` |

Ghi chú: cỡ icon lớn (32×32) không có token riêng trong bảng §2 — là giá trị thô ghi ở Giải phẫu như ràng buộc bố cục, không tự đẻ token `--icon-size-lg`.

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| trong cây (C11) | Khi cả không gian làm việc trống: khối rỗng nhỏ hơn, lồng trong `.tree` thay vì giữa `.content`, kèm nút "Chọn máy để ghim" dẫn sang S3 |
| trong danh sách phiên (`notifItems`) | Câu "Không có phiên nào cần bạn." không có nút — chỉ là dòng trạng thái, không phải khối C4 đầy đủ (xem Không được làm) |

## Tiếp cận (a11y)

Icon lớn mang `aria-hidden="true"` (trang trí, không phải thông tin) — câu chữ phải tự đủ nghĩa không cần icon. Câu giải thích và nút nằm trong luồng đọc tự nhiên của vùng nội dung (không phải overlay) nên trình đọc màn hình gặp đúng thứ tự. Cặp tương phản: `--color-text-muted`/`--color-bg` (vùng nội dung nền trang) đạt mức "thường" ở §3.

## Không được làm

- Không đặt quá **một** nút hành động chính trong một khối C4 — nhiều nút làm mất tính "một lối tới" (nguyên tắc §1 "Một lối tới").
- Không dùng C4 cho thông báo ngắn không cần chiếm cả vùng nội dung (vd "Không có phiên nào cần bạn." trong danh sách thông báo) — đó là dòng trạng thái trơn, không phải khối rỗng toàn vùng.
- Không thay icon lớn bằng ảnh minh hoạ (illustration) — giữ nhất quán với phong cách "ít màu, đơn sắc" của hệ thống.
