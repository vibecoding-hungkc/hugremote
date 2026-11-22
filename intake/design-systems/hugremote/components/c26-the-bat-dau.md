# C26 — Thẻ "Bắt đầu"

| Field | Value |
|---|---|
| Mã | C26 |
| Nhóm | điều hướng |
| Mục đích | Dẫn người dùng mới (chủ instance) qua đúng ba việc đầu tiên cần làm, một bước một lúc |
| Màn hình dùng | S2 |
| Persona chạm tới | P-MOBILE, P-DESK, P-HOST (chỉ vai `owner` — xem "Không được làm") |
| Hiện thực prototype | class `.card.start` (viền trong `--color-primary`) chứa `.steps`/`.step` (mỗi bước `.n` — vòng tròn số thứ tự hoặc dấu ✓ khi `.done`, `.lbl` — nhãn, gạch ngang khi `.done`, đậm khi `.cur`) và `.btns` (một nút chính theo bước hiện tại; bước 1 thêm nút phụ "Bỏ qua, dùng máy này"). Hàm `startCard()`: tính ba điều kiện thật từ dữ liệu (có máy khác local, có dự án khác Home, có ít nhất một phiên), tìm bước đầu tiên chưa xong, trả chuỗi rỗng khi cả ba đã xong hoặc vai không phải `owner` |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/StartCard.tsx` — props: `steps: { label: string; done: boolean }[]; currentIndex: number; onPrimaryAction: () => void; onSkip?: () => void` |

## Giải phẫu

Tiêu đề "Bắt đầu với HugRemote" (bắt buộc) → danh sách 3 bước cố định, mỗi bước [số thứ tự hoặc dấu ✓] [nhãn việc cần làm] (bắt buộc cả 3, thứ tự cố định: thêm máy → tạo dự án → mở phiên) → hàng nút: nút chính theo bước hiện tại (bắt buộc, đúng một) → nút phụ "Bỏ qua, dùng máy này" (chỉ ở bước 1, tuỳ chọn).

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| bước chưa làm | ✓ | `.n` hiện số thứ tự (1/2/3) trong vòng tròn viền `--color-border`; `.lbl` chữ thường `--color-text` |
| bước hiện tại (đậm, một nút chính) | ✓ | `.lbl` đậm; đúng một nút chính bên dưới ứng với bước này (nhãn đổi theo bước: "Thêm máy"/"Tạo dự án"/"Tạo phiên") |
| bước đã xong (dấu ✓, tính theo dữ liệu thật) | ✓ | Vòng tròn nền `--color-success`, icon ✓ thay số, không viền; nhãn gạch ngang + `--color-text-muted`; tính thật từ dữ liệu (có máy ngoài local, có dự án ngoài Home, có ít nhất một phiên) — không phải cờ giả lập |
| ẩn khi xong cả 3 | ✓ | `startCard()` trả chuỗi rỗng khi không còn bước nào chưa làm — thẻ biến mất hoàn toàn khỏi S2, không còn dấu vết |

## Token dùng

| Vị trí | Token |
|---|---|
| Viền thẻ | `--color-primary` |
| Nền vòng tròn bước xong | `--color-success` |
| Viền vòng tròn mặc định | `--color-border` |
| Chữ phụ đã xong | `--color-text-muted` |
| Cỡ chữ số thứ tự | `--text-xs` |
| Bo tròn | `--radius-pill` (vòng số) `--radius` (thẻ) |
| Đệm thẻ | `--space-lg` |
| Khoảng cách bước | `--space-sm` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| — | Ba bước cố định theo đúng thứ tự, không thêm/bớt/đổi thứ tự theo dự án |

## Tiếp cận (a11y)

Thẻ có `aria-label="Bắt đầu"`. Mỗi bước nên có `aria-current="step"` ở pha I cho bước đang làm (prototype thuần CSS, chưa gắn — xem phát hiện ở báo cáo cuối). Dấu ✓ không phải kênh duy nhất báo "đã xong" — nhãn còn gạch ngang (kênh thứ hai không phụ thuộc màu).

## Không được làm

- Không hiện thẻ cho vai `member` (`P-TEAM`) — member không có quyền thêm máy/tạo dự án nên thẻ vô nghĩa với họ; ẩn tuyệt đối kể cả khi cả ba việc đều hiện với owner.
- Không cho phép bỏ qua bước 2 hoặc 3 bằng nút phụ — chỉ bước 1 "Thêm máy" có lối tắt "dùng máy này" vì máy local luôn có sẵn; hai bước sau bắt buộc phải làm để thẻ biến mất.
