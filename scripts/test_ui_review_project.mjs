import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';
import { createRenderer, createSSRApp, h, ssrContextKey } from 'vue';
import { renderToString } from '@vue/server-renderer';
import Fastify from 'fastify';

Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });
globalThis.document = { documentElement: { lang: '' } };

const root = fileURLToPath(new URL('../apps/web/', import.meta.url));
const vite = await createServer({
  root,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});

const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
  parentNode: () => null, nextSibling: () => null,
});

let failures = 0;
async function test(name, run) {
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

try {
  const { useProjectStore } = await vite.ssrLoadModule('/src/stores/projectStore.ts');
  const { useServerStore } = await vite.ssrLoadModule('/src/stores/serverStore.ts');
  const { useFileStore } = await vite.ssrLoadModule('/src/stores/fileStore.ts');

  async function mount() {
    const pinia = createPinia();
    setActivePinia(pinia);
    const projects = useProjectStore();
    const servers = useServerStore();
    const files = useFileStore();
    const project = { id: 'project-test', serverId: 'server-local', name: 'Test', rootPath: '/test' };
    projects.projects = [project];
    const events = [];
    globalThis.fetch = async (url, options = {}) => {
      if (url.includes('/api/ssh-keys')) return { ok: true, json: async () => ({ keys: [] }) };
      throw new Error(`Unexpected fetch ${options.method || 'GET'} ${url}`);
    };
    const component = (await vite.ssrLoadModule('/src/components/ProjectModal.vue')).default;
    const vnode = h(
      { ...component, render: () => null },
      { isOpen: true, onSelected: () => events.push('selected'), onClose: () => events.push('close') }
    );
    const app = renderer.createApp({ render: () => vnode });
    app.use(pinia);
    app.provide(ssrContextKey, {});
    app.mount({});
    const state = vnode.component.setupState;
    return {
      state,
      projects,
      servers,
      files,
      project,
      events,
      app,
      html: () => renderToString(createSSRApp({ ...component, setup: () => state }, { isOpen: true }).use(pinia)),
    };
  }

  // 1. Frontend validation: ProjectModal rejects '~'
  await test('project rename dialog rejects reserved name "~" without calling API', async () => {
    const ctx = await mount();
    try {
      let apiCalled = false;
      globalThis.fetch = async () => {
        apiCalled = true;
        return { ok: true, json: async () => ({}) };
      };
      ctx.state.startRename(ctx.project);
      ctx.state.renameName = '~';
      await ctx.state.saveRename();
      assert.equal(apiCalled, false, 'must not call API when renaming to "~"');
      assert.ok(ctx.state.renameError, 'renameError must be populated');
      assert.match(ctx.state.renameError, /reserved|Tên '~' được dành riêng/i);
      assert.equal(ctx.projects.currentProject.name, 'Test', 'project name must not change');
    } finally {
      ctx.app.unmount();
    }
  });

  // 2. ProjectModal scope handlers have scopeBusy guard and scopeError handling
  await test('ProjectModal scope handlers handle rejection with scopeError and scopeBusy guard', async () => {
    const ctx = await mount();
    try {
      ctx.files.confirmUnsavedChanges = async () => true;
      assert.equal(ctx.state.scopeBusy, false);
      assert.equal(ctx.state.scopeError, '');

      // Mock projectStore.openHomeProject to throw
      ctx.projects.openHomeProject = async () => {
        assert.equal(ctx.state.scopeBusy, true, 'scopeBusy must be true during operation');
        throw new Error('Failed to open Home');
      };

      await ctx.state.openHome();
      assert.equal(ctx.state.scopeBusy, false, 'scopeBusy resets to false in finally');
      assert.equal(ctx.state.scopeError, 'Failed to open Home');
      assert.deepEqual(ctx.events, [], 'no close or selected event on failure');

      // Test select rejection
      ctx.projects.selectProject = async () => {
        throw new Error('Failed to select');
      };
      await ctx.state.select('project-test');
      assert.equal(ctx.state.scopeError, 'Failed to select');
      assert.equal(ctx.state.scopeBusy, false);

      // Verify scopeBusy blocks concurrent calls
      let calls = 0;
      let resolveOp;
      ctx.projects.openProject = () => {
        calls++;
        return new Promise((r) => { resolveOp = r; });
      };
      const op1 = ctx.state.useWorkspace();
      assert.equal(ctx.state.scopeBusy, true);
      const op2 = ctx.state.useWorkspace(); // Should be guarded by scopeBusy
      await new Promise((r) => setImmediate(r));
      assert.equal(calls, 1, 'concurrent scope operation must be blocked by scopeBusy');
      resolveOp({ success: true });
      await op1;
      await op2;
      assert.equal(ctx.state.scopeBusy, false);
    } finally {
      ctx.app.unmount();
    }
  });

  // 3. Backend PATCH /api/projects/:id validation: reject '~' with 400 and no mutation
  await test('apiRoutes PATCH /api/projects/:id rejects name "~" with 400', async () => {
    const { apiRoutes } = await vite.ssrLoadModule('/../../apps/api/src/routes/api.ts');
    const { projectService } = await vite.ssrLoadModule('/../../apps/api/src/services/projectService.ts');
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-test-home-'));
    const testProjectsFile = path.join(tmpDir, 'projects.json');
    projectService.resetForTests(testProjectsFile);

    const app = Fastify();
    await app.register(apiRoutes);
    await app.ready();

    // Create a dummy project in projectService
    const created = projectService.openProject('server-local', path.join(tmpDir, 'test-proj-rev'), 'MyProj');
    const origName = created.name;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${created.id}`,
      payload: { name: '~' },
    });

    assert.equal(res.statusCode, 400, 'must respond 400 for reserved name ~');
    const body = JSON.parse(res.body);
    assert.match(body.error, /reserved/i);

    // Verify no mutation
    const current = projectService.getProject(created.id);
    assert.equal(current.name, origName, 'project name must not have mutated');

    // Clean up
    projectService.deleteProject(created.id);
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
} finally {
  await vite.close();
}

process.exitCode = failures ? 1 : 0;
