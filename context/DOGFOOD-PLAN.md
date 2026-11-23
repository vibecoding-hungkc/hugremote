---
type: dogfood-plan
tier: T1
last_reviewed: "2026-11-21"
---

# DOGFOOD PLAN — hugremote

> **Lập ở pha V của MỖI vòng, trước khi khoá scope** — viết lại cho vòng mới, không nối thêm (bản vòng
> trước: `context/archive/vong-N/`). `/viper-dogfood` chạy đúng theo file này. `gate.py V` kiểm §1–§3,
> `gate.py I` / `P2` kiểm §4. Danh mục vai, tín hiệu bật, luật chia đợt: skill `viper-roles`.
> **Một trang.** Authority đọc §1–§2 để biết vòng này được thử bằng con mắt nào.

Vòng: 1

## 1. Chọn vai

<!-- MỌI vai trong danh mục (.claude/skills/viper-roles/roles/) một dòng — tắt cũng phải có căn cứ, để
     thấy là đã cân nhắc chứ không phải quên. Không vai nào bật mặc định, TRỪ `smoke` — luôn bật.
     Cột Bật: `bật` | `tắt`. Căn cứ trỏ tín hiệu thật, kèm file + mục:
       | `mobile` | tắt | PERSONAS §1 — cả hai persona dùng máy tính tại quầy; PRD không đòi responsive |
       | `money`  | bật | PRD §7 — thu cọc 50.000 ₫ khi đặt lịch, vòng này đưa thanh toán vào |
     Có experience ở ARCHITECTURE §3 (app mobile) → `mobile` phải bật. Marker KHÔNG CÓ UI →
     `picky`, `mobile`, `a11y` phải tắt. Vai ngoài danh mục: thêm thẻ trước (viper-roles §5). -->

| Vai | Bật | Căn cứ |
|---|---|---|
| `smoke` | bật | luôn bật — luồng lõi và mọi AC đã giao không được gãy |
| `newbie` | bật | PERSONAS §1 P-HOST — lần đầu cài, đăng nhập bằng mật khẩu khởi tạo, bắt đổi mật khẩu, thêm máy (PRD §3 AC-1, AC-5) |
| `edge` | bật | ARCHITECTURE §6 — máy SSH chết, ssh config lỗi, mất WS; PRD §7 trạng thái rỗng/lỗi của mọi màn |
| `picky` | bật | DESIGN-SYSTEM mới chốt ở vòng này, hai chủ đề; AC-13, AC-27 đòi mọi giá trị hình thức từ token |
| `a11y` | tắt | PERSONAS §1 — người dùng là lập trình viên, không yêu cầu trợ năng riêng; tương phản AA đã do gate tính ở pha V; bàn phím desktop do `power` soi |
| `locale` | bật | PRD §3 AC-27 (vi/en đủ), AC-26 (tìm không dấu), AC-24 (giọng nói theo ngôn ngữ, IME Telex/VNI); giờ commit/phiên (SOLUTION G-9) |
| `mobile` | bật | PERSONAS §1 P-MOBILE — thiết bị chính điện thoại; AC-11 thanh phím + visualViewport |
| `power` | bật | PERSONAS §1 P-DESK — dùng hằng ngày, nhiều phiên song song; AC-10 chia đôi |
| `rushed` | bật | PRD §3 AC-5 — form thêm/sửa máy, đăng nhập nhiều bước (AC-1, AC-3) |
| `breaker` | bật | PERSONAS §2 — cột ✗ (member, chưa đăng nhập, chưa qua 2FA); ô nhập máy/đường dẫn/prompt; AC-14, AC-34 |
| `concurrent` | bật | ARCHITECTURE §6 — hai thiết bị cùng phiên terminal/Claude, duyệt quyền hai nơi, sửa file đồng thời (`FILE_CHANGED`), sửa `~/.ssh/config` đồng thời |
| `money` | tắt | PRD §7 — không thu tiền |
| `operator` | bật | PERSONAS §1–§2 — P-HOST quản trị instance: SSO + allowlist (AC-32), phân quyền member (AC-33), cập nhật (AC-31), nhập v1 (AC-30), Hệ thống (AC-15), thiết bị (AC-44), quản trị nhóm (AC-45), nhật ký (AC-46), quên mật khẩu (AC-47) |
| `integrator` | bật | ARCHITECTURE §9 — tích hợp ngoài: IdP OIDC/Google (AC-32), Claude CLI trên máy đích (AC-20..25), kênh phát hành (AC-31), dữ liệu v1 (AC-30) |

