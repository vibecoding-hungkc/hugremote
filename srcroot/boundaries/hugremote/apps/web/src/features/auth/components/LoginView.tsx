import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LIMITS } from '@app/shared';
import { ApiError } from '../../../lib/api-client';
import { useAuthStore } from '../../../stores/auth.store';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { ErrorBox } from '../../../components/ui/States';
import { Icon } from '../../../components/ui/Icon';
import { env } from '../../../config/env';
import { authApi } from '../api/auth.api';

/** Sang nhà cung cấp SSO; mang theo hash đích đã lưu (G-11) để callback trả về đúng chỗ. */
function ssoStartUrl(provider: string) {
  let ret = '#/';
  try {
    ret = sessionStorage.getItem('hugremote:returnTo') ?? '#/';
  } catch {
    /* chế độ riêng tư */
  }
  return `${env.apiBase}/auth/sso/${provider}?return=${encodeURIComponent(ret)}`;
}

type Step = 'password' | 'code' | 'newpass';

/** S1 — Đăng nhập: mật khẩu → (2FA) mã → (lần đầu) đặt mật khẩu mới. `onDone` trả về trang định mở. */
export function LoginView({
  initialStep = 'password',
  firstRun,
  onDone,
  sso,
  ssoError,
}: {
  initialStep?: Step;
  firstRun?: boolean;
  onDone: () => void;
  sso?: { provider: string; label: string } | null;
  ssoError?: string | null;
}) {
  const { t } = useTranslation();
  const setToken = useAuthStore((s) => s.setToken);
  const [step, setStep] = useState<Step>(initialStep);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ code: string; remaining?: number } | null>(null);
  const [lockLeft, setLockLeft] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [current, setCurrent] = useState('');
  const [codeMode, setCodeMode] = useState<'totp' | 'recovery'>('totp');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (lockLeft <= 0) return;
    const id = setInterval(() => setLockLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [lockLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const fail = (e: unknown) => {
    if (e instanceof ApiError) {
      if (e.code === 'LOCKED') setLockLeft(Number(e.details?.retryAfter ?? 900));
      setErr({ code: e.code, remaining: e.details?.remaining as number | undefined });
    } else setErr({ code: 'INTERNAL' });
  };

  const afterSession = (s: { accessToken?: string; needs2fa: boolean; pendingToken?: string; mustChangePassword: boolean }) => {
    if (s.needs2fa && s.pendingToken) {
      setPending(s.pendingToken);
      setStep('code');
      return;
    }
    if (s.accessToken) setToken(s.accessToken);
    if (s.mustChangePassword) setStep('newpass');
    else onDone();
  };

  async function submitPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pw = String(new FormData(e.currentTarget).get('password') ?? '');
    if (!pw) return setErr({ code: 'EMPTY' });
    setBusy(true);
    setErr(null);
    try {
      setCurrent(pw);
      afterSession(await authApi.login(pw));
    } catch (x) {
      fail(x);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = codeMode === 'totp' ? digits.join('') : String(new FormData(e.currentTarget).get('recovery') ?? '');
    if (!pending) return;
    setBusy(true);
    setErr(null);
    try {
      afterSession(await authApi.verify(pending, code));
    } catch (x) {
      fail(x);
      setDigits(['', '', '', '', '', '']);
      digitRefs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function submitNew(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const np = String(f.get('np') ?? '');
    const np2 = String(f.get('np2') ?? '');
    if (np.length < LIMITS.PASSWORD_MIN_LENGTH) return setErr({ code: 'PASSWORD_TOO_WEAK' });
    if (np !== np2) return setErr({ code: 'MISMATCH' });
    setBusy(true);
    setErr(null);
    try {
      const cur = current || String(f.get('current') ?? '');
      const s = await authApi.changePassword(cur, np);
      if (s.accessToken) setToken(s.accessToken);
      onDone();
    } catch (x) {
      fail(x);
    } finally {
      setBusy(false);
    }
  }

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '');
    if (d.length > 1) {
      // dán cả mã 6 số
      const all = d.slice(0, 6).split('');
      setDigits([...all, ...Array(6 - all.length).fill('')]);
      digitRefs.current[Math.min(all.length, 5)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 5) digitRefs.current[i + 1]?.focus();
  };

  const mmss = `${String(Math.floor(lockLeft / 60)).padStart(2, '0')}:${String(lockLeft % 60).padStart(2, '0')}`;
  const locked = lockLeft > 0;

  let body;
  if (step === 'password') {
    body = (
      <>
        <div>
          <h1>{t('auth.loginTitle')}</h1>
          <p>{t('auth.loginLead')}</p>
        </div>
        {locked && (
          <ErrorBox
            title={t('auth.lockedTitle')}
            body={
              <>
                {t('auth.lockedBody')}
                <b className="mono">{mmss}</b>.
              </>
            }
          />
        )}
        {ssoError && (
          <ErrorBox
            title={t(`errors.${ssoError}`, { defaultValue: t('errors.SSO_FAILED') })}
            body={ssoError === 'SSO_EMAIL_NOT_ALLOWED' ? t('auth.ssoNotAllowedBody') : t('auth.ssoFailedBody')}
          />
        )}
        <form onSubmit={submitPassword} style={{ display: 'grid', gap: 'var(--space-lg)' }}>
          <input type="text" name="username" autoComplete="username" defaultValue="owner" hidden />
          <Field
            label={t('auth.password')}
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            disabled={locked}
            error={
              err?.code === 'EMPTY'
                ? t('auth.emptyPassword')
                : err?.code === 'INVALID_CREDENTIALS'
                  ? t('auth.wrongPassword', { count: err.remaining ?? 0 })
                  : err && err.code !== 'LOCKED'
                    ? t(`errors.${err.code}`, { defaultValue: t('errors.INTERNAL') })
                    : undefined
            }
            hint={
              firstRun ? (
                t('auth.firstHint')
              ) : (
                <>
                  {t('auth.forgotHint')}
                  <span className="mono">hugremote reset-password</span>
                </>
              )
            }
          />
          <Button variant="primary" block type="submit" loading={busy} loadingLabel={t('auth.loggingIn')} disabled={locked}>
            {t('auth.login')}
          </Button>
        </form>
        {sso && !firstRun && (
          <>
            <div className="or">{t('common.or')}</div>
            <a className="btn block" href={ssoStartUrl(sso.provider)}>
              <Icon name="shield" />
              {t('auth.ssoButton', { label: sso.label })}
            </a>
          </>
        )}
      </>
    );
  } else if (step === 'code') {
    body = (
      <form onSubmit={submitCode} style={{ display: 'grid', gap: 'var(--space-lg)' }}>
        <div>
          <h1>{t('auth.twoFactorTitle')}</h1>
          <p>{t('auth.twoFactorLead')}</p>
        </div>
        {locked && <ErrorBox title={t('auth.lockedTitle')} body={<>{t('auth.lockedBody')}<b className="mono">{mmss}</b>.</>} />}
        <div className="seg" role="tablist">
          <button type="button" className={codeMode === 'totp' ? 'on' : ''} onClick={() => setCodeMode('totp')}>
            {t('auth.totpTab')}
          </button>
          <button type="button" className={codeMode === 'recovery' ? 'on' : ''} onClick={() => setCodeMode('recovery')}>
            {t('auth.recoveryTab')}
          </button>
        </div>
        {codeMode === 'totp' ? (
          <div className="field">
            <label>{t('auth.totpLabel')}</label>
            <div className="otp">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    digitRefs.current[i] = el;
                  }}
                  className={`input ${err ? 'err' : ''}`}
                  inputMode="numeric"
                  maxLength={i === 0 ? 6 : 1}
                  aria-label={t('auth.digit', { n: i + 1 })}
                  autoComplete={i ? 'off' : 'one-time-code'}
                  autoFocus={i === 0}
                  value={d}
                  disabled={locked}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !digits[i] && i > 0) digitRefs.current[i - 1]?.focus();
                  }}
                />
              ))}
            </div>
            {err && !locked ? <span className="msg">{t(`errors.${err.code}`, { defaultValue: t('errors.INTERNAL') })}</span> : <span className="hint">{t('auth.totpHint')}</span>}
          </div>
        ) : (
          <Field label={t('auth.recoveryLabel')} name="recovery" mono placeholder="xxxxx-xxxxx" hint={t('auth.recoveryHint')} error={err && !locked ? t(`errors.${err.code}`) : undefined} />
        )}
        <Button variant="primary" block type="submit" loading={busy} loadingLabel={t('auth.confirming')} disabled={locked || (codeMode === 'totp' && digits.join('').length < 6)}>
          {t('auth.confirm')}
        </Button>
        <Button variant="ghost" block icon="back" onClick={() => { setStep('password'); setErr(null); setPending(null); }}>
          {t('common.back')}
        </Button>
      </form>
    );
  } else {
    body = (
      <>
        <div>
          <h1>{t('auth.newPasswordTitle')}</h1>
          <p>{t('auth.newPasswordLead')}</p>
        </div>
        <form onSubmit={submitNew} style={{ display: 'grid', gap: 'var(--space-lg)' }}>
          <input type="text" autoComplete="username" defaultValue="owner" hidden />
          {!current && <Field label={t('auth.password')} name="current" type="password" autoComplete="current-password" />}
          <Field
            label={t('auth.newPassword')}
            name="np"
            type="password"
            autoComplete="new-password"
            autoFocus
            error={err && err.code !== 'MISMATCH' ? t(`errors.${err.code}`, { defaultValue: t('errors.INTERNAL') }) : undefined}
            hint={t('auth.newPasswordHint', { min: LIMITS.PASSWORD_MIN_LENGTH })}
          />
          <Field label={t('auth.repeat')} name="np2" type="password" autoComplete="new-password" error={err?.code === 'MISMATCH' ? t('auth.mismatch') : undefined} />
          <Button variant="primary" block type="submit" loading={busy} loadingLabel={t('auth.saving')}>
            {t('auth.saveAndEnter')}
          </Button>
        </form>
      </>
    );
  }

  return (
    <main className="auth" data-screen="S1">
      <section className="auth-card" aria-label={t('auth.loginTitle')}>
        <div className="brand">
          <span className="logo-dot" />
          {t('app.name')}
        </div>
        {body}
      </section>
    </main>
  );
}
