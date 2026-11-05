import path from 'path';
import os from 'os';
import fs from 'fs';

export interface ServerConfig {
  id: string;
  name: string;
  type: 'local' | 'ssh';
  label: string;
  host: string;
  user: string;
  port: number;
  authType?: 'key' | 'password';
  key?: string;
  password?: string;
  desc?: string;
  workspace?: string;
  isConnected?: boolean;
}

export const PORT = parseInt(process.env.PORT || '8099', 10);
export const HOST = process.env.HOST || '::';

// Prefix path for reverse proxy subpaths (e.g. BASE_PATH=/remote). Use if set, omitted otherwise.
export const BASE_PATH = process.env.BASE_PATH
  ? ('/' + process.env.BASE_PATH.trim().replace(/^\/+|\/+$/g, ''))
  : '';

export const LOCAL_WORKSPACE = process.env.WORKSPACE_ROOT || os.homedir();
export const ALLOWED_ROOT = process.env.ALLOWED_ROOT || os.homedir();

// Quy đổi đường dẫn kiểu "~" hoặc "~/sub/dir" thành đường dẫn tuyệt đối thật,
// để giá trị lưu trữ luôn nhất quán với giá trị dùng khi list file thực tế.
export function normalizeWorkspacePath(p: string, homeDirOverride?: string): string {
  const trimmed = (p || '').trim();
  if (!trimmed) return homeDirOverride || os.homedir();
  const home = homeDirOverride || os.homedir();
  if (trimmed === '~') return home;
  if (trimmed.startsWith('~/')) return path.posix.join(home, trimmed.slice(2));
  return trimmed;
}

const CREDENTIALS_FILE = path.join(os.homedir(), '.ssh', 'hugcode_credentials.json');

export function loadCredentials(): Record<string, string> {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
    } catch (_) {}
  }
  return {};
}

export function saveCredentials(creds: Record<string, string>): void {
  try {
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
  } catch (err) {
    console.warn('Failed to save hugcode_credentials.json:', err);
  }
}

export function getAvailableSshKeys(): string[] {
  const sshDir = path.join(os.homedir(), '.ssh');
  if (!fs.existsSync(sshDir)) return [];
  try {
    const files = fs.readdirSync(sshDir);
    return files
      .filter((f) => {
        if (f.endsWith('.pub') || f === 'config' || f === 'known_hosts' || f === 'authorized_keys' || f.endsWith('.json')) {
          return false;
        }
        return true;
      })
      .map((f) => path.join(sshDir, f));
  } catch (_) {
    return [];
  }
}

