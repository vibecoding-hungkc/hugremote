import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const claudeViewSource = await readFile(
  fileURLToPath(new URL('../apps/web/src/components/ClaudeView.vue', import.meta.url)),
  'utf8',
);
assert.match(
  claudeViewSource,
  /\.claude-ext-stream\s*\{[^}]*scrollbar-width:\s*thin;[^}]*scrollbar-color:\s*rgba\(217,\s*119,\s*87,\s*0\.44\)\s+transparent;/s,
  'chat stream must use a slim Claude-accent scrollbar in Firefox',
);
assert.match(
  claudeViewSource,
  /\.claude-ext-stream::-webkit-scrollbar\s*\{[^}]*width:\s*10px;/s,
  'chat stream must expose a narrow scrollbar in Blink/WebKit',
);
assert.match(
  claudeViewSource,
  /\.claude-ext-stream::-webkit-scrollbar-track\s*\{[^}]*background:\s*transparent;/s,
  'chat scrollbar track must blend into the dark canvas',
);
assert.match(
  claudeViewSource,
  /\.claude-ext-stream::-webkit-scrollbar-thumb\s*\{[^}]*background:\s*rgba\(217,\s*119,\s*87,\s*0\.44\);[^}]*border:\s*2px solid transparent;[^}]*background-clip:\s*padding-box;[^}]*border-radius:\s*999px;[^}]*min-height:\s*40px;/s,
  'chat scrollbar thumb must be rounded, inset and easy to acquire',
);
assert.match(
  claudeViewSource,
  /\.claude-ext-stream::-webkit-scrollbar-thumb:hover\s*\{[^}]*background:\s*rgba\(217,\s*119,\s*87,\s*0\.68\);/s,
  'chat scrollbar thumb must strengthen on hover',
);
assert.match(
  claudeViewSource,
  /\.claude-ext-stream::-webkit-scrollbar-thumb:active\s*\{[^}]*background:\s*rgba\(217,\s*119,\s*87,\s*0\.82\);/s,
  'chat scrollbar thumb must strengthen while dragging',
);
assert.match(
  claudeViewSource,
  /\.claude-ext-stream::-webkit-scrollbar-corner\s*\{[^}]*background:\s*transparent;/s,
  'chat scrollbar corner must blend into the dark canvas',
);
assert.match(
  claudeViewSource,
  /\.claude-shortcut-bar\s*\{[^}]*scrollbar-width:\s*none;[^}]*\}[\s\S]*?\.claude-shortcut-bar::-webkit-scrollbar\s*\{[^}]*display:\s*none;/s,
  'shortcut bar must keep its intentionally hidden horizontal scrollbar',
);
assert.match(
  claudeViewSource,
  /\.claude-ext-left-controls\s*\{[^}]*scrollbar-width:\s*none;[^}]*\}[\s\S]*?\.claude-ext-left-controls::-webkit-scrollbar\s*\{[^}]*display:\s*none;/s,
  'left controls must keep their intentionally hidden horizontal scrollbar',
);
console.log('PASS chat stream declares a theme-aware Claude scrollbar');

import { createSSRApp, computed, effectScope, nextTick, reactive } from 'vue';
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
 store.sessions = [{ id: 's', serverId: 'local', cwd: '/fixture', model: 'Default', name: 'Test', messages: [{ id: 'a', sender: 'assistant', text: '', thinking: '', isWorking: true, isThinking: true, tools: [{ id: 't', type: 'bash', title: 'Old completed task', status: 'done' }] }] }]; store.activeSessionId = 's';
 let state; const component = { ...View, setup(p,c) { state = View.setup(p,c); return state; } };
 async function render(props = {}) { const app = createSSRApp(component, props); app.use(pinia); return renderToString(app); }
 store.isGenerating = true; store.compactTaskMode = false;
 let html = await render();
 assert.match(html, /class="claude-thinking-panel"/, 'thinking must remain visible in the live assistant message');
 assert.doesNotMatch(html, /class="claude-current-task"/, 'plain thinking must not render a duplicate bottom activity row');
 assert.equal(state.currentLiveTask.value, null, 'plain thinking must not be exposed as a second current task');
 assert.equal((html.match(/Thinking…/g) || []).length, 1, 'exactly one Thinking… label must render');
 console.log('PASS normal mode renders exactly one thinking indicator');
 store.activeSession.messages[0].isThinking = false;
 store.activeSession.messages[0].tools = [{ id: 'running', type: 'bash', title: 'Run: npm test', status: 'running' }];
 html = await render();
 assert.match(html, /class="claude-current-task"/, 'a real running tool must keep the bottom activity row');
 assert.match(html, /npm test/, 'running tool details must remain visible');
 console.log('PASS running tools retain the bottom activity row');
 store.activeSession.messages[0].tools = [{ id: 't', type: 'bash', title: 'Old completed task', status: 'done' }];
 assert.doesNotMatch(state.currentLiveTask.value?.title || '', /Old completed task/, 'completed task must not look running');
 store.isReconnecting = true; html = await render(); assert.match(html,/role="status"/); assert.match(html,/aria-live="polite"/);
 console.log('PASS reconnect banner is an accessible live status');
 let resumed = 0; store.resumeActiveStream = async () => { resumed++; }; store.fetchSessions = async () => {};
 await state.handleVisibilityOrFocus(); assert.equal(resumed,1,'foreground must invoke stream recovery rather than only replacing sessions');
 console.log('PASS foreground invokes stream recovery');
 store.isReconnecting = false; store.isGenerating = false; html = await render(); assert.doesNotMatch(html,/class="claude-current-task"/);
 console.log('PASS completed task has no activity indicator');
 const { watchClaudeLiveMessageForAutoScroll } = await vite.ssrLoadModule('/src/composables/useClaudeAutoScroll.ts');
 const live = reactive({ text: '', thinking: '', isWorking: true, isThinking: true, tools: [], interactions: [], childAgents: [] });
 const liveRef = computed(() => live.isWorking ? live : null);
 const fakeStream = { scrollTop: 10, scrollHeight: 100 };
 const scope = effectScope();
 scope.run(() => watchClaudeLiveMessageForAutoScroll(liveRef, () => { fakeStream.scrollTop = fakeStream.scrollHeight; }));
 live.text = 'first chunk';
 await nextTick();
 assert.equal(fakeStream.scrollTop, 100, 'streaming text must follow the growing message to the bottom');
 fakeStream.scrollHeight = 175;
 live.thinking = 'reasoning chunk';
 await nextTick();
 assert.equal(fakeStream.scrollTop, 175, 'streaming thinking must follow the growing message to the bottom');
 fakeStream.scrollHeight = 240;
 live.tools.push({ id: 'tool-live', type: 'read', title: 'Read fixture', status: 'running', output: 'new output' });
 await nextTick();
 assert.equal(fakeStream.scrollTop, 240, 'streaming tool updates must follow the growing message to the bottom');
 live.isWorking = false;
 await nextTick();
 fakeStream.scrollHeight = 320;
 live.text = 'historical edit';
 await nextTick();
 assert.equal(fakeStream.scrollTop, 240, 'completed historical messages must not force-scroll the user');
 scope.stop();
 console.log('PASS live message revisions auto-scroll after DOM updates');
 await render({ isActive: false }); await state.handleVisibilityOrFocus(); assert.equal(resumed,1,'hidden chat must not recover a stream on window focus');
 console.log('PASS hidden chat does not force stream replacement');
} finally { for (const id of intervals) clearInterval(id); globalThis.setInterval = originalInterval; await vite.close(); }
