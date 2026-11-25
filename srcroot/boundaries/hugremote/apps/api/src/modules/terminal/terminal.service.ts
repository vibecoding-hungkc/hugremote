import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { ErrorCode, isWithin, LIMITS, normalizeRemotePath, TerminalStatus, UserRole } from '@app/shared';
import { AppError } from '../../common/app-error';
import type { AuthUser } from '../../common/auth-user';
import { PathOutsideRootError, resolveWithinRoot } from '../../integrations/host/host-runtime';
import { PtyManager, type PtyViewer } from '../../integrations/pty/pty-manager';
import { EventsService } from '../events/events.service';
import { HostsService, LOCAL_HOST_ID } from '../hosts/hosts.service';
import { WorkspaceService } from '../workspace/workspace.service';
import type { TerminalDto, TmuxSessionDto } from './dto/terminal.dto';
import { TerminalSessionEntity } from './terminal.entity';
import { TerminalRepository } from './terminal.repository';

const toDto = (t: TerminalSessionEntity): TerminalDto => ({
  id: t.id,
  projectId: t.projectId,
  name: t.name,
  cwd: t.cwd,
  status: t.status as TerminalStatus,
  exitCode: t.exitCode ?? undefined,
  createdAt: t.createdAt,
  lastAttachedAt: t.lastAttachedAt ?? undefined,
  ownerUserId: t.ownerUserId,
  tmuxName: t.tmuxName ?? undefined,
});

const TMUX_NAME = /^[A-Za-z0-9_-]{1,64}$/; // không có `.`/`:` — tmux tự đổi chúng trong tên session
const tmuxArgv = (name: string) => ['tmux', 'new-session', '-A', '-s', name];

