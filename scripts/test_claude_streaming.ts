import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { test, after } from 'node:test';

// Set HOME before importing modules which compute their persistence paths.
const home = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'claude-stream-test-'));
process.env.HOME = home;
process.env.WORKSPACE_ROOT = home;
process.env.ALLOWED_ROOT = home;
fs.mkdirSync(path.join(home, '.ssh'));
after(() => fs.rmSync(home, { recursive: true, force: true }));
const { ClaudeService } = await import('../apps/api/src/services/claudeService.js');

type Event = import('../apps/api/src/services/claudeService.js').ClaudeStreamEvent;
async function harness(remote = false, model = 'Default') {
  const service = new ClaudeService();
  let stdinText = '';
  const stdin = new PassThrough();
  stdin.on('data', (chunk) => { stdinText += chunk.toString(); });
  const child = Object.assign(new EventEmitter(), {
    stdin, stdout: new PassThrough(), stderr: new PassThrough(), kill() {},
  });
  let args: string[] = [];
  const capture = (...values: any[]) => { args = values[remote ? 2 : 1]; return child; };
  (service as any).spawnLocalClaude = capture;
  (service as any).spawnRemoteClaude = capture;
  service.serverConfigResolver = id => id === 'remote' ? ({
    id: 'remote', name: 'remote', type: 'ssh', label: 'test', host: 'unused', user: 'test', port: 22,
  }) : undefined;
  const session = {
    id: 'test-session', name: 'test', cwd: home, serverId: remote ? 'remote' : 'server-local',
    messages: [], model, mode: 'Auto', createdAt: 0, updatedAt: 0,
    contextTokens: undefined as string | undefined,
  };
  const events: Event[] = [];
  const result = service.streamClaudePrompt(session as any, 'test prompt', event => events.push(event));
  await new Promise(resolve => setImmediate(resolve));
  return {
    service, session, child, args, events, result,
    get stdinText() { return stdinText; },
    send: (obj: unknown) => child.stdout.write(JSON.stringify(obj) + '\n'),
    close: (code = 0, signal: string | null = null) => child.emit('close', code, signal),
  };
}
const start = (id: string) => ({ type: 'stream_event', event: { type: 'message_start', message: { id, content: [] } } });
const block = (index: number, content_block: any) => ({ type: 'stream_event', event: { type: 'content_block_start', index, content_block } });
const delta = (index: number, text: string, thinking = false) => ({ type: 'stream_event', event: {
  type: 'content_block_delta', index, delta: thinking ? { type: 'thinking_delta', thinking: text } : { type: 'text_delta', text },
} });
const snapshot = (id: string, content: any[]) => ({ type: 'assistant', message: { id, content } });
const text = (events: Event[]) => events.reduce((value, e) => e.type === 'content_sync' ? e.text : e.type === 'text_delta' ? value + e.text : value, '');

test('text arrives before the assistant snapshot and its snapshot is not doubled', async () => {
  const h = await harness();
  h.send(start('m1'));
  h.send(block(0, { type: 'text', text: '' }));
  h.send(delta(0, 'Hel'));
  assert.equal(text(h.events), 'Hel', 'partial text must arrive before snapshot');
  h.send(delta(0, 'lo'));
  h.send({ type: 'stream_event', event: { type: 'content_block_stop', index: 0 } });
  h.send({ type: 'stream_event', event: { type: 'message_stop' } });
  h.send(snapshot('m1', [{ type: 'text', text: 'Hello' }]));
  h.send(snapshot('m1', [{ type: 'text', text: 'Hello' }]));
  assert.equal(text(h.events), 'Hello');
  h.close();
  assert.equal((await h.result).text, 'Hello');
});

