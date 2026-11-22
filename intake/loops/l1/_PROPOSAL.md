NGUỒN: KẾ HOẠCH VÒNG — lập ở vòng 1 ngày 2026-11-21, từ intake/ROADMAP.md §2 + intake/PRD.md §3–§4
Pha vòng này: V, I, P
Thời lượng dự kiến: ~6 tuần công — 6 wave của intake gộp làm một vòng + checklist P1
UI vòng này: có màn mới
Rà lại vòng 1: 2026-11-21

# Vòng 1 — Toàn bộ HugRemote mới: giao việc cho Claude từ điện thoại lẫn desktop (Phase MVP)

## 1. Mục tiêu vòng

Sau vòng này, chủ instance **gỡ HugRemote v1 và dùng bản mới hằng ngày**, nhóm nhỏ dùng chung được. Mở app
trên điện thoại hoặc desktop, đăng nhập (mật khẩu + 2FA, hoặc SSO cho thành viên), thấy một cây **Máy → Dự án →
Phiên** kiểu Orca với chấm trạng thái; giao việc cho Claude Code trong đúng thư mục dự án (local hoặc SSH), bỏ
máy đi, duyệt quyền một chạm từ điện thoại; xem file và diff Claude vừa làm rồi commit/push; terminal chạy nền nối
lại ở mọi thiết bị; chuyển nhanh ⌘K; tối/sáng, vi/en; cài một lệnh mang theo dữ liệu v1 và tự cập nhật trong app.
Authority gộp 6 vòng của kế hoạch cũ làm một (DECISIONS 2026-11-21). P = chỉ P1.

**Giả thuyết chạm tới**: H-1, H-2, H-3, H-4, H-5 — `intake/PRD.md §6`

## 2. Kịch bản demo cuối vòng

Chạy trên `make dev` với seed `deployment/local/` mới tinh (sshd có `fake-claude` + repo `demo-api`, jump,
Keycloak, dữ liệu v1 mẫu, kênh phát hành giả). Desktop 1440×900, rồi điện thoại 390×844.

| Bước | Người dùng làm | Thấy gì (quan sát được) | AC |
|---|---|---|---|
| 1 | Container sạch có dữ liệu v1: chạy `install.sh`, đồng ý nhập v1 | Cài xong user service, in báo cáo nhập (dự án, máy, phiên Claude) | AC-29, AC-30 |
| 2 | Mở app, đăng nhập bằng mật khẩu + mã 2FA cũ của v1 | Vào S2; cây có dự án cũ | AC-1, AC-3, AC-30 |
| 3 | Instance mới tinh (cổng khác): mật khẩu khởi tạo → đặt mật khẩu mới → thẻ Bắt đầu | Thẻ 3 bước, tự đánh dấu khi làm xong | AC-1, AC-28 |
| 4 | Cài đặt → Bảo mật → bật 2FA; đăng xuất, đăng nhập lại bằng mã | 10 mã khôi phục; vào lại đúng chỗ | AC-2, AC-3 |
| 5 | Màn Máy: thấy `demo-sshd` (file Include); thêm `demo-behind-jump` qua `demo-jump` → Thử kết nối | Hộp tin host key → "Kết nối thành công"; API không có mật khẩu | AC-4, AC-5, AC-6 |
| 6 | Ghim `demo-sshd`, đưa lên đầu; Dự án mới → `~/projects/demo-api` (S5 Thư mục mới thử tên lỗi) | Cây đổi thứ tự (tab khác cũng vậy); thanh trên `demo-sshd › demo-api`; dự án chưa có phiên → hai nút Phiên Claude mới / Terminal mới | AC-7, AC-8, AC-12 |
| 7 | Tab **Phiên** → **+** → Phiên Claude mới → "Thêm API POST /bookings, chặn trùng giờ, viết test"; gửi thêm "nhớ cập nhật README" khi Claude đang chạy | Stream suy nghĩ, thẻ công cụ Edit/Bash; Claude chạy ở `/home/dev/projects/demo-api`; tin thứ hai xếp hàng (mờ, có Huỷ) | AC-20, AC-40 |
| 8 | Đóng trình duyệt; mở ở 390×844 | Cây có chấm "cần duyệt"; thẻ "Claude muốn ghi file" → Cho phép; stream tiếp, không lặp; lượt xong → dòng tóm tắt (thời gian · token · chi phí · file đổi) và tin xếp hàng tự chạy | AC-20, AC-21, AC-40, AC-41 |
| 9 | Đổi model + effort; mở chế độ quyền, thử Bypass; ⇧Tab | Model lấy từ CLI; chip Context `a/b` token (vd `227k/1000k`); chip Hạn mức 5 giờ (tooltip tuần + reset); Bypass đòi xác nhận lần hai, ⚠ chỉ ở phiên này | AC-21, AC-22, AC-25, AC-39 |
| 10 | Gõ `/`, đính kèm `bookings.controller.ts`, nói một câu bằng mic | Gợi ý lệnh; chip đính kèm; chữ hiện theo giọng nói | AC-24 |
| 11 | Danh sách phiên → tiếp tục phiên "Refactor auth" tạo từ Claude CLI | Hội thoại cũ hiện, gửi tiếp được | AC-23 |
| 12 | Bấm `bookings.controller.ts:7` trong thẻ công cụ của Claude → sửa, ⌘S; ⌘P `spec:3`; ⌘⇧F `booking`; menu ⋯ → Sao chép đường dẫn, Gửi cho Claude; tải lên thư mục, tải xuống zip | Mở đúng dòng, vạch dòng đổi; tab nhiều file; kết quả tìm mở đúng dòng; tiến độ tải lên | AC-16, AC-17, AC-36, AC-37 |
| 13 | Tab Git: diff → stage → commit → push; tab Lịch sử → mở commit | Commit lên remote; diff theo commit | AC-18, AC-19, AC-43 |
| 14 | Desktop: chia ô Claude + Git; ⌘K gõ "dat lich" → Enter; đang ở tab Files thì phiên Claude khác xin quyền → mở **chuông** → ✓ ngay trong danh sách; bật nút gọn ở S10 | Hai ô cạnh nhau; tới đúng phiên trong ≤3 thao tác; số trên chuông giảm, không rời Files; chế độ gọn chỉ còn tin, trạng thái, kết quả, tóm tắt | AC-26, AC-35, AC-38, AC-42 |
| 15 | Tab **Phiên** → **+** → Terminal mới: `htop`, phiên thứ hai, chia đôi; ⌘/ xem bảng phím, ⌥1/⌥2 chuyển phiên; điện thoại: bộ chọn phiên, chạm terminal mở bàn phím, thanh phím `^C`, `ls -la ↵`; `setOffline` giữa chừng | TUI không vỡ khi đổi thiết bị; bàn phím ảo không che; mất mạng → C13, nút ghi khoá, nháp giữ | AC-9, AC-10, AC-11, AC-43, AC-49 |
| 16 | Cài đặt: Sáng + English; SSO Keycloak + allowlist `@nhom.vn`; Thiết bị → đăng xuất trình duyệt cũ | Không chuỗi chưa dịch; Kiểm tra SSO thành công; trình duyệt cũ về S1 | AC-13, AC-27, AC-32, AC-44 |
| 17 | Trình duyệt khác: mở link sâu `…/files/src/app.ts/12` → đăng nhập SSO là `an@nhom.vn`; mở phiên; owner: Thành viên → Thu hồi `binh`, Lần bị từ chối, Nhật ký | Về đúng file dòng 12; member chỉ thấy phiên của mình (cây, chuông, ⌘K), Máy chỉ xem + ghim, không có Bảo mật/SSO/Nhật ký; thu hồi dừng phiên của binh | AC-32, AC-33, AC-45, AC-46, AC-48 |
| 18 | Owner: Cài đặt → Hệ thống → Cập nhật lên tag mới (đang có phiên chạy → Khi rảnh); thử tag lỗi; `hugremote reset-password` | Hộp nêu số phiên sẽ dừng, run "Đang chờ"; tiến độ từng bước; bản lỗi tự quay lại; phiên đăng nhập còn; mật khẩu tạm bắt đổi | AC-2, AC-15, AC-31, AC-47 |
| 19 | ngoài video — `make test` bộ `security.e2e` + test ma trận quyền | 31 ca pentest + ma trận PASS | AC-14, AC-34 |

