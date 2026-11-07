import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';

const storageMap = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
  },
  configurable: true,
});
globalThis.document = {
  documentElement: { lang: 'vi' },
  body: { classList: { add() {}, remove() {} }, appendChild() {}, removeChild() {} },
  createElement: () => ({ click() {}, style: {} }),
  addEventListener() {},
  removeEventListener() {},
};
globalThis.window = {
  innerWidth: 1440,
  location: { protocol: 'http:', host: 'localhost', hash: '#/files' },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
};
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({ sessions: [], entries: [] }),
});

const root = fileURLToPath(new URL('../apps/web/', import.meta.url));
const vite = await createServer({
  root,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
});

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${name}: ${err.message}`);
  }
}

try {
  const { VALID_TABS, parseHash } = await vite.ssrLoadModule('/src/app/router.ts');
  const { default: BottomDock } = await vite.ssrLoadModule('/src/components/BottomDock.vue');
  const { default: SmartHeader } = await vite.ssrLoadModule('/src/components/SmartHeader.vue');
  const { default: WorkspaceSidebar } = await vite.ssrLoadModule('/src/components/WorkspaceSidebar.vue');
  const { default: QuickWorkspacePanel } = await vite.ssrLoadModule('/src/components/QuickWorkspacePanel.vue');
  const { default: SettingsView } = await vite.ssrLoadModule('/src/components/SettingsView.vue');
  const { useShortcutStore } = await vite.ssrLoadModule('/src/stores/shortcutStore.ts');
  const { useServerStore } = await vite.ssrLoadModule('/src/stores/serverStore.ts');
  const { useProjectStore } = await vite.ssrLoadModule('/src/stores/projectStore.ts');
  const { useTerminalStore } = await vite.ssrLoadModule('/src/stores/terminalStore.ts');
  const { useClaudeStore } = await vite.ssrLoadModule('/src/stores/claudeStore.ts');

  await test('AC-2a: Router & BottomDock support 5th tab "settings" (#dock-item-settings) as icon-only without text label', async () => {
    assert.ok(VALID_TABS.includes('settings'), 'VALID_TABS must include settings');
    assert.equal(parseHash('#/settings').tab, 'settings');

    const pinia = createPinia();
    setActivePinia(pinia);
    const app = createSSRApp(BottomDock, { activeTab: 'settings' });
    app.use(pinia);
    const html = await renderToString(app);
    assert.match(html, /id="dock-item-settings"[^>]*class="[^"]*\bactive\b/);
    assert.match(html, /id="dock-item-settings"[\s\S]*?ri-settings-3-line/);
    const settingsBtnMatch = html.match(/<button[^>]*id="dock-item-settings"[^>]*>([\s\S]*?)<\/button>/);
    assert.ok(settingsBtnMatch, '#dock-item-settings button must exist');
    assert.doesNotMatch(settingsBtnMatch[1], /dock-label|Cài đặt/, '#dock-item-settings must be icon-only without a text label');
  });

  await test('AC-2b: SettingsView renders language selector (#settings-language-card) and shared shortcut block (#settings-shortcut-card) with 5 group rules', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const app = createSSRApp(SettingsView);
    app.use(pinia);
    const html = await renderToString(app);

    assert.match(html, /id="settings-language-card"/);
    assert.match(html, /data-locale="vi"/);
    assert.match(html, /data-locale="en"/);
    assert.match(html, /Tiếng Việt/);
    assert.match(html, /English/);

    assert.match(html, /id="settings-shortcut-card"/);
    assert.match(html, /id="shortcut-labels-toggle-btn"/);
    assert.match(html, /id="shortcut-enabled-toggle"/);
    assert.match(html, /id="btn-reset-shortcuts-default"/);
    assert.match(html, /data-shortcut-group="project"/);
    assert.match(html, /data-shortcut-group="claude"/);
    assert.match(html, /data-shortcut-group="terminal"/);
    assert.match(html, /data-shortcut-group="server"/);
    assert.match(html, /data-shortcut-group="toggleLabels"/);
    assert.doesNotMatch(html, /settings-shortcut-projects|btn-move-up|btn-move-down/);
  });

  await test('AC-3: shortcutStore & WorkspaceSidebar render thin index (1, 2...) and toggleable .dw-kbd-tag', async () => {
    storageMap.clear();
    const pinia = createPinia();
    setActivePinia(pinia);
    const serverStore = useServerStore();
    const projectStore = useProjectStore();
    const terminalStore = useTerminalStore();
    const claudeStore = useClaudeStore();
    const shortcutStore = useShortcutStore();

    const srvId = serverStore.currentServerId;
    projectStore.projects = [
      { id: 'proj-1', serverId: srvId, name: 'hugcode', rootPath: '/home/u/hugcode' },
      { id: 'proj-2', serverId: srvId, name: 'hugremote', rootPath: '/home/u/hugremote' },
    ];
    projectStore.activeProjectIdByServer[srvId] = 'proj-1';
    terminalStore.sessions = [
      { id: 'term-1', serverId: srvId, projectId: 'proj-1', name: 'main-shell', cwd: '/home/u/hugcode', type: 'local' },
      { id: 'term-2', serverId: srvId, projectId: 'proj-2', name: 'api-shell', cwd: '/home/u/hugremote', type: 'local' },
    ];
    claudeStore.sessions = [
      { id: 'claude-1', serverId: srvId, projectId: 'proj-1', name: 'Refactor UI', cwd: '/home/u/hugcode', model: 'sonnet', messages: [] },
    ];

    assert.equal(shortcutStore.showLabels, false, 'Labels must be hidden by default');
    assert.equal(shortcutStore.getItemShortcut('project', 1), 'Alt+1');
    assert.equal(shortcutStore.getItemShortcut('claude', 1), 'Alt+Shift+1');
    assert.equal(shortcutStore.getItemShortcut('terminal', 2), 'Ctrl+Alt+2');
    assert.equal(shortcutStore.getItemShortcut('server', 1), 'Ctrl+Shift+1');

    shortcutStore.toggleLabelsVisibility();
    assert.equal(shortcutStore.showLabels, true);
    shortcutStore.toggleLabelsVisibility();
    assert.equal(shortcutStore.showLabels, false);

    const wsApp = createSSRApp(WorkspaceSidebar, { isOpen: true });
    wsApp.use(pinia);
    const wsHtml = await renderToString(wsApp);

    assert.match(wsHtml, /class="dw-idx-badge"[^>]*data-proj-index="1"[^>]*>1<\/span>/);
    assert.match(wsHtml, /class="dw-idx-badge"[^>]*data-proj-index="2"[^>]*>2<\/span>/);
    assert.match(wsHtml, /class="dw-idx-badge"[^>]*data-term-index="1"[^>]*>1<\/span>/);
    assert.match(wsHtml, /class="dw-idx-badge"[^>]*data-term-index="2"[^>]*>2<\/span>/);
    assert.match(wsHtml, /class="dw-idx-badge"[^>]*data-claude-index="1"[^>]*>1<\/span>/);
    assert.match(wsHtml, /<kbd class="dw-kbd-tag"[^>]*>Alt\+1<\/kbd>/);
    assert.match(wsHtml, /<kbd class="dw-kbd-tag"[^>]*>Ctrl\+Alt\+2<\/kbd>/);

    const wsCss = fs.readFileSync(fileURLToPath(new URL('../apps/web/src/components/WorkspaceSidebar.vue', import.meta.url)), 'utf8');
    assert.match(wsCss, /\.dw-kbd-tag\s*\{[\s\S]*?display:\s*none/);
    assert.match(wsCss, /\.app-root\.shortcut-labels-visible[\s\S]*?\.dw-kbd-tag\s*\{[\s\S]*?display:\s*inline-flex/);
  });

  await test('AC-4a: SmartHeader renders Folder Sidebar trigger and Workspace Sidebar toggle on ALL 6 tabs', async () => {
    for (const tab of ['files', 'editor', 'terminal', 'claude', 'git', 'settings']) {
      const pinia = createPinia();
      setActivePinia(pinia);
      const app = createSSRApp(SmartHeader, {
        activeTab: tab,
        quickPanelOpen: true,
        quickPanelMode: 'files',
        workspaceSidebarOpen: true,
      });
      app.use(pinia);
      const html = await renderToString(app);
      assert.match(html, /data-quick-panel="files"/, `SmartHeader must render Folder Sidebar trigger on tab="${tab}"`);
      assert.match(html, /data-workspace-sidebar-toggle/, `SmartHeader must render Workspace Sidebar toggle on tab="${tab}"`);
      assert.doesNotMatch(html, /language-flag-btn/, `SmartHeader must not render LanguageSwitcher on top menu (tab="${tab}")`);
    }
  });

  await test('AC-4b: QuickWorkspacePanel renders Upload/Download toolbar, per-row Upload/Download actions, and inline file Download button', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const serverStore = useServerStore();
    const projectStore = useProjectStore();
    serverStore.currentServerId = 'server-local';
    projectStore.projects = [{ id: 'p-1', serverId: 'server-local', name: 'hugremote', rootPath: '/home/u/hugremote' }];
    projectStore.activeProjectIdByServer['server-local'] = 'p-1';

    const app = createSSRApp(QuickWorkspacePanel, {
      isOpen: true,
      mode: 'files',
      initialEntries: [
        { name: 'src', relPath: 'src', isDirectory: true, size: 0, mtime: null, ext: '' },
        { name: 'README.md', relPath: 'README.md', isDirectory: false, size: 120, mtime: null, ext: '.md' },
      ],
      initialInlineFile: {
        path: 'README.md',
        name: 'README.md',
        content: '# Hello',
        originalContent: '# Hello',
        dirty: false,
      },
    });
    app.use(pinia);
    const html = await renderToString(app);

    assert.match(html, /id="quick-tree-upload-files"/);
    assert.match(html, /id="quick-tree-upload-folder"/);
    assert.match(html, /id="quick-tree-download-zip"/);
    assert.match(html, /class="[^"]*\bquick-tree-row-upload\b/);
    assert.match(html, /class="[^"]*\bquick-tree-row-download\b/);
    assert.match(html, /id="quick-file-download"/);
    assert.match(html, /id="quick-tree-fullscreen"/);
    assert.match(html, /id="quick-file-fullscreen"/);

    const qpSource = fs.readFileSync(fileURLToPath(new URL('../apps/web/src/components/QuickWorkspacePanel.vue', import.meta.url)), 'utf8');
    assert.match(qpSource, /\.quick-tree-panel\.fullscreen\s*\{[\s\S]*?width:\s*100%\s*!important/);
  });
} finally {
  await vite.close();
}

process.exitCode = failures ? 1 : 0;
