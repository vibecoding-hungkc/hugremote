import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { test, after } from 'node:test';

// Isolate persistence/config paths; never read real account or SSH credentials.
const home = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'claude-model-test-'));
process.env.HOME = home;
process.env.ALLOWED_ROOT = home;
process.env.WORKSPACE_ROOT = home;
fs.mkdirSync(path.join(home, '.ssh'));
after(() => fs.rmSync(home, { recursive: true, force: true }));
const { ClaudeService, parseNativeModels } = await import('../apps/api/src/services/claudeService.js');

const rows = [
  { value: 'default', resolvedModel: 'Team/Custom-Opus-XL', displayName: 'Default (recommended)', description: 'Native default', supportsEffort: true },
  { value: 'Team/Custom-Opus-XL[1m]', resolvedModel: 'Team/Custom-Opus-XL[1m]', displayName: 'Équipe 🚀', description: 'Native custom description', supportedEffortLevels: ['low', 'high'] },
];
function child() {
  const proc = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
    signals: [] as string[],
    kill(signal: string) { this.signals.push(signal); return true; },
  });
  return proc;
}
function success(requestId: string, models: unknown = rows) {
  return { type: 'control_response', response: { subtype: 'success', request_id: requestId, response: { models } } };
}
function service() {
  const value = new ClaudeService();
  value.serverConfigResolver = () => undefined;
  return value;
}

