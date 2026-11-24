---
type: prototype
tier: T0
status: ACTIVE
last_reviewed: "2026-11-21"
---

# PROTOTYPE — hugremote

> **Nguồn sự thật cho kiến trúc thông tin** — ngang vai với `ARCHITECTURE.md` cho backend;
> hình thức (màu, chữ, component) nằm ở `DESIGN-SYSTEM.md`, điền TRƯỚC khi dựng prototype.
> Điền ở pha V, sau khi đã hiểu sản phẩm (phỏng vấn hoặc dịch intake), TRƯỚC khi khoá scope.
> Pha I làm theo màn hình đã chốt ở đây; UI lệch bản đã chốt là phát hiện khi dogfood.
>
> **Quy trình bắt buộc ở vòng 1**: dựng file prototype (§4) → **DỪNG LẠI**, mời Authority mở
> bấm thử hết luồng lõi → ghi phản hồi vào §5, sửa, lặp → Authority nói "chốt" → ghi ngày vào
> dòng `Chốt bởi Authority` → lúc đó mới được khoá scope. Đây vẫn là pha V nên hỏi thoải mái.
>
> **Vòng ≥2**: ngày chốt cũ còn nguyên hiệu lực, không có nghi thức chốt lại — thêm/sửa màn
> delta rồi đi tiếp. Đường intake: vòng khai `UI vòng này: không có màn mới` trong
> `intake/loops/l<N>/_PROPOSAL.md` thì `gate.py V` bỏ qua toàn bộ phần prototype
> ([VIPER.md §1.4](../VIPER.md)).

<!-- DỰ ÁN KHÔNG CÓ GIAO DIỆN NGƯỜI DÙNG (API thuần / CLI / worker):
     xoá toàn bộ nội dung từ §1 trở xuống, thay bằng đúng một dòng:

         KHÔNG CÓ UI — bỏ qua prototype

     kèm 1 dòng lý do trong DECISIONS.md. gate.py V thấy marker này sẽ bỏ qua
     toàn bộ kiểm prototype và KHÔNG chặn khoá scope. -->

---

## 1. Bản đồ màn hình

Experience `hugremote` — file `prototype/hugremote/index.html`. Mỗi màn có bản desktop (≥1024px: thanh bên
cây + vùng chính tab/chia ô kiểu Orca) và mobile (<768px: toàn màn + thanh dưới); 768–1023px thanh bên trượt.
**Không có màn tổng quan dự án**: bấm dự án ở cây/chuyển nhanh mở lại đúng tab đang dùng ở dự án đó (phiên, Files hoặc Git); dự án chưa có phiên → tab Phiên hiện ngay hai nút *Phiên Claude mới* / *Terminal mới*. Trong một dự án, thanh tab dự án (C16) có ba tab **Phiên · Files · Git** — cùng một phạm vi. Tab **Phiên** gộp phiên Claude và terminal trong một thanh tab (Claude trước, terminal sau — đúng thứ tự trong cây); nút **+** hỏi mở *Phiên Claude mới* hay *Terminal mới*; dự án và phiên đổi được tên hiển thị (alias).

