/**
 * Giao thức stream-json của Claude Code CLI (`claude -p --input-format stream-json --output-format stream-json`).
 * Tầng này không biết HTTP/DB (ARCHITECTURE §8): chỉ tách dòng JSONL an toàn UTF-8 và chuẩn hoá thành thao tác
 * trên "mục hội thoại" (ChatItem) mà module claude lưu + phát qua SSE.
 */

/** Mục hội thoại — đơn vị lưu (`claude_messages.content`) và hiển thị (C19, C20, C21, C33). */
export type ChatItem =
  | { kind: 'user'; id: string; text: string; attachments?: string[] }
  | { kind: 'assistant'; id: string; text: string; thinking?: string }
  | { kind: 'tool'; id: string; name: string; input: Record<string, unknown>; result?: string; isError?: boolean; done?: boolean }
  | {
      kind: 'interaction';
      id: string;
      tool: string;
      input: Record<string, unknown>;
      decision?: 'allowed' | 'denied' | 'always';
      by?: string;
      at?: string;
    }
  | {
      kind: 'summary';
      id: string;
      durationMs: number;
      usage: { input: number; output: number; cacheRead: number };
      costUsd?: number;
      filesChanged: string[];
      stopped?: boolean;
      error?: string;
    }
  | { kind: 'note'; id: string; text: string };

/** Thao tác normalizer sinh ra từ một dòng CLI. */
export type NormOp =
  | { op: 'init'; cliSessionId: string; model?: string }
  | { op: 'upsert'; item: ChatItem; final: boolean }
  | { op: 'delta'; itemId: string; field: 'text' | 'thinking'; text: string }
  | { op: 'permission'; requestId: string; item: Extract<ChatItem, { kind: 'interaction' }> }
  | { op: 'result'; item: Extract<ChatItem, { kind: 'summary' }>; isError: boolean }
  | { op: 'control_response'; requestId: string; response: Record<string, unknown> };

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
  private blocks = new Map<number, { itemId: string; type: 'text' | 'thinking' | 'tool' }>();
  private msgCounter = 0;
  private currentAssistantId: string | null = null;
  readonly filesChanged = new Set<string>();
  private toolNames = new Map<string, string>();

  constructor(private readonly turnId: string) {}

  private newAssistantId() {
    this.currentAssistantId = `${this.turnId}-a${++this.msgCounter}`;
    return this.currentAssistantId;
  }

  feed(m: Record<string, unknown>): NormOp[] {
    const out: NormOp[] = [];
    const type = m.type as string;
    if (type === 'system' && m.subtype === 'init') {
      out.push({ op: 'init', cliSessionId: String(m.session_id ?? ''), model: m.model as string | undefined });
    } else if (type === 'stream_event') {
      const ev = m.event as Record<string, unknown>;
      const et = ev?.type as string;
      if (et === 'message_start') this.newAssistantId();
      else if (et === 'content_block_start') {
        const idx = Number(ev.index);
        const cb = ev.content_block as Block;
        const aid = this.currentAssistantId ?? this.newAssistantId();
        if (cb.type === 'text' || cb.type === 'thinking') this.blocks.set(idx, { itemId: aid, type: cb.type });
        else if (cb.type === 'tool_use' && cb.id) {
          this.blocks.set(idx, { itemId: cb.id, type: 'tool' });
          this.toolNames.set(cb.id, cb.name ?? '');
          out.push({ op: 'upsert', item: { kind: 'tool', id: cb.id, name: cb.name ?? '', input: {} }, final: false });
        }
      } else if (et === 'content_block_delta') {
        const b = this.blocks.get(Number(ev.index));
        const d = ev.delta as { type: string; text?: string; thinking?: string };
        if (b && d.type === 'text_delta' && d.text) out.push({ op: 'delta', itemId: b.itemId, field: 'text', text: d.text });
        if (b && d.type === 'thinking_delta' && d.thinking)
          out.push({ op: 'delta', itemId: b.itemId, field: 'thinking', text: d.thinking });
      }
    } else if (type === 'assistant') {
      // Bản đầy đủ của tin nhắn — nguồn sự thật để lưu (delta chỉ để hiển thị nhanh)
      const msg = m.message as { content?: Block[] };
      const aid = this.currentAssistantId ?? this.newAssistantId();
      let text = '';
      let thinking = '';
      for (const b of msg?.content ?? []) {
        if (b.type === 'text') text += b.text ?? '';
        else if (b.type === 'thinking') thinking += b.thinking ?? '';
        else if (b.type === 'tool_use' && b.id) {
          this.toolNames.set(b.id, b.name ?? '');
          const fp = (b.input?.file_path ?? b.input?.notebook_path) as string | undefined;
          if (FILE_TOOLS.has(b.name ?? '') && fp) this.filesChanged.add(fp);
          out.push({ op: 'upsert', item: { kind: 'tool', id: b.id, name: b.name ?? '', input: b.input ?? {} }, final: false });
        }
      }
      if (text || thinking)
        out.unshift({ op: 'upsert', item: { kind: 'assistant', id: aid, text, ...(thinking ? { thinking } : {}) }, final: true });
      this.currentAssistantId = null;
      this.blocks.clear();
    } else if (type === 'user') {
      const msg = m.message as { content?: Block[] | string };
      if (Array.isArray(msg?.content)) {
        for (const b of msg.content) {
          if (b.type !== 'tool_result' || !b.tool_use_id) continue;
          const result =
            typeof b.content === 'string'
              ? b.content
              : Array.isArray(b.content)
                ? (b.content as Block[]).map((x) => x.text ?? '').join('')
                : '';
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
          ...(isError ? { error: String(m.result ?? m.subtype ?? 'error').slice(0, 500) } : {}),
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

/** Dòng stdin: trả lời yêu cầu quyền (`can_use_tool`). */
export function permissionResponse(requestId: string, allow: boolean, input: Record<string, unknown>): string {
  const response = allow ? { behavior: 'allow', updatedInput: input } : { behavior: 'deny', message: 'Người dùng từ chối trên HugRemote' };
  return JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: requestId, response } }) + '\n';
}

/** Dòng stdin: yêu cầu điều khiển từ phía host (interrupt, set_permission_mode, set_model). */
export function controlRequest(requestId: string, request: Record<string, unknown>): string {
  return JSON.stringify({ type: 'control_request', request_id: requestId, request }) + '\n';
}
