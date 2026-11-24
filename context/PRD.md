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

## 3. Tiêu chí chấp nhận (AC) — vòng 3

Vòng 3 = **Terminal dùng hằng ngày trên desktop**: phím tắt macOS + chép/dán trong terminal, phiên tmux bền, mở lại tại tab mất kết nối, phiên trình duyệt trong app desktop, chuyển tiếp cổng hai chiều, Files giữ trạng thái + Home thấy file ẩn, ô chat Claude gọn + hạn mức trong popup model. Nguồn: yêu cầu Authority qua chat 2026-11-24 (14 câu làm rõ ở `intake/loops/l3/_PROPOSAL.md §17`). 49 AC vòng 1 + 3 AC vòng 2 là hợp đồng còn hiệu lực (legacy, `VIPER.md §1.2`), nằm ở `context/archive/vong-1/PRD.md` và `context/archive/vong-2/PRD.md`. Chi tiết Cho trước/Khi/Thì từng AC: `_PROPOSAL.md §6`.

| # | Làm được gì | Coi là xong khi | Capability |
|---|---|---|---|
| AC-53 | Gõ trong terminal bằng phím tắt macOS | ⇧Enter xuống dòng trong Claude CLI (gửi `ESC CR`); ⌥←/→ nhảy từ, ⌘←/→ đầu/cuối dòng, ⌥⌫ xoá từ, ⌘⌫ xoá tới đầu dòng; ⌘C có vùng chọn → chép, không vùng chọn → gửi Ctrl+C; ⌘V dán; ⌥+kéo chọn được chữ khi app bắt chuột | CAP-TERM-03 |
| AC-54 | Tạo nhiều phiên tmux trên máy SSH từ nút + | *Phiên tmux mới* tạo một session tmux mới mỗi lần (tên `<dự án>`, `<dự án>-2`…); nhóm *tmux trên <máy>* liệt kê `tmux ls`, bấm để gắn; "Máy này" không có mục tmux; máy chưa cài tmux → lỗi "Máy chưa cài tmux"; × đóng tab = tắt hẳn session (có xác nhận) | CAP-TERM-04 |
| AC-55 | tmux sống qua lần tắt/mở app | ⌘Q rồi mở lại (hoặc WS đứt) → tab tmux tự gắn lại đúng session, lệnh đang chạy trong tmux vẫn chạy | CAP-TERM-04 |
| AC-56 | Mở lại terminal thường ngay tại tab mất kết nối | Mất kết nối → app tự nối lại ngầm **và** hiện ngay nút *Mở lại tại đây*; bấm → shell mới trong chính tab đó (cùng id, tên, thư mục cuối biết được), số tab không tăng | CAP-TERM-04 |
| AC-57 | Chuyển tiếp cổng hai chiều | Màn Chuyển tiếp cổng (nút header, owner): thêm/sửa cổng đích/tắt/xoá chuyển tiếp máy SSH → Mac (`-L`) và Mac → máy SSH (`-R`); cổng điền sẵn, sửa được; trùng cổng → báo lỗi, không ghi đè; *Tự bật khi mở app*; chỉ bind 127.0.0.1; không có chế độ tự động chuyển tiếp; member → 403 | CAP-NET-01 |
| AC-58 | Thấy các cổng đang mở trên máy SSH | S14 và phiên trình duyệt liệt kê cổng TCP đang nghe (`ss -ltnp`, fallback `lsof`) kèm tiến trình; bấm *Chuyển tiếp* từng cổng | CAP-NET-01 |
| AC-59 | Xem web app của máy SSH ngay trong app desktop | *Trình duyệt mới* ở nút + (chỉ app desktop) mở một phiên trình duyệt trong thanh Phiên; mỗi phiên một trang, nhập link đổi trang; chưa chuyển tiếp → *Chuyển tiếp và mở*; cổng không nghe → lỗi rõ; menu file *Mở bằng trình duyệt* mở file trong phiên mới | CAP-WEB-01 |
| AC-60 | Files giữ trạng thái khi đổi tab | Mở thư mục → sang tab Phiên → quay lại Files: thư mục vẫn mở, cờ file ẩn và vị trí cuộn giữ nguyên, theo từng dự án, qua cả tải lại trang | CAP-FILE-01 |
| AC-61 | Thấy file ẩn ở Home | Tab Files của dự án Home hiện `.ssh`, `.zshrc`, `.config`… mặc định; nút 👁 bật/tắt được và được nhớ | CAP-FILE-01 |
| AC-62 | Ô chat Claude gọn | Chip context / model / quyền chỉ hiện giá trị (nhãn ở tooltip + `aria-label`); không còn nút khiên cạnh mic; không còn chip hạn mức ở ô chat | CAP-AI-03 |
| AC-63 | Xem hạn mức trong popup model | Popup chọn model có hai thanh %: phiên 5 giờ và tuần, kèm giờ reset; ≥80% đổi màu cảnh báo | CAP-AI-06 |

## 4. Ưu tiên — vòng này giao gì, phần còn lại nằm đâu

Vòng 3 giao 11 AC theo thứ tự triển khai `_PROPOSAL.md §21` (phím tắt → mở lại tại chỗ → tmux → chuyển tiếp cổng → trình duyệt → Files → ô chat), rồi pha P1. Thứ tự cắt khi trễ: `_PROPOSAL.md §20`. Lộ trình tổng thể `ROADMAP.md §1`, năng lực `CAPABILITIES-MAP.md`.

## 5. Out-of-scope — chắc chắn KHÔNG làm ở vòng này

- Trình duyệt khi dùng HugRemote từ điện thoại / trình duyệt máy khác (cần proxy ngược) — chỉ app desktop (Q-8)
- Nhiều trang trong một phiên trình duyệt (Q-9) · tự động chuyển tiếp cổng (Q-11) · SOCKS `-D`
- tmux trên "Máy này" (Q-6) · cài tmux hộ (Q-5) · tmux window thay cho session (Q-4a)
- Chuyển tiếp cổng cho vai member
- Deploy production (P2), pha E, video demo cuối vòng (DECISIONS 2026-11-24)
- Ký Apple Developer ID thật, app desktop Windows/Linux, auto-updater desktop (giữ như vòng 2)

## 6. Giả thuyết + success metric

**Vòng này không chạy pha E** (chỉ chạy local; pha V, I, P1). Metric của vòng 3:
**Authority dùng app desktop làm việc cả ngày ≥ 3 ngày liên tiếp mà không mở iTerm / `ssh -L` / trình duyệt riêng cho dự án** (tự báo ở pha R). Tiêu chí xong của vòng là 11 AC §3 qua `make test` + dogfood theo `DOGFOOD-PLAN.md`.

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
