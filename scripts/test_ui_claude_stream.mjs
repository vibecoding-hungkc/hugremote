import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { documentElement: { lang: '' } };
const vite = await createServer({ root: fileURLToPath(new URL('../apps/web/', import.meta.url)), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { useClaudeStore } = await vite.ssrLoadModule('/src/stores/claudeStore.ts');
  const { useServerStore } = await vite.ssrLoadModule('/src/stores/serverStore.ts');
  const pinia = createPinia(); setActivePinia(pinia);
  const server = useServerStore(pinia);
  server.servers = [{ id: 'server-local', name: 'Fixture', type: 'local', workspace: '/isolated' }];
  server.currentServerId = 'server-local';
  const store = useClaudeStore(pinia);
  const session = { id: 'stream-test', serverId: 'server-local', name: 'Stream', model: 'Default', messages: [], cwd: '/isolated' };
  store.sessions = [session]; store.activeSessionId = session.id;
  const encoder = new TextEncoder();
  let controller;
  const stream = new ReadableStream({ start(c) { controller = c; } });
  const send = (event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  const tick = async () => { await new Promise(resolve => setImmediate(resolve)); await nextTick(); };
  let requests = 0;
  globalThis.fetch = async (url, opts) => {
    requests++;
    if (String(url).endsWith('/messages/stream')) {
      assert.equal(opts.method, 'POST');
      return { ok: true, body: stream };
    }
    assert.equal(opts?.method || 'GET', 'GET');
    return { ok: true, json: async () => ({ sessions: store.sessions }) };
  };
  const pending = store.sendMessage('Explain a prime'); await tick();
  send({ type: 'text_delta', text: 'Số ' }); await tick();
  let live = store.activeSession.messages.at(-1);
  assert.equal(live.text, 'Số '); assert.equal(store.isGenerating, true); assert.equal(live.isWorking, true);
  send({ type: 'text_delta', text: 'nguyên tố' }); await tick();
  assert.equal(live.text, 'Số nguyên tố');
  send({ type: 'thinking_start' }); send({ type: 'thinking', text: 'Thinking live' }); await tick();
  assert.equal(live.thinking, 'Thinking live'); assert.equal(live.isThinking, true);
  send({ type: 'tool_use', tool: { id: 'tool-1', type: 'read', title: 'Read', status: 'running' } });
  send({ type: 'tool_result', tool_use_id: 'tool-1', output: 'file contents', status: 'done' }); await tick();
  assert.equal(live.tools[0].output, 'file contents'); assert.equal(live.tools[0].status, 'done');
  send({ type: 'content_sync', text: 'Canonical corrected answer', thinking: 'Canonical thinking' }); await tick();
  assert.equal(live.text, 'Canonical corrected answer'); assert.equal(live.thinking, 'Canonical thinking');
  assert.equal(live.isWorking, true); assert.equal(live.tools[0].output, 'file contents');
  send({ type: 'done', text: 'Số nguyên tố' }); await tick();
  await pending;
  assert.equal(store.isGenerating, false); assert.equal(live.text, 'Số nguyên tố'); assert.equal(live.isWorking, false);
  controller.close();
  console.log('PASS frontend SSE applies text/thinking/tools before completion and preserves canonical final exactly once');
  console.log(`PASS isolated fetches: ${requests}`);
} finally { await vite.close(); }
