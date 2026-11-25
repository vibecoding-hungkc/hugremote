/**
 * Giao thức stream-json của Claude Code CLI (`claude -p --input-format stream-json --output-format stream-json`).
 * Tầng này không biết HTTP/DB (ARCHITECTURE §8): chỉ tách dòng JSONL an toàn UTF-8 và chuẩn hoá thành thao tác
 * trên "mục hội thoại" (ChatItem) mà module claude lưu + phát qua SSE.
 */

import type { ChatItem } from '@app/shared';

export type { ChatItem };

/** Thao tác normalizer sinh ra từ một dòng CLI. */
export type NormOp =
  | { op: 'init'; cliSessionId: string; model?: string }
  | { op: 'upsert'; item: ChatItem; final: boolean }
  | { op: 'delta'; itemId: string; field: 'text' | 'thinking'; text: string; parentId?: string }
  | { op: 'permission'; requestId: string; item: Extract<ChatItem, { kind: 'interaction' }> }
  | { op: 'result'; item: Extract<ChatItem, { kind: 'summary' }>; isError: boolean }
  | { op: 'control_response'; requestId: string; response: Record<string, unknown> }
  | { op: 'rate_limit'; info: RateLimitInfo }
  /** Công cụ sửa file vừa chạy xong không lỗi — để Files tự tải lại file đang mở (AC-37). */
  | { op: 'file_written'; path: string };

/** Hạn mức dùng Claude do CLI báo (`rate_limit_event`) — chip "Hạn mức 5 giờ" (AC-25). */
export interface RateLimitInfo {
  kind: 'five_hour' | 'weekly' | 'other';
  /** 0–100; null khi CLI không báo mức dùng. */
  pct: number | null;
  resetAt: string | null;
  status: string;
}

export function parseRateLimit(m: Record<string, unknown>): RateLimitInfo | null {
  const r = (m.rate_limit_info ?? m.rateLimitInfo) as Record<string, unknown> | undefined;
  if (!r) return null;
  const t = typeof r.rateLimitType === 'string' ? r.rateLimitType : typeof r.type === 'string' ? r.type : '';
  const kind = t.startsWith('five_hour') ? 'five_hour' : t.startsWith('seven_day') || t.startsWith('weekly') ? 'weekly' : 'other';
  const u = typeof r.utilization === 'number' ? r.utilization : null;
  const pct = u === null ? null : Math.round(u <= 1 ? u * 100 : u);
  const ra =
    typeof r.resetsAt === 'number'
      ? new Date(r.resetsAt * (r.resetsAt < 1e12 ? 1000 : 1)).toISOString()
      : typeof r.resetsAt === 'string'
        ? r.resetsAt
        : null;
  return { kind, pct, resetAt: ra, status: typeof r.status === 'string' ? r.status : '' };
}

/**
 * Mọi cửa sổ hạn mức trong một `rate_limit_event`. CLI 2.1.33x chỉ để `utilization` trong
 * `rate_limit_info.unifiedWindows.<five_hour|seven_day…>` (không có ở cấp trên) — đo thật 2026-11-25.
 */
export function parseRateLimits(m: Record<string, unknown>): RateLimitInfo[] {
  const r = (m.rate_limit_info ?? m.rateLimitInfo) as Record<string, unknown> | undefined;
  const top = parseRateLimit(m);
  const wins = (r?.unifiedWindows ?? {}) as Record<string, Record<string, unknown>>;
  const fromWins = Object.entries(wins)
    .map(([type, w]) => parseRateLimit({ rate_limit_info: { ...w, rateLimitType: type } }))
    .filter((x): x is RateLimitInfo => !!x);
  return [...(top ? [top] : []), ...fromWins];
}

/** Tách stdout thành dòng; giữ phần dở dang tới khi có `\n` (không cắt ngang ký tự UTF-8 vì gộp Buffer trước khi decode). */
export class JsonlDecoder {
  private buf = Buffer.alloc(0);
  push(chunk: Buffer, onLine: (obj: Record<string, unknown>) => void, onBad?: (line: string) => void) {
    this.buf = Buffer.concat([this.buf, chunk]);
    let nl: number;
    while ((nl = this.buf.indexOf(0x0a)) >= 0) {
      const line = this.buf.subarray(0, nl).toString('utf8').trim();
      this.buf = this.buf.subarray(nl + 1);
      if (!line) continue;
      try {
        onLine(JSON.parse(line) as Record<string, unknown>);
      } catch {
        onBad?.(line);
      }
    }
  }
}

