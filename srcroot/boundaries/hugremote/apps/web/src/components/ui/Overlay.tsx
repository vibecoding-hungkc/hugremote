import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { Icon, type IconName } from './Icon';

// ---------------- C27 Toast ----------------
const useToastStore = create<{ msg: string | null; show: (m: string) => void }>((set) => {
  let t: ReturnType<typeof setTimeout> | undefined;
  return {
    msg: null,
    show: (msg) => {
      clearTimeout(t);
      set({ msg });
      t = setTimeout(() => set({ msg: null }), 2400);
    },
  };
});

/** Thông báo ngắn xác nhận việc vừa xong — 2,4 giây, không chặn thao tác. */
export const toast = (m: string) => useToastStore.getState().show(m);

export function ToastHost() {
  const msg = useToastStore((s) => s.msg);
  if (!msg) return null;
  return createPortal(
    <div className="toast" role="status">
      {msg}
    </div>,
    document.body,
  );
}

// ---------------- Focus cho lớp nổi (a11y) ----------------
const FOCUSABLE = 'input:not([disabled]), textarea, select, button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Lớp nổi giữ focus: mở → focus phần tử `first`; Esc → đóng; Tab vòng trong lớp (`tab: 'trap'`) hoặc đóng lớp
 * (`tab: 'close'`, cho menu); đóng → trả focus về phần tử đã mở nó. `onClose` đọc qua ref để effect chỉ chạy một lần.
 */
export function useModalFocus(ref: React.RefObject<HTMLElement | null>, onClose: () => void, opts: { first?: string; tab: 'trap' | 'close' }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>(opts.first ?? FOCUSABLE)?.focus();
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) return close.current();
      if (e.key !== 'Tab' || !ref.current) return;
      if (opts.tab === 'close') return close.current();
      const l = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!l.length) return;
      const i = l.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) (e.preventDefault(), l[l.length - 1].focus());
      else if (!e.shiftKey && (i === l.length - 1 || i < 0)) (e.preventDefault(), l[0].focus());
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      if (opener?.isConnected) opener.focus();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

// ---------------- C23 Menu nổi ----------------
export interface MenuItem {
  icon?: IconName;
  label: ReactNode;
  hint?: string;
  kbd?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  group?: string;
}

/** Menu nổi có mô tả — vẽ ở lớp nổi (portal) nên không bị vùng cuộn cắt; ↑↓ Enter Esc. */
export function Menu({ anchor, items, onClose, width = 290, children }: { anchor: DOMRect; items?: MenuItem[]; onClose: () => void; width?: number; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref, onClose, { first: '.mi[tabindex]', tab: 'close' });
  const keys = (e: KeyboardEvent) => {
    const list = Array.from(ref.current?.querySelectorAll<HTMLElement>('.mi[tabindex]') ?? []);
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') (e.preventDefault(), (list[i + 1] ?? list[0])?.focus());
    if (e.key === 'ArrowUp') (e.preventDefault(), (list[i - 1] ?? list[list.length - 1])?.focus());
    if (e.key === 'Home') (e.preventDefault(), list[0]?.focus());
    if (e.key === 'End') (e.preventDefault(), list[list.length - 1]?.focus());
    if (e.key === 'Enter' && document.activeElement?.classList.contains('mi')) (e.preventDefault(), (document.activeElement as HTMLElement).click());
  };
  const x = Math.max(8, Math.min(anchor.left, innerWidth - width - 8));
  // Đo chiều cao thật rồi kẹp trong màn: không đủ chỗ phía dưới → lật lên trên nút mở (menu file dài trên điện thoại)
  const [y, setY] = useState(anchor.bottom + 4);
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 0;
    const below = anchor.bottom + 4;
    setY(below + h <= innerHeight - 8 ? below : Math.max(8, Math.min(anchor.top - 4 - h, innerHeight - 8 - h)));
  }, [anchor, items?.length]); // mục về sau (tmux ls) làm menu cao thêm → đo lại
  let lastGroup: string | undefined;
  return createPortal(
    <div className="scrim" style={{ background: 'transparent' }} onClick={onClose}>
      <div ref={ref} className="menu" role="menu" style={{ left: x, top: y, width }} onClick={(e) => e.stopPropagation()} onKeyDown={keys}>
        {children}
        {items?.map((it, i) => {
          const head = it.group && it.group !== lastGroup ? <div className="grp">{it.group}</div> : null;
          lastGroup = it.group ?? lastGroup;
          return (
            <div key={i}>
              {head}
              <div
                className={`mi ${it.danger ? 'danger' : ''}`}
                role="menuitem"
                tabIndex={it.disabled ? undefined : 0}
                aria-disabled={it.disabled || undefined}
                style={it.disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                onClick={() => {
                  if (it.disabled) return;
                  onClose();
                  it.onSelect?.();
                }}
              >
                <b>
                  {it.icon && <Icon name={it.icon} />}
                  <span className="grow">{it.label}</span>
                  {it.kbd && <kbd>{it.kbd}</kbd>}
                </b>
                {it.hint && <span className="d">{it.hint}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

// ---------------- C9 Hộp thoại ----------------
export function Dialog({ title, children, onClose, danger, label }: { title: ReactNode; children: ReactNode; onClose: () => void; danger?: boolean; label?: string }) {
  const ref = useRef<HTMLElement>(null);
  useModalFocus(ref, onClose, { first: 'input, textarea, button.primary, button.danger, button', tab: 'trap' });
  return createPortal(
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section ref={ref} className={`dialog ${danger ? 'danger' : ''}`} role="dialog" aria-modal="true" aria-label={label ?? (typeof title === 'string' ? title : undefined)}>
        <h2>{title}</h2>
        {children}
      </section>
    </div>,
    document.body,
  );
}
