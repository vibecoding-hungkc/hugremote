import { app, BrowserWindow, Menu, MenuItemConstructorOptions, dialog, session, shell } from 'electron';
import { setupWebViews } from './webviews.js';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { ChildProcess } from 'node:child_process';
import { getMergedMacPath, resolveMacLoginShellEnv } from './shell-env.js';
import { findFreePort, launchBackend, terminateBackend, waitForServer } from './launcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let backend: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let quitting = false;

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

function getWindowStateFile(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState(): WindowState {
  try {
    const raw = fs.readFileSync(getWindowStateFile(), 'utf8');
    const data = JSON.parse(raw);
    if (data && typeof data.width === 'number' && typeof data.height === 'number') {
      return {
        width: Math.max(800, data.width),
        height: Math.max(600, data.height),
        x: typeof data.x === 'number' ? data.x : undefined,
        y: typeof data.y === 'number' ? data.y : undefined,
      };
    }
  } catch {}
  return { width: 1200, height: 800 };
}

function saveWindowState(win: BrowserWindow): void {
  try {
    if (win.isDestroyed()) return;
    const bounds = win.getBounds();
    fs.writeFileSync(getWindowStateFile(), JSON.stringify(bounds, null, 2), 'utf8');
  } catch {}
}

function quitBackend(): void {
  if (backend) {
    terminateBackend(backend);
    backend = null;
  }
}

function setupNativeMenu(): void {
  const isMac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: 'Về HugRemote' },
              { type: 'separator' },
              { role: 'services', label: 'Dịch vụ' },
              { type: 'separator' },
              { role: 'hide', label: 'Ẩn HugRemote' },
              { role: 'hideOthers', label: 'Ẩn ứng dụng khác' },
              { role: 'unhide', label: 'Hiện tất cả' },
              { type: 'separator' },
              { role: 'quit', label: 'Thoát HugRemote', accelerator: 'CommandOrControl+Q' },
            ] as MenuItemConstructorOptions[],
          },
        ]
      : []),
    {
      label: 'Chỉnh sửa',
      submenu: [
        { role: 'undo', label: 'Hoàn tác', accelerator: 'CommandOrControl+Z' },
        { role: 'redo', label: 'Làm lại', accelerator: 'Shift+CommandOrControl+Z' },
        { type: 'separator' },
        { role: 'cut', label: 'Cắt', accelerator: 'CommandOrControl+X' },
        { role: 'copy', label: 'Sao chép', accelerator: 'CommandOrControl+C' },
        { role: 'paste', label: 'Dán', accelerator: 'CommandOrControl+V' },
        { role: 'selectAll', label: 'Chọn tất cả', accelerator: 'CommandOrControl+A' },
      ],
    },
    {
      label: 'Xem',
      submenu: [
        { role: 'reload', label: 'Tải lại', accelerator: 'CommandOrControl+R' },
        { role: 'forceReload', label: 'Tải lại bắt buộc', accelerator: 'Shift+CommandOrControl+R' },
        { role: 'toggleDevTools', label: 'Công cụ nhà phát triển', accelerator: 'Alt+CommandOrControl+I' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Kích thước chuẩn', accelerator: 'CommandOrControl+0' },
        { role: 'zoomIn', label: 'Phóng to', accelerator: 'CommandOrControl+Plus' },
        { role: 'zoomOut', label: 'Thu nhỏ', accelerator: 'CommandOrControl+-' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toàn màn hình', accelerator: 'Control+CommandOrControl+F' },
      ],
    },
    {
      label: 'Cửa sổ',
      submenu: [
        { role: 'minimize', label: 'Thu nhỏ', accelerator: 'CommandOrControl+M' },
        { role: 'zoom', label: 'Phóng to thu nhỏ' },
        { role: 'close', label: 'Đóng cửa sổ', accelerator: 'CommandOrControl+W' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function resolveAppPaths(): {
  runtime: string;
  backendEntry: string;
  webDist: string;
  cwd: string;
  iconPath: string;
} {
  const isPackaged = app.isPackaged;
  if (isPackaged) {
    const resources = process.resourcesPath;
    const runtime = process.execPath;
    const payload = path.join(resources, 'hugremote');
    const backendCandidates = [
      path.join(payload, 'apps', 'api', 'dist', 'main.js'),
      path.join(payload, 'dist', 'main.js'),
    ];
    const backendEntry = backendCandidates.find((f) => fs.existsSync(f)) || backendCandidates[0];
    const cwd = path.dirname(path.dirname(backendEntry));
    const webDist = path.join(payload, 'apps', 'web', 'dist');
    const iconCandidates = [
      path.join(resources, 'icon.png'),
      path.join(resources, 'app', 'resources', 'icon.png'),
    ];
    const iconPath = iconCandidates.find((f) => fs.existsSync(f)) || iconCandidates[0];
    return { runtime, backendEntry, webDist, cwd, iconPath };
  }

  // Development mode: relative to current directory
  const rootDir = path.resolve(__dirname, '..', '..', '..');
  // Dev: module native của apps/api build cho Node hệ thống, không chạy được trong Node của Electron —
  // `HUGREMOTE_BACKEND_NODE=node` để dùng Node hệ thống (e2e desktop, DECISIONS 2026-11-25). Bản đóng gói không đổi.
  const runtime = process.env.HUGREMOTE_BACKEND_NODE || process.execPath;
  const backendEntry = path.resolve(rootDir, 'apps', 'api', 'dist', 'main.js');
  const webDist = path.resolve(rootDir, 'apps', 'web', 'dist');
  const iconPath = path.resolve(__dirname, '..', 'resources', 'icon.png');
  return { runtime, backendEntry, webDist, cwd: path.resolve(rootDir, 'apps', 'api'), iconPath };
}

async function start(): Promise<void> {
  const { runtime, backendEntry, webDist, cwd, iconPath } = resolveAppPaths();

  if (!fs.existsSync(backendEntry)) {
    throw new Error(`Không tìm thấy API entry tại: ${backendEntry}. Vui lòng chạy build trước.`);
  }

  const port = await findFreePort(8099);
  const secret = crypto.randomBytes(32).toString('hex');
  const origin = `http://127.0.0.1:${port}`;

  // Cài đặt cookie bí mật loopback cho BrowserWindow (AC-51)
  await session.defaultSession.cookies.set({
    url: origin,
    name: 'hugremote_desktop_token',
    value: secret,
    httpOnly: true,
    sameSite: 'strict',
  });

  const homeDir = process.env.HOME || app.getPath('home') || os.homedir();
  const userInfo = os.userInfo();
  const shellEnv = resolveMacLoginShellEnv(homeDir);
  const mergedPath = getMergedMacPath(homeDir);

  const backendEnv: NodeJS.ProcessEnv = {
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
    cwd,
    port,
    secret,
    webDist: fs.existsSync(webDist) ? webDist : undefined,
    env: backendEnv,
  });

  let diagnostic = '';
  backend.stdout?.on('data', (chunk) => {
    diagnostic = (diagnostic + chunk.toString()).slice(-4000);
  });
  backend.stderr?.on('data', (chunk) => {
    diagnostic = (diagnostic + chunk.toString()).slice(-4000);
  });

  backend.on('exit', (code, signal) => {
    if (!quitting) {
      dialog.showErrorBox(
        'HugRemote',
        `Dịch vụ nền dừng đột ngột (code ${code ?? signal}).\n${diagnostic.slice(-800)}`,
      );
      app.quit();
    }
  });

  await waitForServer({ port, child: backend, timeoutMs: 25000 });

  // Đặt Dock icon trên macOS (AC-50)
  if (process.platform === 'darwin' && app.dock && fs.existsSync(iconPath)) {
    try {
      app.dock.setIcon(iconPath);
    } catch {}
  }

  setupNativeMenu();

  const windowState = loadWindowState();
  const window = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 390,
    minHeight: 500,
    title: 'HugRemote',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  mainWindow = window;
  setupWebViews(window);

  window.on('resize', () => saveWindowState(window));
  window.on('move', () => saveWindowState(window));
  window.on('close', () => saveWindowState(window));

  const sameOrigin = (urlStr: string): boolean => {
    try {
      return new URL(urlStr).origin === origin;
    } catch {
      return false;
    }
  };

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url) && !sameOrigin(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (!sameOrigin(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  await window.loadURL(origin);

  // Hỗ trợ kiểm thử smoke test tự động
  if (process.env.HUGREMOTE_DESKTOP_SMOKE_FILE) {
    const rendered = await window.webContents.executeJavaScript(`new Promise((resolve) => {
      const ready = () => (document.querySelector('#root') || document.querySelector('#app') || document.body)?.children.length > 0;
      if (ready()) return resolve(true);
      const observer = new MutationObserver(() => {
        if (ready()) { observer.disconnect(); resolve(true); }
      });
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(false); }, 10000);
    })`);

    if (!rendered) throw new Error('Desktop web interface did not render');
    fs.writeFileSync(process.env.HUGREMOTE_DESKTOP_SMOKE_FILE, 'DESKTOP_GUI_READY\n', 'utf8');
    app.quit();
  }
}

app.on('before-quit', () => {
  quitting = true;
  quitBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
  }
});

app.whenReady()
  .then(start)
  .catch((err) => {
    quitting = true;
    quitBackend();
    dialog.showErrorBox('Không thể khởi động HugRemote', err.message);
    app.quit();
  });