test('thinking streams immediately and interleaved block snapshots reconcile independently', async () => {
  const h = await harness();
  h.send(start('thinking-message'));
  h.send(block(0, { type: 'thinking', thinking: 'First ' }));
  assert.equal(h.events.filter(e => e.type === 'thinking_start').length, 1);
  assert.deepEqual(h.events.filter(e => e.type === 'thinking').map(e => e.text), ['First ']);
  h.send(block(1, { type: 'text', text: 'Answer ' }));
  h.send(delta(0, 'reason', true));
  h.send(delta(1, 'one'));
  h.send(block(2, { type: 'text', text: ' / ' }));
  h.send(delta(2, 'two'));
  h.send(delta(1, '!'));
  h.send({ type: 'stream_event', event: { type: 'content_block_stop', index: 0 } });
  h.send({ type: 'stream_event', event: { type: 'message_stop' } });
  h.send(snapshot('thinking-message', [
    { type: 'thinking', thinking: 'First reason' },
    { type: 'text', text: 'Answer one!' },
    { type: 'text', text: ' / two' },
  ]));
  assert.equal(h.events.filter(e => e.type === 'content_sync').at(-1)?.text, 'Answer one! / two');
  assert.equal(h.events.filter(e => e.type === 'thinking').map(e => e.text).join(''), 'First reason');
  h.close();
  assert.equal((await h.result).thinking, 'First reason');
});

test('repeated tool turns preserve identical text and tools use complete snapshot input once', async () => {
  const h = await harness();
  for (const id of ['turn1', 'turn2']) {
    h.send(start(id));
    h.send(block(0, { type: 'text', text: '' }));
    h.send(delta(0, 'Same answer'));
    h.send(block(1, { type: 'tool_use', id: `tool-${id}`, name: 'Bash', input: {} }));
    h.send({ type: 'stream_event', event: { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"command":' } } });
    assert.equal(h.events.filter(e => e.type === 'tool_use').length, id === 'turn1' ? 0 : 1);
    const complete = snapshot(id, [
      { type: 'text', text: 'Same answer' },
      { type: 'tool_use', id: `tool-${id}`, name: 'Bash', input: { command: 'printf complete' } },
    ]);
    h.send(complete);
    h.send(complete);
    h.send({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: `tool-${id}`, content: 'complete' }] } });
  }
  assert.equal(text(h.events), 'Same answerSame answer');
  assert.equal(h.events.filter(e => e.type === 'tool_use').length, 2);
  h.close();
  const result = await h.result;
  assert.equal(result.tools?.length, 2);
  assert.ok(result.tools?.every(t => t.content === 'printf complete' && t.output === 'complete' && t.status === 'done'));
});

test('snapshot-only messages still emit text and thinking across separate IDs', async () => {
  const h = await harness();
  h.send(snapshot('old1', [{ type: 'thinking', thinking: 'reason' }, { type: 'text', text: 'same' }]));
  h.send(snapshot('old2', [{ type: 'thinking', thinking: 'reason' }, { type: 'text', text: 'same' }]));
  h.close();
  assert.equal(text(h.events), 'samesame');
  assert.equal((await h.result).thinking, 'reasonreason');
});

test('trailing JSON without newline is handled through the same parser on close', async () => {
  for (const trailing of [
    snapshot('trailing', [{ type: 'text', text: 'tail' }]),
    { type: 'result', result: 'tail', usage: { input_tokens: 1000, output_tokens: 5 } },
  ]) {
    const h = await harness();
    h.child.stdout.write(JSON.stringify(trailing));
    h.close();
    assert.equal((await h.result).text, 'tail');
    if (trailing.type === 'assistant') assert.equal(text(h.events), 'tail');
    else {
      assert.equal(h.session.contextTokens, '1.0k');
      assert.equal(h.events.filter(e => e.type === 'done').length, 1);
    }
  }
});

test('UTF8 survives byte boundaries in stdout and stderr', async () => {
  const unicode = 'Tiếng Việt 🧑‍💻';
  const h = await harness();
  const bytes = Buffer.from(JSON.stringify(snapshot('utf8', [{ type: 'text', text: unicode }])) + '\n');
  for (const byte of bytes) h.child.stdout.write(Buffer.from([byte]));
  h.close();
  assert.equal((await h.result).text, unicode);
  assert.equal(text(h.events), unicode);
  const error = await harness();
  for (const byte of Buffer.from(unicode)) error.child.stderr.write(Buffer.from([byte]));
  error.close(1);
  assert.ok((await error.result).text.includes(unicode));
});

