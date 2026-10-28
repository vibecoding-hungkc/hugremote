import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, ChildProcess } from 'child_process';
import { StringDecoder } from 'string_decoder';
import { ALLOWED_ROOT, normalizeWorkspacePath, parseSshConfig, ServerConfig } from '../config.js';
import { sshPool } from './sshPool.js';
import { ClaudeEventNormalizer } from './claude/eventNormalizer.js';
import { ClaudeRunAssembler } from './claude/runAssembler.js';
import { NativeFrameDecoder, NativeFrameRecord } from './claude/nativeFrameDecoder.js';
import { ClaudeReplayBuffer, CURRENT_SESSION_SCHEMA_VERSION, migrateSessionRecord } from './claude/sessionMigration.js';

export interface ClaudeLimits {
  fiveHour: {
    usedPercent: number;
    resetIn: string;
  };
  weekly: {
    usedPercent: number;
    resetIn: string;
  };
}
export type ClaudeLimitsInfo = ClaudeLimits;

import type {
  ClaudeToolCall,
  ClaudeToolFamily,
  ClaudeMessage,
  ClaudeProjectSessionSummary,
  ClaudeProjectSessionDetail,
  ClaudeSession,
} from '@hugremote/shared';

export type {
  ClaudeToolCall,
  ClaudeToolFamily,
  ClaudeMessage,
  ClaudeProjectSessionSummary,
  ClaudeProjectSessionDetail,
  ClaudeSession,
};

export type ClaudeStreamEvent =
  | { type: 'thinking_start' }
  | { type: 'thinking'; text: string }
  | { type: 'tool_use'; tool: ClaudeToolCall }
  | { type: 'tool_result'; tool_use_id: string; output: string; status?: 'done' | 'error' }
  | { type: 'interaction_requested'; interaction: NonNullable<ClaudeMessage['interactions']>[number] }
  | { type: 'interaction_responded'; interactionId: string; response: any }
  | { type: 'interaction_cancelled'; interactionId: string }
  | { type: 'text_delta'; text: string }
  | { type: 'content_sync'; text: string; thinking: string }
  | { type: 'done'; text: string; usage?: any; contextTokens?: string }
  | { type: 'error'; error: string };

export interface ClaudeModelItem {
  id: string;
  title: string;
  desc: string;
  prefix: string;
  value: string;
  resolvedModel?: string;
  displayName: string;
  description: string;
  [metadata: string]: unknown;
}

export interface ClaudeModelsResult {
  source: 'settings' | 'cli' | 'fallback';
  defaultModel: string;
  models: ClaudeModelItem[];
}

export interface ClaudeContextUsage {
  source: 'cli';
  freshness: 'session' | 'selected-model';
  sessionSpecific: boolean;
  model: string;
  totalTokens: number;
  maxTokens: number;
  rawMaxTokens: number;
  percentage: number;
}

export class ContextUsageValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ContextUsageValidationError';
  }
}

export class ContextUsageNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message: string = 'Claude session not found') {
    super(message);
    this.name = 'ContextUsageNotFoundError';
  }
}

export class ContextUsageConcurrencyError extends Error {
  readonly statusCode = 429;
  constructor(message: string = 'Too many concurrent Claude context usage requests') {
    super(message);
    this.name = 'ContextUsageConcurrencyError';
  }
}

export function parseNativeContextUsage(value: unknown): Omit<ClaudeContextUsage, 'source' | 'freshness' | 'sessionSpecific'> {
  const invalid = () => new ContextUsageValidationError('Claude native context usage returned invalid summary');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const row = value as Record<string, unknown>;
  if (
    typeof row.model !== 'string' ||
    !row.model.trim() ||
    row.model.includes('\0') ||
    row.model.length > 256
  ) throw invalid();
  if (
    typeof row.totalTokens !== 'number' ||
    !Number.isSafeInteger(row.totalTokens) ||
    row.totalTokens < 0
  ) throw invalid();
  if (
    typeof row.maxTokens !== 'number' ||
    !Number.isSafeInteger(row.maxTokens) ||
    row.maxTokens <= 0
  ) throw invalid();
  if (
    typeof row.rawMaxTokens !== 'number' ||
    !Number.isSafeInteger(row.rawMaxTokens) ||
    row.rawMaxTokens <= 0
  ) throw invalid();
  if (
    typeof row.percentage !== 'number' ||
    !Number.isFinite(row.percentage) ||
    row.percentage < 0
  ) throw invalid();

  return {
    model: row.model,
    totalTokens: row.totalTokens,
    maxTokens: row.maxTokens,
    rawMaxTokens: row.rawMaxTokens,
    percentage: row.percentage,
  };
}

const STORAGE_FILE = path.join(os.homedir(), '.ssh', 'hugcode_claude_sessions.json');
const LIMITS_FILE = path.join(os.homedir(), '.ssh', 'hugcode_claude_limits.json');

function parseResetInToTimestamp(resetIn: string): number {
  let ms = 0;
  const hMatch = resetIn.match(/(\d+)\s*h/i);
  const mMatch = resetIn.match(/(\d+)\s*m/i);
  if (hMatch) ms += parseInt(hMatch[1], 10) * 3600 * 1000;
  if (mMatch) ms += parseInt(mMatch[1], 10) * 60 * 1000;
  if (ms === 0) ms = 3.5 * 3600 * 1000;
  return Date.now() + ms;
}

function formatMsToResetIn(msLeft: number): string {
  if (msLeft <= 0) return 'đã reset';
  const h = Math.floor(msLeft / (3600 * 1000));
  const m = Math.floor((msLeft % (3600 * 1000)) / (60 * 1000));
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Find claude binary
function getClaudeBinaryPath(): string {
  const custom = process.env.CLAUDE_BIN_PATH;
  if (custom && fs.existsSync(custom)) return custom;

  const localBin = path.join(os.homedir(), '.local', 'bin', 'claude');
  if (fs.existsSync(localBin)) return localBin;

  const extBinary = path.join(
    os.homedir(),
    '.local/share/code-server/extensions/anthropic.claude-code-2.1.292-linux-x64/resources/native-binary/claude'
  );
  if (fs.existsSync(extBinary)) return extBinary;

  return 'claude';
}

function shellEscape(arg: string): string {
  if (arg === '') return "''";
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

const MODELS_CACHE_TTL_MS = 30_000;

function normalizeRemotePath(raw: string): string {
  if (typeof raw !== 'string') throw new ContextUsageValidationError('Invalid Claude context usage cwd');
  if (raw.includes('\0')) throw new ContextUsageValidationError('Invalid Claude context usage cwd');
  const trimmed = raw.trim();
  if (!trimmed) return '~';
  if (trimmed.length > 4096) throw new ContextUsageValidationError('Claude context usage cwd exceeded maximum length');
  if (trimmed === '~' || trimmed === '$HOME') return '~';
  if (trimmed.startsWith('~/')) {
    const sub = path.posix.normalize(trimmed.slice(2));
    if (sub === '.' || sub === '') return '~';
    if (sub.startsWith('..')) throw new ContextUsageValidationError('Invalid Claude context usage cwd');
    return `~/${sub}`.replace(/\/+$/, '');
  }
  const norm = path.posix.normalize(trimmed);
  return norm.length > 1 ? norm.replace(/\/+$/, '') : norm;
}

/** Resolve discovery from home by default, not the API process directory. */
function resolveLocalClaudeCwd(cwd?: string): string {
  if (cwd !== undefined && typeof cwd !== 'string') {
    throw new ContextUsageValidationError('Invalid Claude context usage cwd');
  }
  const target = normalizeWorkspacePath(cwd || os.homedir());
  if (target.includes('\0')) throw new ContextUsageValidationError('Invalid Claude context usage cwd');
  if (target.length > 4096) throw new ContextUsageValidationError('Claude context usage cwd exceeded maximum length');
  let canonical: string;
  try {
    canonical = fs.realpathSync(target);
    if (!fs.statSync(canonical).isDirectory()) throw new Error('not a directory');
  } catch (_) { throw new ContextUsageValidationError('Claude context usage cwd must be an existing directory'); }
  if (cwd) {
    const root = fs.realpathSync(ALLOWED_ROOT);
    const relative = path.relative(root, canonical);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new ContextUsageValidationError('Claude context usage cwd is outside allowed root');
    }
  }
  return canonical;
}

function modelDiscoveryBinaryIdentity(binary: string): string {
  try {
    const real = fs.realpathSync(binary);
    const stat = fs.statSync(real);
    return `${real}:${stat.mtimeMs}:${stat.size}`;
  } catch (_) { return binary; }
}

/** Use only native initialize rows, never the /model syntax-help alias list. */
export function parseNativeModels(models: unknown): ClaudeModelsResult {
  const invalid = () => new Error('Claude native model discovery returned invalid model metadata');
  if (!Array.isArray(models) || models.length === 0) throw invalid();
  const seen = new Set<string>();
  const items: ClaudeModelItem[] = models.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)
      || typeof row.value !== 'string' || !row.value.trim()
      || typeof row.displayName !== 'string' || !row.displayName.trim()
      || typeof row.description !== 'string'
      || (row.resolvedModel !== undefined && (typeof row.resolvedModel !== 'string' || !row.resolvedModel.trim()))
      || (row.disabled !== undefined && typeof row.disabled !== 'boolean')
      || seen.has(row.value)) throw invalid();
    seen.add(row.value);
    return { ...row, id: row.value, title: row.displayName, desc: row.description, prefix: row.value };
  });
  const nativeDefault = items.find(row => row.value === 'default');
  if (!nativeDefault?.resolvedModel) throw invalid();
  return { source: 'cli', defaultModel: nativeDefault.resolvedModel, models: items };
}

export function classifyToolFamily(name: string): ClaudeToolFamily {
  const lower = (name || '').toLowerCase();
  if (lower === 'bash' || lower === 'command' || lower.startsWith('bash_')) return 'bash';
  if (lower === 'read' || lower === 'view' || lower.includes('file_read') || lower === 'cat') return 'read';
  if (lower.includes('edit') || lower.includes('replace') || lower.includes('write')) return 'edit';
  if (lower.includes('search') || lower.includes('grep') || lower.includes('glob') || lower.includes('find')) return 'search';
  if (lower.includes('web') || lower.includes('fetch') || lower.includes('browser') || lower.includes('curl')) return 'web';
  if (lower.includes('todo') || lower.includes('task_list') || lower.includes('checklist')) return 'todo';
  if (lower === 'task' || lower === 'agent' || lower.includes('subagent')) return 'agent';
  if (lower.startsWith('mcp_') || lower.startsWith('mcp__') || lower.includes('mcp')) return 'mcp';
  return 'generic';
}

export interface ClaudeProcessHandle {
  stdin?: NodeJS.WritableStream & { end?: () => void };
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  on(event: 'error', cb: (err: Error) => void): this | void;
  on(event: 'close', cb: (code: number | null, signal: string | null) => void): this | void;
  kill(signal?: string): void;
  readonly killed?: boolean;
}

export interface ClaudeTaskState {
  sessionId: string;
  runId?: string;
  userPrompt: string;
  status: 'running' | 'done' | 'error' | 'cancelled';
  startTime: number;
  liveMessage: ClaudeMessage;
  events: any[];
  listeners: Set<(event: any) => void>;
  normalizer?: ClaudeEventNormalizer;
  assembler?: ClaudeRunAssembler;
  replayBuffer?: ClaudeReplayBuffer;
  promise?: Promise<{ text: string; thinking?: string; tools?: ClaudeToolCall[] }>;
}

export class ClaudeService {
  private sessions: Map<string, ClaudeSession> = new Map();
  private activeProcesses: Map<string, ClaudeProcessHandle> = new Map();
  private activeTasks: Map<string, ClaudeTaskState> = new Map();
  private modelsCache: Map<string, { at: number; result: ClaudeModelsResult }> = new Map();
  private cancelledSessions: Set<string> = new Set();
  private limits: {
    fiveHour: { usedPercent: number; resetsAt: number };
    weekly: { usedPercent: number; resetsAt: number };
    updatedAt: number;
  } = {
    fiveHour: {
      usedPercent: 1,
      resetsAt: Date.now() + (3 * 3600 + 35 * 60) * 1000,
    },
    weekly: {
      usedPercent: 94,
      resetsAt: Date.now() + (20 * 3600 + 35 * 60) * 1000,
    },
    updatedAt: Date.now(),
  };

  public serverConfigResolver: (serverId: string) => ServerConfig | undefined = (id: string) => {
    return parseSshConfig().find((s) => s.id === id || s.name === id);
  };

  constructor() {
    this.loadSessions();
    this.loadLimits();
  }

  setServerConfigResolver(fn: (serverId: string) => ServerConfig | undefined) {
    this.serverConfigResolver = fn;
  }

