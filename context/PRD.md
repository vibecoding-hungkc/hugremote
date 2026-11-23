---
type: prd
tier: T0
status: ACTIVE
last_reviewed: "2026-11-23"
---

# PRD — hugremote

> **Mô tả sản phẩm ở lát cắt của VÒNG HIỆN TẠI (vòng 2).** Dịch từ `intake/PRD.md` (đường intake).
> Sau khi khoá scope, file này là nguồn sự thật cho mọi quyết định của agent.
> AC vòng 2 **thay** AC vòng 1 ở §3 (`/viper-repeat` Bước 3) — toàn bộ 49 AC vòng 1 là hợp đồng còn hiệu
> lực (legacy, `VIPER.md §1.2`), lưu nguyên vẹn ở `context/archive/vong-1/PRD.md`; danh sách capability
> cộng dồn nằm ở `CAPABILITIES-MAP.md`.

---

## 1. Pain point

Lập trình viên làm việc với Claude Code và nhiều máy chủ SSH cần **điều khiển máy làm việc từ điện
thoại, tablet hoặc máy khác**: mở terminal thật, xem và sửa file, theo dõi Git, và nhất là giao việc rồi
duyệt quyền cho Claude Code khi không ngồi trước máy. Các Web IDE hiện có thiết kế desktop-first: nút quá
nhỏ để chạm, bàn phím ảo che terminal, thiếu phím `Ctrl/Esc/Tab/mũi tên`.

HugRemote v1.x đã giải phần kỹ thuật (PTY thật, SSH qua `~/.ssh/config` có Include/ProxyJump, Claude CLI
chạy nền, Git đa repo, cài một lệnh) nhưng sau 288 commit trong 5 tuần **trải nghiệm trở nên rối**: bảy
bề mặt điều hướng chồng nhau (chọn máy 4 lối, chọn dự án 4 lối, tạo phiên 3 lối); tab Files theo máy còn
Git/phiên theo dự án; tính năng làm hai lần (hai editor, hai giao diện Git); "phiên HugRemote" và "phiên
CLI" lộ ra người dùng; phiên terminal chỉ sống trong một trình duyệt; không có nút Đăng xuất; máy thêm vào
không sửa/xoá được; không có design system (~12 bán kính, ~25 cỡ chữ). Kèm **nợ bảo mật**: cấu hình OIDC
ghi đè được khi chưa đăng nhập, API trả mật khẩu SSH dạng rõ, mọi SSH tắt kiểm host key, phiên đăng nhập
chỉ trong RAM. Không làm lại thì mỗi tính năng mới lại thêm một lối điều hướng và một lớp vá; lỗ hổng OIDC
là rủi ro chiếm shell từ xa.

## 2. Đối tượng

Một lập trình viên solo (chủ instance) ở ba bối cảnh — **P-MOBILE** (điện thoại, hằng ngày, vài phút mỗi
lần), **P-DESK** (desktop/tablet, phiên dài, nhiều phiên song song — hạng nhất ngang mobile), **P-HOST**
(cài, bảo mật, cập nhật) — cùng vai `owner` — và **P-TEAM**: đồng nghiệp nhóm nhỏ đăng nhập SSO vào
instance chung (vai `member`). Hôm nay họ đang dùng HugRemote v1.x sau Cloudflare Tunnel.

Chân dung chi tiết + năng lực từng vai + ma trận phân quyền: `context/PERSONAS.md`.

## 3. Tiêu chí chấp nhận (AC) — vòng 2

Vòng 2 = **CAP-OPS-05 — Ứng dụng macOS đóng gói**: `apps/desktop` (vỏ Electron bọc `apps/api` + `apps/web` đã build), lệnh build `.app` + `.dmg` ký ad-hoc, chế độ "phiên desktop" (loopback + cookie bí mật riêng mỗi lần mở, không cần mật khẩu). Toàn bộ 49 AC của vòng 1 là hợp đồng còn hiệu lực (legacy, `VIPER.md §1.2`), lưu nguyên vẹn ở `context/archive/vong-1/PRD.md`.