## 3. Cỡ vòng

**~30 ngày công** (kế hoạch cũ 6 wave × ~5 ngày · biên ±20%) — nguồn: `intake/ROADMAP.md §Cadence` + DECISIONS
2026-11-21 (gộp vòng, 2FA, P1).

| Phần | Cỡ (ngày) |
|---|:--:|
| Lát 1 — nền, đăng nhập + 2FA, máy, dự án, terminal (W1) | 8 |
| Lát 2 — Files + Git working tree (W2) | 5 |
| Lát 3 — Claude: stream, nền, duyệt quyền, model, phiên CLI (W3) | 6 |
| Lát 4 — chuyển nhanh, sáng/en, Bắt đầu, installer, nhập v1, pentest (W4) | 5 |
| Lát 5 — SSO, member, lịch sử Git (W5) | 3 |
| Lát 6 — tiện ích soạn prompt, hạn mức, tự cập nhật (W6) | 3 |

## 4. Phạm vi — capability giao ở vòng này

| Capability | Persona | Target | AC (xem §6) |
|---|---|---|---|
| `CAP-ACCESS-01` — Đăng nhập, đổi mật khẩu bắt buộc, đăng xuất, phiên bền | P-MOBILE, P-DESK, P-HOST | `srcroot/boundaries/hugremote` | AC-1, AC-2, AC-44, AC-47, AC-48 |
| `CAP-ACCESS-02` — 2FA | P-MOBILE, P-DESK, P-HOST | `srcroot/boundaries/hugremote` | AC-3 |
| `CAP-ACCESS-03` — SSO Google/OIDC | P-HOST, P-TEAM | `srcroot/boundaries/hugremote` | AC-32, AC-45 |
| `CAP-HOST-01` — Danh sách máy | P-MOBILE, P-DESK, P-HOST | `srcroot/boundaries/hugremote` | AC-4 |
| `CAP-HOST-02` — Thêm/sửa/xoá máy | P-HOST | `srcroot/boundaries/hugremote` | AC-5 |
| `CAP-HOST-03` — Host key | P-HOST | `srcroot/boundaries/hugremote` | AC-6 |
| `CAP-PROJ-01` — Dự án + phạm vi | P-MOBILE, P-DESK | `srcroot/boundaries/hugremote` | AC-7 |
| `CAP-PROJ-02` — Chuyển nhanh | P-MOBILE, P-DESK | `srcroot/boundaries/hugremote` | AC-26 |
| `CAP-PROJ-03` — Ghim máy | P-MOBILE, P-DESK | `srcroot/boundaries/hugremote` | AC-8 |
| `CAP-TERM-01` — Terminal chạy nền, chia đôi | P-MOBILE, P-DESK | `srcroot/boundaries/hugremote` | AC-9, AC-10 |
| `CAP-TERM-02` — Thanh phím cảm ứng | P-MOBILE | `srcroot/boundaries/hugremote` | AC-11 |
| `CAP-FILE-01` — Duyệt, sửa, tìm, mở nhanh, liền mạch với Claude | P-MOBILE, P-DESK | `srcroot/boundaries/hugremote` | AC-16, AC-36, AC-37 |
| `CAP-FILE-02` — Quản lý, tải lên/xuống | P-MOBILE, P-DESK | `srcroot/boundaries/hugremote` | AC-17 |
| `CAP-GIT-01` — Git working tree | P-MOBILE, P-DESK | `srcroot/boundaries/hugremote` | AC-18 |
| `CAP-GIT-02` — Lịch sử commit | P-MOBILE, P-DESK | `srcroot/boundaries/hugremote` | AC-19 |
| `CAP-AI-01` — Phiên Claude chạy nền | P-MOBILE, P-DESK | `srcroot/boundaries/hugremote` | AC-20, AC-40, AC-41, AC-42 |
| `CAP-AI-02` — Duyệt quyền | P-MOBILE, P-DESK | `srcroot/boundaries/hugremote` | AC-21, AC-38, AC-39 |
| `CAP-AI-03` — Model + context | P-MOBILE, P-DESK | `srcroot/boundaries/hugremote` | AC-22, AC-39 |
| `CAP-AI-04` — Một danh sách phiên | P-MOBILE, P-DESK | `srcroot/boundaries/hugremote` | AC-23 |
| `CAP-AI-05` — Tiện ích soạn prompt | P-MOBILE, P-DESK | `srcroot/boundaries/hugremote` | AC-24 |
| `CAP-AI-06` — Hạn mức | P-MOBILE, P-DESK | `srcroot/boundaries/hugremote` | AC-25 |
| `CAP-AI-07` — Chủ phiên cho member | P-TEAM | `srcroot/boundaries/hugremote` | AC-33, AC-45 |
| `CAP-UX-01` — Vỏ + điều hướng + chia ô | P-MOBILE, P-DESK | `srcroot/boundaries/hugremote` | AC-12, AC-35, AC-49 |
| `CAP-UX-02` — Design system tối/sáng, vi/en | mọi persona | `srcroot/boundaries/hugremote` | AC-13, AC-27 |
| `CAP-UX-03` — Lần đầu + rỗng/lỗi/tải | mọi persona | `srcroot/boundaries/hugremote` | AC-28, AC-43 |
| `CAP-OPS-01` — Installer + CLI | P-HOST | `srcroot/boundaries/hugremote` | AC-29, AC-47 |
| `CAP-OPS-02` — Nhập v1 | P-HOST | `srcroot/boundaries/hugremote` | AC-30 |
| `CAP-OPS-03` — Tự cập nhật | P-HOST | `srcroot/boundaries/hugremote` | AC-31 |
| `CAP-OPS-04` — Health + doctor | P-HOST | `srcroot/boundaries/hugremote` | AC-15, AC-46 |
| `CAP-SEC-01` — Nền bảo mật + pentest | mọi persona | `srcroot/boundaries/hugremote` | AC-14, AC-34 |

## 5. Ngoài phạm vi vòng này

| Không làm | Vì sao | Để vòng |
|---|---|---|
| App macOS đóng gói (CAP-OPS-05) | Phase 3 | backlog |
| Worktree/chạy song song nhiều agent kiểu Orca | Chỉ lấy UI của Orca | backlog |
| Bàn phím laptop ảo 5 hàng | Thanh phím + ngăn mở rộng đủ cho AC-11 | backlog |
| Nhập hạn mức Claude bằng tay | Chỉ hiện khi CLI cung cấp | bỏ |
| Production/PaaS, pha E | Chỉ chạy local | — |

## 6. AC chi tiết

