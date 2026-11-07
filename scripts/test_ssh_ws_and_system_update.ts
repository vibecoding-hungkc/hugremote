import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../apps/api/src/app.js';
import { sshPool, isEncryptedPrivateKeyBuffer } from '../apps/api/src/services/sshPool.js';
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

if (failures > 0) {
  process.exit(1);
}