| # | Làm được gì | Coi là xong khi | Capability |
|---|---|---|---|
| AC-50 | Đóng gói ứng dụng desktop macOS nguyên bản | `apps/desktop` (Electron main + preload) khởi động `apps/api` local dưới dạng child process và tải `apps/web` trong cửa sổ BrowserWindow native; hỗ trợ đầy đủ phím tắt macOS (⌘C, ⌘V, ⌘W, ⌘Q), khôi phục kích thước cửa sổ và hiển thị icon ứng dụng | CAP-OPS-05 |
| AC-51 | Xác thực loopback một chạm an toàn | Khi mở từ ứng dụng Electron, main process sinh token bí mật tạm thời (ephemeral loopback secret cookie), gắn vào session của BrowserWindow; `apps/api` xác thực loopback request và tự động cấp quyền `owner` mà không cần nhập mật khẩu hay 2FA; chặn truy cập loopback secret từ các Origin lạ hoặc bên ngoài `127.0.0.1` | CAP-OPS-05 |
| AC-52 | Lệnh đóng gói `.app` và `.dmg` kèm ký ad-hoc | Makefile có lệnh đóng gói build `.app` và tệp cài đặt `.dmg` cho macOS (hỗ trợ Apple Silicon arm64 / Intel x64), ký mã tự động ad-hoc (`codesign --sign - --force --deep`); mở `.dmg` kéo vào Applications chạy được ngay | CAP-OPS-05 |

## 4. Ưu tiên — vòng này giao gì, phần còn lại nằm đâu

Vòng 2 tập trung duy nhất vào capability **CAP-OPS-05 (ứng dụng macOS đóng gói)**. Kế hoạch chi tiết nằm ở `intake/loops/l2/_PROPOSAL.md`, lộ trình tổng thể ở `ROADMAP.md §1`, bản đồ năng lực ở `CAPABILITIES-MAP.md`.

## 5. Out-of-scope — chắc chắn KHÔNG làm ở vòng này

- Ký Apple Developer ID thật + Notarize qua máy chủ Apple (Authority chưa cấp tài khoản Apple Developer; vòng này ký ad-hoc)
- Ứng dụng desktop cho Windows / Linux (.exe / .deb / AppImage) — vòng này chỉ tập trung macOS
- Tự động kiểm tra bản cập nhật Electron qua Auto-Updater
- Màn hình UI mới (vòng này bọc toàn bộ SPA của web vòng 1, `UI vòng này: không có màn mới`)
- Production/PaaS, analytics gửi ra ngoài, pha E (vòng này chỉ chạy local)

## 6. Giả thuyết + success metric

**Vòng này không chạy pha E** (chỉ chạy local, V và I bắt buộc theo `_PROPOSAL.md`). Metric của vòng 2:
**Authority cài đặt thành công tệp .dmg và sử dụng HugRemote trên macOS desktop app liên tục ≥ 3 ngày**, thời gian khởi động app < 2.5s. Kiểm tra tự động bằng `make test` và dogfood.

---

## 7. Quyết định đã chốt ở pha V

