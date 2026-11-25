---
type: architecture
tier: T0
status: ACTIVE
last_reviewed: "2026-11-21"
---

# ARCHITECTURE — hugremote

> Dịch từ `intake/ARCHITECTURE.md`. Phạm vi: **toàn bộ hệ thống, giao trong vòng 1** (Authority gộp 6 vòng —
> DECISIONS 2026-11-21).

---

## 1. Backend boundaries

| Boundary | Nhiệm vụ (1 dòng) | Sở hữu dữ liệu | Vòng |
|---|---|---|---|
| `hugremote` | Monorepo duy nhất (`srcroot/boundaries/hugremote/`): `apps/api` là tiến trình Node giữ mọi năng lực đặc quyền (xác thực, máy local/SSH, PTY, file, git, Claude CLI) và phục vụ bản build của `apps/web` dưới `BASE_PATH` | SQLite (19 bảng; vòng 3 thêm `port_forwards`, `web_sessions`): `users`, `refresh_tokens`, `two_factor`, `login_attempts`, `sso_config`, `sso_denials`, `hosts_meta`, `known_hosts`, `pinned_hosts`, `projects`, `terminal_sessions`, `claude_sessions`, `claude_messages`, `claude_queue`, `recent_files`, `update_runs`, `settings`. Ngoài DB: Host block trong `~/.ssh/config`, `~/.claude/projects` (đọc + đổi tên), buffer PTY + tác vụ Claude trong RAM, zip tạm | 1 |

```text
srcroot/boundaries/hugremote/
├── apps/api/        @app/api — NestJS (modules/, integrations/{ssh,pty,claude-cli,git,oidc,updater}, infra/database, health/)
├── apps/web/        @app/web — React + Vite (pages/, features/<domain>/, components/ui/ (C1–C38), styles/tokens.css (sinh từ gói DS), stores/, types/api.d.ts, dev/ds (route #/_ds))
├── apps/desktop/    @app/desktop — Electron (main, preload), bọc apps/api + apps/web đã build, loopback cookie auth, build .app/.dmg ký ad-hoc (Vòng 2)
├── packages/shared/ @app/shared — enum, hằng số, mã lỗi, hàm thuần
├── bin/             CLI hugremote (doctor [--fix], update, import-v1, reset-password, restart), install.sh, beta.sh, updater cô lập, cài user service
├── pnpm-workspace.yaml · package.json · Makefile
```

## 2. Frontend experiences — web

| Experience | Persona | Năng lực lộ ra | Vòng | Design system |
|---|---|---|---|---|
| `hugremote` | P-MOBILE, P-DESK, P-HOST, P-TEAM | Code ở `srcroot/boundaries/hugremote/apps/web` (cùng monorepo §1, không có thư mục riêng dưới `web-experiences/`). SPA mobile-first + PWA, desktop hạng nhất kiểu Orca (thanh bên cây + tab/chia ô): đăng nhập/2FA/SSO, máy, dự án, terminal, Files, Git, Claude, chuyển nhanh, cài đặt (bảo mật, SSO, giao diện tối/sáng + vi/en, hệ thống + cập nhật). Prototype: `prototype/hugremote/` | 1 | — |

## 3. Frontend experiences — mobile

— (không có app native; mobile do web `hugremote` dạng PWA đảm nhận)

## 4. Sơ đồ

```
 Điện thoại / desktop (trình duyệt, PWA)
        │  HTTPS: REST /api/*  ·  WSS /ws/terminal  ·  SSE /api/claude/sessions/:id/stream  ·  SSE /api/events/stream
        ▼
 Reverse proxy / Cloudflare Tunnel (người dùng tự dựng, BASE_PATH=/remote)
        ▼
 hugremote — apps/api (NestJS, 127.0.0.1:8099, user service)
   ├─ phục vụ apps/web/dist (tĩnh)
   ├─ SQLite  DATA_DIR/hugremote.db (0600, WAL)   + DATA_DIR/secret.key · known_hosts · logs/
   ├─ ~/.ssh/config (+ Include)   ← đọc theo mtime, ghi Host block
   ├─ ~/.claude/projects (phiên CLI)
   ├─ node-pty ──► shell máy local · spawn git / claude (stream-json) local
   ├─ ssh2 / OpenSSH (ProxyJump, ControlMaster) ──► máy SSH (shell, SFTP, exec git / claude)
   ├─ IdP Google / OIDC (SSO, JWKS)
   └─ kênh phát hành (git ls-remote / GitHub Releases) ──► updater cô lập
```

## 5. Contract giữa các target

> Một target, nhưng `apps/api` ↔ `apps/web` vẫn chỉ nói chuyện qua HTTP/WS và `@app/shared` (skill §3.1).
> Đây là mặt tiếp xúc ghi vào `BACKWARD-COMPATIBILITY-CHECKLIST.md §1` khi có vòng 2. Hình dạng chi tiết:
> DTO → OpenAPI `/api/docs-json`.

