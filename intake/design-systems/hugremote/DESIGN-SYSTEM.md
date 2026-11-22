---
type: design-system
design_system_id: "DS-HUGREMOTE"
status: "APPROVED"
version: 1.1
source: "in-house"
figma_file_key: ""
platforms: ["web", "mobile"]
owner_authority: "nguyenhung <nguyenhung96.work@gmail.com>"
last_reviewed: "2026-11-22"
---

# Design System — `hugremote`

> Bộ chuẩn UI dùng chung: tokens + components + screens. Dùng cho experience `hugremote`
> (`srcroot/boundaries/hugremote/apps/web`, web responsive — điện thoại + desktop).
> Nguồn token machine-readable: [`tokens.json`](tokens.json). Mỗi component một file trong
> [`components/`](components/) theo `_COMPONENT-TEMPLATE.md`.
>
> **Gói này là HỢP ĐỒNG** ([VIPER.md §1.3](../../../VIPER.md)): `context/DESIGN-SYSTEM.md` là bản dịch
> trung thành — không bịa token, không bỏ rơi, không đổi giá trị. Hook `scripts/guard_ds.py` chặn lúc
> ghi; `gate.py V` đối chiếu lại toàn bộ 54 token.
>
> Gói lập ở pha V vòng 1 từ chốt của Authority (bố cục Orca, giữ màu HugRemote, mobile + desktop đều hạng
> nhất) và 8 lượt góp ý trên prototype (`context/PROTOTYPE.md §5`). `status` chuyển `APPROVED` khi
> Authority chốt prototype.

---

## 1. Mục đích

Design system duy nhất của HugRemote: một bộ token semantic hai chủ đề (tối mặc định, sáng gán lại) + bảng
màu terminal cố định, và kho 37 component (C1–C38, C22 đã bỏ) đủ dựng 12 màn S1–S12. Màn hình **chỉ được
lắp từ kho này** (quy ước G-16 ở `context/SOLUTION.md`).

Ba tính từ: **Yên · Dày thông tin · Một lối tới**. Neo: Orca (orca.dev) cho bố cục — thanh bên cây có chấm
trạng thái, vùng chính tab + chia ô, "quiet dark"; HugRemote v1 cho phong cách — đơn sắc tối, màu nhấn theo
khu vực (Files/Git xanh, Terminal tím, Claude đất nung), thanh phím cảm ứng.

---

## 2. Nguồn (source)

| Aspect | Value |
|---|---|
| Source | in-house — prototype `prototype/hugremote/index.html` (đã qua 8 lượt góp ý của Authority) |
| Figma file | — |
| Trang mẫu sống | `prototype/hugremote/index.html#/_ds` — mọi component ở mọi trạng thái bắt buộc, tối/sáng |
| Codegen target | CSS custom properties trong `apps/web/src/styles/tokens.css` (sinh từ `tokens.json`), Tailwind 4 `@theme` đọc các biến đó; theme xterm từ `term.*`; component React ở `apps/web/src/components/ui/` |
| Chủ đề | tối = `color.*` trong `:root`; sáng = `:root[data-theme="light"] { --color-x: var(--light-x) }` — component không dùng thẳng `light.*` |
| Versioning | semver trong `tokens.json` `$version` + frontmatter `version` |

---

## 3. Design tokens

> Chi tiết machine-readable trong `tokens.json` (54 token). Bảng dưới là tóm tắt cho người đọc.

### 3.1 Color — chủ đề tối (semantic, mặc định)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `color.bg` | `#141414` | nền trang, vùng chính; chữ trên nút nguy hiểm |
| `color.surface` | `#1c1c1c` | thanh bên, thẻ, sheet, thanh tab, thanh dưới, bong bóng chat |
| `color.surface-raised` | `#262626` | hàng đang chọn/hover, ô nhập, nút phụ, khối code |
| `color.divider` | `#2a2a2a` | đường kẻ chia vùng (trang trí, không mang nghĩa) |
| `color.border` | `#6b6b6b` | viền ô nhập, viền nút phụ — thành phần cần thấy rõ |
| `color.text` | `#ededed` | chữ chính |
| `color.text-muted` | `#a3a3a3` | chữ phụ, nhãn, thời gian, đường dẫn |
| `color.primary` | `#38bdf8` | hành động chính, liên kết, focus, mục đang chọn; màu khu vực Files/Git; chấm **đang chạy** (nhấp nháy) |
| `color.on-primary` | `#0b1620` | chữ trên nền `--color-primary` |
| `color.danger` | `#f87171` | lỗi, xoá, host key đổi, dòng diff bị xoá |
| `color.success` | `#34d399` | **xong**, kết nối được, dòng diff thêm |
| `color.warning` | `#fbbf24` | đang nối / thử lại, Claude **cần duyệt**, Bypass |
| `color.accent-terminal` | `#c084fc` | biểu tượng phiên terminal (màu khu vực HugRemote) |
| `color.accent-claude` | `#d97757` | biểu tượng phiên Claude, tên "Claude" trong chat (màu khu vực HugRemote) |
| `color.scrim` | `#000000a6` | lớp phủ sau hộp thoại / sheet / hộp chuyển nhanh |