| Hạng mục | Chốt |
|---|---|
| Đăng nhập | Tài khoản chủ (`owner`) bằng mật khẩu; thành viên (`member`) bằng SSO Google/OIDC do owner cấu hình. Owner: mật khẩu (PBKDF2-SHA512 100k), không tên đăng nhập; mật khẩu khởi tạo từ `AUTH_PASSWORD` hoặc sinh ngẫu nhiên in ra log lần chạy đầu; bắt đổi lần đầu, ≥10 ký tự. 2FA TOTP tuỳ chọn (bật ở Cài đặt). JWT access 15 phút trong bộ nhớ + refresh 14 ngày trượt (cookie httpOnly `SameSite=Strict`). Khoá 15 phút sau 5 lần sai (mật khẩu và 2FA đếm riêng). Đổi mật khẩu thu hồi mọi thiết bị khác; quên mật khẩu → `hugremote reset-password` trên máy cài; tắt 2FA / tạo mã khôi phục mới cần mã TOTP hoặc một mã khôi phục |
| Thu tiền | Không — công cụ tự host |
| Mô hình dữ liệu lõi | 17 bảng: `users` (kèm `preferences` JSON, `revoked_at`) · `refresh_tokens` (một dòng mỗi thiết bị: `family_id`, IP, user agent) · `two_factor` · `login_attempts` · `sso_config` · `sso_denials` · `hosts_meta` (bổ sung cho Host block của `~/.ssh/config`) · `known_hosts` · `pinned_hosts` · `projects` (thuộc một máy) · `terminal_sessions` + `claude_sessions` + `claude_messages` + `claude_queue` (thuộc một dự án, có chủ) · `recent_files` · `update_runs` · `settings` (khoá hệ thống) — chi tiết `ARCHITECTURE.md §6`. Nháp ô soạn + đính kèm chỉ ở trình duyệt (localStorage theo người dùng + phiên) |
| Ca biên phải xử | Dự án trùng đường dẫn chuẩn hoá trên cùng máy → mở cái có sẵn; xoá máy còn dự án/phiên → hỏi, đóng phiên, xoá dự án của máy đó; xoá máy đang là jump host → chặn (409 `HOST_IS_JUMP`); gửi tin khi Claude đang chạy → xếp hàng ở server; sửa `~/.ssh/config` bên ngoài app → đọc lại theo mtime; host key đổi → chặn; gửi form hai lần → nút khoá khi đang gửi + API idempotent theo khoá tự nhiên; mất WebSocket → tự nối lại, replay buffer |
| Trạng thái rỗng | Chưa có máy SSH: "Chỉ có máy này. Thêm máy SSH để điều khiển máy khác" + nút **Thêm máy**; dự án chưa có phiên: "Chưa có phiên nào" + nút **Mở terminal**; mọi màn theo khuôn `DESIGN-SYSTEM.md §5` |
| Trạng thái lỗi | Mất kết nối server: dải trên "Mất kết nối — đang thử lại (lần n)" + nút Thử ngay, giữ nguyên nội dung terminal; **khoá mọi thao tác ghi** (gửi, duyệt, lưu, commit, push/pull, cập nhật), giữ nháp/bản sửa chưa lưu/message commit, nối lại không tự gửi (AC-43); SSH lỗi: câu nói nguyên nhân (sai khoá / từ chối / không tới được host / host key đổi) + hành động (Sửa máy / Thử lại) |
| Dữ liệu mẫu | `deployment/local/`: container `sshd` (user `dev`, khoá thử, có Claude CLI giả lập `fake-claude` phát fixture stream-json) đứng sau container `jump` (ProxyJump); `~/projects/{demo-api,demo-web}` có repo git, nhánh, 60 commit, file đang sửa; `~/.ssh/config` mẫu dùng `Include conf.d/*.conf`; một host cố ý đổi host key (AC-6); Keycloak container với 2 người dùng thử (AC-32/33); thư mục dữ liệu v1 mẫu (AC-30); kênh phát hành giả qua git repo cục bộ có 2 tag (AC-31) |
| Tên / domain / giọng | HugRemote; không domain công khai (người dùng tự đặt sau Cloudflare Tunnel, ví dụ `BASE_PATH=/remote`); giọng: ngắn, trực tiếp, xưng "bạn", tiếng Việt có dấu |
| Nơi deploy | Máy local của người dùng: user service (systemd `--user` / launchd), nghe `127.0.0.1:8099`, ra ngoài qua reverse proxy/Cloudflare Tunnel do người dùng tự dựng. Không PaaS |

## 8. Nguồn

- `intake/PRD.md`, `intake/ARCHITECTURE.md`, `intake/TECHSTACK.md`, `intake/ROADMAP.md` (render nhận 2026-11-21)
- `intake/loops/l1/_PROPOSAL.md` — kế hoạch vòng 1
- Bảng truy vết đầy đủ: `context/INTERVIEW.md`; chốt của Authority ở pha V: `context/DECISIONS.md` ngày 2026-11-21

---

## 9. Change log

| Ngày | Thay đổi | Lý do |
|---|---|---|
| 2026-11-21 | Tạo từ template VIPER | — |
| 2026-11-21 | Dịch intake, AC vòng 1 (15 AC) | Pha V vòng 1, đường intake |
| 2026-11-21 | Gộp 6 vòng → vòng 1 có 35 AC, đủ 30 capability | Authority chốt ở pha V |
| 2026-11-21 | Thêm AC-36, AC-37 (làm việc với file kiểu developer) → 37 AC | Phản hồi prototype lượt 3 |
| 2026-11-21 | Thêm AC-38..AC-49 (chuông, cấu hình riêng phiên, xếp hàng, tóm tắt lượt, chế độ gọn, mất kết nối, thiết bị, quản trị nhóm, nhật ký, quên mật khẩu, deep link, phím tắt) → 49 AC; gộp vào AC cũ: máy an toàn (AC-5/6), F1–F12 + bộ chọn phiên mobile (AC-11/12), Files tiện tay (AC-16/17), Git tiện tay (AC-18/19), context `a/b` (AC-22), hạn mức chip 5 giờ (AC-25), xác nhận cập nhật (AC-31), member chỉ thấy phiên mình mọi nơi (AC-33); bỏ dự án = xoá cho cả nhóm (AC-8); §7 đồng bộ 17 bảng + mất kết nối khoá thao tác ghi | Prototype lượt 4–7 + rà soát reviewer; DECISIONS 2026-11-21 D1–D17 |
