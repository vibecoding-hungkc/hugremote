import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { createPinia, setActivePinia } from 'pinia';
import { createRenderer, ssrContextKey, nextTick, reactive } from 'vue';

Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null, setItem() {} }, configurable: true });
globalThis.document = {
  documentElement: {},
  addEventListener() {},
  removeEventListener() {},
  visibilityState: 'visible',
};
globalThis.window = {
  location: { protocol: 'http:', host: 'localhost' },
  confirm: () => true,
  addEventListener() {},
  removeEventListener() {},
};
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });

const sockets = [];
class Socket {
  static OPEN = 1;
  readyState = 0;
  closed = false;
  constructor(url) {
    this.url = url;
    sockets.push(this);
  }
  close() {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.();
  }
  send() {}
}
globalThis.WebSocket = Socket;

globalThis.__reviewTerminal = class {
  cols = 80;
  rows = 24;
  options = {};
  loadAddon() {}
  open() {}
  onTitleChange() {}
  onData() {}
  dispose() {}
  reset() {}
  focus() {}
};

const vite = await createServer({
  root: resolve('apps/web'),
  optimizeDeps: { noDiscovery: true, include: [] },
  ssr: { noExternal: [/^@xterm\//] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  plugins: [
    {
      name: 'review-xterm-stub',
      enforce: 'pre',
      resolveId(id) {
        if (id.startsWith('@xterm/')) return '\0review:' + id;
      },
      load(id) {
        if (id.startsWith('\0review:')) {
          return `export const Terminal = globalThis.__reviewTerminal; export class FitAddon { fit() {} } export class WebLinksAddon {}`;
        }
      },
    },
  ],
});

const renderer = createRenderer({
  createComment: () => ({}),
  insert() {},
  remove() {},
  parentNode() {},
  nextSibling() {},
});

const apps = [];
function setup(Component, props) {
  let state;
  const events = [];
  const app = renderer.createApp({
    setup() {
      state = Component.setup(props, {
        expose() {},
        emit: (...args) => events.push(args),
      });
      return () => null;
    },
  });
  app.provide(ssrContextKey, { modules: new Set() });
  app.mount({});
  apps.push(app);
  return { state, events };
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
async function test(name, fn) {
  setActivePinia(createPinia());
  sockets.length = 0;
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}: ${error.message}`);
  } finally {
    for (const app of apps.splice(0)) app.unmount();
  }
}

try {
  const { useTerminalStore } = await vite.ssrLoadModule('/src/stores/terminalStore.ts');
  const { default: View } = await vite.ssrLoadModule('/src/components/TerminalView.vue');
  const { default: Form } = await vite.ssrLoadModule('/src/components/NewTerminalModal.vue');

  await test('pending close immediately detaches socket and cancels all reconnect paths until DELETE succeeds', async () => {
    const store = useTerminalStore();
    store.sessions.push({ id: 'two', name: 'two', cwd: '/old', serverId: 'server-local', projectId: '' });
    store.switchSession('two');
    const { state } = setup(View, { isActive: true });
    state.terminalRef.value = { innerHTML: '', querySelector: () => null, addEventListener() {}, removeEventListener() {} };
    state.initTerminal();
    assert.equal(sockets.length, 1);
    const old = sockets[0];

    const pending = deferred();
    globalThis.fetch = () => pending.promise;
    const closing = store.closeSession('two');

    assert.equal(old.closed, true, 'socket cleanup must be synchronous at operation start');

    // Attempting to reconnect while suspended must be ignored
    state.connectWebSocket();
    state.scheduleReconnect();
    await sleep(70);
    assert.equal(sockets.length, 1, 'slow DELETE must not resurrect the old PTY');

    // Resolve DELETE
    pending.resolve({ ok: true });
    await closing;
    await sleep(70);

    assert.equal(store.sessions.length, 1);
    assert.equal(sockets.length, 2);
    assert.match(sockets[1].url, /sessionId=term-local-main/);
  });

  await test('failed close resumes connection without deleting session and duplicate/last close is guarded', async () => {
    const store = useTerminalStore();
    store.sessions.push({ id: 'two', name: 'two', cwd: '/old', serverId: 'server-local', projectId: '' });
    store.switchSession('two');
    const { state } = setup(View, { isActive: true });
    state.terminalRef.value = { innerHTML: '', querySelector: () => null, addEventListener() {}, removeEventListener() {} };
    state.initTerminal();
    assert.equal(sockets.length, 1);

    const pending = deferred();
    let calls = 0;
    globalThis.fetch = () => {
      calls++;
      return pending.promise;
    };
    const closing = store.closeSession('two');
    assert.equal(sockets[0].closed, true);

    // Concurrent close on same or last session must return false
    assert.equal(await store.closeSession('two'), false);
    assert.equal(await store.closeSession('term-local-main'), false);

    pending.resolve({ ok: false });
    await assert.rejects(closing);
    await sleep(70);

    assert.equal(calls, 1);
    assert.equal(store.sessions.length, 2);
    assert.equal(sockets.length, 2);
    assert.match(sockets[1].url, /cwd=%2Fold/);
  });

  await test('CWD restart stays suspended through slow DELETE and connects only with committed CWD; rename keeps socket', async () => {
    const store = useTerminalStore();
    const session = store.sessions[0];
    session.cwd = '/old';
    const { state } = setup(View, { isActive: true });
    state.terminalRef.value = { innerHTML: '', querySelector: () => null, addEventListener() {}, removeEventListener() {} };
    state.initTerminal();
    assert.equal(sockets.length, 1);

    const { state: form } = setup(Form, { isOpen: true, session });
    form.targetCwd.value = '/new';

    const pending = deferred();
    globalThis.fetch = () => pending.promise;
    const saving = form.handleSubmit();
    assert.equal(sockets[0].closed, true);
    assert.equal(await store.closeSession(session.id), false);

    state.connectWebSocket();
    state.scheduleReconnect();
    await sleep(70);
    assert.equal(sockets.length, 1);
    assert.equal(session.cwd, '/old');

    pending.resolve({ ok: true });
    await saving;
    await sleep(70);

    assert.equal(sockets.length, 2);
    assert.match(sockets[1].url, /cwd=%2Fnew/);

    // Rename only: must not restart PTY socket
    form.customName.value = 'rename only';
    await form.handleSubmit();
    await sleep(70);
    assert.equal(sockets.length, 2, 'rename must not restart PTY');
  });

  await test('restart and close cannot overlap, and failed restart resumes old CWD', async () => {
    const store = useTerminalStore();
    store.sessions.push({ id: 'two', name: 'two', cwd: '/old', serverId: 'server-local', projectId: '' });
    store.switchSession('two');
    const session = store.activeSession;
    const { state } = setup(View, { isActive: true });
    state.terminalRef.value = { innerHTML: '', querySelector: () => null, addEventListener() {}, removeEventListener() {} };
    state.initTerminal();
    assert.equal(sockets.length, 1);

    const { state: form } = setup(Form, { isOpen: true, session });
    form.targetCwd.value = '/new';

    const pending = deferred();
    let calls = 0;
    globalThis.fetch = () => {
      calls++;
      return pending.promise;
    };
    const saving = form.handleSubmit();
    assert.equal(await store.closeSession('two'), false);

    pending.resolve({ ok: false });
    await saving;
    await sleep(70);

    assert.equal(calls, 1);
    assert.ok(form.submitError.value);
    assert.equal(store.activeSession.cwd, '/old');
    assert.equal(sockets.length, 2);
    assert.match(sockets[1].url, /cwd=%2Fold/);
  });

  await test('opening terminal form clears prior submit error', async () => {
    const props = reactive({ isOpen: false, session: null });
    const { state } = setup(Form, props);
    state.submitError.value = 'old failure';
    props.isOpen = true;
    await nextTick();
    assert.equal(state.submitError.value, '');
  });
} finally {
  await vite.close();
}

process.exitCode = failures ? 1 : 0;
