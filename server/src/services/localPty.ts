import pty from 'node-pty';
import os from 'os';
import path from 'path';
import fs from 'fs';

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

export function createLocalPty(
  id: string,
  name: string,
  cwd: string,
  cols = 80,
  rows = 24
): LocalPtyInstance {
  const shell = process.env.SHELL || '/bin/bash';

  let resolvedCwd = cwd || os.homedir();
  if (resolvedCwd.startsWith('~')) {
    resolvedCwd = path.join(os.homedir(), resolvedCwd.slice(1));
  } else if (!path.isAbsolute(resolvedCwd)) {
    resolvedCwd = path.resolve(os.homedir(), resolvedCwd);
  }
  if (!fs.existsSync(resolvedCwd)) {
    resolvedCwd = os.homedir();
  }

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: Math.max(10, cols),
    rows: Math.max(5, rows),
    cwd: resolvedCwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
  });

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
