import { EventEmitter } from 'node:events';
import { TerminalGateway } from './terminal.gateway';

/**
 * G-13: WS terminal kiểm chủ phiên lúc đổi vé. Trước vá 2026-11-23, `ws.on('message', ...)` ghi thẳng
 * vào PTY bằng `sessionId` lấy từ query string TRƯỚC KHI `attach()` (kiểm `owned()`) kịp resolve —
 * bất kỳ ai cầm vé hợp lệ của chính mình, biết `sessionId` của người khác, có thể gõ lệnh vào PTY đó
 * trong khoảng hở này. Bài test này pin đúng khoảng hở đã đóng: không phím gõ nào được ghi vào PTY
 * trước khi `attach()` xác nhận chủ phiên, và phím gõ gửi sớm không bị mất (xả hàng đợi sau khi attach OK).
 */
describe('TerminalGateway — không ghi vào PTY trước khi attach() xác nhận chủ phiên', () => {
  function makeWs() {
    const emitter = new EventEmitter();
    const ws = {
      readyState: 1,
      OPEN: 1,
      on: (event: string, cb: (...args: unknown[]) => void) => emitter.on(event, cb),
      send: jest.fn(),
      close: jest.fn(),
    };
    return { ws: ws as unknown as Parameters<TerminalGateway['handleConnection']>[0], emitter, raw: ws };
  }

  function makeGateway() {
    const write = jest.fn();
    const resize = jest.fn();
    const detach = jest.fn();
    let resolveAttach!: (ok: boolean) => void;
    const attachGate = new Promise<boolean>((res) => (resolveAttach = res));
    const auth = { consumeTicket: jest.fn().mockResolvedValue({ id: 'u1' }) };
    const terminals = {
      ptys: { write, resize, detach },
      attach: jest.fn().mockReturnValue(attachGate),
    };
    const cfg = { basePath: '' };
    const gw = new TerminalGateway(auth as never, terminals as never, cfg as never);
    return { gw, write, resize, resolveAttach };
  }

  const req = { url: '/ws/terminal?sessionId=victim-session&ticket=t1', headers: {} } as never;

  it('không bị người khác (sessionId của họ) ghi vào PTY khi attach() từ chối — phím gõ sớm bị bỏ, không chạy', async () => {
    const { gw, write, resize, resolveAttach } = makeGateway();
    const { ws, emitter, raw } = makeWs();

    const conn = gw.handleConnection(ws, req);
    await Promise.resolve(); // để consumeTicket() resolve và listener 'message' được gắn
    emitter.emit('message', Buffer.from('rm -rf /'), false);

    // Vẫn đang chờ attach() — chưa ghi gì vào PTY dù đã gửi phím gõ
    expect(write).not.toHaveBeenCalled();
    expect(resize).not.toHaveBeenCalled();

    // attach() từ chối (không phải chủ phiên) → đóng socket, KHÔNG xả hàng đợi vào PTY
    resolveAttach(false);
    await conn;

    expect(write).not.toHaveBeenCalled();
    expect(raw.close).toHaveBeenCalledWith(4404, 'gone');
  });

  it('chủ phiên thật: phím gõ gửi sớm được giữ lại và ghi vào PTY sau khi attach() xác nhận', async () => {
    const { gw, write, resolveAttach } = makeGateway();
    const { ws, emitter } = makeWs();

    const conn = gw.handleConnection(ws, req);
    await Promise.resolve(); // để consumeTicket() resolve và listener 'message' được gắn
    emitter.emit('message', Buffer.from('ls -la\n'), false);

    expect(write).not.toHaveBeenCalled(); // chưa ghi trong lúc còn chờ attach()

    resolveAttach(true); // attach() xác nhận: đúng chủ phiên
    await conn;

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('victim-session', Buffer.from('ls -la\n'));
  });
});
