import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';
import { createRenderer, createSSRApp, h, nextTick, ssrContextKey } from 'vue';
import { renderToString } from '@vue/server-renderer';

const root = fileURLToPath(new URL('../apps/web/', import.meta.url));
const source = fs.readFileSync(fileURLToPath(new URL('../apps/web/src/components/GitView.vue', import.meta.url)), 'utf8');
Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });
const vite = await createServer({ root, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
  parentNode: () => null, nextSibling: () => null,
});
let failures = 0;
async function test(name, run) {
  try { await run(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
}
try {
  const { useProjectStore } = await vite.ssrLoadModule('/src/stores/projectStore.ts');
  const { useGitStore } = await vite.ssrLoadModule('/src/stores/gitStore.ts');
  const component = (await vite.ssrLoadModule('/src/components/GitView.vue')).default;
  const pinia = createPinia();
  setActivePinia(pinia);
  const project = useProjectStore();
  project.projects = [{ id: 'git-mobile-project', serverId: 'server-local', name: 'Mobile Git', rootPath: '/mobile' }];
  const git = useGitStore();
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).includes('/api/git/repos')) return { ok: true, json: async () => ({ maxDepth: 5, repos: [
      { relPath: '.', name: 'mobile', depth: 0, branch: 'main', changedCount: 0, clean: true },
      { relPath: 'apps/client', name: 'client', depth: 2, branch: 'feature', changedCount: 1, clean: false },
    ] }) };
    if (String(url).includes('/api/git/branches')) return { ok: true, json: async () => ({ branches: [{ name: 'feature', current: true }] }) };
    if (String(url).includes('/api/git/diff')) return { ok: true, json: async () => ({ lines: [{ type: 'added', newLine: 1, content: 'new line' }] }) };
    return { ok: true, json: async () => ({ branch: 'feature', files: [{ path: 'src/file.ts', status: 'M', staged: false, additions: 4, deletions: 2 }] }) };
  };
  const vnode = h({ ...component, render: () => null });
  const app = renderer.createApp({ render: () => vnode });
  app.use(pinia);
  app.provide(ssrContextKey, {});
  app.mount({});
  const state = vnode.component.setupState;
  const html = () => renderToString(createSSRApp({ ...component, setup: () => state }).use(pinia));
  try {
    await new Promise(resolve => setImmediate(resolve));
    await nextTick();
    await test('new 2-column Git UI renders scanner banner, left repo card column, and split files + diff panes', async () => {
      const initial = await html();
      assert.doesNotMatch(initial, /Tối đa\s*\d+\s*cấp|Quét lại\s*\d+\s*cấp|Cấp\s*\d+/);
      assert.match(initial, /Repositories trong dự án/);
      assert.match(initial, /Danh sách repo/);
      assert.match(initial, /class="[^"]*\bgit-scanner-banner\b/);
      assert.match(initial, /class="[^"]*\bgit-main-grid\b/);
      assert.match(initial, /class="[^"]*\bgit-repos-column\b/);
      assert.match(initial, /class="[^"]*\bgit-Active-detail-column\b/);
      assert.match(initial, /class="[^"]*\bgit-detail-split\b/);
      assert.match(initial, /class="[^"]*\bgit-files-box\b/);
      assert.match(initial, /class="[^"]*\bgit-diff-box\b/);
      assert.match(initial, /Tệp thay đổi trong repo đang chọn/);
      assert.match(initial, /Xem nhanh Diff/);
    });
    await test('mobile starts on repository list while desktop retains both columns and side-by-side split', async () => {
      const initial = await html();
      assert.match(initial, /class="git-view[^\"]*"/);
      assert.match(initial, /class="[^"]*\bgit-multi-repo-bar\b/);
      assert.match(initial, /class="[^"]*\bgit-repo-detail\b/);
      assert.doesNotMatch(initial, /mobile-detail-open/);
      assert.match(source, /@media\s*\(max-width:\s*860px\)[\s\S]*?\.git-view:not\(\.mobile-detail-open\)\s+\.git-repo-detail\s*\{\s*display:\s*none/);
      assert.match(source, /@media\s*\(max-width:\s*860px\)[\s\S]*?\.git-view\.mobile-detail-open\s+\.git-multi-repo-bar\s*\{\s*display:\s*none/);
    });
    await test('selecting nested repo opens detail, auto-loads first file diff side-by-side, and back restores list', async () => {
      await state.openRepo('apps/client');
      await nextTick();
      assert.equal(git.selectedRepoPath, 'apps/client');
      assert.ok(urls.some(url => url.includes('/api/git/status') && url.includes('repoPath=apps%2Fclient')));
      let detail = await html();
      assert.match(detail, /mobile-detail-open/);
      assert.match(detail, /Quay lại danh sách repo/);
      assert.match(detail, /src\/file\.ts/);
      assert.match(detail, /unstaged/);
      assert.match(detail, /\+4/);
      assert.match(detail, /-2/);
      await git.fetchDiff('src/file.ts');
      detail = await html();
      assert.match(detail, /src\/file\.ts/, 'file list remains visible alongside diff');
      assert.match(detail, /new line/, 'diff content renders in side-by-side diff box');
      state.backToRepos();
      assert.doesNotMatch(await html(), /mobile-detail-open/);
      assert.equal(git.selectedRepoPath, 'apps/client');
    });
    await test('project change resets mobile navigation to list', async () => {
      await state.openRepo('apps/client');
      project.projects = [{ id: 'second-project', serverId: 'server-local', name: 'Another', rootPath: '/another' }];
      await nextTick();
      assert.doesNotMatch(await html(), /mobile-detail-open/);
    });
  } finally { app.unmount(); }
} finally { await vite.close(); }
process.exitCode = failures ? 1 : 0;
