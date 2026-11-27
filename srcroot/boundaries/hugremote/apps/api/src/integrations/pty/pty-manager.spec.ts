import type { PtyHandle } from '../host/host-runtime';
import { PtyManager } from './pty-manager';

/** PTY giả: kill() thoát với mã 0 như node-pty trên Máy này. */
function fakePty() {
  let exit: (c: number | null) => void = () => undefined;
  const pty: PtyHandle = {
    write: () => undefined,
    resize: () => undefined,
    onData: () => undefined,
    onExit: (cb) => void (exit = cb),
    kill: () => exit(0),
  };
  return { pty, exit: (c: number | null) => exit(c) };
}

describe('PtyManager', () => {
  it('HugRemote tự kill → báo null (client tự mở lại); người dùng thoát → giữ mã', () => {
    const got: [string, number | null][] = [];
    const m = new PtyManager((id, code) => void got.push([id, code]));
    const a = fakePty();
    const b = fakePty();
    m.add('a', a.pty);
    m.add('b', b.pty);
    m.kill('a');
    b.exit(0);
    m.killAll();
    expect(got).toEqual([
      ['a', null],
      ['b', 0],
    ]);
  });
});