| # | Màn hình | Mục đích (theo persona nào) | Thông tin bắt buộc — theo thứ tự ưu tiên | Hành động chính | Rỗng / lỗi / đang tải |
|---|---|---|---|---|---|
| S1 | Đăng nhập | Mọi persona vào app an toàn | Ô mật khẩu + nút SSO (nếu owner đã bật) → bước mã 6 số / mã khôi phục → lần đầu: đặt mật khẩu mới → số lần còn lại / đếm ngược mm:ss khi bị khoá → liên kết "Quên mật khẩu?" (hướng dẫn `hugremote reset-password`) → sau đăng nhập về đúng trang định mở | Đăng nhập · Đăng nhập bằng Google/SSO · Xác nhận mã · Lưu mật khẩu mới · Quên mật khẩu? · Quay lại | — · nút "Đang đăng nhập…" · sai (còn n lần) / bị khoá (đếm ngược) / email không trong allowlist |
| S2 | Không gian làm việc (trang chủ) | P-MOBILE/P-DESK thấy ngay việc cần mình và đi tới đúng chỗ | Thẻ Bắt đầu (instance mới, một nút chính) → **Cần bạn** (phiên Claude chờ duyệt) → cây máy đã ghim → dự án → phiên (chỉ mở thứ đang dùng; mobile đặt dưới Cần bạn) → **Đang chạy** | Mở phiên · + phiên (Claude/Terminal) · ⋯ (đổi tên, bỏ khỏi không gian, sửa máy, đóng phiên) · Thu gọn tất cả · Thêm máy | Rỗng: thẻ Bắt đầu 3 bước; "Chỉ có máy này…" + Thêm máy · Lỗi: hàng máy đỏ + Thử lại; C13 · Đang tải: khung xám |
| S3 | Máy | P-HOST quản lý máy; member chỉ xem + ghim | Danh sách máy theo đúng thứ tự cây (tên, `user@host:port`, jump, trạng thái, ghim) → form sheet: tên, host, user, cổng, xác thực, jump host, thư mục bắt đầu (sửa: trường bí mật/thư mục trống = giữ cũ; đổi host/port/user → bắt Thử kết nối lại trước khi Lưu) | Thêm · Sửa · Xoá (máy là jump host → chặn, nêu máy phụ thuộc) · Thử kết nối · Ghim/sắp xếp | Rỗng: chỉ Máy này + Thêm máy · Lỗi: block ssh config lỗi; lỗi kết nối có hướng dẫn · Đang tải |
| S4 | Tin host key (hộp thoại) | P-HOST quyết tin máy | Máy, `host:port`, loại khoá, vân tay SHA256 (khoá đổi: cũ gạch + mới, cảnh báo đỏ, ô tick "Tôi đã kiểm vân tay mới") | Tin máy này · Huỷ · Tôi đã kiểm, tin khoá mới (chỉ bật sau khi tick) | — · "Đang kết nối…" · biến thể cảnh báo đỏ |
| S5 | Chọn thư mục — dự án mới | Tạo dự án bằng cây thư mục | Breadcrumb đường dẫn → thư mục con (dấu repo git) → tên dự án | Vào thư mục · Lên trên · Thư mục mới (kiểm tên) · Chọn thư mục này | Rỗng · lỗi ngoài phạm vi + Về gốc · Đang tải |
| S6 | Phiên — terminal | P-DESK nhiều phiên song song; P-MOBILE xem/gõ nhanh | Thanh phiên trộn C8 (tên, chấm, ⚠ Bypass, × đóng) + chuông C38 → nội dung terminal → mobile: bộ chọn phiên C32 + thanh phím + ngăn mở rộng (F1–F12, nhãn phím); chạm terminal mở bàn phím | Gõ · **+** (Claude/Terminal) · Chia ô (chọn phiên cho ô phải) · Đổi tên · Đóng · Chuông ✓/✗ · phím tắt (⌥1–9, Ctrl+Tab, ⌥W) | Rỗng + Mở terminal · C13 mất kết nối; phiên đã kết thúc + Mở lại · "Đang nối phiên…" |
| S7 | Cài đặt | P-HOST bảo mật, SSO, cập nhật; mọi persona giao diện, thiết bị của mình + đăng xuất | Bảo mật (2FA — tắt/tạo mã mới phải nhập mã; mã khôi phục chỉ hiện một lần; đổi mật khẩu) → Thiết bị đăng nhập (C35: trình duyệt, IP, lần cuối; đăng xuất từng cái / mọi nơi khác) → Đăng nhập nhóm (SSO: nhà cung cấp, issuer, client, allowlist email hoặc `@tên-miền`, Kiểm tra, Tắt SSO) → Thành viên (C35: email, lần cuối, phiên đang chạy, Thu hồi) → Lần SSO bị từ chối (C35, Cho phép) → Giao diện (chủ đề, ngôn ngữ) → Hệ thống (phiên bản, bản mới + Cập nhật: xác nhận số phiên sẽ dừng / Khi rảnh, tiến độ; doctor; báo cáo nhập v1) → Nhật ký (C35: ứng dụng/cập nhật/SSH) → Đăng xuất | Bật/tắt 2FA · Tạo mã mới · Đăng xuất thiết bị · Lưu SSO · Tắt SSO · Thu hồi member · Cho phép email bị từ chối · Đổi chủ đề/ngôn ngữ · Cập nhật ngay / Khi rảnh · Xem nhật ký · Đăng xuất | — · Lỗi: mã sai, SSO kiểm tra lỗi, cập nhật lỗi đã quay lại · khung xám |
| S8 | Files | Developer duyệt file Claude vừa sửa, sửa nhanh, tìm, đọc log, lấy đường dẫn (PERSONAS §1.1) | Thanh bên: **File** (lọc tên, cây từ gốc dự án, M/A, `.gitignore` mờ, file ẩn bật/tắt) · **Tìm** (nội dung cả dự án, C29) → tab file đang mở → đường dẫn đầy đủ + chưa lưu → dải "Claude vừa sửa" (C30) → thanh tìm/thay (C28) → editor có vạch dòng đổi / xem trước / ảnh / log / file lớn (C31) | Mở · Mở nhanh ⌘P · Tìm ⌘⇧F · Tìm/thay ⌘F · Tới dòng (URL `/<dòng>`) · Lưu ⌘S · Đóng tab (hỏi lưu) · Lọc log theo mức · Xem thay đổi · ⋯ (Gửi cho Claude — chọn phiên, Mở terminal tại đây — đúng thư mục, Sao chép đường dẫn, Đổi tên/di chuyển, Nhân bản, Tải xuống, Bỏ thay đổi, Xoá) · Tạo · Tải lên | Rỗng: thư mục trống + Tạo file/Tải lên; chưa mở file + Mở nhanh · Lỗi: xung đột với bản Claude vừa sửa (So sánh · Lấy bản trên máy · Giữ bản của tôi) · khung xám |
| S9 | Git | Duyệt và commit thay đổi của Claude; xem lịch sử | Repo (nếu nhiều) → nhánh + ahead/behind → thay đổi (staged/unstaged, +/−) → diff (mobile: danh sách → diff) → ô commit; tab Lịch sử: commit → danh sách file → diff | Nút biểu tượng: Fetch · Pull · Push (kèm số commit, Push tắt khi không có gì) · Stage/Unstage từng file / tất cả · Bỏ thay đổi · Commit (⌘Enter) · Đổi nhánh · Xem commit · Mở file · Chuông | Rỗng: "Không có thay đổi" / "Dự án chưa có repo git" · Lỗi: push bị từ chối (non-fast-forward) · khung xám |
| S10 | Phiên — Claude | Giao việc cho Claude, duyệt quyền một chạm, theo dõi từ xa | Thanh phiên trộn C8 (cùng S6, ⚠ Bypass) + chuông C38 → danh sách phiên (gộp CLI) → luồng chat (đầy đủ hoặc gọn C37): tin người dùng, suy nghĩ (thu gọn), văn bản, thẻ công cụ, thẻ duyệt quyền, tóm tắt lượt C33 → tin xếp hàng C34 → ô soạn C36 (riêng từng phiên): ô nhập + mic + quyền; đính kèm · gọn · Context `227k/1000k` · Hạn mức 5 giờ · Model + mức suy nghĩ · Dừng/Gửi | Gửi (đang chạy → xếp hàng) · Huỷ tin chờ · Dừng (Esc) · Cho phép/Từ chối · Đổi model/chế độ (⇧Tab) · Bật gọn · Tiếp tục phiên CLI · Đổi tên · **+** · Chia ô với Terminal/Files/Git | Rỗng: "Hỏi Claude điều gì đó về dự án này" + gợi ý · Lỗi: chưa cài Claude CLI trên máy, hàng chờ đầy, C13 đang nối lại (Gửi/duyệt khoá, nháp giữ) · "Claude đang suy nghĩ…" |
| S11 | Chuyển nhanh (hộp nổi) | Tới đúng dự án/phiên/file trong ≤3 thao tác | Ô tìm → kết quả nhóm theo máy: dự án, phiên Claude (chấm trạng thái, ⚠ Bypass), phiên terminal, file (khớp tên trước); member chỉ thấy phiên của mình | Gõ · ↑↓ · Enter mở · Esc đóng | Rỗng: phiên cần bạn + đang chạy · "Không thấy …" · đang tìm |
| S12 | Mở nhanh file ⌘P (hộp nổi) | Developer mở file theo tên trong dự án hiện tại, tới dòng | Ô tìm (khớp mờ, `:số` = tới dòng) → file đang mở + vừa thay đổi khi trống → kết quả theo độ khớp | Gõ · ↑↓ · Enter mở · Esc đóng | Rỗng: file đang mở + vừa đổi · "Không có file nào khớp" · — |
| S13 | Phiên trình duyệt (vòng 3, chỉ app desktop) | P-DESK xem web app đang chạy trên máy SSH mà không rời app | Thanh phiên trộn C8 (biểu tượng quả địa cầu, tên = địa chỉ) → thanh địa chỉ (lùi · tiến · tải lại · ô URL · nhãn đường chuyển tiếp `localhost:L → máy:cổng` · mở ngoài · DevTools) → chip cổng đang nghe trên máy → trang | Gõ link (đổi trang trong chính phiên) · bấm chip cổng · Chuyển tiếp và mở · Mở ngoài | Cổng chưa chuyển tiếp: `máy:cổng · tiến trình` + *Chuyển tiếp và mở* · cổng không nghe: lỗi + Thử lại · đang tải: khung xương |
| S14 | Chuyển tiếp cổng (vòng 3, owner) | P-DESK/P-HOST đưa cổng giữa Mac và máy SSH, hai chiều | Lọc theo máy → danh sách chuyển tiếp: chiều ↓ (máy SSH → Mac) / ↑ (Mac → máy SSH), địa chỉ nguồn + tên, ô cổng đích sửa được, trạng thái → *Đang nghe*: cổng chưa chuyển tiếp + tiến trình + ô cổng điền sẵn + Chuyển tiếp → sheet Thêm (máy, chiều, cổng hai đầu tự điền theo nhau, tên, *Tự bật khi mở app*) | Thêm · Chuyển tiếp từng cổng · sửa cổng đích · Tắt/Bật · Xoá · Mở bằng trình duyệt | Rỗng: "Chưa có cổng nào." + Thêm · lỗi: trùng cổng (ô đỏ + câu báo), máy mất kết nối (chữ đỏ, tự thử lại 10 giây) · đang tải: khung xương |

