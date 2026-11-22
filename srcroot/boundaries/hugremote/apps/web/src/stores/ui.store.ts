import { create } from 'zustand';

/** Trạng thái bố cục phía client (TECHSTACK: Zustand) — cây mở/đóng, thanh bên, chia ô. Lưu localStorage cho tiện từng người xem. */
interface UiState {
  open: Record<string, boolean>;
  noSide: boolean;
  sideOpen: boolean;
  split: { kind: 'terminal' | 'claude' | 'files' | 'git'; id?: string } | null;
  ratio: number;
  /** Chế độ gọn của hội thoại Claude (C37). */
  claudeFocus: boolean;
  toggle: (k: string, v?: boolean) => void;
  collapseAll: () => void;
  set: (p: Partial<UiState>) => void;
}

const KEY = 'hugremote:ui';
const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<UiState>;
  } catch {
    return {};
  }
})();

export const useUi = create<UiState>((set, get) => ({
  open: saved.open ?? {},
  noSide: saved.noSide ?? false,
  sideOpen: false,
  split: saved.split ?? null,
  ratio: saved.ratio ?? 55,
  claudeFocus: saved.claudeFocus ?? false,
  toggle: (k, v) => set({ open: { ...get().open, [k]: v ?? !get().open[k] } }),
  collapseAll: () => set({ open: {} }),
  set: (p) => set(p),
}));

useUi.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ open: s.open, noSide: s.noSide, ratio: s.ratio, claudeFocus: s.claudeFocus, split: s.split }));
  } catch {
    /* chế độ riêng tư */
  }
});
