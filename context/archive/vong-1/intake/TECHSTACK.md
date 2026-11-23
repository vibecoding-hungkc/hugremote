---
type: aggregated
artifact_kind: techstack
status: RENDERED
tier: T0
last_rendered: "2026-11-21"
rendered_by: "Claude Code — soạn từ phân tích HugRemote v1.6.20; stack chốt bởi Authority 2026-11-21"
---

# TECHSTACK — HugRemote (bản phát triển lại)

> **Authority chốt (2026-11-21):** toàn bộ code viết lại theo stack skill **`stack-nestjs-react-fullstack`**
> (NestJS + React, monorepo pnpm, TypeORM, `packages/shared`, contract qua OpenAPI), **DB dùng SQLite**.
> Không giữ code Vue/Fastify của v1.
>
> **Cái được tái sử dụng từ v1 là quyết định ở tầng năng lực**, không phải framework: node-pty, ssh2 +
> fallback OpenSSH, Claude CLI `stream-json`, xterm, CodeMirror 6, marked, Remix Icon, mô hình phân phối
> `install.sh` + user service, cơ chế `BASE_PATH` (`intake/ARCHITECTURE.md §6`).
>
> Chỗ lệch default của skill (intake thắng default — `VIPER.md §1.3`) ghi "**Lệch skill**" kèm lý do.
> Ba chỗ lệch lớn đều xuất phát từ cùng một sự thật: HugRemote là **công cụ tự host cài lên chính máy làm
> việc của người dùng**, cần PTY của máy đó, `~/.ssh` và `~/.claude` của user đó — không phải web app
> SaaS chạy trong container.

## 1. Per-target tech choices

### Target: `hugremote` — monorepo `srcroot/boundaries/hugremote/`

Một repo pnpm workspace đúng cấu trúc `stack-nestjs-react-fullstack §3.2`: `apps/api` (`@app/api`), `apps/web` (`@app/web`), `packages/shared` (`@app/shared`), cộng `bin/` cho CLI và trình cài. Ba bảng dưới là lựa chọn của từng gói trong monorepo; thư mục ở `intake/ARCHITECTURE.md §1`.

#### `apps/api` (`@app/api`)

_(Nguồn: `.claude/skills/stack-nestjs-react-fullstack/SKILL.md §2, §5`)_

