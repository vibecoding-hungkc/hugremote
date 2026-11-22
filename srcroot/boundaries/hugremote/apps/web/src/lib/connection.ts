import { create } from 'zustand';

/**
 * Trạng thái kết nối tới server (AC-43): lỗi mạng của api-client, SSE/WS rớt → `offline`.
 * Khi offline, mọi nút ghi khoá (useWriteGuard), nháp giữ nguyên; nối lại không tự gửi.
 */
interface ConnState {
  online: boolean;
  attempt: number;
  set: (online: boolean) => void;
}

export const useConnection = create<ConnState>((set, get) => ({
  online: true,
  attempt: 0,
  set: (online) => set({ online, attempt: online ? 0 : get().attempt + 1 }),
}));

export const connection = {
  reportOk() {
    if (!useConnection.getState().online) useConnection.getState().set(true);
  },
  reportNetworkError() {
    useConnection.getState().set(false);
  },
};

/** Đường phím tắt (⌘S, ⌘Enter, ⌥Y…) không đi qua nút có `write` → kiểm ở đây. true = đang mất kết nối, đừng gửi. */
export function blockedOffline(notify: (msg: string) => void, msg: string) {
  if (useConnection.getState().online) return false;
  notify(msg);
  return true;
}
