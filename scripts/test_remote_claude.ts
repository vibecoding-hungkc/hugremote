import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { claudeService, ClaudeSession } from '../server/src/services/claudeService.js';
import { sshPool } from '../server/src/services/sshPool.js';
import * as configModule from '../server/src/config.js';

test('remote SSH session executes claude remotely via sshPool and streams events without host binary', async (t) => {
  const origResolver = claudeService.serverConfigResolver;
  const origExec = (sshPool as any).executeCommand;

  const remoteServer = {
    id: 'server-ssh-prod',
    name: 'prod',
    type: 'ssh' as const,
    label: 'Prod Server',
    host: '192.168.1.100',
    user: 'remoteuser',
    port: 22,
    workspace: '/home/remoteuser/project',
  };

  claudeService.setServerConfigResolver((id) => (id === 'server-ssh-prod' ? remoteServer : undefined));

  let executed = null as any;
  (sshPool as any).executeCommand = async (server: any, command: string, options: any) => {
    executed = { server, command, options };
    const stream = new EventEmitter() as any;
    stream.stderr = new EventEmitter();
    stream.signal = (sig: string) => { stream.signaled = sig; };
    stream.close = () => { stream.emit('close', 0); };
    setImmediate(() => {
      const initEvent = JSON.stringify({ type: 'system', subtype: 'init', session_id: 'remote-session-42' });
      const textEvent = JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'Hello from remote Claude' }] }
      });
      const doneEvent = JSON.stringify({ type: 'result', result: 'Hello from remote Claude' });
      stream.emit('data', Buffer.from(`${initEvent}\n${textEvent}\n${doneEvent}\n`));
      stream.emit('close', 0);
    });
    return stream;
  };

  t.after(() => {
    claudeService.setServerConfigResolver(origResolver);
    (sshPool as any).executeCommand = origExec;
  });

  const session: ClaudeSession = {
    id: 'test-remote-session',
    serverId: 'server-ssh-prod',
    name: 'remote-chat',
    cwd: '/home/remoteuser/project',
    isCustomNamed: true,
    model: 'Sonnet 5.5 Medium',
    mode: 'Auto',
    timer: '60m',
    contextTokens: '0',
    messages: [],
    updatedAt: Date.now(),
  };

  const events: any[] = [];
  const result = await claudeService.streamClaudePrompt(session, 'Hi remote', (ev) => {
    events.push(ev);
  });

  assert.equal(result.text, 'Hello from remote Claude');
  assert.equal(session.cliSessionId, 'remote-session-42');
  assert.ok(executed, 'sshPool.executeCommand should be called');
  assert.equal(executed.server.id, 'server-ssh-prod');
  assert.match(executed.command, /claude/);
  assert.match(executed.command, /'--output-format'\s+'stream-json'/);
  assert.match(executed.command, /cd -- '\/home\/remoteuser\/project'/);
  assert.ok(events.some((e) => e.type === 'text_delta' && e.text === 'Hello from remote Claude'));
});

test('remote SSH session safely escapes dangerous shell prompts and arguments', async (t) => {
  const origResolver = claudeService.serverConfigResolver;
  const origExec = (sshPool as any).executeCommand;

  const remoteServer = {
    id: 'server-ssh-prod',
    name: 'prod',
    type: 'ssh' as const,
    label: 'Prod Server',
    host: '192.168.1.100',
    user: 'remoteuser',
    port: 22,
    workspace: '/home/remoteuser/project',
  };

  claudeService.setServerConfigResolver((id) => (id === 'server-ssh-prod' ? remoteServer : undefined));

  let capturedCommand = '';
  (sshPool as any).executeCommand = async (_server: any, command: string) => {
    capturedCommand = command;
    const stream = new EventEmitter() as any;
    stream.stderr = new EventEmitter();
    stream.signal = () => {};
    stream.close = () => { stream.emit('close', 0); };
    setImmediate(() => {
      const done = JSON.stringify({ type: 'result', result: 'Safe response' });
      stream.emit('data', Buffer.from(`${done}\n`));
      stream.emit('close', 0);
    });
    return stream;
  };

  t.after(() => {
    claudeService.setServerConfigResolver(origResolver);
    (sshPool as any).executeCommand = origExec;
  });

  const session: ClaudeSession = {
    id: 'test-escape-session',
    serverId: 'server-ssh-prod',
    name: 'escape-chat',
    cwd: '/path/with "special" & \'quotes\'',
    isCustomNamed: true,
    model: 'Sonnet',
    mode: 'Auto',
    timer: '60m',
    contextTokens: '0',
    messages: [],
    updatedAt: Date.now(),
  };

  const dangerousPrompt = 'rm -rf / && $(calc) `whoami` "quotes" and \'single\'\nnewline';
  const result = await claudeService.streamClaudePrompt(session, dangerousPrompt, () => {});

  assert.equal(result.text, 'Safe response');
  // It should be safely wrapped in single quotes with '\''
  assert.ok(
    capturedCommand.includes("'rm -rf / && $(calc) `whoami` \"quotes\" and '\\''single'\\''\nnewline'"),
    'Prompt must be safely shell escaped'
  );
  assert.ok(
    capturedCommand.includes("cd -- '/path/with \"special\" & '\\''quotes'\\'''"),
    'CWD must be safely shell escaped'
  );
});

