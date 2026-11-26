import { Injectable } from '@nestjs/common';
import * as path from 'node:path';
import { ErrorCode, LIMITS } from '@app/shared';
import { AppError } from '../../common/app-error';
import type { HostRuntime } from '../../integrations/host/host-runtime';
import { HostsService } from '../hosts/hosts.service';
import { FilesService } from '../files/files.service';

export interface GitChange {
  path: string;
  oldPath?: string;
  /** X (index) và Y (cây làm việc) theo porcelain. */
  x: string;
  y: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
  added: number;
  deleted: number;
}

const ENV = { GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C', GIT_OPTIONAL_LOCKS: '0' };

/** git-api.v1 — git CLI trên máy đích qua HostRuntime (local spawn mảng tham số; SSH quote từng tham số — G-5). */
@Injectable()
export class GitService {
  constructor(private readonly files: FilesService) {}

  private async ctx(projectId: string, repo = '') {
    const c = await this.files.ctx(projectId);
    const cwd = this.files.abs(c.project, repo);
    return { ...c, cwd };
  }

  private async git(rt: HostRuntime, cwd: string, args: string[], opts: { timeoutMs?: number; stdin?: string; ceiling?: string } = {}) {
    try {
      // core.quotePath=false: đường dẫn tiếng Việt/dấu cách không bị bọc ngoặc + escape bát phân (dogfood edge V5)
      return await rt.exec(['git', '-c', 'core.quotePath=false', ...args], {
        cwd,
        env: opts.ceiling ? { ...ENV, GIT_CEILING_DIRECTORIES: opts.ceiling } : ENV,
        timeoutMs: opts.timeoutMs ?? 30_000,
        maxBytes: 8 * 1024 * 1024,
        stdin: opts.stdin,
      });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw AppError.badRequest(ErrorCode.GIT_NOT_INSTALLED);
      return HostsService.mapSshError(e);
    }
  }

  private async ok(rt: HostRuntime, cwd: string, args: string[], timeoutMs?: number) {
    const r = await this.git(rt, cwd, args, { timeoutMs });
    if (r.code === 127) throw AppError.badRequest(ErrorCode.GIT_NOT_INSTALLED);
    if (r.code !== 0) {
      const err = (r.stderr.toString() || r.stdout.toString()).trim().slice(-2000);
      if (/non-fast-forward|rejected|Not possible to fast-forward|fetch first|diverg/i.test(err))
        throw AppError.conflict(ErrorCode.GIT_NON_FAST_FORWARD, { stderr: err });
      throw AppError.badRequest(ErrorCode.GIT_FAILED, { stderr: err });
    }
    return r.stdout.toString('utf8');
  }

  /** Chặn git leo ngược vượt khỏi gốc dự án (vd dự án local nằm trong thư mục con của repo cha — dogfood edge #2). */
  private ceilingOf(rootPath: string) {
    const parent = path.posix.dirname(rootPath.replace(/\/+$/, ''));
    return parent && parent !== rootPath ? parent : undefined;
  }

  /**
   * Mọi repo trong thư mục dự án, sâu tối đa 4 cấp (Authority 2026-11-25): gốc dự án (`''`) nếu chính nó là repo, rồi repo
   * con theo thứ tự tên. Một lệnh `find` trên máy đích, bỏ qua node_modules/vendor/dist/.cache và không đi vào `.git`.
   * Mỗi repo kèm nhánh + số thay đổi (tối đa 4 lệnh git cùng lúc — sshd mặc định MaxSessions 10).
   */
  /** Nhiều tab/thiết bị mở Git cùng lúc → dùng chung một lượt quét (sshd MaxSessions 10 từng làm 14/20 yêu cầu 500 — breaker #5). */
  private readonly scanning = new Map<
    string,
    Promise<{ repos: { path: string; branch: string | null; changes: number }[]; more: number }>
  >();
  repos(projectId: string) {
    let p = this.scanning.get(projectId);
    if (!p) {
      p = this.scanRepos(projectId).finally(() => this.scanning.delete(projectId));
      this.scanning.set(projectId, p);
    }
    return p;
  }

  private async scanRepos(projectId: string) {
    const c = await this.ctx(projectId);
    const ceiling = this.ceilingOf(c.project.rootPath);
    const top = await this.git(c.rt, c.cwd, ['rev-parse', '--show-toplevel'], { ceiling });
    const r = await c.rt
      .exec(
        [
          'find',
          '.',
          '-maxdepth',
          '5',
          '(',
          '-name',
          'node_modules',
          '-o',
          '-name',
          'vendor',
          '-o',
          '-name',
          'dist',
          '-o',
          '-name',
          '.cache',
          ')',
          '-prune',
          '-o',
          '-name',
          '.git',
          '-print',
          '-prune',
        ],
        { cwd: c.cwd, timeoutMs: 15_000, maxBytes: 1024 * 1024 },
      )
      .catch((e: unknown) => HostsService.mapSshError(e));
    const nested = (r?.stdout.toString().split('\n') ?? [])
      .filter(Boolean)
      .map((p) => path.posix.dirname(p.replace(/^\.\//, '')))
      .filter((p) => p !== '.')
      // nông trước rồi theo tên: vượt trần thì bỏ repo sâu, không bỏ dự án thật cùng cấp (dogfood edge V6)
      .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
    const all = [...(top.code === 0 ? [''] : []), ...nested];
    const paths = all.slice(0, 200);
    const out: { path: string; branch: string | null; changes: number }[] = [];
    // ponytail: hàng đợi 4 luồng đơn giản; đủ cho vài chục repo
    let next = 0;
    const worker = async () => {
      while (next < paths.length) {
        const p = paths[next++];
        const st = await this.git(c.rt, this.files.abs(c.project, p), ['status', '--porcelain=v1', '--branch', '--untracked-files=all'], {
          ceiling,
          timeoutMs: 10_000,
        }).catch(() => null);
        // `-uall`: dòng `?? dir/` còn lại là repo con — không tính là thay đổi
        const lines =
          st?.code === 0
            ? st.stdout
                .toString('utf8')
                .split('\n')
                .filter((l) => l && !(l.startsWith('?? ') && l.endsWith('/')))
            : [];
        const head = lines[0]?.startsWith('## ') ? lines[0].slice(3) : '';
        const branch =
          !head || head.startsWith('HEAD (no branch)')
            ? null
            : head
                .replace(/^No commits yet on /, '')
                .split('...')[0]
                .split(' ')[0];
        out.push({ path: p, branch, changes: Math.max(0, lines.length - 1) });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return {
      repos: out.sort((a, b) => (a.path === '' ? -1 : b.path === '' ? 1 : a.path.localeCompare(b.path))),
      more: all.length - paths.length,
    };
  }

  async status(projectId: string, repo?: string) {
    const c = await this.ctx(projectId, repo);
    const ceiling = this.ceilingOf(c.project.rootPath);
    const st = await this.git(c.rt, c.cwd, ['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'], { ceiling });
    if (st.code === 128) return { isRepo: false, branch: null, upstream: null, ahead: 0, behind: 0, changes: [] as GitChange[] };
    if (st.code === 127) throw AppError.badRequest(ErrorCode.GIT_NOT_INSTALLED);
    let branch: string | null = null;
    let upstream: string | null = null;
    let ahead = 0;
    let behind = 0;
    const changes: GitChange[] = [];
    const parts = st.stdout.toString('utf8').split('\0');
    for (let i = 0; i < parts.length; i++) {
      const l = parts[i];
      if (l.startsWith('# branch.head ')) branch = l.slice(14) === '(detached)' ? null : l.slice(14);
      else if (l.startsWith('# branch.upstream ')) upstream = l.slice(18);
      else if (l.startsWith('# branch.ab ')) {
        const m = /\+(\d+) -(\d+)/.exec(l);
        if (m) [ahead, behind] = [Number(m[1]), Number(m[2])];
      } else if (l.startsWith('1 ') || l.startsWith('2 ')) {
        const f = l.split(' ');
        const xy = f[1];
        const p = l.startsWith('1 ') ? f.slice(8).join(' ') : f.slice(9).join(' ');
        const oldPath = l.startsWith('2 ') ? parts[++i] : undefined;
        changes.push({
          path: p,
          oldPath,
          x: xy[0],
          y: xy[1],
          staged: xy[0] !== '.',
          unstaged: xy[1] !== '.',
          untracked: false,
          added: 0,
          deleted: 0,
        });
      } else if (l.startsWith('u ')) {
        const f = l.split(' ');
        changes.push({
          path: f.slice(10).join(' '),
          x: 'U',
          y: 'U',
          staged: false,
          unstaged: true,
          untracked: false,
          added: 0,
          deleted: 0,
        });
      } else if (l.startsWith('? ')) {
        // `-uall` liệt kê từng file; thư mục còn dấu `/` = repo con lồng bên trong → có danh sách repo riêng, không phải thay đổi
        if (l.endsWith('/')) continue;
        changes.push({ path: l.slice(2), x: '?', y: '?', staged: false, unstaged: true, untracked: true, added: 0, deleted: 0 });
      }
    }
    // số dòng +/− (staged và chưa stage cộng lại)
    for (const args of [
      ['diff', '--numstat', '-z'],
      ['diff', '--cached', '--numstat', '-z'],
    ]) {
      const r = await this.git(c.rt, c.cwd, args);
      for (const rec of r.stdout.toString('utf8').split('\0')) {
        const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(rec);
        if (!m) continue;
        const ch = changes.find((x) => x.path === m[3]);
        if (ch) {
          ch.added += m[1] === '-' ? 0 : Number(m[1]);
          ch.deleted += m[2] === '-' ? 0 : Number(m[2]);
        }
      }
    }
    return { isRepo: true, branch, upstream, ahead, behind, changes };
  }

  /**
   * Đường dẫn file từ client phải là tương đối, nằm trong repo: không tuyệt đối, không `~`, không `..`, không pathspec `:…`
   * hay cờ `-…`. `diff --no-index` từng đọc được mọi file trên máy (kể cả `secret.key`) — dogfood breaker #1.
   */
  private rel(c: { project: Parameters<FilesService['abs']>[0] }, repo: string | undefined, file: string) {
    const clean = path.posix.normalize(file);
    if (
      !file ||
      file.includes('\0') ||
      path.posix.isAbsolute(clean) ||
      clean.startsWith('~') ||
      clean === '..' ||
      clean.startsWith('../') ||
      /^[:-]/.test(file)
    )
      throw AppError.forbidden(ErrorCode.PATH_OUTSIDE_ROOT);
    this.files.abs(c.project, path.posix.join(repo ?? '', clean)); // máy local: realpath trong gốc dự án
    return clean;
  }

  async diff(projectId: string, file: string, staged: boolean, repo?: string) {
    const c = await this.ctx(projectId, repo);
    file = this.rel(c, repo, file);
    let r = await this.git(c.rt, c.cwd, ['diff', ...(staged ? ['--cached'] : []), '--no-color', '--no-ext-diff', '-M', '--', file]);
    if (!staged && !r.stdout.length) r = await this.git(c.rt, c.cwd, ['diff', '--no-color', '--no-index', '--', '/dev/null', file]); // file chưa track
    return { path: file, diff: r.stdout.toString('utf8') };
  }

  async fetch(projectId: string, repo?: string) {
    const c = await this.ctx(projectId, repo);
    await this.ok(c.rt, c.cwd, ['fetch', '--prune'], 120_000);
    return this.status(projectId, repo);
  }

  async stage(projectId: string, paths: string[], on: boolean, repo?: string) {
    const c = await this.ctx(projectId, repo);
    const all = paths.length === 1 && paths[0] === '*';
    if (!all) paths = paths.map((p) => this.rel(c, repo, p)); // chặn `:(exclude)…`/`:/` kéo repo con vào thành gitlink (breaker #6)
    // "tất cả" không được kéo repo con vào thành gitlink → loại các thư mục repo con khỏi pathspec
    const nested = all ? await this.nestedRepos(c.rt, c.cwd) : [];
    if (on) await this.ok(c.rt, c.cwd, ['add', '-A', '--', ...(all ? ['.', ...nested.map((d) => `:(exclude)${d}`)] : paths)]);
    else {
      const hasHead = (await this.git(c.rt, c.cwd, ['rev-parse', '--verify', 'HEAD'])).code === 0;
      await this.ok(
        c.rt,
        c.cwd,
        hasHead ? ['reset', '-q', 'HEAD', '--', ...(all ? ['.'] : paths)] : ['rm', '--cached', '-r', '-q', '--', ...(all ? ['.'] : paths)],
      );
    }
    return this.status(projectId, repo);
  }

  /** Repo con chưa theo dõi trong `cwd` (git báo `?? dir/` khi `-uall`). */
  private async nestedRepos(rt: HostRuntime, cwd: string) {
    const r = await this.git(rt, cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
    return r.stdout
      .toString('utf8')
      .split('\0')
      .filter((l) => l.startsWith('?? ') && l.endsWith('/'))
      .map((l) => l.slice(3, -1));
  }

  /** Bỏ thay đổi chưa commit của một file (UI hỏi xác nhận trước). */
  async discard(projectId: string, file: string, repo?: string) {
    const c = await this.ctx(projectId, repo);
    file = this.rel(c, repo, file);
    const st = await this.status(projectId, repo);
    const ch = st.changes.find((x) => x.path === file);
    if (!ch) return st;
    if (ch.untracked) await this.ok(c.rt, c.cwd, ['clean', '-f', '-q', '--', file]);
    else {
      if (ch.staged) await this.ok(c.rt, c.cwd, ['reset', '-q', 'HEAD', '--', file]);
      await this.ok(c.rt, c.cwd, ['checkout', '-q', '--', file]);
    }
    return this.status(projectId, repo);
  }

  async commit(projectId: string, message: string, repo?: string) {
    const c = await this.ctx(projectId, repo);
    await this.ok(c.rt, c.cwd, ['commit', '-q', '-m', message]);
    return this.status(projectId, repo);
  }

  async pull(projectId: string, repo?: string) {
    const c = await this.ctx(projectId, repo);
    await this.ok(c.rt, c.cwd, ['pull', '--ff-only'], 120_000);
    return this.status(projectId, repo);
  }

  /** Push; chưa có upstream → tự `-u origin HEAD`. Bị từ chối → 409 GIT_NON_FAST_FORWARD, không tự merge. */
  async push(projectId: string, repo?: string) {
    const c = await this.ctx(projectId, repo);
    const st = await this.status(projectId, repo);
    await this.ok(c.rt, c.cwd, st.upstream ? ['push'] : ['push', '-u', 'origin', 'HEAD'], 120_000);
    return this.status(projectId, repo);
  }

  async branches(projectId: string, repo?: string) {
    const c = await this.ctx(projectId, repo);
    const out = await this.ok(c.rt, c.cwd, ['branch', '-a', '--format=%(refname:short)\x1f%(HEAD)\x1f%(refname)']);
    const local: string[] = [];
    const remote: string[] = [];
    let current: string | null = null;
    for (const l of out.split('\n').filter(Boolean)) {
      const [name, head, ref] = l.split('\x1f');
      if (ref.startsWith('refs/remotes/')) {
        if (!name.endsWith('/HEAD') && name.includes('/')) remote.push(name);
      } else {
        local.push(name);
        if (head === '*') current = name;
      }
    }
    return { current, local, remote };
  }

  async checkout(projectId: string, branch: string, create: boolean, repo?: string) {
    const c = await this.ctx(projectId, repo);
    const valid = await this.git(c.rt, c.cwd, ['check-ref-format', '--branch', branch]);
    if (valid.code !== 0) throw AppError.badRequest(ErrorCode.VALIDATION_FAILED, { field: 'branch' });
    if (create) await this.ok(c.rt, c.cwd, ['checkout', '-q', '-b', branch]);
    else if (branch.includes('/') && !(await this.branches(projectId, repo)).local.includes(branch))
      await this.ok(c.rt, c.cwd, ['checkout', '-q', '--track', branch]);
    else await this.ok(c.rt, c.cwd, ['checkout', '-q', branch]);
    return this.status(projectId, repo);
  }

  /** Lịch sử 50 commit/lần (AC-19). */
  async commits(projectId: string, cursor = 0, repo?: string) {
    const c = await this.ctx(projectId, repo);
    const n = LIMITS.GIT_LOG_PAGE;
    const r = await this.git(c.rt, c.cwd, ['log', `--skip=${cursor}`, `-n${n + 1}`, '--format=%H%x1f%h%x1f%an%x1f%aI%x1f%s%x1e']);
    if (r.code !== 0) return { commits: [], next: null };
    const rows = r.stdout
      .toString('utf8')
      .split('\x1e')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [sha, short, author, date, subject] = s.split('\x1f');
        return { sha, short, author, date, subject };
      });
    return { commits: rows.slice(0, n), next: rows.length > n ? cursor + n : null };
  }

  async commitDetail(projectId: string, sha: string, file?: string, repo?: string) {
    if (!/^[0-9a-f]{4,40}$/i.test(sha)) throw AppError.badRequest(ErrorCode.VALIDATION_FAILED, { field: 'sha' });
    const c = await this.ctx(projectId, repo);
    const meta = await this.ok(c.rt, c.cwd, ['show', '-s', '--format=%H%x1f%an%x1f%aI%x1f%B', sha]);
    const [full, author, date, body] = meta.split('\x1f');
    const ns = await this.ok(c.rt, c.cwd, ['show', '--format=', '--numstat', '-M', sha]);
    const files = ns
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const [a, d, p] = l.split('\t');
        return { path: p, added: a === '-' ? 0 : Number(a), deleted: d === '-' ? 0 : Number(d) };
      });
    const diff = file ? await this.ok(c.rt, c.cwd, ['show', '--format=', '--no-color', '-M', sha, '--', file]) : undefined;
    return { sha: full, author, date, message: body?.trim() ?? '', files, diff };
  }
}