type Block = {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
};

const FILE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/**
 * Chuẩn hoá theo lượt. Giữ trạng thái khối đang stream (index → mục) để ghép `content_block_delta`.
 * Tên công cụ sửa file gom vào `filesChanged` cho dòng tóm tắt (AC-41).
 */
export class Normalizer {
  /** Tách theo parentId ('' = agent chính, <tool_use_id> = agent con) để stream song song không lẫn (AC-20). */
  private blocks = new Map<string, Map<number, { itemId: string; type: 'text' | 'thinking' | 'tool' }>>();
  private msgCounter = 0;
  private currentAssistantId = new Map<string, string>();
  readonly filesChanged = new Set<string>();
  private toolNames = new Map<string, string>();
  private toolParents = new Map<string, string>();
  /** Công cụ sửa file đang chờ kết quả → chỉ tính vào `filesChanged` khi trả về không lỗi. */
  private pendingFiles = new Map<string, string>();

  constructor(private readonly turnId: string) {}

  private newAssistantId(parentKey: string) {
    const id = `${this.turnId}-a${++this.msgCounter}`;
    this.currentAssistantId.set(parentKey, id);
    return id;
  }

  private blockMap(parentKey: string) {
    let m = this.blocks.get(parentKey);
    if (!m) {
      m = new Map();
      this.blocks.set(parentKey, m);
    }
    return m;
  }