### 3.2 Color — chủ đề sáng (gán lại cho `color.*`)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `light.bg` | `#fafafa` | chủ đề sáng → `--color-bg` |
| `light.surface` | `#ffffff` | chủ đề sáng → `--color-surface` |
| `light.surface-raised` | `#f0f0f0` | chủ đề sáng → `--color-surface-raised` |
| `light.divider` | `#e5e5e5` | chủ đề sáng → `--color-divider` |
| `light.border` | `#8a8a8a` | chủ đề sáng → `--color-border` |
| `light.text` | `#171717` | chủ đề sáng → `--color-text` |
| `light.text-muted` | `#525252` | chủ đề sáng → `--color-text-muted` |
| `light.primary` | `#0369a1` | chủ đề sáng → `--color-primary` |
| `light.on-primary` | `#ffffff` | chủ đề sáng → `--color-on-primary` |
| `light.danger` | `#b91c1c` | chủ đề sáng → `--color-danger` |
| `light.success` | `#047857` | chủ đề sáng → `--color-success` |
| `light.warning` | `#a16207` | chủ đề sáng → `--color-warning` |
| `light.accent-terminal` | `#7e22ce` | chủ đề sáng → `--color-accent-terminal` |
| `light.accent-claude` | `#c2410c` | chủ đề sáng → `--color-accent-claude` |

### 3.3 Color — terminal (cả hai chủ đề, cũng là theme xterm)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `term.bg` | `#0f0f0f` | nền terminal (cả hai chủ đề) |
| `term.text` | `#ededed` | chữ terminal |
| `term.muted` | `#a3a3a3` | ANSI xám |
| `term.green` | `#34d399` | ANSI xanh lá |
| `term.blue` | `#38bdf8` | ANSI xanh dương |
| `term.yellow` | `#fbbf24` | ANSI vàng |
| `term.red` | `#f87171` | ANSI đỏ |

### 3.4 Typography / Spacing / Radius / Elevation / Kích thước

| Nhóm | Token |
|---|---|
| typography | `font.sans` · `font.mono` (JetBrains Mono, tắt gộp ký tự) · `text.xs = 12px` · `text.sm = 14px` · `text.base = 16px` (ô nhập — iOS không tự phóng to) · `text.xl = 20px` |
| spacing | `space.xs = 4px` · `space.sm = 8px` · `space.md = 12px` · `space.lg = 16px` · `space.xl = 24px` |
| radius | `radius = 8px` (mọi khối) · `radius-pill = 999px` (chấm, huy hiệu) |
| elevation | `shadow = 0 8px 24px #00000066` — một mức, cho lớp nổi |
| kích thước | `tap = 44px` (vùng chạm tối thiểu) · `sidebar-w = 280px` (kéo 220–440) · `bar-h = 36px` (thanh trên/tab/đầu editor trên desktop) · `bar-h-touch = 44px` (các thanh đó dưới 1024px) |
| điểm gãy | `768px` (hẹp → vừa) · `1024px` (vừa → rộng) — ở `$breakpoints`, không phải token |
| motion | — (chỉ chấm "đang chạy" nhấp nháy và toast 2,4 s; tôn trọng `prefers-reduced-motion`) |

### 3.5 Tương phản

Mọi cặp chữ/nền và thành phần/nền được liệt kê ở `context/DESIGN-SYSTEM.md §3`, `gate.py V` tự tính WCAG AA
từ mã hex — hiện đạt toàn bộ ở cả hai chủ đề và terminal.

---

## 4. Component index

> Mỗi file: bảng thông tin (mã, nhóm, mục đích, màn, persona, **hiện thực prototype**, **hiện thực pha I** +
> props) · Giải phẫu · Trạng thái (đủ trạng thái bắt buộc) · Token dùng · Biến thể · Tiếp cận (a11y) · Không
> được làm. C22 (ô soạn cũ) đã bỏ, thay bằng C36 — mã không dùng lại.

