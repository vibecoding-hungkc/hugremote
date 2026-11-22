# C28 — Thanh tìm/thay trong file

| Field | Value |
|---|---|
| Mã | C28 |
| Nhóm | input |
| Mục đích | Cho developer tìm và thay nhanh một chuỗi bên trong file đang mở ở editor, không rời màn |
| Màn hình dùng | S8 |
| Persona chạm tới | P-MOBILE, P-DESK (PERSONAS §1.1 — "Sửa nhanh vài dòng ở 1–3 file") |
| Hiện thực prototype | class `.findbar` (+ `.input` dùng lại của C2); hàm `replaceAll(all)`, `gotoLine()`; mở/đóng qua `ui.findOpen` trong `S8()`, đếm khớp bằng `cnt` tính trong `S8()` |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/FindReplaceBar.tsx` — props chính: `open: boolean, query: string, replacement: string, matchCount: number, onQueryChange, onReplacementChange, onReplaceOne, onReplaceAll, onGotoLine, onClose` |

## Giải phẫu

Thanh ngang nằm ngay dưới `.ehead` (đầu editor), trên vùng code, theo thứ tự đọc:
1. Ô **Tìm** (bắt buộc, tự nhận focus khi mở)
2. Ô **Thay bằng…** (bắt buộc, luôn hiện cạnh ô Tìm — không ẩn sau nút phụ)
3. Số kết quả dạng chữ phụ, vd "3 kết quả" (chỉ hiện khi có chữ trong ô Tìm)
4. Nút **Thay** (một chỗ khớp gần nhất)
5. Nút **Thay tất cả**
6. Nút **Tới dòng…** (mở hộp mở nhanh C24/S12 ở chế độ nhập `:dòng`)
7. Nút đóng (✕, góc phải, phím tắt Esc)

Cả thanh nằm trên một hàng, bọc dòng (`flex-wrap`) khi màn hẹp thay vì cắt bớt nút.

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| đóng | ✓ | Không render thanh; chỉ nút biểu tượng "Tìm/thay trong file (⌘F)" ở `.ehead` còn hiện |
| mở | ✓ | Thanh hiện, ô Tìm tự nhận focus; nếu file không sửa được (log/ảnh/quá lớn) nút không xuất hiện ở `.ehead` nên thanh không mở được |
| có kết quả | ✓ | Chữ khớp trong vùng code tô `--color-warning` qua `<mark>`; số kết quả hiện cạnh ô Thay bằng; Thay/Thay tất cả bấm được |
| không có kết quả | ✓ | Không có `<mark>` nào trong code; không hiện số "0 kết quả" riêng (để trống) — nút Thay/Thay tất cả vẫn bấm được nhưng không đổi gì (ca biên chấp nhận ở vòng này, không chặn nút) |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền thanh | `--color-surface` |
| Viền dưới thanh (phân cách với vùng code) | `--color-divider` |
| Nền ô nhập | `--color-surface-raised` |
| Viền ô nhập | `--color-border` |
| Chữ trong ô nhập | `--text-sm` |
| Chữ khớp tô sáng trong code | nền `--color-warning`, chữ `--color-bg` |
| Đệm trong thanh | `--space-xs` `--space-sm` |
| Khoảng cách giữa các phần tử | `--space-xs` |

## Biến thể

Không có — một kích cỡ, luôn nằm ngang trên cùng một thanh ở cả mobile và desktop.

| Biến thể | Khác gì bản mặc định |
|---|---|
| — | — |

## Tiếp cận (a11y)

- Ô Tìm và ô Thay bằng đều có `placeholder` mô tả, nên thêm `aria-label` tương ứng ("Tìm trong file", "Thay bằng") khi dựng ở pha I — prototype hiện chỉ có `placeholder`.
- Esc trong ô Tìm đóng thanh và xoá chữ đang tìm (giữ nguyên hành vi `onkeydown` của prototype).
- Nút đóng có `title` + `aria-label` "Đóng (Esc)".
- Cặp tương phản chữ khớp tô sáng: `--color-bg` trên `--color-warning` — kiểm ở `DESIGN-SYSTEM.md §3` nhóm "thành phần".
- Vùng chạm nút ≥ `--tap` trên mobile (kế thừa quy tắc chung `.btn.sm` ở `@media (max-width: 767px)`).

## Không được làm

- Không thay thế bằng regex ở C28 — tìm/thay regex thuộc phạm vi C29 (tìm trong dự án), C28 chỉ so khớp chuỗi thường trong một file.
- Không ẩn ô Thay bằng sau một nút "mở rộng" — Authority đã chốt luôn hiện đủ Tìm + Thay bằng trên cùng một thanh (không làm hai bước).
- Không tự động cuộn hay nhảy dòng khi gõ — chỉ tô `<mark>`, việc nhảy tới dòng khớp là việc của "Tới dòng…", không gộp vào gõ tìm.
