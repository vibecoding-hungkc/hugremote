import assert from 'node:assert/strict';
import fs from 'node:fs';
import path, { resolve } from 'node:path';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

globalThis.localStorage = {
  getItem: () => null,
  setItem() {},
  removeItem() {},
};

const rootDir = process.cwd();
const vite = await createServer({
  root: resolve('apps/web'),
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});

try {
  console.log('--- TEST: Desktop Device Detection & Seamless File Preview ---');

  // 1. Test detectDesktopDevice() across Desktop / Mobile / iPadOS / Coarse Pointer regardless of screen size
  const { detectDesktopDevice } = await vite.ssrLoadModule('/src/utils/device.ts');

  assert.equal(
    detectDesktopDevice({
      innerWidth: 375, // Narrow window on Desktop!
      navigator: {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
        platform: 'MacIntel',
        maxTouchPoints: 0,
      },
    }),
    true,
    'macOS Desktop browser must be detected as Desktop even when window.innerWidth is 375px'
  );

  assert.equal(
    detectDesktopDevice({
      innerWidth: 420, // Narrow window on Windows Desktop!
      navigator: {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
        platform: 'Win32',
        maxTouchPoints: 0,
      },
    }),
    true,
    'Windows Desktop browser must be detected as Desktop even when window.innerWidth is 420px'
  );

  assert.equal(
    detectDesktopDevice({
      innerWidth: 1366, // Wide screen on iPad Pro!
      navigator: {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      },
    }),
    false,
    'iPadOS masquerading as MacIntel (maxTouchPoints > 1) must be detected as Mobile/Touch even at 1366px width'
  );

  assert.equal(
    detectDesktopDevice({
      innerWidth: 1200,
      navigator: {
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        platform: 'iPhone',
        maxTouchPoints: 5,
      },
    }),
    false,
    'iPhone UA must be detected as Mobile regardless of screen width'
  );

  assert.equal(
    detectDesktopDevice({
      innerWidth: 1280,
      navigator: {
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36',
        platform: 'Linux armv8l',
        maxTouchPoints: 5,
      },
    }),
    false,
    'Android UA must be detected as Mobile regardless of screen width'
  );

  console.log(
    '✓ Test 1 Passed: detectDesktopDevice accurately detects Desktop vs Mobile/Tablet by device hardware/UA, independent of screen size.'
  );

  // 2. Verify split-pane offsets match the actual rendered 64px header and 42px dock.
  const appVueSrc = fs.readFileSync(path.join(rootDir, 'apps/web/src/App.vue'), 'utf-8');
  assert.match(appVueSrc, /--header-h:\s*64px/, 'App.vue must define actual 64px header');
  assert.match(appVueSrc, /--dock-h:\s*42px/, 'App.vue must define actual 42px dock');

  const quickPanelSrc = fs.readFileSync(
    path.join(rootDir, 'apps/web/src/components/QuickWorkspacePanel.vue'),
    'utf-8'
  );
  assert.match(
    quickPanelSrc,
    /top:\s*calc\(var\(--header-h,\s*64px\)/,
    'QuickWorkspacePanel.vue must align top with 64px SmartHeader to prevent modal overlap'
  );
  assert.match(
    quickPanelSrc,
    /bottom:\s*calc\(var\(--dock-h,\s*42px\)/,
    'QuickWorkspacePanel.vue must align bottom with 42px BottomDock'
  );
  assert.match(
    quickPanelSrc,
    /box-shadow:\s*none/,
    'QuickWorkspacePanel.vue must remove floating modal box-shadow in docked mode'
  );
  console.log(
    '✓ Test 2 Passed: QuickWorkspacePanel aligns seamlessly with 64px SmartHeader and 42px BottomDock without modal shadow overlap.'
  );

  // 3. Verify TerminalView, ClaudeView, and CodeEditor hide quick keybars on Desktop devices
  const terminalViewSrc = fs.readFileSync(
    path.join(rootDir, 'apps/web/src/components/TerminalView.vue'),
    'utf-8'
  );
  assert.match(
    terminalViewSrc,
    /v-if="!isDesktopDevice"\s+class="terminal-touch-bar-container"/,
    'TerminalView.vue must hide .terminal-touch-bar-container on Desktop devices'
  );
  assert.match(
    terminalViewSrc,
    /<VirtualLaptopKeyboard[\s\S]*v-if="isLaptopKeyboardOpen && !isDesktopDevice"/,
    'TerminalView.vue must hide VirtualLaptopKeyboard on Desktop devices'
  );

  const claudeViewSrc = fs.readFileSync(
    path.join(rootDir, 'apps/web/src/components/ClaudeView.vue'),
    'utf-8'
  );
  assert.match(
    claudeViewSrc,
    /v-if="!isDesktopDevice"\s+class="claude-shortcut-bar"/,
    'ClaudeView.vue must hide .claude-shortcut-bar on Desktop devices'
  );

  const codeEditorSrc = fs.readFileSync(
    path.join(rootDir, 'apps/web/src/components/CodeEditor.vue'),
    'utf-8'
  );
  assert.match(
    codeEditorSrc,
    /v-if="!isDesktopDevice && fileStore\.fileMode === 'code'"\s+class="editor-keybar"/,
    'CodeEditor.vue must hide .editor-keybar on Desktop devices'
  );
  console.log(
    '✓ Test 3 Passed: TerminalView, ClaudeView, and CodeEditor hide quick keybars on Desktop devices.'
  );

  // 4. Verify File screen (fileStore.ts + SmartHeader.vue + CodeEditor.vue) defaults to Preview mode for .md/.markdown/.html/.htm
  setActivePinia(createPinia());
  const { useFileStore } = await vite.ssrLoadModule('/src/stores/fileStore.ts');
  const fileStore = useFileStore();

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('README.md')) {
      return {
        ok: true,
        json: async () => ({
          path: '/repo/README.md',
          name: 'README.md',
          content: '# Title\n| A | B |\n|---|---|\n| 1 | 2 |',
        }),
      };
    }
    if (u.includes('index.html')) {
      return {
        ok: true,
        json: async () => ({
          path: '/repo/index.html',
          name: 'index.html',
          content: '<h1>Hello HTML Preview</h1>',
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        path: '/repo/main.ts',
        name: 'main.ts',
        content: 'console.log(1);',
      }),
    };
  };

  await fileStore.openFile('/repo/README.md');
  assert.equal(fileStore.fileMode, 'preview', 'Opening README.md in FileExplorer must default to preview mode');

  await fileStore.openFile('/repo/index.html');
  assert.equal(fileStore.fileMode, 'preview', 'Opening index.html in FileExplorer must default to preview mode');

  const smartHeaderSrc = fs.readFileSync(path.join(rootDir, 'apps/web/src/components/SmartHeader.vue'), 'utf-8');
  const fileStoreSrc = fs.readFileSync(path.join(rootDir, 'apps/web/src/stores/fileStore.ts'), 'utf-8');
  await fileStore.openFile('/repo/main.ts');
  assert.equal(fileStore.fileMode, 'preview', 'Opening main.ts must default to read-only preview');
  assert.equal(fileStore.activeFile.name, 'main.ts');
  fileStore.fileMode = 'code';
  assert.equal(fileStore.fileMode, 'code');
  fileStore.fileMode = 'preview';
  assert.equal(fileStore.fileMode, 'preview');
  await fileStore.openFile('/repo/README.md');
  assert.equal(fileStore.fileMode, 'preview', 'Switching file resets preview mode');
  await fileStore.openFile('/repo/main.ts');
  assert.equal(fileStore.fileMode, 'preview', 'Opening code again remains in preview');
  assert.match(fileStore.activeFile.content, /console\.log/);
  assert.match(codeEditorSrc, /class="code-preview-box"/, 'CodeEditor must expose read-only code preview');
  assert.match(quickPanelSrc, /id="quick-code-preview"/, 'Quick panel must expose read-only code preview');
  assert.match(smartHeaderSrc, /id="btn-editor-preview-toggle"/, 'Header must offer edit/preview toggle for every text file');
  assert.match(appVueSrc, /--header-h:\s*64px/, 'Panel starts at actual rendered 64px header');
  assert.match(appVueSrc, /--dock-h:\s*42px/, 'Panel ends at actual rendered 42px dock');
  assert.doesNotMatch(appVueSrc, /--header-h:\s*66px/, 'No stale 66px header offset');
  assert.doesNotMatch(appVueSrc, /--dock-h:\s*52px/, 'No stale 52px dock offset');
  assert.match(quickPanelSrc, /top:\s*calc\(var\(--header-h,\s*64px\)/, 'Panel uses actual header offset');
  assert.match(quickPanelSrc, /bottom:\s*calc\(var\(--dock-h,\s*42px\)/, 'Panel uses actual dock offset');
  assert.match(codeEditorSrc, /useDesktopDevice\(\)/, 'Editor uses shared device detector');
  assert.doesNotMatch(codeEditorSrc, /function detectDesktopRuntime/, 'Editor must not duplicate device detector');
  assert.match(quickPanelSrc, /id="quick-md-switch"/, 'Quick panel exposes preview/edit toggle');
  assert.match(fileStoreSrc, /fileMode\.value = 'preview'/);

  assert.match(smartHeaderSrc, /v-if="fileStore.activeFile"/, 'Header toggle is available for all text files');

  assert.match(
    codeEditorSrc,
    /v-else-if="fileStore\.fileMode === 'preview' && isHtml"[\s\S]*class="html-preview-box"/,
    'CodeEditor.vue must render iframe .html-preview-box when fileMode is preview for HTML files'
  );

  console.log(
    '✓ Test 4 Passed: File screen defaults to Preview mode for Markdown & HTML files and supports toggling Preview/Edit.'
  );
  console.log('=== ALL DESKTOP DEVICE & SEAMLESS PREVIEW TESTS PASSED ===');
} finally {
  await vite.close();
}
