# C25 — Thanh tiến độ

| Field | Value |
|---|---|
| Mã | C25 |
| Nhóm | phản hồi |
| Mục đích | Cho biết một việc chạy nhiều bước (tải lên file, cập nhật phiên bản) đang ở đâu, không để màn hình trông như treo |
| Màn hình dùng | S7, S8 |
| Persona chạm tới | P-MOBILE, P-DESK, P-HOST, P-TEAM |
| Hiện thực prototype | class `.prog` (rãnh nền) bọc `<i>` (phần đã đầy, `width` set inline theo %) — dùng ở hai nơi: S8 tải lên file (text "14/32 file" + `width:44%` cố định minh hoạ) và S7 tab Hệ thống khi cập nhật phiên bản (đi kèm danh sách bước `.steps`/`.step` với chấm trạng thái từng bước, `width:55%` cố định minh hoạ) |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/ProgressBar.tsx` — props: `percent: number; label?: string; steps?: { label: string; state: 'done'\|'running'\|'pending' }[]` |

## Giải phẫu

[nhãn mô tả việc đang chạy + số liệu tiến độ dạng chữ, ví dụ "14/32 file"] (bắt buộc) → [danh sách bước tuỳ chọn, mỗi bước: chấm trạng thái mượn từ C14 + tên bước] → thanh rãnh + phần đầy (bắt buộc).

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| đang chạy | ✓ | Phần đầy rộng theo % thật của tiến độ, nền `--color-primary`; nếu có danh sách bước, bước hiện tại có chấm "đang chạy" + chữ "— đang chạy" |
| xong | ✓ | **Chưa có khuôn hình riêng trong prototype** — cả hai nơi dùng C25 không tự chuyển sang trạng thái "xong" một cách tường minh: tải lên không có bước kết thúc hiển thị; cập nhật xong thì ứng dụng khởi động lại nên không còn phiên để vẽ tiếp. Pha I nên dùng mẫu chung: phần đầy 100%, danh sách bước còn lại chuyển "xong", rồi thanh biến mất sau khi toast C27 xác nhận (xem phát hiện ở báo cáo cuối) |
| lỗi (nút Thử lại) | ✓ | Quan sát được ở S7 cập nhật: khi lỗi, **toàn bộ khối C25 bị thay bằng khối lỗi C5** (thông báo lỗi + nút "Xem nhật ký"), không phải thanh tiến độ đổi màu đỏ và dừng lại. Pha I giữ đúng hành vi này: lỗi giữa chừng → ẩn C25, hiện C5 cùng vị trí |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền rãnh | `--color-surface-raised` |
| Màu phần đầy | `--color-primary` |
| Bo góc | `--radius-pill` |
| Chữ nhãn | `--text-sm` `--text-xs` |
| Khoảng cách | `--space-xs` `--space-sm` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| đơn giản | Chỉ thanh + nhãn số liệu — dùng ở S8 tải lên |
| kèm danh sách bước | Dùng ở S7 cập nhật hệ thống, mỗi bước có chấm trạng thái riêng mượn từ C14 |

## Tiếp cận (a11y)

Thanh nên có `role="progressbar"` + `aria-valuenow`/`aria-valuemin`/`aria-valuemax` ở pha I (prototype hiện là một `<div>` thuần, không có role — xem phát hiện ở báo cáo cuối). Nhãn số liệu dạng chữ ("14/32 file") đã tự nhiên đọc được bằng trình đọc màn hình mà không cần tính % qua màu.

## Không được làm

- Không chỉ dựa vào màu/độ rộng để truyền tiến độ — luôn kèm nhãn số liệu dạng chữ.
- Không để thanh tiến độ đứng yên quá lâu không đổi khi việc thật đang chạy — pha I phải cập nhật độ rộng theo tiến độ thật, không hardcode như demo.
- Không giữ thanh tiến độ hiển thị cùng lúc với khối lỗi C5 — hai thứ thay thế nhau, không chồng lên nhau.
