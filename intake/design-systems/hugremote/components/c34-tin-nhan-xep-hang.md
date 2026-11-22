# C34 — Tin nhắn xếp hàng

| Field | Value |
|---|---|
| Mã | C34 |
| Nhóm | phản hồi |
| Mục đích | Cho người dùng gửi tiếp việc cho Claude ngay cả khi lượt hiện tại chưa xong, và biết rõ tin đó đang chờ chứ chưa được xử lý |
| Màn hình dùng | S10 |
| Persona chạm tới | P-MOBILE, P-DESK, P-TEAM (chỉ phiên của mình) |
| Hiện thực prototype | class `.msg.queued` (biến thể của `.msg.user`); render trong `chatBody()` ở biến `queued` (map `c.queue`); gửi/huỷ qua `sendPrompt()` (nhánh `status==='running'`) và nút Huỷ gọi `queue.splice(i,1)` |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/QueuedMessage.tsx` — props chính: `text: string, onCancel: () => void` (danh sách lặp từ `session.queue: {id, text}[]`, tối đa 10 phần tử theo `CAP-AI-01`/D1) |

## Giải phẫu

Xếp ngay dưới tin nhắn/thẻ cuối cùng của luồng chat, trước dòng "Claude đang làm…", theo thứ tự đọc:
1. Nội dung tin nhắn (giống bong bóng `.msg.user` nhưng mờ đi)
2. Dòng phụ nhỏ: "Xếp hàng — gửi khi Claude xong lượt này" + nút **Huỷ**

Mỗi tin trong hàng chờ là một khối riêng, xếp theo đúng thứ tự đã gửi (FIFO).

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| đang chờ | ✓ | Opacity giảm (`.7`), viền mảnh `--color-divider` thay vì nền đặc; nút Huỷ luôn bấm được, kể cả khi mất kết nối không (giữ nháp, không phải thao tác ghi mới — xem ARCHITECTURE/DECISIONS AC-43 chỉ khoá gửi mới, không khoá huỷ tin đã xếp hàng cục bộ... **lưu ý**: hành vi mất kết nối cho riêng nút Huỷ chưa có dòng DECISIONS tường minh — pha I tự quyết theo nguyên tắc "giữ nháp" rồi ghi 1 dòng DECISIONS) |
| đã gửi | ✓ | Khi lượt hiện tại kết thúc, server tự lấy tin đầu hàng chờ gửi đi: khối `queued` biến mất khỏi danh sách chờ và xuất hiện lại dưới dạng tin `.msg.user` bình thường (không mờ) ngay phía trên lượt trả lời mới |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền | trong suốt (kế thừa `--color-bg` của `.chat`) |
| Viền | `--color-divider` |
| Chữ tin nhắn | `--text-base`, `--color-text` (độ mờ chung khối qua CSS `opacity`, không phải token màu riêng) |
| Chữ dòng phụ + nút Huỷ | `--text-xs`, `--color-text-muted` |
| Bo góc | `--radius` |
| Đệm | `--space-md` `--space-lg` (kế thừa `.msg.user`) |

## Biến thể

Không có — một kiểu hiển thị cho mọi tin đang chờ, bất kể độ dài nội dung.

| Biến thể | Khác gì bản mặc định |
|---|---|
| — | — |

## Tiếp cận (a11y)

- Nút Huỷ có nhãn chữ rõ ràng (không chỉ icon) vì đây là hành động hiếm, không thuộc nhóm thao tác developer quen tay.
- Khối nên có `aria-live="polite"` ở vùng chứa hàng chờ để trình đọc màn hình báo khi một tin được gửi đi (chuyển từ "đang chờ" sang tin thường) mà không ngắt lời đang đọc dở.
- Vùng chạm nút Huỷ ≥ `--tap` trên mobile dù hiển thị dạng chữ nhỏ (`.linkp.xs`) — pha I cần đệm thêm, prototype hiện chưa đảm bảo đủ 44px (xem phát hiện ở báo cáo cuối).

## Không được làm

- Không cho sửa nội dung tin đang xếp hàng tại chỗ — muốn đổi thì Huỷ rồi gõ lại, tránh đồng bộ hai nơi chỉnh sửa (trình duyệt này và state server).
- Không giới hạn hiển thị chỉ 1 tin chờ — hàng chờ tối đa 10 tin (CAP-AI-01), mọi tin trong hàng đều phải hiện đủ, không cắt bớt hay gộp "+n tin khác".
- Không xoá hàng chờ khi đóng tab trình duyệt — hàng chờ sống ở server, mở lại (kể cả thiết bị khác) phải thấy đúng cùng danh sách.
