import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, type MessageEvent } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { concat, filter, interval, map, merge, Observable, of, Subject } from 'rxjs';
import { ClaudeEvent, ClaudeStatus, ErrorCode, LIMITS, mergeChatItem, PermissionMode, UserRole } from '@app/shared';
import { APP_CONFIG } from '../../config/app-config';
import type { AppConfig } from '../../config/app-config';
import { AppError } from '../../common/app-error';
import type { AuthUser } from '../../common/auth-user';
import type { ChatItem, NormOp } from '../../integrations/claude-cli/protocol';
import { listCliSessions, type CliSession } from '../../integrations/claude-cli/cli-sessions';
import { probeCli, type CliOptions } from '../../integrations/claude-cli/probe';
import type { RateLimitInfo } from '../../integrations/claude-cli/protocol';
import { ClaudeTurn } from '../../integrations/claude-cli/runner';
import { EventsService } from '../events/events.service';
import { LOCAL_HOST_ID } from '../hosts/hosts.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { ClaudeSessionEntity } from './claude.entities';
import { ClaudeRepository } from './claude.repository';
import type { ClaudeSessionDto, QueueItemDto } from './dto/claude.dto';

interface Ev {
  seq: number;
  type: ClaudeEvent;
  data: Record<string, unknown>;
}

/** Trạng thái sống của một phiên trong RAM — tác vụ chạy độc lập với kết nối (G-14). */
interface Live {
  turn?: ClaudeTurn;
  ring: Ev[];
  bus: Subject<Ev>;
  /** Mục đang stream chưa chốt (để `sync` gửi đủ phần đang dở). */
  partial: Map<string, ChatItem>;
  pending: Set<string>;
  /** Mô tả yêu cầu quyền đang chờ (cho chuông C38). */
  pendingInfo: Map<string, { tool: string; summary: string }>;
  stopping: boolean;
  /** Lượt vừa nhận `result` có `isError: true` — không tự rút hàng chờ khi tiến trình thoát 0 (AC-40). */
  hadError: boolean;
  turnStartedAt: number;
  /** Bộ đếm seq duy nhất của phiên (khởi từ claude_sessions.last_sequence). */
  seq?: number;
  /** Chuỗi xử lý tuần tự: thao tác của CLI chạy lần lượt để seq phát ra luôn tăng. */
  chain: Promise<unknown>;
}

const now = () => new Date().toISOString();

