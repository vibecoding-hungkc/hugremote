---
type: design-system
tier: T0
status: ACTIVE
last_reviewed: "2026-11-22"
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

> **hugremote: một gói — `intake/design-systems/hugremote/`** (lập 2026-11-22). `tokens.json` là nguồn của
> §2 (53 token, gate đối chiếu từng giá trị); `components/c<NN>-….md` là nguồn của §4 (mỗi dòng một file:
> giải phẫu, trạng thái, token, biến thể, a11y, props pha I); ảnh chuẩn ở `screens/`; trang mẫu sống là
> `prototype/hugremote/index.html#/_ds`. File này là bản dịch — lệch gói thì gói thắng.

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
| Cố tình tránh | Bảy bề mặt điều hướng của v1 (header 2 hàng + dock + sidebar + panel nhanh); nút chỉ có icon cho hành động developer **không** nhận ra ngay (icon chỉ dùng cho thao tác quen tay của developer: lưu file, fetch/pull/push, stage/unstage, bỏ thay đổi, sao chép, tải lên/xuống, gửi, dừng, đóng, sửa, chia ô — luôn kèm tooltip + `aria-label`); mỗi màn một sắc xám; chữ 10–11px; terminal bảng màu lệch phần còn lại |

## 2. Token

> **Dịch từ `intake/design-systems/hugremote/tokens.json`** (nhóm `color.*`, `light.*`, `term.*`, `font.*`,
> `text.*`, `space.*` và các token đơn) — 53 token, đúng tên và giá trị.
>
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
| `--bar-h` | `36px` | chiều cao thanh trên, thanh tab phiên/file, đầu editor trên desktop ≥1024 (gọn kiểu Orca) |
| `--bar-h-touch` | `44px` | chiều cao các thanh đó dưới 1024px (cảm ứng) và thanh dưới mobile — bằng vùng chạm tối thiểu |

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
| Tối — dòng diff thêm trên thẻ | `--color-success` | `--color-surface` | thường |
| Tối — dòng diff xoá trên thẻ | `--color-danger` | `--color-surface` | thường |
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
| Sáng — dòng diff thêm trên thẻ | `--light-success` | `--light-surface` | thường |
| Sáng — dòng diff xoá trên thẻ | `--light-danger` | `--light-surface` | thường |
| Terminal — chữ | `--term-text` | `--term-bg` | thường |
| Terminal — xám | `--term-muted` | `--term-bg` | thường |
| Terminal — xanh lá | `--term-green` | `--term-bg` | thường |
| Terminal — xanh dương | `--term-blue` | `--term-bg` | thường |
| Terminal — vàng | `--term-yellow` | `--term-bg` | thường |
| Terminal — đỏ | `--term-red` | `--term-bg` | thường |

## 4. Kho component

> **Dịch từ gói `intake/design-systems/hugremote/components/`** — mỗi dòng một file (bấm tên để mở đặc tả đủ:
> giải phẫu, token, biến thể, a11y, hiện thực prototype, props pha I). Tên và trạng thái bắt buộc lấy nguyên từ
> mục "Trạng thái" (cột Bắt buộc ✓) của file; lệch thì file gói thắng. Mỗi mục có ô mẫu ở
> `prototype/hugremote/index.html#/_ds`. C22 (ô soạn cũ) đã bỏ, thay bằng C36 — mã không dùng lại.
> Danh sách **đóng**: cần khối mới → thêm file vào gói + 1 dòng ở đây + 1 dòng `DECISIONS.md`.

