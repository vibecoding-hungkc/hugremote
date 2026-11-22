import { Inject, Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { APP_CONFIG } from '../config/app-config';
import type { AppConfig } from '../config/app-config';

const PBKDF2_ITER = 100_000;

/**
 * Khoá gốc 32 byte ở `DATA_DIR/secret.key` (0600, chỉ tiến trình api đọc — G-6). Từ khoá gốc dẫn ra
 * khoá AES-256-GCM cho bí mật lưu DB và khoá ký JWT (khi không đặt `JWT_SECRET`).
 */
@Injectable()
export class CryptoService {
  private readonly master: Buffer;
  readonly jwtSecret: string;

  constructor(@Inject(APP_CONFIG) cfg: AppConfig) {
    fs.mkdirSync(cfg.dataDir, { recursive: true, mode: 0o700 });
    const file = path.join(cfg.dataDir, 'secret.key');
    if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('base64'), { mode: 0o600 });
    fs.chmodSync(file, 0o600);
    this.master = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
    this.jwtSecret = cfg.jwtSecret ?? this.derive('jwt').toString('base64');
  }

  private derive(label: string): Buffer {
    return crypto.createHmac('sha256', this.master).update(`hugremote:${label}`).digest();
  }

  /** AES-256-GCM → `v1:<iv>:<tag>:<ciphertext>` (base64). */
  encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', this.derive('aes'), iv);
    const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
  }

  decrypt(blob: string): string {
    const [v, iv, tag, ct] = blob.split(':');
    if (v !== 'v1') throw new Error('Định dạng bí mật không hỗ trợ');
    const d = crypto.createDecipheriv('aes-256-gcm', this.derive('aes'), Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
  }

  hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): { hash: string; salt: string } {
    const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITER, 64, 'sha512').toString('hex');
    return { hash, salt };
  }

  verifyPassword(password: string, hash: string, salt: string): boolean {
    const got = Buffer.from(this.hashPassword(password, salt).hash, 'hex');
    const want = Buffer.from(hash, 'hex');
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  }

  sha256(s: string): string {
    return crypto.createHash('sha256').update(s).digest('hex');
  }

  randomToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('base64url');
  }

  /** Mật khẩu ngẫu nhiên dễ đọc (bỏ ký tự dễ nhầm). */
  randomPassword(len = 16): string {
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    return Array.from(crypto.randomBytes(len), (b) => alphabet[b % alphabet.length]).join('');
  }
}