## 2. Vai bật làm gì

> **Mỗi vai một instance riêng** (DATA_DIR + cổng riêng 8101–8112, DECISIONS 2026-11-21) — mỗi instance có đúng một
> owner nên tài khoản owner của vai là `<vai>@inst-<cổng>`; `breaker`/`operator` thêm tài khoản **member** (SSO
> Keycloak) trên cùng instance. Container `sshd` + `jump` + `keycloak` dùng chung, mỗi instance một thư mục dự án riêng.

| Vai | Đợt | Persona | Tài khoản | Nơi thử | Việc vòng này |
|---|---|---|---|---|---|
| `smoke` | 0 | P-MOBILE | `smoke@inst-8101` | localhost:8101 · 1440×900 rồi 390×844 | đi hết §3 |
| `newbie` | 1 | P-HOST | `newbie@inst-8102` | localhost:8102 · instance trống | `install.sh` trong container sạch → mật khẩu khởi tạo → đổi mật khẩu → thẻ Bắt đầu (AC-28) → thêm máy → dự án → hỏi Claude, không đọc tài liệu |
| `edge` | 1 | P-MOBILE | `edge@inst-8103` | localhost:8103 · Slow 4G, tắt `sshd`/`keycloak` giữa chừng | rỗng · lỗi · đang tải ở S2/S3/S5/S6/S8/S9/S10; mất WS/SSE → C13 + nối lại; Claude CLI không có; file >10MB |
| `picky` | 1 | P-DESK | `picky@inst-8104` | localhost:8104 · 1440×900 + 390×844, tối và sáng | S1–S12 so với gói `intake/design-systems/hugremote/` (ảnh `screens/`, đặc tả `components/`, trang mẫu `#/_ds`): màu, chữ, nhịp, trạng thái bắt buộc C1–C38, hai chủ đề |
| `mobile` | 2 | P-MOBILE | `mobile@inst-8105` | localhost:8105 · 390×844, 360×740 | thanh phím terminal, phím phụ editor, duyệt quyền Claude bằng một tay, Git danh sách → chi tiết, ô soạn + mic, sheet thêm máy |
| `locale` | 2 | P-MOBILE | `locale@inst-8106` | localhost:8106 · English rồi Tiếng Việt | AC-27 không chuỗi chưa dịch; ⌘K "viet" khớp "Việt"; gõ Telex trong ô soạn Claude + chuyển nhanh không gửi sớm; giờ commit/phiên đúng định dạng |
| `power` | 2 | P-DESK | `power@inst-8107` | localhost:8107 · 1440×900 | vòng việc developer ở `PERSONAS §1.1` bằng bàn phím (⌘P, ⌘⇧F, ⌘F, ⌘S, ⌘K); 10 phiên terminal + 5 phiên Claude, chia ô Claude+Git / Terminal+Files, ⌘K; đếm thao tác tới phiên cần duyệt (≤3) |
| `rushed` | 3 | P-HOST | `rushed@inst-8108` | localhost:8108 | bấm hai lần: Lưu máy, Đăng nhập, Gửi prompt, Commit, Cập nhật; Back giữa form; đóng tab khi đang tải lên |
| `integrator` | 3 | P-HOST | `integrator@inst-8109` | localhost:8109 · Keycloak, `fake-claude`, kênh phát hành giả, dữ liệu v1 mẫu | SSO đăng nhập/đăng xuất, IdP chết; Claude CLI trả giao thức lạ; cập nhật lên tag mới + bản lỗi tự quay lại; nhập v1 chạy hai lần |
| `concurrent` | 3 | P-MOBILE + P-DESK | `concurrent@inst-8110` | localhost:8110 · hai trình duyệt | cùng phiên terminal/Claude trên hai thiết bị; duyệt quyền cả hai nơi; sửa cùng file với Claude (`FILE_CHANGED`); hai nơi sửa một máy (409) |
| `breaker` | 4 | P-HOST + P-TEAM | `breaker@inst-8111` (owner) + `an@nhom.vn` (member) | localhost:8111 + curl/wscat | PERSONAS §2 cột ✗; WS/SSE không vé/vé cũ/Origin lạ; `../`, symlink; khoá bí mật trong JSON; tiêm shell vào alias/proxyJump/đường dẫn git; cấu hình SSO khi chưa đăng nhập; SSRF discover |
| `operator` | 4 | P-HOST + P-TEAM | `operator@inst-8112` (owner) + `binh@nhom.vn` (member) | localhost:8112 | bật SSO + allowlist (`@nhom.vn`), member chỉ thấy phiên của mình (cây, S2, chuông, ⌘K, URL), owner thấy mọi phiên; thu hồi member, lần SSO bị từ chối, Tắt SSO; thiết bị đăng nhập; nhật ký; cập nhật (xác nhận số phiên / Khi rảnh); `hugremote reset-password`; báo cáo nhập v1; Hệ thống/doctor |

