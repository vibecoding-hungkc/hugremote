import { api } from '../../lib/api-client';
import type { S } from '../../types/schemas';

export type WebSession = S['WebSessionDto'];

/** web-sessions-api.v1 (vòng 3 — AC-59). */
export const webApi = {
  list: () => api<WebSession[]>('/web-sessions'),
  create: (projectId: string, url: string) => api<WebSession>(`/projects/${projectId}/web-sessions`, { body: { url } }),
  patch: (id: string, b: { url?: string; name?: string }) => api<WebSession>(`/web-sessions/${id}`, { method: 'PATCH', body: b }),
  remove: (id: string) => api<void>(`/web-sessions/${id}`, { method: 'DELETE' }),
};

type Bounds = { x: number; y: number; width: number; height: number };
export type WebViewState = { id: string; url: string; title: string; loading: boolean; canBack: boolean; canForward: boolean; error?: string };
export interface DesktopBridge {
  version: number;
  web: {
    show: (id: string, url: string, b: Bounds) => Promise<boolean>;
    bounds: (id: string, b: Bounds) => void;
    hide: (id: string) => void;
    close: (id: string) => void;
    nav: (id: string, action: 'back' | 'forward' | 'reload' | 'devtools' | 'external') => void;
    onState: (cb: (s: WebViewState) => void) => () => void;
  };
}

/** Có khi chạy trong app desktop (preload phơi ra) — phiên trình duyệt chỉ có ở đây (Q-8). */
export const desktop = (): DesktopBridge | undefined => (window as unknown as { hugremoteDesktop?: DesktopBridge }).hugremoteDesktop;
