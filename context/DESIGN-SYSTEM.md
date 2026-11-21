---
type: design-system
tier: T0
status: DRAFT
last_reviewed: "2026-11-21"
---

# DESIGN SYSTEM — hugremote

> **Nguồn sự thật cho hình thức** — ngang vai với `ARCHITECTURE.md` cho backend và
> `PROTOTYPE.md` cho kiến trúc thông tin.
> Điền ở pha V, SAU khi viết context, **TRƯỚC khi dựng prototype** (`PROTOTYPE.md §4`).
> Xoá hết dấu `_CHƯA ĐIỀN_` khi điền xong — `python3 scripts/gate.py V` bắt dấu này.
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

<!-- Ba tính từ lấy từ "giọng thương hiệu" đã hỏi ở INTERVIEW mục 11 và 13. Chúng là thứ để
     cãi nhau khi phân vân giữa hai phương án — "cái nào 'gọn' hơn?" quyết nhanh hơn "cái nào
     đẹp hơn?". Kèm 1–2 neo tham chiếu THẬT (sản phẩm Authority đang dùng và thấy dễ nhìn),
     vì tính từ một mình vẫn quá rộng.

     Ví dụ: Gọn · Rõ trong nắng · Không màu mè
            Neo: giao diện Zalo (chữ to, ít màu) — Authority đang dùng hằng ngày
            Tránh: dashboard nhiều biểu đồ kiểu Google Analytics — "nhìn là ngợp" -->

| Mục | Nội dung |
|---|---|
| Ba tính từ | _CHƯA ĐIỀN_ |
| Neo tham chiếu (thật) | _CHƯA ĐIỀN_ |
| Cố tình tránh | _CHƯA ĐIỀN_ |

## 2. Token

> Đây là **toàn bộ** bảng màu / thang chữ / nhịp của sản phẩm. Giá trị nào không nằm ở đây thì
> không được xuất hiện trong prototype lẫn code — hết đường "thêm một sắc xám nữa cho đẹp".
>
> Token khai ở đây mà prototype **không dùng** sẽ làm gate đỏ: hoặc dùng nó, hoặc **xoá dòng đó
> đi**. Bảng dưới là bộ khởi động tối thiểu, không phải hạn ngạch phải điền cho đủ.
>
> **Nhiều design system** (§0): thêm cột cuối `DS` vào cả ba bảng dưới, giá trị là tên thư mục
> gói. Một design system thì bỏ qua — không cần cột.

### 2.1 Màu

<!-- Semantic, không đặt tên theo màu: `--color-danger`, không phải `--color-red` — đổi đỏ sang
     cam thì tên vẫn đúng. Giá trị ghi mã hex, gate §3 đọc đúng ô này để tính tương phản.

     Ví dụ:  | `--color-text` | `#1A1A1A` | chữ chính | -->

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--color-bg` | _CHƯA ĐIỀN_ | nền trang |
| `--color-surface` | _CHƯA ĐIỀN_ | nền thẻ / hàng danh sách nổi trên nền trang |
| `--color-text` | _CHƯA ĐIỀN_ | chữ chính |
| `--color-text-muted` | _CHƯA ĐIỀN_ | chữ phụ, nhãn, chú thích |
| `--color-primary` | _CHƯA ĐIỀN_ | hành động chính, thứ muốn người dùng bấm |
| `--color-on-primary` | _CHƯA ĐIỀN_ | chữ nằm TRÊN nền `--color-primary` |
| `--color-border` | _CHƯA ĐIỀN_ | viền input, đường kẻ chia |
| `--color-danger` | _CHƯA ĐIỀN_ | lỗi, xoá, cảnh báo mất dữ liệu |

### 2.2 Chữ

<!-- Một họ chữ. Thang cỡ 3–4 bậc là đủ cho một tuần — nhiều bậc hơn chỉ tạo chỗ để phân vân.
     Ví dụ:  | `--text-base` | `16px` | chữ thường trong nội dung | -->

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--font-sans` | _CHƯA ĐIỀN_ | họ chữ duy nhất (ưu tiên font hệ thống — không tải, không nháy chữ) |
| `--text-sm` | _CHƯA ĐIỀN_ | chú thích, nhãn phụ |
| `--text-base` | _CHƯA ĐIỀN_ | chữ thường |
| `--text-xl` | _CHƯA ĐIỀN_ | tiêu đề màn hình |

### 2.3 Nhịp · bo góc · đổ bóng