**Delta vòng 3 trên màn cũ** (chốt 2026-11-24): **S6** — loại phiên tmux (biểu tượng riêng, tên = tên session tmux, không tiền tố), trạng thái *đang gắn lại* (tmux) và *Mất kết nối — đang nối lại (lần n)* + *Mở lại tại đây* / *Đóng tab* (terminal thường); menu **+** thêm *Phiên tmux mới* (⌥⇧M, chỉ máy SSH) + nhóm *tmux trên <máy>* + *Trình duyệt mới* (⌥⇧B, chỉ desktop). **S8** — trạng thái cây (thư mục mở, file ẩn, cuộn) giữ theo dự án; Home bật file ẩn sẵn; menu file thêm *Mở bằng trình duyệt*. **S10** — chip ô soạn chỉ còn giá trị (context, model, quyền), bỏ nút khiên cạnh mic, bỏ chip hạn mức; popup model có hai thanh % hạn mức phiên 5 giờ + tuần. **Header desktop** — tab Phiên · Files · Git chỉ biểu tượng (điện thoại giữ chữ); bỏ nút Chuyển nhanh khi có thanh bên; thêm nút Chuyển tiếp cổng (owner); Cài đặt chỉ trên header. Bỏ các dòng chữ hướng dẫn trên màn mới.