| Mã | Component | Nhóm | Dùng ở màn | File | Status |
|---|---|---|---|---|---|
| C1 | Nút | action | S1, S3, S4, S5, S6, S7, S8, S9, S10 | `components/c01-nut.md` | APPROVED |
| C2 | Trường nhập | input | S1, S3, S7, S9 | `components/c02-truong-nhap.md` | APPROVED |
| C3 | Hàng danh sách | hiển thị | S3, S5, S7, S8, S9 | `components/c03-hang-danh-sach.md` | APPROVED |
| C4 | Khối trạng thái rỗng | hiển thị | S2, S3, S5, S6, S8, S9, S10 | `components/c04-khoi-trang-thai-rong.md` | APPROVED |
| C5 | Khối báo lỗi | phản hồi | S1, S2, S3, S5, S6, S8, S9, S10 | `components/c05-khoi-bao-loi.md` | APPROVED |
| C6 | Sheet | điều hướng | S3 | `components/c06-sheet.md` | APPROVED |
| C7 | Breadcrumb phạm vi | điều hướng | S2, S5, S6, S8 | `components/c07-breadcrumb-pham-vi.md` | APPROVED |
| C8 | Thanh phiên | điều hướng | S6, S10 | `components/c08-thanh-phien.md` | APPROVED |
| C9 | Hộp thoại | phản hồi | S2, S3, S4, S6, S7, S8, S10 | `components/c09-hop-thoai.md` | APPROVED |
| C10 | Thanh phím cảm ứng terminal | input | S6 | `components/c10-thanh-phim-cam-ung-terminal.md` | APPROVED |
| C11 | Hàng cây | điều hướng | S2 | `components/c11-hang-cay.md` | APPROVED |
| C12 | Thanh dưới mobile | điều hướng | S2, S3, S7 | `components/c12-thanh-duoi-mobile.md` | APPROVED |
| C13 | Dải kết nối | phản hồi | S2, S6, S8, S9, S10 | `components/c13-dai-ket-noi.md` | APPROVED |
| C14 | Huy hiệu trạng thái | hiển thị | S2, S3, S6, S7, S9, S10 | `components/c14-huy-hieu-trang-thai.md` | APPROVED |
| C15 | Thanh trên | điều hướng | S2, S6, S8, S9, S10 | `components/c15-thanh-tren.md` | APPROVED |
| C16 | Thanh tab dự án | điều hướng | S2, S6, S8, S9, S10 | `components/c16-thanh-tab-du-an.md` | APPROVED |
| C17 | Editor | input | S8, S6, S10 | `components/c17-editor.md` | APPROVED |
| C18 | Khối diff | hiển thị | S9, S10 | `components/c18-khoi-diff.md` | APPROVED |
| C19 | Tin nhắn chat | hiển thị | S10 | `components/c19-tin-nhan-chat.md` | APPROVED |
| C20 | Thẻ công cụ | hiển thị | S10 | `components/c20-the-cong-cu.md` | APPROVED |
| C21 | Thẻ duyệt quyền / câu hỏi của Claude | action | S10 | `components/c21-the-duyet-quyen.md` | APPROVED |
| C23 | Menu nổi | điều hướng | S2, S6, S7, S10 | `components/c23-menu-noi.md` | APPROVED |
| C24 | Hộp chuyển nhanh / mở nhanh file | điều hướng | S11, S12 | `components/c24-hop-chuyen-nhanh-mo-nhanh-file.md` | APPROVED |
| C25 | Thanh tiến độ | phản hồi | S7, S8 | `components/c25-thanh-tien-do.md` | APPROVED |
| C26 | Thẻ "Bắt đầu" | điều hướng | S2 | `components/c26-the-bat-dau.md` | APPROVED |
| C27 | Toast | phản hồi | S3, S8, S9, S10 | `components/c27-toast.md` | APPROVED |
| C28 | Thanh tìm/thay trong file | input | S8 | `components/c28-thanh-tim-thay.md` | APPROVED |
| C29 | Kết quả tìm trong dự án | hiển thị | S8 | `components/c29-ket-qua-tim-du-an.md` | APPROVED |
| C30 | Dải báo trong editor | phản hồi | S8 | `components/c30-dai-bao-editor.md` | APPROVED |
| C31 | Khung xem file đặc biệt | hiển thị | S8 | `components/c31-khung-xem-file-dac-biet.md` | APPROVED |
| C32 | Bộ chọn phiên trên mobile | điều hướng | S6, S10 | `components/c32-bo-chon-phien-mobile.md` | APPROVED |
| C33 | Dòng tóm tắt cuối lượt Claude | hiển thị | S10 | `components/c33-dong-tom-tat-cuoi-luot.md` | APPROVED |
| C34 | Tin nhắn xếp hàng | phản hồi | S10 | `components/c34-tin-nhan-xep-hang.md` | APPROVED |
| C35 | Danh sách quản trị | hiển thị | S7 | `components/c35-danh-sach-quan-tri.md` | APPROVED |
| C36 | Ô soạn Claude gọn | input | S10 | `components/c36-o-soan-claude-gon.md` | APPROVED |
| C37 | Chế độ gọn của hội thoại Claude | hiển thị | S10 | `components/c37-che-do-gon-hoi-thoai.md` | APPROVED |
| C38 | Nút thông báo (chuông) | action | S6, S10, S8, S9 | `components/c38-nut-thong-bao.md` | APPROVED |