  feed(m: Record<string, unknown>): NormOp[] {
    const out: NormOp[] = [];
    const type = m.type as string;
    const parentId = typeof m.parent_tool_use_id === 'string' && m.parent_tool_use_id ? m.parent_tool_use_id : undefined;
    const pk = parentId ?? '';
    if (type === 'system' && m.subtype === 'init') {
      out.push({ op: 'init', cliSessionId: typeof m.session_id === 'string' ? m.session_id : '', model: m.model as string | undefined });
    } else if (type === 'stream_event') {
      const ev = m.event as Record<string, unknown>;
      const et = ev?.type as string;
      const bm = this.blockMap(pk);
      if (et === 'message_start') this.newAssistantId(pk);
      else if (et === 'content_block_start') {
        const idx = Number(ev.index);
        const cb = ev.content_block as Block;
        const aid = this.currentAssistantId.get(pk) ?? this.newAssistantId(pk);
        if (cb.type === 'text' || cb.type === 'thinking') bm.set(idx, { itemId: aid, type: cb.type });
        else if (cb.type === 'tool_use' && cb.id) {
          bm.set(idx, { itemId: cb.id, type: 'tool' });
          this.toolNames.set(cb.id, cb.name ?? '');
          if (parentId) this.toolParents.set(cb.id, parentId);
          out.push({
            op: 'upsert',
            item: { kind: 'tool', id: cb.id, name: cb.name ?? '', input: {}, ...(parentId ? { parentId } : {}) },
            final: false,
          });
        }
      } else if (et === 'content_block_delta') {
        const b = bm.get(Number(ev.index));
        const d = ev.delta as { type: string; text?: string; thinking?: string };
        if (b && d.type === 'text_delta' && d.text)
          out.push({ op: 'delta', itemId: b.itemId, field: 'text', text: d.text, ...(parentId ? { parentId } : {}) });
        if (b && d.type === 'thinking_delta' && d.thinking)
          out.push({ op: 'delta', itemId: b.itemId, field: 'thinking', text: d.thinking, ...(parentId ? { parentId } : {}) });
      }
    } else if (type === 'assistant') {
      // Bản đầy đủ của tin nhắn — nguồn sự thật để lưu (delta chỉ để hiển thị nhanh)
      const msg = m.message as { content?: Block[] };
      const aid = this.currentAssistantId.get(pk) ?? this.newAssistantId(pk);
      let text = '';
      let thinking = '';
      for (const b of msg?.content ?? []) {
        if (b.type === 'text') text += b.text ?? '';
        else if (b.type === 'thinking') thinking += b.thinking ?? '';
        else if (b.type === 'tool_use' && b.id) {
          this.toolNames.set(b.id, b.name ?? '');
          if (parentId) this.toolParents.set(b.id, parentId);
          const fp = (b.input?.file_path ?? b.input?.notebook_path) as string | undefined;
          if (FILE_TOOLS.has(b.name ?? '') && fp) this.pendingFiles.set(b.id, fp);
          out.push({
            op: 'upsert',
            item: { kind: 'tool', id: b.id, name: b.name ?? '', input: b.input ?? {}, ...(parentId ? { parentId } : {}) },
            final: false,
          });
        }
      }
      if (text || thinking)
        out.unshift({
          op: 'upsert',
          item: { kind: 'assistant', id: aid, text, ...(thinking ? { thinking } : {}), ...(parentId ? { parentId } : {}) },
          final: true,
        });
      this.currentAssistantId.delete(pk);
      this.blocks.delete(pk);
    } else if (type === 'user') {
      const msg = m.message as { content?: Block[] | string };
      if (Array.isArray(msg?.content)) {
        for (const b of msg.content) {
          if (b.type !== 'tool_result' || !b.tool_use_id) continue;
          const fp = this.pendingFiles.get(b.tool_use_id);
          if (fp && !b.is_error) {
            this.filesChanged.add(fp);
            out.push({ op: 'file_written', path: fp });
          }
          this.pendingFiles.delete(b.tool_use_id);
          const result =
            typeof b.content === 'string'
              ? b.content
              : Array.isArray(b.content)
                ? (b.content as Block[]).map((x) => x.text ?? '').join('')
                : '';
          const p = parentId ?? this.toolParents.get(b.tool_use_id);
          out.push({
            op: 'upsert',
            item: {
              kind: 'tool',
              id: b.tool_use_id,
              name: this.toolNames.get(b.tool_use_id) ?? '',
              input: {},
              result: result.slice(0, 20_000),
              isError: !!b.is_error,
              done: true,
              ...(p ? { parentId: p } : {}),
            },
            final: true,
          });
        }
      }
    } else if (type === 'control_request') {
      const req = m.request as { subtype?: string; tool_name?: string; input?: Record<string, unknown>; tool_use_id?: string };
      if (req?.subtype === 'can_use_tool') {
        const requestId = String(m.request_id);
        out.push({
          op: 'permission',
          requestId,
          item: { kind: 'interaction', id: requestId, tool: req.tool_name ?? '', input: req.input ?? {} },
        });
      }
    } else if (type === 'control_response') {
      const r = m.response as { request_id?: string; response?: Record<string, unknown> };
      if (r?.request_id) out.push({ op: 'control_response', requestId: r.request_id, response: r.response ?? {} });
    } else if (type === 'rate_limit_event') {
      for (const info of parseRateLimits(m)) out.push({ op: 'rate_limit', info });
    } else if (type === 'result') {
      const u = (m.usage ?? {}) as Record<string, number>;
      const isError = m.is_error === true || (typeof m.subtype === 'string' && m.subtype !== 'success');
      out.push({
        op: 'result',
        isError,
        item: {
          kind: 'summary',
          id: `${this.turnId}-sum`,
          durationMs: Number(m.duration_ms ?? 0),
          usage: { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0 },
          costUsd: typeof m.total_cost_usd === 'number' ? m.total_cost_usd : undefined,
          filesChanged: [...this.filesChanged],
          ...(isError
            ? { error: (typeof m.result === 'string' ? m.result : typeof m.subtype === 'string' ? m.subtype : 'error').slice(0, 500) }
            : {}),
        },
      });
    }
    return out;
  }
}

/** Dòng stdin: tin nhắn người dùng. */
export function userLine(text: string, sessionId: string): string {
  return (
    JSON.stringify({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text }] },
      parent_tool_use_id: null,
      session_id: sessionId,
    }) + '\n'
  );
}

/** Dòng stdin: trả lời yêu cầu quyền (`can_use_tool`) hoặc câu hỏi chọn phương án (`AskUserQuestion`, AC-21). */
export function permissionResponse(
  requestId: string,
  allow: boolean,
  input: Record<string, unknown>,
  answers?: Record<string, string>,
): string {
  const updatedInput = answers && Object.keys(answers).length ? { ...input, answers } : input;
  const response = allow ? { behavior: 'allow', updatedInput } : { behavior: 'deny', message: 'Người dùng từ chối trên HugRemote' };
  return JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: requestId, response } }) + '\n';
}

/** Dòng stdin: yêu cầu điều khiển từ phía host (interrupt, set_permission_mode, set_model). */
export function controlRequest(requestId: string, request: Record<string, unknown>): string {
  return JSON.stringify({ type: 'control_request', request_id: requestId, request }) + '\n';
}
