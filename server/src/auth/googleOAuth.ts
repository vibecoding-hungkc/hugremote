import type { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { authConfig, withBasePath } from './config.js';
import { clearCookie, decodeSigned, encodeSigned, makeCookie, parseCookies } from './cookies.js';
import { sessionStore } from './sessionStore.js';

interface GoogleCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
}

export function redirectToGoogle(reply: FastifyReply) {
  const state = crypto.randomBytes(18).toString('base64url');
  reply.header('Set-Cookie', makeCookie(authConfig.oauthStateCookie, encodeSigned(state), 600));
  const redirectUri = `${authConfig.appUrl}${withBasePath('/auth/google/callback')}`;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', authConfig.googleClientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');
  return reply.redirect(url.toString());
}

export async function handleGoogleCallback(
  req: FastifyRequest<{ Querystring: GoogleCallbackQuery }>,
  reply: FastifyReply
) {
  if (req.query.error) return reply.redirect(`${withBasePath('/login')}?error=google_denied`);

  const expectedState = decodeSigned(parseCookies(req)[authConfig.oauthStateCookie]);
  if (!req.query.state || !expectedState || req.query.state !== expectedState) {
    return reply.redirect(`${withBasePath('/login')}?error=invalid_state`);
  }
  if (!req.query.code) return reply.redirect(`${withBasePath('/login')}?error=missing_code`);

  const redirectUri = `${authConfig.appUrl}${withBasePath('/auth/google/callback')}`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: req.query.code,
      client_id: authConfig.googleClientId,
      client_secret: authConfig.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) return reply.redirect(`${withBasePath('/login')}?error=token_failed`);
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) return reply.redirect(`${withBasePath('/login')}?error=token_missing`);

  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userRes.ok) return reply.redirect(`${withBasePath('/login')}?error=userinfo_failed`);

  const profile = (await userRes.json()) as { email?: string; name?: string; picture?: string };
  const email = (profile.email || '').toLowerCase();
  if (!email || !authConfig.googleAllowedEmails.has(email)) {
    return reply.redirect(`${withBasePath('/login')}?error=email_not_allowed`);
  }

  sessionStore.create(reply, { provider: 'google', email, name: profile.name, avatar: profile.picture });
  reply.header('Set-Cookie', clearCookie(authConfig.oauthStateCookie));
  return reply.redirect(withBasePath('/'));
}
