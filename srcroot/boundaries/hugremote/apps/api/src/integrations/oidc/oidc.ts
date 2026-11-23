import * as crypto from 'node:crypto';
import * as dns from 'node:dns/promises';
import * as net from 'node:net';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

/**
 * OIDC/Google cho SSO nhóm (AC-32): discovery, PKCE S256 + state + nonce, đổi code, kiểm chữ ký `id_token` bằng JWKS
 * (`jose`) — đóng lỗ hổng v1 tin `id_token` không kiểm chữ ký. Không biết HTTP server/DB (ARCHITECTURE §8).
 */
export interface OidcMeta {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

export const GOOGLE_ISSUER = 'https://accounts.google.com';

export class OidcError extends Error {}

function isPrivate(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:');
}

/**
 * Chặn SSRF: chỉ https và không trỏ vào IP nội bộ. `allowLocalHttp` chỉ bật ở môi trường dev (IdP thử
 * Keycloak ở localhost). Dùng cho Issuer owner nhập VÀ cho mọi endpoint mà tài liệu discovery khai báo
 * (token_endpoint/jwks_uri/authorization_endpoint) — issuer gốc an toàn không có nghĩa nội dung
 * `.well-known` nó trả về (đọc lại ở MỖI lần discover/login, không chỉ lúc owner lưu cấu hình) cũng an
 * toàn: DNS rebinding hoặc issuer bị chiếm sau khi đã lưu vẫn phải bị chặn.
 */
export async function assertSafeUrl(raw: string, allowLocalHttp: boolean, label = 'URL') {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new OidcError(`${label} không hợp lệ`);
  }
  const local = ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
  if (allowLocalHttp && local) return;
  if (u.protocol !== 'https:') throw new OidcError(`${label} phải là https`);
  const addrs = net.isIP(u.hostname) ? [u.hostname] : (await dns.lookup(u.hostname, { all: true })).map((a) => a.address);
  if (addrs.some(isPrivate)) throw new OidcError(`${label} trỏ vào địa chỉ nội bộ`);
}

export const assertSafeIssuer = (raw: string, allowLocalHttp: boolean) => assertSafeUrl(raw, allowLocalHttp, 'Issuer URL');

const metaCache = new Map<string, { at: number; meta: OidcMeta }>();

export async function discover(issuer: string, allowLocalHttp = false): Promise<OidcMeta> {
  const key = issuer.replace(/\/+$/, '');
  const hit = metaCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.meta;
  const r = await fetch(`${key}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(8000), redirect: 'error' });
  if (!r.ok) throw new OidcError(`Không tải được .well-known/openid-configuration (${r.status})`);
  const meta = (await r.json()) as OidcMeta;
  if (!meta.authorization_endpoint || !meta.token_endpoint || !meta.jwks_uri) throw new OidcError('Tài liệu discovery thiếu trường');
  if (meta.issuer.replace(/\/+$/, '') !== key) throw new OidcError('Issuer trong discovery không khớp');
  await assertSafeUrl(meta.token_endpoint, allowLocalHttp, 'token_endpoint');
  await assertSafeUrl(meta.jwks_uri, allowLocalHttp, 'jwks_uri');
  await assertSafeUrl(meta.authorization_endpoint, allowLocalHttp, 'authorization_endpoint');
  metaCache.set(key, { at: Date.now(), meta });
  return meta;
}

const b64url = (b: Buffer) => b.toString('base64url');

export function pkce() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function authorizeUrl(
  meta: OidcMeta,
  p: { clientId: string; redirectUri: string; state: string; nonce: string; challenge: string },
) {
  const u = new URL(meta.authorization_endpoint);
  u.search = new URLSearchParams({
    response_type: 'code',
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    scope: 'openid email profile',
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return u.toString();
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/** Đổi code lấy token, kiểm `id_token` (chữ ký JWKS, iss, aud, nonce, hạn) → email đã xác minh. */
export async function exchange(
  meta: OidcMeta,
  p: { clientId: string; clientSecret: string; redirectUri: string; code: string; verifier: string; nonce: string },
): Promise<{ email: string; name?: string; sub: string }> {
  const r = await fetch(meta.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: p.code,
      redirect_uri: p.redirectUri,
      client_id: p.clientId,
      client_secret: p.clientSecret,
      code_verifier: p.verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await r.json().catch(() => ({}))) as { id_token?: string; error?: string; error_description?: string };
  if (!r.ok || !body.id_token) throw new OidcError(`Đổi code thất bại: ${body.error_description ?? body.error ?? r.status}`);
  let jwks = jwksCache.get(meta.jwks_uri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(meta.jwks_uri));
    jwksCache.set(meta.jwks_uri, jwks);
  }
  let claims: JWTPayload & { email?: string; email_verified?: boolean | string; nonce?: string; name?: string };
  try {
    ({ payload: claims } = await jwtVerify(body.id_token, jwks, { issuer: meta.issuer, audience: p.clientId, clockTolerance: 60 }));
  } catch (e) {
    throw new OidcError(`id_token không hợp lệ: ${(e as Error).message}`);
  }
  if (claims.nonce !== p.nonce) throw new OidcError('nonce không khớp');
  if (!claims.email) throw new OidcError('id_token không có email');
  if (claims.email_verified === false || claims.email_verified === 'false') throw new OidcError('Email chưa được nhà cung cấp xác minh');
  return { email: claims.email.toLowerCase(), name: claims.name, sub: String(claims.sub) };
}

/** Allowlist: email đầy đủ hoặc `@tên-miền` (khớp hậu tố sau @), không phân biệt hoa thường. Rỗng = từ chối tất cả. */
export function emailAllowed(email: string, allow: string[]) {
  const e = email.toLowerCase();
  const domain = e.slice(e.lastIndexOf('@'));
  return allow.some((a) => {
    const x = a.trim().toLowerCase();
    return x.startsWith('@') ? domain === x : x === e;
  });
}
