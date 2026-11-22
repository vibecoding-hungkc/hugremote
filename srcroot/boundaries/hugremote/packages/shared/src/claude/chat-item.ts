/** Mục hội thoại Claude — đơn vị lưu (`claude_messages.content`), phát qua SSE và hiển thị (C19, C20, C21, C33). */
export type ChatItem =
  | { kind: 'user'; id: string; text: string; attachments?: string[] }
  | { kind: 'assistant'; id: string; text: string; thinking?: string; parentId?: string }
  | {
      kind: 'tool';
      id: string;
      name: string;
      input: Record<string, unknown>;
      result?: string;
      isError?: boolean;
      done?: boolean;
      parentId?: string;
    }
  | {
      kind: 'interaction';
      id: string;
      tool: string;
      input: Record<string, unknown>;
      decision?: 'allowed' | 'denied' | 'always' | 'cancelled';
      /** Câu trả lời đã chọn cho `AskUserQuestion` (AC-21). */
      answers?: Record<string, string>;
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
      /** Token context đã dùng / sức chứa sau lượt (CLI `get_context_usage`) — chip Context `a/b` (AC-22). */
      context?: { used: number; max: number };
    }
  | { kind: 'note'; id: string; text: string };

/** Ghép hai bản của cùng một mục (bản sau đè/bổ sung bản trước) — dùng chung cho ảnh chụp ở server và luồng ở web. */
export function mergeChatItem(a: ChatItem, b: ChatItem): ChatItem {
  if (a.kind === 'tool' && b.kind === 'tool')
    return {
      ...a,
      ...b,
      name: b.name || a.name,
      input: Object.keys(b.input).length ? b.input : a.input,
      parentId: b.parentId ?? a.parentId,
    };
  if (a.kind === 'assistant' && b.kind === 'assistant')
    return { ...a, ...b, parentId: b.parentId ?? a.parentId };
  if (a.kind === 'interaction' && b.kind === 'interaction')
    return { ...a, decision: b.decision ?? a.decision, answers: b.answers ?? a.answers, by: b.by ?? a.by, at: b.at ?? a.at };
  return b;
}
