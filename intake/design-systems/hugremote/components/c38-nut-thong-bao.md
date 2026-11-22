# C38 — Nút thông báo (chuông)

| Field | Value |
|---|---|
| Mã | C38 |
| Nhóm | action |
| Mục đích | Cho người dùng biết ngay có phiên Claude nào đang chờ mình duyệt — trên mọi dự án mình được thấy — và duyệt/từ chối ngay tại chỗ mà không rời màn đang làm |
| Màn hình dùng | S6, S10, S8, S9 |
| Persona chạm tới | P-MOBILE, P-DESK (mọi phiên), P-TEAM (chỉ phiên của mình) |
| Hiện thực prototype | hàm `notifBtn(r)` (nút chuông + huy hiệu số), `notifItems()` (nguồn dữ liệu), `rowMenu()` nhánh `m.kind === 'notif'` (danh sách nổi); đặt trong `sessionBar()` (thanh phiên C8, S6/S10) và trong `topbar()` (thanh trên C15) khi đang ở S8/S9 — bổ sung 2026-11-22 |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/NotificationBell.tsx` — props chính: `pendingCount: number, items: {sessionId, sessionName, what, pathHint, host, project, finishedLabel?}[], offline: boolean, onApprove: (sessionId) => void, onDeny: (sessionId) => void, onOpenSession: (sessionId) => void, onViewAllSessions: (host, project) => void` |

## Giải phẫu

**Nút chuông**: icon chuông, huy hiệu số tròn ở góc trên-phải khi có phiên cần duyệt (`n`).

**Danh sách nổi khi mở** (menu C23), theo thứ tự đọc:
1. Tiêu đề nhóm "Thông báo"
2. Mỗi phiên một dòng: icon Claude · tên phiên (co giãn, cắt bớt) · hai nút **✓ Cho phép** / **✗ Từ chối** (nếu đang chờ duyệt) hoặc huy hiệu "xong" (nếu vừa kết thúc lượt); dòng phụ bên dưới: yêu cầu rút gọn (vd "Muốn `tên-file`") · `máy › dự án`
3. Dòng rỗng "Không có phiên nào cần bạn." khi danh sách trống
4. Mục cuối "Tất cả phiên của dự án này" — mở danh sách đầy đủ phiên của dự án đang xem (không lọc theo "cần duyệt")

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| không có gì | ✓ | Chuông không có huy hiệu số; bấm vẫn mở được danh sách, hiện dòng "Không có phiên nào cần bạn." |
| có phiên cần duyệt (chuông tô `--color-primary` + số) | ✓ | Icon chuông chuyển `--color-primary`; huy hiệu số tròn hiện đè góc trên-phải của nút |
| vừa duyệt (dòng biến mất) | ✓ | Bấm ✓/✗ trên một dòng → dòng đó biến mất khỏi danh sách ngay (không đóng cả danh sách), huy hiệu số giảm theo |
| mất kết nối (✓/✗ khoá) | ✓ | Hai nút ✓/✗ của mọi dòng nhận `disabled` + tooltip "Đang mất kết nối — làm được khi nối lại"; bấm vào dòng để vào phiên vẫn hoạt động bình thường (chỉ thao tác ghi mới bị khoá, theo C13) |

## Token dùng

| Vị trí | Token |
|---|---|
| Icon chuông mặc định | `--color-text-muted` (kế thừa kiểu nút `.btn.ghost.icon`) |
| Icon chuông khi có phiên chờ | `--color-primary` (lớp `on-primary`) |
| Huy hiệu số | nền `--color-warning`, chữ `--color-bg`, bo `--radius-pill`, cỡ chữ `--text-xs` (kiểu `.cnt`) |
| Nền danh sách nổi | `--color-surface` |
| Viền danh sách nổi | `--color-border` |
| Bóng danh sách nổi | `--shadow` |
| Nút ✓ (Cho phép) | nền `--color-primary`, chữ `--color-on-primary` |
| Nút ✗ (Từ chối) | kiểu `.btn.sm.icon` mặc định (nền `--color-surface-raised`, viền `--color-border`) |
| Chữ tên phiên | `--text-sm`, `--color-text` |
| Chữ dòng phụ (yêu cầu + `máy › dự án`) | `--text-xs`, `--color-text-muted` |
| Huy hiệu "xong" | kiểu `.badge` + chấm `--color-success` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| Đặt ở thanh phiên C8 (S6/S10) | Thay cho nút danh sách cũ, cạnh nút Sửa/Chia ô |
| Đặt ở thanh trên C15 (S8/S9, cả mobile) | Cùng component, khác vị trí lắp; danh sách mở vẫn liệt kê theo **mọi dự án mình được thấy**, không giới hạn theo dự án đang xem Files/Git |

## Tiếp cận (a11y)

- Nút chuông có `title`/`aria-label` đổi theo trạng thái: "Thông báo" (không có gì) hoặc "`n` phiên cần duyệt" (có) — giữ đúng như prototype.
- Huy hiệu số đặt `aria-hidden="true"` (thông tin số đã nằm trong `aria-label` của nút) và `pointer-events:none`.
- Danh sách mở dùng điều hướng phím mũi tên + Enter (`menuKeys()`), mỗi dòng và mỗi nút ✓/✗ nhận `tabindex="0"` hoặc là `<button>` thật.
- Hai nút ✓/✗ có `title` riêng kèm phím tắt (desktop: `⌥Y`/`⌥N` hoặc `⌘Y`/`⌘N` tuỳ môi trường — D13).
- Vùng chạm nút chuông và hai nút ✓/✗ ≥ `--tap`.
- Cặp tương phản chấm "cần duyệt": `--color-warning` trên `--color-surface` (nhóm "thành phần").

## Không được làm

- Không giới hạn danh sách theo dự án đang mở — chuông luôn gộp mọi dự án owner/member được thấy (khác C32, vốn chỉ liệt kê phiên của dự án hiện tại).
- Không đóng cả danh sách khi duyệt một dòng — chỉ dòng đó biến mất, để duyệt liên tiếp nhiều phiên mà không phải mở lại danh sách.
- Không hiện lại badge "xong" mãi mãi — mục "vừa xong lượt" chỉ nên nằm trong danh sách một khoảng thời gian ngắn sau khi lượt kết thúc (pha I tự quyết ngưỡng, ghi `DECISIONS.md`), tránh danh sách đầy mục đã xong từ lâu.
