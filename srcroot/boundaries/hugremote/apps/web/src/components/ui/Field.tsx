import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

/** C2 — Trường nhập: nhãn · ô · gợi ý / câu lỗi (`--color-danger`). Ô nhập 16px để iOS không phóng to. */
export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
  mono?: boolean;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, hint, error, mono, className = '', id, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="field" style={{ margin: 0 }}>
      <label htmlFor={fid}>{label}</label>
      <input
        ref={ref}
        id={fid}
        className={`input ${mono ? 'mono' : ''} ${error ? 'err' : ''} ${className}`}
        aria-invalid={!!error || undefined}
        aria-describedby={`${fid}-msg`}
        {...rest}
      />
      {error ? (
        <span className="msg" id={`${fid}-msg`} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="hint" id={`${fid}-msg`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
});
