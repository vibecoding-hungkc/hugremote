import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { toast } from '../../../components/ui/Overlay';
import { ErrorBox, Skeleton } from '../../../components/ui/States';
import { systemApi } from '../api/system.api';

type Kind = 'app' | 'update' | 'ssh';

/** Phiên bản, tình trạng máy chạy HugRemote (AC-15) và nhật ký trong app (AC-46). Chỉ owner. */
export function SystemTab() {
  const { t, i18n } = useTranslation();
  const info = useQuery({ queryKey: ['sysinfo'], queryFn: systemApi.info });
  const checks = useQuery({ queryKey: ['syschecks'], queryFn: systemApi.checks });
  const [kind, setKind] = useState<Kind>('app');
  const logs = useQuery({ queryKey: ['syslogs', kind], queryFn: () => systemApi.logs(kind), refetchInterval: 10_000 });
  const lines = logs.data?.lines ?? [];
  const text = lines.join('\n');
  return (
    <>
      <div className="card">
        <h3>{t('settings.version')}</h3>
        {info.isLoading ? (
          <Skeleton rows={2} />
        ) : info.data ? (
          <dl className="kv">
            <dt>{t('settings.running')}</dt>
            <dd className="mono">
              {info.data.version} · {info.data.channel} · Node {info.data.node}
            </dd>
            <dt>{t('settings.address')}</dt>
            <dd className="mono">
              {info.data.address} · BASE_PATH {info.data.basePath}
            </dd>
            <dt>{t('settings.data')}</dt>
            <dd className="mono">{info.data.dataDir}</dd>
            <dt>{t('settings.since')}</dt>
            <dd>{new Date(info.data.startedAt).toLocaleString(i18n.language)}</dd>
          </dl>
        ) : (
          <ErrorBox title={t('errors.INTERNAL')} onRetry={() => void info.refetch()} />
        )}
        <p className="muted xs">{t('settings.envHint')}</p>
      </div>
      <div className="card">
        <h3>{t('settings.health')}</h3>
        {checks.isLoading ? (
          <Skeleton rows={4} />
        ) : (
          <div className="steps">
            {(checks.data ?? []).map((c) => (
              <div key={c.name} className="check">
                <span className={`dot ${c.ok ? 'ok' : c.required ? 'err' : 'warn'}`} />
                <span>
                  {c.name} <span className="muted xs">· {c.detail}</span>
                  {!c.ok && c.hint && <span className={c.required ? 'bad' : 'muted'}> — {c.hint}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card">
        <h3>{t('settings.logs')}</h3>
        <div className="seg" role="tablist">
          {(['app', 'update', 'ssh'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
              {t(`settings.log_${k}`)}
            </button>
          ))}
        </div>
        <pre className="logv" tabIndex={0} aria-label={t('settings.logs')}>
          {lines.length
            ? lines.map((l, i) => (
                <span key={i} className={/ ERROR| FATAL/.test(l) ? 'r' : / WARN/.test(l) ? 'y' : undefined}>
                  {l}
                  {'\n'}
                </span>
              ))
            : t('settings.noLogs')}
        </pre>
        <div className="btns">
          <Button
            size="sm"
            iconOnly
            icon="download"
            label={t('settings.downloadLogs')}
            onClick={() => {
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([text + '\n'], { type: 'text/plain' }));
              a.download = `hugremote-${kind}.log`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          />
          <Button size="sm" iconOnly icon="copy" label={t('settings.copy')} onClick={() => void navigator.clipboard?.writeText(text).then(() => toast(t('settings.copied')))} />
        </div>
      </div>
    </>
  );
}
