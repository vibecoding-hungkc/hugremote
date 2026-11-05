import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parse as parseVue } from '@vue/compiler-sfc';
import postcss from 'postcss';

const files = readdirSync('apps/web/src/components').filter((f) => f.endsWith('.vue')).map((f) => `apps/web/src/components/${f}`);
files.push('apps/web/src/App.vue');
const semantic = /(?:^|[.\s:#])(?:danger|destructive|delete|remove|error|warning|success|connected|disconnected|status|dirty|staged|untracked|modified|added|deleted|failed|done|ok|diff-add|diff-del|diff-ctx|upload-progress-banner|git-badge|status-indicator|server-status)(?=$|[.\s:#>\[,])/i;
const semanticIcon = /(?:item-icon|zip-icon|drop-icon|folder-ic|file-ic|folder-icon|quick-git-badge|quick-file-meta i|quick-tree-title > i|quick-git-branch i|quick-tree-node\[data-node-type=)/;
const semanticGit = /(?:\.plus\b|\.minus\b|\.stage-toggle\b|\.stage-label\b|\.status\b|\.diff-line\b|\.branch-picker\b|\.branch-row\.active\b|\.git-toast\b)/;
function isSemantic(file, selector) {
  return semantic.test(selector) || (file.endsWith('prototype.html') && /(?:claude-diff-(?:add|del)|quick-tree-icon|quick-git-status|git-file-stats \.plus|git-file-stats \.minus|claude-ext-input-box|claude-ext-user-msg)/.test(selector)) ||
    (file.endsWith('ClaudeView.vue') && /(?:claude-ext-input-box|claude-ext-user-msg)/.test(selector)) ||
    (file.endsWith('SmartHeader.vue') && /(?:project-selector-btn|term-session-pill|claude-session-pill|header-action-dropdown-wrapper:has\(\.header-dropdown-menu\)|header-dropdown-menu|quick-tree-trigger\[(?:aria-expanded|data-quick-panel))/.test(selector)) ||
    (file.endsWith('prototype.html') && /(?:project-selector-btn|term-session-pill|quick-tree-trigger\[aria-expanded|quick-tree-trigger\[data-quick-panel)/.test(selector)) ||
    (file.endsWith('GitView.vue') && semanticGit.test(selector)) ||
    (/(FileExplorer|FolderTreeNode|QuickWorkspacePanel|NewTerminalModal)\.vue$/.test(file) && semanticIcon.test(selector));
}
const color = /#(?:[0-9a-f]{3,8})\b|(?:rgba?|hsla?)\([^)]*\)/gi;
function isNeutral(raw) {
  if (/^#/.test(raw)) {
    let v = raw.slice(1);
    if (v.length === 3 || v.length === 4) v = v.split('').map((x) => x + x).join('');
    return Math.max(...[0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16))) - Math.min(...[0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16))) <= 4;
  }
  const nums = raw.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (/^hsla?/i.test(raw)) return nums[1] === 0;
  return nums.length >= 3 && Math.abs(nums[0] - nums[1]) <= 2 && Math.abs(nums[1] - nums[2]) <= 2;
}
const failures = [];
const fileExplorerTemplate = parseVue(readFileSync('apps/web/src/components/FileExplorer.vue', 'utf8')).descriptor.template?.content || '';
assert.match(fileExplorerTemplate, /item\.isDirectory\s*\?\s*'ri-folder-2-line folder'/, 'File-screen directory icon must match Terminal ri-folder-2-line');
assert.doesNotMatch(fileExplorerTemplate, /item\.isDirectory\s*\?\s*'ri-folder-fill folder'/);
function assertSemanticColor(file, selector, property) {
  const source = readFileSync(file, 'utf8');
  const declarations = parseVue(source).descriptor.styles.flatMap((block) => {
    const found = [];
    postcss.parse(block.content).walkDecls((decl) => {
      if (decl.parent.selector === selector && decl.prop === property) found.push(decl.value);
    });
    return found;
  });
  assert.ok(declarations.length, `${file}: missing ${selector} ${property}`);
  assert.ok(declarations.some((value) => (value.match(color) || []).some((literal) => !isNeutral(literal))), `${file}: ${selector} must retain semantic color`);
}
for (const [file, selector, property] of [
  ['FileExplorer.vue', '.item-icon.folder', 'color'],
  ['FileExplorer.vue', '.item-icon.code-js', 'color'],
  ['FolderTreeNode.vue', '.folder-ic', 'color'],
  ['NewTerminalModal.vue', '.folder-icon', 'color'],
  ['QuickWorkspacePanel.vue', '.quick-tree-node[data-node-type="dir"] > i:nth-of-type(2)', 'color'],
  ['QuickWorkspacePanel.vue', '.quick-tree-node[data-node-type="file"] > i:nth-of-type(1)', 'color'],
  ['GitView.vue', '.status', 'color'],
  ['GitView.vue', '.plus', 'color'],
  ['GitView.vue', '.minus', 'color'],
  ['GitView.vue', '.diff-line.added', 'background'],
  ['GitView.vue', '.diff-line.deleted', 'background'],
]) assertSemanticColor(`apps/web/src/components/${file}`, selector, property); 
assert.notEqual(readFileSync('apps/web/src/components/GitView.vue', 'utf8').match(/\.plus\s*\{\s*color:([^;}]+)/)?.[1], readFileSync('apps/web/src/components/GitView.vue', 'utf8').match(/\.minus\s*\{\s*color:([^;}]+)/)?.[1], 'Git additions and deletions must have different colors');
const prototype = readFileSync('analysis/prototypes/prototype.html', 'utf8');
assert.match(prototype, /\.quick-tree-row\[data-kind="file"\] \.quick-tree-icon\s*\{\s*color:\s*#7dd3fc/);
assert.match(prototype, /\.claude-diff-add\s*\{\s*color:\s*#bbf7d0/);
assert.match(prototype, /\.claude-diff-del\s*\{\s*color:\s*#fecaca/);
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  for (const block of parseVue(src).descriptor.styles) {
    postcss.parse(block.content).walkDecls((decl) => {
      const rule = decl.parent;
      if (isSemantic(file, rule.selector || '')) return;
      for (const match of decl.value.match(color) || []) {
        if (!isNeutral(match)) failures.push(`${file} ${rule.selector} ${decl.prop}: ${match}`);
      }
    });
  }
}
const proto = readFileSync('analysis/prototypes/prototype.html', 'utf8');
for (const match of proto.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
  postcss.parse(match[1]).walkDecls((decl) => {
    if (isSemantic('analysis/prototypes/prototype.html', decl.parent.selector || '') || /^--(?:danger|warning)$/.test(decl.prop)) return;
    for (const c of decl.value.match(color) || []) {
      if (!isNeutral(c)) failures.push(`prototype ${decl.parent.selector} ${decl.prop}: ${c}`);
    }
  });
}
if (failures.length) console.error(failures.join('\n'));
assert.deepEqual(failures, [], `${failures.length} non-semantic colored CSS literals remain`);
console.log(`PASS monochrome audit: ${files.length} Vue screens and prototype; semantic status/danger colors retained`);