| # | Component | Dùng ở màn | Trạng thái bắt buộc |
|---|---|---|---|
| C1 | [Nút](../intake/design-systems/hugremote/components/c01-nut.md) | S1, S3, S4, S5, S6, S7, S8, S9, S10 | mặc định · focus · đang gửi · bị vô hiệu |
| C2 | [Trường nhập](../intake/design-systems/hugremote/components/c02-truong-nhap.md) | S1, S3, S7, S9 | rỗng · đang gõ · sai · bị vô hiệu |
| C3 | [Hàng danh sách](../intake/design-systems/hugremote/components/c03-hang-danh-sach.md) | S3, S5, S7, S8, S9 | mặc định · đang chọn · đang tải |
| C4 | [Khối trạng thái rỗng](../intake/design-systems/hugremote/components/c04-khoi-trang-thai-rong.md) | S2, S3, S5, S6, S8, S9, S10 | một câu + đúng một nút hành động |
| C5 | [Khối báo lỗi](../intake/design-systems/hugremote/components/c05-khoi-bao-loi.md) | S1, S2, S3, S5, S6, S8, S9, S10 | nguyên nhân + làm gì tiếp · Thử lại · giữ dữ liệu đang nhập |
| C6 | [Sheet](../intake/design-systems/hugremote/components/c06-sheet.md) | S3 | mở · đang lưu · lỗi lưu |
| C7 | [Breadcrumb phạm vi](../intake/design-systems/hugremote/components/c07-breadcrumb-pham-vi.md) | S2, S5, S6, S8 | thường · rút gọn giữa khi quá dài |
| C8 | [Thanh phiên](../intake/design-systems/hugremote/components/c08-thanh-phien.md) | S6, S10 | tab đang xem · tab khác · tab đã kết thúc · menu + mở · vạch chia đang kéo |
| C9 | [Hộp thoại](../intake/design-systems/hugremote/components/c09-hop-thoai.md) | S2, S3, S4, S6, S7, S8, S10 | mở · đang xử lý · biến thể cảnh báo đỏ · đổi tên (Enter lưu, Esc huỷ, an toàn IME) |
| C10 | [Thanh phím cảm ứng terminal](../intake/design-systems/hugremote/components/c10-thanh-phim-cam-ung-terminal.md) | S6 | thu gọn · mở rộng · Ctrl đang giữ |
| C11 | [Hàng cây](../intake/design-systems/hugremote/components/c11-hang-cay.md) | S2 | thu/mở · đang chọn · máy lỗi · phiên đang chạy · phiên cần duyệt · phiên xong · phiên đã kết thúc · dự án chưa có phiên · đang tải |
| C12 | [Thanh dưới mobile](../intake/design-systems/hugremote/components/c12-thanh-duoi-mobile.md) | S2, S3, S7 | mục đang xem · mục khác |
| C13 | [Dải kết nối](../intake/design-systems/hugremote/components/c13-dai-ket-noi.md) | S2, S6, S8, S9, S10 | đang thử lại · đã nối lại |
| C14 | [Huy hiệu trạng thái](../intake/design-systems/hugremote/components/c14-huy-hieu-trang-thai.md) | S2, S3, S6, S7, S9, S10 | đang chạy · cần duyệt · xong · đã kết thúc · kết nối được · lỗi · đang nối |
| C15 | [Thanh trên](../intake/design-systems/hugremote/components/c15-thanh-tren.md) | S2, S6, S8, S9, S10 | desktop · mobile (nút ← khi ở trong dự án/phiên) |
| C16 | [Thanh tab dự án](../intake/design-systems/hugremote/components/c16-thanh-tab-du-an.md) | S2, S6, S8, S9, S10 | tab đang xem · tab có huy hiệu (Phiên: số Claude cần duyệt; Git: số thay đổi) |
| C17 | [Editor](../intake/design-systems/hugremote/components/c17-editor.md) | S8, S6, S10 | xem · sửa · chưa lưu (chấm màu trên tên tab, không huy hiệu) · đang lưu · xem trước Markdown/HTML · vạch dòng mới (`--color-success`) / đã sửa (`--color-primary`) ở cột số dòng · dòng được nhảy tới tô `--color-surface-raised` · không gộp ký tự (`=>` không thành mũi tên) |
| C18 | [Khối diff](../intake/design-systems/hugremote/components/c18-khoi-diff.md) | S9, S10 | thêm · xoá · ngữ cảnh · thu gọn khi dài |
| C19 | [Tin nhắn chat](../intake/design-systems/hugremote/components/c19-tin-nhan-chat.md) | S10 | đang stream (con trỏ nháy) · xong · đã dừng · lỗi |
| C20 | [Thẻ công cụ](../intake/design-systems/hugremote/components/c20-the-cong-cu.md) | S10 | đang chạy · xong · lỗi |
| C21 | [Thẻ duyệt quyền / câu hỏi của Claude](../intake/design-systems/hugremote/components/c21-the-duyet-quyen.md) | S10 | chờ (viền `--color-warning`) · đã cho phép · đã từ chối · đã trả lời trên thiết bị khác |
| C23 | [Menu nổi](../intake/design-systems/hugremote/components/c23-menu-noi.md) | S2, S6, S7, S10 | đóng · mở · mục nguy hiểm (Bỏ, Xoá, Bypass — chữ đỏ) |
| C24 | [Hộp chuyển nhanh / mở nhanh file](../intake/design-systems/hugremote/components/c24-hop-chuyen-nhanh-mo-nhanh-file.md) | S11, S12 | rỗng (gợi ý: phiên cần bạn / file đang mở + vừa đổi) · có kết quả · không thấy · đang tìm |
| C25 | [Thanh tiến độ](../intake/design-systems/hugremote/components/c25-thanh-tien-do.md) | S7, S8 | đang chạy · xong · lỗi (nút Thử lại) |
| C26 | [Thẻ "Bắt đầu"](../intake/design-systems/hugremote/components/c26-the-bat-dau.md) | S2 | bước chưa làm · bước hiện tại (đậm, một nút chính) · bước đã xong (dấu ✓, tính theo dữ liệu thật) · ẩn khi xong cả 3 |
| C27 | [Toast](../intake/design-systems/hugremote/components/c27-toast.md) | S3, S8, S9, S10 | hiện 2,4 giây rồi tự ẩn · không chặn thao tác |
| C28 | [Thanh tìm/thay trong file](../intake/design-systems/hugremote/components/c28-thanh-tim-thay.md) | S8 | đóng · mở · có kết quả · không có kết quả |
| C29 | [Kết quả tìm trong dự án](../intake/design-systems/hugremote/components/c29-ket-qua-tim-du-an.md) | S8 | gợi ý (chưa đủ 2 ký tự) · có kết quả · không thấy · đang tìm · biểu thức chính quy sai |
| C30 | [Dải báo trong editor](../intake/design-systems/hugremote/components/c30-dai-bao-editor.md) | S8 | hiện · đã đóng |
| C31 | [Khung xem file đặc biệt](../intake/design-systems/hugremote/components/c31-khung-xem-file-dac-biet.md) | S8 | ảnh · log (Theo dõi bật/tắt) · quá lớn (Xem 1.000 dòng cuối / Tải xuống) |
| C32 | [Bộ chọn phiên trên mobile](../intake/design-systems/hugremote/components/c32-bo-chon-phien-mobile.md) | S6, S10 | đóng · mở · phiên cần duyệt có chấm vàng |
| C33 | [Dòng tóm tắt cuối lượt Claude](../intake/design-systems/hugremote/components/c33-dong-tom-tat-cuoi-luot.md) | S10 | có file đổi · không đổi file |
| C34 | [Tin nhắn xếp hàng](../intake/design-systems/hugremote/components/c34-tin-nhan-xep-hang.md) | S10 | đang chờ · đã gửi |
| C35 | [Danh sách quản trị](../intake/design-systems/hugremote/components/c35-danh-sach-quan-tri.md) | S7 | có dữ liệu · rỗng |
| C36 | [Ô soạn Claude gọn](../intake/design-systems/hugremote/components/c36-o-soan-claude-gon.md) | S10 | trống · đang gõ · Claude đang chạy (có Dừng; Gửi vẫn bật → tin xếp hàng C34, không có trạng thái khoá vì bận) · đang ghi âm · gợi ý `/` mở · Bypass (biểu tượng ⚠ đỏ) · mất kết nối (Gửi khoá) |
| C37 | [Chế độ gọn của hội thoại Claude](../intake/design-systems/hugremote/components/c37-che-do-gon-hoi-thoai.md) | S10 | bật · tắt |
| C38 | [Nút thông báo (chuông)](../intake/design-systems/hugremote/components/c38-nut-thong-bao.md) | S6, S10, S8, S9 | không có gì · có phiên cần duyệt (chuông tô `--color-primary` + số) · vừa duyệt (dòng biến mất) · mất kết nối (✓/✗ khoá) |

