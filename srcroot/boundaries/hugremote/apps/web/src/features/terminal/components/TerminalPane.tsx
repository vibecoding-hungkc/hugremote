import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { toast } from '../../../components/ui/Overlay';
import { ErrorBox } from '../../../components/ui/States';
import { ApiError } from '../../../lib/api-client';
import { workspaceApi } from '../../workspace/api/workspace.api';
import { qk } from '../../workspace/hooks/useWorkspace';
import { attachTerm, disposeTerm, getTerm, type PooledTerm } from './terminal-pool';

/**
 * Vùng terminal S6: gắn xterm từ pool, fit theo khung (ResizeObserver), chạm để mở bàn phím ảo (AC-11).
 * Vòng 3 — AC-56: mất kết nối thì vừa tự nối lại vừa hiện ngay *Mở lại tại đây* (Q-7); bấm → shell mới trong CHÍNH tab này
 * (giữ id) thay vì mở tab mới. Phiên tmux (AC-55): đang nối lại = đang gắn lại session.
 */
export function TerminalPane({ sessionId, exited, tmuxName, onClose, onKeyTarget }: { sessionId: string; exited: boolean; tmuxName?: string; onClose: () => void; onKeyTarget?: (p: PooledTerm) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const box = useRef<HTMLDivElement>(null);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [gen, setGen] = useState(0); // tăng sau khi mở lại → lấy xterm mới từ pool
  const [busy, setBusy] = useState(false);
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
  }, [p, gen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (exited) disposeTerm(sessionId);
  }, [exited, sessionId]);

  const reopen = async () => {
    setBusy(true);
    try {
      await workspaceApi.reopenTerminal(sessionId);
    } catch (e) {
      // Vẫn đang chạy = vừa nối lại được → chỉ cần gắn lại
      if (!(e instanceof ApiError && e.code === 'SESSION_STILL_RUNNING')) {
        setBusy(false);
        return toast(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') }));
      }
    }
    disposeTerm(sessionId);
    await qc.invalidateQueries({ queryKey: qk.terminals });
    setBusy(false);
    setGen((g) => g + 1);
  };

  const gone = exited || p?.state.exited || p?.state.gone;
  const retrying = !!p?.state.reconnecting && !gone;
  // Shell thoát thật (exit, tmux bị kill) ≠ mất kết nối: nói đúng, và để output cuối còn nhìn thấy (dải dưới đáy)
  // 4404 sau khi API khởi động lại = PTY đã mất → cũng là "đã kết thúc", không phải "mất kết nối" (dogfood edge V2)
  const ended = !retrying && !!(exited || p?.state.exited || p?.state.gone);
  useEffect(() => {
    if (p?.state.gone) void qc.invalidateQueries({ queryKey: qk.terminals });
  }, [p?.state.gone, qc]);
  return (
    <div className="pane" style={{ position: 'relative', background: 'var(--term-bg)' }}>
      {!exited && <div ref={box} style={{ position: 'absolute', inset: 0 }} onClick={() => p?.term.focus()} aria-label={t('term.area')} />}
      {retrying && tmuxName && <div className="ended-cover">{t('term.tmuxAttaching', { name: tmuxName })}</div>}
      {p?.state.notice === 'TMUX_RECREATED' && (
        <div className="pane-notice" role="status">
          <span className="grow">{t('term.tmuxRecreated', { name: tmuxName })}</span>
          <Button variant="ghost" size="sm" iconOnly icon="x" label={t('common.close')} onClick={() => ((p.state.notice = undefined), force())} />
        </div>
      )}
      {(gone || (retrying && !tmuxName)) && (
        <div className={`ended-cover ${ended ? 'bar' : ''}`}>
          <ErrorBox
            title={retrying ? t('term.lostRetry', { n: p!.state.reconnecting }) : ended ? t('term.ended') : t('term.lost')}
            actions={
              <>
                <Button variant="primary" size="sm" icon="refresh" disabled={busy} onClick={() => void reopen()}>
                  {t('term.reopenHere')}
                </Button>
                <Button size="sm" onClick={onClose}>
                  {t('term.closeTab')}
                </Button>
              </>
            }
          />
        </div>
      )}
    </div>
  );
}
