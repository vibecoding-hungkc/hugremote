// Preload HugRemote Desktop — CommonJS vì cửa sổ chạy `sandbox: true` (DECISIONS 2026-11-25).
// Chỉ phơi đúng bộ hàm cho phiên trình duyệt (AC-59); không phơi ipcRenderer thô (contextIsolation).
import { contextBridge, ipcRenderer } from 'electron';

type Bounds = { x: number; y: number; width: number; height: number };
type WebState = { id: string; url: string; title: string; loading: boolean; canBack: boolean; canForward: boolean; error?: string };

contextBridge.exposeInMainWorld('hugremoteDesktop', {
  version: 1,
  web: {
    show: (id: string, url: string, bounds: Bounds) => ipcRenderer.invoke('web:show', id, url, bounds),
    bounds: (id: string, bounds: Bounds) => ipcRenderer.send('web:bounds', id, bounds),
    hide: (id: string) => ipcRenderer.send('web:hide', id),
    close: (id: string) => ipcRenderer.send('web:close', id),
    nav: (id: string, action: 'back' | 'forward' | 'reload' | 'devtools' | 'external') => ipcRenderer.send('web:nav', id, action),
    onState: (cb: (s: WebState) => void) => {
      const h = (_e: unknown, s: WebState) => cb(s);
      ipcRenderer.on('web:state', h);
      return () => ipcRenderer.removeListener('web:state', h);
    },
  },
});
