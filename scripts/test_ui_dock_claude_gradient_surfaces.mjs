import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { parse as parseVue } from '@vue/compiler-sfc';

const dockSource = readFileSync('apps/web/src/components/BottomDock.vue', 'utf8');
const claudeSource = readFileSync('apps/web/src/components/ClaudeView.vue', 'utf8');
const prototype = readFileSync('analysis/prototypes/prototype.html', 'utf8');

function declarations(css, selector) {
  const out = {};
  postcss.parse(css).walkRules((rule) => {
    if (rule.selector !== selector) return;
    rule.walkDecls((decl) => { out[decl.prop] = decl.value; });
  });
  return out;
}
function vueStyle(source) {
  return parseVue(source).descriptor.styles.map((block) => block.content).join('\n');
}
function assertGradientBorder(style, selector, surface) {
  const rule = declarations(style, selector);
  assert.match(rule.border || '', /1px solid transparent/, `${selector}: transparent border required`);
  assert.match(rule['background-clip'] || '', /padding-box, border-box/, `${selector}: gradient must be clipped to border`);
  assert.match(rule['background-image'] || '', /linear-gradient/, `${selector}: gradient missing`);
  assert.match(rule['background-image'], new RegExp(`linear-gradient\\(\\s*${surface}\\s+0\\s+0\\)\\s*,`), `${selector}: inner fill must retain ${surface}`);
}

for (const [style, label] of [[vueStyle(dockSource), 'app'], [prototype.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i)?.[1] || '', 'prototype']]) {
  const selector = label === 'app' ? '.dock-item.active' : '.dock-item.active';
  assertGradientBorder(style, selector, label === 'app' ? '#171717' : 'var\\(--bg-card\\)');
  console.log(`PASS ${label}: bottom active tab has visible gradient border without changing its fill`);
}

for (const [style, label] of [[vueStyle(claudeSource), 'app'], [prototype.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i)?.[1] || '', 'prototype']]) {
  assertGradientBorder(style, '.claude-ext-user-msg', '#252525');
  assertGradientBorder(style, '.claude-ext-input-box', '#1e1e1e');
  const focus = label === 'app' ? '.claude-ext-input-box.focused,\n.claude-ext-input-box:focus-within' : '.claude-ext-input-box:focus-within';
  const focused = declarations(style, focus);
  assert.match(focused['background-image'] || '', /linear-gradient\(\s*#1e1e1e\s+0\s+0\)\s*,/, `${focus}: focused fill must remain #1e1e1e`);
  assert.match(focused['background-image'], /linear-gradient\(135deg,/, `${focus}: focused gradient border must remain visible`);
  console.log(`PASS ${label}: Claude user message and composer keep original fills, including focus`);
}
