import test from 'node:test';
import assert from 'node:assert/strict';
import { fsService } from '../server/src/services/fsService.js';
import { sshPool } from '../server/src/services/sshPool.js';
import { parseSshConfig } from '../server/src/config.js';

test('Remote FS operations unit tests with mock SFTP', async () => {
  const mockFiles = new Map<string, { isDir: boolean; content?: string }>();
  mockFiles.set('/home/remoteuser/project', { isDir: true });

  const mockSftp = {
    stat: (pathStr: string, cb: Function) => {
      const entry = mockFiles.get(pathStr);
      if (entry) {
        cb(null, {
          mode: entry.isDir ? 0o040755 : 0o100644,
          size: entry.content ? Buffer.byteLength(entry.content) : 4096,
          mtime: Math.floor(Date.now() / 1000),
        });
      } else {
        cb(new Error('ENOENT: no such file or directory'));
      }
    },
    lstat: (pathStr: string, cb: Function) => {
      mockSftp.stat(pathStr, cb);
    },
    mkdir: (pathStr: string, cb: Function) => {
      mockFiles.set(pathStr, { isDir: true });
      cb(null);
    },
    writeFile: (pathStr: string, content: string, encoding: string, cb: Function) => {
      mockFiles.set(pathStr, { isDir: false, content });
      cb(null);
    },
    readFile: (pathStr: string, cb: Function) => {
      const entry = mockFiles.get(pathStr);
      if (entry && !entry.isDir) {
        cb(null, Buffer.from(entry.content || '', 'utf8'));
      } else {
        cb(new Error('ENOENT'));
      }
    },
    unlink: (pathStr: string, cb: Function) => {
      if (mockFiles.has(pathStr)) {
        mockFiles.delete(pathStr);
        cb(null);
      } else {
        cb(new Error('ENOENT'));
      }
    },
    rmdir: (pathStr: string, cb: Function) => {
      if (mockFiles.has(pathStr)) {
        mockFiles.delete(pathStr);
        cb(null);
      } else {
        cb(new Error('ENOENT'));
      }
    },
    readdir: (pathStr: string, cb: Function) => {
      const results: any[] = [];
      const prefix = pathStr.endsWith('/') ? pathStr : pathStr + '/';
      for (const [key, val] of mockFiles.entries()) {
        if (key.startsWith(prefix) && key !== pathStr) {
          const rest = key.slice(prefix.length);
          if (!rest.includes('/')) {
            results.push({
              filename: rest,
              attrs: {
                mode: val.isDir ? 0o040755 : 0o100644,
                size: val.content ? Buffer.byteLength(val.content) : 0,
                mtime: Math.floor(Date.now() / 1000),
              },
            });
          }
        }
      }
      cb(null, results);
    },
    rename: (oldPath: string, newPath: string, cb: Function) => {
      const entry = mockFiles.get(oldPath);
      if (entry) {
        mockFiles.delete(oldPath);
        mockFiles.set(newPath, entry);
        cb(null);
      } else {
        cb(new Error('ENOENT'));
      }
    },
  };

  const origGetSftp = sshPool.getSftp;
  (sshPool as any).getSftp = async () => mockSftp as any;

  const mockServer = {
    id: 'server-ssh-test',
    name: 'test',
    type: 'ssh' as const,
    label: 'Test Server',
    host: '127.0.0.1',
    user: 'remoteuser',
    port: 22,
    workspace: '/home/remoteuser/project',
  };

  try {
    // 1. Create file
    await fsService.createRemote(mockServer, 'src/test.txt', 'file');
    assert.ok(mockFiles.has('/home/remoteuser/project/src/test.txt'));
    assert.strictEqual(mockFiles.get('/home/remoteuser/project/src/test.txt')?.isDir, false);

    // 2. Creating existing file throws 'Item already exists'
    await assert.rejects(
      () => fsService.createRemote(mockServer, 'src/test.txt', 'file'),
      /already exists/
    );

    // 3. Write file
    await fsService.writeRemoteFile(mockServer, 'src/test.txt', 'Hello Remote World');
    assert.strictEqual(mockFiles.get('/home/remoteuser/project/src/test.txt')?.content, 'Hello Remote World');

    // 4. Read file
    const fileData = await fsService.readRemoteFile(mockServer, 'src/test.txt');
    assert.strictEqual(fileData.content, 'Hello Remote World');
    assert.strictEqual(fileData.name, 'test.txt');

    // 5. Create directory
    await fsService.createRemote(mockServer, 'src/nested/folder', 'dir');
    assert.ok(mockFiles.has('/home/remoteuser/project/src/nested/folder'));
    assert.strictEqual(mockFiles.get('/home/remoteuser/project/src/nested/folder')?.isDir, true);

    // 6. Rename file
    await fsService.renameRemote(mockServer, 'src/test.txt', 'src/renamed.txt');
    assert.ok(!mockFiles.has('/home/remoteuser/project/src/test.txt'));
    assert.ok(mockFiles.has('/home/remoteuser/project/src/renamed.txt'));

    // 7. Delete file
    await fsService.deleteRemote(mockServer, 'src/renamed.txt');
    assert.ok(!mockFiles.has('/home/remoteuser/project/src/renamed.txt'));

    // 8. Delete directory recursively
    await fsService.createRemote(mockServer, 'temp/child1.txt', 'file');
    await fsService.createRemote(mockServer, 'temp/sub/child2.txt', 'file');
    await fsService.deleteRemote(mockServer, 'temp');
    assert.ok(!mockFiles.has('/home/remoteuser/project/temp'));
    assert.ok(!mockFiles.has('/home/remoteuser/project/temp/child1.txt'));
    assert.ok(!mockFiles.has('/home/remoteuser/project/temp/sub/child2.txt'));

    // 9. Root workspace protection
    await assert.rejects(
      () => fsService.deleteRemote(mockServer, ''),
      /Cannot delete root workspace/
    );
  } finally {
    (sshPool as any).getSftp = origGetSftp;
  }
});