| Contract | Bên cung cấp | Bên dùng | Kiểu | Vòng |
|---|---|---|---|---|
| `auth-api.v1` — `GET /api/auth/me` · `POST /api/auth/login` (429 `LOCKED` kèm `retryAfter` giây) · `POST /api/auth/2fa/verify` · `POST /api/auth/refresh` · `POST /api/auth/logout` · `POST /api/auth/password` (thu hồi mọi refresh family khác) · `POST /api/auth/stream-ticket` · `GET/POST/DELETE /api/auth/2fa` (setup, enable; disable và recovery-codes **bắt buộc `code`** = mã TOTP hiện tại hoặc một mã khôi phục; mã khôi phục chỉ trả một lần) · `GET /api/auth/devices` · `DELETE /api/auth/devices/:familyId` · `POST /api/auth/devices/revoke-others` · `GET/PATCH /api/me/preferences` (`theme`, `locale`, `compact`, `lastTab{projectId:tab}` — PATCH gộp nông) | apps/api | apps/web | REST | 1 |
| `hosts-api.v1` — `GET /api/hosts` · `POST /api/hosts` · `PATCH /api/hosts/:id` · `DELETE /api/hosts/:id` · `POST /api/hosts/:id/test` · `POST /api/hosts/:id/trust-key` · `POST /api/hosts/:id/disconnect` · `POST /api/hosts/:id/mkdir {path}` (owner, cho S5; G-4) · `GET /api/ssh-keys`. `PATCH`: trường bí mật/thư mục bỏ trống = giữ cũ; đổi `hostName`/`port`/`user` phải kèm `testedAt` của lần Thử kết nối thành công với giá trị mới, thiếu → 409 `HOST_TEST_REQUIRED`. `DELETE` máy đang là ProxyJump của máy khác → 409 `HOST_IS_JUMP {dependents[]}` | apps/api | apps/web | REST | 1 |
| `workspace-api.v1` — `GET/PUT /api/workspace/pins` · `GET /api/hosts/:id/projects` · `POST /api/projects` · `PATCH /api/projects/:id` (owner, đổi tên hiển thị) · `DELETE /api/projects/:id` (owner; xoá cho cả nhóm, dừng mọi phiên của dự án; `GET …?dryRun=1` trả `{sessions}` để hộp xác nhận nêu số) · `GET /api/hosts/:id/browse?path=` | apps/api | apps/web | REST | 1 |
| `terminal-api.v1` — `GET /api/projects/:id/terminals` · `POST /api/projects/:id/terminals {name?, cwd?}` (`cwd` tương đối gốc dự án, phải nằm trong gốc — G-4; dùng cho "Mở terminal tại đây") · `PATCH/DELETE /api/terminals/:id` | apps/api | apps/web | REST | 1 |
| `terminal-ws.v1` — `/ws/terminal?sessionId&cols&rows&ticket`: client gửi phím thô hoặc JSON `{type:"resize",cols,rows}` · `{type:"ping"}`; server resize PTY rồi gửi replay buffer, sau đó output thô, `{type:"pong"}`, `{type:"exit",code}` | apps/api | apps/web | WS | 1 |
| `terminal-api.v1` **delta vòng 3** (additive) — `POST /api/projects/:id/terminals` nhận thêm `tmux?: string` (thiếu = shell thường; `name` `[A-Za-z0-9_-]{1,64}`; máy local → 400 `TMUX_LOCAL_NOT_SUPPORTED`; chưa cài → 400 `TMUX_NOT_INSTALLED`) · `POST /api/terminals/:id/reopen` (PTY mới, giữ id/tên, cwd = thư mục lúc tạo; đang chạy → 409 `SESSION_STILL_RUNNING`) · `GET /api/projects/:id/tmux-sessions` (`tmux ls` → `{name, windows, created, attachedSessionId?}`) · `DELETE` phiên tmux → `tmux kill-session` | apps/api | apps/web | REST | 3 |
| `forwards-api.v1` — `GET/POST /api/port-forwards` · `PATCH/DELETE /api/port-forwards/:id` (`{direction:'L'\|'R', hostId, remoteHost, remotePort, localPort, label?, autoStart}`; owner-only; trùng `localPort` chiều L → 409 `LOCAL_PORT_IN_USE`; cổng <1024 → 400) · `GET /api/hosts/:id/listening-ports` (`ss -ltnpH` fallback `lsof`; `{port, proc}`, bỏ cổng 22; `id=local` = cổng đang nghe trên Mac cho chiều `-R`, bỏ cổng của HugRemote và listener `-L` của nó) · trạng thái nằm trong `GET /api/port-forwards` (`status`, `error`) — S14 tự tải lại 5 giây, không có sự kiện SSE riêng | apps/api | apps/web | REST + SSE | 3 |
| `web-sessions-api.v1` — `GET/POST /api/projects/:id/web-sessions` · `PATCH/DELETE /api/web-sessions/:id` (`{url, name}`; `http(s)://` bất kỳ — Authority 2026-11-25 bỏ giới hạn localhost — hoặc `file://` trong gốc dự án) | apps/api | apps/web (chỉ khi chạy trong app desktop) | REST | 3 |
| `desktop-loopback.v1` *(nâng từ SOLUTION B vòng 2)* — cookie `hugremote_desktop_token` = secret 32-byte sinh mỗi lần mở app (env `HUGREMOTE_DESKTOP_SECRET` cho tiến trình API con); API chỉ nhận khi socket từ `127.0.0.1` và khớp secret → cấp phiên owner; thiếu/sai → 401, không phải loopback → 403 · preload phơi `window.hugremoteDesktop = {version, web: {show(id,url,bounds), bounds, hide, close, nav, onState}}` (vòng 3 thêm hai hàm webview) | apps/desktop | apps/api, apps/web | Cookie + IPC preload | 2, 3 |
| `system-api.v1` — `GET /api/health` · `GET /api/system/info` (phiên bản, kết quả doctor) · `GET /api/system/logs?kind=app\|update\|ssh&tail=200` (owner; đã redact theo G-12) | apps/api | apps/web, `make doctor` | REST | 1 |
| `events.v1` — `GET /api/events/stream?ticket=` (SSE toàn cục, một kết nối mỗi tab, heartbeat 15s): `session_status {sessionId, kind, projectId, status, bypass}` · `interaction_requested {sessionId, interactionId, summary, projectId}` · `interaction_answered {sessionId, interactionId, by}` · `file_changed` (xem `files-watch.v1`) · `turn_finished {sessionId, summary}`; lọc theo G-13 (member chỉ nhận sự kiện phiên của mình); dùng cho cây, chuông C38, S2, files-watch. `POST /api/files/watch {projectId, paths[]}` khai file đang mở | apps/api | apps/web | SSE | 1 |
| `files-watch.v1` — sự kiện `file_changed {projectId, path, mtime, by}` đi qua `events.v1` (inotify/fswatch local; với SSH: kiểm mtime file đang mở mỗi 3s + sự kiện tool `Edit/Write` của Claude); log đang theo dõi (tail -f) = nhận `file_changed` rồi đọc `GET /fs/read?tail=` | apps/api | apps/web | SSE | 1 |
| `files-api.v1` — `GET /api/projects/:id/fs?path=&hidden=` (kèm cờ gitignore, trạng thái git M/A) · `GET /fs/read` (≤10MB; `tail=N` cho file lớn và log theo dõi) · `GET /fs/raw` (ảnh) · `PUT /fs/file` (lưu, kèm `baseMtime`) · `POST /fs/action` (mkdir, touch, rename/move, copy, delete) · `POST /fs/upload` (multipart, `relativePath`; ≤100MB/file, ≤200 file/lần) · `GET /fs/download` (thư mục → zip) · `GET /fs/search?q=&regex=&case=&glob=` (ripgrep/grep trên máy đích, tôn trọng `.gitignore`, tối đa 500 kết quả) · `GET /fs/files` (danh sách tên file cho ⌘P, cache 30s) · `GET /fs/line-changes?path=` (dòng mới/sửa so với HEAD) · `GET /api/files/recent` | apps/api | apps/web | REST | 1 |
| `git-api.v1` — `GET /api/projects/:id/git/repos` · `status` · `diff` · `branches` · `commits?cursor=` · `commit/:sha` (kèm `ahead`/`behind`, `upstream`) · `POST fetch` · `POST stage` · `unstage` (nhận `paths[]`; `["*"]` = tất cả) · `discard` (bỏ thay đổi một file, hỏi xác nhận ở UI) · `commit` · `pull` · `push` · `checkout` | apps/api | apps/web | REST | 1 |
| `claude-api.v1` — `GET/POST /api/projects/:id/claude/sessions` (gộp phiên CLI) · `GET /api/projects/:id/claude/cli-sessions[?all=1]` (không `all`: phiên CLI chưa gắn; `all=1`: lịch sử cạnh chuông, thêm phiên đã gắn của mình kèm `linkedId`) · `DELETE /api/projects/:id/claude/cli-sessions/:cliId` (xoá `~/.claude/projects/<slug>/<cliId>.jsonl` trên máy đích + phiên HugRemote gắn với nó — phiên người khác → 403) · `PATCH/DELETE /api/claude/sessions/:id` · `POST /:id/resume` · `POST /:id/messages` (phiên rảnh → khởi tác vụ nền, trả ngay `{runId}`; phiên đang chạy → 202 `{queued:true, queueId}`, tối đa 10 tin/phiên, vượt → 409 `QUEUE_FULL`) · `GET /:id/queue` · `DELETE /:id/queue/:qid` (server tự gửi tin kế tiếp khi lượt xong — G-14) · `PATCH /:id` nhận cả `name`, `model`, `effort`, `permissionMode` (Bypass cần `confirm:true`) · `POST /:id/cancel` · `POST /:id/interactions/:iid` (allow · deny · option) · `GET /api/projects/:id/claude/options` (model + effort + slash command từ `initialize`) · `GET /api/projects/:id/claude/limits` (hạn mức từ `rate_limit_event`) · Context `a/b` nằm trong khối tóm tắt lượt (`summary.context`) | apps/api | apps/web | REST | 1 |
| `claude-stream.v1` — `GET /api/claude/sessions/:id/stream?ticket&after=` (SSE): `data:<json>` có `sequence`, heartbeat 15s, `Last-Event-ID`; sự kiện `sync` · `thinking_start` · `thinking` · `text_delta` · `content_sync` · `tool_use` · `tool_result` · `agent_*` · `interaction_requested` · `interaction_responded` · `interaction_cancelled` · `queue_changed` · `done` · `error` · `finish {durationMs, usage:{input,output,cacheRead}, costUsd, filesChanged[]}` (lưu thành khối `summary` trong `claude_messages`) (enum ở `@app/shared`) | apps/api | apps/web | SSE | 1 |
| `search-api.v1` — `GET /api/search?q=` (dự án, phiên terminal, phiên Claude, file gần đây trên máy đã ghim của người gọi; bỏ dấu ở server) | apps/api | apps/web | REST | 1 |
| `sso-api.v1` — `GET /auth/sso/:provider` (redirect, PKCE S256 + state) · `GET /auth/sso/:provider/callback` · `GET/PUT /api/sso/config` (owner; allowlist nhận email hoặc `@tên-miền`) · `POST /api/sso/discover` (owner; chỉ URL https, chặn IP nội bộ) · `POST /api/sso/disable` (owner) · `GET /api/sso/members` · `DELETE /api/sso/members/:id` (owner; thu hồi refresh, dừng phiên, gỡ khỏi allowlist) · `GET /api/sso/denials` (owner; 200 dòng gần nhất) | apps/api | apps/web | REST + redirect | 1 |
| `update-api.v1` — `GET /api/system/update?channel=` (bản mới nhất + `runningSessions{claude,terminal}`) · `POST /api/system/update {when:'now'\|'idle'}` (owner; 409 nếu đang chạy; `idle` → run `waiting` tới khi không còn phiên chạy) · `GET /api/system/update/runs/:id` (tiến độ, poll 2,5s) | apps/api | apps/web | REST | 1 |
| CLI — `hugremote [-p port] [-h host] [-b base] --version` · `hugremote doctor [--fix]` (`--fix`: sửa quyền 0600/0700, tạo thư mục thiếu) · `hugremote update [--stable\|--beta\|--dry-run\|--rollback]` · `hugremote import-v1 [--from <dir>]` · `hugremote reset-password` (in mật khẩu tạm, `must_change_password=1`, thu hồi mọi refresh token, giữ 2FA) · `hugremote restart` | bin | người dùng, `install.sh` | CLI | 1 |

