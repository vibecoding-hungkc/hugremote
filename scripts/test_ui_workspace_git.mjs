import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

const root = fileURLToPath(new URL('../apps/web/', import.meta.url));
const repoRootDir = fileURLToPath(new URL('../', import.meta.url));
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

  await test('multi-repo store: fetchRepos, dirty filter, and selectRepo pass repoPath up to 5 levels', async () => {
    projects.projects = [{ id: 'project-multi', serverId: 'server-local', name: 'Multi', rootPath: '/multi' }];
    const requestedUrls = [];
    const postedBodies = [];
    globalThis.fetch = async (url, init) => {
      const urlStr = String(url);
      requestedUrls.push(urlStr);
      if (init?.body) postedBodies.push(JSON.parse(String(init.body)));
      if (urlStr.includes('/api/git/repos')) {
        return {
          ok: true,
          json: async () => ({
            maxDepth: 5,
            repos: [
              { relPath: '.', name: 'multi', depth: 0, branch: 'main', ahead: 0, behind: 0, hasUpstream: true, upstream: 'origin/main', changedCount: 0, stagedCount: 0, unstagedCount: 0, untrackedCount: 0, clean: true },
              { relPath: 'packages/core-sdk', name: 'core-sdk', depth: 2, branch: 'feat/sdk', ahead: 1, behind: 0, hasUpstream: true, upstream: 'origin/feat/sdk', changedCount: 2, stagedCount: 1, unstagedCount: 1, untrackedCount: 0, clean: false },
              { relPath: 'a/b/c/d/e', name: 'e', depth: 5, branch: 'chore/deep', ahead: 0, behind: 0, hasUpstream: false, upstream: '', changedCount: 1, stagedCount: 0, unstagedCount: 0, untrackedCount: 1, clean: false },
            ],
          }),
        };
      }
      if (urlStr.includes('/api/git/branches')) {
        return { ok: true, json: async () => ({ branches: [{ name: 'feat/sdk', current: true }] }) };
      }
      return {
        ok: true,
        json: async () => ({
          branch: 'feat/sdk',
          upstream: 'origin/feat/sdk',
          hasUpstream: true,
          ahead: 1,
          behind: 0,
          repoRoot: '/multi/packages/core-sdk',
          files: [{ path: 'src/index.ts', status: 'M', staged: true, additions: 4, deletions: 1 }],
        }),
      };
    };

    await git.fetchRepos();
    assert.equal(git.repos.length, 3);
    assert.equal(git.dirtyRepoCount, 2);
    git.repoFilter = 'dirty';
    assert.equal(git.filteredRepos.length, 3, 'dirty filter keeps dirty repos plus active selected repo');
    await git.selectRepo('packages/core-sdk');
    assert.equal(git.selectedRepoPath, 'packages/core-sdk');
    assert.equal(git.filteredRepos.length, 2, 'dirty filter hides clean non-selected root repo');
    assert.ok(requestedUrls.some(u => u.includes('/api/git/status') && u.includes('repoPath=packages%2Fcore-sdk')));
    assert.ok(requestedUrls.some(u => u.includes('/api/git/branches') && u.includes('repoPath=packages%2Fcore-sdk')));

    await git.stageFile('src/index.ts');
    assert.equal(postedBodies.at(-1)?.repoPath, 'packages/core-sdk');
    assert.equal(git.repos.find(r => r.relPath === 'packages/core-sdk')?.changedCount, 1);
  });

  await test('GitService.discoverRepos & resolveProjectSubpath enforce maxDepth=5 and skip node_modules', async () => {
    const { GitService, resolveProjectSubpath, MAX_GIT_SCAN_DEPTH } = await vite.ssrLoadModule(
      path.join(repoRootDir, 'apps/api/src/services/gitService.ts')
    );
    assert.equal(MAX_GIT_SCAN_DEPTH, 5);
    assert.deepEqual(resolveProjectSubpath('/root/proj', '.'), { targetPath: '/root/proj', relPath: '.', depth: 0 });
    assert.deepEqual(resolveProjectSubpath('/root/proj', 'a/b/c/d/e'), { targetPath: '/root/proj/a/b/c/d/e', relPath: 'a/b/c/d/e', depth: 5 });
    assert.throws(() => resolveProjectSubpath('/root/proj', 'a/b/c/d/e/f'), /maximum depth of 5/);
    assert.throws(() => resolveProjectSubpath('/root/proj', '../escape'), /Invalid repoPath/);
    assert.throws(() => resolveProjectSubpath('/root/proj', '/abs/path'), /Invalid repoPath/);

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-multirepo-'));
    try {
      const initRepo = (relDir, dirtyFile) => {
        const dir = path.join(tmpRoot, relDir);
        fs.mkdirSync(dir, { recursive: true });
        execFileSync('git', ['init', '-b', 'main'], { cwd: dir, stdio: 'ignore' });
        if (dirtyFile) {
          fs.writeFileSync(path.join(dir, dirtyFile), 'hello\n');
        }
      };
      initRepo('.', 'root.txt');
      initRepo('packages/sub-b', 'sub.txt');
      initRepo('L1/L2/L3/L4/L5', null);
      initRepo('d1/d2/d3/d4/d5/d6-too-deep', 'deep.txt');
      initRepo('node_modules/ignored-pkg', 'ignored.txt');

      const svc = new GitService();
      const discovered = await svc.discoverRepos(tmpRoot, 5);
      assert.deepEqual(
        discovered.map(r => ({ relPath: r.relPath, depth: r.depth, clean: r.clean })),
        [
          { relPath: '.', depth: 0, clean: false },
          { relPath: 'packages/sub-b', depth: 2, clean: false },
          { relPath: 'L1/L2/L3/L4/L5', depth: 5, clean: true },
        ]
      );
      assert.equal(discovered.find(r => r.relPath === 'packages/sub-b')?.changedCount, 1);
      assert.equal(discovered.find(r => r.relPath === 'L1/L2/L3/L4/L5')?.changedCount, 0);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  await test('ClaudeView.vue renders Vietnamese Web Speech API Mic button (#btn-claude-mic) next to ri-shield-check-line with strictly 2 states', async () => {
    const claudeViewSrc = fs.readFileSync(path.join(repoRootDir, 'apps/web/src/components/ClaudeView.vue'), 'utf8');
    assert.match(claudeViewSrc, /id="btn-claude-mic"[\s\S]*?id="btn-claude-shield"/, 'Mic button must sit immediately before permission shield button');
    assert.match(claudeViewSrc, /rec\.lang\s*=\s*'vi-VN'/, 'Web Speech API must be configured for Vietnamese (vi-VN)');
    assert.match(claudeViewSrc, /v-if="micState === 'recording' \|\| micState === 'transcribing'"/, 'Voice status bar must only render for recording and transcribing states');
    assert.match(claudeViewSrc, /micState\.value\s*=\s*'idle'/, 'Mic state must return directly to idle after filling inputText');
  });
} finally {
  await vite.close();
}
process.exitCode = failures ? 1 : 0;
