# C3 — Hàng danh sách

| Field | Value |
|---|---|
| Mã | C3 |
| Nhóm | hiển thị |
| Mục đích | Hiện một mục trong danh sách (máy, thư mục, thiết bị, kết quả tìm, commit…) với icon dẫn nhập, hai dòng chữ (tiêu đề + phụ), và hành động/trạng thái cuối hàng |
| Màn hình dùng | S3, S5, S7, S8, S9 |
| Persona chạm tới | P-MOBILE, P-DESK, P-HOST, P-TEAM |
| Hiện thực prototype | class `.list` (khung, viền chia dòng) + `.row` (một hàng, `.sel` khi đang chọn) + `.t`/`.t1`/`.t2` (khối chữ hai dòng, ellipsis) + `.skel`/`.skel-row` (khung xám khi tải) — dựng trực tiếp trong từng hàm màn (`S3()`, `S5()`, `S7()`, `searchResults()`, lịch sử commit ở `S9()`); hàm dùng chung `skel(n)` (dòng 691) sinh n hàng khung xám |
| Hiện thực pha I | `apps/web/src/components/ui/ListRow.tsx` — `icon?: IconName; title: string; subtitle?: string; selected?: boolean; trailing?: ReactNode; loading?: boolean; onClick?: () => void` |

## Giải phẫu

Thứ tự đọc: **icon dẫn nhập** (tuỳ chọn, trái, cố định không co) → **khối chữ hai dòng** (`t1` tiêu đề đậm vừa, `t2` phụ muted nhỏ hơn — `t2` tuỳ chọn) → **trailing** (tuỳ chọn, phải: badge trạng thái, nút icon hành động hiện khi hover/chọn trên desktop và luôn hiện trên mobile, hoặc chevron dẫn tiếp). Hàng cuối trong `.list` không có viền chia dưới.

Ràng buộc bố cục không token: chiều cao hàng cố định 52px (`.row`) — giá trị thô, không token, nhưng đã vượt `--tap` nên tự đạt vùng chạm tối thiểu mà không cần ép lại ở media query mobile.

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| mặc định | ✓ | Nền `--color-surface`, chữ `t1` màu `--color-text`, `t2` màu `--color-text-muted`; viền chia dòng `--color-divider` |
| đang chọn | ✓ | `.row.sel` (và `:hover` dùng chung style) — nền chuyển `--color-surface-raised`; trailing action luôn hiện (không cần hover) |
| đang tải | ✓ | `.skel-row`: icon thay bằng khối `--color-surface-raised` 24×24, hai dòng chữ thay bằng hai thanh `--color-surface-raised` (55% và 35% rộng) — dùng `skel(n)`, mặc định 3–4 hàng tuỳ màn |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền container | `--color-surface` |
| Viền container + chia dòng | `--color-divider` |
| Nền đang chọn/hover | `--color-surface-raised` |
| Chữ tiêu đề | `--color-text` |
| Chữ phụ | `--color-text-muted` |
| Khung xương khi tải | `--color-surface-raised` |
| Bo góc container | `--radius` |
| Đệm hàng | `--space-sm` (dọc), `--space-lg` (ngang) |
| Khoảng icon–chữ–trailing | `--space-md` |
| Cỡ chữ phụ | `--text-sm` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| có trailing badge trạng thái | Dùng C14 (huy hiệu) ở cuối hàng — vd trạng thái kết nối máy ở S3 |
| có trailing hành động (hover-reveal) | Nút icon C1 chỉ hiện khi `:hover`/`:focus-within`/`.sel` trên desktop (`opacity:0` → `1`); **luôn hiện trên mobile** (không có hover) |
| hàng dạng link lớn (toàn khối bấm được) | S2 "Cần bạn"/"Đang chạy": cả hàng là một `<button>` nền trong suốt, không viền — dùng khi cả hàng dẫn tới một đích duy nhất |

## Tiếp cận (a11y)

Hàng cao 52px, vượt `--tap` nên luôn đủ vùng chạm dù không ép token. Hành động cuối hàng ẩn/hiện theo hover trên desktop phải đồng thời hiện khi phần tử con nhận `:focus-within` — không được chỉ dựa vào `:hover` (người dùng bàn phím/trình đọc màn hình phải thấy và bấm được). Cặp tương phản: `t1` dùng `--color-text`/`--color-surface` ("Tối — chữ chính trên nền thẻ" tương đương quy tắc §3 cho hàng chọn: `--color-text`/`--color-surface-raised`); `t2` dùng `--color-text-muted`/`--color-surface` và `--color-text-muted`/`--color-surface-raised`. Hàng bấm được phải là phần tử tương tác thật (`<button>` hoặc có `role="button"` + `tabindex="0"` + xử lý `Enter`/`Space`), không phải `<div onclick>` trơ.

## Không được làm

- Không hiện trailing action ẩn hoàn toàn trên mobile — mobile không có hover nên action phải luôn hiện.
- Không dùng C3 để thay thế C11 (hàng cây) — cây có thụt lề theo cấp và chevron thu/mở, danh sách phẳng thì dùng C3.
- Không bỏ khung xương khi tải để thay bằng spinner toàn màn — khuôn "đang tải" chuẩn là khung xương đúng kích thước hàng sắp hiện (`DESIGN-SYSTEM.md §5`), không nhảy layout.
