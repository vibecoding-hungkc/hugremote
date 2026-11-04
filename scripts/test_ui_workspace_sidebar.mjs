import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';

let failed = false;
async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failed = true;
    console.error(`FAIL ${name}\n`, err);
  }
}

const root = fileURLToPath(new URL('../apps/web', import.meta.url));
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { documentElement: { lang: 'vi' } };
const vite = await createServer({
  root,
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});

try {
  const { default: SmartHeader } = await vite.ssrLoadModule('/src/components/SmartHeader.vue');
  const { default: WorkspaceSidebar } = await vite.ssrLoadModule('/src/components/WorkspaceSidebar.vue');
  const { useServerStore } = await vite.ssrLoadModule('/src/stores/serverStore.ts');
  const { useProjectStore } = await vite.ssrLoadModule('/src/stores/projectStore.ts');
  const { useTerminalStore } = await vite.ssrLoadModule('/src/stores/terminalStore.ts');
  const { useClaudeStore } = await vite.ssrLoadModule('/src/stores/claudeStore.ts');

  await test('AC-1: SmartHeader renders .btn-workspace-sidebar-toggle next to session dropdown in both Terminal and Claude tabs', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const termApp = createSSRApp(SmartHeader, {
      activeTab: 'terminal',
      workspaceSidebarOpen: true,
    });
    termApp.use(pinia);
    const termHtml = await renderToString(termApp);
    assert.match(termHtml, /id="btn-toggle-workspace-left-term"/);
    assert.match(termHtml, /class="btn-workspace-sidebar-toggle"/);
    assert.match(termHtml, /data-workspace-sidebar-toggle/);
    assert.match(termHtml, /aria-expanded="true"/);
    assert.match(termHtml, /class="term-session-pill"/);

    const claudeApp = createSSRApp(SmartHeader, {
      activeTab: 'claude',
      workspaceSidebarOpen: false,
    });
    claudeApp.use(pinia);
    const claudeHtml = await renderToString(claudeApp);
    assert.match(claudeHtml, /id="btn-toggle-workspace-left-claude"/);
    assert.match(claudeHtml, /class="btn-workspace-sidebar-toggle"/);
    assert.match(claudeHtml, /aria-expanded="false"/);
    assert.match(claudeHtml, /class="claude-session-pill"/);
  });

  await test('AC-2 & AC-3: WorkspaceSidebar renders Projects, Terminal sessions, and Claude sessions scoped to active Project', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const serverStore = useServerStore();
    const projectStore = useProjectStore();
    const terminalStore = useTerminalStore();
    const claudeStore = useClaudeStore();

    const srvId = serverStore.currentServerId;
    projectStore.projects = [
      { id: 'proj-a', serverId: srvId, name: 'hugcode', rootPath: '/home/user/hugcode', lastOpenedAt: 100 },
      { id: 'proj-b', serverId: srvId, name: 'hugremote', rootPath: '/home/user/hugremote', lastOpenedAt: 200 },
    ];
    projectStore.activeProjectIdByServer[srvId] = 'proj-a';

    terminalStore.sessions = [
      { id: 'term-a1', serverId: srvId, projectId: 'proj-a', name: 'hugcode-shell', cwd: '/home/user/hugcode', type: 'local' },
      { id: 'term-b1', serverId: srvId, projectId: 'proj-b', name: 'hugremote-dev', cwd: '/home/user/hugremote', type: 'local' },
    ];
    terminalStore.activeSessionId = 'term-a1';

    claudeStore.sessions = [
      {
        id: 'claude-a1',
        serverId: srvId,
        projectId: 'proj-a',
        name: 'claude-hugcode-session',
        cwd: '/home/user/hugcode',
        model: 'sonnet',
        effort: 'medium',
        permissionMode: 'auto',
        messages: [],
        isStreaming: false,
        statusText: '',
        source: 'in-app',
      },
      {
        id: 'claude-b1',
        serverId: srvId,
        projectId: 'proj-b',
        name: 'claude-hugremote-session',
        cwd: '/home/user/hugremote',
        model: 'opus',
        effort: 'high',
        permissionMode: 'auto',
        messages: [],
        isStreaming: false,
        statusText: '',
        source: 'in-app',
      },
    ];
    claudeStore.activeSessionId = 'claude-a1';

    // Render with Project A active
    const appA = createSSRApp(WorkspaceSidebar, { isOpen: true });
    appA.use(pinia);
    const htmlA = await renderToString(appA);

    assert.match(htmlA, /id="desktop-workspace-sidebar"/);
    assert.match(htmlA, /desktop-workspace-sidebar/);
    assert.match(htmlA, /id="workspace-sidebar-backdrop"/);
    assert.match(htmlA, /workspace-sidebar-backdrop/);
    assert.match(htmlA, /hugcode-shell/);
    assert.doesNotMatch(htmlA, /hugremote-dev/, 'Project B terminal session must not appear while Project A is active');
    assert.match(htmlA, /claude-hugcode-session/);
    assert.doesNotMatch(htmlA, /claude-hugremote-session/, 'Project B claude session must not appear while Project A is active');

    // Switch to Project B and verify sessions switch to Project B
    projectStore.activeProjectIdByServer[srvId] = 'proj-b';
    terminalStore.activeSessionId = 'term-b1';
    claudeStore.activeSessionId = 'claude-b1';

    const appB = createSSRApp(WorkspaceSidebar, { isOpen: true });
    appB.use(pinia);
    const htmlB = await renderToString(appB);

    assert.match(htmlB, /hugremote-dev/);
    assert.doesNotMatch(htmlB, /hugcode-shell/, 'Project A terminal session must not appear while Project B is active');
    assert.match(htmlB, /claude-hugremote-session/);
    assert.doesNotMatch(htmlB, /claude-hugcode-session/, 'Project A claude session must not appear while Project B is active');
  });

  await test('AC-5: Workspace rows display only names in the app and prototype', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const serverStore = useServerStore();
    const projectStore = useProjectStore();
    const terminalStore = useTerminalStore();
    const claudeStore = useClaudeStore();
    const serverId = serverStore.currentServerId;
    projectStore.projects = [{ id: 'name-only-project', serverId, name: 'My Project', rootPath: '/private/secret/project', lastOpenedAt: 100 }];
    projectStore.activeProjectIdByServer[serverId] = 'name-only-project';
    terminalStore.sessions = [{ id: 'name-only-term', serverId, projectId: 'name-only-project', name: 'Terminal A', cwd: '/private/secret/terminal', type: 'local' }];
    terminalStore.activeSessionId = 'name-only-term';
    claudeStore.sessions = [{ id: 'name-only-claude', serverId, projectId: 'name-only-project', name: 'Claude A', cwd: '/private/secret/claude', model: 'sonnet', messages: [], source: 'in-app' }];
    claudeStore.activeSessionId = 'name-only-claude';
    const app = createSSRApp(WorkspaceSidebar, { isOpen: true });
    app.use(pinia);
    const html = await renderToString(app);
    for (const name of ['My Project', 'Terminal A', 'Claude A']) assert.match(html, new RegExp(name));
    assert.doesNotMatch(html, /\/private\/secret\//, 'Workspace must not render file paths even in title attributes');
    assert.doesNotMatch(html, /class="dw-item-sub"/, 'Workspace rows must have only one text line');

    const prototype = fs.readFileSync(fileURLToPath(new URL('../analysis/prototypes/prototype.html', import.meta.url)), 'utf8');
    assert.doesNotMatch(prototype, /<div class="dw-item-sub">/, 'prototype rows must have only one text line');
  });

  await test('AC-4: Prototype HTML stays synchronized with Left Workspace Sidebar toggle and project-scoped sessions', async () => {
    const protoPath = fileURLToPath(new URL('../analysis/prototypes/prototype.html', import.meta.url));
    const protoHtml = fs.readFileSync(protoPath, 'utf8');
    assert.match(protoHtml, /id="btn-toggle-workspace-left-term"/);
    assert.match(protoHtml, /id="btn-toggle-workspace-left-claude"/);
    assert.match(protoHtml, /id="desktop-workspace-sidebar"/);
    assert.match(protoHtml, /id="workspace-sidebar-backdrop"/);
    assert.match(protoHtml, /function activateProjectScope\(/);
    assert.match(protoHtml, /termByProject/);
    assert.match(protoHtml, /claudeByProject/);
    assert.match(protoHtml, /const workspaceSidebarEl = document\.getElementById\('desktop-workspace-sidebar'\)/);
    assert.match(protoHtml, /data-dw-layout-btn="section-groups"/);
  });
} finally {
  await vite.close();
}

if (failed) {
  process.exit(1);
}
