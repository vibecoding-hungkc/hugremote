import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnection } from '../../lib/connection';
import { Icon, type IconName } from './Icon';

/** C1 — Nút. Trạng thái: mặc định · focus · đang gửi (khoá, chữ "Đang …") · bị vô hiệu (có lý do). */
export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  icon?: IconName;
  /** Nút chỉ biểu tượng: `label` bắt buộc → tooltip + aria-label. */
  iconOnly?: boolean;
  label?: string;
  loading?: boolean;
  loadingLabel?: string;
  /** Thao tác ghi: tự khoá khi mất kết nối (AC-43). */
  write?: boolean;
  disabledReason?: string;
  block?: boolean;
  tone?: 'primary' | 'danger';
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconOnly, label, loading, loadingLabel, write, disabledReason, block, tone, className = '', disabled, title, children, ...rest },
  ref,
) {
  const { t } = useTranslation();
  const online = useConnection((s) => s.online);
  const offlineLock = write && !online;
  const cls = [
    'btn',
    variant === 'secondary' ? '' : variant,
    size === 'sm' ? 'sm' : '',
    iconOnly ? 'icon' : '',
    block ? 'block' : '',
    tone ? `on-${tone}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const tip = offlineLock ? t('net.offlineTip') : disabled && disabledReason ? disabledReason : title ?? (iconOnly ? label : undefined);
  return (
    <button
      ref={ref}
      type="button"
      className={cls}
      disabled={disabled || loading || offlineLock}
      title={tip}
      aria-label={iconOnly ? label : undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon && <Icon name={loading && iconOnly ? 'refresh' : icon} />}
      {!iconOnly && (loading && loadingLabel ? loadingLabel : children)}
    </button>
  );
});
