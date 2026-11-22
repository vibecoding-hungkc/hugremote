# C33 — Dòng tóm tắt cuối lượt Claude

| Field | Value |
|---|---|
| Mã | C33 |
| Nhóm | hiển thị |
| Mục đích | Cho người dùng biết nhanh một lượt Claude vừa làm mất bao lâu, tốn bao nhiêu, và sửa file nào — không phải đọc lại toàn bộ luồng chat |
| Màn hình dùng | S10 |
| Persona chạm tới | P-MOBILE, P-DESK, P-TEAM (chỉ phiên của mình) |
| Hiện thực prototype | class `.summary` (`.stats`, `.files`); nhánh `m.t === 'summary'` trong `render1()` của `chatBody()`; dữ liệu tạo ở `finishTurn(h,p,sid,text,files,dur,tokens,cost)` |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/TurnSummary.tsx` — props chính: `durationLabel: string, tokens: string, costLabel: string, filesChanged: string[], onOpenDiff: (path: string) => void` |

## Giải phẫu

Một khối gọn ngay sau tin nhắn cuối cùng của Claude trong lượt đó, theo thứ tự đọc:
1. Hàng thống kê (`.stats`): dấu ✓ "Xong lượt" · thời gian chạy · token (vào/ra gộp) · chi phí (USD) · số file đã đổi
2. Hàng chip file (`.files`, chỉ hiện nếu có file đổi): mỗi file một chip bấm được, icon Git + tên file (rút gọn, không kèm đường dẫn thư mục)

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| có file đổi | ✓ | Hiện cả hai hàng; bấm một chip file → mở Git với file đó đã chọn và bật diff (`ui.gitSel`, `ui.gitPane=true`, chuyển tab Git) |
| không đổi file | ✓ | Chỉ hiện hàng thống kê, ẩn hẳn hàng chip (không hiện khung rỗng thay cho nó) |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền khối | `--color-surface` |
| Viền khối | `--color-divider` |
| Bo góc | `--radius` |
| Chữ thống kê | `--text-xs`, `--color-text-muted` |
| Chip file | nền `--color-bg`, viền `--color-divider`, chữ `--text-xs` (kiểu `.chip` dùng chung với C36) |
| Icon Git trong chip | `--color-primary` |
| Đệm trong khối | `--space-md` |
| Khoảng cách giữa hai hàng | `--space-sm` |

## Biến thể

Không có.

| Biến thể | Khác gì bản mặc định |
|---|---|
| — | — |

## Tiếp cận (a11y)

- Khối tóm tắt không phải phần tử bấm được (chỉ các chip file bên trong mới bấm được) — không gán `tabindex` cho cả khối.
- Mỗi chip file có `title` nêu rõ hành động ("Xem thay đổi `<tên file>`") — giữ như prototype.
- Cặp tương phản chữ thống kê trên nền thẻ: `--color-text-muted` / `--color-surface` (nhóm "thường").
- Khi dùng trình đọc màn hình, khối nên được đọc như một đơn vị thông tin sau tin nhắn cuối — không chèn xen giữa các dòng chat khác.

## Không được làm

- Không hiện tóm tắt khi lượt Claude bị dừng giữa chừng (Esc) — trạng thái đó dùng dòng ghi chú riêng ("Bạn đã dừng Claude lúc…", không phải C33) vì chưa có số liệu đầy đủ (token/chi phí) cho một lượt chưa xong.
- Không gộp tóm tắt của nhiều lượt liên tiếp thành một khối — mỗi lượt Claude kết thúc một khối C33 riêng, kể cả khi lượt kế tiếp chạy ngay từ hàng chờ (C34).
- Không bỏ tóm tắt khi mở lại phiên ở thiết bị khác — tóm tắt lưu cùng hội thoại (`claude_messages`), không phải trạng thái tạm của một phiên trình duyệt.