<!-- Thang khoảng cách theo bội số cố định (4 hoặc 8). Mọi padding/margin lấy từ đây — đây là
     thứ làm giao diện "trông có kỷ luật" mà không cần ai biết vì sao. -->

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--space-sm` | _CHƯA ĐIỀN_ | khoảng hẹp trong một khối |
| `--space-md` | _CHƯA ĐIỀN_ | khoảng chuẩn giữa các khối |
| `--space-lg` | _CHƯA ĐIỀN_ | khoảng giữa các vùng lớn của màn hình |
| `--radius` | _CHƯA ĐIỀN_ | bo góc nút, thẻ, input — một giá trị dùng chung |
| `--shadow` | _CHƯA ĐIỀN_ | đổ bóng thẻ nổi (chỉ một mức) |

### 2.4 Điểm gãy

<!-- CSS media query KHÔNG dùng được var(), nên breakpoint viết số thật trong @media và ghi
     ở đây để tra. Cố tình không đặt dạng `--token` để gate không đòi nó xuất hiện trong prototype.
     Mặc định: một điểm gãy là đủ. Thiết bị chính của persona (`PERSONAS.md §1`) quyết định
     thiết kế cho bên nào trước. -->

| Điểm gãy | Giá trị | Thiết kế trước cho |
|---|---|---|
| hẹp → rộng | _CHƯA ĐIỀN_ | _CHƯA ĐIỀN_ (điện thoại trước / máy tính trước) |

## 3. Tương phản — `gate.py V` tự tính

<!-- Đây là chỗ MVP một tuần hay chết: chữ xám nhạt trên nền trắng, nhìn trên màn hình đẹp
     trong phòng thì ổn, ra nắng hoặc trên điện thoại rẻ là không đọc được. Không cần công cụ
     ngoài — gate đọc mã hex ở §2.1, tự tính tỉ lệ tương phản và báo đỏ nếu chưa đạt.

     Ngưỡng WCAG AA:  chữ thường ≥ 4.5:1 · chữ lớn (≥24px, hoặc ≥19px in đậm) ≥ 3:1
                      thành phần giao diện (viền input, icon) ≥ 3:1
     Cột "Loại" nhận đúng ba giá trị: thường · lớn · thành phần.
     Thêm cặp nào cũng được, miễn hai ô giữa là tên token có ở §2.1. Cặp nào không áp dụng
     cho sản phẩm (vd không có input) thì xoá dòng — nhưng phải còn ít nhất một cặp.

     NHIỀU DESIGN SYSTEM (§0): thêm cột cuối `DS`. Mỗi gói phải có bộ cặp của riêng nó —
     chữ của gói A trên nền của gói B là cặp không tồn tại trên màn nào, gate giải token
     trong đúng lát của gói nên cặp lai sẽ đỏ ở mục "không tính được". -->

| Cặp | Token chữ / tiền cảnh | Token nền | Loại |
|---|---|---|---|
| Chữ chính trên nền trang | `--color-text` | `--color-bg` | thường |
| Chữ phụ trên nền thẻ | `--color-text-muted` | `--color-surface` | thường |
| Chữ trên nút chính | `--color-on-primary` | `--color-primary` | thường |
| Chữ lỗi trên nền trang | `--color-danger` | `--color-bg` | thường |
| Viền input trên nền trang | `--color-border` | `--color-bg` | thành phần |

## 4. Kho component

<!-- Danh sách ĐÓNG các khối được phép dùng. Prototype và pha I lắp từ đây; cần khối mới thì
     thêm vào bảng này trước, không vẽ thẳng vào màn hình.

     Cột "Dùng ở màn" trỏ tới mã màn hình ở `PROTOTYPE.md §1` (S1, S2…) — gate đòi mỗi
     component phải có ít nhất một màn dùng nó. Component không màn nào dùng là component
     tưởng tượng, xoá đi.

     Cột "Trạng thái bắt buộc" là thứ hay bị quên nhất: nút không có trạng thái "đang gửi" thì
     người dùng bấm hai lần, và đó chính là ca biên đã chốt ở `ARCHITECTURE.md §6`.
     Đây cũng là bảng thẻ vai dogfood `picky` cầm đi soi trên app đã chạy.

     NHIỀU DESIGN SYSTEM (§0): thêm cột cuối `DS`. Component của gói A mà lại dùng ở màn
     thuộc experience mặc gói B → gate in cảnh báo (không đỏ, vì màn thuộc experience nào
     chỉ suy được từ file prototype nào chứa mã màn — suy đoán thì không đủ chắc để chặn). -->

| # | Component | Dùng ở màn | Trạng thái bắt buộc |
|---|---|---|---|
| C1 | Nút chính | _CHƯA ĐIỀN_ | mặc định · đang gửi (khoá lại) · bị vô hiệu |
| C2 | Trường nhập | _CHƯA ĐIỀN_ | rỗng · đang gõ · sai (kèm câu báo lỗi tiếng Việt) |
| C3 | Thẻ / hàng danh sách | _CHƯA ĐIỀN_ | mặc định · đang chọn · đang tải (khung xám) |
| C4 | Khối trạng thái rỗng | _CHƯA ĐIỀN_ | một câu giải thích + đúng một nút hành động |
| C5 | Khối báo lỗi | _CHƯA ĐIỀN_ | nói được làm gì tiếp · có đường thử lại |

<!-- Thêm C6, C7… nếu bản đồ màn hình cần. Ít hơn 5 khối cũng được — xoá dòng không dùng. -->

## 5. Ba khuôn trạng thái dùng chung

<!-- Nội dung cụ thể của từng màn nằm ở `PROTOTYPE.md §1` (cột "Rỗng / lỗi / đang tải").
     Ở đây chỉ chốt KHUÔN — hình dạng chung, để năm màn hình không sinh ra năm kiểu báo lỗi. -->

| Khuôn | Chốt |
|---|---|
| Rỗng | _CHƯA ĐIỀN_ (một câu nói vì sao trống + đúng một nút mở việc đầu tiên — không để trắng trơn) |
| Lỗi | _CHƯA ĐIỀN_ (tiếng Việt, nói phải làm gì tiếp, giữ nguyên dữ liệu người dùng đang nhập) |
| Đang tải | _CHƯA ĐIỀN_ (khung xám giữ đúng chỗ nội dung sắp hiện — không nhảy layout) |

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