@Injectable()
export class ClaudeService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Claude');
  private readonly live = new Map<string, Live>();
  /** Hạn mức theo máy — cập nhật mỗi khi CLI phát `rate_limit_event` (AC-25). */
  private readonly limitsByHost = new Map<string, Partial<Record<'five_hour' | 'weekly', RateLimitInfo>>>();
  /** Kết quả `initialize` theo máy + thư mục (model, slash command) — cache 5 phút, tối đa 2 probe cùng lúc (AC-22). */
  private readonly optCache = new Map<string, { at: number; p: Promise<CliOptions> }>();
  private probing = 0;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly repo: ClaudeRepository,
    private readonly ws: WorkspaceService,
    private readonly events: EventsService,
  ) {}

  async onModuleInit() {
    await this.repo.resetRunning();
    this.ws.registerHooks({
      countSessions: (projectId) => this.repo.countRunningInProject(projectId),
      stopSessions: async (projectId) => {
        for (const s of await this.repo.byProject(projectId)) this.live.get(s.id)?.turn?.kill();
      },
    });
  }

  onModuleDestroy() {
    for (const l of this.live.values()) l.turn?.kill();
  }

  private L(id: string): Live {
    let l = this.live.get(id);
    if (!l) {
      l = {
        ring: [],
        bus: new Subject(),
        partial: new Map(),
        pending: new Set(),
        pendingInfo: new Map(),
        stopping: false,
        hadError: false,
        turnStartedAt: 0,
        chain: Promise.resolve(),
      };
      this.live.set(id, l);
    }
    return l;
  }

  // ------------------------------------------------------------ đọc / quyền

  /** G-13: member chỉ thấy phiên của mình; không phải của mình → 403 NOT_SESSION_OWNER. */
  async owned(u: AuthUser, id: string): Promise<ClaudeSessionEntity> {
    const s = await this.repo.getSession(id);
    if (!s) throw AppError.notFound();
    if (u.role !== UserRole.OWNER && s.ownerUserId !== u.id) throw AppError.forbidden(ErrorCode.NOT_SESSION_OWNER);
    return s;
  }

  private async dto(s: ClaudeSessionEntity): Promise<ClaudeSessionDto> {
    return {
      id: s.id,
      projectId: s.projectId,
      name: s.name,
      status: s.status as ClaudeStatus,
      model: s.model ?? undefined,
      effort: s.effort ?? undefined,
      permissionMode: s.permissionMode as PermissionMode,
      ownerUserId: s.ownerUserId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      queued: (await this.repo.queueOf(s.id)).length,
      pendingInteractions: this.live.get(s.id)?.pending.size ?? 0,
      pending: [...(this.live.get(s.id)?.pendingInfo.entries() ?? [])].map(([id, v]) => ({ id, ...v })),
    };
  }

  async list(u: AuthUser, projectId: string) {
    await this.ws.get(projectId);
    return Promise.all((await this.repo.byProject(projectId, u.role === UserRole.OWNER ? undefined : u.id)).map((s) => this.dto(s)));
  }

  async listAll(u: AuthUser) {
    return Promise.all((await this.repo.all(u.role === UserRole.OWNER ? undefined : u.id)).map((s) => this.dto(s)));
  }

  // ------------------------------------------------------------ tạo / sửa / xoá

  async create(
    u: AuthUser,
    projectId: string,
    d: { name?: string; permissionMode?: string; model?: string; effort?: string; confirm?: boolean; resumeCliId?: string },
  ) {
    await this.ws.get(projectId);
    if (d.resumeCliId) {
      // một phiên CLI chỉ gắn với một phiên HugRemote — đã gắn thì trả phiên cũ (không tạo trùng)
      const had = (await this.repo.byProject(projectId)).find((x) => x.cliSessionId === d.resumeCliId);
      if (had) return this.dto(had);
    }
    if (d.permissionMode === PermissionMode.BYPASS && !d.confirm) throw AppError.badRequest(ErrorCode.CONFIRM_REQUIRED);
    const n = (await this.repo.byProject(projectId)).length + 1;
    const s: ClaudeSessionEntity = Object.assign(new ClaudeSessionEntity(), {
      id: crypto.randomUUID(),
      projectId,
      ownerUserId: u.id,
      name: d.name?.trim() || `Claude ${n}`,
      cliSessionId: d.resumeCliId ?? crypto.randomUUID(),
      model: d.model ?? null,
      effort: d.effort ?? null,
      permissionMode: d.permissionMode ?? PermissionMode.MANUAL,
      status: 'idle',
      lastSequence: 0,
      createdAt: now(),
      updatedAt: now(),
    });
    await this.repo.insertSession(s);
    if (d.resumeCliId) {
      // đánh dấu đã có lượt trên CLI → lượt đầu ở HugRemote dùng `--resume` thay vì `--session-id`
      const seq = this.nextSeq(s);
      const item: ChatItem = { kind: 'note', id: `${s.id.slice(0, 8)}-cli`, text: 'CLI_RESUMED' };
      await this.repo.insertMessage({ sessionId: s.id, seq, role: 'cli_resume', content: JSON.stringify(item), createdAt: now() });
      await this.repo.updateSession(s.id, { lastSequence: s.lastSequence });
    }
    this.status(s, 'idle');
    return this.dto(s);
  }

  /** Phiên Claude CLI có sẵn trong thư mục dự án mà chưa gắn với phiên HugRemote nào (AC-23). */
  async cliSessions(projectId: string) {
    const { project, rt } = await this.ws.context(projectId);
    const abs = await rt.realpath(project.rootPath);
    const linked = new Set((await this.repo.byProject(projectId)).map((x) => x.cliSessionId));
    const list = await listCliSessions(rt, abs).catch((e: Error): CliSession[] => {
      this.log.warn(`cli sessions ${project.hostId}: ${e.message}`);
      return [];
    });
    // sửa trong 2 phút gần đây → có thể đang chạy ở terminal khác (cảnh báo trước khi tiếp tục)
    return list.filter((c) => !linked.has(c.id)).map((c) => ({ ...c, recent: Date.now() - Date.parse(c.updatedAt) < 120_000 }));
  }

  async patch(u: AuthUser, id: string, d: { name?: string; permissionMode?: string; model?: string; effort?: string; confirm?: boolean }) {
    const s = await this.owned(u, id);
    if (d.permissionMode === PermissionMode.BYPASS && s.permissionMode !== (PermissionMode.BYPASS as string) && !d.confirm)
      throw AppError.badRequest(ErrorCode.CONFIRM_REQUIRED);
    const patch: Partial<ClaudeSessionEntity> = {};
    if (d.name) patch.name = d.name.trim();
    if (d.model !== undefined) patch.model = d.model || null;
    if (d.effort !== undefined) patch.effort = d.effort || null;
    if (d.permissionMode) {
      patch.permissionMode = d.permissionMode;
      this.live.get(id)?.turn?.setPermissionMode(d.permissionMode);
    }
    await this.repo.updateSession(id, patch);
    const next = (await this.repo.getSession(id))!;
    this.status(next, next.status);
    return this.dto(next);
  }

  async remove(u: AuthUser, id: string) {
    await this.owned(u, id);
    this.live.get(id)?.turn?.kill();
    this.live.delete(id);
    await this.repo.deleteSession(id);
  }

  // ------------------------------------------------------------ phát sự kiện

  private nextSeq(s: ClaudeSessionEntity): number {
    const l = this.L(s.id);
    l.seq = Math.max(l.seq ?? 0, s.lastSequence) + 1;
    s.lastSequence = l.seq;
    return l.seq;
  }

  private publish(s: ClaudeSessionEntity, ev: Ev): Ev {
    const l = this.L(s.id);
    l.ring.push(ev);
    if (l.ring.length > LIMITS.CLAUDE_REPLAY_EVENTS) l.ring.splice(0, l.ring.length - LIMITS.CLAUDE_REPLAY_EVENTS);
    l.bus.next(ev);
    return ev;
  }

  private emit(s: ClaudeSessionEntity, type: ClaudeEvent, data: Record<string, unknown>): Ev {
    return this.publish(s, { seq: this.nextSeq(s), type, data });
  }

  /** Ghi mục TRƯỚC rồi mới phát (G-14) — chỉ chèn, không sửa dòng cũ. */
  private async persist(s: ClaudeSessionEntity, item: ChatItem, type: ClaudeEvent = ClaudeEvent.ITEM) {
    const seq = this.nextSeq(s);
    await this.repo.insertMessage({ sessionId: s.id, seq, role: item.kind, content: JSON.stringify(item), createdAt: now() });
    await this.repo.updateSession(s.id, { lastSequence: s.lastSequence });
    this.publish(s, { seq, type, data: { item } });
  }

  private status(s: ClaudeSessionEntity, status: ClaudeSessionEntity['status']) {
    s.status = status;
    this.emit(s, ClaudeEvent.STATUS, { status });
    this.events.publish({
      type: 'session_status',
      data: {
        sessionId: s.id,
        kind: 'claude',
        projectId: s.projectId,
        status,
        bypass: s.permissionMode === (PermissionMode.BYPASS as string),
      },
      ownerUserId: s.ownerUserId,
    });
  }

  private async setStatus(s: ClaudeSessionEntity, status: ClaudeSessionEntity['status']) {
    await this.repo.updateSession(s.id, { status, lastSequence: s.lastSequence });
    this.status(s, status);
  }

  // ------------------------------------------------------------ gửi / hàng chờ

  /** Phiên rảnh → chạy lượt ngay; đang chạy → vào hàng chờ phía server (≤10, AC-40). */
  async send(u: AuthUser, id: string, text: string, attachments: string[] = []) {
    const s = await this.owned(u, id);
    const l = this.L(id);
    if (l.turn?.running) {
      const q = await this.repo.queueOf(id);
      if (q.length >= LIMITS.CLAUDE_QUEUE_MAX) throw AppError.conflict(ErrorCode.QUEUE_FULL, { max: LIMITS.CLAUDE_QUEUE_MAX });
      const qid = crypto.randomUUID();
      await this.repo.enqueue({
        id: qid,
        sessionId: id,
        userId: u.id,
        text,
        attachmentsJson: JSON.stringify(attachments),
        createdAt: now(),
      });
      await this.serial(id, () => this.emitQueue(s));
      return { queued: true, queueId: qid };
    }
    await this.serial(id, () => this.startTurn(s, text, attachments));
    return { queued: false };
  }

  async queue(u: AuthUser, id: string): Promise<QueueItemDto[]> {
    await this.owned(u, id);
    return (await this.repo.queueOf(id)).map((q) => ({ id: q.id, text: q.text, createdAt: q.createdAt }));
  }

  async unqueue(u: AuthUser, id: string, qid: string) {
    const s = await this.owned(u, id);
    const q = (await this.repo.queueOf(id)).find((x) => x.id === qid);
    if (!q) throw AppError.notFound();
    await this.repo.dequeue(qid);
    await this.serial(id, () => this.emitQueue(s));
  }

  private async emitQueue(s: ClaudeSessionEntity) {
    const q = await this.repo.queueOf(s.id);
    this.emit(s, ClaudeEvent.QUEUE_CHANGED, { queue: q.map((x) => ({ id: x.id, text: x.text, createdAt: x.createdAt })) });
  }

  /** Chạy fn trong chuỗi tuần tự của phiên (cùng chuỗi với thao tác CLI) — seq phát ra luôn tăng. */
  private serial<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const l = this.L(id);
    const run = l.chain.then(fn);
    l.chain = run.catch(() => undefined);
    return run;
  }

  private composePrompt(text: string, attachments: string[]) {
    return attachments.length ? `${attachments.map((a) => `@${a}`).join(' ')}\n\n${text}` : text;
  }

  private async startTurn(s: ClaudeSessionEntity, text: string, attachments: string[]) {
    const { project, rt } = await this.ws.context(s.projectId);
    const l = this.L(s.id);
    const turnId = crypto.randomUUID().slice(0, 8);
    await this.persist(s, { kind: 'user', id: `${turnId}-u`, text, ...(attachments.length ? { attachments } : {}) });
    const resume = await this.repo.hasTurns(s.id);
    l.stopping = false;
    l.hadError = false;
    l.turnStartedAt = Date.now();
    l.partial.clear();
    const turn = new ClaudeTurn(turnId, {
      onOp: (op) => {
        l.chain = l.chain.then(() => this.onOp(s, l, op)).catch((e: Error) => this.log.error(e.stack));
      },
      onExit: (info) => {
        l.chain = l.chain.then(() => this.onExit(s, l, info)).catch((e: Error) => this.log.error(e.stack));
      },
    });
    l.turn = turn;
    this.log.log(`"${s.name}": bắt đầu lượt trên ${project.hostId} (${s.permissionMode}${s.model ? `, ${s.model}` : ''})`);
    await this.setStatus(s, 'running');
    const bin = this.bin(project.hostId);
    await turn.start(
      rt,
      {
        bin,
        cwd: project.rootPath,
        cliSessionId: s.cliSessionId!,
        resume,
        model: s.model,
        effort: s.effort,
        permissionMode: s.permissionMode,
        name: s.name,
      },
      this.composePrompt(text, attachments),
    );
  }

  private bin(hostId: string) {
    return hostId === LOCAL_HOST_ID ? (this.cfg.claudeBinPath ?? 'claude') : 'claude';
  }

  // ------------------------------------------------------------ model / slash command / hạn mức

  async options(projectId: string): Promise<CliOptions> {
    const { project, rt } = await this.ws.context(projectId);
    const key = `${project.hostId}\0${project.rootPath}`;
    const hit = this.optCache.get(key);
    if (hit && Date.now() - hit.at < 5 * 60_000) return hit.p;
    if (this.probing >= 2 && hit) return hit.p;
    if (this.probing >= 2) throw new AppError(ErrorCode.RATE_LIMITED, 429);
    this.probing++;
    const p = probeCli(rt, this.bin(project.hostId), project.rootPath)
      .catch((e: Error) => {
        this.optCache.delete(key);
        if (e.message === 'ENOENT' || (e as NodeJS.ErrnoException).code === 'ENOENT')
          throw AppError.conflict(ErrorCode.CLAUDE_NOT_INSTALLED);
        this.log.warn(`probe ${project.hostId}: ${e.message}`);
        throw AppError.badGateway(ErrorCode.CLAUDE_PROBE_FAILED);
      })
      .finally(() => this.probing--);
    this.optCache.set(key, { at: Date.now(), p });
    return p;
  }

  async limits(projectId: string) {
    const project = await this.ws.get(projectId);
    const l = this.limitsByHost.get(project.hostId) ?? {};
    const pick = (i?: RateLimitInfo) => (i && i.pct !== null ? { pct: i.pct, resetAt: i.resetAt } : undefined);
    return { fiveHour: pick(l.five_hour), weekly: pick(l.weekly) };
  }

  private async onOp(s: ClaudeSessionEntity, l: Live, op: NormOp) {
    if (op.op === 'file_written') {
      // không gắn chủ: ai đang mở file này trong dự án cũng cần biết (G-13 chỉ áp cho phiên)
      this.events.publish({ type: 'file_changed', data: { projectId: s.projectId, path: op.path, by: 'claude', sessionId: s.id } });
      return;
    }
    if (op.op === 'rate_limit') {
      if (op.info.kind === 'other') return;
      const project = await this.ws.get(s.projectId);
      const cur = this.limitsByHost.get(project.hostId) ?? {};
      if (op.info.pct === null && cur[op.info.kind]?.pct != null) return; // bản không có % không đè bản có %
      this.limitsByHost.set(project.hostId, { ...cur, [op.info.kind]: op.info });
      return;
    }
    if (op.op === 'upsert') {
      if (op.final) {
        l.partial.delete(op.item.id);
        await this.persist(s, op.item);
      } else {
        l.partial.set(op.item.id, op.item);
        this.emit(s, ClaudeEvent.ITEM, { item: op.item, partial: true });
      }
    } else if (op.op === 'delta') {
      const cur = l.partial.get(op.itemId) as Extract<ChatItem, { kind: 'assistant' }> | undefined;
      const item = cur ?? { kind: 'assistant' as const, id: op.itemId, text: '', ...(op.parentId ? { parentId: op.parentId } : {}) };
      if (op.field === 'text') item.text += op.text;
      else item.thinking = (item.thinking ?? '') + op.text;
      l.partial.set(op.itemId, item);
      this.emit(s, op.field === 'text' ? ClaudeEvent.TEXT_DELTA : ClaudeEvent.THINKING, {
        itemId: op.itemId,
        text: op.text,
        ...(op.parentId ? { parentId: op.parentId } : {}),
      });
    } else if (op.op === 'permission') {
      l.pending.add(op.requestId);
      l.pendingInfo.set(op.requestId, { tool: op.item.tool, summary: summarize(op.item.tool, op.item.input) });
      await this.persist(s, op.item, ClaudeEvent.INTERACTION_REQUESTED);
      await this.setStatus(s, 'awaiting_input');
      this.events.publish({
        type: 'interaction_requested',
        data: {
          sessionId: s.id,
          interactionId: op.requestId,
          projectId: s.projectId,
          tool: op.item.tool,
          summary: summarize(op.item.tool, op.item.input),
        },
        ownerUserId: s.ownerUserId,
      });
    } else if (op.op === 'result') {
      if (op.isError) l.hadError = true;
      const item = { ...op.item, ...(l.stopping ? { stopped: true } : {}) };
      await this.persist(s, item, ClaudeEvent.FINISH);
      this.events.publish({
        type: 'turn_finished',
        data: { sessionId: s.id, projectId: s.projectId, summary: item },
        ownerUserId: s.ownerUserId,
      });
    }
  }

  private async onExit(
    s: ClaudeSessionEntity,
    l: Live,
    info: { code: number | null; stderr: string; notInstalled: boolean; gotResult: boolean },
  ) {
    l.turn = undefined;
    for (const p of l.partial.values()) if (p.kind === 'assistant' && p.text) await this.persist(s, p); // giữ phần đã stream
    l.partial.clear();
    for (const iid of l.pending) this.emit(s, ClaudeEvent.INTERACTION_RESPONDED, { interactionId: iid, decision: 'cancelled' });
    l.pending.clear();
    l.pendingInfo.clear();
    if (info.notInstalled) {
      this.log.warn(`"${s.name}": chưa cài Claude Code trên máy của dự án`);
      await this.persist(s, { kind: 'note', id: `${crypto.randomUUID().slice(0, 8)}-n`, text: 'CLAUDE_NOT_INSTALLED' }, ClaudeEvent.ERROR);
      return this.setStatus(s, 'error');
    }
    if (l.stopping) {
      if (!info.gotResult)
        await this.persist(
          s,
          {
            kind: 'summary',
            id: `${crypto.randomUUID().slice(0, 8)}-sum`,
            durationMs: Date.now() - l.turnStartedAt,
            usage: { input: 0, output: 0, cacheRead: 0 },
            filesChanged: [],
            stopped: true,
          },
          ClaudeEvent.FINISH,
        );
      this.log.log(`"${s.name}": người dùng dừng lượt`);
      return this.setStatus(s, 'cancelled'); // dừng không xoá hàng chờ, không tự gửi tin kế (AC-40)
    }
    if (!info.gotResult || info.code || l.hadError) {
      if (!l.hadError) {
        this.log.error(`"${s.name}": lượt lỗi (exit ${info.code}) ${info.stderr.trim().split('\n').pop()?.slice(0, 200) ?? ''}`);
        await this.persist(
          s,
          { kind: 'note', id: `${crypto.randomUUID().slice(0, 8)}-n`, text: info.stderr.trim().slice(-800) || `exit ${info.code}` },
          ClaudeEvent.ERROR,
        );
      } else {
        this.log.warn(`"${s.name}": lượt kết thúc với lỗi (is_error) — tạm dừng hàng chờ`);
      }
      return this.setStatus(s, 'error'); // lượt lỗi → không tự gửi tin kế, hiện "Gửi tiếp" (AC-40)
    }
    this.log.log(`"${s.name}": xong lượt sau ${Math.round((Date.now() - l.turnStartedAt) / 1000)} giây`);
    await this.setStatus(s, 'done');
    const next = (await this.repo.queueOf(s.id))[0];
    if (next) {
      await this.repo.dequeue(next.id);
      await this.emitQueue(s);
      await this.startTurn(s, next.text, JSON.parse(next.attachmentsJson) as string[]);
    }
  }

  /** Người dùng bấm "Gửi tiếp" sau lượt lỗi: rút tin đầu hàng chờ. */
  async resumeQueue(u: AuthUser, id: string) {
    const s = await this.owned(u, id);
    if (this.live.get(id)?.turn?.running) return;
    const next = (await this.repo.queueOf(id))[0];
    if (!next) return;
    await this.repo.dequeue(next.id);
    await this.emitQueue(s);
    await this.startTurn(s, next.text, JSON.parse(next.attachmentsJson) as string[]);
  }

  async cancel(u: AuthUser, id: string) {
    await this.owned(u, id);
    const l = this.live.get(id);
    if (!l?.turn?.running) return;
    l.stopping = true;
    l.turn.interrupt();
  }

  /** Trả lời đầu tiên thắng; lần sau → 409 INTERACTION_ALREADY_ANSWERED (ARCHITECTURE §6). */
  async answer(u: AuthUser, id: string, iid: string, decision: 'allow' | 'deny' | 'always', rawAnswers?: Record<string, string>) {
    const s = await this.owned(u, id);
    const l = this.live.get(id);
    const info = l?.pendingInfo.get(iid);
    if (!l?.turn || !l.pending.has(iid) || !info) throw AppError.conflict(ErrorCode.INTERACTION_ALREADY_ANSWERED);
    const answers = cleanAnswers(rawAnswers);
    if (info.tool === 'AskUserQuestion' && decision !== 'deny' && !answers)
      throw AppError.badRequest(ErrorCode.VALIDATION_FAILED, { field: 'answers' });
    if (!l.turn.answer(iid, decision !== 'deny', answers)) throw AppError.conflict(ErrorCode.INTERACTION_ALREADY_ANSWERED);
    l.pending.delete(iid);
    l.pendingInfo.delete(iid);
    const d = decision === 'deny' ? 'denied' : decision === 'always' ? 'always' : 'allowed';
    if (decision === 'always' && s.permissionMode === (PermissionMode.MANUAL as string)) {
      await this.repo.updateSession(id, { permissionMode: PermissionMode.ACCEPT_EDITS });
      s.permissionMode = PermissionMode.ACCEPT_EDITS;
      l.turn.setPermissionMode(PermissionMode.ACCEPT_EDITS);
    }
    const item: ChatItem = {
      kind: 'interaction',
      id: iid,
      tool: '',
      input: {},
      decision: d,
      ...(answers ? { answers } : {}),
      by: u.email ?? u.role,
      at: now(),
    };
    await this.serial(id, async () => {
      await this.persist(s, item, ClaudeEvent.INTERACTION_RESPONDED);
      if (!l.pending.size) await this.setStatus(s, 'running');
    });
    this.events.publish({
      type: 'interaction_answered',
      data: { sessionId: id, interactionId: iid, by: u.id, decision: d },
      ownerUserId: s.ownerUserId,
    });
  }

  async runningOf(userId: string) {
    return (await this.repo.all(userId)).filter((s) => s.status === 'running' || s.status === 'awaiting_input').length;
  }

  async stopAllOf(userId: string) {
    for (const s of await this.repo.all(userId)) this.live.get(s.id)?.turn?.kill();
  }

  runningCount() {
    return [...this.live.values()].filter((l) => l.turn?.running).length;
  }

  // ------------------------------------------------------------ SSE

  /** Ảnh chụp hội thoại: gộp các dòng đã lưu theo id (dòng sau đè/ghép dòng trước) + phần đang stream. */
  private async snapshot(s: ClaudeSessionEntity) {
    const items = new Map<string, ChatItem>();
    for (const m of await this.repo.messagesOf(s.id)) {
      const it = JSON.parse(m.content) as ChatItem;
      const prev = items.get(it.id);
      items.set(it.id, prev ? mergeChatItem(prev, it) : it);
    }
    const l = this.live.get(s.id);
    for (const p of l?.partial.values() ?? []) items.set(p.id, items.has(p.id) ? mergeChatItem(items.get(p.id)!, p) : p);
    return {
      seq: s.lastSequence,
      status: s.status,
      items: [...items.values()],
      pending: [...(l?.pending ?? [])],
      queue: (await this.repo.queueOf(s.id)).map((q) => ({ id: q.id, text: q.text, createdAt: q.createdAt })),
    };
  }

  /**
   * `after` trong vùng nhớ → phát lại phần thiếu; ngoài vùng (hoặc không có) → `sync` (ảnh chụp đầy đủ).
   * Mỗi sự kiện có `id` = seq để EventSource gửi lại `Last-Event-ID` khi nối lại.
   */
  async stream(u: AuthUser, id: string, after?: number): Promise<Observable<MessageEvent>> {
    const s = await this.owned(u, id);
    const l = this.L(id);
    s.lastSequence = Math.max(s.lastSequence, l.seq ?? 0);
    const toMsg = (e: Ev): MessageEvent => ({ id: String(e.seq), type: e.type, data: { seq: e.seq, ...e.data } });
    const live$ = l.bus.pipe(map(toMsg));
    const beat$ = interval(15_000).pipe(map((): MessageEvent => ({ type: 'ping', data: {} })));
    let head$: Observable<MessageEvent>;
    const first = l.ring[0]?.seq ?? Infinity;
    if (after !== undefined && after >= first - 1 && after <= s.lastSequence) {
      const a = after;
      head$ = of(...l.ring.filter((e) => e.seq > a).map(toMsg));
    } else {
      const snap = await this.snapshot(s);
      head$ = of({ id: String(snap.seq), type: ClaudeEvent.SYNC, data: snap } as MessageEvent);
      after = snap.seq;
    }
    const from = after ?? 0;
    return concat(head$, merge(live$.pipe(filter((m) => Number(m.id ?? Infinity) > from || m.type === 'ping')), beat$));
  }
}

/** Làm sạch bản đồ câu trả lời của AskUserQuestion — chặn khoá prototype và giới hạn kích thước. */
function cleanAnswers(raw?: Record<string, string>): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, string> = {};
  let n = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    if (typeof v !== 'string' || !v.trim()) continue;
    if (++n > 16) break;
    out[k.slice(0, 500)] = v.trim().slice(0, 2000);
  }
  return n ? out : undefined;
}

/** Câu ngắn cho chuông / thẻ duyệt: "Write src/x.ts", "Bash: pnpm test", hoặc câu hỏi AskUserQuestion. */
export function summarize(tool: string, input: Record<string, unknown>) {
  if (tool === 'AskUserQuestion' && Array.isArray(input.questions)) {
    const q = (input.questions[0] as { question?: string } | undefined)?.question;
    if (typeof q === 'string' && q.trim()) return q.trim().slice(0, 140);
  }
  const fp = (input.file_path ?? input.notebook_path ?? input.path) as string | undefined;
  if (fp) return `${tool} ${fp}`;
  if (typeof input.command === 'string') return `${tool}: ${input.command.slice(0, 120)}`;
  return tool;
}
