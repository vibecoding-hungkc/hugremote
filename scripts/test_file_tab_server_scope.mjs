import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

const vite = await createServer({ root: 'apps/web', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
let failures = 0;
try {
  const { useFileStore } = await vite.ssrLoadModule('/src/stores/fileStore.ts');
  const { useProjectStore } = await vite.ssrLoadModule('/src/stores/projectStore.ts');
  async function test(name, run) {
    setActivePinia(createPinia());
    const originalFetch = globalThis.fetch;
    try { await run(useFileStore(), useProjectStore()); console.log('PASS', name); }
    catch (error) { failures++; console.error('FAIL', name, error.message); }
    finally { globalThis.fetch = originalFetch; }
  }
  const listing = (rel) => new Response(JSON.stringify({ currentRel: rel, parentRel: rel ? '' : null, entries: [] }));
  await test('Files directory stays on the same server path when selected project changes', async (files, projects) => {
    projects.projects = [{ id:'one', serverId:'server-local', rootPath:'/home/one' }, { id:'two', serverId:'server-local', rootPath:'/home/two' }];
    projects.activeProjectIdByServer['server-local'] = 'one';
    const urls = [];
    globalThis.fetch = async url => { urls.push(String(url)); return listing('Documents'); };
    await files.fetchFiles('Documents');
    projects.activeProjectIdByServer['server-local'] = 'two';
    await files.fetchFiles(files.currentRel);
    assert.equal(files.currentRel, 'Documents');
    assert.ok(urls.every(url => new URL(url, 'http://localhost').searchParams.get('fsScope') === 'server'));
    assert.ok(urls.every(url => !new URL(url, 'http://localhost').searchParams.has('projectId')));
  });
  await test('Directories are isolated by server and restored when switching back', async files => {
    const { useServerStore } = await vite.ssrLoadModule('/src/stores/serverStore.ts');
    const server = useServerStore();
    const paths = [];
    globalThis.fetch = async url => { const q = new URL(url, 'http://localhost').searchParams; paths.push([q.get('serverId'), q.get('path')]); return listing(q.get('path')); };
    await files.fetchFiles('Documents');
    server.currentServerId = 'server-remote';
    await files.fetchFiles();
    await files.fetchFiles('srv/logs');
    server.currentServerId = 'server-local';
    await files.fetchFiles();
    assert.deepEqual(paths, [['server-local', 'Documents'], ['server-remote', ''], ['server-remote', 'srv/logs'], ['server-local', 'Documents']]);
  });
  await test('Changing a server workspace resets stale relative directory', async files => {
    const { useServerStore } = await vite.ssrLoadModule('/src/stores/serverStore.ts');
    const server = useServerStore();
    server.servers[0].workspace = '/one';
    globalThis.fetch = async url => listing(new URL(url, 'http://localhost').searchParams.get('path'));
    await files.fetchFiles('Documents');
    server.servers[0].workspace = '/two';
    await files.fetchFiles();
    assert.equal(files.currentRel, '');
  });
  await test('Missing remembered folder falls back to the workspace root', async files => {
    const paths = [];
    let removed = false;
    globalThis.fetch = async url => {
      const path = new URL(url, 'http://localhost').searchParams.get('path');
      paths.push(path);
      return path === 'removed' && removed ? new Response('{"error":"Directory does not exist"}', { status: 400 }) : listing(path);
    };
    await files.fetchFiles('removed');
    removed = true;
    await files.fetchFiles();
    assert.equal(files.currentRel, '');
    assert.deepEqual(paths, ['removed', 'removed', '']);
  });
  await test('Obsolete folder response cannot replace the newer location', async files => {
    const pending = [];
    globalThis.fetch = (url) => new Promise(resolve => pending.push({ url: String(url), resolve }));
    const first = files.fetchFiles('Documents');
    const second = files.fetchFiles('Pictures');
    pending[1].resolve(listing('Pictures')); await second;
    pending[0].resolve(listing('Documents')); await first;
    assert.equal(files.currentRel, 'Pictures');
  });
  await test('File read and save use independent server filesystem scope', async files => {
    const calls = [];
    globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return String(url).includes('/read?') ? new Response(JSON.stringify({ name:'note.txt', content:'Hi' })) : new Response('{}'); };
    assert.equal(await files.openFile('Documents/note.txt'), true);
    files.activeFile.content = 'Saved';
    await files.saveActiveFile();
    assert.equal(new URL(calls[0].url, 'http://localhost').searchParams.get('fsScope'), 'server');
    assert.equal(JSON.parse(calls[1].init.body).fsScope, 'server');
  });
  await test('Directory is remembered when store is recreated after page reload', async files => {
    const { useServerStore } = await vite.ssrLoadModule('/src/stores/serverStore.ts');
    const server = useServerStore();
    server.currentServerId = 'server-local';
    const memory = new Map();
    const prior = globalThis.localStorage;
    globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
    try {
      globalThis.fetch = async url => listing(new URL(url, 'http://localhost').searchParams.get('path'));
      await files.fetchFiles('Documents/reports');
      assert.equal(files.currentRel, 'Documents/reports');
      setActivePinia(createPinia());
      const revived = useFileStore();
      await revived.fetchFiles();
      assert.equal(revived.currentRel, 'Documents/reports');
    } finally { globalThis.localStorage = prior; }
  });
  await test('File create, download and upload do not inherit selected project', async files => {
    const calls = [];
    globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return String(url).includes('/api/fs?') ? listing('Documents') : new Response('{"count":1}'); };
    await files.fetchFiles('Documents');
    await files.createItem('note.txt','file');
    assert.equal(JSON.parse(calls[1].init.body).fsScope, 'server');
    assert.equal(new URL(files.getDownloadUrl('Documents/note.txt'), 'http://localhost').searchParams.get('fsScope'), 'server');
    await files.uploadFiles([new File(['draft'], 'draft.txt')]);
    assert.equal(new URL(calls[3].url, 'http://localhost').searchParams.get('fsScope'), 'server');
  });
} finally {
  await vite.close();
}
if (failures) process.exitCode = 1;
