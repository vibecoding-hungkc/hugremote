import type { IncomingMessage } from 'node:http';
import type { AppConfig } from '../config/app-config';

/** Origin hợp lệ cho WS/SSE (AC-14): trùng Host của request, trùng APP_URL, hoặc loopback. Thiếu Origin (không phải trình duyệt) → để vé quyết. */
export function originAllowed(req: IncomingMessage, cfg: AppConfig): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  let o: URL;
  try {
    o = new URL(origin);
  } catch {
    return false;
  }
  if (req.headers.host && o.host === req.headers.host) return true;
  try {
    if (o.origin === new URL(cfg.appUrl).origin) return true;
  } catch {
    /* APP_URL sai định dạng */
  }
  return ['localhost', '127.0.0.1', '[::1]'].includes(o.hostname);
}
