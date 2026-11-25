import { useNewSession } from '../app/shell/actions';
import { desktop } from '../features/web/web.api';
import { workspaceApi } from '../features/workspace/api/workspace.api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Field } from '../components/ui/Field';
import { toast, useModalFocus } from '../components/ui/Overlay';
import { EmptyState, ErrorBox, Skeleton } from '../components/ui/States';
import { forwardsApi, freeLocal, type Forward } from '../features/forwards/forwards.api';
import { useHosts, usePins } from '../features/workspace/hooks/useWorkspace';
import { ApiError } from '../lib/api-client';

const FK = ['port-forwards'];

/** S14 — Chuyển tiếp cổng (vòng 3, owner): hai chiều, cổng đích sửa được, bấm *Chuyển tiếp* từng cổng đang nghe (AC-57/58). */
export function ForwardsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const hosts = (useHosts().data?.hosts ?? []).filter((h) => h.id !== 'local');
  const fw = useQuery({ queryKey: FK, queryFn: forwardsApi.list, refetchInterval: 5000 });
  // Bộ lọc chỉ gồm máy đang ở không gian làm việc (ghim) + máy đã có chuyển tiếp — theo thứ tự ghim
  const pins = usePins().data ?? [];
  const chips = hosts
    .filter((h) => pins.includes(h.id) || fw.data?.some((f) => f.hostId === h.id))
    .sort((a, b) => (pins.indexOf(a.id) + 1 || 1e9) - (pins.indexOf(b.id) + 1 || 1e9));
  const [params] = useSearchParams();
  const [hostSel, setHost] = useState<string | undefined>(params.get('host') ?? undefined);
  const [sheet, setSheet] = useState(false);
  const host = hostSel ?? chips[0]?.id ?? hosts[0]?.id;
  const ports = useQuery({ queryKey: ['listening', host], queryFn: () => forwardsApi.listening(host!), enabled: !!host, refetchInterval: 10000 });

  const err = (e: unknown) => toast(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') }));
  const refresh = () => qc.invalidateQueries({ queryKey: FK });
  const all = fw.data ?? [];
  const usedL = all.filter((f) => f.direction === 'L').map((f) => f.localPort);
  const mine = all.filter((f) => f.hostId === host);
  // bỏ cổng đã chuyển tiếp -L, và cổng do chính -R của mình mở trên máy SSH
  const notYet = (ports.data ?? []).filter((p) => !mine.some((f) => f.remotePort === p.port));

  if (fw.isLoading) return <div className="content" data-screen="S14"><div className="wrap"><Skeleton rows={3} /></div></div>;
  if (fw.isError) return <div className="content" data-screen="S14"><div className="wrap"><ErrorBox title={t('fw.loadError')} body={t('fw.loadErrorHint')} onRetry={() => void fw.refetch()} /></div></div>;

  return (
    <div className="content" data-screen="S14" aria-label={t('fw.title')}>
      <div className="wrap">
        <div className="btns" style={{ marginBottom: 'var(--space-md)' }}>
          <div className="seg grow" role="tablist">
            {chips.map((h) => (
              <button key={h.id} className={h.id === host ? 'on' : ''} onClick={() => setHost(h.id)}>
                {h.name}
              </button>
            ))}
          </div>
          <Button variant="primary" icon="plus" onClick={() => setSheet(true)}>
            {t('fw.add')}
          </Button>
        </div>
        {mine.length > 0 && (
          <div className="list">
            {mine.map((f) => (
              <ForwardRow key={f.id} f={f} hostName={hosts.find((h) => h.id === f.hostId)?.name ?? f.hostId} onChanged={refresh} onError={err} />
            ))}
          </div>
        )}
        {notYet.length > 0 && (
          <>
            <h2 className="sm" style={{ margin: 'var(--space-lg) 0 var(--space-sm)' }}>{t('fw.listening')}</h2>
            <div className="list">
              {notYet.map((p) => (
                <ListeningRow key={p.port} hostId={host!} hostName={hosts.find((h) => h.id === host)?.name ?? ''} port={p.port} proc={p.proc} suggest={freeLocal(p.port, usedL)} onChanged={refresh} onError={err} />
              ))}
            </div>
          </>
        )}
        {!mine.length && !notYet.length && <EmptyState icon="fwd" message={t('fw.empty')} />}
      </div>
      {sheet && <AddSheet hosts={hosts} hostId={host} usedL={usedL} onClose={() => setSheet(false)} onDone={(h) => (setHost(h), setSheet(false), void refresh())} onError={err} />}
    </div>
  );
}

