import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'node:crypto';
import { Repository } from 'typeorm';
import { ErrorCode, UserRole } from '@app/shared';
import { AppError } from '../../common/app-error';
import type { AuthUser } from '../../common/auth-user';
import { WorkspaceService } from '../workspace/workspace.service';
import type { WebSessionDto, WebSessionPatch } from './dto/web-session.dto';
import { WebSessionEntity } from './web-session.entity';

/** Chỉ trang chạy trên localhost/127.0.0.1 (qua chuyển tiếp cổng) hoặc file trong dự án — G-17, ARCHITECTURE §6. */
export function checkWebUrl(raw: string, root?: string): { url: string; name: string } {
  const s = raw.trim();
  if (/^file:\/\//i.test(s)) {
    const p = s.slice(7);
    let dec: string;
    try {
      dec = decodeURIComponent(p); // `%2f..%2f` cũng là `..`
    } catch {
      throw AppError.badRequest(ErrorCode.WEB_URL_NOT_ALLOWED);
    }
    if (!p || dec.includes('\0') || /(^|\/)\.\.(\/|$)/.test(dec)) throw AppError.badRequest(ErrorCode.WEB_URL_NOT_ALLOWED);
    // chỉ file trong dự án (dogfood breaker: `file:///etc/passwd` từng được nhận) — web dựng URL là `file://${rootPath}/${rel}`
    const base = root?.replace(/\/+$/, '');
    if (base === undefined || (dec !== base && !dec.startsWith(`${base}/`))) throw AppError.badRequest(ErrorCode.WEB_URL_NOT_ALLOWED);
    return { url: `file://${p}`, name: p.split('/').filter(Boolean).pop() ?? p };
  }
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `http://${s}`);
  } catch {
    throw AppError.badRequest(ErrorCode.WEB_URL_NOT_ALLOWED);
  }
  if (!/^https?:$/.test(u.protocol) || !['localhost', '127.0.0.1'].includes(u.hostname) || u.port === '0')
    throw AppError.badRequest(ErrorCode.WEB_URL_NOT_ALLOWED);
  return { url: u.toString(), name: `${u.host}${u.pathname === '/' ? '' : u.pathname}` };
}

const toDto = (w: WebSessionEntity): WebSessionDto => ({ ...w, lastOpenedAt: w.lastOpenedAt ?? undefined });

@Injectable()
export class WebSessionsService {
  constructor(
    @InjectRepository(WebSessionEntity) private readonly rows: Repository<WebSessionEntity>,
    private readonly ws: WorkspaceService,
  ) {}

  /** G-13: member chỉ thấy phiên của mình. */
  private async owned(u: AuthUser, id: string) {
    const w = await this.rows.findOne({ where: { id } });
    if (!w) throw AppError.notFound();
    if (u.role !== UserRole.OWNER && w.ownerUserId !== u.id) throw AppError.forbidden(ErrorCode.NOT_SESSION_OWNER);
    return w;
  }

  async list(u: AuthUser): Promise<WebSessionDto[]> {
    return (await this.rows.find({ where: u.role === UserRole.OWNER ? {} : { ownerUserId: u.id }, order: { createdAt: 'ASC' } })).map(
      toDto,
    );
  }

  async create(u: AuthUser, projectId: string, raw: string): Promise<WebSessionDto> {
    const project = await this.ws.get(projectId);
    const { url, name } = checkWebUrl(raw, project.rootPath);
    const w = Object.assign(new WebSessionEntity(), {
      id: crypto.randomUUID(),
      projectId,
      ownerUserId: u.id,
      url,
      name,
      createdAt: new Date().toISOString(),
      lastOpenedAt: null,
    });
    await this.rows.insert(w);
    return toDto(w);
  }

  /** Nhập link khác = đổi trang ngay trong phiên này (Q-9). */
  async patch(u: AuthUser, id: string, b: WebSessionPatch): Promise<WebSessionDto> {
    const w = await this.owned(u, id);
    const nav = b.url !== undefined ? checkWebUrl(b.url, (await this.ws.get(w.projectId)).rootPath) : null;
    const next = { url: nav?.url ?? w.url, name: b.name?.trim() || nav?.name || w.name, lastOpenedAt: new Date().toISOString() };
    await this.rows.update({ id }, next);
    return toDto({ ...w, ...next });
  }

  async remove(u: AuthUser, id: string) {
    await this.owned(u, id);
    await this.rows.delete({ id });
  }
}
