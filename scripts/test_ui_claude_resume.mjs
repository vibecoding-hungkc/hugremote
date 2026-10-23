import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { mock } from 'node:test';

// No network/inference: exercise the real Vue/Pinia store with controlled SSE.
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { documentElement: { lang: '' } };
const vite = await createServer({ root: fileURLToPath(new URL('../apps/web/', import.meta.url)), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
const tick = async () => { await new Promise(resolve => setImmediate(resolve)); await nextTick(); };
const clone = value => JSON.parse(JSON.stringify(value));
const encoder = new TextEncoder();
try {
  const { useClaudeStore } = await vite.ssrLoadModule('/src/stores/claudeStore.ts');
  const { useServerStore } = await vite.ssrLoadModule('/src/stores/serverStore.ts');
  function fixture() {
    const pinia = createPinia(); setActivePinia(pinia);
    const server = useServerStore(pinia);
    server.servers = [{ id: 'server-local', name: 'Fixture', type: 'local', workspace: '/isolated' }];
    server.currentServerId = 'server-local';
    const store = useClaudeStore(pinia);
    store.sessions = [{ id: 'a', serverId: 'server-local', name: 'A', model: 'Default', messages: [], cwd: '/isolated', isRunning: false }];
    store.activeSessionId = 'a';
    let snapshot = clone(store.sessions);
    const requests = [];
    const streams = [];
    globalThis.fetch = async (url, options = {}) => {
      const path = String(url);
      requests.push({ path, options });
      if (path.endsWith('/stream')) {
        let controller;
        const body = new ReadableStream({ start(c) { controller = c; }, cancel() {} });
        const transport = {
          options, body,
          send(event) { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); },
          close() { controller.close(); },
          heartbeat() { controller.enqueue(encoder.encode(': heartbeat\n\n')); },
        };
        streams.push(transport);
        return { ok: true, body };
      }
      if (path.includes('/models?')) return { ok: true, json: async () => ({ models: [] }) };
      assert.ok(path.includes('/sessions?'), `unexpected fixture request ${path}`);
      return { ok: true, json: async () => ({ sessions: clone(snapshot) }) };
    };
    return { store, streams, requests, snapshot(value) { snapshot = clone(value); },
      posts: () => requests.filter(r => r.options.method === 'POST'),
      gets: () => requests.filter(r => r.path.endsWith('/stream') && r.options.method !== 'POST'),
    };
  }
  {
    const f = fixture();
    const pending = f.store.sendMessage('one prompt'); await tick();
    f.streams[0].send({ type: 'sync', status: 'running', liveMessage: { id: 'canonical', text: 'old', isWorking: true } }); await tick();
    const row = f.store.activeSession.messages.at(-1);
    f.snapshot([{ ...clone(f.store.activeSession), isRunning: true }]);
    await f.store.fetchSessions();
    f.streams[0].send({ type: 'text_delta', text: ' fresh' }); await tick();
    assert.equal(f.store.activeSession.messages.at(-1).text, 'old fresh', 'hydration must not detach the visible live row');
    assert.equal(f.store.activeSession.messages.at(-1), row, 'stable message identity survives hydration');
    f.snapshot([{ ...clone(f.store.activeSession), isRunning: false }]);
    f.streams[0].send({ type: 'done', text: 'old fresh' }); await pending;
    assert.equal(f.posts().length, 1);
    console.log('PASS hydration during running POST retains visible live message');
  }
  {
    const f = fixture();
    const pending = f.store.sendMessage('one prompt'); await tick();
    f.streams[0].send({ type: 'text_delta', text: 'before background' }); await tick();
    f.snapshot([{ ...clone(f.store.activeSession), isRunning: true }]);
    assert.equal(typeof f.store.resumeActiveStream, 'function', 'foreground resume API is public');
    await Promise.all([f.store.resumeActiveStream(), f.store.resumeActiveStream()]); await tick();
    assert.equal(f.streams[0].options.signal.aborted, true, 'force resume aborts stalled POST reader');
    assert.equal(f.gets().length, 1, 'concurrent focus events share one GET');
    assert.equal(f.posts().length, 1, 'foreground never submits prompt again');
    await f.store.resumeActiveStream(); await tick();
    assert.equal(f.gets().length, 1, 'overlapping focus after hydration must not replace GET awaiting initial sync');
    f.streams[1].send({ type: 'sync', status: 'running', liveMessage: { id: 'server-row', text: 'caught up', thinking: '', isWorking: true } });
    f.streams[1].send({ type: 'text_delta', text: ' live' }); await tick();
    assert.equal(f.store.activeSession.messages.at(-1).text, 'caught up live');
    assert.equal(f.store.isGenerating, true, 'stale POST finally cannot clear refreshed GET state');
    f.snapshot([{ ...clone(f.store.activeSession), isRunning: false }]);
    f.streams[1].send({ type: 'done', text: 'caught up live' }); await tick(); await pending;
    assert.equal(f.store.isGenerating, false);
    console.log('PASS foreground aborts stalled reader, dedupes GET and preserves renewed task state');
  }
  for (const status of ['done', 'cancelled', 'error']) {
    const f = fixture();
    const pending = f.store.sendMessage('one prompt'); await tick();
    const row = f.store.activeSession.messages.at(-1);
    f.streams[0].send({ type: 'content_sync', text: 'old answer', thinking: 'old thought' }); await tick();
    f.snapshot([{ ...clone(f.store.activeSession), isRunning: false, messages: [
      clone(f.store.activeSession.messages[0]), { ...clone(row), text: '', thinking: '', isWorking: false },
    ] }]);
    const fetchFixture = globalThis.fetch;
    let releaseHydration;
    const hydrationGate = new Promise(resolve => { releaseHydration = resolve; });
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('/sessions?')) await hydrationGate;
      return fetchFixture(url, options);
    };
    f.streams[0].send({ type: 'sync', status, liveMessage: { id: row.id, text: '', thinking: '', isWorking: false } });
    await tick();
    assert.equal(row.text, '', `${status} sync must apply empty canonical text before hydration`);
    assert.equal(row.thinking, '');
    assert.equal(row.isWorking, false);
    assert.equal(f.store.isGenerating, false, `${status} sync is terminal without waiting for EOF`);
    releaseHydration(); await pending;
    assert.equal(f.gets().length, 0);
    console.log(`PASS terminal ${status} sync applies empty snapshots without waiting for EOF`);
  }
  {
    const f = fixture();
    const oldPending = f.store.sendMessage('prompt A'); await tick();
    const a = clone(f.store.activeSession);
    f.store.sessions.push({ ...a, id: 'b', name: 'B', isRunning: false, messages: [] });
    f.store.switchSession('b'); await tick();
    assert.equal(f.store.isGenerating, false, 'switch to idle B must not inherit A loading');
    assert.equal(f.streams[0].options.signal.aborted, true, 'leaving A releases its transport, not server task');
    const newPending = f.store.sendMessage('prompt B'); await tick();
    assert.equal(f.posts().length, 2);
    await oldPending;
    assert.equal(f.store.isGenerating, true, 'old stream cleanup must not clear B');
    f.streams[1].send({ type: 'text_delta', text: 'B live' }); await tick();
    assert.equal(f.store.activeSession.messages.at(-1).text, 'B live');
    f.snapshot([{ ...a, isRunning: true }, { ...clone(f.store.activeSession), isRunning: false }]);
    f.streams[1].send({ type: 'done', text: 'B live' }); await newPending;
    assert.equal(f.store.isGenerating, false);
    console.log('PASS switching sessions releases A transport and stale cleanup cannot clear B');
  }
  {
    const f = fixture();
    const pending = f.store.sendMessage('race prompt'); await tick();
    f.streams[0].send({ type: 'sync', status: 'running', liveMessage: { id: 'canonical', text: 'base', isWorking: true } }); await tick();
    const fetchFixture = globalThis.fetch;
    const delayed = [];
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('/sessions?')) return new Promise(resolve => delayed.push(resolve));
      return fetchFixture(url, options);
    };
    const snapshot = text => ({ ok: true, json: async () => ({ sessions: [{ ...clone(f.store.activeSession), isRunning: true, name: text, messages: [clone(f.store.activeSession.messages[0]), { ...clone(f.store.activeSession.messages.at(-1)), text }] }] }) });
    const older = f.store.fetchSessions();
    const newer = f.store.fetchSessions();
    f.streams[0].send({ type: 'text_delta', text: ' delta' }); await tick();
    delayed[1](snapshot('ahead of reader')); await newer;
    assert.equal(f.store.activeSession.messages.at(-1).text, 'base delta', 'running snapshot must not overwrite or jump ahead of owned reader');
    delayed[0](snapshot('stale snapshot')); await older;
    assert.equal(f.store.activeSession.name, 'ahead of reader', 'slow old response cannot replace newer session metadata');
    f.streams[0].send({ type: 'content_sync', text: 'short', thinking: '' }); await tick();
    assert.equal(f.store.activeSession.messages.at(-1).text, 'short', 'canonical revision may shrink');
    globalThis.fetch = fetchFixture;
    f.snapshot([{ ...clone(f.store.activeSession), isRunning: false }]);
    f.streams[0].send({ type: 'done', text: 'short' }); await pending;
    console.log('PASS response ordering and snapshot/event race preserve reader progress and canonical shrinking revisions');
  }
  {
    const f = fixture();
    const pending = f.store.sendMessage('terminal race'); await tick();
    const stale = [{ ...clone(f.store.activeSession), isRunning: true }];
    const fetchFixture = globalThis.fetch;
    const gates = [];
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('/sessions?')) return new Promise(resolve => { gates.push(resolve); });
      return fetchFixture(url, options);
    };
    const oldFetch = f.store.fetchSessions();
    f.streams[0].send({ type: 'done', text: 'stable final' }); await tick();
    // Complete's newer hydration should win; hold the older running snapshot too.
    globalThis.fetch = fetchFixture;
    gates[1]({ ok: true, json: async () => ({ sessions: [{ ...clone(f.store.activeSession), isRunning: false }] }) });
    await pending;
    gates[0]({ ok: true, json: async () => ({ sessions: stale }) }); await oldFetch;
    assert.equal(f.store.activeSession.messages.at(-1).text, 'stable final');
    assert.equal(f.store.activeSession.isRunning, false);
    assert.equal(f.gets().length, 0);
    console.log('PASS old running hydration cannot resurrect a terminal stream');
  }
  {
    const f = fixture();
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      const pending = f.store.sendMessage('EOF prompt'); await tick();
      f.streams[0].send({ type: 'text_delta', text: 'partial' }); await tick();
      f.snapshot([{ ...clone(f.store.activeSession), isRunning: true }]);
      f.streams[0].close(); await tick();
      assert.equal(f.gets().length, 1, 'clean POST EOF recovers through GET without duplicate POST');
      f.streams[1].close(); await tick();
      assert.equal(f.store.isReconnecting, true);
      assert.equal(f.gets().length, 1, 'GET clean EOF waits before retry');
      mock.timers.tick(999); await tick(); assert.equal(f.gets().length, 1);
      mock.timers.tick(1); await tick(); assert.equal(f.gets().length, 2);
      for (let i = 2; i <= 15; i++) {
        f.streams[i].close(); await tick();
        mock.timers.tick(5000); await tick();
      }
      await pending;
      assert.equal(f.gets().length, 15, 'all clean EOF attempts count toward bounded recovery budget');
      assert.equal(f.posts().length, 1);
      assert.equal(f.store.isGenerating, true, 'transport exhaustion does not complete server task or hide Stop');
      assert.equal(f.store.isReconnecting, false);
      await f.store.sendMessage('must not submit twice');
      assert.equal(f.posts().length, 1, 'running server task blocks prompt after transport exhausted');
      assert.equal(f.store.activeSession.messages.at(-1).text, 'partial');
      console.log('PASS clean POST/GET EOF recovery is bounded, preserves Stop and blocks duplicate prompt after exhaustion');
    } finally { mock.timers.reset(); }
  }
  {
    const f = fixture();
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      const pending = f.store.sendMessage('stalled GET'); await tick();
      f.snapshot([{ ...clone(f.store.activeSession), isRunning: true }]);
      await f.store.resumeActiveStream(); await tick();
      assert.equal(f.gets().length, 1);
      mock.timers.tick(29000); await tick();
      f.streams[1].heartbeat(); await tick();
      mock.timers.tick(29000); await tick();
      assert.equal(f.gets().length, 1, 'heartbeat bytes reset the 30s reader deadline without a data event');
      assert.equal(f.store.isReconnecting, false);
      mock.timers.tick(1000); await tick();
      assert.equal(f.store.isReconnecting, true, 'no heartbeat/data within idle deadline restarts a stuck GET');
      mock.timers.tick(1000); await tick();
      assert.equal(f.gets().length, 2);
      f.snapshot([{ ...clone(f.store.activeSession), isRunning: false }]);
      f.streams[2].send({ type: 'done', text: 'recovered' }); await tick(); await pending;
      console.log('PASS idle GET reader deadline releases half-dead stream and retries');
    } finally { mock.timers.reset(); }
  }
  {
    const f = fixture();
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      const pending = f.store.sendMessage('header stall'); await tick();
      f.snapshot([{ ...clone(f.store.activeSession), isRunning: true }]);
      const fetchFixture = globalThis.fetch;
      const attempts = [];
      globalThis.fetch = (url, options = {}) => {
        if (String(url).endsWith('/stream') && options.method !== 'POST') {
          return new Promise(resolve => attempts.push({ resolve, signal: options.signal })); // Deliberately ignores abort.
        }
        return fetchFixture(url, options);
      };
      await f.store.resumeActiveStream(); await tick(); await pending;
      await f.store.resumeActiveStream(); await tick();
      assert.equal(attempts.length, 1, 'focus dedupes a pending header attempt');
      for (let i = 0; i < 15; i++) {
        mock.timers.tick(30000); await tick();
        assert.equal(attempts[i].signal.aborted, true, 'header timeout aborts its attempt even if fetch ignores abort');
        mock.timers.tick(5000); await tick();
      }
      assert.equal(attempts.length, 15, 'header stalls consume the bounded retry budget');
      assert.equal(f.store.isReconnecting, false, 'exhausted header attempts release owner');
      assert.equal(f.store.activeSession.isRunning, true);
      assert.equal(f.store.isGenerating, true, 'Stop remains available after transport exhaustion');
      await f.store.sendMessage('duplicate forbidden');
      assert.equal(f.posts().length, 1);
      let cancelled = 0;
      attempts[0].resolve({ ok: true, body: new ReadableStream({ cancel() { cancelled++; } }) });
      await tick();
      assert.equal(cancelled, 1, 'late response from timed-out fetch is cancelled without acquiring a reader');
      globalThis.fetch = fetchFixture;
      await f.store.resumeActiveStream(); await tick();
      assert.equal(f.gets().length, 1, 'fresh foreground event can recover after exhausted headers');
      f.snapshot([{ ...clone(f.store.activeSession), isRunning: false }]);
      f.streams[1].send({ type: 'done', text: 'recovered after headers' }); await tick();
      assert.equal(f.store.isGenerating, false);
      console.log('PASS never-resolving GET headers are bounded, abort attempts, cancel late responses and allow foreground recovery');
    } finally { mock.timers.reset(); }
  }
  {
    const f = fixture();
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      const pending = f.store.sendMessage('abort headers'); await tick();
      f.snapshot([{ ...clone(f.store.activeSession), isRunning: true }]);
      const fetchFixture = globalThis.fetch;
      let signal; let resolveHeaders; let attempts = 0;
      globalThis.fetch = (url, options = {}) => {
        if (String(url).endsWith('/stream') && options.method !== 'POST') {
          attempts++; signal = options.signal;
          return new Promise(resolve => { resolveHeaders = resolve; });
        }
        return fetchFixture(url, options);
      };
      await f.store.resumeActiveStream(); await tick(); await pending;
      f.snapshot([{ ...clone(f.store.activeSession), isRunning: false }]);
      await f.store.fetchSessions(); await tick();
      assert.equal(signal.aborted, true, 'owner release aborts pending header connection');
      mock.timers.tick(1000000); await tick();
      assert.equal(attempts, 1, 'released owner never retries or leaves a live timeout');
      let cancelled = 0;
      resolveHeaders({ ok: true, body: new ReadableStream({ cancel() { cancelled++; } }) }); await tick();
      assert.equal(cancelled, 1, 'owner-aborted late response is discarded');
      assert.equal(f.store.isGenerating, false);
      console.log('PASS owner abort cleans pending header connection and late response');
    } finally { mock.timers.reset(); }
  }
  {
    const f = fixture();
    const pending = f.store.sendMessage('away prompt'); await tick();
    f.streams[0].send({ type: 'text_delta', text: 'old' }); await tick();
    f.snapshot([{ ...clone(f.store.activeSession), isRunning: false, messages: [clone(f.store.activeSession.messages[0]), { ...clone(f.store.activeSession.messages.at(-1)), text: 'final while away', isWorking: false }] }]);
    await f.store.resumeActiveStream(); await pending;
    assert.equal(f.streams[0].options.signal.aborted, true);
    assert.equal(f.store.activeSession.messages.at(-1).text, 'final while away');
    assert.equal(f.store.activeSession.messages.at(-1).isWorking, false);
    assert.equal(f.gets().length, 0);
    assert.equal(f.store.isGenerating, false);
    console.log('PASS terminal snapshot while away aborts dead reader and keeps canonical final');
  }
} finally { await vite.close(); }
