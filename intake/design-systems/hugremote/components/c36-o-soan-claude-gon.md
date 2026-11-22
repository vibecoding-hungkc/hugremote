# C36 — Ô soạn Claude gọn

| Field | Value |
|---|---|
| Mã | C36 |
| Nhóm | input |
| Mục đích | Cho người dùng gõ/nói yêu cầu cho Claude và kiểm soát cấu hình của phiên (model, mức suy nghĩ, quyền, chế độ gọn) trong một khung gọn, không chiếm quá nhiều chỗ của luồng chat |
| Màn hình dùng | S10 |
| Persona chạm tới | P-MOBILE, P-DESK, P-TEAM (chỉ phiên của mình) |
| Hiện thực prototype | class `.cbox` / `.crow` / `.cscroll` / `.chip` / `.attach` / `.slash`; hàm `composer(r, c, compact)`, `sendPrompt()`, `setMode()`; dòng chip Context/Hạn mức/Model/Quyền nằm trong `.cscroll` |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/ClaudeComposer.tsx` — props chính: `sessionId, model, effort, mode, ctxUsed, ctxMax, limit5h, limitWeek, running, offline, compact, recording, draft, attachments, onDraftChange, onSend, onStop, onCancelQueueNote?, onToggleRecord, onAttach, onChangeModel, onChangeEffort, onChangeMode, onToggleCompact` |

## Giải phẫu

Một khung `.cbox` duy nhất, viền sáng khi đang focus, gồm (theo đúng thứ tự dựng trong prototype):

**Hàng đính kèm** (chỉ hiện khi có file đính kèm) — nằm **trên** hàng 1, không phải trong hàng 2 như mô tả rút gọn ở kho: mỗi file một chip nhỏ (`.attach`) có nút ✕ bỏ đính kèm.

**Hàng 1** (`.crow`):
1. Ô nhập văn bản (textarea tự giãn chiều cao, tối đa ~160px)
2. Nút **mic** (nói thay vì gõ)
3. Nút **quyền** dạng chỉ-icon (khiên hoặc ⚠ nếu Bypass) — lối tắt nhanh mở menu chế độ quyền mà không phải với tay xuống hàng 2

**Hàng 2** (`.crow.tools`), từ trái sang phải:
1. Nút **đính kèm** (kẹp giấy, mở hộp mở nhanh file)
2. Nút **gọn** (icon "target") — bật/tắt chế độ gọn C37 của hội thoại (không phải của riêng ô soạn)
3. Dải chip trượt ngang `.cscroll` (mobile: vuốt ngang xem hết; desktop: đủ chỗ, không cần vuốt):
   a. Chip **Context** `<đã dùng>k/<sức chứa>k` (vd `227k/1000k`) — không hiện phần trăm
   b. Chip **Hạn mức 5 giờ** `x%` (vàng khi ≥80%, tooltip có hạn mức tuần + giờ reset) (desktop thêm "· tuần y%" cùng chip, ẩn trên mobile qua `.hide-mobile`)
   c. Chip **Model** `<tên model> · <mức suy nghĩ>` — bấm mở menu chọn model + mức suy nghĩ (Thấp/Vừa/Cao/Tối đa)
   d. Chip **Quyền** `<tên chế độ>` — bấm mở menu chọn chế độ quyền (⇧Tab xoay nhanh)
4. Nút **Dừng** (chỉ hiện khi đang chạy)
5. Nút **Gửi** (mũi tên lên — label đổi thành "Xếp hàng tin nhắn" khi đang chạy, hành vi vẫn là gửi)

Gõ `/` ở đầu ô nhập mở bảng gợi ý slash command (`.slash`) nổi phía trên `.cbox`.

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| trống | ✓ | Ô nhập rỗng, placeholder "Nhập yêu cầu cho Claude…"; nút Gửi **không có trạng thái khoá riêng cho ô trống** — bấm Gửi khi rỗng không làm gì (chặn ở hàm gửi, không phải ở giao diện nút) |
| đang gõ | ✓ | Ô nhập tự giãn theo số dòng (tối đa ~160px rồi cuộn trong ô); gõ `/` ở đầu dòng → mở `.slash` |
| Claude đang chạy (có Dừng; Gửi vẫn bật → tin xếp hàng C34, không có trạng thái khoá vì bận) | ✓ | Placeholder đổi "Nhắn thêm (xếp hàng)…"; nút Dừng (đỏ) xuất hiện trước Gửi; Gửi vẫn bấm được — gửi lúc này tạo một dòng C34, không khoá ô nhập |
| đang ghi âm | ✓ | Nút mic chuyển `on-primary`; placeholder đổi "Đang nghe… nói bằng tiếng Việt" |
| gợi ý `/` mở | ✓ | Bảng `.slash` nổi phía trên khung, liệt kê lệnh + mô tả ngắn (`/init`, `/compact`, `/review`, `/clear`) |
| Bypass (biểu tượng ⚠ đỏ) | ✓ | Icon quyền ở hàng 1 chuyển `on-danger` (đỏ) — khớp mô tả "⚠ đỏ"; chip Quyền ở hàng 2 chuyển lớp `danger` (viền + chữ `--color-danger`) — cùng màu đỏ với icon hàng 1 |
| mất kết nối (Gửi khoá) | ✓ | Nút Gửi nhận `disabled` + tooltip "Đang mất kết nối — làm được khi nối lại"; nút **Dừng** cũng khoá (thao tác ghi — AC-43); nháp giữ nguyên |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền khung `.cbox` | `--color-bg` |
| Viền khung | `--color-border`; khi focus-within → `--color-primary` |
| Bo góc khung | `--radius` |
| Chữ ô nhập | `--text-base` (16px — cố ý để iOS không tự phóng to) |
| Chip (Context/Hạn mức/Model/Quyền) | nền `--color-bg`, viền `--color-divider`, chữ `--text-xs` `--color-text-muted`, phần nhấn mạnh trong chip `--color-text` |
| Chip cảnh báo (Context >80%, Hạn mức ≥80%) | viền + chữ `--color-warning` |
| Chip Quyền khi Bypass | viền + chữ `--color-danger` |
| Icon quyền khi Bypass (hàng 1) | `--color-danger` |
| Nút Dừng | nền `--color-danger`, chữ `--color-bg` |
| Nút Gửi | nền `--color-primary`, chữ `--color-on-primary` |
| Đệm trong khung | `--space-xs` `--space-sm` |
| Khoảng cách giữa phần tử hàng | `--space-xs` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| `compact` (dùng khi chia ô — `withSplit()` gọi `composer(r, c, true)`) | Ẩn `.askbar` (thẻ duyệt quyền dạng thanh gọn phía trên); mọi phần khác giữ nguyên |
| Mobile (<768px) | Dải chip `.cscroll` vuốt ngang được thay vì xuống dòng; chip "Hạn mức … tuần" ẩn bớt phần tuần (`.hide-mobile`) |

## Tiếp cận (a11y)

- Ô nhập có `aria-label="Nhắn cho Claude"`.
- Nút gọn (target) có `aria-pressed` phản ánh bật/tắt chế độ gọn — giữ nguyên thuộc tính đã có ở prototype.
- Mọi nút chỉ-icon (mic, quyền hàng 1, đính kèm, gọn, Dừng, Gửi) có `title` + `aria-label` — đây là nhóm "thao tác developer quen tay" được phép chỉ-icon theo `DESIGN-SYSTEM.md §1`.
- Phím `⇧Tab` trong ô nhập xoay vòng chế độ quyền (trừ Bypass) — không được chặn hành vi Tab điều hướng mặc định khi không có focus trong ô nhập.
- Enter gửi, Shift+Enter xuống dòng — không gửi sớm khi đang gõ tiếng Việt bằng IME (kiểm `event.isComposing`).
- Vùng chạm mọi nút ≥ `--tap` trên mobile.
- Cặp tương phản chữ trên nút Gửi: `--color-on-primary` / `--color-primary` (nhóm "thường").

## Không được làm

- Không bỏ bớt nút khi "đóng gọn lại" giao diện — Authority đã nhắc lại rõ: **chỉnh cách trình bày, không bỏ nút**; mọi nút cũ (Context, Hạn mức, Model, Quyền) phải còn, có nhãn chữ, không rút gọn thành chỉ icon.
- Không hiện Context theo phần trăm — luôn là `<đã dùng>k/<sức chứa>k` (Authority lượt 6).
- Không có trạng thái "khoá vì bận" khi Claude đang chạy — gửi lúc đó luôn tạo tin xếp hàng (C34), không bao giờ vô hiệu hoá ô nhập hay nút Gửi vì lý do "đang bận" (D1, thay cho 409 `SESSION_BUSY` cũ).
- Không đặt nháp/đính kèm dùng chung giữa các phiên — mỗi phiên Claude giữ nháp và đính kèm riêng (D2, theo `sessionId`), kể cả trên cùng trình duyệt.