## 2. Sơ đồ điều hướng

```
S1 Đăng nhập ──mật khẩu / SSO──► (2FA) mã ──► (lần đầu) đặt mật khẩu mới ──► S2

DESKTOP (≥1024px)
  thanh bên: cây Máy → Dự án → Phiên (Claude ◆, terminal ›_)   +  [Tìm ⌘K] trên đầu  +  [Quản lý máy] [Cài đặt] cuối
    bấm dự án  ──► tab đang dùng lần trước ở dự án đó (S6/S10/S8/S9); chưa có phiên ──► tab Phiên rỗng + 2 nút tạo
    [⋯] ở hàng máy/dự án/phiên ──► menu: Dự án mới · Sửa máy · Đổi tên hiển thị · Bỏ khỏi không gian làm việc · Đóng phiên
    [Thu gọn tất cả] / [+ máy] ở đầu cây
    bấm phiên Claude ──► S10      bấm phiên terminal ──► S6   (cùng một thanh phiên trộn C8)
    [+] ở cây hoặc thanh phiên ──► menu: Phiên Claude mới ──► S10 · Terminal mới ──► S6
    [✎] ở cây / thanh phiên / trang dự án ──► hộp đổi tên hiển thị (C9)
    tab Files ──► S8 (thanh bên File | Tìm; tab file đang mở)   tab Git ──► S9
    ⌘P ──► S12 mở nhanh file   ⌘⇧F ──► S8 tab Tìm   ⌘F ──► thanh tìm/thay trong file
    đường dẫn file:dòng trong S10 / nút Mở file ở S9 ──► S8 đúng dòng
    [Chia ô] ở S6/S10: ô phải = Terminal | Files | Git | Claude khác (AC-35)
    [Dự án mới] ──► S5 ──► S2      [Quản lý máy] ──► S3 ──Thử kết nối──► S4      [Cài đặt] ──► S7
    ⌘K / Ctrl+Alt+K ở mọi màn ──► S11 ──Enter──► đúng máy + dự án + tab
    [chuông C38] ở thanh phiên (S6/S10) / thanh trên (S8/S9) ──► danh sách cần duyệt: ✓/✗ tại chỗ · bấm dòng ──► S10 phiên đó
    ⌘/ ──► bảng phím tắt (tab thường: ⌥ thay tổ hợp trình duyệt giữ; PWA: phím gốc)
    chưa đăng nhập + link sâu ──► S1 ──đăng nhập──► đúng link đã định mở

MOBILE (<768px): thanh dưới [Không gian] [Máy] [Cài đặt]; nút tìm ở thanh trên ──► S11; trong dự án, chuông ở thanh phiên (S6/S10) / thanh trên (S8/S9) ──► danh sách cần duyệt
  S2 cây ──chạm dự án──► tab đang dùng ở dự án đó (C16: Phiên · Files · Git) ──► S10 / S6 (bộ chọn phiên C32) / S8 / S9 toàn màn ──←──► S2

URL hash: #/login · #/s/<máy>/p/<dự án> · …/claude/<phiên> · …/terminal/<phiên> (cùng tab Phiên) · …/files/<đường dẫn>[/<dòng>] · …/git[/history]
          · #/s/<máy>/new-project[/<đường dẫn>] · #/hosts · #/settings[/<mục>]
```

## 3. Map AC ↔ màn hình

