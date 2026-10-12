# HugRemote Architecture

HugRemote is a mobile-first web IDE and terminal with a Claude Code chat interface. The app is built as a Vue 3 single-page application served by a Fastify backend. The backend owns all privileged capabilities: filesystem access, PTY/SSH terminal sessions, Claude CLI execution, auth, and WebSocket routing.

## Goals

- Mobile-first touch UX for phones and iOS standalone PWA.
- Real terminal and Claude CLI behavior; no mocked command/chat output.
- Simple deployment through Node.js, npm/npx, curl installer, systemd, or Docker.
- Clear security boundary: browser UI is untrusted; backend validates auth and allowed filesystem roots.
- Extensible code structure for future auth, servers, tools, and deployment modes.

## Repository Layout

```text
.
├── bin/
│   └── hugremote.js                 # CLI wrapper for npm/npx/global installs
├── client/
│   └── src/
│       ├── App.vue                  # App shell and modal wiring
│       ├── components/              # Vue UI components
│       ├── composables/             # Reusable Vue app/bootstrap logic
│       ├── stores/                  # Pinia stores for app state and API calls
│       └── utils/                   # API/WebSocket URL helpers
├── server/
│   └── src/
│       ├── auth/                    # Auth config, sessions, middleware, routes
│       ├── routes/                  # Fastify HTTP and WebSocket routes
│       ├── services/                # PTY, SSH, filesystem, Claude CLI services
│       ├── telegram/                # Telegram bot, topic manager, streaming bridge
│       ├── auth.ts                  # Auth barrel exports
│       ├── config.ts                # Runtime config and SSH server discovery
│       └── index.ts                 # Fastify bootstrap
├── Dockerfile
├── docker-compose.yml
├── install.sh
├── start.sh
└── README.md
```

## Runtime Processes

### Browser SPA

The browser loads the Vue app from `server/public`. It talks to the backend via:

- HTTP API: `${BASE_PATH}/api/*`
- Terminal WebSocket: `${BASE_PATH}/ws/terminal`
- Google OAuth browser redirects: `${BASE_PATH}/auth/google*`

`client/src/utils/api.ts` resolves `BASE_PATH` from `window.__BASE_PATH__`, which the server injects into `index.html` at request time.

### Fastify Backend

`server/src/index.ts` wires the backend in this order:

1. Fastify/CORS/WebSocket plugins.
2. Auth routes.
3. Auth middleware hook.
4. Core API and WebSocket routes.
5. Optional duplicated route registration under `BASE_PATH`.
6. Static SPA serving and fallback.
7. `fastify.listen({ port: PORT, host: HOST })`.

This order matters: auth routes must be public; application APIs and WebSockets must be protected when auth is enabled.

## Configuration

Core runtime config lives in `server/src/config.ts` and environment variables.

| Variable | Default | Purpose |
|---|---:|---|
| `PORT` | `8099` | HTTP/WebSocket port |
| `HOST` | `::` | Bind address |
| `BASE_PATH` | empty | Reverse-proxy subpath, e.g. `/remote` |
| `WORKSPACE_ROOT` | `~/projects` | Default workspace shown in terminal/files |
| `ALLOWED_ROOT` | `~` | Maximum allowed filesystem root |
| `AUTH_MODE` | `none` | `none`, `password`, or `google` |
| `APP_URL` | `http://localhost:$PORT` | Public app URL for OAuth redirects |

The CLI wrapper `bin/hugremote.js` converts CLI options into these environment variables before importing `server/dist/index.js`.

## Auth Architecture

Auth modules are under `server/src/auth/`.

```text
server/src/auth/
├── config.ts          # AUTH_MODE, APP_URL, provider settings, validation
├── cookies.ts         # Signed cookie helpers
├── googleOAuth.ts     # Google redirect and callback flow
├── middleware.ts      # HTTP/WS protection decisions
├── passwordLimiter.ts # Password comparison + 5-fail/15-minute lockout
├── routes.ts          # /api/auth/* and /auth/google* endpoints
├── sessionStore.ts    # In-memory sessions and cookie creation/destruction
└── types.ts           # Shared auth types
```

