import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/States';
import { filesApi } from '../../features/files/api/files.api';
import { useFiles } from '../../features/files/files.store';

/** Khớp mờ: các ký tự của truy vấn xuất hiện lần lượt trong đường dẫn. Điểm thấp hơn = khớp tốt hơn. */
function fuzzy(path: string, q: string): number | null {
  const s = path.toLowerCase();
  const name = s.slice(s.lastIndexOf('/') + 1);
  if (name.includes(q)) return name.indexOf(q) + name.length * 0.01;
  let i = 0;
  let gaps = 0;
  let last = -1;
  for (let k = 0; k < s.length && i < q.length; k++)
    if (s[k] === q[i]) {
      if (last >= 0) gaps += k - last - 1;
      last = k;
      i++;
    }
  return i === q.length ? 100 + gaps + s.length * 0.01 : null;
}

/**
 * S12 — Mở nhanh file (⌘P): gõ vài ký tự → Enter; thêm `:số` để tới dòng; trống → file đang mở.
 * Dùng lại làm bộ chọn file đính kèm cho ô soạn Claude (C36).
 */
export function QuickOpen({ projectId, onPick, onClose, placeholder }: { projectId: string; onPick: (path: string, line?: number) => void; onClose: () => void; placeholder?: string }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const list = useQuery({ queryKey: ['fsfiles', projectId], queryFn: () => filesApi.files(projectId), staleTime: 30_000 });
  const open = useFiles((s) => s.byProject[projectId]?.open ?? []);
  const m = /:(\d+)$/.exec(q);
  const line = m ? Number(m[1]) : undefined;
  const query = q.replace(/:\d*$/, '').trim().toLowerCase();
  const res = useMemo(() => {
    const files = list.data?.files ?? [];
    if (!query) return open.map((f) => f.path).slice(0, 12);
    return files
      .map((f) => [f, fuzzy(f, query)] as const)
      .filter((x): x is readonly [string, number] => x[1] !== null)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 30)
      .map((x) => x[0]);
  }, [list.data, query, open]);
  const pick = (p: string) => {
    onClose();
    onPick(p, line);
  };
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((i) => (res.length ? (i + (e.key === 'ArrowDown' ? 1 : -1) + res.length) % res.length : 0));
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing && res[sel]) {
      e.preventDefault();
      pick(res[sel]);
    } else if (e.key === 'Escape') onClose();
  };
  return createPortal(
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section className="spot" role="dialog" aria-label={t('quick.title')} data-screen="S12">
        <div className="top">
          <input
            autoFocus
            value={q}
            placeholder={placeholder ?? t('quick.placeholder')}
            aria-label={t('quick.title')}
            autoComplete="off"
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={keys}
          />
          <Button variant="ghost" size="sm" iconOnly icon="x" label={t('common.close')} onClick={onClose} />
        </div>
        <div className="res" role="listbox">
          {list.isLoading ? (
            <Skeleton rows={3} />
          ) : res.length ? (
            <>
              <div className="grp">{query ? t('quick.matches') : t('quick.openNow')}</div>
              {res.map((p, i) => (
                <div key={p} className={`row ${i === sel ? 'sel' : ''}`} role="option" aria-selected={i === sel} tabIndex={-1} onMouseEnter={() => setSel(i)} onClick={() => pick(p)}>
                  <Icon name="file" />
                  <div className="t">
                    <div className="t1 sm">{p.split('/').pop()}</div>
                    <div className="t2 xs">{p}</div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="empty">
              <p>{query ? t('quick.none', { q }) : t('quick.typeToFind')}</p>
            </div>
          )}
        </div>
        <div className="hint hide-mobile">{t('quick.hint')}</div>
      </section>
    </div>,
    document.body,
  );
}
