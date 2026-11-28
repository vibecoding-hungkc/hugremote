import { BrowserWindow, ipcMain, shell, WebContentsView } from 'electron';

/**
 * Vòng 3 — AC-59: phiên trình duyệt = một `WebContentsView` native đặt đúng ô nội dung của S13.
 * Partition riêng (không chung cookie với HugRemote), sandbox, không Node. Mọi trang http(s) — Authority 2026-11-25 bỏ
 * giới hạn chỉ localhost (G-17 cũ); scheme khác (file:, javascript:…) vẫn chặn.
 */
type Bounds = { x: number; y: number; width: number; height: number };
const PARTITION = 'persist:hugremote-web';

export const allowedWebUrl = (u: string) => {
  try {
    const x = new URL(u);
    return /^https?:$/.test(x.protocol);
  } catch {
    return false;
  }
};

export function setupWebViews(win: BrowserWindow) {
  const views = new Map<string, WebContentsView>();
  const asked = new Map<string, string>(); // link renderer xin hiện lần gần nhất, theo phiên
  // tải lỗi → ẩn view (view native đè lên HTML, che mất hộp lỗi + nút Thử lại); bắt đầu tải lại → hiện lại
  const failed = new Map<string, { url: string; desc: string }>(); // phiên → link tải lỗi + lý do
  let shown: string | undefined;
  const state = (id: string, v: WebContentsView, error?: string) => {
    if (win.isDestroyed()) return;
    const wc = v.webContents;
    win.webContents.send('web:state', {
      id,
      url: wc.getURL(),
      title: wc.getTitle(),
      loading: wc.isLoading(),
      canBack: wc.navigationHistory.canGoBack(),
      canForward: wc.navigationHistory.canGoForward(),
      error,
    });
  };
  const create = (id: string) => {
    const v = new WebContentsView({ webPreferences: { partition: PARTITION, sandbox: true, nodeIntegration: false, contextIsolation: true } });
    const wc = v.webContents;
    wc.setWindowOpenHandler(({ url }) => {
      if (allowedWebUrl(url)) void wc.loadURL(url);
      else if (/^https?:\/\//.test(url)) void shell.openExternal(url);
      return { action: 'deny' };
    });
    wc.on('will-navigate', (e, url) => {
      if (!allowedWebUrl(url)) {
        e.preventDefault();
        if (/^https?:\/\//.test(url)) void shell.openExternal(url);
      }
    });
    for (const ev of ['did-navigate', 'did-navigate-in-page', 'page-title-updated', 'did-stop-loading'] as const) wc.on(ev as 'did-stop-loading', () => !failed.has(id) && state(id, v));
    wc.on('did-start-loading', () => {
      if (failed.delete(id) && shown === id) v.setVisible(true);
      state(id, v);
    });
    wc.on('did-fail-load', (_e, code, desc, url, isMain) => {
      if (!isMain || code === -3) return;
      failed.set(id, { url, desc });
      v.setVisible(false);
      state(id, v, desc);
    });
    win.contentView.addChildView(v);
    views.set(id, v);
    return v;
  };
  // Bounds đo bằng px CSS của renderer; app đang phóng to/thu nhỏ (⌘+/⌘−) thì 1px CSS ≠ 1 DIP → nhân hệ số zoom,
  // rồi kẹp trong vùng nội dung cửa sổ (Authority 2026-11-25: khung web rộng hơn app).
  const fit = (b: Bounds): Bounds => {
    const z = win.webContents.getZoomFactor();
    const [cw, ch] = win.getContentSize();
    const x = Math.max(0, Math.round(b.x * z));
    const y = Math.max(0, Math.round(b.y * z));
    return { x, y, width: Math.max(0, Math.min(Math.round(b.width * z), cw - x)), height: Math.max(0, Math.min(Math.round(b.height * z), ch - y)) };
  };

  ipcMain.handle('web:show', async (e, id: string, url: string, b: Bounds) => {
    if (e.sender !== win.webContents || !allowedWebUrl(url)) return false;
    for (const [k, other] of views) if (k !== id) other.setVisible(false); // một trang hiện một lúc
    const fresh = !views.has(id);
    const v = views.get(id) ?? create(id);
    shown = id;
    v.setBounds(fit(b));
    v.setVisible(!failed.has(id));
    // chỉ nạp khi view mới hoặc renderer xin link KHÁC lần trước (gõ thanh địa chỉ). Quay lại phiên với link đã lưu cũ
    // (trang đã đi tiếp mà chưa kịp lưu, redirect…) thì giữ nguyên trang đang mở — Authority 2026-11-26: đổi tab về là về home
    const again = !fresh && asked.get(id) === url;
    asked.set(id, url);
    // quay lại phiên đang lỗi → thử tải lại trang lỗi (server có thể đã chạy)
    const retry = again ? failed.get(id)?.url : undefined;
    if (retry) await v.webContents.loadURL(retry).catch(() => undefined);
    else if (!again && v.webContents.getURL() !== url) await v.webContents.loadURL(url).catch(() => undefined);
    state(id, v, failed.get(id)?.desc); // loadURL lỗi thì did-fail-load đã báo — đừng gửi state trống xoá hộp lỗi
    return true;
  });
  // bounds kèm hiện lại: renderer ẩn view khi có menu/hộp thoại phủ lên (view native luôn đè lên HTML), đóng menu → gửi bounds
  ipcMain.on('web:bounds', (e, id: string, b: Bounds) => {
    const v = views.get(id);
    if (e.sender !== win.webContents || !v) return;
    v.setBounds(fit(b));
    v.setVisible(!failed.has(id));
  });
  ipcMain.on('web:hide', (e, id: string) => {
    if (e.sender !== win.webContents) return;
    if (shown === id) shown = undefined;
    views.get(id)?.setVisible(false);
  });
  ipcMain.on('web:close', (e, id: string) => {
    const v = views.get(id);
    if (e.sender !== win.webContents || !v) return;
    win.contentView.removeChildView(v);
    v.webContents.close();
    views.delete(id);
    asked.delete(id);
    failed.delete(id);
  });
  ipcMain.on('web:nav', (e, id: string, action: string) => {
    const v = views.get(id);
    if (e.sender !== win.webContents || !v) return;
    const wc = v.webContents;
    if (action === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
    else if (action === 'forward' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
    // trang chưa nạp được lần nào (server chưa chạy) → lịch sử rỗng, reload() không làm gì → nạp lại đúng link
    else if (action === 'reload') {
      const u = failed.get(id)?.url || wc.getURL() || asked.get(id);
      if ((failed.has(id) || !wc.getURL()) && u) void wc.loadURL(u).catch(() => undefined);
      else wc.reload();
    }
    else if (action === 'devtools') wc.openDevTools({ mode: 'detach' });
    else if (action === 'external' && allowedWebUrl(wc.getURL())) void shell.openExternal(wc.getURL());
  });
}
