import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, ChildProcess } from 'child_process';
import { normalizeWorkspacePath } from '../config.js';

export interface ClaudeLimitsInfo {
  fiveHour: {
    usedPercent: number;
    resetIn: string;
  };
  weekly: {
    usedPercent: number;
    resetIn: string;
  };
}

export interface ClaudeToolCall {
  id?: string;
  type: 'read' | 'edit' | 'bash';
  title: string;
  status?: 'running' | 'done' | 'error';
  content?: string;
  diff?: string[];
  output?: string;
}

export interface ClaudeMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  thinking?: string;
  isThinking?: boolean;
  isThinkingExpanded?: boolean;
  tools?: ClaudeToolCall[];
}

export interface ClaudeSession {
  id: string;
  serverId: string;
  cliSessionId?: string;
  name: string;
  cwd: string;
  isCustomNamed: boolean;
  model: string;
  mode: string;
  bypassPermissions?: boolean;
  timer: string;
  contextTokens: string;
  messages: ClaudeMessage[];
  updatedAt: number;
}

export type ClaudeStreamEvent =
  | { type: 'thinking_start' }
  | { type: 'thinking'; text: string }
  | { type: 'tool_use'; tool: ClaudeToolCall }
  | { type: 'tool_result'; tool_use_id: string; output: string; status?: 'done' | 'error' }
  | { type: 'text_delta'; text: string }
  | { type: 'done'; text: string; usage?: any; contextTokens?: string }
  | { type: 'error'; error: string };

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

class ClaudeService {
  private sessions: Map<string, ClaudeSession> = new Map();
  private activeProcesses: Map<string, ChildProcess> = new Map();
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

