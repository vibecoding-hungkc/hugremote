# C37 — Chế độ gọn của hội thoại Claude

| Field | Value |
|---|---|
| Mã | C37 |
| Nhóm | hiển thị |
| Mục đích | Cho người dùng chỉ xem việc Claude đang làm và kết quả, không phải đọc hết suy nghĩ + từng lệnh/file khi không cần — bật/tắt bằng nút gọn của C36 |
| Màn hình dùng | S10 |
| Persona chạm tới | P-MOBILE, P-DESK, P-TEAM (chỉ phiên của mình) |
| Hiện thực prototype | logic trong `chatBody(r, c, compact)` khi `ui.focus === true`: gom `m.t === 'tool'` vào mảng `steps`, ẩn `m.think`, hàm `flush()` dựng dòng gộp; biến `thinking` thêm "· bước hiện tại" khi đang chạy |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/ClaudeChatBody.tsx` — props chính: `messages: ClaudeMessage[], compactMode: boolean, running: boolean, onExpandSteps?: () => void` (bật/tắt `compactMode` nằm ở nút gọn của `ClaudeComposer`/C36, lưu `users.preferences.claudeFocusMode`) |

## Giải phẫu

Khi bật, thay đổi cách luồng chat hiển thị (không đổi dữ liệu stream, chỉ đổi cách vẽ):
1. Tin nhắn của người dùng — hiển thị bình thường, không đổi
2. Dòng trạng thái "Claude đang làm · `<bước hiện tại>`" khi phiên đang chạy (thay cho việc hiện từng thẻ công cụ)
3. Các bước công cụ liên tiếp (sửa file, chạy lệnh) — không hiện riêng từng thẻ, gộp lại thành **một dòng bấm được**: "`n` bước · sửa `x` file · chạy `y` lệnh" (kèm "· `z` lỗi" nếu có bước lỗi); bấm dòng này tắt chế độ gọn để xem đủ
4. Tin nhắn **cuối cùng** của Claude trong một chuỗi suy nghĩ — hiện phần trả lời, **ẩn khối "Suy nghĩ"** (không hiện `<details>` thu gọn được như ở chế độ đầy đủ)
5. Thẻ duyệt quyền (C21/`ask`), ghi chú dừng (C19 "note"), và tóm tắt lượt (C33) — **luôn hiện đầy đủ**, không bị gộp hay ẩn dù đang bật gọn

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| bật | ✓ | Luồng chat chỉ còn: tin của bạn, dòng trạng thái, dòng gộp bước, tin cuối của Claude, thẻ duyệt quyền, tóm tắt lượt |
| tắt | ✓ | Toàn bộ suy nghĩ (`<details>` mở được) + từng thẻ công cụ riêng lẻ hiện đầy đủ theo đúng thứ tự stream |

## Token dùng

| Vị trí | Token |
|---|---|
| Dòng trạng thái "Claude đang làm" | `--text-sm`, `--color-text-muted`; icon Claude `--color-accent-claude` |
| Dòng gộp bước (bấm được) | `--text-sm`, `--color-text-muted` (kiểu `.note.linkp`, không dùng màu liên kết mặc định `--color-primary` của `.linkp`) |
| Tin cuối của Claude | `--text-base`, `--color-text`; tên "Claude" `--color-accent-claude` |
| Con trỏ nháy khi đang stream | `--color-text` (`.caret`) |

## Biến thể

Không có — chỉ hai trạng thái bật/tắt, không có mức độ gọn khác nhau.

| Biến thể | Khác gì bản mặc định |
|---|---|
| — | — |

## Tiếp cận (a11y)

- Dòng gộp bước phải là phần tử bấm được thật (`<button>`, không phải `<div onclick>` trá hình) với nhãn mô tả hành động ("Tắt chế độ gọn để xem chi tiết" — giữ nguyên `title` đã có ở prototype).
- Bật/tắt chế độ gọn không được làm mất vị trí cuộn hiện tại của luồng chat một cách đột ngột — nên giữ neo ở tin nhắn đang xem.
- Thẻ duyệt quyền không được giảm độ nổi bật khi đang ở chế độ gọn — đây là yêu cầu của Authority ("duyệt quyền không được bị giấu"), viền `--color-warning` phải giữ nguyên độ tương phản dù đứng một mình giữa các dòng đã gộp.
- Lựa chọn bật/tắt là tuỳ chọn cá nhân lưu theo người dùng (`users.preferences`) — áp dụng mọi phiên, mọi thiết bị của người đó, không phải trạng thái cục bộ của một tab.

## Không được làm

- Không đổi dữ liệu luồng stream để phục vụ chế độ gọn — gọn chỉ là cách vẽ lại (`render`), không được bỏ qua hay không lưu thẻ công cụ/suy nghĩ ở tầng dữ liệu (mở lại ở chế độ đầy đủ phải thấy lại nguyên vẹn).
- Không ẩn hoặc gộp thẻ duyệt quyền, ghi chú dừng lượt, hoặc tóm tắt lượt khi đang bật gọn.
- Không lưu chế độ gọn riêng theo từng phiên Claude — đây là tuỳ chọn của người dùng, áp dụng đồng loạt cho mọi phiên họ mở (khác với model/effort/chế độ quyền ở C36, vốn lưu riêng từng phiên).
