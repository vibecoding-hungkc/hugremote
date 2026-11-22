---
type: solution
tier: T0
status: DRAFT
last_reviewed: "2026-11-21"
---

# SOLUTION — hugremote

> **Đầu mối của bộ giải pháp** — bộ gồm file này + `ARCHITECTURE.md` (hệ thống trông thế nào) +
> `TECHSTACK.md` (dựng bằng gì) + `DESIGN-SYSTEM.md` (trông ra sao, nếu có UI). File này trả lời
> câu còn lại: **bài toán của Phase được giải ra sao, và pha I phải tuân thủ những gì.**
>
> - **Phần A — giải pháp tổng thể của Phase**: lập ở pha V của **vòng đầu tiên của Phase** (MVP,
>   Phase 2…), Authority chốt, đứng yên suốt Phase. Đổi giữa Phase → dòng ở §A6, không sửa lén.
> - **Phần B — giải pháp chi tiết của vòng**: viết lại ở pha V **mỗi vòng** cho đúng AC của vòng.
>   Trước khi viết lại, phần nào của B vòng trước còn hiệu lực lâu dài thì **nâng lên** A3 (quy ước)
>   hoặc `ARCHITECTURE.md` (contract, dữ liệu) — B cũ nằm ở `context/archive/vong-N/`.
>
> Pha I **tuân thủ** A3 và B1: làm khác đi phải có 1 dòng `DECISIONS.md` + sửa file này cùng commit
> (luật #4). Ngắn: A tối đa ~2 trang, B tối đa ~1 trang — Authority đọc A một lần mỗi Phase.
> `gate.py V` kiểm cả hai phần.

Phase: MVP
Vòng đầu của Phase: 1
Authority chốt Phase: _CHƯA ĐIỀN_

<!-- Ba dòng trên là dòng máy đọc. `Phase` và `Vòng đầu của Phase` phải khớp dòng `Phase` trong
     STATE.md. `Authority chốt Phase: <ngày ISO>` — ghi khi Authority đọc phần A và đồng ý (đang pha
     V, được hỏi); ở vòng đầu của Phase từ vòng 2 trở đi, ngày phải ≥ `Vòng mở`. -->

## A. Giải pháp tổng thể của Phase

### A1. Sản phẩm cuối Phase

Phase MVP có **đúng một vòng** (Authority gộp 6 vòng — DECISIONS 2026-11-21). Hết vòng 1, chủ instance **gỡ
HugRemote v1 và dùng bản mới hằng ngày** trên điện thoại lẫn desktop, và nhóm nhỏ dùng chung được: đăng nhập
an toàn (mật khẩu + 2FA, SSO cho thành viên), một cây Máy → Dự án → Phiên kiểu Orca, giao việc cho Claude Code
rồi bỏ máy đi và duyệt quyền từ điện thoại, xem file/diff và commit, terminal chạy nền, chuyển nhanh ⌘K, tối/sáng
+ vi/en, cài một lệnh mang theo dữ liệu v1, tự cập nhật trong app.

| Năng lực | Persona | Vòng | Xong Phase khi |
|---|---|---|---|
| CAP-ACCESS-01..03 Đăng nhập, 2FA, SSO | mọi persona | 1 | Mở ra Internet an toàn; thành viên vào bằng SSO |
| CAP-HOST-01..03 Máy, CRUD, host key | P-HOST | 1 | Thêm máy qua jump host không sửa file tay |
| CAP-PROJ-01..03 Dự án, chuyển nhanh, ghim | P-MOBILE, P-DESK | 1 | Một phạm vi cho mọi tab; ≤3 thao tác tới đúng chỗ |
| CAP-TERM-01, 02 Terminal | P-MOBILE, P-DESK | 1 | TUI không vỡ khi đổi thiết bị; gõ được trên điện thoại |
| CAP-FILE-01, 02 Files | P-MOBILE, P-DESK | 1 | Sửa nhanh thứ Claude viết |
| CAP-GIT-01, 02 Git + lịch sử | P-MOBILE, P-DESK | 1 | Commit/push từ điện thoại; xem lại commit |
| CAP-AI-01..07 Claude | P-MOBILE, P-DESK, P-TEAM | 1 | Giao việc rồi bỏ máy đi; duyệt quyền 1 chạm; mỗi người thấy phiên của mình |
| CAP-UX-01..03 Vỏ, design system, lần đầu | mọi persona | 1 | Mỗi thứ một lối tới; tối/sáng, vi/en; người mới tự dùng được |
| CAP-OPS-01..04 Cài, nhập v1, cập nhật, doctor | P-HOST | 1 | Cài một lệnh; không mất dữ liệu v1; cập nhật có quay lại |
| CAP-SEC-01 Bảo mật | mọi persona | 1 | Pentest v1 + 4 ca mới PASS |
| CAP-OPS-05 App macOS | P-DESK, P-HOST | — | Phase 3, ngoài kế hoạch |

### A2. Hướng giải pháp

| Vấn đề | Giải pháp chọn | Đã loại | Vì sao |
|---|---|---|---|
| Hình dạng hệ thống | Một tiến trình NestJS giữ mọi quyền + phục vụ SPA, một monorepo | Tách service PTY/SSH/Claude riêng | Cùng quyền OS, cùng pool SSH — tách chỉ thêm IPC |
| Lưu trạng thái | SQLite (TypeORM, migration) trong `DATA_DIR`, 0600 | Postgres; file JSON như v1 | Cài một lệnh; transaction + migration thay cho ghi đè file |
| Nguồn danh sách máy | `~/.ssh/config` là nguồn sự thật, DB chỉ giữ phần bổ sung | Danh sách máy riêng trong DB | Dùng lại cấu hình sẵn có; người dùng vẫn `ssh alias` được ngoài app |
| Kết nối SSH | ssh2 thử khoá → agent → mật khẩu; ProxyJump → ProxyCommand `ssh -W`; lỗi thì OpenSSH hệ thống (ControlMaster) | Chỉ ssh2; chỉ OpenSSH | Thuật toán v1 đã qua ≥4 vòng vá trên macOS |
| Xác thực | JWT access 15' trong bộ nhớ + refresh 14 ngày cookie httpOnly băm trong DB; vé 30s cho WS/SSE | Cookie phiên + CSRF token như v1 | Bền qua restart, không CSRF, đúng skill |
| Phiên terminal | PTY + buffer trong RAM, metadata trong DB; resize trước replay; pool xterm phía web | Ghi output xuống đĩa; tmux trên máy đích | Đủ cho chạy nền; restart mất phiên là chấp nhận được |
| Claude | Spawn CLI `stream-json` hai chiều, tác vụ nền độc lập kết nối, replay theo sequence qua SSE; hàng chờ tin nhắn ở server; một SSE toàn cục `events.v1` cho trạng thái mọi phiên | Chạy Claude trong PTY rồi parse màn hình | Giao thức có cấu trúc, đã kiểm chứng ở v1.6 |
| Điều hướng | Một cây Máy → Dự án → Phiên (Orca); desktop thanh bên + tab/chia ô, mobile cây toàn màn + thanh dưới | Bảy bề mặt như v1 | Một lối tới mỗi thứ |
| Phạm vi | Phạm vi hiện hành = (máy, dự án) cho mọi tab, nằm trong URL hash | Files theo máy như v1 | Authority chốt; đóng lớp lỗi "sai scope" |
| Phân phối | User service trên máy người dùng; `make deploy` cài local; installer công khai `install.sh`/`beta.sh` cùng vòng 1 | PaaS / Docker là kênh chính | Phải chạy nơi có PTY/`~/.ssh`/`~/.claude` |

### A3. Quy ước bắt buộc — pha I tuân thủ

| Mã | Quy ước | Áp cho | Kiểm bằng |
|---|---|---|---|
| G-1 | Mọi route `/api/*` và WS mặc định qua `JwtAuthGuard` + kiểm 2FA đã xong + kiểm `must_change_password`; route công khai phải gắn `@Public()` và nằm trong danh sách: login, 2fa/verify, refresh, health | apps/api | test bảo mật quét mọi route + breaker |
| G-2 | Response chỉ là DTO tường minh; cấm trả entity; cấm khoá `password`, `passphrase`, `secret*`, `*_hash`, `*_enc` trong mọi response (test quét JSON) | apps/api | test quét khoá + reviewer |
| G-3 | Lỗi theo khuôn `{code, message?, details?}`, `code` là enum `ErrorCode` ở `@app/shared`; backend không trả câu cho người đọc; web dịch qua i18n `errors.<CODE>` | api, web | test + locale |
| G-4 | Mọi đường dẫn local qua `resolveWithinRoot(path, ALLOWED_ROOT)` (realpath, chặn `..`/symlink/null byte); đường dẫn remote lưu dạng `~/…`, không mở rộng bằng home local; `cd` remote dùng `{ cd -- "<dir>" \|\| cd "$HOME"; }` | apps/api | unit + breaker |
| G-5 | Không nối chuỗi người dùng vào lệnh shell: spawn bằng mảng tham số; tham số buộc phải qua shell remote thì quote bằng `shellQuote` của `@app/shared` | apps/api | unit + reviewer |
| G-6 | Bí mật (mật khẩu SSH, passphrase, TOTP secret) mã hoá AES-256-GCM qua `CryptoService`; file DB, `secret.key`, `known_hosts`, log mode 0600, thư mục 0700 | apps/api | test `stat` + doctor |
| G-7 | Ghi `~/.ssh/config`: đọc mtime → sửa đúng block (kể cả file Include) → ghi file tạm + rename → nếu mtime đổi giữa chừng trả 409 `SSH_CONFIG_CHANGED`; giữ nguyên comment và block khác | apps/api | unit parser/writer |
| G-8 | Thay đổi schema chỉ qua migration TypeORM có version, `synchronize: false`, migration chỉ thêm (đổi/xoá đi hai bước qua hai vòng) | apps/api | review + `make migrate` |
| G-9 | Thời gian lưu UTC ISO-8601; hiển thị giờ máy người xem, định dạng `dd/MM/yyyy HH:mm`, thời lượng phiên dạng `2 giờ 5 phút` | api, web | locale |
| G-10 | Web: mọi giá trị màu/chữ/khoảng cách/bo góc từ token `DESIGN-SYSTEM.md §2` (CSS variables); mọi chuỗi qua i18n; component không `fetch`, chỉ hook TanStack Query trong `features/<domain>/` | apps/web | picky + test chuỗi cứng + reviewer |
| G-11 | View chính gắn URL hash `#/s/:hostId/p/:projectId/<tab>/:id?` (Files: `…/files/<đường dẫn>/<dòng>?`); query con `enabled` chỉ khi đã có hostId + projectId; chưa đăng nhập → lưu hash đích (chỉ `#/…` nội bộ) trước khi chuyển `#/login`, đăng nhập xong (cả 2FA, SSO) về đúng đích | apps/web | e2e F5/Back + edge |
| G-12 | Log có cấu trúc (pino), `redact` trường bí mật; không log nội dung terminal/prompt | apps/api | reviewer |
| G-13 | Mọi truy vấn phiên terminal/Claude theo id lọc thêm `owner_user_id` khi người gọi là `member`; route owner-only gắn `@Roles('owner')`; WS/SSE kiểm chủ phiên lúc đổi vé | apps/api | breaker + operator |
| G-14 | Tác vụ Claude chạy độc lập với kết nối: mọi sự kiện có `sequence` tăng dần, ghi `claude_messages` trước khi phát; client nối lại chỉ bằng `after=<sequence>` | apps/api, apps/web | integration + concurrent |
| G-15 | Ghi file từ editor luôn kèm `baseMtime`; không ghi đè im lặng | api, web | concurrent |

### A4. Yêu cầu phi chức năng — có số

| Hạng mục | Mức yêu cầu | Đo bằng |
|---|---|---|
| Mở app tới thấy cây (đã đăng nhập) | < 1,5 s trên Fast 4G | Playwright throttling, dogfood mobile |
| Độ trễ gõ phím terminal local | < 50 ms vòng | test echo |
| Phiên đồng thời | 50 phiên PTY, 10 máy SSH, bộ nhớ < 300 MB | test tải nhẹ |
| Bundle web ban đầu | < 400 KB gzip | báo cáo `vite build` |
| Thiết bị | iOS Safari 17+, Chrome Android 120+, Chrome/Firefox/Safari desktop 2 bản gần nhất; 360px → 2560px | e2e 3 viewport |
| Trợ năng | Tương phản AA (gate tính); mọi thao tác dùng được bằng bàn phím trên desktop | gate V + dogfood |

### A5. Rủi ro lớn của Phase

| Rủi ro | Khả năng × tác động | Phòng ngừa | Nếu xảy ra |
|---|---|---|---|
| Tương thích SSH macOS (agent Keychain/1Password, ProxyJump, PATH khi chạy service) | cao × cao | Port nguyên thuật toán v1, test container sshd + jump, fallback OpenSSH | Fallback OpenSSH cho mọi thao tác của máy đó |
| TUI vỡ khi chuyển phiên/thiết bị | trung bình × cao | Pool xterm, resize trước replay, buffer cắt `\n` | Gửi clear + vẽ lại sau attach |
| Giao thức stream-json của Claude CLI đổi | trung bình × cao | Decoder/normalizer tách riêng, fixture ghi từ CLI thật + fuzz | Ghim phiên bản CLI tối thiểu, báo rõ khi lệch |
| Di trú dữ liệu v1 làm hỏng dữ liệu thật | thấp × cao | Chỉ đọc file v1, sao lưu trước, DATA_DIR riêng | Giữ v1 chạy song song tới khi xong |
| Một vòng ôm cả hệ thống (~30 ngày công) — vòng dài, khó thấy tiến độ, dễ trượt | cao × cao | Thứ tự triển khai 6 lát cắt dọc (`l1/_PROPOSAL.md §21`), mỗi lát có demo riêng chạy được; dogfood `smoke` sau mỗi lát | Cắt theo thứ tự `l1/_PROPOSAL.md §20` — phần cắt ghi `ROADMAP.md §3` và chuyển thành vòng 2 |
| SSO + phân quyền member làm sai dẫn tới lộ phiên của người khác | trung bình × cao | G-1, G-13; ma trận `PERSONAS.md §2`; vai `breaker` + `operator` | Tắt SSO (owner vẫn đăng nhập mật khẩu) tới khi sửa |
| Updater tự cập nhật làm hỏng bản đang chạy | trung bình × cao | Bản cài cô lập + symlink `current` + health check + quay lại; thử trên kênh phát hành giả | Quay lại bản trước tự động; `hugremote update --rollback` |

### A6. Điều chỉnh giữa Phase

| Ngày | Vòng | Đổi gì | Vì sao |
|---|---|---|---|

## B. Giải pháp chi tiết vòng này

Vòng: 1

### B1. Giải pháp theo AC

| AC | Thay đổi (target · API/contract · dữ liệu · màn/component) | Ca biên phải xử · quy ước | Kiểm chứng |
|---|---|---|---|
| AC-1 | api `modules/auth`: `POST /api/auth/login`, `POST /api/auth/password`; seed owner lần chạy đầu (`AUTH_PASSWORD` hoặc sinh 16 ký tự in log); bảng `users.must_change_password` · web S1 bước đặt mật khẩu (C2 trường nhập, C1 nút) | <10 ký tự/trùng cũ → 400 `PASSWORD_TOO_WEAK`/`PASSWORD_REUSED`; API khác 403 `PASSWORD_CHANGE_REQUIRED` · G-1, G-3 | integration + e2e + newbie |
| AC-2 | api `POST /api/auth/refresh` (xoay token, trượt 14 ngày), `POST /api/auth/logout` (revoke); bảng `refresh_tokens` · web `lib/api-client` tự refresh khi 401, S7 nút Đăng xuất | refresh token cũ dùng lại sau khi xoay → thu hồi cả chuỗi · G-1, G-6 | integration (khởi động lại app trong test) + smoke |
| AC-3 | api `/api/auth/2fa` setup/enable/disable/recovery-codes, `POST /api/auth/2fa/verify`; TOTP SHA-1 30s ±1 bước; QR SVG tự sinh; 10 mã khôi phục băm SHA-256, chỉ trả một lần; bảng `two_factor`, `login_attempts` · web S7 thẻ Bảo mật (C9 hộp thoại), S1 bước mã | mã khôi phục dùng một lần; sai 5 lần → 429 `LOCKED` + `retryAfter`; tắt 2FA / tạo mã mới cần `code` = mã TOTP hiện tại hoặc một mã khôi phục (DECISIONS D11) · G-6 | unit vector RFC 6238 + integration + breaker |
| AC-4 | api `integrations/ssh/config-parser` (Include glob đệ quy ≤16 cấp, chống vòng, wildcard, giá trị đầu thắng, cache mtime) + `GET /api/hosts` (DTO không bí mật) · web S3 danh sách (C3) | block lỗi cú pháp → bỏ qua + cảnh báo; `SSH_CONFIG_PATH` cho dev · G-2 | unit parser + test quét khoá JSON |
| AC-5 | api `POST/PATCH/DELETE /api/hosts`, `POST /:id/test`, `GET /api/ssh-keys`; `integrations/ssh` pool + ProxyJump + fallback OpenSSH; ghi Host block · web S3 form (C2, C1, C6 sheet, C9 xác nhận xoá) | alias trùng 409; mtime đổi 409; xoá máy đóng phiên + xoá dự án; máy là jump host → 409 `HOST_IS_JUMP {dependents[]}`; sửa: trường trống giữ cũ, đổi host/port/user chưa thử lại → 409 `HOST_TEST_REQUIRED`; lỗi → `SSH_AUTH_FAILED`/`SSH_UNREACHABLE`/`SSH_REFUSED` · G-5, G-6, G-7 | integration với container sshd/jump + e2e + rushed |
| AC-6 | api `known_hosts` + hostVerifier của ssh2 (SHA256) + `POST /:id/trust-key`; fallback OpenSSH dùng `UserKnownHostsFile=DATA_DIR/known_hosts`, `StrictHostKeyChecking=yes` · web S4 (C9 biến thể cảnh báo, ô tick xác nhận bật nút tin khoá mới) | khoá đổi → 409 `HOST_KEY_CHANGED` kèm hai vân tay; trust-key phải gửi đúng vân tay mới · G-6 | integration container đổi khoá + breaker |
| AC-7 | api `GET /api/hosts/:id/browse` (local qua G-4, remote qua SFTP), `POST /api/hosts/:id/mkdir` (S5 Thư mục mới), `POST /api/projects` (id = sha256, idempotent), `PATCH /api/projects/:id` (đổi tên hiển thị, owner), Home tự tạo · web S5 (C3, C7 breadcrumb), S2 cây, C9 đổi tên, router hash | trùng đường dẫn → trả dự án cũ; Home không xoá; đường dẫn không tồn tại → 404 `PATH_NOT_FOUND` · G-4, G-11 | integration + e2e F5/Back + power |
| AC-8 | api `GET/PUT /api/workspace/pins` (thay cả danh sách, position), `DELETE /api/projects/:id` (owner; xoá cho cả nhóm, dừng mọi phiên của dự án, `dryRun=1` trả số phiên; không đụng thư mục) · web cây C11 menu ⋯ (bỏ khỏi không gian, C9 nêu số phiên sẽ dừng), S3 Ghim/Bỏ ghim + lên/xuống | ghim máy đã xoá → bỏ qua; member không thấy mục Bỏ · G-11, G-13 | integration + e2e hai context |
| AC-9 | api `modules/terminal` REST + gateway `/ws/terminal` (vé), `integrations/pty` manager (local node-pty, SSH shell, ≤50, 30', buffer 500KB `\n`), cwd = gốc dự án · web S6 pool xterm (một instance/phiên, ẩn/hiện), fit trước khi mở WS | attach: resize PTY rồi gửi buffer; nhiều socket một PTY; restart → `exited` · G-4, G-5 | integration PTY + e2e (htop, đổi viewport) + mobile, concurrent |
| AC-10 | web S6: thanh tab (C8), chia đôi trái/phải, vạch chia kéo (pointer events, lưu tỉ lệ trong Zustand), đổi tên (PATCH), đóng (DELETE, hỏi nếu `running`) | debounce resize 40ms; fit khi đổi tỉ lệ · G-10 | e2e + power |
| AC-11 | web S6 mobile: C10 thanh phím (Esc, Tab, Ctrl giữ, ↑↓←→, Enter, ^C) + ngăn mở rộng (tổ hợp Ctrl, ký tự shell, lệnh nhanh, F1–F12, nhãn phím); chạm vùng terminal → focus textarea ẩn của xterm mở bàn phím ảo; hook `useVisualViewport` co vùng terminal | Ctrl dạng bật/tắt một lần; IME không gửi sớm · G-10 | e2e 390×844 + mobile |
| AC-12 | web vỏ app: desktop thanh bên cây (C11, chỉ mở thứ đang dùng, + và ⋯) + vùng chính; mobile S2 (Cần bạn → cây → Đang chạy) + thanh dưới 3 mục (C12) · bấm dự án → tab đang dùng (`users.preferences.lastTab[projectId]` qua `PATCH /api/me/preferences`), chưa có phiên → tab Phiên rỗng 2 nút · mobile C32 bộ chọn phiên · router hash, Back · chấm trạng thái cây từ `events.v1` | máy lỗi kết nối hiện trong cây; không lối điều hướng thứ hai · G-11 | e2e + newbie |
| AC-13 | web `styles/tokens.css` sinh từ `DESIGN-SYSTEM.md §2`; Tailwind 4 đọc biến; i18next `vi` + khung `en`; test bắt chuỗi cứng trong JSX | — · G-10 | test chuỗi cứng + picky |
| AC-14 | api guard toàn cục, guard Origin cho WS (APP_URL + loopback), vé stream 30s một lần (bảng tạm trong RAM), `resolveWithinRoot`, chmod khi khởi động | vé dùng lại → 4401; Origin lạ → 1008 · G-1, G-4, G-6 | test bảo mật + breaker |
| AC-15 | api `@nestjs/terminus` `/api/health`, `GET /api/system/info` (phiên bản + doctor checks); `bin/hugremote doctor` + root `make doctor` · web S7 thẻ Hệ thống | `/api/health` công khai chỉ trả `{status}` · G-1 | integration + operator |
| AC-16 | api `modules/files` + `integrations/ssh` SFTP: `GET /fs` (cờ gitignore + trạng thái git), `/fs/read` (≤10MB, `tail`), `/fs/raw`, `PUT /fs/file` (`baseMtime`), `/fs/line-changes` (`git diff -U0 HEAD`) · web S8: thanh bên File (lọc, file ẩn) + tab file + editor C17 (CodeMirror: tô màu, vạch dòng đổi, search panel cho ⌘F/thay, goto line) + xem trước Markdown/HTML + C31 (ảnh, log theo dõi = `file_changed` của `events.v1` + đọc `tail`, lọc theo mức, file lớn); URL `…/files/<đường dẫn>/<dòng>` | file đổi trên đĩa → 409 `FILE_CHANGED`; >10MB → 413 `FILE_TOO_LARGE`; rời hoặc đóng tab khi chưa lưu → hỏi Lưu/Bỏ/Ở lại · G-4, G-11, G-15 | integration (local + SSH) + e2e + concurrent |
| AC-17 | api `POST /fs/action`, `POST /fs/upload` (Multer, `relativePath`), `GET /fs/download` (zip qua `python3 -m zipfile`, TTL 60'), `POST /api/projects/:id/terminals {cwd}` (Mở terminal tại đây) · web S8 C25 tiến độ, C9 xác nhận xoá, C23 chọn phiên khi Gửi cho Claude (chèn `@path` vào nháp phiên đó) | tên trùng → 409; tải lên vượt 100MB/file hoặc 200 file/lần → 413; dọn zip tạm theo TTL; `cwd` ngoài gốc dự án → 403 `PATH_OUTSIDE_ROOT` · G-4, G-5 | integration + rushed |
| AC-18 | api `modules/git` + `integrations/git`: repos (≤5 cấp), status (porcelain v2 + numstat, `ahead/behind`), diff, fetch, stage/unstage (`paths[]`, tất cả), discard, commit, pull `--ff-only`, push (tự `-u`), branches, checkout · web S9 (C3, C18 diff, ô commit ⌘/Ctrl+Enter, C1 nút biểu tượng fetch/pull/push kèm số, push tắt khi `ahead=0`; mobile danh sách → diff) | push từ chối → 409 `GIT_NON_FAST_FORWARD`; repo không có → rỗng "Dự án chưa có repo git"; bỏ thay đổi hỏi C9 · G-5 | integration với repo seed + e2e |
| AC-19 | api `GET /git/commits?cursor=` (50/lần, `log --numstat` + `--name-status` ghép theo SHA), `GET /git/commit/:sha` (danh sách file + diff) · web S9 tab Lịch sử: commit → file → diff (cả mobile) | repo không commit → rỗng · G-5 | integration |
| AC-20 | api `modules/claude` + `integrations/claude-cli`: process runner local/SSH (`{ cd -- dir \|\| cd "$HOME"; }`), decoder JSONL UTF-8, normalizer, assembler, tác vụ nền, replay 1000 sự kiện, cancel SIGINT; bảng `claude_sessions`, `claude_messages`; SSE `@Sse()` · web S10 C19, C20, `EventSource` + `Last-Event-ID` | mất kết nối → nối lại `after`; phiên đang chạy nhận prompt mới → xếp hàng (AC-40); CLI không có → `CLAUDE_NOT_INSTALLED` · G-14 | unit decoder/normalizer (fixture + fuzz) + integration với `fake-claude` + e2e + concurrent |
| AC-21 | api `control_request` → `interaction_requested`; `POST /interactions/:iid` → `control_response` qua stdin; trạng thái phiên `awaiting_input` → cây chấm cần duyệt · web S10 C21, C23 menu chế độ, C9 xác nhận Bypass | trả lời hai nơi → 409 `INTERACTION_ALREADY_ANSWERED`; Bypass cần xác nhận lần hai · G-13 | integration + breaker + concurrent |
| AC-22 | api probe `initialize` / `get_context_usage` trên đúng host + cwd, cache 30s, tối đa 2 probe đồng thời · web C36 chip model/effort + Context dạng token đã dùng/sức chứa (`227k/1000k`, lấy `totalTokens`/`maxTokens` từ `get_context_usage`) | probe lỗi → giữ lựa chọn cũ, báo "Không lấy được danh sách model" · — | integration với `fake-claude` |
| AC-23 | api đọc `~/.claude/projects/<slug>/*.jsonl` (local + SSH), gộp với `claude_sessions` theo `cli_session_id`; resume `--resume`; đổi tên ghi `--name` + metadata · web S10 danh sách phiên | phiên CLI đang chạy ở terminal khác → cảnh báo trước khi resume · — | integration |
| AC-24 | api `GET /claude/commands` (slash command của CLI + dự án) · web C36: gợi ý `/`, đính kèm (chọn file trong dự án → chèn `@path`), mic Web Speech theo locale, `isComposing` chặn Enter khi IME | trình duyệt không hỗ trợ giọng nói → ẩn nút + tooltip · G-10 | e2e + mobile + locale |
| AC-25 | api `GET /api/claude/limits` đọc từ CLI (khi có: `fiveHour{pct,resetAt}`, `weekly{pct,resetAt}`) · web C36 chip "Hạn mức 5 giờ x%", tooltip tuần + giờ reset, cảnh báo ≥80% | CLI không cung cấp → không hiện | integration |
| AC-26 | api `modules/search` `GET /api/search?q=` (bỏ dấu ở server, khớp tên trước) · web S11 C24, phím ⌘K / Ctrl+Alt+K, nút tìm mobile | không thấy → C4; IME không chọn sớm · G-13 (member chỉ thấy của mình) | e2e (đếm thao tác) + power + locale |
| AC-27 | web token `--light-*` gán lại khi `data-theme="light"`; `prefers-color-scheme` cho Theo hệ thống; i18next `en` đủ, test so khoá `vi`↔`en`; lưu `users.preferences.theme/locale` qua `PATCH /api/me/preferences` | — · G-10 | test khoá thiếu + picky + locale |
| AC-28 | web C26 thẻ Bắt đầu ở S2 (dựa trên số máy/dự án/phiên), khuôn rỗng/lỗi/tải ở mọi màn | — | newbie + edge |
| AC-29 | `bin/install.sh`, `bin/beta.sh`: kiểm môi trường, hỏi cấu hình, ghi `.env`, cài user service (systemd `--user` / launchd plist), in mật khẩu khởi tạo; CLI `hugremote` | đã cài → hỏi nâng cấp; thiếu công cụ build → hướng dẫn | test cài trong container Ubuntu sạch + macOS (CI) |
| AC-30 | `hugremote import-v1`: sao lưu, đọc `projects.json`, `auth.json` (giữ băm PBKDF2), `two_factor.json` (mã hoá lại secret), `hugcode_credentials.json` (mã hoá), `hugcode_claude_sessions.json` → bảng mới; báo cáo ở S7 | chạy lại → bỏ qua bản ghi đã nhập; file hỏng → bỏ qua + báo | integration với thư mục v1 mẫu |
| AC-31 | api `modules/system` update (khoá `update_runs`, `runningSessions`, `when:'now'\|'idle'`, trạng thái `waiting`), `bin/isolated-update` (staging → build → symlink `current` → restart → health → quay lại) · web S7 C9 xác nhận nêu số phiên sẽ dừng + Cập nhật ngay / Khi rảnh, C25 tiến độ, poll 2,5s | bấm lại → 409 `UPDATE_IN_PROGRESS`; health lỗi → quay lại, báo ở S7 | integration với kênh phát hành giả (2 tag) |
| AC-32 | api `modules/sso` + `integrations/oidc` (PKCE S256, state, JWKS `jose`, allowlist), bảng `sso_config`, `users` member; discover chỉ https + chặn IP nội bộ · web S1 nút SSO, S7 cấu hình | allowlist rỗng → từ chối; email ngoài allowlist → `SSO_EMAIL_NOT_ALLOWED`; cấu hình khi chưa đăng nhập → 401 · G-1 | integration với Keycloak container + breaker |
| AC-33 | api G-13 ở mọi route phiên + WS/SSE + `events.v1` + `search`; `@Roles('owner')` cho ghi hosts/projects, sso, system, logs, update (member được `GET /api/hosts` và ghim) · web ẩn mục owner-only; cây, S2, chuông, ⌘K, thanh phiên lọc theo người dùng; URL phiên người khác → S2 | member gọi phiên người khác → 403 `NOT_SESSION_OWNER` · G-13 | test ma trận `PERSONAS §2` + breaker + operator |
| AC-34 | bộ `security.e2e` tự động: 19 ca chuẩn + 8 ca nâng cao của v1 + 4 ca mới | — · G-1..G-6, G-13 | `make test` + breaker |
| AC-35 | web thanh phiên C8 dùng chung S6/S10 (tab trộn Claude trước terminal sau, + chọn loại, đổi tên → `PATCH /api/claude/sessions/:id` hoặc `PATCH /api/terminals/:id`); vùng chính chia ô tổng quát (Zustand: trái/phải, loại ô Claude · Terminal · Files · Git, tỉ lệ); cây có phiên Claude với chấm trạng thái + thời gian | mobile không chia ô · G-10, G-11 | e2e + power |
| AC-36 | api `GET /fs/files` (liệt kê bằng `git ls-files` + file chưa track; không phải repo → `find` giới hạn 20.000 mục), `GET /fs/search` (`rg --json` trên máy đích, fallback `grep -rn`; giới hạn 500 kết quả, timeout 10s) · web S12 C24 (khớp mờ ở client, `:dòng`), S8 tab Tìm C29, phím ⌘P / ⌘⇧F | không có rg → fallback + gợi ý cài; quá 500 → "Hiện 500 kết quả đầu, thu hẹp từ khoá"; G-5 (truyền từ khoá như tham số, không ghép shell) | integration với repo seed + e2e + power |
| AC-37 | web: renderer chat nhận dạng `path:line` (đường dẫn tương đối gốc dự án hoặc tuyệt đối trong dự án) → nút mở file; S9 nút Mở file; api `files-watch.v1` phát `file_changed` qua `events.v1` (kèm `by: claude` khi khớp tool Edit/Write của phiên) → web tự tải lại nếu không có sửa chưa lưu, hiện C30; có sửa chưa lưu → C5 So sánh · Lấy bản trên máy · Giữ bản của tôi | đường dẫn ngoài dự án → không thành link; G-15 | e2e + concurrent + power |
| AC-38 | api `modules/events` `GET /api/events/stream` (SSE toàn cục: `session_status`, `interaction_requested`, `interaction_answered`, `turn_finished`), `POST /api/claude/sessions/:id/interactions/:iid` dùng lại · web C38 chuông ở C8 (S6/S10) và C15 (S8/S9, mobile): số phiên chờ duyệt, danh sách ✓/✗, bấm dòng → `#/…/claude/<phiên>` | trả lời ở chuông khi thiết bị khác đã trả lời → 409 `INTERACTION_ALREADY_ANSWERED`, dòng biến mất; SSE đứt → nối lại bằng vé mới, lấy lại trạng thái đầy đủ (`session_status` snapshot đầu kết nối) · G-13, G-14 | integration (2 user) + e2e + concurrent + operator |
| AC-39 | api `PATCH /api/claude/sessions/:id {model, effort, permissionMode, confirm?}` lưu cột `claude_sessions`; tác vụ đang chạy nhận đổi chế độ qua `control_request set_permission_mode` · web C36 đọc/ghi theo phiên, ⇧Tab xoay chế độ (bỏ qua Bypass), ⚠ đỏ ở C11/C8/C36 khi Bypass; nháp + đính kèm localStorage khoá `draft:<userId>:<sessionId>` | Bypass thiếu `confirm:true` → 400 `CONFIRM_REQUIRED`; member chỉ đổi phiên của mình · G-13 | integration + e2e (2 phiên, F5) + power + breaker |
| AC-40 | api `claude_queue`; `POST /:id/messages` → 202 `{queued, queueId}` khi `running`; `GET /:id/queue`, `DELETE /:id/queue/:qid`; runner lấy tin cũ nhất khi `finish`, phát `queue_changed` · web C34 tin xếp hàng (mờ, Huỷ), Esc/nút Dừng → `POST /:id/cancel` | >10 tin → 409 `QUEUE_FULL`; huỷ tin vừa được gửi → 404, UI bỏ dòng; Dừng không xoá hàng chờ; lượt lỗi → không tự gửi tin kế, hiện C5 + "Gửi tiếp" · G-14 | integration với `fake-claude` (đóng mọi client giữa lượt) + concurrent + rushed |
| AC-41 | api normalizer đọc `result` của CLI → `finish {durationMs, usage, costUsd, filesChanged[]}` (filesChanged từ tool Edit/Write/MultiEdit của lượt) → khối `summary` trong `claude_messages` · web C33 dòng tóm tắt, bấm file → diff (C18) | CLI không trả cost → ẩn chi phí; lượt bị dừng → tóm tắt ghi "Đã dừng" · G-14 | unit normalizer (fixture) + integration + e2e |
| AC-42 | web C37 chế độ gọn: render gộp phía client từ cùng dữ liệu stream; lưu `users.preferences.compact` | yêu cầu quyền, lỗi chặn lượt, tóm tắt luôn hiện dù bật gọn · G-10 | e2e (bật/tắt, F5, thiết bị khác) + mobile |
| AC-43 | web `lib/connection` (trạng thái từ WS/SSE/heartbeat + lỗi mạng của api-client) → C13; hook `useWriteGuard` khoá C1 ghi (Gửi, ✓/✗, Lưu, Commit, Push, Pull, Cập nhật) + tooltip; nháp localStorage; editor giữ buffer | nối lại không tự gửi; đang lưu thì mất mạng → báo lỗi, giữ buffer, không báo "đã lưu" · G-10 | e2e (`context.setOffline`) + edge + mobile |
| AC-44 | api `refresh_tokens` thêm `family_id, ip, user_agent, created_at, last_used_at`; `GET /api/auth/devices`, `DELETE /api/auth/devices/:familyId`, `POST /api/auth/devices/revoke-others`; `POST /api/auth/password` thu hồi family khác · web S7 thẻ Thiết bị (C35) | thu hồi thiết bị đang dùng → về S1; member chỉ thấy của mình · G-1, G-13 | integration + e2e hai context + breaker |
| AC-45 | api `users.revoked_at`, bảng `sso_denials`; `GET /api/sso/members`, `DELETE /api/sso/members/:id`, `GET /api/sso/denials`, `POST /api/sso/disable`; allowlist khớp email hoặc `@tên-miền` · web S7 thẻ Thành viên + Lần bị từ chối (C35, "Cho phép" → `PUT /api/sso/config`), Tắt SSO (C9) | thu hồi → dừng phiên của họ + thu hồi refresh; member đã thu hồi đăng nhập lại → từ chối, ghi `sso_denials`; `@Example.com` khớp `an@example.com` · G-1, G-13 | integration với Keycloak + operator + breaker |
| AC-46 | api `GET /api/system/logs?kind=&tail=200` (owner) đọc `DATA_DIR/logs/{app,update,ssh}.log` · web S7 thẻ Nhật ký (C35, chọn loại, làm mới, tải xuống) | file chưa có → rỗng C4; đã redact theo G-12 · G-12 | integration (quét bí mật trong output) + operator |
| AC-47 | `bin/hugremote reset-password` (ghi thẳng SQLite: mật khẩu tạm 16 ký tự, `must_change_password=1`, `revoked_at` mọi refresh token) · web S1 liên kết "Quên mật khẩu?" → C9 hướng dẫn lệnh | dịch vụ đang chạy → lệnh vẫn ghi được (WAL); 2FA giữ nguyên | integration CLI + newbie |
| AC-48 | web router: guard lưu hash đích (sessionStorage, chỉ `#/…`) trước `#/login`, trả về sau login/2FA/callback SSO; S1 đếm ngược từ `retryAfter` | đích không tồn tại/không quyền → S2 + C27 báo; hash ngoài → bỏ · G-11 | e2e (link sâu Files dòng, SSO) + edge |
| AC-49 | web `lib/shortcuts` (bảng phím một nguồn, phát hiện `display-mode: standalone` → phím gốc, ngược lại ⌥/Alt cho tổ hợp trình duyệt giữ), bảng ⌘/ (C9) | IME đang gõ → không bắt phím; focus trong terminal → chỉ bắt tổ hợp có ⌘/⌥, còn lại gửi PTY · G-10 | e2e (tab thường + PWA) + power |

### B2. Thay đổi kỹ thuật của vòng

| Loại | Thay đổi | Tương thích ngược |
|---|---|---|
| Migration | `0001-init`: 17 bảng ở `ARCHITECTURE.md §6` (thêm `claude_queue`, `sso_denials`; cột mới `users.preferences/revoked_at/last_login_at`, `refresh_tokens.family_id/ip/created_at`, `update_runs.status waiting` + `when`) | — (vòng đầu) |
| Contract | 16 contract ở `ARCHITECTURE.md §5` (auth + thiết bị + preferences, hosts, workspace, terminal REST, terminal WS, system + logs, events, files-watch, files, git, claude REST + hàng chờ, claude SSE, search, sso + thành viên, update, CLI) | — |
| Biến môi trường | Danh sách `TECHSTACK.md §6` vào `deployment/.env.example` | — |
| Hạ tầng dev | `deployment/local/docker-compose.yml`: shared, api, web, sshd (git + `fake-claude`), jump, keycloak; seed ssh config, dự án mẫu, dữ liệu v1 mẫu, kênh phát hành giả; script instance dogfood | — |
| Deploy | `make deploy` = build + cài user service local + health + quay lại; `install.sh`/`beta.sh` cho người khác | — |
