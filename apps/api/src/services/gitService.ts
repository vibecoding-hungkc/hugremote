import { spawn } from 'child_process';
import type { ClientChannel } from 'ssh2';
import type { ServerConfig } from '../config.js';
import { sshPool } from './sshPool.js';

export type GitExecutor = (cwd: string, args: string[]) => Promise<string>;
const GIT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

function shellQuote(value: string): string {
  if (value.includes('\0')) throw new Error('Git arguments must not contain NUL');
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

/** A request-scoped SSH executor; never mutates the local singleton. */
export function createRemoteGitExecutor(
  server: ServerConfig,
  executeCommand: typeof sshPool.executeCommand = sshPool.executeCommand.bind(sshPool),
  timeoutMs = GIT_TIMEOUT_MS,
): GitExecutor {
  if (server.type !== 'ssh') throw new Error('Remote Git requires an SSH server');
  return (cwd, args) => {
    const directory = cwd === '~' ? '"$HOME"' : cwd.startsWith('~/')
      ? `"$HOME"/${shellQuote(cwd.slice(2))}` : shellQuote(cwd);
    const command = `GIT_TERMINAL_PROMPT=0 git -C ${directory} ${args.map(shellQuote).join(' ')}`;
    return new Promise((resolve, reject) => {
      let channel: ClientChannel | undefined;
      let settled = false;
      let exitCode: number | undefined;
      let exitSignal: string | undefined;
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let bytes = 0;
      const stop = () => { try { channel?.signal('TERM'); channel?.close(); } catch {} };
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(Buffer.concat(stdout).toString('utf8'));
      };
      // Do not echo stderr/argv: transport and Git errors can include credential URLs.
      const failure = (reason: string) => new Error(`Remote Git ${args[0] || 'command'} failed: ${reason}`);
      const timer = setTimeout(() => { finish(failure('timed out')); stop(); }, timeoutMs);
      const collect = (chunks: Buffer[], data: Buffer | string) => {
        const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
        bytes += chunk.length;
        if (bytes > MAX_OUTPUT_BYTES) { finish(failure('output limit exceeded')); stop(); }
        else chunks.push(chunk);
      };
      Promise.resolve().then(() => executeCommand(server, command)).then(stream => {
        channel = stream;
        if (settled) { stream.on('error', () => {}); stop(); return; }
        stream.on('data', (data: Buffer) => collect(stdout, data));
        stream.stderr.on('data', data => collect(stderr, data));
        stream.stderr.on('error', () => { finish(failure('stderr stream error')); stop(); });
        stream.on('error', () => { finish(failure('SSH stream error')); stop(); });
        stream.on('exit', (code: number | null, signal?: string) => {
          exitCode = code === null ? undefined : code;
          exitSignal = signal;
          if (signal || (code !== null && code !== 0)) {
            finish(failure(signal ? 'terminated by signal' : `exit code ${code}`));
            stop();
          }
        });
        stream.on('close', (code?: number, signal?: string) => {
          const result = exitCode ?? code;
          if (exitSignal || signal) finish(failure('terminated by signal'));
          else if (result === 0) finish();
          else finish(failure(result === undefined ? 'SSH channel closed without exit status' : `exit code ${result}`));
        });
      }, () => finish(failure('SSH connection or execution error')));
    });
  };
}

export function createGitService(server: ServerConfig): GitService {
  return server.type === 'local' ? gitService : new GitService(createRemoteGitExecutor(server));
}

export interface GitChangedFile {
  path: string;
  status: 'M' | 'A' | 'D' | 'R' | '??';
  staged: boolean;
  additions: number;
  deletions: number;
}

export interface GitStatusResponse {
  repoRoot: string;
  branch: string;
  upstream: string;
  hasUpstream: boolean;
  ahead: number;
  behind: number;
  fetchedAt: string;
  files: GitChangedFile[];
}

export interface GitBranchItem {
  name: string;
  current: boolean;
}

export interface GitDiffLine {
  type: 'context' | 'added' | 'deleted' | 'hunk';
  oldLine?: number;
  newLine?: number;
  content: string;
}

export interface GitDiffResponse {
  file: string;
  lines: GitDiffLine[];
}

function parseNumstat(raw: string): Map<string, { additions: number; deletions: number }> {
  const map = new Map<string, { additions: number; deletions: number }>();
  raw.split('\n').filter(Boolean).forEach((line) => {
    const [a, d, ...rest] = line.split('\t');
    const file = rest.join('\t');
    map.set(file, {
      additions: a === '-' ? 0 : Number(a || 0),
      deletions: d === '-' ? 0 : Number(d || 0),
    });
  });
  return map;
}

function parseDiff(raw: string): GitDiffLine[] {
  let oldLine = 0;
  let newLine = 0;
  const lines: GitDiffLine[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      oldLine = match ? Number(match[1]) : 0;
      newLine = match ? Number(match[2]) : 0;
      lines.push({ type: 'hunk', content: line });
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      lines.push({ type: 'added', newLine: newLine++, content: line.slice(1) });
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      lines.push({ type: 'deleted', oldLine: oldLine++, content: line.slice(1) });
    } else if (!line.startsWith('diff --git') && !line.startsWith('index ') && !line.startsWith('---') && !line.startsWith('+++')) {
      lines.push({ type: 'context', oldLine: oldLine ? oldLine++ : undefined, newLine: newLine ? newLine++ : undefined, content: line.startsWith(' ') ? line.slice(1) : line });
    }
  }
  return lines;
}