| AC | Capability | Cho trước | Khi | Thì | Kiểm bằng |
|---|---|---|---|---|---|
| AC-1 | `CAP-ACCESS-01` | Instance mới, `must_change_password=1` | Đăng nhập đúng mật khẩu khởi tạo | Chuyển màn đặt mật khẩu mới; API khác 403 `PASSWORD_CHANGE_REQUIRED`; mật khẩu <10 ký tự hoặc trùng cũ → lỗi tại chỗ | integration + e2e + dogfood newbie |
| AC-2 | `CAP-ACCESS-01` | Đã đăng nhập | Bấm Đăng xuất / restart service | Đăng xuất: refresh token `revoked_at` có giá trị, về S1; restart: `/api/auth/refresh` vẫn cấp token mới | integration (restart app trong test) + smoke |
| AC-3 | `CAP-ACCESS-02` | 2FA tắt | Bật 2FA, đăng nhập lại; nhập sai 5 lần | QR + 10 mã khôi phục; đăng nhập cần mã; mã khôi phục dùng một lần; sai 5 lần → 429 `LOCKED` + `retryAfter` | unit (TOTP RFC 6238 vectors) + integration + breaker |
| AC-4 | `CAP-HOST-01` | `~/.ssh/config` có `Include conf.d/*.conf`, Host wildcard | Mở màn Máy | Liệt kê `local` + mọi Host không wildcard; JSON không có khoá `password`/`passphrase`/`secret` | unit parser + integration (quét khoá JSON) |
| AC-5 | `CAP-HOST-02` | Seed có `demo-jump` | Thêm/sửa/xoá máy, Thử kết nối | Host block ghi đúng file (kể cả file Include khi sửa); ProxyJump qua jump chạy; lỗi kết nối → mã lỗi `SSH_AUTH_FAILED`/`SSH_UNREACHABLE`/`SSH_REFUSED` + câu hướng dẫn | integration với container sshd/jump + e2e |
| AC-6 | `CAP-HOST-03` | Host chưa có trong `known_hosts` / host đã đổi khoá | Kết nối | 409 `HOST_KEY_UNKNOWN` → S4 lần đầu; 409 `HOST_KEY_CHANGED` → S4 cảnh báo đỏ; chỉ đi tiếp sau `trust-key` đúng vân tay | integration (container đổi khoá) + breaker |
| AC-7 | `CAP-PROJ-01` | Máy đã kết nối | Tạo dự án từ cây thư mục; tạo lại cùng đường dẫn | Dự án có trong cây, Home có sẵn; URL hash; F5/Back đúng; tạo trùng → trả dự án cũ | integration + e2e + dogfood power |
| AC-8 | `CAP-PROJ-03` | ≥2 máy | Ghim, đổi thứ tự | `pinned_hosts.position` cập nhật; trình duyệt khác thấy cùng | integration + e2e (2 context) |
| AC-9 | `CAP-TERM-01` | Dự án trên máy SSH | Mở phiên, chạy htop, đóng tab, mở ở viewport khác | `cwd` = gốc dự án; PTY sống; replay sau resize, không chữ chồng | integration PTY + e2e + dogfood mobile/concurrent |
| AC-10 | `CAP-TERM-01` | ≥2 phiên, desktop | Chia đôi, kéo vạch, đổi tên, đóng | Hai terminal fit đúng; tên lưu; đóng khi còn tiến trình → hỏi | e2e + dogfood power |
| AC-11 | `CAP-TERM-02` | Điện thoại 390×844 | Dùng thanh phím, mở ngăn mở rộng, bàn phím ảo bật | Gửi đúng chuỗi phím; vùng terminal co theo `visualViewport` | e2e (mobile viewport) + dogfood mobile |
| AC-12 | `CAP-UX-01` | Đã đăng nhập | Điều hướng trên desktop và mobile | Một cây Máy → Dự án → Phiên với chấm trạng thái + thời gian; không có lối điều hướng thứ hai tới cùng thứ; Back đúng | e2e + dogfood newbie |
| AC-13 | `CAP-UX-02` | — | Xem mọi màn vòng 1 | Giá trị hình thức chỉ từ token; chuỗi qua i18n `vi` | test i18n (chuỗi cứng) + picky |
| AC-14 | `CAP-SEC-01` | Chưa đăng nhập / Origin lạ | Gọi API/WS, vé dùng lại, `browse?path=../..` | 401 · đóng 1008 · vé bị từ chối · 403 `PATH_OUTSIDE_ROOT`; `stat` DB = 0600 | test bảo mật (supertest + ws) + breaker |
| AC-15 | `CAP-OPS-04` | — | `GET /api/health`, `make doctor`, mở Hệ thống | 200 `{status:"ok"}`; doctor liệt kê thiếu gì, exit 1 nếu thiếu; màn Hệ thống hiện phiên bản + tình trạng | integration + operator |
| AC-16 | `CAP-FILE-01` | Dự án `demo-api` trên SSH | Mở file, sửa, lưu; mở `.md`; file 12MB | Lưu đúng; xem trước Markdown; 413 "File quá lớn" | integration + e2e |
| AC-17 | `CAP-FILE-02` | Như trên | Tạo/đổi tên/xoá, tải lên thư mục, tải xuống thư mục; Gửi cho Claude (chọn phiên); Mở terminal tại thư mục; F5 trên URL `…/files/<path>/<dòng>`; đóng tab chưa lưu | Cấu trúc giữ nguyên; zip đúng; zip tạm bị dọn sau 60'; `@path` vào nháp đúng phiên; `pwd` đúng thư mục; mở lại đúng dòng; hỏi Lưu/Bỏ/Ở lại | integration + rushed + power |
| AC-18 | `CAP-GIT-01` | Repo seed có file sửa | Fetch, stage tất cả, bỏ thay đổi 1 file, ⌘Enter commit, push (nút kèm số commit), đổi nhánh; pull khi remote có commit mới; mobile xem diff | Commit lên remote; push tắt khi không có gì; 409 `GIT_NON_FAST_FORWARD` khi cần | integration + e2e + mobile |
| AC-19 | `CAP-GIT-02` | Repo 60 commit | Mở Lịch sử, tải thêm, mở commit | 50/lần; commit → danh sách file → diff | integration |
| AC-20 | `CAP-AI-01` | `fake-claude` trên sshd | Gửi prompt, đóng tab, mở lại; Dừng | cwd đúng; stream tiếp không lặp; "Đã dừng" | unit decoder + integration + concurrent |
| AC-21 | `CAP-AI-02` | Claude xin quyền | Cho phép ở điện thoại; trả lời lại ở desktop; bật Bypass | Claude chạy tiếp; 409 ở lần hai; Bypass cần xác nhận | integration + breaker |
| AC-22 | `CAP-AI-03` | — | Mở chọn model | Danh sách từ `initialize`; chip Context `đã dùng/sức chứa` token (vd `227k/1000k`), vàng >80% | integration |
| AC-23 | `CAP-AI-04` | `~/.claude/projects` có phiên CLI | Mở danh sách, tiếp tục, đổi tên | Một danh sách; resume được; tên đồng bộ `--name` | integration |
| AC-24 | `CAP-AI-05` | Điện thoại | Gõ `/`, đính kèm, mic, gõ Telex rồi Enter | Gợi ý; chip; chữ giọng nói; không gửi sớm | e2e + mobile + locale |
| AC-25 | `CAP-AI-06` | CLI có / không có hạn mức | Mở ô soạn | Chip Hạn mức 5 giờ % (tooltip hạn mức tuần + giờ reset), cảnh báo ≥80% / ẩn | integration |
| AC-26 | `CAP-PROJ-02` | 3 máy ghim | ⌘K "dat lich" Enter | Đúng phiên ≤3 thao tác | e2e + power |
| AC-27 | `CAP-UX-02` | — | Chuyển Sáng, English | Không chuỗi thiếu; token sáng | test khoá + picky + locale |
| AC-28 | `CAP-UX-03` | Instance mới | Đi thẻ Bắt đầu | 3 bước tự đánh dấu | newbie |
| AC-29 | `CAP-OPS-01` | Container Ubuntu sạch / macOS | `install.sh`, `beta.sh` | User service chạy; `hugremote --version` | test cài (CI) |
| AC-30 | `CAP-OPS-02` | Thư mục v1 mẫu | Nhập v1 hai lần | Sao lưu; dữ liệu có mặt; lần hai không nhân bản | integration |
| AC-31 | `CAP-OPS-03` | Kênh phát hành giả 2 tag | Cập nhật khi có phiên chạy (Ngay / Khi rảnh); tag lỗi | Hộp nêu số phiên sẽ dừng; "Đang chờ" rồi tự chạy khi rảnh; tiến độ; quay lại tự động | integration |
| AC-32 | `CAP-ACCESS-03` | Keycloak | Cấu hình SSO; đăng nhập member; gọi cấu hình khi chưa đăng nhập | Đăng nhập được; allowlist rỗng từ chối; 401 | integration + breaker |
| AC-33 | `CAP-AI-07` | Owner + member | Member mở S2, cây, chuông, ⌘K, URL phiên owner; gọi API phiên owner | Chỉ thấy phiên của mình mọi nơi; URL bị chặn về S2; 403 `NOT_SESSION_OWNER`; màn Máy chỉ xem + ghim | test ma trận + operator + breaker |
| AC-34 | `CAP-SEC-01` | — | `make test` bộ bảo mật | 31 ca PASS | security.e2e |
| AC-35 | `CAP-UX-01` | Desktop | Chia ô Claude + Git, Terminal + Files | Hai ô cạnh nhau, kéo vạch | e2e + power |
| AC-36 | `CAP-FILE-01` | Repo seed `demo-api` | ⌘P gõ "spec:3"; ⌘⇧F tìm "booking" | Mở `bookings.controller.spec.ts` dòng 3; kết quả nhóm theo file, bấm mở đúng dòng; `.gitignore` bị bỏ qua | integration + e2e + power |
| AC-37 | `CAP-FILE-01` | Claude vừa sửa file đang mở | Bấm `file:dòng` trong thẻ công cụ; Claude sửa file đang mở (chưa sửa / đang sửa) | Mở đúng dòng; tự tải lại + dải báo / hỏi So sánh · Lấy bản trên máy · Giữ bản của tôi | e2e + concurrent |
| AC-38 | `CAP-AI-02` | 2 phiên Claude chờ duyệt ở 2 dự án | Đang ở Files, mở chuông → ✓ một dòng, ✗ dòng kia; bấm dòng | Số trên chuông giảm, không rời Files; Claude chạy tiếp / dừng đúng; bấm dòng vào đúng phiên; mất kết nối → ✓/✗ khoá | e2e + power + concurrent |
| AC-39 | `CAP-AI-02`, `CAP-AI-03` | 2 phiên Claude | Đổi model/quyền ở phiên A, bật Bypass; F5; mở phiên B; ⇧Tab | Phiên B giữ cấu hình cũ; ⚠ chỉ ở A (cây, tab, ô soạn); Bypass cần xác nhận lần hai | integration + breaker |
| AC-40 | `CAP-AI-01` | Phiên đang chạy | Gửi 2 tin, huỷ 1; đóng mọi trình duyệt; gửi tin thứ 11 | Tin mờ "Xếp hàng"; server tự gửi tin còn lại khi xong lượt; 409 `QUEUE_FULL`; Esc = Dừng | integration + concurrent |
| AC-41 | `CAP-AI-01` | `fake-claude` có `result.usage` | Chạy 1 lượt, mở lại ở thiết bị khác | Dòng tóm tắt thời gian · token · chi phí · file đổi; bấm file → diff | integration + e2e |
| AC-42 | `CAP-AI-01` | Phiên có nhiều thẻ công cụ + 1 yêu cầu quyền | Bật/tắt nút gọn; F5 | Bật: chỉ tin, trạng thái, kết quả, tóm tắt, "n bước…"; yêu cầu quyền vẫn hiện; nhớ theo người dùng | e2e + picky |
| AC-43 | `CAP-UX-03` | Đang soạn tin + sửa file | `setOffline` → thử Gửi/Lưu/Commit/Push/✓ → nối lại | Dải C13; nút ghi khoá có tooltip; nháp + bản sửa còn; không gì tự gửi | e2e + mobile + edge |
| AC-44 | `CAP-ACCESS-01` | Đăng nhập ở 3 trình duyệt | Đăng xuất 1 thiết bị; mọi nơi khác; đổi mật khẩu | Thiết bị bị đăng xuất về S1 ở lần gọi kế; danh sách đúng | integration + breaker |
| AC-45 | `CAP-ACCESS-03`, `CAP-AI-07` | Keycloak, `binh` đang có phiên | Thu hồi `binh`; email ngoài allowlist đăng nhập; allowlist `@nhom.vn`; Tắt SSO | `binh` bị đăng xuất, phiên dừng, gỡ allowlist; lần bị từ chối hiện + Cho phép một chạm; owner vẫn vào bằng mật khẩu | integration + operator + breaker |
| AC-46 | `CAP-OPS-04` | Log có lỗi SSH chứa mật khẩu giả | Mở Nhật ký 3 loại; tải xuống | 200 dòng cuối, bí mật bị che | integration + operator |
| AC-47 | `CAP-ACCESS-01`, `CAP-OPS-01` | Instance có 2FA, 2 thiết bị | `hugremote reset-password` | In mật khẩu tạm; mọi thiết bị về S1; bắt đổi mật khẩu; 2FA còn | integration (CLI) + operator |
| AC-48 | `CAP-ACCESS-01` | Chưa đăng nhập | Mở link sâu `…/files/src/main.ts/5`; sai 5 lần | Về đúng file dòng 5 sau mật khẩu + 2FA/SSO; bị khoá → đếm ngược | e2e + edge |
| AC-49 | `CAP-UX-01` | Desktop, tab trình duyệt và PWA | ⌥1–9 / ⌘1–9, Ctrl+Tab, ⌥W, ⌥⇧N, ⌥Y, ⌘\\, ⌘/, ⌘Enter | Mỗi phím chạy đúng; bảng ⌘/ hiện đúng bộ phím theo môi trường | e2e + power |

