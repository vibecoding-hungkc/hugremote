---
type: techstack
tier: T0
status: ACTIVE
last_reviewed: "2026-11-21"
---

# TECHSTACK — hugremote

> Chốt ở pha V (DECISIONS 2026-11-21). Dịch từ `intake/TECHSTACK.md` — intake thắng default của skill.
> Đổi stack sau pha V = phá luật #1, phải ghi đánh đổi.

---

## 1. Stack theo target

### Target: `hugremote`

Monorepo pnpm tại `srcroot/boundaries/hugremote/` — `apps/api` (`@app/api`), `apps/web` (`@app/web`,
cũng là web experience `hugremote`), `packages/shared` (`@app/shared`), `bin/` (CLI, trình cài).

| Hạng mục | Chọn | Version | Lý do |
|---|---|---|---|
| Skill đang dùng | `stack-nestjs-react-fullstack` | — | Authority chốt; các chỗ lệch ở mục dưới |
| Ngôn ngữ | TypeScript strict | 5.x | Skill |
| Runtime | Node.js LTS | 22 | node-pty + better-sqlite3 cần build native ổn định |
| Package manager | pnpm workspace, một `pnpm-lock.yaml` | 9.x (corepack) | Skill §2 |
| Framework API | NestJS, adapter Express | 11 | Skill; module theo domain `auth · sso · hosts · workspace · terminal · files · git · claude · search · system · health` |
| Database | SQLite qua driver `better-sqlite3`, file `${DATA_DIR}/hugremote.db`, mode 0600, WAL | — | Authority chốt; công cụ tự host cài một lệnh, không bắt dựng Postgres |
| ORM / query layer | TypeORM, `synchronize: false`, migration có version, `migrationsRun` khi khởi động bản cài | 0.3.x | Skill §5 |
| Validation | class-validator + class-transformer, `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` | — | Skill §5 |
| Contract | DTO `*.dto.ts` + `@nestjs/swagger` → `/api/docs-json` → `openapi-typescript` sinh `apps/web/src/types/api.d.ts` | — | Skill §1, §3.1 |
| Config | `@nestjs/config` + validate env; đọc thêm `~/.config/hugremote/.env` | — | Giữ vị trí `.env` quen thuộc |
| Auth | `@nestjs/jwt` (access 15 phút, trong bộ nhớ trình duyệt) + refresh 14 ngày (cookie httpOnly `SameSite=Strict`, băm SHA-256 trong bảng `refresh_tokens`); mật khẩu PBKDF2-SHA512 100k; TOTP RFC 6238 + QR SVG tự sinh bằng `node:crypto` | — | Skill §5; TOTP không thư viện ngoài |
| Vé stream | `POST /api/auth/stream-ticket` → vé 30s dùng một lần cho WebSocket terminal và SSE Claude | — | WebSocket/EventSource không gửi được header `Authorization` |
| Rate limit | `@nestjs/throttler` toàn cục + đếm sai mật khẩu/2FA riêng theo IP (5 lần → khoá 15 phút) | — | Skill §5 |
| Log | `nestjs-pino`, `redact` cho `password · token · secret · privateKey · passphrase` | — | Skill §5 |
| Health | `@nestjs/terminus` + `TypeOrmHealthIndicator` → `/api/health` | — | Skill §5 |
| Terminal | `@nestjs/websockets` + `@nestjs/platform-ws` (adapter `ws`, không socket.io) · `node-pty` | node-pty 1.x | Kênh PTY nhị phân thô |
| Upload | Multer của `@nestjs/platform-express` (100MB/file, 200 file, giữ `relativePath`) | — | Có sẵn trong adapter Express |
| Claude CLI | Spawn `claude -p --input-format stream-json --output-format stream-json --include-partial-messages --verbose` (local `child_process`, SSH exec); `integrations/claude-cli` decoder/normalizer/assembler; SSE bằng `@Sse()` (GET) | Claude Code CLI trên máy đích | Giao thức có cấu trúc đã kiểm chứng ở v1.6 |
| SSO | Google OAuth + OIDC (PKCE S256), kiểm `id_token` bằng `jose` (JWKS) | jose 5 | Đóng lỗ hổng v1 không kiểm chữ ký |
| Git | CLI `git` (local spawn mảng tham số; SSH `git -C` có quote), `GIT_TERMINAL_PROMPT=0`, output ≤8MB | git ≥2.30 trên máy đích | Một lệnh cho local và remote |
| Nén | `python3 -m zipfile`, fallback `zip -r` trên remote; zip tạm TTL 60 phút, tổng ≤500MB | — | Như v1 |
| Cập nhật | `bin/isolated-update` (staging → build → đổi symlink `current` → restart → health → quay lại), khoá PID, kênh stable (tag) / beta (`main`) | — | Như v1, đã chạy thật |
| SSH | `ssh2` (pool theo máy, SFTP cache) + fallback OpenSSH hệ thống (`ssh -tt`, ControlMaster) ở `src/integrations/ssh/` | ssh2 1.16+ | Chiến lược đã kiểm chứng ở v1 (`ARCHITECTURE.md §6`) |
| Phục vụ web | `@nestjs/serve-static` phục vụ `apps/web/dist`, chèn `<meta name="hugremote-base-path">` khi trả `index.html`; prefix `${BASE_PATH}/api` | — | Một tiến trình, một cổng, chạy sau reverse proxy |
| Web | React 19 + Vite 6 (`tsc -b && vite build`) | — | Skill §1: app sau đăng nhập → Vite |
| Router | React Router 7 `createHashRouter` (`#/s/:hostId/p/:projectId/terminal/:sessionId?`) | 7 | Skill §3.1 luật 12; hash chạy dưới mọi `BASE_PATH` |
| Server state | TanStack Query (query con `enabled` khi đã có host + project) | 5 | Skill §3.1 luật 10, 13 |
| Client state | Zustand: phạm vi hiện hành, bố cục (độ rộng thanh bên, chia ô), access token | 5 | Skill §3.3 |
| Editor | CodeMirror 6 (`@codemirror/*`, lang js/ts/json/markdown/python/html/css/yaml) bọc component React | 6 | Nhẹ hơn Monaco, hợp cảm ứng |
| Markdown | `marked` + `DOMPurify`, một renderer dùng chung (chat Claude, xem trước file); HTML xem trước trong iframe `sandbox` | — | v1 cấu hình 3 chỗ |
| Diff | Hiển thị unified diff tự render (không thư viện), tô màu bằng token | — | Nhẹ, theo design system |
| SSE client | `EventSource` với vé `?ticket=`, tự nối lại kèm `Last-Event-ID` | — | Khớp `@Sse()` |
| Giọng nói | Web Speech API theo ngôn ngữ giao diện | — | Không phụ thuộc thêm |
| Terminal UI | `@xterm/xterm` + `addon-fit` + `addon-web-links`, một instance mỗi phiên | 5.x/6.x | Giữ cách v1 |
| UI kit | Không thư viện component ngoài; kho component riêng theo `DESIGN-SYSTEM.md §4`; CSS custom properties từ token + Tailwind CSS 4 đọc biến đó | Tailwind 4 | Token là hợp đồng design system |
| Icons | Remix Icon đóng gói cùng bundle (không CDN) | 4.6 | CSP chặt |
| i18n | `i18next` + `react-i18next`; `vi` mặc định + `en` đủ 100% khoá | — | Test bắt chuỗi cứng + khoá thiếu |
| Test runner | Jest + supertest (api), Vitest + Testing Library (web), Playwright (e2e, gốc monorepo) | — | Skill §4 |
| Deploy | `make deploy`: build + cài user service local (systemd `--user` / launchd) + health check + quay lại bản trước khi lỗi; phân phối cho người khác bằng `install.sh` / `beta.sh` | — | DECISIONS 2026-11-21; không PaaS |

