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
| `picky` | 1 | P-DESK | `picky@dogfood.local` | local web 1440 | S13, S14, header, S10 chip + popup model + khung nội dung rộng + bảng/code markdown (AC-64/65) đối chiếu prototype + C39–C42 |
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
| 37 | AC-64 + AC-65 nội dung Claude | 3 | S10 ở 1600px: phiên có bảng markdown | khung nội dung rộng, ô soạn hẹp hơn; bảng có viền + tiêu đề; code block có khung |
| 38 | Gợi ý `/lệnh` (Authority sau dogfood) | 3 | S10 gõ `/` ở 1280 và 390 | tên lệnh 1 dòng, mô tả ≤2 dòng |
| 39 | Lịch sử chat Claude | 3 | nút đồng hồ cạnh chuông (S10 + header S8) → bấm phiên đang mở / phiên CLI chưa gắn / phiên vừa sửa → 🗑 phiên đang đứng | mở đúng phiên; phiên mới tên cũ; phiên vừa sửa hỏi lại; xoá → file `.jsonl` mất, về danh sách phiên dự án |
| 40 | Khung chat | 3 | S10 xem vùng quanh ô soạn | không nền ngoài; ô soạn cao ≈1.5× ô một dòng; viền gradient |
| 41 | Menu ⋯ dòng dự án | 3 | cây → dòng dự án | chỉ còn ⋯; menu: phiên mới → nhóm Dự án → tmux có sẵn |
| 42 | Hạn mức trong popup model | 3 | máy chưa có lượt → mở popup; gửi một tin → mở lại; restart API → mở lại | chưa có số → dòng giải thích; có số → 2 thanh %; còn sau restart |
| 43 | Tự nối lại | 3 | terminal → `setOffline` 80s → bật mạng → gõ lệnh | không hiện "Phiên đã kết thúc"; lệnh chạy |
| 44 | S14 mở bằng trình duyệt ngoài | 3 | bật một chuyển tiếp SSH → local | có nút ↗ "Mở bằng trình duyệt ngoài" (+ 🌐 trong Electron) |
| 45 | Git repo lồng nhau | 3 | dự án có repo con + dự án Home | danh sách repo đủ, nhánh + số thay đổi; chọn → diff/commit/lịch sử đúng repo; nhớ sau F5; ≤5.5 dòng rồi cuộn |
| 46 | Electron: khung web + menu | 3 | app desktop: S13 ở zoom ≠ 100%; mở ⋯ cây khi đang ở S13 | khung web vừa ô; menu không bị che |

## 4. Kết quả

<!-- /viper-dogfood ghi — mỗi lượt của mỗi vai một dòng. Nơi: `local` (pha I) | `production` (pha P2).
     Trình duyệt: đúng như dòng đầu báo cáo của khe (mcp__pw-slot-k__ · mobile · curl). `smoke` có hai
     dòng mỗi pha: lượt đầu (đợt 0) và lượt cuối sau khi sửa. -->