| Component | Choice | Reason |
|---|---|---|
| Runtime | Node.js 22 LTS | Skill §2; v1 chạy `node:22-bookworm-slim`; node-pty + better-sqlite3 cần build native ổn định |
| Language | TypeScript strict | Skill |
| Framework | NestJS 11 (`@nestjs/core`, `@nestjs/common`), adapter Express mặc định | Skill. Module NestJS theo domain: `auth`, `hosts`, `workspace`, `terminal`, `files`, `git`, `claude`, `system`, `health` |
| Package manager / monorepo | pnpm workspace trong `srcroot/boundaries/hugremote/` (`apps/*` + `packages/*`), một `pnpm-lock.yaml` | Skill §2; Authority chốt một repo monorepo cho cả api và web |
| Database | **SQLite** qua TypeORM (driver `better-sqlite3`), file `${DATA_DIR}/hugremote.db` mode 0600, WAL | **Lệch skill** (Postgres) — Authority chốt. Ứng dụng tự host một người dùng/nhóm nhỏ, cài bằng một lệnh: không được bắt người dùng dựng Postgres. Giữ nguyên TypeORM, repository pattern, migration có version |
| ORM / migration | TypeORM, `synchronize: false`, migration commit vào repo, chạy tự động lúc khởi động bản cài (`migrationsRun`) và bằng `make migrate` khi dev | Skill §5; bản cài trên máy người dùng không có bước `make migrate` riêng |
| Validation | class-validator + class-transformer, `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` toàn cục | Skill §5 — thay cho kiểm tay rải rác của v1 |
| Contract | DTO `*.dto.ts` + plugin `@nestjs/swagger` → `/api/docs-json` → web sinh `types/api.d.ts` bằng `openapi-typescript` | Skill §1, §3.1 |
| Config | `@nestjs/config` + validate env bằng class-validator; đọc thêm `~/.config/hugremote/.env` | Skill §5; giữ vị trí file `.env` của v1 để bản cài cũ dùng tiếp |
| Auth | Mật khẩu PBKDF2-SHA512 100k vòng (giữ định dạng `auth.json` v1 để nhập); `@nestjs/jwt`: access token trong bộ nhớ trình duyệt + refresh token cookie `HttpOnly; SameSite=Strict; Secure` khi HTTPS, lưu băm trong bảng `refresh_tokens` (bền qua restart); TOTP RFC 6238 + QR SVG tự sinh bằng `crypto` | Skill §5 (JWT + refresh cookie). TOTP giữ cách làm không thư viện của v1 (tránh rủi ro chuỗi cung ứng và build native). Refresh cookie `SameSite=Strict` + access token ở header thay cho CSRF token |
| SSO (Phase 2) | Google OAuth + OIDC PKCE, kiểm chữ ký `id_token` bằng JWKS (`jose`) | v1 không kiểm chữ ký — `intake/ARCHITECTURE.md §6` |
| Rate limit | `@nestjs/throttler` toàn cục, siết ở đăng nhập và bước 2FA | Skill §5; v1 không giới hạn 2FA |
| Logging | `nestjs-pino`, che trường bí mật (`password`, `token`, `secret`, `privateKey`) | Skill §5 |
| Health | `@nestjs/terminus` + `TypeOrmHealthIndicator` → `/api/health` | Skill §5 |
| Terminal (WS) | `@nestjs/websockets` + `@nestjs/platform-ws` (adapter `ws`, **không** socket.io), gateway `/ws/terminal`; `node-pty ^1.1` | Kênh PTY nhị phân thô như v1 (`terminal-ws.v1`); socket.io thêm framing không cần |
| Stream Claude | `@Sse()` của NestJS (GET, trả `Observable<MessageEvent>`), hỗ trợ `Last-Event-ID` / `?after=N`; gửi prompt bằng `POST` riêng rồi gắn stream | `@Sse()` chỉ GET — tách "gửi" và "nghe" khớp đúng mô hình tác vụ nền + reattach của v1 |
| SSH | `ssh2 ^1.16` (pool theo máy, SFTP cache) + fallback OpenSSH hệ thống (`ssh -tt`, ControlMaster) — đặt ở `src/integrations/ssh/` | Chiến lược đã vá nhiều vòng ở v1 (`intake/ARCHITECTURE.md §6`); skill §3.3 xếp SDK ngoài vào `integrations/` |
| Claude CLI | `src/integrations/claude-cli/` (process, decoder JSONL, normalizer, assembler, probe), domain `modules/claude/` | Giữ giao thức v1.6, tách god-object 3383 dòng |
| Git / zip | CLI `git` (`git -C` qua SSH, `GIT_TERMINAL_PROMPT=0`, output ≤8MB); zip bằng `python3 -m zipfile`, fallback `zip -r` | Giữ cách v1 |
| Phục vụ web | `@nestjs/serve-static` phục vụ bản build của `apps/web`, chèn `<meta name="hugremote-base-path">` lúc trả `index.html`; prefix toàn cục `${BASE_PATH}/api` | **Lệch skill §6** (web và API deploy riêng): một tiến trình, một cổng, chạy sau reverse proxy dưới `BASE_PATH` như v1 |
| CLI & phân phối | `bin/hugremote.js` (cờ → env), `hugremote doctor`, `install.sh` / `beta.sh`, user service systemd; Phase 2: updater cô lập `releases/<ver>` + symlink `current` | Giữ mô hình v1 |
| Test | Jest (mặc định NestJS) cho unit + e2e API (`supertest`); container SSH thử cho test tích hợp SSH | Skill §4 (`pnpm --filter @app/api test`) |

#### `apps/web` (`@app/web`) — web experience `hugremote`

_(Nguồn: skill §2, §3.2 biến thể Vite)_

| Component | Choice | Reason |
|---|---|---|
| Framework | React 19 | Skill |
| Language | TypeScript strict | Skill |
| Build | **Vite** (`tsc -b && vite build`), output phục vụ bởi `apps/api` | Skill §1: app sau đăng nhập, không cần SSR/SEO → Vite. Next.js không phục vụ tĩnh dưới `BASE_PATH` tuỳ biến lúc chạy được |
| Router | React Router 7, **`createHashRouter`** — `#/s/:serverId/p/:projectId/{terminal,files,git,claude}/:id?` | Skill §3.1 luật 12 (view chính gắn URL). Hash để chạy được dưới mọi `BASE_PATH` mà không cấu hình proxy |
| Server state | TanStack Query — mọi gọi API qua `features/<domain>/api` + hook; query con `enabled` khi đã có server + project | Skill §3.1 luật 10, 13 — v1 có component `fetch` thẳng |
| Client state | Zustand (`stores/`): phạm vi hiện hành, theme, layout panel | Skill §3.3 |
| HTTP | `lib/api-client.ts` — base path từ meta, gắn access token, tự refresh khi 401 | Skill §3.2 |
| Realtime | WebSocket thô cho terminal; `EventSource` cho Claude SSE. Cả hai xác thực bằng **vé ngắn hạn** (`?ticket=`, sống 30s, dùng một lần) xin bằng access token qua `POST /api/auth/stream-ticket` | `EventSource`/WebSocket không gửi được header `Authorization`, còn access token không được nằm trong cookie hay `localStorage` (skill §7) |
| Terminal | `@xterm/xterm ^6` + `addon-fit` + `addon-web-links`, một instance mỗi phiên (pool, ẩn/hiện) | Giữ từ v1 |
| Editor | CodeMirror 6 (`@codemirror/*`, lang js/json/markdown/python/html) bọc trong component React riêng — một editor duy nhất | Giữ từ v1 (nhẹ hơn Monaco, hợp cảm ứng) |
| Markdown | `marked` + `DOMPurify`, một renderer dùng chung; HTML preview trong iframe sandbox | v1 cấu hình 3 chỗ |
| CSS / UI | Tailwind CSS 4 đọc token CSS custom properties của design system; kho component riêng (`components/`), không thư viện UI ngoài; theme tối/sáng qua `data-theme` | Skill scaffold dùng Tailwind; token là hợp đồng design system chốt ở pha V |
| Icons | Remix Icon 4.6 đóng gói cùng bundle | Giữ bộ icon v1, bỏ CDN để CSP chặt |
| i18n | `i18next` + `react-i18next`, locale `vi` (mặc định) + `en`, test bắt khoá thiếu | v1 tự viết store i18n và phủ thiếu |
| PWA | Manifest + meta standalone iOS, safe-area, `visualViewport` cho bàn phím ảo | v1 thiếu `visualViewport` |
| Giọng nói (Phase 2) | Web Speech API theo locale | Giữ từ v1 |
| Test (e2e) | Playwright ở gốc monorepo `srcroot/boundaries/hugremote/` (viewport 390×844, 820×1180, 1440×900) | Skill §2, §4 |

