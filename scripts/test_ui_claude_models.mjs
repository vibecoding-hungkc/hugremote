import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createSSRApp, createRenderer, nextTick, reactive } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createPinia, setActivePinia } from 'pinia';

// Isolated fixtures only: no API server, credentials, or persisted user data.
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { documentElement: { lang: '' } };
let respond = async () => ({ ok: true, json: async () => ({ models: [] }) });
globalThis.fetch = (url, options) => {
  assert.equal(options?.method || 'GET', 'GET');
  return respond(new URL(String(url), 'http://fixture.invalid'));
};
const nativeModels = [
  { id: 'default', title: 'Default (recommended)', desc: 'Native default (configured)', prefix: 'Default', resolvedModel: 'hermes-claude[1m]', supportsEffort: true },
  { id: 'opus', title: 'hermes-claude[1m]', desc: 'Native Opus (1M context)', prefix: 'opus', resolvedModel: 'hermes-claude[1m]', supportsEffort: true },
  { id: 'fable', title: 'Fable (preview)', desc: 'Native external model (preview)', prefix: 'fable[1m]', disabled: true },
  { id: 'sonnet', title: 'hermes-claude[1m]', desc: 'Native Sonnet', prefix: 'sonnet[1m]', resolvedModel: 'hermes-claude[1m]' },
  { id: 'haiku', title: 'hermes-claude[1m]', desc: 'Native Haiku', prefix: 'haiku' },
];
const root = fileURLToPath(new URL('../apps/web/', import.meta.url));
const vite = await createServer({ root, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
let failures = 0;
async function test(name, fn) {
  if (process.argv[2] && !name.includes(process.argv[2])) return;
  try { await fn(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.stack}`); }
}
try {
  const { default: Picker } = await vite.ssrLoadModule('/src/components/ModelSelectorPopup.vue');
  const { useClaudeStore } = await vite.ssrLoadModule('/src/stores/claudeStore.ts');
  const { useServerStore } = await vite.ssrLoadModule('/src/stores/serverStore.ts');
  function fixture() {
    const pinia = createPinia(); setActivePinia(pinia);
    const server = useServerStore(pinia);
    server.currentServerId = 'server-local';
    const claude = useClaudeStore(pinia);
    return { pinia, server, claude };
  }
  async function picker(context, values = {}) {
    const props = reactive({ isOpen: true, modelValue: 'Default Medium', serverId: 'ssh-test', ...values });
    const updates = [];
    let state;
    const app = createSSRApp({ ...Picker, setup(p, ctx) { state = Picker.setup(props, ctx); return state; } },
      { ...props, 'onUpdate:modelValue': (value) => updates.push(value) });
    app.use(context.pinia);
    await renderToString(app);
    const render = async () => {
      const app = createSSRApp({ ...Picker, setup: () => state }, { ...props });
      app.use(context.pinia);
      return renderToString(app);
    };
    return { state, props, updates, render };
  }
  await test('store has no fabricated fallback before fetch or after per-target failure', async () => {
    const { claude } = fixture();
    assert.deepEqual(claude.availableModels, []);
    respond = async () => ({ ok: true, json: async () => ({ source: 'cli', defaultModel: 'hermes-claude[1m]', models: nativeModels }) });
    await claude.fetchModels('server-local');
    assert.deepEqual(claude.availableModels, nativeModels, 'native rows and metadata remain unchanged, including duplicate labels');
    await claude.fetchModels('ssh-test');
    respond = async () => ({ ok: false, status: 503, json: async () => ({ error: 'Native CLI unavailable' }) });
    await assert.doesNotReject(claude.fetchModels('ssh-test'), 'UI-triggered fetch failures are represented as state, not rejected promises');
    assert.deepEqual(claude.modelsByServer['ssh-test'], [], 'failed refresh clears stale models');
    assert.equal(claude.modelErrorsByServer['ssh-test'], 'Native CLI unavailable');
    assert.equal(claude.defaultModelByServer['ssh-test'], '');
    assert.deepEqual(claude.availableModels, nativeModels, 'remote failure cannot erase another target');
    assert.equal(claude.modelErrorsByServer['server-local'] || '', '');
  });
  await test('loading is per target; same-context requests dedupe; newer cwd wins races', async () => {
    const { claude } = fixture();
    const pending = [];
    respond = (url) => new Promise((resolve) => pending.push({ url, resolve }));
    const finish = (index, models, ok = true) => pending[index].resolve({ ok, json: async () => ok ? { source: 'cli', models } : { error: 'Obsolete failure' } });
    const old = claude.fetchModels('ssh-test', '/old');
    const duplicate = claude.fetchModels('ssh-test', '/old');
    assert.equal(pending.length, 1, 'coalesce concurrent fetches for the same target and cwd');
    assert.equal(pending[0].url.searchParams.get('cwd'), '/old');
    assert.equal(claude.loadingModelsByServer['ssh-test'], true);
    assert.equal(claude.loadingModelsByServer['server-local'] || false, false);
    const local = claude.fetchModels('server-local', '/local');
    const newer = claude.fetchModels('ssh-test', '/new');
    assert.equal(pending.length, 3);
    finish(0, nativeModels, false);
    await Promise.all([old, duplicate]);
    assert.equal(claude.loadingModelsByServer['ssh-test'], true, 'old finally cannot stop new loading');
    assert.equal(claude.modelErrorsByServer['ssh-test'], '', 'obsolete errors cannot replace new context');
    finish(2, nativeModels);
    await newer;
    assert.equal(claude.loadingModelsByServer['ssh-test'], false);
    assert.equal(claude.loadingModelsByServer['server-local'], true);
    finish(1, []);
    await local;
    assert.deepEqual(claude.modelsByServer['ssh-test'], nativeModels);
    const refresh = claude.fetchModels('ssh-test', '/different-project');
    assert.deepEqual(claude.modelsByServer['ssh-test'], [], 'context switch immediately clears old project rows');
    assert.equal(claude.modelCwdByServer['ssh-test'], '/different-project');
    finish(3, []);
    await refresh;
    const olderSuccess = claude.fetchModels('ssh-test', '/slow');
    const latest = claude.fetchModels('ssh-test', '/fast');
    finish(5, []);
    await latest;
    finish(4, nativeModels);
    await olderSuccess;
    assert.deepEqual(claude.modelsByServer['ssh-test'], [], 'obsolete success cannot replace latest context');
  });
  await test('fetch defaults cwd only from a session on the requested target', async () => {
    const { claude, server } = fixture();
    server.servers = [{ id: 'ssh-test', name: 'Fixture', type: 'ssh', workspace: '/work/project' }];
    server.currentServerId = 'ssh-test';
    claude.sessions = [{ id: 'session', serverId: 'ssh-test', cwd: '/work/project', messages: [] }];
    claude.activeSessionId = 'session';
    const urls = [];
    respond = async (url) => { urls.push(url); return { ok: true, json: async () => ({ models: [] }) }; };
    await claude.fetchModels('ssh-test');
    await claude.fetchModels('server-local');
    assert.equal(urls[0].searchParams.get('cwd'), '/work/project');
    assert.equal(urls[1].searchParams.get('cwd'), null, 'never send another target\'s cwd');
  });
  await test('picker isolates target and cwd; loading empty error retry are explicit', async () => {
    const context = fixture();
    context.claude.modelsByServer['server-local'] = nativeModels;
    const { state, render } = await picker(context);
    assert.deepEqual(state.models.value, [], 'remote picker must never fall back to current local list');
    assert.match(await render(), /No native models available/);
    let resolve;
    respond = () => new Promise((done) => { resolve = done; });
    const loading = state.loadModels();
    assert.equal(state.isLoadingModels.value, true);
    assert.match(await render(), /Loading native models/);
    resolve({ ok: false, json: async () => ({ error: 'Remote CLI unavailable' }) });
    await loading;
    const failed = await render();
    assert.match(failed, /role="alert"/);
    assert.match(failed, /Remote CLI unavailable/);
    assert.match(failed, /<button[^>]*>[\s\S]*?Retry[\s\S]*?<\/button>/);
    respond = async () => ({ ok: true, json: async () => ({ models: nativeModels }) });
    await assert.doesNotReject(state.loadModels());
    assert.deepEqual(state.models.value, nativeModels);
    const html = await render();
    assert.match(html, /Fable \(preview\)/, 'native external labels are not normalized');
    assert.match(html, /Native external model \(preview\)/);
    assert.equal((html.match(/<button[^>]*class="[^"]*claude-model-item/g) || []).length, 5, 'native alias rows remain separate accessible buttons');
    assert.match(html, /<button[^>]*disabled[^>]*>[\s\S]*?Fable/);
    context.claude.modelCwdByServer['ssh-test'] = '/another-project';
    assert.deepEqual(state.models.value, [], 'picker hides mismatched project metadata even before watcher fetch');
  });
  await test('picker matches exact native ids and prefixes, keeps unknown selection and effort', async () => {
    const context = fixture();
    context.claude.modelsByServer['ssh-test'] = nativeModels;
    const { state, props, updates, render } = await picker(context, { modelValue: 'custom-sonnet-pro[1m] High' });
    assert.equal(state.currentModelId.value, '', 'substring aliases cannot select arbitrary models or Default');
    assert.doesNotMatch(await render(), /aria-pressed="true"/);
    state.setEffort('Max');
    assert.equal(updates.at(-1), 'custom-sonnet-pro[1m] Max', 'effort cannot reset unknown models');
    for (const value of ['default-custom High', '', 'sonnet[1m]-extra Medium', 'hermes-claude[1m] High']) {
      props.modelValue = value;
      assert.equal(state.currentModelId.value, '', `unknown value ${JSON.stringify(value)} must not select Default`);
    }
    props.modelValue = 'Default Medium';
    assert.equal(state.currentModelId.value, 'default');
    props.modelValue = 'sonnet[1m] High';
    assert.equal(state.currentModelId.value, 'sonnet');
    state.selectModel(nativeModels[3]);
    assert.equal(updates.at(-1), 'sonnet[1m] High', 'preserve native prefix including context suffix');
    state.selectModel(nativeModels[0]);
    assert.equal(updates.at(-1), 'Default High');
    const count = updates.length;
    state.selectModel(nativeModels[2]);
    assert.equal(updates.length, count, 'disabled metadata must guard the handler too');
    props.modelValue = 'opus Low';
    state.cycleEffort();
    assert.equal(updates.at(-1), 'opus Medium', 'existing effort cycle remains functional');
  });
  await test('mounted picker reloads on project cwd and explicit target changes', async () => {
    const context = fixture();
    context.server.servers = [
      { id: 'ssh-test', name: 'Fixture', type: 'ssh', workspace: '/work/one' },
      { id: 'server-local', name: 'Local', type: 'local', workspace: '/local' },
    ];
    context.server.currentServerId = 'ssh-test';
    context.claude.sessions = [{ id: 'session', serverId: 'ssh-test', cwd: '/work/one', messages: [] }];
    context.claude.activeSessionId = 'session';
    const props = reactive({ isOpen: true, modelValue: 'Default Medium', serverId: 'ssh-test' });
    const urls = [];
    respond = async (url) => { urls.push(url); return { ok: true, json: async () => ({ models: [] }) }; };
    // A null-render host exercises Vue mount/watch without DOM or browser dependencies.
    const renderer = createRenderer({
      createComment: () => ({}), createElement: () => ({}), createText: () => ({}),
      insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
      parentNode: () => null, nextSibling: () => null,
    });
    const app = renderer.createApp({ setup(_, ctx) { Picker.setup(props, ctx); return () => null; } });
    app.use(context.pinia);
    app.provide(Symbol.for('v-scx'), { modules: new Set() });
    try {
      app.mount({});
      await nextTick();
      assert.equal(urls.at(-1).searchParams.get('cwd'), '/work/one');
      context.server.servers[0].workspace = '/work/two';
      context.claude.sessions[0].cwd = '/work/two';
      await nextTick();
      assert.equal(urls.at(-1).searchParams.get('cwd'), '/work/two');
      props.serverId = 'server-local';
      await nextTick();
      assert.equal(urls.at(-1).searchParams.get('serverId'), 'server-local');
      assert.equal(urls.at(-1).searchParams.get('cwd'), null);
    } finally { app.unmount(); }
  });
} finally { await vite.close(); }
process.exitCode = failures ? 1 : 0;