  private loadLimits() {
    if (fs.existsSync(LIMITS_FILE)) {
      try {
        const raw = fs.readFileSync(LIMITS_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (data && data.fiveHour && data.weekly) {
          this.limits = {
            fiveHour: {
              usedPercent: typeof data.fiveHour.usedPercent === 'number' ? data.fiveHour.usedPercent : 1,
              resetsAt: data.fiveHour.resetsAt || (Date.now() + (3 * 3600 + 35 * 60) * 1000),
            },
            weekly: {
              usedPercent: typeof data.weekly.usedPercent === 'number' ? data.weekly.usedPercent : 94,
              resetsAt: data.weekly.resetsAt || (Date.now() + (20 * 3600 + 35 * 60) * 1000),
            },
            updatedAt: data.updatedAt || Date.now(),
          };
        }
      } catch (e) {
        console.error('Failed to load claude limits:', e);
      }
    }
  }

  private saveLimits() {
    try {
      const dir = path.dirname(LIMITS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LIMITS_FILE, JSON.stringify(this.limits, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save claude limits:', e);
    }
  }

  private loadSessions() {
    if (fs.existsSync(STORAGE_FILE)) {
      try {
        const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
        const list: ClaudeSession[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          let changed = false;
          list.forEach((s) => {
            const rawVersion = (s as any).schemaVersion;
            s = migrateSessionRecord(s);
            if (rawVersion !== (s as any).schemaVersion) {
              changed = true;
            }
            const isAutoDefault =
              !s.isCustomNamed &&
              (!s.messages || s.messages.length === 0) &&
              (s.name === 'hugcode' || s.name === 'hugremote');
            if (isAutoDefault) {
              changed = true;
              return;
            }
            if (typeof s.cliSessionId === 'string' && s.cliSessionId.trim() && !s.cliSessionId.includes('\0') && (!s.isCustomNamed || s.name === 'chat' || s.name === 'claude')) {
              const detail = this.getLocalProjectSessionDetail(s.cliSessionId.trim(), typeof s.cwd === 'string' ? s.cwd : '');
              if (detail && detail.summary && detail.summary !== 'Phiên chưa đặt tên') {
                s.name = detail.summary;
                s.isCustomNamed = true;
                changed = true;
              }
            }
            this.sessions.set(s.id, s);
          });
          if (changed) this.saveSessions();
        }
      } catch (e) {
        console.error('Failed to load claude sessions from disk:', e);
      }
    }
  }

  private saveSessions() {
    try {
      const dir = path.dirname(STORAGE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const list = Array.from(this.sessions.values());
      for (const session of list) {
        (session as any).schemaVersion = CURRENT_SESSION_SCHEMA_VERSION;
        if (!Array.isArray(session.messages)) session.messages = [];
        for (const message of session.messages) {
          if (!Array.isArray(message.childAgents)) message.childAgents = [];
          if (!Array.isArray(message.interactions)) message.interactions = [];
          for (const tool of message.tools || []) {
            if (!tool.status) tool.status = 'done';
            if (!tool.type) tool.type = 'generic';
          }
        }
      }
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save claude sessions to disk:', e);
    }
  }

  getTask(sessionId: string): ClaudeTaskState | undefined {
    return this.activeTasks.get(sessionId);
  }

  isTaskRunning(sessionId: string): boolean {
    const task = this.activeTasks.get(sessionId);
    return task?.status === 'running';
  }

  getSessionsForServer(serverId: string, defaultCwd = '', projectId = ''): ClaudeSession[] {
    const normDefaultCwd = defaultCwd ? path.resolve(defaultCwd) : '';
    const list = Array.from(this.sessions.values()).filter((s) => {
      if (s.serverId !== serverId) return false;
      if (projectId && s.projectId && s.projectId === projectId) return true;
      if (normDefaultCwd && s.cwd && path.resolve(s.cwd) === normDefaultCwd) return true;
      if (!projectId && !defaultCwd) return true;
      return false;
    });
    return list
      .map((s) => ({
        ...s,
        isRunning: this.isTaskRunning(s.id),
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getSession(id: string): ClaudeSession | undefined {
    const s = this.sessions.get(id);
    if (!s) return undefined;
    return {
      ...s,
      isRunning: this.isTaskRunning(s.id),
    };
  }

  createSession(
    serverId: string,
    projectIdOrName: string,
    nameOrCwd: string,
    cwdOrModel: string,
    modelOrMode = 'Sonnet 5.5 Medium',
    modeOrInitialPrompt: string | undefined = 'Auto',
    initialPromptOrBypass?: string | boolean,
    bypassPermissions = false,
    ownerEmail?: string
  ): ClaudeSession {
    let projectId = projectIdOrName;
    let name = nameOrCwd;
    let cwd = cwdOrModel;
    let model = modelOrMode;
    let mode = modeOrInitialPrompt || 'Auto';
    let initialPrompt = typeof initialPromptOrBypass === 'string' ? initialPromptOrBypass : undefined;

    // Backward compatibility for callers using the pre-project signature:
    // createSession(serverId, name, cwd, model, mode, initialPrompt, bypass)
    if (typeof initialPromptOrBypass === 'boolean') {
      projectId = '';
      name = projectIdOrName;
      cwd = nameOrCwd;
      model = cwdOrModel || 'Sonnet 5.5 Medium';
      mode = modelOrMode || 'Auto';
      initialPrompt = typeof modeOrInitialPrompt === 'string' && modeOrInitialPrompt !== 'Auto' ? modeOrInitialPrompt : undefined;
      bypassPermissions = initialPromptOrBypass;
    }

    const id = `claude-${serverId}-${Date.now()}`;
    const server = this.serverConfigResolver(serverId);
    const isRemote = Boolean(server && server.type === 'ssh' && server.id !== 'server-local');
    const normalizedCwd = isRemote
      ? ((cwd || '').trim() || server?.workspace || '~')
      : normalizeWorkspacePath(cwd);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const defaultMessages: ClaudeMessage[] = [];
    if (initialPrompt && initialPrompt.trim()) {
      defaultMessages.push({
        id: `msg-${Date.now()}`,
        sender: 'user',
        text: initialPrompt.trim(),
        time: timeStr,
      });
    }

    const session: ClaudeSession = {
      id,
      serverId,
      projectId,
      name: name || 'chat',
      cwd: normalizedCwd,
      isCustomNamed: Boolean(name && name !== 'chat' && name !== 'hugcode'),
      model,
      mode,
      ownerEmail,
      bypassPermissions,
      timer: '60m',
      contextTokens: '0',
      messages: defaultMessages,
      updatedAt: Date.now(),
    };

    this.sessions.set(id, session);
    this.saveSessions();
    return session;
  }

  updateSession(id: string, updates: Partial<ClaudeSession>): ClaudeSession | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    if (updates.serverId !== undefined || updates.cwd !== undefined || updates.model !== undefined || updates.cliSessionId !== undefined) {
      this.clearContextUsageCacheForSession(id);
    }

    if (updates.name !== undefined) {
      session.name = updates.name.trim();
      session.isCustomNamed = true;
    }
    if (updates.cwd !== undefined) {
      const server = this.serverConfigResolver(session.serverId);
      const isRemote = Boolean(server && server.type === 'ssh' && server.id !== 'server-local');
      session.cwd = isRemote
        ? ((updates.cwd || '').trim() || server?.workspace || '~')
        : normalizeWorkspacePath(updates.cwd);
    }
    if (updates.model !== undefined) session.model = updates.model;
    if (updates.mode !== undefined) session.mode = updates.mode;
    if (updates.bypassPermissions !== undefined) session.bypassPermissions = Boolean(updates.bypassPermissions);
    if (updates.timer !== undefined) session.timer = updates.timer;
    if (updates.contextTokens !== undefined) session.contextTokens = updates.contextTokens;

    session.updatedAt = Date.now();
    this.saveSessions();
    return session;
  }

  deleteSession(id: string): boolean {
    if (!this.sessions.has(id)) return false;
    this.clearContextUsageCacheForSession(id);
    this.sessions.delete(id);
    this.saveSessions();
    return true;
  }

  public estimateSessionTokens(messages: ClaudeMessage[]): string {
    let totalChars = 0;
    for (const m of messages) {
      totalChars += (m.text?.length || 0);
      totalChars += (m.thinking?.length || 0);
      if (m.tools && Array.isArray(m.tools)) {
        for (const t of m.tools) {
          totalChars += (t.title?.length || 0);
          totalChars += (t.content?.length || 0);
          totalChars += (t.output?.length || 0);
        }
      }
    }
    const estTokens = Math.round(totalChars / 3.8);
    return estTokens >= 1000 ? `${(estTokens / 1000).toFixed(1)}k` : `${estTokens}`;
  }

  addMessage(sessionId: string, message: ClaudeMessage, explicitContextTokens?: string): ClaudeSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.messages.push(message);
    session.updatedAt = Date.now();

    if (explicitContextTokens && explicitContextTokens !== '0' && explicitContextTokens !== '0k') {
      session.contextTokens = explicitContextTokens;
    } else if (!session.contextTokens || session.contextTokens === '0' || session.contextTokens === '0k') {
      session.contextTokens = this.estimateSessionTokens(session.messages);
    }

    this.saveSessions();
    return session;
  }

  clearMessages(sessionId: string): ClaudeSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.messages = [];
    session.contextTokens = '0';
    session.updatedAt = Date.now();
    this.saveSessions();
    return session;
  }

  public resolveClaudeProjectDir(cwd: string): string | null {
    if (!cwd) return null;
    let normalized = cwd;
    if (normalized.startsWith('~')) {
      normalized = path.join(os.homedir(), normalized.slice(1));
    }
    normalized = path.resolve(normalized);

    const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');
    if (!fs.existsSync(claudeProjectsDir)) return null;

    // 1. Direct slug match
    const slug = normalized.replace(/\//g, '-');
    const direct = path.join(claudeProjectsDir, slug);
    if (fs.existsSync(direct)) return direct;

    // 2. Parent directory search (e.g. if cwd is a subdirectory)
    let parent = normalized;
    while (parent && parent !== '/' && parent !== os.homedir()) {
      const parentSlug = parent.replace(/\//g, '-');
      const parentDir = path.join(claudeProjectsDir, parentSlug);
      if (fs.existsSync(parentDir)) return parentDir;
      parent = path.dirname(parent);
    }

    // 3. Scan all project dirs and inspect jsonl files for workingDirectory
    try {
      const dirs = fs.readdirSync(claudeProjectsDir);
      for (const d of dirs) {
        const fullDir = path.join(claudeProjectsDir, d);
        if (!fs.statSync(fullDir).isDirectory()) continue;
        const jsonls = fs.readdirSync(fullDir).filter((f) => f.endsWith('.jsonl'));
        if (jsonls.length > 0) {
          try {
            const sampleFile = path.join(fullDir, jsonls[0]);
            const sampleContent = fs.readFileSync(sampleFile, 'utf8');
            const lines = sampleContent.split('\n', 15);
            for (const l of lines) {
              if (l.includes('"workingDirectory"')) {
                const parsed = JSON.parse(l);
                const wDir = parsed.snapshot?.workingDirectory || parsed.workingDirectory;
                if (wDir && (normalized === wDir || normalized.startsWith(wDir))) {
                  return fullDir;
                }
              }
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    return null;
  }

  public async listProjectSessions(
    cwd: string,
    serverId = 'server-local'
  ): Promise<ClaudeProjectSessionSummary[]> {
    const isRemote = serverId !== 'server-local';
    const server = isRemote ? this.serverConfigResolver(serverId) : undefined;

    if (isRemote && server) {
      return this.listRemoteProjectSessions(server, cwd);
    }

    return this.listLocalProjectSessions(cwd);
  }

  private readProjectMeta(projectDir: string): Record<string, { name: string; updatedAt: number }> {
    try {
      const metaPath = path.join(projectDir, '.hugremote-meta.json');
      if (fs.existsSync(metaPath)) {
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      }
    } catch (_) {}
    return {};
  }

  private writeProjectMeta(projectDir: string, meta: Record<string, { name: string; updatedAt: number }>): void {
    try {
      const metaPath = path.join(projectDir, '.hugremote-meta.json');
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    } catch (_) {}
  }

  private listLocalProjectSessions(cwd: string): ClaudeProjectSessionSummary[] {
    const projectDir = this.resolveClaudeProjectDir(cwd);
    if (!projectDir || !fs.existsSync(projectDir)) {
      return this.collectRecentLocalProjectSessions();
    }

    try {
      const files = fs.readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'));
      const sessions: ClaudeProjectSessionSummary[] = [];
      const meta = this.readProjectMeta(projectDir);

      for (const f of files) {
        const fullPath = path.join(projectDir, f);
        const stat = fs.statSync(fullPath);
        const sessionId = f.replace('.jsonl', '');
        const summary = this.parseSessionSummary(fullPath, stat.mtimeMs, stat.size);
        if (summary) {
          summary.id = sessionId;
          summary.cwd = cwd;
          if (meta[sessionId]?.name) {
            summary.summary = meta[sessionId].name;
          }
          sessions.push(summary);
        }
      }

      sessions.sort((a, b) => b.updatedAt - a.updatedAt);
      return sessions;
    } catch (err) {
      console.error('listLocalProjectSessions error:', err);
      return [];
    }
  }

  private collectRecentLocalProjectSessions(): ClaudeProjectSessionSummary[] {
    const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');
    if (!fs.existsSync(claudeProjectsDir)) return [];

    try {
      const dirs = fs.readdirSync(claudeProjectsDir);
      const all: ClaudeProjectSessionSummary[] = [];

      for (const d of dirs) {
        const fullDir = path.join(claudeProjectsDir, d);
        if (!fs.statSync(fullDir).isDirectory()) continue;
        const files = fs.readdirSync(fullDir).filter((f) => f.endsWith('.jsonl'));
        const meta = this.readProjectMeta(fullDir);
        for (const f of files) {
          const fullPath = path.join(fullDir, f);
          const stat = fs.statSync(fullPath);
          const sessionId = f.replace('.jsonl', '');
          const summary = this.parseSessionSummary(fullPath, stat.mtimeMs, stat.size);
          if (summary) {
            summary.id = sessionId;
            if (meta[sessionId]?.name) {
              summary.summary = meta[sessionId].name;
            }
            all.push(summary);
          }
        }
      }

      all.sort((a, b) => b.updatedAt - a.updatedAt);
      return all.slice(0, 20);
    } catch (_) {
      return [];
    }
  }

  private parseSessionSummary(
    filePath: string,
    mtime: number,
    size: number
  ): ClaudeProjectSessionSummary | null {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      let firstPrompt = '';
      let lastPrompt = '';
      let customTitle = '';
      let model = '';
      let branch = '';
      let userMsgs = 0;
      let asstMsgs = 0;
      let latestContextTokens = 0;
      let totalCostUSD: number | undefined = undefined;

      for (const line of lines) {
        if (!line.trim().startsWith('{')) continue;
        try {
          const d = JSON.parse(line);
          if (d.type === 'cost-state') {
            if (typeof d.totalCostUSD === 'number') {
              totalCostUSD = d.totalCostUSD;
            }
            if (d.modelUsage && typeof d.modelUsage === 'object') {
              for (const mu of Object.values<any>(d.modelUsage)) {
                if (mu && typeof mu === 'object') {
                  const inTok = mu.inputTokens || 0;
                  const outTok = mu.outputTokens || 0;
                  const cRead = mu.cacheReadInputTokens || 0;
                  const cCreate = mu.cacheCreationInputTokens || 0;
                  const sum = inTok + outTok + cRead + cCreate;
                  if (sum > 0) latestContextTokens = sum;
                }
              }
            }
          } else if (d.type === 'assistant' && d.message?.usage) {
            const u = d.message.usage;
            const inTok = u.input_tokens || 0;
            const outTok = u.output_tokens || 0;
            const cRead = u.cache_read_input_tokens || 0;
            const cCreate = u.cache_creation_input_tokens || 0;
            const sum = inTok + outTok + cRead + cCreate;
            if (sum > 0) latestContextTokens = sum;
          }

          if (d.type === 'custom-title' && d.customTitle) {
            customTitle = String(d.customTitle).trim();
          } else if (d.type === 'user' && d.message) {
            userMsgs++;
            let c = d.message.content;
            if (Array.isArray(c)) {
              c = c.map((x: any) => (typeof x === 'string' ? x : x.text || '')).join(' ');
            }
            if (typeof c === 'string' && !firstPrompt && !c.startsWith('<local-command')) {
              firstPrompt = c.trim().slice(0, 120);
            }
          } else if (d.type === 'assistant' && d.message) {
            asstMsgs++;
          } else if (d.type === 'last-prompt') {
            const lp = d.lastPrompt;
            if (lp && typeof lp === 'string' && !lp.startsWith('<local-command')) {
              lastPrompt = lp.trim().slice(0, 120);
            }
          } else if (d.type === 'system' && d.gitBranch) {
            branch = d.gitBranch;
          } else if (d.attachment && d.attachment.type === 'model') {
            model = d.attachment.identity?.modelId || '';
          }
        } catch (_) {}
      }

      let summary = customTitle || lastPrompt || firstPrompt || 'Phiên chưa đặt tên';
      summary = summary.replace(/<[^>]+>/g, '').trim() || 'Phiên chưa đặt tên';

      let contextTokensStr: string | undefined = undefined;
      if (latestContextTokens >= 1000) {
        contextTokensStr = `${(latestContextTokens / 1000).toFixed(1)}k`;
      } else if (latestContextTokens > 0) {
        contextTokensStr = `${latestContextTokens}`;
      }

      return {
        id: '',
        summary,
        firstPrompt: firstPrompt ? firstPrompt.replace(/<[^>]+>/g, '').trim() : undefined,
        lastPrompt: lastPrompt ? lastPrompt.replace(/<[^>]+>/g, '').trim() : undefined,
        model: model || 'sonnet',
        branch,
        userMsgs,
        asstMsgs,
        updatedAt: mtime,
        size,
        contextTokens: contextTokensStr,
        totalCostUSD,
      };
    } catch (_) {
      return null;
    }
  }

  public async getProjectSessionDetail(
    sessionId: string,
    cwd: string,
    serverId = 'server-local'
  ): Promise<ClaudeProjectSessionDetail | null> {
    const isRemote = serverId !== 'server-local';
    const server = isRemote ? this.serverConfigResolver(serverId) : undefined;

    if (isRemote && server) {
      return this.getRemoteProjectSessionDetail(server, sessionId, cwd);
    }

    return this.getLocalProjectSessionDetail(sessionId, cwd);
  }

  private getLocalProjectSessionDetail(
    sessionId: string,
    cwd: string
  ): ClaudeProjectSessionDetail | null {
    const projectDir = this.resolveClaudeProjectDir(cwd);
    let targetFile = projectDir ? path.join(projectDir, `${sessionId}.jsonl`) : null;

    if (!targetFile || !fs.existsSync(targetFile)) {
      const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');
      if (fs.existsSync(claudeProjectsDir)) {
        for (const d of fs.readdirSync(claudeProjectsDir)) {
          const candidate = path.join(claudeProjectsDir, d, `${sessionId}.jsonl`);
          if (fs.existsSync(candidate)) {
            targetFile = candidate;
            break;
          }
        }
      }
    }

    if (!targetFile || !fs.existsSync(targetFile)) return null;

    const stat = fs.statSync(targetFile);
    const summary = this.parseSessionSummary(targetFile, stat.mtimeMs, stat.size);
    if (!summary) return null;

    summary.id = sessionId;

    // Check project metadata file
    const meta = this.readProjectMeta(path.dirname(targetFile));
    if (meta[sessionId]?.name) {
      summary.summary = meta[sessionId].name;
    }

    // Attempt to extract actual project workingDirectory from transcript
    try {
      const headLines = fs.readFileSync(targetFile, 'utf8').split('\n', 25);
      for (const hl of headLines) {
        if (hl.includes('"cwd"') || hl.includes('"workingDirectory"')) {
          const parsed = JSON.parse(hl);
          const realCwd = parsed.cwd || parsed.snapshot?.workingDirectory || parsed.workingDirectory;
          if (realCwd) {
            summary.cwd = realCwd;
            break;
          }
        }
      }
    } catch (_) {}
    if (!summary.cwd) summary.cwd = cwd;

    const messages = this.parseSessionMessages(targetFile);
    return {
      ...summary,
      messages,
    };
  }

  private parseSessionMessages(filePath: string): ClaudeMessage[] {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const messages: ClaudeMessage[] = [];

      for (const line of lines) {
        if (!line.trim().startsWith('{')) continue;
        try {
          const d = JSON.parse(line);
          const ts = d.timestamp ? new Date(d.timestamp) : new Date();
          const timeStr = `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`;

          if (d.type === 'user' && d.message) {
            let text = '';
            let c = d.message.content;
            if (typeof c === 'string') {
              text = c;
            } else if (Array.isArray(c)) {
              text = c.map((x: any) => (typeof x === 'string' ? x : x.text || '')).filter(Boolean).join('\n');
            }
            if (text.includes('<command-name>')) {
              const match = text.match(/<command-name>([^<]+)<\/command-name>/);
              if (match) text = match[1];
            }
            if (text.startsWith('<local-command-caveat>')) continue;

            if (text.trim()) {
              messages.push({
                id: d.uuid || `u-${Date.now()}-${Math.random()}`,
                sender: 'user',
                text: text.trim(),
                time: timeStr,
              });
            }
          } else if (d.type === 'assistant' && d.message) {
            let text = '';
            let thinking = '';
            let c = d.message.content;
            if (typeof c === 'string') {
              text = c;
            } else if (Array.isArray(c)) {
              for (const b of c) {
                if (typeof b === 'string') text += b;
                else if (b.type === 'text' && b.text) text += b.text;
                else if (b.type === 'thinking' && b.thinking) thinking += b.thinking;
              }
            }
            if (text.trim() || thinking.trim()) {
              messages.push({
                id: d.uuid || d.message.id || `a-${Date.now()}-${Math.random()}`,
                sender: 'assistant',
                text: text.trim(),
                thinking: thinking.trim() || undefined,
                time: timeStr,
              });
            }
          }
        } catch (_) {}
      }

      return messages;
    } catch (_) {
      return [];
    }
  }

  public async resumeProjectSession(
    cliSessionId: string,
    cwd: string,
    targetSessionId?: string,
    serverId = 'server-local',
    projectId?: string
  ): Promise<ClaudeSession | null> {
    const detail = await this.getProjectSessionDetail(cliSessionId, cwd, serverId);
    if (!detail) return null;

    const targetCwd = detail.cwd || cwd;
    const normTargetCwd = targetCwd ? path.resolve(targetCwd) : '';

    let session: ClaudeSession | undefined;
    if (targetSessionId) {
      const candidate = this.sessions.get(targetSessionId);
      if (candidate && candidate.serverId === serverId) {
        const candidateNormCwd = candidate.cwd ? path.resolve(candidate.cwd) : '';
        const isMatchCwd = candidateNormCwd === normTargetCwd;
        const isMatchProject = projectId && candidate.projectId === projectId;
        const isEmptySession = (!candidate.messages || candidate.messages.length === 0) && !candidate.cliSessionId;
        if (isMatchCwd || isMatchProject || isEmptySession) {
          session = candidate;
        }
      }
    }
    if (!session && normTargetCwd) {
      session = Array.from(this.sessions.values()).find(
        (s) => s.serverId === serverId && s.cwd && path.resolve(s.cwd) === normTargetCwd
      );
    }
    if (!session) {
      session = this.createSession(serverId, projectId || '', `Claude ${cliSessionId.slice(0, 8)}`, targetCwd);
    }

    session.cliSessionId = cliSessionId;
    session.messages = detail.messages;
    if (projectId) {
      session.projectId = projectId;
    }
    if (detail.model) session.model = detail.model;
    if (detail.summary && detail.summary !== 'Phiên chưa đặt tên') {
      session.name = detail.summary;
      session.isCustomNamed = true;
    } else if (!session.isCustomNamed || session.name === 'chat' || session.name === 'claude') {
      session.name = detail.summary || `Claude ${cliSessionId.slice(0, 8)}`;
      session.isCustomNamed = true;
    }
    if (targetCwd) {
      session.cwd = targetCwd;
    }
    session.updatedAt = Date.now();

    if (detail.contextTokens && detail.contextTokens !== '0' && detail.contextTokens !== '0k') {
      session.contextTokens = detail.contextTokens;
    } else {
      session.contextTokens = this.estimateSessionTokens(session.messages);
    }

    this.saveSessions();
    return session;
  }

  public async renameProjectSession(
    sessionId: string,
    newName: string,
    cwd?: string,
    serverId = 'server-local'
  ): Promise<boolean> {
    const isRemote = serverId !== 'server-local';
    const server = isRemote ? this.serverConfigResolver(serverId) : undefined;
    if (isRemote && server) {
      return this.renameRemoteProjectSession(server, sessionId, newName, cwd);
    }
    return this.renameLocalProjectSession(sessionId, newName, cwd);
  }

  private renameLocalProjectSession(sessionId: string, newName: string, cwd?: string): boolean {
    const cleanName = newName.trim();
    if (!cleanName) return false;

    let projectDir = cwd ? this.resolveClaudeProjectDir(cwd) : null;
    let filePath = projectDir ? path.join(projectDir, `${sessionId}.jsonl`) : '';

    if (!filePath || !fs.existsSync(filePath)) {
      const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');
      if (fs.existsSync(claudeProjectsDir)) {
        for (const d of fs.readdirSync(claudeProjectsDir)) {
          const checkDir = path.join(claudeProjectsDir, d);
          const candidate = path.join(checkDir, `${sessionId}.jsonl`);
          if (fs.existsSync(candidate)) {
            projectDir = checkDir;
            filePath = candidate;
            break;
          }
        }
      }
    }

    if (!filePath || !fs.existsSync(filePath) || !projectDir) {
      return false;
    }

    try {
      // 1. Update .hugremote-meta.json
      const meta = this.readProjectMeta(projectDir);
      meta[sessionId] = { name: cleanName, updatedAt: Date.now() };
      this.writeProjectMeta(projectDir, meta);

      // 2. Append custom-title record to .jsonl
      const entry = JSON.stringify({
        type: 'custom-title',
        customTitle: cleanName,
        updatedAt: Date.now(),
      });
      fs.appendFileSync(filePath, `\n${entry}\n`, 'utf8');

      // 3. Update active sessions if bound
      for (const s of this.sessions.values()) {
        if (s.cliSessionId === sessionId) {
          s.name = cleanName;
          s.isCustomNamed = true;
        }
      }
      this.saveSessions();
      return true;
    } catch (err) {
      console.error('renameLocalProjectSession error:', err);
      return false;
    }
  }

  public async deleteProjectSession(
    sessionId: string,
    cwd?: string,
    serverId = 'server-local'
  ): Promise<boolean> {
    const isRemote = serverId !== 'server-local';
    const server = isRemote ? this.serverConfigResolver(serverId) : undefined;
    if (isRemote && server) {
      return this.deleteRemoteProjectSession(server, sessionId, cwd);
    }
    return this.deleteLocalProjectSession(sessionId, cwd);
  }

  private deleteLocalProjectSession(sessionId: string, cwd?: string): boolean {
    let projectDir = cwd ? this.resolveClaudeProjectDir(cwd) : null;
    let filePath = projectDir ? path.join(projectDir, `${sessionId}.jsonl`) : '';

    if (!filePath || !fs.existsSync(filePath)) {
      const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');
      if (fs.existsSync(claudeProjectsDir)) {
        for (const d of fs.readdirSync(claudeProjectsDir)) {
          const checkDir = path.join(claudeProjectsDir, d);
          const candidate = path.join(checkDir, `${sessionId}.jsonl`);
          if (fs.existsSync(candidate)) {
            projectDir = checkDir;
            filePath = candidate;
            break;
          }
        }
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return false;
    }

    try {
      fs.unlinkSync(filePath);

      if (projectDir) {
        const meta = this.readProjectMeta(projectDir);
        if (meta[sessionId]) {
          delete meta[sessionId];
          this.writeProjectMeta(projectDir, meta);
        }
      }

      for (const s of this.sessions.values()) {
        if (s.cliSessionId === sessionId) {
          s.cliSessionId = undefined;
        }
      }
      this.saveSessions();
      return true;
    } catch (err) {
      console.error('deleteLocalProjectSession error:', err);
      return false;
    }
  }

  private async renameRemoteProjectSession(
    server: ServerConfig,
    sessionId: string,
    newName: string,
    cwd?: string
  ): Promise<boolean> {
    try {
      const escapedId = shellEscape(sessionId);
      const escapedName = shellEscape(newName.trim());
      const pyScript = `import os, glob, json, time; files = glob.glob(os.path.expanduser('~/.claude/projects/*/' + ${escapedId} + '.jsonl'));\nif files:\n  f = files[0]; entry = json.dumps({'type': 'custom-title', 'customTitle': ${escapedName}, 'updatedAt': int(time.time()*1000)})\n  with open(f, 'a') as fp: fp.write('\\n' + entry + '\\n')\n  pdir = os.path.dirname(f); meta_path = os.path.join(pdir, '.hugremote-meta.json'); meta = {}\n  if os.path.exists(meta_path): meta = json.load(open(meta_path))\n  meta[${escapedId}] = {'name': ${escapedName}, 'updatedAt': int(time.time()*1000)}\n  json.dump(meta, open(meta_path, 'w'), indent=2); print('ok')\nelse: print('not_found')`;
      const cmd = `python3 -c ${shellEscape(pyScript)} 2>/dev/null`;
      const stream = await sshPool.executeCommand(server, cmd);
      let data = '';
      await new Promise((resolve) => {
        stream.on('data', (d: any) => { data += d.toString('utf8'); });
        stream.on('close', resolve);
        stream.on('exit', resolve);
      });
      return data.trim() === 'ok';
    } catch (_) {
      return false;
    }
  }

  private async deleteRemoteProjectSession(
    server: ServerConfig,
    sessionId: string,
    cwd?: string
  ): Promise<boolean> {
    try {
      const escapedId = shellEscape(sessionId);
      const pyScript = `import os, glob; files = glob.glob(os.path.expanduser('~/.claude/projects/*/' + ${escapedId} + '.jsonl'));\nif files: os.remove(files[0]); print('ok')\nelse: print('not_found')`;
      const cmd = `python3 -c ${shellEscape(pyScript)} 2>/dev/null`;
      const stream = await sshPool.executeCommand(server, cmd);
      let data = '';
      await new Promise((resolve) => {
        stream.on('data', (d: any) => { data += d.toString('utf8'); });
        stream.on('close', resolve);
        stream.on('exit', resolve);
      });
      return data.trim() === 'ok';
    } catch (_) {
      return false;
    }
  }

  private async listRemoteProjectSessions(
    server: ServerConfig,
    cwd: string
  ): Promise<ClaudeProjectSessionSummary[]> {
    try {
      const escapedCwd = shellEscape(cwd || server.workspace || '~');
      const pyScript = `import os, glob, json; cwd = os.path.expanduser(${escapedCwd}); slug = cwd.replace('/', '-'); pdir = os.path.expanduser('~/.claude/projects/' + slug); files = glob.glob(pdir + '/*.jsonl') if os.path.exists(pdir) else glob.glob(os.path.expanduser('~/.claude/projects/*/*.jsonl')); out = [];\nfor f in sorted(files, key=os.path.getmtime, reverse=True)[:20]:\n  sid = os.path.basename(f).replace('.jsonl', ''); s = ''; fp = '';\n  for l in open(f, errors='ignore'):\n    try:\n      d = json.loads(l)\n      if d.get('type') == 'user' and not fp: fp = str(d['message']['content'])[:80]\n      elif d.get('type') == 'last-prompt': s = str(d['lastPrompt'])[:80]\n    except: pass\n  out.append({'id': sid, 'summary': s or fp or 'Phiên chưa đặt tên', 'model': 'sonnet', 'userMsgs': 1, 'asstMsgs': 1, 'updatedAt': os.path.getmtime(f) * 1000, 'size': os.path.getsize(f)})\nprint(json.dumps(out))`;
      const cmd = `python3 -c ${shellEscape(pyScript)} 2>/dev/null || node -e 'console.log("[]")'`;
      const stream = await sshPool.executeCommand(server, cmd);
      let data = '';
      await new Promise((resolve) => {
        stream.on('data', (d: any) => {
          data += d.toString('utf8');
        });
        stream.on('close', resolve);
        stream.on('exit', resolve);
      });
      return JSON.parse(data.trim() || '[]');
    } catch (_) {
      return [];
    }
  }

  private async getRemoteProjectSessionDetail(
    server: ServerConfig,
    sessionId: string,
    cwd: string
  ): Promise<ClaudeProjectSessionDetail | null> {
    try {
      const escapedId = shellEscape(sessionId);
      const pyScript = `import os, glob, json; files = glob.glob(os.path.expanduser('~/.claude/projects/*/' + ${escapedId} + '.jsonl'));\nif not files: print('null')\nelse:\n  f = files[0]; msgs = []\n  for l in open(f, errors='ignore'):\n    try:\n      d = json.loads(l)\n      if d.get('type') in ['user', 'assistant'] and 'message' in d:\n        c = d['message'].get('content', '')\n        text = c if isinstance(c, str) else ' '.join(x.get('text', '') for x in c if isinstance(x, dict))\n        if text.strip(): msgs.append({'id': d.get('uuid', str(len(msgs))), 'sender': d['type'], 'text': text.strip(), 'time': '12:00'})\n    except: pass\n  print(json.dumps({'id': ${escapedId}, 'summary': 'Phiên Claude', 'model': 'sonnet', 'userMsgs': len(msgs), 'asstMsgs': 0, 'updatedAt': os.path.getmtime(f)*1000, 'size': os.path.getsize(f), 'messages': msgs}))`;
      const cmd = `python3 -c ${shellEscape(pyScript)} 2>/dev/null`;
      const stream = await sshPool.executeCommand(server, cmd);
      let data = '';
      await new Promise((resolve) => {
        stream.on('data', (d: any) => {
          data += d.toString('utf8');
        });
        stream.on('close', resolve);
        stream.on('exit', resolve);
      });
      const parsed = JSON.parse(data.trim() || 'null');
      return parsed;
    } catch (_) {
      return null;
    }
  }

  getLimits(): ClaudeLimitsInfo {
    this.loadLimits();
    const now = Date.now();
    let fiveHourMs = this.limits.fiveHour.resetsAt - now;
    let weeklyMs = this.limits.weekly.resetsAt - now;

    let fiveHourPercent = this.limits.fiveHour.usedPercent;
    let weeklyPercent = this.limits.weekly.usedPercent;

    if (fiveHourMs <= 0) {
      fiveHourPercent = 0;
      fiveHourMs = 0;
    }
    if (weeklyMs <= 0) {
      weeklyPercent = 0;
      weeklyMs = 0;
    }

    return {
      fiveHour: {
        usedPercent: fiveHourPercent,
        resetIn: formatMsToResetIn(fiveHourMs),
      },
      weekly: {
        usedPercent: weeklyPercent,
        resetIn: formatMsToResetIn(weeklyMs),
      },
    };
  }

  updateLimits(payload: {
    rawText?: string;
    fiveHour?: { usedPercent?: number; resetIn?: string };
    weekly?: { usedPercent?: number; resetIn?: string };
  }): ClaudeLimitsInfo {
    if (payload.rawText && typeof payload.rawText === 'string') {
      const text = payload.rawText;
      const usageMatch = text.match(/Usage[^\d]*(\d+)%\s*\((?:resets in\s*)?([^)]+)\)/i);
      if (usageMatch) {
        this.limits.fiveHour.usedPercent = parseInt(usageMatch[1], 10);
        this.limits.fiveHour.resetsAt = parseResetInToTimestamp(usageMatch[2]);
      }
      const weeklyMatch = text.match(/Weekly[^\d]*(\d+)%\s*\((?:resets in\s*)?([^)]+)\)/i);
      if (weeklyMatch) {
        this.limits.weekly.usedPercent = parseInt(weeklyMatch[1], 10);
        this.limits.weekly.resetsAt = parseResetInToTimestamp(weeklyMatch[2]);
      }
    }

    if (payload.fiveHour) {
      if (typeof payload.fiveHour.usedPercent === 'number') {
        this.limits.fiveHour.usedPercent = payload.fiveHour.usedPercent;
      }
      if (payload.fiveHour.resetIn) {
        this.limits.fiveHour.resetsAt = parseResetInToTimestamp(payload.fiveHour.resetIn);
      }
    }

    if (payload.weekly) {
      if (typeof payload.weekly.usedPercent === 'number') {
        this.limits.weekly.usedPercent = payload.weekly.usedPercent;
      }
      if (payload.weekly.resetIn) {
        this.limits.weekly.resetsAt = parseResetInToTimestamp(payload.weekly.resetIn);
      }
    }

    this.limits.updatedAt = Date.now();
    this.saveLimits();
    return this.getLimits();
  }

  // Separate spawn seam keeps discovery tests off the real CLI and user sessions.
  private spawnModelDiscovery = spawn;
  private modelDiscoveryTimeoutMs = 15_000;
  private modelDiscoveryKillGraceMs = 1_000;
  private contextUsageCache = new Map<string, { sessionId: string; result: ClaudeContextUsage; at: number }>();
  private inFlightContextUsage = new Map<string, Promise<ClaudeContextUsage>>();
  private contextUsageScopeEpoch = new WeakMap<object, number>();
  private nextContextUsageScopeEpoch = 0;
  private activeContextUsageProbes = 0;
  private static readonly MAX_CONCURRENT_CONTEXT_PROBES = 4;
  private static readonly CONTEXT_USAGE_CACHE_TTL_MS = 2_000;
  private static readonly MAX_CONTEXT_USAGE_CACHE_ENTRIES = 24;

  private clearContextUsageCacheForSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.contextUsageScopeEpoch.set(session, ++this.nextContextUsageScopeEpoch);
    }
    for (const [key, entry] of this.contextUsageCache) {
      if (entry.sessionId === sessionId) this.contextUsageCache.delete(key);
    }
  }

  private pruneContextUsageCache(now: number): void {
    for (const [key, entry] of this.contextUsageCache) {
      if (now - entry.at >= ClaudeService.CONTEXT_USAGE_CACHE_TTL_MS) {
        this.contextUsageCache.delete(key);
      }
    }
  }

  private trimContextUsageCache(): void {
    while (this.contextUsageCache.size > ClaudeService.MAX_CONTEXT_USAGE_CACHE_ENTRIES) {
      const oldestKey = this.contextUsageCache.keys().next().value;
      if (oldestKey === undefined) break;
      this.contextUsageCache.delete(oldestKey);
    }
  }

  async getContextUsage(
    sessionId: string,
    selected: { serverId?: string; cwd?: string; model?: string } = {}
  ): Promise<ClaudeContextUsage> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new ContextUsageNotFoundError('Claude session not found');

    if (session.serverId !== undefined && (typeof session.serverId !== 'string' || session.serverId.includes('\0') || session.serverId.length > 256)) {
      throw new ContextUsageValidationError('Claude context usage session has corrupt serverId');
    }
    const canonicalServerId = session.serverId || 'server-local';

    if (selected.serverId !== undefined) {
      if (typeof selected.serverId !== 'string' || selected.serverId.includes('\0') || selected.serverId.length > 256) {
        throw new ContextUsageValidationError('Invalid Claude context usage target');
      }
      const selectedServerId = selected.serverId || 'server-local';
      if (selectedServerId !== canonicalServerId) {
        throw new ContextUsageValidationError('Claude context usage serverId mismatch for session');
      }
    }

    const server = this.serverConfigResolver(canonicalServerId);
    if (!server && canonicalServerId !== 'server-local') {
      throw new ContextUsageValidationError('Unknown Claude context usage target');
    }
    const remote = server?.type === 'ssh';

    let targetCwd: string;
    if (remote) {
      if (session.cwd !== undefined && (typeof session.cwd !== 'string' || session.cwd.includes('\0') || session.cwd.length > 4096)) {
        throw new ContextUsageValidationError('Claude context usage session has corrupt cwd');
      }
      const canonicalRemoteCwd = normalizeRemotePath(session.cwd?.trim() || server?.workspace?.trim() || '~');
      if (selected.cwd !== undefined) {
        if (typeof selected.cwd !== 'string' || selected.cwd.includes('\0') || selected.cwd.length > 4096) {
          throw new ContextUsageValidationError('Invalid Claude context usage cwd');
        }
        const selectedRemoteCwd = normalizeRemotePath(selected.cwd);
        if (selectedRemoteCwd !== canonicalRemoteCwd) {
          throw new ContextUsageValidationError('Claude context usage cwd mismatch for session');
        }
      }
      targetCwd = canonicalRemoteCwd;
    } else {
      if (session.cwd !== undefined && (typeof session.cwd !== 'string' || session.cwd.includes('\0') || session.cwd.length > 4096)) {
        throw new ContextUsageValidationError('Claude context usage session has corrupt cwd');
      }
      const canonicalLocalCwd = resolveLocalClaudeCwd(session.cwd || undefined);
      if (selected.cwd !== undefined) {
        if (typeof selected.cwd !== 'string' || selected.cwd.includes('\0') || selected.cwd.length > 4096) {
          throw new ContextUsageValidationError('Invalid Claude context usage cwd');
        }
        const selectedLocalCwd = resolveLocalClaudeCwd(selected.cwd);
        if (selectedLocalCwd !== canonicalLocalCwd) {
          throw new ContextUsageValidationError('Claude context usage cwd mismatch for session');
        }
      }
      targetCwd = canonicalLocalCwd;
    }

    let modelSelection = '';
    if (selected.model !== undefined) {
      if (typeof selected.model !== 'string' || selected.model.includes('\0') || selected.model.length > 256) {
        throw new ContextUsageValidationError('Invalid Claude context usage model');
      }
      modelSelection = selected.model.trim();
    } else if (session.model !== undefined) {
      if (typeof session.model === 'string' && !session.model.includes('\0') && session.model.length <= 256) {
        modelSelection = session.model.trim();
      }
    }
    const baseModel = modelSelection.replace(/\s+(Low|Medium|High|Max)$/i, '').trim();
    const modelArg = !baseModel || /^default$/i.test(baseModel) ? null : baseModel;

    let resumeId: string | null = null;
    if (typeof session.cliSessionId === 'string' && !session.cliSessionId.includes('\0')) {
      const trimmed = session.cliSessionId.trim();
      if (trimmed.length > 0 && trimmed.length <= 256 && !/[\r\n\t]/.test(trimmed)) {
        resumeId = trimmed;
      }
    }

    const scopeEpoch = this.contextUsageScopeEpoch.get(session) || 0;
    const cacheKey = JSON.stringify([session.id, canonicalServerId, targetCwd, modelArg, resumeId, scopeEpoch]);
    const now = Date.now();
    this.pruneContextUsageCache(now);

    const cached = this.contextUsageCache.get(cacheKey);
    if (cached) {
      // Reinsertion keeps iteration order as a simple LRU queue.
      this.contextUsageCache.delete(cacheKey);
      this.contextUsageCache.set(cacheKey, cached);
      return cached.result;
    }

    const inFlight = this.inFlightContextUsage.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    if (this.activeContextUsageProbes >= ClaudeService.MAX_CONCURRENT_CONTEXT_PROBES) {
      throw new ContextUsageConcurrencyError('Too many concurrent Claude context usage requests');
    }

    const args = [
      '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '-p',
      '--no-session-persistence',
      ...(modelArg ? ['--model', modelArg] : []),
      ...(resumeId ? ['--resume', resumeId] : []),
    ];

    this.activeContextUsageProbes++;
    const probePromise = (async () => {
      try {
        const native = await this.executeContextUsageProbe(targetCwd, remote, server, args);
        const result: ClaudeContextUsage = {
          source: 'cli',
          freshness: resumeId ? 'session' : 'selected-model',
          sessionSpecific: Boolean(resumeId),
          ...native,
        };
        this.pruneContextUsageCache(Date.now());
        if (this.sessions.get(sessionId) === session && (this.contextUsageScopeEpoch.get(session) || 0) === scopeEpoch) {
          this.contextUsageCache.set(cacheKey, { sessionId: session.id, result, at: Date.now() });
          this.trimContextUsageCache();
        }
        return result;
      } finally {
        this.activeContextUsageProbes--;
        this.inFlightContextUsage.delete(cacheKey);
      }
    })();

    this.inFlightContextUsage.set(cacheKey, probePromise);
    return probePromise;
  }

  private async executeContextUsageProbe(
    targetCwd: string,
    remote: boolean,
    server: any,
    args: string[]
  ): Promise<ReturnType<typeof parseNativeContextUsage>> {
    let proc: {
      stdin: NodeJS.WritableStream; stdout: NodeJS.ReadableStream; stderr: NodeJS.ReadableStream;
      on(event: string, callback: (...args: any[]) => void): unknown;
      removeListener?(event: string, callback: (...args: any[]) => void): unknown;
      kill(signal: string): unknown;
    };
    if (remote && server) {
      const remoteCwd = targetCwd === '~' ? '"$HOME"'
        : targetCwd.startsWith('~/') ? `"$HOME"/${shellEscape(targetCwd.slice(2))}` : shellEscape(targetCwd);
      const command = `export PATH="$HOME/.local/bin:$HOME/.nvm/versions/node/$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | tail -n 1)/bin:$HOME/.fnm/current/bin:$HOME/.local/share/fnm/current/bin:$HOME/.bun/bin:$HOME/.pnpm:$HOME/.local/share/pnpm:/usr/local/bin:$PATH"; cd -- ${remoteCwd} && exec env CLAUDE_CODE_CONFIG_PROBE=1 claude ${args.map(shellEscape).join(' ')}`;
      const channel = await new Promise<Awaited<ReturnType<typeof sshPool.executeCommand>>>((resolve, reject) => {
        let expired = false;
        const timer = setTimeout(() => {
          expired = true;
          reject(new Error('Claude context usage timed out opening SSH channel'));
        }, this.modelDiscoveryTimeoutMs);
        sshPool.executeCommand(server, command).then(channel => {
          clearTimeout(timer);
          if (expired) {
            try { channel.signal('TERM'); } catch (_) {}
            try { channel.close(); } catch (_) {}
          } else resolve(channel);
        }, error => { clearTimeout(timer); reject(error); });
      });
      proc = {
        stdin: channel, stdout: channel, stderr: channel.stderr,
        on: (event, callback) => channel.on(event, callback),
        removeListener: (event, callback) => {
          try { (channel as any).removeListener?.(event, callback); } catch (_) {}
        },
        kill: () => {
          try { channel.signal('TERM'); } catch (_) {}
          try { channel.close(); } catch (_) {}
        },
      };
    } else {
      const binary = getClaudeBinaryPath();
      const child = this.spawnModelDiscovery(binary, args, {
        cwd: targetCwd, stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CLAUDE_CODE_CONFIG_PROBE: '1', PATH: `${path.join(os.homedir(), '.local', 'bin')}:${process.env.PATH}` },
      });
      proc = {
        stdin: child.stdin!, stdout: child.stdout!, stderr: child.stderr!,
        on: (event, callback) => child.on(event, callback),
        removeListener: (event, callback) => {
          try { (child as any).removeListener?.(event, callback); } catch (_) {}
        },
        kill: signal => child.kill(signal as NodeJS.Signals),
      };
    }

    const requestId = `context-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise<ReturnType<typeof parseNativeContextUsage>>((resolve, reject) => {
      let buffer = '';
      let bytes = 0;
      let settled = false;
      let closed = false;
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      const decoder = new StringDecoder('utf8');

      let listenersCleaned = false;
      const cleanupDataListeners = () => {
        try { (proc.stdout as any)?.removeListener?.('data', onData); } catch (_) {}
        try { (proc.stderr as any)?.removeListener?.('data', onStderr); } catch (_) {}
      };
      const cleanupListeners = () => {
        if (listenersCleaned) return;
        listenersCleaned = true;
        clearTimeout(killTimer);
        cleanupDataListeners();
        try { proc.removeListener?.('close', onClose); } catch (_) {}
        try { proc.removeListener?.('error', onError); } catch (_) {}
        try { (proc.stdin as any)?.removeListener?.('error', onError); } catch (_) {}
        try { (proc.stdout as any)?.removeListener?.('error', onError); } catch (_) {}
        try { (proc.stderr as any)?.removeListener?.('error', onError); } catch (_) {}
      };

      const finish = (error?: unknown, result?: ReturnType<typeof parseNativeContextUsage>) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanupDataListeners();
        // Keep close/error guards through termination: end()/SIGTERM can emit a
        // synchronous or late EPIPE. The close handler cancels escalation.
        try { proc.stdin?.end(); } catch (_) {}
        try { proc.kill('SIGTERM'); } catch (_) {}
        if (closed) {
          cleanupListeners();
        } else {
          killTimer = setTimeout(() => {
            if (!closed && !remote) {
              try { proc.kill('SIGKILL'); } catch (_) {}
            }
            cleanupListeners();
          }, this.modelDiscoveryKillGraceMs);
          killTimer.unref();
        }
        if (error) reject(error); else resolve(result!);
      };

      const countOutput = (chunk: Buffer | string) => {
        bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
        if (bytes > 1_048_576) {
          finish(new Error('Claude context usage output exceeded limit'));
          return false;
        }
        return true;
      };

      const onStderr = (chunk: Buffer | string) => { if (!settled) countOutput(chunk); };
      const onData = (chunk: Buffer | string) => {
        if (settled || !countOutput(chunk)) return;
        buffer += decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let message: any;
          try { message = JSON.parse(line); }
          catch (_) { finish(new Error('Claude context usage returned malformed JSONL')); return; }
          if (message?.type !== 'control_response' || message.response?.request_id !== requestId) continue;
          if (message.response.subtype !== 'success') {
            finish(new Error('Claude context usage request failed or denied'));
          } else {
            try { finish(undefined, parseNativeContextUsage(message.response.response)); }
            catch (error) { finish(error); }
          }
          return;
        }
      };

      const onClose = () => {
        closed = true;
        clearTimeout(killTimer);
        if (!settled && buffer.trim()) {
          buffer += decoder.end();
          onData('\n');
        }
        if (!settled) finish(new Error('Claude context usage closed with no correlated response'));
        cleanupListeners();
      };

      const onError = (error: Error) => finish(new Error(`Claude context usage transport error: ${error.message}`));

      const timer = setTimeout(
        () => finish(new Error('Claude context usage timed out waiting for correlated response')),
        this.modelDiscoveryTimeoutMs
      );

      proc.on('close', onClose);
      proc.on('error', onError);
      (proc.stdin as any)?.on?.('error', onError);
      (proc.stdout as any)?.on?.('error', onError);
      (proc.stderr as any)?.on?.('error', onError);
      (proc.stdout as any)?.on?.('data', onData);
      (proc.stderr as any)?.on?.('data', onStderr);

      try {
        proc.stdin.write(JSON.stringify({
          type: 'control_request', request_id: requestId,
          request: { subtype: 'get_context_usage', detail: 'summary' },
        }) + '\n');
      } catch (error) { finish(error); }
    });
  }

  async getAvailableModels(serverId?: string, forceRefresh = false, cwd?: string): Promise<ClaudeModelsResult> {
    const sId = serverId || 'server-local';
    const server = this.serverConfigResolver(sId);
    if (!server && sId !== 'server-local') throw new Error('Unknown Claude model discovery target');
    const remote = server?.type === 'ssh';
    const targetCwd = remote ? (cwd?.trim() || server.workspace?.trim() || '~') : resolveLocalClaudeCwd(cwd);
    if (targetCwd.includes('\0')) throw new Error('Invalid Claude model discovery cwd');
    const binary = remote ? 'claude' : getClaudeBinaryPath();
    const cacheKey = JSON.stringify([sId, server?.type || 'local', server?.host, server?.port, server?.user, targetCwd,
      remote ? binary : modelDiscoveryBinaryIdentity(binary)]);
    const cached = this.modelsCache.get(cacheKey);
    if (!forceRefresh && cached && Date.now() - cached.at < MODELS_CACHE_TTL_MS) return cached.result;
    const args = ['--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '-p', '--no-session-persistence'];
    let proc: {
      stdin: NodeJS.WritableStream; stdout: NodeJS.ReadableStream; stderr: NodeJS.ReadableStream;
      on(event: string, callback: (...args: any[]) => void): unknown;
      kill(signal: string): unknown;
    };
    if (server?.type === 'ssh') {
      const remoteCwd = targetCwd === '~' ? '"$HOME"'
        : targetCwd.startsWith('~/') ? `"$HOME"/${shellEscape(targetCwd.slice(2))}` : shellEscape(targetCwd);
      const command = `export PATH="$HOME/.local/bin:$HOME/.nvm/versions/node/$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | tail -n 1)/bin:$HOME/.fnm/current/bin:$HOME/.local/share/fnm/current/bin:$HOME/.bun/bin:$HOME/.pnpm:$HOME/.local/share/pnpm:/usr/local/bin:$PATH"; cd -- ${remoteCwd} && exec env CLAUDE_CODE_CONFIG_PROBE=1 claude ${args.map(shellEscape).join(' ')}`;
      const channel = await new Promise<Awaited<ReturnType<typeof sshPool.executeCommand>>>((resolve, reject) => {
        let expired = false;
        const timer = setTimeout(() => {
          expired = true;
          reject(new Error('Claude model discovery timed out opening SSH channel'));
        }, this.modelDiscoveryTimeoutMs);
        sshPool.executeCommand(server, command).then(channel => {
          clearTimeout(timer);
          if (expired) {
            try { channel.signal('TERM'); } catch (_) {}
            try { channel.close(); } catch (_) {}
          } else resolve(channel);
        }, error => { clearTimeout(timer); reject(error); });
      });
      proc = {
        stdin: channel, stdout: channel, stderr: channel.stderr,
        on: (event, callback) => channel.on(event, callback),
        kill: () => {
          try { channel.signal('TERM'); } catch (_) {}
          try { channel.close(); } catch (_) {}
        },
      };
    } else {
      const child = this.spawnModelDiscovery(binary, args, {
        cwd: targetCwd, stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CLAUDE_CODE_CONFIG_PROBE: '1', PATH: `${path.join(os.homedir(), '.local', 'bin')}:${process.env.PATH}` },
      });
      proc = { stdin: child.stdin!, stdout: child.stdout!, stderr: child.stderr!, on: (event, callback) => child.on(event, callback), kill: signal => child.kill(signal as NodeJS.Signals) };
    }
    const requestId = `models-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await new Promise<ClaudeModelsResult>((resolve, reject) => {
      let buffer = '';
      let bytes = 0;
      let settled = false;
      let closed = false;
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      const decoder = new StringDecoder('utf8');
      const finish = (error?: unknown, result?: ClaudeModelsResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        proc.stdout!.removeListener('data', onData);
        proc.stderr!.removeListener('data', onStderr);
        // Keep error handlers until streams die: SIGTERM/EOF can trigger late EPIPE.
        try { proc.stdin!.end(); } catch (_) {}
        try { proc.kill('SIGTERM'); } catch (_) {}
        if (!remote && !closed) {
          killTimer = setTimeout(() => {
            if (!closed) try { proc.kill('SIGKILL'); } catch (_) {}
          }, this.modelDiscoveryKillGraceMs);
          killTimer.unref();
        }
        if (error) reject(error); else resolve(result!);
      };
      const countOutput = (chunk: Buffer | string) => {
        bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
        if (bytes > 1_048_576) {
          finish(new Error('Claude model discovery output exceeded limit'));
          return false;
        }
        return true;
      };
      const onStderr = (chunk: Buffer | string) => { if (!settled) countOutput(chunk); };
      const onData = (chunk: Buffer | string) => {
        if (settled || !countOutput(chunk)) return;
        buffer += decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let message: any;
          try { message = JSON.parse(line); }
          catch (_) { finish(new Error('Claude model discovery returned malformed JSONL')); return; }
          if (message?.type !== 'control_response' || message.response?.request_id !== requestId) continue;
          if (message.response.subtype !== 'success') {
            finish(new Error('Claude model discovery initialize failed or denied'));
          } else {
            try { finish(undefined, parseNativeModels(message.response.response?.models)); }
            catch (error) { finish(error); }
          }
          return;
        }
      };
      const timer = setTimeout(() => finish(new Error('Claude model discovery timed out waiting for initialize response')), this.modelDiscoveryTimeoutMs);
      proc.on('close', () => {
        closed = true;
        clearTimeout(killTimer);
        if (!settled && buffer.trim()) {
          buffer += decoder.end();
          onData('\n');
        }
        finish(new Error('Claude model discovery closed with no initialize response'));
      });
      const onError = (error: Error) => finish(new Error(`Claude model discovery transport error: ${error.message}`));
      proc.on('error', onError);
      proc.stdin!.on('error', onError);
      proc.stdout!.on('error', onError);
      proc.stderr!.on('error', onError);
      proc.stdout!.on('data', onData);
      proc.stderr!.on('data', onStderr);
      try {
        proc.stdin!.write(JSON.stringify({ type: 'control_request', request_id: requestId, request: { subtype: 'initialize' } }) + '\n');
      } catch (error) { finish(error); }
    });
    this.modelsCache.set(cacheKey, { at: Date.now(), result });
    return result;
  }

  cancelRun(sessionId: string): boolean {
    const task = this.activeTasks.get(sessionId);
    if (task && task.status === 'running') {
      task.status = 'cancelled';
      task.liveMessage.isWorking = false;
      task.liveMessage.isThinking = false;
      task.liveMessage.text = task.liveMessage.text
        ? (task.liveMessage.text + '\n\n[Đã dừng yêu cầu]')
        : 'Đã dừng yêu cầu.';
      if (task.liveMessage.tools) {
        for (const tool of task.liveMessage.tools) {
          if (!tool.status || tool.status === 'running' || tool.status === 'receiving-input' || tool.status === 'ready') {
            tool.status = 'cancelled';
          }
        }
      }
      for (const interaction of task.liveMessage.interactions || []) {
        if (interaction.status !== 'pending') continue;
        if (task.assembler) {
          task.assembler.applyNormalizedEvent({
            schemaVersion: 1,
            runId: task.runId || task.sessionId,
            sessionId: task.sessionId,
            type: 'interaction.cancelled',
            interactionId: interaction.interactionId,
            timestamp: Date.now()
          });
        }
        this.publishInteractionTaskEvent(task, {
          type: 'interaction_cancelled', interactionId: interaction.interactionId
        });
      }
      const session = this.sessions.get(sessionId);
      if (session) {
        const idx = session.messages.findIndex((m) => m.id === task.liveMessage.id);
        if (idx !== -1) {
          session.messages[idx] = { ...task.liveMessage };
        }
        this.saveSessions();
      }
      const doneEvt = { type: 'done', text: task.liveMessage.text };
      for (const listener of task.listeners) {
        try {
          listener(doneEvt);
        } catch (_) {}
      }
    }
    this.cancelledSessions.add(sessionId);
    const child = this.activeProcesses.get(sessionId);
    if (!child) return Boolean(task && task.status === 'cancelled');
    try {
      child.kill('SIGINT');
      setTimeout(() => {
        if (this.activeProcesses.get(sessionId) === child) {
          try { child.kill('SIGTERM'); } catch (_) {}
        }
      }, 1200).unref();
      return true;
    } catch (_) {
      return false;
    }
  }

  private publishInteractionTaskEvent(task: ClaudeTaskState, event: ClaudeStreamEvent): void {
    if (!task.replayBuffer) task.replayBuffer = new ClaudeReplayBuffer(1000);
    const sequenced = task.replayBuffer.append(event);
    (event as ClaudeStreamEvent & { sequence?: number }).sequence = sequenced.sequence;

    if (event.type === 'interaction_responded') {
      const interaction = task.liveMessage.interactions?.find(
        (item) => item.interactionId === event.interactionId
      );
      if (interaction) {
        interaction.status = 'responded';
        interaction.response = event.response;
      }
    } else if (event.type === 'interaction_cancelled') {
      const interaction = task.liveMessage.interactions?.find(
        (item) => item.interactionId === event.interactionId
      );
      if (interaction) interaction.status = 'cancelled';
    }

    task.events.push(event);
    if (task.events.length > 1000) task.events.shift();
    for (const listener of task.listeners) {
      try { listener(event); } catch (_) {}
    }
  }

  respondInteraction(sessionId: string, interactionId: string, response?: any): boolean {
    const task = this.activeTasks.get(sessionId);
    if (!task || task.status !== 'running' || !task.assembler) return false;
    const proc = this.activeProcesses.get(sessionId);
    if (!proc || !proc.stdin) return false;
    const stdin = proc.stdin as any;
    if (stdin.writableEnded || stdin.destroyed || stdin.writable === false) return false;

    const interaction = task.assembler.getSnapshot().interactions.find(
      (item) => item.interactionId === interactionId
    );
    if (!interaction || interaction.status !== 'pending') return false;

    try {
      const rawResponse = response && typeof response === 'object' ? response : {};
      const resolvedResponse: Record<string, unknown> = {};
      if (typeof rawResponse.behavior === 'string') resolvedResponse.behavior = rawResponse.behavior.slice(0, 64);
      if (typeof rawResponse.optionId === 'string') resolvedResponse.optionId = rawResponse.optionId.slice(0, 128);
      if (typeof rawResponse.selected_option_id === 'string') resolvedResponse.selected_option_id = rawResponse.selected_option_id.slice(0, 128);
      if (rawResponse.input !== undefined) resolvedResponse.input = rawResponse.input;
      if (rawResponse.response !== undefined) resolvedResponse.response = rawResponse.response;

      const payload = JSON.stringify({
        type: 'control_response',
        response: {
          subtype: 'success',
          request_id: interactionId,
          response: resolvedResponse
        }
      }) + '\n';
      const writeOk = proc.stdin.write(payload);
      if (writeOk === false && (stdin.writableEnded || stdin.destroyed)) return false;
      const ok = task.assembler.applyNormalizedEvent({
        schemaVersion: 1,
        runId: task.runId || task.sessionId,
        sessionId: task.sessionId,
        type: 'interaction.responded',
        interactionId,
        response: resolvedResponse,
        timestamp: Date.now()
      });
      if (!ok) return false;
      this.publishInteractionTaskEvent(task, {
        type: 'interaction_responded', interactionId, response: resolvedResponse
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  cancelInteraction(sessionId: string, interactionId: string): boolean {
    const task = this.activeTasks.get(sessionId);
    if (!task || task.status !== 'running' || !task.assembler) return false;
    const proc = this.activeProcesses.get(sessionId);
    if (!proc || !proc.stdin) return false;
    const stdin = proc.stdin as any;
    if (stdin.writableEnded || stdin.destroyed || stdin.writable === false) return false;

    const interaction = task.assembler.getSnapshot().interactions.find(
      (item) => item.interactionId === interactionId
    );
    if (!interaction || interaction.status !== 'pending') return false;

    try {
      const payload = JSON.stringify({
        type: 'control_cancel_request',
        request_id: interactionId
      }) + '\n';
      const writeOk = proc.stdin.write(payload);
      if (writeOk === false && (stdin.writableEnded || stdin.destroyed)) return false;
      const ok = task.assembler.applyNormalizedEvent({
        schemaVersion: 1,
        runId: task.runId || task.sessionId,
        sessionId: task.sessionId,
        type: 'interaction.cancelled',
        interactionId,
        timestamp: Date.now()
      });
      if (!ok) return false;
      this.publishInteractionTaskEvent(task, { type: 'interaction_cancelled', interactionId });
      return true;
    } catch (_) {
      return false;
    }
  }

  private spawnLocalClaude(
    session: ClaudeSession,
    args: string[],
    claudeSettingsEnv: Record<string, string>
  ): ClaudeProcessHandle {
    const bin = getClaudeBinaryPath();
    const child = spawn(bin, args, {
      cwd: session.cwd || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...claudeSettingsEnv,
        PATH: `${path.join(os.homedir(), '.local', 'bin')}:${process.env.PATH}`,
      },
    });

    return {
      stdin: child.stdin,
      stdout: child.stdout,
      stderr: child.stderr,
      on: (event: string, cb: any) => {
        child.on(event as any, cb);
      },
      kill: (signal?: string) => {
        child.kill((signal as any) || 'SIGINT');
      },
      get killed() {
        return child.killed;
      },
    };
  }

  private async spawnRemoteClaude(
    server: ServerConfig,
    session: ClaudeSession,
    args: string[]
  ): Promise<ClaudeProcessHandle> {
    const escapedArgs = args.map(shellEscape).join(' ');
    const targetCwd = (session.cwd || server.workspace || '').trim();
    let cdCmd = '';
    if (targetCwd === '~' || targetCwd === '') {
      cdCmd = 'cd -- "$HOME" && ';
    } else if (targetCwd.startsWith('~/')) {
      const sub = targetCwd.slice(2);
      cdCmd = `cd -- "$HOME"/${shellEscape(sub)} && `;
    } else {
      cdCmd = `cd -- ${shellEscape(targetCwd)} && `;
    }
    const remoteCmd = `export PATH="$HOME/.local/bin:$HOME/.nvm/versions/node/$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | tail -n 1)/bin:$HOME/.fnm/current/bin:$HOME/.local/share/fnm/current/bin:$HOME/.bun/bin:$HOME/.pnpm:$HOME/.local/share/pnpm:/usr/local/bin:$PATH"; ${cdCmd}claude ${escapedArgs}`;

    const stream = await sshPool.executeCommand(server, remoteCmd);
    let exitCode: number | null = null;
    let exitSignal: string | null = null;
    let killed = false;

    stream.on('exit', (code: any, sig: any) => {
      exitCode = typeof code === 'number' ? code : null;
      exitSignal = sig || null;
    });

    return {
      stdin: stream,
      stdout: stream,
      stderr: stream.stderr,
      on: (event: string, cb: any) => {
        if (event === 'close') {
          stream.on('close', () => cb(exitCode, exitSignal));
        } else {
          stream.on(event as any, cb);
        }
      },
      kill: (signal?: string) => {
        killed = true;
        try {
          stream.signal((signal === 'SIGTERM' ? 'TERM' : 'INT') as any);
        } catch (_) {}
        try {
          stream.close();
        } catch (_) {}
      },
      get killed() {
        return killed;
      },
    };
  }

  startBackgroundPrompt(session: ClaudeSession, userPrompt: string): ClaudeTaskState {
    // getSession() is a public read snapshot. Run against the persisted owner so
    // CLI resume identity/context updates survive the next HTTP hydration/reload.
    session = this.sessions.get(session.id) || session;
    const existing = this.activeTasks.get(session.id);
    if (existing && existing.status === 'running') {
      return existing;
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const liveAsstMsg: ClaudeMessage = {
      id: `msg-${Date.now()}-a`,
      sender: 'assistant',
      text: '',
      thinking: '',
      isThinking: true,
      isWorking: true,
      isThinkingExpanded: true,
      tools: [],
      time: timeStr,
    };

    session.messages.push(liveAsstMsg);
    session.updatedAt = Date.now();
    this.saveSessions();

    const taskRunId = `${session.id}:${Date.now()}`;
    const task: ClaudeTaskState = {
      sessionId: session.id,
      runId: taskRunId,
      userPrompt,
      status: 'running',
      startTime: Date.now(),
      liveMessage: liveAsstMsg,
      events: [],
      listeners: new Set(),
      normalizer: new ClaudeEventNormalizer({ sessionId: session.id, runId: taskRunId }),
      assembler: new ClaudeRunAssembler(),
      replayBuffer: new ClaudeReplayBuffer(1000),
    };

    this.activeTasks.set(session.id, task);

    const onEvent = (event: any) => {
      if (!task.replayBuffer) {
        task.replayBuffer = new ClaudeReplayBuffer(1000);
      }
      const sequenced = task.replayBuffer.append(event);
      event.sequence = sequenced.sequence;

      if (event.type === 'thinking_start') {
        task.liveMessage.isThinking = true;
        task.liveMessage.isThinkingExpanded = true;
      } else if (event.type === 'thinking') {
        task.liveMessage.thinking = (task.liveMessage.thinking || '') + (event.text || '');
      } else if (event.type === 'tool_use') {
        task.liveMessage.isThinking = false;
        task.liveMessage.tools = task.liveMessage.tools || [];
        task.liveMessage.tools.push(event.tool);
      } else if (event.type === 'tool_result') {
        const found = task.liveMessage.tools?.find((t) => t.id === event.tool_use_id);
        if (found) {
          found.output = event.output;
          found.status = event.status;
        }
      } else if (event.type === 'interaction_requested') {
        task.liveMessage.interactions = task.liveMessage.interactions || [];
        const index = task.liveMessage.interactions.findIndex(
          (interaction) => interaction.interactionId === event.interaction.interactionId
        );
        if (index >= 0) task.liveMessage.interactions[index] = event.interaction;
        else task.liveMessage.interactions.push(event.interaction);
      } else if (event.type === 'interaction_responded') {
        const interaction = task.liveMessage.interactions?.find(
          (item) => item.interactionId === event.interactionId
        );
        if (interaction) {
          interaction.status = 'responded';
          interaction.response = event.response;
        }
      } else if (event.type === 'interaction_cancelled') {
        const interaction = task.liveMessage.interactions?.find(
          (item) => item.interactionId === event.interactionId
        );
        if (interaction) interaction.status = 'cancelled';
      } else if (event.type === 'content_sync') {
        task.liveMessage.text = event.text ?? '';
        task.liveMessage.thinking = event.thinking ?? '';
      } else if (event.type === 'text_delta') {
        task.liveMessage.isThinking = false;
        task.liveMessage.text = (task.liveMessage.text || '') + (event.text || '');
      } else if (event.type === 'done') {
        // Claude's native result frame is terminal even though the child process
        // may emit close on a later tick. Publish the terminal task state before
        // SSE listeners observe `done`, otherwise the client can rehydrate a
        // stale `isRunning: true` snapshot and leave the Stop button stuck.
        if (task.status === 'running') task.status = 'done';
        task.liveMessage.isThinking = false;
        task.liveMessage.isWorking = false;
        if (event.text) {
          task.liveMessage.text = event.text;
        }
      }

      task.events.push(event);
      if (task.events.length > 1000) {
        task.events.shift();
      }

      for (const listener of task.listeners) {
        try {
          listener(event);
        } catch (_) {}
      }
    };

    task.promise = this.streamClaudePrompt(session, userPrompt, onEvent)
      .then((finalResult) => {
        if (task.status !== 'cancelled') task.status = 'done';
        task.liveMessage.isWorking = false;
        task.liveMessage.isThinking = false;
        if (finalResult.text) {
          task.liveMessage.text = finalResult.text;
        }
        if (finalResult.thinking) {
          task.liveMessage.thinking = finalResult.thinking;
        }
        if (finalResult.tools) {
          task.liveMessage.tools = finalResult.tools;
        }
        const idx = session.messages.findIndex((m) => m.id === liveAsstMsg.id);
        if (idx !== -1) {
          session.messages[idx] = { ...task.liveMessage };
        }
        session.updatedAt = Date.now();
        this.saveSessions();

        const finishEvent = {
          type: 'finish',
          assistantMessage: task.liveMessage,
          contextTokens: session.contextTokens,
        };
        for (const listener of task.listeners) {
          try {
            listener(finishEvent);
          } catch (_) {}
        }
        return finalResult;
      })
      .catch((err: any) => {
        task.status = 'error';
        task.liveMessage.isWorking = false;
        task.liveMessage.isThinking = false;
        task.liveMessage.text = `Lỗi thực thi: ${err.message || err}`;
        const idx = session.messages.findIndex((m) => m.id === liveAsstMsg.id);
        if (idx !== -1) {
          session.messages[idx] = { ...task.liveMessage };
        }
        session.updatedAt = Date.now();
        this.saveSessions();

        const errEvent = { type: 'error', error: err.message || err };
        for (const listener of task.listeners) {
          try {
            listener(errEvent);
          } catch (_) {}
        }
        return { text: task.liveMessage.text };
      })
      .finally(() => {
        const cleanupTimer = setTimeout(() => {
          if (this.activeTasks.get(session.id) === task) {
            this.activeTasks.delete(session.id);
          }
        }, 10 * 60 * 1000);
        cleanupTimer.unref();
      });

    return task;
  }

  async streamClaudePrompt(
    session: ClaudeSession,
    userPrompt: string,
    onEvent: (event: ClaudeStreamEvent) => void
  ): Promise<{ text: string; thinking?: string; tools?: ClaudeToolCall[] }> {
    const server = session.serverId ? this.serverConfigResolver(session.serverId) : undefined;
    const isRemote = Boolean(server && server.type === 'ssh' && server.id !== 'server-local');

    if (session.serverId && session.serverId !== 'server-local' && !server) {
      const errorText = `Không tìm thấy thông tin cấu hình máy chủ "${session.serverId}" trong SSH config.`;
      onEvent({ type: 'error', error: errorText });
      return { text: errorText };
    }

    const trimmedPrompt = userPrompt.trim();
    if (trimmedPrompt === '/help') {
      const helpText = `### 💡 Danh sách Slash Commands hỗ trợ trong Claude Chat\n\n` +
        `- **/clear**: Xoá sạch lịch sử tin nhắn trong phiên hiện tại.\n` +
        `- **/resume [id]**: Mở trình quản lý phiên (Hub) hoặc chuyển sang phiên khác bằng ID/tên.\n` +
        `- **/model [name]**: Chọn Model hoặc đổi nhanh (\`sonnet\`, \`opus\`, \`haiku\`).\n` +
        `- **/usage**: Xem hạn mức sử dụng (quota 5 giờ và theo tuần).\n` +
        `- **/status**: Xem thông tin trạng thái phiên hiện tại, model và máy chủ.\n` +
        `- **/context**: Trực quan hoá mức độ chiếm dụng của Context Window.\n` +
        `- **/cost**: Thống kê số lượng token và chi phí API của phiên làm việc.\n` +
        `- **/compact [focus]**: Tóm tắt và nén ngữ cảnh hội thoại để tiết kiệm token.\n` +
        `- **/review**: Yêu cầu Claude review toàn bộ git diff tìm lỗi và cải thiện code.\n` +
        `- **/security-review**: Quét và phân tích các lỗ hổng bảo mật trong mã nguồn.\n` +
        `- **/plan [nhiệm vụ]**: Bật chế độ lập kế hoạch giải pháp trước khi code.\n` +
        `- **/commit**: Phân tích git diff và tự động tạo git commit message.\n` +
        `- **/init**: Khởi tạo file hướng dẫn \`CLAUDE.md\` cho dự án.\n` +
        `- **/permissions**: Bật / tắt chế độ bỏ qua hỏi quyền thực thi (Bypass Permissions).\n` +
        `- **/effort [low|medium|high|max]**: Đặt mức độ tư duy/suy nghĩ cho Claude.\n` +
        `- **/todos**: Kiểm tra danh sách các đầu việc đang theo dõi trong dự án.`;
      onEvent({ type: 'text_delta', text: helpText });
      onEvent({ type: 'done', text: helpText });
      return { text: helpText };
    }

    if (trimmedPrompt === '/status') {
      const srvName = session.serverId || 'server-local';
      const statusText = `### ℹ️ Trạng thái phiên làm việc Claude\n\n` +
        `- **Phiên:** ${session.name || 'Không xác định'} (\`${session.id}\`)\n` +
        `- **Model:** \`${session.model || 'Default Medium'}\`\n` +
        `- **Chế độ:** \`${session.mode || 'Auto'}\` (Bypass Permissions: **${session.bypassPermissions ? 'Bật' : 'Tắt'}**)\n` +
        `- **Thư mục (CWD):** \`${session.cwd || 'N/A'}\`\n` +
        `- **Máy chủ:** \`${srvName}\`\n` +
        `- **Số tin nhắn:** ${session.messages.length}\n` +
        `- **CLI Session ID:** \`${session.cliSessionId || 'Chưa khởi tạo'}\``;
      onEvent({ type: 'text_delta', text: statusText });
      onEvent({ type: 'done', text: statusText });
      return { text: statusText };
    }

    if (trimmedPrompt === '/resume') {
      const projectSessions = await this.listProjectSessions(session.cwd || '', session.serverId || 'server-local');
      const list = projectSessions.slice(0, 15).map((s, idx) => {
        const isCur = s.id === session.cliSessionId;
        const timeStr = new Date(s.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        return `${idx + 1}. \`${s.id.slice(0, 8)}\` • **"${s.summary}"** (${s.userMsgs} tin nhắn, ${timeStr})${isCur ? ' *(đang kết nối)*' : ''}`;
      }).join('\n');
      const resumeText = `### 📂 Danh sách phiên làm việc Claude Code (Project Sessions)\n\n` +
        `📁 **Thư mục dự án:** \`${session.cwd || '~'}\`\n\n` +
        `${list || '*Chưa tìm thấy phiên Claude CLI nào trong thư mục dự án này.*'}\n\n` +
        `👉 *Gõ \`/resume <số thứ tự hoặc ID>\` (ví dụ \`/resume 1\` hoặc \`/resume ${projectSessions[0]?.id.slice(0, 8) || 'uuid'}\`) để khôi phục phiên.*`;
      onEvent({ type: 'text_delta', text: resumeText });
      onEvent({ type: 'done', text: resumeText });
      return { text: resumeText };
    }

    if (trimmedPrompt.startsWith('/resume ')) {
      const query = trimmedPrompt.slice(8).trim().toLowerCase();
      const projectSessions = await this.listProjectSessions(session.cwd || '', session.serverId || 'server-local');
      const idxNum = parseInt(query, 10);
      let target = (!isNaN(idxNum) && idxNum >= 1 && idxNum <= projectSessions.length) ? projectSessions[idxNum - 1] : null;
      if (!target) {
        target = projectSessions.find((s) =>
          s.id.toLowerCase() === query ||
          s.id.toLowerCase().startsWith(query) ||
          s.summary.toLowerCase().includes(query)
        ) || null;
      }
      if (target) {
        const resumed = await this.resumeProjectSession(target.id, session.cwd || '', session.id, session.serverId || 'server-local');
        const resumeText = `✅ **Đã khôi phục phiên Claude Code:** \`${target.id}\`\n\n` +
          `- **Chủ đề / Prompt:** "${target.summary}"\n` +
          `- **Số tin nhắn:** ${resumed?.messages.length || target.userMsgs}\n` +
          `- **Model:** ${resumed?.model || target.model}\n\n` +
          `Ngữ cảnh đã sẵn sàng. Bạn có thể tiếp tục gửi tin nhắn trong phiên này.`;
        onEvent({ type: 'text_delta', text: resumeText });
        onEvent({ type: 'done', text: resumeText });
        return { text: resumeText };
      } else {
        const notFoundText = `❌ Không tìm thấy phiên Claude CLI nào khớp với "${query}". Gõ \`/resume\` để xem danh sách phiên dự án.`;
        onEvent({ type: 'text_delta', text: notFoundText });
        onEvent({ type: 'done', text: notFoundText });
        return { text: notFoundText };
      }
    }

    // Load custom env from ~/.claude/settings.json if present
    let claudeSettingsEnv: Record<string, string> = {};
    if (!isRemote) {
      const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
      if (fs.existsSync(settingsPath)) {
        try {
          const rawSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          if (rawSettings && typeof rawSettings.env === 'object') {
            claudeSettingsEnv = rawSettings.env;
          }
        } catch (_) {}
      }
    }

    // Map model
    const selection = (session.model || '').trim();
    const baseModel = selection.replace(/\s+(Low|Medium|High|Max)$/i, '').trim();
    // Preserve native CLI values. Only migrate old built-in display titles;
    // arbitrary custom IDs must never collapse via substring matching.
    const legacyTitle = baseModel.match(/^(Sonnet|Sonet|Opus|Haiku|Fable)(?:\s+\d+(?:\.\d+)*)?$/i);
    const modelArg = !baseModel || /^default$/i.test(baseModel)
      ? null
      : legacyTitle ? legacyTitle[1].toLowerCase().replace('sonet', 'sonnet') : baseModel;

    const effortMatch = selection.match(/\s+(Low|Medium|High|Max)$/i);
    const effortArg = (effortMatch?.[1] || 'Medium').toLowerCase();

    const modeKey = (session.mode || 'Auto').toLowerCase().replace(/[^a-z]/g, '');
    const permissionModeMap: Record<string, string> = {
      auto: 'auto',
      plan: 'plan',
      manual: 'manual',
      acceptedits: 'acceptEdits',
    };
    const permissionModeArg = session.bypassPermissions
      ? 'bypassPermissions'
      : (permissionModeMap[modeKey] || 'auto');

    const args = [
      '-p',
      '--input-format',
      'stream-json',
      ...(modelArg ? ['--model', modelArg] : []),
      '--effort',
      effortArg,
      '--permission-mode',
      permissionModeArg,
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--verbose',
    ];
    if (session.bypassPermissions) {
      args.push('--dangerously-skip-permissions');
    }
    if (session.cliSessionId) {
      let cliExists = true;
      if (!isRemote) {
        const pdir = this.resolveClaudeProjectDir(session.cwd || process.cwd());
        if (pdir) {
          const jsonlFile = path.join(pdir, `${session.cliSessionId}.jsonl`);
          if (!fs.existsSync(jsonlFile)) {
            cliExists = false;
          }
        }
      }
      if (cliExists) {
        args.push('--resume', session.cliSessionId);
      } else {
        session.cliSessionId = undefined;
        this.saveSessions();
      }
    }

    let handle: ClaudeProcessHandle;
    try {
      if (isRemote && server) {
        handle = await this.spawnRemoteClaude(server, session, args);
      } else {
        handle = this.spawnLocalClaude(session, args, claudeSettingsEnv);
      }
    } catch (err: any) {
      this.cancelledSessions.delete(session.id);
      const targetLabel = isRemote && server ? `máy chủ remote "${server.label || server.name}"` : 'máy chủ nội bộ';
      const errorText = `Không thể khởi chạy Claude Code trên ${targetLabel}: ${err.message || err}`;
      onEvent({ type: 'error', error: errorText });
      return { text: errorText };
    }

    const currentTask = this.activeTasks.get(session.id);
    if (this.cancelledSessions.has(session.id) || currentTask?.status === 'cancelled') {
      this.cancelledSessions.delete(session.id);
      try { handle.kill('SIGTERM'); } catch (_) {}
      return { text: 'Đã dừng yêu cầu.' };
    }

    this.cancelledSessions.delete(session.id);
    this.activeProcesses.set(session.id, handle);
    const releaseOwnedProcess = () => {
      if (this.activeProcesses.get(session.id) !== handle) return false;
      this.activeProcesses.delete(session.id);
      return true;
    };
    try {
      if (!handle.stdin) throw new Error('Claude duplex transport did not expose stdin');
      const promptFrame = {
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'text', text: userPrompt }],
        },
      };
      handle.stdin.write(`${JSON.stringify(promptFrame)}\n`);
    } catch (err: any) {
      releaseOwnedProcess();
      try { handle.kill('SIGTERM'); } catch (_) {}
      const errorText = `Không thể gửi yêu cầu qua Claude duplex transport: ${err.message || err}`;
      onEvent({ type: 'error', error: errorText });
      return { text: errorText };
    }

    return new Promise((resolve) => {
      let isSettled = false;
      const settle = (result: { text: string; thinking?: string; tools?: ClaudeToolCall[] }) => {
        if (isSettled) return;
        isSettled = true;
        resolve(result);
      };

      const nativeFrameDecoder = new NativeFrameDecoder();
      const stderrDecoder = new StringDecoder('utf8');
      const maxCapturedOutputBytes = 1024 * 1024;
      const stderrBuffer = Buffer.allocUnsafe(maxCapturedOutputBytes);
      let stderrBytes = 0;
      const captureStderr = (chunk: string): void => {
        if (stderrBytes >= maxCapturedOutputBytes || !chunk) return;
        const bytes = Buffer.from(chunk, 'utf8');
        const retainedBytes = Math.min(bytes.length, maxCapturedOutputBytes - stderrBytes);
        bytes.copy(stderrBuffer, stderrBytes, 0, retainedBytes);
        stderrBytes += retainedBytes;
      };
      const getCapturedStderr = (): string => stderrBuffer.subarray(0, stderrBytes).toString('utf8');
      let thinkingText = '';
      let fullText = '';
      const tools: ClaudeToolCall[] = [];
      // A CLI invocation can contain many assistant messages around tool turns.
      // Reconcile snapshots per message/block, never against the aggregate text.
      type ContentBlock = { type: string; value: string; committed: boolean };
      type StreamMessage = { blocks: Map<number, ContentBlock> };
      const messages = new Map<string, StreamMessage>();
      const toolBlocks = new Set<string>();
      const snapshotBlocks = new Map<string, number[]>();
      const normalizedShadowEnabled = process.env.HUGREMOTE_CLAUDE_NORMALIZED_PROTOCOL === 'true';
      const normalizedRunId = `${session.id}:${Date.now()}`;
      const normalizedShadow = normalizedShadowEnabled
        ? {
            normalizer: new ClaudeEventNormalizer({ sessionId: session.id, runId: normalizedRunId }),
            assembler: new ClaudeRunAssembler(),
          }
        : undefined;
      let currentMessageId: string | undefined;
      let anonymousMessage = 0;
      const getMessage = (id: string): StreamMessage => {
        let message = messages.get(id);
        if (!message) {
          message = { blocks: new Map() };
          messages.set(id, message);
        }
        return message;
      };
      const syncContent = () => {
        let text = '';
        let thinking = '';
        for (const message of messages.values()) {
          for (const [, block] of [...message.blocks].sort(([a], [b]) => a - b)) {
            if (block.type === 'text') text += block.value;
            if (block.type === 'thinking') thinking += block.value;
          }
        }
        if (text === fullText && thinking === thinkingText) return;
        const previousText = fullText;
        const previousThinking = thinkingText;
        fullText = text;
        thinkingText = thinking;
        if (!text.startsWith(previousText) || !thinking.startsWith(previousThinking)) {
          onEvent({ type: 'content_sync', text, thinking });
        } else {
          if (thinking.length > previousThinking.length) onEvent({ type: 'thinking', text: thinking.slice(previousThinking.length) });
          if (text.length > previousText.length) onEvent({ type: 'text_delta', text: text.slice(previousText.length) });
        }
      };
      const retireUncommitted = (exceptId: string) => {
        for (const [id, message] of messages) {
          if (id === exceptId) continue;
          for (const [index, block] of message.blocks) {
            if (!block.committed) message.blocks.delete(index);
          }
          if (!message.blocks.size) messages.delete(id);
        }
        syncContent();
      };

      const processLine = (line: string) => {
          const trimmed = line.trim();
          if (!trimmed.startsWith('{')) return;
          let obj: any;
          try {
            obj = JSON.parse(trimmed);
          } catch (_) {
            return;
          }

            if (normalizedShadow) {
              if (obj.type === 'system' && obj.subtype === 'init' && typeof obj.session_id === 'string') {
                normalizedShadow.normalizer.bindNativeSession(obj.session_id);
              }
              if (typeof obj.run_id === 'string') normalizedShadow.normalizer.bindNativeRun(obj.run_id);
              try {
                for (const event of normalizedShadow.normalizer.normalizeFrame(obj)) {
                  normalizedShadow.assembler.applyNormalizedEvent(event);
                }
              } catch {
                // Shadow validation must never interrupt the stable legacy stream path.
              }
            }

            if (obj.type === 'control_request' && typeof obj.request_id === 'string') {
              const activeTask = this.activeTasks.get(session.id);
              const normalizer = activeTask?.normalizer;
              const assembler = activeTask?.assembler;
              if (normalizer && assembler) {
                try {
                  const requestedEvent = normalizer.normalizeFrame(obj).find(
                    (event) => event.type === 'interaction.requested'
                  );
                  if (requestedEvent && assembler.applyNormalizedEvent(requestedEvent)) {
                    const interaction = assembler.getSnapshot().interactions.find(
                      (item) => item.interactionId === requestedEvent.interactionId
                    );
                    if (interaction) {
                      onEvent({ type: 'interaction_requested', interaction });
                    }
                  }
                } catch {
                  // A malformed control request must not break the active stream.
                }
              }
            }

            // 1. Session Init
            if (obj.type === 'system' && obj.subtype === 'init' && obj.session_id) {
              session.cliSessionId = obj.session_id;
            }

            // 2. Thinking start
            if (obj.type === 'system' && obj.subtype === 'thinking_tokens') {
              onEvent({ type: 'thinking_start' });
            }

            // Child agents have independent assemblers in the official client. This
            // flat chat has no child rows yet, so do not mix their content into root.
            if (obj.parent_tool_use_id != null) return;
            if (obj.type === 'stream_event' && obj.event) {
              const event = obj.event;
              if (event.type === 'message_start') {
                currentMessageId = event.message?.id || `anonymous-${++anonymousMessage}`;
                retireUncommitted(currentMessageId!);
                getMessage(currentMessageId!);
              } else if (currentMessageId && event.type === 'content_block_start') {
                const block = event.content_block;
                if (block) {
                  getMessage(currentMessageId).blocks.set(event.index, {
                    type: block.type, value: block.text || block.thinking || '', committed: false,
                  });
                  if (block.type === 'thinking') onEvent({ type: 'thinking_start' });
                  syncContent();
                }
              } else if (currentMessageId && event.type === 'content_block_delta') {
                const block = getMessage(currentMessageId).blocks.get(event.index);
                if (block && !block.committed) {
                  if (event.delta?.type === 'text_delta') block.value += event.delta.text || '';
                  if (event.delta?.type === 'thinking_delta') block.value += event.delta.thinking || '';
                  syncContent();
                }
              } else if (event.type === 'content_block_stop') {
                // Tool input stays private until the complete assistant payload.
              } else if (event.type === 'message_stop') {
                currentMessageId = undefined;
              }
            }

            // 3. Assistant content
            if (obj.type === 'assistant' && obj.message) {
              if (obj.message.usage) {
                const u = obj.message.usage;
                const inTok = u.input_tokens || 0;
                const outTok = u.output_tokens || 0;
                const cRead = u.cache_read_input_tokens || 0;
                const cCreate = u.cache_creation_input_tokens || 0;
                const sum = inTok + outTok + cRead + cCreate;
                if (sum > 0) {
                  const ctxStr = sum >= 1000 ? `${(sum / 1000).toFixed(1)}k` : `${sum}`;
                  session.contextTokens = ctxStr;
                }
              }

              if (Array.isArray(obj.message.content)) {
                const messageId = obj.message.id || `snapshot-${++anonymousMessage}`;
                // A CLI assistant record may contain only ONE completed block,
                // not the entire message's content array. Preserve its stream index.
                if (!messages.has(messageId)) retireUncommitted(messageId);
                const message = getMessage(messageId);
                const snapshotKey = obj.uuid ? `${messageId}:${obj.uuid}` : undefined;
                const mappedIndices = snapshotKey ? snapshotBlocks.get(snapshotKey) : undefined;
                const indices: number[] = [];
                for (const [contentIndex, c] of obj.message.content.entries()) {
                  let index = mappedIndices?.[contentIndex] ?? contentIndex;
                  if (!mappedIndices && obj.message.content.length === 1) {
                    const candidates = [...message.blocks].filter(([, b]) => b.type === c.type);
                    const nextIndex = message.blocks.size ? Math.max(...message.blocks.keys()) + 1 : 0;
                    index = candidates.find(([, b]) => !b.committed)?.[0]
                      ?? (snapshotKey ? nextIndex : candidates.find(([, b]) => b.value === (c.text || c.thinking || ''))?.[0]
                        ?? candidates[0]?.[0] ?? nextIndex);
                  }
                  indices.push(index);
                  message.blocks.set(index, { type: c.type, value: c.text || c.thinking || '', committed: true });
                if (c.type === 'thinking' || c.type === 'text') {
                  syncContent();
                } else if (c.type === 'tool_use') {
                  const blockKey = `${messageId}:${index}`;
                  if (toolBlocks.has(blockKey)) continue;
                  toolBlocks.add(blockKey);
                  const toolType = classifyToolFamily(c.name || '');
                  let title = `${c.name}`;
                  let content = '';
                  let diff: string[] | undefined = undefined;

                  if (toolType === 'bash') {
                    const cmd = c.input?.command || '';
                    title = `Chạy lệnh: ${cmd.length > 50 ? cmd.slice(0, 47) + '...' : cmd}`;
                    content = cmd;
                  } else if (toolType === 'read') {
                    const p = c.input?.path || c.input?.file_path || '';
                    title = `Đọc file: ${path.basename(p) || p}`;
                    content = p;
                  } else if (toolType === 'edit') {
                    const p = c.input?.path || c.input?.file_path || '';
                    title = `Chỉnh sửa: ${path.basename(p) || p}`;
                    if (c.input?.old_str || c.input?.new_str) {
                      diff = [];
                      if (c.input.old_str) {
                        c.input.old_str.split('\n').forEach((l: string) => diff!.push(`- ${l}`));
                      }
                      if (c.input.new_str) {
                        c.input.new_str.split('\n').forEach((l: string) => diff!.push(`+ ${l}`));
                      }
                    }
                  } else if (toolType === 'search') {
                    const query = c.input?.query || c.input?.pattern || c.input?.regex || '';
                    title = `Tìm kiếm: ${query.length > 50 ? query.slice(0, 47) + '...' : query}`;
                    content = query;
                  } else if (toolType === 'web') {
                    const url = c.input?.url || '';
                    title = `Web: ${url.length > 50 ? url.slice(0, 47) + '...' : url}`;
                    content = url;
                  } else if (toolType === 'todo') {
                    title = `Task: ${c.input?.task || c.name}`;
                    content = JSON.stringify(c.input || {}, null, 2);
                  } else if (toolType === 'agent') {
                    title = `Agent: ${c.input?.task || c.input?.description || c.name}`;
                    content = c.input?.task || c.input?.description || '';
                  } else if (toolType === 'mcp') {
                    title = `MCP (${c.name}): ${JSON.stringify(c.input || {}).slice(0, 40)}`;
                    content = JSON.stringify(c.input || {}, null, 2);
                  } else {
                    title = `${c.name}: ${JSON.stringify(c.input || {}).slice(0, 40)}`;
                    content = typeof c.input === 'object' ? JSON.stringify(c.input, null, 2) : String(c.input || '');
                  }

                  const toolCall: ClaudeToolCall = {
                    id: c.id,
                    type: toolType,
                    nativeName: c.name,
                    title,
                    status: 'running',
                    content: content || undefined,
                    diff,
                  };
                  tools.push(toolCall);
                  onEvent({ type: 'tool_use', tool: toolCall });
                }
              }
                if (snapshotKey) snapshotBlocks.set(snapshotKey, indices);
            }
          }

            // 4. User tool results
            if (obj.type === 'user' && obj.message && Array.isArray(obj.message.content)) {
              for (const c of obj.message.content) {
                if (c.type === 'tool_result') {
                  const found = tools.find((t) => t.id === c.tool_use_id);
                  const outStr = typeof c.content === 'string' ? c.content : JSON.stringify(c.content || '');
                  if (found) {
                    found.output = outStr;
                    found.status = c.is_error ? 'error' : 'done';
                  }
                  onEvent({
                    type: 'tool_result',
                    tool_use_id: c.tool_use_id,
                    output: outStr,
                    status: c.is_error ? 'error' : 'done',
                  });
                }
              }
            }

            // 5. Result
            if (obj.type === 'result') {
              // One browser prompt maps to one SDK stream-json turn. Closing stdin
              // after its terminal result lets the persistent CLI exit cleanly.
              try { handle.stdin?.end?.(); } catch (_) {}
              if (obj.result && typeof obj.result === 'string') {
                fullText = obj.result;
              }
              let ctxStr: string | undefined = undefined;
              let totalTokens = 0;

              if (obj.usage) {
                const inTok = obj.usage.input_tokens || 0;
                const outTok = obj.usage.output_tokens || 0;
                const cacheReadTok = obj.usage.cache_read_input_tokens || 0;
                const cacheCreateTok = obj.usage.cache_creation_input_tokens || 0;
                totalTokens = inTok + outTok + cacheReadTok + cacheCreateTok;
              }

              if (totalTokens === 0 && obj.modelUsage && typeof obj.modelUsage === 'object') {
                for (const mu of Object.values<any>(obj.modelUsage)) {
                  if (mu && typeof mu === 'object') {
                    const inTok = mu.inputTokens || 0;
                    const outTok = mu.outputTokens || 0;
                    const cacheRead = mu.cacheReadInputTokens || 0;
                    const cacheCreate = mu.cacheCreationInputTokens || 0;
                    const sum = inTok + outTok + cacheRead + cacheCreate;
                    if (sum > totalTokens) totalTokens = sum;
                  }
                }
              }

              if (totalTokens > 0) {
                ctxStr = totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : `${totalTokens}`;
                session.contextTokens = ctxStr;
                this.saveSessions();
              }
              onEvent({
                type: 'done',
                text: fullText,
                usage: obj.usage,
                contextTokens: ctxStr || session.contextTokens,
              });
            }
      };

      const processNativeRecord = (record: NativeFrameRecord) => {
        if (record.kind === 'frame') {
          processLine(JSON.stringify(record.frame));
          return;
        }
        if (normalizedShadow) {
          try {
            for (const event of normalizedShadow.normalizer.normalizeFrame({
              type: `transport.${record.code}`,
              diagnostic: record.preview,
            })) {
              normalizedShadow.assembler.applyNormalizedEvent(event);
            }
          } catch {
            // Diagnostics remain isolated from the legacy event stream.
          }
        }
      };

      handle.stdout.on('data', (d: any) => {
        const chunk = typeof d === 'string' ? d : Buffer.from(d);
        for (const record of nativeFrameDecoder.push(chunk)) processNativeRecord(record);
      });

      handle.stderr.on('data', (d: any) => {
        captureStderr(typeof d === 'string' ? d : stderrDecoder.write(d));
      });

      handle.on('error', (err: any) => {
        const ownedProcess = releaseOwnedProcess();
        if (ownedProcess) this.cancelledSessions.delete(session.id);
        if (isSettled) return;
        const targetLabel = isRemote && server ? `máy chủ remote "${server.label || server.name}"` : 'máy chủ nội bộ';
        const errorText = `Không thể khởi chạy Claude Code trên ${targetLabel}: ${err.message || err}`;
        onEvent({ type: 'error', error: errorText });
        settle({ text: errorText });
      });

      handle.on('close', (code: any, signal: any) => {
        const ownedProcess = releaseOwnedProcess();
        const wasCancelled = ownedProcess ? this.cancelledSessions.delete(session.id) : false;
        if (isSettled) return;

        const trailingRecords = nativeFrameDecoder.finish();
        captureStderr(stderrDecoder.end());

        if (wasCancelled || signal === 'SIGINT' || signal === 'SIGTERM') {
          const cancelledText = 'Đã dừng yêu cầu.';
          tools.forEach((tool) => {
            if (!tool.status || tool.status === 'running') tool.status = 'error';
          });
          onEvent({ type: 'done', text: cancelledText, contextTokens: session.contextTokens });
          return settle({
            text: cancelledText,
            thinking: thinkingText || undefined,
            tools: tools.length ? tools : undefined,
          });
        }

        // Process a final JSON record even when the CLI omits its newline.
        for (const record of trailingRecords) processNativeRecord(record);

        if (fullText && (code === 0 || code === null)) {
          return settle({
            text: fullText,
            thinking: thinkingText || undefined,
            tools: tools.length ? tools : undefined,
          });
        }

        const capturedStderr = getCapturedStderr();
        let errorText = capturedStderr.trim()
          ? `Claude Code không trả về kết quả: ${capturedStderr.trim().slice(0, 500)}`
          : `Claude Code không trả về kết quả. Tiến trình thoát với mã ${code ?? 'unknown'}.`;
        if (
          isRemote &&
          server &&
          (capturedStderr.includes('claude: not found') ||
            capturedStderr.includes('claude: command not found') ||
            code === 127)
        ) {
          errorText = `Không tìm thấy lệnh "claude" trên máy chủ remote "${server.label || server.name}". Vui lòng cài đặt Claude Code trên máy chủ đó và đảm bảo đã đăng nhập.`;
        }
        onEvent({ type: 'error', error: errorText });
        settle({ text: errorText });
      });
    });
  }

  async runClaudePrompt(
    session: ClaudeSession,
    userPrompt: string,
    onProgress: (chunk: string) => void
  ): Promise<{ text: string; thinking?: string; tools?: ClaudeToolCall[] }> {
    return this.streamClaudePrompt(session, userPrompt, (event) => {
      if (event.type === 'text_delta') {
        onProgress(event.text);
      }
    });
  }

  private generateIntelligentResponse(session: ClaudeSession, prompt: string): { text: string; tools?: ClaudeToolCall[] } {
    const lower = prompt.toLowerCase();
    const tools: ClaudeToolCall[] = [];

    if (lower.includes('hi') || lower.includes('hello') || lower.includes('xin chào')) {
      return {
        text: `Hi! What would you like to work on in this repo (${path.basename(session.cwd)})?`,
      };
    }

    if (lower.includes('package.json') || lower.includes('dependencies') || lower.includes('cấu trúc')) {
      tools.push({
        type: 'read',
        title: `Read ${session.cwd}/package.json`,
        content: `{\n  "name": "hugcode",\n  "version": "1.0.0",\n  "type": "module",\n  "dependencies": {\n    "fastify": "^4.26.0",\n    "vue": "^3.4.0"\n  }\n}`,
      });
      return {
        text: `Dự án **${path.basename(session.cwd)}** là một ứng dụng Web IDE & Terminal Mobile-First kết hợp công nghệ Fastify và Vue 3.`,
        tools,
      };
    }

    if (lower.includes('fix') || lower.includes('lỗi') || lower.includes('bug') || lower.includes('review')) {
      tools.push({
        type: 'read',
        title: `Inspect ${session.cwd}/server/src/config.ts`,
        content: `export const PORT = 8099;\nexport const HOST = "::"; // IPv4 & IPv6 Dual Stack`,
      });
      return {
        text: `Tôi đã quét mã nguồn tại **${session.cwd}**: Hệ thống đang lắng nghe dual-stack trên cổng 8099, không có lỗi runtime chưa giải quyết.`,
        tools,
      };
    }

    if (lower.includes('test')) {
      tools.push({
        type: 'bash',
        title: 'Bash: npm test',
        output: '✓ PASS all test suites (100% passing)',
      });
      return {
        text: `Đã chạy bộ kiểm thử trong thư mục làm việc: Tất cả bài kiểm tra đều hoàn tất thành công.`,
        tools,
      };
    }

    tools.push({
      type: 'bash',
      title: `Workspace action in ${session.cwd}`,
      output: `✓ Executed in ${session.cwd} (exit 0)`,
    });
    return {
      text: `Tôi đã tiếp nhận yêu cầu: "${prompt}". Ngữ cảnh làm việc hiện tại: <code>${session.cwd}</code>.`,
      tools,
    };
  }
}

export const claudeService = new ClaudeService();