function ForwardRow({ f, hostName, onChanged, onError }: { f: Forward; hostName: string; onChanged: () => void; onError: (e: unknown) => void }) {
  const { t } = useTranslation();
  const newSession = useNewSession();
  /** Mở trong phiên trình duyệt của dự án Home của máy (S14 không thuộc dự án nào). */
  const openWeb = async (hostId: string, localPort: number) => {
    const home = (await workspaceApi.projects(hostId)).find((p) => p.isHome);
    if (home) await newSession('web', hostId, home.id, { url: `http://localhost:${localPort}/` });
  };
  const rev = f.direction === 'R';
  const [v, setV] = useState(String(rev ? f.remotePort : f.localPort));
  const [bad, setBad] = useState(false);
  const save = async () => {
    const n = Number(v);
    if (n === (rev ? f.remotePort : f.localPort)) return;
    try {
      await forwardsApi.update(f.id, rev ? { remotePort: n } : { localPort: n });
      setBad(false);
      onChanged();
    } catch (e) {
      setBad(true);
      setV(String(rev ? f.remotePort : f.localPort));
      onError(e);
    }
  };
  const act = (p: Promise<unknown>) => void p.then(onChanged, onError);
  return (
    <div className="row fw" style={{ cursor: 'default' }}>
      <Icon name={rev ? 'up' : 'down'} />
      <div className="t">
        <div className="t1 mono">
          {rev ? `Mac localhost:${f.localPort}` : `${hostName} ${f.remoteHost}:${f.remotePort}`}
          {f.label && <span className="muted xs"> · {f.label}</span>}
        </div>
        {f.status === 'err' && <div className="t2 danger-t">{f.error ? t(`errors.${f.error}`, { defaultValue: f.error }) : t('errors.INTERNAL')}</div>}
      </div>
      <span className="mono muted xs">→ {rev ? `${hostName}:` : 'Mac:'}</span>
      <input className={`input mono sm ${bad ? 'err' : ''}`} style={{ width: 84 }} inputMode="numeric" aria-label={rev ? t('fw.remotePortOn', { host: hostName }) : t('fw.localPort')} value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ''))} onBlur={() => void save()} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
      <span className="hide-mobile">
        <span className="badge">
          <span className={`dot ${f.status === 'on' ? 'ok' : f.status === 'err' ? 'err' : ''}`} />
          {t(`fw.st_${f.status}`)}
        </span>
      </span>
      {f.status === 'on' && !rev && desktop() && (
        <Button variant="ghost" size="sm" iconOnly icon="globe" label={t('files.openInBrowser')} onClick={() => void openWeb(f.hostId, f.localPort)} />
      )}
      {f.status === 'off' ? (
        <Button variant="ghost" size="sm" iconOnly icon="plug" label={t('fw.enable')} onClick={() => act(forwardsApi.update(f.id, { enabled: true }))} />
      ) : (
        <Button variant="ghost" size="sm" iconOnly icon="stop" label={t('fw.disable')} onClick={() => act(forwardsApi.update(f.id, { enabled: false }))} />
      )}
      <Button variant="ghost" size="sm" iconOnly icon="trash" label={t('fw.remove')} onClick={() => act(forwardsApi.remove(f.id))} />
    </div>
  );
}

