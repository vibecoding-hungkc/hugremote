# C20 — Thẻ công cụ

| Field | Value |
|---|---|
| Mã | C20 |
| Nhóm | hiển thị |
| Mục đích | Cho biết Claude vừa/đang làm gì ở tầng hệ thống (sửa file nào, chạy lệnh gì) và kết quả, rút gọn theo mặc định |
| Màn hình dùng | S10 |
| Hiện thực prototype | class `.tool` bọc `.th` (hàng đầu: icon theo loại `file`/`term`, nhãn "Sửa file"/"Chạy lệnh", đường dẫn dạng link mở file đúng dòng hoặc lệnh mono, huy hiệu trạng thái bên phải) và `.tb` (thân chi tiết, mono, chỉ hiện khi không ở chế độ gọn — `pathLinks()` biến `@@path:line@@` trong chuỗi chi tiết thành link `openFile()`) |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/ToolCard.tsx` — props: `kind: 'edit'\|'bash'; label: string; path?: string; line?: number; cmd?: string; status: 'running'\|'done'\|'err'\|'stopped'; detail?: string; compact?: boolean` |

## Giải phẫu

Hàng đầu (bắt buộc): [icon loại] [nhãn ngắn] [đường dẫn:dòng dạng link HOẶC lệnh mono, co giãn] [huy hiệu trạng thái C14]. Thân chi tiết (tuỳ chọn): ẩn khi rút gọn, ẩn khi rỗng.

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| đang chạy | ✓ | Huy hiệu C14 "đang chạy" (chấm xanh dương nhấp nháy) ở cuối hàng đầu |
| xong | ✓ | Huy hiệu C14 "xong" (chấm xanh lá); với lệnh, thân chi tiết giữ nguyên output cuối cùng |
| lỗi | ✓ | Badge riêng (icon chấm đỏ + "lỗi", ngắn hơn nhãn "không kết nối được" của huy hiệu C14 dùng chung); thân chi tiết hiện output lỗi, link `path:dòng` bấm được để nhảy thẳng tới dòng gây lỗi trong editor |

## Token dùng

| Vị trí | Token |
|---|---|
| Viền | `--color-divider` |
| Bo góc | `--radius` |
| Nền | `--color-surface` |
| Cỡ chữ hàng đầu | `--text-sm` |
| Cỡ chữ thân chi tiết | `--text-xs` |
| Font thân chi tiết | `--font-mono` |
| Màu thân chi tiết | `--color-text-muted` |
| Đệm | `--space-sm` `--space-md` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| đầy đủ | Mặc định, hiện cả thân chi tiết |
| rút gọn (compact) | Ẩn thân chi tiết — dùng trong ô chia bên phải |

Trạng thái "đã dừng" (mượn huy hiệu C14 khi người dùng bấm Dừng giữa chừng) không phải biến thể/trạng thái chính thức thứ tư của C20 — xem "Không được làm".

## Tiếp cận (a11y)

Link `path:line` trong thân chi tiết là `<button>` thật, bấm được và nhận focus bàn phím — không phải chữ gạch chân giả lập. Cặp tương phản thân chi tiết: `--color-text-muted`/`--color-surface`.

## Không được làm

- Không gộp hai loại tool (edit/bash) vào một thẻ.
- Không ẩn đường dẫn/lệnh ngay cả ở chế độ rút gọn — hàng đầu luôn đủ ba phần icon/nhãn/đích.
- Không coi trạng thái "đã dừng" là trạng thái bắt buộc thứ tư của C20 — ba trạng thái bắt buộc đã khoá ở `DESIGN-SYSTEM.md §4` là đang chạy/xong/lỗi; "đã dừng" chỉ là huy hiệu mượn từ C14 khi người dùng chủ động dừng phiên (xem phát hiện).
