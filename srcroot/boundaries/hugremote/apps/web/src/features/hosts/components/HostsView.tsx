import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog, useDialogs } from '../../../components/ui/Dialogs';
import { Field } from '../../../components/ui/Field';
import { Icon } from '../../../components/ui/Icon';
import { toast } from '../../../components/ui/Overlay';
import { StatusBadge } from '../../../components/ui/Status';
import { EmptyState, ErrorBox, Skeleton } from '../../../components/ui/States';
import { ApiError } from '../../../lib/api-client';
import type { Host } from '../../../types/schemas';
import { useMe } from '../../auth/hooks/useMe';
import { hostsApi } from '../api/hosts.api';
import { HostKeyDialog, type HostKeyInfo } from './HostKeyDialog';

interface FormState {
  id?: string;
  alias: string;
  hostName: string;
  user: string;
  port: string;
  authType: 'key' | 'password' | 'agent';
  keyPath: string;
  password: string;
  proxyJump: string;
  workspaceDir: string;
}

const empty: FormState = { alias: '', hostName: '', user: '', port: '22', authType: 'agent', keyPath: '', password: '', proxyJump: '', workspaceDir: '' };

/** S3 — Máy: danh sách từ ~/.ssh/config, ghim + lên/xuống (khớp thứ tự cây), sheet thêm/sửa, thử kết nối, S4 tin host key. */
export function HostsView({ hosts, pins, loading, error, onPins, onReload }: { hosts: Host[]; pins: string[]; loading: boolean; error?: boolean; onPins: (ids: string[]) => void; onReload: () => void }) {
  const { t } = useTranslation();
  const me = useMe();
  const owner = me.data?.role === 'owner';
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState<FormState | null>(null);
  const editId = params.get('edit');
  useEffect(() => {
    const h = editId && hosts.find((x) => x.id === editId);
    if (h) {
      openForm(h);
      setParams({}, { replace: true });
    }
  }, [editId, hosts]); // eslint-disable-line react-hooks/exhaustive-deps

  const openForm = (h?: Host) =>
    setForm(
      h
        ? {
            id: h.id,
            alias: h.id,
            hostName: h.hostName ?? '',
            user: h.user ?? '',
            port: String(h.port ?? 22),
            authType: (h.authType as FormState['authType']) ?? 'agent',
            keyPath: h.keyPath ?? '',
            password: '',
            proxyJump: h.proxyJump ?? '',
            workspaceDir: h.workspaceDir === '~' ? '' : h.workspaceDir,
          }
        : { ...empty },
    );

  if (loading)
    return (
      <div className="content" data-screen="S3">
        <div className="wrap">
          <Skeleton rows={4} />
        </div>
      </div>
    );
  const ordered = [...pins.map((id) => hosts.find((h) => h.id === id)).filter((h): h is Host => !!h), ...hosts.filter((h) => !pins.includes(h.id))];
  const move = (id: string, d: number) => {
    const i = pins.indexOf(id);
    const next = [...pins];
    next.splice(i, 1);
    next.splice(i + d, 0, id);
    onPins(next);
  };
  return (
    <div className="content" data-screen="S3" aria-label={t('nav.hosts')}>
      <div className="wrap">
        <div className="btns" style={{ marginBottom: 'var(--space-md)' }}>
          <p className="muted sm grow" style={{ margin: 0 }}>
            {t('hosts.lead')} {!owner && t('hosts.memberNote')}
          </p>
          {owner && (
            <Button variant="primary" icon="plus" onClick={() => openForm()}>
              {t('hosts.add')}
            </Button>
          )}
        </div>
        {error && <ErrorBox title={t('hosts.loadError')} onRetry={onReload} />}
        <div className="list">
          {ordered.map((h) => {
            const pinned = pins.includes(h.id);
            const i = pins.indexOf(h.id);
            return (
              <div className="row" key={h.id} style={{ cursor: 'default' }}>
                <Icon name={h.kind === 'local' ? 'home' : 'server'} />
                <div className="t">
                  <div className="t1">{h.kind === 'local' ? t('hosts.thisMachineShort') : h.name}</div>
                  <div className="t2 mono">
                    {h.kind === 'local' ? t('hosts.thisMachine') : `${h.user ? h.user + '@' : ''}${h.hostName}${h.port && h.port !== 22 ? ':' + h.port : ''}`}
                    {h.proxyJump ? ` · ${t('hostkey.via', { via: h.proxyJump })}` : ''}
                  </div>
                </div>
                <span className="hide-mobile">
                  <StatusBadge status={h.trusted ? 'ok' : 'connecting'} />
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={pinned ? 'unpin' : 'pin'}
                  tone={pinned ? 'primary' : undefined}
                  label={pinned ? t('hosts.unpin') : t('hosts.pin')}
                  onClick={() => onPins(pinned ? pins.filter((x) => x !== h.id) : [...pins, h.id])}
                />
                {pinned && pins.length > 1 && (
                  <>
                    <Button variant="ghost" size="sm" iconOnly icon="up" label={t('hosts.up')} disabled={i === 0} onClick={() => move(h.id, -1)} />
                    <Button variant="ghost" size="sm" iconOnly icon="down" label={t('hosts.down')} disabled={i === pins.length - 1} onClick={() => move(h.id, 1)} />
                  </>
                )}
                {owner && h.kind !== 'local' && <Button variant="ghost" size="sm" iconOnly icon="edit" label={t('hosts.editNamed', { name: h.name })} onClick={() => openForm(h)} />}
              </div>
            );
          })}
        </div>
        {hosts.length === 1 && owner && (
          <EmptyState
            icon="server"
            message={t('hosts.empty')}
            action={
              <Button variant="primary" icon="plus" onClick={() => openForm()}>
                {t('hosts.add')}
              </Button>
            }
          />
        )}
      </div>
      {form && <HostSheet form={form} hosts={hosts} onClose={() => setForm(null)} onSaved={onReload} />}
    </div>
  );
}

