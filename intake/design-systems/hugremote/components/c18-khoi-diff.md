# C18 — Khối diff

| Field | Value |
|---|---|
| Mã | C18 |
| Nhóm | hiển thị |
| Mục đích | Cho thấy chính xác dòng nào thêm/xoá giữa hai phiên bản (so với commit, hoặc giữa hai commit trong lịch sử) |
| Màn hình dùng | S9, S10 |
| Hiện thực prototype | class `.diff` (mono, `line-height:1.55`) chứa các `div` con biến thể `.a` (thêm, chữ `--color-success`, nền `--color-surface`), `.d` (xoá, chữ `--color-danger`, nền `--color-surface`), `.h` (dòng `@@` hunk header, `--color-text-muted`), dòng thường không class (ngữ cảnh); hàm `diffView()` parse chuỗi diff theo ký tự đầu dòng (`+`/`-`/`@@`). Dùng lại y nguyên ở Files (xem thay đổi so với commit), Git (thay đổi + lịch sử) và từ chip file trong tóm tắt lượt Claude (S10) |
| Hiện thực pha I | `srcroot/boundaries/hugremote/apps/web/src/components/ui/DiffView.tsx` — props: `hunks: { type: 'add'\|'del'\|'context'\|'hunk-header'; lineNo?: number; text: string }[]; collapsedContext?: boolean` |

## Giải phẫu

Chuỗi dòng đơn cột, mỗi dòng là [nội dung dòng kèm ký hiệu `+`/`-`/khoảng trắng đứng đầu giữ nguyên trong text, mono]. Không có cột số dòng riêng (số dòng nằm trong nội dung hunk header `@@ -a,b +c,d @@`). Cuộn dọc độc lập với phần còn lại của màn.

## Trạng thái

| Trạng thái | Bắt buộc? | Trông thế nào / hành vi |
|---|:--:|---|
| thêm | ✓ | `.a`: chữ `--color-success`, nền `--color-surface` phủ cả dòng |
| xoá | ✓ | `.d`: chữ `--color-danger`, nền `--color-surface` phủ cả dòng |
| ngữ cảnh | ✓ | Dòng không tô nền/màu, chữ `--color-text` mặc định — gồm cả dòng thường và hunk header (`.h`, chữ `--color-text-muted`) |
| thu gọn khi dài | ✓ | **Chưa hiện thực trong prototype** — `diffView()` luôn in hết toàn bộ nội dung diff, không gấp bớt ngữ cảnh hay khối dài; `.diff` chỉ dựa `overflow:auto` để cuộn. Pha I phải tự thêm: gấp đoạn ngữ cảnh dài (ví dụ >6 dòng không đổi liên tiếp) thành một dòng "⋯ n dòng không đổi — bấm để mở" (xem phát hiện ở báo cáo cuối) |

## Token dùng

| Vị trí | Token |
|---|---|
| Chữ thêm | `--color-success` |
| Chữ xoá | `--color-danger` |
| Chữ ngữ cảnh / hunk | `--color-text` `--color-text-muted` |
| Nền phủ dòng đổi | `--color-surface` |
| Nền vùng diff | `--color-bg` |
| Font | `--font-mono` |
| Cỡ chữ | `--text-sm` |
| Đệm ngang dòng | `--space-md` |

## Biến thể

| Biến thể | Khác gì bản mặc định |
|---|---|
| — | Một bố cục duy nhất (cột đơn); dùng y nguyên trong panel Files, panel Git và khi mở từ tóm tắt lượt Claude |

## Tiếp cận (a11y)

`.diff` có `tabindex="0"` để cuộn bằng bàn phím khi focus. Không dùng màu làm kênh duy nhất phân biệt thêm/xoá — ký hiệu `+`/`-` vẫn giữ nguyên trong nội dung dòng nên trình đọc màn hình vẫn đọc được. Cặp tương phản chữ thêm/xoá trên nền `--color-surface` chưa có hàng riêng trong `DESIGN-SYSTEM.md §3` — cần tự kiểm AA ở pha I (xem phát hiện ở báo cáo cuối).

## Không được làm

- Không bỏ ký hiệu `+`/`-`/khoảng trắng đầu dòng dù đã tô màu nền — người mù màu và trình đọc màn hình cần nó.
- Không tự thêm cột số dòng riêng ngoài những gì đã có trong hunk header.
- Không dùng C18 cho so sánh hai bản chưa commit cùng lúc (đó là khối `.cmp` riêng của C17 — hai cột song song, khác bố cục một cột của C18).
