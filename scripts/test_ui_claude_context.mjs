import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createSSRApp, nextTick } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createPinia, setActivePinia } from 'pinia';

// No API server, credentials, LLM calls, or persisted user data are used.
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { documentElement: { lang: '' } };
const requests = [];
let responseFor = () => ({ entries: [], currentRel: '', parentRel: null });
globalThis.fetch = async (url, options) => {
  requests.push(String(url));
  assert.equal(options?.method || 'GET', 'GET', 'UI tests must never write live data');
  const data = responseFor(new URL(String(url), 'http://fixture.invalid'));
  return { ok: !data.error, status: data.error ? 403 : 200, json: async () => data };
};
const root = fileURLToPath(new URL('../apps/web/', import.meta.url));
const vite = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
let failures = 0;
async function test(name, fn) {
  if (process.argv[2] && !name.includes(process.argv[2])) return;
  try { await fn(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
}
try {
  const { default: ClaudeView } = await vite.ssrLoadModule('/src/components/ClaudeView.vue');
  const { useClaudeStore } = await vite.ssrLoadModule('/src/stores/claudeStore.ts');
  const { useServerStore } = await vite.ssrLoadModule('/src/stores/serverStore.ts');
  const { useProjectStore } = await vite.ssrLoadModule('/src/stores/projectStore.ts');
  async function view() {
    const pinia = createPinia(); setActivePinia(pinia);
    const server = useServerStore(pinia);
    server.servers = [{ id: 'ssh-test', name: 'Fixture', type: 'ssh', workspace: '/work/project' }];
    server.currentServerId = 'ssh-test';
    const project = useProjectStore(pinia);
    project.projects = [{ id: 'project-test', serverId: 'ssh-test', rootPath: '/work/project', name: 'Fixture' }];
    const claude = useClaudeStore(pinia);
    claude.sessions = [{ id: 'session-test', serverId: 'ssh-test', projectId: 'project-test', cwd: '/work/project', name: 'Fixture', model: 'Sonnet', messages: [] }];
    claude.activeSessionId = 'session-test';
    let state;
    const component = { ...ClaudeView, setup(props, ctx) { state = ClaudeView.setup(props, ctx); return state; } };
    const app = createSSRApp(component); app.use(pinia);
    const html = await renderToString(app);
    return { state, html, claude, server, project, pinia };
  }
  await test('/status reports selected server without sending an LLM prompt', async () => {
    const { state, claude } = await view();
    const before = requests.length;
    state.inputText.value = '/status';
    await state.handleSend();
    assert.equal(claude.activeSession.messages.length, 2);
    assert.match(claude.activeSession.messages[1].text, /Máy chủ:\*\* `ssh-test`/);
    assert.equal(requests.length, before, '/status stays local');
  });
  await test('/model uses exact native values, not description substrings or another target', async () => {
    const { state, claude } = await view();
    claude.modelsByServer['ssh-test'] = [
      { id: 'default', title: 'Default', desc: 'Custom Opus model', prefix: 'Default' },
      { id: 'opus', title: 'Team model', desc: '', prefix: 'opus' },
    ];
    claude.modelCwdByServer['ssh-test'] = '/work/project';
    const selected = [];
    claude.updateSession = async (_, value) => { selected.push(value.model); };
    claude.fetchModels = async () => ({ models: claude.modelsByServer['ssh-test'] });
    state.inputText.value = '/model opus';
    await state.handleSend();
    assert.equal(selected.at(-1), 'opus Medium');
    state.inputText.value = '/model Team/Custom-Opus-XL';
    await state.handleSend();
    assert.equal(selected.at(-1), 'Team/Custom-Opus-XL');
  });
  await test('/model keeps only the latest selection when discovery finishes in reverse order', async () => {
    const { state, claude } = await view();
    const discoveries = [];
    const selected = [];
    claude.fetchModels = () => new Promise((resolve) => discoveries.push(resolve));
    claude.updateSession = async (_, updates) => {
      selected.push(updates.model);
      Object.assign(claude.activeSession, updates);
    };
    state.inputText.value = '/model opus';
    const oldSelection = state.handleSend();
    state.inputText.value = '/model haiku';
    const newSelection = state.handleSend();
    discoveries[1]({ models: [] });
    await newSelection;
    const latestToast = state.actionToast.value;
    discoveries[0]({ models: [] });
    await oldSelection;
    assert.deepEqual(selected, ['haiku'], 'obsolete discovery must not update the selected model');
    assert.equal(claude.activeSession.model, 'haiku');
    assert.equal(state.actionToast.value, latestToast, 'obsolete selection must not replace the success toast');
    assert.deepEqual(claude.activeSession.messages.filter((m) => m.sender === 'user').map((m) => m.text), ['/model haiku']);
  });
  await test('picker selection invalidates pending /model discovery', async () => {
    const { state, claude } = await view();
    let resolveDiscovery;
    const selected = [];
    claude.fetchModels = () => new Promise((resolve) => { resolveDiscovery = resolve; });
    claude.updateSession = async (_, updates) => {
      selected.push(updates.model);
      Object.assign(claude.activeSession, updates);
    };
    state.inputText.value = '/model opus';
    const pending = state.handleSend();
    state.onModelChange('haiku High');
    resolveDiscovery({ models: [] });
    await pending;
    assert.deepEqual(selected, ['haiku High']);
    assert.equal(claude.activeSession.model, 'haiku High');
    assert.equal(state.actionToast.value, null, 'obsolete command must not announce success');
    assert.deepEqual(claude.activeSession.messages, []);
  });
  await test('/effort selection invalidates pending /model discovery even before persistence applies', async () => {
    const { state, claude } = await view();
    let resolveDiscovery;
    const selected = [];
    claude.fetchModels = () => new Promise((resolve) => { resolveDiscovery = resolve; });
    claude.updateSession = async (_, updates) => { selected.push(updates.model); };
    state.inputText.value = '/model opus';
    const pending = state.handleSend();
    state.inputText.value = '/effort high';
    await state.handleSend();
    resolveDiscovery({ models: [] });
    await pending;
    assert.deepEqual(selected, ['Sonnet High']);
    assert.equal(state.actionToast.value, null);
    assert.deepEqual(claude.activeSession.messages.filter((m) => m.sender === 'user').map((m) => m.text), ['/effort high']);
  });
  for (const [context, changeContext] of [
    ['cwd', (claude) => { claude.activeSession.cwd = '/work/other'; }],
    ['server', (claude) => { claude.activeSession.serverId = 'other-server'; }],
    ['model', (claude) => { claude.activeSession.model = 'haiku'; }],
    ['session', (claude) => {
      claude.sessions.push({ ...claude.activeSession, id: 'other-session', messages: [] });
      claude.activeSessionId = 'other-session';
    }],
  ]) {
    await test(`/model ignores discovery after ${context} context changes`, async () => {
      const { state, claude } = await view();
      let resolveDiscovery;
      const selected = [];
      claude.fetchModels = () => new Promise((resolve) => { resolveDiscovery = resolve; });
      claude.updateSession = async (_, updates) => { selected.push(updates.model); };
      state.inputText.value = '/model opus';
      const pending = state.handleSend();
      changeContext(claude);
      resolveDiscovery({ models: [] });
      await pending;
      assert.deepEqual(selected, [], 'changed context must block the obsolete update');
      assert.equal(state.actionToast.value, null);
      assert.ok(claude.sessions.every((session) => session.messages.length === 0));
    });
  }
  for (const [context, changeContext] of [
    ['picker selection', (state) => state.onModelChange('haiku High')],
    ['cwd change', (_, claude) => { claude.activeSession.cwd = '/work/other'; }],
  ]) {
    await test(`/model does not announce stale success after ${context} during persistence`, async () => {
      const { state, claude } = await view();
      let resolveUpdate;
      claude.fetchModels = async () => ({ models: [] });
      claude.updateSession = (_, updates) => {
        Object.assign(claude.activeSession, updates);
        return updates.model === 'opus' ? new Promise((resolve) => { resolveUpdate = resolve; }) : Promise.resolve();
      };
      state.inputText.value = '/model opus';
      const pending = state.handleSend();
      await nextTick();
      assert.equal(typeof resolveUpdate, 'function', 'the old operation must be waiting on persistence');
      changeContext(state, claude);
      resolveUpdate();
      await pending;
      assert.equal(state.actionToast.value, null, 'obsolete persistence must not announce success');
      assert.deepEqual(claude.activeSession.messages, []);
    });
  }
  await test('Add context is visible and inserts paths without losing multiline draft or changing CWD', async () => {
    const { state, html, claude } = await view();
    const controls = html.match(/<div class="claude-ext-controls-bar"[\s\S]*?(?=<!-- Right Controls -->)/)?.[0];
    assert.ok(controls, 'composer controls must render');
    const attachment = controls.match(/<button[^>]*claude-add-context-btn[\s\S]*?<\/button>/)?.[0];
    assert.ok(attachment, 'attachment button must remain');
    assert.match(attachment, /aria-label="Add context"/);
    assert.match(attachment, /title="Add context"/);
    assert.match(attachment, /ri-attachment-2/);
    assert.doesNotMatch(attachment, /<span|>\s*Add context\s*</, 'attachment must be icon-only');
    assert.doesNotMatch(controls, /ri-history-line|ri-dashboard-3-line/, 'duplicate history and report controls must be absent');
    assert.match(controls, /claude-context-pill/, 'context usage report entry remains');
    assert.match(controls, /ri-focus-3-line/, 'compact task toggle remains');
    state.inputText.value = 'Review this\nKeep all lines';
    const before = requests.length;
    state.openContextPicker();
    assert.equal(state.isContextPickerOpen.value, true);
    state.attachContextPath('/work/project/README.md');
    assert.equal(state.inputText.value, 'Review this\nKeep all lines @/work/project/README.md ');
    assert.equal(state.isContextPickerOpen.value, false);
    assert.equal(claude.activeSession.cwd, '/work/project');
    assert.equal(claude.activeSession.messages.length, 0);
    assert.equal(requests.length, before);
    await nextTick();
  });
  await test('compact mode still renders a partial assistant answer during generation', async () => {
    const { claude, pinia } = await view();
    claude.compactTaskMode = true;
    claude.activeSession.messages.push({ id: 'partial', sender: 'assistant', text: 'REALTIME_PARTIAL', isWorking: true, tools: [] });
    const renderApp = createSSRApp(ClaudeView); renderApp.use(pinia);
    const html = await renderToString(renderApp);
    claude.isGenerating = false;
    await nextTick();
    const message = html.match(/<div[^>]*class="claude-ext-asst-msg"[^>]*>/)?.[0];
    assert.ok(message);
    assert.doesNotMatch(message, /display:\s*none/, 'partial text must stay visible even when compact mode is enabled');
  });
  await test('picker lists selectable files and folders using the project-scoped fs API', async () => {
    const { state: parent } = await view();
    assert.ok(parent.ContextAttachmentPicker, 'ClaudeView must host its own context picker');
    const Picker = parent.ContextAttachmentPicker;
    responseFor = (url) => url.searchParams.get('path') === 'src'
      ? { currentRel: 'src', parentRel: '', entries: [{ name: 'app.ts', relPath: 'src/app.ts', isDirectory: false }] }
      : { currentRel: '', parentRel: null, entries: [
        { name: 'README.md', relPath: 'README.md', isDirectory: false },
        { name: 'src', relPath: 'src', isDirectory: true },
      ] };
    const props = { serverId: 'ssh-test', projectId: 'project-test', rootPath: '/work/project' };
    const selected = [];
    let state;
    const app = createSSRApp({ ...Picker, setup(p, ctx) { state = Picker.setup(p, ctx); return state; } },
      { ...props, onConfirm: (path) => { selected.push(path); parent.attachContextPath(path); } });
    await renderToString(app);
    await state.loadDirectory('');
    const url = new URL(requests.at(-1), 'http://fixture.invalid');
    assert.equal(url.pathname, '/api/fs');
    assert.equal(url.searchParams.get('serverId'), 'ssh-test');
    assert.equal(url.searchParams.get('projectId'), 'project-test');
    assert.equal(state.entries.value.length, 2, 'files must not be filtered out');
    let html = await renderToString(createSSRApp({ ...Picker, setup: () => state }, props));
    assert.match(html, /README.md/);
    assert.match(html, /src/);
    state.selectEntry(state.entries.value.find((entry) => !entry.isDirectory));
    state.confirmSelection();
    assert.equal(selected.at(-1), '/work/project/README.md');
    assert.equal(parent.inputText.value, '@/work/project/README.md ');
    state.selectEntry(state.entries.value.find((entry) => entry.isDirectory));
    state.confirmSelection();
    assert.equal(selected.at(-1), '/work/project/src', 'folders are attachable without navigating');
    await state.loadDirectory('src');
    assert.equal(state.currentRel.value, 'src');
    assert.equal(state.parentRel.value, '');
    assert.equal(state.entries.value[0].name, 'app.ts');
    state.selectEntry(state.entries.value[0]);
    state.confirmSelection();
    assert.equal(selected.at(-1), '/work/project/src/app.ts');
    await state.loadDirectory('');
    state.selectedPath.value = state.fullPath(state.currentRel.value);
    state.confirmSelection();
    assert.equal(selected.at(-1), '/work/project', 'the project root is attachable');
  });
  await test('picker blocks stale selection after directory errors and ignores obsolete responses', async () => {
    const { state: parent } = await view();
    const Picker = parent.ContextAttachmentPicker;
    let state;
    const selected = [];
    const props = { serverId: 'server-local', rootPath: '/work/project' };
    await renderToString(createSSRApp({ ...Picker, setup(p, ctx) { state = Picker.setup(p, ctx); return state; } },
      { ...props, onConfirm: (path) => selected.push(path) }));
    responseFor = () => ({ error: 'Permission denied' });
    state.selectedPath.value = '/work/project/old.md';
    await state.loadDirectory('private');
    assert.equal(state.error.value, 'Permission denied');
    assert.equal(state.selectedPath.value, '');
    state.confirmSelection();
    assert.deepEqual(selected, []);
    const html = await renderToString(createSSRApp({ ...Picker, setup: () => state }, props));
    assert.match(html, /role="alert"/);
    assert.match(html, /Permission denied/);
    const originalFetch = globalThis.fetch;
    let resolveOld;
    globalThis.fetch = async (url) => {
      const path = new URL(String(url), 'http://fixture.invalid').searchParams.get('path');
      const data = path === 'old' ? await new Promise((resolve) => { resolveOld = resolve; })
        : { currentRel: 'new', parentRel: '', entries: [] };
      return { ok: true, json: async () => data };
    };
    try {
      const oldRequest = state.loadDirectory('old');
      await state.loadDirectory('new');
      resolveOld({ currentRel: 'old', parentRel: '', entries: [{ name: 'stale', relPath: 'old/stale', isDirectory: false }] });
      await oldRequest;
      assert.equal(state.currentRel.value, 'new');
      assert.deepEqual(state.entries.value, []);
      assert.equal(state.loading.value, false);
    } finally { globalThis.fetch = originalFetch; }
  });
} finally { await vite.close(); }
process.exitCode = failures ? 1 : 0;
