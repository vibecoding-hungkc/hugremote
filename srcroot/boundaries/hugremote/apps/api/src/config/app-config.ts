import * as os from 'node:os';
import * as path from 'node:path';

/** Cấu hình đã chuẩn hoá — chỗ DUY NHẤT đọc `process.env` (skill §2.2). */
export interface AppConfig {
  env: 'development' | 'production' | 'test';
  host: string;
  port: number;
  basePath: string;
  appUrl: string;
  dataDir: string;
  workspaceRoot: string;
  allowedRoot: string;
  jwtSecret?: string;
  authMode: 'password' | 'none';
  authPassword?: string;
  authMaxAttempts: number;
  authLockMinutes: number;
  trustProxy: boolean;
  sshConfigPath: string;
  claudeBinPath?: string;
  claudeProjectsDir: string;
  updateChannel: 'stable' | 'beta';
  updateRepo?: string;
  webDist?: string;
}

const expandHome = (p: string) => (p === '~' ? os.homedir() : p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p);

function cleanBase(b?: string): string {
  if (!b || b === '/') return '';
  const s = '/' + b.replace(/^\/+|\/+$/g, '');
  if (!/^\/[A-Za-z0-9._~\-/]*$/.test(s)) throw new Error('BASE_PATH không hợp lệ');
  return s;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const appEnv = (env.APP_ENV ?? 'development') as AppConfig['env'];
  const port = Number(env.PORT ?? (appEnv === 'production' ? 8099 : 3000));
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('PORT không hợp lệ');
  const host = env.HOST ?? '127.0.0.1';
  const authMode = (env.AUTH_MODE ?? 'password') as AppConfig['authMode'];
  if (!['password', 'none'].includes(authMode)) throw new Error('AUTH_MODE phải là password hoặc none');
  if (authMode === 'none' && !['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error('AUTH_MODE=none chỉ được dùng khi HOST là loopback');
  }
  return {
    env: appEnv,
    host,
    port,
    basePath: cleanBase(env.BASE_PATH),
    appUrl: env.APP_URL ?? `http://localhost:${port}`,
    dataDir: expandHome(env.DATA_DIR ?? '~/.config/hugremote'),
    workspaceRoot: expandHome(env.WORKSPACE_ROOT ?? '~'),
    allowedRoot: expandHome(env.ALLOWED_ROOT ?? '~'),
    jwtSecret: env.JWT_SECRET || undefined,
    authMode,
    authPassword: env.AUTH_PASSWORD || undefined,
    authMaxAttempts: Number(env.AUTH_MAX_ATTEMPTS ?? 5),
    authLockMinutes: Number(env.AUTH_LOCK_MINUTES ?? 15),
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    sshConfigPath: expandHome(env.SSH_CONFIG_PATH ?? '~/.ssh/config'),
    claudeBinPath: env.CLAUDE_BIN_PATH || undefined,
    claudeProjectsDir: expandHome(env.CLAUDE_PROJECTS_DIR ?? '~/.claude/projects'),
    updateChannel: env.UPDATE_CHANNEL === 'beta' ? 'beta' : 'stable',
    updateRepo: env.UPDATE_REPO || undefined,
    webDist: env.WEB_DIST || undefined,
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
