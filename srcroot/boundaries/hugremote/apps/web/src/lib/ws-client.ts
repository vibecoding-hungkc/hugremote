import { env } from '../config/env';
import { api } from './api-client';
import { useConnection } from './connection';

/**
 * WebSocket terminal với vé 30s (terminal-ws.v1). Rớt → nối lại backoff 1→5s, KHÔNG giới hạn số lần (Mac ngủ / mất mạng
 * lâu vẫn tự hồi — Authority 2026-11-25), có mạng lại (`online`) hoặc quay lại tab → thử ngay; xin vé mới, server replay
 * buffer. Đóng 4404 (phiên không còn — kể cả PTY bị thu hồi sau 30 phút không socket) → không nối lại.
 */
export class TerminalSocket {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private closed = false;
  private timer?: ReturnType<typeof setTimeout>;
  private queue: (string | Uint8Array)[] = [];

  constructor(
    private readonly sessionId: string,
    private readonly size: () => { cols: number; rows: number },
    private readonly on: {
      data: (d: Uint8Array) => void;
      exit: (code: number | null) => void;
      gone: () => void;
      reconnecting: (n: number) => void;
      open: () => void;
      notice?: (code: string) => void;
      replay?: () => void;
    },
  ) {
    window.addEventListener('online', this.now);
    document.addEventListener('visibilitychange', this.now);
    void this.open();
  }

  /** Đang chờ nối lại mà có mạng / tab hiện lại → khỏi đợi hết backoff. */
  private now = () => {
    if (this.closed || this.ws || !this.timer || document.visibilityState === 'hidden') return;
    clearTimeout(this.timer);
    this.timer = undefined;
    void this.open();
  };

  private async open() {
    this.timer = undefined;
    if (this.closed) return;
    let ticket: string;
    try {
      ticket = (await api<{ ticket: string }>('/auth/stream-ticket', { method: 'POST' })).ticket;
    } catch {
      return this.retry();
    }
    const { cols, rows } = this.size();
    const ws = new WebSocket(`${env.wsBase}/ws/terminal?sessionId=${encodeURIComponent(this.sessionId)}&cols=${cols}&rows=${rows}&ticket=${encodeURIComponent(ticket)}`);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      useConnection.getState().set(true);
      for (const q of this.queue) ws.send(q);
      this.queue = [];
      this.on.open();
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        try {
          const m = JSON.parse(ev.data) as { type?: string; code?: number | string };
          if (m.type === 'exit') return this.on.exit(typeof m.code === 'number' ? m.code : null);
          if (m.type === 'notice') return this.on.notice?.(String(m.code));
          if (m.type === 'replay') return this.on.replay?.();
          if (m.type === 'pong') return;
        } catch {
          /* chuỗi thường */
        }
        this.on.data(new TextEncoder().encode(ev.data));
      } else this.on.data(new Uint8Array(ev.data as ArrayBuffer));
    };
    ws.onclose = (ev) => {
      this.ws = null;
      if (this.closed) return;
      if (ev.code === 4404) return this.on.gone();
      this.retry();
    };
  }

  private retry() {
    if (this.closed) return;
    this.attempt++;
    if (this.attempt > 1) useConnection.getState().set(false);
    this.on.reconnecting(this.attempt);
    this.timer = setTimeout(() => void this.open(), Math.min(5000, 1000 * this.attempt));
  }

  send(d: string | Uint8Array) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(d);
    else this.queue.push(d);
  }

  resize(cols: number, rows: number) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'resize', cols, rows }));
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    window.removeEventListener('online', this.now);
    document.removeEventListener('visibilitychange', this.now);
    this.ws?.close();
  }
}