## 7. Luồng người dùng

### 7.1 Luồng chính — P-MOBILE: mở lại terminal đang chạy từ điện thoại

1. Mở PWA → (token hết hạn) refresh tự động → (2FA chỉ hỏi ở lần đăng nhập mới)
2. Màn Không gian làm việc: cây máy đã ghim → chạm dự án → danh sách phiên có chấm trạng thái
3. Chạm phiên đang chạy → terminal toàn màn + thanh phím → gõ → nút ← quay lại cây

**Nhánh phụ / lỗi**: mất mạng → dải "Mất kết nối — đang thử lại", terminal giữ nguyên nội dung; máy SSH
không tới được → hàng máy hiện lỗi + "Thử lại"; host key đổi → S4 cảnh báo.

### 7.2 Luồng chính — P-DESK: làm việc hai terminal song song

1. Thanh bên trái: Máy → Dự án → Phiên; bấm phiên mở thành tab ở vùng chính
2. Bấm "Chia đôi" → chọn phiên thứ hai → hai ô trái/phải, kéo vạch chia
3. Đổi dự án bằng thanh bên; tab của dự án cũ vẫn giữ (pool xterm), quay lại không vẽ lại

### 7.3 Luồng chính — P-HOST: cài đặt lần đầu

1. `make deploy` (hoặc `make dev`) → log in mật khẩu khởi tạo
2. Đăng nhập → đặt mật khẩu mới → Cài đặt → bật 2FA → lưu mã khôi phục
3. Màn Máy → Thêm máy → Thử kết nối → tin host key

## 8. Màn hình

| S# | Màn | Persona | Vào từ đâu | Thông tin bắt buộc (theo ưu tiên) | Hành động chính | Rỗng · đang tải · lỗi · không quyền | AC |
|---|---|---|---|---|---|---|---|
| S1 | Đăng nhập | mọi persona | Mở app chưa có phiên | Ô mật khẩu → (bước 2) ô mã 6 số / mã khôi phục → (lần đầu) đặt mật khẩu mới; gợi ý quên mật khẩu → `hugremote reset-password` | Đăng nhập · Xác nhận mã · Lưu mật khẩu · SSO; xong → về đích định mở | — · nút đang gửi · sai mật khẩu (còn n lần) / bị khoá (đếm ngược) · — | AC-1, AC-2, AC-3, AC-14, AC-47, AC-48 |
| S2 | Không gian làm việc | P-MOBILE, P-DESK | Sau đăng nhập; logo | Cây Máy (đã ghim trước) → Dự án → Phiên (chấm trạng thái, thời gian); "Cần bạn" + "Đang chạy"; bấm dự án → tab đang dùng lần trước (không có màn tổng quan dự án) | Chọn dự án · + Phiên Claude/Terminal · Đổi tên · Bỏ dự án · Dự án mới · Ghim/sắp xếp | Rỗng: thẻ Bắt đầu / dự án chưa phiên → hai nút Phiên Claude mới · Terminal mới · khung xám · máy lỗi kết nối + Thử lại · — | AC-7, AC-8, AC-12, AC-13, AC-28, AC-33, AC-43 |
| S3 | Máy | P-HOST, P-MOBILE | Thanh bên "Quản lý máy"; Cài đặt | Danh sách máy (tên, user@host, trạng thái, jump) → form thêm/sửa | Thêm · Sửa · Xoá (chặn khi là jump host) · Thử kết nối · Ghim · Lên/Xuống (khớp cây) | Rỗng: chỉ Máy này + Thêm máy · khung xám · lỗi đọc ssh config / lỗi kết nối có hướng dẫn · — | AC-4, AC-5, AC-8 |
| S4 | Tin host key (hộp thoại) | P-HOST | Kết nối máy chưa tin / khoá đổi | Tên máy, host:port, loại khoá, vân tay SHA256 (và vân tay cũ nếu đổi) | Tin máy này · Huỷ · (đổi khoá) tick "đã đối chiếu vân tay" rồi Tin khoá mới | — · đang kết nối · khoá đổi = cảnh báo đỏ · — | AC-6 |
| S5 | Chọn thư mục — dự án mới | P-MOBILE, P-DESK | "Dự án mới" ở S2 | Đường dẫn hiện tại (breadcrumb) → thư mục con → tên dự án | Vào thư mục · Lên trên · Thư mục mới (kiểm tên) · Tạo dự án từ thư mục này | Thư mục rỗng · khung xám · không đọc được / ngoài ALLOWED_ROOT · — | AC-7, AC-14 |
| S6 | Phiên — Terminal | P-MOBILE, P-DESK | Tab **Phiên** (Claude + terminal chung một thanh); **+** → Terminal mới | Thanh phiên (desktop tab có ×; mobile bộ chọn phiên) + chuông → nội dung terminal → thanh phím có F1–F12 (mobile, chạm terminal mở bàn phím) | Gõ · + Claude/Terminal · Chia ô (desktop) · Đổi tên · Đóng · Chuông ✓/✗ | Phiên đã kết thúc + Mở lại · đang nối · mất kết nối đang thử lại · — | AC-9, AC-10, AC-11, AC-12, AC-38, AC-49 |
| S7 | Cài đặt | P-HOST (member: phần Giao diện + Đăng xuất) | Bánh răng | Tài khoản & bảo mật (2FA, mật khẩu, thiết bị) → Nhóm (SSO, allowlist `@tên-miền`, thành viên, lần bị từ chối) → Giao diện (chủ đề, ngôn ngữ, phím tắt) → Hệ thống (phiên bản, cập nhật, tình trạng, nhật ký, báo cáo nhập v1) | Bật/tắt 2FA (nhập mã) · Đăng xuất thiết bị · Lưu/Tắt SSO · Thu hồi thành viên · Cập nhật (Ngay/Khi rảnh) · Đăng xuất | — · khung xám · mã sai / SSO lỗi / cập nhật lỗi đã quay lại · member không thấy Bảo mật/SSO/Hệ thống | AC-2, AC-3, AC-15, AC-27, AC-29..AC-32, AC-44..AC-46 |

