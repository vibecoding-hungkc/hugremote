import * as fs from 'node:fs';
import * as path from 'node:path';
import pino from 'pino';
import type { AppConfig } from '../config/app-config';

/** Khoá bí mật bị che trong mọi log (G-12). */
export const REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.clientSecret',
  '*.privateKey',
  '*.passphrase',
  '*.code',
];

/** Log JSON ra stdout + `DATA_DIR/logs/app.log` (0600) — nhật ký trong app đọc từ file này (AC-46). */
export function createLogStream(cfg: AppConfig): pino.DestinationStream {
  const dir = path.join(cfg.dataDir, 'logs');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, 'app.log');
  if (!fs.existsSync(file)) fs.writeFileSync(file, '', { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return pino.multistream([{ stream: process.stdout }, { stream: pino.destination({ dest: file, append: true, sync: false }) }]);
}
