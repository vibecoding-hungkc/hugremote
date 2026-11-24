---
type: dogfood-plan
tier: T1
last_reviewed: "2026-11-24"
---

# DOGFOOD PLAN — hugremote

> **Lập ở pha V của MỖI vòng, trước khi khoá scope** — viết lại cho vòng mới, không nối thêm (bản vòng
> trước: `context/archive/vong-N/`). `/viper-dogfood` chạy đúng theo file này. `gate.py V` kiểm §1–§3,
> `gate.py I` / `P2` kiểm §4. Danh mục vai, tín hiệu bật, luật chia đợt: skill `viper-roles`.
> **Một trang.** Authority đọc §1–§2 để biết vòng này được thử bằng con mắt nào.

Vòng: 3

## 1. Chọn vai

| Vai | Bật | Căn cứ |
|---|---|---|
| `smoke` | bật | luôn bật — luồng lõi + AC-1..52 các vòng trước + AC-53..63 vòng này |
| `newbie` | tắt | `_PROPOSAL.md §8` — vòng này không có luồng người mới (không đổi S1/S2/thẻ Bắt đầu); người dùng là P-DESK đã quen app |
| `edge` | bật | `ARCHITECTURE.md §6` delta vòng 3 — mất kết nối, tmux bị kill bên ngoài, cổng bận, máy SSH tắt khi đang chuyển tiếp, cổng không nghe |
| `picky` | bật | `PROTOTYPE.md §1` — màn mới S13, S14, header đổi (tab chỉ biểu tượng), ô chat S10 gọn; `DESIGN-SYSTEM.md §4` C39–C42 mới |
| `a11y` | bật | `PRD.md §3` AC-62 + header chỉ biểu tượng — nhãn phải còn ở `aria-label`/tooltip; S14 dùng bàn phím (ô cổng, công tắc C42) |
| `locale` | tắt | Vòng này không thêm ngày giờ/tiền/tìm theo tên; chuỗi mới đi theo luật i18n vòng 1 (CAP-UX-02), `picky` soát chuỗi chưa dịch |
| `mobile` | bật | `PERSONAS.md §1` P-MOBILE + responsive — header đổi phải giữ chữ trên điện thoại; mục tmux/trình duyệt ẩn đúng ở web điện thoại; không vỡ thanh dưới |
| `power` | bật | `PERSONAS.md §1` P-DESK dùng hằng ngày — AC-53 phím tắt trong Claude CLI/vim/tmux; nhiều tab tmux + trình duyệt; S14 nhiều chuyển tiếp |
| `rushed` | tắt | Không có form nhiều bước mới; sheet Thêm chuyển tiếp ngắn, ca bấm hai lần do `concurrent` + `edge` phủ |
| `breaker` | bật | `_PROPOSAL.md §14` — member gọi `/api/port-forwards` (403), tên tmux có `;`/`$()`, webview điều hướng ra ngoài, listener ngoài 127.0.0.1 |
| `concurrent` | bật | `ARCHITECTURE.md §6` — hai tab cùng gắn một session tmux, hai lần bật cùng một cổng, sửa cổng đích khi đang có kết nối |
| `money` | tắt | `PRD.md §7` — không thu tiền |
| `operator` | bật | `_PROPOSAL.md §12` — *Tự bật khi mở app*, khởi động lại API giữ tmux + chuyển tiếp, migration thêm cột/bảng trên dữ liệu vòng 2 |
| `integrator` | tắt | Không có API công khai / webhook / dịch vụ ngoài mới (`ssh2` forwarding là nội bộ) |

## 2. Vai bật làm gì

> **Mỗi vai một tài khoản riêng** (`<vai>@dogfood.local`, owner — trừ `breaker` dùng thêm một member SSO). Đợt 0 `smoke` một mình; đợt 1–3 tối đa 3 vai; vai ghi dữ liệu chung (`breaker`, `concurrent`, `operator`) đi đợt cuối; seed lại giữa các đợt. Phần chỉ kiểm được trên Mac (phím ⌘ thật, webview) chạy bằng Playwright Electron trên máy này và ghi rõ ở §4; Authority xác nhận trên Mac ở pha R.

