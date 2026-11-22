# C1 — Nút

| Field | Value |
|---|---|
| Mã | C1 |
| Nhóm | action |
| Mục đích | Kích hoạt một hành động — gửi form, xác nhận, hoặc thao tác developer quen tay (lưu file ⌘S, fetch/pull/push kèm số commit, stage/unstage, bỏ thay đổi, sao chép, tải lên/xuống, gửi, dừng, đóng, sửa, chia ô) qua nút chỉ-icon có nhãn ẩn + tooltip |
| Màn hình dùng | S1, S3, S4, S5, S6, S7, S8, S9, S10 |
| Persona chạm tới | P-MOBILE, P-DESK, P-HOST, P-TEAM |
| Hiện thực prototype | class `.btn` (biến thể `.primary` `.danger` `.ghost`; cỡ `.sm`; dạng `.icon`; full-width `.block`; đổi màu chữ không đổi nền `.on-primary` `.on-danger`; số phụ `.num`) + hàm `ib(icon, label, act, cls, extra)` dựng nút chỉ-icon luôn kèm `title` + `aria-label`; icon lấy qua `ic(name, cls)`; trạng thái đang gửi mô phỏng bằng `sending(btn, label, done)` (khoá `disabled`, đổi `textContent`) |
| Hiện thực pha I | `apps/web/src/components/ui/Button.tsx` — `variant: 'primary' \| 'secondary' \| 'danger' \| 'ghost'; size?: 'sm' \| 'md'; icon?: IconName; iconOnly?: boolean; loading?: boolean; disabled?: boolean; disabledReason?: string; block?: boolean; label: string` (label bắt buộc kể cả khi `iconOnly` — dùng dựng `aria-label` + `title`) |

## Giải phẫu

Thứ tự đọc trái → phải: **icon** (tuỳ chọn, 18×18, `svg.i`) → **nhãn chữ** (bắt buộc, trừ biến thể chỉ-icon — khi đó nhãn không hiện nhưng vẫn tồn tại dưới dạng `aria-label`/`title`) → **số phụ** (tuỳ chọn, ví dụ số commit cạnh nút Push) → **chỉ báo đang tải** (tuỳ chọn, thay nhãn bằng "Đang …", không phải spinner riêng).

Ràng buộc bố cục không token: nút `.sm` cao cố định 32px trên desktop (ép lại `--tap` dưới 768px); nút chỉ-icon hình vuông (rộng = cao).

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| mặc định | ✓ | `.btn` không biến thể: nền `--color-surface-raised`, viền `--color-border`, chữ `--color-text`. Biến thể màu: `.primary` nền+viền `--color-primary` chữ `--color-on-primary`; `.danger` nền+viền `--color-danger` chữ `--color-bg`; `.ghost` nền/viền trong suốt, hiện `--color-surface-raised` khi hover |
| focus | ✓ | `:focus-visible` toàn cục: vòng ngoài 2px `--color-primary`, offset 2px — áp dụng mọi nút, không riêng biến thể |
| đang gửi | ✓ | Khoá `disabled`, đổi nhãn thành "Đang …" (hàm `sending()`), không nhận bấm lần hai cho tới khi việc xong — bắt buộc cho mọi nút submit mạng (ca biên "gửi form hai lần" ở `ARCHITECTURE.md §6`) |
| bị vô hiệu | ✓ | `[disabled] { opacity:.5; cursor:not-allowed }`; khi nguyên nhân là mất kết nối, `OFF()` gắn thêm `title="Đang mất kết nối — làm được khi nối lại"` (phối hợp với C13) |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền mặc định | `--color-surface-raised` |
| Viền mặc định | `--color-border` |
| Chữ mặc định | `--color-text` |
| Nền/viền primary | `--color-primary` |
| Chữ trên primary | `--color-on-primary` |
| Nền/viền danger | `--color-danger` |
| Chữ trên danger | `--color-bg` |
| Bo góc | `--radius` |
| Đệm ngang (thường) | `--space-lg` |
| Đệm ngang (`.sm`) | `--space-md` |
| Khoảng icon–nhãn | `--space-sm` |
| Chiều cao tối thiểu (thường) | `--tap` |
| Cỡ chữ | `--text-sm` |
| Cỡ số phụ `.num` | `--text-xs` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| primary | Một hành động chính mỗi màn/hộp thoại; nền+viền `--color-primary`, chữ `--color-on-primary` |
| danger | Hành động phá huỷ (xoá, bỏ thay đổi, tắt 2FA, thu hồi…); nền+viền `--color-danger`, chữ `--color-bg` |
| ghost | Hành động phụ, ít nổi bật; nền/viền trong suốt, chỉ hiện nền khi hover/focus |
| sm | Chiều cao cố định 32px *(giá trị thô, không token — xem ghi chú lỗ hổng)*; dùng trong sheet/card dày đặc; dưới 768px bị ép lại `--tap` |
| icon (chỉ-icon) | Bỏ nhãn chữ hiển thị, hình vuông, giữ `aria-label` + `title`; `.sm.icon` rộng 32px, mobile rộng `--tap` |
| block | `width:100%`, dùng cho nút chính cuối form một cột (S1, S5) |
| on-primary / on-danger | Chỉ đổi màu chữ (không đổi nền) — dùng trong `.dialog` để nút nổi trên nền trung tính |

## Tiếp cận (a11y)

Vùng chạm tối thiểu `--tap` (44px) trên mọi nút, kể cả `.sm` một khi màn hình dưới 768px. Nút chỉ-icon **luôn** có `aria-label` và `title` trùng nội dung tooltip — không bao giờ để icon trơ không tên. Focus-visible vòng 2px `--color-primary`, offset 2px. Cặp tương phản bắt buộc đạt: chữ trên nút chính `--color-on-primary`/`--color-primary` ("Tối — chữ trên nút chính" ở §3); chữ trên nút nguy hiểm `--color-bg`/`--color-danger` ("Tối — chữ trên nút nguy hiểm"). Phần tử là `<button>` chuẩn nên Enter/Space kích hoạt và thứ tự tab theo DOM tự nhiên, không cần `tabindex` thủ công.

## Không được làm

- Không tự chế thêm biến thể màu ngoài primary/danger/ghost/mặc định.
- Không bỏ trạng thái "đang gửi" cho bất kỳ nút nào gọi API ghi dữ liệu — thiếu nó là bấm hai lần gây trùng dữ liệu.
- Không dùng nút chỉ-icon cho hành động developer **không** nhận ra ngay bằng icon đơn thuần — danh sách đóng ở `DESIGN-SYSTEM.md §1`: fetch/pull/push/stage/unstage/bỏ thay đổi/sao chép/tải lên/tải xuống/gửi/dừng/đóng/sửa/chia ô. Hành động khác phải có nhãn chữ.
- Không bỏ `aria-label`/`title` trên nút chỉ-icon dù đã có tooltip trình duyệt mặc định.
