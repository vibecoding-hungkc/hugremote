import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog, useDialogs } from '../../../components/ui/Dialogs';
import { Field } from '../../../components/ui/Field';
import { Icon } from '../../../components/ui/Icon';
import { toast } from '../../../components/ui/Overlay';
import { ErrorBox, Skeleton } from '../../../components/ui/States';
import { ApiError } from '../../../lib/api-client';
import { ssoApi } from '../api/sso.api';

const errOf = (t: TFunction, e: unknown) =>
  e instanceof ApiError && typeof e.details?.reason === 'string' ? e.details.reason : t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') });

/** Nhóm (SSO): cấu hình nhà cung cấp + allowlist (AC-32), thành viên + thu hồi, lần bị từ chối (AC-45). Chỉ owner. */
export function TeamTab() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const open = useDialogs((s) => s.open);
  const cfg = useQuery({ queryKey: ['sso'], queryFn: ssoApi.config });
  const members = useQuery({ queryKey: ['ssomembers'], queryFn: ssoApi.members, refetchInterval: 15_000 });
  const denials = useQuery({ queryKey: ['ssodenials'], queryFn: ssoApi.denials, refetchInterval: 15_000 });
  const [f, setF] = useState({ provider: 'oidc' as 'oidc' | 'google', issuerUrl: '', clientId: '', clientSecret: '', allow: '', buttonLabel: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const c = cfg.data;
    if (c) setF({ provider: c.provider as 'oidc' | 'google', issuerUrl: c.issuerUrl, clientId: c.clientId, clientSecret: '', allow: c.allowedEmails.join('\n'), buttonLabel: c.buttonLabel });
  }, [cfg.data]);
  const c = cfg.data;
  const refresh = () => Promise.all(['sso', 'ssomembers', 'ssodenials', 'ssopublic'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  const run = async (name: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(name);
    setErr(null);
    try {
      await fn();
      if (ok) toast(ok);
      await refresh();
    } catch (e) {
      setErr(errOf(t, e));
    } finally {
      setBusy(null);
    }
  };
  const body = (enabled: boolean) => ({
    provider: f.provider,
    issuerUrl: f.provider === 'oidc' ? f.issuerUrl : undefined,
    clientId: f.clientId,
    clientSecret: f.clientSecret || undefined,
    allowedEmails: f.allow.split(/[\n,]/).map((x) => x.trim()).filter(Boolean),
    buttonLabel: f.buttonLabel || undefined,
    enabled,
  });
  const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' }) : t('team.never'));
  if (cfg.isLoading) return <Skeleton rows={4} />;
  const callback = c?.callbackUrls[f.provider] ?? '';
  return (
    <>
      <div className="card">
        <h3>
          <Icon name="shield" />
          {t('team.title')}
          <span className="grow" />
          <span className="badge">
            {c?.enabled && <span className="dot ok" />}
            {c?.enabled ? t('team.on') : t('team.off')}
          </span>
        </h3>
        <p className="muted sm">{t('team.lead')}</p>
        <div className="seg" role="radiogroup">
          {(['oidc', 'google'] as const).map((p) => (
            <button key={p} role="radio" aria-checked={f.provider === p} className={f.provider === p ? 'on' : ''} onClick={() => setF({ ...f, provider: p })}>
              {t(`team.p_${p}`)}
            </button>
          ))}
        </div>
        {f.provider === 'oidc' && (
          <Field label={t('team.issuer')} mono placeholder="https://sso.cong-ty.vn/realms/…" value={f.issuerUrl} onChange={(e) => setF({ ...f, issuerUrl: e.target.value })} />
        )}
        <div className="grid2">
          <Field label={t('team.clientId')} mono value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })} />
          <Field
            label={t('team.clientSecret')}
            mono
            type="password"
            autoComplete="off"
            placeholder={c?.hasSecret ? '••••••••' : ''}
            hint={t('team.secretHint')}
            value={f.clientSecret}
            onChange={(e) => setF({ ...f, clientSecret: e.target.value })}
          />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="sso-allow">{t('team.allow')}</label>
          <textarea id="sso-allow" className="input mono" rows={3} value={f.allow} onChange={(e) => setF({ ...f, allow: e.target.value })} />
          <span className="hint">{t('team.allowHint')}</span>
        </div>
        <Field label={t('team.label')} placeholder={f.provider === 'google' ? 'Google' : 'SSO'} value={f.buttonLabel} onChange={(e) => setF({ ...f, buttonLabel: e.target.value })} />
        <div className="field" style={{ margin: 0 }}>
          <label>{t('team.callback')}</label>
          <div className="btns">
            <span className="fp grow">{callback}</span>
            <Button size="sm" iconOnly icon="copy" label={t('settings.copy')} onClick={() => void navigator.clipboard?.writeText(callback).then(() => toast(t('settings.copied')))} />
          </div>
        </div>
        {err && <ErrorBox title={t('team.errTitle')} body={err} />}
        <div className="btns">
          <Button write loading={busy === 'test'} onClick={() => void run('test', () => ssoApi.discover({ provider: f.provider, issuerUrl: f.issuerUrl }), t('team.testOk'))}>
            {t('team.test')}
          </Button>
          {c?.enabled ? (
            <>
              <Button variant="primary" write loading={busy === 'save'} onClick={() => void run('save', () => ssoApi.save(body(true)), t('team.saved'))}>
                {t('common.save')}
              </Button>
              <Button tone="danger" write onClick={() => void run('off', ssoApi.disable, t('team.disabled'))}>
                {t('team.disable')}
              </Button>
            </>
          ) : (
            <Button variant="primary" write loading={busy === 'save'} onClick={() => void run('save', () => ssoApi.save(body(true)), t('team.enabled'))}>
              {t('team.saveEnable')}
            </Button>
          )}
        </div>
      </div>

      <div className="card">
        <h3>{t('team.members')}</h3>
        {members.data?.length ? (
          <div className="list">
            {members.data.map((m) => (
              <div key={m.id} className="row" style={{ cursor: 'default' }}>
                <Icon name="shield" />
                <div className="t">
                  <div className="t1 sm">{m.email}</div>
                  <div className="t2 xs">
                    {m.revokedAt ? t('team.revokedAt', { at: when(m.revokedAt) }) : t('team.lastLogin', { at: when(m.lastLoginAt), n: m.running })}
                  </div>
                </div>
                {m.revokedAt ? (
                  <Button size="sm" write onClick={() => void run('restore', () => ssoApi.restore(m.id), t('team.restored', { email: m.email }))}>
                    {t('team.restore')}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    tone="danger"
                    write
                    onClick={() =>
                      open(
                        <ConfirmDialog
                          danger
                          title={t('team.revokeTitle', { email: m.email })}
                          body={<p>{t('team.revokeBody', { count: m.running })}</p>}
                          confirmLabel={t('team.revoke')}
                          onConfirm={() => run('revoke', () => ssoApi.revoke(m.id), t('team.revoked', { email: m.email }))}
                        />,
                      )
                    }
                  >
                    {t('team.revoke')}…
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted sm">{t('team.noMembers')}</p>
        )}
      </div>

      <div className="card">
        <h3>{t('team.denials')}</h3>
        {denials.data?.length ? (
          <div className="list">
            {denials.data.map((d) => (
              <div key={d.id} className="row" style={{ cursor: 'default' }}>
                <Icon name="x" />
                <div className="t">
                  <div className="t1 sm">{d.email}</div>
                  <div className="t2 xs">
                    {when(d.at)} · {t(`team.why_${d.reason}`)}
                  </div>
                </div>
                {d.reason !== 'token_invalid' && d.email.includes('@') && (
                  <Button size="sm" icon="plus" write onClick={() => void run('allow', () => ssoApi.allow(d.email), t('team.allowed', { email: d.email }))}>
                    {t('team.allowBtn')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted sm">{t('team.noDenials')}</p>
        )}
      </div>
    </>
  );
}
