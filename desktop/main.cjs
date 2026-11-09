const { app, BrowserWindow, dialog, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

let backend;
let mainWindow;
let quitting = false;
let terminateBackend;

function quitBackend() {
  if (backend && terminateBackend) terminateBackend(backend);
}

function resolveMacLoginShellEnv(homeDir) {
  const result = {};
  if (process.platform !== 'darwin') return result;
  const userShell = process.env.SHELL || '/bin/zsh';
  try {
    const out = execFileSync(
      userShell,
      [
        '-lic',
        'printf "__HUG_ENV_START__%s__HUG_SEP__%s__HUG_ENV_END__" "$PATH" "$SSH_AUTH_SOCK"',
      ],
      {
        encoding: 'utf8',
        timeout: 2500,
        env: { ...process.env, HOME: homeDir },
        stdio: ['ignore', 'pipe', 'ignore'],
      }
    );
    const match = out.match(/__HUG_ENV_START__([\s\S]*?)__HUG_SEP__([\s\S]*?)__HUG_ENV_END__/);
    if (match) {
      if (match[1] && match[1].trim()) result.PATH = match[1].trim();
      if (match[2] && match[2].trim() && fs.existsSync(match[2].trim())) {
        result.SSH_AUTH_SOCK = match[2].trim();
      }
    }
  } catch {
    // Fallback if interactive login shell probe times out
  }
  if (!result.SSH_AUTH_SOCK) {
    try {
      const sock = execFileSync('launchctl', ['getenv', 'SSH_AUTH_SOCK'], {
        encoding: 'utf8',
        timeout: 1500,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (sock && fs.existsSync(sock)) {
        result.SSH_AUTH_SOCK = sock;
      }
    } catch {}
  }
  return result;
}

async function start() {
  if (process.platform !== 'darwin') throw new Error('This desktop build is for macOS only');
  const root = path.join(process.resourcesPath, 'hugremote');
  const runtime = path.join(process.resourcesPath, 'node', 'bin', 'node');
  const backendEntry = path.join(root, 'apps', 'api', 'dist', 'main.js');
  for (const file of [runtime, backendEntry, path.join(root, 'apps', 'api', 'public', 'index.html')]) {
    if (!fs.existsSync(file)) throw new Error(`Desktop payload is incomplete: ${file}`);
  }
  const launcher = await import(pathToFileURL(path.join(__dirname, 'launcher.mjs')).href);
  const { findFreePort, waitForServer, launchBackend } = launcher;
  terminateBackend = launcher.terminateBackend;
  const port = await findFreePort();
  const secret = crypto.randomBytes(32).toString('hex');
  const origin = `http://127.0.0.1:${port}`;
  await session.defaultSession.cookies.set({ url: origin, name: 'hugremote_desktop_session', value: secret, httpOnly: true, sameSite: 'strict', session: true });

  const homeDir = process.env.HOME || app.getPath('home') || os.homedir();
  const userInfo = os.userInfo();
  const shellEnv = resolveMacLoginShellEnv(homeDir);
  const inheritedPath = shellEnv.PATH || process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin';
  const extraPaths = [
    path.join(homeDir, '.local', 'bin'),
    path.join(homeDir, '.orbstack', 'bin'),
    path.join(homeDir, '.rd', 'bin'),
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/local/sbin',
    '/opt/local/bin',
  ];
  const mergedPath = Array.from(new Set([...extraPaths, ...inheritedPath.split(':')].filter(Boolean))).join(':');

  const backendEnv = {
    ...process.env,
    HOME: homeDir,
    USER: process.env.USER || userInfo.username,
    LOGNAME: process.env.LOGNAME || userInfo.username,
    PATH: mergedPath,
    ...(shellEnv.SSH_AUTH_SOCK ? { SSH_AUTH_SOCK: shellEnv.SSH_AUTH_SOCK } : {}),
  };

  backend = launchBackend({
    runtime,
    backendEntry,
    cwd: root,
    port,
    secret,
    env: backendEnv,
  });
  let diagnostic = '';
  for (const stream of [backend.stdout, backend.stderr]) stream.on('data', (chunk) => { diagnostic = (diagnostic + chunk.toString()).slice(-4000); });
  backend.on('exit', () => { if (!quitting) { dialog.showErrorBox('HugRemote', `Backend stopped unexpectedly.\n${diagnostic.slice(-800)}`); app.quit(); } });
  await waitForServer({ port, secret, child: backend, timeoutMs: 20000 });

  const iconPath = path.join(__dirname, 'icon.png');
  if (process.platform === 'darwin' && app.dock && fs.existsSync(iconPath)) {
    try { app.dock.setIcon(iconPath); } catch {}
  }

  const window = new BrowserWindow({
    width: 1200, height: 820, minWidth: 390, minHeight: 500,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  mainWindow = window;
  const sameOrigin = (url) => {
    try { return new URL(url).origin === origin; } catch { return false; }
  };
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url) && !sameOrigin(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!sameOrigin(url)) event.preventDefault();
  });
  window.webContents.on('will-redirect', (event, url) => {
    if (!sameOrigin(url)) event.preventDefault();
  });
  await window.loadURL(origin);
  if (process.env.HUGREMOTE_DESKTOP_SMOKE_FILE) {
    const rendered = await window.webContents.executeJavaScript(`new Promise((resolve) => {
      const ready = () => document.querySelector('#app')?.children.length > 0;
      if (ready()) return resolve(true);
      const observer = new MutationObserver(() => { if (ready()) { observer.disconnect(); resolve(true); } });
      observer.observe(document.querySelector('#app') || document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(false); }, 10000);
    })`);
    if (!rendered) throw new Error('Desktop frontend did not render');
    fs.writeFileSync(process.env.HUGREMOTE_DESKTOP_SMOKE_FILE, 'DESKTOP_GUI_READY\n');
    app.quit();
  }
}

app.on('before-quit', () => { quitting = true; quitBackend(); });
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show(); });
app.whenReady().then(start).catch((error) => {
  quitting = true;
  quitBackend();
  dialog.showErrorBox('HugRemote could not start', error.message);
  app.quit();
});