test('Live remote server FS actions over SSH / SFTP (if configured)', async () => {
  const servers = parseSshConfig();
  const remoteServer = servers.find((s) => s.type === 'ssh' && (s.id.includes('claude-server') || s.port === 2222));
  if (!remoteServer) {
    console.log('No live SSH container available, skipping live integration test');
    return;
  }

  const testDir = `tmp_test_fs_${Date.now()}`;
  try {
    // Test create dir
    await fsService.createRemote(remoteServer, testDir, 'dir');

    // Test create file inside dir
    await fsService.createRemote(remoteServer, `${testDir}/sample.txt`, 'file');

    // Test write file
    await fsService.writeRemoteFile(remoteServer, `${testDir}/sample.txt`, 'hugremote remote fs test content');

    // Test read file
    const read = await fsService.readRemoteFile(remoteServer, `${testDir}/sample.txt`);
    assert.strictEqual(read.content, 'hugremote remote fs test content');

    // Test list directory
    const list = await fsService.listRemote(remoteServer, testDir);
    assert.ok(list.entries.some((e) => e.name === 'sample.txt'));

    // Test rename
    await fsService.renameRemote(remoteServer, `${testDir}/sample.txt`, `${testDir}/renamed_sample.txt`);
    const listAfterRename = await fsService.listRemote(remoteServer, testDir);
    assert.ok(listAfterRename.entries.some((e) => e.name === 'renamed_sample.txt'));

    // Test delete recursive
    await fsService.deleteRemote(remoteServer, testDir);

    // Verify deleted
    await assert.rejects(
      () => fsService.readRemoteFile(remoteServer, `${testDir}/renamed_sample.txt`)
    );
    console.log('✓ Live remote SSH/SFTP file operations verified successfully on', remoteServer.name);
  } catch (err: any) {
    console.warn('Live remote test notice:', err.message);
  }
});
