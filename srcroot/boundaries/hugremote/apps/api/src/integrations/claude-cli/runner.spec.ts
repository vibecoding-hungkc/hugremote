import type { HostRuntime, StreamProc } from '../host/host-runtime';
import { ClaudeTurn, LINGER_MS } from './runner';

/** Tiến trình giả: in `result` rồi KHÔNG tự thoát khi stdin đóng — như CLI thật chờ mạng/hook lúc thoát (Authority 2026-11-26). */
function fakeProc() {
  let out: (d: Buffer) => void = () => undefined;
  let exit: (c: number | null) => void = () => undefined;
  const writes: string[] = [];
  const signals: string[] = [];
  const st = { ended: false };
  const proc: StreamProc = {
    stdin: { write: (d) => void writes.push(d), end: () => void (st.ended = true) },
    onStdout: (cb) => void (out = cb),
    onStderr: () => undefined,
    onExit: (cb) => void (exit = cb),
    signal: (s) => void (signals.push(s), exit(null)),
  };
  return { writes, signals, st, proc, say: (o: object) => out(Buffer.from(JSON.stringify(o) + '\n')) };
}
const opts = { bin: 'claude', cwd: '/', cliSessionId: 'x', resume: false, model: null, effort: null, permissionMode: 'default', name: 'n' };

describe('ClaudeTurn — CLI thoát chậm sau result', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('result → báo ngay; quá LINGER_MS không in gì thì kết thúc hộ, coi là thoát thường (code 0)', async () => {
    const f = fakeProc();
    const ops: string[] = [];
    let exitInfo: { code: number | null; gotResult: boolean } | undefined;
    const turn = new ClaudeTurn('t', { onOp: (o) => ops.push(o.op), onExit: (i) => (exitInfo = i) });
    await turn.start({ spawnStream: () => Promise.resolve(f.proc) } as unknown as HostRuntime, opts, 'hi');
    f.say({ type: 'result', subtype: 'success', is_error: false, usage: {} });
    jest.advanceTimersByTime(3000); // không trả get_context_usage → nhả result sau 3s
    expect(ops).toContain('result');
    expect(f.st.ended).toBe(true);
    expect(turn.finished).toBe(true);
    expect(exitInfo).toBeUndefined(); // vẫn còn chạy
    jest.advanceTimersByTime(LINGER_MS);
    expect(f.signals).toEqual(['SIGTERM']);
    expect(exitInfo).toMatchObject({ code: 0, gotResult: true });
  });

  it('dừng sau result: kết thúc thẳng, không ghi interrupt vào stdin đã đóng', async () => {
    const f = fakeProc();
    const turn = new ClaudeTurn('t', { onOp: () => undefined, onExit: () => undefined });
    await turn.start({ spawnStream: () => Promise.resolve(f.proc) } as unknown as HostRuntime, opts, 'hi');
    f.say({ type: 'result', subtype: 'success', is_error: false, usage: {} });
    jest.advanceTimersByTime(3000);
    const n = f.writes.length;
    turn.interrupt();
    expect(f.writes.length).toBe(n);
    expect(f.signals).toEqual(['SIGTERM']);
  });
});
