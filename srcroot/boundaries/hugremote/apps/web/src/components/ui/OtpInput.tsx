import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

/** Ô nhập mã 6 số (TOTP): dán cả mã vào ô đầu được, Backspace lùi ô. */
export function OtpInput({ value, onChange, error, disabled, autoFocus }: { value: string; onChange: (v: string) => void; error?: boolean; disabled?: boolean; autoFocus?: boolean }) {
  const { t } = useTranslation();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');
  const set = (i: number, raw: string) => {
    const only = raw.replace(/\D/g, '');
    if (only.length > 1) {
      // dán cả mã
      const all = only.slice(0, 6);
      onChange(all);
      refs.current[Math.min(all.length, 5)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = only;
    onChange(next.join('').slice(0, 6));
    if (only && i < 5) refs.current[i + 1]?.focus();
  };
  return (
    <div className="otp">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`input ${error ? 'err' : ''}`}
          inputMode="numeric"
          maxLength={i === 0 ? 6 : 1}
          aria-label={t('auth.digit', { n: i + 1 })}
          autoComplete={i ? 'off' : 'one-time-code'}
          autoFocus={autoFocus && i === 0}
          value={d}
          disabled={disabled}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}
