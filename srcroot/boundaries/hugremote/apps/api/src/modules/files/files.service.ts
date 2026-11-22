import { Injectable } from '@nestjs/common';
import * as path from 'node:path';
import { ErrorCode, isWithin, LIMITS, normalizeRemotePath } from '@app/shared';
import { AppError } from '../../common/app-error';
import { PathNotFoundError, PathOutsideRootError, resolveWithinRoot, type HostRuntime } from '../../integrations/host/host-runtime';
import { HostsService, LOCAL_HOST_ID } from '../hosts/hosts.service';
import type { ProjectEntity } from '../workspace/project.entity';
import { WorkspaceService } from '../workspace/workspace.service';

export interface FsEntry {
  name: string;
  path: string;
  type: 'dir' | 'file' | 'link';
  size: number;
  mtime: number;
  hidden: boolean;
  ignored: boolean;
  git?: 'M' | 'A' | 'D' | 'U' | '?';
}

const BINARY_SNIFF = 8000;
const isBinary = (b: Buffer) => b.subarray(0, BINARY_SNIFF).includes(0);

interface Ctx {
  project: ProjectEntity;
  rt: HostRuntime;
}

/** files-api.v1 — mọi đường dẫn là tương đối gốc dự án và phải nằm trong gốc (G-4). */
@Injectable()
export class FilesService {
  constructor(private readonly ws: WorkspaceService) {}

  async ctx(projectId: string): Promise<Ctx> {
    return this.ws.context(projectId);
  }

  /** `rel` (tương đối gốc) → đường dẫn trên máy đích, chặn thoát khỏi gốc dự án. */
  abs(project: ProjectEntity, rel = ''): string {
    const clean = rel.replace(/^\/+/, '');
    if (clean.includes('\0')) throw AppError.forbidden(ErrorCode.PATH_OUTSIDE_ROOT);
    if (project.hostId === LOCAL_HOST_ID) {
      try {
        return resolveWithinRoot(path.join(project.rootPath, clean), project.rootPath);
      } catch (e) {
        if (e instanceof PathOutsideRootError) throw AppError.forbidden(ErrorCode.PATH_OUTSIDE_ROOT);
        throw e;
      }
    }
    const p = normalizeRemotePath(clean ? `${project.rootPath}/${clean}` : project.rootPath);
    if (!isWithin(project.rootPath, p)) throw AppError.forbidden(ErrorCode.PATH_OUTSIDE_ROOT);
    return p;
  }

  private rel(project: ProjectEntity, abs: string) {
    return abs === project.rootPath ? '' : abs.slice(project.rootPath.length + 1);
  }

  private static mapFsError(e: unknown): never {
    if (e instanceof PathNotFoundError || (e as NodeJS.ErrnoException)?.code === 'ENOENT')
      throw AppError.notFound(ErrorCode.PATH_NOT_FOUND);
    if (e instanceof PathOutsideRootError) throw AppError.forbidden(ErrorCode.PATH_OUTSIDE_ROOT);
    if ((e as NodeJS.ErrnoException)?.code === 'EEXIST') throw AppError.conflict(ErrorCode.PATH_EXISTS);
    return HostsService.mapSshError(e);
  }

