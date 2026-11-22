# C16 — Thanh tab dự án

| Field | Value |
|---|---|
| Mã | C16 |
| Nhóm | điều hướng |
| Mục đích | Chuyển giữa ba khía cạnh của cùng một dự án (Phiên, Files, Git) mà không rời phạm vi hiện tại |
| Màn hình dùng | S2, S6, S8, S9, S10 |
| Persona chạm tới | P-MOBILE, P-DESK |
| Hiện thực prototype | class `.ptabs` (desktop `.ptabs-d` nằm trong `.topbar`; mobile `.ptabs-m` dòng riêng — `.ptabs-d` ẩn, `.ptabs-m` hiện dưới 768px) chứa `.ptab` (biến thể `.on` khi đang xem) + `.cnt` (số phiên cần duyệt, nền `--color-warning`) hoặc `.badge` (số thay đổi git); hàm `projTabs(r, cls)` |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/ProjectTabs.tsx` — props: `active: 'sessions'\|'files'\|'git'; pendingCount: number; gitChangesCount: number; onSelect: (tab: 'sessions'\|'files'\|'git') => void` |

## Giải phẫu

Ba nút theo thứ tự cố định: Phiên → Files → Git. Mỗi nút gồm [icon] [nhãn] [huy hiệu số, tuỳ chọn].

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| tab đang xem | ✓ | `.on`: nền `--color-surface-raised`, chữ `--color-text` (so với chữ phụ mặc định `--color-text-muted` của tab không chọn) |
| tab có huy hiệu (Phiên: số Claude cần duyệt; Git: số thay đổi) | ✓ | Tab Phiên: `.cnt` (nền `--color-warning`, chữ `--color-bg`, bo `--radius-pill`) hiện số phiên Claude `awaiting`; tab Git: `.badge` hiện số file trong `g.changes.length` — cả hai ẩn khi bằng 0 |

Desktop vs mobile: desktop ba tab nằm cùng dòng với breadcrumb trong C15 (phím tắt Ctrl+1/2/3); mobile ba tab xuống dòng riêng ngay dưới C15, kéo dài hết chiều ngang (`justify-content:space-around`), vùng chạm mỗi tab ép `--tap`.

## Token dùng

| Vị trí | Token |
|---|---|
| Nền tab đang xem | `--color-surface-raised` |
| Chữ | `--color-text` `--color-text-muted` |
| Nền huy hiệu | `--color-warning` |
| Bo góc nút | `--radius` |
| Bo góc huy hiệu | `--radius-pill` |
| Cỡ chữ nhãn | `--text-sm` |
| Cỡ chữ huy hiệu | `--text-xs` |
| Khoảng cách | `--space-xs` `--space-md` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| — | Ba tab cố định, không thêm/bớt theo dự án — dự án chưa có repo vẫn hiện tab Git, dẫn tới màn rỗng của S9 |

## Tiếp cận (a11y)

Bọc trong `<nav aria-label="Tab dự án">`. Mỗi nút có `title` nêu phím tắt (Ctrl+1/2/3). Thứ tự tab theo DOM khớp thứ tự đọc.

## Không được làm

- Không ẩn tab Git/Files khi dự án chưa có repo/file — luôn hiện đủ ba tab, màn đích tự xử lý trạng thái rỗng.
- Không đổi thứ tự ba tab theo ngữ cảnh — luôn Phiên → Files → Git.