### Sai khác so với skill

| Hạng mục | Skill mặc định | Intake chốt | Vì sao theo intake |
|---|---|---|---|
| Database | Postgres 16 trong compose | SQLite file trong `DATA_DIR` | Authority chốt; cài một lệnh trên máy cá nhân, không DB server |
| Nơi chứa monorepo | Gốc repo | `srcroot/boundaries/hugremote/` | Đường intake: mỗi target một thư mục dưới `srcroot/` (skill §3.5) |
| Web | Next.js mặc định | Vite React | App sau đăng nhập, không SSR; Next không phục vụ tĩnh dưới `BASE_PATH` đổi lúc chạy |
| Deploy web/API | Hai thứ riêng (skill §6) | Web build tĩnh do API phục vụ, một cổng | Chạy sau reverse proxy dưới `BASE_PATH` |
| Nơi chạy thật | PaaS | User service trên máy người dùng | Phải chạy trên chính máy có PTY, `~/.ssh`, `~/.claude` |
| Docker Compose dev | `db + shared + api + web` | `shared + api + web + sshd + jump + keycloak` | Không có DB server; cần máy SSH thử + jump host |
| Biến DB | `DATABASE_URL` | Suy từ `DATA_DIR` | Một file SQLite |
| WebSocket | (không nói) | `@nestjs/platform-ws`, không socket.io | Luồng PTY thô |
| CSRF | (cookie + Bearer) | Access token ở header + refresh cookie `SameSite=Strict`; không cookie phiên tự gửi cho API | Không cần CSRF token |

## 2. Hạ tầng dùng chung

| Hạng mục | Chọn | Version | Dùng cho target nào |
|---|---|---|---|
| Error tracking | Không dịch vụ ngoài: log JSON (pino) ra file `DATA_DIR/logs/` xoay vòng 7 ngày + lỗi hiện ở Cài đặt → Hệ thống | — | hugremote |
| Analytics | Không — công cụ tự host, không gửi gì ra ngoài; nhật ký dùng cục bộ (đăng nhập, mở phiên) để Authority tự đọc ở pha R | — | hugremote |
| Máy SSH thử | Container `sshd` (có `git` + `fake-claude` phát fixture stream-json) + `jump` (OpenSSH) trong `deployment/local/docker-compose.yml` | — | hugremote (dev, test, dogfood) |
| IdP thử | Container Keycloak (realm `hugremote`, 2 người dùng thử) | — | hugremote (AC-32/33) |
| Kênh phát hành thử | Git repo cục bộ có 2 tag để thử cập nhật + quay lại | — | hugremote (AC-31) |
| CI | GitHub Actions: `make check` + `make test` mỗi push | — | hugremote |

