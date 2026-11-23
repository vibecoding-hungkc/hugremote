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
Authority chốt Phase: 2026-11-22

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
| G-16 | Màn hình chỉ lắp từ `apps/web/src/components/ui/` — mỗi component C<n> của gói `intake/design-systems/hugremote/components/` một file, props theo dòng "Hiện thực pha I"; không style riêng trong `features/` (chỉ bố cục). Route dev `#/_ds` dựng lại trang mẫu `prototype/hugremote/index.html#/_ds`; test Playwright so ảnh chụp từng mục C<n> (1440 và 390, tối và sáng) với ảnh ở `intake/design-systems/hugremote/screens/`, chạy trong `make check` | apps/web | picky + test so ảnh |

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

Vòng: 2

### B1. Giải pháp theo AC

| AC | Thay đổi (target · API/contract · dữ liệu · màn/component) | Ca biên phải xử · quy ước | Kiểm chứng |
|---|---|---|---|
| AC-50 | `apps/desktop`: scaffold Electron (main process + preload script) bọc bản build của `apps/web` và spawn child process `apps/api`; BrowserWindow native kích thước 1200×800; menu native macOS hỗ trợ các phím ⌘C, ⌘V, ⌘W, ⌘Q; Dock icon | API chết giữa chừng → tự khởi động lại hoặc thông báo lỗi; đóng cửa sổ không tắt service nền trừ khi ⌘Q | e2e Playwright Electron + dogfood power |
| AC-51 | `apps/desktop` + `apps/api`: Electron main sinh ngẫu nhiên `DESKTOP_SECRET` 32-byte lúc khởi chạy, set cookie `hugremote_desktop_token` cho BrowserWindow; `apps/api` có middleware/guard nhận diện loopback request từ `127.0.0.1` khớp secret → tự động cấp session `owner` | Yêu cầu từ Origin lạ hoặc không phải `127.0.0.1` bị từ chối 403; thiếu secret bị 401; không lộ secret ra ngoài console log · G-1, G-6 | integration + dogfood breaker |
| AC-52 | `apps/desktop/package.json` + `electron-builder.yml`: script build đóng gói `.app` và `.dmg` cho macOS (arm64, x64); tự động ký ad-hoc `codesign --sign - --force --deep`; tích hợp lệnh `make desktop-build` vào root Makefile | Máy chưa có Node/pnpm build báo lỗi rõ ràng; file `.dmg` mount và kéo thả vào Applications chạy được | CLI build + dogfood operator |

### B2. Thay đổi kỹ thuật của vòng

| Loại | Thay đổi | Tương thích ngược |
|---|---|---|
| Target mới | `srcroot/boundaries/hugremote/apps/desktop/` (Electron main, preload, electron-builder) | Giữ nguyên `apps/api` và `apps/web` độc lập |
| Contract | `desktop-loopback.v1`: middleware/endpoint nhận diện loopback token và cấp session owner | Tương thích hoàn toàn với các client HTTP/WS hiện có |
| Biến môi trường | `HUGREMOTE_DESKTOP_SECRET` (chỉ dùng nội bộ trong tiến trình Electron và child process) | Không ảnh hưởng `.env` hiện tại |
| Hạ tầng build | Thêm phụ thuộc dev `electron`, `electron-builder` vào workspace desktop | Không ảnh hưởng docker-compose hay user service của vòng 1 |