#### `packages/shared` (`@app/shared`)

| Component | Choice | Reason |
|---|---|---|
| Nội dung | Enum + hằng số + hàm thuần dùng cả hai phía: loại máy (`local`/`ssh`), chế độ quyền Claude, loại sự kiện `claude-stream.v1`, mã lỗi, giới hạn (kích thước đọc file, số phiên tối đa), chuẩn hoá đường dẫn `~/…` | Skill §3.1 luật 2–3; v1 cũng có gói kiểu dùng chung cho giao thức Claude |
| Vị trí | `srcroot/boundaries/hugremote/packages/shared` — bên trong monorepo | Đúng skill §3.2; không còn câu hỏi mở vì api và web chung một repo |

## 2. Cross-cutting infrastructure

| Hạng mục | Lựa chọn | Ghi chú |
|---|---|---|
| Dev local | `deployment/local/docker-compose.yml` (build context = monorepo `srcroot/boundaries/hugremote`): `shared` (tsc -w) + `api` (Nest watch, cổng 3000) + `web` (Vite 5173, proxy `/api`, `/ws` → api) + `sshd` (container SSH thử, có jump host) | Skill §2.1, **lệch**: không có service `db` (SQLite là file trong volume `DATA_DIR` của api). Trong dev, "máy local" của HugRemote là chính container api |
| Môi trường chạy thật | Cài **native** lên máy người dùng (Linux/macOS) qua `install.sh`, user service systemd, nghe `127.0.0.1:8099`, ra ngoài qua reverse proxy hoặc Cloudflare Tunnel dưới `BASE_PATH` | **Lệch skill §6** (PaaS): app phải chạy trên chính máy có PTY, `~/.ssh`, `~/.claude` cần điều khiển. Instance của Authority sau Cloudflare Tunnel là "production" để deploy và dogfood lần 2 |
| Makefile | Root `Makefile` của repo VIPER điều phối `make -C srcroot/boundaries/hugremote <lệnh>`; Makefile của monorepo hiện thực 6 lệnh theo skill §4 | Skill §3.5 |
| `make deploy` | Build + đóng gói bản phát hành, cài lên máy đích qua `install.sh`/updater, health check `/api/health`, quay lại bản trước khi lỗi | Chi tiết ở `context/shared/DEPLOY.md` (pha P) |
| Docker | Image tuỳ chọn `node:22-bookworm-slim` + `openssh-client` + `git` + `python3` — kênh cài thay thế | v1 có, nhưng build qua symlink legacy |
| CI | GitHub Actions: `make check` + `make test` trên Ubuntu mỗi push | v1 không có CI cho web |
| Phát hành | Tag `vX.Y.Z` → GitHub Release (ghi chú phát hành tiếng Việt) | Giữ |
| Biến môi trường (`deployment/.env.example`) | `APP_ENV` · `PORT` (8099) · `HOST` (127.0.0.1) · `BASE_PATH` · `APP_URL` · `DATA_DIR` (`~/.config/hugremote`) · `WORKSPACE_ROOT` · `ALLOWED_ROOT` · `JWT_SECRET` (sinh + lưu lần đầu nếu trống) · `AUTH_MODE` · `AUTH_PASSWORD` (chỉ lần đầu) · `AUTH_MAX_ATTEMPTS` · `AUTH_LOCK_MINUTES` · `TRUST_PROXY` · `CLAUDE_BIN_PATH` · `UPDATE_CHANNEL` | Giữ tên biến v1; bỏ `DATABASE_URL` của skill (đường dẫn DB suy từ `DATA_DIR`) |

## 3. References

- `.claude/skills/stack-nestjs-react-fullstack/SKILL.md` — bất biến kiến trúc, preset, forbidden patterns
- `intake/ARCHITECTURE.md §6` — ràng buộc kế thừa
