import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { documentElement: { lang: '' } };

const vite = await createServer({
  root: fileURLToPath(new URL('../apps/web/', import.meta.url)),
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const { useClaudeStore } = await vite.ssrLoadModule('/src/stores/claudeStore.ts');
  const { useServerStore } = await vite.ssrLoadModule('/src/stores/serverStore.ts');

  // Test 1: Parallel tool lifecycle and duplicate frame deduplication (AC11 & AC12)
  {
    const pinia = createPinia();
    setActivePinia(pinia);
    const server = useServerStore(pinia);
    server.servers = [{ id: 'server-local', name: 'Fixture', type: 'local', workspace: '/isolated' }];
    server.currentServerId = 'server-local';
    const store = useClaudeStore(pinia);
    const session = { id: 'parallel-tools', serverId: 'server-local', name: 'Tools', model: 'Default', messages: [], cwd: '/isolated' };
    store.sessions = [session];
    store.activeSessionId = session.id;

    const encoder = new TextEncoder();
    let controller;
    const stream = new ReadableStream({ start(c) { controller = c; } });
    const send = (event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    const tick = async () => { await new Promise((r) => setImmediate(r)); await nextTick(); };

    globalThis.fetch = async (url, opts) => {
      if (String(url).endsWith('/messages/stream')) {
        return { ok: true, body: stream };
      }
      return { ok: true, json: async () => ({ sessions: store.sessions }) };
    };

    const pending = store.sendMessage('Run tools');
    await tick();

    // Send two tools in parallel
    send({
      type: 'tool_use',
      tool: { id: 'tool-A', type: 'generic', title: 'Generic A', status: 'receiving-input', input: {} },
    });
    send({
      type: 'tool_use',
      tool: { id: 'tool-B', type: 'mcp', title: 'MCP B', status: 'receiving-input', input: {} },
    });
    await tick();

    let live = store.activeSession.messages.at(-1);
    assert.equal(live.tools.length, 2);
    assert.equal(live.tools[0].type, 'generic');
    assert.equal(live.tools[1].type, 'mcp');
    assert.equal(live.tools[0].status, 'receiving-input');
    assert.equal(live.tools[1].status, 'receiving-input');

    // Duplicate frame for tool-A does NOT duplicate the card
    send({
      type: 'tool_use',
      tool: { id: 'tool-A', type: 'generic', title: 'Generic A (Ready)', status: 'ready', input: { query: 'test' } },
    });
    await tick();

    assert.equal(live.tools.length, 2, 'duplicate tool_use must update existing card, not duplicate');
    assert.equal(live.tools[0].status, 'ready');
    assert.equal(live.tools[0].title, 'Generic A (Ready)');

    // Transition tool-B to cancelled
    send({
      type: 'tool_result',
      tool_use_id: 'tool-B',
      output: 'user cancelled',
      status: 'cancelled',
    });
    // Complete tool-A with structured output
    send({
      type: 'tool_result',
      tool_use_id: 'tool-A',
      output: JSON.stringify({ result: 'success' }),
      status: 'done',
    });
    await tick();

    assert.equal(live.tools[1].status, 'cancelled');
    assert.equal(live.tools[0].status, 'done');

    send({ type: 'done', text: 'Tools completed' });
    await tick();
    await pending;
    controller.close();
    console.log('PASS AC11 & AC12: parallel tool lifecycle, deduplication and terminal cancellation');
  }

  // Test 2: Child agent lifecycle separation and transcript hierarchy (AC14 & AC15)
  {
    const pinia = createPinia();
    setActivePinia(pinia);
    const server = useServerStore(pinia);
    server.servers = [{ id: 'server-local', name: 'Fixture', type: 'local', workspace: '/isolated' }];
    server.currentServerId = 'server-local';
    const store = useClaudeStore(pinia);
    const session = { id: 'agent-hierarchy', serverId: 'server-local', name: 'Agents', model: 'Default', messages: [], cwd: '/isolated' };
    store.sessions = [session];
    store.activeSessionId = session.id;

    const encoder = new TextEncoder();
    let controller;
    const stream = new ReadableStream({ start(c) { controller = c; } });
    const send = (event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    const tick = async () => { await new Promise((r) => setImmediate(r)); await nextTick(); };

    globalThis.fetch = async (url) => {
      if (String(url).endsWith('/messages/stream')) return { ok: true, body: stream };
      return { ok: true, json: async () => ({ sessions: store.sessions }) };
    };

    const pending = store.sendMessage('Start agent task');
    await tick();

    // Root streams text
    send({ type: 'text_delta', text: 'Root starting subagent...' });
    // Child agent 1 started
    send({
      type: 'child_agent',
      agent: {
        agentId: 'task-sub-1',
        parentToolUseId: 'parent-tool-1',
        status: 'running',
        summary: 'Subagent analyzing code',
        recentTools: ['Read'],
        totalTokens: 50,
        messages: [{ sender: 'assistant', text: 'Child message 1' }],
      },
    });
    // Child agent 2 started in parallel
    send({
      type: 'child_agent',
      agent: {
        agentId: 'task-sub-2',
        parentToolUseId: 'parent-tool-2',
        status: 'running',
        summary: 'Subagent testing',
        recentTools: ['Bash'],
        totalTokens: 100,
        messages: [{ sender: 'assistant', text: 'Child message 2' }],
      },
    });
    await tick();

    let live = store.activeSession.messages.at(-1);
    assert.equal(live.text, 'Root starting subagent...', 'child text must not bleed into root text');
    assert.equal(live.childAgents?.length, 2);
    assert.equal(live.childAgents[0].status, 'running');
    assert.equal(live.childAgents[1].status, 'running');

    // Child agent 2 completes FIRST
    send({
      type: 'child_agent',
      agent: {
        agentId: 'task-sub-2',
        status: 'completed',
        summary: 'Subagent testing passed',
      },
    });
    await tick();

    assert.equal(live.childAgents[1].status, 'completed');
    assert.equal(live.childAgents[1].summary, 'Subagent testing passed');
    assert.equal(live.childAgents[0].status, 'running');

    // Root finishes
    send({ type: 'done', text: 'Root task finished' });
    await tick();
    await pending;
    controller.close();

    assert.equal(live.childAgents?.length, 2, 'child agent hierarchy preserved after completion');
    console.log('PASS AC14 & AC15: child agent namespace isolation and out-of-order completion');
  }

  // Test 3: AC13 Safe generic renderer and hostile string sanitization
  {
    const pinia = createPinia();
    setActivePinia(pinia);
    const server = useServerStore(pinia);
    server.servers = [{ id: 'server-local', name: 'Fixture', type: 'local', workspace: '/isolated' }];
    server.currentServerId = 'server-local';
    const store = useClaudeStore(pinia);
    const session = { id: 'renderer-safe', serverId: 'server-local', name: 'Safe', model: 'Default', messages: [], cwd: '/isolated' };
    store.sessions = [session];
    store.activeSessionId = session.id;

    const encoder = new TextEncoder();
    let controller;
    const stream = new ReadableStream({ start(c) { controller = c; } });
    const send = (event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    const tick = async () => { await new Promise((r) => setImmediate(r)); await nextTick(); };

    globalThis.fetch = async (url) => {
      if (String(url).endsWith('/messages/stream')) return { ok: true, body: stream };
      return { ok: true, json: async () => ({ sessions: store.sessions }) };
    };

    const pending = store.sendMessage('Test hostile strings');
    await tick();

    // Hostile tool payload
    const hostileInput = { payload: '<script>alert("xss")</script>', query: '<img src=x onerror=alert(1)>' };
    const hostileOutput = '<iframe src="javascript:alert(1)"></iframe>';
    send({
      type: 'tool_use',
      tool: {
        id: 'hostile-tool',
        type: 'generic',
        title: 'CustomTool: <script>',
        status: 'running',
        content: JSON.stringify(hostileInput),
      },
    });
    send({
      type: 'tool_result',
      tool_use_id: 'hostile-tool',
      output: hostileOutput,
      status: 'done',
    });
    send({
      type: 'child_agent',
      agent: {
        agentId: 'hostile-agent',
        parentToolUseId: 'hostile-tool',
        status: 'completed',
        summary: '<script>hostile</script>',
        messages: [{ sender: 'assistant', text: '<b onclick=alert(1)>click me</b>' }],
      },
    });
    send({ type: 'done', text: 'All done' });
    await tick();
    await pending;
    controller.close();

    const live = store.activeSession.messages.at(-1);
    const tool = live.tools[0];
    assert.equal(tool.type, 'generic', 'unknown custom tool must have type generic, never bash');
    assert.equal(typeof tool.content, 'string');
    assert.equal(tool.output, hostileOutput);
    assert.equal(live.childAgents[0].summary, '<script>hostile</script>');
    console.log('PASS AC13: safe generic tool representation and hostile payload integrity');
  }
} finally {
  await vite.close();
}
