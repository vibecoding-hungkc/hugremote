import crypto from 'crypto';
import { BASE_PATH } from '../config.js';
import type { AuthMode } from './types.js';

export function normalizeMode(value?: string): AuthMode {
  const raw = (value || 'none').toLowerCase().trim();
  if (raw === 'password') return 'password';
  if (raw === 'google') return 'google';
  if (raw === 'oidc') return 'oidc';
  if (raw === 'both' || raw === 'hybrid') return 'both';
  return 'none';
}

const ephemeralSecret = crypto.randomBytes(32).toString('hex');

export const authConfig = {
  mode: normalizeMode(process.env.AUTH_MODE),
  appUrl: (process.env.APP_URL || `http://localhost:${process.env.PORT || '8099'}`).replace(/\/+$/, ''),
  sessionSecret: process.env.SESSION_SECRET || ephemeralSecret,
  maxAttempts: Math.max(1, parseInt(process.env.AUTH_MAX_ATTEMPTS || '5', 10)),
  lockMinutes: Math.max(1, parseInt(process.env.AUTH_LOCK_MINUTES || '15', 10)),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleAllowedEmails: new Set(
    (process.env.GOOGLE_ALLOWED_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  ),
  oidcIssuerUrl: (process.env.OIDC_ISSUER_URL || '').trim().replace(/\/+$/, ''),
  oidcClientId: (process.env.OIDC_CLIENT_ID || '').trim(),
  oidcClientSecret: (process.env.OIDC_CLIENT_SECRET || '').trim(),
  oidcAllowedEmails: new Set(
    (process.env.OIDC_ALLOWED_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  ),
  oidcButtonLabel: (process.env.OIDC_BUTTON_LABEL || 'Tiếp tục với Single Sign-On · OIDC').trim(),
  sessionCookie: 'hugremote_session',
  oauthStateCookie: 'hugremote_oauth_state',
  oidcPkceCookie: 'hugremote_oidc_pkce',
  sessionTtlMs: 1000 * 60 * 60 * 24 * 14,
};

export function validateAuthConfig() {
  // Mode password uses default '123456' on first run and enforces change-password
  if (authConfig.mode === 'google') {
    const missing = [
      !authConfig.googleClientId && 'GOOGLE_CLIENT_ID',
      !authConfig.googleClientSecret && 'GOOGLE_CLIENT_SECRET',
      authConfig.googleAllowedEmails.size === 0 && 'GOOGLE_ALLOWED_EMAILS',
    ].filter(Boolean);
    if (missing.length) {
      throw new Error(`AUTH_MODE=google requires ${missing.join(', ')}`);
    }
  }

  if (authConfig.mode === 'oidc') {
    const missing = [
      !authConfig.oidcIssuerUrl && 'OIDC_ISSUER_URL',
      !authConfig.oidcClientId && 'OIDC_CLIENT_ID',
      !authConfig.oidcClientSecret && 'OIDC_CLIENT_SECRET',
    ].filter(Boolean);
    if (missing.length) {
      throw new Error(`AUTH_MODE=oidc requires ${missing.join(', ')}`);
    }
  }
}

export function withBasePath(pathname: string): string {
  if (!BASE_PATH) return pathname;
  if (pathname === '/') return BASE_PATH;
  return `${BASE_PATH}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

export function stripBasePath(pathname: string): string {
  return BASE_PATH && pathname.startsWith(BASE_PATH)
    ? pathname.slice(BASE_PATH.length) || '/'
    : pathname;
}
