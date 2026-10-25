import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';

const componentPath = resolve('apps/web/src/components/VirtualLaptopKeyboard.vue');
const source = await readFile(componentPath, 'utf8');
const style = source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function declarations(selector, css = style) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  assert.ok(match, `missing CSS rule ${selector}`);
  return Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map(([, property, value]) => [property, value.trim()]),
  );
}

function mediaCss(maxWidth) {
  const marker = `@media (max-width: ${maxWidth})`;
  const start = style.indexOf(marker);
  assert.notEqual(start, -1, `missing ${marker}`);
  return style.slice(start + marker.length);
}

await test('desktop keyboard characters are exactly 1.5x larger', () => {
  assert.equal(declarations('.vlk-key')['font-size'], '18.75px');
  const expected = {
    '.vlk-key-bksp': '21px',
    '.vlk-key-caps': '16.5px',
    '.vlk-key-enter': '18px',
    '.vlk-key-lshift': '16.5px',
    '.vlk-key-rshift': '16.5px',
    '.vlk-key-esc': '16.5px',
    '.vlk-key-ctrl': '16.5px',
    '.vlk-key-alt': '16.5px',
    '.vlk-key-paste': '21px',
    '.vlk-key-space': '17.25px',
    '.vlk-key-arrow': '18px',
  };
  for (const [selector, size] of Object.entries(expected)) {
    assert.equal(declarations(selector)['font-size'], size, `${selector} font-size`);
  }
});

await test('mobile key characters scale exactly and touch heights stay unchanged', () => {
  const mobile = mediaCss('480px');
  assert.equal(declarations('.vlk-key', mobile)['font-size'], '16.5px');
  assert.equal(declarations('.vlk-key', mobile).height, '31px');
  const longActionKeys = declarations('.vlk-key-enter, .vlk-key-lshift, .vlk-key-rshift', mobile);
  assert.equal(longActionKeys['font-size'], '15px');
  assert.equal(declarations('.vlk-key').height, '34px');
  assert.equal(declarations('.vlk-modifier-row .vlk-key').height, '34px');
});

await test('keyboard spacing is reduced without adding internal key padding', () => {
  assert.equal(
    declarations('.virtual-laptop-keyboard').padding,
    '3px 3px calc(3px + env(safe-area-inset-bottom, 0px))',
  );
  assert.equal(declarations('.virtual-laptop-keyboard').gap, '3px');
  assert.equal(declarations('.vlk-header').padding, '1px 2px 2px');
  assert.equal(declarations('.vlk-rows').gap, '2px');
  assert.equal(declarations('.vlk-row').gap, '2px');
  assert.equal(declarations('.vlk-key').padding, '0');
});

await test('labels have a non-wrapping overflow guard', () => {
  const label = declarations('.vlk-label');
  assert.equal(label['white-space'], 'nowrap');
  assert.equal(label.overflow, 'hidden');
  assert.equal(label['text-overflow'], 'ellipsis');
  assert.equal(label['max-width'], '100%');
  assert.equal(label['min-width'], '0');
});

await test('action legends stay compact at the larger mobile font', () => {
  const compactLegends = {
    tab: '↹',
    caps: '⇪',
    enter: '↵',
    lshift: '⇧',
    rshift: '⇧',
    esc: '⎋',
    ctrl: '⌃',
    alt: '⌥',
  };
  for (const [id, legend] of Object.entries(compactLegends)) {
    assert.match(source, new RegExp(`id: '${id}'[\\s\\S]{0,140}defaultVal: '${legend}'`), `${id} compact legend`);
  }
  assert.doesNotMatch(source, /defaultVal: '(?:Tab(?: ↹)?|Caps(?: ⇪)?|Enter ↵|⇧ Shift|Ctrl|Alt)'/);
});

await test('symbolic keys retain explicit accessible names', () => {
  assert.match(source, /:aria-label="getAccessibleLabel\(k\)"/);
  assert.match(source, /:title="getAccessibleLabel\(k\)"/);
  for (const [id, name] of Object.entries({
    bksp: 'Xóa lùi', tab: 'Tab', caps: 'Caps Lock', enter: 'Enter', lshift: 'Shift trái',
    rshift: 'Shift phải', esc: 'Escape', ctrl: 'Control', alt: 'Alt', paste: 'Dán',
    space: 'Phím cách', left: 'Mũi tên trái', up: 'Mũi tên lên', down: 'Mũi tên xuống', right: 'Mũi tên phải',
  })) {
    assert.match(source, new RegExp(`id: '${id}'[\\s\\S]{0,180}accessibleLabel: '${name}'`), `${id} accessible name`);
  }
});

const vite = await createServer({
  root: resolve('apps/web'),
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true },
  appType: 'custom',
});
try {
  await test('SSR keeps the complete keyboard layout and visible labels', async () => {
    const { default: VirtualLaptopKeyboard } = await vite.ssrLoadModule('/src/components/VirtualLaptopKeyboard.vue');
    const html = await renderToString(createSSRApp(VirtualLaptopKeyboard));
    assert.equal((html.match(/<button/g) ?? []).length, 63, '62 keys plus the close control');
    for (const label of ['`', '↹', '⇪', '↵', '⇧', '⎋', '⌃', '⌥', '␣ Space']) {
      assert.ok(html.includes(label), `missing SSR label ${label}`);
    }
    assert.equal((html.match(/vlk-key-arrow/g) ?? []).length, 4, 'all four arrow keys render');
  });
} finally {
  await vite.close();
}

if (failed) process.exitCode = 1;
