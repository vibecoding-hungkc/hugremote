import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse as parseVue } from '@vue/compiler-sfc';
import postcss from 'postcss';

const header = readFileSync('apps/web/src/components/SmartHeader.vue', 'utf8');
const css = postcss.parse(parseVue(header).descriptor.styles.map(s => s.content).join('\n'));
const prototype = readFileSync('analysis/prototypes/prototype.html', 'utf8');
const prototypeCss = postcss.parse([...prototype.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n'));
function borderColor(root, selector) {
  let color;
  root.walkRules(rule => {
    if (rule.selector !== selector) return;
    rule.walkDecls(decl => {
      if (decl.prop === 'border-color') color = decl.value;
      if (decl.prop === 'border' && !color) color = decl.value;
    });
  });
  assert.ok(color, `${selector} requires an explicit border`);
  const hex = color.match(/#[\da-f]{6}\b/i)?.[0];
  const rgb = color.match(/rgba?\(([^)]+)\)/i)?.[1]?.split(',').map(Number);
  const channels = hex ? [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) : rgb?.slice(0, 3);
  assert.ok(channels && Math.max(...channels) - Math.min(...channels) >= 25, `${selector} border should have a discernible accent: ${color}`);
  if (rgb?.length === 4) assert.ok(rgb[3] >= .35, `${selector} border opacity too low: ${color}`);
}
for (const selector of ['.project-selector-btn', '.term-session-pill, .claude-session-pill', '.claude-session-pill', '.header-action-dropdown-wrapper:has(.header-dropdown-menu) > .btn-icon-action', '.header-dropdown-menu', '.btn-icon-action.quick-tree-trigger[aria-expanded="true"]', '.btn-icon-action.quick-tree-trigger[data-quick-panel="git"][aria-expanded="true"]']) borderColor(css, selector);
for (const selector of ['.project-selector-btn', '.term-session-pill', '.term-session-pill.claude-pill', '.quick-tree-trigger[aria-expanded="true"]', '.quick-tree-trigger[data-quick-panel="git"][aria-expanded="true"]']) borderColor(prototypeCss, selector);
assert.match(header, /class="header-action-dropdown-wrapper"/);
assert.match(header, /class="header-dropdown-menu"/);
console.log('PASS header dropdown borders: semantic accent, grayscale surfaces');
