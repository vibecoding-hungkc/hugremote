import fs from 'fs';
import path from 'path';
import os from 'os';
import { TelegramConfig } from './types.js';

const CONFIG_ENV_FILE = path.join(os.homedir(), '.config', 'hugremote', '.env');

function loadEnvFileVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  if (fs.existsSync(CONFIG_ENV_FILE)) {
    try {
      const content = fs.readFileSync(CONFIG_ENV_FILE, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          vars[key] = val;
        }
      }
    } catch (_) {}
  }
  return vars;
}

export function getTelegramConfig(): TelegramConfig {
  const envFileVars = loadEnvFileVars();

  const botToken = process.env.TELEGRAM_BOT_TOKEN || envFileVars.TELEGRAM_BOT_TOKEN || '';

  const rawAllowed =
    process.env.TELEGRAM_ALLOWED_USERS ||
    envFileVars.TELEGRAM_ALLOWED_USERS ||
    '';

  const allowedUsers = rawAllowed
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);

  const rawTopicMode =
    process.env.TELEGRAM_TOPIC_MODE ||
    envFileVars.TELEGRAM_TOPIC_MODE ||
    'true';
  const topicModeDefault = rawTopicMode.toLowerCase() !== 'false' && rawTopicMode !== '0';

  const defaultCwd =
    process.env.TELEGRAM_DEFAULT_CWD ||
    envFileVars.TELEGRAM_DEFAULT_CWD ||
    process.env.WORKSPACE_ROOT ||
    os.homedir();

  return {
    botToken,
    allowedUsers,
    topicModeDefault,
    defaultCwd,
  };
}

export function isTelegramConfigured(): boolean {
  const config = getTelegramConfig();
  return Boolean(config.botToken && config.botToken.trim());
}