| AC | Màn hình | Ghi chú |
|---|---|---|
| AC-1 | S1 | Bước đặt mật khẩu mới |
| AC-2 | S7, S1 | Đăng xuất; phiên bền (không màn riêng) |
| AC-3 | S7, S1 | Bật 2FA + mã khôi phục; bước mã + khoá |
| AC-4 | S3 | Danh sách máy |
| AC-5 | S3, S4 | Sheet thêm/sửa/xoá, Thử kết nối; sửa giữ giá trị cũ, đổi địa chỉ bắt thử lại; chặn xoá jump host |
| AC-6 | S4 | Lần đầu / khoá đổi (tick xác nhận) |
| AC-7 | S5, S2 | Tạo dự án (Thư mục mới), phạm vi hiện hành, đổi tên hiển thị |
| AC-8 | S2, S3 | Ghim/bỏ ghim máy, bỏ dự án (cho cả nhóm, nêu số phiên dừng), thứ tự |
| AC-9 | S6, S2 | Chạy nền, nối lại |
| AC-10 | S6 | Tab + chia đôi |
| AC-11 | S6 | Thanh phím mobile, F1–F12, chạm mở bàn phím |
| AC-12 | S2, S6, S10 | Cây gọn (chỉ mở thứ đang dùng); bấm dự án về tab đang dùng; tab Phiên trộn + menu **+**; đổi tên phiên; bộ chọn phiên mobile |
| AC-13 | S2 | Lắp từ token, chuỗi i18n |
| AC-14 | S1, S5 | Chưa đăng nhập chỉ thấy S1; ngoài phạm vi |
| AC-15 | S7 | Hệ thống |
| AC-16 | S8 | Lọc cây, file ẩn, tab file, tô màu, vạch dòng đổi, tìm/thay, tới dòng, xem trước, ảnh, log theo dõi + lọc mức, file lớn, URL `/<dòng>`, hỏi lưu khi đóng tab |
| AC-17 | S8, S6 | Menu ⋯ file/thư mục, tải lên/xuống, Gửi cho Claude chọn phiên, terminal mở tại thư mục |
| AC-18 | S9 | Thay đổi, diff (cả mobile), stage tất cả, bỏ thay đổi, commit ⌘Enter, fetch/pull/push biểu tượng kèm số, đổi nhánh |
| AC-19 | S9 | Tab Lịch sử: commit → file → diff |
| AC-20 | S10, S2 | Stream, chạy nền, Dừng |
| AC-21 | S10, S2 | Thẻ duyệt quyền, chấm cần duyệt, menu chế độ |
| AC-22 | S10 | Model + effort, Context `a/b` token (`227k/1000k`) |
| AC-23 | S10 | Danh sách phiên gộp CLI |
| AC-24 | S10 | Gợi ý `/`, đính kèm, mic |
| AC-25 | S10 | Chip Hạn mức 5 giờ, tooltip tuần + giờ reset |
| AC-26 | S11 | Chuyển nhanh |
| AC-27 | S7 | Chủ đề + ngôn ngữ |
| AC-28 | S2 | Thẻ Bắt đầu |
| AC-29 | S7 | Thông tin cài đặt/`BASE_PATH` ở Hệ thống (phần CLI kiểm bằng test cài) |
| AC-30 | S7 | Báo cáo nhập v1 ở Hệ thống |
| AC-31 | S7 | Xác nhận số phiên sẽ dừng / Khi rảnh; cập nhật có tiến độ |
| AC-32 | S7, S1 | Cấu hình SSO; nút SSO ở đăng nhập |
| AC-33 | S2, S3, S6, S7, S10, S11 | Member chỉ thấy phiên của mình ở cây, S2, chuông, ⌘K, thanh phiên; S3 chỉ xem + ghim; S7 ẩn mục owner |
| AC-34 | S1 | Phần lớn kiểm bằng test bảo mật |
| AC-35 | S10, S6 | Chia ô Claude + Terminal/Files/Git, phiên Claude trong cây |
| AC-36 | S12, S8 | ⌘P mở nhanh + `:dòng`; tab Tìm ⌘⇧F |
| AC-37 | S10, S9, S8 | Đường dẫn trong Claude/test bấm được; Mở file từ diff; dải "Claude vừa sửa", xung đột So sánh · Lấy bản trên máy · Giữ bản của tôi |
| AC-38 | S6, S10, S8, S9 | Chuông C38 (thanh phiên C8 ở S6/S10, thanh trên ở S8/S9): số phiên cần duyệt, ✓/✗ tại chỗ, bấm dòng vào phiên |
| AC-39 | S10, S2 | Cấu hình riêng từng phiên, ⚠ Bypass ở cây/tab/ô soạn, ⇧Tab |
| AC-40 | S10 | Tin xếp hàng C34 (Huỷ), Esc dừng |
| AC-41 | S10 | Dòng tóm tắt cuối lượt C33 → diff |
| AC-42 | S10 | Nút gọn, chế độ gọn C37 |
| AC-43 | S2, S6, S8, S9, S10 | C13 + khoá thao tác ghi, giữ nháp |
| AC-44 | S7 | Thiết bị đăng nhập (C35) |
| AC-45 | S7 | Thành viên + thu hồi, lần SSO bị từ chối, allowlist `@tên-miền`, Tắt SSO |
| AC-46 | S7 | Nhật ký ứng dụng/cập nhật/SSH |
| AC-47 | S1 | Quên mật khẩu → hướng dẫn `hugremote reset-password` |
| AC-48 | S1 | Quay về trang định mở; đếm ngược khi bị khoá |
| AC-49 | S6, S10, S8, S9 | Phím tắt desktop, bảng ⌘/ |
| AC-50 | S2, S6, S10 | Vòng 2 — app desktop bọc nguyên giao diện web (không màn mới) |
| AC-51 | S2 | Vòng 2 — mở app vào thẳng không gian làm việc, không qua S1 |
| AC-52 | S2 | Vòng 2 — lệnh build `.app`/`.dmg` (CLI); kết quả là app mở vào S2 |
| AC-53 | S6 | Bảng phím tắt ⌘/ có nhóm Terminal |
| AC-54 | S6 | Menu + (tmux mới, tmux trên máy), tab tmux |
| AC-55 | S6 | Trạng thái *đang gắn lại* |
| AC-56 | S6 | *Mất kết nối — đang nối lại* + *Mở lại tại đây* |
| AC-57 | S14 | Danh sách hai chiều, sheet Thêm, lỗi trùng cổng |
| AC-58 | S14, S13 | *Đang nghe* (S14), chip cổng (S13) |
| AC-59 | S13, S6, S8 | Menu + *Trình duyệt mới*; menu file *Mở bằng trình duyệt* |
| AC-60 | S8 | Cây giữ trạng thái khi đổi tab |
| AC-61 | S8 | Home bật file ẩn sẵn |
| AC-62 | S10 | Chip chỉ giá trị, bỏ nút khiên |
| AC-63 | S10 | Popup model: thanh % hạn mức |