test('remote SSH session cancellation sends signal to stream and marks cancelled', async (t) => {
  const origResolver = claudeService.serverConfigResolver;
  const origExec = (sshPool as any).executeCommand;

  const remoteServer = {
    id: 'server-ssh-prod',
    name: 'prod',
    type: 'ssh' as const,
    label: 'Prod Server',
    host: '192.168.1.100',
    user: 'remoteuser',
    port: 22,
    workspace: '/home/remoteuser/project',
  };

  claudeService.setServerConfigResolver((id) => (id === 'server-ssh-prod' ? remoteServer : undefined));

  let signaled = '';
  let streamClosed = false;
  (sshPool as any).executeCommand = async () => {
    const stream = new EventEmitter() as any;
    stream.stderr = new EventEmitter();
    stream.signal = (s: string) => { signaled = s; };
    stream.close = () => {
      streamClosed = true;
      stream.emit('close', null, 'SIGINT');
    };
    return stream;
  };

  t.after(() => {
    claudeService.setServerConfigResolver(origResolver);
    (sshPool as any).executeCommand = origExec;
  });

  const session: ClaudeSession = {
    id: 'test-cancel-session',
    serverId: 'server-ssh-prod',
    name: 'cancel-chat',
    cwd: '/home/remoteuser/project',
    isCustomNamed: true,
    model: 'Sonnet',
    mode: 'Auto',
    timer: '60m',
    contextTokens: '0',
    messages: [],
    updatedAt: Date.now(),
  };

  const runPromise = claudeService.streamClaudePrompt(session, 'Slow task', () => {});
  // Give setImmediate for stream to be registered
  await new Promise((r) => setTimeout(r, 10));

  const didCancel = claudeService.cancelRun('test-cancel-session');
  assert.equal(didCancel, true);
  assert.equal(signaled, 'INT');
  assert.equal(streamClosed, true);

  const res = await runPromise;
  assert.equal(res.text, 'Đã dừng yêu cầu.');
});

test('remote SSH session reports clear error when claude command not found', async (t) => {
  const origResolver = claudeService.serverConfigResolver;
  const origExec = (sshPool as any).executeCommand;

  const remoteServer = {
    id: 'server-ssh-prod',
    name: 'prod',
    type: 'ssh' as const,
    label: 'Prod Server',
    host: '192.168.1.100',
    user: 'remoteuser',
    port: 22,
    workspace: '/home/remoteuser/project',
  };

  claudeService.setServerConfigResolver((id) => (id === 'server-ssh-prod' ? remoteServer : undefined));

  (sshPool as any).executeCommand = async () => {
    const stream = new EventEmitter() as any;
    stream.stderr = new EventEmitter();
    stream.signal = () => {};
    stream.close = () => {};
    setImmediate(() => {
      stream.stderr.emit('data', Buffer.from('bash: line 1: claude: command not found\n'));
      stream.emit('exit', 127);
      stream.emit('close', 127);
    });
    return stream;
  };

  t.after(() => {
    claudeService.setServerConfigResolver(origResolver);
    (sshPool as any).executeCommand = origExec;
  });

  const session: ClaudeSession = {
    id: 'test-missing-claude-session',
    serverId: 'server-ssh-prod',
    name: 'missing-claude',
    cwd: '/home/remoteuser/project',
    isCustomNamed: true,
    model: 'Sonnet',
    mode: 'Auto',
    timer: '60m',
    contextTokens: '0',
    messages: [],
    updatedAt: Date.now(),
  };

  const res = await claudeService.streamClaudePrompt(session, 'Hi', () => {});
  assert.match(res.text, /Không tìm thấy lệnh "claude" trên máy chủ remote "Prod Server"/);
});

test('local session executes locally and does not invoke sshPool', async (t) => {
  const origResolver = claudeService.serverConfigResolver;
  const origExec = (sshPool as any).executeCommand;

  let sshCalled = false;
  (sshPool as any).executeCommand = async () => {
    sshCalled = true;
    throw new Error('SSH should not be called for local session');
  };

  t.after(() => {
    claudeService.setServerConfigResolver(origResolver);
    (sshPool as any).executeCommand = origExec;
  });

  const session: ClaudeSession = {
    id: 'test-local-session',
    serverId: 'server-local',
    name: 'local-chat',
    cwd: '/tmp',
    isCustomNamed: true,
    model: 'Sonnet',
    mode: 'Auto',
    timer: '60m',
    contextTokens: '0',
    messages: [],
    updatedAt: Date.now(),
  };

  // Local binary does not exist on this test WSL env so it should catch error from local spawn without calling SSH
  const res = await claudeService.streamClaudePrompt(session, 'Hello local', () => {});
  assert.equal(sshCalled, false, 'sshPool must not be called for local sessions');
  assert.match(res.text, /Không thể khởi chạy Claude Code/);
});

