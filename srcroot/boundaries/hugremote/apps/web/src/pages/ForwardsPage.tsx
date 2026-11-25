import { useNewSession } from '../app/shell/actions';
import { desktop } from '../features/web/web.api';
import { workspaceApi } from '../features/workspace/api/workspace.api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
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

  const err = (e: unknown) => toast(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') }));
  const refresh = () => qc.invalidateQueries({ queryKey: FK });
  const all = fw.data ?? [];
  const usedL = all.filter((f) => f.direction === 'L').map((f) => f.localPort);
  const mine = all.filter((f) => f.hostId === host);

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
              <ForwardRow key={f.id} f={f} onChanged={refresh} onError={err} />
            ))}
          </div>
        )}
        {!mine.length && <EmptyState icon="fwd" message={t('fw.empty')} />}
      </div>
      {sheet && (
        <AddSheet
          hosts={hosts}
          hostId={host}
          usedL={usedL}
          forwards={all}
          onClose={() => setSheet(false)}
          onAdded={(h) => (setHost(h), void refresh())}
          onError={err}
        />
      )}
    </div>
  );
}

function ForwardRow({ f, onChanged, onError }: { f: Forward; onChanged: () => void; onError: (e: unknown) => void }) {
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
          {rev ? `localhost:${f.localPort}` : `${f.remoteHost}:${f.remotePort}`}
          {f.label && <span className="muted xs"> · {f.label}</span>}
        </div>
        {f.status === 'err' && <div className="t2 danger-t">{f.error ? t(`errors.${f.error}`, { defaultValue: f.error }) : t('errors.INTERNAL')}</div>}
      </div>
      <span className="mono muted xs">→ {rev ? 'SSH:' : 'local:'}</span>
      <input className={`input mono sm ${bad ? 'err' : ''}`} style={{ width: 84 }} inputMode="numeric" aria-label={rev ? t('fw.remotePortOn', { host: f.hostId }) : t('fw.localPort')} value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ''))} onBlur={() => void save()} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
      <span className="hide-mobile">
        <span className="badge">
          <span className={`dot ${f.status === 'on' ? 'ok' : f.status === 'err' ? 'err' : ''}`} />
          {t(`fw.st_${f.status}`)}
        </span>
      </span>
      {f.status === 'on' && !rev && desktop() && (
        <Button variant="ghost" size="sm" iconOnly icon="globe" label={t('files.openInBrowser')} onClick={() => void openWeb(f.hostId, f.localPort)} />
      )}
      {/* trình duyệt hệ thống: app desktop chuyển window.open sang shell.openExternal; web thường chỉ đúng khi đang mở HugRemote ngay trên máy chạy nó */}
      {f.status === 'on' && !rev && (desktop() || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) && (
        <Button variant="ghost" size="sm" iconOnly icon="ext" label={t('web.external')} onClick={() => window.open(`http://localhost:${f.localPort}/`, '_blank', 'noopener')} />
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

/**
 * Một cổng đang nghe ở đầu nguồn → ô cổng đầu đích + *Chuyển tiếp*. `port` rỗng = dòng "cổng khác" (tự nhập cổng nguồn).
 * `L`: nguồn = máy SSH, đích = Mac (`ssh -L`). `R`: nguồn = Mac, đích = máy SSH (`ssh -R`).
 */
function ListeningRow({ dir, hostId, port, proc, suggest, autoStart, usedL, onChanged, onError }: { dir: 'L' | 'R'; hostId: string; port?: number; proc?: string; suggest: number; autoStart: boolean; usedL: number[]; onChanged: () => void; onError: (e: unknown) => void }) {
  const { t } = useTranslation();
  const rev = dir === 'R';
  const [v, setV] = useState(suggest ? String(suggest) : '');
  const [src, setSrc] = useState('');
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const from = port ?? Number(src);
  const go = () => {
    if (busy || !from || !v) return;
    setBusy(true);
    const body = rev ? { direction: 'R' as const, hostId, remotePort: Number(v), localPort: from } : { direction: 'L' as const, hostId, remotePort: from, localPort: Number(v) };
    void forwardsApi
      .create({ ...body, label: proc || undefined, autoStart })
      .then(onChanged, (e) => (setBad(e instanceof ApiError && (e.code === 'LOCAL_PORT_IN_USE' || e.code === 'REMOTE_PORT_IN_USE')), onError(e)))
      .finally(() => setBusy(false));
  };
  return (
    <div className="row fw" style={{ cursor: 'default' }}>
      <Icon name={rev ? 'up' : 'server'} />
      <div className="t">
        <div className="t1 mono">
          localhost:
          {port !== undefined ? (
            port
          ) : (
            <input
              className="input mono sm"
              style={{ width: 112 }}
              inputMode="numeric"
              aria-label={rev ? t('fw.localService') : t('fw.remote')}
              placeholder={t('fw.otherPort')}
              value={src}
              onChange={(e) => {
                const x = e.target.value.replace(/\D/g, '');
                setSrc(x);
                if (x) setV(String(rev ? Number(x) : freeLocal(Number(x), usedL)));
              }}
            />
          )}
        </div>
        {proc && <div className="t2 mono">{proc}</div>}
      </div>
      <span className="mono muted xs">→ {rev ? 'SSH:' : 'local:'}</span>
      <input
        className={`input mono sm ${bad ? 'err' : ''}`}
        aria-invalid={bad || undefined}
        style={{ width: 84 }}
        inputMode="numeric"
        aria-label={rev ? t('fw.remotePortOn', { host: hostId }) : t('fw.localPort')}
        value={v}
        onChange={(e) => (setBad(false), setV(e.target.value.replace(/\D/g, '')))}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), go())}
      />
      <Button size="sm" icon="fwd" loading={busy} disabled={!from || !v} onClick={go}>
        {t('fw.forward')}
      </Button>
    </div>
  );
}

