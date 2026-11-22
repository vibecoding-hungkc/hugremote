import { useQuery, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog, useDialogs } from '../../../components/ui/Dialogs';
import { Field } from '../../../components/ui/Field';
import { Icon } from '../../../components/ui/Icon';
import { Dialog, toast } from '../../../components/ui/Overlay';
import { OtpInput } from '../../../components/ui/OtpInput';
import { Skeleton } from '../../../components/ui/States';
import { ApiError } from '../../../lib/api-client';
import { useAuthStore } from '../../../stores/auth.store';
import { authApi, type Device, type Me } from '../../auth/api/auth.api';

const errText = (t: TFunction, e: unknown) =>
  t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`, { defaultValue: t('errors.INTERNAL') });

/** Hộp hiện mã khôi phục — chỉ hiện một lần, phải tick "đã lưu" mới đóng (AC-3). */
function CodesDialog({ codes }: { codes: string[] }) {
  const { t } = useTranslation();
  const close = useDialogs((s) => s.close);
  const [ok, setOk] = useState(false);
  const text = codes.join('\n');
  return (
    <Dialog title={t('settings.codesTitle', { n: codes.length })} onClose={() => ok && close()}>
      <p>{t('settings.codesBody')}</p>
      <div className="codes">
        {codes.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="btns">
        <Button size="sm" iconOnly icon="copy" label={t('settings.copy')} onClick={() => void navigator.clipboard?.writeText(text).then(() => toast(t('settings.copied')))} />
        <Button
          size="sm"
          iconOnly
          icon="download"
          label={t('settings.downloadTxt')}
          onClick={() => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([text + '\n'], { type: 'text/plain' }));
            a.download = 'hugremote-recovery-codes.txt';
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        />
      </div>
      <label className="chk">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        {t('settings.codesSaved')}
      </label>
      <div className="btns" style={{ justifyContent: 'flex-end' }}>
        <Button variant="primary" disabled={!ok} onClick={close}>
          {t('settings.done')}
        </Button>
      </div>
    </Dialog>
  );
}

/** Tắt 2FA / tạo bộ mã mới — xác nhận bằng mã 6 số hiện tại. */
function OtpConfirm({ act, onDone }: { act: 'off' | 'regen'; onDone: (codes?: string[]) => void }) {
  const { t } = useTranslation();
  const close = useDialogs((s) => s.close);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (act === 'off') {
        await authApi.disable2fa(code);
        close();
        onDone();
      } else {
        const r = await authApi.regenCodes(code);
        onDone(r.recoveryCodes);
      }
    } catch (e) {
      setErr(errText(t, e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={act === 'off' ? t('settings.offTitle') : t('settings.regenTitle')} danger={act === 'off'} onClose={close}>
      <p>{act === 'off' ? t('settings.offBody') : t('settings.regenBody')}</p>
      <OtpInput value={code} onChange={setCode} error={!!err} autoFocus />
      {err && <span className="msg">{err}</span>}
      <div className="btns" style={{ justifyContent: 'flex-end' }}>
        <Button onClick={close}>{t('common.cancel')}</Button>
        <Button variant={act === 'off' ? 'danger' : 'primary'} write loading={busy} disabled={code.length < 6} onClick={() => void go()}>
          {act === 'off' ? t('settings.offConfirm') : t('settings.regenConfirm')}
        </Button>
      </div>
    </Dialog>
  );
}

function TwoFactorCard({ me }: { me: Me }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const open = useDialogs((s) => s.open);
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['me'] });
  const start = async () => {
    setBusy(true);
    try {
      setSetup(await authApi.setup2fa());
      setCode('');
      setErr(null);
    } catch (e) {
      toast(errText(t, e));
    } finally {
      setBusy(false);
    }
  };
  const enable = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await authApi.enable2fa(code);
      setSetup(null);
      await refresh();
      open(<CodesDialog codes={r.recoveryCodes} />);
    } catch (e) {
      setErr(errText(t, e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card">
      <h3>
        <Icon name="lock" />
        {t('settings.twofa')}
      </h3>
      {me.twoFactorEnabled ? (
        <>
          <div className="check">
            <span className="dot ok" />
            {t('settings.twofaOn', { n: me.recoveryCodesLeft ?? 0 })}
          </div>
          <p className="muted xs">{t('settings.codesHint')}</p>
          <div className="btns">
            <Button size="sm" icon="refresh" onClick={() => open(<OtpConfirm act="regen" onDone={(c) => (c ? open(<CodesDialog codes={c} />) : undefined, void refresh())} />)}>
              {t('settings.regen')}
            </Button>
            <Button size="sm" tone="danger" onClick={() => open(<OtpConfirm act="off" onDone={() => (toast(t('settings.offDone')), void refresh())} />)}>
              {t('settings.off')}
            </Button>
          </div>
        </>
      ) : setup ? (
        <>
          <p className="muted sm">{t('settings.step1')}</p>
          <div className="btns" style={{ gap: 'var(--space-lg)', alignItems: 'flex-start' }}>
            <div
              className="qrsvg"
              aria-label={t('settings.qr')}
              style={{ width: 164, height: 164, background: 'var(--light-surface)', padding: 'var(--space-sm)', borderRadius: 'var(--radius)' }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(setup.qrSvg, { USE_PROFILES: { svg: true } }) }}
            />
            <div className="xs muted">
              {t('settings.noScan')}
              <div className="fp">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</div>
            </div>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>{t('settings.step2')}</label>
            <OtpInput value={code} onChange={setCode} error={!!err} autoFocus />
            {err && <span className="msg">{err}</span>}
          </div>
          <div className="btns">
            <Button variant="primary" write loading={busy} loadingLabel={t('auth.confirming')} disabled={code.length < 6} onClick={() => void enable()}>
              {t('settings.enable')}
            </Button>
            <Button onClick={() => setSetup(null)}>{t('common.cancel')}</Button>
          </div>
        </>
      ) : (
        <>
          <p className="muted sm">{t('settings.twofaOff')}</p>
          <div className="btns">
            <Button variant="primary" icon="lock" write loading={busy} onClick={() => void start()}>
              {t('settings.turnOn')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function PasswordCard() {
  const { t } = useTranslation();
  const setToken = useAuthStore((s) => s.setToken);
  const qc = useQueryClient();
  const [cur, setCur] = useState('');
  const [np, setNp] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const s = await authApi.changePassword(cur, np);
      if (s.accessToken) setToken(s.accessToken);
      setCur('');
      setNp('');
      void qc.invalidateQueries({ queryKey: ['devices'] });
      toast(t('settings.pwDone'));
    } catch (e) {
      setErr(errText(t, e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card">
      <h3>{t('settings.password')}</h3>
      <div className="grid2">
        <Field label={t('settings.pwCurrent')} type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
        <Field label={t('settings.pwNew')} type="password" autoComplete="new-password" hint={t('settings.pwHint')} value={np} onChange={(e) => setNp(e.target.value)} error={err ?? undefined} />
      </div>
      <div className="btns">
        <Button write loading={busy} disabled={!cur || np.length < 10} onClick={() => void save()}>
          {t('settings.pwChange')}
        </Button>
      </div>
    </div>
  );
}

function deviceName(d: Device) {
  const ua = d.userAgent ?? '';
  const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /curl|node/i.test(ua) ? 'CLI' : '';
  return [br, os].filter(Boolean).join(' · ') || ua.slice(0, 40) || '—';
}

/** AC-44 — thiết bị đang đăng nhập: đăng xuất từng cái, mọi thiết bị khác, hoặc thiết bị này. */
function DevicesCard() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const nav = useNavigate();
  const open = useDialogs((s) => s.open);
  const setToken = useAuthStore((s) => s.setToken);
  const q = useQuery({ queryKey: ['devices'], queryFn: authApi.devices });
  const list = q.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['devices'] });
  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' }) : '—');
  return (
    <div className="card">
      <h3>{t('settings.devices')}</h3>
      {q.isLoading ? (
        <Skeleton rows={2} />
      ) : (
        <div className="list">
          {list.map((d) => (
            <div key={d.familyId} className="row" style={{ cursor: 'default' }}>
              <Icon name={/iPhone|Android/.test(d.userAgent ?? '') ? 'kb' : 'server'} />
              <div className="t">
                <div className="t1 sm">{deviceName(d)}</div>
                <div className="t2 xs">
                  {d.ip ?? '—'} · {t('settings.lastUsed', { at: when(d.lastUsedAt ?? d.createdAt) })}
                </div>
              </div>
              {d.current ? (
                <span className="badge">{t('settings.thisDevice')}</span>
              ) : (
                <Button
                  size="sm"
                  write
                  onClick={() =>
                    void authApi.revokeDevice(d.familyId).then(() => {
                      toast(t('settings.revoked', { name: deviceName(d) }));
                      void refresh();
                    })
                  }
                >
                  {t('settings.logoutDevice')}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="btns">
        {list.length > 1 && (
          <Button size="sm" write onClick={() => void authApi.revokeOthers().then(() => (toast(t('settings.revokedOthers')), void refresh()))}>
            {t('settings.logoutOthers')}
          </Button>
        )}
        <span className="grow" />
        <Button
          onClick={() =>
            open(
              <ConfirmDialog
                title={t('settings.logoutTitle')}
                body={<p>{t('settings.logoutBody')}</p>}
                confirmLabel={t('settings.logout')}
                onConfirm={async () => {
                  await authApi.logout().catch(() => undefined);
                  setToken(null);
                  qc.clear();
                  nav('/login');
                }}
              />,
            )
          }
        >
          {t('settings.logoutThis')}
        </Button>
      </div>
    </div>
  );
}

export function AccountTab({ me }: { me: Me }) {
  const { t } = useTranslation();
  if (me.role !== 'owner')
    return (
      <>
        <div className="card">
          <h3>
            <Icon name="shield" />
            {t('settings.sso')}
          </h3>
          <p className="muted sm">{t('settings.ssoMember', { email: me.email ?? '' })}</p>
        </div>
        <DevicesCard />
      </>
    );
  return (
    <>
      <TwoFactorCard me={me} />
      <PasswordCard />
      <DevicesCard />
    </>
  );
}
