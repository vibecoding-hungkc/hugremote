# C35 — Danh sách quản trị

| Field | Value |
|---|---|
| Mã | C35 |
| Nhóm | hiển thị |
| Mục đích | Cho owner (và member, riêng mục thiết bị của mình) xem và thao tác trên các danh sách quản trị: thiết bị đăng nhập, thành viên, lần SSO bị từ chối, nhật ký |
| Màn hình dùng | S7 |
| Persona chạm tới | P-HOST (mọi mục), P-TEAM (chỉ mục Thiết bị đăng nhập — của riêng mình) |
| Hiện thực prototype | class `.list` + `.row` (dùng lại của C3), không phải class riêng — bốn chỗ dùng trong `S7()`: `D.devices.map(...)`, `D.members.map(...)`, `D.denied.map(...)`, và biến thể dạng nhật ký dùng `.logv` + `.seg` (xem "Biến thể") |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/AdminList.tsx` — props chính: `items: {id, title, subtitle, actions?: {label, onClick, variant?: 'default' \| 'danger'}[], badge?}[], emptyText: string` |

## Giải phẫu

Danh sách dọc dùng lại khung C3 (Hàng danh sách), mỗi hàng theo thứ tự đọc:
1. Icon loại dòng (thiết bị, khiên bảo mật, dấu X cho bị từ chối…)
2. Tiêu đề chính (tên thiết bị / email thành viên / email bị từ chối)
3. Dòng phụ (IP + lần dùng cuối / lần đăng nhập cuối + số phiên đang chạy / thời điểm + lý do từ chối)
4. Huy hiệu hoặc nút hành động cuối hàng (Đăng xuất / "thiết bị này" / Thu hồi… / Cho phép)

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| có dữ liệu | ✓ | Danh sách `.list`/`.row` đầy đủ, hàng cuối không có viền dưới; nút hành động nguy hiểm (Thu hồi, Đăng xuất mọi thiết bị khác) tô theo quy ước nút C1 danger khi mở hộp xác nhận |
| rỗng | ✓ | Một câu chữ phụ thay cho danh sách (vd "Chưa ai đăng nhập bằng SSO.", "Không có.") — **không dùng khuôn C4 đầy đủ** (không có icon lớn + nút hành động), vì đây là mục phụ trong trang Cài đặt, không phải nội dung chính của màn (xem phát hiện ở báo cáo cuối) |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền danh sách | `--color-surface` |
| Viền danh sách + đường kẻ giữa hàng | `--color-divider` |
| Bo góc danh sách | `--radius` |
| Chữ tiêu đề hàng | `--text-sm`, `--color-text` |
| Chữ dòng phụ | `--text-xs`, `--color-text-muted` |
| Icon khiên/thiết bị | `--color-text` (mặc định, không mang màu khu vực) |
| Huy hiệu "thiết bị này" | kiểu `.badge` — nền `--color-surface-raised`, chữ `--text-xs` |
| Nút hành động nguy hiểm | `--color-danger` (chữ, kiểu `.btn.on-danger`) |
| Chữ rỗng | `--text-sm`, `--color-text-muted` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| Nhật ký (log viewer) | Không dùng `.list`/`.row` — dùng `.seg` chọn nguồn (Ứng dụng/Cập nhật/SSH) + khối `<pre class="logv">` nền `--term-bg`, chữ `--term-text`, dòng ERROR `--term-red`/WARN `--term-yellow`, kèm hai nút Tải xuống/Sao chép. Đây là cách trình bày khác hẳn ba danh sách kia (dữ liệu dòng thô, không phải thực thể có thể thao tác từng dòng) — giữ làm biến thể của C35 vì cùng mục đích "danh mục quản trị", không tách component riêng |

## Tiếp cận (a11y)

- Hàng không có hành động (chỉ xem) đặt `cursor:default`, không gán `tabindex`/`onclick` giả — khác C3 (hàng danh sách thường có thể bấm cả hàng để chọn).
- Mọi nút hành động nguy hiểm (Thu hồi, Tắt SSO, Đăng xuất) phải mở hộp xác nhận C9 trước khi thực thi — không thực thi ngay khi bấm.
- Vùng chạm nút hành động cuối hàng ≥ `--tap`.
- Cặp tương phản chữ phụ trên nền thẻ: `--color-text-muted` / `--color-surface` (nhóm "thường").
- Khối nhật ký (`.logv`) dùng `--font-mono` — đủ tương phản theo cặp "Terminal" (`DESIGN-SYSTEM.md §3`).

## Không được làm

- Không cho member thấy ba mục Thành viên / Lần SSO bị từ chối / Nhật ký — chỉ owner (AC-33, ma trận PERSONAS §2).
- Không xoá cứng bản ghi khi "Thu hồi" — hành động này thu hồi refresh token + dừng phiên + gỡ khỏi allowlist, không xoá lịch sử đăng nhập trước đó.
- Không trộn danh sách quản trị với danh sách phiên/máy/dự án (C3/C11) — C35 chỉ dùng cho bốn danh mục ở Cài đặt, không dùng lại cho cây điều hướng.