test('createSession for remote server does not pollute cwd with local host homedir', async (t) => {
  const origResolver = claudeService.serverConfigResolver;
  const remoteServer = {
    id: 'server-ssh-remote',
    name: 'remote',
    type: 'ssh' as const,
    label: 'Remote Server',
    host: '10.0.0.5',
    user: 'ubuntu',
    port: 22,
    workspace: '/var/www/remote-app',
  };

  claudeService.setServerConfigResolver((id) => (id === 'server-ssh-remote' ? remoteServer : undefined));
  t.after(() => {
    claudeService.setServerConfigResolver(origResolver);
  });

  const sessionWithEmpty = claudeService.createSession('server-ssh-remote', '', 'chat-empty', '');
  assert.equal(sessionWithEmpty.cwd, '/var/www/remote-app');

  const sessionWithTilde = claudeService.createSession('server-ssh-remote', '', 'chat-tilde', '~');
  assert.equal(sessionWithTilde.cwd, '~');

  const sessionWithSub = claudeService.createSession('server-ssh-remote', '', 'chat-sub', '~/subfolder');
  assert.equal(sessionWithSub.cwd, '~/subfolder');
});

test('remote SSH session correctly handles tilde paths without breaking shell expansion', async (t) => {
  const origResolver = claudeService.serverConfigResolver;
  const origExec = (sshPool as any).executeCommand;

  const remoteServer = {
    id: 'server-ssh-prod',
    name: 'prod',
    type: 'ssh' as const,
    label: 'Prod Server',
    host: '192.168.1.100',
    user: 'remoteuser',
    port: 22,
    workspace: '~',
  };

  claudeService.setServerConfigResolver((id) => (id === 'server-ssh-prod' ? remoteServer : undefined));

  let capturedCommand = '';
  (sshPool as any).executeCommand = async (_server: any, command: string) => {
    capturedCommand = command;
    const stream = new EventEmitter() as any;
    stream.stderr = new EventEmitter();
    stream.signal = () => {};
    stream.close = () => { stream.emit('close', 0); };
    setImmediate(() => {
      const done = JSON.stringify({ type: 'result', result: 'OK' });
      stream.emit('data', Buffer.from(`${done}\n`));
      stream.emit('close', 0);
    });
    return stream;
  };

  t.after(() => {
    claudeService.setServerConfigResolver(origResolver);
    (sshPool as any).executeCommand = origExec;
  });

  const session: ClaudeSession = {
    id: 'test-tilde-session',
    serverId: 'server-ssh-prod',
    name: 'tilde-chat',
    cwd: '~/my project',
    isCustomNamed: true,
    model: 'Sonnet',
    mode: 'Auto',
    timer: '60m',
    contextTokens: '0',
    messages: [],
    updatedAt: Date.now(),
  };

  await claudeService.streamClaudePrompt(session, 'test', () => {});
  assert.ok(
    capturedCommand.includes('cd -- "$HOME"/\'my project\' &&'),
    `Command must expand tilde safely, got: ${capturedCommand}`
  );
});

test('streamClaudePrompt does not emit duplicate error events when error event is followed by close', async (t) => {
  const origResolver = claudeService.serverConfigResolver;
  const origExec = (sshPool as any).executeCommand;

  const remoteServer = {
    id: 'server-ssh-prod',
    name: 'prod',
    type: 'ssh' as const,
    label: 'Prod Server',
    host: '192.168.1.100',
    user: 'remoteuser',
    port: 22,
    workspace: '/remote',
  };

  claudeService.setServerConfigResolver((id) => (id === 'server-ssh-prod' ? remoteServer : undefined));

  (sshPool as any).executeCommand = async () => {
    const stream = new EventEmitter() as any;
    stream.stderr = new EventEmitter();
    stream.signal = () => {};
    stream.close = () => {};
    setImmediate(() => {
      stream.emit('error', new Error('Connection abruptly reset'));
      stream.stderr.emit('data', Buffer.from('fatal: failed\n'));
      stream.emit('exit', 1);
      stream.emit('close', 1);
    });
    return stream;
  };

  t.after(() => {
    claudeService.setServerConfigResolver(origResolver);
    (sshPool as any).executeCommand = origExec;
  });

  const session: ClaudeSession = {
    id: 'test-double-err-session',
    serverId: 'server-ssh-prod',
    name: 'err-chat',
    cwd: '/remote',
    isCustomNamed: true,
    model: 'Sonnet',
    mode: 'Auto',
    timer: '60m',
    contextTokens: '0',
    messages: [],
    updatedAt: Date.now(),
  };

  const errorEvents: any[] = [];
  const res = await claudeService.streamClaudePrompt(session, 'Hi', (ev) => {
    if (ev.type === 'error') errorEvents.push(ev);
  });

  assert.equal(errorEvents.length, 1, 'Must emit exactly one error event');
  assert.match(res.text, /Không thể khởi chạy Claude Code/);
});
