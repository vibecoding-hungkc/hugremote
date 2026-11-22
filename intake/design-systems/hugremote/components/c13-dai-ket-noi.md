# C13 — Dải kết nối

| Field | Value |
|---|---|
| Mã | C13 |
| Nhóm | phản hồi |
| Mục đích | Báo mất kết nối với server HugRemote, cho biết hệ thống đang tự thử lại, và khoá mọi thao tác ghi để không mất dữ liệu hay báo "xong" giả trong lúc mất kết nối |
| Màn hình dùng | S2, S6, S8, S9, S10 |
| Persona chạm tới | P-MOBILE, P-DESK, P-HOST, P-TEAM |
| Hiện thực prototype | class `.conn` (nền `--color-surface-raised`, viền dưới `--color-warning`) — dựng bằng hàm `connBar()` (dòng 692), chỉ render khi `offline()` true (`ui.state==='offline'`); phối hợp khoá ghi qua hàm `OFF()` (dòng 653) gắn `disabled title="Đang mất kết nối — làm được khi nối lại"` vào mọi nút ghi (Gửi, ✓/✗ duyệt, Lưu, Commit, Push/Pull, Cập nhật) |
| Hiện thực pha I | `apps/web/src/components/ui/ConnectionBar.tsx` — `retrying: boolean; attempt: number; onRetryNow: () => void` (hiện/ẩn do component cha quyết theo trạng thái kết nối socket, không tự poll) |

## Giải phẫu

Một hàng toàn chiều rộng, đặt ngay dưới thanh trên/thanh phiên và trên vùng nội dung: **chấm cảnh báo** → **câu trạng thái** (grow, nêu rõ đang thử lại lần thứ mấy + Claude/terminal vẫn chạy trên máy + việc gì đang bị khoá + nháp vẫn được giữ) → **nút "Thử ngay"** (C1, icon refresh).

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| đang thử lại | ✓ | Dải hiện, chấm `--color-warning`, câu "Mất kết nối với HugRemote — đang thử lại (lần n)."; đồng thời **mọi nút ghi toàn app** chuyển trạng thái *bị vô hiệu* của C1 kèm `title="Đang mất kết nối — làm được khi nối lại"`; nháp ô soạn, bản sửa file chưa lưu, message commit **giữ nguyên**, không bị xoá |
| đã nối lại | ✓ | Dải biến mất (`offline()` false); khoá gỡ trên mọi nút ghi; **không tự gửi** bất cứ thứ gì đang chờ (người dùng chủ động bấm lại) |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền dải | `--color-surface-raised` |
| Viền dưới dải | `--color-warning` |
| Chấm cảnh báo | `--color-warning` (dùng chấm chung `.dot.warn`) |
| Chữ | `--color-text` (mặc định, không override riêng) |
| Đệm | `--space-sm` (dọc), `--space-lg` (ngang) |
| Khoảng cách chấm/chữ/nút | `--space-sm` |
| Cỡ chữ | `--text-sm` |

## Biến thể

Không có biến thể hình thức — chỉ một hình dạng. Phạm vi hiệu lực mới là biến số: dải xuất hiện ở mọi màn có thao tác ghi (S2, S6, S8, S9, S10); màn chỉ đọc (S3 xem máy, S5 chọn thư mục…) không bắt buộc hiện dải này vì không có thao tác ghi nào bị khoá ở đó.

## Tiếp cận (a11y)

`role="status"` để trình đọc màn hình công bố không chặn luồng (khác `role="alert"` của C5 — mất kết nối không phải lỗi một thao tác, mà là tình trạng nền liên tục). Nút "Thử ngay" theo chuẩn C1 đầy đủ (`--tap`, nhãn chữ + icon). Mọi nút ghi bị khoá trong lúc này phải có `title`/`aria-label` giải thích **vì sao** bị khoá (không chỉ `disabled` trơ) — đây là điểm khác biệt quan trọng với trạng thái "bị vô hiệu" thông thường của C1 (lý do cố định, không phải tuỳ ngữ cảnh).

## Không được làm

- Không dùng C5 (khối báo lỗi) cho mất kết nối server toàn cục — luôn dùng C13, vì ảnh hưởng toàn app chứ không riêng một khối nội dung.
- Không xoá nháp ô soạn, bản sửa file chưa lưu, hay nội dung ô message commit khi mất kết nối — phải giữ nguyên tới khi nối lại.
- Không tự động gửi lại các thao tác bị chặn khi kết nối phục hồi — luôn chờ người dùng chủ động bấm lại (tránh gửi trùng ngoài ý muốn).
- Không hiện quá một dải C13 cùng lúc (không lồng dải trong dải khi chia ô — dải chỉ cần xuất hiện một lần ở gốc màn).