function HostSheet({ form: initial, hosts, onClose, onSaved }: { form: FormState; hosts: Host[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const openDialog = useDialogs((s) => s.open);
  const [f, setF] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [testedAt, setTestedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<'test' | 'save' | null>(null);
  const [hostKey, setHostKey] = useState<HostKeyInfo | null>(null);
  const edit = !!f.id;
  const orig = initial;
  const addressChanged = edit && (f.hostName !== orig.hostName || f.port !== orig.port || f.user !== orig.user);
  const set = (k: keyof FormState) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value });
    if (['hostName', 'port', 'user', 'proxyJump', 'authType', 'keyPath', 'password'].includes(k)) setTestedAt(null);
  };
  const body = () => ({
    hostName: f.hostName.trim(),
    user: f.user.trim(),
    port: Number(f.port) || 22,
    authType: f.authType,
    keyPath: f.authType === 'key' ? f.keyPath.trim() || undefined : undefined,
    password: f.authType === 'password' ? f.password || undefined : undefined,
    proxyJump: f.proxyJump || undefined,
    workspaceDir: f.workspaceDir.trim() || undefined,
  });
  const explain = (e: unknown) => {
    if (e instanceof ApiError && (e.code === 'HOST_KEY_UNKNOWN' || e.code === 'HOST_KEY_CHANGED')) {
      const d = e.details as Record<string, string | number>;
      setHostKey({ hostId: f.alias || f.id!, host: String(d.host), port: Number(d.port), keyType: String(d.keyType), fingerprint: String(d.fingerprint), oldFingerprint: d.oldFingerprint as string | undefined, via: d.via as string | undefined });
      return;
    }
    setErr(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') }));
  };
  const test = async () => {
    if (!f.alias.trim() || !f.hostName.trim()) return setErr(t('hosts.needAliasHost'));
    setBusy('test');
    setErr(null);
    try {
      const r = await hostsApi.test(f.id, { alias: f.alias.trim(), ...body() });
      setTestedAt(r.testedAt);
      toast(t('hosts.testOk'));
    } catch (e) {
      explain(e);
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    if (!f.alias.trim() || !f.hostName.trim() || !f.user.trim()) return setErr(t('hosts.needAliasHost'));
    setBusy('save');
    setErr(null);
    try {
      if (edit) await hostsApi.update(f.id!, { ...body(), testedAt: testedAt ?? undefined });
      else await hostsApi.create({ alias: f.alias.trim(), ...body() } as never);
      await qc.invalidateQueries({ queryKey: ['hosts'] });
      onSaved();
      toast(edit ? t('hosts.saved') : t('hosts.added', { name: f.alias }));
      onClose();
    } catch (e) {
      explain(e);
    } finally {
      setBusy(null);
    }
  };
  const remove = () =>
    openDialog(
      <ConfirmDialog
        danger
        title={t('hosts.removeTitle', { name: f.id })}
        body={<p>{t('hosts.removeBody')}</p>}
        confirmLabel={t('hosts.remove')}
        onConfirm={async () => {
          await hostsApi.remove(f.id!);
          await qc.invalidateQueries();
          toast(t('hosts.removed', { name: f.id }));
          onClose();
        }}
      />,
    );
  const jumps = hosts.filter((h) => h.kind !== 'local' && h.id !== f.id);
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="sheet" aria-label={edit ? t('hosts.editNamed', { name: f.id }) : t('hosts.addTitle')}>
        <div className="sheet-head">
          {edit ? t('hosts.editNamed', { name: f.id }) : t('hosts.addTitle')}
          <Button variant="ghost" size="sm" iconOnly icon="x" label={t('common.close')} onClick={onClose} />
        </div>
        <div className="sheet-body">
          <Field label={t('hosts.alias')} value={f.alias} onChange={set('alias')} disabled={edit} placeholder={t('hosts.aliasPh')} />
          <Field label={t('hosts.hostName')} value={f.hostName} onChange={set('hostName')} mono placeholder="10.0.0.20" />
          <div className="grid2">
            <Field label={t('hosts.user')} value={f.user} onChange={set('user')} mono placeholder="dev" />
            <Field label={t('hosts.port')} value={f.port} onChange={set('port')} mono inputMode="numeric" />
          </div>
          <div className="field">
            <label>{t('hosts.auth')}</label>
            <div className="seg">
              {(['agent', 'key', 'password'] as const).map((a) => (
                <button key={a} type="button" className={f.authType === a ? 'on' : ''} onClick={() => set('authType')({ target: { value: a } })}>
                  {t(`hosts.auth_${a}`)}
                </button>
              ))}
            </div>
          </div>
          {f.authType === 'key' && <Field label={t('hosts.keyPath')} value={f.keyPath} onChange={set('keyPath')} mono placeholder="~/.ssh/id_ed25519" />}
          {f.authType === 'password' && (
            <Field label={t('hosts.password')} type="password" value={f.password} onChange={set('password')} hint={edit ? t('hosts.passwordKeep') : t('hosts.passwordHint')} autoComplete="new-password" />
          )}
          <div className="field">
            <label htmlFor="f-jump">{t('hosts.jump')}</label>
            <select id="f-jump" className="input mono" value={f.proxyJump} onChange={set('proxyJump')}>
              <option value="">{t('hosts.noJump')}</option>
              {jumps.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.id}
                </option>
              ))}
            </select>
          </div>
          <Field label={t('hosts.dir')} value={f.workspaceDir} onChange={set('workspaceDir')} mono placeholder="~" hint={edit ? t('hosts.dirKeep') : undefined} />
          {err && <ErrorBox title={err} />}
          {testedAt && (
            <div className="check">
              <span className="dot ok" />
              {t('hosts.testedOk')}
            </div>
          )}
          {addressChanged && !testedAt && <p className="hint">{t('hosts.retestNeeded')}</p>}
        </div>
        <div className="sheet-foot">
          {edit && (
            <Button variant="danger" icon="trash" write style={{ marginRight: 'auto' }} onClick={remove}>
              {t('hosts.remove')}
            </Button>
          )}
          <Button icon="plug" loading={busy === 'test'} loadingLabel={t('hosts.testing')} onClick={() => void test()}>
            {t('hosts.test')}
          </Button>
          <Button variant="primary" write loading={busy === 'save'} loadingLabel={t('auth.saving')} disabled={addressChanged && !testedAt} disabledReason={t('hosts.retestNeeded')} onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </div>
      </aside>
      {hostKey && (
        <HostKeyDialog
          info={hostKey}
          onClose={() => setHostKey(null)}
          onTrust={async () => {
            const target = edit ? f.id! : f.alias.trim();
            try {
              // máy mới chưa lưu: tin theo địa chỉ đang nhập (máy sau jump: tin khoá của máy trung gian trước)
              await hostsApi.trust(hostKey.via ?? target, { fingerprint: hostKey.fingerprint, keyType: hostKey.keyType, host: hostKey.host, port: hostKey.port });
              setHostKey(null);
              await test();
            } catch (e) {
              setHostKey(null);
              explain(e);
            }
          }}
        />
      )}
    </div>
  );
}
