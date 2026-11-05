const { app, BrowserWindow, dialog, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

let backend;
let mainWindow;
let quitting = false;
let terminateBackend;

function quitBackend() {
  if (backend && terminateBackend) terminateBackend(backend);
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
  const inheritedPath = process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin';
  backend = launchBackend({ runtime, backendEntry, cwd: root, port, secret, env: {
    ...process.env,
    PATH: `${path.join(process.env.HOME || app.getPath('home'), '.local', 'bin')}:/opt/homebrew/bin:/usr/local/bin:${inheritedPath}`,
  } });
  let diagnostic = '';
  for (const stream of [backend.stdout, backend.stderr]) stream.on('data', (chunk) => { diagnostic = (diagnostic + chunk.toString()).slice(-4000); });
  backend.on('exit', () => { if (!quitting) { dialog.showErrorBox('HugRemote', `Backend stopped unexpectedly.\n${diagnostic.slice(-800)}`); app.quit(); } });
  await waitForServer({ port, secret, child: backend, timeoutMs: 20000 });

  const window = new BrowserWindow({
    width: 1200, height: 820, minWidth: 390, minHeight: 500,
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