| S8 | Files | P-MOBILE, P-DESK | Tab Files (C16) | Cây từ gốc dự án (lọc, file ẩn, `.gitignore` mờ, M/A) / Tìm trong dự án → tab file + chấm chưa lưu → editor (vạch dòng đổi) / xem trước / log / ảnh | Mở · Sửa · Lưu ⌘S · ⌘F tìm/thay · Tới dòng · Xem diff · Gửi cho Claude (chọn phiên) · Terminal tại thư mục · Tạo · Đổi tên · Xoá · Tải lên · Tải xuống | thư mục trống + Tạo file · khung xám · file quá lớn / file đổi trên đĩa · member: trong dự án | AC-16, AC-17, AC-36, AC-37, AC-43 |
| S9 | Git | P-MOBILE, P-DESK | Tab Git | Nhánh + ahead/behind → thay đổi +/− → diff → ô commit; tab Lịch sử | Fetch · Pull · Push (icon, kèm số commit) · +/− stage (từng file / tất cả) · ↶ bỏ thay đổi · Commit ⌘Enter · Đổi nhánh · Xem commit + file | "Không có thay đổi" / "chưa có repo" · khung xám · push bị từ chối · — | AC-18, AC-19 |
| S10 | Phiên — Claude | P-MOBILE, P-DESK, P-TEAM | Tab **Phiên**; **+** → Phiên Claude mới; phiên Claude ở cây; chuông | Thanh phiên + chuông → luồng chat (suy nghĩ, thẻ công cụ, thẻ duyệt quyền, tin xếp hàng, tóm tắt lượt; chế độ gọn) → ô soạn C36 (đính kèm · gọn · Context `a/b` · Hạn mức · Model · Quyền · mic · Dừng/Gửi) | Gửi / xếp hàng · Dừng (Esc) · Cho phép/Từ chối · Đổi model/chế độ (⇧Tab) · Bypass (⚠ một phiên) · Tiếp tục phiên CLI · Chia ô | "Nhập yêu cầu cho Claude…" · "Claude đang làm · <bước>" · chưa cài Claude CLI (lịch sử vẫn hiện) / hàng chờ đầy / C13 · member: chỉ phiên của mình | AC-20..AC-25, AC-35, AC-38..AC-43 |
| S11 | Chuyển nhanh | P-MOBILE, P-DESK | ⌘K / Ctrl+Alt+K / nút tìm | Ô tìm (không dấu, nhiều từ) → kết quả nhóm theo máy + File + Lệnh | Gõ · ↑↓ · Enter · Esc | gợi ý phiên đang chạy/cần duyệt · không thấy · — · member: chỉ của mình | AC-26, AC-33 |
| S12 | Mở nhanh file | P-DESK, P-MOBILE | ⌘P; nút Mở nhanh ở S8; "Tới dòng…" | Ô tìm tên (mờ) + `:dòng` → file đang mở / vừa đổi | Gõ · ↑↓ · Enter · Esc | gợi ý file đang mở · không thấy · — · — | AC-36 |
- **Điều hướng vòng này**: desktop — thanh bên cây (máy → dự án → phiên Claude/terminal) + ô Chuyển nhanh + Quản lý máy/Cài đặt; vùng chính có tab dự án **Phiên · Files · Git** (Phiên gộp Claude + terminal, **+** hỏi Claude/Terminal), chuông thông báo, chia ô, ⌘/ bảng phím tắt; mobile — thanh dưới Không gian · Máy · Cài đặt, trong dự án có tab Phiên · Files · Git và bộ chọn phiên; URL `#/s/<máy>/p/<dự án>/{claude|terminal}/<id>|files/<path>/<dòng>|git[/history]`, `#/s/<máy>/new-project/<path>`
- **Component mới cần có trong design system**: toàn bộ kho vòng 1 (`DESIGN-SYSTEM.md §4`)
- **Chuỗi hiển thị / i18n**: namespace `auth`, `workspace`, `hosts`, `terminal`, `files`, `git`, `claude`, `search`, `settings`, `errors` — `vi` và `en` đủ

## 9. Thay đổi theo target

### 9.1 `srcroot/boundaries/hugremote`

| Module / thư mục | Việc | Không được làm |
|---|---|---|
| `apps/api/src/modules/auth` | login, 2FA, refresh, logout, đổi mật khẩu, stream-ticket, guard | Trả token trong cookie đọc được bởi JS; câu tiếng Việt trong response |
| `apps/api/src/modules/hosts` | CRUD máy, test, trust-key, ssh-keys | Trả bí mật; sửa ssh config bằng regex không kiểm mtime |
| `apps/api/src/modules/workspace` | pins, projects, browse | Mở rộng `~` bằng home local |
| `apps/api/src/modules/terminal` | REST phiên + gateway WS | Attach trước khi resize |
| `apps/api/src/modules/system` + `health` | health, info, doctor, logs (redact) | Lộ đường dẫn/biến bí mật ở `/api/health` công khai |
| `apps/api/src/modules/{files,git,claude,search,sso,update,events,me}` | file + watch, git (fetch/stage/commit/push/branch/log), runner Claude + hàng chờ + duyệt quyền + tóm tắt, tìm (ripgrep), SSO + members + denials, updater (now/idle), SSE `events.v1`, preferences | Gửi chuỗi shell ghép tay; trả phiên người khác cho member (G-13) |
| `apps/api/src/integrations/{ssh,pty,git,claude-cli,oidc,updater}` | parser, pool, ProxyJump, fallback OpenSSH, PTY manager; git CLI; Claude stream-json decoder; OIDC/JWKS; updater bản cô lập | Biết HTTP/DB |
| `apps/web/src/features/{auth,workspace,hosts,terminal,files,git,claude,search,settings,notifications}` | màn S1–S12, C1–C38 | Gọi `fetch` trong component; giá trị ngoài token |
| `packages/shared` | `ErrorCode`, `SessionStatus`, `HostAuthType`, giới hạn, `normalizeRemotePath` | Import Nest/React/Node |
| `bin/` + root `Makefile` | `hugremote` CLI (doctor [--fix], restart, reset-password, import-v1, update --rollback), cài user service, 6 lệnh | — |

**Biến môi trường / cấu hình mới**: toàn bộ danh sách `TECHSTACK.md §6` (thêm TÊN vào `deployment/.env.example`)

## 10. Contract delta

