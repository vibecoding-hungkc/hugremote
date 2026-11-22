# C6 — Sheet

| Field | Value |
|---|---|
| Mã | C6 |
| Nhóm | điều hướng |
| Mục đích | Mở một form chi tiết (thêm/sửa máy) như một bề mặt phụ, không rời khỏi màn đang xem — trượt từ đáy trên mobile, panel cố định bên phải trên desktop |
| Màn hình dùng | S3 |
| Persona chạm tới | P-MOBILE, P-DESK, P-HOST |
| Hiện thực prototype | class `.scrim` (nền phủ) > `.sheet` (khung) > `.sheet-head` (tiêu đề + nút đóng) + `.sheet-body` (nội dung cuộn được, chứa các C2) + `.sheet-foot` (hàng nút, nút xoá đẩy trái bằng `margin-right:auto`, nút chính đẩy phải) — dựng trong `S3sheet()`; mở bằng `ui.sheet=true` + `openHostForm(id)`, đóng bằng click ra ngoài `.scrim` hoặc nút X |
| Hiện thực pha I | `apps/web/src/components/ui/Sheet.tsx` — `open: boolean; title: string; onClose: () => void; footer: ReactNode; danger?: { label: string; onClick: () => void }; children: ReactNode; saving?: boolean; error?: string` |

## Giải phẫu

Thứ tự đọc: **đầu sheet** (`.sheet-head`) — tiêu đề ("Thêm máy SSH" / "Sửa máy <tên>") + nút đóng C1 chỉ-icon → **thân sheet** (`.sheet-body`, cuộn riêng) — các C2 xếp dọc, có thể chèn C5 khi lỗi kết nối → **chân sheet** (`.sheet-foot`) — nút xoá (chỉ khi sửa, đẩy trái, biến thể danger) + nút phụ ("Thử kết nối") + nút chính ("Lưu", đẩy phải).

Ràng buộc bố cục không token: rộng cố định **420px** trên desktop (phủ từ phải), **100% rộng, cao 88%** trên mobile (trượt từ đáy, chỉ bo góc trên).

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| mở | ✓ | Scrim phủ `--color-scrim` sau sheet; sheet nổi với `--shadow` |
| đang lưu | ✓ | Nút "Lưu" chuyển trạng thái "đang gửi" của C1 (khoá, "Đang lưu…"), không nhận bấm lần hai |
| lỗi lưu | ✓ | Chèn C5 trong `.sheet-body` ngay trên hàng nút chân sheet; giữ nguyên mọi giá trị đã nhập |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền scrim | `--color-scrim` |
| Nền sheet | `--color-surface` |
| Bóng | `--shadow` |
| Viền chia đầu/thân/chân | `--color-divider` |
| Chiều cao đầu/chân cố định | `--bar-h` (đầu) |
| Đệm thân | `--space-lg` |
| Đệm chân | `--space-md` (dọc), `--space-lg` (ngang) |
| Khoảng cách nút trong chân | `--space-sm` |
| Chữ tiêu đề | `--color-text`, trọng lượng 600 (không token riêng cho weight) |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| thêm mới | Không có nút xoá ở chân sheet; tiêu đề "Thêm máy SSH" |
| sửa | Có nút xoá (danger, đẩy trái) ở chân; tiêu đề "Sửa máy <tên>"; đổi host/port/user bắt "Thử kết nối" lại trước khi "Lưu" mở khoá (xem C2 `testHost()`) |

## Tiếp cận (a11y)

`aria-label` trên phần tử sheet nêu rõ đang ở màn nào ("S3 Thêm máy"/"S3 Sửa máy"). Bấm ra ngoài vùng sheet (lên `.scrim`) đóng sheet — tương đương Esc (xử lý ở `addEventListener('keydown')` toàn cục khi `ui.sheet` đang mở). Nút đóng C1 luôn có `aria-label="Đóng"`. Thân sheet cuộn riêng (`.sheet-body { overflow:auto }`) để đầu/chân luôn cố định và thấy được trên màn hình thấp. Trên mobile, chiều cao 88% chừa khoảng hở phía trên để người dùng thấy còn nội dung bên dưới sheet (gợi ý còn ngữ cảnh), không chiếm trọn màn.

## Không được làm

- Không dùng C6 cho xác nhận ngắn (có/không) — đó là C9 (hộp thoại).
- Không cho phép "Lưu" khi vừa đổi địa chỉ/cổng/người dùng mà chưa "Thử kết nối" lại thành công (ca biên khoá ở `ARCHITECTURE.md §6`).
- Không xoá giá trị đã nhập khi đóng sheet do lỗi — chỉ xoá khi người dùng chủ động Huỷ/đóng thành công.
- Không thêm sheet thứ hai chồng lên sheet đang mở.
