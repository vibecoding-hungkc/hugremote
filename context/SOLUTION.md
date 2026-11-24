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
| G-17 | Mọi listener mạng do HugRemote mở (chuyển tiếp cổng `-L`/`-R`, webview) chỉ bind `127.0.0.1`; tính năng mở cổng là owner-only; tên đi vào lệnh shell (tmux) qua whitelist `[A-Za-z0-9_.-]{1,64}` và luôn truyền dạng mảng đối số, không nối chuỗi | api, desktop | breaker |

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
| 2026-11-24 | 3 | Thêm G-17 (listener chỉ 127.0.0.1, owner-only, whitelist tên vào shell); nâng contract `desktop-loopback.v1` của vòng 2 lên `ARCHITECTURE.md §5` | Vòng 3 mở cổng mạng (chuyển tiếp, webview) — luật phải sống qua các vòng sau |

## B. Giải pháp chi tiết vòng này

Vòng: 3

### B1. Giải pháp theo AC

| AC | Thay đổi (target · API/contract · dữ liệu · màn/component) | Ca biên phải xử · quy ước | Kiểm chứng |
|---|---|---|---|
| AC-53 | `apps/web` `features/terminal/components/terminal-pool.ts`: `term.attachCustomKeyEventHandler(macKeys)` + file mới `mac-keys.ts` (bảng `{key, meta, alt, shift} → bytes`); `Terminal({ macOptionIsMeta: true, macOptionClickForcesSelection: true })`; ⌘C: `term.hasSelection()` → `navigator.clipboard.writeText(term.getSelection())`, không → gửi `\x03`; ⌘V để trình duyệt dán (xterm tự nhận paste); `apps/desktop` menu Edit giữ role copy/paste nhưng không chặn phím khi focus ở terminal; bảng ⌘/ (S6) thêm nhóm Terminal | Chỉ áp khi Mac (`/Mac/.test(navigator.platform)`); Windows/Linux giữ hành vi cũ; IME đang gõ (`isComposing`) → không chặn; ⇧Enter trong shell thường cũng gửi `ESC CR` (zsh hiểu như Enter) | `mac-keys.spec.ts` (mỗi tổ hợp → đúng byte) · e2e gõ trong `cat -v` thấy `^[^M` · dogfood `power` |
| AC-54 | `apps/api` terminal: `POST /terminals {tmux:{name}}` → PTY chạy `tmux new-session -A -s <name>` (mảng đối số, G-17); `GET /hosts/:id/tmux-sessions` chạy `tmux ls -F '#{session_name}\t#{session_windows}\t#{session_created}'`; DELETE phiên tmux → `tmux kill-session -t <name>`; cột `terminal_sessions.tmux_name`. `apps/web`: menu + C23 thêm mục tmux + nhóm *tmux trên <máy>* (ẩn khi host local), tên tự sinh `<dự án>`, `<dự án>-N` không trùng `tmux ls`; tab dùng biểu tượng tmux, tên = tên session | Máy local → 400 `TMUX_LOCAL_NOT_SUPPORTED` (UI đã ẩn); `command -v tmux` rỗng → 422 `TMUX_NOT_INSTALLED`; session đang mở ở tab khác → chuyển tab; × có hộp thoại xác nhận như terminal đang chạy (C9) | `terminal.tmux.spec.ts` (tên xấu bị chặn, lệnh đúng mảng đối số) · e2e trên container `demo-sshd` có tmux |
| AC-55 | `apps/api` lúc khởi động: phiên `tmux_name` + `running` → không đánh `exited` như shell thường mà giữ `running`, PTY tạo lười khi WS gắn vào (`tmux new-session -A`); web hiện trạng thái *đang gắn lại* trong lúc WS mở | Session đã bị kill bên ngoài → `-A` tạo mới cùng tên + dải báo; SSH chưa nối lại được → giữ *đang gắn lại* + thử lại theo cơ chế WS vòng 1 | e2e: tạo tmux, `sleep 600 &`, restart API, gắn lại thấy tiến trình |
| AC-56 | `apps/api`: `POST /terminal-sessions/:id/reopen` (G-13 kiểm chủ phiên) tạo PTY mới cho cùng bản ghi, `cwd = last_cwd ?? cwd`; `last_cwd` cập nhật khi PTY phát OSC 7. `apps/web` `TerminalPane.tsx`: khi `reconnecting > 0` hoặc `gone/exited` → `ended-cover` mới có errorBox "Mất kết nối — đang nối lại (lần n)" + *Mở lại tại đây* + *Đóng tab*; bấm → gọi reopen rồi `disposeTerm` + `getTerm` cùng id (giữ tab) | Đang nối lại thành công thì ẩn nút; bấm khi phiên vẫn chạy → 409 → coi như đã nối; không đổi thứ tự tab, alias, URL | e2e: số tab trước = sau; URL giữ nguyên · dogfood `edge` |
| AC-57 | `apps/api` module mới `forwards`: bảng `port_forwards`, service giữ `Map<id, net.Server \| remoteListener>`; `-L`: `net.createServer` bind `127.0.0.1:localPort`, mỗi kết nối `conn.forwardOut('127.0.0.1', 0, remoteHost, remotePort)` trên client SSH dùng chung của host; `-R`: `conn.forwardIn('127.0.0.1', remotePort)` + `tcp connection` → `net.connect(localPort,'127.0.0.1')`; `auto_start` bật lại khi khởi động; `forward_status` qua `events.v1`. `apps/web`: route `#/ports` (S14), nút ⇄ trên header (owner), C40 hàng chuyển tiếp, sheet Thêm có seg chiều | G-17; trùng cổng → 409 `LOCAL_PORT_IN_USE` (ô đỏ); <1024 → 400; mất SSH → `err` + thử lại 10s; `FORWARDING_DENIED`; member → 403 (G-1); sửa cổng đích = **mở listener mới trước**, thành công mới đóng listener cũ (kết nối đang chạy trên cổng cũ được giữ tới khi tự đóng); mở mới lỗi → 409, giữ nguyên chuyển tiếp cũ | `forwards.service.spec.ts` (bind, trùng cổng, dừng/mở lại) · e2e `curl localhost:L` qua `demo-sshd` · dogfood `breaker`, `operator` |
| AC-58 | `apps/api` `GET /hosts/:id/listening-ports`: chạy `ss -ltnpH` (parse cổng + `users:(("node",pid=…))`), không có `ss` → `lsof -iTCP -sTCP:LISTEN -nP`; gán `projectId` nếu cwd của pid nằm trong gốc dự án (đọc `/proc/<pid>/cwd`, bỏ qua nếu không đọc được). `apps/web`: S14 mục *Đang nghe* (ô cổng điền sẵn = cổng, bận → +10000), chip cổng ở S13 | Chỉ cổng TCP nghe; ẩn cổng 22; owner-only | parser spec với output mẫu `ss`/`lsof` |
| AC-59 | `apps/desktop`: preload phơi `openWebView/closeWebView`; main dựng `WebContentsView` partition `persist:hugremote-web`, `nodeIntegration:false`, `will-navigate` chỉ cho `localhost/127.0.0.1/file://`, link ngoài → `shell.openExternal`; khung webview đặt đúng toạ độ ô nội dung (web gửi bounds qua IPC khi resize). `apps/api` bảng `web_sessions` + `web-sessions-api.v1`; `file://` trong gốc dự án đọc qua `files-api`. `apps/web`: loại phiên `web` trong thanh Phiên/cây (kIc quả địa cầu), route `…/web/:id`, S13 thanh địa chỉ C39, *Chuyển tiếp và mở* gọi forwards; mục *Trình duyệt mới* và *Mở bằng trình duyệt* chỉ hiện khi `window.hugremoteDesktop` có; ngoài app desktop phiên `web` **không hiện** ở thanh Phiên/cây/chuyển nhanh, link sâu `…/web/:id` mở ra errorBox "Phiên trình duyệt chỉ mở được trong app HugRemote trên máy tính" + nút về tab Phiên | Trang lỗi/không nghe → errorBox; đổi phiên/chia ô → ẩn/hiện webview theo tab đang xem; ⌘W đóng phiên; web thường không thấy mục | e2e Playwright Electron mở phiên → trang :3000 hiện · dogfood `power` |
| AC-60 | `apps/web` `files.store.ts`: thêm `tree: Record<projectId, {expanded, hidden, scrollTop}>` vào phần persist (localStorage `hugremote:files`); `FilesView.tsx` bỏ `useState` cho `expanded`/`hidden`, đọc/ghi store; lưu `scrollTop` khi gỡ | Dự án bị xoá → dọn mục store; giới hạn 200 thư mục mở / dự án | e2e: mở thư mục → sang Phiên → về Files thấy còn mở; F5 vẫn còn |
| AC-61 | `apps/web`: giá trị mặc định `hidden = project.isHome`; `apps/api` giữ nguyên (đã lọc đúng theo `hidden`) — pha I **tái hiện trước**: nếu bật 👁 ở Home vẫn không có dotfile thì sửa ở `files.service.list` / `ctx` (đường dẫn `~` remote) | Home local và Home SSH đều phải thấy `.ssh`; `.git` vẫn ẩn | e2e trên `demo-sshd` Home thấy `.ssh` |
| AC-62 | `apps/web` claude composer (C36): chip context/model/quyền chỉ render giá trị, nhãn vào `title` + `aria-label`; bỏ nút khiên cạnh mic; bỏ chip hạn mức | Bypass vẫn đỏ + ⚠ ở chip quyền; ⇧Tab vẫn đổi quyền | e2e snapshot composer · dogfood `picky` |
| AC-63 | `apps/web` popup model (menu C23 trong C36): khối hạn mức trên cùng mục "Mức suy nghĩ" — hai C41 thanh % (`--color-primary`, ≥80% `--color-warning`) + giờ reset; số lấy từ API hạn mức vòng 1 (CAP-AI-06) | CLI không trả hạn mức → khối ẩn; đang tải → khung xương | e2e mở popup thấy 2 thanh |
| AC-64 | `apps/web` `styles/components.css`: `.col` `max-width` 820px → 1280px; `.composer .in` giữ 820px | Tin người dùng giữ `max-width: 85%`; điện thoại không đổi (đã full width) | e2e đo bề ngang |
| AC-65 | `apps/web` `styles/components.css`: thêm khối `.md` (bảng `border-collapse` + viền `--color-divider` + `th` nền `--color-surface-raised`; bọc `<table>` trong `.tbl` cuộn ngang qua `marked` renderer `table`; `pre` khung + cuộn; `code`, `ul/ol`, `h1–h3`, `blockquote`) — chỉ token (G-10); đối chiếu CSS `.md` ở `prototype/hugremote/index.html` | Bảng rất rộng → cuộn trong `.tbl`, không đẩy vỡ khung; DOMPurify vẫn chạy sau marked | e2e snapshot tin có bảng · dogfood `picky` |

### B2. Thay đổi kỹ thuật của vòng

| Loại | Thay đổi | Tương thích ngược |
|---|---|---|
| Migration | `terminal_sessions` + `tmux_name`, `last_cwd` (nullable); bảng mới `port_forwards`, `web_sessions` | Chỉ thêm — bản ghi cũ chạy như vòng 2 |
| Contract | `terminal-api.v1` thêm trường tuỳ chọn `tmux` + 2 endpoint; `forwards-api.v1`, `web-sessions-api.v1` mới; `events.v1` thêm sự kiện `forward_status`; preload `desktop-loopback.v1` thêm `openWebView/closeWebView` | Additive; client cũ không gửi `tmux` = shell thường; client cũ bỏ qua sự kiện lạ |
| Hành vi | AC-2 (vòng 1): phiên terminal mất kết nối — nút tạo tab mới đổi thành *Mở lại tại đây* (cùng tab) | Phá có chốt: `_PROPOSAL.md §24` |
| Phụ thuộc | `ssh2` đã có (dùng `forwardOut/forwardIn`); không thêm gói mới ở api/web; desktop dùng `WebContentsView` có sẵn của Electron 41 | — |
| Biến môi trường | Không thêm | — |
