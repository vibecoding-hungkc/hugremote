import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { BASE_PATH } from './config.js';

export type AuthMode = 'none' | 'password' | 'google';

export interface AuthUser {
  provider: 'none' | 'password' | 'google';
  email?: string;
  name?: string;
  avatar?: string;
}

interface SessionRecord {
  user: AuthUser;
  expiresAt: number;
}

interface AttemptRecord {
  failedCount: number;
  lockedUntil: number;
}

const SESSION_COOKIE = 'hugremote_session';
const OAUTH_STATE_COOKIE = 'hugremote_oauth_state';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const sessions = new Map<string, SessionRecord>();
const passwordAttempts = new Map<string, AttemptRecord>();
const ephemeralSecret = crypto.randomBytes(32).toString('hex');

function normalizeMode(value?: string): AuthMode {
  const raw = (value || 'none').toLowerCase().trim();
  if (raw === 'password') return 'password';
  if (raw === 'google') return 'google';
  return 'none';
}

export const AUTH_MODE: AuthMode = normalizeMode(process.env.AUTH_MODE);
export const APP_URL = (process.env.APP_URL || `http://localhost:${process.env.PORT || '8099'}`).replace(/\/+$/, '');
export const SESSION_SECRET = process.env.SESSION_SECRET || ephemeralSecret;
export const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';
export const AUTH_MAX_ATTEMPTS = Math.max(1, parseInt(process.env.AUTH_MAX_ATTEMPTS || '5', 10));
export const AUTH_LOCK_MINUTES = Math.max(1, parseInt(process.env.AUTH_LOCK_MINUTES || '15', 10));
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
export const GOOGLE_ALLOWED_EMAILS = new Set(
  (process.env.GOOGLE_ALLOWED_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

if (AUTH_MODE === 'password' && !AUTH_PASSWORD) {
  throw new Error('AUTH_MODE=password requires AUTH_PASSWORD');
}

if (AUTH_MODE === 'google') {
  const missing = [
    !GOOGLE_CLIENT_ID && 'GOOGLE_CLIENT_ID',
    !GOOGLE_CLIENT_SECRET && 'GOOGLE_CLIENT_SECRET',
    GOOGLE_ALLOWED_EMAILS.size === 0 && 'GOOGLE_ALLOWED_EMAILS',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`AUTH_MODE=google requires ${missing.join(', ')}`);
  }
}

function basePath(pathname: string): string {
  if (!BASE_PATH) return pathname;
  if (pathname === '/') return BASE_PATH;
  return `${BASE_PATH}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

function parseCookies(req: FastifyRequest): Record<string, string> {
  const header = req.headers.cookie || '';
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch (_) {
      cookies[key] = value;
    }
  }
  return cookies;
}

function sign(value: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

function encodeSigned(value: string): string {
  return `${value}.${sign(value)}`;
}

function decodeSigned(value: string | undefined): string | null {
  if (!value) return null;
  const idx = value.lastIndexOf('.');
  if (idx === -1) return null;
  const raw = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  const expected = sign(raw);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch (_) {
    return null;
  }
  return raw;
}

function cookiePath(): string {
  return BASE_PATH || '/';
}

function secureCookie(): boolean {
  return APP_URL.startsWith('https://');
}

function makeCookie(name: string, value: string, maxAgeSeconds: number): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'SameSite=Lax',
    `Path=${cookiePath()}`,
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secureCookie()) parts.push('Secure');
  return parts.join('; ');
}

function clearCookie(name: string): string {
  const parts = [
    `${name}=`,
    'HttpOnly',
    'SameSite=Lax',
    `Path=${cookiePath()}`,
    'Max-Age=0',
  ];
  if (secureCookie()) parts.push('Secure');
  return parts.join('; ');
}

function getClientIp(req: FastifyRequest): string {
  if ((process.env.TRUST_PROXY || '').toLowerCase() === 'true') {
    const xff = req.headers['x-forwarded-for'];
    const first = Array.isArray(xff) ? xff[0] : xff;
    if (first) return first.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function createSession(reply: FastifyReply, user: AuthUser) {
  const id = crypto.randomBytes(32).toString('base64url');
  sessions.set(id, { user, expiresAt: Date.now() + SESSION_TTL_MS });
  reply.header('Set-Cookie', makeCookie(SESSION_COOKIE, encodeSigned(id), Math.floor(SESSION_TTL_MS / 1000)));
}

function getSessionUser(req: FastifyRequest): AuthUser | null {
  if (AUTH_MODE === 'none') return { provider: 'none' };
  const rawId = decodeSigned(parseCookies(req)[SESSION_COOKIE]);
  if (!rawId) return null;
  const session = sessions.get(rawId);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(rawId);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session.user;
}

function destroySession(req: FastifyRequest, reply: FastifyReply) {
  const rawId = decodeSigned(parseCookies(req)[SESSION_COOKIE]);
  if (rawId) sessions.delete(rawId);
  reply.header('Set-Cookie', clearCookie(SESSION_COOKIE));
}

export function isAuthenticated(req: FastifyRequest): boolean {
  return Boolean(getSessionUser(req));
}

export function requireAuthForWs(req: FastifyRequest): boolean {
  return AUTH_MODE === 'none' || isAuthenticated(req);
}

function isPublicPath(pathname: string): boolean {
  const p = BASE_PATH && pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || '/' : pathname;
  return (
    p === '/api/auth/me' ||
    p === '/api/auth/password' ||
    p === '/api/auth/logout' ||
    p === '/login' ||
    p === '/auth/google' ||
    p === '/auth/google/callback' ||
    p.startsWith('/assets/') ||
    p === '/favicon.ico' ||
    p === '/manifest.webmanifest' ||
    p.endsWith('.png') ||
    p.endsWith('.svg') ||
    p.endsWith('.ico')
  );
}

function wantsHtml(req: FastifyRequest): boolean {
  const accept = String(req.headers.accept || '');
  return accept.includes('text/html') || accept.includes('*/*');
}

export async function authGuard(req: FastifyRequest, reply: FastifyReply) {
  if (AUTH_MODE === 'none') return;
  const pathname = new URL(req.url, 'http://local').pathname;
  if (isPublicPath(pathname)) return;
  if (isAuthenticated(req)) return;
  if (wantsHtml(req) && !pathname.includes('/api/') && !pathname.includes('/ws/')) {
    return reply.redirect(basePath('/login'));
  }
  return reply.status(401).send({ error: 'unauthorized', mode: AUTH_MODE });
}

function authStatus(req: FastifyRequest) {
  const user = getSessionUser(req);
  return {
    mode: AUTH_MODE,
    authenticated: AUTH_MODE === 'none' || Boolean(user),
    user,
    appUrl: APP_URL,
    basePath: BASE_PATH,
  };
}

export async function authRoutes(fastify: FastifyInstance) {
  fastify.get('/api/auth/me', async (req) => authStatus(req));

  fastify.post<{ Body: { password?: string } }>('/api/auth/password', async (req, reply) => {
    if (AUTH_MODE !== 'password') {
      return reply.status(400).send({ success: false, error: 'password_auth_disabled' });
    }

    const ip = getClientIp(req);
    const now = Date.now();
    const state = passwordAttempts.get(ip) || { failedCount: 0, lockedUntil: 0 };
    if (state.lockedUntil > now) {
      return reply.status(429).send({
        success: false,
        error: 'locked',
        retryAfterSeconds: Math.ceil((state.lockedUntil - now) / 1000),
      });
    }

    const password = req.body?.password || '';
    const ok =
      password.length === AUTH_PASSWORD.length &&
      crypto.timingSafeEqual(Buffer.from(password), Buffer.from(AUTH_PASSWORD));

    if (ok) {
      passwordAttempts.delete(ip);
      createSession(reply, { provider: 'password' });
      return { success: true };
    }

    state.failedCount += 1;
    if (state.failedCount >= AUTH_MAX_ATTEMPTS) {
      state.failedCount = 0;
      state.lockedUntil = now + AUTH_LOCK_MINUTES * 60 * 1000;
      passwordAttempts.set(ip, state);
      return reply.status(429).send({
        success: false,
        error: 'locked',
        retryAfterSeconds: AUTH_LOCK_MINUTES * 60,
      });
    }

    passwordAttempts.set(ip, state);
    return reply.status(401).send({
      success: false,
      error: 'wrong_password',
      attemptsLeft: AUTH_MAX_ATTEMPTS - state.failedCount,
    });
  });

  fastify.post('/api/auth/logout', async (req, reply) => {
    destroySession(req, reply);
    return { success: true };
  });

  fastify.get('/auth/google', async (_req, reply) => {
    if (AUTH_MODE !== 'google') return reply.status(400).send('Google auth is disabled');
    const state = crypto.randomBytes(18).toString('base64url');
    reply.header('Set-Cookie', makeCookie(OAUTH_STATE_COOKIE, encodeSigned(state), 600));
    const redirectUri = `${APP_URL}${basePath('/auth/google/callback')}`;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');
    return reply.redirect(url.toString());
  });

  fastify.get<{ Querystring: { code?: string; state?: string; error?: string } }>('/auth/google/callback', async (req, reply) => {
    if (AUTH_MODE !== 'google') return reply.status(400).send('Google auth is disabled');
    if (req.query.error) return reply.redirect(`${basePath('/login')}?error=google_denied`);
    const expectedState = decodeSigned(parseCookies(req)[OAUTH_STATE_COOKIE]);
    if (!req.query.state || !expectedState || req.query.state !== expectedState) {
      return reply.redirect(`${basePath('/login')}?error=invalid_state`);
    }
    if (!req.query.code) return reply.redirect(`${basePath('/login')}?error=missing_code`);

    const redirectUri = `${APP_URL}${basePath('/auth/google/callback')}`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) return reply.redirect(`${basePath('/login')}?error=token_failed`);
    const tokens = (await tokenRes.json()) as { access_token?: string; id_token?: string };
    if (!tokens.access_token) return reply.redirect(`${basePath('/login')}?error=token_missing`);

    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) return reply.redirect(`${basePath('/login')}?error=userinfo_failed`);
    const profile = (await userRes.json()) as { email?: string; name?: string; picture?: string };
    const email = (profile.email || '').toLowerCase();
    if (!email || !GOOGLE_ALLOWED_EMAILS.has(email)) {
      return reply.redirect(`${basePath('/login')}?error=email_not_allowed`);
    }

    createSession(reply, { provider: 'google', email, name: profile.name, avatar: profile.picture });
    reply.header('Set-Cookie', clearCookie(OAUTH_STATE_COOKIE));
    return reply.redirect(basePath('/'));
  });
}
