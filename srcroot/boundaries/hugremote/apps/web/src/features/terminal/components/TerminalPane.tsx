import { useEffect, useReducer, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { attachTerm, disposeTerm, getTerm, type PooledTerm } from './terminal-pool';

/** Vùng terminal S6: gắn xterm từ pool, fit theo khung (ResizeObserver), chạm để mở bàn phím ảo (AC-11). */
export function TerminalPane({ sessionId, exited, onNew, onKeyTarget }: { sessionId: string; exited: boolean; onNew: () => void; onKeyTarget?: (p: PooledTerm) => void }) {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const p = exited ? null : getTerm(sessionId);

  useEffect(() => {
    if (!p || !box.current) return;
    attachTerm(p, box.current);
    p.listeners.add(force);
    onKeyTarget?.(p);
    const ro = new ResizeObserver(() => {
      try {
        p.fit.fit();
      } catch {
        /* chưa hiển thị */
      }
    });
    ro.observe(box.current);
    p.term.focus();
    return () => {
      ro.disconnect();
      p.listeners.delete(force);
    };
  }, [p]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (exited) disposeTerm(sessionId);
  }, [exited, sessionId]);

  const gone = exited || p?.state.exited || p?.state.gone;
  return (
    <div className="pane" style={{ position: 'relative', background: 'var(--term-bg)' }}>
      {!exited && <div ref={box} style={{ position: 'absolute', inset: 0 }} onClick={() => p?.term.focus()} aria-label={t('term.area')} />}
      {!!p?.state.reconnecting && !gone && <div className="ended-cover">{t('term.reconnecting', { n: p.state.reconnecting })}</div>}
      {gone && (
        <div className="ended-cover">
          {t('term.ended')}
          <Button size="sm" icon="plus" onClick={onNew}>
            {t('term.newHere')}
          </Button>
        </div>
      )}
    </div>
  );
}
