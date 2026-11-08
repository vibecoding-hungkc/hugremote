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
  proxyJump?: string;
  proxyCommand?: string;
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

export function sanitizeRemoteWorkspacePath(
  rawPath: string | undefined,
  remoteUser = 'root',
  localHome = os.homedir()
): string {
  const effectiveUser = (remoteUser || 'root').trim() || 'root';
  const defaultWs = effectiveUser !== 'root' ? `/home/${effectiveUser}` : '/root';
  const trimmed = (rawPath || '').trim();
  if (!trimmed || trimmed === '~') return defaultWs;
  if (trimmed.startsWith('~/')) return path.posix.join(defaultWs, trimmed.slice(2));

  // Repair macOS local home paths (/Users/<macUser>...) accidentally persisted onto remote Linux SSH hosts
  if (trimmed.startsWith('/Users/')) {
    const parts = trimmed.split('/').filter(Boolean); // ['Users', '<macUser>', ...rest]
    if (parts.length >= 2) {
      const rest = parts.slice(2).join('/');
      return rest ? path.posix.join(defaultWs, rest) : defaultWs;
    }
  }
  if (localHome && localHome !== defaultWs && (trimmed === localHome || trimmed.startsWith(localHome + '/'))) {
    const rel = trimmed.slice(localHome.length).replace(/^\/+/, '');
    return rel ? path.posix.join(defaultWs, rel) : defaultWs;
  }
  return trimmed;
}

function getCredentialsFilePath(homeDir = os.homedir()): string {
  return path.join(homeDir, '.ssh', 'hugcode_credentials.json');
}

export function loadCredentials(homeDir = os.homedir()): Record<string, string> {
  const file = getCredentialsFilePath(homeDir);
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (_) {}
  }
  return {};
}

export function saveCredentials(creds: Record<string, string>, homeDir = os.homedir()): void {
  try {
    fs.writeFileSync(getCredentialsFilePath(homeDir), JSON.stringify(creds, null, 2), { mode: 0o600 });
  } catch (err) {
    console.warn('Failed to save hugcode_credentials.json:', err);
  }
}

export function getAvailableSshKeys(homeDir = os.homedir()): string[] {
  const sshDir = path.join(homeDir, '.ssh');
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
function expandSshInclude(sshDir: string, pattern: string, homeDir = os.homedir()): string[] {
  const expanded = pattern === '~' ? homeDir
    : pattern.startsWith('~/') ? path.join(homeDir, pattern.slice(2))
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

export function listSshConfigFiles(sshConfigPath: string, homeDir = path.dirname(path.dirname(sshConfigPath))): string[] {
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
        for (const pattern of patterns) for (const included of expandSshInclude(sshDir, pattern, homeDir)) visit(included, depth + 1);
      }
    } finally { active.delete(canonical); }
  };
  visit(sshConfigPath);
  return files;
}

export function hasSshHostAlias(alias: string, homeDir = os.homedir()): boolean {
  const cleanAlias = (alias || '').trim();
  if (!cleanAlias) return false;
  const sshConfigPath = path.join(homeDir, '.ssh', 'config');
  if (!fs.existsSync(sshConfigPath)) return false;
  const escaped = cleanAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hostLineRegex = new RegExp(`(^|\\n)\\s*Host\\s+[^\\n#]*\\b${escaped}\\b`, 'i');
  for (const file of listSshConfigFiles(sshConfigPath, homeDir)) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      if (hostLineRegex.test(content)) return true;
    } catch {}
  }
  return false;
}

