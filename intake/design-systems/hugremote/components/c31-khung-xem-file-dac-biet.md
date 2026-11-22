# C31 — Khung xem file đặc biệt

| Field | Value |
|---|---|
| Mã | C31 |
| Nhóm | hiển thị |
| Mục đích | Hiện đúng cách những file không sửa được như văn bản thường: ảnh, log đang chạy, file quá lớn |
| Màn hình dùng | S8 |
| Persona chạm tới | P-MOBILE, P-DESK (PERSONAS §1.1 — "Đọc log / file cấu hình") |
| Hiện thực prototype | class `.special` + `.imgbox` (ảnh); `.findbar` + `.term`/`.logv` (log, lọc theo mức); `.special` với hai nút (file lớn); hàm `fileBody()` theo `f.kind` (`img`/`log`/`big`) |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/SpecialFileView.tsx` — props chính: `kind: 'image' \| 'log' \| 'oversized', sizeLabel?: string, lines?: string[], logLevel?: 'all' \| 'ERROR' \| 'WARN', following?: boolean, onLevelChange, onToggleFollow, onViewTail, onDownload` |

## Giải phẫu

Vùng giữa khung editor (thế chỗ `.codewrap`), căn giữa theo chiều ngang và dọc, theo thứ tự đọc tuỳ `kind`:

**Ảnh**: khung vuông giữ chỗ (preview) → dòng phụ tên file · kích thước · dung lượng → nút Tải xuống.

**Log**: thanh lọc (`.findbar`) trước tiên — ô lọc theo chữ + bộ chọn mức (Tất cả/ERROR/WARN) + số dòng đang hiện/tổng; dưới là nội dung log kiểu terminal (`--term-*`), dòng mới tự thêm khi đang theo dõi.

**File quá lớn**: một câu nói rõ lý do (dung lượng, giới hạn) → hai nút: Xem 1.000 dòng cuối · Tải xuống.

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| ảnh | ✓ | Khung giữ chỗ hình vuông `--radius`, icon `--color-primary`; dòng phụ tên + kích thước; nút Tải xuống |
| log (Theo dõi bật/tắt) | ✓ | Nút "Theo dõi (tail -f)" bật → nền nút `on-primary`, dòng mới nối thêm tự động, chữ ghi chú cuối "đang theo dõi, dòng mới tự hiện"; tắt → log tĩnh tại thời điểm mở |
| quá lớn (Xem 1.000 dòng cuối / Tải xuống) | ✓ | Hai nút ngang hàng, không mở file vào editor có thể sửa |

## Token dùng

| Vị trí | Token |
|---|---|
| Khung giữ chỗ ảnh | nền `--color-surface-raised`, bo `--radius`, icon `--color-primary` |
| Nền log | `--term-bg` |
| Chữ log | `--term-text`; dòng ERROR `--term-red`; dòng WARN `--term-yellow`; ghi chú theo dõi `--term-muted` |
| Chữ khớp lọc trong log | nền `--color-warning`, chữ `--color-bg` (kế thừa `mark` dùng chung với C28/C29) |
| Chữ mô tả file lớn | `--text-base` (thân), `--color-text-muted` |
| Đệm vùng | `--space-xl` (ảnh/file lớn), `--space-xs` `--space-sm` (thanh lọc log) |
| Bo góc khung ảnh | `--radius` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| ảnh | Không có thanh lọc, chỉ khung + nút tải xuống |
| log | Có thanh lọc + nền `--term-*` thay vì `--color-*` |
| quá lớn | Không hiện nội dung file, chỉ câu giải thích + hai nút |

## Tiếp cận (a11y)

- Khung ảnh giữ chỗ cần `alt`/`aria-label` mô tả tên file thật (prototype đang hiển thị icon placeholder, pha I phải render `<img>` thật với `alt`).
- Bộ lọc mức log (Tất cả/ERROR/WARN) là `.seg` — giữ `aria-pressed`/`role="group"` như mọi `.seg` khác trong kho.
- Nút Theo dõi có `aria-pressed` phản ánh bật/tắt.
- Nội dung log dùng `--font-mono`, `--text-xs` — đủ tương phản theo cặp "Terminal" ở `DESIGN-SYSTEM.md §3`.
- File quá lớn: hai nút phải có nhãn rõ ràng, không chỉ icon (đây không thuộc nhóm thao tác developer quen tay được phép chỉ-icon).

## Không được làm

- Không mở ảnh/log/file quá lớn vào vùng `contenteditable` của C17 — ba trạng thái này luôn thay thế hoàn toàn vùng code, không bao giờ cho gõ.
- Không tự động tải hết log dài hàng trăm nghìn dòng vào DOM — log theo dõi chỉ giữ cửa sổ gần nhất (pha I quyết định số dòng tối đa, ghi 1 dòng `DECISIONS.md` nếu khác 200 dòng mặc định ở S7 §Nhật ký).
- Không thêm nút "Sửa" cho file quá lớn — vượt giới hạn 10MB đã chốt, không có đường vòng.
