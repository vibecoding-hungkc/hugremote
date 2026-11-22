# C17 — Editor

| Field | Value |
|---|---|
| Mã | C17 |
| Nhóm | input |
| Mục đích | Xem và sửa trực tiếp nội dung file trên máy đích, biết ngay dòng nào Claude/mình vừa đổi so với commit |
| Màn hình dùng | S8, S6, S10 |
| Persona chạm tới | P-MOBILE, P-DESK |
| Hiện thực prototype | khung `.editor` gồm `.tabbar` (tab file đang mở, mỗi tab có `.dot.warn.dirtydot` khi chưa lưu + nút đóng), `.ehead` (tên file, đường dẫn `.fdir` rút gọn rtl, nút Tìm/thay, Xuống dòng, Xem trước (`.md`), Theo dõi (log), Xem thay đổi, Lưu chỉ icon `#savebtn` `.btn.sm.icon` — `ghost` khi sạch, `primary` khi có thay đổi chưa lưu), `.findbar` (C28), `.notice`/`.notice.danger` (C30/xung đột), thân `.codewrap` gồm `.gutter` (số dòng, lớp `.add`/`.mod` đánh dấu dòng đổi, `.hl` tô dòng nhảy tới) + `.code` (contenteditable khi sửa được, tô cú pháp qua `hlCode()` dùng span `.kw`/`.st`/`.cm`); xem trước Markdown dùng `.preview`; so sánh xung đột dùng `.cmp`; chế độ diff gọi lại C18 (`diffView()`); thanh phím phụ `.edkeys` (chỉ <768px). Hàm chính: `openFile(path,line)`, `syncFileRoute(r)`, `codeView(readonly)`, `fileBody()`, `onEdit(el)`, `gutter(path)`, `saveFile()`, `closeFile()` |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/CodeEditor.tsx` — props chính: `path: string; content: string; readOnly?: boolean; dirty: boolean; saving: boolean; highlightedLine?: number; addedLines: number[]; modifiedLines: number[]; previewMode?: 'code'\|'markdown'; onChange: (content: string) => void; onSave: () => void` |

## Giải phẫu

Thanh tab file đang mở (≥1 tab, mỗi tab: icon file → tên → chấm chưa lưu tuỳ chọn → nút đóng) → thanh đầu file `.ehead` (nút quay lại mobile tuỳ chọn → tên file bắt buộc → đường dẫn thư mục chứa, desktop → badge "chưa lưu" tuỳ chọn → cụm nút công cụ tuỳ chọn theo loại file → nút Lưu khi sửa được) → dải báo tuỳ chọn (C30/xung đột) → thanh tìm/thay tuỳ chọn (C28) → thân nội dung bắt buộc (cột số dòng + vùng code, hoặc xem trước/ảnh/log/quá lớn — xem C31) → thanh phím phụ tuỳ chọn (chỉ mobile, khi sửa được).

Ràng buộc bố cục không token: cột số dòng (`.gutter div`) rộng tối thiểu 44px *(trùng đúng giá trị `--tap` nhưng viết số thô, không `var(--tap)` — xem phát hiện ở báo cáo cuối)*; `.codewrap` cao bằng phần còn lại của khung dọc.

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| xem | ✓ | `readonly` (ô chia bên phải, hoặc file không sửa được: log/ảnh/quá lớn): `.code` không có `contenteditable` |
| sửa | ✓ | `.code[contenteditable="true"]`, `oninput` cập nhật buffer; chỉ khi file là text và không ở chế độ diff/so sánh |
| chưa lưu (chấm màu trên tên tab, không huy hiệu) | ✓ | Tab file: `.dot.warn.dirtydot` cạnh tên là chỉ báo **duy nhất** (Authority bỏ huy hiệu "chưa lưu" ở `.ehead` — lượt 9); nút Lưu chỉ icon đổi từ `ghost` sang `primary` để nhắc; cả hai bật/tắt theo `isDirty(path)` |
| đang lưu | ✓ | **Chưa có chỉ báo riêng trong prototype** — `saveFile()` ghi xong tức thì rồi hiện toast "Đã lưu …" (xem phát hiện); pha I phải khoá nút Lưu + đổi icon sang vòng xoay, tooltip "Đang lưu…" theo mẫu `sending()` của C1 trong lúc chờ phản hồi mạng |
| xem trước Markdown/HTML | ✓ | File `.md` bật xem trước: thân đổi sang `.preview` (nền `--color-bg`, không còn cột số dòng); nút chuyển Sửa/Xem trước ở `.ehead` |
| vạch dòng mới (`--color-success`) / đã sửa (`--color-primary`) ở cột số dòng | ✓ | `.gutter .add` (dòng mới so với commit), `.gutter .mod` (dòng đã sửa) — chỉ hiện khi chưa có sửa dở, tắt khi đang sửa |
| dòng được nhảy tới tô `--color-surface-raised` | ✓ | class `.hl` trên cả dòng gutter và dòng code tương ứng — dùng khi mở file kèm `:dòng` (kết quả tìm, link trong thẻ công cụ Claude, mở nhanh `tên:số`) |
| không gộp ký tự (`=>` không thành mũi tên) | ✓ | `font-variant-ligatures: none` trên vùng code — bắt buộc vì developer cần thấy đúng ký tự gõ |

## Token dùng

| Vị trí | Token |
|---|---|
| Nền vùng code / cột số dòng | `--color-bg` |
| Nền dải tab/ehead | `--color-surface` |
| Viền dưới | `--color-divider` |
| Chữ phụ (số dòng, đường dẫn) | `--color-text-muted` |
| Chữ chính | `--color-text` |
| Cảnh báo chưa lưu | `--color-warning` |
| Đánh dấu dòng mới | `--color-success` |
| Đánh dấu dòng sửa | `--color-primary` |
| Tô dòng nhảy tới | `--color-surface-raised` |
| Font | `--font-mono` |
| Cỡ chữ | `--text-sm` `--text-xs` |
| Đệm | `--space-sm` `--space-md` |
| Chiều cao thanh | `--bar-h` (36px desktop ≥1024; dưới 1024px gán lại `--bar-h-touch` 44px) |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| đầy đủ | Mặc định: tab + ehead + thân, sửa được |
| gọn trong ô chia | `readonly=true` khi mở ở ô chia bên phải (`withSplit`) — ẩn khả năng sửa, chỉ xem |
| xem trước Markdown | Thay cột số dòng + vùng code bằng văn bản đã dựng |

## Tiếp cận (a11y)

`.code` có `aria-label="Nội dung <path>"`. Cột số dòng `user-select:none` (không phải nội dung đọc, chỉ định vị). Cặp tương phản "chữ phụ trên nền thẻ" (`--color-text-muted`/`--color-surface`) cho đường dẫn. Nút Lưu (`⌘S`) và nút công cụ dùng mẫu C1 (title+aria-label). Vùng chạm nút công cụ ≥ `--tap` trên mobile.

## Không được làm

- Không bật `contenteditable` cho file log/ảnh/quá lớn/khi đang ở chế độ diff hoặc so sánh.
- Không bật ligature — `=>`, `===`… phải giữ nguyên ký tự gõ.
- Không xoá đánh dấu dòng mới/sửa khi chuyển sang chỉ-xem — giữ nguyên để dogfood vai `picky` vẫn kiểm được trên app đã render.
