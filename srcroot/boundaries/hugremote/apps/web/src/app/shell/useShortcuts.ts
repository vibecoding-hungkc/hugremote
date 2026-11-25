import { desktop } from '../../features/web/web.api';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUi } from '../../stores/ui.store';
import { useNewSession } from './actions';
import { pbase, useSessions } from './sessions';

/** Vị trí hiện tại trong URL `#/s/<máy>/p/<dự án>/<tab>/<phiên>`. */
function where(path: string) {
  const m = /^\/s\/([^/]+)\/p\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?/.exec(path);
  return m ? { hostId: decodeURIComponent(m[1]), projectId: m[2], tab: m[3], sid: m[4] } : null;
}

/**
 * Phím tắt desktop (AC-49). Trong tab trình duyệt các phím trình duyệt giữ (⌘W, ⌘1–9, ⌘⇧N…) có bản ⌥;
 * phím riêng của từng màn (⌘S, ⌘F, Esc, ⌥Y/⌥N, ⌘Enter…) nằm ở màn đó.
 */
export function useShortcuts() {
  const nav = useNavigate();
  const loc = useLocation();
  const set = useUi((s) => s.set);
  const sessions = useSessions();
  const newSession = useNewSession();

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const r = where(loc.pathname);
      const k = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      const list = r ? (sessions.byProject.get(r.projectId) ?? []) : [];
      const goSession = (i: number) => {
        const s = list[i];
        if (!r || !s) return false;
        e.preventDefault();
        nav(`${pbase(r.hostId, r.projectId)}/${s.kind}/${s.id}`);
        return true;
      };
      // lớp nổi đang mở thì để nó tự xử lý phím
      if (document.querySelector('.scrim') && !(mod && (k === 'k' || k === '/'))) return;

      // phím toàn cục thắng phím của editor/terminal (⌘/ ở CodeMirror là bật chú thích) → chặn lan xuống
      const take = () => (e.preventDefault(), e.stopPropagation());
      if ((e.metaKey && k === 'k') || (e.ctrlKey && e.altKey && e.code === 'KeyK')) return (take(), set({ spot: true }));
      if (mod && k === '/') return (take(), set({ keys: true }));
      if (mod && k === '\\') return (take(), set({ noSide: !useUi.getState().noSide }));
      if (!r) return;
      const base = pbase(r.hostId, r.projectId);
      if (mod && !e.shiftKey && k === 'p') return (take(), set({ quick: true }));
      if (mod && e.shiftKey && k === 'f') {
        take();
        set({ filesSearchAt: Date.now() });
        if (r.tab !== 'files') nav(`${base}/files`);
        return;
      }
      // ⌥ thay cho phím trình duyệt giữ; ⌘ khi chạy dạng PWA
      const alt = e.altKey && !e.metaKey && !e.ctrlKey;
      if ((alt || (mod && e.shiftKey)) && e.code === 'KeyN' && e.shiftKey) return (e.preventDefault(), void newSession('claude', r.hostId, r.projectId));
      if ((alt || (mod && e.shiftKey)) && e.code === 'KeyT' && e.shiftKey) return (e.preventDefault(), void newSession('terminal', r.hostId, r.projectId));
      if ((alt || (mod && e.shiftKey)) && e.code === 'KeyM' && e.shiftKey && r.hostId !== 'local') return (e.preventDefault(), void newSession('tmux', r.hostId, r.projectId));
      if ((alt || (mod && e.shiftKey)) && e.code === 'KeyB' && e.shiftKey && desktop()) return (e.preventDefault(), void newSession('web', r.hostId, r.projectId));
      if ((alt || e.metaKey) && /^Digit[1-9]$/.test(e.code) && !e.shiftKey) {
        if (goSession(Number(e.code.slice(5)) - 1)) return;
      }
      // ⌥W đóng phiên terminal đang xem (có xác nhận khi còn chạy) — Files tự xử lý ⌥W cho tab file
      if (alt && e.code === 'KeyW' && r.tab === 'terminal') {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>('.tabbar .tab.on button')?.click();
        return;
      }
      if (e.ctrlKey && !e.metaKey && ['1', '2', '3'].includes(k)) return (e.preventDefault(), nav(`${base}/${['sessions', 'files', 'git'][Number(k) - 1]}`));
      if (e.ctrlKey && e.key === 'Tab' && r.tab !== 'files' && list.length) {
        e.preventDefault();
        const i = list.findIndex((s) => s.id === r.sid);
        goSession((i + (e.shiftKey ? -1 : 1) + list.length) % list.length);
      }
    };
    // capture: chạy trước handler của CodeMirror/xterm
    window.addEventListener('keydown', on, true);
    return () => window.removeEventListener('keydown', on, true);
  }, [loc.pathname, sessions.byProject, nav, set, newSession]);
}