## 5. Ba khuôn trạng thái dùng chung

| Khuôn | Chốt |
|---|---|
| Rỗng | C4 giữa vùng nội dung: một câu nói vì sao trống, chữ `--text-base` `--color-text-muted`, đúng một nút C1 chính mở việc đầu tiên ("Thêm máy", "Mở terminal", "Hỏi Claude", "Dự án mới"). Khối con rỗng nằm trong vùng đã có hành động chính (vd "Không thấy…" của C29) dùng biến thể phụ *chỉ thông tin* của C4 — không nút |
| Lỗi | **Mỗi màn chỉ một khuôn lỗi**, hành động khắc phục nằm trong khối. C5: dòng đầu nói chuyện gì xảy ra bằng ngôn ngữ đang chọn (từ `errors.<CODE>`), dòng hai nói làm gì tiếp; nút Thử lại (hoặc hành động khắc phục đúng ngữ cảnh); ô nhập giữ nguyên giá trị; lỗi mạng toàn cục dùng C13 thay vì C5 |
| Đang tải | Khung xám `--color-surface-raised` đúng kích thước hàng/khối sắp hiện (3 hàng cho danh sách), không spinner toàn màn, không nhảy layout |

## 6. Ràng buộc thực thi

Năm ràng buộc này là thứ biến file trên thành hiệu lực thật, không phải bảng trang trí:

