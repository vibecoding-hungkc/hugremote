# C21 — Thẻ duyệt quyền / câu hỏi của Claude

| Field | Value |
|---|---|
| Mã | C21 |
| Nhóm | action |
| Mục đích | Để developer quyết định một chạm cho việc Claude xin phép làm (ghi file, chạy lệnh nhạy cảm), không rời màn chat |
| Màn hình dùng | S10 |
| Hiện thực prototype | class `.ask` (viền trong `--color-warning` qua box-shadow inset) gồm `.h` (icon khiên + câu hỏi, màu `--color-warning`) → dòng mono đường dẫn + chú thích phụ → ba nút: Cho phép (`.btn.primary`), Từ chối (`.btn`), "Cho phép mọi lần ghi file trong phiên này" (`.btn`); khi đã quyết, thay bằng dòng `.note` một câu. Bản rút gọn ở ô soạn (`.askbar`, chỉ mobile) lặp lại quyết định với hai nút Cho phép/Từ chối. Hàm `decide(h,p,sid,aid,decision)` |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/PermissionAsk.tsx` — props: `what: string; path: string; extra?: string; decision: 'allowed'\|'denied'\|'always'\|null; decidedAt?: string; disabled?: boolean; onDecide: (d: 'allowed'\|'denied'\|'always') => void` |

## Giải phẫu

Hàng tiêu đề [icon khiên] [câu Claude xin phép làm gì] (bắt buộc) → dòng thông tin [đường dẫn/lệnh mono] [chú thích phụ trong ngoặc, ví dụ "+38 dòng"] (bắt buộc) → hàng nút [Cho phép] [Từ chối] [Cho phép mọi lần — tuỳ chọn, chỉ khi xin ghi file] (bắt buộc tối thiểu hai nút đầu).

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| chờ (viền `--color-warning`) | ✓ | Thẻ `.ask` đầy đủ như Giải phẫu; mất kết nối (C13) khoá cả ba nút kèm tooltip "Đang mất kết nối" |
| đã cho phép | ✓ | Thay bằng `.note` một dòng: icon ✓ + "Bạn đã cho phép ghi <file> · <giờ>" (hoặc "cho phép mọi lần ghi file trong phiên" nếu quyết định là "mọi lần") |
| đã từ chối | ✓ | `.note`: icon ✗ + "Bạn đã từ chối ghi <file> · <giờ>" |
| đã trả lời trên thiết bị khác | ✓ | Dùng **chung khuôn** với "đã cho phép"/"đã từ chối" — quyết định lưu theo phiên, không theo thiết bị, nên khi thiết bị khác đã bấm, màn này chỉ cần tải lại để thấy đúng `.note`; prototype không thêm chữ "từ thiết bị khác" vào nội dung dòng (xem phát hiện nếu Authority muốn thêm chi tiết đó) |

## Token dùng

| Vị trí | Token |
|---|---|
| Viền | `--color-warning` |
| Nền | `--color-surface` |
| Màu tiêu đề | `--color-warning` |
| Font dòng thông tin | `--font-mono` |
| Cỡ chữ | `--text-sm` |
| Đệm | `--space-lg` |
| Khoảng cách dọc | `--space-md` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| đầy đủ | Mặc định, trong luồng chat, ba nút |
| rút gọn (`.askbar`) | Chỉ mobile, nổi ngay trên ô soạn, hai nút (không có nút "mọi lần") |

## Tiếp cận (a11y)

Thẻ có `role="group" aria-label="Claude xin quyền"`, `id` gắn theo phiên để điều hướng nhanh. Ba nút theo mẫu C1 (title nêu phím tắt `⌥Y`/`⌥N`). Cặp tương phản tiêu đề: không có hàng riêng trong `DESIGN-SYSTEM.md §3` cho "chữ cảnh báo trên nền thẻ" — gần nhất là nhóm "chấm cần duyệt trên thẻ" (`--color-warning`/`--color-surface`, nhóm thành phần); vì đây là chữ chứ không phải chấm nhỏ, cần tự kiểm AA ở pha I (xem phát hiện).

## Không được làm

- Không tự động chọn giúp người dùng khi hết thời gian — không có mặc định "Cho phép".
- Không cho phép bấm quyết định khi mất kết nối — khoá cả ba nút, không chỉ nút chính.
- Không xoá thẻ khỏi lịch sử sau khi quyết định — luôn giữ lại dưới dạng `.note` để xem lại ai đã quyết định gì.
