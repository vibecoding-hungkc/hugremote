# C12 — Thanh dưới mobile

| Field | Value |
|---|---|
| Mã | C12 |
| Nhóm | điều hướng |
| Mục đích | Điều hướng chính trên điện thoại giữa ba vùng gốc của app: Không gian làm việc, Máy, Cài đặt |
| Màn hình dùng | S2, S3, S7 |
| Persona chạm tới | P-MOBILE, P-TEAM |
| Hiện thực prototype | class `.bottombar` (`display:none` mặc định, `display:grid` 3 cột dưới 767px, có `env(safe-area-inset-bottom)`) — dựng bằng hàm `bottombar(r)` (dòng 810); ẩn hoàn toàn khi đang trong một dự án (`inProject(r)` true — khi đó mobile dùng `.keybar`/thanh trên thay vì thanh dưới) |
| Hiện thực pha I | `apps/web/src/components/ui/MobileTabBar.tsx` — `active: 'workspace' \| 'hosts' \| 'settings'; onNavigate: (dest) => void` |

## Giải phẫu

Ba ô bằng nhau theo lưới (`grid-template-columns: repeat(3,1fr)`), mỗi ô: **icon** (trên) + **nhãn chữ** (dưới) — không badge số đếm trên thanh này (badge cần duyệt nằm ở chuông C38 trong thanh trên của dự án, không lặp lại ở đây). Thứ tự cố định: Không gian (folder) → Máy (server) → Cài đặt (cog).

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| mục đang xem | ✓ | `button.on` — icon + chữ chuyển `--color-primary` |
| mục khác | ✓ | Icon + chữ `--color-text-muted` |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền thanh | `--color-surface` |
| Viền trên | `--color-divider` |
| Chữ/icon mục khác | `--color-text-muted` |
| Chữ/icon mục đang xem | `--color-primary` |
| Chiều cao thanh | `--bar-h` + 8px *(8px là bù trực quan, giá trị thô)* + `env(safe-area-inset-bottom)` |
| Cỡ chữ | `--text-xs` |
| Khoảng cách icon/chữ | 2px *(giá trị thô, không token — khoảng cách rất hẹp dưới mức `--space-xs`)* |

## Biến thể

Không có biến thể cỡ/màu — chỉ hai trạng thái ở trên. Thanh **biến mất** hoàn toàn (không phải một biến thể ẩn-rỗng) khi người dùng đang ở trong một dự án (S6/S8/S9/S10) — lúc đó điều hướng về không gian làm việc dùng nút "←" ở thanh trên (C15), không phải thanh dưới.

## Tiếp cận (a11y)

Bọc trong `<nav aria-label="Điều hướng chính">`. Mỗi nút cao đủ `--bar-h` + phần bù an toàn, rộng bằng 1/3 màn — vượt xa `--tap`. Icon mang `aria-hidden`, nhãn chữ là nguồn tên chính cho trình đọc màn hình (không chỉ dựa icon). `env(safe-area-inset-bottom)` đảm bảo thanh không bị tai thỏ/thanh cử chỉ hệ điều hành che mất.

## Không được làm

- Không thêm mục thứ tư — ba mục cố định theo đúng ba vùng gốc; "Dự án" không có mục riêng vì không có màn tổng quan dự án (bấm dự án đi thẳng vào tab đang dùng).
- Không hiện thanh này trên desktop/tablet ≥768px — đã có thanh bên cố định hoặc trượt ra thay thế.
- Không hiện thanh này khi đang trong một dự án — tránh hai lớp điều hướng chồng nhau.
