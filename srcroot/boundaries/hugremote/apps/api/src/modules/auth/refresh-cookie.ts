import type { Response } from 'express';
import type { AppConfig } from '../../config/app-config';

export const REFRESH_COOKIE = 'hr_refresh';

/** Refresh token: cookie httpOnly, SameSite=Strict, chỉ gửi tới /api/auth (TECHSTACK §1). */
export function setRefreshCookie(res: Response, token: string, cfg: AppConfig) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: cfg.appUrl.startsWith('https://'),
    path: `${cfg.basePath}/api/auth`,
    maxAge: 14 * 86_400_000,
  });
}

export function clearRefreshCookie(res: Response, cfg: AppConfig) {
  res.clearCookie(REFRESH_COOKIE, { path: `${cfg.basePath}/api/auth` });
}
