import { Inject, Logger } from '@nestjs/common';
import { OnGatewayConnection, WebSocketGateway } from '@nestjs/websockets';
import type { IncomingMessage } from 'node:http';
import type { WebSocket } from 'ws';
import { loadConfig, APP_CONFIG } from '../../config/app-config';
import type { AppConfig } from '../../config/app-config';
import { originAllowed } from '../../common/origin';
import { AuthService } from '../auth/auth.service';
import { TerminalService } from './terminal.service';

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.floor(n))) : lo);

/**
 * terminal-ws.v1 — `/ws/terminal?sessionId&cols&rows&ticket`. Kênh thô: client gửi phím, hoặc JSON
 * `{type:"resize"|"ping"}`; server resize PTY rồi replay buffer, sau đó output thô; `{type:"exit"}` khi PTY thoát.
 * Đóng 4401 vé sai · 1008 Origin lạ · 4404 phiên không còn.
 */
@WebSocketGateway({ path: `${loadConfig().basePath}/ws/terminal` })
export class TerminalGateway implements OnGatewayConnection {
  private readonly log = new Logger('TerminalWS');

  constructor(
    private readonly auth: AuthService,
    private readonly terminals: TerminalService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  async handleConnection(ws: WebSocket, req: IncomingMessage) {
    if (!originAllowed(req, this.cfg)) return ws.close(1008, 'origin');
    const q = new URL(req.url ?? '/', 'http://x').searchParams;
    const user = await this.auth.consumeTicket(q.get('ticket') ?? undefined);
    if (!user) return ws.close(4401, 'ticket');
    const id = q.get('sessionId') ?? '';
    const viewer = {
      send: (d: Buffer) => ws.readyState === ws.OPEN && ws.send(d, { binary: true }),
      sendControl: (m: Record<string, unknown>) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m)),
    };
    const handle = (raw: Buffer, isBinary: boolean) => {
      if (!isBinary && raw.length < 256 && raw[0] === 0x7b) {
        try {
          const m = JSON.parse(raw.toString()) as { type?: string; cols?: number; rows?: number };
          if (m.type === 'resize') return this.terminals.ptys.resize(id, clamp(Number(m.cols), 2, 500), clamp(Number(m.rows), 2, 300));
          if (m.type === 'ping') return void viewer.sendControl({ type: 'pong' });
        } catch {
          /* không phải JSON điều khiển → là phím gõ */
        }
      }
      this.terminals.ptys.write(id, raw);
    };
    // Đệm phím gõ tới khi attach() xác nhận chủ phiên (G-13) — gắn nghe trước để không lỡ phím gõ
    // sớm, nhưng KHÔNG ghi thẳng vào PTY trước khi biết `id` đúng là phiên của `user`.
    let attached = false;
    const pending: Array<{ raw: Buffer; isBinary: boolean }> = [];
    ws.on('message', (raw: Buffer, isBinary: boolean) => {
      if (!attached) {
        if (pending.length < 64) pending.push({ raw, isBinary });
        return;
      }
      handle(raw, isBinary);
    });
    ws.on('close', () => this.terminals.ptys.detach(id, viewer));
    try {
      const ok = await this.terminals.attach(user, id, viewer, clamp(Number(q.get('cols')), 2, 500), clamp(Number(q.get('rows')), 2, 300));
      if (!ok) return ws.close(4404, 'gone');
      attached = true;
      for (const { raw, isBinary } of pending) handle(raw, isBinary);
    } catch {
      ws.close(4404, 'gone');
    }
  }
}