test('single-block snapshots reconcile the streamed index after a thinking block', async () => {
  const h = await harness();
  h.send(start('split'));
  h.send(block(0, { type: 'thinking', thinking: '' }));
  h.send(delta(0, 'reason', true));
  h.send({ ...snapshot('split', [{ type: 'thinking', thinking: 'reason' }]), uuid: 'thinking-snapshot' });
  h.send(block(1, { type: 'text', text: '' }));
  h.send(delta(1, 'long answer'));
  const complete = { ...snapshot('split', [{ type: 'text', text: 'long answer' }]), uuid: 'text-snapshot' };
  h.send(complete);
  h.send(complete);
  h.close();
  assert.equal(text(h.events), 'long answer');
  assert.equal((await h.result).thinking, 'reason');
});

test('interleaved parent tool namespaces keep message and block state separate', async () => {
  const h = await harness();
  const root = (obj: any) => h.send({ ...obj, parent_tool_use_id: null });
  const child = (obj: any) => h.send({ ...obj, parent_tool_use_id: 'parent-tool' });
  root(start('shared-id'));
  root(block(0, { type: 'text', text: '' }));
  child(start('shared-id'));
  child(block(0, { type: 'text', text: '' }));
  root(delta(0, 'root'));
  child(delta(0, 'child'));
  child({ type: 'stream_event', event: { type: 'message_stop' } });
  root(delta(0, '!'));
  root(snapshot('shared-id', [{ type: 'text', text: 'root!' }]));
  child(snapshot('shared-id', [{ type: 'text', text: 'child' }]));
  h.close();
  assert.equal(text(h.events), 'root!');
  assert.equal((await h.result).text, 'root!');
});

test('authoritative snapshots correct equal, shorter and non-prefix text', async () => {
  for (const finalText of ['right', 'ok', 'different answer']) {
    const h = await harness();
    h.send(start('correction'));
    h.send(block(0, { type: 'text', text: '' }));
    h.send(delta(0, 'wrong'));
    h.send(snapshot('correction', [{ type: 'text', text: finalText }]));
    assert.equal(text(h.events), finalText);
    assert.equal(h.events.filter(e => e.type === 'content_sync').length, 1);
    h.close();
    assert.equal((await h.result).text, finalText);
  }
});

test('replacement message_start retires only uncommitted streamed attempts', async () => {
  const h = await harness();
  h.send(start('tool-turn'));
  h.send(block(0, { type: 'text', text: 'kept ' }));
  h.send(snapshot('tool-turn', [{ type: 'text', text: 'kept ' }]));
  h.send({ type: 'stream_event', event: { type: 'message_stop' } });
  h.send(start('abandoned'));
  h.send(block(0, { type: 'text', text: 'discard' }));
  h.send(start('replacement'));
  h.send(block(0, { type: 'text', text: 'replacement' }));
  h.send(snapshot('replacement', [{ type: 'text', text: 'replacement' }]));
  h.close();
  assert.equal(text(h.events), 'kept replacement');
  assert.equal((await h.result).text, 'kept replacement');
});

test('replacement discards uncommitted text even after thinking was committed', async () => {
  const h = await harness();
  h.send(start('mixed-attempt'));
  h.send(block(0, { type: 'thinking', thinking: 'committed reasoning' }));
  h.send(snapshot('mixed-attempt', [{ type: 'thinking', thinking: 'committed reasoning' }]));
  h.send(block(1, { type: 'text', text: 'DISCARD' }));
  h.send(start('replacement'));
  assert.equal(text(h.events), '', 'uncommitted text must retire independently from committed thinking');
  h.send(block(0, { type: 'text', text: 'replacement' }));
  h.send(snapshot('replacement', [{ type: 'text', text: 'replacement' }]));
  h.close();
  const result = await h.result;
  assert.equal(result.text, 'replacement');
  assert.equal(result.thinking, 'committed reasoning');
});

test('nonzero exit emits error even after partial content', async () => {
  const h = await harness();
  h.send(start('failed'));
  h.send(block(0, { type: 'text', text: 'partial' }));
  h.child.stderr.write('provider failed');
  h.close(1);
  assert.ok(h.events.some(e => e.type === 'error' && e.error.includes('provider failed')));
  assert.ok((await h.result).text.includes('provider failed'));
});