/**
 * Sheet Thêm (rộng 1/2 màn — Authority 2026-11-25): cả hai chiều là danh sách cổng đang nghe ở đầu nguồn + dòng
 * "cổng khác", mỗi dòng ô cổng đầu đích + *Chuyển tiếp*. Máy SSH → Mac: nguồn = `ss`/`lsof` trên máy SSH;
 * Mac → máy SSH: nguồn = cổng đang nghe trên Mac (`hosts/local/listening-ports`).
 */
function AddSheet({
  hosts,
  hostId,
  usedL,
  forwards,
  onClose,
  onAdded,
}: {
  hosts: { id: string; name: string }[];
  hostId?: string;
  usedL: number[];
  forwards: Forward[];
  onClose: () => void;
  onAdded: (hostId: string) => void;
  onError: (e: unknown) => void;
}) {
  const { t } = useTranslation();
  const [h, setH] = useState(hostId ?? hosts[0]?.id ?? '');
  const [dir, setDir] = useState<'L' | 'R'>('L');
  const [auto, setAuto] = useState(true);
  const rev = dir === 'R';
  const src = rev ? 'local' : h;
  const ports = useQuery({ queryKey: ['listening', src], queryFn: () => forwardsApi.listening(src), enabled: !!src, refetchInterval: 10000 });
  // bỏ cổng đã có chuyển tiếp cùng chiều tới máy này (L: theo cổng máy SSH; R: theo cổng service trên Mac)
  const notYet = (ports.data ?? []).filter((p) => !forwards.some((f) => f.hostId === h && f.direction === dir && (rev ? f.localPort : f.remotePort) === p.port));
  const usedR = forwards.filter((f) => f.hostId === h && f.direction === 'R').map((f) => f.remotePort);
  const sugg = (port: number) => (rev ? (usedR.includes(port) ? freeLocal(port, usedR) : port) : freeLocal(port, usedL));
  const sheetRef = useRef<HTMLDivElement>(null);
  useModalFocus(sheetRef, onClose, { first: '#fw-h', tab: 'trap' });
  const err = (e: unknown) => toast(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') }));
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={sheetRef} className="sheet wide" role="dialog" aria-modal="true" aria-label={t('fw.addTitle')}>
        <div className="sheet-head">
          {t('fw.addTitle')}
          <Button variant="ghost" size="sm" iconOnly icon="x" label={t('common.close')} onClick={onClose} />
        </div>
        <div className="sheet-body">
          <div className="field">
            <label htmlFor="fw-h">{t('fw.host')}</label>
            <select id="fw-h" className="input mono" value={h} onChange={(e) => setH(e.target.value)}>
              {hosts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t('fw.direction')}</label>
            <div className="seg">
              <button type="button" aria-pressed={!rev} className={rev ? '' : 'on'} onClick={() => setDir('L')}>
                <Icon name="down" />
                {t('fw.dirL')}
              </button>
              <button type="button" aria-pressed={rev} className={rev ? 'on' : ''} onClick={() => setDir('R')}>
                <Icon name="up" />
                {t('fw.dirR')}
              </button>
            </div>
          </div>
          <label className="chk" style={{ marginBottom: 'var(--space-lg)' }}>
            <input type="checkbox" role="switch" className="sw" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            {t('fw.autoStart')}
          </label>
          <h2 className="sm" style={{ margin: '0 0 var(--space-sm)' }}>
            {rev ? t('fw.listeningMac') : t('fw.listening')}
          </h2>
          {ports.isLoading && <Skeleton rows={2} />}
          <div className="list">
            <ListeningRow key={`${dir}:${h}:other`} dir={dir} hostId={h} suggest={rev ? 0 : freeLocal(8000, usedL)} autoStart={auto} usedL={usedL} onChanged={() => onAdded(h)} onError={err} />
            {notYet.map((p) => (
              <ListeningRow key={`${dir}:${h}:${p.port}`} dir={dir} hostId={h} port={p.port} proc={p.proc} suggest={sugg(p.port)} autoStart={auto} usedL={usedL} onChanged={() => onAdded(h)} onError={err} />
            ))}
          </div>
        </div>
        <div className="sheet-foot">
          <Button type="button" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </div>
  );
}
