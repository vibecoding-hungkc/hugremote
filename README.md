# 🐴 HugRemote — Mobile-First Web IDE & Terminal

> **Mobile-first web IDE, multi-window terminal, and Claude Code coding assistant optimized for phones.**

---

## ⚡ Quick Install

### Option 1: One-line curl installer (Recommended)
```bash
curl -fsSL https://raw.githubusercontent.com/vibecoding-hungkc/hugremote/packaged/install.sh | bash
```

The installer checks Node.js >= 18, builds frontend/backend assets, creates the `hugremote` CLI command, and optionally configures a user-level systemd service.

### Option 2: Run with npm / npx
```bash
# Run immediately without installing globally:
npx hugremote

# Or install globally:
npm install -g hugremote
hugremote
```

### Option 3: Run from source
```bash
git clone -b packaged https://github.com/vibecoding-hungkc/hugremote.git
cd hugremote
./install.sh
```

---

## 🚀 CLI Usage

```bash
# Default startup: port 8099, bind 127.0.0.1 only
hugremote

# Change the listening port
hugremote -p 3000

# Bind to another interface when needed
hugremote --host 0.0.0.0
hugremote --host ::

# Use a subpath for Cloudflare Tunnel / reverse proxy / Nginx
hugremote -p 8099 -b /remote

# Customize workspace and file access root
hugremote -w ~/my-projects -a ~/
```

### CLI Options

| Option | Description | Default |
|---|---|---|
| `-p, --port <number>` | HTTP & WebSocket listening port | `8099` or `$PORT` |
| `-h, --host <ip>` | Bind address. Use `0.0.0.0` or `::` only when you intentionally want network exposure. | `127.0.0.1` or `$HOST` |
| `-b, --base-path <path>` | Subpath prefix, for example `/remote` | `""` or `$BASE_PATH` |
| `-w, --workspace <dir>` | Default terminal/project workspace | `~/projects` or `$WORKSPACE_ROOT` |
| `-a, --allowed-root <dir>` | Maximum file-browser access root | `~` or `$ALLOWED_ROOT` |
| `-v, --version` | Print version | `1.0.0` |
| `--help` | Show help | |

---

## 📱 Key Features

### 1. 100% Mobile-First UX
- iOS standalone PWA layout with safe-area support for notch, Dynamic Island, and home indicator.
- Horizontal-drift protection with `touch-action: pan-y` and `overscroll-behavior-x: none`.
- File actions, rename flows, and confirmations use touch-friendly bottom-sheet modals instead of native browser prompts.

### 2. Multi-Window Terminal & Multi-Server SSH
- Real PTY shell over WebSocket for local and SSH-backed terminal sessions.
- Direct typing at the terminal cursor on mobile keyboards.
- Mobile shortcut bar with `Esc`, `Tab`, `Ctrl C`, `Enter`, arrow keys, and an expanded quick-key drawer for Ctrl combos, Git macros, and common commands.
- Rename terminal windows, edit startup directory (`cwd`), and manage independent sessions.

### 3. Claude Code AI Assistant
- Webview-style UI inspired by the official Claude Code VS Code / code-server extension.
- Connects to the real Claude CLI (`claude -p`) with realtime streaming of thinking and execution cards.
- Supports model switching (`Sonnet`, `Opus`) and effort levels (`Low`, `Medium`, `High`, `Max`).
- Shield toggle for Bypass Permissions (`--dangerously-skip-permissions`) directly in the chat input.
- Send button becomes a red Stop button and interrupts the process with `SIGINT`.
- Quick shortcuts: `⇧ Enter` for newline, `Ctrl C` for copy, `Ctrl V` for paste.

### 4. File Manager & Code Viewer
- Browse, create, rename, and delete files/folders safely.
- Markdown preview with fast toggle between preview and edit modes.
- Syntax highlighting for JavaScript, TypeScript, Python, HTML, CSS, JSON, Markdown, and Bash.

---

## 🛠️ User Systemd Service on Linux

```bash
# Start the background service
systemctl --user start hugremote

# Enable auto-start on login
systemctl --user enable hugremote

# Inspect status
systemctl --user status hugremote

# Restart
systemctl --user restart hugremote

# Stop
systemctl --user stop hugremote
```

The installer-created service binds to `127.0.0.1` by default. Edit `~/.config/systemd/user/hugremote.service` and set `Environment=HOST=0.0.0.0` or `Environment=HOST=::` only if you explicitly need external network access.

---

## 📄 License

Released under the [MIT](LICENSE) license.
