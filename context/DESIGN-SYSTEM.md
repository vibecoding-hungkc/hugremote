---
type: design-system
tier: T0
status: ACTIVE
last_reviewed: "2026-11-21"
---

# DESIGN SYSTEM — hugremote

> **Nguồn sự thật cho hình thức** — ngang vai với `ARCHITECTURE.md` cho backend và
> `PROTOTYPE.md` cho kiến trúc thông tin.
> Điền ở pha V, SAU khi viết context, **TRƯỚC khi dựng prototype** (`PROTOTYPE.md §4`).
>
> **Vì sao trước prototype, không phải sau.** Dựng prototype trước rồi mới rút token ra thì
> token chỉ là bản mô tả những màu đã lỡ chọn — mỗi màn một sắc xám khác nhau, chữ phụ không
> đọc nổi, pha I phải đoán lại. Quyết thang màu/chữ/nhịp trước thì prototype chỉ còn là việc
> lắp component, và Authority bấm thử đúng thứ sẽ lên production.
>
> **Có gói design system từ intake** (`intake/design-systems/<ds>/tokens.json`) thì file này
> là **bản dịch trung thành của gói đó**, không phải chỗ chọn lại: không bịa token mới, không
> bỏ rơi token của gói, không đổi giá trị. Hook `scripts/guard_ds.py` chặn ngay lúc ghi file
> và `gate.py V` đối chiếu lại toàn bộ. Cần token mới thật sự → hỏi Authority (đang pha V)
> rồi ghi 1 dòng `DECISIONS.md`.

<!-- DỰ ÁN KHÔNG CÓ GIAO DIỆN NGƯỜI DÙNG (API thuần / CLI / worker):
     `PROTOTYPE.md` đã mang marker `KHÔNG CÓ UI` thì gate bỏ qua luôn file này.
     Xoá toàn bộ nội dung từ §1 trở xuống, thay bằng đúng một dòng:

         KHÔNG CÓ UI — bỏ qua design system

     để file không nằm lại với khung rỗng gây hiểu nhầm. -->

---

## 0. Sản phẩm này có mấy design system

**Một** — mặc định, và là trường hợp của cả đường phỏng vấn. Không phải khai gì thêm;
mọi bảng dưới đây không cần cột `DS`.

**Nhiều** — hệ lớn ở đường intake có thể mặc nhiều gói (`intake/design-systems/<ds>/`),
ví dụ màn quản trị nội bộ và app cho khách hàng không dùng chung bảng màu. Khi đó:

1. **Ánh xạ experience → gói nằm ở [`ARCHITECTURE.md §2–§3`](ARCHITECTURE.md), cột
   `Design system`** — nguồn DUY NHẤT. Đừng chép bảng ánh xạ vào đây: hai bảng song
   song thì sớm muộn cũng lệch nhau mà không ai hay.
2. **Mọi bảng ở §2 · §3 · §4 phải thêm cột cuối `DS`**, giá trị là tên thư mục gói.
   Hai gói cùng khai `--color-primary` khác giá trị thì thành **hai dòng riêng** — đó
   là lý do có cột này, chứ không phải để trang trí.
3. `prototype/<experience>/index.html` **chỉ được dùng token của gói mình**. Mượn token
   gói khác là *trộn design system*: hook `guard_ds.py` chặn lúc ghi, `gate.py V` báo đỏ,
   và thẻ vai `picky` bắt lại trên app đã chạy khi dogfood.

