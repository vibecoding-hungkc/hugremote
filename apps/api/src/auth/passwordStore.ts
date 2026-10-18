import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export interface StoredPasswordRecord {
  salt: string;
  hash: string;
  iterations: number;
  algorithm: string;
  isDefault: boolean;
  updatedAt: string;
}

const DEFAULT_PASSWORD = '123456';
const ITERATIONS = 100000;
const KEY_LEN = 64;
const DIGEST = 'sha512';

class PasswordStore {
  private filePath: string;
  private currentRecord: StoredPasswordRecord;

  constructor() {
    this.filePath = this.resolvePath();
    this.currentRecord = this.loadOrCreate();
  }

  private resolvePath(): string {
    if (process.env.AUTH_PASSWORD_FILE) return process.env.AUTH_PASSWORD_FILE;
    const baseDir = process.env.DATA_DIR || path.join(os.homedir(), '.config', 'hugremote');
    try {
      fs.mkdirSync(baseDir, { recursive: true });
    } catch (_) {}
    return path.join(baseDir, 'auth.json');
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  }

  private loadOrCreate(): StoredPasswordRecord {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.salt && parsed.hash) {
          return {
            salt: parsed.salt,
            hash: parsed.hash,
            iterations: parsed.iterations || ITERATIONS,
            algorithm: parsed.algorithm || 'pbkdf2-sha512',
            isDefault: Boolean(parsed.isDefault),
            updatedAt: parsed.updatedAt || new Date().toISOString(),
          };
        }
      }
    } catch (err) {
      console.warn('Could not read auth.json, initializing default password:', err);
    }

    // Default record with '123456' or env override if provided
    const envPass = process.env.AUTH_PASSWORD;
    const initialPass = envPass || DEFAULT_PASSWORD;
    const defaultSalt = crypto.randomBytes(32).toString('hex');
    const defaultHash = this.hashPassword(initialPass, defaultSalt);
    const defaultRecord: StoredPasswordRecord = {
      salt: defaultSalt,
      hash: defaultHash,
      iterations: ITERATIONS,
      algorithm: 'pbkdf2-sha512',
      isDefault: !envPass || initialPass === DEFAULT_PASSWORD,
      updatedAt: new Date().toISOString(),
    };

    try {
      fs.writeFileSync(this.filePath, JSON.stringify(defaultRecord, null, 2), { mode: 0o600 });
    } catch (_) {}

    return defaultRecord;
  }

  public isDefault(): boolean {
    return this.currentRecord.isDefault;
  }

  public verify(password: string): boolean {
    try {
      const computedHash = crypto.pbkdf2Sync(
        password,
        this.currentRecord.salt,
        this.currentRecord.iterations,
        KEY_LEN,
        DIGEST
      ).toString('hex');

      const a = Buffer.from(computedHash, 'hex');
      const b = Buffer.from(this.currentRecord.hash, 'hex');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch (_) {
      return false;
    }
  }

  public changePassword(newPassword: string): void {
    if (newPassword.length < 6) {
      throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự');
    }
    if (newPassword === DEFAULT_PASSWORD) {
      throw new Error('Không được dùng lại mật khẩu mặc định 123456');
    }

    const salt = crypto.randomBytes(32).toString('hex');
    const hash = this.hashPassword(newPassword, salt);
    this.currentRecord = {
      salt,
      hash,
      iterations: ITERATIONS,
      algorithm: 'pbkdf2-sha512',
      isDefault: false,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(this.filePath, JSON.stringify(this.currentRecord, null, 2), { mode: 0o600 });
  }

  public reload(): void {
    this.currentRecord = this.loadOrCreate();
  }
}

export const passwordStore = new PasswordStore();