function ListeningRow({ hostId, hostName, port, proc, suggest, onChanged, onError }: { hostId: string; hostName: string; port: number; proc: string; suggest: number; onChanged: () => void; onError: (e: unknown) => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState(String(suggest));
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = () => {
    if (busy) return;
    setBusy(true);
    void forwardsApi
      .create({ direction: 'L', hostId, remotePort: port, localPort: Number(v), label: proc || undefined, autoStart: false })
      .then(onChanged, (e) => (setBad(e instanceof ApiError && e.code === 'LOCAL_PORT_IN_USE'), onError(e)))
      .finally(() => setBusy(false));
  };
  return (
    <div className="row fw" style={{ cursor: 'default' }}>
      <Icon name="server" />
      <div className="t">
        <div className="t1 mono">{hostName} localhost:{port}</div>
        {proc && <div className="t2 mono">{proc}</div>}
      </div>
      <span className="mono muted xs">→ Mac:</span>
      <input className={`input mono sm ${bad ? 'err' : ''}`} aria-invalid={bad || undefined} style={{ width: 84 }} inputMode="numeric" aria-label={t('fw.localPort')} value={v} onChange={(e) => (setBad(false), setV(e.target.value.replace(/\D/g, '')))} onKeyDown={(e) => e.key === 'Enter' && go()} />
      <Button size="sm" icon="fwd" loading={busy} onClick={go}>
        {t('fw.forward')}
      </Button>
    </div>
  );
}

function AddSheet({ hosts, hostId, usedL, onClose, onDone, onError }: { hosts: { id: string; name: string }[]; hostId?: string; usedL: number[]; onClose: () => void; onDone: (hostId: string) => void; onError: (e: unknown) => void }) {
  const { t } = useTranslation();
  const [h, setH] = useState(hostId ?? hosts[0]?.id ?? '');
  const [dir, setDir] = useState<'L' | 'R'>('L');
  const [remote, setRemote] = useState('localhost:8000');
  const [local, setLocal] = useState(String(freeLocal(8000, usedL)));
  const [touched, setTouched] = useState(false);
  const [remoteTouched, setRemoteTouched] = useState(false);
  const [label, setLabel] = useState('');
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  // AC-57: trùng cổng → câu lỗi ngay dưới ô (C2), không chỉ toast
  const [fieldErr, setFieldErr] = useState<{ remote?: string; local?: string }>({});
  const rev = dir === 'R';
  const onRemote = (s: string) => {
    setRemote(s);
    setRemoteTouched(true);
    const m = /:(\d+)$/.exec(s) ?? /^(\d+)$/.exec(s);
    if (m && !touched) setLocal(String(rev ? Number(m[1]) : freeLocal(Number(m[1]), usedL)));
  };
  const sheetRef = useRef<HTMLFormElement>(null);
  useModalFocus(sheetRef, onClose, { first: '#fw-r', tab: 'trap' });
  const submit = async () => {
    const m = /^(?:(.+):)?(\d+)$/.exec(remote.trim());
    if (!m) return onError(new ApiError(400, 'VALIDATION_FAILED'));
    setBusy(true);
    setFieldErr({});
    try {
      await forwardsApi.create({ direction: dir, hostId: h, remoteHost: rev ? undefined : m[1] || 'localhost', remotePort: Number(m[2]), localPort: Number(local), label: label || undefined, autoStart: auto });
      onDone(h);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      if (code === 'LOCAL_PORT_IN_USE') setFieldErr({ local: t(`errors.${code}`) });
      else if (code === 'REMOTE_PORT_IN_USE') setFieldErr({ remote: t(`errors.${code}`) });
      else onError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-label={t('fw.addTitle')} onSubmit={(e) => (e.preventDefault(), void submit())}>
        <div className="sheet-head">
          {t('fw.addTitle')}
          <Button variant="ghost" size="sm" iconOnly icon="x" label={t('common.close')} onClick={onClose} />
        </div>
        <div className="sheet-body">
          <div className="field">
            <label htmlFor="fw-h">{t('fw.host')}</label>
            <select id="fw-h" className="input mono" value={h} onChange={(e) => setH(e.target.value)}>
              {hosts.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t('fw.direction')}</label>
            <div className="seg">
              <button type="button" aria-pressed={!rev} className={rev ? '' : 'on'} onClick={() => setDir('L')}><Icon name="down" />{t('fw.dirL')}</button>
              <button type="button" aria-pressed={rev} className={rev ? 'on' : ''} onClick={() => setDir('R')}><Icon name="up" />{t('fw.dirR')}</button>
            </div>
          </div>
          <div className="grid2" style={{ marginBottom: 'var(--space-lg)' }}>
            <Field id="fw-r" mono label={rev ? t('fw.remoteOpen') : t('fw.remote')} error={fieldErr.remote} value={remote} onChange={(e) => (setFieldErr({}), onRemote(e.target.value))} />
            <Field id="fw-l" mono label={rev ? t('fw.localService') : t('fw.localPort')} error={fieldErr.local} inputMode="numeric" value={local} onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '');
                setFieldErr({});
                setTouched(true);
                setLocal(v);
                if (!remoteTouched && v) setRemote(rev ? v : `localhost:${v}`); // cổng hai đầu tự điền theo nhau (AC-57)
              }} />
          </div>
          <div className="field">
            <label htmlFor="fw-n">{t('fw.label')}</label>
            <input id="fw-n" className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <label className="chk">
            <input type="checkbox" role="switch" className="sw" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            {t('fw.autoStart')}
          </label>
        </div>
        <div className="sheet-foot">
          <Button type="button" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" icon="fwd" loading={busy}>
            {t('fw.forward')}
          </Button>
        </div>
      </form>
    </div>
  );
}
