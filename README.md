# 🐴 HugRemote — Mobile-First Web IDE & Terminal

> **Mobile-first web IDE, multi-window terminal, and Claude Code coding assistant optimized for phones.**

---

## ⚡ Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/vibecoding-hungkc/hugremote/packaged/install.sh | bash
```

Alternative:

```bash
npx hugremote
npm install -g hugremote
hugremote
```

---

## 🚀 CLI Usage

```bash
# Default: port 8099, no auth
hugremote

# Reverse proxy / Cloudflare Tunnel subpath
hugremote -p 8099 -b /remote

# Password auth: one password field, no username
hugremote --auth password --password 'your-password'

# Google auth
AUTH_MODE=google \
APP_URL=https://your-domain.com \
BASE_PATH=/remote \
GOOGLE_CLIENT_ID=... \
GOOGLE_CLIENT_SECRET=... \
GOOGLE_ALLOWED_EMAILS=user@gmail.com,admin@domain.com \
hugremote
```

### CLI Options

| Option | Description | Default |
|---|---|---|
| `-p, --port <number>` | HTTP & WebSocket port | `8099` or `$PORT` |
| `-h, --host <ip>` | Bind address | `::` or `$HOST` |
| `-b, --base-path <path>` | Subpath prefix, e.g. `/remote` | `""` or `$BASE_PATH` |
| `-w, --workspace <dir>` | Default workspace | `~/projects` or `$WORKSPACE_ROOT` |
| `-a, --allowed-root <dir>` | Maximum file-browser access root | `~` or `$ALLOWED_ROOT` |
| `--auth <mode>` | `none`, `password`, or `google` | `none` or `$AUTH_MODE` |
| `--password <pass>` | Plain password for password auth | `$AUTH_PASSWORD` |
| `--app-url <url>` | Public app URL for Google OAuth | `http://localhost:8099` or `$APP_URL` |
| `-v, --version` | Print version | `1.0.0` |
| `--help` | Show help | |

---

## 🔐 Authentication

HugRemote supports three auth modes.

### 1. No Auth

```env
AUTH_MODE=none
```

This is the default. Use it for localhost, trusted LAN, or when Cloudflare Access / another reverse proxy already protects the app.

### 2. Password Auth

```env
AUTH_MODE=password
AUTH_PASSWORD=your-password
SESSION_SECRET=random-long-secret
AUTH_MAX_ATTEMPTS=5
AUTH_LOCK_MINUTES=15
```

Behavior:

- Login screen has only one password field.
- No username.
- The password is stored as plain text in env/service config for easier setup.
- 5 wrong attempts from the same IP locks login for 15 minutes.
- Successful login resets the failed-attempt counter.
- Session is stored in an HttpOnly cookie.

> Do not commit passwords/secrets to Git. Prefer systemd env, shell env, or a private `.env` file with `chmod 600`.

### 3. Google Login

```env
AUTH_MODE=google
APP_URL=https://your-domain.com
BASE_PATH=/remote
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_ALLOWED_EMAILS=user@gmail.com,admin@domain.com
SESSION_SECRET=random-long-secret
```

Only emails in `GOOGLE_ALLOWED_EMAILS` can access the app.

Google OAuth Redirect URI:

```text
${APP_URL}${BASE_PATH}/auth/google/callback
```

Examples:

```text
http://localhost:8099/auth/google/callback
https://hugtech.buaanvuive.com/remote/auth/google/callback
```

---

## 📱 Key Features

- Mobile-first PWA layout with iOS safe-area support.
- Real PTY terminal over WebSocket for local and SSH-backed sessions.
- Mobile terminal shortcut bar and expanded quick-key drawer.
- Claude Code UI connected to the real Claude CLI with streaming thinking/tool cards.
- Claude stop button sends `SIGINT` instead of generating fake output.
- File explorer, Markdown preview, syntax-highlighted code viewer.

---

## 🛠️ User Systemd Service on Linux

```bash
systemctl --user start hugremote
systemctl --user enable hugremote
systemctl --user status hugremote
systemctl --user restart hugremote
systemctl --user stop hugremote
```

Edit service env at:

```bash
~/.config/systemd/user/hugremote.service
```

Then reload/restart:

```bash
systemctl --user daemon-reload
systemctl --user restart hugremote
```

---

## 📄 License

Released under the [MIT](LICENSE) license.
