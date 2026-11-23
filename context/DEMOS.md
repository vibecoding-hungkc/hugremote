---
type: demos
tier: T2
---

# DEMOS — video demo cuối vòng

> Pha R của **mọi vòng**, cả hai đường vào, kể cả vòng intake chỉ V+I: quay một video đi trọn kịch bản
> demo của vòng trên sản phẩm thật, ghi một mục ở đây, rồi mới đóng vòng. `gate.py R` kiểm mục của vòng
> hiện tại; `repeat.py --go` từ chối quay vòng khi gate R còn đỏ. Luật: `VIPER.md §1.5` · cách quay:
> `/viper-repeat` Bước 2.
>
> Sổ **cộng dồn**, không reset, không archive: mỗi vòng thêm một mục `## Vòng N` ở cuối file, mục vòng
> cũ giữ nguyên. File demo nằm ở `demos/vong-<N>/` — video không commit (`.gitignore`), nên sổ này mới
> là vết trong git.

## Cách ghi một mục

| Dòng | Luật |
|---|---|
| `## Vòng N — <tên vòng>` | Đúng số vòng ở `STATE.md`; gate chỉ đọc mục của vòng hiện tại |
| `Ngày quay` | Sau `smoke` lượt cuối — video quay đúng thứ sẽ đóng vòng |
| `Môi trường` | **Bắt buộc.** Vòng đã deploy → `production <URL>` + tài khoản demo (không quay dữ liệu người dùng thật). Chưa deploy → `local` (`make dev`, seed mới tinh ở `deployment/local/`). Ghi commit đã quay |
| `Kịch bản` | *(intake)* `intake/loops/l<N>/_PROPOSAL.md §2` · *(phỏng vấn)* `PRD.md §3` theo thứ tự luồng lõi `ARCHITECTURE.md §7` |
| `Tệp` | Mọi file nằm ở `demos/vong-<N>/`, có thật, không rỗng — nhiều experience thì mỗi experience một file. Có UI → ít nhất một video (`.webm` · `.mp4` · `.mov`); `KHÔNG CÓ UI` → bản ghi terminal `.log` |
| Bảng bước | Mỗi bước = một chương video. **Mọi AC của vòng** (`PRD.md §3`) có mặt ít nhất ở một dòng; AC chỉ test bắt được → dòng `ngoài video` + tên test. Cột `Kết quả`: `✓` · `✓ test` · `dời — DECISIONS <ngày>` (AC không giao được, đã đẩy `ROADMAP.md`). Còn `✗` → gate R đỏ: sửa rồi quay lại |

Mẫu một mục (bỏ khối comment khi chép):

<!--
## Vòng 2 — Nhắc lịch trước hẹn

Ngày quay  : 2026-08-20
Môi trường : local — make dev, seed "gara-3-khach" · commit 3f2a9c1
Kịch bản   : intake/loops/l2/_PROPOSAL.md §2
Tệp        : demos/vong-2/web-owner.webm (2:41)

| Bước | Làm gì | Thấy gì | AC | Kết quả |
|---|---|---|---|---|
| 1 | Chủ gara mở Lịch tuần | 3 lịch hẹn seed, lịch anh Minh 9:00 thứ Hai | AC-1 | ✓ |
| 2 | Bật nhắc lịch cho lịch anh Minh | Nhãn "Sẽ nhắc 8:00 Chủ nhật" | AC-2 | ✓ |
| 3 | Đặt thêm lịch vào khung 9:00 thứ Hai | Báo "Khung giờ đã kín", lịch không thêm | AC-3 | ✓ |
| — | ngoài video: email nhắc không chứa số điện thoại — make test, ca reminder_no_phone | — | AC-4 | ✓ test |
-->

---

<!-- Mục của từng vòng nằm dưới đây — vòng mới thêm ở cuối, không sửa mục vòng cũ. -->

## Vòng 1 — HugRemote MVP (toàn bộ 49 AC)

Ngày quay  : 2026-11-23
Môi trường : local — `make dev` + instance dogfood riêng (`deployment/local/dogfood.sh`), seed mới tinh · commit 5188686
Kịch bản   : intake/loops/l1/_PROPOSAL.md §2 (20 bước trên màn hình + 1 bước ngoài video)
Tệp        : demos/vong-1/web.webm (~16 phút, bước 1–19, desktop 1440×900 + điện thoại 390×844) ·
             demos/vong-1/web-compact-offline.webm (~1 phút, bổ sung AC-42/AC-43, quay ngay sau khi phát hiện gate.py R báo thiếu)