Lỗi trả về theo một khuôn: `{ code: "<MA_LOI>", message?: string, details?: object }` — `code` là enum ở
`@app/shared/errors`, web dịch sang câu tiếng Việt (backend không trả câu cho người đọc).

## 6. Mô hình dữ liệu lõi

### hugremote (SQLite)

| Thực thể | Field chính | Quan hệ | Ràng buộc |
|---|---|---|---|
| `users` | id, role (`owner`·`member`), email (member/SSO), password_hash, password_salt, must_change_password, preferences (JSON: theme, locale, compact, lastTab theo dự án), last_login_at, revoked_at, created_at | 1–n refresh_tokens, 1–1 two_factor | đúng một `owner`; member tạo khi SSO lần đầu, email unique; `revoked_at` có giá trị → SSO bị từ chối tới khi owner cho phép lại |
| `refresh_tokens` | id, user_id, family_id, token_hash, ip, user_agent, created_at, expires_at, last_used_at, revoked_at | n–1 users | token_hash unique; trượt 14 ngày; một `family_id` = một thiết bị (xoay token giữ family); dùng lại token cũ → thu hồi cả family |
| `two_factor` | user_id, enabled, secret_enc, recovery_code_hashes (JSON), pending_secret_enc | 1–1 users | secret mã hoá AES-256-GCM; mã khôi phục chỉ lưu băm; tắt/tạo lại mã cần TOTP hoặc mã khôi phục |
| `login_attempts` | key (ip + loại `password`/`2fa`), fail_count, locked_until | — | 5 lần → khoá 15 phút |
| `hosts_meta` | host_id (`local` hoặc alias SSH), workspace_dir, auth_type (`key`·`password`·`agent`), secret_enc, updated_at | 1–n projects | Host block gốc nằm ở `~/.ssh/config`; bảng chỉ giữ phần config không chứa |
| `known_hosts` | host_id, host:port, key_type, fingerprint_sha256, trusted_at | n–1 hosts | unique (host, port, key_type) |
| `pinned_hosts` | user_id, host_id, position | — | unique (user_id, host_id) |
| `projects` | id = sha256(host_id + đường dẫn chuẩn hoá) cắt 32 ký tự hex, host_id, name, root_path (remote lưu dạng `~/…`), is_home, created_at | 1–n terminal_sessions | unique (host_id, root_path); mỗi máy đúng một `is_home` |
| `terminal_sessions` | id (uuid), project_id, owner_user_id, name, cwd, status (`running`·`exited`), exit_code, created_at, last_attached_at | n–1 projects | PTY + buffer 500KB ở RAM; restart service → `exited` |
| `terminal_sessions` **delta vòng 3** | + `tmux_name` (nullable — có = phiên tmux) | — | Migration chỉ thêm cột nullable; bản ghi cũ = shell thường |
| `port_forwards` (vòng 3) | id, direction (`L`·`R`), host_id, remote_host, remote_port, local_port, label, auto_start, created_at | n–1 hosts_meta | unique (local_port) khi direction=`L`; unique (host_id, remote_port) khi direction=`R`; listener sống trong RAM của API |
| `web_sessions` (vòng 3) | id (uuid), project_id, owner_user_id, url, name, created_at, last_opened_at | n–1 projects | Trang render ở `WebContentsView` của app desktop, không lưu nội dung trang |
| `sso_config` | provider (`google`·`oidc`), issuer_url, client_id, client_secret_enc, allowed_emails (JSON: email hoặc `@tên-miền`), button_label, enabled | — | allowlist rỗng = từ chối tất cả; `@tên-miền` khớp hậu tố sau @, không phân biệt hoa thường; chỉ owner ghi |
| `sso_denials` | id, email, provider, reason (`not_allowed`·`revoked`·`disabled`·`token_invalid`), at | — | giữ 200 dòng gần nhất (xoá cũ khi chèn) |
| `claude_sessions` | id, project_id, owner_user_id, name, cli_session_id, model, effort, permission_mode, status (`idle`·`running`·`awaiting_input`·`done`·`cancelled`·`error`), last_sequence, created_at, updated_at | n–1 projects, 1–n claude_messages | `cli_session_id` unique theo (host, cwd); phiên CLI chưa nhập chỉ hiện từ `~/.claude/projects`, nhập khi mở; model/effort/permission_mode riêng từng phiên; context `a/b` không lưu (probe) |
| `claude_messages` | id, session_id, seq, role, content (JSON khối: text/thinking/tool/agent/interaction/summary), created_at | n–1 claude_sessions | chỉ chèn; unique (session_id, seq); khối `summary` = `{durationMs, usage, costUsd, filesChanged[]}` của sự kiện `finish` |
| `claude_queue` | id, session_id, user_id, text, attachments_json, created_at | n–1 claude_sessions | tối đa 10 dòng/phiên; server lấy dòng cũ nhất khi lượt xong, xoá khi đã gửi; xoá phiên → xoá hàng chờ |
| `recent_files` | user_id, project_id, path, opened_at | — | giữ 50 gần nhất mỗi người |
| `update_runs` | id, channel, from_version, to_version, status (`waiting`·`running`·`done`·`rolled_back`·`failed`), when (`now`·`idle`), steps (JSON), started_at, finished_at | — | một run `waiting`/`running` tại một thời điểm (khoá) |
| `settings` | key, value | — | chỉ khoá cấp hệ thống (ghi chú, cờ đã nhập v1); tuỳ chọn người dùng ở `users.preferences` |