1. **`prototype/hugremote/index.html` khai đúng token ở §2 trong `:root` và dùng qua `var(--…)`.**
   `gate.py V` đối chiếu từng token: khai mà không dùng → đỏ. Không hardcode màu/cỡ chữ trong
   prototype.
2. **Pha I dùng lại chính bảng token này** — `apps/web/src/styles/tokens.css` sinh từ
   `intake/design-systems/hugremote/tokens.json`, Tailwind 4 `@theme` đọc các biến đó, theme xterm lấy `--term-*`.
   UI code không được đẻ ra giá trị mới.
3. **Đổi token sau khi Authority đã chốt prototype** → sửa gói `tokens.json` trước, dịch lại §2, 1 dòng
   `DECISIONS.md` (luật #3). Token là thứ Authority đã bấm thử và chốt, không phải chi tiết nội bộ của người code.
4. **Từ pha I trở đi, `guard_ds.py` chỉ soi `prototype/**` và file này** — code trong `srcroot/` được canh bằng
   test so ảnh (ràng buộc 5) và thẻ vai `picky` đo trên **app đã render**.
5. **Pha I dựng component trước màn hình** (G-16): `apps/web/src/components/ui/` mỗi C<n> một file theo đặc
   tả gói; route dev `#/_ds` dựng lại trang mẫu prototype; test Playwright so ảnh từng mục với
   `intake/design-systems/hugremote/screens/` chạy trong `make check` — lệch giao diện bị bắt ngay lúc
   kiểm tra, không đợi tới dogfood. Màn hình chỉ lắp từ `components/ui`, không style riêng.

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
| 2026-11-22 | Lập gói `intake/design-systems/hugremote/` (tokens.json khớp §2, 37 file component, ảnh `screens/`) + trang mẫu `#/_ds`; §6 thêm ràng buộc 5 | Phản hồi lượt 8: "không có DS thì pha I có đạt UI như prototype không" |
| 2026-11-22 | `--bar-h` 48→36px (desktop) + token mới `--bar-h-touch` 44px (<1024px); nút Lưu file chỉ còn icon; C17 bỏ huy hiệu "chưa lưu" (chấm trên tab là đủ) | Phản hồi lượt 9: "thanh tab session và header cao quá; nút lưu vẫn còn label; badge chưa lưu không cần" |
| 2026-11-22 | §2 và §4 ghi rõ là bản dịch của gói; §4 dịch lại từ 37 file component (tên + trạng thái bắt buộc lấy nguyên file, mỗi dòng có liên kết); C4/C5/C7/C9 chỉnh ở gói cho khớp trạng thái đã chốt; §3 thêm 4 cặp dòng diff trên thẻ; §5 thêm biến thể *chỉ thông tin* của C4; §6 ràng buộc 2–4 trỏ về gói | Authority: "cập nhật lại context theo ds" |
