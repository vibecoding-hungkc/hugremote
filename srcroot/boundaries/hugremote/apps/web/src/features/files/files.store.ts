import { create } from 'zustand';

/** Tab file đang mở + bản sửa chưa lưu, theo dự án (giữ khi đổi tab dự án — AC-16). */
export interface OpenFile {
  path: string;
  /** Nội dung trên máy lúc đọc/lưu gần nhất. */
  base: string;
  mtime: number;
  /** Bản đang sửa (khác `base` = chưa lưu). */
  buf: string;
  conflictMtime?: number;
}

interface FilesState {
  byProject: Record<string, { open: OpenFile[]; active?: string }>;
  open: (projectId: string, f: OpenFile) => void;
  setActive: (projectId: string, path: string) => void;
  edit: (projectId: string, path: string, buf: string) => void;
  saved: (projectId: string, path: string, mtime: number, content: string) => void;
  reload: (projectId: string, path: string, content: string, mtime: number) => void;
  conflict: (projectId: string, path: string, mtime?: number) => void;
  close: (projectId: string, path: string) => void;
  rename: (projectId: string, from: string, to: string) => void;
}

const upd = (s: FilesState, pid: string, fn: (p: { open: OpenFile[]; active?: string }) => { open: OpenFile[]; active?: string }) => ({
  byProject: { ...s.byProject, [pid]: fn(s.byProject[pid] ?? { open: [] }) },
});

export const useFiles = create<FilesState>((set) => ({
  byProject: {},
  open: (pid, f) => set((s) => upd(s, pid, (p) => ({ open: p.open.some((x) => x.path === f.path) ? p.open : [...p.open, f], active: f.path }))),
  setActive: (pid, path) => set((s) => upd(s, pid, (p) => ({ ...p, active: path }))),
  edit: (pid, path, buf) => set((s) => upd(s, pid, (p) => ({ ...p, open: p.open.map((x) => (x.path === path ? { ...x, buf } : x)) }))),
  saved: (pid, path, mtime, content) => set((s) => upd(s, pid, (p) => ({ ...p, open: p.open.map((x) => (x.path === path ? { ...x, base: content, buf: content, mtime, conflictMtime: undefined } : x)) }))),
  reload: (pid, path, content, mtime) => set((s) => upd(s, pid, (p) => ({ ...p, open: p.open.map((x) => (x.path === path ? { ...x, base: content, buf: content, mtime, conflictMtime: undefined } : x)) }))),
  conflict: (pid, path, mtime) => set((s) => upd(s, pid, (p) => ({ ...p, open: p.open.map((x) => (x.path === path ? { ...x, conflictMtime: mtime } : x)) }))),
  close: (pid, path) =>
    set((s) =>
      upd(s, pid, (p) => {
        const i = p.open.findIndex((x) => x.path === path);
        const open = p.open.filter((x) => x.path !== path);
        const active = p.active === path ? (open[Math.min(i, open.length - 1)]?.path ?? undefined) : p.active;
        return { open, active };
      }),
    ),
  rename: (pid, from, to) => set((s) => upd(s, pid, (p) => ({ open: p.open.map((x) => (x.path === from ? { ...x, path: to } : x)), active: p.active === from ? to : p.active }))),
}));

export const isDirty = (f?: OpenFile) => !!f && f.buf !== f.base;