**Ca biên đã quyết** (nguồn: `PRD.md §7`):

| Tình huống | Xử lý |
|---|---|
| Trùng dữ liệu | Dự án: khoá tự nhiên (host_id, root_path chuẩn hoá) → `POST /api/projects` trả dự án có sẵn (200) thay vì tạo mới. Máy: alias trùng Host có sẵn → 409 `HOST_ALIAS_TAKEN`. Ghim: upsert |
| Xoá | Xoá cứng. Xoá máy: hỏi xác nhận (hiện số dự án/phiên bị ảnh hưởng) → đóng PTY/kết nối, xoá projects/terminal_sessions/hosts_meta/known_hosts của máy, gỡ Host block khỏi file nó nằm (kể cả file `Include`); máy `local` và dự án Home không xoá được; máy đang là ProxyJump của máy khác → 409 `HOST_IS_JUMP {dependents[]}`. Bỏ dự án (owner) = xoá bản ghi cho cả nhóm, dừng mọi phiên của dự án kể cả của member (hộp xác nhận nêu số phiên), không đụng thư mục thật. Thu hồi member: `users.revoked_at`, thu hồi mọi refresh family, dừng phiên của họ, gỡ khỏi allowlist |
| Sửa đồng thời | `~/.ssh/config` đổi bên ngoài → cache theo mtime đọc lại; ghi Host block kiểm mtime trước khi ghi, lệch → 409 `SSH_CONFIG_CHANGED`, UI tải lại form. Hai thiết bị cùng gõ một phiên terminal → cả hai thấy cùng output (nhiều socket một PTY), kích thước theo socket resize gần nhất |
| Gửi hai lần (double submit) | Nút khoá khi đang gửi (C1); API tạo dự án idempotent theo khoá tự nhiên; tạo phiên terminal không idempotent — nút khoá đủ; đăng nhập/2FA đếm sai đúng một lần mỗi request |
| Host key đổi | Chặn kết nối, trả 409 `HOST_KEY_CHANGED` kèm vân tay cũ/mới; chỉ `POST /trust-key` với vân tay mới mới đi tiếp |
| Mất kết nối WS | Client tự nối lại (backoff 1→5s, **không giới hạn số lần** — Mac ngủ/mất mạng lâu vẫn hồi; có mạng lại `online` hoặc quay lại tab → thử ngay; stream Claude cũng vậy), xin vé mới, replay buffer; quá 30 phút không socket nào → PTY bị thu hồi, phiên `exited` |
| Sửa file đồng thời | `PUT /fs/file` gửi `baseMtime`; file đã đổi trên đĩa → 409 `FILE_CHANGED`, UI hỏi **So sánh · Lấy bản trên máy · Giữ bản của tôi** (giữ = ghi lại với `baseMtime` mới) |
| Claude mất kết nối giữa chừng | Tác vụ chạy tiếp ở server; client mở lại stream `?after=<sequence>`; replay buffer 1000 sự kiện, quá thì gửi `sync` (ảnh chụp tin nhắn hiện tại) |
| Hai thiết bị cùng gửi prompt vào một phiên Claude | Phiên đang `running` → 202 `{queued:true}`, tin vào `claude_queue` (tối đa 10, vượt → 409 `QUEUE_FULL`); mọi thiết bị thấy cùng hàng chờ qua `queue_changed`; lượt xong server tự gửi tin cũ nhất, kể cả khi không còn trình duyệt nào mở |
| Duyệt quyền trên hai thiết bị | Trả lời đầu tiên thắng; lần sau → 409 `INTERACTION_ALREADY_ANSWERED`, thẻ chuyển "Đã trả lời trên thiết bị khác" |
| Git push bị từ chối / pull không fast-forward | 409 `GIT_NON_FAST_FORWARD` + stderr rút gọn; không tự merge/rebase |
| Cập nhật đang chạy mà bấm lại | 409 `UPDATE_IN_PROGRESS`, trả run hiện tại; khoá chết (PID không còn) tự giải; `when:'idle'` → run `waiting` tới khi 0 phiên Claude `running` và 0 PTY có socket trong 5 phút |
| Mất kết nối server (web) | Dải C13; khoá mọi thao tác ghi (gửi, duyệt, lưu, commit, push/pull, cập nhật); giữ nháp (localStorage), bản sửa file, message commit; nối lại không tự gửi |
| Đổi mật khẩu / quên mật khẩu | `POST /api/auth/password` thu hồi mọi refresh family trừ thiết bị đang dùng; `hugremote reset-password` thu hồi tất cả, đặt `must_change_password=1`, giữ 2FA |
| Sửa máy | Trường bí mật/thư mục để trống giữ cũ; đổi host/port/user mà chưa Thử kết nối thành công với giá trị mới → 409 `HOST_TEST_REQUIRED` |
| Link sâu khi chưa đăng nhập | Web lưu hash đích (chỉ `#/…` nội bộ) → sau đăng nhập/2FA/SSO về đích; đích không còn hoặc không có quyền → S2 kèm câu báo |
| Nhập dữ liệu v1 | Chỉ đọc file v1, sao lưu trước vào `DATA_DIR/import-v1-<ngày>/`; chạy lại thì bỏ qua bản ghi đã nhập (khoá tự nhiên) |
| Đường dẫn | Local: `realpath` phải nằm trong `ALLOWED_ROOT` (chặn `..`, symlink, null byte). Remote: không mở rộng `~` bằng home local; `cd` remote dùng nhóm lệnh `{ cd -- "<dir>" || cd "$HOME"; }` |
| Tắt/mở app với phiên tmux (vòng 3) | API khởi động → mọi `terminal_sessions` có `tmux_name` và status `running` → PTY mới chạy `tmux new-session -A -s <tên>`; session tmux đã bị kill bên ngoài → tạo lại rỗng cùng tên + dải "Phiên tmux đã bị đóng bên ngoài, đã tạo mới" |
| Terminal thường mất kết nối (vòng 3) | WS tự nối lại như vòng 1 **đồng thời** hiện *Mở lại tại đây*; nối lại thành công → ẩn nút; PTY đã chết (restart API) → `exited`, chỉ còn nút; bấm → `reopen` giữ id |
| Hai tab cùng gắn một session tmux (vòng 3) | Menu + bấm session đang mở ở tab khác → chuyển tới tab đó, không mở tab thứ hai |
| Chuyển tiếp cổng khi máy SSH mất kết nối (vòng 3) | status `err` + lý do; thử lại mỗi 10 giây; kết nối lại → `on`; listener cục bộ giữ cổng để không bị app khác chiếm |
| Cổng cục bộ đã bị tiến trình khác chiếm (vòng 3) | `EADDRINUSE` → 409 `LOCAL_PORT_IN_USE`, gợi ý cổng +10000; không ghi đè chuyển tiếp đang có |
| Máy SSH cấm TCP forwarding (vòng 3) | `ssh2` báo từ chối → status `err` `FORWARDING_DENIED` ("Máy không cho chuyển tiếp cổng — AllowTcpForwarding") |
| Phiên trình duyệt: URL (vòng 3) | Mọi trang `http(s)://` (Authority 2026-11-25 bỏ giới hạn localhost; webview vẫn partition riêng, sandbox, không Node); API trả 400 cho scheme khác (`ftp:`, `javascript:`, `data:`…), cổng 0, `file://` ngoài `rootPath` (kể cả `%2f..`); file html hiện trong iframe `allow-scripts allow-forms allow-modals allow-popups`, không `allow-same-origin` nên không đọc được phiên HugRemote |
| Chép trong terminal (vòng 3) | Chương trình tự bắt chuột (Claude CLI, tmux, vim) gửi nội dung chép qua OSC 52 → xterm ghi clipboard; chỉ ghi, không trả lời câu hỏi đọc clipboard |
| Phiên trình duyệt mở ngoài app desktop (vòng 3) | Web thường / điện thoại: phiên `web` không hiện ở thanh Phiên, cây, chuyển nhanh; link sâu `…/web/:id` → errorBox "Phiên trình duyệt chỉ mở được trong app HugRemote trên máy tính" + nút về tab Phiên (Q-8) |
| Sửa cổng đích khi đang có kết nối (vòng 3) | Mở listener mới trước, thành công mới đóng cũ; kết nối đang chạy trên cổng cũ giữ tới khi tự đóng; mở mới lỗi → 409, giữ nguyên chuyển tiếp cũ |
| Session tmux người khác đang giữ (vòng 3, dogfood breaker) | `POST …/terminals {tmux}` trùng tên session mà phiên của người khác đang giữ → 403 `NOT_SESSION_OWNER`; member chỉ gắn session của mình hoặc tạo mới (`tmuxFresh` — server chọn `<tên>-N` trống); `tmux-sessions` của member chỉ liệt kê session của mình, `sessionId` luôn chỉ của người gọi; xoá phiên chỉ `kill-session` khi không còn phiên nào khác giữ tên đó |
| Tạo / mở lại phiên đồng thời (vòng 3, dogfood concurrent) | Tạo tmux, `reopen`, gắn lại lười đi qua một khoá tuần tự trong `TerminalService` → hai tab cùng bấm: hai tên khác nhau / cùng một phiên / một 201 + một 409, không rò shell; xoá phiên phát `session_status` để thiết bị khác gỡ tab |
| Mở app với chuyển tiếp (vòng 3, dogfood operator) | Chỉ bật lại chuyển tiếp có *Tự bật* **và** người dùng chưa tắt; không *Tự bật* → về tắt; mở cổng lỗi lúc khởi động → `err` có mã (`LOCAL_PORT_IN_USE`…) + log, `tick()` thử lại mỗi 10 giây |
| Máy SSH mất giữa lúc bắt tay (vòng 3, dogfood edge) | `ssh2` có thể phát `error` lần hai sau `readyTimeout` → client luôn có listener `error` thường trực + `end()` khi nối lỗi; API không bao giờ thoát vì máy SSH chết |

