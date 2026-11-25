import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Vòng 3 — AC-60/61: trạng thái cây Files theo dự án (thư mục đang mở, file ẩn, vị trí cuộn), giữ khi đổi tab và qua F5.
 * Gốc lỗi: trước đây là `useState` trong `FilesView`, mất mỗi lần component bị gỡ. `hidden` chưa đặt = mặc định theo dự án
 * (Home bật — dotfile là nội dung chính của Home).
 */
interface TreeState {
  expanded: Record<string, boolean>;
  hidden?: boolean;
  scrollTop?: number;
}
interface FilesTree {
  byProject: Record<string, TreeState>;
  patch: (pid: string, p: Partial<TreeState>) => void;
}

const MAX_OPEN = 200;

export const useFilesTree = create<FilesTree>()(
  persist(
    (set) => ({
      byProject: {},
      patch: (pid, p) =>
        set((s) => {
          const cur = s.byProject[pid] ?? { expanded: {} };
          const next = { ...cur, ...p };
          const keys = Object.keys(next.expanded).filter((k) => next.expanded[k]);
          if (keys.length > MAX_OPEN) next.expanded = Object.fromEntries(keys.slice(-MAX_OPEN).map((k) => [k, true]));
          return { byProject: { ...s.byProject, [pid]: next } };
        }),
    }),
    { name: 'hugremote:files-tree' },
  ),
);
