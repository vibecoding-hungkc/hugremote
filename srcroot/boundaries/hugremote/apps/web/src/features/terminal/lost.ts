import { create } from 'zustand';

/** Terminal đang mất kết nối (đang tự nối lại) — để chấm máy ở cây chuyển đỏ (Authority 2026-11-26). */
export const useLostTerms = create<{ ids: Record<string, true>; set: (id: string, lost: boolean) => void }>((set, get) => ({
  ids: {},
  set: (id, lost) => {
    if (!!get().ids[id] === lost) return;
    const ids = { ...get().ids };
    if (lost) ids[id] = true;
    else delete ids[id];
    set({ ids });
  },
}));