| Contract | Endpoint · event · tool | Mới / sửa / bỏ | Vào (trường chính) | Ra (trường chính) | Lỗi trả về | Tương thích ngược |
|---|---|---|---|---|---|---|
| `auth-api.v1` | `POST /api/auth/login` | mới | password | accessToken, needs2fa, mustChangePassword | 401 `INVALID_CREDENTIALS` · 429 `LOCKED` | — (contract mới) |
| `auth-api.v1` | `POST /api/auth/2fa/verify` · `POST /api/auth/refresh` · `POST /api/auth/logout` · `POST /api/auth/password` · `POST /api/auth/stream-ticket` · `/api/auth/2fa` (setup/enable/disable/recovery-codes) · `GET /api/auth/me` | mới | code / (cookie) / currentPassword,newPassword / — | accessToken / ticket (30s) / qrSvg, recoveryCodes | 401 · 403 `PASSWORD_CHANGE_REQUIRED` · 403 `TWO_FACTOR_REQUIRED` · 429 `LOCKED` | — |
| `hosts-api.v1` | `GET/POST /api/hosts` · `PATCH/DELETE /api/hosts/:id` · `POST /:id/test` · `POST /:id/trust-key` · `POST /:id/disconnect` · `GET /api/ssh-keys` | mới | alias, hostName, user, port, authType, keyPath?, password?, proxyJump?, workspaceDir | id, kind, alias, hostName, user, port, proxyJump, workspaceDir, status, pinned (KHÔNG bí mật) | 409 `HOST_ALIAS_TAKEN` · 409 `SSH_CONFIG_CHANGED` · 409 `HOST_KEY_UNKNOWN`/`HOST_KEY_CHANGED` (kèm fingerprint) · 502 `SSH_*` | — |
| `workspace-api.v1` | `GET/PUT /api/workspace/pins` · `GET /api/hosts/:id/projects` · `POST /api/projects` · `PATCH/DELETE /api/projects/:id` · `GET /api/hosts/:id/browse` | mới | hostId, rootPath, name / path | project{id,hostId,name,rootPath,isHome} / entries[] | 403 `PATH_OUTSIDE_ROOT` · 404 `PATH_NOT_FOUND` · 409 `HOME_NOT_DELETABLE` | — |
| `terminal-api.v1` | `GET/POST /api/projects/:id/terminals` · `PATCH/DELETE /api/terminals/:id` | mới | name? | session{id,name,status,createdAt,lastAttachedAt} | 404 · 409 `SESSION_LIMIT` (50) | — |
| `terminal-ws.v1` | `/ws/terminal?sessionId&cols&rows&ticket` | mới | phím thô · `{type:resize}` · `{type:ping}` | output thô · `{type:pong}` · `{type:exit,code}` | đóng 4401 vé sai · 1008 Origin lạ · 4404 phiên không có | — |
| `system-api.v1` | `GET /api/health` · `GET /api/system/info` | mới | — | status / version, checks[] | 503 khi DB hỏng | — |
| `files-api.v1` · `git-api.v1` · `claude-api.v1` · `claude-stream.v1` · `search-api.v1` · `sso-api.v1` · `update-api.v1` · CLI | xem `context/ARCHITECTURE.md §5` (đường dẫn, sự kiện) | mới | xem ARCHITECTURE §5 | xem ARCHITECTURE §5 | 409 `FILE_CHANGED`/`QUEUE_FULL`/`INTERACTION_ALREADY_ANSWERED`/`GIT_NON_FAST_FORWARD`/`UPDATE_IN_PROGRESS` · 403 `NOT_SESSION_OWNER` · 413 `FILE_TOO_LARGE` · `CLAUDE_NOT_INSTALLED` · `SSO_EMAIL_NOT_ALLOWED` | — (contract mới) |
| `auth-api.v1` (bổ sung) | `GET /api/auth/devices` · `DELETE /api/auth/devices/:familyId` · `POST /api/auth/devices/revoke-others` · `GET/PATCH /api/me/preferences` | mới | — / theme, locale, compact, lastTab | devices[{familyId, userAgent, ip, createdAt, lastUsedAt, current}] / preferences | 404 · 403 | — |
| `events.v1` | `GET /api/events/stream?ticket=` (SSE) | mới | ticket | `session_status`, `interaction_requested`, `interaction_answered`, `file_changed`, `turn_finished` (lọc G-13) | 401 vé sai | — |
| `sso-api.v1` (bổ sung) · `system-api.v1` · `update-api.v1` · `claude-api.v1` | `GET/DELETE /api/sso/members[/:id]` · `GET /api/sso/denials` · `POST /api/sso/disable` · `GET /api/system/logs?kind&tail` · `POST /api/system/update {when}` · `POST/DELETE /api/claude/sessions/:id/queue[/:qid]` | mới | xem ARCHITECTURE §5 | xem ARCHITECTURE §5 | 409 `QUEUE_FULL` · 409 `HOST_IS_JUMP {dependents[]}` | — |

## 11. Dữ liệu & migration

| DB / schema | Bảng | Mới / sửa | Trường · index · ràng buộc | Migration & dữ liệu cũ |
|---|---|---|---|---|
| SQLite `hugremote.db` | `users`, `refresh_tokens`, `two_factor`, `login_attempts`, `sso_config`, `hosts_meta`, `known_hosts`, `pinned_hosts`, `projects`, `terminal_sessions`, `claude_sessions`, `claude_messages`, `recent_files`, `update_runs`, `settings`, `claude_queue`, `sso_denials` (+ cột `users.preferences`, `users.revoked_at`, `refresh_tokens.family_id/ip/user_agent/last_used_at`) | mới | xem `context/ARCHITECTURE.md §6` (unique: `refresh_tokens.token_hash`, `known_hosts(host,port,key_type)`, `pinned_hosts(user_id,host_id)`, `projects(host_id,root_path)`) | `0001-init` — bảng mới; dữ liệu v1 nhập bằng `hugremote import-v1` (chỉ đọc file v1) |

**Seed cho dev, dogfood & demo**: `deployment/local/`: compose `sshd` (user `dev`, khoá `dev_ed25519`, `git`, `fake-claude` phát fixture stream-json ghi từ CLI thật) sau `jump`; `ssh_config.sample` dùng `Include conf.d/*.conf` (`demo-sshd`, `demo-jump`, `demo-behind-jump`, một host đổi host key); `~/projects/demo-api` (repo 60 commit, file đang sửa, remote bare để push) + `demo-web`; `~/.claude/projects` mẫu có 2 phiên CLI; Keycloak realm `hugremote` (`an@nhom.vn`, `binh@nhom.vn`); thư mục dữ liệu v1 mẫu; kênh phát hành giả (git repo 2 tag, tag mới cố ý hỏng health). Mỗi vai dogfood một instance (`DATA_DIR` + cổng riêng, `deployment/local/dogfood-instances.sh`).

## 12. Luật nghiệp vụ, mặc định & giới hạn

| Luật | Mặc định | Chỉnh ở đâu | Vi phạm thì | Thông điệp người dùng thấy |
|---|---|---|---|---|
| Độ dài mật khẩu | ≥10 ký tự, khác mật khẩu cũ | cố định | chặn | "Mật khẩu cần ít nhất 10 ký tự" |
| Khoá đăng nhập | 5 lần sai / 15 phút, đếm riêng mật khẩu và 2FA | `AUTH_MAX_ATTEMPTS`, `AUTH_LOCK_MINUTES` | chặn | "Bạn đã nhập sai quá nhiều lần. Thử lại sau 14:32" |
| Thời hạn phiên | access 15 phút, refresh 14 ngày trượt | cố định | về S1 | "Phiên đăng nhập đã hết hạn" |
| Số phiên terminal | tối đa 50 toàn instance | cố định | chặn | "Đã đạt 50 phiên. Đóng bớt phiên cũ để mở phiên mới" |
| Thu hồi PTY không ai xem | 30 phút | cố định | phiên `exited` | "Phiên đã kết thúc" |
| Buffer replay | 500KB, cắt ở `\n` | cố định | — | — |
| Duyệt thư mục local | trong `ALLOWED_ROOT` | `ALLOWED_ROOT` | chặn | "Thư mục này nằm ngoài phạm vi được phép" |
| Mở file trong editor | ≤10 MB | cố định | 413 `FILE_TOO_LARGE` | "File quá lớn để mở — Xem 1.000 dòng cuối / Tải xuống" |
| Tải lên | ≤100 MB/lần, ≤200 file | cố định | chặn | "Tối đa 100 MB và 200 file mỗi lần" |
| Zip tải xuống tạm | dọn sau 60 phút | cố định | — | — |
| Tìm trong dự án | ≤500 kết quả, ≤10 s, bỏ `.gitignore` | cố định | cắt | "Hiện 500 kết quả đầu — thu hẹp từ khoá" |
| Lịch sử Git | 50 commit/lần | cố định | — | "Tải thêm 50 commit" |
| Replay Claude | 1.000 sự kiện gần nhất | cố định | tải lại từ DB | — |
| Hàng chờ tin Claude | ≤10 tin/phiên | cố định | 409 `QUEUE_FULL` | "Hàng chờ đã đầy — chờ Claude xong lượt" |
| Probe model/context | cache 30 s, ≤2 probe đồng thời | cố định | giữ giá trị cũ | "Không lấy được danh sách model" |
| File gần đây | 50/người | cố định | xoá cũ nhất | — |
| Lần SSO bị từ chối | giữ 200 dòng | cố định | xoá cũ nhất | — |
| Allowlist SSO | email hoặc `@tên-miền` | Cài đặt › Nhóm | từ chối + ghi `sso_denials` | "Email này chưa được cấp quyền" |

