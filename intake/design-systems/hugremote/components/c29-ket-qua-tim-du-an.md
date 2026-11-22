# C29 — Kết quả tìm trong dự án

| Field | Value |
|---|---|
| Mã | C29 |
| Nhóm | hiển thị |
| Mục đích | Cho developer tìm một hàm/chuỗi xuất hiện ở đâu trong cả dự án rồi nhảy thẳng tới đúng dòng |
| Màn hình dùng | S8 |
| Persona chạm tới | P-MOBILE, P-DESK (PERSONAS §1.1 — "Tìm nơi dùng một hàm/chuỗi") |
| Hiện thực prototype | class `.sres` (`.sf` tiêu đề nhóm theo file, `.sl` dòng kết quả, `.legend` tổng số); hàm `searchResults()`, gọi từ `ui.fside === 'search'` trong `S8()` |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/ProjectSearchResults.tsx` — props chính: `query: string, caseSensitive: boolean, regex: boolean, scopeSrcOnly: boolean, groups: {path: string, hits: {line: number, text: string}[]}[], loading: boolean, onOpen: (path, line) => void` |

## Giải phẫu

Thay cho cây file ở cột trái, theo thứ tự đọc:
1. Ô tìm (dùng lại `.input` của C2) + ba chip tuỳ chọn: **Aa** (phân biệt hoa thường), **.\*** (regex), **src/\*\*** (chỉ tìm trong `src/`)
2. Dòng tổng số: "`<n>` kết quả trong `<m>` file" (`.legend`)
3. Mỗi file một nhóm: tiêu đề nhóm (icon file + đường dẫn + huy hiệu số dòng khớp trong file đó)
4. Trong mỗi nhóm: danh sách dòng khớp — số dòng (căn phải) + nội dung dòng (chữ khớp tô sáng), cắt bớt nếu dài hơn một dòng

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| gợi ý (chưa đủ 2 ký tự) | ✓ | Chữ phụ nhỏ giải thích cách dùng (đã bỏ qua `.gitignore`, và file ẩn trừ khi đang bật hiện file ẩn) — không gọi tìm kiếm |
| có kết quả | ✓ | Nhóm theo file, số dòng, chữ khớp tô `--color-warning`; bấm một dòng → mở file đúng dòng đó |
| không thấy | ✓ | Khuôn rỗng C4: "Không thấy "<chuỗi>" trong dự án." |
| đang tìm | ✓ | Trạng thái tải — khung xám theo khuôn "Đang tải" ở `DESIGN-SYSTEM.md §5` thay cho danh sách (pha I: tìm chạy trên máy đích qua ripgrep/`grep -rn`, có độ trễ mạng SSH — không được bỏ qua trạng thái này) |
| biểu thức chính quy sai | ✓ | Chữ lỗi nhỏ "Biểu thức chính quy chưa đúng" thay danh sách kết quả |

## Token dùng

| Vị trí | Token |
|---|---|
| Chữ dòng kết quả | `--text-sm` (tiêu đề nhóm), `--text-xs` (số dòng, nội dung dòng — dùng `--font-mono`) |
| Chữ khớp tô sáng | nền `--color-warning`, chữ `--color-bg` |
| Hover một dòng kết quả | `--color-surface-raised` |
| Số dòng (cột trái) | `--color-text-muted` |
| Huy hiệu số kết quả mỗi file | nền `--color-surface-raised`, chữ `--text-xs` (C14 kiểu `.badge`) |
| Đệm dòng/tiêu đề nhóm | `--space-xs` `--space-sm` `--space-md` `--space-xl` (thụt theo nhóm) |
| Vùng chạm dòng kết quả (mobile) | `--tap` |

## Biến thể

Không có biến thể kích cỡ — một cách trình bày cho mọi màn.

| Biến thể | Khác gì bản mặc định |
|---|---|
| — | — |

## Tiếp cận (a11y)

- Mỗi dòng kết quả là phần tử bấm được với `tabindex="0"` và xử lý `Enter` — giữ nguyên ở pha I.
- Tiêu đề nhóm (tên file) không bấm được, chỉ phân nhóm trực quan — không gán `role="button"` nhầm.
- Cặp tương phản chữ khớp tô sáng: `--color-bg` trên `--color-warning` (nhóm "thành phần", `DESIGN-SYSTEM.md §3`).
- Vùng chạm mỗi dòng ≥ `--tap` trên mobile.
- Ba chip tuỳ chọn (Aa, .*, src/**) phải có `aria-pressed` phản ánh bật/tắt — prototype đã có, giữ nguyên ở pha I.

## Không được làm

- Không tìm trong file đã bị `.gitignore` trừ khi người dùng chủ động tắt lọc — mặc định bỏ qua đúng theo `DECISIONS.md` (ripgrep tôn trọng `.gitignore`).
- Không gộp C29 với C28 — C29 luôn thao tác trên toàn dự án và luôn mở ở thanh bên (cột trái), không mở nổi trên vùng code như C28.
- Không tự tìm khi chưa đủ 2 ký tự — tránh quét toàn dự án cho một ký tự, tốn tài nguyên máy đích.
