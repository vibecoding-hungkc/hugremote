import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';

Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: () => null, setItem() {}, removeItem() {} },
  configurable: true,
});
globalThis.document = {
  documentElement: { lang: '' },
  body: { classList: { add() {}, remove() {} } },
  addEventListener() {},
  removeEventListener() {},
};
globalThis.window = {
  innerWidth: 1440,
  location: { protocol: 'http:', host: 'localhost' },
  addEventListener() {},
  removeEventListener() {},
};
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({ sessions: [] }),
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
async function test(name, run) {
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

try {
  const { default: SmartHeader } = await vite.ssrLoadModule('/src/components/SmartHeader.vue');
  const { default: ClaudeSessionHubModal } = await vite.ssrLoadModule('/src/components/ClaudeSessionHubModal.vue');
  const { useClaudeStore } = await vite.ssrLoadModule('/src/stores/claudeStore.ts');
  const { useServerStore } = await vite.ssrLoadModule('/src/stores/serverStore.ts');
  const { useProjectStore } = await vite.ssrLoadModule('/src/stores/projectStore.ts');

  await test('AC-1: SmartHeader renders icon-only folder (ri-folder-2-line) and git triggers on terminal and claude tabs', async () => {
    for (const tab of ['terminal', 'claude']) {
      const pinia = createPinia();
      setActivePinia(pinia);
      const app = createSSRApp(SmartHeader, {
        activeTab: tab,
        quickPanelOpen: true,
        quickPanelMode: tab === 'terminal' ? 'files' : 'git',
      });
      app.use(pinia);
      const html = await renderToString(app);
      assert.match(html, /data-quick-panel="files"/, `missing files trigger on ${tab}`);
      assert.match(html, /ri-folder-2-line/, `missing valid folder icon glyph on ${tab}`);
      assert.doesNotMatch(html, /ri-folder-tree-line/, `must not use broken ri-folder-tree-line on ${tab}`);
      assert.match(html, /data-quick-panel="git"/, `missing git trigger on ${tab}`);
      assert.match(html, /ri-git-branch-line/, `missing git branch icon on ${tab}`);
      if (tab === 'terminal') {
        assert.match(html, /data-quick-panel="files"[^>]*aria-expanded="true"/);
        assert.match(html, /data-quick-panel="git"[^>]*aria-expanded="false"/);
      } else {
        assert.match(html, /data-quick-panel="files"[^>]*aria-expanded="false"/);
        assert.match(html, /data-quick-panel="git"[^>]*aria-expanded="true"/);
      }
    }
  });

  await test('AC-6: SmartHeader Claude session dropdown displays user-defined session name instead of latest CLI message summary', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const serverStore = useServerStore();
    const projectStore = useProjectStore();
    const claudeStore = useClaudeStore();

    serverStore.currentServerId = 'server-local';
    projectStore.projects = [{ id: 'p-1', serverId: 'server-local', name: 'hugremote', rootPath: '/home/hungnd/projects/hugremote' }];
    projectStore.activeProjectIdByServer['server-local'] = 'p-1';

    claudeStore.sessions = [
      {
        id: 'claude-1',
        serverId: 'server-local',
        projectId: 'p-1',
        name: 'Cửa sổ chính của Hưng',
        isCustomNamed: true,
        cwd: '/home/hungnd/projects/hugremote',
        cliSessionId: 'cli-uuid-1234',
        model: 'Sonnet 4.6 Medium',
        mode: 'Auto',
        timer: '60m',
        contextTokens: '12k',
        messages: [],
        updatedAt: Date.now(),
      },
    ];
    claudeStore.activeSessionId = 'claude-1';
    claudeStore.projectSessions = [
      {
        id: 'cli-uuid-1234',
        summary: 'tôi thấy tên của của sổ claude ở dropdown đang bị hiển thị theo tin nhắn mới nhất',
        lastPrompt: 'tôi thấy tên của của sổ claude ở dropdown đang bị hiển thị theo tin nhắn mới nhất',
        model: 'sonnet',
        userMsgs: 5,
        asstMsgs: 5,
        updatedAt: Date.now(),
        size: 1024,
      },
    ];

    const app = createSSRApp(SmartHeader, {
      activeTab: 'claude',
      quickPanelOpen: false,
      quickPanelMode: 'files',
    });
    app.use(pinia);
    const html = await renderToString(app);
    assert.match(html, /Cửa sổ chính của Hưng/, 'Expected user-defined session name in Claude dropdown pill');
    assert.doesNotMatch(
      html,
      /tôi thấy tên của của sổ claude ở dropdown đang bị hiển thị theo tin nhắn mới nhất/,
      'Must not display latest CLI message summary instead of user-defined session name'
    );
  });

  await test('AC-7: ClaudeSessionHubModal puts Phiên HugRemote tab first and makes it the default active tab', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const serverStore = useServerStore();
    const projectStore = useProjectStore();
    const claudeStore = useClaudeStore();

    serverStore.currentServerId = 'server-local';
    projectStore.projects = [{ id: 'p-1', serverId: 'server-local', name: 'hugremote', rootPath: '/home/hungnd/projects/hugremote' }];
    projectStore.activeProjectIdByServer['server-local'] = 'p-1';
    claudeStore.sessions = [
      {
        id: 'claude-1',
        serverId: 'server-local',
        projectId: 'p-1',
        name: 'Phiên làm việc 1',
        isCustomNamed: true,
        cwd: '/home/hungnd/projects/hugremote',
        model: 'Sonnet 4.6 Medium',
        mode: 'Auto',
        timer: '60m',
        contextTokens: '10k',
        messages: [],
        updatedAt: Date.now(),
      },
    ];
    claudeStore.activeSessionId = 'claude-1';

    const app = createSSRApp(ClaudeSessionHubModal, { isOpen: true });
    app.use(pinia);
    const html = await renderToString(app);

    const webTabIdx = html.indexOf('Phiên HugRemote');
    const cliTabIdx = html.indexOf('Phiên Claude CLI');
    assert.ok(webTabIdx !== -1 && cliTabIdx !== -1, 'Both tabs must render');
    assert.ok(webTabIdx < cliTabIdx, 'Phiên HugRemote tab must appear BEFORE Phiên Claude CLI tab');
    assert.match(
      html,
      /<button[^>]*class="[^"]*\bactive\b[^"]*\bhub-tab\b[^"]*"[^>]*>[\s\S]*?Phiên HugRemote[\s\S]*?<\/button>/,
      'Phiên HugRemote must be the active default tab when modal opens'
    );
    assert.match(html, /Phiên làm việc 1/, 'Default open view must render HugRemote sessions list');
  });

  await test('AC-2, AC-3, AC-4, AC-5: QuickWorkspacePanel renders resize handle, expandable file tree, inline file workbench, and quick git controls', async () => {
    const { default: QuickWorkspacePanel } = await vite.ssrLoadModule('/src/components/QuickWorkspacePanel.vue');
    const { useGitStore } = await vite.ssrLoadModule('/src/stores/gitStore.ts');

    const pinia = createPinia();
    setActivePinia(pinia);
    const serverStore = useServerStore();
    const projectStore = useProjectStore();
    const gitStore = useGitStore();

    serverStore.currentServerId = 'server-local';
    projectStore.projects = [{ id: 'p-1', serverId: 'server-local', name: 'hugremote', rootPath: '/home/hungnd/projects/hugremote' }];
    projectStore.activeProjectIdByServer['server-local'] = 'p-1';
    gitStore.branch = 'feat/quick-workspace-panel';
    gitStore.files = [
      { path: 'apps/web/src/App.vue', status: 'M', staged: false, additions: 12, deletions: 2 },
      { path: 'README.md', status: 'M', staged: true, additions: 4, deletions: 0 },
    ];

    const filesApp = createSSRApp(QuickWorkspacePanel, {
      isOpen: true,
      mode: 'files',
      panelWidth: 340,
      initialEntries: [
        { name: 'src', relPath: 'src', isDirectory: true, size: 0, mtime: null, ext: '' },
        { name: 'README.md', relPath: 'README.md', isDirectory: false, size: 120, mtime: null, ext: '.md' },
      ],
      initialInlineFile: {
        path: 'README.md',
        name: 'README.md',
        content: '# HugRemote\nQuick inline edit',
        originalContent: '# HugRemote',
        dirty: true,
      },
    });
    filesApp.use(pinia);
    const filesHtml = await renderToString(filesApp);

    // AC-4: Resize handle with aria attributes
    assert.match(filesHtml, /id="quick-tree-resize"/);
    assert.match(filesHtml, /role="separator"/);
    assert.match(filesHtml, /aria-valuenow="340"/);

    // AC-2: Tree entries and valid folder icon
    assert.match(filesHtml, /id="quick-tree-list"/);
    assert.match(filesHtml, /ri-folder-2-line/);
    assert.match(filesHtml, /data-node-path="src"/);
    assert.match(filesHtml, /data-node-path="README\.md"/);

    // AC-3: Inline file workbench (view & edit in place with back button, dirty badge, eye preview button, save button)
    assert.match(filesHtml, /id="quick-file-workbench"[^>]*class="[^"]*\bopen\b/);
    assert.match(filesHtml, /id="quick-file-back"/);
    assert.match(filesHtml, /id="quick-file-save"/);
    assert.match(filesHtml, /id="quick-md-switch"/);
    assert.match(filesHtml, /id="quick-md-switch"[^>]*>[\s\S]*?ri-eye-line/, 'Eye button (ri-eye-line) must render on previewable files in edit mode');
    assert.match(filesHtml, /id="quick-code-input"/);
    assert.match(filesHtml, /Chưa lưu/);

    // AC-5: Git mode renders branch, changed files, stage/unstage/commit/pull/push controls
    const gitApp = createSSRApp(QuickWorkspacePanel, {
      isOpen: true,
      mode: 'git',
      panelWidth: 340,
    });
    gitApp.use(pinia);
    const gitHtml = await renderToString(gitApp);
    assert.match(gitHtml, /feat\/quick-workspace-panel/);
    assert.match(gitHtml, /data-git-file="apps\/web\/src\/App\.vue"/);
    assert.match(gitHtml, /id="quick-git-stage"/);
    assert.match(gitHtml, /id="quick-git-unstage"/);
    assert.match(gitHtml, /id="quick-git-commit"/);
    assert.match(gitHtml, /id="quick-git-pull"/);
    assert.match(gitHtml, /id="quick-git-push"/);
  });

  await test('AC-9: QuickWorkspacePanel supports eye button preview mode for both .md and .html files', async () => {
    const { default: QuickWorkspacePanel } = await vite.ssrLoadModule('/src/components/QuickWorkspacePanel.vue');
    const pinia = createPinia();
    setActivePinia(pinia);

    // 1. HTML file in edit mode shows eye button (ri-eye-line)
    const htmlEditApp = createSSRApp(QuickWorkspacePanel, {
      isOpen: true,
      mode: 'files',
      initialInlineFile: {
        path: 'benchmark-report.html',
        name: 'benchmark-report.html',
        content: '<!DOCTYPE html><html><body><h1>Benchmark Report</h1></body></html>',
        originalContent: '<!DOCTYPE html><html><body><h1>Benchmark Report</h1></body></html>',
        dirty: false,
      },
    });
    htmlEditApp.use(pinia);
    const htmlEditRendered = await renderToString(htmlEditApp);
    assert.match(
      htmlEditRendered,
      /id="quick-md-switch"[^>]*>[\s\S]*?ri-eye-line/,
      'HTML file in edit mode must render eye button (ri-eye-line)'
    );

    // 2. HTML file in preview mode renders sandboxed iframe (#quick-html-preview) and edit icon (ri-edit-line)
    const htmlPreviewApp = createSSRApp(QuickWorkspacePanel, {
      isOpen: true,
      mode: 'files',
      initialPreviewMode: 'preview',
      initialInlineFile: {
        path: 'benchmark-report.html',
        name: 'benchmark-report.html',
        content: '<!DOCTYPE html><html><body><h1>Benchmark Report</h1></body></html>',
        originalContent: '<!DOCTYPE html><html><body><h1>Benchmark Report</h1></body></html>',
        dirty: false,
      },
    });
    htmlPreviewApp.use(pinia);
    const htmlPreviewRendered = await renderToString(htmlPreviewApp);
    assert.match(
      htmlPreviewRendered,
      /id="quick-md-switch"[^>]*>[\s\S]*?ri-edit-line/,
      'HTML file in preview mode must show edit icon (ri-edit-line) to return to raw edit'
    );
    assert.match(
      htmlPreviewRendered,
      /<iframe[^>]*id="quick-html-preview"[^>]*sandbox="allow-scripts"[^>]*srcdoc="[^"]*Benchmark Report[^"]*"/,
      'HTML file in preview mode must render sandboxed iframe with srcdoc'
    );

    // 3. Markdown file in preview mode renders GFM markdown (#quick-md-preview) including tables
    const mdPreviewApp = createSSRApp(QuickWorkspacePanel, {
      isOpen: true,
      mode: 'files',
      initialPreviewMode: 'preview',
      initialInlineFile: {
        path: 'README.md',
        name: 'README.md',
        content: '# Readme\n\n| File | Nội dung |\n|---|---|\n| a.md | Mô tả A |',
        originalContent: '# Readme',
        dirty: false,
      },
    });
    mdPreviewApp.use(pinia);
    const mdPreviewRendered = await renderToString(mdPreviewApp);
    assert.match(
      mdPreviewRendered,
      /id="quick-md-preview"[^>]*>[\s\S]*?<table>[\s\S]*?<th>File<\/th>/,
      'Markdown file in preview mode must render GFM tables inside #quick-md-preview'
    );
  });

  await test('Markdown preview escapes raw HTML and unsafe links', async () => {
    const { default: QuickWorkspacePanel } = await vite.ssrLoadModule('/src/components/QuickWorkspacePanel.vue');
    const pinia = createPinia();
    setActivePinia(pinia);
    const app = createSSRApp(QuickWorkspacePanel, {
      isOpen: true, mode: 'files', initialPreviewMode: 'preview', initialInlineFile: {
        path: 'README.md', name: 'README.md',
        content: '<img src=x onerror=alert(1)>\n[evil](javascript:alert(1))',
        originalContent: '', dirty: true,
      },
    });
    app.use(pinia);
    const html = await renderToString(app);
    assert.match(html, /id="quick-md-preview"/);
    assert.doesNotMatch(html, /<img src=x onerror=/);
    assert.doesNotMatch(html, /href="javascript:/);
  });
} finally {
  await vite.close();
}

process.exitCode = failures ? 1 : 0;
