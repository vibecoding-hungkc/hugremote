import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { ErrorCode, normalizeRemotePath } from '@app/shared';
import { APP_CONFIG } from '../../config/app-config';
import type { AppConfig } from '../../config/app-config';
import { AppError } from '../../common/app-error';
import { PathNotFoundError, PathOutsideRootError, resolveWithinRoot, type HostRuntime } from '../../integrations/host/host-runtime';
import { HostsService, LOCAL_HOST_ID } from '../hosts/hosts.service';
import { ProjectEntity } from './project.entity';
import { WorkspaceRepository } from './workspace.repository';
import type { BrowseDto, ProjectDto } from './dto/workspace.dto';

/** Module khác (terminal, claude) khai số phiên và dọn phiên khi dự án bị bỏ. */
export interface ProjectSessionHooks {
  countSessions(projectId: string): Promise<number>;
  stopSessions(projectId: string): Promise<void>;
}

const toDto = (p: ProjectEntity): ProjectDto => ({ id: p.id, hostId: p.hostId, name: p.name, rootPath: p.rootPath, isHome: !!p.isHome });

@Injectable()
export class WorkspaceService implements OnModuleInit {
  private readonly hooks: ProjectSessionHooks[] = [];

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly repo: WorkspaceRepository,
    private readonly hosts: HostsService,
  ) {}

  onModuleInit() {
    // Xoá máy → xoá dự án của máy (phiên đi theo khoá ngoại + hook dừng tiến trình)
    this.hosts.onHostRemoved(async (hostId) => {
      for (const p of await this.repo.byHost(hostId)) for (const h of this.hooks) await h.stopSessions(p.id);
      await this.repo.deleteByHost(hostId);
    });
  }

  registerHooks(h: ProjectSessionHooks) {
    this.hooks.push(h);
  }

  /** Khoá tự nhiên → id: sha256(host + đường dẫn chuẩn hoá), 32 ký tự hex (ARCHITECTURE §6). */
  static projectId(hostId: string, rootPath: string) {
    return crypto.createHash('sha256').update(`${hostId}\0${rootPath}`).digest('hex').slice(0, 32);
  }

  /** Chuẩn hoá: local → tuyệt đối trong ALLOWED_ROOT (G-4); remote → `~/…` hoặc tuyệt đối, không mở rộng bằng home local. */
  normalize(hostId: string, p: string): string {
    if (hostId === LOCAL_HOST_ID) {
      try {
        return resolveWithinRoot(p, this.cfg.allowedRoot);
      } catch (e) {
        if (e instanceof PathOutsideRootError) throw AppError.forbidden(ErrorCode.PATH_OUTSIDE_ROOT);
        throw e;
      }
    }
    return normalizeRemotePath(p);
  }

  private async ensureHome(hostId: string) {
    if (await this.repo.home(hostId)) return;
    const root = this.normalize(hostId, await this.hosts.workspaceDir(hostId));
    const id = WorkspaceService.projectId(hostId, root);
    if (await this.repo.get(id)) return;
    await this.repo.insert(
      Object.assign(new ProjectEntity(), { id, hostId, name: 'Home', rootPath: root, isHome: 1, createdAt: new Date().toISOString() }),
    );
  }

  async list(hostId: string): Promise<ProjectDto[]> {
    this.hosts.assertExists(hostId);
    await this.ensureHome(hostId);
    return (await this.repo.byHost(hostId)).map(toDto);
  }

  async get(id: string): Promise<ProjectEntity> {
    const p = await this.repo.get(id);
    if (!p) throw AppError.notFound();
    return p;
  }

  async getDto(id: string) {
    return toDto(await this.get(id));
  }

  /** Dự án + máy để chạy lệnh trong dự án — files, git, terminal, claude đều đi qua đây. */
  async context(projectId: string): Promise<{ project: ProjectEntity; rt: HostRuntime }> {
    const project = await this.get(projectId);
    try {
      return { project, rt: await this.hosts.runtime(project.hostId) };
    } catch (e) {
      return HostsService.mapSshError(e);
    }
  }

  /** Idempotent theo (máy, đường dẫn chuẩn hoá): đã có → trả bản cũ (ARCHITECTURE §6 "Trùng dữ liệu"). */
  async create(hostId: string, rootPath: string, name?: string): Promise<ProjectDto> {
    this.hosts.assertExists(hostId);
    const root = this.normalize(hostId, rootPath);
    const id = WorkspaceService.projectId(hostId, root);
    const existing = await this.repo.get(id);
    if (existing) return toDto(existing);
    const rt = await this.hosts.runtime(hostId).catch((e) => HostsService.mapSshError(e));
    const st = await rt.stat(root).catch((e) => HostsService.mapSshError(e));
    if (!st || st.type !== 'dir') throw AppError.notFound(ErrorCode.PATH_NOT_FOUND);
    const base = root === '~' ? 'Home' : path.posix.basename(root);
    const p = Object.assign(new ProjectEntity(), {
      id,
      hostId,
      name: (name ?? base).slice(0, 80),
      rootPath: root,
      isHome: 0,
      createdAt: new Date().toISOString(),
    });
    await this.repo.insert(p);
    return toDto(p);
  }

  async rename(id: string, name: string): Promise<ProjectDto> {
    await this.get(id);
    await this.repo.rename(id, name.trim());
    return this.getDto(id);
  }

  async countSessions(id: string) {
    let n = 0;
    for (const h of this.hooks) n += await h.countSessions(id);
    return n;
  }

  /** Bỏ dự án = xoá bản ghi cho cả nhóm, dừng mọi phiên (kể cả của member), không đụng thư mục (D15). */
  async remove(id: string) {
    const p = await this.get(id);
    if (p.isHome) throw AppError.forbidden(ErrorCode.HOME_NOT_DELETABLE);
    for (const h of this.hooks) await h.stopSessions(id);
    await this.repo.delete(id);
  }

  async browse(hostId: string, p?: string): Promise<BrowseDto> {
    this.hosts.assertExists(hostId);
    const dir = this.normalize(hostId, p || (await this.hosts.workspaceDir(hostId)));
    const rt = await this.hosts.runtime(hostId).catch((e) => HostsService.mapSshError(e));
    let entries;
    try {
      entries = await rt.readdir(dir);
    } catch (e) {
      if (e instanceof PathNotFoundError) throw AppError.notFound(ErrorCode.PATH_NOT_FOUND);
      if (e instanceof PathOutsideRootError) throw AppError.forbidden(ErrorCode.PATH_OUTSIDE_ROOT);
      return HostsService.mapSshError(e);
    }
    const sorted = entries
      .filter((e) => e.type === 'dir' || e.type === 'link')
      .map((e) => ({ name: e.name, type: e.type, hidden: e.name.startsWith('.') }))
      .sort((a, b) => Number(a.hidden) - Number(b.hidden) || a.name.localeCompare(b.name));
    let parent: string | undefined;
    if (hostId === LOCAL_HOST_ID) {
      const up = path.dirname(dir);
      try {
        if (up !== dir) parent = resolveWithinRoot(up, this.cfg.allowedRoot);
      } catch {
        parent = undefined; // đỉnh ALLOWED_ROOT
      }
    } else if (dir !== '/' && dir !== '~') {
      parent = normalizeRemotePath(dir + '/..');
      if (dir.startsWith('~') && parent === '~' && dir === '~') parent = undefined;
    }
    const pid = WorkspaceService.projectId(hostId, dir);
    const existing = await this.repo.get(pid);
    return { path: dir, parent, entries: sorted, projectId: existing?.id };
  }

  async mkdir(hostId: string, p: string): Promise<BrowseDto> {
    const name = path.posix.basename(p);
    if (!name || name === '.' || name === '..' || /[/\0]/.test(name) || name.length > 255)
      throw AppError.badRequest(ErrorCode.VALIDATION_FAILED, { field: 'name' });
    const dir = this.normalize(hostId, p);
    const rt = await this.hosts.runtime(hostId).catch((e) => HostsService.mapSshError(e));
    if (await rt.stat(dir)) throw AppError.conflict(ErrorCode.PATH_EXISTS);
    try {
      await rt.mkdir(dir);
    } catch (e) {
      if (e instanceof PathOutsideRootError) throw AppError.forbidden(ErrorCode.PATH_OUTSIDE_ROOT);
      if (e instanceof PathNotFoundError) throw AppError.notFound(ErrorCode.PATH_NOT_FOUND);
      throw e;
    }
    return this.browse(hostId, dir);
  }
}
