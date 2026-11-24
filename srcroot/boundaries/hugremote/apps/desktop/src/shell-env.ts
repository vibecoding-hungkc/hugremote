import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

export interface ShellEnvResult {
  PATH?: string;
  SSH_AUTH_SOCK?: string;
}

export function resolveMacLoginShellEnv(homeDir: string = os.homedir()): ShellEnvResult {
  const result: ShellEnvResult = {};
  if (process.platform !== 'darwin') return result;

  const userShell = process.env.SHELL || '/bin/zsh';
  try {
    const out = execFileSync(
      userShell,
      [
        '-lic',
        'printf "__HUG_ENV_START__%s__HUG_SEP__%s__HUG_ENV_END__" "$PATH" "$SSH_AUTH_SOCK"',
      ],
      {
        encoding: 'utf8',
        timeout: 2500,
        env: { ...process.env, HOME: homeDir },
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    const match = out.match(/__HUG_ENV_START__([\s\S]*?)__HUG_SEP__([\s\S]*?)__HUG_ENV_END__/);
    if (match) {
      if (match[1]?.trim()) result.PATH = match[1].trim();
      if (match[2]?.trim() && fs.existsSync(match[2].trim())) {
        result.SSH_AUTH_SOCK = match[2].trim();
      }
    }
  } catch {
    // Fallback if interactive shell times out
  }

  if (!result.SSH_AUTH_SOCK) {
    try {
      const sock = execFileSync('launchctl', ['getenv', 'SSH_AUTH_SOCK'], {
        encoding: 'utf8',
        timeout: 1500,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (sock && fs.existsSync(sock)) {
        result.SSH_AUTH_SOCK = sock;
      }
    } catch {}
  }

  return result;
}

export function getMergedMacPath(homeDir: string = os.homedir()): string {
  const shellEnv = resolveMacLoginShellEnv(homeDir);
  const inheritedPath = shellEnv.PATH || process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin';
  const extraPaths = [
    path.join(homeDir, '.local', 'bin'),
    path.join(homeDir, '.orbstack', 'bin'),
    path.join(homeDir, '.rd', 'bin'),
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/local/sbin',
    '/opt/local/bin',
  ];
  return Array.from(new Set([...extraPaths, ...inheritedPath.split(':')].filter(Boolean))).join(':');
}