function wildcardToRegExp(pattern: string): RegExp | null {
  try {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`, 'i');
  } catch {
    return null;
  }
}

export function parseSshConfig(homeDirOverride?: string): ServerConfig[] {
  const homeDir = homeDirOverride || process.env.HOME || os.homedir();
  const sshConfigPath = path.join(homeDir, '.ssh', 'config');
  const creds = loadCredentials(homeDir);

  let localWs = homeDirOverride ? homeDir : LOCAL_WORKSPACE;
  const localWsFile = path.join(homeDir, '.ssh', 'hugcode_local_workspace.txt');
  if (fs.existsSync(localWsFile)) {
    try {
      const saved = fs.readFileSync(localWsFile, 'utf8').trim();
      if (saved) localWs = normalizeWorkspacePath(saved, homeDir);
    } catch (_) {}
  }

  const defaultLocalUser = os.userInfo().username || 'root';

  const servers: ServerConfig[] = [
    {
      id: 'server-local',
      name: os.hostname() || 'localhost',
      type: 'local',
      label: `Máy hiện tại (${os.hostname() || 'Local'})`,
      host: '127.0.0.1',
      user: defaultLocalUser,
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
    interface ParsedStanza {
      concreteAliases: string[];
      wildcardMatchers: RegExp[];
      props: Partial<ServerConfig>;
    }

    let currentStanza: ParsedStanza | null = null;
    const concreteEntries: Array<{ alias: string; props: Partial<ServerConfig> }> = [];
    const wildcardStanzas: Array<{ matchers: RegExp[]; props: Partial<ServerConfig> }> = [];
    const seenHosts = new Set<string>();
    const activeFiles = new Set<string>();
    let expandedFiles = 0;

    const sshDir = path.dirname(sshConfigPath);
    function expandInclude(pattern: string): string[] {
      return expandSshInclude(sshDir, pattern, homeDir);
    }

    function flushCurrentStanza() {
      if (!currentStanza) return;
      for (const alias of currentStanza.concreteAliases) {
        if (!seenHosts.has(alias)) {
          seenHosts.add(alias); // OpenSSH applies the first matching Host stanza
          concreteEntries.push({ alias, props: { ...currentStanza.props } });
        }
      }
      if (currentStanza.wildcardMatchers.length > 0) {
        wildcardStanzas.push({
          matchers: currentStanza.wildcardMatchers,
          props: { ...currentStanza.props },
        });
      }
      currentStanza = null;
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
        flushCurrentStanza();
      } finally { activeFiles.delete(canonical); }
    }

    function parseLine(rawLine: string, depth: number) {
      const line = rawLine.trim();
      if (!line) return;
      if (line.toLowerCase().startsWith('# workspace')) {
        const wsVal = line.replace(/^#\s*workspace\s*/i, '').trim();
        if (wsVal && currentStanza && !currentStanza.props.workspace) {
          currentStanza.props.workspace = wsVal;
        }
        return;
      }
      if (line.toLowerCase().startsWith('# authtype')) {
        const atVal = line.replace(/^#\s*authtype\s*/i, '').trim().toLowerCase();
        if ((atVal === 'password' || atVal === 'key') && currentStanza && !currentStanza.props.authType) {
          currentStanza.props.authType = atVal as 'password' | 'key';
        }
        return;
      }
      if (line.startsWith('#')) return;
      const normalizedLine = line.replace(/^([A-Za-z][A-Za-z0-9]*)\s*=\s*/, '$1 ');
      const [key, ...valParts] = normalizedLine.split(/\s+/);
      const val = valParts.join(' ').replace(/^['"]|['"]$/g, '');
      const lowerKey = key.toLowerCase();

      if (lowerKey === 'include') {
        const savedStanza = currentStanza;
        currentStanza = null;
        const patterns = valParts.join(' ').match(/"[^"]+"|'[^']+'|\S+/g)?.map((part) => part.replace(/^['"]|['"]$/g, '')) || [];
        for (const pattern of patterns) for (const included of expandInclude(pattern)) parseConfig(included, depth + 1);
        currentStanza = savedStanza;
      } else if (lowerKey === 'match') {
        // Close any active Host block so directives inside a Match block never overwrite the preceding Host stanza.
        flushCurrentStanza();
      } else if (lowerKey === 'host') {
        flushCurrentStanza();
        const rawTokens = valParts
          .join(' ')
          .match(/"[^"]+"|'[^']+'|\S+/g)
          ?.map((part) => part.replace(/^['"]|['"]$/g, '')) || [];
        const concreteAliases = rawTokens.filter((part) => !part.startsWith('!') && !/[?*]/.test(part));
        const wildcardMatchers = rawTokens
          .filter((part) => !part.startsWith('!') && /[?*]/.test(part))
          .map((part) => wildcardToRegExp(part))
          .filter((re): re is RegExp => re !== null);
        if (concreteAliases.length > 0 || wildcardMatchers.length > 0) {
          currentStanza = {
            concreteAliases,
            wildcardMatchers,
            props: {},
          };
        }
      } else if (currentStanza) {
        // OpenSSH applies the first value seen for each directive.
        if (lowerKey === 'hostname' && !currentStanza.props.host) {
          currentStanza.props.host = val;
        } else if (lowerKey === 'user' && !currentStanza.props.user) {
          currentStanza.props.user = val;
        } else if (lowerKey === 'port' && !currentStanza.props.port) {
          const p = parseInt(val, 10);
          if (!isNaN(p) && p > 0) currentStanza.props.port = p;
        } else if (lowerKey === 'identityfile' && !currentStanza.props.key) {
          currentStanza.props.key = val;
        } else if (lowerKey === 'proxyjump' && !currentStanza.props.proxyJump) {
          if (val.toLowerCase() !== 'none') currentStanza.props.proxyJump = val;
        } else if (lowerKey === 'proxycommand' && !currentStanza.props.proxyCommand) {
          if (val.toLowerCase() !== 'none') currentStanza.props.proxyCommand = val;
        }
      }
    }

    parseConfig(sshConfigPath);
    flushCurrentStanza();

    for (const entry of concreteEntries) {
      const hName = entry.alias;
      const merged: Partial<ServerConfig> = { ...entry.props };
      for (const wc of wildcardStanzas) {
        if (wc.matchers.some((re) => re.test(hName))) {
          if (!merged.host && wc.props.host) merged.host = wc.props.host;
          if (!merged.user && wc.props.user) merged.user = wc.props.user;
          if (!merged.port && wc.props.port) merged.port = wc.props.port;
          if (!merged.key && wc.props.key) merged.key = wc.props.key;
          if (!merged.proxyJump && wc.props.proxyJump) merged.proxyJump = wc.props.proxyJump;
          if (!merged.proxyCommand && wc.props.proxyCommand) merged.proxyCommand = wc.props.proxyCommand;
          if (!merged.workspace && wc.props.workspace) merged.workspace = wc.props.workspace;
          if (!merged.authType && wc.props.authType) merged.authType = wc.props.authType;
        }
      }

      const pass = creds[hName];
      const effectiveUser = merged.user || defaultLocalUser || 'root';
      const sanitizedWs = sanitizeRemoteWorkspacePath(merged.workspace, effectiveUser, homeDir);
      servers.push({
        id: `server-ssh-${hName}`,
        name: hName,
        type: 'ssh',
        label: `Remote SSH (${hName})`,
        host: merged.host || hName,
        user: effectiveUser,
        port: merged.port || 22,
        authType: pass ? 'password' : (merged.authType || 'key'),
        key: merged.key,
        password: pass,
        proxyJump: merged.proxyJump,
        proxyCommand: merged.proxyCommand,
        desc: `SSH Host • ${effectiveUser}@${merged.host || hName}`,
        workspace: sanitizedWs,
        isConnected: false,
      });
    }
  } catch (err) {
    console.warn('Failed to parse ~/.ssh/config:', err);
  }

  return servers;
}

export function saveOrUpdateSshConfigHost(server: ServerConfig, homeDirOverride?: string): void {
  const homeDir = homeDirOverride || process.env.HOME || os.homedir();
  const sshDir = path.join(homeDir, '.ssh');
  if (!fs.existsSync(sshDir)) {
    fs.mkdirSync(sshDir, { mode: 0o700, recursive: true });
  }

  const existing = parseSshConfig(homeDir).find((s) => s.name === server.name);
  const effectiveUser = server.user || existing?.user || 'root';
  const effectiveProxyJump = server.proxyJump !== undefined ? server.proxyJump : existing?.proxyJump;
  const effectiveProxyCommand = server.proxyCommand !== undefined ? server.proxyCommand : existing?.proxyCommand;
  const effectiveKey = server.key !== undefined ? server.key : existing?.key;

  const sshConfigPath = path.join(sshDir, 'config');
  const escaped = server.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hostRegex = new RegExp(`(^|\\n)Host\\s+${escaped}(?:\\s[^\\n]*)?([\\s\\S]*?)(?=\\n\\s*(?:Host|Match)\\s+|$)`, 'i');

  let newBlock = `Host ${server.name}\n`;
  newBlock += `    HostName ${server.host}\n`;
  newBlock += `    Port ${server.port || 22}\n`;
  newBlock += `    User ${effectiveUser}\n`;
  if (server.authType === 'key' && effectiveKey) {
    newBlock += `    IdentityFile ${effectiveKey}\n`;
  }
  if (effectiveProxyJump) {
    newBlock += `    ProxyJump ${effectiveProxyJump}\n`;
  }
  if (effectiveProxyCommand) {
    newBlock += `    ProxyCommand ${effectiveProxyCommand}\n`;
  }
  if (server.authType === 'password') {
    newBlock += `    # AuthType password\n`;
  }
  if (server.workspace) {
    const rawWs = server.workspace.trim();
    const persistedWs =
      rawWs === '~' || rawWs.startsWith('~/')
        ? rawWs
        : sanitizeRemoteWorkspacePath(rawWs, effectiveUser, homeDir);
    newBlock += `    # Workspace ${persistedWs}\n`;
  }
  newBlock += `    StrictHostKeyChecking no\n`;
  newBlock += `    UserKnownHostsFile /dev/null\n`;

  let updatedInPlace = false;
  if (fs.existsSync(sshConfigPath)) {
    for (const configFile of listSshConfigFiles(sshConfigPath, homeDir)) {
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
    const creds = loadCredentials(homeDir);
    creds[server.name] = server.password;
    saveCredentials(creds, homeDir);
  }
}

export function updateSshConfigHostWorkspace(serverName: string, newWorkspace: string, homeDirOverride?: string): void {
  const homeDir = homeDirOverride || process.env.HOME || os.homedir();
  if (serverName === os.hostname() || serverName === 'localhost' || serverName === 'hungpc') {
    const normalized = normalizeWorkspacePath(newWorkspace, homeDir);
    const localWsFile = path.join(homeDir, '.ssh', 'hugcode_local_workspace.txt');
    try {
      fs.writeFileSync(localWsFile, normalized, { mode: 0o600 });
    } catch (_) {}
    return;
  }

  const rawTrimmed = (newWorkspace || '~').trim() || '~';
  const normalized =
    rawTrimmed === '~' || rawTrimmed.startsWith('~/')
      ? rawTrimmed
      : sanitizeRemoteWorkspacePath(rawTrimmed, 'root', homeDir);

  const sshConfigPath = path.join(homeDir, '.ssh', 'config');
  if (!fs.existsSync(sshConfigPath)) return;
  const escaped = serverName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hostRegex = new RegExp(`(^|\\n)(Host\\s+${escaped}(?:\\s[^\\n]*)?[\\s\\S]*?)(?=\\n\\s*(?:Host|Match)\\s+|$)`, 'i');
  for (const configFile of listSshConfigFiles(sshConfigPath, homeDir)) {
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
