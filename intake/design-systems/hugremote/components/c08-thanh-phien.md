# C8 — Thanh phiên

| Field | Value |
|---|---|
| Mã | C8 |
| Nhóm | điều hướng |
| Mục đích | Chuyển đổi giữa các phiên (Claude + terminal trộn chung, Claude trước) của một dự án, mở phiên mới, chia ô, và vào thẳng danh sách phiên cần duyệt |
| Màn hình dùng | S6, S10 |
| Persona chạm tới | P-MOBILE, P-DESK, P-HOST, P-TEAM |
| Hiện thực prototype | class `.tabbar` > `.tabs` (cuộn ngang, mỗi `.tab` có icon màu khu vực, tên, cảnh báo Bypass, chấm trạng thái, nút đóng cho terminal) + `.sesspick` (bộ chọn phiên thay dải tab, chỉ hiện <768px) + `.tools` (chuông C38, đổi tên, chia ô, **+**) — dựng bằng hàm `sessionBar(r, curId, extra)` (dòng 991); chia ô qua `openSplit(kind)`/`withSplit(r,left)` (dòng 999, 1005) với `.splitter` kéo được (`dragSplit`) |
| Hiện thực pha I | `apps/web/src/components/ui/SessionTabBar.tsx` — `sessions: SessionTab[]; currentId: string; onSelect, onClose, onRename, onSplit, onNewMenu: (...) => void; splitActive?: boolean; notifCount: number` |

## Giải phẫu

Thứ tự đọc (desktop, ≥768px): **dải tab cuộn ngang** (mỗi tab: icon claude/terminal màu khu vực → tên → icon ⚠ nếu Bypass → chấm trạng thái → nút đóng chỉ ở terminal) → **vùng công cụ cố định phải**: chuông thông báo C38 → đổi tên (C1 icon, chỉ khi có phiên đang xem) → chia ô (C1 icon, ẩn trên mobile) → **+** mở menu phiên mới (C23). Dưới 768px, dải tab bị ẩn hoàn toàn, thay bằng **bộ chọn phiên** (`.sesspick` — một hàng: icon phiên hiện tại + tên + badge số phiên + chevron xuống) mở C23 danh sách nhóm Claude/Terminal.

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| tab đang xem | ✓ | `.tab.on` — nền `--color-bg`, chữ `--color-text`, vạch trên 2px `--color-primary` (inset box-shadow) |
| tab khác | ✓ | Chữ `--color-text-muted`, nền trong suốt |
| tab đã kết thúc | ✓ | `.tab.ended .tn` gạch ngang tên (`text-decoration: line-through`) |
| menu + mở | ✓ | C23 nổi phía trên nút **+**, hai mục: Phiên Claude mới / Terminal mới |
| vạch chia đang kéo | ✓ | `.splitter.drag` (và `:hover`) đổi nền từ `--color-divider` sang `--color-primary` trong lúc kéo (`dragSplit`, `pointerdown`→`pointermove`) |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền thanh | `--color-surface` |
| Viền dưới thanh | `--color-divider` |
| Viền phải mỗi tab | `--color-divider` |
| Nền tab đang xem | `--color-bg` |
| Vạch trên tab đang xem | `--color-primary` |
| Chữ tab khác | `--color-text-muted` |
| Icon khu vực terminal | `--color-accent-terminal` |
| Icon khu vực Claude | `--color-accent-claude` |
| Chiều cao thanh | `--bar-h` (36px desktop ≥1024; dưới 1024px gán lại `--bar-h-touch` 44px) |
| Đệm tab | `--space-xs` `--space-md` |
| Cỡ chữ | `--text-sm` |
| Vạch chia (mặc định/kéo) | `--color-divider` / `--color-primary` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| dải tab (≥768px) | Danh sách ngang, mỗi phiên một tab riêng, cuộn ngang khi tràn |
| bộ chọn phiên C32 (<768px) | Thay dải tab bằng một hàng tên-phiên-hiện-tại + badge số phiên, mở danh sách nhóm khi bấm |
| đang chia ô | Thêm `.splitter` + ô phải (`withSplit`) — ô phải có `.pane-head` riêng với `<select>` đổi phiên trong cùng loại và nút đóng ô |

## Tiếp cận (a11y)

Dải tab mang `role="tablist"`, mỗi tab `role="tab"` + `tabindex="0"`; tên phiên dài bị cắt bằng ellipsis nhưng `title` đầy đủ trên tab giữ nguyên tên + trạng thái + phím tắt số thứ tự (`⌥1`…`⌥9`/`⌘1`…`⌘9` tuỳ PWA hay tab trình duyệt). Nút đóng tab (chỉ terminal) là C1 chỉ-icon với `aria-label="Đóng phiên <tên> (⌥W)"`. Bộ chọn phiên mobile (`.sesspick`) vùng chạm `--tap` theo luật media query ép `.tab`/`.node` v.v. Vạch chia kéo (`.splitter`) có `title="Kéo để đổi tỉ lệ"` nhưng **chỉ dùng được bằng con trỏ** (kéo chuột/chạm) — không có phím tắt thay thế trong prototype (ghi vào lỗ hổng nếu Authority yêu cầu điều khiển bàn phím cho vạch chia).

## Không được làm

- Không tách tab Claude và tab Terminal thành hai dải riêng — chốt của Authority (lượt phản hồi 1) là **một tab Phiên trộn**, Claude luôn trước Terminal.
- Không ẩn nút đóng tab khỏi terminal đã kết thúc trên mobile — mobile luôn hiện action, không cần hover.
- Không cho chia ô trên mobile (<768px) — `.splitter, .pane.second { display:none }` dưới breakpoint hẹp, chủ động không hỗ trợ màn hình nhỏ.
