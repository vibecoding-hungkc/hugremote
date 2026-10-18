import pty from 'node-pty';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

export interface LocalPtyInstance {
  id: string;
  name: string;
  cwd: string;
  buffer: string;
  ptyProcess: pty.IPty;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  onData: (callback: (data: string) => void) => void;
  onExit: (callback: () => void) => void;
}

const MAX_BUFFER_LENGTH = 100 * 1024; // 100KB replay buffer

/**
 * On macOS (Darwin), node-pty uses `posix_spawn` with a helper binary named `spawn-helper`.
 * In the official node-pty@1.1.0 npm package, Microsoft packaged `spawn-helper` with mode 0644
 * (missing executable +x bit), which causes `Error: posix_spawnp failed.` on macOS.
 * This helper ensures any `spawn-helper` binary found has 0755 permissions.
 */
function ensureDarwinPtyExecutable() {
  if (process.platform !== 'darwin') return;
  try {
    const req = createRequire(import.meta.url);
    const searchDirs: string[] = [];

    try {
      const ptyEntry = req.resolve('node-pty');
      searchDirs.push(path.dirname(path.dirname(ptyEntry)));
    } catch (_) {}

    searchDirs.push(
      path.resolve(process.cwd(), 'node_modules/node-pty'),
      path.resolve(process.cwd(), '../node_modules/node-pty'),
      path.resolve(os.homedir(), '.hugremote/server/node_modules/node-pty'),
      path.resolve(os.homedir(), '.hugremote/node_modules/node-pty')
    );

    for (const dir of searchDirs) {
      if (!dir || !fs.existsSync(dir)) continue;
      const candidates = [
        path.join(dir, 'build/Release/spawn-helper'),
        path.join(dir, 'build/Debug/spawn-helper'),
        path.join(dir, `prebuilds/darwin-${process.arch}/spawn-helper`),
        path.join(dir, 'prebuilds/darwin-arm64/spawn-helper'),
        path.join(dir, 'prebuilds/darwin-x64/spawn-helper'),
      ];

      for (const file of candidates) {
        if (fs.existsSync(file)) {
          try {
            const stat = fs.statSync(file);
            if ((stat.mode & 0o111) !== 0o111) {
              fs.chmodSync(file, 0o755);
            }
          } catch (_) {}
        }
      }
    }
  } catch (err) {
    console.warn('[localPty] ensureDarwinPtyExecutable warning:', err);
  }
}

function getValidShell(): string {
  const candidates = [
    process.env.SHELL,
    process.platform === 'darwin' ? '/bin/zsh' : null,
    '/bin/bash',
    '/bin/zsh',
    '/bin/sh',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch (_) {}
    }
  }
  return '/bin/sh';
}

export function createLocalPty(
  id: string,
  name: string,
  cwd: string,
  cols = 80,
  rows = 24
): LocalPtyInstance {
  ensureDarwinPtyExecutable();
  const shell = getValidShell();

  let resolvedCwd = cwd || os.homedir();
  if (resolvedCwd.startsWith('~')) {
    resolvedCwd = path.join(os.homedir(), resolvedCwd.slice(1));
  } else if (!path.isAbsolute(resolvedCwd)) {
    resolvedCwd = path.resolve(os.homedir(), resolvedCwd);
  }
  if (!fs.existsSync(resolvedCwd)) {
    resolvedCwd = os.homedir();
  }

  const spawnOptions = {
    name: 'xterm-256color',
    cols: Math.max(10, cols),
    rows: Math.max(5, rows),
    cwd: resolvedCwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
  };

  let ptyProcess: pty.IPty;
  try {
    ptyProcess = pty.spawn(shell, [], spawnOptions);
  } catch (firstErr: any) {
    if (process.platform === 'darwin') {
      ensureDarwinPtyExecutable();
      const fallbackShell = fs.existsSync('/bin/zsh') ? '/bin/zsh' : '/bin/sh';
      try {
        ptyProcess = pty.spawn(fallbackShell, [], {
          ...spawnOptions,
          cwd: fs.existsSync(resolvedCwd) ? resolvedCwd : os.homedir(),
        });
      } catch (secondErr: any) {
        console.error('[localPty] Failed to spawn fallback shell on darwin:', secondErr);
        throw firstErr;
      }
    } else {
      throw firstErr;
    }
  }

  let buffer = '';
  const dataCallbacks: Array<(data: string) => void> = [];
  const exitCallbacks: Array<() => void> = [];

  ptyProcess.onData((data: string) => {
    buffer += data;
    if (buffer.length > MAX_BUFFER_LENGTH) {
      buffer = buffer.substring(buffer.length - MAX_BUFFER_LENGTH);
    }
    for (const cb of dataCallbacks) {
      cb(data);
    }
  });

  ptyProcess.onExit(() => {
    for (const cb of exitCallbacks) {
      cb();
    }
  });

  return {
    id,
    name,
    cwd: resolvedCwd,
    get buffer() {
      return buffer;
    },
    ptyProcess,
    write(data: string) {
      try {
        ptyProcess.write(data);
      } catch (e) {
        console.error('Error writing to PTY:', e);
      }
    },
    resize(newCols: number, newRows: number) {
      try {
        ptyProcess.resize(Math.max(10, newCols), Math.max(5, newRows));
      } catch (e) {
        console.error('Error resizing PTY:', e);
      }
    },
    kill() {
      try {
        ptyProcess.kill();
      } catch (_) {}
    },
    onData(callback: (data: string) => void) {
      dataCallbacks.push(callback);
    },
    onExit(callback: () => void) {
      exitCallbacks.push(callback);
    },
  };
}