  constructor() {
    this.loadSessions();
    this.loadLimits();
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
          list.forEach((s) => this.sessions.set(s.id, s));
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
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save claude sessions to disk:', e);
    }
  }

  getSessionsForServer(serverId: string, defaultCwd: string): ClaudeSession[] {
    const list = Array.from(this.sessions.values()).filter((s) => s.serverId === serverId);
    if (list.length === 0) {
      // Create initial default session for this server
      const init = this.createSession(serverId, 'hugcode', defaultCwd || '~/projects/hugcode');
      return [init];
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getSession(id: string): ClaudeSession | undefined {
    return this.sessions.get(id);
  }

  createSession(
    serverId: string,
    name: string,
    cwd: string,
    model = 'Sonnet 5.5 Medium',
    mode = 'Auto',
    initialPrompt?: string,
    bypassPermissions = false
  ): ClaudeSession {
    const id = `claude-${serverId}-${Date.now()}`;
    const normalizedCwd = normalizeWorkspacePath(cwd);
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
      name: name || 'chat',
      cwd: normalizedCwd,
      isCustomNamed: Boolean(name && name !== 'chat' && name !== 'hugcode'),
      model,
      mode,
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

    if (updates.name !== undefined) {
      session.name = updates.name.trim();
      session.isCustomNamed = true;
    }
    if (updates.cwd !== undefined) session.cwd = normalizeWorkspacePath(updates.cwd);
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
    const ok = this.sessions.delete(id);
    if (ok) this.saveSessions();
    return ok;
  }

  addMessage(sessionId: string, message: ClaudeMessage): ClaudeSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.messages.push(message);
    session.updatedAt = Date.now();

    // Increment context tokens dynamically based on total message characters
    const totalChars = session.messages.reduce((acc, m) => acc + (m.text?.length || 0), 0);
    const estTokens = Math.round(totalChars / 3.5);
    session.contextTokens = estTokens >= 1000 ? `${(estTokens / 1000).toFixed(1)}k` : `${estTokens}`;

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

  getLimits(): ClaudeLimitsInfo {
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

  cancelRun(sessionId: string): boolean {
    const child = this.activeProcesses.get(sessionId);
    if (!child) return false;
    try {
      this.cancelledSessions.add(sessionId);
      child.kill('SIGINT');
      setTimeout(() => {
        if (!child.killed) child.kill('SIGTERM');
      }, 1200).unref();
      return true;
    } catch (_) {
      return false;
    }
  }

  async streamClaudePrompt(
    session: ClaudeSession,
    userPrompt: string,
    onEvent: (event: ClaudeStreamEvent) => void
  ): Promise<{ text: string; thinking?: string; tools?: ClaudeToolCall[] }> {
    const bin = getClaudeBinaryPath();

    // Load custom env from ~/.claude/settings.json if present
    let claudeSettingsEnv: Record<string, string> = {};
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      try {
        const rawSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (rawSettings && typeof rawSettings.env === 'object') {
          claudeSettingsEnv = rawSettings.env;
        }
      } catch (_) {}
    }

    // Map model
    let modelArg = 'sonet';
    const mLower = (session.model || '').toLowerCase();
    if (mLower.includes('opus')) modelArg = 'opus';
    else if (mLower.includes('haiku')) modelArg = 'haiku';
    else if (mLower.includes('fable')) modelArg = 'fable';
    else if (mLower.includes('sonnet') || mLower.includes('sonet')) modelArg = 'sonet';

    return new Promise((resolve) => {
      let lineBuffer = '';
      let fullStdout = '';
      let fullStderr = '';
      let thinkingText = '';
      let fullText = '';
      const tools: ClaudeToolCall[] = [];

      const effortMatch = (session.model || '').match(/\b(Low|Medium|High|Max)\b/i);
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
        userPrompt,
        '--model',
        modelArg,
        '--effort',
        effortArg,
        '--permission-mode',
        permissionModeArg,
        '--output-format',
        'stream-json',
        '--verbose',
      ];
      if (session.bypassPermissions) {
        args.push('--dangerously-skip-permissions');
      }
      if (session.cliSessionId) {
        args.push('--resume', session.cliSessionId);
      }

      const child = spawn(bin, args, {
        cwd: session.cwd || process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...claudeSettingsEnv,
          PATH: `${path.join(os.homedir(), '.local', 'bin')}:${process.env.PATH}`,
        },
      });
      this.cancelledSessions.delete(session.id);
      this.activeProcesses.set(session.id, child);

      child.stdout.on('data', (d) => {
        const chunk = d.toString('utf8');
        fullStdout += chunk;
        lineBuffer += chunk;
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('{')) continue;
          try {
            const obj = JSON.parse(trimmed);

            // 1. Session Init
            if (obj.type === 'system' && obj.subtype === 'init' && obj.session_id) {
              session.cliSessionId = obj.session_id;
            }

            // 2. Thinking start
            if (obj.type === 'system' && obj.subtype === 'thinking_tokens') {
              onEvent({ type: 'thinking_start' });
            }

            // 3. Assistant content
            if (obj.type === 'assistant' && obj.message && Array.isArray(obj.message.content)) {
              for (const c of obj.message.content) {
                if (c.type === 'thinking' && c.thinking) {
                  thinkingText += c.thinking;
                  onEvent({ type: 'thinking', text: c.thinking });
                } else if (c.type === 'tool_use') {
                  const nameLower = (c.name || '').toLowerCase();
                  let toolType: 'read' | 'edit' | 'bash' = 'bash';
                  let title = `${c.name}`;
                  let content = '';
                  let diff: string[] | undefined = undefined;

                  if (nameLower === 'bash') {
                    toolType = 'bash';
                    const cmd = c.input?.command || '';
                    title = `Chạy lệnh: ${cmd.length > 50 ? cmd.slice(0, 47) + '...' : cmd}`;
                    content = cmd;
                  } else if (nameLower === 'view' || nameLower === 'read') {
                    toolType = 'read';
                    const p = c.input?.path || c.input?.file_path || '';
                    title = `Đọc file: ${path.basename(p) || p}`;
                    content = p;
                  } else if (nameLower.includes('edit') || nameLower.includes('replace')) {
                    toolType = 'edit';
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
                  } else {
                    title = `${c.name}: ${JSON.stringify(c.input || {}).slice(0, 40)}`;
                  }

                  const toolCall: ClaudeToolCall = {
                    id: c.id,
                    type: toolType,
                    title,
                    status: 'running',
                    content: content || undefined,
                    diff,
                  };
                  tools.push(toolCall);
                  onEvent({ type: 'tool_use', tool: toolCall });
                } else if (c.type === 'text' && c.text) {
                  fullText += c.text;
                  onEvent({ type: 'text_delta', text: c.text });
                }
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
              if (obj.result && typeof obj.result === 'string') {
                fullText = obj.result;
              }
              let ctxStr: string | undefined = undefined;
              if (obj.usage) {
                const inTok = obj.usage.input_tokens || 0;
                const outTok = obj.usage.output_tokens || 0;
                const cacheTok = obj.usage.cache_read_input_tokens || 0;
                const total = inTok + outTok + cacheTok;
                if (total > 0) {
                  ctxStr = total >= 1000 ? `${(total / 1000).toFixed(1)}k` : `${total}`;
                  session.contextTokens = ctxStr;
                  this.saveSessions();
                }
              }
              onEvent({
                type: 'done',
                text: fullText,
                usage: obj.usage,
                contextTokens: ctxStr || session.contextTokens,
              });
            }
          } catch (_) {}
        }
      });

      child.stderr.on('data', (d) => {
        fullStderr += d.toString('utf8');
      });

      child.on('error', (err) => {
        this.activeProcesses.delete(session.id);
        this.cancelledSessions.delete(session.id);
        const errorText = `Không thể khởi chạy Claude Code: ${err.message}`;
        onEvent({ type: 'error', error: errorText });
        resolve({ text: errorText });
      });

      child.on('close', (code, signal) => {
        this.activeProcesses.delete(session.id);
        const wasCancelled = this.cancelledSessions.delete(session.id);
        if (wasCancelled || signal === 'SIGINT' || signal === 'SIGTERM') {
          const cancelledText = 'Đã dừng yêu cầu.';
          tools.forEach((tool) => {
            if (!tool.status || tool.status === 'running') tool.status = 'error';
          });
          onEvent({ type: 'done', text: cancelledText, contextTokens: session.contextTokens });
          return resolve({
            text: cancelledText,
            thinking: thinkingText || undefined,
            tools: tools.length ? tools : undefined,
          });
        }

        // Handle any remaining lineBuffer
        if (lineBuffer.trim().startsWith('{')) {
          try {
            const obj = JSON.parse(lineBuffer.trim());
            if (obj.type === 'result' && obj.result) {
              fullText = obj.result;
            }
          } catch (_) {}
        }

        if (fullText) {
          return resolve({
            text: fullText,
            thinking: thinkingText || undefined,
            tools: tools.length ? tools : undefined,
          });
        }

        const cliError = fullStderr.trim() || fullStdout.trim() || `Claude Code exited with code ${code ?? 'unknown'}`;
        const errorText = `Claude Code không trả về kết quả: ${cliError.slice(0, 500)}`;
        onEvent({ type: 'error', error: errorText });
        resolve({ text: errorText });
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