## 3. Danh sách smoke hồi quy

| # | Luồng / AC | Từ vòng | Bước kiểm | Kỳ vọng |
|---|---|---|---|---|
| 1 | Luồng lõi — đăng nhập → cây → terminal SSH chạy nền (AC-9) | 1 | đăng nhập (mật khẩu + 2FA) → chạm `demo-sshd › demo-api` → mở terminal, `htop` → đóng trình duyệt, mở ở 390×844, chạm phiên | htop vẫn chạy, đúng kích thước, không chữ chồng |
| 2 | AC-1 lần đầu đổi mật khẩu | 1 | instance mới → mật khẩu khởi tạo → đặt mật khẩu 10+ ký tự | vào S2; gọi API trước khi đổi → 403 |
| 3 | AC-2 đăng xuất + phiên bền | 1 | Cài đặt → Đăng xuất → đăng nhập lại → restart service → mở app | về S1 sau đăng xuất; không phải đăng nhập lại sau restart |
| 4 | AC-3 2FA | 1 | bật 2FA → đăng xuất → đăng nhập với mã → lần sau dùng một mã khôi phục | vào được; mã khôi phục dùng lại bị từ chối |
| 5 | AC-4 danh sách máy | 1 | mở S3 | có Máy này + `demo-sshd` (từ file Include); JSON không có bí mật |
| 6 | AC-5 + AC-6 thêm máy qua jump + host key | 1 | thêm `demo-behind-jump` qua `demo-jump` → Thử kết nối → Tin máy này | "Kết nối thành công"; lần sau không hỏi lại |
| 7 | AC-6 host key đổi | 1 | đổi khoá container → kết nối lại | S4 cảnh báo đỏ; không kết nối cho tới khi xác nhận |
| 8 | AC-7 + AC-8 dự án + ghim | 1 | Dự án mới → chọn `~/projects/demo-api` → F5; ghim và đổi thứ tự máy → mở tab khác | dự án được chọn sau F5; thứ tự giống nhau ở tab khác |
| 9 | AC-10 chia đôi | 1 | desktop: mở 2 phiên → Chia đôi → kéo vạch | hai terminal vừa khung |
| 10 | AC-11 thanh phím mobile | 1 | 390×844: Ctrl rồi C, mở ngăn → `ls -la ↵` | lệnh chạy; dòng con trỏ không bị che |
| 11 | AC-14 + AC-15 | 1 | `curl /api/hosts` không token; `GET /api/health`; `make doctor` | 401; 200 `{status:"ok"}`; doctor không báo thiếu |
| 12 | **Luồng lõi Claude** — AC-20 + AC-21 | 1 | `demo-sshd › demo-api` → Hỏi Claude "pwd và thêm API" → đóng tab giữa chừng → mở ở 390×844 → thẻ xin quyền → Cho phép → Dừng | `pwd` = thư mục dự án; stream tiếp không lặp; Claude chạy tiếp sau khi cho phép; "Đã dừng" |
| 13 | AC-22 + AC-23 | 1 | đổi model + effort; mở danh sách phiên → tiếp tục phiên tạo từ CLI | model lấy từ CLI; phiên CLI tiếp tục được |
| 14 | AC-16 + AC-17 + AC-36 + AC-37 | 1 | bấm `file:dòng` trong Claude → sửa → ⌘S; ⌘P `spec:3`; ⌘⇧F `booking`; ⋯ → Sao chép đường dẫn; tải lên/xuống thư mục | mở đúng dòng; lưu được; tìm ra đúng file/dòng; zip đúng cấu trúc |
| 15 | AC-18 + AC-19 | 1 | Git: thấy file vừa sửa → diff → stage → commit → push; mở Lịch sử → xem commit | commit lên remote; lịch sử có commit mới |
| 16 | AC-26 + AC-35 | 1 | ⌘K "dat lich" → Enter; desktop chia ô Claude + Git | mở đúng phiên ≤3 thao tác; hai ô cạnh nhau |
| 17 | AC-27 + AC-28 | 1 | instance mới → thẻ Bắt đầu; Cài đặt → Sáng + English | thẻ tự đánh dấu bước; không chuỗi chưa dịch |
| 18 | AC-29 + AC-30 | 1 | container sạch có dữ liệu v1 → `install.sh` → nhập v1 → đăng nhập bằng mật khẩu + 2FA cũ | dịch vụ chạy; dự án/phiên v1 có mặt |
| 19 | AC-31 | 1 | Cài đặt → Cập nhật lên tag mới; thử tag lỗi | tiến độ từng bước; bản lỗi tự quay lại |
| 20 | AC-32 + AC-33 | 1 | owner bật SSO (Keycloak) → member đăng nhập → mở phiên; member gọi phiên của owner | member vào được, chỉ thấy phiên của mình; 403 |
| 21 | AC-24 + AC-25 + AC-34 | 1 | gõ `/` + đính kèm + mic; xem hạn mức; `make test` bộ `security.e2e` | gợi ý hiện; chip "Hạn mức 5 giờ x%", tooltip tuần + giờ reset khi CLI có; pentest PASS |
| 22 | AC-12 + AC-13 điều hướng + token | 1 | desktop: cây chỉ mở thứ đang dùng → bấm dự án → về đúng tab lần trước; dự án chưa có phiên → 2 nút; mobile 390×844: bộ chọn phiên; đổi tên phiên | một lối tới mỗi thứ; Back đúng; không giá trị màu/cỡ ngoài token |
| 23 | AC-38 chuông | 1 | hai phiên Claude ở hai dự án cùng xin quyền → đang ở S8 mở chuông → ✓ phiên A, ✗ phiên B; bấm dòng còn lại | số trên chuông đúng; dòng biến mất sau ✓/✗; bấm dòng vào đúng phiên; không rời S8 khi duyệt |
| 24 | AC-39 + AC-40 + AC-41 + AC-42 cấu hình phiên, xếp hàng, tóm tắt, gọn | 1 | phiên A bật Bypass (xác nhận), phiên B giữ Manual; ở A gửi 2 tin khi đang chạy → đóng mọi trình duyệt → mở lại; Esc; bật gọn | ⚠ chỉ ở A; 2 tin tự chạy lần lượt dù đã đóng trình duyệt; Esc dừng, hàng chờ còn; dòng tóm tắt có token/chi phí/file → diff; gọn nhớ sau F5 |
| 25 | AC-43 mất kết nối | 1 | đang soạn prompt + sửa file chưa lưu → `setOffline` → bấm Gửi, Lưu, Commit, ✓ ở chuông → bật mạng | C13 hiện; mọi nút ghi khoá; nháp + bản sửa còn; nối lại không tự gửi |
| 26 | AC-33 + AC-45 + AC-46 quản trị S7 | 1 | owner: Thành viên → Thu hồi `binh@nhom.vn`; email lạ đăng nhập SSO → Lần bị từ chối → Cho phép; allowlist `@nhom.vn`; Nhật ký SSH; member (tài khoản thứ hai) mở ⌘K, chuông, URL phiên của owner | binh bị đăng xuất, phiên dừng; email lạ vào được sau Cho phép; nhật ký không lộ bí mật; member không thấy phiên owner ở mọi nơi, URL về S2 |
| 27 | AC-44 + AC-47 + AC-48 thiết bị, quên mật khẩu, link sâu | 1 | đăng nhập 2 trình duyệt → Thiết bị → đăng xuất trình duyệt kia; `hugremote reset-password` → đăng nhập mật khẩu tạm; mở link `…/files/src/app.ts/12` khi chưa đăng nhập; sai mật khẩu 5 lần | trình duyệt kia về S1; bị bắt đổi mật khẩu, 2FA còn; về đúng file dòng 12; đếm ngược mm:ss |
| 28 | AC-5 + AC-31 + AC-49 máy an toàn, cập nhật, phím tắt | 1 | xoá `demo-jump` (đang là jump); sửa `demo-sshd` để trống khoá; Cập nhật khi có 2 phiên chạy → Khi rảnh; ⌘/ ở tab thường rồi PWA, ⌥1/⌥W | chặn xoá, nêu máy phụ thuộc; khoá giữ nguyên; hộp nêu 2 phiên, run "Đang chờ" rồi chạy khi rảnh; bảng phím đúng môi trường |

