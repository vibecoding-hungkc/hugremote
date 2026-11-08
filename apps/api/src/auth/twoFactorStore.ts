import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { generateQrSvg } from './qrSvg.js';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const RECOVERY_CODE_COUNT = 8;

export interface StoredTwoFactorConfig {
  enabled: boolean;
  secret: string;
  recoveryCodeHashes: string[];
  pendingSecret?: string;
  pendingRecoveryCodes?: string[];
  updatedAt: string;
}

export function generateBase32Secret(byteLength = 20): string {
  const bytes = crypto.randomBytes(byteLength);
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output.slice(0, 32);
}

export function decodeBase32(secret: string): Buffer {
  const cleaned = (secret || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function generateHotp(secret: string, counter: number): string {
  const key = decodeBase32(secret);
  const buf = Buffer.alloc(8);
  let c = Math.floor(counter);
  for (let i = 7; i >= 0; i--) {
    buf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = binary % 10 ** TOTP_DIGITS;
  return String(otp).padStart(TOTP_DIGITS, '0');
}

export function generateTotpToken(secret: string, timestampMs = Date.now()): string {
  const counter = Math.floor(timestampMs / 1000 / TOTP_STEP_SECONDS);
  return generateHotp(secret, counter);
}

export function verifyTotpToken(secret: string, rawCode: string, timestampMs = Date.now(), windowSteps = 1): boolean {
  const code = (rawCode || '').replace(/\s+/g, '').trim();
  if (!/^\d{6}$/.test(code) || !secret) return false;
  const baseCounter = Math.floor(timestampMs / 1000 / TOTP_STEP_SECONDS);
  for (let delta = -windowSteps; delta <= windowSteps; delta++) {
    const candidate = generateHotp(secret, baseCounter + delta);
    const a = Buffer.from(code, 'utf8');
    const b = Buffer.from(candidate, 'utf8');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }
  return false;
}

function normalizeRecoveryCode(code: string): string {
  return (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(`hugremote-2fa:${normalizeRecoveryCode(code)}`).digest('hex');
}

function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(8);
    let p1 = '';
    let p2 = '';
    for (let j = 0; j < 4; j++) p1 += alphabet[bytes[j] % alphabet.length];
    for (let j = 4; j < 8; j++) p2 += alphabet[bytes[j] % alphabet.length];
    codes.push(`${p1}-${p2}`);
  }
  return codes;
}

class TwoFactorStore {
  private filePath: string;
  private record: StoredTwoFactorConfig;

  constructor() {
    this.filePath = this.resolvePath();
    this.record = this.load();
  }

  private resolvePath(): string {
    if (process.env.AUTH_2FA_FILE) return process.env.AUTH_2FA_FILE;
    const baseDir = process.env.DATA_DIR || path.join(os.homedir(), '.config', 'hugremote');
    try {
      fs.mkdirSync(baseDir, { recursive: true });
    } catch {}
    return path.join(baseDir, 'two_factor.json');
  }

  private load(): StoredTwoFactorConfig {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        return {
          enabled: Boolean(raw.enabled && raw.secret),
          secret: typeof raw.secret === 'string' ? raw.secret : '',
          recoveryCodeHashes: Array.isArray(raw.recoveryCodeHashes) ? raw.recoveryCodeHashes : [],
          pendingSecret: typeof raw.pendingSecret === 'string' ? raw.pendingSecret : undefined,
          pendingRecoveryCodes: Array.isArray(raw.pendingRecoveryCodes) ? raw.pendingRecoveryCodes : undefined,
          updatedAt: raw.updatedAt || new Date().toISOString(),
        };
      }
    } catch {}
    return {
      enabled: false,
      secret: '',
      recoveryCodeHashes: [],
      updatedAt: new Date().toISOString(),
    };
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      fs.writeFileSync(this.filePath, JSON.stringify(this.record, null, 2), { mode: 0o600 });
    } catch (err) {
      console.warn('Failed to save two_factor.json:', err);
    }
  }

  public reload(): void {
    this.filePath = this.resolvePath();
    this.record = this.load();
  }

  public isEnabled(): boolean {
    return Boolean(this.record.enabled && this.record.secret);
  }

  public getStatus() {
    return {
      enabled: this.isEnabled(),
      remainingRecoveryCodes: this.record.recoveryCodeHashes.length,
      updatedAt: this.record.updatedAt,
    };
  }

  public beginSetup(accountLabel = 'HugRemote Web'): {
    secret: string;
    otpauthUrl: string;
    qrSvg: string;
    recoveryCodes: string[];
  } {
    const secret = generateBase32Secret();
    const recoveryCodes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
    this.record.pendingSecret = secret;
    this.record.pendingRecoveryCodes = recoveryCodes;
    this.record.updatedAt = new Date().toISOString();
    this.save();

    const issuer = 'HugRemote';
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(
      accountLabel
    )}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    const qrSvg = generateQrSvg(otpauthUrl);

    return {
      secret,
      otpauthUrl,
      qrSvg,
      recoveryCodes,
    };
  }

  public confirmEnable(code: string): { ok: boolean; remainingRecoveryCodes: number } {
    const pendingSecret = this.record.pendingSecret;
    if (!pendingSecret) {
      return { ok: false, remainingRecoveryCodes: 0 };
    }
    if (!verifyTotpToken(pendingSecret, code)) {
      return { ok: false, remainingRecoveryCodes: 0 };
    }
    const recoveryCodes = this.record.pendingRecoveryCodes || generateRecoveryCodes(RECOVERY_CODE_COUNT);
    this.record.enabled = true;
    this.record.secret = pendingSecret;
    this.record.recoveryCodeHashes = recoveryCodes.map(hashRecoveryCode);
    delete this.record.pendingSecret;
    delete this.record.pendingRecoveryCodes;
    this.record.updatedAt = new Date().toISOString();
    this.save();
    return {
      ok: true,
      remainingRecoveryCodes: this.record.recoveryCodeHashes.length,
    };
  }

  public verifyCodeOrRecovery(rawInput: string): { ok: boolean; usedRecoveryCode: boolean } {
    if (!this.isEnabled()) {
      return { ok: true, usedRecoveryCode: false };
    }
    const trimmed = (rawInput || '').trim();
    if (!trimmed) {
      return { ok: false, usedRecoveryCode: false };
    }

    if (verifyTotpToken(this.record.secret, trimmed)) {
      return { ok: true, usedRecoveryCode: false };
    }

    const normalized = normalizeRecoveryCode(trimmed);
    if (normalized.length >= 6) {
      const targetHash = hashRecoveryCode(normalized);
      const idx = this.record.recoveryCodeHashes.findIndex((h) => h === targetHash);
      if (idx !== -1) {
        this.record.recoveryCodeHashes.splice(idx, 1);
        this.record.updatedAt = new Date().toISOString();
        this.save();
        return { ok: true, usedRecoveryCode: true };
      }
    }

    return { ok: false, usedRecoveryCode: false };
  }

  public disable(rawCode: string): boolean {
    if (!this.isEnabled()) return true;
    const check = this.verifyCodeOrRecovery(rawCode);
    if (!check.ok) return false;
    this.record = {
      enabled: false,
      secret: '',
      recoveryCodeHashes: [],
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return true;
  }

  public regenerateRecoveryCodes(rawCode: string): string[] | null {
    if (!this.isEnabled()) return null;
    const check = this.verifyCodeOrRecovery(rawCode);
    if (!check.ok) return null;
    const codes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
    this.record.recoveryCodeHashes = codes.map(hashRecoveryCode);
    this.record.updatedAt = new Date().toISOString();
    this.save();
    return codes;
  }
}

export const twoFactorStore = new TwoFactorStore();
