export type SpotlightKind = 'project' | 'claude' | 'terminal';

export interface SpotlightServerInput {
  id: string;
  name: string;
  type?: string;
}

export interface SpotlightProjectInput {
  id: string;
  serverId: string;
  name: string;
  rootPath: string;
}

export interface SpotlightSessionInput {
  id: string;
  serverId: string;
  projectId?: string;
  name: string;
  cwd?: string;
}

export interface SpotlightItem {
  key: string;
  kind: SpotlightKind;
  id: string;
  title: string;
  subtitle: string;
  serverId: string;
  serverName: string;
  serverType: string;
  serverIndex: number;
  projectId?: string;
  projectName: string;
}

export interface BuildSpotlightInput {
  servers: SpotlightServerInput[];
  projects: SpotlightProjectInput[];
  terminals: SpotlightSessionInput[];
  claudes: SpotlightSessionInput[];
}

const KIND_ORDER: Record<SpotlightKind, number> = { project: 0, claude: 1, terminal: 2 };

export function normalizeSearchText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

function trimSlash(path?: string): string {
  return (path || '').trim().replace(/\/+$/, '') || '/';
}

function describeLocation(name: string, rootPath: string): string {
  const base = trimSlash(rootPath).split('/').pop() || '';
  return !name || name === '~' || name === base ? rootPath : `${name} · ${rootPath}`;
}

export function buildSpotlightItems(input: BuildSpotlightInput): SpotlightItem[] {
  const serverName = new Map(input.servers.map(s => [s.id, s.name]));
  const serverIndex = new Map(input.servers.map((s, i) => [s.id, i]));
  const serverType = new Map(input.servers.map(s => [s.id, s.type || 'local']));
  const serverIds = new Set(input.servers.map(s => s.id));
  const projects = input.projects.filter(p => serverIds.has(p.serverId));
  const projectById = new Map(projects.map(p => [`${p.serverId}\u0000${p.id}`, p]));

  const resolveProject = (s: SpotlightSessionInput): SpotlightProjectInput | undefined => {
    if (s.projectId) return projectById.get(`${s.serverId}\u0000${s.projectId}`);
    if (!s.cwd) return undefined;
    const cwd = trimSlash(s.cwd);
    return projects.find(p => p.serverId === s.serverId && trimSlash(p.rootPath) === cwd);
  };

  const items: SpotlightItem[] = [];

  for (const p of projects) {
    const srv = serverName.get(p.serverId) || p.serverId;
    items.push({
      key: `project:${p.serverId}:${p.id}`,
      kind: 'project',
      id: p.id,
      title: p.name,
      subtitle: p.rootPath,
      serverId: p.serverId,
      serverName: srv,
      serverType: serverType.get(p.serverId) || 'local',
      serverIndex: serverIndex.get(p.serverId) ?? 0,
      projectId: p.id,
      projectName: p.name,
    });
  }

  const seen = new Set<string>();
  const addSessions = (list: SpotlightSessionInput[], kind: 'claude' | 'terminal') => {
    for (const s of list) {
      if (!serverIds.has(s.serverId)) continue;
      const key = `${kind}:${s.serverId}:${s.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const srv = serverName.get(s.serverId) || s.serverId;
      const project = resolveProject(s);
      items.push({
        key,
        kind,
        id: s.id,
        title: s.name || (kind === 'claude' ? 'Claude' : 'Terminal'),
        subtitle: project ? describeLocation(project.name, project.rootPath) : s.cwd || '~',
        serverId: s.serverId,
        serverName: srv,
        serverType: serverType.get(s.serverId) || 'local',
        serverIndex: serverIndex.get(s.serverId) ?? 0,
        projectId: project?.id,
        projectName: project?.name || '',
      });
    }
  };
  addSessions(input.claudes, 'claude');
  addSessions(input.terminals, 'terminal');

  return items;
}

function isWordStart(haystack: string, index: number): boolean {
  if (index === 0) return true;
  return /[\s\-_./:·]/.test(haystack[index - 1]);
}

function scoreToken(token: string, title: string, rest: string): number {
  const at = title.indexOf(token);
  if (at === 0) return 100;
  if (at > 0) return isWordStart(title, at) ? 80 : 60;
  const inRest = rest.indexOf(token);
  if (inRest >= 0) return isWordStart(rest, inRest) ? 35 : 25;
  return 0;
}

export function scoreSpotlightItem(item: SpotlightItem, query: string): number {
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 1;
  const title = normalizeSearchText(item.title);
  const rest = normalizeSearchText(`${item.subtitle} ${item.projectName} ${item.serverName}`);
  let total = 0;
  for (const token of tokens) {
    const s = scoreToken(token, title, rest);
    if (s === 0) return 0;
    total += s;
  }
  return total;
}

export function filterSpotlightItems(
  items: SpotlightItem[],
  query: string,
  limit = 60
): SpotlightItem[] {
  const q = normalizeSearchText(query);
  const indexed = items.map((item, index) => ({ item, index, score: scoreSpotlightItem(item, q) }));
  const kept = indexed.filter(r => r.score > 0);
  kept.sort((a, b) => {
    if (!q) {
      return (
        a.item.serverIndex - b.item.serverIndex ||
        KIND_ORDER[a.item.kind] - KIND_ORDER[b.item.kind] ||
        a.index - b.index
      );
    }
    return b.score - a.score || KIND_ORDER[a.item.kind] - KIND_ORDER[b.item.kind] || a.index - b.index;
  });
  return kept.slice(0, limit).map(r => r.item);
}

export function isApplePlatform(platform: string): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform || '');
}

// Single global hotkey: Cmd+K on Apple platforms, Ctrl+Alt+K elsewhere.
export function isSpotlightHotkey(
  event: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>,
  platform: string
): boolean {
  const isK = event.code === 'KeyK' || event.key.toLowerCase() === 'k';
  if (!isK || event.shiftKey) return false;
  if (isApplePlatform(platform)) {
    return event.metaKey && !event.ctrlKey && !event.altKey;
  }
  return event.ctrlKey && event.altKey && !event.metaKey;
}

export function spotlightHotkeyLabel(platform: string): string {
  return isApplePlatform(platform) ? '⌘K' : 'Ctrl+Alt+K';
}
