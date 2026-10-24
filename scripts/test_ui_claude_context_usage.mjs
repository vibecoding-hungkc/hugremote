import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createSSRApp, nextTick } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createPinia, setActivePinia } from 'pinia';

// Isolated fixtures only: no API server, credentials, or persisted user data.
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { documentElement: { lang: '' } };
let requests = [];
let getQueue = [];
let respond = async () => ({ ok: true, json: async () => ({ context: null, source: 'native' }) });
let patchHandler = null;
let postHandler = null;
let deleteHandler = null;
let currentActiveStore = null;
let respectAbortSignal = true;

function resetFixture() {
  requests = [];
  getQueue = [];
  respond = async () => ({ ok: true, json: async () => ({ context: null, source: 'native' }) });
  patchHandler = null;
  postHandler = null;
  deleteHandler = null;
  currentActiveStore = null;
  respectAbortSignal = true;
}

globalThis.fetch = (url, options = {}) => {
  const method = (options?.method || 'GET').toUpperCase();
  const parsed = new URL(String(url), 'http://fixture.invalid');
  parsed.options = options;
  parsed.method = method;
  requests.push(parsed);

  if (options?.signal?.aborted) {
    return Promise.reject(new DOMException('This operation was aborted', 'AbortError'));
  }

  const wrapSignal = (promise) => {
    if (!respectAbortSignal || !options?.signal) return promise;
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        reject(new DOMException('This operation was aborted', 'AbortError'));
      };
      options.signal.addEventListener('abort', onAbort, { once: true });
      promise.then(
        (val) => { options.signal?.removeEventListener('abort', onAbort); resolve(val); },
        (err) => { options.signal?.removeEventListener('abort', onAbort); reject(err); }
      );
    });
  };

  if (method === 'PATCH') {
    if (patchHandler) return wrapSignal(Promise.resolve(patchHandler(parsed, options)));
    let body = {};
    try { body = JSON.parse(options?.body || '{}'); } catch {}
    const sId = parsed.pathname.split('/').pop();
    const existing = currentActiveStore?.sessions?.find((s) => s.id === sId) || {};
    return wrapSignal(Promise.resolve({
      ok: true,
      json: async () => ({ session: { serverId: 'server-a', cwd: '/work/a', id: sId, ...existing, ...body } }),
    }));
  }

  if (method === 'POST') {
    if (postHandler) return wrapSignal(Promise.resolve(postHandler(parsed, options)));
    let body = {};
    try { body = JSON.parse(options?.body || '{}'); } catch {}
    return wrapSignal(Promise.resolve({
      ok: true,
      json: async () => ({ session: { id: parsed.pathname.split('/').filter(Boolean).slice(-2, -1)[0] || 'session-a', ...body } }),
    }));
  }

  if (method === 'DELETE') {
    if (deleteHandler) return wrapSignal(Promise.resolve(deleteHandler(parsed, options)));
    return wrapSignal(Promise.resolve({ ok: true, json: async () => ({ success: true }) }));
  }

  assert.equal(method, 'GET', 'context usage must be a read-only request');

  if (parsed.pathname === '/api/claude/limits') {
    return wrapSignal(Promise.resolve({
      ok: true,
      json: async () => ({ limits: {
        fiveHour: { usedPercent: 1, resetIn: 'fixture' },
        weekly: { usedPercent: 2, resetIn: 'fixture' },
      } }),
    }));
  }

  if (getQueue.length > 0) {
    const next = getQueue.shift();
    return wrapSignal(Promise.resolve(typeof next === 'function' ? next(parsed, options) : next));
  }

  const custom = respond(parsed, options);
  if (custom !== undefined) {
    return wrapSignal(Promise.resolve(custom));
  }

  if (parsed.pathname === '/api/claude/sessions') {
    return wrapSignal(Promise.resolve({
      ok: true,
      json: async () => ({ sessions: [] }),
    }));
  }

  return wrapSignal(Promise.resolve({ ok: true, json: async () => ({}) }));
};

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
  if (process.argv[2] && !name.includes(process.argv[2])) return;
  resetFixture();
  try { await fn(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.stack}`); }
}
const context = (model, totalTokens, maxTokens, percentage, rawMaxTokens = maxTokens) => ({
  context: { model, totalTokens, maxTokens, rawMaxTokens, percentage }, source: 'native',
});

try {
  const { useClaudeStore } = await vite.ssrLoadModule('/src/stores/claudeStore.ts');
  const { useServerStore } = await vite.ssrLoadModule('/src/stores/serverStore.ts');
  const { useProjectStore } = await vite.ssrLoadModule('/src/stores/projectStore.ts');
  const { default: ClaudeView } = await vite.ssrLoadModule('/src/components/ClaudeView.vue');
  const { default: ClaudeLimitsPopup } = await vite.ssrLoadModule('/src/components/ClaudeLimitsPopup.vue');
  const { default: ClaudeSessionHubModal } = await vite.ssrLoadModule('/src/components/ClaudeSessionHubModal.vue');

  function fixture({ id = 'session-a', serverId = 'server-a', cwd = '/work/a', model = 'sonnet' } = {}) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const server = useServerStore(pinia);
    server.servers = [
      { id: 'server-a', name: 'A', type: 'ssh', workspace: '/work/a' },
      { id: 'server-b', name: 'B', type: 'ssh', workspace: '/work/b' },
    ];
    server.currentServerId = serverId;
    const project = useProjectStore(pinia);
    project.projects = [{ id: `project-${serverId}`, serverId, rootPath: cwd, name: 'Fixture' }];
    const store = useClaudeStore(pinia);
    store.sessions = [{
      id, serverId, projectId: `project-${serverId}`, cwd, model, mode: 'Auto', name: id,
      isCustomNamed: false, messages: [{ id: 'u', sender: 'user', text: 'old', time: '00:00' }],
      contextTokens: '999k', updatedAt: 1,
    }];
    store.activeSessionId = id;
    currentActiveStore = store;
    return { pinia, server, project, store };
  }

  async function settle() {
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }

  async function renderPopup(pinia, { retry = false } = {}) {
    const store = useClaudeStore(pinia);
    const origFetch = store.fetchContextUsage;
    if (!retry && (store.currentContextUsage.status === 'unavailable' || store.currentContextUsage.status === 'error')) {
      store.fetchContextUsage = () => Promise.resolve(store.currentContextUsage);
    }
    try {
      const app = createSSRApp(ClaudeLimitsPopup, { isOpen: true });
      app.use(pinia);
      const ssrContext = {};
      const shell = await renderToString(app, ssrContext);
      const teleport = ssrContext.teleports?.body || Object.values(ssrContext.teleports || {}).join('');
      return (shell + teleport) || shell;
    } finally {
      store.fetchContextUsage = origFetch;
    }
  }

  function selectText(html, className) {
    const regex = new RegExp(`<[^>]+class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`);
    const match = html.match(regex);
    return match ? match[1].replace(/<[^>]+>/g, '').trim() : null;
  }

  function selectCard(popupHtml, titleSubstring) {
    const cards = popupHtml.split(/<div\s+class="[^"]*(?<!-)limit-card(?!-)[^"]*"/);
    return cards.find((c) => c.includes(titleSubstring)) || '';
  }

  await test('stale older model PATCH response must not overwrite newest intent when resolved in reverse order', async () => {
    resetFixture();
    const patchResolvers = [];
    patchHandler = (url, options) => new Promise((resolve) => patchResolvers.push({ url, options, resolve }));
    respond = async (url) => {
      const model = url.searchParams.get('model');
      if (model === 'haiku') return { ok: true, json: async () => context('haiku-effective', 10_000, 200_000, 5) };
      if (model === 'opus') return { ok: true, json: async () => context('opus-effective', 80_000, 200_000, 40) };
      return { ok: true, json: async () => context('sonnet-effective', 50_000, 200_000, 25) };
    };

    const { store } = fixture({ id: 'session-a', model: 'sonnet' });
    await settle();
    assert.equal(store.activeSession.model, 'sonnet');

    // Call 1: user switches to opus
    const p1 = store.updateSession('session-a', { model: 'opus' });
    assert.equal(store.activeSession.model, 'opus', 'optimistic model update to opus');

    // Call 2: user quickly switches to haiku
    const p2 = store.updateSession('session-a', { model: 'haiku' });
    assert.equal(store.activeSession.model, 'haiku', 'optimistic model update to haiku');

    assert.equal(patchResolvers.length, 2, 'both PATCH requests must be dispatched');

    // Resolve haiku (Call 2) first
    patchResolvers[1].resolve({
      ok: true,
      json: async () => ({ session: { ...store.activeSession, model: 'haiku' } }),
    });
    await p2;
    await settle();
    assert.equal(store.activeSession.model, 'haiku');

    // Resolve opus (Call 1) second (stale reverse order)
    patchResolvers[0].resolve({
      ok: true,
      json: async () => ({ session: { ...store.activeSession, model: 'opus' } }),
    });
    await p1;
    await settle();

    // Stale opus response must NOT overwrite haiku
    assert.equal(store.activeSession.model, 'haiku', 'session model must remain haiku');
    assert.equal(store.currentContextUsage.context?.model, 'haiku-effective', 'context must reflect haiku only');
  });

  await test('latest rename response cannot restore model or effort superseded by an older model request', async () => {
    const patchResolvers = [];
    patchHandler = (url, options) => new Promise((resolve) => patchResolvers.push({ options, resolve }));
    respond = async () => ({ ok: true, json: async () => context('haiku-high-effective', 25_000, 200_000, 12.5) });

    const { store } = fixture({ model: 'sonnet Medium' });
    await settle();
    const modelUpdate = store.updateSession('session-a', { model: 'haiku High' });
    const renameUpdate = store.updateSession('session-a', { name: 'Newest name' });
    assert.equal(store.activeSession.model, 'haiku High');
    assert.equal(store.activeSession.name, 'Newest name');

    patchResolvers[0].resolve({
      ok: true,
      json: async () => ({ session: { ...store.activeSession, model: 'haiku High', name: 'session-a' } }),
    });
    await modelUpdate;
    patchResolvers[1].resolve({
      ok: true,
      json: async () => ({ session: { ...store.activeSession, model: 'sonnet Medium', name: 'Newest name' } }),
    });
    await renameUpdate;
    await settle();

    assert.equal(store.activeSession.model, 'haiku High', 'rename response must preserve newer model/effort intent');
    assert.equal(store.activeSession.name, 'Newest name');
  });

  await test('non-model PATCH updates are preserved safely without clobbering newer model intent', async () => {
    resetFixture();
    const patchResolvers = [];
    patchHandler = (url, options) => new Promise((resolve) => patchResolvers.push({ url, options, resolve }));
    respond = async () => ({ ok: true, json: async () => context('sonnet-effective', 50_000, 200_000, 25) });

    const { store } = fixture({ id: 'session-a', model: 'sonnet' });
    await settle();

    // Call 1: rename session
    const p1 = store.updateSession('session-a', { name: 'Renamed Session' });
    assert.equal(store.activeSession.name, 'Renamed Session');

    // Call 2: update model
    const p2 = store.updateSession('session-a', { model: 'haiku' });
    assert.equal(store.activeSession.model, 'haiku');

    assert.equal(patchResolvers.length, 2);

    // Resolve p2 first (model haiku)
    patchResolvers[1].resolve({
      ok: true,
      json: async () => ({ session: { ...store.activeSession, model: 'haiku' } }),
    });
    await p2;
    await settle();

    // Resolve p1 second (name rename)
    patchResolvers[0].resolve({
      ok: true,
      json: async () => ({ session: { ...store.activeSession, name: 'Renamed Session', model: 'sonnet' } }),
    });
    await p1;
    await settle();

    assert.equal(store.activeSession.name, 'Renamed Session');
    assert.equal(store.activeSession.model, 'haiku');
  });

  await test('PATCH response re-finds its session by ID after list reorder', async () => {
    const patchResolvers = [];
    patchHandler = (url, options) => new Promise((resolve) => patchResolvers.push({ options, resolve }));
    const { store } = fixture({ id: 'session-a' });
    store.sessions.push({ ...store.activeSession, id: 'session-b', name: 'Session B', messages: [] });
    await settle();

    const update = store.updateSession('session-a', { name: 'Session A renamed' });
    store.sessions.reverse();
    patchResolvers[0].resolve({
      ok: true,
      json: async () => ({ session: { ...store.sessions.find((s) => s.id === 'session-a'), name: 'Server A' } }),
    });
    await update;

    assert.equal(store.sessions.find((s) => s.id === 'session-a').name, 'Server A');
    assert.equal(store.sessions.find((s) => s.id === 'session-b').name, 'Session B', 'reordered neighbor must not be mutated');
  });

  await test('PATCH response for a deleted session is ignored and cannot mutate another row', async () => {
    const patchResolvers = [];
    patchHandler = (url, options) => new Promise((resolve) => patchResolvers.push({ options, resolve }));
    const { store } = fixture({ id: 'session-a' });
    store.sessions.push({ ...store.activeSession, id: 'session-b', name: 'Session B', messages: [] });
    await settle();

    const update = store.updateSession('session-a', { name: 'Session A renamed' });
    store.sessions = store.sessions.filter((s) => s.id !== 'session-a');
    patchResolvers[0].resolve({
      ok: true,
      json: async () => ({ session: { id: 'session-a', name: 'Late A', model: 'sonnet' } }),
    });
    await update;

    assert.equal(store.sessions.some((s) => s.id === 'session-a'), false, 'deleted session must not be recreated');
    assert.equal(store.sessions.find((s) => s.id === 'session-b').name, 'Session B', 'remaining row must not be mutated');
  });

  await test('clearMessages successful operation synchronously invalidates old native context then fetches after clear', async () => {
    resetFixture();
    let contextResolve;
    respond = async (url) => {
      if (url.pathname.endsWith('/context-usage')) {
        return { ok: true, json: async () => context('effective-model', 45_000, 200_000, 22.5) };
      }
      return { ok: true, json: async () => ({}) };
    };

    const { store } = fixture();
    await settle();
    assert.equal(store.currentContextUsage.status, 'available');
    assert.equal(store.currentContextUsage.context.totalTokens, 45_000);

    let clearResolve;
    postHandler = (url) => {
      if (url.pathname.endsWith('/clear')) {
        return new Promise((resolve) => { clearResolve = resolve; });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    };

    // When clear completes, next context usage will be controlled via contextResolve
    respond = (url) => new Promise((resolve) => {
      contextResolve = resolve;
    });

    const clearPromise = store.clearMessages(store.activeSession.id);
    assert.equal(store.currentContextUsage.context, null, 'clear must invalidate old native context before POST resolves');
    assert.equal(store.currentContextUsage.status, 'loading', 'clear must expose pending native refresh immediately');

    // Resolve clear operation successfully
    clearResolve({
      ok: true,
      json: async () => ({ session: { ...store.activeSession, messages: [] } }),
    });

    await clearPromise;
    assert.equal(store.currentContextUsage.context, null, 'old native context must be invalidated synchronously without stale total');
    assert.equal(store.currentContextUsage.status, 'loading');

    // Resolve refreshed context usage
    contextResolve({ ok: true, json: async () => context('effective-model', 0, 200_000, 0) });
    await settle();

    assert.equal(store.currentContextUsage.status, 'available');
    assert.equal(store.currentContextUsage.context.totalTokens, 0);
  });

  await test('failed clear remains explicit error and never restores old native usage', async () => {
    respond = async () => ({ ok: true, json: async () => context('effective-model', 45_000, 200_000, 22.5) });
    const { store } = fixture();
    await settle();
    assert.equal(store.currentContextUsage.status, 'available');

    let rejectClear;
    postHandler = () => new Promise((resolve, reject) => { rejectClear = reject; });
    const clear = store.clearMessages('session-a');
    assert.equal(store.currentContextUsage.context, null);
    assert.equal(store.currentContextUsage.status, 'loading');
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      rejectClear(new Error('clear failed'));
      await clear;
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(store.currentContextUsage.context, null);
    assert.equal(store.currentContextUsage.status, 'error');
    assert.match(store.currentContextUsage.error, /clear failed/i);
  });

  await test('clear response cannot recreate context or session state after deletion', async () => {
    respond = async () => ({ ok: true, json: async () => context('effective-model', 45_000, 200_000, 22.5) });
    const { store } = fixture();
    await settle();
    let clearResolve;
    postHandler = () => new Promise((resolve) => { clearResolve = resolve; });

    const clear = store.clearMessages('session-a');
    deleteHandler = () => ({ ok: true, json: async () => ({ success: true }) });
    await store.deleteSession('session-a');
    clearResolve({ ok: true, json: async () => ({ session: { id: 'session-a', messages: [], model: 'sonnet' } }) });
    await clear;
    await settle();

    assert.equal(store.sessions.some((s) => s.id === 'session-a'), false);
    assert.equal(store.contextUsageBySession['session-a'], undefined);
  });

  await test('hydration issues exactly one context GET per unchanged scope and coalesces concurrent fetches', async () => {
    resetFixture();
    respond = async () => ({ ok: true, json: async () => context('effective-model', 50_000, 200_000, 25) });

    const pinia = createPinia();
    setActivePinia(pinia);
    const server = useServerStore(pinia);
    server.servers = [{ id: 'server-a', name: 'A', type: 'ssh', workspace: '/work/a' }];
    server.currentServerId = 'server-a';
    const project = useProjectStore(pinia);
    project.projects = [{ id: 'project-server-a', serverId: 'server-a', rootPath: '/work/a', name: 'Fixture' }];
    const store = useClaudeStore(pinia);

    const hydratedSessions = [{
      id: 'session-h', serverId: 'server-a', projectId: 'project-server-a', cwd: '/work/a',
      model: 'sonnet', mode: 'Auto', name: 'Hydrated', isCustomNamed: false, messages: [],
      updatedAt: 1,
    }];

    // Mock GET /api/claude/sessions
    const origRespond = respond;
    respond = async (url, options) => {
      if (url.pathname === '/api/claude/sessions') {
        return { ok: true, json: async () => ({ sessions: hydratedSessions }) };
      }
      return origRespond(url, options);
    };

    requests = [];

    // First hydration
    await store.fetchSessions();
    await settle();

    const contextRequests1 = requests.filter(r => r.pathname.endsWith('/context-usage'));
    assert.equal(contextRequests1.length, 1, 'hydration must issue exactly one context GET per unchanged scope');

    // Repeated hydration with unchanged scope must NOT issue another context GET
    await store.fetchSessions();
    await settle();
    const contextRequests2 = requests.filter(r => r.pathname.endsWith('/context-usage'));
    assert.equal(contextRequests2.length, 1, 'repeated hydration with unchanged scope must not refresh context');

    // Concurrent identical fetches must coalesce to 1 in-flight GET
    const p1 = store.fetchContextUsage();
    const p2 = store.fetchContextUsage();
    const p3 = store.fetchContextUsage();
    await Promise.all([p1, p2, p3]);
    await settle();
    const contextRequests3 = requests.filter(r => r.pathname.endsWith('/context-usage'));
    assert.equal(contextRequests3.length, 2, 'coalesced identical fetches share a single GET request');
  });

  await test('scope change aborts in-flight context request via AbortController', async () => {
    resetFixture();
    let abortedCount = 0;
    const inFlightSignals = [];
    respond = (url, options) => {
      inFlightSignals.push(options?.signal);
      options?.signal?.addEventListener('abort', () => {
        abortedCount++;
      });
      return new Promise(() => {}); // never resolves
    };

    const { store } = fixture({ id: 'session-a', model: 'sonnet' });
    await nextTick();
    assert.equal(inFlightSignals.length, 1);
    assert.ok(inFlightSignals[0], 'context usage fetch must provide an AbortSignal');

    // Change model to opus -> scope changes
    store.activeSession.model = 'opus';
    await nextTick();

    assert.equal(inFlightSignals.length, 2);
    assert.equal(abortedCount, 1, 'previous in-flight request must be aborted when scope changes');
  });

  await test('popup open retries unavailable and error with exactly one additional request', async () => {
    resetFixture();
    let getContextCount = 0;
    respond = async (url) => {
      if (url.pathname.endsWith('/context-usage')) {
        getContextCount++;
        return { ok: true, json: async () => ({ context: null, source: 'native' }) };
      }
      return { ok: true, json: async () => ({}) };
    };

    const { store, pinia } = fixture();
    await settle();
    assert.equal(store.currentContextUsage.status, 'unavailable');
    const initialGetCount = getContextCount;

    // Opening popup when status is 'unavailable' must retry fetchContextUsage
    respond = async (url) => {
      if (url.pathname.endsWith('/context-usage')) {
        getContextCount++;
        return { ok: true, json: async () => context('effective-model', 60_000, 200_000, 30) };
      }
      return { ok: true, json: async () => ({}) };
    };

    await renderPopup(pinia, { retry: true });
    await settle();

    assert.equal(getContextCount, initialGetCount + 1, 'opening popup must issue exactly one unavailable retry');
    assert.equal(store.currentContextUsage.status, 'available');
    assert.equal(store.currentContextUsage.context.totalTokens, 60_000);

    // Now simulate error status
    respond = async () => ({ ok: false, status: 500, json: async () => ({ error: 'probe failed' }) });
    await store.fetchContextUsage();
    assert.equal(store.currentContextUsage.status, 'error');
    const errorGetCount = getContextCount;

    // Opening popup when status is 'error' must retry fetchContextUsage
    respond = async (url) => {
      if (url.pathname.endsWith('/context-usage')) {
        getContextCount++;
        return { ok: true, json: async () => context('effective-model', 70_000, 200_000, 35) };
      }
      return { ok: true, json: async () => ({}) };
    };

    await renderPopup(pinia, { retry: true });
    await settle();

    assert.equal(getContextCount, errorGetCount + 1, 'opening popup must issue exactly one error retry');
    assert.equal(store.currentContextUsage.status, 'available');
    assert.equal(store.currentContextUsage.context.totalTokens, 70_000);
  });

  await test('delete session cleans usage state, generations, and in-flight controllers', async () => {
    resetFixture();
    let aborted = false;
    respond = (url, options) => {
      options?.signal?.addEventListener('abort', () => { aborted = true; });
      return new Promise(() => {}); // hang
    };

    deleteHandler = () => ({ ok: true, json: async () => ({ success: true }) });

    const { store } = fixture({ id: 'session-to-delete' });
    await nextTick();
    assert.equal(store.currentContextUsage.status, 'loading');
    assert.ok(store.contextUsageBySession['session-to-delete']);

    await store.deleteSession('session-to-delete');
    await settle();

    assert.equal(store.contextUsageBySession['session-to-delete'], undefined, 'usage state must be deleted');
    assert.ok(aborted, 'in-flight context request controller must be aborted');
  });

  await test('selected model refresh replaces native 200k with native 1m and clears the old limit immediately', async () => {
    respond = async (url) => ({ ok: true, json: async () => url.searchParams.get('model') === 'sonnet'
      ? context('claude-sonnet', 50_000, 200_000, 25)
      : context('claude-sonnet[1m]', 75_000, 1_000_000, 7.5) });
    const { store } = fixture();
    await settle();
    assert.equal(store.currentContextUsage.status, 'available');
    assert.equal(store.currentContextUsage.context.maxTokens, 200_000);
    const change = store.updateSession(store.activeSession.id, { model: 'sonnet[1m]' });
    assert.equal(store.currentContextUsage.context, null, 'old model usage must disappear synchronously');
    assert.equal(store.currentContextUsage.status, 'loading');
    await change;
    await settle();
    assert.equal(store.currentContextUsage.context.maxTokens, 1_000_000);
    assert.equal(store.currentContextUsage.context.percentage, 7.5);
    const request = [...requests].reverse().find((item) => item.pathname.endsWith('/context-usage'));
    assert.match(request.pathname, /\/api\/claude\/sessions\/session-a\/context-usage$/);
    assert.equal(request.searchParams.get('serverId'), 'server-a');
    assert.equal(request.searchParams.get('cwd'), '/work/a');
    assert.equal(request.searchParams.get('model'), 'sonnet[1m]');
  });

  await test('custom resolved native context and native percentage are retained without alias inference', async () => {
    respond = async () => ({ ok: true, json: async () => context('team-router/custom-effective-v4', 123_456, 654_321, 18.866) });
    const { store } = fixture({ model: 'team-alias Medium' });
    await settle();
    assert.deepEqual(store.currentContextUsage.context, {
      model: 'team-router/custom-effective-v4', totalTokens: 123_456, maxTokens: 654_321,
      rawMaxTokens: 654_321, percentage: 18.866,
    });
  });

  await test('late responses are rejected after model, session, cwd, or server scope changes', async () => {
    const pending = [];
    respond = (url) => new Promise((resolve) => pending.push({ url, resolve }));
    const { store, server } = fixture();
    await nextTick();
    assert.equal(pending.length, 1);
    store.activeSession.model = 'opus';
    await nextTick();
    assert.equal(pending.length, 2);
    pending[1].resolve({ ok: true, json: async () => context('opus-effective', 20, 400, 5) });
    await settle();
    pending[0].resolve({ ok: true, json: async () => context('stale-sonnet', 190, 200, 95) });
    await settle();
    assert.equal(store.currentContextUsage.context.model, 'opus-effective');

    store.sessions.push({ ...store.sessions[0], id: 'session-b', cwd: '/work/b', serverId: 'server-b', model: 'custom', messages: [] });
    server.currentServerId = 'server-b';
    store.activeSessionId = 'session-b';
    await nextTick();
    const sessionRequest = pending.at(-1);
    const sessionB = store.sessions.find((session) => session.id === 'session-b');
    sessionB.cwd = '/work/b-next';
    await nextTick();
    const cwdRequest = pending.at(-1);
    sessionB.serverId = 'server-a';
    server.currentServerId = 'server-a';
    await nextTick();
    const serverRequest = pending.at(-1);
    serverRequest.resolve({ ok: true, json: async () => context('current', 3, 30, 10) });
    await settle();
    cwdRequest.resolve({ ok: true, json: async () => context('stale-cwd', 29, 30, 96.7) });
    sessionRequest.resolve({ ok: true, json: async () => context('stale-session', 28, 30, 93.3) });
    await settle();
    assert.equal(store.currentContextUsage.context.model, 'current');
    assert.equal(store.currentContextUsage.scope.sessionId, 'session-b');
    assert.equal(store.currentContextUsage.scope.serverId, 'server-a');
    assert.equal(store.currentContextUsage.scope.cwd, '/work/b-next');
  });

  await test('stale generation is ignored even when fetch fixture ignores AbortSignal', async () => {
    respectAbortSignal = false;
    const pending = [];
    respond = (url) => new Promise((resolve) => pending.push({ url, resolve }));
    const { store } = fixture({ model: 'sonnet' });
    await nextTick();
    store.activeSession.model = 'opus';
    await nextTick();
    assert.equal(pending.length, 2);

    pending[1].resolve({ ok: true, json: async () => context('opus-current', 20, 400, 5) });
    await settle();
    pending[0].resolve({ ok: true, json: async () => context('sonnet-stale', 190, 200, 95) });
    await settle();

    assert.equal(store.currentContextUsage.context.model, 'opus-current');
    assert.equal(store.currentContextUsage.context.totalTokens, 20);
  });

  await test('usage is isolated by target and session even when responses complete out of order', async () => {
    const pending = [];
    respond = (url) => new Promise((resolve) => pending.push({ url, resolve }));
    const { store, server } = fixture();
    await nextTick();
    store.sessions.push({ ...store.activeSession, id: 'session-b', serverId: 'server-b', cwd: '/work/b', messages: [] });
    store.activeSessionId = 'session-b'; server.currentServerId = 'server-b';
    await nextTick();
    pending[1].resolve({ ok: true, json: async () => context('server-b-model', 8, 80, 10) });
    await settle();
    pending[0].resolve({ ok: true, json: async () => context('server-a-model', 9, 90, 10) });
    await settle();
    assert.equal(store.currentContextUsage.context.model, 'server-b-model');
    assert.equal(store.currentContextUsage.scope.sessionId, 'session-b');
  });

  await test('null and errors are explicit and never expose the legacy contextTokens estimate', async () => {
    respond = async () => ({ ok: true, json: async () => ({ context: null, source: 'native' }) });
    const { store } = fixture();
    await settle();
    assert.equal(store.currentContextUsage.status, 'unavailable');
    assert.equal(store.currentContextUsage.context, null);
    assert.notEqual(store.currentContextUsage.context?.totalTokens, 999_000);
    respond = async () => ({ ok: false, status: 503, json: async () => ({ error: 'Native context unavailable' }) });
    await store.fetchContextUsage();
    assert.equal(store.currentContextUsage.status, 'error');
    assert.equal(store.currentContextUsage.error, 'Native context unavailable');
    assert.equal(store.currentContextUsage.context, null);
  });

  await test('composer and popup render native human totals, raw max, percentage, and effective model', async () => {
    respond = async () => ({ ok: true, json: async () => context('effective/custom-v4', 123_456, 900_000, 12.3456, 1_000_000) });
    const { store, pinia } = fixture({ model: 'team-alias Medium' });
    await settle();
    const viewApp = createSSRApp(ClaudeView); viewApp.use(pinia);
    const viewHtml = await renderToString(viewApp);
    assert.equal(selectText(viewHtml, 'ctx-used'), '123.5k');
    assert.match(selectText(viewHtml, 'ctx-max') || '', /1M/);
    assert.equal(selectText(viewHtml, 'ctx-percent'), '12.3%');
    assert.doesNotMatch(viewHtml, /999k/, 'legacy assistant estimate must not be rendered as verified context');
    store.isLimitsPopupOpen = true;
    const popupHtml = await renderPopup(pinia);
    const contextCard = selectCard(popupHtml, 'ri-cpu-line');
    assert.ok(contextCard, 'popup must contain native context window card');
    assert.equal(selectText(contextCard, 'limit-tokens-detail'), '123.5k / 1M tokens');
    assert.equal(selectText(contextCard, 'limit-pct-val'), '12.3%');
    assert.equal(selectText(contextCard, 'limit-model-tag'), 'effective/custom-v4');
  });

  await test('loading, unavailable, and error UI use Vietnamese explicit states and em dashes', async () => {
    let resolve;
    respond = () => new Promise((done) => { resolve = done; });
    const { store, pinia } = fixture();
    await nextTick();
    const loadingPopup = await renderPopup(pinia);
    const loadingCard = selectCard(loadingPopup, 'ri-cpu-line');
    assert.match(selectText(loadingCard, 'limit-context-status') || '', /Đang tải/);

    respond = async () => ({ ok: true, json: async () => ({ context: null, source: 'native' }) });
    resolve({ ok: true, json: async () => ({ context: null, source: 'native' }) });
    await settle();
    const unavailable = await renderPopup(pinia);
    const unavailableCard = selectCard(unavailable, 'ri-cpu-line');
    assert.equal(selectText(unavailableCard, 'limit-tokens-detail'), '— / — tokens');
    assert.equal(selectText(unavailableCard, 'limit-context-status'), 'Chưa xác định');

    let viewApp = createSSRApp(ClaudeView); viewApp.use(pinia);
    const unavailableComposer = await renderToString(viewApp);
    assert.equal(selectText(unavailableComposer, 'ctx-used'), '—');
    assert.match(selectText(unavailableComposer, 'ctx-max') || '', /—/);
    assert.equal(selectText(unavailableComposer, 'ctx-percent'), 'Chưa xác định');

    respond = async () => ({ ok: false, status: 500, json: async () => ({ error: 'probe failed' }) });
    await store.fetchContextUsage();
    const failed = await renderPopup(pinia);
    const failedCard = selectCard(failed, 'ri-cpu-line');
    assert.equal(selectText(failedCard, 'limit-context-status'), 'Không thể tải ngữ cảnh native');
    assert.equal(selectText(failedCard, 'limit-tokens-detail'), '— / — tokens');

    viewApp = createSSRApp(ClaudeView); viewApp.use(pinia);
    const failedComposer = await renderToString(viewApp);
    assert.equal(selectText(failedComposer, 'ctx-percent'), 'Không thể tải');
  });

  await test('all context usage UI components contain no model-name inference or fixed context fallback', async () => {
    const components = [
      '../apps/web/src/components/ClaudeView.vue',
      '../apps/web/src/components/ClaudeLimitsPopup.vue',
      '../apps/web/src/components/ClaudeSessionHubModal.vue',
    ];
    for (const relative of components) {
      const source = await readFile(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
      assert.doesNotMatch(source, /getModelContext(?:Window|Label)|includes\(['"](?:1m|1000k)|\b(?:200k|1000k|200000|1000000)\b/i, relative);
    }
    const hub = await readFile(fileURLToPath(new URL('../apps/web/src/components/ClaudeSessionHubModal.vue', import.meta.url)), 'utf8');
    assert.doesNotMatch(hub, /s\.contextTokens/, 'session hub must not claim legacy estimates as native context');
    assert.match(hub, /formatContextTokenCount/, 'session hub must use shared native formatting');
    assert.match(hub, /nativeContextLimit/, 'session hub must preserve the raw native denominator');
  });

  await test('session hub source distinguishes exact active native usage from unfetched rows', async () => {
    const hub = await readFile(fileURLToPath(new URL('../apps/web/src/components/ClaudeSessionHubModal.vue', import.meta.url)), 'utf8');
    assert.match(hub, /isExactActiveContext/);
    assert.match(hub, /— \/ —/);
    assert.match(hub, /context\?\.model/);
  });
} finally {
  await vite.close();
}
process.exitCode = failures ? 1 : 0;
