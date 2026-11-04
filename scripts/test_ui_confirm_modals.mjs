import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';

let failed = false;
async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failed = true;
    console.error(`FAIL ${name}\n`, err);
  }
}

const root = fileURLToPath(new URL('../apps/web', import.meta.url));
globalThis.document = { documentElement: { lang: 'vi' } };
const vite = await createServer({
  root,
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});

try {
  await test('AC-1: ConfirmModal.vue centers modal in middle of screen (align-items: center, border-radius: 14px, z-index: 3000)', async () => {
    const confirmModalPath = fileURLToPath(new URL('../apps/web/src/components/ConfirmModal.vue', import.meta.url));
    const css = fs.readFileSync(confirmModalPath, 'utf8');
    assert.match(css, /\.modal-overlay[^{]*\{[\s\S]*?align-items:\s*center/m, 'ConfirmModal .modal-overlay must have align-items: center');
    assert.match(css, /\.modal-overlay[^{]*\{[\s\S]*?justify-content:\s*center/m, 'ConfirmModal .modal-overlay must have justify-content: center');
    assert.match(css, /\.modal-overlay[^{]*\{[\s\S]*?z-index:\s*3000/m, 'ConfirmModal .modal-overlay must have z-index: 3000');
    assert.doesNotMatch(css, /align-items:\s*flex-end/, 'ConfirmModal must not align to flex-end (bottom)');
    assert.match(css, /border-radius:\s*14px(\s*!important)?\s*;/m, 'ConfirmModal .modal-sheet must have full 4-corner border-radius');
  });

  await test('AC-2: Zero native window.confirm or alert calls remain in apps/web/src/components/', async () => {
    const componentsDir = fileURLToPath(new URL('../apps/web/src/components', import.meta.url));
    const entries = fs.readdirSync(componentsDir).filter((f) => f.endsWith('.vue'));
    for (const file of entries) {
      const content = fs.readFileSync(`${componentsDir}/${file}`, 'utf8');
      assert.doesNotMatch(
        content,
        /\bwindow\.confirm\s*\(|\bconfirm\s*\(|\bwindow\.alert\s*\(|\balert\s*\(/,
        `${file} must not use native browser confirm() or alert()`
      );
    }
  });

  await test('AC-3: Destructive/delete actions across components integrate ConfirmModal', async () => {
    const componentsDir = fileURLToPath(new URL('../apps/web/src/components', import.meta.url));
    for (const file of [
      'FileExplorer.vue',
      'ProjectModal.vue',
      'ClaudeSessionHubModal.vue',
      'TerminalSessionHubModal.vue',
      'NewTerminalModal.vue',
      'QuickWorkspacePanel.vue',
    ]) {
      const content = fs.readFileSync(`${componentsDir}/${file}`, 'utf8');
      assert.match(content, /ConfirmModal/, `${file} must import and render ConfirmModal`);
    }

    const { default: ConfirmModal } = await vite.ssrLoadModule('/src/components/ConfirmModal.vue');
    const pinia = createPinia();
    setActivePinia(pinia);
    const app = createSSRApp(ConfirmModal, {
      isOpen: true,
      title: 'Xác Nhận Xóa',
      icon: 'ri-delete-bin-line',
      message: 'Bạn có chắc chắn muốn xóa mục này?',
      confirmLabel: 'Xóa Ngay',
      isDanger: true,
    });
    app.use(pinia);
    const html = await renderToString(app);
    assert.match(html, /class="[^"]*\bmodal-overlay\b/, 'ConfirmModal renders .modal-overlay');
    assert.match(html, /class="[^"]*\bmodal-sheet\b/, 'ConfirmModal renders .modal-sheet');
    assert.match(html, /Xác Nhận Xóa/, 'ConfirmModal renders title');
    assert.match(html, /Xóa Ngay/, 'ConfirmModal renders confirm button');
  });

  await test('AC-4: prototype.html centers #confirm-modal with high z-index and uses openConfirmModal for zip archive deletion', async () => {
    const protoPath = fileURLToPath(new URL('../analysis/prototypes/prototype.html', import.meta.url));
    const proto = fs.readFileSync(protoPath, 'utf8');
    assert.match(proto, /#confirm-modal[\s\S]*?z-index:\s*3000|\.modal-overlay\s*\{[\s\S]*?align-items:\s*center/m);
    assert.match(proto, /function purgeAllZips\(\)\s*\{\s*openConfirmModal\(/m, 'purgeAllZips in prototype.html must use openConfirmModal');
  });
} finally {
  await vite.close();
}

if (failed) process.exit(1);
