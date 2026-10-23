import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createPinia, setActivePinia } from 'pinia';
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { documentElement: { lang: '' }, visibilityState: 'visible' };
const intervals = []; const originalInterval = globalThis.setInterval;
globalThis.setInterval = (...args) => { const id = originalInterval(...args); intervals.push(id); return id; };
const vite = await createServer({ root: fileURLToPath(new URL('../apps/web', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
 const { default: View } = await vite.ssrLoadModule('/src/components/ClaudeView.vue');
 const { useClaudeStore } = await vite.ssrLoadModule('/src/stores/claudeStore.ts');
 const { useServerStore } = await vite.ssrLoadModule('/src/stores/serverStore.ts');
 const pinia = createPinia(); setActivePinia(pinia);
 const server = useServerStore(pinia); server.servers = [{ id: 'local', name: 'Fixture', type: 'local', workspace: '/fixture' }]; server.currentServerId = 'local';
 const store = useClaudeStore(pinia);
 store.sessions = [{ id: 's', serverId: 'local', cwd: '/fixture', model: 'Default', name: 'Test', messages: [{ id: 'a', sender: 'assistant', text: 'Earlier text', isWorking: true, isThinking: false, tools: [{ id: 't', type: 'bash', title: 'Old completed task', status: 'done' }] }] }]; store.activeSessionId = 's';
 let state; const component = { ...View, setup(p,c) { state = View.setup(p,c); return state; } };
 async function render(props = {}) { const app = createSSRApp(component, props); app.use(pinia); return renderToString(app); }
 store.isGenerating = true; store.compactTaskMode = false;
 let html = await render();
 assert.match(html, /class="claude-current-task"/, 'running task must show activity even in normal noncompact mode after tools complete');
 assert.doesNotMatch(state.currentLiveTask.value.title, /Old completed task/, 'completed task must not look running');
 console.log('PASS normal mode displays activity independent of thinking/tools');
 store.isReconnecting = true; html = await render(); assert.match(html,/role="status"/); assert.match(html,/aria-live="polite"/);
 console.log('PASS reconnect banner is an accessible live status');
 let resumed = 0; store.resumeActiveStream = async () => { resumed++; }; store.fetchSessions = async () => {};
 await state.handleVisibilityOrFocus(); assert.equal(resumed,1,'foreground must invoke stream recovery rather than only replacing sessions');
 console.log('PASS foreground invokes stream recovery');
 store.isReconnecting = false; store.isGenerating = false; html = await render(); assert.doesNotMatch(html,/class="claude-current-task"/);
 console.log('PASS completed task has no activity indicator');
 await render({ isActive: false }); await state.handleVisibilityOrFocus(); assert.equal(resumed,1,'hidden chat must not recover a stream on window focus');
 console.log('PASS hidden chat does not force stream replacement');
} finally { for (const id of intervals) clearInterval(id); globalThis.setInterval = originalInterval; await vite.close(); }
