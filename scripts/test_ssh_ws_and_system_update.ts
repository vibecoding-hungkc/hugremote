import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../apps/api/src/app.js';
import { parseSshConfig, saveOrUpdateSshConfigHost } from '../apps/api/src/config.js';
import { fsService } from '../apps/api/src/services/fsService.js';
import {
  sshPool,
  isEncryptedPrivateKeyBuffer,
  buildNativeSshArgs,
  buildProxyCommandFromJump,
  resolveUsablePrivateKeys,
  resolveEffectiveSshTarget,
} from '../apps/api/src/services/sshPool.js';
import { projectService } from '../apps/api/src/services/projectService.js';
import { systemUpdateService } from '../apps/api/src/services/systemUpdateService.js';

let failures = 0;
async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err: any) {
    failures++;
    console.error(`FAIL ${name}: ${err.message}`);
  }
}

await runTest('AC-1: App.vue calls terminalStore.ensureServerSession() before awaiting fileStore.fetchFiles() in handleScopeChanged', () => {
  const appSource = fs.readFileSync(
    fileURLToPath(new URL('../apps/web/src/App.vue', import.meta.url)),
    'utf8'
  );
  const scopeFnMatch = appSource.match(/async function handleScopeChanged\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(scopeFnMatch, 'handleScopeChanged must exist in App.vue');
  const body = scopeFnMatch[1];
  const ensureIdx = body.indexOf('terminalStore.ensureServerSession()');
  const fetchFilesIdx = body.indexOf('await fileStore.fetchFiles()');
  assert.ok(ensureIdx !== -1, 'terminalStore.ensureServerSession() must be in handleScopeChanged');
  assert.ok(fetchFilesIdx !== -1, 'await fileStore.fetchFiles() must be in handleScopeChanged');
  assert.ok(
    ensureIdx < fetchFilesIdx,
    'terminalStore.ensureServerSession() must run BEFORE await fileStore.fetchFiles() so switching to an SSH server immediately has an active session'
  );
});

await runTest('AC-2a: isEncryptedPrivateKeyBuffer detects passphrase-protected keys so ssh2 does not throw synchronously', () => {
  const encryptedPem = Buffer.from(
    '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-128-CBC,1234\n-----END RSA PRIVATE KEY-----\n'
  );
  assert.equal(isEncryptedPrivateKeyBuffer(encryptedPem), true);
});

await runTest('AC-2b: sshPool.createShell and sshPool.executeCommand fall back to native ssh CLI when ssh2 direct connection fails', async () => {
  const origGetClient = sshPool.getClient.bind(sshPool);
  let fallbackShellUsed = false;
  let fallbackExecUsed = false;

  (sshPool as any).getClient = async () => {
    throw new Error('All configured authentication methods failed');
  };
  (sshPool as any).setNativeSshSpawnersForTest({
    spawnPty: (sessionInfo: any, server: any, args: string[]) => {
      fallbackShellUsed = true;
      assert.equal(server.name, 'hermes-admin');
      assert.ok(args.includes('hermes-admin') || args.some((a) => a.includes('hermes.example')));
      let dataCb: ((d: string) => void) | null = null;
      setTimeout(() => dataCb?.('SSH_PTY_FALLBACK_READY\r\n'), 10);
      return {
        id: sessionInfo.id,
        name: sessionInfo.name,
        serverId: sessionInfo.serverId,
        buffer: 'SSH_PTY_FALLBACK_READY\r\n',
        stream: {} as any,
        write() {},
        resize() {},
        kill() {},
        onData(cb: (d: string) => void) {
          dataCb = cb;
        },
        onExit() {},
      };
    },
    spawnExec: (_server: any, command: string) => {
      fallbackExecUsed = true;
      assert.match(command, /git status/);
      const stream: any = new EventEmitter();
      stream.stderr = new EventEmitter();
      stream.close = () => {};
      stream.signal = () => {};
      setImmediate(() => {
        stream.emit('data', Buffer.from('On branch main\n'));
        stream.emit('exit', 0);
        stream.emit('close', 0);
      });
      return stream;
    },
  });

  try {
    const shell = await sshPool.createShell(
      { id: 'sess-ssh-1', name: 'hermes', serverId: 'server-ssh-hermes-admin', cols: 100, rows: 30, cwd: '/home/hungnd' },
      {
        id: 'server-ssh-hermes-admin',
        name: 'hermes-admin',
        type: 'ssh',
        label: 'Remote SSH',
        host: 'hermes.example',
        user: 'hungnd',
        port: 22,
        workspace: '/home/hungnd',
      }
    );
    assert.equal(fallbackShellUsed, true, 'createShell must fall back to native ssh PTY when ssh2 fails');
    assert.match(shell.buffer, /SSH_PTY_FALLBACK_READY/);

    const execStream = await sshPool.executeCommand(
      {
        id: 'server-ssh-hermes-admin',
        name: 'hermes-admin',
        type: 'ssh',
        label: 'Remote SSH',
        host: 'hermes.example',
        user: 'hungnd',
        port: 22,
      },
      'git status'
    );
    const out = await new Promise<string>((resolve) => {
      let buf = '';
      execStream.on('data', (d: Buffer) => {
        buf += d.toString();
      });
      execStream.on('close', () => resolve(buf));
    });
    assert.equal(fallbackExecUsed, true, 'executeCommand must fall back to native ssh CLI when ssh2 fails');
    assert.match(out, /On branch main/);
  } finally {
    (sshPool as any).getClient = origGetClient;
    (sshPool as any).setNativeSshSpawnersForTest(null);
  }
});

await runTest('AC-2c: parseSshConfig parses ProxyJump/ProxyCommand, Included aliases, Host * inheritance, and stops at Match blocks; buildNativeSshArgs preserves Included alias', () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-ssh-proxyjump-'));
  const sshDir = path.join(tmpHome, '.ssh');
  const confD = path.join(sshDir, 'config.d');
  fs.mkdirSync(confD, { recursive: true });

  fs.writeFileSync(
    path.join(confD, 'hermes.conf'),
    [
      'Host hermes-admin hermes-prod',
      '    HostName 127.0.0.1',
      '    Port 2225',
      '    User hungnd',
      '    ProxyJump jump@158.178.227.183',
      '',
      'Match host localhost',
      '    HostName 127.0.0.1',
      '    Port 22',
    ].join('\n'),
    'utf8'
  );

  fs.writeFileSync(
    path.join(sshDir, 'config'),
    [
      'Include config.d/*.conf',
      '',
      'Host cf-box',
      '    HostName ssh.example.com',
      '    ProxyCommand cloudflared access ssh --hostname %h',
      '',
      'Host *',
      '    User defaultuser',
      '    Port 2222',
    ].join('\n'),
    'utf8'
  );

  const prevHome = process.env.HOME;
  try {
    process.env.HOME = tmpHome;
    const servers = parseSshConfig(tmpHome);
    const hermes = servers.find((s) => s.name === 'hermes-admin');
    assert.ok(hermes, 'hermes-admin must be parsed from Included config');
    assert.equal(hermes!.host, '127.0.0.1');
    assert.equal(hermes!.port, 2225, 'Match block must not overwrite Port 2225 of hermes-admin');
    assert.equal(hermes!.user, 'hungnd');
    assert.equal((hermes as any).proxyJump, 'jump@158.178.227.183');

    const hermesProd = servers.find((s) => s.name === 'hermes-prod');
    assert.ok(hermesProd, 'second alias on same Host line must also be parsed');
    assert.equal(hermesProd!.port, 2225);
    assert.equal((hermesProd as any).proxyJump, 'jump@158.178.227.183');

    const cfBox = servers.find((s) => s.name === 'cf-box');
    assert.ok(cfBox, 'cf-box must be parsed');
    assert.equal(cfBox!.user, 'defaultuser', 'cf-box must inherit User from Host *');
    assert.equal(cfBox!.port, 2222, 'cf-box must inherit Port from Host *');
    assert.equal((cfBox as any).proxyCommand, 'cloudflared access ssh --hostname %h');

    const nativeArgs = buildNativeSshArgs(hermes!, ['-tt'], tmpHome);
    assert.ok(
      nativeArgs.includes('hermes-admin'),
      `buildNativeSshArgs must pass alias "hermes-admin" for Included host so OpenSSH applies ProxyJump, got: ${nativeArgs.join(' ')}`
    );
    assert.ok(
      !nativeArgs.includes('hungnd@127.0.0.1'),
      'buildNativeSshArgs must NOT rewrite Included alias to hungnd@127.0.0.1 (which bypasses ProxyJump and causes Connection refused)'
    );

    const proxyCmdBracketed = buildProxyCommandFromJump('jump@[158.178.227.183]', '/usr/bin/ssh');
    assert.ok(
      proxyCmdBracketed.endsWith(" -W '[%h]:%p' jump@158.178.227.183"),
      `buildProxyCommandFromJump must strip ssh -G bracketed host so ssh destination resolves properly, got: ${proxyCmdBracketed}`
    );

    const proxyCmdPort = buildProxyCommandFromJump('jump@[158.178.227.183]:2222', '/usr/bin/ssh');
    assert.ok(
      proxyCmdPort.includes('-p 2222') && proxyCmdPort.endsWith('jump@158.178.227.183'),
      `buildProxyCommandFromJump must extract port into -p flag, got: ${proxyCmdPort}`
    );

    const homeProj = projectService.openHomeProject('server-ssh-hermes-admin');
    assert.equal(homeProj.rootPath, '~', 'Remote SSH home project must preserve "~" instead of expanding to local client os.homedir()');
  } finally {
    if (prevHome !== undefined) process.env.HOME = prevHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

await runTest('AC-3: fsService remote operations (listRemote, readRemoteFile, writeRemoteFile, createRemote, renameRemote, deleteRemote) fall back to sshPool.executeCommand when direct SFTP fails with ECONNREFUSED', async () => {
  const origGetSftp = sshPool.getSftp.bind(sshPool);
  const origExec = sshPool.executeCommand.bind(sshPool);
  const remoteTmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-remote-fs-fallback-'));
  fs.mkdirSync(path.join(remoteTmpRoot, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(remoteTmpRoot, 'hello.txt'), 'Xin chao tu remote fallback\n', 'utf8');

  (sshPool as any).getSftp = async () => {
    const err: any = new Error('connect ECONNREFUSED 127.0.0.1:2225');
    err.code = 'ECONNREFUSED';
    throw err;
  };

  const { spawn } = await import('node:child_process');
  (sshPool as any).executeCommand = async (_server: any, command: string) => {
    const child = spawn('/bin/sh', ['-c', command], { stdio: ['pipe', 'pipe', 'pipe'] });
    const channel: any = new EventEmitter();
    channel.stderr = new EventEmitter();
    channel.write = (d: any) => child.stdin.write(d);
    channel.end = (d?: any) => child.stdin.end(d);
    channel.close = () => child.kill('SIGTERM');
    channel.signal = () => child.kill('SIGTERM');
    child.stdout.on('data', (c) => channel.emit('data', c));
    child.stderr.on('data', (c) => channel.stderr.emit('data', c));
    child.on('exit', (code, sig) => channel.emit('exit', code, sig));
    child.on('close', (code, sig) => channel.emit('close', code, sig));
    return channel;
  };

  const fakeServer: any = {
    id: 'server-ssh-hermes-admin',
    name: 'hermes-admin',
    type: 'ssh',
    label: 'Remote SSH (hermes-admin)',
    host: '127.0.0.1',
    user: 'hungnd',
    port: 2225,
    proxyJump: 'jump@158.178.227.183',
    workspace: remoteTmpRoot,
  };

  try {
    const listed = await fsService.listRemote(fakeServer, '');
    assert.ok(listed.entries.some((e) => e.name === 'hello.txt' && !e.isDirectory));
    assert.ok(listed.entries.some((e) => e.name === 'sub' && e.isDirectory));

    const readRes = await fsService.readRemoteFile(fakeServer, 'hello.txt');
    assert.equal(readRes.name, 'hello.txt');
    assert.equal(readRes.content, 'Xin chao tu remote fallback\n');

    const writeRes = await fsService.writeRemoteFile(fakeServer, 'sub/new.txt', 'Noi dung moi 123');
    assert.equal(writeRes.size, Buffer.byteLength('Noi dung moi 123'));
    assert.equal(fs.readFileSync(path.join(remoteTmpRoot, 'sub/new.txt'), 'utf8'), 'Noi dung moi 123');

    await fsService.createRemote(fakeServer, 'created-dir', 'dir');
    assert.ok(fs.statSync(path.join(remoteTmpRoot, 'created-dir')).isDirectory());

    await fsService.renameRemote(fakeServer, 'sub/new.txt', 'sub/renamed.txt');
    assert.equal(fs.readFileSync(path.join(remoteTmpRoot, 'sub/renamed.txt'), 'utf8'), 'Noi dung moi 123');

    await fsService.deleteRemote(fakeServer, 'sub/renamed.txt');
    assert.equal(fs.existsSync(path.join(remoteTmpRoot, 'sub/renamed.txt')), false);
  } finally {
    (sshPool as any).getSftp = origGetSftp;
    (sshPool as any).executeCommand = origExec;
    fs.rmSync(remoteTmpRoot, { recursive: true, force: true });
  }
});

await runTest('AC-4: GET /api/system/version and POST /api/system/update report update availability and trigger quick update', async () => {
  systemUpdateService.setMockCheckProviderForTest(async () => ({
    currentVersion: '1.6.7',
    currentCommit: '1111111',
    latestVersion: '1.6.8',
    latestCommit: '2222222',
    latestReleaseTag: 'v1.6.8',
    channel: 'beta',
    hasUpdate: true,
    summary: 'Bản cập nhật mới v1.6.8 (2222222)',
    checkedAt: new Date().toISOString(),
    isDesktopApp: false,
  }));

  let updateTriggeredWith: any = null;
  systemUpdateService.setMockUpdateRunnerForTest(async (opts) => {
    updateTriggeredWith = opts;
    return {
      success: true,
      previousVersion: '1.6.7',
      updatedVersion: '1.6.8',
      updatedCommit: '2222222',
      channel: opts?.channel || 'beta',
      restarting: true,
      message: 'Đã cập nhật thành công lên v1.6.8 (2222222)',
    };
  });

  const app = await createApp();
  try {
    const getRes = await app.inject({ method: 'GET', url: '/api/system/version' });
    assert.equal(getRes.statusCode, 200);
    const vData = getRes.json();
    assert.equal(vData.currentVersion, '1.6.7');
    assert.equal(vData.latestVersion, '1.6.8');
    assert.equal(vData.hasUpdate, true);

    const postRes = await app.inject({
      method: 'POST',
      url: '/api/system/update',
      payload: { channel: 'beta' },
    });
    assert.equal(postRes.statusCode, 200);
    const uData = postRes.json();
    assert.equal(uData.success, true);
    assert.equal(uData.updatedVersion, '1.6.8');
    assert.equal(updateTriggeredWith?.channel, 'beta');
  } finally {
    systemUpdateService.setMockCheckProviderForTest(null);
    systemUpdateService.setMockUpdateRunnerForTest(null);
    await app.close();
  }
});

await runTest('AC-5: macOS Jump Server multi-key auth, non-interactive ProxyCommand host-key bypass, ControlMaster multiplexing, and macOS /Users workspace sanitization', () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-mac-jump-fix-'));
  const sshDir = path.join(tmpHome, '.ssh');
  fs.mkdirSync(sshDir, { recursive: true });

  const vpsKeyPath = path.join(sshDir, 'vps_tunnel');
  const edKeyPath = path.join(sshDir, 'id_ed25519');
  fs.writeFileSync(vpsKeyPath, '-----BEGIN OPENSSH PRIVATE KEY-----\ndnBzX3R1bm5lbF9kdW1teQ==\n-----END OPENSSH PRIVATE KEY-----\n', { mode: 0o600 });
  fs.writeFileSync(edKeyPath, '-----BEGIN OPENSSH PRIVATE KEY-----\naWRfZWQyNTUxOV9kdW1teQ==\n-----END OPENSSH PRIVATE KEY-----\n', { mode: 0o600 });

  fs.writeFileSync(
    path.join(sshDir, 'config'),
    [
      'Host hermes-admin',
      '    HostName 127.0.0.1',
      '    Port 2225',
      '    User hungnd',
      '    ProxyJump jump@158.178.227.183',
      `    # Workspace /Users/${path.basename(os.homedir())}`,
    ].join('\n'),
    'utf8'
  );

  const prevHome = process.env.HOME;
  try {
    process.env.HOME = tmpHome;
    const servers = parseSshConfig(tmpHome);
    const hermes = servers.find((s) => s.name === 'hermes-admin')!;
    assert.ok(hermes, 'hermes-admin must exist');
    assert.ok(
      !hermes.workspace?.startsWith('/Users/'),
      `parseSshConfig must sanitize leaked macOS /Users/... workspace on remote SSH server, got: ${hermes.workspace}`
    );

    const target = resolveEffectiveSshTarget(hermes, tmpHome);
    const keys = resolveUsablePrivateKeys(target);
    assert.ok(
      keys.length >= 2,
      `resolveUsablePrivateKeys must return ALL unencrypted keys (both vps_tunnel and id_ed25519), got ${keys.length}`
    );

    assert.ok(
      target.proxyCommand && target.proxyCommand.includes('UserKnownHostsFile=/dev/null'),
      `target.proxyCommand must include UserKnownHostsFile=/dev/null for non-interactive GUI app, got: ${target.proxyCommand}`
    );
    assert.ok(
      target.proxyCommand && target.proxyCommand.includes(vpsKeyPath),
      `target.proxyCommand must pass custom ~/.ssh/vps_tunnel key with -i so Jump Server auth succeeds, got: ${target.proxyCommand}`
    );

    const execArgs = buildNativeSshArgs(hermes, ['-o', 'BatchMode=yes', 'echo READY'], tmpHome);
    const hostIdx = execArgs.indexOf('hermes-admin');
    const batchIdx = execArgs.indexOf('BatchMode=yes');
    assert.ok(hostIdx !== -1 && batchIdx !== -1 && batchIdx < hostIdx, `SSH option flags (-o BatchMode=yes) must precede hostname in buildNativeSshArgs: ${execArgs.join(' ')}`);
    assert.ok(
      execArgs.some((a) => a.includes('ControlMaster=auto')),
      `buildNativeSshArgs must enable ControlMaster=auto multiplexing: ${execArgs.join(' ')}`
    );
    assert.ok(
      execArgs.some((a) => a.startsWith('ProxyCommand=') && a.includes('UserKnownHostsFile=/dev/null')),
      `buildNativeSshArgs must pass hardened ProxyCommand for ProxyJump host: ${execArgs.join(' ')}`
    );

    saveOrUpdateSshConfigHost({
      ...hermes,
      workspace: '~',
    });
    const savedCfg = fs.readFileSync(path.join(sshDir, 'config'), 'utf8');
    assert.ok(savedCfg.includes('ProxyJump jump@158.178.227.183'), 'saveOrUpdateSshConfigHost must preserve ProxyJump');
    assert.ok(!savedCfg.includes('/Users/'), 'saveOrUpdateSshConfigHost must not expand ~ to /Users/... for remote SSH server');
  } finally {
    if (prevHome !== undefined) process.env.HOME = prevHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

if (failures > 0) {
  process.exit(1);
}
