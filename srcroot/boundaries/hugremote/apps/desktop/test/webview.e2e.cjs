// Vòng 3 — AC-59: phiên trình duyệt trong app desktop thật (Electron), chạy được không cần màn hình
// (`--ozone-platform=headless`). Kiểm: preload CJS phơi `window.hugremoteDesktop`, WebContentsView tải đúng trang
// localhost, điều hướng ra ngoài bị chặn (G-17), đóng phiên gỡ webview.
//   pnpm --filter @app/desktop build && node apps/desktop/test/webview.e2e.cjs
const { _electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const DESK = path.resolve(__dirname, '..');
const ELECTRON = require(path.join(DESK, 'node_modules/electron'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hr-web-'));

(async () => {
  const site = http.createServer((_q, s) => s.end('<title>demo-api</title><h1 id="h">hr-webview-ok</h1><a id="out" href="http://example.com/">ra ngoài</a>')).listen(0, '127.0.0.1');
  await new Promise((r) => site.once('listening', r));
  const sitePort = site.address().port;

  const app = await _electron.launch({
    executablePath: ELECTRON,
    args: [path.join(DESK, 'dist/main.js'), '--ozone-platform=headless', '--disable-gpu', '--no-sandbox'],
    env: { ...process.env, HUGREMOTE_BACKEND_NODE: process.execPath, DATA_DIR: path.join(tmp, 'data'), AUTH_PASSWORD: 'matkhau-khoi-tao-ban-dau', SSH_CONFIG_PATH: path.join(tmp, 'ssh_config'), HOME: tmp },
    timeout: 60_000,
  });
  let ok = false;
  const log = [];
  app.process().stdout?.on('data', (d) => log.push(String(d)));
  app.process().stderr?.on('data', (d) => log.push(String(d)));
  try {
    console.log('· app đã chạy');
    const win = await app.firstWindow();
    console.log('· có cửa sổ');
    await win.waitForLoadState('domcontentloaded');
    // link ra ngoài không được mở trình duyệt thật trong lúc test
    await app.evaluate(({ shell }) => { global.__opened = []; shell.openExternal = async (u) => void global.__opened.push(u); });
    await win.waitForFunction(() => !!window.hugremoteDesktop, null, { timeout: 30_000 });
    assert.equal(await win.evaluate(() => typeof window.hugremoteDesktop.web.show), 'function', 'preload chưa phơi cầu nối');
    console.log('· preload OK');

    // phiên đăng nhập desktop (loopback) → token để gọi API
    const setup = await win.evaluate(async (sitePort) => {
      const j = (r) => r.json();
      const s = await fetch('/api/auth/desktop-session', { method: 'POST' }).then(j);
      const h = { 'content-type': 'application/json', authorization: `Bearer ${s.accessToken}` };
      const home = (await fetch('/api/hosts/local/projects', { headers: h }).then(j)).find((p) => p.isHome);
      const w = await fetch(`/api/projects/${home.id}/web-sessions`, { method: 'POST', headers: h, body: JSON.stringify({ url: `http://localhost:${sitePort}/` }) }).then(j);
      const bad = await fetch(`/api/projects/${home.id}/web-sessions`, { method: 'POST', headers: h, body: JSON.stringify({ url: 'http://example.com/' }) });
      return { home: home.id, w, badStatus: bad.status };
    }, sitePort);
    assert.equal(setup.badStatus, 400, 'domain ngoài phải bị chặn ở API');
    assert.equal(setup.w.name, `localhost:${sitePort}`);
    console.log('· API phiên trình duyệt OK');

    await win.evaluate(({ home, id }) => (location.hash = `#/s/local/p/${home}/web/${id}`), { home: setup.home, id: setup.w.id });
    const viewText = async () =>
      app.evaluate(async ({ BrowserWindow }) => {
        const v = BrowserWindow.getAllWindows()[0].contentView.children.find((c) => c.webContents);
        if (!v) return null;
        return { url: v.webContents.getURL(), visible: v.getVisible(), bounds: v.getBounds(), text: await v.webContents.executeJavaScript('document.body?.innerText ?? ""').catch(() => '') };
      });
    let st = null;
    for (let i = 0; i < 60 && !(st && /hr-webview-ok/.test(st.text)); i++) {
      await new Promise((r) => setTimeout(r, 250));
      st = await viewText();
    }
    assert.ok(st && /hr-webview-ok/.test(st.text), `webview chưa tải trang: ${JSON.stringify(st)}`);
    assert.equal(st.visible, true);
    assert.ok(st.bounds.width > 200 && st.bounds.height > 200, `webview không nằm đúng ô: ${JSON.stringify(st.bounds)}`);

    // điều hướng ra ngoài bị chặn, mở bằng trình duyệt mặc định (đã stub)
    await app.evaluate(async ({ BrowserWindow }) => {
      const v = BrowserWindow.getAllWindows()[0].contentView.children.find((c) => c.webContents);
      await v.webContents.executeJavaScript('document.getElementById("out").click()');
    });
    await new Promise((r) => setTimeout(r, 800));
    st = await viewText();
    assert.equal(new URL(st.url).port, String(sitePort), `webview bị đưa ra ngoài: ${st.url}`);
    assert.deepEqual(await app.evaluate(() => global.__opened), ['http://example.com/']);

    // rời trang → ẩn webview
    await win.evaluate((home) => (location.hash = `#/s/local/p/${home}/files`), setup.home);
    await new Promise((r) => setTimeout(r, 800));
    assert.equal((await viewText()).visible, false, 'rời phiên trình duyệt mà webview vẫn hiện');

    // Authority 2026-11-28: nút Tải lại không chạy khi trang chưa tải được lần nào (server chưa bật) — lịch sử rỗng,
    // reload() không làm gì; view native còn che hộp lỗi. Server bật rồi bấm Tải lại → phải ra trang.
    const free = await new Promise((r) => { const s = http.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
    const w2 = await win.evaluate(async ({ home, free }) => {
      const s = await fetch('/api/auth/desktop-session', { method: 'POST' }).then((r) => r.json());
      const h = { 'content-type': 'application/json', authorization: `Bearer ${s.accessToken}` };
      return fetch(`/api/projects/${home}/web-sessions`, { method: 'POST', headers: h, body: JSON.stringify({ url: `http://localhost:${free}/` }) }).then((r) => r.json());
    }, { home: setup.home, free });
    await win.evaluate(({ home, id }) => (location.hash = `#/s/local/p/${home}/web/${id}`), { home: setup.home, id: w2.id });
    const viewOf = (url) =>
      app.evaluate(async ({ BrowserWindow }, url) => {
        const v = BrowserWindow.getAllWindows()[0].contentView.children.find((c) => c.webContents && (c.webContents.getURL().startsWith(url) || c.getVisible() === false));
        return v ? { visible: v.getVisible(), url: v.webContents.getURL(), text: await v.webContents.executeJavaScript('document.body?.innerText ?? ""').catch(() => '') } : null;
      }, url);
    await win.getByText(`Không mở được http://localhost:${free}/`).waitFor({ timeout: 15_000 });
    const hidden = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.filter((c) => c.webContents && c.getVisible()).length);
    assert.equal(hidden, 0, 'trang lỗi mà view native vẫn hiện, che hộp lỗi');
    const site2 = http.createServer((_q, s) => s.end('<h1>hr-reload-ok</h1>')).listen(free, '127.0.0.1');
    await new Promise((r) => site2.once('listening', r));
    await win.getByRole('button', { name: 'Tải lại' }).first().click();
    let r2 = null;
    for (let i = 0; i < 40 && !(r2 && /hr-reload-ok/.test(r2.text)); i++) {
      await new Promise((r) => setTimeout(r, 250));
      r2 = await viewOf(`http://localhost:${free}`);
    }
    site2.close();
    assert.ok(r2 && /hr-reload-ok/.test(r2.text) && r2.visible, `Tải lại không ra trang: ${JSON.stringify(r2)}`);
    assert.equal(await win.getByText(`Không mở được http://localhost:${free}/`).count(), 0, 'tải lại được mà hộp lỗi vẫn còn');
    console.log('✔ Tải lại sau khi trang lỗi: hộp lỗi hiện (view ẩn), bật server + Tải lại → ra trang');
    ok = true;
    console.log('✔ AC-59 webview desktop: tải trang localhost, chặn domain ngoài, ẩn khi rời phiên');
  } catch (e) {
    console.error(log.join('').slice(-3000));
    throw e;
  } finally {
    await app.close().catch(() => undefined);
    site.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    process.exitCode = ok ? 0 : 1;
  }
})().catch((e) => {
  console.error('✖', e.message);
  process.exitCode = 1;
});