  /** Trạng thái git theo đường dẫn tương đối gốc dự án (rỗng nếu không phải repo). */
  async gitStatusMap(c: Ctx): Promise<Map<string, FsEntry['git']>> {
    const m = new Map<string, FsEntry['git']>();
    const r = await c.rt
      .exec(['git', 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--', '.'], { cwd: c.project.rootPath, timeoutMs: 15_000 })
      .catch(() => null);
    if (!r || r.code !== 0) return m;
    const prefix = (await c.rt.exec(['git', 'rev-parse', '--show-prefix'], { cwd: c.project.rootPath })).stdout.toString().trim();
    const parts = r.stdout.toString('utf8').split('\0');
    for (let i = 0; i < parts.length; i++) {
      const line = parts[i];
      if (line.length < 4) continue;
      const xy = line.slice(0, 2);
      let file = line.slice(3);
      if (xy[0] === 'R' || xy[0] === 'C') i++; // tên cũ đi kèm
      if (prefix && file.startsWith(prefix)) file = file.slice(prefix.length);
      const st: FsEntry['git'] = xy === '??' ? '?' : xy.includes('U') ? 'U' : xy.includes('D') ? 'D' : xy.includes('A') ? 'A' : 'M';
      m.set(file, st);
      // thư mục cha mang dấu chấm "có thay đổi bên trong"
      let dir = path.posix.dirname(file);
      while (dir && dir !== '.') {
        if (!m.has(dir + '/')) m.set(dir + '/', 'M');
        dir = path.posix.dirname(dir);
      }
    }
    return m;
  }

  async list(projectId: string, rel: string, showHidden: boolean) {
    const c = await this.ctx(projectId);
    const dir = this.abs(c.project, rel);
    let entries;
    try {
      entries = await c.rt.readdir(dir);
    } catch (e) {
      return FilesService.mapFsError(e);
    }
    const base = this.rel(c.project, dir);
    const relOf = (n: string) => (base ? `${base}/${n}` : n);
    const filtered = entries
      .filter((e) => showHidden || !e.name.startsWith('.') || e.name === '.gitignore')
      .filter((e) => e.name !== '.git');
    // cờ .gitignore: một lần `git check-ignore --stdin`
    const ignored = new Set<string>();
    if (filtered.length) {
      const r = await c.rt
        .exec(['git', 'check-ignore', '--stdin'], {
          cwd: c.project.rootPath,
          stdin: filtered.map((e) => relOf(e.name)).join('\n') + '\n',
          timeoutMs: 10_000,
        })
        .catch(() => null);
      if (r) for (const l of r.stdout.toString().split('\n')) if (l) ignored.add(l.replace(/\/$/, ''));
    }
    const git = await this.gitStatusMap(c);
    const out: FsEntry[] = filtered
      .map((e) => {
        const p = relOf(e.name);
        return {
          name: e.name,
          path: p,
          type: e.type,
          size: e.size,
          mtime: e.mtime,
          hidden: e.name.startsWith('.'),
          ignored: ignored.has(p),
          git: e.type === 'dir' ? (git.get(p + '/') ? 'M' : undefined) : git.get(p),
        };
      })
      .sort((a, b) => Number(b.type === 'dir') - Number(a.type === 'dir') || a.name.localeCompare(b.name));
    return { path: base, entries: out };
  }

  async read(projectId: string, rel: string, tail?: number) {
    const c = await this.ctx(projectId);
    const p = this.abs(c.project, rel);
    const st = await c.rt.stat(p).catch((e) => FilesService.mapFsError(e));
    if (!st) throw AppError.notFound(ErrorCode.PATH_NOT_FOUND);
    if (st.type === 'dir') throw AppError.badRequest(ErrorCode.VALIDATION_FAILED, { reason: 'is directory' });
    if (tail) {
      const buf = await c.rt.readTail(p, Math.min(tail, LIMITS.FILE_MAX_BYTES)).catch((e) => FilesService.mapFsError(e));
      const text = buf.toString('utf8');
      return {
        path: rel,
        content: text.slice(text.indexOf('\n') + 1),
        mtime: st.mtime,
        size: st.size,
        binary: false,
        truncated: st.size > buf.length,
      };
    }
    if (st.size > LIMITS.FILE_MAX_BYTES) throw AppError.tooLarge(ErrorCode.FILE_TOO_LARGE, { size: st.size, max: LIMITS.FILE_MAX_BYTES });
    const buf = await c.rt.readFile(p, LIMITS.FILE_MAX_BYTES).catch((e) => FilesService.mapFsError(e));
    const binary = isBinary(buf);
    return { path: rel, content: binary ? '' : buf.toString('utf8'), mtime: st.mtime, size: st.size, binary, truncated: false };
  }

  async raw(projectId: string, rel: string) {
    const c = await this.ctx(projectId);
    const p = this.abs(c.project, rel);
    const st = await c.rt.stat(p);
    if (!st || st.type === 'dir') throw AppError.notFound(ErrorCode.PATH_NOT_FOUND);
    if (st.size > LIMITS.UPLOAD_MAX_BYTES) throw AppError.tooLarge(ErrorCode.FILE_TOO_LARGE, { size: st.size });
    return { name: path.posix.basename(p), data: await c.rt.readFile(p).catch((e) => FilesService.mapFsError(e)) };
  }

  /** Lưu kèm `baseMtime`: file đã đổi trên máy → 409 FILE_CHANGED, không ghi đè im lặng (G-15). */
  async write(projectId: string, rel: string, content: string, baseMtime?: number) {
    const c = await this.ctx(projectId);
    const p = this.abs(c.project, rel);
    const st = await c.rt.stat(p);
    if (st && baseMtime !== undefined && Math.abs(st.mtime - baseMtime) > 1)
      throw AppError.conflict(ErrorCode.FILE_CHANGED, { mtime: st.mtime });
    const data = Buffer.from(content, 'utf8');
    if (data.length > LIMITS.FILE_MAX_BYTES) throw AppError.tooLarge(ErrorCode.FILE_TOO_LARGE);
    await c.rt.writeFile(p, data).catch((e) => FilesService.mapFsError(e));
    const after = await c.rt.stat(p);
    return { mtime: after?.mtime ?? Date.now() };
  }

  async action(projectId: string, op: 'mkdir' | 'touch' | 'rename' | 'copy' | 'delete', rel: string, to?: string) {
    const c = await this.ctx(projectId);
    const p = this.abs(c.project, rel);
    if (p === c.project.rootPath && op !== 'mkdir' && op !== 'touch') throw AppError.forbidden(ErrorCode.PATH_OUTSIDE_ROOT);
    const dst = to !== undefined ? this.abs(c.project, to) : undefined;
    try {
      if (op === 'mkdir') {
        if (await c.rt.stat(p)) throw AppError.conflict(ErrorCode.PATH_EXISTS);
        await c.rt.mkdir(p);
      } else if (op === 'touch') {
        if (await c.rt.stat(p)) throw AppError.conflict(ErrorCode.PATH_EXISTS);
        await c.rt.writeFile(p, Buffer.alloc(0));
      } else if (op === 'rename') {
        if (!dst) throw AppError.badRequest(ErrorCode.VALIDATION_FAILED, { field: 'to' });
        if (await c.rt.stat(dst)) throw AppError.conflict(ErrorCode.PATH_EXISTS);
        await c.rt.rename(p, dst);
      } else if (op === 'copy') {
        if (!dst) throw AppError.badRequest(ErrorCode.VALIDATION_FAILED, { field: 'to' });
        if (await c.rt.stat(dst)) throw AppError.conflict(ErrorCode.PATH_EXISTS);
        const r = await c.rt.exec(['cp', '-R', '--', p, dst]);
        if (r.code !== 0) throw new Error(r.stderr.toString());
      } else {
        await c.rt.remove(p);
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      return FilesService.mapFsError(e);
    }
    return { ok: true };
  }

  async upload(projectId: string, dirRel: string, files: { relativePath: string; data: Buffer }[]) {
    if (files.length > LIMITS.UPLOAD_MAX_FILES) throw AppError.tooLarge(ErrorCode.UPLOAD_TOO_LARGE, { maxFiles: LIMITS.UPLOAD_MAX_FILES });
    const c = await this.ctx(projectId);
    const made = new Set<string>();
    for (const f of files) {
      const rel = path.posix.join(dirRel, f.relativePath.replace(/\\/g, '/'));
      const dst = this.abs(c.project, rel);
      // tạo thư mục cha theo cấu trúc tải lên (giữ cấu trúc thư mục — AC-17)
      const parents = path.posix.dirname(rel).split('/').filter(Boolean);
      let acc = '';
      for (const seg of parents) {
        acc = acc ? `${acc}/${seg}` : seg;
        if (made.has(acc)) continue;
        const ap = this.abs(c.project, acc);
        if (!(await c.rt.stat(ap))) await c.rt.mkdir(ap).catch(() => undefined);
        made.add(acc);
      }
      await c.rt.writeFile(dst, f.data).catch((e) => FilesService.mapFsError(e));
    }
    return { count: files.length };
  }

  /** Tải xuống: file → nguyên file; thư mục → zip tạm (python3 -m zipfile, fallback zip -r). */
  async download(projectId: string, rel: string): Promise<{ name: string; data: Buffer; zip: boolean }> {
    const c = await this.ctx(projectId);
    const p = this.abs(c.project, rel);
    const st = await c.rt.stat(p);
    if (!st) throw AppError.notFound(ErrorCode.PATH_NOT_FOUND);
    const name = path.posix.basename(p) || 'project';
    if (st.type !== 'dir') return { name, data: await c.rt.readFile(p), zip: false };
    const tmp = `/tmp/hugremote-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`;
    let r = await c.rt.exec(['python3', '-m', 'zipfile', '-c', tmp, p], { timeoutMs: 120_000 }).catch(() => null);
    if (!r || r.code !== 0)
      r = await c.rt.exec(['zip', '-qr', tmp, name], { cwd: path.posix.dirname(p), timeoutMs: 120_000 }).catch(() => null);
    if (!r || r.code !== 0) throw AppError.badRequest(ErrorCode.VALIDATION_FAILED, { reason: 'zip' });
    try {
      const sh =
        c.rt.kind === 'local'
          ? await import('node:fs/promises').then((fs) => fs.readFile(tmp))
          : await c.rt.exec(['cat', tmp], { maxBytes: 600 * 1024 * 1024 }).then((x) => x.stdout);
      return { name: `${name}.zip`, data: sh, zip: true };
    } finally {
      await c.rt.exec(['rm', '-f', tmp]).catch(() => undefined);
    }
  }

  /** Tìm trong nội dung (ripgrep trên máy đích, fallback grep), tôn trọng .gitignore, ≤500 kết quả, ≤10s (AC-36). */
  async search(projectId: string, q: string, opts: { regex?: boolean; caseSensitive?: boolean; hidden?: boolean }) {
    const c = await this.ctx(projectId);
    const max = LIMITS.SEARCH_MAX_RESULTS;
    const results: { path: string; line: number; text: string; col: number }[] = [];
    const rgArgs = [
      'rg',
      '--json',
      '--max-count',
      '50',
      '--max-columns',
      '300',
      ...(opts.regex ? [] : ['-F']),
      ...(opts.caseSensitive ? ['-s'] : ['-i']),
      ...(opts.hidden ? ['--hidden', '-g', '!.git'] : []),
      '--',
      q,
      '.',
    ];
    const rg = await c.rt
      .exec(rgArgs, { cwd: c.project.rootPath, timeoutMs: LIMITS.SEARCH_TIMEOUT_SECONDS * 1000, maxBytes: 4 * 1024 * 1024 })
      .catch(() => null);
    let engine: 'rg' | 'grep' = 'rg';
    if (rg && (rg.code === 0 || rg.code === 1)) {
      for (const line of rg.stdout.toString('utf8').split('\n')) {
        if (!line.startsWith('{"type":"match"')) continue;
        try {
          const m = JSON.parse(line) as {
            data: { path: { text: string }; line_number: number; lines: { text: string }; submatches: { start: number }[] };
          };
          results.push({
            path: m.data.path.text.replace(/^\.\//, ''),
            line: m.data.line_number,
            text: m.data.lines.text.replace(/\n$/, '').slice(0, 300),
            col: m.data.submatches[0]?.start ?? 0,
          });
        } catch {
          /* dòng hỏng */
        }
        if (results.length >= max) break;
      }
    } else {
      engine = 'grep';
      const args = [
        'git',
        'grep',
        '-n',
        '-I',
        '--no-color',
        ...(opts.regex ? ['-E'] : ['-F']),
        ...(opts.caseSensitive ? [] : ['-i']),
        '--untracked',
        '-e',
        q,
      ];
      let r = await c.rt
        .exec(args, { cwd: c.project.rootPath, timeoutMs: LIMITS.SEARCH_TIMEOUT_SECONDS * 1000, maxBytes: 4 * 1024 * 1024 })
        .catch(() => null);
      if (!r || r.code === 128)
        r = await c.rt
          .exec(
            [
              'grep',
              '-rnI',
              ...(opts.regex ? ['-E'] : ['-F']),
              ...(opts.caseSensitive ? [] : ['-i']),
              '--exclude-dir=.git',
              '--exclude-dir=node_modules',
              '--',
              q,
              '.',
            ],
            { cwd: c.project.rootPath, timeoutMs: LIMITS.SEARCH_TIMEOUT_SECONDS * 1000, maxBytes: 4 * 1024 * 1024 },
          )
          .catch(() => null);
      for (const l of r?.stdout.toString('utf8').split('\n') ?? []) {
        const m = /^(.+?):(\d+):(.*)$/.exec(l);
        if (!m) continue;
        results.push({
          path: m[1].replace(/^\.\//, ''),
          line: Number(m[2]),
          text: m[3].slice(0, 300),
          col: Math.max(0, m[3].toLowerCase().indexOf(q.toLowerCase())),
        });
        if (results.length >= max) break;
      }
    }
    return { engine, truncated: results.length >= max, results };
  }

  /** Danh sách tên file cho ⌘P: git ls-files + chưa track; không phải repo → find ≤20.000 mục. */
  async files(projectId: string) {
    const c = await this.ctx(projectId);
    const r = await c.rt
      .exec(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], {
        cwd: c.project.rootPath,
        timeoutMs: 15_000,
        maxBytes: 16 * 1024 * 1024,
      })
      .catch(() => null);
    if (r && r.code === 0) return { files: r.stdout.toString('utf8').split('\n').filter(Boolean).slice(0, 50_000) };
    const f = await c.rt
      .exec(['find', '.', '-type', 'f', '-not', '-path', '*/.git/*', '-not', '-path', '*/node_modules/*'], {
        cwd: c.project.rootPath,
        timeoutMs: 15_000,
      })
      .catch(() => null);
    return {
      files: (f?.stdout.toString('utf8').split('\n') ?? [])
        .filter(Boolean)
        .map((x) => x.replace(/^\.\//, ''))
        .slice(0, 20_000),
    };
  }

  /** Dòng mới/đã sửa so với HEAD (`git diff -U0`) — vạch ở cột số dòng (AC-37). */
  async lineChanges(projectId: string, rel: string) {
    const c = await this.ctx(projectId);
    this.abs(c.project, rel);
    const r = await c.rt
      .exec(['git', 'diff', '-U0', '--no-color', 'HEAD', '--', rel], { cwd: c.project.rootPath, timeoutMs: 10_000 })
      .catch(() => null);
    const added: number[] = [];
    const modified: number[] = [];
    if (!r || r.code !== 0) return { added, modified, tracked: false };
    for (const l of r.stdout.toString().split('\n')) {
      const m = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(l);
      if (!m) continue;
      const oldCount = m[1] === undefined ? 1 : Number(m[1]);
      const start = Number(m[2]);
      const count = m[3] === undefined ? 1 : Number(m[3]);
      for (let i = 0; i < count; i++) (oldCount === 0 ? added : modified).push(start + i);
    }
    return { added, modified, tracked: true };
  }
}