## 4. File prototype tương tác

**Bao nhiêu file — theo đường vào** ([VIPER.md §1.3](../VIPER.md)):

| Đường phỏng vấn | Đường intake |
|---|---|
| `prototype/index.html` — MỘT file, một app | `prototype/<experience>/index.html` — mỗi experience có UI ở `ARCHITECTURE.md §2–§3` một file, tên thư mục khớp tên experience |

Mã màn hình `S<số>` là **toàn cục** cho cả hệ (S1, S2… — không đặt SW1/SM1); `gate.py` chỉ khớp `S\d+` và glob `prototype/**/*.html`.

Mỗi file phải là **HTML tự chứa** để Authority mở thẳng bằng trình duyệt:

- Đủ mọi màn hình của experience đó ở §1, điều hướng bấm được đúng sơ đồ §2 (hash routing hoặc show/hide, không cần backend)
- Dữ liệu giả lấy từ `PRD.md §7` (dữ liệu mẫu) — không lorem ipsum
- Có cả trạng thái rỗng và trạng thái lỗi của từng màn (nút chuyển trạng thái để xem)
- Responsive theo "Thiết bị chính" của persona dùng experience đó (`PERSONAS.md §1`)
- Không CDN, không thư viện ngoài — mở offline vẫn chạy
- **Hình thức lấy nguyên từ `DESIGN-SYSTEM.md`**: token §2 khai trong `:root` và dùng qua
  `var(--…)`; màn hình lắp từ kho component §4 — **không hardcode màu, không khai token
  mới ngay trong HTML, không vẽ khối ngoài kho**

Ba luật cuối không phải lời khuyên: hook `scripts/guard_ds.py` **chặn thẳng lệnh ghi file**
khi thấy mã màu thô ngoài `:root` hoặc `var(--…)` chưa khai ở §2, và `gate.py V` báo đỏ khi
màn khai ở §1 mà prototype chưa dựng. Design system chốt trước prototype chỉ có tác dụng nếu
prototype thật sự lắp từ token — gõ thẳng `#hex` cho nhanh là giết đúng cơ chế đó: phản hồi
"chữ nhỏ quá" của Authority lẽ ra sửa MỘT token rồi lan ra mọi màn.

**Prototype là tài liệu, không phải code nền.** Pha I scaffold từ stack skill và làm lại UI
theo bản đồ §1 — không phát triển tiếp file này, không copy nguyên khối vào codebase.

**Trang mẫu component** `prototype/hugremote/index.html#/_ds` (mở từ bảng điều khiển prototype): mọi
component C1–C38 ở mọi trạng thái bắt buộc, tối/sáng, desktop/mobile — vẽ bằng chính CSS và hàm của các
màn nên không lệch. Ảnh chụp của nó và của S1–S12 nằm ở `intake/design-systems/hugremote/screens/` — chuẩn
cho test so ảnh pha I (G-16).

## 5. Chốt của Authority

<!-- Ghi từng LƯỢT phản hồi (lượt ở đây là một vòng bấm-thử-rồi-sửa, không phải "vòng"
     V-I-P-E-R). Authority nói "chốt" thì điền ngày ISO vào dòng dưới cùng — ví dụ:
     `Chốt bởi Authority: 2026-08-04` — gate.py V bắt đúng dòng này, chưa có thì chưa
     được khoá scope. Vòng ≥2 không xoá ngày này (repeat.py giữ nguyên): tài liệu vòng
     / kế hoạch vòng là chữ ký của Authority cho vòng mới. -->