---

## 5. Screens

> Ảnh chụp từ prototype (chủ đề tối, 1440×900 và 390×844); file `.json` cùng tên ghi route, viewport và danh
> sách component dùng ở màn. `ds-gallery.*.png` (toàn trang `#/_ds`, tối + sáng, desktop + mobile) là **ảnh
> chuẩn cho test so ảnh** ở pha I (G-16).

| Screen | File | Nguồn |
|---|---|---|
| S1 Đăng nhập | `screens/S1-dang-nhap.desktop.png` · `.mobile.png` + `.json` | `prototype/hugremote/index.html#/login` |
| S2 Không gian làm việc | `screens/S2-khong-gian-lam-viec.desktop.png` · `.mobile.png` + `.json` | `prototype/hugremote/index.html#/` |
| S3 Máy | `screens/S3-may.desktop.png` · `.mobile.png` + `.json` | `prototype/hugremote/index.html#/hosts` |
| S4 Tin host key (hộp thoại) | `screens/S4-tin-host-key.desktop.png` · `.mobile.png` + `.json` | `prototype/hugremote/index.html#/hosts + hộp thoại hostkey` |
| S5 Chọn thư mục — dự án mới | `screens/S5-du-an-moi.desktop.png` · `.mobile.png` + `.json` | `prototype/hugremote/index.html#/s/demo-sshd/new-project/~` |
| S6 Phiên — Terminal | `screens/S6-phien-terminal.desktop.png` · `.mobile.png` + `.json` | `prototype/hugremote/index.html#/s/demo-sshd/p/demo-api/terminal/t1` |
| S7 Cài đặt | `screens/S7-cai-dat.desktop.png` · `.mobile.png` + `.json` | `prototype/hugremote/index.html#/settings` |
| S8 Files | `screens/S8-files.desktop.png` · `.mobile.png` + `.json` | `prototype/hugremote/index.html#/s/demo-sshd/p/demo-api/files` |
| S9 Git | `screens/S9-git.desktop.png` · `.mobile.png` + `.json` | `prototype/hugremote/index.html#/s/demo-sshd/p/demo-api/git` |
| S10 Phiên — Claude | `screens/S10-phien-claude.desktop.png` · `.mobile.png` + `.json` | `prototype/hugremote/index.html#/s/demo-sshd/p/demo-api/claude/c1` |
| S11 Chuyển nhanh | `screens/S11-chuyen-nhanh.desktop.png` · `.mobile.png` + `.json` | `prototype/hugremote/index.html` |
| S12 Mở nhanh file | `screens/S12-mo-nhanh-file.desktop.png` · `.mobile.png` + `.json` | `prototype/hugremote/index.html#/…/files + openQuick()` |
| Trang mẫu component | `screens/ds-gallery.{desktop,mobile}.{dark,light}.png` + `ds-gallery.json` | `prototype/hugremote/index.html#/_ds` |

---

## 6. Changelog

| Date | Version | Change |
|---|---|---|
| 2026-11-22 | 1 | Khởi tạo gói từ prototype đã qua 8 lượt góp ý: 53 token (hai chủ đề + terminal), 37 component C1–C38 (bỏ C22), 12 màn + trang mẫu `#/_ds`. Cùng lúc chỉnh prototype cho khớp đặc tả: chuông ở thanh trên S8/S9, Bypass đỏ thống nhất, Dừng khoá khi mất kết nối, Hạn mức vàng khi ≥80%, toast 2,4 s, breadcrumb rút gọn giữa |
| 2026-11-22 | 1 | C4, C5, C7, C9: nhãn trạng thái bắt buộc chỉnh về đúng bản đã chốt (C4 một câu + đúng một nút, biến thể *chỉ thông tin* thành tuỳ chọn; C5 ba trạng thái nguyên nhân · Thử lại · giữ dữ liệu); `context/DESIGN-SYSTEM.md` §2/§4 dịch lại từ gói |
| 2026-11-22 | 1.1 | `bar-h` 48→36px, thêm `bar-h-touch` 44px (gán lại cho `bar-h` dưới 1024px); C17 bỏ huy hiệu "chưa lưu", nút Lưu chỉ icon (C1 thêm "lưu file" vào nhóm icon) — phản hồi lượt 9 |
| 2026-11-22 | 1.1 | Authority chốt cùng prototype (PROTOTYPE.md §5 lượt 10) — `status: APPROVED` |
