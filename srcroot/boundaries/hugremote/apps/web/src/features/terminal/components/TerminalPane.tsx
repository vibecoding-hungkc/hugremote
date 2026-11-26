import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { toast } from '../../../components/ui/Overlay';
import { ErrorBox } from '../../../components/ui/States';
import { ApiError } from '../../../lib/api-client';
import { workspaceApi } from '../../workspace/api/workspace.api';
import { qk } from '../../workspace/hooks/useWorkspace';
import { useLostTerms } from '../lost';
import { attachTerm, disposeTerm, getTerm, type PooledTerm } from './terminal-pool';

/**
 * Vùng terminal S6: gắn xterm từ pool, fit theo khung (ResizeObserver), chạm để mở bàn phím ảo (AC-11).
 * Mất kết nối (WS đang nối lại, hoặc phiên đóng KHÔNG có mã thoát — SSH rớt / API mất PTY) → tự nối lại, chỉ hiện badge
 * "Đang kết nối lại…" giữa ô, nối được thì "Đã kết nối lại" 2 giây (Authority 2026-11-26, bỏ 2 nút). Chỉ phiên tự thoát thật
 * (có mã thoát) mới còn *Mở lại tại đây* / *Đóng tab*.
 */
export function TerminalPane({
  sessionId,
  exited,
  exitCode,
  tmuxName,
  onClose,
  onKeyTarget,
}: {
  sessionId: string;
  exited: boolean;
  exitCode?: number;
  tmuxName?: string;
  onClose: () => void;
  onKeyTarget?: (p: PooledTerm) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const box = useRef<HTMLDivElement>(null);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [gen, setGen] = useState(0); // tăng sau khi mở lại → lấy xterm mới từ pool
  const [busy, setBusy] = useState(false);
  const [back, setBack] = useState(false); // "Đã kết nối lại" 2 giây
  const setLost = useLostTerms((s) => s.set);
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

  /** Shell mới trong CHÍNH tab này (giữ id). Trả false nếu chưa được (máy còn chưa tới được). */
  const reopen = async (quiet = false) => {
    setBusy(true);
    try {
      await workspaceApi.reopenTerminal(sessionId);
    } catch (e) {
      // Vẫn đang chạy = vừa nối lại được → chỉ cần gắn lại
      if (!(e instanceof ApiError && e.code === 'SESSION_STILL_RUNNING')) {
        setBusy(false);
        if (!quiet) toast(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') }));
        return false;
      }
    }
    disposeTerm(sessionId);
    await qc.invalidateQueries({ queryKey: qk.terminals });
    setBusy(false);
    setGen((g) => g + 1);
    return true;
  };

  const retrying = !!p?.state.reconnecting && !p.state.gone && !p.state.exited;
  // đóng mà không có mã thoát = kênh SSH rớt / API khởi động lại mất PTY (4404) — không phải người dùng thoát
  const dropped = !!p?.state.gone || (!!p?.state.exited && p.state.exitCode == null) || (exited && exitCode == null && !p);
  const lost = retrying || dropped;
  const ended = !lost && (exited || !!p?.state.exited);

  useEffect(() => setLost(sessionId, lost), [sessionId, lost, setLost]);
  useEffect(() => () => setLost(sessionId, false), [sessionId, setLost]);

  // mất rồi có lại → badge "Đã kết nối lại" 2 giây
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !lost) {
      setBack(true);
      const tm = setTimeout(() => setBack(false), 2000);
      was.current = false;
      return () => clearTimeout(tm);
    }
    was.current = lost;
  }, [lost]);

  // phiên rớt → tự mở lại; máy chưa tới được thì thử lại 2 → 5 giây, có mạng lại thì thử ngay
  useEffect(() => {
    if (!dropped) return;
    let stop = false;
    let n = 0;
    let tm: ReturnType<typeof setTimeout> | undefined;
    const go = async () => {
      if (stop || busy) return;
      if (await reopen(true)) return;
      tm = setTimeout(() => void go(), Math.min(5000, 2000 + 1000 * n++));
    };
    const now = () => (clearTimeout(tm), void go());
    window.addEventListener('online', now);
    void go();
    return () => {
      stop = true;
      clearTimeout(tm);
      window.removeEventListener('online', now);
    };
  }, [dropped]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (p?.state.gone) void qc.invalidateQueries({ queryKey: qk.terminals });
  }, [p?.state.gone, qc]);

  return (
    <div className="pane" style={{ position: 'relative', background: 'var(--term-bg)' }}>
      {!exited && <div ref={box} style={{ position: 'absolute', inset: 0 }} onClick={() => p?.term.focus()} aria-label={t('term.area')} />}
      {lost && (
        <div className="reconn" role="status">
          <span className="spin" aria-hidden />
          {t('term.reconnecting')}
        </div>
      )}
      {!lost && back && (
        <div className="reconn" role="status">
          <Icon name="check" className="ok-ic" />
          {t('term.reconnected')}
        </div>
      )}
      {p?.state.notice === 'TMUX_RECREATED' && (
        <div className="pane-notice" role="status">
          <span className="grow">{t('term.tmuxRecreated', { name: tmuxName })}</span>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon="x"
            label={t('common.close')}
            onClick={() => ((p.state.notice = undefined), force())}
          />
        </div>
      )}
      {ended && (
        <div className="ended-cover bar">
          <ErrorBox
            title={t('term.ended')}
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
