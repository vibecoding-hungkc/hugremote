import { ErrorCode } from '@app/shared';
import { env } from '../config/env';
import { useAuthStore } from '../stores/auth.store';
import { connection } from './connection';

/** Lỗi api theo khuôn `{ code, details }` (G-3) — web dịch qua i18n `errors.<code>`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | string;
  readonly details?: Record<string, unknown>;
  constructor(status: number, code: ErrorCode | string, details?: Record<string, unknown>) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let refreshing: Promise<string | null> | null = null;

/** Một lần refresh dùng chung cho mọi request cùng lúc bị 401. */
export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= fetch(`${env.apiBase}/auth/refresh`, { method: 'POST', credentials: 'same-origin' })
    .then(async (r) => {
      if (!r.ok) return null;
      const b = (await r.json()) as { accessToken?: string };
      return b.accessToken ?? null;
    })
    .catch(() => null)
    .then((t) => {
      useAuthStore.getState().setToken(t);
      return t;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface Opts {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  raw?: boolean;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const qs = opts.query
    ? '?' + new URLSearchParams(Object.entries(opts.query).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString()
    : '';
  const send = (token: string | null) =>
    fetch(`${env.apiBase}${path}${qs}`, {
      method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
      credentials: 'same-origin',
      signal: opts.signal,
      headers: {
        ...(opts.body !== undefined && !(opts.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body === undefined ? undefined : opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body),
    });
  let res: Response;
  try {
    res = await send(useAuthStore.getState().accessToken);
    connection.reportOk();
  } catch (e) {
    if ((e as Error).name !== 'AbortError') connection.reportNetworkError();
    throw e;
  }
  if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/2fa/verify')) {
    const t = await refreshAccessToken();
    if (t) res = await send(t);
  }
  if (!res.ok) {
    let body: { code?: string; details?: Record<string, unknown> } = {};
    try {
      body = await res.json();
    } catch {
      /* không phải JSON */
    }
    throw new ApiError(res.status, body.code ?? ErrorCode.INTERNAL, body.details);
  }
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  return (ct.includes('json') ? res.json() : res.text()) as Promise<T>;
}