## 4. Kết quả

<!-- /viper-dogfood ghi — mỗi lượt của mỗi vai một dòng. Nơi: `local` (pha I) | `production` (pha P2).
     Trình duyệt: đúng như dòng đầu báo cáo của khe (mcp__pw-slot-k__ · mobile · curl). `smoke` có hai
     dòng mỗi pha: lượt đầu (đợt 0) và lượt cuối sau khi sửa. -->

| Ngày | Vai | Nơi | Trình duyệt | Nặng | Vừa | Nhẹ | Ghi chú |
|---|---|---|---|---|---|---|---|
| 2026-11-22 | smoke | local | mcp__pw-slot-1__ | 8 | 6 | 13 | đợt 0: 19/28 PASS, luồng lõi terminal + Claude đi hết; FAIL dòng 6, 10, 14, 19, 22, 25, 26, 28 (+ phần chưa kiểm được ở 19) |
| 2026-11-23 | newbie | local | pw-slot-1/ | 1 | 4 | 3 | đợt 1: đi hết luồng lần đầu (đổi mật khẩu, S2/S3/S4/S5, Terminal, Claude `hỏi phương án`); phát hiện trạng thái S3 `đang nối` không tự cập nhật sau S4, trùng 2 chuông tab Phiên, dòng "Claude đang làm" khi chờ trả lời |
| 2026-11-23 | edge | local | pw-slot-2/ | 0 | 4 | 4 | đợt 1: file >10MB + offline/online C13 + khoá ghi + giữ nháp ĐẠT; phát hiện hàng chờ Claude tự chạy tiếp sau `Lượt lỗi`, Git leo ngược vượt `ALLOWED_ROOT`, S3 báo nhầm lỗi SSH config khi mất mạng |
| 2026-11-23 | picky | local | pw-slot-3/ | 1 | 6 | 4 | đợt 1: 54/54 token khớp `tokens.json`, 0 màu trộn DS, 0/12 tràn ngang; phát hiện tương phản `span.meta.warn` chủ đề Sáng 4.32:1, S8 thiếu C5 khi lỗi API, C23 mục Bỏ thiếu đỏ, S3 sheet & S12 thiếu Esc, S1 mất Quên mật khẩu khi sai |
| 2026-11-23 | mobile | local | pw-slot-1/ | 2 | 2 | 1 | đợt 2: S1–S3, S6 keybar, S9 diff, S10 slash/attach/askbar PASS ở 390×844 & 360×740; phát hiện S8 kẹt không mở lại được file vừa thoát, S8 thiếu `.edkeys`, S6 nút mở ngăn phím bị đẩy ngoài 390px, vài nút <44px |
| 2026-11-23 | locale | local | pw-slot-2/ | 0 | 2 | 3 | đợt 2: vi↔en giữ qua F5, ⌘K tìm không dấu, IME `isComposing` PASS; phát hiện S7 Health còn chuỗi vi cứng và S9 Git History dùng cứng `vi-VN` khi ở chế độ en |
| 2026-11-23 | power | local | pw-slot-3/ | 0 | 1 | 3 | đợt 2: ⌘K ≤3 thao tác, ⌘P/⌘⇧F/⌘F/⌘S/⌘//⌘\, chia ô giữ tỉ lệ 71% qua F5, AC-39..42, AC-37 PASS; phát hiện chip `Quyền Không hỏi gì` bị tràn sát nút Gửi, icon ⚠ Bypass ở cây/tab màu vàng thay vì đỏ |
| 2026-11-23 | rushed | local | pw-slot-1/ | 0 | 2 | 1 | đợt 3: bấm đúp Đăng nhập/Lưu máy/Gửi Claude/Commit Git đều chỉ bắn 1 request (không trùng); phát hiện nút Lưu S8 Files chưa khoá khi bấm đúp 37ms (gây 404 thừa), Back giữa form S3 mất nháp |
| 2026-11-23 | integrator | local | pw-slot-2/ | 0 | 1 | 2 | đợt 3: Keycloak OIDC (allowlist + `sso_denials`), Claude CLI SSH (agent con, AskUserQuestion, Context 31k/1000k, hạn mức 81%), `import-v1` chạy 2 lần idempotent 100% PASS; phát hiện S7 Hệ thống chưa thấy tag mới và thiếu nút kiểm tra thủ công |
| 2026-11-23 | concurrent | local | pw-slot-3/ | 0 | 0 | 2 | đợt 3: 4/4 kịch bản đồng thời Desktop+Mobile ĐẠT — terminal realtime, duyệt quyền chênh 24ms trả 204/409 đồng bộ UI, sửa file `FILE_CHANGED` 409, đăng xuất thiết bị kia ở S7 |