## 7. Luồng lõi

**Luồng lõi của sản phẩm: giao việc cho Claude trong dự án trên máy SSH → bỏ máy đi → duyệt quyền từ điện
thoại → xem file/diff → commit.** Hai luồng nền đi kèm: terminal chạy nền và cài/đăng nhập.

```
A. Truy cập
1. GET /api/auth/me → (lưu hash đích) S1: mật khẩu (owner) hoặc nút SSO (member/owner) → (owner bật 2FA) mã → (lần đầu) đổi mật khẩu
   → access token (body) + refresh cookie; DB refresh_tokens; SSO: PKCE → callback → kiểm id_token JWKS → allowlist → users
2. GET /api/workspace/pins + /api/hosts → cây Máy → Dự án → Phiên (S2); mở SSE /api/events/stream → chấm trạng thái, chuông

B. Máy + dự án
3. Máy SSH lần đầu → 409 HOST_KEY_UNKNOWN → S4 → trust-key (known_hosts) → ssh2 (ProxyJump; lỗi → OpenSSH)
4. Dự án: browse → POST /api/projects → URL #/s/<host>/p/<project>

C. Claude (luồng lõi)
5. POST /api/projects/:id/claude/sessions → POST /:sid/messages → server spawn `claude -p --input-format stream-json
   --output-format stream-json --include-partial-messages` trên máy đích, cwd = gốc dự án (local spawn | SSH exec
   `{ cd -- dir || cd "$HOME"; } && claude …`) → decoder JSONL → normalizer → assembler → claude_messages + replay
6. Client: POST stream-ticket → GET /stream (SSE) → hiển thị; đóng tab: tác vụ chạy tiếp
7. control_request (xin quyền) → interaction_requested → chấm "cần duyệt" ở cây → người dùng bấm Cho phép
   → POST /interactions/:iid (từ thẻ trong chat hoặc ✓ ở chuông) → control_response qua stdin → Claude chạy tiếp → done
   → finish {durationMs, usage, costUsd, filesChanged} → khối summary; claude_queue còn tin → server gửi tin kế tiếp
8. Mở lại (thiết bị khác): GET /stream?after=<seq> → replay phần thiếu, không lặp

D. Kết quả
9. Files: GET /fs?path= (gốc dự án) → read → sửa → PUT (baseMtime) · Git: status → diff → stage → commit → push

E. Terminal
10. POST terminals → fit() → vé → WS /ws/terminal → server resize PTY → replay → stream; đóng tab PTY vẫn chạy

F. Cài đặt & cập nhật
11. install.sh → (có v1) hugremote import-v1 → user service → log mật khẩu khởi tạo
12. Cài đặt → Cập nhật → POST /api/system/update → updater cô lập (staging → build → đổi symlink current → restart
    → health) → lỗi thì quay lại bản trước
```

