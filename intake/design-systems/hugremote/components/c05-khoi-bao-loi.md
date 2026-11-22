# C5 — Khối báo lỗi

| Field | Value |
|---|---|
| Mã | C5 |
| Nhóm | phản hồi |
| Mục đích | Báo rõ nguyên nhân một thao tác/tải dữ liệu thất bại và cho biết làm gì tiếp, luôn kèm lối khắc phục ngay trong khối |
| Màn hình dùng | S1, S2, S3, S5, S6, S8, S9, S10 |
| Persona chạm tới | P-MOBILE, P-DESK, P-HOST, P-TEAM |
| Hiện thực prototype | class `.error` (viền `--color-danger`, nền `--color-surface`) + hàm `errorBox(h, p, btns)` (dòng 690): `h` là tiêu đề đỏ đậm, `p` là câu nói làm gì tiếp (muted), `btns` tuỳ chọn (mặc định một nút "Thử lại" với icon refresh, `btns=''` thì ẩn hẳn hàng nút) |
| Hiện thực pha I | `apps/web/src/components/ui/ErrorBlock.tsx` — `title: string; description: string; retry?: { label?: string; onClick: () => void }; showActions?: boolean` (`showActions=false` ẩn hoàn toàn hàng nút, khác `retry` undefined) |

## Giải phẫu

Thứ tự đọc: **dòng đầu** — nguyên nhân, in đậm màu `--color-danger` (`.h`) → **dòng hai** — nói làm gì tiếp, bằng ngôn ngữ đang chọn, lấy từ `errors.<CODE>` (`.p` muted) → **hàng nút khắc phục** (tuỳ chọn, mặc định nút "Thử lại" icon `refresh`). Có `role="alert"` trên khối để trình đọc màn hình công bố ngay khi khối xuất hiện.

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| nguyên nhân + làm gì tiếp | ✓ | Dòng 1 nói chuyện gì xảy ra (chuỗi `errors.<CODE>` theo ngôn ngữ đang chọn), dòng 2 nói làm gì tiếp — không lộ mã kỹ thuật thô |
| Thử lại | ✓ | Nút "Thử lại" (icon refresh) gọi lại đúng hành động vừa lỗi; ngữ cảnh có cách khắc phục rõ hơn thì thay bằng hành động đó — vd S3 sheet lỗi kết nối dùng lại `testHost()`, S4/S5 quay về phạm vi hợp lệ |
| giữ dữ liệu đang nhập | ✓ | Ô nhập, nháp, bản sửa giữ nguyên giá trị sau lỗi; không reset form |
| không có nút (`btns=''`) | — | Chỉ hiện khi khối đã nằm trong một luồng có nút xử lý riêng ngay bên ngoài (hộp thoại `delhost` không đủ điều kiện xoá) |

## Token dùng

| Vị trí | Token |
|---|---|
| Viền khối | `--color-danger` |
| Nền khối | `--color-surface` |
| Chữ tiêu đề | `--color-danger` |
| Chữ mô tả | `--color-text-muted` |
| Bo góc | `--radius` |
| Đệm trong | `--space-lg` |
| Khoảng cách dòng/nút | `--space-sm` |
| Cỡ chữ mô tả | `--text-sm` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| trong sheet/dialog (không viền ngoài) | Khi khối lỗi nằm trong `.sheet-body`/`.dialog` đã có khung riêng, vẫn giữ nguyên `.error` nhưng không lồng thêm viền kép |
| lỗi mạng toàn cục | **Không dùng C5** — dùng C13 (dải kết nối) thay thế, vì lỗi mất kết nối ảnh hưởng toàn app chứ không riêng một khối (`DESIGN-SYSTEM.md §5`) |

## Tiếp cận (a11y)

`role="alert"` để trình đọc màn hình công bố ngay (không cần người dùng điều hướng tới). Cặp tương phản bắt buộc đạt: `--color-danger`/`--color-bg` ("Tối — chữ lỗi trên nền trang"). Nút "Thử lại" theo đúng chuẩn C1 (vùng chạm `--tap`, có icon + nhãn chữ, không chỉ-icon). Mỗi màn chỉ hiện **một** khuôn lỗi tại một thời điểm — không chồng hai khối C5.

## Không được làm

- Không hiện quá một khối lỗi mỗi màn tại một thời điểm.
- Không dùng C5 cho lỗi kết nối server toàn cục — dùng C13.
- Không xoá nội dung người dùng đang nhập dở khi hiện khối lỗi của chính thao tác đó (ô nhập/nháp phải còn nguyên — phối hợp với C2/ô soạn).
- Không viết câu lỗi chung chung kiểu "Đã có lỗi xảy ra" — luôn nêu nguyên nhân cụ thể (sai khoá / từ chối / không tới được host / hết hạn mức…) lấy từ `errors.<CODE>`.
