import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { after, test } from 'node:test';

// Persistence paths are computed at import time: never use the developer's HOME.
const home = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'claude-sse-test-'));
process.env.HOME = home;
process.env.WORKSPACE_ROOT = home;
process.env.ALLOWED_ROOT = home;
process.env.AUTH_MODE = 'none';
process.env.BASE_PATH = '';
fs.mkdirSync(path.join(home, '.ssh'));
const { createApp } = await import('../apps/api/src/app.js');
const { claudeService } = await import('../apps/api/src/services/claudeService.js');
const { sessionManager } = await import('../apps/api/src/services/sessionManager.js');
const { tempZipService } = await import('../apps/api/src/services/tempZipService.js');
after(() => {
  clearInterval((sessionManager as any).cleanupInterval);
  clearInterval((tempZipService as any).cleanupTimer);
  fs.rmSync(home, { recursive: true, force: true });
});

async function waitFor(predicate: () => boolean, message: string, timeout = 1000) {
  const deadline = Date.now() + timeout;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(predicate(), message);
}

async function fixture() {
  const task = {
    status: 'running', liveMessage: { id: 'assistant', sender: 'assistant', text: 'snapshot' },
    listeners: new Set<(event: any) => void>(),
  };
  const session = { id: 'fixture', messages: [task.liveMessage], contextTokens: '123' };
  const originals = {
    getSession: claudeService.getSession, addMessage: claudeService.addMessage,
    startBackgroundPrompt: claudeService.startBackgroundPrompt, getTask: claudeService.getTask,
  };
  claudeService.getSession = (() => session) as any;
  claudeService.addMessage = (() => session) as any;
  claudeService.startBackgroundPrompt = (() => task) as any;
  claudeService.getTask = (() => task) as any;
  const heartbeatTimers: NodeJS.Timeout[] = [];
  const originalSetInterval = globalThis.setInterval;
  globalThis.setInterval = ((callback: any, delay: number, ...args: any[]) => {
    const timer = originalSetInterval(callback, delay, ...args);
    if (delay === 15_000) heartbeatTimers.push(timer);
    return timer;
  }) as typeof setInterval;
  const app = await createApp();
  const lifecycle = { requestCloses: 0, responseCloses: 0, requestComplete: false };
  app.addHook('onRequest', async (request, reply) => {
    request.raw.on('close', () => lifecycle.requestCloses++);
    reply.raw.on('close', () => lifecycle.responseCloses++);
  });
  app.addHook('preHandler', async request => { lifecycle.requestComplete = request.raw.complete; });
  const origin = await app.listen({ port: 0, host: '127.0.0.1' });
  const clients: Array<{ request: http.ClientRequest; response?: http.IncomingMessage }> = [];
  async function connect(method: 'POST' | 'GET') {
    const suffix = method === 'POST' ? '/messages/stream' : '/stream';
    let text = '';
    let ended = false;
    const client: (typeof clients)[number] = { request: undefined as any };
    const responsePromise = new Promise<http.IncomingMessage>((resolve, reject) => {
      client.request = http.request(`${origin}/api/claude/sessions/fixture${suffix}`, {
        method, headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
      }, response => {
        client.response = response;
        response.setEncoding('utf8');
        response.on('data', chunk => { text += chunk; });
        response.on('end', () => { ended = true; });
        response.on('error', () => {}); // Expected when the test aborts a reader.
        resolve(response);
      });
      client.request.on('error', reject);
      clients.push(client);
      client.request.end(method === 'POST' ? JSON.stringify({ prompt: 'fixture only' }) : undefined);
    });
    const response = await responsePromise;
    assert.equal(response.statusCode, 200);
    assert.match(String(response.headers['content-type']), /text\/event-stream/);
    return { get text() { return text; }, get ended() { return ended; }, abort() { response.destroy(); client.request.destroy(); } };
  }
  return {
    task, lifecycle, connect, heartbeatTimers,
    emit(event: any) { for (const listener of task.listeners) listener(event); },
    async close() {
      for (const client of clients) { client.response?.destroy(); client.request.destroy(); }
      await app.close();
      Object.assign(claudeService, originals);
      globalThis.setInterval = originalSetInterval;
      for (const timer of heartbeatTimers) clearInterval(timer);
    },
  };
}

