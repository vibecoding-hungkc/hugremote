import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const protoPath = path.resolve('analysis/prototypes/prototype.html');
const proto = fs.readFileSync(protoPath, 'utf8');

// 1. Bottom dock has 5th item: Cài đặt (view-settings)
assert.match(
  proto,
  /id="dock-item-settings"[^>]*data-target="view-settings"|data-target="view-settings"[^>]*id="dock-item-settings"/,
  'Bottom dock must include #dock-item-settings targeting view-settings',
);
assert.match(
  proto,
  /<span class="dock-label">Cài đặt<\/span>/,
  'Bottom dock settings item must be labeled Cài đặt',
);

// 2. Settings view (#view-settings) exists with shortcut configuration sections
assert.match(proto, /<section id="view-settings" class="view">/, '#view-settings view section must exist');
assert.match(proto, /id="shortcut-enabled-toggle"/, 'Shortcut master toggle must exist');
assert.match(proto, /id="shortcut-session-scope-server"/, 'Session numbering scope (server) button must exist');
assert.match(proto, /id="shortcut-session-scope-project"/, 'Session numbering scope (project) button must exist');
assert.match(proto, /id="settings-shortcut-group-list"/, 'Group prefix rules list must exist');
assert.match(proto, /id="settings-shortcut-projects"/, 'Numbered projects shortcut table/list must exist');
assert.match(proto, /id="settings-shortcut-terminals"/, 'Numbered terminal sessions shortcut list must exist');
assert.match(proto, /id="settings-shortcut-claudes"/, 'Numbered claude sessions shortcut list must exist');
assert.match(proto, /id="settings-shortcut-servers"/, 'Numbered servers shortcut list must exist');
assert.match(proto, /id="btn-reset-shortcuts-default"/, 'Reset default shortcuts button must exist');

// 3. Sequential index badges & shortcut hints rendered across Workspace Sidebar, Header, and Modals
assert.match(proto, /class="dw-idx-badge"/, 'Workspace sidebar must render sequential index badges (.dw-idx-badge)');
assert.match(proto, /class="dw-kbd-tag"/, 'Workspace sidebar must render shortcut kbd tags (.dw-kbd-tag)');
assert.match(proto, /id="current-server-idx"/, 'Header server selector must display current server index badge');
assert.match(proto, /id="current-project-idx"/, 'Header project selector must display current project index badge');

// 4. Core shortcut engine functions exist
for (const fnName of [
  'renderSettingsScreen',
  'formatShortcutCombo',
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

console.log('PASS prototype shortcut navigation & bottom settings menu checks');
