import { env } from '../config/env';
import { api } from './api-client';
import { useConnection } from './connection';

/**
 * WebSocket terminal với vé 30s (terminal-ws.v1). Rớt → nối lại backoff 1→5s, tối đa 15 lần, xin vé mới,
 * server replay buffer. Đóng 4404 (phiên không còn) → không nối lại.
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
    private readonly on: { data: (d: Uint8Array) => void; exit: (code: number | null) => void; gone: () => void; reconnecting: (n: number) => void; open: () => void },
  ) {
    void this.open();
  }

  private async open() {
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
          const m = JSON.parse(ev.data) as { type?: string; code?: number };
          if (m.type === 'exit') return this.on.exit(m.code ?? null);
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
    if (this.attempt > 15) return this.on.gone();
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
    this.ws?.close();
  }
}
