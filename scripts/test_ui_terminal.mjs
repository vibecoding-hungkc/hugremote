import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { createPinia, setActivePinia } from 'pinia';
import { createRenderer, ssrContextKey } from 'vue';
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null, setItem() {} }, configurable: true });
globalThis.document = { documentElement: {} };
const renderer = createRenderer({ createComment: () => ({}), insert() {}, remove() {}, parentNode() {}, nextSibling() {} });

const vite = await createServer({ root: resolve('apps/web'), server: { middlewareMode: true }, appType: 'custom' });
let failed = 0;
try {
  const { useTerminalStore } = await vite.ssrLoadModule('/src/stores/terminalStore.ts');
  const { useServerStore } = await vite.ssrLoadModule('/src/stores/serverStore.ts');
  const { default: Hub } = await vite.ssrLoadModule('/src/components/TerminalSessionHubModal.vue');
  const { default: Form } = await vite.ssrLoadModule('/src/components/NewTerminalModal.vue');
  async function test(name, fn) {
    setActivePinia(createPinia());
    try { await fn(); console.log(`PASS ${name}`); }
    catch (err) { failed++; console.error(`FAIL ${name}: ${err.message}`); }
  }
  function setup(Component, props) {
    const events = [];
    let state;
    const app = renderer.createApp({ setup() {
      state = Component.setup(props, { expose() {}, emit: (...args) => events.push(args) });
      return () => null;
    } });
    app.provide(ssrContextKey, { modules: new Set() });
    app.mount({});
    return { state, events };
  }
  function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
  await test('close waits for DELETE before removing session', async () => {
    const store = useTerminalStore();
    store.sessions.push({ id: 'test/2', name: 'two', serverId: 'server-local', projectId: '' });
    store.switchSession('test/2');
    const pending = deferred(); const calls = [];
    globalThis.fetch = (...args) => { calls.push(args); return pending.promise; };
    const closing = store.closeSession('test/2');
    assert.equal(calls.length, 1, 'DELETE must be sent');
    assert.equal(calls[0][0], '/api/sessions/test%2F2');
    assert.equal(calls[0][1].method, 'DELETE');
    assert.equal(store.sessions.length, 2, 'state retained until DELETE succeeds');
    pending.resolve({ ok: true }); await closing;
    assert.equal(store.sessions.length, 1);
    assert.equal(store.activeSessionId, 'term-local-main');
  });
  await test('network failure preserves sessions and inactive close keeps selection', async () => {
    const store = useTerminalStore();
    store.sessions.push({ id: 'two', name: 'two', serverId: 'server-local', projectId: '' });
    globalThis.fetch = async () => { throw new Error('offline'); };
    await assert.rejects(store.closeSession('two'), /offline/);
    assert.equal(store.sessions.length, 2);
    globalThis.fetch = async () => ({ ok: true });
    await store.closeSession('two');
    assert.equal(store.activeSessionId, 'term-local-main');
  });
  await test('form create uses project path and cancellation does not mutate state', async () => {
    const store = useTerminalStore();
    const server = useServerStore(); server.currentServer.workspace = '/workspace';
    const { state, events } = setup(Form, { isOpen: true, session: null });
    assert.equal(state.targetCwd.value, '/workspace');
    state.requestClose(); assert.equal(store.sessions.length, 1);
    state.targetCwd.value = '/work/new'; state.customName.value = 'new';
    await state.handleSubmit();
    assert.equal(store.sessions.length, 2);
    assert.equal(store.activeSession.cwd, '/work/new');
    assert.deepEqual(events, [['close'], ['created'], ['close']]);
  });
  await test('failed close preserves sessions and active selection', async () => {
    const store = useTerminalStore();
    store.sessions.push({ id: 'two', name: 'two', serverId: 'server-local', projectId: '' });
    store.switchSession('two');
    globalThis.fetch = async () => ({ ok: false });
    await assert.rejects(store.closeSession('two'));
    assert.equal(store.sessions.length, 2);
    assert.equal(store.activeSessionId, 'two');
  });
  await test('last session and concurrent closes cannot delete final PTY', async () => {
    const store = useTerminalStore(); let calls = 0;
    const pending = deferred();
    globalThis.fetch = () => { calls++; return pending.promise; };
    assert.equal(await store.closeSession('term-local-main'), false);
    store.sessions.push({ id: 'two', name: 'two', serverId: 'server-local', projectId: '' });
    const closing = store.closeSession('two');
    assert.equal(await store.closeSession('term-local-main'), false);
    assert.equal(await store.closeSession('two'), false);
    pending.resolve({ ok: true }); await closing;
    assert.equal(calls, 1);
    assert.equal(store.sessions.length, 1);
  });
  await test('hub cancellation sends no DELETE and failed confirmation exposes error', async () => {
    const store = useTerminalStore(); let calls = 0;
    store.sessions.push({ id: 'two', name: 'two', serverId: 'server-local', projectId: '' });
    const { state, events } = setup(Hub, { isOpen: true });
    globalThis.window = { confirm: () => false };
    globalThis.fetch = async () => { calls++; return { ok: false }; };
    assert.equal(typeof state.closeSession, 'function', 'hub must confirm before calling store');
    await state.closeSession('two');
    assert.equal(calls, 0); assert.equal(store.sessions.length, 2);
    window.confirm = () => true;
    await state.closeSession('two');
    assert.equal(calls, 1); assert.ok(state.closeError.value);
    assert.equal(store.sessions.length, 2); assert.deepEqual(events, []);
  });
  await test('CWD edit cancellation and DELETE failure preserve original session', async () => {
    const store = useTerminalStore(); const session = store.sessions[0];
    session.cwd = '/old'; let calls = 0;
    const { state, events } = setup(Form, { isOpen: true, session });
    state.targetCwd.value = '/new';
    globalThis.window = { confirm: () => false };
    globalThis.fetch = async () => { calls++; return { ok: false }; };
    await state.handleSubmit();
    assert.equal(calls, 0, 'cancelled CWD restart must not DELETE');
    assert.equal(session.cwd, '/old'); assert.deepEqual(events, []);
    window.confirm = () => true;
    await state.handleSubmit();
    assert.equal(calls, 1); assert.equal(session.cwd, '/old');
    assert.ok(state.submitError.value); assert.deepEqual(events, []);
  });
  await test('CWD edit commits only after successful DELETE and name edit does not restart', async () => {
    const store = useTerminalStore(); const session = store.sessions[0]; session.cwd = '/old';
    const { state, events } = setup(Form, { isOpen: true, session });
    state.targetCwd.value = '/new'; state.customName.value = 'custom';
    globalThis.window = { confirm: () => true };
    const pending = deferred(); let calls = 0;
    globalThis.fetch = () => { calls++; return pending.promise; };
    const saving = state.handleSubmit();
    assert.equal(session.cwd, '/old', 'do not mutate CWD before backend success');
    await state.handleSubmit(); assert.equal(calls, 1, 'duplicate submit blocked');
    pending.resolve({ ok: true }); await saving;
    assert.equal(session.cwd, '/new'); assert.equal(session.name, 'custom');
    assert.deepEqual(events, [['updated'], ['close']]);
    state.customName.value = 'renamed'; await state.handleSubmit();
    assert.equal(calls, 1); assert.equal(session.name, 'renamed');
  });
} finally { await vite.close(); }
if (failed) process.exitCode = 1;
