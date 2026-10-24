import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { after, test } from 'node:test';

// Isolate all persistence/config reads from the real Claude account and sessions.
const home = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'claude-context-usage-test-'));
process.env.HOME = home;
process.env.ALLOWED_ROOT = home;
process.env.WORKSPACE_ROOT = home;
fs.mkdirSync(path.join(home, '.ssh'));
after(() => fs.rmSync(home, { recursive: true, force: true }));

const {
  ClaudeService,
  ContextUsageValidationError,
  ContextUsageNotFoundError,
  ContextUsageConcurrencyError,
  parseNativeContextUsage,
} = await import('../apps/api/src/services/claudeService.js');

function child() {
  return Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    signals: [] as string[],
    kill(signal: string) { this.signals.push(signal); return true; },
  });
}

function response(requestId: string, value: unknown = {
  model: 'team/claude-sonnet[1m]', totalTokens: 12_345, maxTokens: 900_000,
  rawMaxTokens: 1_000_000, percentage: 1.37,
}) {
  return { type: 'control_response', response: { subtype: 'success', request_id: requestId, response: value } };
}

function service(session: Partial<any> = {}) {
  const svc = new ClaudeService();
  svc.serverConfigResolver = () => undefined;
  (svc as any).sessions.set('app-session', {
    id: 'app-session', serverId: 'server-local', projectId: '', name: 'chat', cwd: home,
    isCustomNamed: false, model: 'Default', mode: 'Auto', messages: [], updatedAt: Date.now(),
    ...session,
  });
  return svc;
}

async function mockLocalSuccess(svc: any, inspect?: (request: any) => void) {
  const proc = child();
  let captured: any[] = [];
  let input = '';
  proc.stdin.on('data', chunk => {
    input += chunk.toString();
    const request = JSON.parse(input.trim());
    inspect?.(request);
    proc.stdout.write(JSON.stringify(response(request.request_id)) + '\n');
  });
  svc.spawnModelDiscovery = (...args: any[]) => { captured = args; return proc; };
  const result = await svc.getContextUsage('app-session');
  return { result, proc, captured, input };
}

test('summary probe resumes the canonical CLI session with exact no-user local argv', async () => {
  const svc = service({ cliSessionId: 'canonical-resume-id', model: 'Team/Custom-Opus[1m] High' });
  const { result, proc, captured, input } = await mockLocalSuccess(svc);
  assert.deepEqual(captured[1], [
    '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '-p',
    '--no-session-persistence', '--model', 'Team/Custom-Opus[1m]', '--resume', 'canonical-resume-id',
  ]);
  assert.equal(captured[2].cwd, home);
  assert.equal(captured[2].env.CLAUDE_CODE_CONFIG_PROBE, '1');
  assert.deepEqual(JSON.parse(input), {
    type: 'control_request', request_id: JSON.parse(input).request_id,
    request: { subtype: 'get_context_usage', detail: 'summary' },
  });
  assert.equal(input.split('\n').filter(Boolean).length, 1, 'must not send a user message');
  assert.deepEqual(result, {
    source: 'cli', freshness: 'session', sessionSpecific: true,
    model: 'team/claude-sonnet[1m]', totalTokens: 12_345, maxTokens: 900_000,
    rawMaxTokens: 1_000_000, percentage: 1.37,
  });
  assert.ok(proc.signals.includes('SIGTERM'));
});

