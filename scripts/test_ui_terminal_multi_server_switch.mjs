import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const terminalViewPath = path.join(root, 'apps/web/src/components/TerminalView.vue');
const wsRoutePath = path.join(root, 'apps/api/src/routes/ws.ts');
const localPtyPath = path.join(root, 'apps/api/src/services/localPty.ts');
const sshPoolPath = path.join(root, 'apps/api/src/services/sshPool.ts');
const workspaceSidebarPath = path.join(root, 'apps/web/src/components/WorkspaceSidebar.vue');

const terminalSrc = fs.readFileSync(terminalViewPath, 'utf8');
const wsRouteSrc = fs.readFileSync(wsRoutePath, 'utf8');
const localPtySrc = fs.readFileSync(localPtyPath, 'utf8');
const sshPoolSrc = fs.readFileSync(sshPoolPath, 'utf8');
const workspaceSidebarSrc = fs.readFileSync(workspaceSidebarPath, 'utf8');

// 1. TerminalView must maintain multi-session terminal pool and preserve instances on switch
assert.match(
  terminalSrc,
  /interface\s+SessionTerminalInstance\s*\{[\s\S]*?sessionId:\s*string;[\s\S]*?serverId:\s*string;[\s\S]*?term:\s*Terminal;[\s\S]*?fitAddon:\s*FitAddon;[\s\S]*?socket:\s*WebSocket\s*\|\s*null;[\s\S]*?wrapper:\s*HTMLElement;/,
  'TerminalView must define SessionTerminalInstance with term, fitAddon, socket, and wrapper'
);
assert.match(
  terminalSrc,
  /const\s+sessionInstances\s*=\s*new\s+Map<string,\s*SessionTerminalInstance>\(\);/,
  'TerminalView must maintain a session-keyed map of active terminal instances'
);

// 2. Switching sessions must toggle wrapper display instead of destroying terminal
assert.match(
  terminalSrc,
  /for\s*\(const\s*\[id,\s*inst\]\s*of\s*sessionInstances\.entries\(\)\)\s*\{[\s\S]*?if\s*\(id\s*!==\s*sessionId\)\s*\{[\s\S]*?inst\.wrapper\.style\.display\s*=\s*'none';/,
  'TerminalView must hide inactive session wrappers when switching sessions'
);
assert.match(
  terminalSrc,
  /existing\.wrapper\.style\.display\s*=\s*'block';[\s\S]*?syncActiveRefs\(existing\);[\s\S]*?executeResizeForInstance\(existing\);/,
  'TerminalView must restore existing session wrapper, sync refs, and fit geometry without socket teardown'
);

// 3. New sessions must fit geometry synchronously BEFORE connecting WebSocket
assert.match(
  terminalSrc,
  /newTerm\.open\(wrapper\);[\s\S]*?newFit\.fit\(\);[\s\S]*?connectInstanceWebSocket\(inst,\s*session,\s*server\);/,
  'TerminalView must synchronously fit geometry immediately after opening before connecting WebSocket'
);

// 4. WebSocket connect must send actual fitted cols and rows
assert.match(
  terminalSrc,
  /const\s+cols\s*=\s*inst\.term\.cols\s*\|\|\s*80;[\s\S]*?const\s+rows\s*=\s*inst\.term\.rows\s*\|\|\s*24;[\s\S]*?cols=\$\{cols\}&rows=\$\{rows\}/,
  'TerminalView must send fitted cols and rows in WS query parameters'
);

// 5. Backend ws.ts must resize PTY before replaying buffer on attach
assert.match(
  wsRouteSrc,
  /if\s*\(cols\s*>\s*0\s*&&\s*rows\s*>\s*0\)\s*\{\s*sessionManager\.resize\(sessionId,\s*cols,\s*rows\);\s*\}[\s\S]*?sessionManager\.attach\(sessionId,\s*socket,\s*session\);/,
  'ws.ts route must resize backend PTY to client cols/rows before buffer replay in attach()'
);

// 6. Buffer capacity must be 500KB with safe newline slicing
assert.match(localPtySrc, /const\s+MAX_BUFFER_LENGTH\s*=\s*500\s*\*\s*1024;/, 'localPty must use 500KB buffer');
assert.match(sshPoolSrc, /const\s+MAX_BUFFER_LENGTH\s*=\s*500\s*\*\s*1024;/, 'sshPool must use 500KB buffer');
assert.match(
  localPtySrc,
  /const\s+nextNewline\s*=\s*buffer\.indexOf\('\\n',\s*startIdx\);[\s\S]*?buffer\s*=\s*buffer\.substring\(startIdx\);/,
  'localPty must slice buffer at newline boundaries to protect multi-byte UTF-8 and ANSI sequences'
);
assert.match(
  sshPoolSrc,
  /const\s+nextNewline\s*=\s*buffer\.indexOf\('\\n',\s*startIdx\);[\s\S]*?buffer\s*=\s*buffer\.substring\(startIdx\);/,
  'sshPool must slice buffer at newline boundaries to protect multi-byte UTF-8 and ANSI sequences'
);

// 7. WorkspaceSidebar must switch terminal session ID before selecting project/server scope
assert.match(
  workspaceSidebarSrc,
  /async\s+function\s+handleSelectTerminal\(session:\s*TerminalSessionItem\)\s*\{[\s\S]*?emit\('select-terminal'\);[\s\S]*?terminalStore\.switchSession\(session\.id\);[\s\S]*?const\s+targetServerId\s*=\s*session\.serverId/,
  'WorkspaceSidebar must switch activeSessionId first to prevent intermediate desync during server/project change'
);

console.log('PASS all multi-server terminal switch, instance pooling, and PTY resize tests passed.');
