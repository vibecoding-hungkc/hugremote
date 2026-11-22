# C24 — Hộp chuyển nhanh / mở nhanh file

| Field | Value |
|---|---|
| Mã | C24 |
| Nhóm | điều hướng |
| Mục đích | Tới đúng máy/dự án/phiên/file/lệnh (S11) hoặc đúng file trong dự án hiện tại (S12) trong vài ký tự gõ, không rời bàn phím |
| Màn hình dùng | S11, S12 |
| Hiện thực prototype | class `.spot` (dùng chung cho cả hai màn) gồm `.top` (ô input + nút đóng), `.res` (kết quả nhóm theo `.grp`, mỗi dòng `.row`), `.hint` (gợi ý phím tắt cuối hộp); hàm `openSpot()`/`closeSpot()`/`spotResults()` cho S11 (tìm không dấu qua `norm()`, nhóm theo tên máy, gồm dự án/phiên/file/lệnh tĩnh); `openQuick()`/`quickResults()` cho S12 (khớp mờ ký tự `fz()`, cú pháp `:số` để tới dòng); điều hướng bàn phím dùng chung `spotKeys(e,id)` |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/CommandPalette.tsx` — props: `mode: 'global'\|'quick-open'; query: string; groups: { label: string; items: { icon: IconName; title: string; subtitle: string; status?: SessionStatus; onSelect: () => void }[] }[]; loading: boolean; onQueryChange: (q: string) => void; onClose: () => void` |

## Giải phẫu

Ô tìm (bắt buộc, đặt lại rỗng mỗi lần mở, autofocus) → danh sách kết quả theo nhóm (nhãn nhóm + các dòng [icon] [tiêu đề] [phụ đề] [huy hiệu trạng thái tuỳ chọn, chỉ S11]) → dòng gợi ý phím tắt cuối hộp (chỉ desktop).

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| rỗng (gợi ý: phiên cần bạn / file đang mở + vừa đổi) | ✓ | S11 khi query rỗng: lọc sẵn mục đang `awaiting`/`running`; S12 khi query rỗng: liệt kê file đang mở + file có đánh dấu sửa chưa mở — không hiện toàn bộ danh sách để tránh ngợp |
| có kết quả | ✓ | Danh sách lọc theo token khớp mờ (S11: mọi token khớp tên+phụ đề, không dấu; S12: khớp mờ ký tự theo thứ tự, sắp theo độ dài tên ngắn trước); dòng đầu luôn được chọn sẵn để Enter mở ngay |
| không thấy | ✓ | Một câu "Không thấy "…"." (S11) / "Không có file nào khớp "…"."" (S12) |
| đang tìm | ✓ | **Chưa hiện thực trong prototype** — kết quả tính đồng bộ tức thì trên dữ liệu giả lập trong bộ nhớ, không có độ trễ nên không có chỉ báo "đang tìm". Pha I gọi API thật (tìm file/dự án/phiên qua mạng) nên **bắt buộc** thêm trạng thái này, ví dụ khung xám như C3 (xem phát hiện ở báo cáo cuối) |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền hộp | `--color-surface` |
| Viền | `--color-border` |
| Bo góc | `--radius` |
| Bóng | `--shadow` |
| Nền phủ sau hộp | `--color-scrim` |
| Viền dưới ô tìm/hint | `--color-divider` |
| Chữ ô tìm | `--text-base` |
| Chữ nhóm/phụ đề | `--text-xs` `--color-text-muted` |
| Đệm ô tìm | `--space-lg` |
| Đệm danh sách | `--space-xs` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| S11 Chuyển nhanh | Nhóm theo máy, gồm dự án/phiên/file/lệnh, tìm không dấu |
| S12 Mở nhanh file | Chỉ file trong dự án hiện tại, khớp mờ, cú pháp `:số` để tới dòng |

## Tiếp cận (a11y)

Ô tìm `autocomplete="off"`, giữ vị trí con trỏ khi gõ (tránh nhảy về cuối do render lại). Điều hướng Lên/Xuống/Enter qua danh sách, cuộn tới mục chọn khi dùng bàn phím. Đóng bằng Esc hoặc bấm ra ngoài lớp phủ.

## Không được làm

- Không hiện toàn bộ danh sách khi ô tìm rỗng — chỉ gợi ý có chọn lọc.
- Không trộn kết quả S11 và S12 vào cùng một hộp — S12 chỉ tìm tên file, không có dự án/phiên/lệnh.
- Không giữ hộp mở sau khi Enter chọn một kết quả — luôn đóng ngay trước khi điều hướng tới đích.