test('result usage, tool errors, spawn errors and cancellation remain supported', async () => {
  const h = await harness();
  h.send(snapshot('tools', [{ type: 'tool_use', id: 'bad-tool', name: 'Bash', input: { command: 'false' } }]));
  h.send({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'bad-tool', content: 'failed', is_error: true }] } });
  h.send({ type: 'result', result: 'answer', modelUsage: { model: { inputTokens: 1000, outputTokens: 20 } } });
  h.close();
  assert.equal((await h.result).tools?.[0].status, 'error');
  assert.equal(h.session.contextTokens, '1.0k');
  assert.ok(h.events.some(e => e.type === 'done' && e.text === 'answer'));
  const cancelled = await harness();
  cancelled.send(snapshot('cancel', [{ type: 'tool_use', id: 'running-tool', name: 'Bash', input: { command: 'sleep 60' } }]));
  cancelled.close(null as any, 'SIGTERM');
  assert.equal((await cancelled.result).tools?.[0].status, 'error');
  assert.ok(cancelled.events.some(e => e.type === 'done' && e.text === 'Đã dừng yêu cầu.'));
  const failed = await harness();
  failed.child.emit('error', new Error('spawn test failure'));
  assert.ok((await failed.result).text.includes('spawn test failure'));
  assert.ok(failed.events.some(e => e.type === 'error'));
});

test('snapshot-only split blocks preserve thinking and multiple same-type blocks', async () => {
  const h = await harness();
  h.send({ ...snapshot('split-only', [{ type: 'thinking', thinking: 'reason' }]), uuid: 's1' });
  h.send({ ...snapshot('split-only', [{ type: 'text', text: 'first' }]), uuid: 's2' });
  h.send({ ...snapshot('split-only', [{ type: 'text', text: 'second' }]), uuid: 's3' });
  h.close();
  const result = await h.result;
  assert.equal(result.text, 'firstsecond');
  assert.equal(result.thinking, 'reason');
});

test('native model values are passed exactly; Default omits model and legacy titles still work', async () => {
  for (const remote of [false, true]) {
    for (const [selection, expected] of [
      ['Default Medium', null], ['opus High', 'opus'], ['sonnet[1m] Medium', 'sonnet[1m]'],
      ['Team/Custom-Opus-XL High', 'Team/Custom-Opus-XL'], ['default-special Low', 'default-special'],
      ['Sonnet 5.5 Medium', 'sonnet'], ['Haiku High', 'haiku'],
    ] as const) {
      const h = await harness(remote, selection);
      h.send(snapshot('selected', [{ type: 'text', text: 'ok' }]));
      h.close();
      await h.result;
      const idx = h.args.indexOf('--model');
      assert.equal(idx === -1 ? null : h.args[idx + 1], expected, selection);
      const effort = selection.split(' ').at(-1)!.toLowerCase();
      assert.equal(h.args[h.args.indexOf('--effort') + 1], effort);
    }
  }
});

test('local and SSH invocations use SDK duplex stream-json and send the prompt over stdin', async () => {
  for (const remote of [false, true]) {
    const h = await harness(remote);
    assert.ok(h.args.includes('--include-partial-messages'), `${remote ? 'SSH' : 'local'} missing partial flag`);
    assert.equal(h.args[h.args.indexOf('--input-format') + 1], 'stream-json');
    assert.equal(h.args[h.args.indexOf('--output-format') + 1], 'stream-json');
    assert.equal(h.args.includes('test prompt'), false, 'prompt must not be passed as argv');
    assert.equal(h.args.at(0), '-p');

    const frames = h.stdinText.split('\n').filter(Boolean).map(line => JSON.parse(line));
    assert.equal(frames.length, 1);
    assert.deepEqual(frames[0], {
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'text', text: 'test prompt' }]
      }
    });

    h.send(snapshot('m', [{ type: 'text', text: 'ok' }]));
    h.close();
    await h.result;
  }
});

