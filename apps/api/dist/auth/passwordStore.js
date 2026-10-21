import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
const DEFAULT_PASSWORD = '123456';
const ITERATIONS = 100000;
const KEY_LEN = 64;
const DIGEST = 'sha512';
class PasswordStore {
    filePath;
    currentRecord;
    constructor() {
        this.filePath = this.resolvePath();
        this.currentRecord = this.loadOrCreate();
    }
    resolvePath() {
        if (process.env.AUTH_PASSWORD_FILE)
            return process.env.AUTH_PASSWORD_FILE;
        const baseDir = process.env.DATA_DIR || path.join(os.homedir(), '.config', 'hugremote');
        try {
            fs.mkdirSync(baseDir, { recursive: true });
        }
        catch (_) { }
        return path.join(baseDir, 'auth.json');
    }
    hashPassword(password, salt) {
        return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
    }
    verifyHash(password, salt, iterations, targetHex) {
        try {
            const computed = crypto.pbkdf2Sync(password, salt, iterations, KEY_LEN, DIGEST).toString('hex');
            const a = Buffer.from(computed, 'hex');
            const b = Buffer.from(targetHex, 'hex');
            if (a.length !== b.length)
                return false;
            return crypto.timingSafeEqual(a, b);
        }
        catch (_) {
            return false;
        }
    }
    loadOrCreate() {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath, 'utf8');
                const parsed = JSON.parse(raw);
                if (parsed.salt && parsed.hash) {
                    const rec = {
                        salt: parsed.salt,
                        hash: parsed.hash,
                        iterations: parsed.iterations || ITERATIONS,
                        algorithm: parsed.algorithm || 'pbkdf2-sha512',
                        isDefault: Boolean(parsed.isDefault),
                        updatedAt: parsed.updatedAt || new Date().toISOString(),
                    };
                    // If CLI passed --password or process.env.AUTH_PASSWORD was set, and record is still default:
                    const envPass = process.env.AUTH_PASSWORD;
                    if (envPass && rec.isDefault && !this.verifyHash(envPass, rec.salt, rec.iterations, rec.hash)) {
                        const newSalt = crypto.randomBytes(32).toString('hex');
                        const newHash = this.hashPassword(envPass, newSalt);
                        rec.salt = newSalt;
                        rec.hash = newHash;
                        rec.isDefault = (envPass === DEFAULT_PASSWORD);
                        rec.updatedAt = new Date().toISOString();
                        try {
                            fs.writeFileSync(this.filePath, JSON.stringify(rec, null, 2), { mode: 0o600 });
                        }
                        catch (_) { }
                    }
                    return rec;
                }
            }
        }
        catch (err) {
            console.warn('Could not read auth.json, initializing default password:', err);
        }
        // Default record with '123456' or env override if provided
        const envPass = process.env.AUTH_PASSWORD;
        const initialPass = envPass || DEFAULT_PASSWORD;
        const defaultSalt = crypto.randomBytes(32).toString('hex');
        const defaultHash = this.hashPassword(initialPass, defaultSalt);
        const defaultRecord = {
            salt: defaultSalt,
            hash: defaultHash,
            iterations: ITERATIONS,
            algorithm: 'pbkdf2-sha512',
            isDefault: !envPass || initialPass === DEFAULT_PASSWORD,
            updatedAt: new Date().toISOString(),
        };
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(defaultRecord, null, 2), { mode: 0o600 });
        }
        catch (_) { }
        return defaultRecord;
    }
    isDefault() {
        return this.currentRecord.isDefault;
    }
    verify(password) {
        return this.verifyHash(password, this.currentRecord.salt, this.currentRecord.iterations, this.currentRecord.hash);
    }
    changePassword(newPassword) {
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
    reload() {
        this.currentRecord = this.loadOrCreate();
    }
}
export const passwordStore = new PasswordStore();