| Lượt | Ngày | Phản hồi của Authority | Đã sửa |
|---|---|---|---|
| 1 | 2026-11-21 | "Không phân biệt tab Claude và Terminal. Nhấn + sẽ hiển thị terminal hoặc Claude. Các session và dự án cho phép đổi alias name hiển thị, ở workspace vẫn giữ nguyên cách sắp xếp Claude và terminal. Nút edit và nút chia ô trên prototype chưa hoạt động." | Gộp Claude + Terminal thành tab **Phiên** (C8 tab trộn, Claude trước terminal sau, giống cây); **+** mở menu Phiên Claude mới / Terminal mới (cả ở cây); đổi tên hiển thị cho dự án (cây, trang dự án) và phiên (cây, thanh phiên) qua hộp C9; sửa menu chia ô bị cắt (tách vùng cuộn tab khỏi nhóm nút) và nút sửa chưa gắn hành động |
| 2 | 2026-11-21 | "Không phải lúc nào cũng hiện tất cả list server và project; không cho xoá khỏi workspace; click project phải trở lại tab current active trên project đó chứ không phải ra màn danh sách — màn này vô dụng; không có session thì click project phải có nút tạo. Dùng vai newbie và picky để có thêm góc nhìn." | Cây chỉ mở máy/dự án đang dùng + Thu gọn tất cả; menu ⋯ (bỏ máy/dự án khỏi không gian, đổi tên, sửa máy, đóng phiên) thay cho dãy icon; **bỏ màn tổng quan dự án** — bấm dự án về tab đang dùng, chưa có phiên thì hiện 2 nút tạo. Vai `newbie` (25 phát hiện) + `picky` (19) đã chạy; đã sửa: thêm máy đúng dữ liệu + form trống, tạo dự án mở đúng dự án, commit/duyệt quyền/gửi prompt cập nhật trạng thái, phiên mới sạch, thanh duyệt quyền ghim trên ô soạn (mobile), đăng nhập kiểm mật khẩu + thứ tự đặt mật khẩu trước 2FA + nút Quay lại, card đăng nhập không tràn, vùng chạm ≥44px trên mobile, badge cần duyệt đủ tương phản ở chủ đề sáng, một khuôn lỗi mỗi màn (Mất kết nối tách riêng), focus cho mọi phần tử bấm được, chấm "xong" xanh lá / "đang chạy" xanh dương nhấp nháy, mã khôi phục ẩn sau nút, Đăng xuất cuối Cài đặt, biểu tượng Cài đặt rõ là bánh răng, S5 có Thư mục mới, ⌘K tìm cả file, toast xác nhận sau Lưu/Commit/Đổi tên |
| 3 | 2026-11-21 | "Các thao tác với file vẫn chưa đủ để làm việc. HugRemote dành cho đối tượng chính là developer — xác định chính xác persona, trải nghiệm thêm và update lại nếu đề xuất hợp lý." | Thêm `PERSONAS §1.1` việc hằng ngày của developer. S8 làm lại: thanh bên File/Tìm, lọc tên, file ẩn, `.gitignore` mờ, tab nhiều file, tô màu cú pháp, vạch dòng mới/đã sửa, ⌘F tìm/thay + tới dòng, xem thay đổi so với commit, menu ⋯ kiểu IDE (gửi cho Claude, mở terminal tại đây, sao chép đường dẫn, nhân bản, bỏ thay đổi…), ảnh/log theo dõi/file lớn, dải "Claude vừa sửa — đã tự tải lại", xung đột có So sánh. Thêm S12 mở nhanh ⌘P (`:dòng`), ⌘⇧F, ⌘S. Đường dẫn trong thẻ công cụ Claude + output test bấm được; Git có Mở file. AC-16/17 mở rộng, thêm AC-36/37 |
| 4 | 2026-11-21 | "Tương tự hãy dùng persona và trải nghiệm thêm các màn hình khác." · "Những nút mặc định developer sẽ hiểu như pull, push, bỏ commit, thêm commit có thể dùng icon cho gọn — update thêm ở những màn khác." | Vai `power` (Files + desktop), `mobile`, `operator` chạy: 66 phát hiện. Đã sửa: quyền/model/context **riêng từng phiên** (Bypass chỉ phiên đó, có ⚠ ở cây và tab), dòng duyệt quyền không đổi sau khi ghi, Dừng ghi "Đã dừng" và Esc dừng Claude, một trạng thái phiên cho cây/⌘K/tab, tin nhắn khi đang chạy **xếp hàng** (có Huỷ), dòng tóm tắt cuối lượt (thời gian · token · chi phí · file đổi → diff), nháp giữ theo phiên, chat tự cuộn; Mất kết nối khoá gửi/duyệt/lưu/commit/push; Git mobile xem được diff, chọn tất cả, bỏ thay đổi từng file, lịch sử có danh sách file, push tắt khi không có gì; **nút icon + tooltip** cho fetch/pull/push(số commit)/stage/unstage/bỏ thay đổi/sao chép/gửi/dừng/đóng/tải lên/tải xuống ở S8 S9 S10 S7; mobile: bộ chọn phiên thay 8 tab, ô soạn gọn (tuỳ chọn sau nút ⋯, Gửi cạnh ô), thanh phím thêm F1–F12 và nhãn, chạm terminal mở bàn phím; desktop: tab có ×, ⌘1–9, Ctrl+Tab, ⌘W, ⌘⇧N/⌘⇧T, ⌘Y/⌘N, ⇧Tab, ⌘Enter commit, ⌘\\ ẩn thanh bên, bảng phím tắt ⌘/, chia ô chọn được phiên và ô Claude có ô soạn; Files: chọn phiên khi Gửi cho Claude, terminal mở đúng thư mục chứa file, URL có file:dòng, hỏi lưu khi đóng tab chưa lưu, lọc log theo mức; phân quyền: member chỉ thấy phiên của mình (S2, cây, ⌘K, route bị chặn), tắt 2FA/tạo mã mới phải nhập mã, mã khôi phục chỉ hiện một lần, không xoá được máy đang là jump host, khoá đổi phải tick xác nhận; S7 thêm thiết bị đăng nhập + đăng xuất nơi khác, thành viên + thu hồi, lần SSO bị từ chối, allowlist nhận `@tên-miền`, Tắt SSO, nhật ký trong app, xác nhận cập nhật (báo số phiên sẽ dừng, hoặc hẹn khi rảnh); S1 quên mật khẩu → lệnh CLI, đếm ngược khi bị khoá, quay về trang định mở; S3 thứ tự khớp cây, sửa máy giữ khoá/thư mục, đổi địa chỉ bắt thử lại; S5 kiểm tên thư mục |
| 5 | 2026-11-21 | "Đóng gọn lại khung chat Claude tương tự [ảnh]. Bổ sung nút target trong chat Claude: bật lên chat hiển thị trạng thái working và kết quả, tắt thì thấy toàn bộ quá trình Claude reasoning." | Ô soạn S10 làm lại thành một khung hai hàng theo ảnh (C36): ô nhập + mic + quyền; đính kèm · nút **gọn** (target) · Context token đã dùng/sức chứa (vd `227k/1000k`, không hiện %) · Hạn mức 5 giờ · Model + mức suy nghĩ · Quyền · Dừng/Gửi (mũi tên lên) — **giữ đủ mọi nút cũ, chỉ đổi cách trình bày** (Authority nhắc lại); trên điện thoại hàng nút trượt ngang, ô soạn giữ hai hàng. Thêm chế độ gọn (C37), nhớ theo người dùng, mặc định tắt |
| 6 | 2026-11-21 | "Context tôi muốn hiển thị a/b số lượng token, ví dụ 227k/1000k, không hiển thị theo %." | Chip Context ở S10 hiện token đã dùng / sức chứa context window của model đang chọn (`227k/1000k`); chuyển vàng khi vượt 80% |
| 7 | 2026-11-21 | "Icon list cạnh nút edit và chia chuyển thành nút thông báo và có thẻ duyệt hoặc từ chối trong drop list khi mở; click vào item thì đi vào session, click v là duyệt, x là từ chối." | Thay nút danh sách bằng nút thông báo C38 (chuông + số phiên cần duyệt, lấy từ mọi dự án mình được thấy). ✓/✗ duyệt ngay trong danh sách, không rời màn đang làm; bấm dòng vào phiên. Danh sách mọi phiên vẫn có ở cuối danh sách thông báo và ở bộ chọn phiên trên mobile |
| 8 | 2026-11-22 | "Tôi thấy bạn chưa sinh component. Không có DS thì pha I có thể đạt được UI như prototype không?" → "Hãy làm đầy đủ và sinh component vào `intake/design-systems/hugremote` theo template." | Lập gói design system theo template: `tokens.json` (53 token, khớp §2), `components/` C1–C38 (mỗi file: giải phẫu, trạng thái, token, biến thể, a11y, không được làm, hiện thực prototype + props pha I), `screens/` ảnh chụp; thêm route `#/_ds` trang mẫu component trong prototype; quy ước G-16 + lát 1 pha I dựng `components/ui` và so ảnh |
| 9 | 2026-11-22 | "Thanh tab của session chiều cao đang cao quá, chiếm nhiều chiều dài, cả phần header. Các nút lưu vẫn chưa dùng icon, vẫn còn label. Badge trạng thái chưa lưu — đã có icon màu trên tab name nên không cần badge nữa." | Token `--bar-h` 48→36px trên desktop (thanh trên, thanh tab phiên/file, đầu editor — kiểu Orca), token mới `--bar-h-touch` 44px gán lại dưới 1024px để giữ vùng chạm; nút Lưu file chỉ còn icon (mờ khi sạch, tô màu khi có thay đổi); bỏ huy hiệu "chưa lưu" — chấm màu trên tab là chỉ báo duy nhất. Sửa ở gói trước (`tokens.json`, C1/C8/C15/C17) rồi dịch sang context |
| 10 | 2026-11-22 | "Oke. Cập nhật component và prototype, context, prototype html rồi sang validate pha I đi." | Rà lần cuối: gói `intake/design-systems/hugremote/` (54 token, 37 component, ảnh `screens/`), `context/DESIGN-SYSTEM.md`, `PROTOTYPE.md`, `prototype/hugremote/index.html` khớp nhau. **Authority chốt** prototype + gói design system + `SOLUTION.md` phần A; khoá scope |