## 13. Ca biên & lỗi

| Ca | Kích hoạt khi | Hệ thống làm gì | Người dùng thấy gì |
|---|---|---|---|
| Host key đổi | Container đổi khoá | 409 `HOST_KEY_CHANGED`, không kết nối | S4 cảnh báo đỏ, vân tay cũ/mới |
| ssh config sửa bên ngoài khi đang mở form | mtime đổi | 409 `SSH_CONFIG_CHANGED` | "Cấu hình SSH vừa thay đổi ở nơi khác — đã tải lại" |
| Jump host chết | ProxyJump không tới | lỗi `SSH_UNREACHABLE` (qua jump) | "Không tới được demo-jump (máy trung gian)" + Sửa máy |
| ssh2 không hỗ trợ agent (1Password/Keychain) | auth chain thất bại | fallback OpenSSH 2 phút | Không thấy gì khác — kết nối được |
| Mất WebSocket | mạng chập chờn | nối lại tối đa 15 lần, xin vé mới, replay | Dải "Mất kết nối — đang thử lại (lần n)" |
| Restart service | `make deploy` | phiên `running` → `exited` | Phiên "Đã kết thúc" + "Mở lại" |
| Hai thiết bị cùng mở một phiên | — | nhiều socket một PTY, kích thước theo socket resize sau cùng | Cả hai thấy cùng nội dung |
| Xoá máy đang có phiên | — | hỏi; đóng PTY; xoá dữ liệu máy | "Xoá demo-sshd sẽ đóng 2 phiên và xoá 1 dự án" |
| Xoá máy đang là jump host | máy khác `proxyJump` tới nó | 409 `HOST_IS_JUMP {dependents[]}` | "Chưa xoá được — đang là máy trung gian của demo-behind-jump" |
| Gửi tin khi Claude đang chạy | phiên `running` | đưa vào `claude_queue`, tự gửi khi xong lượt | Tin mờ "Xếp hàng" + Huỷ |
| Hai thiết bị cùng duyệt một yêu cầu | — | lần hai 409 `INTERACTION_ALREADY_ANSWERED` | "Yêu cầu này đã được trả lời ở thiết bị khác" |
| Claude sửa file đang mở | `file_changed` | chưa sửa → tự tải lại + dải báo; đang sửa → giữ bản người dùng | So sánh · Lấy bản trên máy · Giữ bản của tôi |
| Mất kết nối server | SSE/WS rớt | khoá thao tác ghi phía web, giữ nháp/bản sửa | Dải C13, nút ghi có tooltip |
| Bỏ dự án | owner | xoá bản ghi cho cả nhóm, dừng mọi phiên của dự án, không xoá thư mục | "Bỏ dự án sẽ dừng n phiên (cả của thành viên)" |
| Thu hồi member | owner | thu hồi refresh, dừng phiên, gỡ allowlist | "Đã thu hồi …" |

## 14. Quyền & bảo mật

- **Dòng ma trận `context/PERSONAS.md §2` vòng này chạm**: mọi dòng của cả bốn cột `owner`, `member`, `đã nhập đúng mật khẩu, chưa qua 2FA`, `chưa đăng nhập`
- **Ca ✗ mới phải kiểm (vai `breaker`)**: gọi API khi chỉ qua bước mật khẩu (chưa 2FA); WS không vé / vé dùng lại / vé hết hạn; Origin lạ; `browse` ra ngoài `ALLOWED_ROOT`; đổi mật khẩu không có mật khẩu cũ; danh sách máy lộ bí mật; member gọi phiên/hàng chờ/duyệt của owner (403 `NOT_SESSION_OWNER`); member nhận sự kiện phiên người khác qua `events.v1`; member gọi SSO/members/logs/update/devices của người khác; tắt 2FA không kèm mã
- **Bí mật mới**: mật khẩu/passphrase SSH — AES-256-GCM trong `hosts_meta.secret_enc`; TOTP secret — `two_factor.secret_enc`; OIDC/Google — `sso_config.client_secret_enc`; mã khôi phục — lưu băm, chỉ hiện một lần; khoá dẫn từ `DATA_DIR/secret.key` (0600) — chỉ tiến trình api đọc
- **Đầu vào không tin cậy mới**: trường form máy (alias, host, user, proxyJump, path) → class-validator + whitelist ký tự, không nối chuỗi vào lệnh shell (ProxyCommand dựng bằng mảng tham số); `path` duyệt thư mục → realpath + kiểm root; output PTY là dữ liệu thô, xterm tự hiển thị

## 15. Phi chức năng

| Hạng mục | Mức yêu cầu | Đo bằng |
|---|---|---|
| Mở app tới thấy cây (đã đăng nhập) | < 1,5 s trên 4G giả lập (Fast 4G) | Playwright throttling + dogfood mobile |
| Độ trễ gõ phím terminal (local) | < 50 ms vòng | đo echo trong test |
| Bundle web ban đầu | < 400 KB gzip (xterm tách chunk) | `vite build` report |
| Bộ nhớ api lúc rảnh | < 200 MB với 10 phiên | `make doctor` / ps |

**Sự kiện đo mới** (`PRODUCTION-READY.md` nhóm 4): nhật ký cục bộ `login_success`, `terminal_opened`, `terminal_reattached` (ghi vào log, không gửi ra ngoài)

## 16. Phụ thuộc ngoài & việc của Authority

| Thứ cần | Ai chuẩn bị | Trước khi | Tốn tiền / đăng ký dịch vụ? | Không có thì |
|---|---|---|---|---|
| Docker trên máy dev (compose sshd/jump/keycloak) | Authority (đã có) | ngày 1 pha I | không | test SSH/SSO chỉ chạy được với máy thật |
| Claude Code CLI đã đăng nhập trên máy local (để thử với CLI thật ngoài `fake-claude`) | Authority (đã có) | lát 3 (bước 5 §21) | không (dùng gói Claude sẵn có) | chỉ thử bằng fixture |
| App xác thực (Google Authenticator/1Password) để thử 2FA | Authority | demo | không | dùng mã sinh trong test |
| Bấm thử + chốt prototype | Authority | khoá scope (pha V) | không | không được khoá scope |

## 17. Quyết định & câu hỏi mở

| # | Loại | Nội dung | Phương án đề xuất | Ai chốt | Đảo ngược được? |
|---|---|---|---|---|---|
| D-1 | đã chốt | P chỉ P1, ở vòng 1 | — | Authority 2026-11-21 | có |
| D-2 | đã chốt | 2FA vào vòng 1 | — | Authority 2026-11-21 | có |
| D-3 | đã chốt | Bố cục Orca + màu HugRemote, mobile + desktop đều tốt | — | Authority 2026-11-21 | có |
| D-4 | đã chốt | Files mở ở gốc dự án | — | Authority 2026-11-21 | có |
| D-5 | đã chốt | Một tài khoản chủ (+ member qua SSO), mỗi vai dogfood một instance | — | meta + DECISIONS 2026-11-21 | có |
| D-6 | đã chốt | Gộp 6 vòng làm một — vòng 1 giao 30 capability | — | Authority 2026-11-21 | có |
| Q-1 | câu hỏi mở | — không còn câu hỏi mở cho vòng 1 | — | — | — |

