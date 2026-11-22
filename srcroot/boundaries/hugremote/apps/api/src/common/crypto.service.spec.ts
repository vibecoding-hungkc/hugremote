import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadConfig } from '../config/app-config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hr-crypto-'));
  const svc = new CryptoService(loadConfig({ DATA_DIR: dir }));

  it('secret.key 0600 (G-6)', () => {
    expect(fs.statSync(path.join(dir, 'secret.key')).mode & 0o777).toBe(0o600);
  });

  it('AES-256-GCM mã hoá/giải mã, bản mã khác nhau mỗi lần, sửa bản mã thì lỗi', () => {
    const a = svc.encrypt('mật khẩu ssh');
    const b = svc.encrypt('mật khẩu ssh');
    expect(a).not.toBe(b);
    expect(svc.decrypt(a)).toBe('mật khẩu ssh');
    const parts = a.split(':');
    parts[3] = Buffer.from('xx').toString('base64');
    expect(() => svc.decrypt(parts.join(':'))).toThrow();
  });

  it('PBKDF2: đúng/sai mật khẩu', () => {
    const { hash, salt } = svc.hashPassword('matkhau-123456');
    expect(svc.verifyPassword('matkhau-123456', hash, salt)).toBe(true);
    expect(svc.verifyPassword('matkhau-123457', hash, salt)).toBe(false);
  });
});