## 8. Ranh giới module

| Thư mục | Chứa gì | Được gọi bởi | Không được làm gì |
|---|---|---|---|
| `apps/api/src/modules/<domain>/` (`auth`, `sso`, `hosts`, `workspace`, `terminal`, `files`, `git`, `claude`, `search`, `system`, `events`) | controller (mỏng) · service (nghiệp vụ) · repository (chỗ DUY NHẤT chạm DB) · dto | HTTP/WS | Controller không chạm DB; không trả entity; không câu tiếng Việt trong response |
| `apps/api/src/integrations/ssh/` | Parser `~/.ssh/config` (Include, wildcard, mtime cache), pool ssh2, ProxyJump, fallback OpenSSH, kiểm host key | modules/hosts, terminal (sau: files, git, claude) | Không biết gì về HTTP; không đọc DB trực tiếp (nhận known_hosts qua tham số) |
| `apps/api/src/integrations/claude-cli/` | process runner (local/SSH), decoder JSONL an toàn UTF-8, normalizer → sự kiện `claude-stream.v1`, assembler, probe `initialize`/`get_context_usage`, đọc `~/.claude/projects` | modules/claude | Không biết HTTP; không chạm DB (assembler trả thay đổi, repository ghi) |
| `apps/api/src/integrations/git/` | chạy `git` local / `git -C` qua SSH, parse porcelain/numstat/log | modules/git | Không nối chuỗi người dùng vào shell (G-5) |
| `apps/api/src/integrations/oidc/` | Google + OIDC (PKCE, JWKS qua `jose`), discover có chặn SSRF | modules/sso | — |
| `apps/api/src/integrations/updater/` | gọi `bin/isolated-update`, đọc tiến độ | modules/system | — |
| `apps/api/src/integrations/pty/` | node-pty local, shell SSH, session manager (≤50 phiên, thu hồi 30 phút, buffer 500KB cắt ở `\n`) | modules/terminal | Không biết HTTP; không chạm DB |
| `apps/api/src/common/` | guard JWT, guard Origin, exception filter → khuôn lỗi, crypto (AES-GCM, PBKDF2, TOTP) | mọi module | Không nghiệp vụ |
| `apps/api/src/infra/database/` | DataSource SQLite, migrations | repository | — |
| `apps/web/src/features/<domain>/` (`auth`, `hosts`, `workspace`, `terminal`, `files`, `git`, `claude`, `search`, `settings`) | components · hooks (TanStack Query) · api | trang | Feature không import feature khác; component không `fetch` |
| `apps/web/src/components/ui/` | Kho component C1–C38 — mỗi file theo `intake/design-systems/hugremote/components/c<NN>-….md` (props, trạng thái bắt buộc) | feature, trang | Không gọi API; không giá trị màu/cỡ ngoài token; không component ngoài danh sách gói |
| `apps/web/src/styles/tokens.css` | Biến CSS sinh từ `intake/design-systems/hugremote/tokens.json` (tối trong `:root`, sáng gán lại khi `data-theme="light"`) | toàn app, Tailwind `@theme`, theme xterm | Không sửa tay — sửa gói rồi sinh lại |
| `apps/web/src/dev/ds/` | Route `#/_ds` dựng lại trang mẫu `prototype/hugremote/index.html#/_ds` cho test so ảnh (chỉ bản dev/test) | test e2e | Không lên bản build production |
| `apps/web/src/pages/` + `app/router.tsx` | Ghép feature theo route | router | Không gọi API trực tiếp |
| `apps/web/src/lib/` | `api-client.ts` (base path, token, tự refresh), `ws-client.ts` | features | — |
| `packages/shared/` | Enum (`HostKind`, `SessionStatus`, `ErrorCode`), hằng số (giới hạn), hàm thuần (chuẩn hoá đường dẫn `~/…`) | api, web | Không import Nest/React/Node/DOM |
| `bin/` | `hugremote` CLI (doctor [--fix], update, import-v1, reset-password, restart), `install.sh`, `beta.sh`, `isolated-update`, cài user service | người dùng, Makefile, modules/system | Không import code app ngoài bản build |

