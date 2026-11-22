# C19 — Tin nhắn chat

| Field | Value |
|---|---|
| Mã | C19 |
| Nhóm | hiển thị |
| Mục đích | Hiển thị hội thoại giữa người dùng và Claude theo đúng trình tự xảy ra, phân biệt rõ ai nói gì và việc gì đang chạy |
| Màn hình dùng | S10 |
| Hiện thực prototype | class `.msg` (biến thể `.msg.user` bong bóng phải, `.msg.queued` tin xếp hàng mờ — xem C34) chứa `.who` (nhãn "Claude", màu `--color-accent-claude`), `.think` (suy nghĩ, `<details>` thu gọn được, viền trái `--color-divider`), `.caret` (con trỏ nhấp nháy, `@keyframes blink`); hàm `chatBody(r,c,compact)` lặp `c.msgs`, chọn `render1(m)` theo `m.t` (`user`/`claude`/`tool` → C20/`ask` → C21/`note`/`summary` → C33); chế độ gọn C37 (`ui.focus`) gộp các bước `tool` liên tiếp thành một dòng tóm tắt qua hàm nội bộ `flush()` |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/ChatMessage.tsx` — props: `role: 'user'\|'claude'; text: string; thinking?: string; streaming: boolean; stopped?: boolean; error?: boolean` |

## Giải phẫu

Tin của Claude: [nhãn "Claude" + icon, bắt buộc] → [khối suy nghĩ, tuỳ chọn, thu gọn mặc định] → [nội dung chính dạng Markdown, bắt buộc] → [con trỏ nhấp nháy khi đang stream, tuỳ chọn]. Tin của người dùng: chỉ nội dung, căn phải, không nhãn tên (ngữ cảnh đã rõ là người dùng).

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| đang stream (con trỏ nháy) | ✓ | `.caret` nối cuối nội dung trong lúc Claude đang sinh chữ; dùng chung với dòng trạng thái "Claude đang làm… <caret>" khi phiên đang chạy |
| xong | ✓ | Nội dung tĩnh, không `.caret`; có thể kèm khối tóm tắt lượt C33 ngay sau |
| đã dừng | ✓ | Tin dạng `.note` "Bạn đã dừng Claude lúc <giờ>" chèn vào cuối hội thoại (`stopClaude()`); các thẻ công cụ đang chạy chuyển nhãn "đã dừng" |
| lỗi | ✓ | Không phải màu riêng của bong bóng `.msg` — lỗi hiện ở thẻ công cụ bên trong (C20) hoặc ở khối lỗi C5 khi cả phiên không kết nối được; bong bóng chat tự nó không đổi màu khi có lỗi bên trong |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền bong bóng người dùng | `--color-surface-raised` |
| Chữ phụ (nhãn, suy nghĩ) | `--color-text-muted` |
| Màu nhãn Claude | `--color-accent-claude` |
| Màu con trỏ | `--color-text` |
| Viền trái suy nghĩ | `--color-divider` |
| Cỡ chữ | `--text-xs` (nhãn) `--text-sm` (suy nghĩ) `--text-base` (nội dung chính) |
| Bo góc bong bóng | `--radius` |
| Đệm bong bóng | `--space-md` `--space-lg` |
| Khoảng cách dọc | `--space-sm` `--space-lg` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| đầy đủ | Mặc định — hiện suy nghĩ + mọi thẻ công cụ từng bước |
| gọn (C37) | Ẩn suy nghĩ + thẻ công cụ từng bước, gộp thành dòng "n bước · sửa x file · chạy y lệnh"; chỉ còn tin người dùng/Claude cuối cùng/kết quả/yêu cầu quyền/tóm tắt lượt |

## Tiếp cận (a11y)

Khối suy nghĩ dùng `<details>/<summary>` chuẩn (Enter/Space mở được bằng bàn phím, không cần JS riêng). Con trỏ nhấp nháy nên tôn trọng `prefers-reduced-motion` ở pha I (prototype hiện chưa áp dụng — xem phát hiện). Cặp tương phản chữ phụ trên nền trang: `--color-text-muted`/`--color-bg`.

## Không được làm

- Không lặp lại nhãn "Claude" trên mỗi đoạn trong cùng một lượt trả lời — chỉ một nhãn đầu khối.
- Không tự ý xoá lịch sử tin nhắn khi đổi chế độ gọn C37 — chỉ ẩn/gộp hiển thị, dữ liệu giữ nguyên.
- Không trộn tin xếp hàng (C34) vào giữa dòng chảy chính — luôn nằm cuối cùng, sau dòng "Claude đang làm".
