import type { QueryClient } from '@tanstack/react-query';
import { env } from '../config/env';
import { api } from './api-client';
import { useConnection } from './connection';

/**
 * Kênh `events.v1` (SSE, vé 30s). Nhận sự kiện → làm mới query liên quan; rớt → nối lại với vé mới (backoff 1→5s).
 * Trạng thái kết nối đi vào `useConnection` (AC-43).
 */
export function startEvents(qc: QueryClient, handlers: Record<string, (d: Record<string, unknown>) => void> = {}) {
  let es: EventSource | null = null;
  let stopped = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  // server gửi `ping` mỗi 15s; quá 35s không nghe gì (mạng đứt mà socket chưa báo lỗi) → coi là mất kết nối, nối lại
  const alive = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      useConnection.getState().set(false);
      es?.close();
      es = null;
      if (!stopped) void open();
    }, 35_000);
  };
  const goneOffline = () => {
    useConnection.getState().set(false);
    es?.close();
    es = null;
    clearTimeout(timer);
    timer = setTimeout(() => void open(), 1000);
  };
  window.addEventListener('offline', goneOffline);

  const open = async () => {
    if (stopped) return;
    try {
      const { ticket } = await api<{ ticket: string }>('/auth/stream-ticket', { method: 'POST' });
      es = new EventSource(`${env.apiBase}/events/stream?ticket=${encodeURIComponent(ticket)}`);
      es.addEventListener('ping', alive);
      es.onopen = () => {
        alive();
        attempt = 0;
        useConnection.getState().set(true);
        // vừa nối lại → lấy lại trạng thái đầy đủ
        void qc.invalidateQueries();
      };
      const on = (type: string, fn: (d: Record<string, unknown>) => void) =>
        es!.addEventListener(type, (ev) => {
          try {
            fn(JSON.parse((ev as MessageEvent).data as string) as Record<string, unknown>);
          } catch {
            /* sự kiện hỏng — bỏ qua */
          }
        });
      on('session_status', (d) => {
        void qc.invalidateQueries({ queryKey: d.kind === 'terminal' ? ['terminals'] : ['claude'] });
        handlers.session_status?.(d);
      });
      for (const t of ['interaction_requested', 'interaction_answered', 'turn_finished', 'file_changed', 'hosts_changed']) on(t, (d) => handlers[t]?.(d));
      es.onerror = () => {
        es?.close();
        es = null;
        if (stopped) return;
        attempt++;
        if (attempt > 1) useConnection.getState().set(false);
        timer = setTimeout(() => void open(), Math.min(5000, 1000 * attempt));
      };
    } catch {
      attempt++;
      timer = setTimeout(() => void open(), Math.min(5000, 1000 * attempt));
    }
  };
  void open();
  return () => {
    stopped = true;
    clearTimeout(timer);
    clearTimeout(watchdog);
    window.removeEventListener('offline', goneOffline);
    es?.close();
  };
}