<!-- Bỏ trống ô DS trong khi dự án có nhiều gói → gate V đỏ ("token chưa khai thuộc
     design system nào"). Fail-closed có chủ đích: đối chiếu sai địa chỉ còn tệ hơn
     không đối chiếu. -->

---

## 1. Ba tính từ + neo tham chiếu

| Mục | Nội dung |
|---|---|
| Ba tính từ | **Yên · Dày thông tin · Một lối tới** — tối (có chủ đề sáng), ít màu, nhiều thứ thấy cùng lúc nhưng mỗi thứ chỉ có một chỗ để bấm |
| Neo tham chiếu (thật) | **Orca (orca.dev)** — Authority chốt theo bố cục: thanh bên cây repo/worktree/agent có chấm trạng thái + thời gian, vùng chính tab + chia ô, chủ đề tối "quiet dark". **HugRemote v1** — giữ phong cách: đơn sắc tối, màu nhấn theo khu vực (Files/Git xanh, Terminal tím, Claude đất nung), mobile-first với thanh phím cảm ứng |
| Cố tình tránh | Bảy bề mặt điều hướng của v1 (header 2 hàng + dock + sidebar + panel nhanh); nút chỉ có icon cho hành động developer **không** nhận ra ngay (icon chỉ dùng cho thao tác quen tay của developer: fetch/pull/push, stage/unstage, bỏ thay đổi, sao chép, tải lên/xuống, gửi, dừng, đóng, sửa, chia ô — luôn kèm tooltip + `aria-label`); mỗi màn một sắc xám; chữ 10–11px; terminal bảng màu lệch phần còn lại |

## 2. Token

> **Hai chủ đề, một bộ tên.** Component chỉ dùng token semantic `--color-*`. Chủ đề tối là giá trị mặc định
> trong `:root`; chủ đề sáng khai ở các token `--light-*` và được **gán lại** cho token semantic khi
> `data-theme="light"` (`:root[data-theme="light"] { --color-bg: var(--light-bg); … }`) — không component nào
> dùng thẳng `--light-*`. Terminal giữ nền tối ở cả hai chủ đề, dùng bộ `--term-*` riêng (cũng là theme của xterm).

### 2.1 Màu

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--color-bg` | `#141414` | nền trang, vùng chính; chữ trên nút nguy hiểm |
| `--color-surface` | `#1c1c1c` | thanh bên, thẻ, sheet, thanh tab, thanh dưới, bong bóng chat |
| `--color-surface-raised` | `#262626` | hàng đang chọn/hover, ô nhập, nút phụ, khối code |
| `--color-divider` | `#2a2a2a` | đường kẻ chia vùng (trang trí, không mang nghĩa) |
| `--color-border` | `#6b6b6b` | viền ô nhập, viền nút phụ — thành phần cần thấy rõ |
| `--color-text` | `#ededed` | chữ chính |
| `--color-text-muted` | `#a3a3a3` | chữ phụ, nhãn, thời gian, đường dẫn |
| `--color-primary` | `#38bdf8` | hành động chính, liên kết, focus, mục đang chọn; màu khu vực Files/Git; chấm **đang chạy** (nhấp nháy) |
| `--color-on-primary` | `#0b1620` | chữ trên nền `--color-primary` |
| `--color-danger` | `#f87171` | lỗi, xoá, host key đổi, dòng diff bị xoá |
| `--color-success` | `#34d399` | **xong**, kết nối được, dòng diff thêm |
| `--color-warning` | `#fbbf24` | đang nối / thử lại, Claude **cần duyệt**, Bypass |
| `--color-accent-terminal` | `#c084fc` | biểu tượng phiên terminal (màu khu vực HugRemote) |
| `--color-accent-claude` | `#d97757` | biểu tượng phiên Claude, tên "Claude" trong chat (màu khu vực HugRemote) |
| `--color-scrim` | `#000000a6` | lớp phủ sau hộp thoại / sheet / hộp chuyển nhanh |
| `--light-bg` | `#fafafa` | chủ đề sáng → `--color-bg` |
| `--light-surface` | `#ffffff` | chủ đề sáng → `--color-surface` |
| `--light-surface-raised` | `#f0f0f0` | chủ đề sáng → `--color-surface-raised` |
| `--light-divider` | `#e5e5e5` | chủ đề sáng → `--color-divider` |
| `--light-border` | `#8a8a8a` | chủ đề sáng → `--color-border` |
| `--light-text` | `#171717` | chủ đề sáng → `--color-text` |
| `--light-text-muted` | `#525252` | chủ đề sáng → `--color-text-muted` |
| `--light-primary` | `#0369a1` | chủ đề sáng → `--color-primary` |
| `--light-on-primary` | `#ffffff` | chủ đề sáng → `--color-on-primary` |
| `--light-danger` | `#b91c1c` | chủ đề sáng → `--color-danger` |
| `--light-success` | `#047857` | chủ đề sáng → `--color-success` |
| `--light-warning` | `#a16207` | chủ đề sáng → `--color-warning` |
| `--light-accent-terminal` | `#7e22ce` | chủ đề sáng → `--color-accent-terminal` |
| `--light-accent-claude` | `#c2410c` | chủ đề sáng → `--color-accent-claude` |
| `--term-bg` | `#0f0f0f` | nền terminal (cả hai chủ đề) |
| `--term-text` | `#ededed` | chữ terminal |
| `--term-muted` | `#a3a3a3` | ANSI xám |
| `--term-green` | `#34d399` | ANSI xanh lá |
| `--term-blue` | `#38bdf8` | ANSI xanh dương |
| `--term-yellow` | `#fbbf24` | ANSI vàng |
| `--term-red` | `#f87171` | ANSI đỏ |

### 2.2 Chữ

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--font-sans` | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | chữ giao diện — font hệ thống, đủ dấu tiếng Việt |
| `--font-mono` | `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | terminal, editor, diff, đường dẫn, vân tay, mã 2FA |
| `--text-xs` | `12px` | thời gian, huy hiệu, chú thích |
| `--text-sm` | `14px` | hàng cây, nhãn, terminal, editor, diff |
| `--text-base` | `16px` | chữ thường, chat, ô nhập (16px để iOS không tự phóng to) |
| `--text-xl` | `20px` | tiêu đề màn |

### 2.3 Nhịp · bo góc · đổ bóng

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--space-xs` | `4px` | giữa chấm trạng thái và chữ, trong huy hiệu |
| `--space-sm` | `8px` | khoảng hẹp trong một khối |
| `--space-md` | `12px` | đệm hàng, đệm nút |
| `--space-lg` | `16px` | khoảng chuẩn giữa các khối |
| `--space-xl` | `24px` | khoảng giữa các vùng lớn, lề màn |
| `--radius` | `8px` | nút, thẻ, ô nhập, sheet, bong bóng chat — một giá trị dùng chung |
| `--radius-pill` | `999px` | chấm trạng thái, huy hiệu |
| `--shadow` | `0 8px 24px #00000066` | sheet, hộp thoại, menu nổi, hộp chuyển nhanh (một mức) |
| `--tap` | `44px` | chiều cao tối thiểu vùng chạm |
| `--sidebar-w` | `280px` | độ rộng thanh bên desktop (kéo được 220–440) |
| `--bar-h` | `48px` | chiều cao thanh trên, thanh tab, thanh dưới |

### 2.4 Điểm gãy

| Điểm gãy | Giá trị | Thiết kế trước cho |
|---|---|---|
| hẹp → vừa | `768px` | điện thoại trước (P-MOBILE): dưới mốc này cây toàn màn + thanh dưới, chia ô tắt |
| vừa → rộng | `1024px` | desktop hạng nhất (P-DESK): từ mốc này thanh bên cố định + vùng chính tab/chia ô; 768–1023 thanh bên trượt ra phủ lên |

## 3. Tương phản — `gate.py V` tự tính

| Cặp | Token chữ / tiền cảnh | Token nền | Loại |
|---|---|---|---|
| Tối — chữ chính trên nền trang | `--color-text` | `--color-bg` | thường |
| Tối — chữ chính trên hàng đang chọn | `--color-text` | `--color-surface-raised` | thường |
| Tối — chữ phụ trên nền thẻ | `--color-text-muted` | `--color-surface` | thường |
| Tối — chữ phụ trên hàng đang chọn | `--color-text-muted` | `--color-surface-raised` | thường |
| Tối — chữ trên nút chính | `--color-on-primary` | `--color-primary` | thường |
| Tối — liên kết trên nền trang | `--color-primary` | `--color-bg` | thường |
| Tối — chữ lỗi trên nền trang | `--color-danger` | `--color-bg` | thường |
| Tối — chữ trên nút nguy hiểm | `--color-bg` | `--color-danger` | thường |
| Tối — chấm xong / kết nối được trên thẻ | `--color-success` | `--color-surface` | thành phần |
| Tối — chấm đang chạy trên thẻ | `--color-primary` | `--color-surface` | thành phần |
| Tối — chấm cần duyệt trên thẻ | `--color-warning` | `--color-surface` | thành phần |
| Tối — biểu tượng terminal | `--color-accent-terminal` | `--color-surface` | thành phần |
| Tối — chữ "Claude" trên thẻ | `--color-accent-claude` | `--color-surface` | thường |
| Tối — viền ô nhập trên nền trang | `--color-border` | `--color-bg` | thành phần |
| Tối — viền ô nhập trên thẻ | `--color-border` | `--color-surface` | thành phần |
| Sáng — chữ chính trên nền trang | `--light-text` | `--light-bg` | thường |
| Sáng — chữ chính trên hàng đang chọn | `--light-text` | `--light-surface-raised` | thường |
| Sáng — chữ phụ trên thẻ | `--light-text-muted` | `--light-surface` | thường |
| Sáng — chữ phụ trên hàng đang chọn | `--light-text-muted` | `--light-surface-raised` | thường |
| Sáng — chữ trên nút chính | `--light-on-primary` | `--light-primary` | thường |
| Sáng — liên kết trên nền trang | `--light-primary` | `--light-bg` | thường |
| Sáng — chữ lỗi trên nền trang | `--light-danger` | `--light-bg` | thường |
| Sáng — chữ trên nút nguy hiểm | `--light-bg` | `--light-danger` | thường |
| Sáng — chấm xong / kết nối được trên thẻ | `--light-success` | `--light-surface` | thành phần |
| Sáng — chấm đang chạy trên thẻ | `--light-primary` | `--light-surface` | thành phần |
| Sáng — chấm cần duyệt trên thẻ | `--light-warning` | `--light-surface` | thường |
| Sáng — biểu tượng terminal | `--light-accent-terminal` | `--light-surface` | thành phần |
| Sáng — chữ "Claude" trên thẻ | `--light-accent-claude` | `--light-surface` | thường |
| Sáng — viền ô nhập trên nền trang | `--light-border` | `--light-bg` | thành phần |
| Sáng — viền ô nhập trên thẻ | `--light-border` | `--light-surface` | thành phần |
| Terminal — chữ | `--term-text` | `--term-bg` | thường |
| Terminal — xám | `--term-muted` | `--term-bg` | thường |
| Terminal — xanh lá | `--term-green` | `--term-bg` | thường |
| Terminal — xanh dương | `--term-blue` | `--term-bg` | thường |
| Terminal — vàng | `--term-yellow` | `--term-bg` | thường |
| Terminal — đỏ | `--term-red` | `--term-bg` | thường |

## 4. Kho component

| # | Component | Dùng ở màn | Trạng thái bắt buộc |
|---|---|---|---|
| C1 | Nút (chính · phụ · nguy hiểm · chỉ biểu tượng có nhãn ẩn + tooltip — dùng cho thao tác developer quen: pull/push kèm số commit, +/− stage, ↶ bỏ thay đổi, sao chép, gửi, dừng) | S1, S3, S4, S5, S6, S7, S8, S9, S10 | mặc định · focus (vòng `--color-primary`) · đang gửi (khoá, chữ "Đang …") · bị vô hiệu |
| C2 | Trường nhập (chữ · mật khẩu · ô mã 6 số · ô chọn) | S1, S3, S7, S9 | rỗng · đang gõ · sai (viền + câu lỗi `--color-danger`) · bị vô hiệu |
| C3 | Hàng danh sách (biểu tượng · tiêu đề · dòng phụ · hành động cuối) | S3, S5, S7, S8, S9 | mặc định · đang chọn · đang tải (khung xám) |
| C4 | Khối trạng thái rỗng | S2, S3, S5, S6, S8, S9, S10 | một câu + đúng một nút hành động |
| C5 | Khối báo lỗi | S1, S2, S3, S5, S6, S8, S9, S10 | nguyên nhân + làm gì tiếp · Thử lại · giữ dữ liệu đang nhập |
| C6 | Sheet (mobile: từ đáy; desktop: panel phải 420px) | S3 | mở · đang lưu · lỗi lưu |
| C7 | Breadcrumb phạm vi (`máy › dự án`, đường dẫn) | S2, S5, S6, S8 | thường · rút gọn giữa khi quá dài |
| C8 | Thanh phiên: tab trộn Claude + terminal (Claude trước) · Đổi tên · Chia ô · **+** (menu chọn Phiên Claude mới / Terminal mới) | S6, S10 | tab đang xem · tab khác · tab đã kết thúc · menu + mở · vạch chia đang kéo |
| C9 | Hộp thoại (xác nhận · cảnh báo nguy hiểm · đổi tên hiển thị) | S2, S3, S4, S6, S7, S8, S10 | mở · đang xử lý · biến thể cảnh báo đỏ · đổi tên (Enter lưu, Esc huỷ, an toàn IME) |
| C10 | Thanh phím cảm ứng terminal + ngăn mở rộng | S6 | thu gọn · mở rộng · Ctrl đang giữ |
| C11 | Hàng cây (máy · dự án · phiên — Claude trước, terminal sau) có chấm trạng thái + thời gian rút gọn; chỉ hai nút: **+** (dự án) và **⋯** (mở C23) — hiện khi hover/chọn trên desktop, luôn hiện trên mobile; đầu cây có Thu gọn tất cả + Thêm máy | S2 | thu/mở · đang chọn · máy lỗi · phiên đang chạy / cần duyệt / xong / đã kết thúc · dự án chưa có phiên (dòng "tạo phiên") · đang tải |
| C12 | Thanh dưới mobile (3 mục có nhãn) | S2, S3, S7 | mục đang xem · mục khác |
| C13 | Dải kết nối (mất kết nối / đang thử lại lần n · Thử ngay) — khi hiện, mọi nút ghi (Gửi, ✓/✗, Lưu, Commit, Push/Pull, Cập nhật) chuyển trạng thái *bị vô hiệu* của C1 kèm tooltip "Đang mất kết nối"; nháp và bản sửa giữ nguyên | S2, S6, S8, S9, S10 | đang thử lại (thao tác ghi khoá) · đã nối lại (mở khoá, không tự gửi) |
| C14 | Huy hiệu trạng thái (chấm + nhãn) | S2, S3, S6, S7, S9, S10 | đang chạy (xanh dương nhấp nháy) · cần duyệt (viền + chữ cảnh báo trên nền thẻ) · xong (xanh lá) · đã kết thúc (xám) · kết nối được · lỗi · đang nối |
| C15 | Thanh trên (phạm vi C7 · tab dự án · tìm · cài đặt) | S2, S6, S8, S9, S10 | desktop · mobile (nút ← khi ở trong dự án/phiên) |
| C16 | Thanh tab dự án (Phiên · Files · Git) | S2, S6, S8, S9, S10 | tab đang xem · tab có huy hiệu (Phiên: số Claude cần duyệt; Git: số thay đổi) |
| C17 | Editor (CodeMirror) + tab file đang mở + thanh phím phụ lập trình | S8, S6, S10 | xem · sửa · chưa lưu (chấm ở tab + huy hiệu) · đang lưu · xem trước Markdown/HTML · vạch dòng mới (`--color-success`) / đã sửa (`--color-primary`) ở cột số dòng · dòng được nhảy tới tô `--color-surface-raised` · không gộp ký tự (`=>` không thành mũi tên) |
| C18 | Khối diff (dòng thêm/xoá, số dòng) | S9, S10 | thêm · xoá · ngữ cảnh · thu gọn khi dài |
| C19 | Tin nhắn chat (người dùng · Claude, suy nghĩ thu gọn được, Markdown) | S10 | đang stream (con trỏ nháy) · xong · đã dừng · lỗi |
| C20 | Thẻ công cụ (tên tool · tham số rút gọn · kết quả thu gọn) | S10 | đang chạy · xong · lỗi |
| C21 | Thẻ duyệt quyền / câu hỏi của Claude | S10 | chờ (viền `--color-warning`) · đã cho phép · đã từ chối · đã trả lời trên thiết bị khác |
| C23 | Menu nổi có mô tả (⋯ của hàng cây, + chọn Claude/Terminal, chia ô, model + effort, chế độ quyền) — vẽ ở lớp nổi, không bị vùng cuộn cắt | S2, S6, S7, S10 | đóng · mở · mục nguy hiểm (Bỏ, Xoá, Bypass — chữ đỏ) |
| C24 | Hộp chuyển nhanh / mở nhanh file (ô tìm + kết quả nhóm) | S11, S12 | rỗng (gợi ý: phiên cần bạn / file đang mở + vừa đổi) · có kết quả · không thấy · đang tìm |
| C25 | Thanh tiến độ (tải lên, cập nhật theo bước) | S7, S8 | đang chạy · xong · lỗi (nút Thử lại) |
| C26 | Thẻ "Bắt đầu" 3 bước | S2 | bước chưa làm · bước hiện tại (đậm, **một** nút chính) · bước đã xong (dấu ✓, tính theo dữ liệu thật) · ẩn khi xong cả 3 |
| C27 | Thông báo ngắn (toast) xác nhận việc vừa xong | S3, S8, S9, S10 | hiện 2,4 giây rồi tự ẩn · không chặn thao tác |
| C28 | Thanh tìm/thay trong file (Tìm · Thay bằng · số kết quả · Thay · Thay tất cả · Tới dòng) | S8 | đóng · mở · có kết quả (chữ khớp tô `--color-warning`) · không có kết quả |
| C29 | Kết quả tìm trong dự án (nhóm theo file, số dòng, chữ khớp tô sáng) | S8 | gợi ý (chưa đủ 2 ký tự) · có kết quả · không thấy · đang tìm |
| C30 | Dải báo trong editor (Claude vừa sửa file — đã tự tải lại · Xem thay đổi · Đóng) | S8 | hiện · đã đóng |
| C31 | Khung xem file đặc biệt (ảnh, log theo dõi, file quá lớn) | S8 | ảnh · log (Theo dõi bật/tắt) · quá lớn (Xem 1.000 dòng cuối / Tải xuống) |
| C32 | Bộ chọn phiên trên mobile (tên phiên hiện tại · số phiên · mở danh sách nhóm Claude/Terminal) thay dải tab | S6, S10 | đóng · mở · phiên cần duyệt có chấm vàng |
| C33 | Dòng tóm tắt cuối lượt Claude (thời gian · token · chi phí · file đã đổi bấm ra diff) | S10 | có file đổi · không đổi file |
| C34 | Tin nhắn xếp hàng (gửi khi Claude đang chạy — mờ, có Huỷ) | S10 | đang chờ · đã gửi |
| C35 | Danh sách quản trị (thiết bị đăng nhập · thành viên · lần SSO bị từ chối · nhật ký ứng dụng/cập nhật/SSH) | S7 | có dữ liệu · rỗng |
| C36 | Ô soạn Claude gọn — **thay C22** (ô soạn cũ đã bỏ; mã C22 để trống, không dùng lại) (một khung: hàng 1 ô nhập + mic + quyền; hàng 2 đính kèm · nút **gọn** (target) · Context token đã dùng/sức chứa (vd `227k/1000k`, không hiện %) · Hạn mức 5 giờ · Model + mức suy nghĩ · Quyền · Dừng/Gửi; cấu hình riêng từng phiên, ⇧Tab xoay chế độ quyền; mobile: dải chip trượt ngang) | S10 | trống · đang gõ · Claude đang chạy (có Dừng; Gửi vẫn bật → tin xếp hàng C34, không có trạng thái khoá vì bận) · đang ghi âm · gợi ý `/` mở · Bypass (biểu tượng ⚠ đỏ) · mất kết nối (Gửi khoá) |
| C37 | Chế độ gọn của hội thoại Claude: bật → chỉ hiện tin của bạn, trạng thái "Claude đang làm · <bước hiện tại>", kết quả, yêu cầu quyền và tóm tắt lượt; các bước công cụ gộp thành một dòng "n bước · sửa x file · chạy y lệnh" (bấm để xem đủ); tắt → toàn bộ suy nghĩ + thẻ công cụ | S10 | bật · tắt |
| C38 | Nút thông báo (chuông, số phiên cần duyệt) — đặt ở **thanh phiên C8** trên S6/S10 (thay nút danh sách cạnh Sửa/Chia ô) và ở **thanh trên C15** trên S8/S9 (cả mobile): mở danh sách nổi — mỗi phiên cần duyệt một dòng (tên phiên · yêu cầu · máy › dự án) có ✓ Cho phép / ✗ Từ chối ngay tại chỗ; bấm vào dòng là vào phiên; phiên vừa xong lượt hiện nhãn "xong"; cuối danh sách có "Tất cả phiên của dự án này"; nguồn dữ liệu: `events.v1` | S6, S10, S8, S9 | không có gì · có phiên cần duyệt (chuông tô `--color-primary` + số) · vừa duyệt (dòng biến mất) · mất kết nối (✓/✗ khoá) |

## 5. Ba khuôn trạng thái dùng chung

| Khuôn | Chốt |
|---|---|
| Rỗng | C4 giữa vùng nội dung: một câu nói vì sao trống, chữ `--text-base` `--color-text-muted`, đúng một nút C1 chính mở việc đầu tiên ("Thêm máy", "Mở terminal", "Hỏi Claude", "Dự án mới") |
| Lỗi | **Mỗi màn chỉ một khuôn lỗi**, hành động khắc phục nằm trong khối. C5: dòng đầu nói chuyện gì xảy ra bằng ngôn ngữ đang chọn (từ `errors.<CODE>`), dòng hai nói làm gì tiếp; nút Thử lại; ô nhập giữ nguyên giá trị; lỗi mạng toàn cục dùng C13 thay vì C5 |
| Đang tải | Khung xám `--color-surface-raised` đúng kích thước hàng/khối sắp hiện (3 hàng cho danh sách), không spinner toàn màn, không nhảy layout |

## 6. Ràng buộc thực thi

Bốn ràng buộc này là thứ biến file trên thành hiệu lực thật, không phải bảng trang trí:

1. **`prototype/index.html` khai đúng token ở §2 trong `:root` và dùng qua `var(--…)`.**
   `gate.py V` đối chiếu từng token: khai mà không dùng → đỏ. Không hardcode màu/cỡ chữ trong
   prototype.
2. **Pha I dùng lại chính bảng token này** — đổ vào biến CSS, `tailwind.config`, hay theme của
   stack đang dùng (`TECHSTACK.md`), tuỳ stack. UI code không được đẻ ra giá trị mới.
   Nhiều design system (§0) → mỗi experience đổ **đúng lát token của gói mình**, không đổ cả
   bảng vào một theme dùng chung: gộp lại là mở đường cho việc mượn token gói khác.
3. **Đổi token sau khi Authority đã chốt prototype** → 1 dòng `DECISIONS.md` (luật #3). Token là
   thứ Authority đã bấm thử và chốt, không phải chi tiết nội bộ của người code.
4. **Từ pha I trở đi, thứ canh design system là dogfood, không phải hook.** `guard_ds.py` chỉ
   soi `prototype/**` và file này; code trong `srcroot/` thì mỗi stack một kiểu (Tailwind,
   CSS-in-JS…) nên bắt "mã màu thô" ở đó sẽ báo oan. Thẻ vai `picky` (`/viper-dogfood`)
   đo trên **app đã render** — đúng với mọi stack, và là chỗ duy nhất chứng minh được pha I có
   thật sự dùng lại bảng token hay không.

## 7. Change log

| Ngày | Thay đổi | Lý do |
|---|---|---|
| 2026-11-21 | Tạo từ template VIPER | — |
| 2026-11-21 | Chốt design system vòng 1: bố cục Orca, màu HugRemote, chủ đề tối | Authority chọn ở pha V (DECISIONS 2026-11-21) |
| 2026-11-21 | Thêm chủ đề sáng (`--light-*`), màu Claude, bộ `--term-*`, component C16–C26 | Gộp 6 vòng (DECISIONS 2026-11-21) |
| 2026-11-21 | C8 tab phiên trộn + menu **+**; C16 còn Phiên · Files · Git; C9 thêm đổi tên; C11 có đổi tên | Phản hồi prototype lượt 1 của Authority |
| 2026-11-21 | C11 gọn (+ và ⋯), C23 menu nổi, C14 tách đang chạy/xong, C26 một nút chính, thêm C27 toast; vùng chạm ≥44px trên mobile | Phản hồi lượt 2 + vai newbie/picky |
| 2026-11-21 | C17 mở rộng (tab file, vạch dòng đổi), thêm C28–C31 cho làm việc với file kiểu developer; C24 dùng cho S12 | Phản hồi lượt 3: "thao tác với file chưa đủ để làm việc" |
| 2026-11-21 | Thêm C32 bộ chọn phiên mobile, C33 tóm tắt lượt, C34 tin xếp hàng, C35 danh sách quản trị; C1 thêm nút chỉ biểu tượng + tooltip; C8 có × và ⚠ Bypass | Phản hồi lượt 4 + vai power/mobile/operator |
| 2026-11-21 | C36 ô soạn gọn hai hàng **thay C22** (bỏ C22; bỏ trạng thái "khoá vì bận" — tin gửi khi đang chạy vào hàng chờ, DECISIONS D1); thêm C37 chế độ gọn | Phản hồi lượt 5 |
| 2026-11-21 | C36 chip Context hiện `a/b` token (`227k/1000k`), không % | Phản hồi lượt 6 |
| 2026-11-21 | Thêm C38 chuông thông báo (thanh phiên C8 ở S6/S10, thanh trên C15 ở S8/S9); C13 thêm trạng thái khoá thao tác ghi; xếp lại thứ tự C32..C38 | Phản hồi lượt 7 + rà soát reviewer (DECISIONS D4) |