test('live background task forwards native interaction and exact response through child stdin', async () => {
  const service = new ClaudeService();
  let stdinText = '';
  const stdin = new PassThrough();
  stdin.on('data', (chunk) => { stdinText += chunk.toString(); });
  const child = Object.assign(new EventEmitter(), {
    stdin,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill() {},
  });
  (service as any).spawnLocalClaude = () => child;

  const session = {
    id: 'session-live-interaction',
    serverId: 'server-local',
    name: 'test',
    cwd: process.cwd(),
    model: 'Default',
    mode: 'Auto',
    bypassPermissions: false,
    timer: '60m',
    contextTokens: '0',
    messages: [],
    updatedAt: Date.now(),
  } as any;

  const task = service.startBackgroundPrompt(session, 'test prompt');
  await new Promise(resolve => setImmediate(resolve));
  child.stdout.write(JSON.stringify({
    type: 'control_request',
    request_id: 'request-live-1',
    request: {
      subtype: 'can_use_tool',
      tool_name: 'Bash',
      input: { command: 'printf fixture' },
    },
  }) + '\n');
  await new Promise(resolve => setImmediate(resolve));

  const requested = task.events.find((event) => event.type === 'interaction_requested');
  assert.equal(requested?.interaction?.interactionId, 'request-live-1');
  assert.equal(requested?.interaction?.status, 'pending');
  assert.equal(requested?.interaction?.request?.tool_name, 'Bash');

  assert.equal(service.respondInteraction(session.id, 'request-live-1', { behavior: 'allow' }), true);
  const frames = stdinText.split('\n').filter(Boolean).map(line => JSON.parse(line));
  assert.deepEqual(frames[0], {
    type: 'user',
    message: {
      role: 'user',
      content: [{ type: 'text', text: 'test prompt' }],
    },
  });
  assert.deepEqual(frames[1], {
    type: 'control_response',
    response: {
      subtype: 'success',
      request_id: 'request-live-1',
      response: { behavior: 'allow' },
    },
  });
  assert.equal(task.events.at(-1)?.type, 'interaction_responded');
  assert.equal(task.liveMessage.interactions?.[0]?.status, 'responded');

  child.stdout.write(JSON.stringify({ type: 'result', result: 'done' }) + '\n');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stdin.writableEnded, true, 'terminal result must close duplex stdin');
  child.emit('close', 0, null);
  await task.promise;
});

test('cancelling a live task terminally cancels pending interactions', async () => {
  const service = new ClaudeService();
  const stdin = new PassThrough();
  const child = Object.assign(new EventEmitter(), {
    stdin,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    killed: false,
    kill() { this.killed = true; },
  });
  (service as any).spawnLocalClaude = () => child;

  const session = {
    id: 'session-live-cancel', serverId: 'server-local', name: 'test', cwd: process.cwd(),
    model: 'Default', mode: 'Auto', bypassPermissions: false, timer: '60m',
    contextTokens: '0', messages: [], updatedAt: Date.now(),
  } as any;
  const task = service.startBackgroundPrompt(session, 'cancel fixture');
  await new Promise(resolve => setImmediate(resolve));
  child.stdout.write(JSON.stringify({
    type: 'control_request', request_id: 'request-cancel-live',
    request: { subtype: 'can_use_tool', tool_name: 'Edit', input: { file_path: 'fixture.txt' } },
  }) + '\n');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(task.liveMessage.interactions?.[0]?.status, 'pending');

  assert.equal(service.cancelRun(session.id), true);
  assert.equal(task.status, 'cancelled');
  assert.equal(task.liveMessage.interactions?.[0]?.status, 'cancelled');
  assert.equal(task.events.at(-1)?.type, 'interaction_cancelled');

  child.emit('close', null, 'SIGINT');
  await task.promise;
  assert.equal(task.status, 'cancelled', 'completion handler must not overwrite cancelled terminal state');
});

