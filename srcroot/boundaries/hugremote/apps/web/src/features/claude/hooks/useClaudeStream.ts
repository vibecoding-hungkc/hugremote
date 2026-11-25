import { mergeChatItem, type ChatItem } from '@app/shared';
import { useEffect, useReducer } from 'react';
import { env } from '../../../config/env';
import { claudeApi, type QueueItem } from '../api/claude.api';

export interface ChatState {
  seq: number;
  status: string;
  items: ChatItem[];
  pending: string[];
  queue: QueueItem[];
  /** Đã nhận ảnh chụp đầu tiên. */
  ready: boolean;
  /** Kênh đang nối (false khi đứt, đang nối lại). */
  live: boolean;
}

type Ev = { type: string; data: Record<string, unknown> };
const init: ChatState = { seq: 0, status: 'idle', items: [], pending: [], queue: [], ready: false, live: false };

function upsert(items: ChatItem[], it: ChatItem): ChatItem[] {
  const i = items.findIndex((x) => x.id === it.id);
  if (i < 0) return [...items, it];
  const next = items.slice();
  next[i] = mergeChatItem(items[i], it);
  return next;
}

function reduce(s: ChatState, a: Ev | { type: 'reset' } | { type: 'live'; on: boolean }): ChatState {
  if (a.type === 'reset') return init;
  if (a.type === 'live') return { ...s, live: (a as { on: boolean }).on };
  const d = (a as Ev).data;
  if (a.type === 'sync')
    return {
      seq: Number(d.seq),
      status: String(d.status),
      items: d.items as ChatItem[],
      pending: d.pending as string[],
      queue: d.queue as QueueItem[],
      ready: true,
      live: true,
    };
  const seq = Number(d.seq);
  // sự kiện đã có trong ảnh chụp/đã nhận → bỏ (phát lại có thể trùng)
  if (!Number.isFinite(seq) || seq <= s.seq) return s;
  const n: ChatState = { ...s, seq };
  switch (a.type) {
    case 'item':
    case 'finish':
    case 'error':
      if (d.item) n.items = upsert(s.items, d.item as ChatItem);
      break;
    case 'text_delta':
    case 'thinking': {
      const id = String(d.itemId);
      const parentId = typeof d.parentId === 'string' ? d.parentId : undefined;
      const cur = s.items.find((x) => x.id === id);
      const base: Extract<ChatItem, { kind: 'assistant' }> =
        cur?.kind === 'assistant' ? cur : { kind: 'assistant', id, text: '', ...(parentId ? { parentId } : {}) };
      const upd = a.type === 'text_delta' ? { ...base, text: base.text + String(d.text) } : { ...base, thinking: (base.thinking ?? '') + String(d.text) };
      n.items = cur ? s.items.map((x) => (x.id === id ? upd : x)) : [...s.items, upd];
      break;
    }
    case 'status':
      n.status = String(d.status);
      break;
    case 'interaction_requested': {
      const it = d.item as ChatItem;
      n.items = upsert(s.items, it);
      n.pending = [...s.pending.filter((x) => x !== it.id), it.id];
      break;
    }
    case 'interaction_responded': {
      const it = d.item as ChatItem | undefined;
      const iid = it?.id ?? String(d.interactionId);
      if (it) n.items = upsert(s.items, it);
      else n.items = s.items.map((x) => (x.id === iid && x.kind === 'interaction' ? { ...x, decision: 'cancelled' as const } : x));
      n.pending = s.pending.filter((x) => x !== iid);
      break;
    }
    case 'queue_changed':
      n.queue = d.queue as QueueItem[];
      break;
  }
  return n;
}

const TYPES = ['sync', 'item', 'text_delta', 'thinking', 'status', 'interaction_requested', 'interaction_responded', 'queue_changed', 'finish', 'error'];

/**
 * Kênh SSE của một phiên Claude: vé 30s dùng một lần → mỗi lần nối lại xin vé mới và gửi `after=<seq cuối>`;
 * server phát lại phần thiếu (≤1000 sự kiện) hoặc gửi `sync` (ảnh chụp đầy đủ). Tác vụ chạy độc lập với kênh (G-14).
 */
export function useClaudeStream(sessionId: string | undefined) {
  const [state, dispatch] = useReducer(reduce, init);
  useEffect(() => {
    if (!sessionId) return;
    dispatch({ type: 'reset' });
    let es: EventSource | null = null;
    let stopped = false;
    let attempt = 0;
    let last: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const open = async () => {
      timer = undefined;
      if (stopped) return;
      try {
        const { ticket } = await claudeApi.ticket();
        if (stopped) return;
        const q = new URLSearchParams({ ticket });
        if (last !== undefined) q.set('after', String(last));
        es = new EventSource(`${env.apiBase}/claude/sessions/${sessionId}/stream?${q}`);
        es.onopen = () => {
          attempt = 0;
          dispatch({ type: 'live', on: true });
        };
        for (const t of TYPES)
          es.addEventListener(t, (ev) => {
            try {
              const data = JSON.parse((ev as MessageEvent).data as string) as Record<string, unknown>;
              if (typeof data.seq === 'number') last = Math.max(last ?? 0, data.seq);
              dispatch({ type: t, data });
            } catch {
              /* sự kiện hỏng — bỏ qua */
            }
          });
        es.onerror = () => {
          es?.close();
          es = null;
          if (stopped) return;
          dispatch({ type: 'live', on: false });
          attempt++;
          timer = setTimeout(() => void open(), Math.min(5000, 800 * attempt));
        };
      } catch {
        attempt++;
        timer = setTimeout(() => void open(), Math.min(5000, 800 * attempt));
      }
    };
    // có mạng lại / quay lại tab khi đang chờ nối lại → thử ngay (Authority 2026-11-25: phiên phải tự hồi)
    const now = () => {
      if (stopped || es || !timer || document.visibilityState === 'hidden') return;
      clearTimeout(timer);
      void open();
    };
    window.addEventListener('online', now);
    document.addEventListener('visibilitychange', now);
    void open();
    return () => {
      stopped = true;
      clearTimeout(timer);
      es?.close();
      window.removeEventListener('online', now);
      document.removeEventListener('visibilitychange', now);
    };
  }, [sessionId]);
  return state;
}