| 11 | 2026-11-24 | Vòng 3 (chat): phím tắt terminal, tmux ở nút +, mở đè tab mất kết nối, trình duyệt, chuyển tiếp cổng | Dựng S13, S14; S6 tmux/mất kết nối; menu + |
| 12 | 2026-11-24 | "Bỏ các dòng chữ hướng dẫn; cho tạo nhiều phiên tmux; file thêm Mở bằng trình duyệt; chuyển tiếp cho sửa port đích, điền sẵn, bấm từng cổng" | Bỏ chữ hướng dẫn; tmux tên tự đánh số; menu file; S14 ô cổng sửa được + nút từng cổng |
| 13 | 2026-11-24 | "Bỏ tìm kiếm trên header, bỏ cài đặt ở sidebar, forward port lên header, tab header chỉ icon, tên tmux không tiền tố" | Sửa header/thanh bên |
| 14 | 2026-11-24 | 14 câu làm rõ: trình duyệt thành loại phiên ở nút +, mỗi phiên một trang; chuyển tiếp hai chiều; bỏ tự động chuyển tiếp; tmux chỉ máy SSH; mất kết nối vừa tự nối lại vừa hiện nút | S13 thành phiên; S14 hai chiều; ẩn tmux ở Máy này |
| 15 | 2026-11-24 | "Thư mục không giữ trạng thái; Home chưa xem được file ẩn; ô chat ẩn chữ context/model/quyền, bỏ nút khiên; popup model có session/week limit dạng %" → "chỉ hiện trong popup" → "oke chốt prototype" | S8 Home + giữ trạng thái; S10 chip gọn; popup model thanh %; bỏ chip hạn mức |

Chốt bởi Authority: 2026-11-24
