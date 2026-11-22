import { create } from 'zustand';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { TerminalSocket } from '../../../lib/ws-client';

/**
 * Pool xterm: một instance mỗi phiên, giữ sống khi đổi tab/dự án (chuyển lại không vẽ lại — A5).
 * Phần tử DOM của xterm được gắn vào khung đang hiển thị.
 */
export interface PooledTerm {
  id: string;
  term: Terminal;
  fit: FitAddon;
  el: HTMLDivElement;
  sock?: TerminalSocket;
  state: { exited: boolean; gone: boolean; reconnecting: number };
  listeners: Set<() => void>;
}

const pool = new Map<string, PooledTerm>();

function cssVar(n: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
}

/** Bảng màu terminal cố định ở cả hai chủ đề (`--term-*`). */
function theme() {
  return {
    background: cssVar('--term-bg'),
    foreground: cssVar('--term-text'),
    cursor: cssVar('--term-text'),
    selectionBackground: cssVar('--color-surface-raised'),
    black: cssVar('--term-bg'),
    brightBlack: cssVar('--term-muted'),
    red: cssVar('--term-red'),
    brightRed: cssVar('--term-red'),
    green: cssVar('--term-green'),
    brightGreen: cssVar('--term-green'),
    yellow: cssVar('--term-yellow'),
    brightYellow: cssVar('--term-yellow'),
    blue: cssVar('--term-blue'),
    brightBlue: cssVar('--term-blue'),
    magenta: cssVar('--color-accent-terminal'),
    brightMagenta: cssVar('--color-accent-terminal'),
    cyan: cssVar('--term-blue'),
    brightCyan: cssVar('--term-blue'),
    white: cssVar('--term-text'),
    brightWhite: cssVar('--term-text'),
  };
}

export function getTerm(id: string): PooledTerm {
  const existing = pool.get(id);
  if (existing) return existing;
  const el = document.createElement('div');
  el.className = 'xterm-host';
  el.style.cssText = 'position:absolute;inset:0;padding:var(--space-sm)';
  const term = new Terminal({
    fontFamily: cssVar('--font-mono'),
    fontSize: 14,
    cursorBlink: true,
    scrollback: 5000,
    allowProposedApi: true,
    theme: theme(),
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon());
  term.open(el);
  const p: PooledTerm = {
    id,
    term,
    fit,
    el,
    state: { exited: false, gone: false, reconnecting: 0 },
    listeners: new Set(),
  };
  term.onData((d) => {
    // Ctrl giữ một lần trên thanh phím + phím gõ từ bàn phím ảo → ký tự điều khiển (AC-11)
    const c = useCtrlLatch.getState();
    if (c.on && d.length === 1 && /[a-z@[\\\]^_ ]/i.test(d)) {
      c.set(false);
      return p.sock?.send(String.fromCharCode(d.toUpperCase().charCodeAt(0) & 0x1f));
    }
    p.sock?.send(d);
  });
  term.onBinary((d) => p.sock?.send(Uint8Array.from(d, (c) => c.charCodeAt(0))));
  let t: ReturnType<typeof setTimeout> | undefined;
  term.onResize(({ cols, rows }) => {
    clearTimeout(t);
    t = setTimeout(() => p.sock?.resize(cols, rows), 40); // debounce 40ms (B1 AC-10)
  });
  pool.set(id, p);
  return p;
}

/** Gắn xterm vào khung, fit TRƯỚC rồi mới mở WS lần đầu (server resize PTY trước khi replay — AC-9). */
export function attachTerm(p: PooledTerm, container: HTMLElement) {
  if (p.el.parentElement !== container) container.appendChild(p.el);
  try {
    p.fit.fit();
  } catch {
    /* khung chưa có kích thước */
  }
  if (!p.sock) {
    const notify = () => p.listeners.forEach((l) => l());
    p.sock = new TerminalSocket(p.id, () => ({ cols: p.term.cols, rows: p.term.rows }), {
      data: (d) => p.term.write(d),
      exit: () => ((p.state.exited = true), notify()),
      gone: () => ((p.state.gone = true), notify()),
      reconnecting: (n) => ((p.state.reconnecting = n), notify()),
      open: () => ((p.state.reconnecting = 0), notify()),
    });
  }
}

export function disposeTerm(id: string) {
  const p = pool.get(id);
  if (!p) return;
  p.sock?.close();
  p.term.dispose();
  p.el.remove();
  pool.delete(id);
}

/** Trạng thái phím Ctrl "giữ một lần" của thanh phím cảm ứng — chung cho thanh phím và bàn phím ảo. */
export const useCtrlLatch = create<{ on: boolean; set: (on: boolean) => void }>((set) => ({ on: false, set: (on) => set({ on }) }));
