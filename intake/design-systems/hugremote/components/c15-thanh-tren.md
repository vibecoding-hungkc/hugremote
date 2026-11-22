# C15 — Thanh trên

| Field | Value |
|---|---|
| Mã | C15 |
| Nhóm | điều hướng |
| Mục đích | Khung cố định đầu màn cho biết đang ở đâu (phạm vi C7) và cho lối tắt tới mọi nơi khác (tab dự án, chuyển nhanh, phím tắt, cài đặt) |
| Màn hình dùng | S2, S6, S8, S9, S10 |
| Persona chạm tới | P-MOBILE, P-DESK |
| Hiện thực prototype | class `.topbar` (chứa `.crumb` — breadcrumb C7, nút ẩn/hiện sidebar `.only-desk`, nút mở sidebar `.only-narrow`, nút quay lại `.only-mobile` khi trong dự án/phiên); hàm `topbar(r, title)` dựng khung, gọi `projTabs(r,'ptabs-d')` cùng dòng cho desktop và trả thêm `projTabs(r,'ptabs-m')` làm dòng riêng cho mobile |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/TopBar.tsx` — props: `scope?: { hostName: string; projectName?: string; projectPath?: string }; title?: string; showBack: boolean; sidebarHidden: boolean; onToggleSidebar: () => void; onOpenSpot: () => void; onOpenShortcuts: () => void` |

## Giải phẫu

[nút ẩn/hiện thanh bên (desktop) HOẶC nút mở thanh bên (mobile/tablet <1024px) HOẶC nút quay lại (mobile, trong dự án/phiên)] (đúng một trong ba, bắt buộc) → [phạm vi C7 — tên máy, tên dự án, đường dẫn — HOẶC tiêu đề tĩnh khi ngoài dự án] (bắt buộc) → [tab dự án C16, chỉ khi trong dự án, desktop] (tuỳ chọn) → nút Chuyển nhanh (bắt buộc) → nút phím tắt (chỉ desktop, tuỳ chọn) → nút Cài đặt (chỉ desktop, tuỳ chọn).

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| desktop | ✓ | ≥1024px: nút ẩn/hiện thanh bên (`⌘\`), tab dự án C16 nằm cùng dòng bên phải phạm vi, nút phím tắt và Cài đặt hiện |
| mobile (nút ← khi ở trong dự án/phiên) | ✓ | <1024px: nút mở thanh bên dạng hamburger thay cho ẩn/hiện; nút Cài đặt ẩn (chuyển vào thanh dưới); khi đang trong dự án/phiên, thêm nút ← quay về không gian làm việc; tab dự án C16 (nếu có) xuống dòng riêng bên dưới |

## Token dùng

| Vị trí | Token |
|---|---|
| Chiều cao | `--bar-h` (36px desktop ≥1024; dưới 1024px gán lại `--bar-h-touch` 44px) |
| Nền | `--color-bg` |
| Viền dưới | `--color-divider` |
| Khoảng cách giữa các nút | `--space-sm` |
| Đệm ngang | `--space-sm` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| — | Không có biến thể màu/kích cỡ; chỉ nội dung bên trong đổi theo route (có/không phạm vi, có/không tab dự án) |

## Tiếp cận (a11y)

Breadcrumb bọc trong `<nav aria-label="Phạm vi hiện hành">`. Mọi nút chỉ-icon dùng mẫu C1 (`title` + `aria-label` trùng nội dung). Vùng chạm ≥ `--tap` trên mobile (nút kế thừa `.btn.ghost.sm.icon`, bị ép `--tap` dưới 768px theo CSS chung).

## Không được làm

- Không cho tab dự án C16 xuất hiện ngoài ngữ cảnh "đang trong một dự án".
- Không bỏ nút Chuyển nhanh ở bất kỳ route nào — luôn hiện kể cả ngoài dự án.
- Không gộp nút quay lại (mobile) với nút mở thanh bên — hai hành động khác nhau (về không gian làm việc, khác với trượt sidebar ra khi đang ở không gian làm việc nhưng màn hẹp).
