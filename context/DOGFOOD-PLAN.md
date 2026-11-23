---
type: dogfood-plan
tier: T1
last_reviewed: "2026-11-23"
---

# DOGFOOD PLAN — hugremote

> **Lập ở pha V của MỖI vòng, trước khi khoá scope** — viết lại cho vòng mới, không nối thêm (bản vòng
> trước: `context/archive/vong-N/`). `/viper-dogfood` chạy đúng theo file này. `gate.py V` kiểm §1–§3,
> `gate.py I` / `P2` kiểm §4. Danh mục vai, tín hiệu bật, luật chia đợt: skill `viper-roles`.
> **Một trang.** Authority đọc §1–§2 để biết vòng này được thử bằng con mắt nào.

Vòng: 2

## 1. Chọn vai

| Vai | Bật | Căn cứ |
|---|---|---|
| `smoke` | bật | luôn bật — luồng lõi và mọi AC đã giao không được gãy |
| `newbie` | bật | PERSONAS §1 P-HOST — lần đầu cài ứng dụng desktop từ file .dmg, kiểm tra tự động đăng nhập loopback không cần mật khẩu |
| `edge` | bật | ARCHITECTURE §6 — cổng loopback bị chiếm, API crash giữa chừng, mất kết nối local PTY |
| `picky` | tắt | Vòng này không có màn mới, dùng lại 100% giao diện web đã dogfood ở vòng 1 |
| `a11y` | tắt | Không có UI mới |
| `locale` | tắt | Không có chuỗi hiển thị / i18n mới |
| `mobile` | tắt | Ứng dụng desktop cho macOS, không chạy trên thiết bị di động |
| `power` | bật | PERSONAS §1 P-DESK — kiểm tra phím tắt macOS (⌘W, ⌘Q, ⌘C, ⌘V, ⌘K, ⌘P), menu native |
| `rushed` | tắt | Không có form nhập liệu mới |
| `breaker` | bật | Kiểm tra cookie loopback: giả mạo request từ bên ngoài vào loopback port, truy cập khi thiếu token secret |
| `concurrent` | tắt | App chạy đơn lẻ trên một máy macOS |
| `money` | tắt | PRD §7 — không thu tiền |
| `operator` | bật | Kiểm tra lệnh build .dmg, kiểm tra chữ ký mã ad-hoc, lệnh doctor |
| `integrator` | tắt | Không có IdP hay dịch vụ bên thứ ba mới |

## 2. Vai bật làm gì

> **Mỗi vai một tài khoản riêng.** Đợt 0 chạy `smoke` một mình; đợt 1 và đợt 2 chạy tối đa 3 vai/đợt.

| Vai | Đợt | Persona | Tài khoản | Nơi thử | Việc vòng này |
|---|---|---|---|---|---|
| `smoke` | 0 | P-DESK | `smoke@desktop.local` | macOS app (localhost) | Đi hết §3: mở app, kiểm tra loopback auth, chạy terminal, Claude |
| `newbie` | 1 | P-HOST | `newbie@desktop.local` | macOS app | Tải .dmg, mount, chạy app lần đầu, xác nhận vào thẳng không cần gõ mật khẩu |
| `edge` | 1 | P-DESK | `edge@desktop.local` | macOS app | Chạy khi port bị chiếm hoặc kill process backend |
| `power` | 1 | P-DESK | `power@desktop.local` | macOS app | Kiểm tra các phím tắt ⌘Q, ⌘W, ⌘C, ⌘V, ⌘K, ⌘P, chia đôi terminal |
| `breaker` | 2 | P-HOST | `breaker@desktop.local` | curl / trình duyệt ngoài | Cố gắng gọi loopback API từ curl hoặc browser ngoài không có secret token |
| `operator` | 2 | P-HOST | `operator@desktop.local` | CLI terminal | Chạy `make desktop-build`, kiểm tra file .app, .dmg và `codesign -v` |

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

## 4. Kết quả

<!-- /viper-dogfood ghi — mỗi lượt của mỗi vai một dòng. Nơi: `local` (pha I) | `production` (pha P2).
     Trình duyệt: đúng như dòng đầu báo cáo của khe (mcp__pw-slot-k__ · mobile · curl). `smoke` có hai
     dòng mỗi pha: lượt đầu (đợt 0) và lượt cuối sau khi sửa. -->

| Ngày | Vai | Nơi | Trình duyệt | Nặng | Vừa | Nhẹ | Ghi chú |
|---|---|---|---|---|---|---|---|
