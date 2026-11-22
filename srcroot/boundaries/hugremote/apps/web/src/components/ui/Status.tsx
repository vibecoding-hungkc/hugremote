import { useTranslation } from 'react-i18next';

/** Trạng thái chung của phiên/máy (C14). */
export type Status = 'running' | 'awaiting' | 'done' | 'stopped' | 'exited' | 'ok' | 'err' | 'connecting' | 'idle';

const DOT: Record<Status, string> = { running: 'run', awaiting: 'warn', done: 'ok', stopped: '', exited: '', ok: 'ok', err: 'err', connecting: 'warn', idle: '' };

export function StatusDot({ status, title }: { status: Status; title?: string }) {
  return <span className={`dot ${DOT[status]}`} title={title} />;
}

/** C14 — Huy hiệu trạng thái (chấm + nhãn). */
export function StatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation();
  return (
    <span className={`badge ${status === 'awaiting' || status === 'connecting' ? 'warn' : ''}`}>
      <span className={`dot ${DOT[status]}`} />
      {t(`status.${status}`)}
    </span>
  );
}
