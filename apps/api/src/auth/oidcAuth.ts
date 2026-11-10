import type { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { authConfig, withBasePath } from './config.js';
import { clearCookie, decodeSigned, encodeSigned, makeCookie, parseCookies } from './cookies.js';
import { oidcStore } from './oidcStore.js';
import { sessionStore } from './sessionStore.js';
import { twoFactorStore } from './twoFactorStore.js';

interface OidcCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

// Simple in-memory discovery cache with 15min TTL
let cachedEndpoints: {
  issuerUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint?: string;
  expiresAt: number;
} | null = null;

async function resolveEndpoints(issuerUrl: string) {
  const cleanUrl = issuerUrl.trim().replace(/\/+$/, '');
  const now = Date.now();
  if (cachedEndpoints && cachedEndpoints.issuerUrl === cleanUrl && cachedEndpoints.expiresAt > now) {
    return cachedEndpoints;
  }

  const discovery = await oidcStore.discover(cleanUrl);
  if (!discovery.valid || !discovery.authorizationEndpoint || !discovery.tokenEndpoint) {
    throw new Error(discovery.error || 'Không thể tìm thấy OpenID discovery endpoints');
  }

  cachedEndpoints = {
    issuerUrl: cleanUrl,
    authorizationEndpoint: discovery.authorizationEndpoint,
    tokenEndpoint: discovery.tokenEndpoint,
    userinfoEndpoint: discovery.userinfoEndpoint,
    expiresAt: now + 15 * 60 * 1000,
  };
  return cachedEndpoints;
}

export async function redirectToOidc(req: FastifyRequest, reply: FastifyReply) {
  const cfg = oidcStore.getConfig(req);
  if (!cfg.configured || !authConfig.oidcIssuerUrl || !authConfig.oidcClientId) {
    return reply.redirect(`${withBasePath('/login')}?error=oidc_not_configured`);
  }

  try {
    const endpoints = await resolveEndpoints(authConfig.oidcIssuerUrl);
    const state = crypto.randomBytes(18).toString('base64url');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    reply.header('Set-Cookie', [
      makeCookie(authConfig.oauthStateCookie, encodeSigned(state), 600),
      makeCookie(authConfig.oidcPkceCookie, encodeSigned(codeVerifier), 600),
    ]);

    const redirectUri = oidcStore.getCallbackUrl(req);
    const url = new URL(endpoints.authorizationEndpoint);
    url.searchParams.set('client_id', authConfig.oidcClientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return reply.redirect(url.toString());
  } catch (err: any) {
    console.error('OIDC redirect failed:', err);
    return reply.redirect(`${withBasePath('/login')}?error=oidc_discovery_failed`);
  }
}

function parseJwtClaims(token?: string): Record<string, any> {
  if (!token) return {};
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
      return JSON.parse(payload);
    }
  } catch {}
  return {};
}

export async function handleOidcCallback(
  req: FastifyRequest<{ Querystring: OidcCallbackQuery }>,
  reply: FastifyReply
) {
  if (req.query.error) {
    const code = req.query.error === 'access_denied' ? 'oidc_denied' : 'oidc_failed';
    return reply.redirect(`${withBasePath('/login')}?error=${code}`);
  }

  const cookies = parseCookies(req);
  const expectedState = decodeSigned(cookies[authConfig.oauthStateCookie]);
  const codeVerifier = decodeSigned(cookies[authConfig.oidcPkceCookie]);

  if (!req.query.state || !expectedState || req.query.state !== expectedState) {
    return reply.redirect(`${withBasePath('/login')}?error=invalid_state`);
  }
  if (!req.query.code) {
    return reply.redirect(`${withBasePath('/login')}?error=missing_code`);
  }

  try {
    const endpoints = await resolveEndpoints(authConfig.oidcIssuerUrl);
    const redirectUri = oidcStore.getCallbackUrl(req);

    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: req.query.code,
      redirect_uri: redirectUri,
      client_id: authConfig.oidcClientId,
    });
    if (authConfig.oidcClientSecret) {
      bodyParams.set('client_secret', authConfig.oidcClientSecret);
    }
    if (codeVerifier) {
      bodyParams.set('code_verifier', codeVerifier);
    }

    const tokenRes = await fetch(endpoints.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: bodyParams,
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      console.error('OIDC token exchange failed:', tokenRes.status, errText);
      return reply.redirect(`${withBasePath('/login')}?error=token_failed`);
    }

    const tokens = (await tokenRes.json()) as { access_token?: string; id_token?: string };
    const idClaims = parseJwtClaims(tokens.id_token);

    let userinfo: Record<string, any> = {};
    if (endpoints.userinfoEndpoint && tokens.access_token) {
      try {
        const uRes = await fetch(endpoints.userinfoEndpoint, {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Accept: 'application/json',
          },
        });
        if (uRes.ok) {
          userinfo = (await uRes.json()) as Record<string, any>;
        }
      } catch (uErr) {
        console.warn('OIDC userinfo fetch failed, falling back to id_token claims:', uErr);
      }
    }

    const email = (
      userinfo.email ||
      idClaims.email ||
      userinfo.preferred_username ||
      idClaims.preferred_username ||
      ''
    ).toLowerCase().trim();

    const name = userinfo.name || idClaims.name || userinfo.preferred_username || idClaims.preferred_username || email;
    const avatar = userinfo.picture || userinfo.avatar || idClaims.picture || idClaims.avatar;

    if (!email) {
      return reply.redirect(`${withBasePath('/login')}?error=email_missing`);
    }

    if (authConfig.oidcAllowedEmails.size > 0 && !authConfig.oidcAllowedEmails.has(email)) {
      return reply.redirect(`${withBasePath('/login')}?error=email_not_allowed`);
    }

    sessionStore.create(reply, {
      provider: 'oidc',
      email,
      name,
      avatar,
      twoFactorVerified: !twoFactorStore.isEnabled(),
    });

    reply.header('Set-Cookie', [
      clearCookie(authConfig.oauthStateCookie),
      clearCookie(authConfig.oidcPkceCookie),
    ]);

    return reply.redirect(withBasePath('/'));
  } catch (err: any) {
    console.error('OIDC callback processing failed:', err);
    return reply.redirect(`${withBasePath('/login')}?error=oidc_failed`);
  }
}