@Injectable()
export class TerminalService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Terminal');
  readonly ptys: PtyManager;

  constructor(
    private readonly repo: TerminalRepository,
    private readonly ws: WorkspaceService,
    private readonly hosts: HostsService,
    private readonly events: EventsService,
  ) {
    this.ptys = new PtyManager((id, code) => void this.markExited(id, code));
  }

  async onModuleInit() {
    await this.repo.markAllExited();
    this.ws.registerHooks({
      countSessions: (projectId) => this.repo.countRunningInProject(projectId),
      stopSessions: async (projectId) => {
        for (const t of await this.repo.byProject(projectId)) this.ptys.kill(t.id);
      },
    });
  }

  onModuleDestroy() {
    this.ptys.killAll();
  }

  private async markExited(id: string, code: number | null) {
    const t = await this.repo.get(id);
    if (!t) return;
    // Phiên tmux: PTY thoát (bị reap, SSH đứt, ⌘Q) không có nghĩa session chết — còn thì giữ `running` để gắn lại (AC-55)
    if (t.tmuxName && (await this.tmuxAlive(t).catch(() => false))) return;
    await this.repo.update(id, { status: 'exited', exitCode: code });
    this.events.publish({
      type: 'session_status',
      data: { sessionId: id, kind: 'terminal', projectId: t.projectId, status: 'exited' },
      ownerUserId: t.ownerUserId,
    });
  }

  /** G-13: member chỉ thấy/điều khiển phiên của mình. Không có hoặc không phải của mình → cùng một lỗi. */
  async owned(u: AuthUser, id: string): Promise<TerminalSessionEntity> {
    const t = await this.repo.get(id);
    if (!t) throw AppError.notFound();
    if (u.role !== UserRole.OWNER && t.ownerUserId !== u.id) throw AppError.forbidden(ErrorCode.NOT_SESSION_OWNER);
    return t;
  }

  async list(u: AuthUser, projectId: string): Promise<TerminalDto[]> {
    await this.ws.get(projectId);
    return (await this.repo.byProject(projectId, u.role === UserRole.OWNER ? undefined : u.id)).map(toDto);
  }

  async listAll(u: AuthUser): Promise<TerminalDto[]> {
    return (await this.repo.all(u.role === UserRole.OWNER ? undefined : u.id)).map(toDto);
  }

  /** `cwd` tương đối gốc dự án, phải nằm trong gốc (G-4). */
  private resolveCwd(hostId: string, root: string, cwd?: string): string {
    if (!cwd) return root;
    if (hostId === LOCAL_HOST_ID) {
      try {
        const abs = resolveWithinRoot(path.resolve(root, cwd), root);
        return abs;
      } catch (e) {
        if (e instanceof PathOutsideRootError) throw AppError.forbidden(ErrorCode.PATH_OUTSIDE_ROOT);
        throw e;
      }
    }
    const joined = normalizeRemotePath(cwd.startsWith('/') || cwd.startsWith('~') ? cwd : `${root}/${cwd}`);
    if (!isWithin(root, joined)) throw AppError.forbidden(ErrorCode.PATH_OUTSIDE_ROOT);
    return joined;
  }

  async create(u: AuthUser, projectId: string, name?: string, cwd?: string, tmux?: string): Promise<TerminalDto> {
    const { project, rt } = await this.ws.context(projectId);
    if (this.ptys.count >= LIMITS.TERMINAL_MAX_SESSIONS)
      throw AppError.conflict(ErrorCode.SESSION_LIMIT, { max: LIMITS.TERMINAL_MAX_SESSIONS });
    const dir = this.resolveCwd(project.hostId, project.rootPath, cwd);
    if (tmux !== undefined) await this.assertTmux(project.hostId, tmux);
    const id = crypto.randomUUID();
    let pty;
    try {
      pty = await rt.spawnPty(dir, 80, 24, tmux ? tmuxArgv(tmux) : undefined);
    } catch (e) {
      return HostsService.mapSshError(e);
    }
    const n = (await this.repo.byProject(projectId)).length + 1;
    const row = Object.assign(new TerminalSessionEntity(), {
      id,
      projectId,
      ownerUserId: u.id,
      name: name?.trim() || tmux || `Terminal ${n}`,
      cwd: dir,
      status: 'running',
      exitCode: null,
      createdAt: new Date().toISOString(),
      lastAttachedAt: null,
      tmuxName: tmux ?? null,
    });
    await this.repo.insert(row);
    this.ptys.add(id, pty);
    this.events.publish({
      type: 'session_status',
      data: { sessionId: id, kind: 'terminal', projectId, status: 'running' },
      ownerUserId: u.id,
    });
    this.log.log(`Mở terminal ${id} ở ${project.hostId}`);
    return toDto(row);
  }

  async rename(u: AuthUser, id: string, name: string): Promise<TerminalDto> {
    await this.owned(u, id);
    await this.repo.update(id, { name: name.trim() });
    return toDto((await this.repo.get(id))!);
  }

  /** Đóng: dừng PTY (nếu còn) rồi xoá khỏi danh sách. Phiên tmux: tắt hẳn session (Q-4). */
  async remove(u: AuthUser, id: string) {
    const t = await this.owned(u, id);
    await this.repo.delete(id);
    this.ptys.kill(id);
    if (t.tmuxName) {
      const { rt } = await this.ws.context(t.projectId);
      await rt.exec(['tmux', 'kill-session', '-t', `=${t.tmuxName}`]).catch(() => undefined);
    }
  }

  /** AC-56: shell mới cho đúng bản ghi cũ (giữ id, tên) — tab không đổi. Phiên tmux: gắn lại session. */
  async reopen(u: AuthUser, id: string): Promise<TerminalDto> {
    const t = await this.owned(u, id);
    if (this.ptys.has(id)) throw AppError.conflict(ErrorCode.SESSION_STILL_RUNNING);
    await this.spawnFor(t, 80, 24);
    await this.repo.update(id, { status: 'running', exitCode: null });
    this.events.publish({
      type: 'session_status',
      data: { sessionId: id, kind: 'terminal', projectId: t.projectId, status: 'running' },
      ownerUserId: t.ownerUserId,
    });
    return toDto((await this.repo.get(id))!);
  }

  /** `tmux ls` của máy (AC-54) — kèm id phiên HugRemote đang gắn, nếu có. */
  async tmuxSessions(projectId: string): Promise<TmuxSessionDto[]> {
    const { project, rt } = await this.ws.context(projectId);
    await this.assertTmux(project.hostId);
    const r = await rt.exec(['tmux', 'list-sessions', '-F', '#{session_name}:#{session_windows}:#{session_created}']);
    if (r.code !== 0) return []; // chưa có tmux server = chưa có session nào
    const mine = new Map((await this.repo.all()).filter((x) => x.tmuxName && x.projectId === projectId).map((x) => [x.tmuxName!, x.id]));
    return parseTmuxLs(r.stdout.toString()).map((x) => ({ ...x, sessionId: mine.get(x.name) }));
  }

  private async assertTmux(hostId: string, name?: string) {
    if (hostId === LOCAL_HOST_ID) throw AppError.badRequest(ErrorCode.TMUX_LOCAL_NOT_SUPPORTED);
    if (name !== undefined && !TMUX_NAME.test(name)) throw AppError.badRequest(ErrorCode.TMUX_NAME_INVALID);
    const rt = await this.hosts.runtime(hostId);
    const r = await rt.exec(['sh', '-c', 'command -v tmux']).catch(() => null);
    if (!r || r.code !== 0) throw AppError.badRequest(ErrorCode.TMUX_NOT_INSTALLED);
  }

  private async tmuxAlive(t: TerminalSessionEntity) {
    const { rt } = await this.ws.context(t.projectId);
    return (await rt.exec(['tmux', 'has-session', '-t', `=${t.tmuxName}`])).code === 0;
  }

  private async spawnFor(t: TerminalSessionEntity, cols: number, rows: number) {
    const { rt } = await this.ws.context(t.projectId);
    let pty;
    try {
      pty = await rt.spawnPty(t.cwd, cols, rows, t.tmuxName ? tmuxArgv(t.tmuxName) : undefined);
    } catch (e) {
      return HostsService.mapSshError(e);
    }
    this.ptys.add(t.id, pty);
  }

  async attach(u: AuthUser, id: string, viewer: PtyViewer, cols: number, rows: number): Promise<boolean> {
    const t = await this.owned(u, id);
    // AC-55: phiên tmux còn `running` nhưng chưa có PTY (sau restart / bị reap) → gắn lại lười
    if (t.status === 'running' && t.tmuxName && !this.ptys.has(id)) await this.spawnFor(t, cols, rows);
    if (t.status !== 'running' || !this.ptys.attach(id, viewer, cols, rows)) return false;
    await this.repo.update(id, { lastAttachedAt: new Date().toISOString() });
    return true;
  }

  /** Dừng mọi phiên của một người (thu hồi member — AC-45). */
  async stopAllOf(userId: string) {
    for (const t of await this.repo.all(userId)) this.ptys.kill(t.id);
  }

  async runningOf(userId: string) {
    return (await this.repo.all(userId)).filter((t) => t.status === 'running').length;
  }

  runningCount() {
    return this.ptys.count;
  }
}

/** `name:windows:created(epoch)` mỗi dòng → DTO (tmux đổi tab thành `_` khi in, còn `:` không có trong tên session). */
export function parseTmuxLs(out: string): Omit<TmuxSessionDto, 'sessionId'>[] {
  return out
    .split('\n')
    .map((l) => l.split(':'))
    .filter((c) => c.length >= 3 && c[0])
    .map(([name, w, c]) => ({ name, windows: Number(w) || 0, createdAt: new Date(Number(c) * 1000).toISOString() }));
}
