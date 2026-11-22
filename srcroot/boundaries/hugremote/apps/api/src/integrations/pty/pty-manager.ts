import { LIMITS } from '@app/shared';
import type { PtyHandle } from '../host/host-runtime';

/** Socket đang xem một phiên — tầng WS cài interface này, PTY manager không biết gì về WebSocket. */
export interface PtyViewer {
  send(data: Buffer): void;
  sendControl(msg: Record<string, unknown>): void;
}

interface Live {
  id: string;
  pty: PtyHandle;
  buffer: Buffer[];
  size: number;
  viewers: Set<PtyViewer>;
  lastViewerAt: number;
  exited: boolean;
  exitCode: number | null;
}

/**
 * Giữ PTY + buffer trong RAM (A2). Buffer ≤500KB, cắt ở ranh giới `\n` để TUI không vỡ khi replay.
 * Nhiều socket một PTY; kích thước theo socket resize gần nhất. Không ai xem 30 phút → thu hồi.
 */
export class PtyManager {
  private readonly live = new Map<string, Live>();
  private readonly timer: NodeJS.Timeout;

  constructor(private readonly onExit: (id: string, code: number | null) => void) {
    this.timer = setInterval(() => this.reap(), 60_000);
    this.timer.unref();
  }

  get count() {
    return [...this.live.values()].filter((l) => !l.exited).length;
  }

  has(id: string) {
    return this.live.has(id) && !this.live.get(id)!.exited;
  }

  add(id: string, pty: PtyHandle) {
    const l: Live = { id, pty, buffer: [], size: 0, viewers: new Set(), lastViewerAt: Date.now(), exited: false, exitCode: null };
    this.live.set(id, l);
    pty.onData((d) => {
      this.append(l, d);
      for (const v of l.viewers) v.send(d);
    });
    pty.onExit((code) => {
      l.exited = true;
      l.exitCode = code;
      for (const v of l.viewers) v.sendControl({ type: 'exit', code });
      this.live.delete(id);
      this.onExit(id, code);
    });
  }

  private append(l: Live, d: Buffer) {
    l.buffer.push(d);
    l.size += d.length;
    if (l.size <= LIMITS.TERMINAL_BUFFER_BYTES) return;
    // Gộp rồi cắt phần đầu, bắt đầu lại ở ngay sau một `\n`
    const all = Buffer.concat(l.buffer);
    let cut = all.length - LIMITS.TERMINAL_BUFFER_BYTES;
    const nl = all.indexOf(0x0a, cut);
    if (nl >= 0 && nl - cut < 64 * 1024) cut = nl + 1;
    const kept = all.subarray(cut);
    l.buffer = [kept];
    l.size = kept.length;
  }

  /** Attach: resize PTY TRƯỚC rồi mới gửi buffer (tránh TUI vẽ theo kích thước cũ — A5). */
  attach(id: string, v: PtyViewer, cols: number, rows: number): boolean {
    const l = this.live.get(id);
    if (!l || l.exited) return false;
    l.pty.resize(cols, rows);
    l.viewers.add(v);
    l.lastViewerAt = Date.now();
    if (l.size) v.send(Buffer.concat(l.buffer));
    return true;
  }

  detach(id: string, v: PtyViewer) {
    const l = this.live.get(id);
    if (!l) return;
    l.viewers.delete(v);
    l.lastViewerAt = Date.now();
  }

  write(id: string, data: Buffer | string) {
    this.live.get(id)?.pty.write(data);
  }

  resize(id: string, cols: number, rows: number) {
    this.live.get(id)?.pty.resize(cols, rows);
  }

  kill(id: string) {
    const l = this.live.get(id);
    if (!l) return;
    l.pty.kill();
  }

  killAll() {
    for (const id of [...this.live.keys()]) this.kill(id);
    clearInterval(this.timer);
  }

  private reap() {
    const limit = LIMITS.TERMINAL_IDLE_REAP_MINUTES * 60_000;
    const now = Date.now();
    for (const l of this.live.values()) if (!l.viewers.size && now - l.lastViewerAt > limit) l.pty.kill();
  }
}
