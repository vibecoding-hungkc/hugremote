import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';
import { createRenderer, createSSRApp, h, ssrContextKey } from 'vue';
import { renderToString } from '@vue/server-renderer';

Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });
globalThis.document = { documentElement: { lang: '' } };
const root = fileURLToPath(new URL('../apps/web/', import.meta.url));
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
  const { useServerStore } = await vite.ssrLoadModule('/src/stores/serverStore.ts');
  const { useFileStore } = await vite.ssrLoadModule('/src/stores/fileStore.ts');
  async function mount(name) {
    const pinia = createPinia(); setActivePinia(pinia);
    const projects = useProjectStore(); const servers = useServerStore(); const files = useFileStore();
    const project = { id: 'project-test', serverId: 'server-local', name: 'Test', rootPath: '/test' };
    projects.projects = [project];
    const events = [];
    globalThis.fetch = async (url, options = {}) => {
      if (url.includes('/api/ssh-keys')) return { ok: true, json: async () => ({ keys: [] }) };
      throw new Error(`Unexpected fetch ${options.method || 'GET'} ${url}`);
    };
    const component = (await vite.ssrLoadModule(`/src/components/${name}.vue`)).default;
    const vnode = h({ ...component, render: () => null }, { isOpen: true, onSelected: () => events.push('selected'), onClose: () => events.push('close') });
    const app = renderer.createApp({ render: () => vnode }); app.use(pinia); app.provide(ssrContextKey, {}); app.mount({});
    const state = vnode.component.setupState;
    return { state, projects, servers, files, project, events, app, html: () => renderToString(createSSRApp({ ...component, setup: () => state }, { isOpen: true }).use(pinia)) };
  }
  await test('project rename dialog validates blank names and persists trimmed name through store API', async () => {
    const ctx = await mount('ProjectModal');
    try {
      assert.equal(typeof ctx.state.startRename, 'function', 'rename action exists');
      ctx.state.startRename(ctx.project);
      assert.match(await ctx.html(), /Rename project/);
      ctx.state.renameName = '   ';
      await ctx.state.saveRename();
      assert.match(await ctx.html(), /Enter a project name/);
      let persisted = '';
      const requests = [];
      globalThis.fetch = async (url, options = {}) => {
        requests.push({ url, method: options.method || 'GET' });
        if (options.method === 'PATCH') { persisted = JSON.parse(options.body).name; return { ok: true, json: async () => ({ project: { ...ctx.project, name: persisted } }) }; }
        return { ok: true, json: async () => ({ projects: [{ ...ctx.project, name: persisted }], activeProjectId: ctx.project.id }) };
      };
      ctx.state.renameName = '  Renamed  ';
      await ctx.state.saveRename();
      assert.equal(persisted, 'Renamed');
      assert.equal(ctx.projects.currentProject.name, 'Renamed');
      assert.equal(ctx.projects.currentProject.rootPath, '/test');
      assert.equal(ctx.state.renamingProject, null);
      assert.deepEqual(requests.map(r => r.method), ['PATCH', 'GET']);
      assert.match(await ctx.html(), /Renamed/);
      assert.deepEqual(ctx.events, []);
    } finally { ctx.app.unmount(); }
  });
  await test('rename failure stays visible and preserves the project name', async () => {
    const ctx = await mount('ProjectModal');
    try {
      ctx.state.startRename(ctx.project);
      ctx.state.renameName = 'Renamed';
      globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: 'Rename denied' }) });
      await ctx.state.saveRename();
      assert.equal(ctx.projects.currentProject.name, 'Test');
      assert.equal(ctx.state.renamingProject.id, ctx.project.id);
      assert.equal(ctx.state.renaming, false);
      assert.match(await ctx.html(), /role="alert"[^>]*>Rename denied/);
      ctx.state.renamingProject = null;
      ctx.state.startRename({ ...ctx.project, id: 'home', name: '~', rootPath: '~' });
      assert.equal(ctx.state.renamingProject, null, 'home cannot be renamed');
    } finally { ctx.app.unmount(); }
  });
  for (const [componentName, action, args] of [
    ['ProjectModal', 'select', ['other-project']],
    ['ProjectModal', 'openHome', []],
    ['ProjectModal', 'useWorkspace', []],
    ['ProjectModal', 'openPath', []],
    ['ProjectModal', 'deleteProject', ['project-test']],
    ['ServerModal', 'handleSelect', ['remote-server']],
    ['ServerModal', 'handleDisconnect', ['server-local']],
    ['ServerDrawer', 'selectServer', ['remote-server']],
    ['ServerDrawer', 'openHome', ['remote-server']],
  ]) {
    await test(`${componentName}.${action} cancellation guards scope mutation`, async () => {
      const ctx = await mount(componentName);
      try {
        let confirmations = 0;
        ctx.files.confirmUnsavedChanges = async () => {
          confirmations++;
          assert.equal(ctx.servers.currentServerId, 'server-local');
          assert.equal(ctx.projects.currentProject.id, ctx.project.id);
          return false;
        };
        if (action === 'openPath') ctx.state.pathInput = '/next';
        const calls = [];
        globalThis.fetch = async url => { calls.push(url); return { ok: true, json: async () => ({ projects: [] }) }; };
        await ctx.state[action](...args);
        assert.equal(confirmations, 1, 'asks before mutation');
        assert.equal(ctx.servers.currentServerId, 'server-local');
        assert.equal(ctx.projects.currentProject.id, ctx.project.id);
        assert.deepEqual(calls, [], 'cancel must not call API');
        assert.deepEqual(ctx.events, []);
      } finally { ctx.app.unmount(); }
    });
  }
  for (const [action, args] of [['select', ['next-project']], ['openHome', []], ['useWorkspace', []], ['openPath', []], ['deleteProject', ['project-test']]]) {
    await test(`ProjectModal.${action} confirms original scope before request and emits selected`, async () => {
      const ctx = await mount('ProjectModal');
      try {
        let confirmed = false;
        ctx.files.confirmUnsavedChanges = async () => {
          assert.equal(ctx.projects.currentProject.id, ctx.project.id);
          assert.equal(ctx.servers.currentServerId, 'server-local');
          confirmed = true;
          return true;
        };
        ctx.state.pathInput = '/next';
        const next = { ...ctx.project, id: 'next-project', rootPath: '/next' };
        globalThis.fetch = async (url, options = {}) => {
          assert.equal(confirmed, true, 'guard completed before request');
          return { ok: true, json: async () => options.method ? { project: next } : { projects: [next], activeProjectId: next.id } };
        };
        await ctx.state[action](...args);
        assert.equal(confirmed, true);
        assert.equal(ctx.projects.currentProject.id, next.id);
        assert.deepEqual(ctx.events, action === 'deleteProject' ? ['selected'] : ['selected', 'close']);
      } finally { ctx.app.unmount(); }
    });
  }
  await test('deleting inactive project does not refresh active editor scope', async () => {
    const ctx = await mount('ProjectModal');
    try {
      ctx.files.confirmUnsavedChanges = async () => { throw new Error('Inactive deletion must not prompt'); };
      globalThis.fetch = async (url, options = {}) => ({ ok: true, json: async () => options.method === 'DELETE' ? {} : { projects: [ctx.project], activeProjectId: ctx.project.id } });
      await ctx.state.deleteProject('inactive-project');
      assert.equal(ctx.projects.currentProject.id, ctx.project.id);
      assert.deepEqual(ctx.events, [], 'inactive deletion must not reset the active editor');
    } finally { ctx.app.unmount(); }
  });
  for (const [componentName, action] of [['ServerModal', 'handleSelect'], ['ServerDrawer', 'selectServer']]) {
    await test(`${componentName} restores target projects before selected notification`, async () => {
      const ctx = await mount(componentName);
      try {
        ctx.files.confirmUnsavedChanges = async () => true;
        ctx.servers.servers.push({ ...ctx.servers.currentServer, id: 'remote-server', name: 'Remote', workspace: '/remote' });
        let release;
        let requested = '';
        globalThis.fetch = async url => {
          requested = url;
          return new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ projects: [{ ...ctx.project, id: 'remote-project', serverId: 'remote-server' }], activeProjectId: 'remote-project' }) }); });
        };
        const pending = ctx.state[action]('remote-server');
        await new Promise(resolve => setImmediate(resolve));
        assert.match(requested, /\/api\/projects\?serverId=remote-server/);
        assert.deepEqual(ctx.events, [], 'selected waits for project restoration');
        release();
        await pending;
        assert.equal(ctx.servers.currentServerId, 'remote-server');
        assert.equal(ctx.projects.currentProject.id, 'remote-project');
        assert.deepEqual(ctx.events, ['selected', 'close']);
      } finally { ctx.app.unmount(); }
    });
  }
  for (const [componentName, action] of [['ServerModal', 'handleSelect'], ['ServerDrawer', 'selectServer']]) {
    await test(`${componentName} failed project loading preserves scope and exposes error`, async () => {
      const ctx = await mount(componentName);
      try {
        ctx.files.confirmUnsavedChanges = async () => true;
        ctx.servers.servers.push({ ...ctx.servers.currentServer, id: 'remote-server', name: 'Remote' });
        globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: 'Target scope unavailable' }) });
        await ctx.state[action]('remote-server');
        assert.equal(ctx.servers.currentServerId, 'server-local');
        assert.equal(ctx.projects.currentProject.id, ctx.project.id);
        assert.deepEqual(ctx.events, []);
        assert.match(await ctx.html(), /Target scope unavailable/);
      } finally { ctx.app.unmount(); }
    });
  }
} finally { await vite.close(); }
process.exitCode = failures ? 1 : 0;