`server/src/auth.ts` is a compatibility barrel that exports the public auth API used by the server bootstrap and WebSocket routes.

### Auth Modes

#### `AUTH_MODE=none`

- No login UI.
- `/api/auth/me` returns authenticated.
- Middleware allows all requests.

#### `AUTH_MODE=password`

- Login UI shows one password field, no username.
- Server compares against plain `AUTH_PASSWORD` from environment/config.
- Failed attempts are tracked in memory per client IP.
- `AUTH_MAX_ATTEMPTS` defaults to `5`.
- `AUTH_LOCK_MINUTES` defaults to `15`.
- After lockout, even the correct password is rejected until the timer expires.

#### `AUTH_MODE=google`

- Login UI redirects to Google OAuth.
- Required config:
  - `APP_URL`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_ALLOWED_EMAILS`
- Redirect URI is:

```text
${APP_URL}${BASE_PATH}/auth/google/callback
```

Only emails listed in `GOOGLE_ALLOWED_EMAILS` can create a session.

### Sessions

Sessions are in-memory and represented by signed `HttpOnly` cookies:

- Cookie: `hugremote_session`
- `SameSite=Lax`
- `Secure` when `APP_URL` is HTTPS
- Path is `BASE_PATH` or `/`
- Restarting the backend clears sessions unless external persistence is added later.

## Frontend Architecture

### App Shell

`client/src/App.vue` is the composition root. It wires the main tabs and modals but delegates reusable logic to components/composables.

`client/src/composables/useAppBootstrap.ts` owns startup:

1. Fetch auth state.
2. If authenticated, load servers, files, and Claude sessions.
3. If not authenticated, show `AuthGate`.

### State Stores

```text
client/src/stores/
├── authStore.ts      # Auth mode/status, password login, logout, Google URL
├── i18nStore.ts      # Locale state, translation lookup, persistence
├── serverStore.ts    # Local/SSH server list and current server
├── fileStore.ts      # Filesystem tree, file loading, writes, previews
├── terminalStore.ts  # Terminal window metadata and active session
└── claudeStore.ts    # Claude sessions, messages, streaming, limits
```

Stores call backend APIs directly using `apiUrl()` from `client/src/utils/api.ts`.

### Internationalization

The frontend i18n system is intentionally lightweight and easy to extend:

```text
client/src/i18n/messages.ts          # Supported locales and translation trees
client/src/stores/i18nStore.ts       # Active locale, t(key), localStorage persistence
client/src/composables/useI18n.ts    # Convenience access for components
client/src/components/LanguageSwitcher.vue
```

Current locales:

- `vi` — Vietnamese
- `en` — English

Add a new language by:

1. Adding its locale code to `SUPPORTED_LOCALES`.
2. Adding its label to `localeLabels`.
3. Adding a matching translation tree in `messages`.

Components should call `t('namespace.key')` rather than hardcoding user-facing strings. Use interpolation for dynamic values, for example `t('terminalHub.title', { server })`. Locale choice is stored in `localStorage` under `hugremote_locale` and updates `document.documentElement.lang`.

### UI Components

Large reusable UI units live in `client/src/components/`.

Important components:

- `AuthGate.vue` — password/Google login surface.
- `TerminalView.vue` — xterm-like terminal screen and mobile key bar.
- `TerminalSessionHubModal.vue` — terminal window picker/actions.
- `ClaudeView.vue` — Claude chat stream, tool cards, composer, stop button.
- `ClaudeSessionHubModal.vue` — Claude session picker/actions.
- `ClaudeLimitsPopup.vue` — auto-loaded Claude usage modal.
- `FileExplorer.vue` and `CodeEditor.vue` — file browsing and editing/preview.

## Terminal Flow

1. `TerminalView.vue` opens a WebSocket with `wsUrl('/ws/terminal?...')`.
2. `server/src/routes/ws.ts` checks `requireAuthForWs(req)` before attaching a PTY.
3. `sessionManager` chooses local PTY or SSH based on selected server config.
4. Browser keystrokes are forwarded over WS to the PTY.
5. PTY output streams back to the browser.

Terminal session metadata is kept in `terminalStore.ts`. PTY process state is backend-owned.

## Claude Code Flow

1. Claude session metadata is loaded through `/api/claude/sessions`.
2. Sending a message calls `/api/claude/sessions/:id/messages/stream`.
3. `claudeService.ts` spawns the real Claude CLI and parses streaming JSON/SSE-like events.
4. The frontend updates one live assistant message with thinking text, tool cards, outputs, and final answer.
5. Stop calls `/api/claude/sessions/:id/cancel`; backend sends `SIGINT` to the active process.

Rules:

- No fake Claude responses.
- Stop must show the real cancelled state: `Đã dừng yêu cầu.`
- Bypass permissions is explicit per Claude session and maps to CLI flags.

## Filesystem Flow

All file actions go through backend APIs and `fsService.ts`:

- Browse directory tree.
- Read files.
- Create/rename/delete files/folders.
- Save edited content.

The server enforces `ALLOWED_ROOT` to prevent browsing outside the allowed filesystem boundary.

## Telegram Bot Integration Architecture

HugRemote includes an optional Telegram Bot integration (`server/src/telegram/`) that allows users to interact with Claude Code and execute terminal commands from any Telegram client.

### Core Modules
- `config.ts`: Loads `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USERS`, `TELEGRAM_TOPIC_MODE`, and `TELEGRAM_DEFAULT_CWD`.
- `bot.ts`: Initializes the `grammy` Bot instance, installs zero-trust authorization middleware, and manages the long-polling lifecycle linked to Fastify server startup/shutdown.
- `topicManager.ts`: Manages multi-session topic mode (Threaded Mode / Forum Topics), persists bindings between `(chatId, threadId)` and Claude `sessionId` to `~/.config/hugremote/telegram_topics.json`, and handles automatic topic renaming.
- `claudeBridge.ts`: Streams Claude Code CLI JSON events into Telegram messages in real time with debounced edits (1200ms) to respect Telegram API rate limits, formats tool execution cards, and uploads long responses (> 3800 chars) to the file server with clickable links.
- `terminalRunner.ts`: Executes direct shell commands (`/terminal <cmd>`), capturing execution time, exit codes, and output with file server offloading for large outputs.
- `commands.ts`: Registers bot commands:
  - `/new [name] [cwd]`: Creates a new session and binds to the active topic.
  - `/resume [id]`: Connects to an existing session or lists available sessions.
  - `/compact`: Triggers context compression/compaction.
  - `/clear`: Clears message history of the current session.
  - `/stop` / `/abort`: Cancels in-flight Claude CLI process.
  - `/status`: Displays active session metrics and Claude quota limits.
  - `/sessions`: Lists all available sessions.
  - `/terminal <cmd>`: Runs shell command in workspace.
  - `/cd <path>` and `/pwd`: Changes and inspects working directory.
  - `/topic [on|off|<session_id>]`: Configures topic mode and topic bindings.

## Deployment Modes

### Host/systemd

Installer creates a user-level systemd service. Runtime config is stored as `Environment=` lines in the service file.

### npm/npx

`bin/hugremote.js` is the entrypoint. It parses CLI options and imports built server code.

### Docker

`Dockerfile` builds the client and server, then runs `node dist/index.js` from a slim Node image. `docker-compose.yml` maps port `8099` to localhost by default.

## Development Guidelines

- Keep privileged logic backend-side.
- Do not add direct filesystem/terminal/Claude behavior to the frontend.
- New backend features should live under `server/src/services/` or feature-specific folders, with routes staying thin.
- New frontend state belongs in Pinia stores; reusable UI belongs in `components/`; lifecycle orchestration belongs in `composables/`.
- Preserve mobile-first constraints: no horizontal drift, touch-safe controls, bottom-sheet modals instead of native prompts.
- Secrets must not be committed. Plain password auth is intentionally supported for ease of use, but it belongs only in env/private service config.

## Future Refactor Candidates

- Split `claudeService.ts` into process management, event parsing, limits, and persistence modules.
- Split `TerminalView.vue` key definitions into data-driven config.
- Add persistent session store for auth if logout-on-restart becomes undesirable.
- Move deployment examples into `docs/deployment.md` if README grows further.