Quy tắc chung không đổi:
- Chỉ **một tầng** được chạm DB. UI không query trực tiếp.
- Logic nghiệp vụ không nằm trong component.
- Gọi ra ngoài (SSH, shell) đi qua `integrations/` — dễ giả lập khi test.

## 9. Dịch vụ ngoài

| Dịch vụ | Dùng để | Hỏng thì sao |
|---|---|---|
| Máy SSH của người dùng (qua ssh2 / OpenSSH) | Shell, SFTP, exec | Máy đó hiện "Không kết nối được" + nguyên nhân; máy khác không ảnh hưởng |
| `~/.ssh/config` + `ssh-agent` của user chạy dịch vụ | Danh sách máy, khoá | File lỗi cú pháp → bỏ qua block lỗi, báo ở màn Máy; không agent → thử khoá file, rồi mật khẩu |
| Shell local (`$SHELL`) qua node-pty | Terminal máy này | Fallback `/bin/bash` → `/bin/sh` |
| Reverse proxy / Cloudflare Tunnel (người dùng tự dựng) | HTTPS từ ngoài | Ngoài phạm vi app; `make doctor` cảnh báo khi `APP_URL` là http mà `HOST` không phải loopback |
| Claude Code CLI trên máy đích | Phiên Claude, model, context, hạn mức | Không tìm thấy `claude` → phiên báo "Chưa cài Claude Code trên máy này" + lệnh cài; giao thức lệch → báo phiên bản CLI tối thiểu |
| `git` trên máy đích | Tab Git | Không có git → tab Git báo "Máy này chưa có git" |
| IdP Google / OIDC | SSO | IdP lỗi → nút SSO báo lỗi; owner vẫn đăng nhập bằng mật khẩu |
| Kênh phát hành (GitHub Releases / `git ls-remote`) | Cập nhật | Không tới được → "Không kiểm tra được bản mới", không ảnh hưởng app đang chạy |

## 10. Thứ cố tình KHÔNG làm

- Database server, cache, hàng đợi — một file SQLite là đủ cho một người/nhóm nhỏ
- socket.io — WebSocket thô; SSE cho Claude
- Đa tenant, cô lập ở mức hệ điều hành — mọi thứ chạy dưới quyền user chạy dịch vụ; `member` chỉ bị giới hạn ở tầng app
- Telemetry/analytics gửi ra ngoài
- Chạy Claude trong PTY rồi đọc màn hình — dùng giao thức stream-json
- Git worktree, chạy song song nhiều agent kiểu Orca (backlog); app Windows/Linux native (backlog)