| Vai | Đợt | Persona | Tài khoản | Nơi thử | Việc vòng này |
|---|---|---|---|---|---|
| `smoke` | 0 | P-DESK | `smoke@dogfood.local` | local (web + Electron) | Đi hết §3 (vòng 1–3) |
| `power` | 1 | P-DESK | `power@dogfood.local` | local Electron | AC-53 mọi tổ hợp trong `claude`, `vim`, tmux; 3 tab tmux + 2 phiên trình duyệt; S14 thêm 5 chuyển tiếp, sửa cổng đích |
| `edge` | 1 | P-DESK | `edge@dogfood.local` | local Electron | AC-55/56: tắt mạng, restart API, kill tmux bên ngoài; cổng bận; máy SSH tắt khi đang chuyển tiếp; S13 cổng không nghe |
| `picky` | 1 | P-DESK | `picky@dogfood.local` | local web 1440 | S13, S14, header, S10 chip + popup model đối chiếu prototype + C39–C42 |
| `a11y` | 2 | P-DESK | `a11y@dogfood.local` | local web | Chỉ bàn phím: tab header (biểu tượng có tên đọc được), menu +, S14 ô cổng + công tắc, popup model |
| `mobile` | 2 | P-MOBILE | `mobile@dogfood.local` | local web 390×844 | Header giữ chữ, không có mục tmux cho Máy này / không có Trình duyệt mới; S8 Home file ẩn; S10 chip gọn |
| `breaker` | 3 | P-TEAM (member) + P-HOST | `breaker@dogfood.local` | curl + web | Member → 403 forwards/listening-ports; tên tmux bậy → 400; webview `http://example.com` bị chặn; `ss -ltn` không có listener ngoài 127.0.0.1 |
| `concurrent` | 3 | P-DESK | `concurrent@dogfood.local` | 2 cửa sổ | Hai tab gắn cùng session tmux; bật cùng cổng hai lần; sửa cổng đích khi `curl` đang chạy |
| `operator` | 3 | P-HOST | `operator@dogfood.local` | CLI + Electron | Migration trên DB vòng 2; ⌘Q/mở lại 3 lần: tmux gắn lại, chuyển tiếp *Tự bật* bật lại, chuyển tiếp tắt vẫn tắt |

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
| 29 | AC-50 + AC-51 + AC-52 macOS desktop app | 2 | Khởi chạy app HugRemote trên macOS → kiểm tra đăng nhập tự động qua loopback secret → mở Terminal và Claude | App khởi động bình thường, vào thẳng không gian làm việc mà không cần nhập mật khẩu |
| 30 | AC-53 phím tắt | 3 | `claude` → gõ, ⇧Enter, gõ tiếp; ⌥⌫, ⌘⌫, ⌥←, ⌘←; bôi đen ⌘C rồi dán; bỏ chọn ⌘C | xuống dòng không gửi; xoá/nhảy đúng; dán đúng; ⌘C không chọn → Claude dừng |
| 31 | AC-54 + AC-55 tmux | 3 | + → Phiên tmux mới ×2 → `pnpm dev` ở tab 1 → ⌘Q → mở lại | hai session `demo-api`, `demo-api-2`; tab tự gắn lại, `pnpm dev` còn chạy |
| 32 | AC-56 mở lại tại chỗ | 3 | terminal thường → restart API → *Mở lại tại đây* | shell mới cùng tab, cùng tên, số tab không đổi |
| 33 | AC-57 + AC-58 chuyển tiếp | 3 | S14 → Chuyển tiếp `:5173` từ *Đang nghe*; Thêm `-R` 11434; trùng cổng 3000 | `curl localhost:5173` trên Mac OK; `curl localhost:11434` trên máy SSH OK; trùng → ô đỏ |
| 34 | AC-59 phiên trình duyệt | 3 | + → Trình duyệt mới → chip `:3000` → gõ link khác; menu file README → Mở bằng trình duyệt | trang hiện trong tab; đổi trang trong cùng tab; README render |
| 35 | AC-60 + AC-61 Files | 3 | Home → Files thấy `.ssh` → mở `.ssh` → sang Phiên → về Files → F5 | `.ssh` vẫn mở sau đổi tab và sau F5 |
| 36 | AC-62 + AC-63 ô chat | 3 | S10: xem chip; mở popup model | chip chỉ giá trị, không nút khiên, không chip hạn mức; popup có 2 thanh % + giờ reset |

## 4. Kết quả

<!-- /viper-dogfood ghi — mỗi lượt của mỗi vai một dòng. Nơi: `local` (pha I) | `production` (pha P2).
     Trình duyệt: đúng như dòng đầu báo cáo của khe (mcp__pw-slot-k__ · mobile · curl). `smoke` có hai
     dòng mỗi pha: lượt đầu (đợt 0) và lượt cuối sau khi sửa. -->

| Ngày | Vai | Nơi | Trình duyệt | Nặng | Vừa | Nhẹ | Ghi chú |
|---|---|---|---|---|---|---|---|