export class GitService {
  constructor(private readonly executor?: GitExecutor) {}

  execGit(cwd: string, args: string[]): Promise<string> {
    if (this.executor) return this.executor(cwd, args);
    return new Promise((resolve, reject) => {
      const child = spawn('git', ['-C', cwd, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || stdout || `git exited with ${code}`));
      });
    });
  }

  async fetchRemote(cwd: string): Promise<{ fetched: boolean; error?: string }> {
    try {
      await this.execGit(cwd, ['fetch', '--prune']);
      return { fetched: true };
    } catch (err: any) {
      return { fetched: false, error: err.message || 'fetch failed' };
    }
  }

  private async countAheadBehind(cwd: string): Promise<{ ahead: number; behind: number; hasUpstream: boolean; upstream: string }> {
    const upstream = await this.execGit(cwd, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']).then((s) => s.trim()).catch(() => '');
    if (!upstream) return { ahead: 0, behind: 0, hasUpstream: false, upstream: '' };
    const counts = await this.execGit(cwd, ['rev-list', '--left-right', '--count', 'HEAD...@{u}']).then((s) => s.trim()).catch(() => '0\t0');
    const [aheadRaw, behindRaw] = counts.split(/\s+/);
    return { ahead: Number(aheadRaw || 0), behind: Number(behindRaw || 0), hasUpstream: true, upstream };
  }

  async getStatus(cwd: string, options: { fetch?: boolean } = {}): Promise<GitStatusResponse> {
    const fetchedAt = new Date().toISOString();
    if (options.fetch !== false) {
      await this.fetchRemote(cwd).catch(() => ({ fetched: false }));
    }
    const [rootRaw, branchRaw, statusRaw, numstatRaw, aheadBehind] = await Promise.all([
      this.execGit(cwd, ['rev-parse', '--show-toplevel']),
      this.execGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
      this.execGit(cwd, ['status', '--porcelain=v1']),
      this.execGit(cwd, ['diff', '--numstat', 'HEAD']).catch(() => ''),
      this.countAheadBehind(cwd),
    ]);
    const root = rootRaw.trim();
    const nums = parseNumstat(numstatRaw);
    const files: GitChangedFile[] = statusRaw.split('\n').filter(Boolean).map((line) => {
      const xyRaw = line.slice(0, 2);
      const xy = xyRaw.trim() || 'M';
      const staged = xyRaw[0] !== ' ' && xyRaw[0] !== '?';
      const filePath = line.slice(3).replace(/^.* -> /, '');
      const stat = nums.get(filePath) || { additions: 0, deletions: 0 };
      const status = (xy === '??' ? '??' : xy.includes('A') ? 'A' : xy.includes('D') ? 'D' : xy.includes('R') ? 'R' : 'M') as GitChangedFile['status'];
      return { path: filePath, status, staged, additions: stat.additions, deletions: stat.deletions };
    });
    return {
      repoRoot: root,
      branch: branchRaw.trim() || 'main',
      upstream: aheadBehind.upstream,
      hasUpstream: aheadBehind.hasUpstream,
      ahead: aheadBehind.ahead,
      behind: aheadBehind.behind,
      fetchedAt,
      files,
    };
  }

  async getDiff(cwd: string, file: string): Promise<GitDiffResponse> {
    let raw = await this.execGit(cwd, ['diff', '--', file]);
    if (!raw.trim()) {
      raw = await this.execGit(cwd, ['diff', '--cached', '--', file]);
    }
    return { file, lines: parseDiff(raw) };
  }

  async getBranches(cwd: string): Promise<GitBranchItem[]> {
    const raw = await this.execGit(cwd, ['branch', '--format=%(HEAD)|%(refname:short)']);
    return raw.split('\n').filter(Boolean).map((line) => {
      const [head, name] = line.split('|');
      return { name, current: head.trim() === '*' };
    });
  }

  async checkout(cwd: string, branch: string): Promise<void> {
    const clean = branch.trim();
    if (!clean) throw new Error('Branch is required');
    if (clean.startsWith('-') || /[\s\x00-\x1f\x7f~^:?*\[\\]/.test(clean) || clean.includes('..') || clean.includes('@{')) {
      throw new Error('Invalid branch name');
    }
    await this.execGit(cwd, ['checkout', clean]);
  }

  async pull(cwd: string): Promise<string> {
    return await this.execGit(cwd, ['pull', '--ff-only']);
  }

  async push(cwd: string): Promise<string> {
    try {
      return await this.execGit(cwd, ['push']);
    } catch (err) {
      const branch = await this.execGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).then((s) => s.trim()).catch(() => '');
      if (!branch) throw err;
      return await this.execGit(cwd, ['push', '-u', 'origin', branch]);
    }
  }

  async stage(cwd: string, file: string): Promise<void> {
    await this.execGit(cwd, ['add', '--', file]);
  }

  async unstage(cwd: string, file: string): Promise<void> {
    await this.execGit(cwd, ['restore', '--staged', '--', file]);
  }

  async commit(cwd: string, message: string): Promise<string> {
    const clean = message.trim();
    if (!clean) throw new Error('Commit message is required');
    return await this.execGit(cwd, ['commit', '-m', clean]);
  }
}

export const gitService = new GitService();
