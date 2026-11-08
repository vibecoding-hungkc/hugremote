import type { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { authConfig } from './config.js';
import { clearCookie, decodeSigned, encodeSigned, makeCookie, parseCookies } from './cookies.js';
import { twoFactorStore } from './twoFactorStore.js';
import type { AuthUser, SessionRecord } from './types.js';

function isDesktopInternalRequest(req: FastifyRequest): boolean {
  const secret = process.env.HUGREMOTE_DESKTOP_SECRET;
  if (!secret) return false;
  const cookies = parseCookies(req);
  return cookies.hugremote_desktop_session === secret;
}

class SessionStore {
  private sessions = new Map<string, SessionRecord>();

  create(reply: FastifyReply, user: AuthUser) {
    const id = crypto.randomBytes(32).toString('base64url');
    this.sessions.set(id, { user, expiresAt: Date.now() + authConfig.sessionTtlMs });
    reply.header(
      'Set-Cookie',
      makeCookie(authConfig.sessionCookie, encodeSigned(id), Math.floor(authConfig.sessionTtlMs / 1000))
    );
  }

  getUser(req: FastifyRequest): AuthUser | null {
    if (isDesktopInternalRequest(req)) {
      return { provider: 'none', twoFactorVerified: true };
    }

    const rawId = decodeSigned(parseCookies(req)[authConfig.sessionCookie]);
    if (rawId) {
      const session = this.sessions.get(rawId);
      if (session) {
        if (session.expiresAt < Date.now()) {
          this.sessions.delete(rawId);
        } else {
          session.expiresAt = Date.now() + authConfig.sessionTtlMs;
          return session.user;
        }
      }
    }

    if (authConfig.mode === 'none') {
      if (twoFactorStore.isEnabled()) {
        return null;
      }
      return { provider: 'none', twoFactorVerified: true };
    }

    return null;
  }

  destroy(req: FastifyRequest, reply: FastifyReply) {
    const rawId = decodeSigned(parseCookies(req)[authConfig.sessionCookie]);
    if (rawId) this.sessions.delete(rawId);
    reply.header('Set-Cookie', clearCookie(authConfig.sessionCookie));
  }

  isAuthenticated(req: FastifyRequest): boolean {
    const user = this.getUser(req);
    if (!user) return false;
    if (user.mustChangePassword) return false;
    if (twoFactorStore.isEnabled() && !user.twoFactorVerified) return false;
    return true;
  }
}

export const sessionStore = new SessionStore();
