import { useQuery, type QueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { api } from '../../lib/api-client';

/** session-notes-api.v1 — ghi chú từng phiên (Authority 2026-11-26). */
export interface SessionNote {
  sessionId: string;
  text: string;
  updatedAt: string;
}
export const NOTE_MAX = 500;
const KEY = ['session-notes'] as const;

export const notesApi = {
  list: () => api<SessionNote[]>('/session-notes'),
  put: (sessionId: string, text: string) => api<SessionNote>(`/session-notes/${sessionId}`, { method: 'PUT', body: { text } }),
};

/** Ghi chú theo id phiên — làm mới khi quay lại cửa sổ (máy khác vừa sửa). */
export const useNotes = () =>
  useQuery({ queryKey: KEY, queryFn: notesApi.list, staleTime: 30_000, select: (l) => new Map(l.map((n) => [n.sessionId, n])) });

export async function saveNote(qc: QueryClient, sessionId: string, text: string) {
  const n = await notesApi.put(sessionId, text);
  qc.setQueryData<SessionNote[]>(KEY, (l = []) => [...l.filter((x) => x.sessionId !== sessionId), ...(n.text ? [n] : [])]);
  return n;
}

const HIDE = 'hugremote:notehide';
const hidden0 = (() => {
  try {
    return JSON.parse(localStorage.getItem(HIDE) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
})();

/** Trạng thái dải ghi chú phía client: đang sửa phiên nào · phiên nào ẩn dải (nhớ theo trình duyệt) · phiên nào mở hết. */
interface NoteUi {
  editing: string | null;
  hidden: Record<string, boolean>;
  open: Record<string, boolean>;
  edit: (id: string | null) => void;
  setHidden: (id: string, v: boolean) => void;
  setOpen: (id: string, v: boolean) => void;
  /** Nút 📝 / ⌥⇧K: chưa có ghi chú → sửa; có rồi → ẩn/hiện dải. */
  toggle: (id: string, hasNote: boolean) => void;
}
export const useNoteUi = create<NoteUi>((set, get) => ({
  editing: null,
  hidden: hidden0,
  open: {},
  edit: (id) => set(id ? { editing: id, hidden: { ...get().hidden, [id]: false } } : { editing: null }),
  setHidden: (id, v) => set({ hidden: { ...get().hidden, [id]: v } }),
  setOpen: (id, v) => set({ open: { ...get().open, [id]: v } }),
  toggle: (id, hasNote) => (hasNote ? get().setHidden(id, !get().hidden[id]) : get().edit(id)),
}));
useNoteUi.subscribe((s) => {
  try {
    localStorage.setItem(HIDE, JSON.stringify(Object.fromEntries(Object.entries(s.hidden).filter(([, v]) => v))));
  } catch {
    /* chế độ riêng tư */
  }
});