## 3. Vì sao chọn stack này

Authority chốt `stack-nestjs-react-fullstack` cho bản viết lại (API tách bạch có contract OpenAPI, monorepo
có `@app/shared`) và SQLite cho dữ liệu. Ràng buộc thật của sản phẩm: chạy trên chính máy làm việc của
người dùng, cần PTY/`~/.ssh`/`~/.claude` của user đó, cài một lệnh — nên SQLite, một tiến trình phục vụ cả
web, và cài native thay vì PaaS. Năng lực tái dùng từ v1 ở tầng thuật toán (node-pty, ssh2 + fallback
OpenSSH, xterm), không ở tầng framework. DECISIONS 2026-11-21 (Stack, Một target, Lệch skill).

## 4. Version pinning

Ghi version thật sau khi scaffold xong (đọc từ `package.json`), để lần sau dựng lại được đúng.

```
(điền ở pha I sau scaffold)
```

## 5. Hợp đồng lệnh

| Lệnh | Làm gì | Đã hoạt động? |
|---|---|---|
| `make dev` | Compose: shared (tsc -w) + api (Nest watch :3000) + web (Vite :5173, proxy `/api` `/ws`) + sshd + jump + keycloak | ☐ |
| `make check` | Lint + typecheck + build cả monorepo | ☐ |
| `make test` | Jest (api) + Vitest (web) + Playwright smoke | ☐ |
| `make migrate` | TypeORM migration:run trên SQLite của dev | ☐ |
| `make deploy` | Build bản phát hành + cài/khởi động lại user service local + health check + quay lại khi lỗi | ☐ |
| `make doctor` | Kiểm Node, pnpm, git, ssh, python3/zip, quyền `DATA_DIR`, biến môi trường, `/api/health` | ☐ |

Root `Makefile` là hợp đồng 6 lệnh duy nhất — thân lệnh gọi `make -C srcroot/boundaries/hugremote …`.
Deploy luôn đi qua root `make deploy` (hook `guard_bc` đứng ở đó).

## 6. Biến môi trường

Danh sách đầy đủ ở `deployment/.env.example`; giá trị local ở `deployment/local/.env` (không commit).

| Biến | Dùng để | Target | Bắt buộc? |
|---|---|---|---|
| `APP_ENV` | `development` / `production` (tắt Swagger ở production) | hugremote | có |
| `PORT` | Cổng nghe (mặc định 8099; dev 3000) | hugremote | không |
| `HOST` | Địa chỉ nghe (mặc định `127.0.0.1`) | hugremote | không |
| `BASE_PATH` | Đường dẫn con sau reverse proxy, ví dụ `/remote` | hugremote | không |
| `APP_URL` | Origin công khai — kiểm Origin WS/CORS, cờ `Secure` của cookie | hugremote | không (mặc định `http://localhost:PORT`) |
| `DATA_DIR` | Thư mục dữ liệu (DB, `secret.key`, `known_hosts`, log) — mặc định `~/.config/hugremote` | hugremote | không |
| `WORKSPACE_ROOT` | Thư mục dự án mặc định của máy local | hugremote | không |
| `ALLOWED_ROOT` | Ranh giới duyệt file local (mặc định `$HOME`) | hugremote | không |
| `JWT_SECRET` | Khoá ký JWT; trống thì sinh lần đầu và lưu vào `DATA_DIR/secret.key` | hugremote | không |
| `AUTH_MODE` | `password` (mặc định; SSO bật thêm trong Cài đặt); `none` chỉ chấp nhận khi `HOST` là loopback | hugremote | không |
| `AUTH_PASSWORD` | Mật khẩu khởi tạo (chỉ dùng khi chưa có tài khoản) | hugremote | không |
| `AUTH_MAX_ATTEMPTS` · `AUTH_LOCK_MINUTES` | Ngưỡng khoá đăng nhập/2FA (5 · 15) | hugremote | không |
| `TRUST_PROXY` | Tin `X-Forwarded-For` (sau reverse proxy) | hugremote | không |
| `SSH_CONFIG_PATH` | Đường dẫn `~/.ssh/config` (dev/test trỏ vào file mẫu) | hugremote | không |
| `CLAUDE_BIN_PATH` | Đường dẫn Claude CLI local (mặc định tìm trong PATH, `~/.local/bin`) | hugremote | không |
| `CLAUDE_PROJECTS_DIR` | Thư mục phiên CLI (mặc định `~/.claude/projects`) | hugremote | không |
| `UPDATE_CHANNEL` · `UPDATE_REPO` | Kênh `stable`/`beta`, nguồn phát hành | hugremote | không |
| `PUBLIC_BASE_URL` cho SSO callback | Dùng `APP_URL` + `BASE_PATH` | hugremote | không |
