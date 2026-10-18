import crypto from 'crypto';
import { BASE_PATH } from '../config.js';
import { authConfig } from './config.js';
export function parseCookies(req) {
    const header = req.headers.cookie || '';
    const cookies = {};
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1)
            continue;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (!key)
            continue;
        try {
            cookies[key] = decodeURIComponent(value);
        }
        catch (_) {
            cookies[key] = value;
        }
    }
    return cookies;
}
function sign(value) {
    return crypto.createHmac('sha256', authConfig.sessionSecret).update(value).digest('base64url');
}
export function encodeSigned(value) {
    return `${value}.${sign(value)}`;
}
export function decodeSigned(value) {
    if (!value)
        return null;
    const idx = value.lastIndexOf('.');
    if (idx === -1)
        return null;
    const raw = value.slice(0, idx);
    const sig = value.slice(idx + 1);
    const expected = sign(raw);
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length)
        return null;
    try {
        if (!crypto.timingSafeEqual(sigBuf, expBuf))
            return null;
    }
    catch (_) {
        return null;
    }
    return raw;
}
function cookiePath() {
    return BASE_PATH || '/';
}
function secureCookie() {
    return authConfig.appUrl.startsWith('https://');
}
export function makeCookie(name, value, maxAgeSeconds) {
    const parts = [
        `${name}=${encodeURIComponent(value)}`,
        'HttpOnly',
        'SameSite=Lax',
        `Path=${cookiePath()}`,
        `Max-Age=${maxAgeSeconds}`,
    ];
    if (secureCookie())
        parts.push('Secure');
    return parts.join('; ');
}
export function clearCookie(name) {
    const parts = [
        `${name}=`,
        'HttpOnly',
        'SameSite=Lax',
        `Path=${cookiePath()}`,
        'Max-Age=0',
    ];
    if (secureCookie())
        parts.push('Secure');
    return parts.join('; ');
}
