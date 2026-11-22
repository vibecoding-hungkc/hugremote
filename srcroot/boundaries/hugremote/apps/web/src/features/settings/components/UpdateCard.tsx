import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { useDialogs } from '../../../components/ui/Dialogs';
import { Dialog, toast } from '../../../components/ui/Overlay';
import { ErrorBox } from '../../../components/ui/States';
import { ApiError } from '../../../lib/api-client';
import { systemApi } from '../api/system.api';

const STEP_DOT: Record<string, string> = { ok: 'ok', running: 'run', failed: 'err', pending: '' };

/** AC-31 — có bản mới → xác nhận nêu số phiên sẽ dừng → Cập nhật ngay / Khi rảnh → tiến độ từng bước → tự quay về khi lỗi. */
export function UpdateCard({ onShowLog }: { onShowLog: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const open = useDialogs((s) => s.open);
  const close = useDialogs((s) => s.close);
  const q = useQuery({
    queryKey: ['sysupdate'],
    queryFn: systemApi.update,
    // đang chạy → hỏi 2,5s một lần; trong lúc api khởi động lại thì lỗi mạng là bình thường
    refetchInterval: (x) => (x.state.data?.run?.status === 'running' || x.state.data?.waiting ? 2500 : 60_000),
    retry: true,
  });
  const u = q.data;
  if (!u) return null;
  const start = async (when: 'now' | 'idle') => {
    close();
    try {
      qc.setQueryData(['sysupdate'], await systemApi.startUpdate(when));
    } catch (e) {
      toast(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') }));
    }
  };
  const confirm = () => {
    const { claude, terminal } = u.running;
    const busy = claude + terminal > 0;
    open(
      <Dialog title={t('update.confirmTitle', { v: u.latest })} onClose={close}>
        <p>
          {t('update.confirmBody', { v: u.current })} {busy && <b>{t('update.willStop', { claude, terminal })}</b>}
        </p>
        <div className="btns" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button onClick={close}>{t('common.cancel')}</Button>
          {busy && (
            <Button write onClick={() => void start('idle')}>
              {t('update.whenIdle')}
            </Button>
          )}
          <Button variant="primary" write onClick={() => void start('now')}>
            {t('update.now')}
          </Button>
        </div>
      </Dialog>,
    );
  };
  const run = u.run;
  if (!u.installed) return <p className="muted xs">{t('update.dev')}</p>;
  if (run?.status === 'running')
    return (
      <>
        <p className="sm">{t('update.running', { from: run.from, to: run.to })}</p>
        <div className="steps">
          {run.steps.map((s) => (
            <div key={s.name} className="step">
              <span className={`dot ${STEP_DOT[s.status] ?? ''}`} />
              {t(`update.step_${s.name}`)}
              {s.status === 'running' && ` — ${t('update.inProgress')}`}
            </div>
          ))}
        </div>
      </>
    );
  return (
    <>
      {(run?.status === 'failed' || run?.status === 'rolled_back') && (
        <ErrorBox
          title={t(run.status === 'failed' ? 'update.failedTitle' : 'update.rolledTitle', { to: run.to, from: run.from })}
          body={t(run.status === 'failed' ? 'update.failedBody' : 'update.rolledBody')}
          actions={
            <Button size="sm" onClick={onShowLog}>
              {t('update.showLog')}
            </Button>
          }
        />
      )}
      {run?.status === 'done' && run.to === u.current && <p className="muted xs">{t('update.done', { v: run.to })}</p>}
      {u.waiting ? (
        <div className="btns">
          <span className="grow sm">{t('update.waiting', { v: u.latest, claude: u.running.claude, terminal: u.running.terminal })}</span>
          <Button size="sm" write onClick={() => void systemApi.cancelUpdate().then(() => q.refetch())}>
            {t('update.cancelWait')}
          </Button>
        </div>
      ) : u.latest ? (
        <div className="btns">
          <span className="grow sm">{t('update.available', { v: u.latest, channel: u.channel })}</span>
          <Button variant="primary" size="sm" icon="download" write onClick={confirm}>
            {t('update.update')}
          </Button>
        </div>
      ) : (
        <p className="muted xs">{t('update.latest', { channel: u.channel })}</p>
      )}
    </>
  );
}