| Ngày | Vai | Nơi | Trình duyệt | Nặng | Vừa | Nhẹ | Ghi chú |
|---|---|---|---|---|---|---|---|
| 2026-11-25 | smoke | local | mcp__pw-slot-1__ | 1 | 1 | 12 | Lượt đầu (đợt 0): 30/37 PASS · FAIL #32 AC-56 nút *Mở lại tại đây* bị xterm che, #33 AC-57 trùng cổng chỉ toast — đã sửa (`.ended-cover` absolute, `Field` lỗi ngay ô) · BLOCKED #18 install.sh, #19 cập nhật, #29/#34 cần Mac, mic (origin không an toàn) · chạy tuần tự, trình duyệt Mac qua IP LAN (DECISIONS 2026-11-25) |
| 2026-11-25 | power | local | mcp__pw-slot-1__ | 0 | 4 | 8 | AC-53 đúng byte trong bash/tmux/S10; 5 chuyển tiếp ±L/R + sửa cổng đích OK · đã sửa: nhãn `tmux trên <máy>`, focus ô soạn khi đổi tab bằng phím, sheet S14 Enter/Esc + `role=dialog` + `-R` tự điền cổng, bộ lọc S14 theo máy đã ghim · vim không có trong container (BLOCKED), webview cần Mac |
| 2026-11-25 | edge | local | mcp__pw-slot-1__ | 1 | 6 | 7 | Nặng: máy SSH tắt → `uncaughtException` ssh2 làm API thoát — đã sửa (`ssh-pool.ts` listener `error` thường trực + `client.end()`), đo lại: pause 90 giây API sống, chuyển tiếp `err` rồi tự về `on` · đã sửa vừa: replay nối lại ghi chồng (reset trước replay), phiên thoát thật báo "Phiên đã kết thúc" + dải đáy, `-R` cổng bận → 409, `-L` cổng không ai nghe giữ `err` có câu Việt, link sâu phiên web trên web thường → errorBox Q-8 · S13 BLOCKED (cần Mac) |
| 2026-11-25 | picky | local | mcp__pw-slot-1__ | 0 | 3 | 8 | 27 màu đo đều trong §2.1, không trộn DS · 11/13 cặp tương phản đạt (viền chip 1.28, rãnh C42 tắt 1.19 — giống prototype) · chip chia ô 1280 đã hết cắt · đã sửa: dòng lỗi C40 đỏ, nút Chuyển tiếp ở *Đang nghe* khoá khi gửi, lỗi chuyển tiếp thành mã + i18n, khuôn lỗi S14 có dòng hai, nút Phím tắt trên header, khoảng 16px sheet Thêm · C39/S13 BLOCKED (cần Mac) |
| 2026-11-25 | a11y | local | mcp__pw-slot-1__ | 1 | 3 | 4 | Nặng: không chọn được model bằng bàn phím, Esc không đóng popup — đã sửa (Enter/Space, focus mục đang chọn, ↑↓, Esc trả focus về chip, chip có tên kèm giá trị + `aria-haspopup/expanded`) · đã sửa vừa: `useModalFocus` cho Menu/Dialog/sheet S14 (focus vào trong, bẫy Tab, trả focus về nút mở, Home/End) · vòng focus 2px 8,6:1 đạt |
| 2026-11-25 | mobile | local | mcp__pw-slot-1__ | 0 | 4 | 4 | 390×844: header giữ chữ, Máy này không có tmux/Trình duyệt mới, Home hiện file ẩn, chip gọn, duyệt quyền chạm 44px · đã sửa: menu nổi đo chiều cao thật + lật lên (`Overlay.tsx`), chip ô chat xuống dòng trên điện thoại (chip quyền luôn thấy), hàng S14 xuống dòng, trạng thái rỗng bẻ đường dẫn dài · không bật được `hasTouch` (pointer: coarse không đo) |
| 2026-11-25 | breaker | local | mcp__pw-slot-1__ | 3 | 1 | 3 | 21 ô ✗ thử, 18 chặn đúng · Nặng: member gắn vào / giết / liệt kê tmux của owner qua `new-session -A` trùng tên — đã sửa (`assertTmuxAccess`, `tmuxHolders`, `tmuxSessions` lọc theo người gọi, `tmuxFresh` server chọn tên trống) · vừa: phiên web nhận `file://` ngoài dự án — đã sửa (`checkWebUrl` theo `rootPath`, decode `%2f`) · nhẹ: cổng 0, tên tmux mở đầu `-` — đã sửa · mọi listener 127.0.0.1 |
| 2026-11-25 | breaker | local | mcp__pw-slot-1__ | 0 | 0 | 2 | Kiểm lại sau sửa: 7/7 ca từng FAIL nay PASS (member 403 khi gắn tmux người khác, xoá phiên không kill session còn người giữ, `tmux-sessions` lọc đúng, `tmuxFresh` → tên mới, `file://` ngoài dự án 400, `-t` 400) |
| 2026-11-25 | concurrent | local | mcp__pw-slot-1__ | 2 | 2 | 2 | Chuyển tiếp chịu tranh chấp tốt (6 POST song song → 1×201 + 5×409, rebind không lúc nào hai/không cổng nghe) · Nặng: tạo tmux đồng thời trùng tên, *Mở lại* đồng thời rò shell — đã sửa (`serial` cho create tmux/reopen/gắn lại lười; đo lại: `race` + `race-2`, 409 + 201 một shell) · vừa: chọn cùng session có sẵn → trả phiên đã có; xoá phiên phát `session_status` để thiết bị khác tự gỡ — đã sửa |
| 2026-11-25 | operator | local | mcp__pw-slot-1__ | 0 | 3 | 6 | DB vòng 2 (commit 5253a18) → bản hiện tại: 4 migration, không mất dữ liệu, mật khẩu + 2FA cũ dùng được · tmux gắn lại qua 3 lần restart · đã sửa vừa: *Tự bật* ghi đè lựa chọn Tắt, cổng bận lúc khởi động → `err` không mã/không thử lại (giờ `LOCAL_PORT_IN_USE` + log + tick thử lại), dải "tmux đã bị đóng bên ngoài, đã tạo mới" (notice WS) · Electron ⌘Q BLOCKED (cần Mac) |
| 2026-11-25 | smoke | local | mcp__pw-slot-1__ | 0 | 1 | 5 | Lượt cuối: 32/37 PASS · 0 FAIL · BLOCKED #18 install.sh, #19 cập nhật, #29/#34 cần Mac, phần cập nhật #28 · mọi bản sửa đợt 1–3 giữ đúng (hồi quy sạch) · khe đã `--isolated` · F1 vừa: terminal thường `running` không PTY → nối lại mãi — đã sửa (`attach` ghi `exited` + sự kiện; đo lại: 1 lần xin vé, "Phiên đã kết thúc") |
| 2026-11-25 | smoke | local | mcp__pw-slot-1__ | 1 | 2 | 6 | Lượt đầu, dogfood lại yêu cầu bổ sung Authority (§3 #38–46 + #1/#12/#15/#33): 11/13 PASS · FAIL #42 `claude-limits.json` ghi chồng async → hỏng, mất số sau restart — đã sửa (ghi đồng bộ + rename, log khi đọc hỏng) · BLOCKED #46 cần Electron · vừa: `/sessions` báo "chưa có phiên" khi dự án có phiên → chuyển vào phiên đầu; repo con hiện như file chưa theo dõi của repo cha (stage được thành gitlink) → API bỏ `?? dir/` + "stage tất cả" loại repo con · nhẹ đã sửa: file chưa theo dõi `+0 −0`, popup hạn mức rộng 627px, danh sách repo không cuộn tới dòng chọn · ghi lại: S14 nhãn tiến trình cũ khi cổng đích đã tắt, chip ô soạn 2 hàng ở 390 |
| 2026-11-25 | picky | local | mcp__pw-slot-1__ | 0 | 3 | 8 | Yêu cầu bổ sung (#38–45) ở 1100×680: 0 màu lạ, không trộn DS, 14/14 cặp tương phản đạt; gradient `.cbox` đúng 3 token, ô soạn 57.6px = 1.5×, `.repolist` 242px · đã sửa: hộp thoại `danger` thiếu viền đỏ C9 (CSS chỉ có `.warn`), lỗi `git/repos` hiện như "chưa có repo" → ErrorBox + Thử lại, ô "cổng khác" S14 bị cắt ở sheet 550px, dòng repo gốc thiếu tên dự án, dòng hạn mức đổi nền khi hover (`.mi.static`), tab đang chọn không cuộn vào tầm nhìn · ghi lại: S9 rỗng thiếu nút git init, 🗑 lồng trong menuitem, menu ⋯ cao che nút mở, ↓ trong gợi ý `/`, skeleton 4 hàng |
| 2026-11-25 | a11y | local | mcp__pw-slot-1__ | 1 | 5 | 4 | Chỉ bàn phím, yêu cầu bổ sung (#38–45) · Nặng: nút 🗑 lịch sử Claude không tới được bằng bàn phím → Delete/⌫ trên dòng = xoá (`aria-keyshortcuts`) · đã sửa: lần mở lịch sử đầu focus kẹt ở nút (tải xong mới mở menu, `aria-haspopup/expanded`), gợi ý `/` thêm ↑↓ + `aria-activedescendant`/`aria-selected`, repo Git thành `listbox`/`option` một điểm dừng Tab + ↑↓ + Space, trả focus sau khi đổi repo, Enter trên ⋯ cây không còn chuyển trang, nút ↗ S14 có số cổng trong tên · giữ: Shift+Tab trong ô chat đổi chế độ quyền (giống Claude CLI — DECISIONS vòng 1) · ghi lại: cây chưa có ↑↓/`aria-level`, dòng hạn mức không phải menuitem, menu chưa có tên |
| 2026-11-25 | mobile | local | mcp__pw-slot-1__ | 0 | 2 | 7 | 390×844 (+390×500 giả bàn phím, 360×640): không tràn ngang, nút ≥44px, 🗑 lịch sử không chạm nhầm dòng, `.repolist` cuộn riêng · đã sửa: back điện thoại rời Git thay vì đóng ô diff (đẩy mục lịch sử khi mở ô), tên lệnh `/` dài ép mô tả (`max-width:45%`), thanh diff ghi repo, ẩn `kbd` trong menu ở ≤767px · ghi lại: nút ↗ S14 mở nhầm máy khi vào HugRemote qua đường hầm `-L` (giới hạn đã nêu ở DECISIONS), chip ô soạn 2–3 hàng, bàn phím + gợi ý `/` đẩy đáy ô soạn, bộ chọn phiên cắt tên ở 360, Home nhiều repo còn ~110px cho file, menu ⋯ che dòng vừa chạm |
| 2026-11-25 | edge | local | mcp__pw-slot-1__ | 0 | 6 | 5 | Ca biên #39/#42/#43/#45: thư mục lịch sử chưa có, tiêu đề 1000 ký tự/HTML, resume đúp → 1 phiên, hạn mức `resetAt` quá khứ + JSON hỏng → "chưa có số" + log, tmux tự nối lại sau restart API, repo sâu 4/5 cấp, node_modules, submodule, repo bị xoá ngoài → đạt · đã sửa: repo con tên tiếng Việt/dấu cách bị tính là thay đổi của repo cha (`core.quotePath=false`), trần 200 repo cắt im lặng (nông trước + dòng "còn N repo"), Lịch sử repo chưa commit kẹt skeleton, terminal thường sau restart API kẹt "Mất kết nối" (4404 → "Phiên đã kết thúc" + làm mới danh sách), lượt Claude bị ngắt hiện "exit null" → câu tiếng Việt, xoá phiên đang đứng văng về "/" (chuyển trang + gỡ cache cùng nhịp) + cảnh báo khi Claude đang chạy, file lịch sử rỗng/hỏng không còn hiện · ghi lại: tiêu đề bắt đầu bằng `<` bị bỏ, HEAD rời ghi "Push sẽ tạo", Fetch repo vừa bị xoá nháy "chưa có repo", thanh tmux lệch 2 dòng sau nối lại |
| 2026-11-25 | breaker | local | mcp__pw-slot-1__ | 3 | 2 | 2 | curl, owner 4717 + member SSO `an@nhom.vn` (8112): 9 ô ✗ thử, 7 chặn đúng · Nặng: `git/diff --no-index` đọc mọi file trên máy kể cả `secret.key` (từ vòng 1) → kiểm `path` tương đối trong repo (`rel()`, cả stage/discard); xoá lịch sử CLI bằng cliId viết hoa lách kiểm chủ phiên; `resumeCliId` của owner trả DTO phiên owner → chữ thường hoá cliId + `owned()` · vừa: 20 `git/repos` song song → 14×500 (MaxSessions) → dùng chung một lượt quét/dự án + lỗi `find` báo lỗi thay vì danh sách thiếu; symlink trong dự án SSH ra ngoài → giữ (DECISIONS) · nhẹ đã sửa: pathspec `:(exclude)` kéo repo con thành gitlink, cliId toàn `-`, desktop `will-navigate` mở mọi scheme · kiểm lại bằng curl: diff `/etc`/`secret.key`/`~` → 403, 20×repos → 200 |
