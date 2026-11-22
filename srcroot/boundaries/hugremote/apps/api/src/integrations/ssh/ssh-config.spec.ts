import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseSshConfig, removeHostBlock, SshConfigChangedError, writeHostBlock } from './ssh-config';

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hr-ssh-'));
}

describe('ssh config', () => {
  it('đọc Include đệ quy, wildcard, giá trị đầu thắng, bỏ qua vòng lặp', () => {
    const d = tmp();
    fs.mkdirSync(path.join(d, 'conf.d'));
    fs.writeFileSync(
      path.join(d, 'config'),
      `# chú thích\nInclude ${d}/conf.d/*.conf\nHost demo-sshd\n  HostName 10.0.0.5\n  Port 2222\nHost *\n  User dev\n  Port 22\nInclude ${d}/config\n`,
    );
    fs.writeFileSync(
      path.join(d, 'conf.d', 'a.conf'),
      'Host demo-jump\n  HostName jump.local\nHost demo-behind\n  HostName 172.18.0.5\n  ProxyJump demo-jump\n',
    );
    const r = parseSshConfig(path.join(d, 'config'));
    const by = Object.fromEntries(r.hosts.map((h) => [h.alias, h]));
    expect(Object.keys(by).sort()).toEqual(['demo-behind', 'demo-jump', 'demo-sshd']);
    expect(by['demo-sshd']).toMatchObject({ hostName: '10.0.0.5', port: 2222, user: 'dev' });
    expect(by['demo-behind']).toMatchObject({ proxyJump: 'demo-jump', file: path.join(d, 'conf.d', 'a.conf') });
    expect(r.warnings.some((w) => w.includes('vòng lặp'))).toBe(true);
  });

  it('ghi/sửa/xoá block giữ nguyên comment và block khác; từ chối giá trị có xuống dòng', () => {
    const d = tmp();
    const f = path.join(d, 'config');
    fs.writeFileSync(f, '# giữ dòng này\nHost a\n  HostName a.local\n\nHost b\n  HostName b.local\n');
    writeHostBlock(f, { alias: 'c', hostName: 'c.local', user: 'dev', port: 2200 });
    writeHostBlock(f, { alias: 'a', hostName: 'a2.local' });
    let text = fs.readFileSync(f, 'utf8');
    expect(text).toContain('# giữ dòng này');
    expect(text).toContain('HostName a2.local');
    expect(text).toContain('HostName b.local');
    expect(text).toContain('Port 2200');
    removeHostBlock(f, 'b');
    text = fs.readFileSync(f, 'utf8');
    expect(text).not.toContain('b.local');
    expect(() => writeHostBlock(f, { alias: 'x', hostName: 'evil\n  ProxyCommand sh' })).toThrow();
  });

  it('mtime đổi giữa chừng → SshConfigChangedError', () => {
    const d = tmp();
    const f = path.join(d, 'config');
    fs.writeFileSync(f, 'Host a\n  HostName a\n');
    const m = fs.statSync(f).mtimeMs;
    expect(() => writeHostBlock(f, { alias: 'b', hostName: 'b' }, m - 1000)).toThrow(SshConfigChangedError);
  });
});