for (const method of ['POST', 'GET'] as const) {
  test(`${method}: request completion preserves delayed live events until finish`, async () => {
    const h = await fixture();
    try {
      const stream = await h.connect(method);
      await waitFor(() => stream.text.includes('"type":"sync"'), 'initial snapshot arrives');
      assert.equal(h.lifecycle.requestComplete, true, 'incoming request was fully received');
      if (method === 'POST') await waitFor(() => h.lifecycle.requestCloses === 1, 'POST request close already fired');
      console.log(`${method}: request closed=${h.lifecycle.requestCloses}, response closed=${h.lifecycle.responseCloses}, subscribers=${h.task.listeners.size}`);
      assert.equal(h.lifecycle.responseCloses, 0, 'response remains open after request completion');
      assert.equal(h.task.listeners.size, 1, 'request completion must not unsubscribe the live response');
      await new Promise(resolve => setTimeout(resolve, 30));
      h.emit({ type: 'text_delta', text: 'delayed live text' });
      await waitFor(() => stream.text.includes('delayed live text'), 'live delta follows snapshot');
      h.emit({ type: 'done', text: 'model turn done' });
      await waitFor(() => stream.text.includes('model turn done'), 'intermediate done arrives');
      assert.equal(stream.ended, false, 'done while task is running is not terminal');
      h.task.status = 'done';
      h.emit({ type: 'finish', assistantMessage: h.task.liveMessage });
      await waitFor(() => stream.ended, 'finish closes the stream');
      assert.match(stream.text, /"type":"finish"/);
      assert.match(stream.text, /data: \[DONE\]\n\n/);
      await waitFor(() => h.task.listeners.size === 0, 'terminal response removes subscription');
      assert.ok(h.heartbeatTimers.every(timer => (timer as any)._destroyed), 'terminal response clears heartbeat');
    } finally { await h.close(); }
  });

  test(`${method}: abort only detaches the response; background task continues`, async () => {
    const h = await fixture();
    try {
      const stream = await h.connect(method);
      await waitFor(() => stream.text.includes('"type":"sync"'), 'snapshot arrives');
      assert.equal(h.task.listeners.size, 1);
      stream.abort();
      await waitFor(() => h.lifecycle.responseCloses === 1, 'server sees response disconnect');
      await waitFor(() => h.task.listeners.size === 0, 'aborted response unsubscribes');
      assert.ok(h.heartbeatTimers.every(timer => (timer as any)._destroyed), 'abort clears heartbeat');
      assert.equal(h.task.status, 'running', 'disconnect does not cancel task');
      h.task.liveMessage.text += ' generated after disconnect';
      h.emit({ type: 'text_delta', text: 'generated after disconnect' });
      const resumed = await h.connect('GET');
      await waitFor(() => resumed.text.includes('generated after disconnect'), 'reconnect receives progressed snapshot');
      h.task.status = 'done';
      h.emit({ type: 'finish', assistantMessage: h.task.liveMessage });
      await waitFor(() => resumed.ended, 'resumed stream finishes');
    } finally { await h.close(); }
  });
}

test('idle POST and GET responses send heartbeat comments and release timers on abort', async () => {
  const h = await fixture();
  try {
    const streams = await Promise.all([h.connect('POST'), h.connect('GET')]);
    await waitFor(() => streams.every(stream => stream.text.includes(': heartbeat\n\n')),
      'both idle responses receive the real 15-second heartbeat', 17_000);
    assert.equal(h.heartbeatTimers.length, 2);
    for (const stream of streams) stream.abort();
    await waitFor(() => h.task.listeners.size === 0, 'all idle subscribers detach');
    assert.ok(h.heartbeatTimers.every(timer => (timer as any)._destroyed));
    assert.equal(h.task.status, 'running');
  } finally { await h.close(); }
});

for (const status of ['done', 'error', 'cancelled']) {
  test(`GET: terminal ${status} snapshot closes without subscribing`, async () => {
    const h = await fixture();
    try {
      h.task.status = status;
      const stream = await h.connect('GET');
      await waitFor(() => stream.ended, 'terminal stream closes');
      assert.match(stream.text, new RegExp(`"status":"${status}"`));
      assert.match(stream.text, /data: \[DONE\]/);
      assert.equal(h.task.listeners.size, 0);
    } finally { await h.close(); }
  });
}