// OpenSSH Include patterns are relative to ~/.ssh, including nested files.
function expandSshInclude(sshDir: string, pattern: string): string[] {
  const expanded = pattern === '~' ? os.homedir()
    : pattern.startsWith('~/') ? path.join(os.homedir(), pattern.slice(2))
    : path.isAbsolute(pattern) ? pattern : path.join(sshDir, pattern);
  const absolute = path.resolve(expanded);
  const segments = absolute.split(path.sep).filter(Boolean);
  let paths = [path.parse(absolute).root];
  for (const segment of segments) {
    const wildcard = /[*?\[]/.test(segment);
    let matcher: RegExp | null = null;
    if (wildcard) {
      try {
        matcher = new RegExp('^' + segment.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      } catch {
        return [];
      }
    }
    paths = paths.flatMap((dir) => {
      if (!wildcard) return [path.join(dir, segment)];
      try {
        return fs.readdirSync(dir).filter((name) => !name.startsWith('.') && matcher!.test(name))
          .map((name) => path.join(dir, name));
      } catch { return []; }
    }).slice(0, 256);
  }
  return paths.filter((file) => {
    try { return fs.statSync(file).isFile(); } catch { return false; }
  }).sort();
}

function listSshConfigFiles(sshConfigPath: string): string[] {
  const sshDir = path.dirname(sshConfigPath);
  const files: string[] = [];
  const active = new Set<string>();
  const visit = (file: string, depth = 0) => {
    if (depth > 16 || files.length >= 256) return;
    let canonical: string;
    try { canonical = fs.realpathSync(file); } catch { return; }
    if (active.has(canonical)) return;
    active.add(canonical);
    files.push(canonical);
    try {
      for (const rawLine of fs.readFileSync(canonical, 'utf8').split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const normalizedLine = line.replace(/^([A-Za-z][A-Za-z0-9]*)\s*=\s*/, '$1 ');
        const [key, ...valParts] = normalizedLine.split(/\s+/);
        if (key.toLowerCase() !== 'include') continue;
        const patterns = valParts.join(' ').match(/"[^"]+"|'[^']+'|\S+/g)?.map((part) => part.replace(/^['"]|['"]$/g, '')) || [];
        for (const pattern of patterns) for (const included of expandSshInclude(sshDir, pattern)) visit(included, depth + 1);
      }
    } finally { active.delete(canonical); }
  };
  visit(sshConfigPath);
  return files;
}

export function parseSshConfig(): ServerConfig[] {
  const sshConfigPath = path.join(os.homedir(), '.ssh', 'config');
  const creds = loadCredentials();

  let localWs = LOCAL_WORKSPACE;
  const localWsFile = path.join(os.homedir(), '.ssh', 'hugcode_local_workspace.txt');
  if (fs.existsSync(localWsFile)) {
    try {
      const saved = fs.readFileSync(localWsFile, 'utf8').trim();
      if (saved) localWs = normalizeWorkspacePath(saved);
    } catch (_) {}
  }

  const servers: ServerConfig[] = [
    {
      id: 'server-local',
      name: os.hostname() || 'localhost',
      type: 'local',
      label: `Máy hiện tại (${os.hostname() || 'Local'})`,
      host: '127.0.0.1',
      user: os.userInfo().username || 'root',
      port: 22,
      desc: 'Local Machine • Direct Host Workspace',
      workspace: localWs,
      isConnected: true,
    },
  ];

  if (!fs.existsSync(sshConfigPath)) {
    return servers;
  }

  try {
    let currentHost: Partial<ServerConfig> | null = null;
    const seenHosts = new Set<string>();
    const activeFiles = new Set<string>();
    let expandedFiles = 0;

    const sshDir = path.dirname(sshConfigPath);
    function expandInclude(pattern: string): string[] {
      return expandSshInclude(sshDir, pattern);
    }

    function parseConfig(file: string, depth = 0) {
      if (depth > 16 || expandedFiles >= 256) return;
      let canonical: string;
      try { canonical = fs.realpathSync(file); } catch { return; }
      if (activeFiles.has(canonical)) return;
      activeFiles.add(canonical);
      expandedFiles++;
      try {
        for (const rawLine of fs.readFileSync(canonical, 'utf8').split('\n')) {
          parseLine(rawLine, depth);
        }
        pushCurrentHost();
        currentHost = null;
      } finally { activeFiles.delete(canonical); }
    }

    function parseLine(rawLine: string, depth: number) {
      const line = rawLine.trim();
      if (!line) return;
      if (line.toLowerCase().startsWith('# workspace')) {
        const wsVal = line.replace(/^#\s*workspace\s*/i, '').trim();
        if (wsVal && currentHost) currentHost.workspace = wsVal;
        return;
      }
      if (line.toLowerCase().startsWith('# authtype')) {
        const atVal = line.replace(/^#\s*authtype\s*/i, '').trim().toLowerCase();
        if ((atVal === 'password' || atVal === 'key') && currentHost) currentHost.authType = atVal as 'password' | 'key';
        return;
      }
      if (line.startsWith('#')) return;
      const normalizedLine = line.replace(/^([A-Za-z][A-Za-z0-9]*)\s*=\s*/, '$1 ');
      const [key, ...valParts] = normalizedLine.split(/\s+/);
      const val = valParts.join(' ').replace(/^['"]|['"]$/g, '');
      if (key.toLowerCase() === 'include') {
        const savedHost = currentHost;
        currentHost = null;
        const patterns = valParts.join(' ').match(/"[^"]+"|'[^']+'|\S+/g)?.map((part) => part.replace(/^['"]|['"]$/g, '')) || [];
        for (const pattern of patterns) for (const included of expandInclude(pattern)) parseConfig(included, depth + 1);
        currentHost = savedHost;
      } else if (key.toLowerCase() === 'host') {
        pushCurrentHost();
        const alias = valParts.find((part) => !part.startsWith('!') && !/[?*]/.test(part));
        currentHost = alias ? { name: alias } : null;
      } else if (currentHost) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'hostname') currentHost.host = val;
        else if (lowerKey === 'user') currentHost.user = val;
        else if (lowerKey === 'port') currentHost.port = parseInt(val, 10);
        else if (lowerKey === 'identityfile') currentHost.key = val;
      }
    }

    function pushCurrentHost() {
      if (currentHost && currentHost.name && currentHost.name !== '*' && !/[?*]/.test(currentHost.name)) {
        const hName = currentHost.name;
        if (seenHosts.has(hName)) return;
        seenHosts.add(hName);  // OpenSSH applies the first matching Host stanza.
        const pass = creds[hName];
        const defaultWs = (currentHost.user && currentHost.user !== 'root') ? `/home/${currentHost.user}` : '/root';
        servers.push({
          id: `server-ssh-${hName}`,
          name: hName,
          type: 'ssh',
          label: `Remote SSH (${hName})`,
          host: currentHost.host || hName,
          user: currentHost.user || 'root',
          port: currentHost.port || 22,
          authType: pass ? 'password' : (currentHost.authType || (currentHost.key ? 'key' : 'key')),
          key: currentHost.key,
          password: pass,
          desc: `SSH Host • ${currentHost.user || 'root'}@${currentHost.host || hName}`,
          workspace: currentHost.workspace || defaultWs,
          isConnected: false,
        });
      }
    }

    parseConfig(sshConfigPath);
    pushCurrentHost();
  } catch (err) {
    console.warn('Failed to parse ~/.ssh/config:', err);
  }

  return servers;
}

export function saveOrUpdateSshConfigHost(server: ServerConfig): void {
  const sshDir = path.join(os.homedir(), '.ssh');
  if (!fs.existsSync(sshDir)) {
    fs.mkdirSync(sshDir, { mode: 0o700, recursive: true });
  }

  const sshConfigPath = path.join(sshDir, 'config');
  const escaped = server.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hostRegex = new RegExp(`(^|\\n)Host\\s+${escaped}(?:\\s[^\\n]*)?([\\s\\S]*?)(?=\\nHost\\s+|$)`, 'i');

  let newBlock = `Host ${server.name}\n`;
  newBlock += `    HostName ${server.host}\n`;
  newBlock += `    Port ${server.port || 22}\n`;
  newBlock += `    User ${server.user || 'root'}\n`;
  if (server.authType === 'key' && server.key) {
    newBlock += `    IdentityFile ${server.key}\n`;
  }
  if (server.authType === 'password') {
    newBlock += `    # AuthType password\n`;
  }
  if (server.workspace) {
    newBlock += `    # Workspace ${normalizeWorkspacePath(server.workspace)}\n`;
  }
  newBlock += `    StrictHostKeyChecking no\n`;
  newBlock += `    UserKnownHostsFile /dev/null\n`;

  let updatedInPlace = false;
  if (fs.existsSync(sshConfigPath)) {
    for (const configFile of listSshConfigFiles(sshConfigPath)) {
      const fileContent = fs.readFileSync(configFile, 'utf8');
      if (!hostRegex.test(fileContent)) continue;
      const nextContent = fileContent.replace(hostRegex, (_match, prefix) => (prefix ? '\n' : '') + newBlock.trim());
      fs.writeFileSync(configFile, nextContent.trim() + '\n', { mode: 0o600 });
      updatedInPlace = true;
      break;
    }
  }

  if (!updatedInPlace) {
    let content = fs.existsSync(sshConfigPath) ? fs.readFileSync(sshConfigPath, 'utf8') : '';
    content = content.trim();
    content = content ? `${content}\n\n${newBlock}` : newBlock;
    fs.writeFileSync(sshConfigPath, content.trim() + '\n', { mode: 0o600 });
  }

  if (server.password) {
    const creds = loadCredentials();
    creds[server.name] = server.password;
    saveCredentials(creds);
  }
}

export function updateSshConfigHostWorkspace(serverName: string, newWorkspace: string): void {
  const normalized = normalizeWorkspacePath(newWorkspace);

  if (serverName === os.hostname() || serverName === 'localhost' || serverName === 'hungpc') {
    const localWsFile = path.join(os.homedir(), '.ssh', 'hugcode_local_workspace.txt');
    try {
      fs.writeFileSync(localWsFile, normalized, { mode: 0o600 });
    } catch (_) {}
    return;
  }

  const sshConfigPath = path.join(os.homedir(), '.ssh', 'config');
  if (!fs.existsSync(sshConfigPath)) return;
  const escaped = serverName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hostRegex = new RegExp(`(^|\\n)(Host\\s+${escaped}(?:\\s[^\\n]*)?[\\s\\S]*?)(?=\\nHost\\s+|$)`, 'i');
  for (const configFile of listSshConfigFiles(sshConfigPath)) {
    let content = fs.readFileSync(configFile, 'utf8');
    const match = content.match(hostRegex);
    if (!match) continue;
    let block = match[2];
    if (/#\s*Workspace\s+[^\n]+/i.test(block)) {
      block = block.replace(/#\s*Workspace\s+[^\n]+/i, `# Workspace ${normalized}`);
    } else {
      block = block.trimEnd() + `\n    # Workspace ${normalized}\n`;
    }
    content = content.replace(hostRegex, (_m, prefix) => (prefix ? '\n' : '') + block.trim());
    fs.writeFileSync(configFile, content.trim() + '\n', { mode: 0o600 });
    return;
  }
}
