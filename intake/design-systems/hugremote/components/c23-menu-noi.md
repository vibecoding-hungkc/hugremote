# C23 — Menu nổi

| Field | Value |
|---|---|
| Mã | C23 |
| Nhóm | điều hướng |
| Mục đích | Gom các hành động phụ của một hàng/vùng (máy, dự án, phiên, file, nhánh, chia ô, thông báo…) vào một lớp nổi không bị vùng cuộn cắt |
| Màn hình dùng | S2, S6, S7, S10 |
| Persona chạm tới | P-MOBILE, P-DESK, P-HOST, P-TEAM |
| Hiện thực prototype | class `.menu` (biến thể `.menu.inline` dùng trong ô soạn cho chọn model/quyền) bọc bởi `.scrim` nền trong suốt để bắt click-ra-ngoài-để-đóng, chứa `.grp` (nhãn nhóm) và `.mi` (mục menu, biến thể `.mi.danger` chữ đỏ); hàm `openRowMenu(e,kind,...)` định vị menu theo toạ độ phần tử bấm (kẹp trong viewport), `rowMenu()` dựng nội dung theo `kind` (host/project/session/plus/sessions/notif/branch/split/sendclaude/gitfile/file), `menuKeys(e)` xử lý Lên/Xuống/Enter giữa các `.mi` |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/FloatingMenu.tsx` — props: `items: { icon?: IconName; label: string; description?: string; kbd?: string; danger?: boolean; onSelect: () => void }[]; groups?: string[]; anchorRect: DOMRect; open: boolean; onClose: () => void` |

## Giải phẫu

Danh sách mục theo nhóm (nhãn nhóm tuỳ chọn) → mỗi mục [icon tuỳ chọn] [nhãn bắt buộc] [mô tả phụ tuỳ chọn, dòng dưới nhãn] [phím tắt tuỳ chọn, bên phải].

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| đóng | ✓ | Không render gì |
| mở | ✓ | Render `.menu` định vị tuyệt đối tại toạ độ nguồn mở (kẹp trong viewport), focus tự động vào mục đầu tiên, điều hướng bàn phím Lên/Xuống/Enter |
| mục nguy hiểm (Bỏ, Xoá, Bypass — chữ đỏ) | ✓ | `.mi.danger`: chữ `--color-danger` cho cả nhãn và icon — dùng cho "Bỏ dự án", "Xoá phiên", "Bật Bypass", "Bỏ thay đổi…", "Xoá…" |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền | `--color-surface` |
| Viền | `--color-border` |
| Bo góc | `--radius` |
| Bóng | `--shadow` |
| Đệm ngoài | `--space-xs` |
| Đệm mỗi mục | `--space-xs` `--space-md` |
| Nhãn nhóm | `--text-xs` `--color-text-muted` |
| Nhãn mục | `--text-sm` |
| Mô tả phụ | `--text-xs` `--color-text-muted` |
| Màu nguy hiểm | `--color-danger` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| nổi theo toạ độ | Mặc định — dùng cho mọi menu ngữ cảnh (chuột phải/⋯) |
| `.inline` neo trong ô soạn | Menu model/quyền: neo `bottom:100%` phía trên nút mở, không theo toạ độ chuột |

## Tiếp cận (a11y)

Mỗi `.mi` có `tabindex="0"` và nhận focus theo thứ tự render. `menuKeys()` cho phép dùng thuần bàn phím (Lên/Xuống di chuyển vòng, Enter kích hoạt mục đang focus). Đóng bằng Esc (xử lý ở tầng phím tắt toàn cục). Lớp `.scrim` nền trong suốt vẫn bắt được click ra ngoài để đóng mà không che khuất nội dung phía sau.

## Không được làm

- Không để menu tràn ra ngoài viewport — luôn tính lại toạ độ theo kích thước cửa sổ.
- Không dùng C23 cho hành động cần nhập liệu (dùng hộp thoại C9 cho đổi tên, xác nhận — menu chỉ chứa mục bấm-là-xong).
- Không trộn mục nguy hiểm lẫn vào giữa các mục thường — đặt ở cuối nhóm hoặc tách nhóm riêng.
