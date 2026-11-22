# C11 — Hàng cây

| Field | Value |
|---|---|
| Mã | C11 |
| Nhóm | điều hướng |
| Mục đích | Hiện cấu trúc Máy → Dự án → Phiên (Claude trước, terminal sau) của không gian làm việc, chỉ mở nhánh đang dùng, và dẫn một chạm tới đúng tab đang xem của dự án đó |
| Màn hình dùng | S2 |
| Persona chạm tới | P-MOBILE, P-DESK, P-HOST, P-TEAM |
| Hiện thực prototype | class `.node` (`.host`, `.l1`, `.l2` theo cấp thụt lề; `.sel` đang chọn; `.err`/`.ign` màu theo trạng thái) + `.chev`/`.chev.open` (mũi tên thu/mở xoay 90°) + `.act` (nút **+**/**⋯** ẩn/hiện theo hover-focus-chọn, luôn hiện mobile) — dựng bằng hàm `tree(r)` (dòng 759) và đầu cây `treeHead()` (dòng 781, Thu gọn tất cả + Thêm máy) |
| Hiện thực pha I | `apps/web/src/components/ui/WorkspaceTree.tsx` — `hosts: HostNode[]; openKeys: Record<string, boolean>; currentPath: { host?: string; proj?: string; sid?: string }; onToggle, onOpenProject, onOpenSession: (...) => void; onRowMenu: (kind, ...) => void` |

## Giải phẫu

Ba cấp thụt lề: **máy** (`.node.host`, không thụt) — chevron → icon home/server → tên → (khi thu gọn: badge số cần duyệt hoặc "n chạy") → chấm kết nối (ok/err) → **⋯**. **dự án** (`.node.l1`, thụt `--space-xl`) — chevron → icon home/folder → tên → badge số cần duyệt → **+** (phiên mới) → **⋯**. **phiên** (`.node.l2`, thụt thêm `--space-lg`) — icon claude/terminal màu khu vực → tên → icon ⚠ nếu Bypass → thời gian rút gọn (màu cảnh báo nếu cần duyệt) → chấm trạng thái → **⋯**. Dự án chưa có phiên: một dòng muted "Chưa có phiên — tạo phiên" thay cho danh sách phiên.

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| thu/mở | ✓ | `.chev.open` xoay 90°; chỉ nhánh máy/dự án **đang dùng** mở sẵn, còn lại thu — không tự mở hết cây |
| đang chọn | ✓ | `.node.sel` — nền `--color-surface-raised` + vạch trái 2px `--color-primary` (inset box-shadow) |
| máy lỗi | ✓ | `.node.err .nm` chữ tên `--color-danger`; chấm trạng thái `--color-danger`, `title="Không kết nối được"` |
| phiên đang chạy | ✓ | Chấm `--color-primary` nhấp nháy (`@keyframes pulse`) |
| phiên cần duyệt | ✓ | Chấm `--color-warning`; thời gian rút gọn tô `--color-warning`; đồng thời cộng vào badge đếm ở cấp máy/dự án khi thu gọn |
| phiên xong | ✓ | Chấm `--color-success` |
| phiên đã kết thúc | ✓ | Chấm xám mặc định (không tô màu riêng) |
| dự án chưa có phiên | ✓ | Dòng "Chưa có phiên — tạo phiên" (icon +, muted), bấm mở menu **+** |
| đang tải | ✓ | Dùng lại khung xương của C3 (`skel`) |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền hover/chọn | `--color-surface-raised` |
| Vạch trái đang chọn | `--color-primary` |
| Chữ tên mặc định | `--color-text` |
| Chữ tên lỗi | `--color-danger` |
| Chữ tên ignore/muted | `--color-text-muted` |
| Chấm theo trạng thái | `--color-success` / `--color-primary` / `--color-warning` / `--color-danger` / `--color-text-muted` |
| Icon khu vực terminal | `--color-accent-terminal` |
| Icon khu vực Claude | `--color-accent-claude` |
| Icon cảnh báo Bypass | `--color-warning` |
| Badge số đếm (nền) | `--color-warning` |
| Chiều cao hàng | 36px *(giá trị thô, không token — ép lại `--text-base` cỡ chữ trên mobile)* |
| Thụt lề cấp 1 | `--space-xl` |
| Thụt lề cấp 2 | `--space-xl` + `--space-lg` |
| Cỡ chữ | `--text-sm` (desktop), `--text-base` (mobile) |
| Cỡ chữ meta/thời gian | `--text-xs` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| máy (cấp 0) | Đậm hơn (`font-weight:600` qua `.node.host`), có chấm kết nối thay vì chấm trạng thái phiên |
| dự án (cấp 1) | Có nút **+** riêng ngoài **⋯** |
| phiên (cấp 2) | Không có nút **+**, chỉ **⋯**; có thể mang icon Bypass |
| rỗng không gian làm việc | Khi chưa ghim máy nào: khối C4 nhỏ "Không gian làm việc đang trống." + nút "Chọn máy để ghim" |

## Tiếp cận (a11y)

Mỗi `.node` là phần tử `tabindex="0"` bấm được bằng Enter/Space (qua `onclick`, cần đảm bảo pha I gắn thêm `onKeyDown` cho Enter/Space vì prototype hiện chỉ có `onclick`). Nút **+**/**⋯** luôn hiện khi hàng `:focus-within` (không chỉ `:hover`) để điều hướng bàn phím thấy được. Chevron thu/mở có vùng bấm riêng (`event.stopPropagation()`), tách khỏi việc bấm cả hàng để mở dự án. Đầu cây có hai nút rõ nhãn: "Thu gọn tất cả" và "Ghim thêm máy vào không gian làm việc" (cả hai đều `aria-label` qua `ib()`).

## Không được làm

- Không tự mở toàn bộ cây khi tải — chỉ mở máy/dự án đang dùng (chốt phản hồi lượt 2 của Authority: "không phải lúc nào cũng hiện tất cả").
- Không gắn quá hai nút hành động cho mỗi hàng ngoài **⋯** (menu nổi C23 gom mọi hành động khác) — tránh hàng rối như v1.
- Không bỏ chấm trạng thái khi hàng đang `.sel` — trạng thái phải luôn thấy được bất kể đang chọn hay không.
- Không dùng C11 cho danh sách phẳng không phân cấp — dùng C3.