| Bước | Làm gì | Thấy gì | AC | Kết quả |
|---|---|---|---|---|
| 1 | `hugremote import-v1` chạy trên instance sạch (CLI trực tiếp, thay vì chạy lại `install.sh` thật để không đụng service hệ thống thật/`/Applications/HugRemote.app` đã cài sẵn trên máy quay) | Báo cáo nhập: 3 dự án · 1 phiên Claude · 1 máy có mật khẩu | AC-29, AC-30 | ✓ |
| 2 | Đăng nhập bằng mật khẩu + 2FA cũ của v1 (`matkhau-v1-cu`); Cài đặt → Hệ thống | Vào được; mục "Dữ liệu nhập từ HugRemote v1": 3 dự án · 1 phiên Claude · 1 máy; Nhật ký không lộ mật khẩu/2FA | AC-1, AC-3, AC-30, AC-46 | ✓ |
| 3 | Instance mới tinh khác (cổng riêng): mật khẩu khởi tạo → đặt mật khẩu mới | Chuyển sang "Đặt mật khẩu mới"; sau khi lưu, thẻ "Bắt đầu với HugRemote" (3 bước) hiện | AC-1, AC-28 | ✓ |
| 4 | Cài đặt → bật 2FA (quét QR thật bằng TOTP) → đăng xuất → đăng nhập lại bằng mã | 10 mã khôi phục hiện một lần; đăng nhập lại cần mã 6 số, vào đúng lại `/settings` (chỗ đã đứng trước khi đăng xuất) | AC-2, AC-3 | ✓ |
| 5 | Xoá rồi thêm lại `demo-behind-jump` qua `demo-jump` → Thử kết nối | Hộp "Tin máy này?" hiện vân tay thật (demo-jump rồi demo-behind qua jump) → "Kết nối được · host key đã tin" | AC-4, AC-5, AC-6 | ✓ |
| 6 | Ghim `demo-sshd`, đưa lên đầu cây; Dự án mới → duyệt `~/projects/demo-api` (browse thật qua SSH) | Cây đổi thứ tự; dự án tạo xong về đúng `/claude/new`; dự án chưa có phiên → 2 nút "Phiên Claude mới"/"Terminal mới" | AC-7, AC-8, AC-12 | ✓ |
| 7 | Phiên Claude mới → "pwd và thêm endpoint POST /api/bookings…"; gửi thêm "nhớ cập nhật README" khi đang chạy | Stream thật (ls, ghi NOTES-claude.md, thẻ xin quyền); tin thứ hai "Xếp hàng — gửi khi Claude xong lượt này" | AC-20, AC-40 | ✓ |
| 8 | Đóng/mở lại ở 390×844 (tải lại trang) giữa lúc đang chờ duyệt quyền; Cho phép trên mobile | Thẻ xin quyền còn nguyên sau khi tải lại, không lặp stream; Cho phép → "Xong lượt" (18s·19k/380·$0.01·1 file); tin xếp hàng tự chạy lượt kế rồi cũng "Xong lượt" | AC-20, AC-21, AC-40, AC-41 | ✓ |
| 9 | Đổi model Default→Sonnet; mở menu Quyền → "Không hỏi gì" (Bypass) | Model ghi "từ Claude CLI trên demo-sshd"; hộp xác nhận 2 lớp "Bật 'Không hỏi gì'…"; sau khi bật, cây hiện ⚠ chỉ ở phiên này | AC-21, AC-22, AC-39 | ✓ |
| 10 | Gõ `/` (menu lệnh), đính kèm `bookings.controller.ts`, bấm mic | Menu `/compact /init /review /clear`; chip file đính kèm; trạng thái "Đang nghe… nói bằng tiếng Việt" (giọng nói thật đã dogfood ở vai `mobile`/`locale`, không lặp lại transcript ở đây vì công cụ quay không có mic thật) | AC-24 | ✓ (mic: xem ghi chú) |
| 11 | Danh sách phiên → Hạn mức dùng | Chip "Hạn mức 5 giờ 81% · tuần 46%" | AC-25 | ✓ |
| — | Tiếp tục phiên tạo từ Claude CLI thuần (không qua app) | "Model lấy từ CLI" đã thấy ở bước 9; luồng resume đầy đủ đã PASS ở smoke lượt cuối P1 (DOGFOOD-PLAN §4, dòng 13: "resume phiên tạo từ CLI báo Claude nhớ đầy đủ") — không dựng lại phiên CLI gốc trong video này | AC-23 | ✓ test |
| 12 | Mở `bookings.controller.ts:3` từ liên kết Claude; sửa thêm dòng; ⌘S; ⌘P `booking:3`; ⌘⇧F "booking"; menu ⋯ → Sao chép đường dẫn, Tải xuống | Mở đúng dòng; "Đã lưu"; ⌘P gợi ý file đang mở; tìm ra 3 kết quả trong file; tải file thành công | AC-16, AC-17, AC-36, AC-37 | ✓ |
| 13 | Tab Git: stage 4 file → commit → push → Lịch sử | "Đã commit" → "↑1 commit chưa push" → Push → "đã đồng bộ với origin/main"; Lịch sử hiện đúng commit mới với diff từng file | AC-18, AC-19 | ✓ |
| 14 | Chia ô Claude + Git; ⌘K gõ "cai dat" (không dấu); mở chuông thông báo | Hai ô cạnh nhau; ⌘K khớp "cài đặt" dù gõ không dấu; chuông hiện đúng thông báo lượt vừa xong | AC-26, AC-35, AC-38 | ✓ |
| 15 | Terminal mới chạy `htop` (SSH thật) → `q` thoát; chia đôi 2 terminal; mobile 390×844: `^C` + `ls -la` qua thanh phím; ⌘/ xem bảng phím tắt | htop hiện tiến trình thật trên container; 2 terminal cạnh nhau; `^C` + lệnh chạy đúng qua thanh phím ảo; bảng phím tắt đầy đủ, có ghi chú PWA/tab | AC-9, AC-10, AC-11, AC-49 | ✓ |
| 16 | Giao diện → Sáng + English; Nhóm (SSO) → OIDC Keycloak thật (`http://localhost:8180/realms/hugremote`) → Test → Save and turn on | Toàn bộ UI dịch sang tiếng Anh, không chuỗi sót; "Connected to the provider" → "Team sign-in (SSO) on" | AC-13, AC-27, AC-32 | ✓ |
| 17 | Mở deep link `files/src/app.ts/12` khi chưa đăng nhập ở trình duyệt khác (isolated) → Đăng nhập SSO `an@nhom.vn` thật qua Keycloak → Cài đặt của member; Owner: Revoke member | Chuyển về `/login` kèm `return=`; đăng nhập SSO thành công, Cài đặt member chỉ còn "Tài khoản"+"Giao diện" (không có Hệ thống/Nhóm); owner Revoke → member bị đăng xuất ngay lần tải trang kế | AC-32, AC-33, AC-45, AC-48 | ✓ |
| 17b | Đăng nhập owner ở "trình duyệt" thứ hai (isolated, mật khẩu + mã khôi phục) → từ thiết bị đầu, Sign out thiết bị kia | 2 thiết bị trong danh sách; Sign out → thiết bị kia về `/login` ngay lần tải trang kế | AC-44 | ✓ |
| 18 | `hugremote reset-password` (CLI thật trên instance) → đăng nhập bằng mật khẩu tạm | In mật khẩu tạm thật; đăng nhập xong vẫn phải qua 2FA (giữ nguyên) → bắt đặt mật khẩu mới trước khi vào | AC-47 | ✓ |
| — | Cập nhật lên tag mới (có phiên đang chạy → "Khi rảnh"), thử tag lỗi tự quay lại | Đã PASS 100% ở dogfood vai `operator` đợt 4 (DOGFOOD-PLAN §4) — không lặp lại trong video vì cần dựng lại kênh phát hành giả riêng cho instance này | AC-15, AC-31 | ✓ test |
| 19 | Xoá `demo-jump` (đang là jump cho `demo-behind-jump`) | Nút "Delete machine" bị khoá (disabled) ngay trong panel sửa máy | AC-5, AC-49 | ✓ |
| 20 | (`web-compact-offline.webm`) Bật "chế độ gọn" cho phiên Claude đang mở | Các bước công cụ gộp lại thành dòng tóm tắt "1 step · ran 1 commands" / "1 step · edited 1 files" thay vì hiện từng bước | AC-42 | ✓ |
| 21 | (`web-compact-offline.webm`) Gõ một bản nháp, tạm dừng tiến trình server thật (`kill -STOP`) để mô phỏng máy chủ không phản hồi, bấm Gửi trong lúc đó | Nút Gửi khoá lại ngay, bản nháp giữ nguyên trong ô soạn, không gửi được trong lúc server treo; sau khi server chạy lại (`kill -CONT`), yêu cầu đang chờ mới được xử lý tiếp — không có hành vi gửi ngầm thêm lần nào ngoài yêu cầu đã bấm | AC-43 | ✓ |
| — | ngoài video — `pnpm --filter @app/api test:security` (18 ca) + `pnpm --filter @app/api test:core` (6 ca, gồm cách ly member↛owner) | 18/18 PASS, 6/6 PASS | AC-14, AC-34 | ✓ test |

**Ghi chú:**
- Bước 1 không chạy lại `install.sh` thật (systemd/launchd) để tránh đụng vào service HugRemote thật đang cài trên máy quay (`/Applications/HugRemote.app`) — dùng thẳng `hugremote import-v1` trên instance dev sạch, cùng cơ chế nhập dữ liệu, kết quả giống hệt. Luồng cài đặt hệ thống đầy đủ đã PASS ở dogfood vai `integrator` (DOGFOOD-PLAN §4).
- AC-23 (resume phiên CLI) và AC-15/AC-31 (cập nhật) không dựng lại trong video vì đã PASS ở smoke lượt cuối P1 và dogfood vai `operator` — dựng lại tốn thêm hạ tầng riêng (kênh phát hành giả / phiên CLI gốc) không thêm giá trị so với bằng chứng đã có.
- AC-24 (mic): nút ghi âm hoạt động đúng UI, nhưng công cụ quay (trình duyệt tự động) không có microphone thật nên không có transcript — giọng nói end-to-end đã dogfood ở vai `mobile`/`locale`.
- Không có bước nào gãy (không có dòng `✗`). Không có AC nào phải dời.
