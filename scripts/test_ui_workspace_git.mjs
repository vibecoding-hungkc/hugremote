import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

const root = fileURLToPath(new URL('../apps/web/', import.meta.url));
Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });
const vite = await createServer({ root, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let failures = 0;
async function test(name, run) {
  try { await run(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
}
try {
  const { useGitStore } = await vite.ssrLoadModule('/src/stores/gitStore.ts');
  const { useProjectStore } = await vite.ssrLoadModule('/src/stores/projectStore.ts');
  setActivePinia(createPinia());
  const projects = useProjectStore();
  projects.projects = [{ id: 'project-test', serverId: 'server-local', name: 'Test', rootPath: '/test' }];
  const git = useGitStore();
  const status = { branch: 'main', upstream: 'origin/main', hasUpstream: true, fetchedAt: '2026-10-22T01:00:00Z', ahead: 2, behind: 1, repoRoot: '/test', files: [{ path: 'test.txt' }] };
  globalThis.fetch = async () => ({ ok: true, json: async () => status });
  await test('fetchStatus binds upstream metadata from the status response', async () => {
    await git.fetchStatus();
    assert.equal(git.upstream, status.upstream);
    assert.equal(git.hasUpstream, true);
    assert.equal(git.fetchedAt, status.fetchedAt);
    assert.equal(git.ahead, 2);
  });
  await test('status error clears stale repository and upstream state', async () => {
    Object.assign(git, status);
    globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: 'Not a repository' }) });
    await git.fetchStatus();
    assert.equal(git.error, 'Not a repository');
    for (const field of ['branch', 'upstream', 'repoRoot', 'fetchedAt']) assert.equal(git[field], '', field);
    assert.equal(git.hasUpstream, false);
    assert.equal(git.ahead, 0);
    assert.equal(git.behind, 0);
    assert.deepEqual(git.files, []);
  });
  await test('status refresh without upstream clears previous upstream metadata', async () => {
    Object.assign(git, status);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ branch: 'feature', files: [] }) });
    await git.fetchStatus();
    assert.equal(git.upstream, '');
    assert.equal(git.hasUpstream, false);
    assert.equal(git.fetchedAt, '');
    assert.equal(git.ahead, 0);
    assert.equal(git.behind, 0);
  });
  await test('missing active project resets status without making a request', async () => {
    Object.assign(git, status);
    git.error = 'Old error';
    projects.projects = [];
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('Unexpected request'); };
    await git.fetchStatus();
    assert.equal(git.upstream, '');
    assert.equal(git.hasUpstream, false);
    assert.equal(git.fetchedAt, '');
    assert.equal(git.branch, '');
    assert.equal(git.error, null);
    assert.equal(calls, 0);
  });
} finally {
  await vite.close();
}
process.exitCode = failures ? 1 : 0;
