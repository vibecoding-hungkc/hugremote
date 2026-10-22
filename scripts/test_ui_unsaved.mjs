import assert from 'node:assert/strict';
import { createServer } from 'vite';
const vite = await createServer({ root: 'apps/web', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
let failures = 0;
try {
  const { createPinia, setActivePinia } = await import('pinia');
  const { useFileStore } = await vite.ssrLoadModule('/src/stores/fileStore.ts');
  async function test(name, run) {
    setActivePinia(createPinia());
    try { await run(useFileStore()); console.log('PASS', name); }
    catch (e) { failures++; console.error('FAIL', name, e.message); }
  }
  const { useProjectStore } = await vite.ssrLoadModule('/src/stores/projectStore.ts');
  await test('failed project selection retains original mapping', async () => {
    const projects = useProjectStore(); projects.activeProjectIdByServer.local = 'old';
    globalThis.fetch = async () => new Response('{"error":"denied"}', { status: 500 });
    await assert.rejects(projects.selectProject('new', 'local'), /denied/);
    assert.equal(projects.activeProjectIdByServer.local, 'old');
  });
  await test('project fetch propagates errors without mutating cached scope', async () => {
    const projects = useProjectStore(); projects.projects = [{ id: 'old', serverId: 'local' }];
    projects.activeProjectIdByServer.local = 'old';
    globalThis.fetch = async () => new Response('{"error":"offline"}', { status: 500 });
    await assert.rejects(projects.fetchProjects('local'), /offline/);
    assert.equal(projects.error, 'offline'); assert.equal(projects.activeProjectIdByServer.local, 'old');
  });
  await test('selection refresh failure does not publish new project scope', async () => {
    const projects = useProjectStore(); projects.activeProjectIdByServer.local = 'old';
    let calls = 0;
    globalThis.fetch = async () => ++calls === 1
      ? new Response('{"project":{"id":"new","serverId":"local"}}')
      : new Response('{"error":"refresh failed"}', { status: 500 });
    await assert.rejects(projects.selectProject('new', 'local'), /refresh failed/);
    assert.equal(projects.activeProjectIdByServer.local, 'old');
  });
  const dirty = (store) => { store.activeFile = { relPath: 'a.txt', name: 'a.txt', content: 'edited', originalContent: 'old', isDirty: true }; };
  await test('dirty Close waits for choice; Cancel retains exact buffer', async store => {
    dirty(store);
    const closing = store.closeActiveFile();
    assert.ok(store.activeFile, 'dirty buffer was immediately discarded');
    assert.equal(store.isUnsavedPromptOpen, true);
    await store.resolveUnsavedChanges('cancel');
    assert.equal(await closing, false);
    assert.equal(store.activeFile.content, 'edited');
  });
  await test('Discard permits Close without saving', async store => {
    dirty(store); let writes = 0; globalThis.fetch = async () => { writes++; return new Response('{}'); };
    const closing = store.closeActiveFile();
    assert.equal(store.isUnsavedPromptOpen, true);
    await store.resolveUnsavedChanges('discard');
    assert.equal(await closing, true); assert.equal(store.activeFile, null); assert.equal(writes, 0);
  });
  await test('Save uses original scope and content before Close', async store => {
    dirty(store); let body;
    globalThis.fetch = async (_, init) => { body = JSON.parse(init.body); return new Response('{}'); };
    const closing = store.closeActiveFile();
    assert.equal(store.isUnsavedPromptOpen, true);
    await store.resolveUnsavedChanges('save');
    assert.equal(await closing, true); assert.equal(body.content, 'edited'); assert.equal(body.path, 'a.txt'); assert.equal(store.activeFile, null);
  });
  await test('failed Save keeps prompt and buffer; Cancel still works', async store => {
    dirty(store); globalThis.fetch = async () => new Response('{"error":"disk full"}', { status: 500 });
    const closing = store.closeActiveFile();
    assert.equal(store.isUnsavedPromptOpen, true);
    await store.resolveUnsavedChanges('save');
    assert.equal(store.isUnsavedPromptOpen, true); assert.match(store.unsavedPromptError, /disk full/); assert.equal(store.activeFile.content, 'edited');
    await store.resolveUnsavedChanges('cancel'); assert.equal(await closing, false);
  });
  await test('edits arriving during Save stay dirty and cannot be discarded by Save choice', async store => {
    dirty(store); let finish;
    globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
    const closing = store.closeActiveFile();
    const saving = store.resolveUnsavedChanges('save');
    store.activeFile.content = 'newer edit';
    finish(new Response('{}')); await saving;
    assert.equal(store.isUnsavedPromptOpen, true); assert.equal(store.activeFile.isDirty, true);
    assert.equal(store.activeFile.originalContent, 'edited');
    await store.resolveUnsavedChanges('cancel'); assert.equal(await closing, false);
  });
  const tick = () => new Promise(resolve => setImmediate(resolve));
  await test('toolbar and modal saves serialize writes before closing', async store => {
    dirty(store); const requests = [];
    globalThis.fetch = (_, init) => new Promise(resolve => requests.push({ body: JSON.parse(init.body), resolve }));
    const toolbar = store.saveActiveFile();
    store.activeFile.content = 'newer';
    const closing = store.closeActiveFile();
    const modal = store.resolveUnsavedChanges('save');
    assert.equal(requests.length, 1, 'concurrent disk writes must not start');
    requests[0].resolve(new Response('{}')); await toolbar; await tick();
    assert.equal(requests.length, 2); assert.equal(requests[1].body.content, 'newer');
    assert.ok(store.activeFile); requests[1].resolve(new Response('{}')); await modal;
    assert.equal(await closing, true);
  });
  await test('obsolete read cannot replace newer open', async store => {
    const requests = []; globalThis.fetch = () => new Promise(resolve => requests.push(resolve));
    const first = store.openFile('first'); await tick();
    const second = store.openFile('second'); await tick();
    requests[1](new Response('{"name":"second","content":"two"}')); assert.equal(await second, true);
    requests[0](new Response('{"name":"first","content":"one"}')); assert.equal(await first, false);
    assert.equal(store.activeFile.relPath, 'second');
  });
  await test('read cannot replace edits acquired while fetching', async store => {
    dirty(store); store.activeFile.isDirty = false; let finish;
    globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
    const opening = store.openFile('b'); await tick();
    store.activeFile.content = 'new edits'; store.activeFile.isDirty = true;
    finish(new Response('{"name":"b","content":"B"}'));
    assert.equal(await opening, false); assert.equal(store.activeFile.content, 'new edits');
  });
  await test('close cannot discard edits acquired after its guard', async store => {
    dirty(store); store.activeFile.isDirty = false;
    const closing = store.closeActiveFile();
    store.activeFile.content = 'just typed'; store.activeFile.isDirty = true;
    assert.equal(await closing, false); assert.equal(store.activeFile.content, 'just typed');
  });
  await test('competing open while prompt is open rejects second and allows first to proceed', async store => {
    dirty(store);
    globalThis.fetch = async () => new Response('{"name":"a.txt","content":"A"}');
    const first = store.openFile('a.txt');
    const second = store.openFile('b.txt');
    assert.equal(await second, false);
    await store.resolveUnsavedChanges('discard');
    assert.equal(await first, true);
    assert.equal(store.activeFile.relPath, 'a.txt');
  });
  await test('one prompt authorizes only its original action', async store => {
    dirty(store); const first = store.confirmUnsavedChanges(); const second = store.confirmUnsavedChanges();
    await store.resolveUnsavedChanges('discard');
    assert.equal(await first, true); assert.equal(await second, false);
  });
  await test('opening another file cannot silently replace dirty buffer', async store => {
    dirty(store); let calls = 0; globalThis.fetch = async () => { calls++; return new Response('{"name":"b.txt","content":"B"}'); };
    const opening = store.openFile('b.txt');
    assert.equal(store.isUnsavedPromptOpen, true);
    await store.resolveUnsavedChanges('cancel');
    assert.equal(await opening, false); assert.equal(calls, 0); assert.equal(store.activeFile.relPath, 'a.txt');
  });
} finally { await vite.close(); }
process.exitCode = failures ? 1 : 0;
