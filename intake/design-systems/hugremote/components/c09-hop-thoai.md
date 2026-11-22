# C9 — Hộp thoại

| Field | Value |
|---|---|
| Mã | C9 |
| Nhóm | phản hồi |
| Mục đích | Chặn luồng để xác nhận một hành động (thường là phá huỷ/không đảo ngược được), cảnh báo rủi ro (host key đổi, Bypass), hoặc thu một giá trị ngắn (đổi tên hiển thị) |
| Màn hình dùng | S2, S3, S4, S6, S7, S8, S10 |
| Persona chạm tới | P-MOBILE, P-DESK, P-HOST, P-TEAM |
| Hiện thực prototype | class `.scrim` > `.dialog` (`.warn` cho biến thể cảnh báo đỏ) — dựng qua hàm cục bộ `dlg(warn, title, msg, ok, okCls, act, cancel, extraOk)` bên trong `dialogs()` (dòng 1417) cho các loại `rmproj/close/unsaved/discard/delhost/logout/bypass/revoke/update`; loại `hostkey` tái dùng màn `S4()`; loại `rename` và `keys`/`otp`/`codes` viết tay riêng trong cùng hàm. Đổi tên: input `#rn` tự focus + chọn hết chữ khi mở (`renderOverlay`), `onkeydown` kiểm `!event.isComposing` trước khi Enter-lưu |
| Hiện thực pha I | `apps/web/src/components/ui/Dialog.tsx` — `open: boolean; title: string; description: ReactNode; danger?: boolean; confirmLabel?: string; confirmVariant?: 'primary' \| 'danger'; onConfirm?: () => void; cancelLabel?: string; extraAction?: ReactNode; processing?: boolean; children?: ReactNode` (dùng `children` cho biến thể đổi tên/nhập liệu) |

## Giải phẫu

Thứ tự đọc: **tiêu đề** (`<h2>`, `--text-xl`) → **mô tả** (`<p>`, muted, có thể chứa `<b>` nhấn mạnh hậu quả) → **nội dung phụ tuỳ biến** (tuỳ loại: bảng khoá-giá trị `dl.kv` cho vân tay host key, lưới mã khôi phục, ô nhập đổi tên, checkbox xác nhận) → **hàng nút** căn phải: Huỷ (ghost) → hành động phụ tuỳ chọn (`extraOk`) → hành động chính (primary hoặc danger tuỳ ngữ cảnh).

Ràng buộc bố cục không token: rộng cố định 480px, `max-height: calc(100% - 2*space-lg)` có cuộn riêng khi nội dung dài.

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| mở | ✓ | Scrim `--color-scrim` phủ sau, hộp nổi giữa màn với `--shadow` |
| đang xử lý | ✓ | Nút xác nhận chuyển trạng thái "đang gửi" của C1 (vd S4 "Đang kết nối…" qua `sending()`) — khoá Huỷ cũng nên khoá trong lúc xử lý nếu hành động không huỷ ngang được |
| biến thể cảnh báo đỏ | ✓ | `.dialog.warn` — thêm viền trong 1px `--color-danger` (`box-shadow: var(--shadow), inset 0 0 0 1px var(--color-danger)`); dùng cho host key đổi, bật Bypass, xoá máy, thu hồi, bỏ thay đổi |
| đổi tên (Enter lưu, Esc huỷ, an toàn IME) | ✓ | Ô nhập tự focus + chọn hết chữ khi mở; **Enter lưu** (chặn khi `event.isComposing` — an toàn gõ Telex/VNI); **Esc huỷ** (handler phím toàn cục dọn `ui.dialog`) |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền scrim | `--color-scrim` |
| Nền hộp | `--color-surface` |
| Bóng | `--shadow` |
| Viền cảnh báo đỏ | `--color-danger` |
| Chữ tiêu đề | `--color-text` |
| Chữ mô tả | `--color-text-muted` |
| Bo góc | `--radius` |
| Đệm trong | `--space-xl` |
| Khoảng cách khối | `--space-lg` |
| Nền khối vân tay (`.fp`) | `--color-bg` |
| Cỡ chữ tiêu đề | `--text-xl` |
| Cỡ chữ mô tả | `--text-sm` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| xác nhận thường | Nút chính `.primary`, không viền đỏ — vd đăng xuất |
| cảnh báo nguy hiểm | `.warn` + nút chính `.danger` — xoá, bỏ dự án, bỏ thay đổi, thu hồi, bật Bypass, host key đổi |
| đổi tên | Có `<input>` thay vì chỉ đọc, Enter lưu/Esc huỷ |
| có hành động phụ thứ ba | `extraOk` thêm một nút giữa Huỷ và nút chính — vd "Cập nhật khi không còn phiên chạy" cạnh "Cập nhật ngay"/Huỷ; "Bỏ thay đổi" cạnh "Lưu"/Huỷ khi đóng tab file chưa lưu |
| có bảng khoá-giá trị | `dl.kv` hai cột — vd S4 (máy, địa chỉ, loại khoá) |

## Tiếp cận (a11y)

`role="dialog"` + `aria-label` nêu rõ tiêu đề hộp thoại. Bấm ra ngoài (`.scrim`) hoặc Esc đóng hộp — trừ khi hành động đang "đang xử lý" thì nên khoá cả hai lối thoát tới khi xong (áp dụng nhất quán cho pha I, prototype hiện cho phép đóng bất cứ lúc nào qua scrim). Focus quản lý: hộp "Tin host key" khi khoá đổi tự focus nút Huỷ (an toàn mặc định, tránh bấm nhầm "Tin khoá mới"); hộp đổi tên tự focus + select-all ô nhập. Cặp tương phản tiêu đề/nền đạt `--color-text`/`--color-surface`; biến thể cảnh báo đạt viền `--color-danger`/`--color-surface` (thành phần).

## Không được làm

- Không đặt nút nguy hiểm (danger) ở vị trí nút chính mặc định khi hộp không phải biến thể cảnh báo — chỉ nút xác nhận hành động phá huỷ mới dùng `.danger`.
- Không cho nút xác nhận của biến thể cảnh báo bật sẵn — hộp "khoá đổi" phải chờ tick checkbox xác nhận trước khi mở nút.
- Không dùng C9 để hiển thị nội dung dài cần cuộn nhiều (danh sách dài, bảng dữ liệu) — đó là việc của C6 (sheet) hoặc màn riêng.
- Không bỏ qua "an toàn IME" ở ô nhập trong hộp thoại đổi tên — gõ Telex/VNI bấm Enter để chọn chữ không được gửi sớm.
