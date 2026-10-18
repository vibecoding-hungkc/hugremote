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
    const content = fs.readFileSync(sshConfigPath, 'utf8');
    const lines = content.split('\n');
    let currentHost: Partial<ServerConfig> | null = null;

    function pushCurrentHost() {
      if (currentHost && currentHost.name && currentHost.name !== '*') {
        const hName = currentHost.name;
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

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.toLowerCase().startsWith('# workspace')) {
        const wsVal = line.replace(/^#\s*workspace\s*/i, '').trim();
        if (wsVal && currentHost) {
          currentHost.workspace = wsVal;
        }
        continue;
      }

      if (line.toLowerCase().startsWith('# authtype')) {
        const atVal = line.replace(/^#\s*authtype\s*/i, '').trim().toLowerCase();
        if ((atVal === 'password' || atVal === 'key') && currentHost) {
          currentHost.authType = atVal as any;
        }
        continue;
      }

      if (line.startsWith('#')) continue;

      const [key, ...valParts] = line.split(/\s+/);
      const val = valParts.join(' ');

      if (key.toLowerCase() === 'host') {
        pushCurrentHost();
        currentHost = { name: val };
      } else if (currentHost) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'hostname') currentHost.host = val;
        else if (lowerKey === 'user') currentHost.user = val;
        else if (lowerKey === 'port') currentHost.port = parseInt(val, 10);
        else if (lowerKey === 'identityfile') currentHost.key = val;
      }
    }

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
  let content = fs.existsSync(sshConfigPath) ? fs.readFileSync(sshConfigPath, 'utf8') : '';

  const hostRegex = new RegExp(`(^|\\n)Host\\s+${server.name}\\b([\\s\\S]*?)(?=\\nHost\\s+|$)`, 'i');

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

  if (hostRegex.test(content)) {
    content = content.replace(hostRegex, (match, prefix) => {
      return (prefix ? '\n' : '') + newBlock.trim();
    });
  } else {
    content = content.trim();
    content = content ? `${content}\n\n${newBlock}` : newBlock;
  }

  fs.writeFileSync(sshConfigPath, content.trim() + '\n', { mode: 0o600 });

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
  let content = fs.readFileSync(sshConfigPath, 'utf8');

  const hostRegex = new RegExp(`(^|\\n)(Host\\s+${serverName}\\b[\\s\\S]*?)(?=\\nHost\\s+|$)`, 'i');
  const match = content.match(hostRegex);
  if (!match) return;

  let block = match[2];
  if (/#\s*Workspace\s+[^\n]+/i.test(block)) {
    block = block.replace(/#\s*Workspace\s+[^\n]+/i, `# Workspace ${normalized}`);
  } else {
    block = block.trimEnd() + `\n    # Workspace ${normalized}\n`;
  }

  content = content.replace(hostRegex, (m, prefix) => {
    return (prefix ? '\n' : '') + block.trim();
  });

  fs.writeFileSync(sshConfigPath, content.trim() + '\n', { mode: 0o600 });
}
