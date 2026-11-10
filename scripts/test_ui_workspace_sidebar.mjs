import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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

    // Render with Project A active and Terminal tab active
    const appA = createSSRApp(WorkspaceSidebar, { isOpen: true, activeTab: 'terminal' });
    appA.use(pinia);
    const htmlA = await renderToString(appA);

    assert.match(htmlA, /id="desktop-workspace-sidebar"/);
    assert.match(htmlA, /desktop-workspace-sidebar/);
    assert.match(htmlA, /id="workspace-sidebar-backdrop"/);
    assert.match(htmlA, /workspace-sidebar-backdrop/);
    assert.match(htmlA, /hugcode-shell/);
    assert.match(htmlA, /hugremote-dev/, 'Project B terminal must be visible under Project B');
    assert.match(htmlA, /claude-hugcode-session/);
    assert.match(htmlA, /claude-hugremote-session/, 'Project B Claude must be visible under Project B');
    assert.match(htmlA, /data-dw-project-group="proj-a"/);
    assert.match(htmlA, /data-dw-project-group="proj-b"/);
    assert.match(htmlA, /data-dw-term-project="proj-b"/);
    assert.match(htmlA, /data-dw-claude-project="proj-b"/);
    assert.doesNotMatch(htmlA, /class="dw-active-dot"/);
    assert.doesNotMatch(htmlA, /class="dw-server-active-badge"/);
    assert.match(htmlA, /data-dw-project="proj-a"[^>]*class="[^"]*\bactive\b[^"]*"|class="[^"]*\bactive\b[^"]*"[^>]*data-dw-project="proj-a"/);
    assert.match(htmlA, /data-dw-term="term-a1"[^>]*class="[^"]*\bactive\b[^"]*"|class="[^"]*\bactive\b[^"]*"[^>]*data-dw-term="term-a1"/, 'Terminal session must be active when activeTab is terminal');
    assert.doesNotMatch(htmlA, /data-dw-claude="claude-a1"[^>]*class="[^"]*\bactive\b[^"]*"|class="[^"]*\bactive\b[^"]*"[^>]*data-dw-claude="claude-a1"/, 'Claude session must NOT be active when activeTab is terminal');
    assert.doesNotMatch(htmlA, /data-dw-layout-btn|dw-item-sub/);

    // Switch to Project B and Claude tab active
    projectStore.activeProjectIdByServer[srvId] = 'proj-b';
    terminalStore.activeSessionId = 'term-b1';
    claudeStore.activeSessionId = 'claude-b1';

    const appB = createSSRApp(WorkspaceSidebar, { isOpen: true, activeTab: 'claude' });
    appB.use(pinia);
    const htmlB = await renderToString(appB);

    assert.match(htmlB, /hugremote-dev/);
    assert.match(htmlB, /hugcode-shell/, 'Project A sessions remain visible');
    assert.match(htmlB, /claude-hugremote-session/);
    assert.match(htmlB, /claude-hugcode-session/, 'Project A sessions remain visible');
    assert.doesNotMatch(htmlB, /class="dw-active-dot"/);
    assert.doesNotMatch(htmlB, /class="dw-server-active-badge"/);
    assert.match(htmlB, /data-dw-project="proj-b"[^>]*class="[^"]*\bactive\b[^"]*"|class="[^"]*\bactive\b[^"]*"[^>]*data-dw-project="proj-b"/);
    assert.doesNotMatch(htmlB, /data-dw-term="term-b1"[^>]*class="[^"]*\bactive\b[^"]*"|class="[^"]*\bactive\b[^"]*"[^>]*data-dw-term="term-b1"/, 'Terminal session must NOT be active when activeTab is claude');
    assert.match(htmlB, /data-dw-claude="claude-b1"[^>]*class="[^"]*\bactive\b[^"]*"|class="[^"]*\bactive\b[^"]*"[^>]*data-dw-claude="claude-b1"/, 'Claude session must be active when activeTab is claude');
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
    assert.doesNotMatch(protoHtml, /data-dw-layout-btn="section-groups"/);
    assert.match(protoHtml, /id="dw-workspace-resize"/);
  });

  await test('AC-6: Workspace resizer and two tree guides exist without card borders', async () => {
    const source = fs.readFileSync(fileURLToPath(new URL('../apps/web/src/components/WorkspaceSidebar.vue', import.meta.url)), 'utf8');
    const app = fs.readFileSync(fileURLToPath(new URL('../apps/web/src/App.vue', import.meta.url)), 'utf8');
    assert.match(source, /id="dw-workspace-resize"/);
    assert.match(source, /@pointerdown="onResizePointerDown"/);
    assert.match(source, /@keydown="onResizeKeyDown"/);
    assert.match(app, /--workspace-sidebar-width/);
    assert.match(source, /\.dw-list\s*\{[^}]*border-left:/);
    assert.match(source, /\.dw-session-list\s*\{[^}]*border-left:/);
    assert.doesNotMatch(source, /\.dw-item\s*\{[^}]*border:\s*1px/);
    assert.match(source, /ri-folder-2-line['"][^>]*style="color:\s*#38bdf8"/);
    assert.match(source, /ri-terminal-box-line"[^>]*style="color:\s*#c084fc"/);
    assert.match(source, /ri-sparkling-fill"[^>]*style="color:\s*#f59e0b"/);
  });

  await test('AC-7: Selecting sessions in another Project selects its scope first', async () => {
    const source = fs.readFileSync(fileURLToPath(new URL('../apps/web/src/components/WorkspaceSidebar.vue', import.meta.url)), 'utf8');
    assert.match(source, /async function handleSelectTerminal\(session: TerminalSessionItem\)/);
    assert.match(source, /async function handleSelectClaude\(session: ClaudeSession\)/);
    assert.match(source, /await selectProjectScope\(session\.projectId/);
    assert.match(source, /async function handleEditTerminal\(session: TerminalSessionItem\)/);
    assert.match(source, /async function handleEditClaude\(session: ClaudeSession\)/);
    assert.match(source, /async function handleDeleteClaude\(session: ClaudeSession\)/);
    assert.match(source, /sessionsForProject\(session\.projectId,\s*'',\s*'terminal'\)\.length <= 1/);
    assert.match(source, /claudeStore\.sessions\.map\(s => `\$\{s\.id\}:\$\{s\.name\}/);
  });

  await test('AC-8: Claude session name sync (--name CLI flag) and Workspace running state with Stop button', async () => {
    const claudeServiceSource = fs.readFileSync(
      fileURLToPath(new URL('../apps/api/src/services/claudeService.ts', import.meta.url)),
      'utf8'
    );
    assert.match(
      claudeServiceSource,
      /args\.push\('--name',\s*cleanSessionName\)/,
      'ClaudeService must pass --name <session.name> when spawning claude CLI'
    );
    assert.match(
      claudeServiceSource,
      /this\.renameProjectSession\(session\.cliSessionId,\s*session\.name/,
      'ClaudeService.updateSession must sync renamed session to bound CLI project session'
    );

    const pinia = createPinia();
    setActivePinia(pinia);
    const serverStore = useServerStore();
    const projectStore = useProjectStore();
    const claudeStore = useClaudeStore();
    const srvId = serverStore.currentServerId;

    projectStore.projects = [
      { id: 'proj-run', serverId: srvId, name: 'hugremote', rootPath: '/home/user/hugremote', lastOpenedAt: 100 },
    ];
    projectStore.activeProjectIdByServer[srvId] = 'proj-run';

    claudeStore.sessions = [
      {
        id: 'claude-run-1',
        serverId: srvId,
        projectId: 'proj-run',
        name: 'chat',
        isCustomNamed: true,
        cliSessionId: 'cli-uuid-1',
        cwd: '/home/user/hugremote',
        model: 'Default Medium',
        mode: 'Auto',
        messages: [],
        isRunning: true,
      },
      {
        id: 'claude-idle-2',
        serverId: srvId,
        projectId: 'proj-run',
        name: 'Backend Refactor',
        isCustomNamed: true,
        cliSessionId: 'cli-uuid-2',
        cwd: '/home/user/hugremote',
        model: 'Default Medium',
        mode: 'Auto',
        messages: [],
        isRunning: false,
      },
    ];
    claudeStore.projectSessions = [
      { id: 'cli-uuid-1', summary: 'Prompt text should not overwrite chat name', userMsgs: 1, asstMsgs: 1, model: 'sonnet', updatedAt: 100, size: 10 },
    ];
    claudeStore.activeSessionId = 'claude-run-1';

    const headerApp = createSSRApp(SmartHeader, { activeTab: 'claude', workspaceSidebarOpen: true });
    headerApp.use(pinia);
    const headerHtml = await renderToString(headerApp);
    assert.match(headerHtml, /class="claude-session-pill"[^>]*>[\s\S]*?<span>chat<\/span>/, 'SmartHeader must keep configured session name even when named chat');

    const wsApp = createSSRApp(WorkspaceSidebar, { isOpen: true });
    wsApp.use(pinia);
    const wsHtml = await renderToString(wsApp);
    assert.match(wsHtml, /data-dw-claude="claude-run-1"[^>]*class="[^"]*running[^"]*"|class="[^"]*running[^"]*"[^>]*data-dw-claude="claude-run-1"/);
    assert.match(wsHtml, /class="dw-claude-running status-indicator"/);
    assert.doesNotMatch(wsHtml, /btn-dw-claude-stop/);
    assert.equal((wsHtml.match(/class="dw-claude-running status-indicator"/g) || []).length, 1, 'Only running Claude session should render running indicator');
  });

  await test('AC-9: WorkspaceSidebar supports adding and displaying multiple servers simultaneously in the Workspace tree', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const serverStore = useServerStore();
    const projectStore = useProjectStore();
    const terminalStore = useTerminalStore();
    const claudeStore = useClaudeStore();

    serverStore.servers = [
      { id: 'server-local', name: 'localhost', type: 'local', label: 'Local', host: '127.0.0.1', user: '', port: 22, isConnected: true },
      { id: 'server-prod', name: 'prod-api-01', type: 'ssh', label: 'Prod API', host: '203.0.113.10', user: 'ubuntu', port: 22, isConnected: true },
      { id: 'server-gpu', name: 'gpu-worker', type: 'ssh', label: 'GPU Worker', host: '203.0.113.11', user: 'root', port: 22, isConnected: false },
    ];
    serverStore.currentServerId = 'server-local';
    serverStore.addServerToWorkspace('server-prod');

    assert.equal(serverStore.workspaceServers.length, 2, 'Two servers must be present in workspaceServers');
    assert.equal(serverStore.availableServersToAdd.length, 1, 'One server remains available to add');
    assert.equal(serverStore.availableServersToAdd[0].id, 'server-gpu');

    projectStore.projects = [
      { id: 'proj-local-1', serverId: 'server-local', name: 'local-app', rootPath: '/home/u/local-app', lastOpenedAt: 100 },
      { id: 'proj-prod-1', serverId: 'server-prod', name: 'prod-service', rootPath: '/srv/prod-service', lastOpenedAt: 200 },
    ];
    projectStore.activeProjectIdByServer['server-local'] = 'proj-local-1';
    projectStore.activeProjectIdByServer['server-prod'] = 'proj-prod-1';

    terminalStore.sessions = [
      { id: 'term-local-1', serverId: 'server-local', projectId: 'proj-local-1', name: 'local-shell', cwd: '/home/u/local-app' },
      { id: 'term-prod-1', serverId: 'server-prod', projectId: 'proj-prod-1', name: 'prod-logs', cwd: '/srv/prod-service' },
    ];
    claudeStore.sessions = [
      { id: 'claude-local-1', serverId: 'server-local', projectId: 'proj-local-1', name: 'Local Agent', cwd: '/home/u/local-app', model: 'sonnet', messages: [] },
      { id: 'claude-prod-1', serverId: 'server-prod', projectId: 'proj-prod-1', name: 'Prod Agent', cwd: '/srv/prod-service', model: 'opus', messages: [], isRunning: true },
    ];

    const wsApp = createSSRApp(WorkspaceSidebar, { isOpen: true });
    wsApp.use(pinia);
    const wsHtml = await renderToString(wsApp);

    assert.match(wsHtml, /id="btn-dw-add-server"/);
    assert.match(wsHtml, /data-dw-server-group="server-local"/);
    assert.match(wsHtml, /data-dw-server-group="server-prod"/);
    assert.match(wsHtml, /localhost/);
    assert.match(wsHtml, /prod-api-01/);
    assert.match(wsHtml, /local-app/);
    assert.match(wsHtml, /prod-service/);
    assert.match(wsHtml, /local-shell/);
    assert.match(wsHtml, /prod-logs/);
    assert.match(wsHtml, /Local Agent/);
    assert.match(wsHtml, /Prod Agent/);
    assert.match(wsHtml, /btn-dw-server-remove/, 'Remove server from workspace button must render when >1 server');
  });

  await test('AC-10: SmartHeader context-row indents according to workspace sidebar and folder (quick panel) widths', async () => {
    const repoRoot = path.resolve(root, '../..');
    const smartHeaderVue = fs.readFileSync(path.resolve(repoRoot, 'apps/web/src/components/SmartHeader.vue'), 'utf8');
    const appVue = fs.readFileSync(path.resolve(repoRoot, 'apps/web/src/App.vue'), 'utf8');
    const protoHtml = fs.readFileSync(path.resolve(repoRoot, 'analysis/prototypes/prototype.html'), 'utf8');

    // SmartHeader.vue & App.vue rules
    assert.match(smartHeaderVue, /\.workspace-sidebar-open\s+\.context-row[\s\S]*?padding-left:\s*calc\(var\(--workspace-sidebar-width/);
    assert.match(smartHeaderVue, /\.quick-tree-open\s+\.context-row[\s\S]*?padding-right:\s*calc\(var\(--quick-panel-width/);
    assert.match(appVue, /\.workspace-sidebar-open\s+\.context-row[\s\S]*?padding-left:\s*calc\(var\(--workspace-sidebar-width/);
    assert.match(appVue, /\.quick-tree-open\s+\.context-row[\s\S]*?padding-right:\s*calc\(var\(--quick-panel-width/);

    // prototype.html rules
    assert.match(protoHtml, /#app\.workspace-sidebar-open\s+\.context-row[\s\S]*?padding-left:\s*calc\(var\(--workspace-sidebar-width/);
    assert.match(protoHtml, /#app\.quick-tree-open\s+\.context-row[\s\S]*?padding-right:\s*calc\(var\(--quick-panel-width/);
  });
} finally {
  await vite.close();
}

if (failed) {
  process.exit(1);
}