test('local discovery initializes native metadata without a user message or syntax aliases', async () => {
  const svc = service();
  const proc = child();
  let captured: any[] = [];
  let input = '';
  proc.stdin.on('data', (chunk) => {
    input += chunk.toString();
    const request = JSON.parse(input.trim());
    proc.stdout.write(JSON.stringify(success(request.request_id)) + '\n');
  });
  (svc as any).spawnModelDiscovery = (...args: any[]) => { captured = args; return proc; };
  const result = await svc.getAvailableModels();
  assert.equal(result.source, 'cli');
  assert.equal(result.defaultModel, rows[0].resolvedModel);
  assert.deepEqual(result.models.map(m => m.id), rows.map(m => m.value));
  assert.equal(result.models[0].prefix, 'default');
  assert.deepEqual(result.models[1], { ...rows[1], id: rows[1].value, title: rows[1].displayName, desc: rows[1].description, prefix: rows[1].value });
  assert.deepEqual(captured[1], ['--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '-p', '--no-session-persistence']);
  assert.equal(captured[2].cwd, home);
  assert.equal(captured[2].env.CLAUDE_CODE_CONFIG_PROBE, '1');
  assert.notEqual(captured[2].env.CLAUDE_CODE_ENTRYPOINT, 'claude-vscode');
  assert.deepEqual(captured[2].stdio, ['pipe', 'pipe', 'pipe']);
  assert.deepEqual(JSON.parse(input), { type: 'control_request', request_id: JSON.parse(input).request_id, request: { subtype: 'initialize' } });
  assert.equal(input.split('\n').filter(Boolean).length, 1);
  assert.ok(proc.signals.includes('SIGTERM'));
});

test('discovery correlates nested request IDs and preserves fragmented UTF8', async () => {
  const svc = service();
  const proc = child();
  (svc as any).spawnModelDiscovery = () => proc;
  proc.stdin.on('data', chunk => {
    const request = JSON.parse(chunk.toString());
    proc.stdout.write(JSON.stringify(success('unrelated', [rows[0]])) + '\n');
    proc.stdout.write(JSON.stringify({ ...success('wrong'), response_id: request.request_id }) + '\n');
    const data = Buffer.from(JSON.stringify(success(request.request_id)) + '\n');
    // Deliberately split every byte, including multibyte accent and emoji.
    for (let i = 0; i < data.length; i++) proc.stdout.write(data.subarray(i, i + 1));
  });
  const result = await svc.getAvailableModels();
  assert.equal(result.models[1].title, 'Équipe 🚀');
});

test('protocol failure is explicit, cleaned up, and never cached', async () => {
  const svc = service();
  let attempts = 0;
  const children: ReturnType<typeof child>[] = [];
  (svc as any).spawnModelDiscovery = () => {
    const proc = child(); children.push(proc);
    proc.stdin.on('data', chunk => {
      const { request_id } = JSON.parse(chunk.toString());
      const message = success(request_id);
      if (++attempts === 1) (message.response as any).subtype = 'error';
      proc.stdout.write(JSON.stringify(message) + '\n');
    });
    return proc;
  };
  await assert.rejects(svc.getAvailableModels(), /initialize.*(failed|denied|error)/i);
  assert.ok(children[0].signals.includes('SIGTERM'));
  assert.equal((await svc.getAvailableModels()).models.length, 2);
  assert.equal(attempts, 2);
});

test('silent CLI times out promptly and cleans up streams even without close', async () => {
  const svc = service();
  const proc = child();
  (svc as any).spawnModelDiscovery = () => proc;
  (svc as any).modelDiscoveryTimeoutMs = 20;
  const started = Date.now();
  const result = svc.getAvailableModels();
  const guard = new Promise((_, reject) => setTimeout(() => reject(new Error('test guard: missing discovery timeout')), 150));
  await assert.rejects(Promise.race([result, guard]), /discovery.*timed out/i);
  assert.ok(Date.now() - started < 140);
  assert.ok(proc.signals.includes('SIGTERM'));
  assert.equal(proc.stdout.listenerCount('data'), 0);
  assert.equal(proc.stderr.listenerCount('data'), 0);
  assert.ok(proc.stdin.writableEnded);
});

test('premature exit reports no initialize response instead of waiting or falling back', async () => {
  const svc = service(); const proc = child();
  (svc as any).modelDiscoveryTimeoutMs = 20;
  (svc as any).spawnModelDiscovery = () => proc;
  proc.stdin.on('data', () => proc.emit('close', 1, null));
  await assert.rejects(svc.getAvailableModels(), /no.*initialize.*response/i);
  assert.ok(proc.signals.includes('SIGTERM'));
});

test('malformed JSON, spawn errors and output limits reject explicitly without leaking listeners', async () => {
  for (const failure of ['json', 'spawn', 'stdout-limit', 'stderr-limit', 'stdin']) {
    const svc = service(); const proc = child();
    (svc as any).modelDiscoveryTimeoutMs = 20;
    (svc as any).spawnModelDiscovery = () => proc;
    proc.stdin.on('data', () => {
      if (failure === 'json') proc.stdout.write('{bad JSON}\n');
      if (failure === 'spawn') proc.emit('error', new Error('mock spawn failure'));
      if (failure === 'stdout-limit') proc.stdout.write(Buffer.alloc(1_048_577, 'x'));
      if (failure === 'stderr-limit') proc.stderr.write(Buffer.alloc(1_048_577, 'x'));
      if (failure === 'stdin') proc.stdin.emit('error', new Error('mock write failure'));
    });
    await assert.rejects(svc.getAvailableModels(), /malformed|spawn|output.*limit|write failure/i);
    assert.ok(proc.signals.includes('SIGTERM'));
    assert.equal(proc.stdout.listenerCount('data'), 0);
  }
});

test('SSH discovery uses quoted target cwd and writes only initialize to its channel', async () => {
  const { sshPool } = await import('../apps/api/src/services/sshPool.js');
  const original = sshPool.executeCommand;
  const svc = service();
  const remote = { id: 'remote', type: 'ssh', host: 'example', user: 'tester', port: 22, workspace: "~/project's $(touch nope)" };
  svc.serverConfigResolver = id => id === 'remote' ? remote as any : undefined;
  (svc as any).spawnModelDiscovery = () => { throw new Error('must not launch local CLI for SSH'); };
  const channel = Object.assign(new EventEmitter(), {
    stderr: new PassThrough(), input: '', signals: [] as string[], closed: false,
    write(input: string) {
      this.input += input;
      const { request_id } = JSON.parse(input);
      queueMicrotask(() => channel.emit('data', Buffer.from(JSON.stringify(success(request_id)) + '\n')));
      return true;
    },
    end() { return this; }, signal(signal: string) { this.signals.push(signal); }, close() { this.closed = true; },
  });
  let command = ''; let target: unknown;
  sshPool.executeCommand = (async (server: unknown, cmd: string) => { target = server; command = cmd; return channel; }) as any;
  try {
    const result = await svc.getAvailableModels('remote');
    assert.deepEqual(result.models.map(m => m.id), rows.map(m => m.value));
    assert.equal(target, remote);
    assert.ok(command.includes('CLAUDE_CODE_CONFIG_PROBE=1'));
    assert.ok(command.includes('cd -- "$HOME"/\'project\'\\\'\'s $(touch nope)\''));
    for (const arg of ['--input-format', 'stream-json', '--output-format', '--verbose', '-p', '--no-session-persistence']) assert.ok(command.includes(`'${arg}'`));
    assert.doesNotMatch(command, /\/model|--resume|claude-vscode|settings\.json/);
    assert.equal(JSON.parse(channel.input).request.subtype, 'initialize');
    assert.equal(channel.input.split('\n').filter(Boolean).length, 1);
    assert.ok(channel.signals.includes('TERM'));
    assert.ok(channel.closed);
  } finally { sshPool.executeCommand = original; }
});

test('unknown targets reject without launching or returning a cached local list', async () => {
  const svc = service(); let launched = false;
  (svc as any).spawnModelDiscovery = () => { launched = true; throw new Error('local launch forbidden'); };
  await assert.rejects(svc.getAvailableModels('unknown'), /unknown.*target/i);
  assert.equal(launched, false);
});

test('cache is scoped by canonical project cwd and CLI identity, with refresh and no failure caching', async () => {
  const svc = service(); let launches = 0; const seen: string[] = [];
  const project = path.join(home, 'project'); fs.mkdirSync(project);
  const link = path.join(home, 'project-link'); fs.symlinkSync(project, link);
  const bin = path.join(home, 'claude-test'); fs.writeFileSync(bin, 'stub');
  (svc as any).spawnModelDiscovery = (_bin: string, _args: string[], options: any) => {
    launches++; seen.push(options.cwd);
    const proc = child();
    proc.stdin.on('data', chunk => proc.stdout.write(JSON.stringify(success(JSON.parse(chunk.toString()).request_id)) + '\n'));
    return proc;
  };
  await svc.getAvailableModels();
  await svc.getAvailableModels(); assert.equal(launches, 1);
  await svc.getAvailableModels(undefined, false, project); assert.equal(launches, 2);
  await svc.getAvailableModels(undefined, false, link); assert.equal(launches, 2);
  await svc.getAvailableModels(undefined, true, project); assert.equal(launches, 3);
  const previousBin = process.env.CLAUDE_BIN_PATH;
  try {
    process.env.CLAUDE_BIN_PATH = bin;
    await svc.getAvailableModels(undefined, false, project); assert.equal(launches, 4);
  } finally {
    if (previousBin === undefined) delete process.env.CLAUDE_BIN_PATH; else process.env.CLAUDE_BIN_PATH = previousBin;
  }
  assert.deepEqual(seen, [home, project, project, project]);
});

test('local cwd validates directory existence and allowed-root symlink containment before launch', async () => {
  const svc = service(); let launched = false;
  (svc as any).spawnModelDiscovery = () => { launched = true; throw new Error('must validate cwd first'); };
  const file = path.join(home, 'not-directory'); fs.writeFileSync(file, '');
  fs.symlinkSync('/', path.join(home, 'outside-link'));
  for (const invalid of [path.join(home, 'missing'), file, '/', path.join(home, 'outside-link'), 'bad\0path']) {
    await assert.rejects(svc.getAvailableModels(undefined, true, invalid), /cwd|directory|allowed root/i);
  }
  assert.equal(launched, false);
});

test('SSH channel acquisition timeout rejects promptly and closes a late channel', async () => {
  const { sshPool } = await import('../apps/api/src/services/sshPool.js');
  const original = sshPool.executeCommand; const svc = service();
  svc.serverConfigResolver = () => ({ id: 'remote', type: 'ssh', host: 'test' } as any);
  (svc as any).modelDiscoveryTimeoutMs = 20;
  let release!: (channel: any) => void; let closed = false;
  sshPool.executeCommand = (() => new Promise(resolve => { release = resolve; })) as any;
  const result = svc.getAvailableModels('remote');
  const guard = new Promise((_, reject) => setTimeout(() => reject(new Error('test guard: missing channel timeout')), 100));
  try {
    await assert.rejects(Promise.race([result, guard]), /discovery.*timed out/i);
  } finally {
    release({ signal() {}, close() { closed = true; } });
    await new Promise(resolve => setImmediate(resolve));
    sshPool.executeCommand = original;
  }
  assert.ok(closed);
});

test('local cleanup escalates when CLI ignores SIGTERM, but not after close', async () => {
  const svc = service(); const proc = child();
  (svc as any).modelDiscoveryTimeoutMs = 10;
  (svc as any).modelDiscoveryKillGraceMs = 10;
  (svc as any).spawnModelDiscovery = () => proc;
  await assert.rejects(svc.getAvailableModels(), /timed out/);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual(proc.signals, ['SIGTERM', 'SIGKILL']);
});

test('final correlated response without newline is parsed at close', async () => {
  const svc = service(); const proc = child();
  (svc as any).spawnModelDiscovery = () => proc;
  proc.stdin.on('data', chunk => {
    proc.stdout.write(JSON.stringify(success(JSON.parse(chunk.toString()).request_id)));
    proc.emit('close', 0, null);
  });
  assert.equal((await svc.getAvailableModels()).models[1].title, 'Équipe 🚀');
});

test('native rows reject malformed data and never accept syntax-help aliases', () => {
  for (const invalid of [undefined, null, [], ['opus', 'sonnet'], 'Available: opus, sonnet',
    [rows[0], { value: 'opus', displayName: 4, description: '' }],
    [rows[0], { value: '', displayName: 'Empty', description: '' }],
    [rows[0], { ...rows[1], description: null }],
    [rows[0], { ...rows[1], disabled: 'false' }],
    [rows[0], { ...rows[1], resolvedModel: 4 }],
    [rows[1]], [{ ...rows[0], resolvedModel: undefined }], [rows[0], rows[0]],
  ]) assert.throws(() => parseNativeModels(invalid), /native.*model|model.*native/i);
  assert.deepEqual(parseNativeModels([rows[0]]).models.map(m => m.id), ['default']);
  assert.deepEqual(parseNativeModels([...rows, { ...rows[1], value: 'opus', disabled: true }]).models.map(m => m.id), ['default', rows[1].value, 'opus']);
});
