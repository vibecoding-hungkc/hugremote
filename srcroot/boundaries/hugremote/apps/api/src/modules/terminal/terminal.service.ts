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
import type { TerminalDto } from './dto/terminal.dto';
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
});

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

  async create(u: AuthUser, projectId: string, name?: string, cwd?: string): Promise<TerminalDto> {
    const { project, rt } = await this.ws.context(projectId);
    if (this.ptys.count >= LIMITS.TERMINAL_MAX_SESSIONS)
      throw AppError.conflict(ErrorCode.SESSION_LIMIT, { max: LIMITS.TERMINAL_MAX_SESSIONS });
    const dir = this.resolveCwd(project.hostId, project.rootPath, cwd);
    const id = crypto.randomUUID();
    let pty;
    try {
      pty = await rt.spawnPty(dir, 80, 24);
    } catch (e) {
      return HostsService.mapSshError(e);
    }
    const n = (await this.repo.byProject(projectId)).length + 1;
    const row = Object.assign(new TerminalSessionEntity(), {
      id,
      projectId,
      ownerUserId: u.id,
      name: name?.trim() || `Terminal ${n}`,
      cwd: dir,
      status: 'running',
      exitCode: null,
      createdAt: new Date().toISOString(),
      lastAttachedAt: null,
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

  /** Đóng: dừng PTY (nếu còn) rồi xoá khỏi danh sách. */
  async remove(u: AuthUser, id: string) {
    await this.owned(u, id);
    this.ptys.kill(id);
    await this.repo.delete(id);
  }

  async attach(u: AuthUser, id: string, viewer: PtyViewer, cols: number, rows: number): Promise<boolean> {
    const t = await this.owned(u, id);
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
