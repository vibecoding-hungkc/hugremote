import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const protoPath = path.resolve('analysis/prototypes/prototype.html');
const proto = fs.readFileSync(protoPath, 'utf8');

// 1. Bottom dock has 5th item: Cài đặt (view-settings) as icon-only without text label
assert.match(
  proto,
  /id="dock-item-settings"[^>]*data-target="view-settings"|data-target="view-settings"[^>]*id="dock-item-settings"/,
  'Bottom dock must include #dock-item-settings targeting view-settings',
);
const protoSettingsBtn = proto.match(/<button[^>]*id="dock-item-settings"[^>]*>([\s\S]*?)<\/button>/);
assert.ok(protoSettingsBtn, '#dock-item-settings button must exist in prototype.html');
assert.doesNotMatch(
  protoSettingsBtn[1],
  /dock-label|Cài đặt/,
  'Bottom dock settings item in prototype.html must be icon-only without a text label',
);

// 2. Settings view (#view-settings) renders language selector (#settings-language-card), version updater (#settings-version-card), and shared shortcut configuration block
assert.match(proto, /<section id="view-settings" class="view">/, '#view-settings view section must exist');
assert.match(proto, /id="settings-language-card"/, 'Language configuration card #settings-language-card must exist in Settings view');
assert.match(proto, /id="settings-version-card"/, 'Version update card #settings-version-card must exist in Settings view');
assert.match(proto, /id="version-status-badge"/, 'Version status badge #version-status-badge must exist in Settings view');
assert.match(proto, /id="btn-check-update"/, 'Check update button #btn-check-update must exist in Settings view');
assert.match(proto, /id="btn-quick-update"/, 'Quick update button #btn-quick-update must exist in Settings view');
assert.match(proto, /id="settings-2fa-card"/, 'Two-factor security card #settings-2fa-card must exist in Settings view');
assert.match(proto, /id="two-factor-status-badge"/, 'Two-factor status badge #two-factor-status-badge must exist in Settings view');
assert.match(proto, /id="btn-toggle-2fa-setup"/, 'Two-factor setup/disable button #btn-toggle-2fa-setup must exist in Settings view');
assert.match(proto, /id="settings-shortcut-card"/, 'Shared shortcut configuration card #settings-shortcut-card must exist');
assert.match(proto, /id="shortcut-enabled-toggle"/, 'Shortcut master toggle must exist');
assert.match(proto, /id="shortcut-labels-toggle-btn"/, 'Shortcut labels toggle button must exist');
assert.match(proto, /id="settings-shortcut-group-list"/, 'Shared shortcut rules list must exist');
assert.match(proto, /id="btn-reset-shortcuts-default"/, 'Reset default shortcuts button must exist');
assert.doesNotMatch(
  proto,
  /id="settings-shortcut-projects"|id="settings-shortcut-terminals"|id="settings-shortcut-claudes"|id="settings-shortcut-servers"|btn-move-up|btn-move-down/,
  'Settings view must not render per-item shortcut tables or reorder buttons',
);

// 3. Workspace Sidebar renders thin index (.dw-idx-badge) and hides .dw-kbd-tag by default until #app.shortcut-labels-visible is active
assert.match(proto, /class="dw-idx-badge"/, 'Workspace sidebar must render thin sequential index (.dw-idx-badge)');
assert.match(
  proto,
  /\.dw-kbd-tag\s*\{[\s\S]*?display:\s*none/,
  '.dw-kbd-tag must be hidden by default in Workspace Sidebar',
);
assert.match(
  proto,
  /#app\.shortcut-labels-visible\s+\.dw-kbd-tag\s*\{\s*display:\s*inline-flex/,
  '#app.shortcut-labels-visible must reveal .dw-kbd-tag in Workspace Sidebar',
);

// 4. Universal Folder Sidebar (.quick-tree-trigger[data-quick-panel="files"]) in all 6 screen headers
for (const actionGroupId of [
  'ctx-actions-files',
  'ctx-actions-editor',
  'ctx-actions-claude',
  'ctx-actions-terminal',
  'ctx-actions-git',
  'ctx-actions-settings',
]) {
  const regex = new RegExp(
    `id="${actionGroupId}"[\\s\\S]*?quick-tree-trigger[^>]*data-quick-panel="files"[\\s\\S]*?<\\/div>`,
  );
  assert.match(
    proto,
    regex,
    `Header action group #${actionGroupId} must include a Folder Sidebar trigger (.quick-tree-trigger[data-quick-panel="files"])`,
  );
}

// 5. Folder Sidebar (#quick-tree-panel) supports Upload, Download, and Fullscreen mode
assert.match(proto, /id="quick-tree-upload-files"/, 'Folder Sidebar must include #quick-tree-upload-files button');
assert.match(proto, /id="quick-tree-upload-folder"/, 'Folder Sidebar must include #quick-tree-upload-folder button');
assert.match(proto, /id="quick-tree-download-zip"/, 'Folder Sidebar must include #quick-tree-download-zip button');
assert.match(proto, /id="quick-file-download"/, 'Folder Sidebar inline workbench must include #quick-file-download button');
assert.match(proto, /id="quick-tree-fullscreen"/, 'Folder Sidebar must include #quick-tree-fullscreen button');
assert.match(proto, /id="quick-file-fullscreen"/, 'Folder Sidebar inline workbench must include #quick-file-fullscreen button');
assert.match(proto, /\.quick-tree-panel\.fullscreen\s*\{[\s\S]*?width:\s*100%\s*!important/, 'Folder Sidebar must support .fullscreen full-width CSS');
assert.match(proto, /quick-tree-row-download/, 'Folder Sidebar tree rows must include .quick-tree-row-download action');
assert.match(proto, /quick-tree-row-upload/, 'Folder Sidebar folder rows must include .quick-tree-row-upload action');

// 6. Core shortcut engine functions exist
for (const fnName of [
  'renderSettingsScreen',
  'toggleShortcutLabelsVisibility',
  'getEffectiveItemShortcut',
  'handleGlobalShortcutKeyDown',
  'executeShortcutAction',
]) {
  assert.match(
    proto,
    new RegExp(`function\\s+${fnName}\\s*\\(`),
    `Prototype must define ${fnName}()`,
  );
}

console.log('PASS prototype shared shortcut block, thin index with toggleable labels, and universal Folder Sidebar with upload/download');
