# C2 — Trường nhập

| Field | Value |
|---|---|
| Mã | C2 |
| Nhóm | input |
| Mục đích | Thu thập một giá trị từ người dùng — chữ, mật khẩu, mã 6 số (2FA), lựa chọn theo đoạn (segmented), hoặc chọn một giá trị từ danh sách |
| Màn hình dùng | S1, S3, S7, S9 |
| Persona chạm tới | P-MOBILE, P-DESK, P-HOST, P-TEAM |
| Hiện thực prototype | class `.field` (khung label+input+hint/msg) · `.input` (chữ/mật khẩu/select, `.err` khi sai) · `.otp` (lưới 6 ô mã) · `.seg` (chuyển đoạn, `button.on`) · `.chk` (checkbox xác nhận) · `.grid2` (hai field cùng hàng); không có hàm JS dựng riêng — mỗi màn viết trực tiếp field của mình (`fld()` cục bộ trong `S3sheet()`, input `#pw`/`#np`/`#np2` ở `S1()`, ô commit trong `commitbox`) |
| Hiện thực pha I | `apps/web/src/components/ui/Field.tsx` — `kind: 'text' \| 'password' \| 'otp' \| 'select' \| 'textarea'; label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; disabled?: boolean; options?: {value: string; label: string}[]` (dùng khi `kind==='select'`) |

## Giải phẫu

Thứ tự đọc: **nhãn** (`label`, phía trên) → **ô nhập** (input/select/otp/seg) → **câu phụ** — hoặc `hint` (muted, trung tính) hoặc `msg` (đỏ, chỉ hiện khi sai, thay chỗ hint chứ không chồng lên). Biến thể `otp` thay ô nhập đơn bằng lưới 6 ô một-ký-tự canh giữa, font `--font-mono`. Biến thể `seg` thay nhãn+ô nhập bằng hai (hoặc nhiều) nút loại trừ nhau trên cùng một hàng nền.

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| rỗng | ✓ | Viền `--color-border`, nền `--color-surface-raised`, không placeholder giả — `placeholder` là ví dụ định dạng (vd "ví dụ: 10.0.0.20"), không phải giá trị mặc định |
| đang gõ | ✓ | Không có kiểu riêng ngoài `:focus-visible` toàn cục (vòng `--color-primary`); ô soạn Claude (`.cbox:focus-within`) là ca riêng đổi màu viền sang `--color-primary` khi một con trong khung đang focus |
| sai | ✓ | `.input.err` viền `--color-danger`; `.field .msg` hiện câu lỗi màu `--color-danger`, cỡ `--text-xs`, thay cho `.hint` |
| bị vô hiệu | ✓ | `disabled` trên input (vd ô mật khẩu khi bị khoá đăng nhập ở S1) — trình duyệt tự xám, không có class riêng |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền ô nhập | `--color-surface-raised` |
| Viền mặc định | `--color-border` |
| Viền sai | `--color-danger` |
| Chữ nhập | `--color-text` |
| Chữ nhãn | `--color-text-muted` |
| Chữ hint | `--color-text-muted` |
| Chữ lỗi | `--color-danger` |
| Bo góc | `--radius` |
| Chiều cao tối thiểu | `--tap` |
| Đệm ngang | `--space-md` |
| Khoảng cách field (nhãn/ô/hint) | `--space-xs` |
| Khoảng cách giữa các field | `--space-lg` |
| Cỡ chữ ô nhập | `--text-base` (16px — cố ý, để iOS không tự phóng to) |
| Cỡ chữ nhãn | `--text-sm` |
| Cỡ chữ hint/lỗi | `--text-xs` |
| Cỡ chữ ô mã OTP | `--text-xl` |
| Nền `.seg` (rãnh) | `--color-surface-raised` |
| Nền nút `.seg` đang chọn | `--color-bg` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| password | `type="password"`, `autocomplete` đúng ngữ cảnh (`current-password`/`new-password`) — không thêm nút hiện/ẩn mật khẩu (không có trong prototype) |
| otp (mã 6 số) | 6 ô `maxlength="1"`, `inputmode="numeric"`, canh giữa, font mono, cỡ `--text-xl`; ô đầu `autocomplete="one-time-code"` |
| select (ô chọn) | Dùng `<select>` gốc trình duyệt bọc class `.input` — không dựng dropdown tuỳ biến (khoá SSH, jump host, nhánh git) |
| seg (chuyển đoạn) | Thay nhãn/ô nhập bằng các nút loại trừ nhau trên nền `--color-surface-raised`; nút đang chọn nổi trên nền `--color-bg` — dùng cho "Khoá SSH / Mật khẩu", "Mã 6 số / Mã khôi phục" |
| grid2 (hai cột) | Hai field cùng hàng (vd Người dùng + Cổng); dưới 768px rớt về một cột |
| checkbox xác nhận | `.chk` — ô vuông 18×18 + câu dài bên phải, dùng cho xác nhận bắt buộc trước khi mở nút nguy hiểm (vd "Tôi đã kiểm vân tay mới") |

## Tiếp cận (a11y)

Mọi `input`/`select` có `<label for>` tương ứng (không dựa vào `placeholder` làm nhãn). Vùng chạm `--tap` cho input/select; ô OTP tuy nhỏ hơn về bề rộng nhưng vẫn cao `--tap`. `inputmode="numeric"` cho mọi ô chỉ nhận số (OTP, cổng SSH) để bật bàn phím số trên mobile. Cặp tương phản viền ô nhập phải đạt: `--color-border`/`--color-bg` ("Tối — viền ô nhập trên nền trang") và `--color-border`/`--color-surface` ("Tối — viền ô nhập trên thẻ"). Thông báo lỗi gắn liền ngay dưới ô nhập (không chỉ đổi màu viền) để trình đọc màn hình và người khó phân biệt màu đều nhận ra. Checkbox xác nhận phải thật sự khoá nút kế tiếp (`disabled` gỡ bằng JS khi tick) — không chỉ đổi màu.

## Không được làm

- Không xoá giá trị người dùng đã gõ khi API báo lỗi — giữ nguyên nội dung ô nhập, chỉ thêm `.err` + `msg` (đúng "ô nhập giữ nguyên giá trị" ở khuôn lỗi `DESIGN-SYSTEM.md §5`).
- Không dùng cỡ chữ nhỏ hơn `--text-base` cho ô nhập trên mobile — nhỏ hơn 16px khiến iOS Safari tự phóng to khi focus, phá layout.
- Không dựng dropdown tuỳ biến thay cho `<select>` gốc — mất bàn phím điều hướng và không gian `Select` chuẩn.
- Không gộp `hint` và `msg` hiển thị cùng lúc; `msg` luôn thay thế `hint` khi có lỗi.
