import crypto from 'crypto';
import { authConfig } from './config.js';
import { clearCookie, decodeSigned, encodeSigned, makeCookie, parseCookies } from './cookies.js';
class SessionStore {
    sessions = new Map();
    create(reply, user) {
        const id = crypto.randomBytes(32).toString('base64url');
        this.sessions.set(id, { user, expiresAt: Date.now() + authConfig.sessionTtlMs });
        reply.header('Set-Cookie', makeCookie(authConfig.sessionCookie, encodeSigned(id), Math.floor(authConfig.sessionTtlMs / 1000)));
    }
    getUser(req) {
        if (authConfig.mode === 'none')
            return { provider: 'none' };
        const rawId = decodeSigned(parseCookies(req)[authConfig.sessionCookie]);
        if (!rawId)
            return null;
        const session = this.sessions.get(rawId);
        if (!session)
            return null;
        if (session.expiresAt < Date.now()) {
            this.sessions.delete(rawId);
            return null;
        }
        session.expiresAt = Date.now() + authConfig.sessionTtlMs;
        return session.user;
    }
    destroy(req, reply) {
        const rawId = decodeSigned(parseCookies(req)[authConfig.sessionCookie]);
        if (rawId)
            this.sessions.delete(rawId);
        reply.header('Set-Cookie', clearCookie(authConfig.sessionCookie));
    }
    isAuthenticated(req) {
        return Boolean(this.getUser(req));
    }
}
export const sessionStore = new SessionStore();
