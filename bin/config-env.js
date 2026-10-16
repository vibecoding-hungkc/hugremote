import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CONFIG_KEYS = new Set([
  'HOST', 'PORT', 'BASE_PATH', 'AUTH_MODE', 'SESSION_SECRET', 'APP_URL',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_ALLOWED_EMAILS',
  'WORKSPACE_ROOT', 'ALLOWED_ROOT', 'UPDATE_CHANNEL',
]);

function configError(key, filename, line, message) {
  throw new Error(`Invalid ${key} in ${filename} at line ${line}: ${message}`);
}

function validateValue(key, value, filename, line) {
  if (key === 'AUTH_MODE' && !['none', 'password', 'google'].includes(value)) {
    configError(key, filename, line, 'expected none, password, or google');
  }
  if (key === 'UPDATE_CHANNEL' && value && !['stable', 'beta', 'release', 'main'].includes(value.toLowerCase())) {
    configError(key, filename, line, 'expected stable, beta, release, or main');
  }
  if (key === 'PORT' && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)) {
    configError(key, filename, line, 'expected a port number from 1 through 65535');
  }
  if (key === 'BASE_PATH' && value && value !== '/' && !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\/?$/.test(value)) {
    configError(key, filename, line, 'expected /remote or /tools/remote (not a URL)');
  }
  if (key === 'APP_URL' && value) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    } catch (_) {
      configError(key, filename, line, 'expected an http:// or https:// URL');
    }
  }
}

export function loadUserConfig(env = process.env, home = os.homedir()) {
  const filename = path.join(home, '.config', 'hugremote', '.env');
  let contents;
  try {
    contents = fs.readFileSync(filename, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw new Error(`Cannot read HugRemote config ${filename}: ${error.code}`);
  }
  const defaults = {};
  for (const [index, line] of contents.split(/\r?\n/).entries()) {
    const key = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\b/)?.[1];
    if (!CONFIG_KEYS.has(key)) continue;
    const invalid = () => new Error(`Invalid ${key} in ${filename} at line ${index + 1}: expected KEY=value with optional matching quotes`);
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
    if (!match || line.includes('\0')) throw invalid();
    const raw = match[2].trim();
    const quote = raw[0];
    let value;
    if (quote === '"' || quote === "'") {
      const end = raw.indexOf(quote, 1);
      if (end === -1 || !/^\s*(?:#.*)?$/.test(raw.slice(end + 1))) throw invalid();
      value = raw.slice(1, end);
    } else {
      value = raw.replace(/\s+#.*$/, '').trim();
    }
    validateValue(key, value, filename, index + 1);
    defaults[key] = value;
  }
  for (const [key, value] of Object.entries(defaults)) {
    if (!Object.hasOwn(env, key)) env[key] = value;
  }
}
