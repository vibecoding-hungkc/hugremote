# C14 — Huy hiệu trạng thái

| Field | Value |
|---|---|
| Mã | C14 |
| Nhóm | hiển thị |
| Mục đích | Cho biết trạng thái máy/phiên/kết nối bằng một chấm màu + nhãn chữ ngắn, đọc được trong nháy mắt trên cây, thẻ, tab |
| Màn hình dùng | S2, S3, S6, S7, S9, S10 |
| Persona chạm tới | P-MOBILE, P-DESK, P-HOST, P-TEAM |
| Hiện thực prototype | class `.badge` (biến thể `.badge.warn` viền cảnh báo, `.badge.danger` viền đỏ) bọc `.dot` (biến thể `.dot.ok` `.dot.run` nhấp nháy qua `@keyframes pulse` `.dot.warn` `.dot.err`); hàm `statusBadge(s)` tra bảng `SB` (map trạng thái → `[class dot, nhãn]`) dựng `<span class="badge …">`; `dotCls(s)` dùng khi chỉ cần chấm đơn (cây C11, tab C8); `durLabel(s)` ghép nhãn + "ago" cho `title` |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/StatusBadge.tsx` — props: `status: 'running'\|'awaiting'\|'done'\|'stopped'\|'exited'\|'ok'\|'err'\|'connecting'; label?: string; dotOnly?: boolean` |

## Giải phẫu

Chấm tròn (bắt buộc) → nhãn chữ (bắt buộc ở biến thể huy hiệu đầy đủ; biến thể "chỉ chấm" bỏ nhãn hiển thị, chuyển nhãn sang `title`/`aria-label`, dùng khi chỗ chật — hàng cây C11, tab phiên C8, hàng máy S3 trên mobile).

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| đang chạy | ✓ | Chấm `--color-primary` nhấp nháy opacity 100%↔35% chu kỳ 1.6s (`.dot.run`, `@keyframes pulse`); nhãn "đang chạy". Giống nhau desktop/mobile — animation vẫn chạy trên mobile |
| cần duyệt | ✓ | `.badge.warn`: nền `--color-surface`, viền trong `--color-warning` (box-shadow inset), chữ `--color-warning`; chấm `--color-warning`. Trên cây C11 khi node đóng, thay bằng số đếm `.cnt` (nền `--color-warning`) thay vì huy hiệu đầy đủ |
| xong | ✓ | Chấm `--color-success` (`.dot.ok`… thực ra dùng chung mã `ok`), nhãn "xong", `.badge` không biến thể |
| đã kết thúc | ✓ | Chấm mặc định `--color-text-muted` (không hậu tố), nhãn "đã kết thúc" |
| kết nối được | ✓ | Chấm `--color-success` (`.dot.ok`), nhãn "kết nối được" — dùng cho trạng thái máy ở S3 |
| lỗi | ✓ | `.badge.danger` (viền + chữ `--color-danger`) cho dạng thẻ, hoặc chấm đơn `.dot.err` trên cây/hàng máy; nhãn "không kết nối được" |
| đang nối | ✓ | Cùng màu `--color-warning` như "cần duyệt" nhưng nhãn "đang nối" — dùng khi máy đang thử kết nối lại |

Desktop vs mobile: huy hiệu đầy đủ (chấm+nhãn) luôn hiện trên thẻ (S2 "Cần bạn"/"Đang chạy") ở mọi cỡ màn; hàng máy S3 rút gọn về chỉ chấm dưới 768px (`class="only-mobile dot err"`, huy hiệu đầy đủ ẩn qua `hide-mobile`) để tiết kiệm chỗ ngang.

## Token dùng

| Vị trí | Token |
|---|---|
| Nền viền (biến thể warn/danger) | `--color-surface` |
| Viền trong cảnh báo/nguy hiểm | `--color-warning` `--color-danger` |
| Chấm theo trạng thái | `--color-primary` `--color-success` `--color-warning` `--color-danger` `--color-text-muted` |
| Chữ nhãn | `--text-xs`, `--color-text-muted` (mặc định) hoặc màu trạng thái |
| Bo góc | `--radius-pill` |
| Khoảng cách chấm–nhãn | `--space-xs` |
| Đệm ngang huy hiệu | `--space-sm` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| huy hiệu đầy đủ | Mặc định: chấm + nhãn chữ trong một `.badge` |
| chỉ chấm | Dùng `.dot` độc lập, không bọc `.badge`; nhãn chuyển sang `title`/`aria-label` |

## Tiếp cận (a11y)

Chấm màu không phải kênh thông tin duy nhất — luôn kèm nhãn chữ hoặc `title`/`aria-label` (ví dụ chấm đơn trên cây dùng `title="Kết nối được"`/`"Không kết nối được"`) để không phụ thuộc màu sắc. Cặp tương phản bắt buộc đạt AA (`DESIGN-SYSTEM.md §3`, nhóm "thành phần"): chấm xong/kết nối được trên thẻ `--color-success`/`--color-surface`; chấm đang chạy trên thẻ `--color-primary`/`--color-surface`; chấm cần duyệt trên thẻ `--color-warning`/`--color-surface`. Animation nhấp nháy của trạng thái "đang chạy" nên tôn trọng `prefers-reduced-motion` ở pha I (prototype hiện chưa áp dụng — xem phát hiện ở báo cáo cuối).

## Không được làm

- Không bịa thêm trạng thái ngoài bảy trạng thái đã khoá ở `DESIGN-SYSTEM.md §4` (danh sách đóng).
- Không dùng chấm đơn không kèm nhãn/tooltip ở nơi lần đầu xuất hiện trong một màn — chỉ rút gọn khi ngữ cảnh đã đủ rõ (tên phiên/máy đứng cạnh).
- Không tự đổi màu ngoài bảng `SB` (map trạng thái → màu) đã chốt trong prototype.
