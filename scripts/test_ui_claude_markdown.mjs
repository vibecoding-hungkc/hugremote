import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createPinia, setActivePinia } from 'pinia';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { documentElement: { lang: '' }, visibilityState: 'visible' };
const intervals = [];
const originalInterval = globalThis.setInterval;
globalThis.setInterval = (...args) => {
  const id = originalInterval(...args);
  intervals.push(id);
  return id;
};

const claudeViewPath = fileURLToPath(
  new URL('../apps/web/src/components/ClaudeView.vue', import.meta.url)
);
const claudeViewSource = await readFile(claudeViewPath, 'utf8');

const vite = await createServer({
  root: fileURLToPath(new URL('../apps/web', import.meta.url)),
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const { default: ClaudeView } = await vite.ssrLoadModule('/src/components/ClaudeView.vue');
  const { useClaudeStore } = await vite.ssrLoadModule('/src/stores/claudeStore.ts');
  const { useServerStore } = await vite.ssrLoadModule('/src/stores/serverStore.ts');

  const pinia = createPinia();
  setActivePinia(pinia);
  const serverStore = useServerStore(pinia);
  serverStore.servers = [
    { id: 'local', name: 'Fixture', type: 'local', workspace: '/fixture' },
  ];
  serverStore.currentServerId = 'local';

  const claudeStore = useClaudeStore(pinia);
  const sampleMarkdown = [
    '### Tài liệu tích hợp',
    '',
    '| File | Nội dung |',
    '|---|---|',
    '| notification-contract.md | Hợp đồng cho bên gửi notification qua edu-notification-hub: message Kafka, render nội dung, fan-out ra các kênh |',
    '| device-registration-integration.md | Hướng dẫn client server đăng ký device với hub để nhận push |',
    '',
    '- Mục **in đậm** và *in nghiêng* kèm `inline_code()`',
    '',
    '> Lưu ý quan trọng khi tích hợp',
    '',
    '```ts',
    'const hub = "edu-notification-hub";',
    '```',
    '',
    '[Tài liệu chuẩn](https://example.com/docs) và [Link độc hại](javascript:alert(1))',
    '',
    '<script>window.__xss = true;</script>',
  ].join('\n');

  claudeStore.sessions = [
    {
      id: 'sess-md-test',
      serverId: 'local',
      cwd: '/fixture',
      model: 'Default Medium',
      name: 'Markdown Test',
      messages: [
        {
          id: 'msg-md-1',
          sender: 'assistant',
          text: sampleMarkdown,
          thinking: '',
          isWorking: false,
          isThinking: false,
          tools: [],
        },
      ],
    },
  ];
  claudeStore.activeSessionId = 'sess-md-test';

  const app = createSSRApp(ClaudeView);
  app.use(pinia);
  const html = await renderToString(app);

  // AC-1: GFM Table rendering inside scrollable wrapper
  assert.match(
    html,
    /<div class="claude-md-table-wrap">\s*<table class="claude-md-table">\s*<thead>\s*<tr>\s*<th>File<\/th>\s*<th>Nội dung<\/th>\s*<\/tr>\s*<\/thead>\s*<tbody>/s,
    'AC-1: GFM table header must render inside .claude-md-table-wrap > table.claude-md-table'
  );
  assert.match(
    html,
    /<td>notification-contract\.md<\/td>\s*<td>Hợp đồng cho bên gửi notification qua edu-notification-hub: message Kafka, render nội dung, fan-out ra các kênh<\/td>/s,
    'AC-1: First table row cells must render as <td> elements'
  );
  assert.match(
    html,
    /<td>device-registration-integration\.md<\/td>\s*<td>Hướng dẫn client server đăng ký device với hub để nhận push<\/td>/s,
    'AC-1: Second table row cells must render as <td> elements'
  );
  console.log('PASS AC-1: ClaudeView renders GFM tables into .claude-md-table-wrap > table.claude-md-table');

  // AC-2: Rich GFM blocks & inline elements
  assert.match(html, /<h3>Tài liệu tích hợp<\/h3>/, 'AC-2: H3 heading must render');
  assert.match(
    html,
    /<ul>\s*<li>Mục <strong>in đậm<\/strong> và <em>in nghiêng<\/em> kèm <code class="inline-code">inline_code\(\)<\/code><\/li>\s*<\/ul>/s,
    'AC-2: Unordered list, bold, italic, and .inline-code must render'
  );
  assert.match(
    html,
    /<blockquote>\s*<p>Lưu ý quan trọng khi tích hợp<\/p>\s*<\/blockquote>/s,
    'AC-2: Blockquote must render'
  );
  assert.match(
    html,
    /<pre><code class="language-ts">const hub = &quot;edu-notification-hub&quot;;\n?<\/code><\/pre>/s,
    'AC-2: Fenced code block must render as <pre><code>'
  );
  console.log('PASS AC-2: ClaudeView renders headings, lists, blockquotes, fenced code, and inline code');

  // AC-3: XSS escaping & unsafe link neutralization
  assert.ok(
    !html.includes('<script>window.__xss'),
    'AC-3: Raw <script> tags must be escaped and never injected into DOM'
  );
  assert.match(
    html,
    /&lt;script&gt;window\.__xss = true;&lt;\/script&gt;/,
    'AC-3: Escaped script text must remain visible as harmless text'
  );
  assert.match(
    html,
    /<a href="https:\/\/example\.com\/docs" target="_blank" rel="noopener noreferrer">Tài liệu chuẩn<\/a>/,
    'AC-3: Safe HTTPS links must include target="_blank" rel="noopener noreferrer"'
  );
  assert.match(
    html,
    /<a href="#" target="_blank" rel="noopener noreferrer">Link độc hại<\/a>/,
    'AC-3: Unsafe javascript: links must be neutralized to #'
  );
  console.log('PASS AC-3: ClaudeView escapes raw HTML and neutralizes unsafe URLs');

  // AC-4: Stylesheet rules for responsive table wrapper and table cells
  assert.match(
    claudeViewSource,
    /\.claude-md-table-wrap\s*\{[^}]*overflow-x:\s*auto;[^}]*max-width:\s*100%;/s,
    'AC-4: .claude-md-table-wrap must enforce horizontal scrolling and max-width: 100%'
  );
  assert.match(
    claudeViewSource,
    /\.claude-md-table\s*\{[^}]*border-collapse:\s*collapse;/s,
    'AC-4: .claude-md-table must collapse borders cleanly'
  );
  console.log('PASS AC-4: ClaudeView declares responsive dark-theme table styles');
} finally {
  for (const id of intervals) clearInterval(id);
  globalThis.setInterval = originalInterval;
  await vite.close();
}
