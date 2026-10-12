import { spawn } from 'child_process';

export interface GitChangedFile {
  path: string;
  status: 'M' | 'A' | 'D' | 'R' | '??';
  additions: number;
  deletions: number;
}

export interface GitStatusResponse {
  repoRoot: string;
  branch: string;
  ahead: number;
  behind: number;
  files: GitChangedFile[];
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
  execGit(cwd: string, args: string[]): Promise<string> {
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

  async getStatus(cwd: string): Promise<GitStatusResponse> {
    const [rootRaw, branchRaw, statusRaw, numstatRaw] = await Promise.all([
      this.execGit(cwd, ['rev-parse', '--show-toplevel']),
      this.execGit(cwd, ['status', '--porcelain=v1', '--branch']),
      this.execGit(cwd, ['status', '--porcelain=v1']),
      this.execGit(cwd, ['diff', '--numstat', 'HEAD']).catch(() => ''),
    ]);
    const root = rootRaw.trim();
    const branchLine = branchRaw.split('\n')[0] || '## main';
    const branchMatch = branchLine.match(/^##\s+([^\.\s]+)/);
    const aheadMatch = branchLine.match(/ahead\s+(\d+)/);
    const behindMatch = branchLine.match(/behind\s+(\d+)/);
    const nums = parseNumstat(numstatRaw);
    const files: GitChangedFile[] = statusRaw.split('\n').filter(Boolean).map((line) => {
      const xy = line.slice(0, 2).trim() || 'M';
      const filePath = line.slice(3).replace(/^.* -> /, '');
      const stat = nums.get(filePath) || { additions: 0, deletions: 0 };
      const status = (xy === '??' ? '??' : xy.includes('A') ? 'A' : xy.includes('D') ? 'D' : xy.includes('R') ? 'R' : 'M') as GitChangedFile['status'];
      return { path: filePath, status, additions: stat.additions, deletions: stat.deletions };
    });
    return {
      repoRoot: root,
      branch: branchMatch?.[1] || 'main',
      ahead: Number(aheadMatch?.[1] || 0),
      behind: Number(behindMatch?.[1] || 0),
      files,
    };
  }

  async getDiff(cwd: string, file: string): Promise<GitDiffResponse> {
    let raw = await this.execGit(cwd, ['diff', '--', file]).catch(() => '');
    if (!raw.trim()) {
      raw = await this.execGit(cwd, ['diff', '--cached', '--', file]).catch(() => '');
    }
    return { file, lines: parseDiff(raw) };
  }
}

export const gitService = new GitService();
