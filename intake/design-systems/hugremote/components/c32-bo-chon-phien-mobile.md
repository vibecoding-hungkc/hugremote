# C32 — Bộ chọn phiên trên mobile

| Field | Value |
|---|---|
| Mã | C32 |
| Nhóm | điều hướng |
| Mục đích | Thay dải tab phiên (không vừa màn hẹp) bằng một nút mở danh sách phiên, để chuyển phiên trên điện thoại |
| Màn hình dùng | S6, S10 |
| Persona chạm tới | P-MOBILE (PERSONAS: "Thiết bị chính: Điện thoại"), P-TEAM khi dùng điện thoại |
| Hiện thực prototype | class `.sesspick` (ẩn ở desktop, `display:flex` dưới 768px — thế chỗ `.tabbar .tabs`); render trong `sessionBar(r, curId, extra)`; mở danh sách qua `openRowMenu(event,'sessions',...)` → `rowMenu()` nhánh `m.kind === 'sessions'` |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/MobileSessionPicker.tsx` — props chính: `currentSession: {id, name, kind: 'claude' \| 'terminal', status} \| null, sessionCount: number, hasAwaiting: boolean, onOpen: () => void` |

## Giải phẫu

Một hàng thay cho toàn bộ dải tab, theo thứ tự đọc:
1. Icon loại phiên hiện tại (Claude hoặc terminal, màu khu vực tương ứng)
2. Tên phiên hiện tại (co giãn, cắt bớt `…` nếu dài)
3. Chấm trạng thái của phiên hiện tại (ẩn khi phiên là "mới")
4. Huy hiệu "`<n>` phiên"
5. Mũi tên xuống (gợi ý mở danh sách)

Toàn hàng là một nút bấm được, chiếm hết chỗ còn lại của thanh phiên (sau khi chuông C38 và nút + đã chiếm chỗ của mình).

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| đóng | ✓ | Chỉ hiện hàng tóm tắt (tên phiên hiện tại + số phiên); danh sách chưa mở |
| mở | ✓ | Danh sách nổi (C23) hiện, nhóm **Claude** trước **Terminal** sau — đúng thứ tự cây; mỗi dòng: icon + tên + trạng thái (+ "· Bypass" nếu có); cuối danh sách hai dòng "Phiên Claude mới" / "Terminal mới" |
| phiên cần duyệt có chấm vàng | ✓ | Dòng phiên Claude đang `awaiting` trong danh sách hiện chấm `--color-warning` qua `statusBadge('awaiting')`; bản thân nút tóm tắt không đổi màu cho trạng thái này (đó là việc của chuông C38, không trùng vai) |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền hàng tóm tắt | trong suốt (kế thừa `--color-surface` của `.tabbar`) |
| Chữ tên phiên | `--text-sm`, `--color-text` |
| Icon Claude / Terminal | `--color-accent-claude` / `--color-accent-terminal` |
| Chấm trạng thái | `--color-primary` (đang chạy, nhấp nháy) · `--color-success` (xong) · `--color-warning` (cần duyệt) · `--color-text-muted` (đã kết thúc) |
| Huy hiệu số phiên | nền `--color-surface-raised`, chữ `--text-xs` (kiểu `.badge`) |
| Đệm ngang | `--space-md` |
| Vùng chạm | `--tap` |

## Biến thể

Không có — chỉ xuất hiện dưới 768px, một kích cỡ.

| Biến thể | Khác gì bản mặc định |
|---|---|
| — | — |

## Tiếp cận (a11y)

- Nút tóm tắt có `aria-haspopup="listbox"` và `aria-expanded` phản ánh trạng thái đóng/mở (prototype dùng `openRowMenu` chung cho mọi menu nổi — pha I thêm hai thuộc tính này riêng cho C32).
- Danh sách mở dùng điều hướng phím mũi tên + Enter giống mọi `.menu` khác (`menuKeys()`), áp dụng cả khi mở bằng chạm trên mobile có bàn phím ngoài gắn vào.
- Vùng chạm nút tóm tắt và từng dòng trong danh sách ≥ `--tap`.
- Cặp tương phản tên phiên trên nền trang: `--color-text` / `--color-bg` (nhóm "thường").

## Không được làm

- Không hiện C32 trên desktop ≥768px — ở đó dùng dải tab C8 đầy đủ, không thay thế.
- Không gộp chuông C38 vào bên trong C32 — hai nút độc lập, cùng nằm trên thanh phiên nhưng mở hai danh sách khác nhau (C32: mọi phiên của dự án; C38: phiên cần duyệt của mọi dự án).
- Không bỏ nhóm theo loại (Claude/Terminal) khi danh sách dài — giữ đúng thứ tự cây đã chốt ở DECISIONS (Claude trước, terminal sau).