test('M5 LOGIC-001: cancel during in-flight remote spawn prevents prompt write and stops child', async () => {
  const service = new ClaudeService();
  service.setServerConfigResolver(() => ({
    id: 'server-ssh-test',
    name: 'ssh-test',
    label: 'Remote SSH',
    type: 'ssh',
    host: 'example.invalid',
    user: 'root',
    port: 22,
  }));

  let remoteSpawnResolve: (handle: any) => void = () => {};
  const remoteSpawnPromise = new Promise((resolve) => { remoteSpawnResolve = resolve; });
  (service as any).spawnRemoteClaude = () => remoteSpawnPromise;

  const session = {
    id: 'session-ssh-cancel-inflight',
    serverId: 'server-ssh-test',
    name: 'test',
    cwd: '/root',
    model: 'Default',
    mode: 'Auto',
    bypassPermissions: false,
    timer: '60m',
    contextTokens: '0',
    messages: [],
    updatedAt: Date.now(),
  } as any;

  const task = service.startBackgroundPrompt(session, 'ssh prompt');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(task.status, 'running');

  // Cancel while remote spawn is still pending
  const cancelled = service.cancelRun(session.id);
  assert.equal(cancelled, true, 'cancelRun must return true when active task is cancelled');
  assert.equal(task.status, 'cancelled');

  let killedSignal = '';
  let promptWritten = false;
  const stdin = new PassThrough();
  stdin.on('data', () => { promptWritten = true; });
  const remoteHandle = Object.assign(new EventEmitter(), {
    stdin,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill(sig: string) { killedSignal = sig; },
  });

  // Now the async remote spawn resolves
  remoteSpawnResolve(remoteHandle);
  await task.promise;

  assert.equal(promptWritten, false, 'prompt must not be written if task was cancelled before spawn resolved');
  assert.equal(killedSignal, 'SIGTERM', 'remote handle must be terminated if cancelled before spawn resolved');
  assert.equal(task.status, 'cancelled');
});

test('normalized protocol shadow mode is exactly event/result equivalent and isolated from malformed native schemas', async () => {
  const previous = process.env.HUGREMOTE_CLAUDE_NORMALIZED_PROTOCOL;
  const run = async (enabled: boolean) => {
    if (enabled) process.env.HUGREMOTE_CLAUDE_NORMALIZED_PROTOCOL = 'true';
    else delete process.env.HUGREMOTE_CLAUDE_NORMALIZED_PROTOCOL;
    const h = await harness();
    h.send(start('shadow-message'));
    h.send(block(0, { type: 'thinking', thinking: '' }));
    h.send(delta(0, 'reason', true));
    h.send(block(1, { type: 'text', text: '' }));
    h.send(delta(1, 'answer'));
    h.send({ type: 'system', subtype: { malformed: true } });
    h.send(snapshot('shadow-message', [
      { type: 'thinking', thinking: 'reason' },
      { type: 'text', text: 'answer' },
      { type: 'tool_use', id: 'shadow-tool', name: 'Bash', input: { command: 'printf ok' } },
    ]));
    h.send({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'shadow-tool', content: 'ok' }] } });
    h.close();
    return { events: h.events, result: await h.result };
  };
  try {
    const disabled = await run(false);
    const enabled = await run(true);
    assert.deepEqual(enabled, disabled);
    assert.equal(enabled.result.text, 'answer');
    assert.equal(enabled.result.thinking, 'reason');
    assert.equal(enabled.result.tools?.[0]?.output, 'ok');
  } finally {
    if (previous === undefined) delete process.env.HUGREMOTE_CLAUDE_NORMALIZED_PROTOCOL;
    else process.env.HUGREMOTE_CLAUDE_NORMALIZED_PROTOCOL = previous;
  }
});

test('live stdout decoder drops an oversized native record and resumes at the next valid frame', async () => {
  const h = await harness();
  h.child.stdout.write(JSON.stringify({ type: 'unknown', payload: 'x'.repeat(1024 * 1024 + 100) }) + '\n');
  h.send(snapshot('after-oversize', [{ type: 'text', text: 'recovered' }]));
  h.close();
  assert.equal((await h.result).text, 'recovered');
  assert.equal(text(h.events), 'recovered');
});

test('native stdout payload is never reflected into browser errors or final text', async () => {
  const h = await harness();
  const sensitive = 'private-native-payload-must-not-leak';
  h.send({ type: 'future_native_frame', payload: sensitive });
  h.close(1);
  const result = await h.result;
  assert.doesNotMatch(result.text, new RegExp(sensitive));
  assert.doesNotMatch(JSON.stringify(h.events), new RegExp(sensitive));
  assert.match(result.text, /exited with code 1|không trả về kết quả/i);
});
