import { parseLsof, parseSs, localPortOpen } from './forwards.service';
import * as net from 'node:net';

describe('cổng đang nghe (AC-58)', () => {
  it('parse ss -ltnpH, gộp IPv4/IPv6, bỏ 22', () => {
    const out = [
      'LISTEN 0 128 0.0.0.0:22 0.0.0.0:*',
      'LISTEN 0 511 0.0.0.0:3000 0.0.0.0:* users:(("node",pid=12,fd=20))',
      'LISTEN 0 511 [::]:3000 [::]:* users:(("node",pid=12,fd=21))',
      'LISTEN 0 5 127.0.0.1:5432 0.0.0.0:*',
      '',
    ].join('\n');
    expect(parseSs(out)).toEqual([
      { port: 3000, proc: 'node' },
      { port: 5432, proc: '' },
    ]);
  });
  it('parse lsof', () => {
    const out =
      'COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME\nnode 12 dev 20u IPv4 1 0t0 TCP *:3000 (LISTEN)\nvite 13 dev 21u IPv6 2 0t0 TCP [::1]:5173 (LISTEN)\n';
    expect(parseLsof(out)).toEqual([
      { port: 3000, proc: 'node' },
      { port: 5173, proc: 'vite' },
    ]);
  });
});

describe('localPortOpen (S14 kiểm cổng đích — Authority 2026-11-26)', () => {
  it('có tiến trình nghe → true; đóng rồi → false', async () => {
    const srv = net.createServer().listen(0, '127.0.0.1');
    await new Promise((r) => srv.once('listening', r));
    const port = (srv.address() as net.AddressInfo).port;
    expect(await localPortOpen(port)).toBe(true);
    await new Promise((r) => srv.close(r));
    expect(await localPortOpen(port)).toBe(false);
  });
});