## 18. Kế hoạch test

| Lớp | Phủ gì | Công cụ (theo `context/TECHSTACK.md`) |
|---|---|---|
| unit | TOTP (vector RFC 6238), PBKDF2, AES-GCM, parser ssh config (Include/wildcard/vòng lặp), `normalizeRemotePath`, cắt buffer ở `\n` | Jest |
| integration | API auth/hosts/workspace/terminal/files/git/claude (hàng chờ, duyệt, tóm tắt)/search/sso/update/events/system logs với SQLite tạm; SSH thật tới container sshd/jump; PTY local | Jest + supertest + ws |
| contract | OpenAPI sinh `types/api.d.ts` không lệch (build web fail nếu lệch) | `openapi-typescript` trong `make check` |
| e2e | Kịch bản §2 bước 1–18 ở 1440×900 và 390×844 | Playwright |
| bảo mật | AC-14, AC-34: không token, Origin lạ, vé, path, khoá JSON bí mật; ma trận PERSONAS §2 (AC-33) | Jest + supertest + ws |

## 19. Gợi ý dogfood

Kế hoạch đầy đủ đã lập ở `context/DOGFOOD-PLAN.md` (12 vai bật: smoke, newbie, edge, picky, mobile, locale, power, rushed, integrator, concurrent, breaker, operator; 5 đợt).

| Vai | Bật vì | Persona | Kịch bản vòng này | Hồ sơ dữ liệu |
|---|---|---|---|---|
| `smoke` | luôn bật | P-MOBILE | §2 bước 1–18 | seed mới |

**Dòng smoke hồi quy thêm từ vòng này**: toàn bộ `DOGFOOD-PLAN.md §3` (28 dòng), luồng lõi Claude là dòng 12

## 20. Rủi ro & thứ tự cắt

| Rủi ro | Dấu hiệu sớm | Phòng | Nếu xảy ra |
|---|---|---|---|
| Vòng quá dài (~30 ngày công) | Lát 3 chưa xong ở ngày 20 | 6 lát cắt dọc, mỗi lát demo được; `smoke` sau mỗi lát | Cắt theo thứ tự dưới, phần cắt thành vòng 2 |
| SSH macOS/agent/ProxyJump | Thử kết nối qua jump fail ngày 3 | Port thuật toán v1 + container thử | Fallback OpenSSH cho mọi thao tác |
| Giao thức Claude CLI đổi | Fixture lệch CLI thật | Decoder/normalizer tách riêng, fuzz | Ghim phiên bản CLI tối thiểu |
| Phân quyền member lộ phiên | breaker thấy phiên người khác | G-13 + test ma trận | Tắt SSO tới khi sửa |
| Updater hỏng bản đang chạy | Health lỗi sau cập nhật | Bản cô lập + quay lại | `hugremote update --rollback` |

**Thứ tự cắt nếu vượt biên hoặc trễ**: 1. tự cập nhật trong app (AC-31) → 2. giọng nói + hạn mức (AC-24 phần mic, AC-25) → 3. lịch sử Git (AC-19) → 4. SSO + member (AC-32, AC-33) → 5. chủ đề sáng + en (AC-27). Phần bị cắt ghi `context/ROADMAP.md` + §25 và thành vòng 2.

## 21. Thứ tự triển khai

Lát cắt dọc theo đúng thứ tự wave của intake — mỗi lát chạy được end-to-end và có demo riêng.

| Bước | Lát cắt | Target chạm | Cỡ | Xong khi |
|---|---|---|:--:|---|
| 1 | Scaffold monorepo + compose (shared/api/web/sshd/jump/keycloak) + 6 lệnh + health + vỏ app có token tối/sáng + **bộ `components/ui` C1–C38 từ gói `intake/design-systems/hugremote/` + route `#/_ds` + test so ảnh với `screens/` (G-16)** | hugremote | 2 | `make dev` mở vỏ app; `/api/health` 200; `#/_ds` khớp ảnh trang mẫu |
| 2 | Đăng nhập + đổi mật khẩu + refresh + đăng xuất + 2FA + guard + Origin + vé stream | hugremote | 2 | AC-1..AC-3, AC-14 |
| 3 | Máy local → dự án Home → terminal WS (pool xterm) → SSH (parser, ssh2, ProxyJump, fallback, host key) + CRUD máy + ghim + cây + chia đôi + thanh phím | hugremote | 5 | AC-4..AC-12, demo §2 bước 5–6, 15 |
| 4 | Files + Git working tree | hugremote | 5 | AC-16..AC-18, demo bước 12–13 |
| 5 | Claude: runner local/SSH, decoder/normalizer/assembler, SSE + replay, duyệt quyền, model/context, phiên CLI, chia ô tổng quát | hugremote | 6 | AC-20..AC-23, AC-35, AC-38..AC-42, demo bước 7–11, 14 |
| 6 | Chuyển nhanh + sáng/en + Bắt đầu + installer + nhập v1 + doctor + pentest | hugremote | 5 | AC-13, AC-15, AC-26..AC-30, AC-34, AC-43, AC-48, AC-49 |
| 7 | SSO + member + lịch sử Git | hugremote | 3 | AC-19, AC-32, AC-33, AC-44..AC-47 |
| 8 | Tiện ích soạn prompt + hạn mức + tự cập nhật | hugremote | 3 | AC-24, AC-25, AC-31 |
| 9 | P1: checklist production-ready + `make deploy` local | hugremote | 0,5 | `gate.py P1` |

## 22. Định nghĩa xong

- [ ] Mọi AC ở §6 đạt, kiểm bằng đúng cách ghi ở cột "Kiểm bằng"
- [ ] Kịch bản §2 chạy trọn trên hồ sơ seed mới tinh
- [ ] `make check` + `make test` xanh (gồm `security.e2e`, test ma trận quyền); migration `0001-init` chạy trên DB trống
- [ ] Dogfood theo §19 (`smoke` đầu + cuối), phát hiện đã xử hoặc đã ghi
- [ ] Contract §10 đã cập nhật ở `context/ARCHITECTURE.md §5` và nơi producer khai contract
- [ ] Video demo kịch bản §2 đã quay, ghi `context/DEMOS.md` mục `## Vòng 1` (pha R — `gate.py R`)
- [ ] `gate.py P1` xanh: `PRODUCTION-READY.md` 4 nhóm (trừ mục sau deploy), `make test/deploy/doctor` có thân

## 23. Phụ thuộc vòng trước

Vòng đầu tiên — không có.

| Cần gì | Từ vòng | Hỏng thì sao |
|---|---|---|
| — | — | — |

## 24. Legacy được phép phá

Vòng 1 — chưa có legacy của sản phẩm mới. Dữ liệu và instance HugRemote v1 **không bị đụng**: bản mới dùng
`DATA_DIR` riêng, cổng riêng khi chạy song song; nhập dữ liệu v1 chỉ đọc file v1, có sao lưu (AC-30).

| Phá gì | Ai/dữ liệu đang dùng | Đường di trú |
|---|---|---|
| — | — | — |

## 25. Điều chỉnh khi mở vòng

| Ngày | Đổi gì | Vì sao |
|---|---|---|
| 2026-11-21 | Thêm CAP-ACCESS-02 (2FA) và pha P (chỉ P1) so với W1 của intake | Authority chốt ở pha V (DECISIONS 2026-11-21) |
| 2026-11-21 | Mở rộng Files theo việc của developer: AC-16/17 mở rộng, thêm AC-36/37 | Phản hồi prototype lượt 3 |
| 2026-11-21 | Gộp W1–W6 vào vòng 1: 30 capability, 35 AC (sau đó 37, rồi 49), 6 lát triển khai; xoá `l2`..`l6` | Authority: "gộp vào thành 1 loop" (DECISIONS 2026-11-21) |
| 2026-11-21 | Prototype lượt 1–7 + rà chéo tài liệu: tab Phiên gộp, chuông duyệt, cấu hình riêng từng phiên, hàng chờ tin, tóm tắt lượt, chế độ gọn, Context `a/b`, mất kết nối khoá ghi, thiết bị, quản trị nhóm, nhật ký, reset-password, link sâu, phím tắt — thêm AC-38..AC-49; mở rộng AC-5/6/11/12/16–19/22/25/31/33 | Phản hồi Authority lượt 1–7 + vai power/mobile/operator (DECISIONS D1–D17) |
