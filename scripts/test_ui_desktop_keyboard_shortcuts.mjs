import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const terminalViewPath = path.join(root, 'apps/web/src/components/TerminalView.vue');
const claudeViewPath = path.join(root, 'apps/web/src/components/ClaudeView.vue');
const codeEditorPath = path.join(root, 'apps/web/src/components/CodeEditor.vue');
const quickPanelPath = path.join(root, 'apps/web/src/components/QuickWorkspacePanel.vue');

const terminalSrc = fs.readFileSync(terminalViewPath, 'utf8');
const claudeSrc = fs.readFileSync(claudeViewPath, 'utf8');
const editorSrc = fs.readFileSync(codeEditorPath, 'utf8');
const quickSrc = fs.readFileSync(quickPanelPath, 'utf8');

// 1. TerminalView desktop physical keyboard shortcuts (Esc, Ctrl+C, Ctrl+V)
assert.match(
  terminalSrc,
  /term\.attachCustomKeyEventHandler\(\(event:\s*KeyboardEvent\)\s*=>/,
  'TerminalView must register attachCustomKeyEventHandler on xterm for desktop keyboard shortcuts'
);
assert.match(
  terminalSrc,
  /if\s*\(event\.key\s*===\s*'Escape'\)/,
  'TerminalView custom key handler must handle Escape'
);
assert.match(
  terminalSrc,
  /if\s*\(hasCtrlOrMeta\s*&&\s*!event\.altKey\s*&&\s*key\s*===\s*'c'\)/,
  'TerminalView must handle Ctrl+C / Cmd+C for copy-on-selection vs SIGINT'
);
assert.match(
  terminalSrc,
  /if\s*\(hasCtrlOrMeta\s*&&\s*!event\.altKey\s*&&\s*key\s*===\s*'v'\)/,
  'TerminalView must intercept Ctrl+V / Cmd+V so xterm does not send raw ^V (\\x16)'
);
assert.match(
  terminalSrc,
  /window\.addEventListener\('keydown',\s*handleWindowKeyDown\)/,
  'TerminalView must listen to window keydown so Esc/Ctrl+C/Ctrl+V work even when xterm textarea loses focus'
);
assert.match(
  terminalSrc,
  /window\.addEventListener\('paste',\s*handleWindowPaste,\s*true\)/,
  'TerminalView must listen to window paste so native Ctrl+V/Cmd+V works even when xterm textarea is not focused'
);
assert.match(
  terminalSrc,
  /sendKey\('\\x1b'\)/,
  'TerminalView window keydown fallback must send Escape (\\x1b) to terminal'
);
assert.match(
  terminalSrc,
  /sendKey\('\\x03'\)/,
  'TerminalView window keydown fallback must send SIGINT (\\x03) on Ctrl+C without selection'
);

// 2. ClaudeView desktop physical keyboard shortcuts (Esc, Ctrl+C, Ctrl+V)
assert.match(
  claudeSrc,
  /window\.addEventListener\('keydown',\s*handleClaudeWindowKeyDown\)/,
  'ClaudeView must listen to window keydown for Esc/Ctrl+C/Ctrl+V when active'
);
assert.match(
  claudeSrc,
  /window\.addEventListener\('paste',\s*handleClaudeWindowPaste,\s*true\)/,
  'ClaudeView must listen to window paste when active'
);
assert.match(
  claudeSrc,
  /@paste="onTextareaPaste"/,
  'ClaudeView textarea must track native paste timestamps to avoid duplicate paste on Ctrl+V fallback'
);

// 3. CodeEditor & QuickWorkspacePanel focus and keyboard shortcuts
assert.match(
  editorSrc,
  /window\.addEventListener\('keydown',\s*handleEditorKeyDown\)/,
  'CodeEditor must handle desktop keyboard shortcuts (Ctrl+S, Ctrl+C, Ctrl+V)'
);
assert.match(
  editorSrc,
  /\(\)\s*=>\s*fileStore\.fileMode/,
  'CodeEditor must watch fileStore.fileMode and focus editor when switching from preview to code'
);
assert.match(
  quickSrc,
  /function\s+toggleInlineEditMode\(\)/,
  'QuickWorkspacePanel must focus inline editor when switching from preview to edit mode'
);

console.log('Desktop physical keyboard shortcuts (Esc, Ctrl+C, Ctrl+V) checks passed.');
