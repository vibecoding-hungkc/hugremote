import path from 'path';
import os from 'os';
import fs from 'fs';
import { authConfig, normalizeMode, withBasePath } from './config.js';
export class OidcStore {
    filePath;
    record;
    constructor() {
        this.filePath = this.resolvePath();
        this.record = this.load();
        this.syncToAuthConfig();
    }
    resolvePath() {
        if (process.env.AUTH_OIDC_FILE)
            return process.env.AUTH_OIDC_FILE;
        const baseDir = process.env.DATA_DIR || path.join(os.homedir(), '.config', 'hugremote');
        try {
            fs.mkdirSync(baseDir, { recursive: true });
        }
        catch { }
        return path.join(baseDir, 'oidc.json');
    }
    load() {
        const defaultRecord = {
            mode: authConfig.mode,
            issuerUrl: authConfig.oidcIssuerUrl || '',
            clientId: authConfig.oidcClientId || '',
            clientSecret: authConfig.oidcClientSecret || '',
            allowedEmails: Array.from(authConfig.oidcAllowedEmails),
            buttonLabel: authConfig.oidcButtonLabel || 'Tiếp tục với Single Sign-On · OIDC',
            updatedAt: new Date().toISOString(),
        };
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
                return {
                    mode: raw.mode ? normalizeMode(raw.mode) : defaultRecord.mode,
                    issuerUrl: typeof raw.issuerUrl === 'string' ? raw.issuerUrl.trim().replace(/\/+$/, '') : defaultRecord.issuerUrl,
                    clientId: typeof raw.clientId === 'string' ? raw.clientId.trim() : defaultRecord.clientId,
                    clientSecret: typeof raw.clientSecret === 'string' ? raw.clientSecret.trim() : defaultRecord.clientSecret,
                    allowedEmails: Array.isArray(raw.allowedEmails)
                        ? raw.allowedEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean)
                        : defaultRecord.allowedEmails,
                    buttonLabel: typeof raw.buttonLabel === 'string' ? raw.buttonLabel.trim() : defaultRecord.buttonLabel,
                    updatedAt: raw.updatedAt || new Date().toISOString(),
                };
            }
        }
        catch { }
        return defaultRecord;
    }
    save() {
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
            fs.writeFileSync(this.filePath, JSON.stringify(this.record, null, 2), { mode: 0o600 });
        }
        catch (err) {
            console.warn('Failed to save oidc.json:', err);
        }
    }
    syncToAuthConfig() {
        if (this.record.mode && this.record.mode !== 'none') {
            authConfig.mode = this.record.mode;
        }
        if (this.record.issuerUrl) {
            authConfig.oidcIssuerUrl = this.record.issuerUrl;
        }
        if (this.record.clientId) {
            authConfig.oidcClientId = this.record.clientId;
        }
        if (this.record.clientSecret) {
            authConfig.oidcClientSecret = this.record.clientSecret;
        }
        if (this.record.allowedEmails) {
            authConfig.oidcAllowedEmails = new Set(this.record.allowedEmails);
        }
        if (this.record.buttonLabel) {
            authConfig.oidcButtonLabel = this.record.buttonLabel;
        }
    }
    reload() {
        this.filePath = this.resolvePath();
        this.record = this.load();
        this.syncToAuthConfig();
    }
    getCallbackUrl() {
        return `${authConfig.appUrl}${withBasePath('/auth/oidc/callback')}`;
    }
    getConfig() {
        return {
            mode: authConfig.mode,
            issuerUrl: this.record.issuerUrl || authConfig.oidcIssuerUrl || '',
            clientId: this.record.clientId || authConfig.oidcClientId || '',
            hasClientSecret: Boolean(this.record.clientSecret || authConfig.oidcClientSecret),
            allowedEmails: (this.record.allowedEmails.length > 0 ? this.record.allowedEmails : Array.from(authConfig.oidcAllowedEmails)).join(', '),
            buttonLabel: this.record.buttonLabel || authConfig.oidcButtonLabel || 'Tiếp tục với Single Sign-On · OIDC',
            callbackUrl: this.getCallbackUrl(),
            configured: Boolean((this.record.issuerUrl || authConfig.oidcIssuerUrl) &&
                (this.record.clientId || authConfig.oidcClientId) &&
                (this.record.clientSecret || authConfig.oidcClientSecret)),
            updatedAt: this.record.updatedAt,
        };
    }
    async discover(issuerUrl) {
        const cleanUrl = (issuerUrl || '').trim().replace(/\/+$/, '');
        if (!cleanUrl) {
            return { valid: false, error: 'Issuer URL không được để trống' };
        }
        const discoveryEndpoint = cleanUrl.endsWith('/.well-known/openid-configuration')
            ? cleanUrl
            : `${cleanUrl}/.well-known/openid-configuration`;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 6000);
            const res = await fetch(discoveryEndpoint, {
                signal: controller.signal,
                headers: { Accept: 'application/json' },
            });
            clearTimeout(timeout);
            if (!res.ok) {
                return {
                    valid: false,
                    error: `IdP phản hồi mã lỗi HTTP ${res.status} tại ${discoveryEndpoint}`,
                };
            }
            const doc = (await res.json());
            if (!doc || typeof doc !== 'object') {
                return { valid: false, error: 'Phản hồi từ Discovery Endpoint không phải là JSON hợp lệ' };
            }
            const authEndpoint = doc.authorization_endpoint;
            const tokenEndpoint = doc.token_endpoint;
            if (!authEndpoint || !tokenEndpoint) {
                return {
                    valid: false,
                    error: 'Thiếu authorization_endpoint hoặc token_endpoint trong OpenID configuration',
                };
            }
            return {
                valid: true,
                issuer: doc.issuer || cleanUrl,
                authorizationEndpoint: authEndpoint,
                tokenEndpoint: tokenEndpoint,
                userinfoEndpoint: doc.userinfo_endpoint,
                endSessionEndpoint: doc.end_session_endpoint,
            };
        }
        catch (err) {
            const msg = err.name === 'AbortError'
                ? 'Kết nối tới IdP quá thời gian chờ (Timeout)'
                : (err.message || 'Không thể kết nối tới IdP');
            return { valid: false, error: msg };
        }
    }
    saveConfig(payload) {
        const nextMode = payload.mode ? normalizeMode(payload.mode) : this.record.mode;
        const nextIssuer = payload.issuerUrl !== undefined ? payload.issuerUrl.trim().replace(/\/+$/, '') : this.record.issuerUrl;
        const nextClientId = payload.clientId !== undefined ? payload.clientId.trim() : this.record.clientId;
        const nextSecret = payload.clientSecret !== undefined && payload.clientSecret.trim() !== ''
            ? payload.clientSecret.trim()
            : this.record.clientSecret;
        let emails = this.record.allowedEmails;
        if (typeof payload.allowedEmails === 'string') {
            emails = payload.allowedEmails
                .split(',')
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);
        }
        else if (Array.isArray(payload.allowedEmails)) {
            emails = payload.allowedEmails
                .map((s) => String(s).trim().toLowerCase())
                .filter(Boolean);
        }
        const nextLabel = payload.buttonLabel !== undefined
            ? payload.buttonLabel.trim() || 'Tiếp tục với Single Sign-On · OIDC'
            : this.record.buttonLabel;
        if (nextMode === 'oidc' && (!nextIssuer || !nextClientId || !nextSecret)) {
            throw new Error('Chế độ oidc bắt buộc phải có đầy đủ Issuer URL, Client ID và Client Secret');
        }
        this.record = {
            mode: nextMode,
            issuerUrl: nextIssuer,
            clientId: nextClientId,
            clientSecret: nextSecret,
            allowedEmails: emails,
            buttonLabel: nextLabel,
            updatedAt: new Date().toISOString(),
        };
        this.save();
        this.syncToAuthConfig();
        return {
            success: true,
            config: this.getConfig(),
        };
    }
    getRecord() {
        return { ...this.record };
    }
}
export const oidcStore = new OidcStore();
