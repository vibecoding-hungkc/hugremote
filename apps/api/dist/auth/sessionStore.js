import crypto from 'crypto';
import { authConfig } from './config.js';
import { clearCookie, decodeSigned, encodeSigned, makeCookie, parseCookies } from './cookies.js';
import { twoFactorStore } from './twoFactorStore.js';
function isDesktopInternalRequest(req) {
    const secret = process.env.HUGREMOTE_DESKTOP_SECRET;
    if (!secret)
        return false;
    const cookies = parseCookies(req);
    return cookies.hugremote_desktop_session === secret;
}
class SessionStore {
    sessions = new Map();
    create(reply, user) {
        const id = crypto.randomBytes(32).toString('base64url');
        this.sessions.set(id, { user, expiresAt: Date.now() + authConfig.sessionTtlMs });
        reply.header('Set-Cookie', makeCookie(authConfig.sessionCookie, encodeSigned(id), Math.floor(authConfig.sessionTtlMs / 1000)));
    }
    getUser(req) {
        if (isDesktopInternalRequest(req)) {
            return { provider: 'none', twoFactorVerified: true };
        }
        const rawId = decodeSigned(parseCookies(req)[authConfig.sessionCookie]);
        if (rawId) {
            const session = this.sessions.get(rawId);
            if (session) {
                if (session.expiresAt < Date.now()) {
                    this.sessions.delete(rawId);
                }
                else {
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
    destroy(req, reply) {
        const rawId = decodeSigned(parseCookies(req)[authConfig.sessionCookie]);
        if (rawId)
            this.sessions.delete(rawId);
        reply.header('Set-Cookie', clearCookie(authConfig.sessionCookie));
    }
    isAuthenticated(req) {
        const user = this.getUser(req);
        if (!user)
            return false;
        if (user.mustChangePassword)
            return false;
        if (twoFactorStore.isEnabled() && !user.twoFactorVerified)
            return false;
        return true;
    }
}
export const sessionStore = new SessionStore();