test('request-provided cliSessionId is ignored and Default omits model and resume flags', async () => {
  const svc = service({ model: 'Default', cliSessionId: undefined });
  const proc = child(); let args: string[] = []; let requestBody: any;
  proc.stdin.on('data', chunk => {
    requestBody = JSON.parse(chunk.toString());
    proc.stdout.write(JSON.stringify(response(requestBody.request_id)) + '\n');
  });
  (svc as any).spawnModelDiscovery = (_bin: string, argv: string[]) => { args = argv; return proc; };
  const result = await svc.getContextUsage('app-session', {
    serverId: 'server-local', cwd: home, model: 'Default', cliSessionId: 'attacker-id',
  } as any);
  assert.deepEqual(args, ['--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '-p', '--no-session-persistence']);
  assert.doesNotMatch(args.join(' '), /attacker-id|--resume|--model/);
  assert.equal(requestBody.request.subtype, 'get_context_usage');
  assert.equal(result.freshness, 'selected-model');
  assert.equal(result.sessionSpecific, false);
});

test('selected request target cwd and native model value are used without changing canonical resume identity', async () => {
  const project = path.join(home, 'project'); fs.mkdirSync(project);
  const svc = service({ cwd: project, cliSessionId: 'canonical-id', model: 'old-model' });
  const proc = child(); let captured: any[] = [];
  proc.stdin.on('data', chunk => proc.stdout.write(JSON.stringify(response(JSON.parse(chunk.toString()).request_id)) + '\n'));
  (svc as any).spawnModelDiscovery = (...args: any[]) => { captured = args; return proc; };
  await svc.getContextUsage('app-session', { serverId: 'server-local', cwd: project, model: 'new/custom[1m] Max' });
  assert.equal(captured[2].cwd, project);
  assert.deepEqual(captured[1].slice(-4), ['--model', 'new/custom[1m]', '--resume', 'canonical-id']);
});

test('context probe preserves exact selected native model after stripping only an effort suffix', async () => {
  for (const selectedModel of ['Sonnet 4.5', 'Sonet', 'Opus 4.1', 'Fable']) {
    const svc = service({ model: 'Default', cliSessionId: undefined });
    const proc = child(); let args: string[] = [];
    proc.stdin.on('data', chunk => proc.stdout.write(JSON.stringify(response(JSON.parse(chunk.toString()).request_id)) + '\n'));
    (svc as any).spawnModelDiscovery = (_bin: string, argv: string[]) => { args = argv; return proc; };
    await svc.getContextUsage('app-session', { model: `${selectedModel} High` });
    assert.deepEqual(args.slice(-2), ['--model', selectedModel]);
  }
});

test('delimiter-colliding context scopes never coalesce', async () => {
  const svc = service({ id: 'a:b', serverId: 'c', cwd: home, model: 'native', cliSessionId: undefined });
  (svc as any).sessions.set('a', { id: 'a', serverId: 'b:c', cwd: home, model: 'native', cliSessionId: undefined });
  svc.serverConfigResolver = (id: string) => ({ id, type: 'local' } as any);
  const pending: any[] = [];
  let spawnCount = 0;
  (svc as any).spawnModelDiscovery = () => {
    spawnCount++;
    const proc = child();
    proc.stdin.on('data', chunk => {
      pending.push({ proc, requestId: JSON.parse(chunk.toString()).request_id });
    });
    return proc;
  };

  const first = svc.getContextUsage('app-session');
  const second = svc.getContextUsage('a');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(spawnCount, 2, 'distinct tuple fields must not collide or share an in-flight probe');
  for (const { proc, requestId } of pending) proc.stdout.write(JSON.stringify(response(requestId)) + '\n');
  await Promise.all([first, second]);
});

test('SSH probe quotes cwd, model and canonical resume ID and closes its channel', async () => {
  const { sshPool } = await import('../apps/api/src/services/sshPool.js');
  const original = sshPool.executeCommand;
  const remote = { id: 'remote', type: 'ssh', host: 'example', user: 'tester', workspace: "~/work's $(touch nope)" } as any;
  const svc = service({ serverId: 'remote', cwd: remote.workspace, model: "vendor/model's[1m]", cliSessionId: "resume'id" });
  svc.serverConfigResolver = id => id === 'remote' ? remote : undefined;
  const channel: any = Object.assign(new EventEmitter(), {
    stderr: new PassThrough(), input: '', signals: [] as string[], closed: false,
    write(input: string) {
      this.input += input;
      const request = JSON.parse(input);
      queueMicrotask(() => this.emit('data', Buffer.from(JSON.stringify(response(request.request_id)) + '\n')));
      return true;
    },
    end() { return this; }, signal(signal: string) { this.signals.push(signal); }, close() { this.closed = true; },
  });
  let command = ''; let target: unknown;
  sshPool.executeCommand = (async (server: unknown, cmd: string) => { target = server; command = cmd; return channel; }) as any;
  try {
    const result = await svc.getContextUsage('app-session');
    assert.equal(target, remote);
    assert.ok(command.includes('CLAUDE_CODE_CONFIG_PROBE=1'));
    assert.ok(command.includes('cd -- "$HOME"/\'work\'\\\'\'s $(touch nope)\''));
    assert.ok(command.includes("'--model' 'vendor/model'\\''s[1m]'"));
    assert.ok(command.includes("'--resume' 'resume'\\''id'"));
    assert.equal(JSON.parse(channel.input).request.detail, 'summary');
    assert.equal(result.sessionSpecific, true);
    assert.ok(channel.signals.includes('TERM'));
    assert.ok(channel.closed);
  } finally { sshPool.executeCommand = original; }
});

test('native summary validation rejects null, malformed, nonfinite and invalid boundaries without fallback', () => {
  const good = { model: 'claude', totalTokens: 0, maxTokens: 200_000, rawMaxTokens: 200_000, percentage: 0 };
  assert.deepEqual(parseNativeContextUsage(good), good);
  const invalid = [
    null, {}, { ...good, model: '' }, { ...good, model: 'bad\0model' },
    { ...good, totalTokens: -1 }, { ...good, totalTokens: 12.34 },
    { ...good, totalTokens: Number.MAX_SAFE_INTEGER + 10 },
    { ...good, maxTokens: 0 }, { ...good, maxTokens: -1 }, { ...good, maxTokens: 200_000.5 },
    { ...good, maxTokens: Number.MAX_SAFE_INTEGER + 10 },
    { ...good, rawMaxTokens: 0 }, { ...good, rawMaxTokens: -1 }, { ...good, rawMaxTokens: 200_000.5 },
    { ...good, rawMaxTokens: Number.MAX_SAFE_INTEGER + 10 },
    { ...good, percentage: -1 }, { ...good, totalTokens: Number.NaN },
    { ...good, maxTokens: Number.POSITIVE_INFINITY }, { ...good, percentage: '2' },
  ];
  for (const value of invalid) assert.throws(() => parseNativeContextUsage(value), /context usage.*invalid/i);
});

test('protocol errors, malformed JSON, null summaries and uncorrelated responses reject explicitly', async () => {
  for (const failure of ['protocol', 'json', 'null', 'uncorrelated']) {
    const svc = service(); const proc = child();
    (svc as any).modelDiscoveryTimeoutMs = 20;
    (svc as any).spawnModelDiscovery = () => proc;
    proc.stdin.on('data', chunk => {
      const request = JSON.parse(chunk.toString());
      if (failure === 'protocol') proc.stdout.write(JSON.stringify({ ...response(request.request_id), response: { subtype: 'error', request_id: request.request_id, error: 'denied' } }) + '\n');
      if (failure === 'json') proc.stdout.write('{bad json}\n');
      if (failure === 'null') proc.stdout.write(JSON.stringify(response(request.request_id, null)) + '\n');
      if (failure === 'uncorrelated') proc.stdout.write(JSON.stringify(response('wrong-id')) + '\n');
    });
    await assert.rejects(svc.getContextUsage('app-session'), /context usage.*(failed|malformed|invalid|timed out)/i);
    assert.ok(proc.signals.includes('SIGTERM'));
  }
});

test('fragmented UTF8 and final correlated JSON without newline are preserved', async () => {
  const svc = service(); const proc = child();
  (svc as any).spawnModelDiscovery = () => proc;
  proc.stdin.on('data', chunk => {
    const request = JSON.parse(chunk.toString());
    const data = Buffer.from(JSON.stringify(response(request.request_id, {
      model: 'Équipe 🚀', totalTokens: 1, maxTokens: 2, rawMaxTokens: 3, percentage: 50,
    })));
    for (let i = 0; i < data.length; i++) proc.stdout.write(data.subarray(i, i + 1));
    proc.emit('close', 0, null);
  });
  assert.equal((await svc.getContextUsage('app-session')).model, 'Équipe 🚀');
});

test('bounded stdout and stderr reject and clean up listeners', async () => {
  for (const stream of ['stdout', 'stderr'] as const) {
    const svc = service(); const proc = child();
    (svc as any).spawnModelDiscovery = () => proc;
    proc.stdin.on('data', () => proc[stream].write(Buffer.alloc(1_048_577, 'x')));
    await assert.rejects(svc.getContextUsage('app-session'), /context usage output exceeded limit/i);
    assert.ok(proc.signals.includes('SIGTERM'));
    assert.equal(proc.stdout.listenerCount('data'), 0);
    assert.equal(proc.stderr.listenerCount('data'), 0);
  }
});

test('HTTP API accepts selected target fields but has no request cliSessionId surface', async () => {
  const Fastify = (await import('fastify')).default;
  const { apiRoutes } = await import('../apps/api/src/routes/api.js');
  const { claudeService } = await import('../apps/api/src/services/claudeService.js');
  const app = Fastify();
  const original = claudeService.getContextUsage;
  let call: any[] = [];
  (claudeService as any).getContextUsage = async (...args: any[]) => {
    call = args;
    return { source: 'cli', freshness: 'selected-model', sessionSpecific: false, model: 'native', totalTokens: 1, maxTokens: 2, rawMaxTokens: 3, percentage: 50 };
  };
  try {
    await app.register(apiRoutes);
    const reply = await app.inject({
      method: 'GET',
      url: '/api/claude/sessions/app-session/context-usage?serverId=remote&cwd=%2Fexact%20cwd&model=Default&cliSessionId=untrusted',
    });
    assert.equal(reply.statusCode, 200);
    assert.deepEqual(call, ['app-session', { serverId: 'remote', cwd: '/exact cwd', model: 'Default' }]);
    assert.deepEqual(reply.json(), {
      context: { model: 'native', totalTokens: 1, maxTokens: 2, rawMaxTokens: 3, percentage: 50 },
      source: 'native',
    });
    (claudeService as any).getContextUsage = async () => { throw new Error('transport auth detail must stay private'); };
    const unavailable = await app.inject({ method: 'GET', url: '/api/claude/sessions/app-session/context-usage' });
    assert.equal(unavailable.statusCode, 200);
    assert.deepEqual(unavailable.json(), { context: null, source: 'native' });
  } finally {
    (claudeService as any).getContextUsage = original;
    await app.close();
  }
});

test('missing app session is explicit and never launches a probe', async () => {
  const svc = new ClaudeService(); let launched = false;
  (svc as any).spawnModelDiscovery = () => { launched = true; return child(); };
  await assert.rejects(svc.getContextUsage('missing'), /session not found/i);
  assert.equal(launched, false);
});

test('SSH channel acquisition timeout closes a late channel', async () => {
  const { sshPool } = await import('../apps/api/src/services/sshPool.js');
  const original = sshPool.executeCommand; const remote = { id: 'remote', type: 'ssh', host: 'test' } as any;
  const svc = service({ serverId: 'remote' }); svc.serverConfigResolver = () => remote;
  (svc as any).modelDiscoveryTimeoutMs = 20;
  let release!: (channel: any) => void; let closed = false;
  sshPool.executeCommand = (() => new Promise(resolve => { release = resolve; })) as any;
  try {
    await assert.rejects(svc.getContextUsage('app-session'), /context usage.*timed out/i);
    release({ signal() {}, close() { closed = true; } });
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(closed);
  } finally { sshPool.executeCommand = original; }
});

test('local and remote scope mismatches reject with validation error and never launch', async () => {
  const svc = service({ serverId: 'server-local', cwd: home });
  let launched = false;
  (svc as any).spawnModelDiscovery = () => { launched = true; return child(); };

  // Local serverId mismatch
  await assert.rejects(
    svc.getContextUsage('app-session', { serverId: 'other-server', cwd: home }),
    /context usage.*(target|serverId|scope|mismatch|invalid)/i
  );
  assert.equal(launched, false);

  // Local cwd mismatch
  const otherDir = path.join(home, 'other');
  fs.mkdirSync(otherDir, { recursive: true });
  await assert.rejects(
    svc.getContextUsage('app-session', { serverId: 'server-local', cwd: otherDir }),
    /context usage.*(cwd|scope|mismatch|invalid)/i
  );
  assert.equal(launched, false);

  // Remote serverId mismatch
  const remote = { id: 'remote-1', type: 'ssh', host: 'test', workspace: '/remote/work' } as any;
  const remoteSvc = service({ serverId: 'remote-1', cwd: '/remote/work' });
  remoteSvc.serverConfigResolver = (id: string) => id === 'remote-1' ? remote : undefined;
  let remoteLaunched = false;
  const { sshPool } = await import('../apps/api/src/services/sshPool.js');
  const origExec = sshPool.executeCommand;
  sshPool.executeCommand = (async () => { remoteLaunched = true; return child(); }) as any;
  try {
    // Selected serverId differs
    await assert.rejects(
      remoteSvc.getContextUsage('app-session', { serverId: 'server-local', cwd: '/remote/work' }),
      /context usage.*(target|serverId|scope|mismatch|invalid)/i
    );
    assert.equal(remoteLaunched, false);

    // Selected remote cwd differs lexically
    await assert.rejects(
      remoteSvc.getContextUsage('app-session', { serverId: 'remote-1', cwd: '/other/path' }),
      /context usage.*(cwd|scope|mismatch|invalid)/i
    );
    assert.equal(remoteLaunched, false);
  } finally {
    sshPool.executeCommand = origExec;
  }
});

test('remote scope accepts safe normalized lexical equivalents without launching on mismatch', async () => {
  const remote = { id: 'remote-1', type: 'ssh', host: 'test', workspace: '~/project' } as any;
  const svc = service({ serverId: 'remote-1', cwd: '~/project' });
  svc.serverConfigResolver = (id: string) => id === 'remote-1' ? remote : undefined;
  const { sshPool } = await import('../apps/api/src/services/sshPool.js');
  const origExec = sshPool.executeCommand;
  let executedCmd = '';
  sshPool.executeCommand = (async (_srv: any, cmd: string) => {
    executedCmd = cmd;
    const ch: any = Object.assign(new EventEmitter(), {
      stderr: new PassThrough(),
      write(d: string) {
        const req = JSON.parse(d);
        queueMicrotask(() => ch.emit('data', Buffer.from(JSON.stringify(response(req.request_id)) + '\n')));
        return true;
      },
      end() {}, signal() {}, close() {},
    });
    return ch;
  }) as any;
  try {
    // '~/project/' should lexically match '~/project'
    const res = await svc.getContextUsage('app-session', { serverId: 'remote-1', cwd: '~/project/' });
    assert.equal(res.source, 'cli');
    assert.ok(executedCmd.includes('cd -- "$HOME"/\'project\''));
  } finally {
    sshPool.executeCommand = origExec;
  }
});

test('persisted session field corruption is handled safely without TypeError and bad values do not launch', async () => {
  // bad cliSessionId: numbers, NUL, oversized string
  for (const badCliId of [12345, 'bad\0id', 'x'.repeat(1000), { obj: true }]) {
    const svc = service({ cliSessionId: badCliId as any });
    let capturedArgs: string[] = [];
    const proc = child();
    proc.stdin.on('data', chunk => {
      const req = JSON.parse(chunk.toString());
      proc.stdout.write(JSON.stringify(response(req.request_id)) + '\n');
    });
    (svc as any).spawnModelDiscovery = (_bin: string, argv: string[]) => { capturedArgs = argv; return proc; };
    const res = await svc.getContextUsage('app-session');
    assert.equal(res.sessionSpecific, false);
    assert.ok(!capturedArgs.includes('--resume'));
  }

  // bad cwd: number, NUL, oversized
  for (const badCwd of [12345, `${home}\0bad`, 'x'.repeat(5000), { obj: true }]) {
    const svc = service({ cwd: badCwd as any });
    let launched = false;
    (svc as any).spawnModelDiscovery = () => { launched = true; return child(); };
    await assert.rejects(svc.getContextUsage('app-session'), /context usage.*(cwd|invalid|corrupt)/i);
    assert.equal(launched, false);
  }

  // bad serverId: number, NUL
  for (const badServerId of [12345, 'server\0local', { obj: true }]) {
    const svc = service({ serverId: badServerId as any });
    let launched = false;
    (svc as any).spawnModelDiscovery = () => { launched = true; return child(); };
    await assert.rejects(svc.getContextUsage('app-session'), /context usage.*(target|serverId|invalid|corrupt)/i);
    assert.equal(launched, false);
  }
});

test('coalesces identical in-flight probes and caches results with short TTL', async () => {
  const svc = service();
  let spawnCount = 0;
  (svc as any).spawnModelDiscovery = () => {
    spawnCount++;
    const proc = child();
    proc.stdin.on('data', chunk => {
      const req = JSON.parse(chunk.toString());
      setTimeout(() => {
        proc.stdout.write(JSON.stringify(response(req.request_id, {
          model: 'claude-sonnet', totalTokens: 100, maxTokens: 1000, rawMaxTokens: 1000, percentage: 10,
        })) + '\n');
      }, 10);
    });
    return proc;
  };

  const [res1, res2] = await Promise.all([
    svc.getContextUsage('app-session'),
    svc.getContextUsage('app-session'),
  ]);

  assert.equal(spawnCount, 1, 'identical in-flight requests must coalesce into a single probe');
  assert.equal(res1.totalTokens, 100);
  assert.equal(res2.totalTokens, 100);

  const res3 = await svc.getContextUsage('app-session');
  assert.equal(spawnCount, 1, 'subsequent request within TTL must use cache');
  assert.equal(res3.totalTokens, 100);
});

test('context cache removes expired entries, stays bounded across model churn, and clears on session scope changes', async () => {
  const svc = service({ cliSessionId: undefined });
  let launches = 0;
  (svc as any).spawnModelDiscovery = () => {
    launches++;
    const proc = child();
    proc.stdin.on('data', chunk => proc.stdout.write(JSON.stringify(response(JSON.parse(chunk.toString()).request_id)) + '\n'));
    return proc;
  };

  await svc.getContextUsage('app-session', { model: 'model-0' });
  const cache: Map<string, any> = (svc as any).contextUsageCache;
  const firstKey = [...cache.keys()][0];
  cache.get(firstKey).at = Date.now() - 60_000;
  cache.set('expired-unrelated', { sessionId: 'other', result: {}, at: Date.now() - 60_000 });
  await svc.getContextUsage('app-session', { model: 'model-0' });
  assert.equal(launches, 2, 'expired matching cache entry must launch again');
  assert.equal(cache.has('expired-unrelated'), false, 'expired unrelated entries must be pruned');

  for (let i = 1; i <= 30; i++) await svc.getContextUsage('app-session', { model: `model-${i}` });
  assert.ok(cache.size <= 24, `cache must remain bounded, got ${cache.size}`);
  svc.updateSession('app-session', { model: 'updated-model' });
  assert.equal([...cache.values()].some(entry => entry.sessionId === 'app-session'), false);

  await svc.getContextUsage('app-session');
  assert.ok([...cache.values()].some(entry => entry.sessionId === 'app-session'));
  svc.deleteSession('app-session');
  assert.equal([...cache.values()].some(entry => entry.sessionId === 'app-session'), false);
});

test('an in-flight result cannot repopulate cache after update or delete', async () => {
  for (const action of ['update', 'delete'] as const) {
    const svc = service({ cliSessionId: undefined });
    const proc = child();
    let requestId = '';
    (svc as any).spawnModelDiscovery = () => proc;
    proc.stdin.on('data', chunk => { requestId = JSON.parse(chunk.toString()).request_id; });
    const pending = svc.getContextUsage('app-session', { model: 'before' });
    await new Promise(resolve => setImmediate(resolve));
    if (action === 'update') svc.updateSession('app-session', { model: 'after' });
    else svc.deleteSession('app-session');
    proc.stdout.write(JSON.stringify(response(requestId)) + '\n');
    await pending;
    assert.equal((svc as any).contextUsageCache.size, 0, `${action} must prevent stale in-flight cache writes`);
  }
});

test('scope update prevents a new request from coalescing with stale in-flight work', async () => {
  const svc = service({ cliSessionId: undefined });
  const pending: any[] = [];
  let launches = 0;
  (svc as any).spawnModelDiscovery = () => {
    launches++;
    const proc = child();
    proc.stdin.on('data', chunk => pending.push({ proc, requestId: JSON.parse(chunk.toString()).request_id }));
    return proc;
  };
  const first = svc.getContextUsage('app-session', { model: 'same-selection' });
  await new Promise(resolve => setImmediate(resolve));
  svc.updateSession('app-session', { cwd: home });
  const second = svc.getContextUsage('app-session', { model: 'same-selection' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(launches, 2);
  for (const item of pending) item.proc.stdout.write(JSON.stringify(response(item.requestId)) + '\n');
  await Promise.all([first, second]);
});

test('bounds global/target concurrency and rejects excess requests with 429 without launching', async () => {
  const svc = service();
  for (let i = 1; i <= 5; i++) {
    (svc as any).sessions.set(`session-${i}`, {
      id: `session-${i}`, serverId: 'server-local', cwd: home, model: `Model-${i}`,
    });
  }

  let activeProcs: any[] = [];
  let spawnCount = 0;
  (svc as any).spawnModelDiscovery = () => {
    spawnCount++;
    const proc = child();
    proc.stdin.on('data', chunk => {
      const req = JSON.parse(chunk.toString());
      (proc as any).lastRequestId = req.request_id;
    });
    activeProcs.push(proc);
    return proc;
  };

  const p1 = svc.getContextUsage('session-1');
  const p2 = svc.getContextUsage('session-2');
  const p3 = svc.getContextUsage('session-3');
  const p4 = svc.getContextUsage('session-4');

  await assert.rejects(
    svc.getContextUsage('session-5'),
    (err: any) => err.statusCode === 429 || /concurrency|too many/i.test(err.message)
  );
  assert.equal(spawnCount, 4, '5th probe must not launch');

  // Let stdin flush
  await new Promise(resolve => setImmediate(resolve));
  for (const proc of activeProcs) {
    proc.stdout.write(JSON.stringify(response((proc as any).lastRequestId)) + '\n');
  }
  await Promise.allSettled([p1, p2, p3, p4]);

  activeProcs = [];
  const p5 = svc.getContextUsage('session-5');
  assert.equal(spawnCount, 5, 'probe should launch once concurrency cleared');
  await new Promise(resolve => setImmediate(resolve));
  activeProcs[0]?.stdout.write(JSON.stringify(response(activeProcs[0]?.lastRequestId)) + '\n');
  await p5;
});

test('synchronous close during SIGTERM cancels escalation and removes guarded listeners', async () => {
  const svc = service(); const proc = child();
  (svc as any).modelDiscoveryKillGraceMs = 10;
  (svc as any).spawnModelDiscovery = () => proc;
  proc.kill = function (signal: string) {
    this.signals.push(signal);
    if (signal === 'SIGTERM') this.emit('close', 0, signal);
    return true;
  };
  proc.stdin.on('data', chunk => proc.stdout.write(JSON.stringify(response(JSON.parse(chunk.toString()).request_id)) + '\n'));
  await svc.getContextUsage('app-session');
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.deepEqual(proc.signals, ['SIGTERM']);
  assert.equal(proc.stdout.listenerCount('data'), 0);
  assert.equal(proc.stdout.listenerCount('error'), 0);
  assert.equal(proc.stderr.listenerCount('data'), 0);
  assert.equal(proc.stderr.listenerCount('error'), 0);
  assert.equal(proc.stdin.listenerCount('error'), 0);
  assert.equal(proc.listenerCount('close'), 0);
  assert.equal(proc.listenerCount('error'), 0);
});

test('asynchronous close after SIGTERM cancels escalation without listener or timer leaks', async () => {
  const svc = service(); const proc = child();
  (svc as any).modelDiscoveryKillGraceMs = 20;
  (svc as any).spawnModelDiscovery = () => proc;
  proc.kill = function (signal: string) {
    this.signals.push(signal);
    if (signal === 'SIGTERM') setTimeout(() => this.emit('close', 0, signal), 5);
    return true;
  };
  proc.stdin.on('data', chunk => proc.stdout.write(JSON.stringify(response(JSON.parse(chunk.toString()).request_id)) + '\n'));
  await svc.getContextUsage('app-session');
  await new Promise(resolve => setTimeout(resolve, 35));
  assert.deepEqual(proc.signals, ['SIGTERM']);
  assert.equal(proc.stdout.listenerCount('error'), 0);
  assert.equal(proc.stderr.listenerCount('error'), 0);
  assert.equal(proc.stdin.listenerCount('error'), 0);
  assert.equal(proc.listenerCount('close'), 0);
  assert.equal(proc.listenerCount('error'), 0);
});

test('late EPIPE during shutdown is swallowed until close then guards are removed', async () => {
  const svc = service(); const proc = child();
  (svc as any).modelDiscoveryKillGraceMs = 20;
  (svc as any).spawnModelDiscovery = () => proc;
  proc.stdin.on('data', chunk => proc.stdout.write(JSON.stringify(response(JSON.parse(chunk.toString()).request_id)) + '\n'));
  await svc.getContextUsage('app-session');
  assert.doesNotThrow(() => proc.stdin.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' })));
  assert.doesNotThrow(() => proc.stdout.emit('error', Object.assign(new Error('read EPIPE'), { code: 'EPIPE' })));
  proc.emit('close', 0, 'SIGTERM');
  assert.equal(proc.stdin.listenerCount('error'), 0);
  assert.equal(proc.stdout.listenerCount('error'), 0);
  assert.equal(proc.listenerCount('close'), 0);
});

test('shutdown escalates once after grace and then removes all guarded listeners', async () => {
  const svc = service(); const proc = child();
  (svc as any).modelDiscoveryTimeoutMs = 5;
  (svc as any).modelDiscoveryKillGraceMs = 5;
  (svc as any).spawnModelDiscovery = () => proc;
  await assert.rejects(svc.getContextUsage('app-session'), /timed out/i);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(proc.signals, ['SIGTERM', 'SIGKILL']);
  assert.equal(proc.stdout.listenerCount('data'), 0);
  assert.equal(proc.stdout.listenerCount('error'), 0);
  assert.equal(proc.stderr.listenerCount('data'), 0);
  assert.equal(proc.stderr.listenerCount('error'), 0);
  assert.equal(proc.stdin.listenerCount('error'), 0);
  assert.equal(proc.listenerCount('close'), 0);
  assert.equal(proc.listenerCount('error'), 0);
});

test('HTTP API classifies only trusted context errors and always uses fixed sanitized messages', async () => {
  const Fastify = (await import('fastify')).default;
  const { apiRoutes } = await import('../apps/api/src/routes/api.js');
  const { claudeService } = await import('../apps/api/src/services/claudeService.js');
  const app = Fastify();
  const original = claudeService.getContextUsage;

  try {
    await app.register(apiRoutes);
    const trusted = [
      [new ContextUsageNotFoundError('secret /home/user/session.json'), 404, 'Claude session not found'],
      [new ContextUsageValidationError('secret /home/user/session.json'), 400, 'Invalid Claude context usage request'],
      [new ContextUsageConcurrencyError('secret /home/user/session.json'), 429, 'Too many concurrent Claude context usage requests'],
    ] as const;
    for (const [error, statusCode, message] of trusted) {
      (claudeService as any).getContextUsage = async () => { throw error; };
      const res = await app.inject({ method: 'GET', url: '/api/claude/sessions/s1/context-usage' });
      assert.equal(res.statusCode, statusCode);
      assert.deepEqual(res.json(), { error: message });
      assert.doesNotMatch(res.body, /secret|\/home\/user/);
    }

    const generic = [
      Object.assign(new Error('invalid mismatch secret /home/user/session.json'), { statusCode: 400 }),
      Object.assign(new Error('session not found secret /home/user/session.json'), { statusCode: 404 }),
      Object.assign(new Error('concurrency secret /home/user/session.json'), { statusCode: 429 }),
      Object.assign(new Error('innocent fake status'), { statusCode: 404 }),
    ];
    for (const error of generic) {
      (claudeService as any).getContextUsage = async () => { throw error; };
      const res = await app.inject({ method: 'GET', url: '/api/claude/sessions/s1/context-usage' });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), { context: null, source: 'native' });
      assert.doesNotMatch(res.body, /secret|\/home\/user|invalid|mismatch|not found|concurrency|fake status/i);
    }
  } finally {
    (claudeService as any).getContextUsage = original;
    await app.close();
  }
});
