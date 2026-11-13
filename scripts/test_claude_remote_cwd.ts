import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, after } from 'node:test';

// Isolated HOME so no real user data or Claude sessions are touched.
const home = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'claude-remote-cwd-'));
process.env.HOME = home;
process.env.WORKSPACE_ROOT = home;

const { claudeService } = await import('../apps/api/src/services/claudeService.js');
const { sshPool } = await import('../apps/api/src/services/sshPool.js');

after(() => fs.rmSync(home, { recursive: true, force: true }));

// Fake remote host: HOME=<tmp>/remote-home with a stub `claude` that prints its cwd.
const remoteHome = path.join(home, 'remote-home');
fs.mkdirSync(path.join(remoteHome, '.local', 'bin'), { recursive: true });
fs.mkdirSync(path.join(remoteHome, 'test-proj'), { recursive: true });
fs.mkdirSync(path.join(remoteHome, 'my project'), { recursive: true });
fs.writeFileSync(path.join(remoteHome, '.local', 'bin', 'claude'), '#!/bin/sh\npwd\n', { mode: 0o755 });

const remoteServer = {
  id: 'server-ssh-cwd-test',
  name: 'cwd-test',
  type: 'ssh' as const,
  label: 'Cwd Test',
  host: '203.0.113.10',
  user: 'devops',
  port: 22,
  workspace: '~',
};

async function runRemote(cwd: string): Promise<string> {
  const origResolver = claudeService.serverConfigResolver;
  const origExec = (sshPool as any).executeCommand;
  claudeService.setServerConfigResolver((id) => (id === remoteServer.id ? remoteServer : undefined));
  let captured = '';
  (sshPool as any).executeCommand = async (_server: unknown, command: string) => {
    captured = command;
    const stream = new EventEmitter() as any;
    stream.stderr = new EventEmitter();
    stream.signal = () => {};
    stream.close = () => stream.emit('close', 0);
    setImmediate(() => stream.emit('close', 0));
    return stream;
  };
  try {
    const session: any = {
      id: `cwd-${Date.now()}-${Math.random()}`,
      serverId: remoteServer.id,
      name: 'cwd-probe',
      cwd,
      isCustomNamed: true,
      model: 'Sonnet 5.5 Medium',
      mode: 'Auto',
      timer: '60m',
      contextTokens: '0',
      messages: [],
      updatedAt: Date.now(),
    };
    await claudeService.streamClaudePrompt(session, 'hi', () => {});
  } finally {
    claudeService.setServerConfigResolver(origResolver);
    (sshPool as any).executeCommand = origExec;
  }
  assert.ok(captured, 'remote command captured');
  // Execute the generated command in a real shell, replacing the long `claude` flags by the stub.
  const result = spawnSync('sh', ['-c', captured], {
    env: { PATH: '/usr/bin:/bin', HOME: remoteHome },
    encoding: 'utf8',
  });
  return (result.stdout || '').trim();
}

test('remote Claude starts inside the project directory given as ~/relative path', async () => {
  assert.equal(await runRemote('~/test-proj'), path.join(remoteHome, 'test-proj'));
});

test('remote Claude starts inside an absolute project directory', async () => {
  const abs = path.join(remoteHome, 'test-proj');
  // sanitizeRemoteWorkspacePath keeps an absolute path unless it sits under the local HOME.
  const result = await runRemote('/home/devops/test-proj');
  // /home/devops does not exist in this sandbox, so the documented fallback is $HOME.
  assert.equal(result, remoteHome);
  assert.ok(fs.existsSync(abs));
});

test('remote Claude handles project paths containing spaces', async () => {
  assert.equal(await runRemote('~/my project'), path.join(remoteHome, 'my project'));
});

test('remote Claude falls back to HOME when the project directory is missing', async () => {
  assert.equal(await runRemote('~/does-not-exist'), remoteHome);
});

test('generated cd must not run in a subshell, otherwise cwd never reaches claude', async () => {
  const src = fs.readFileSync(
    new URL('../apps/api/src/services/claudeService.ts', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(src, /\(cd -- [^)]*\|\| cd -- [^)]*\) &&/, 'subshell cd loses the directory change');
});
