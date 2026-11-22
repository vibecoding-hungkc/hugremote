import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

/** C4 — Khối trạng thái rỗng: một câu + đúng một nút hành động (khuôn §5). `action` bỏ trống = biến thể chỉ thông tin. */
export function EmptyState({ icon, message, action }: { icon: IconName; message: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} className="big muted" />
      <p>{message}</p>
      {action && (
        <div className="btns" style={{ justifyContent: 'center' }}>
          {action}
        </div>
      )}
    </div>
  );
}

/** C5 — Khối báo lỗi: nguyên nhân + làm gì tiếp · Thử lại (hoặc hành động khắc phục) · giữ dữ liệu đang nhập. */
export function ErrorBox({ title, body, onRetry, actions }: { title: ReactNode; body?: ReactNode; onRetry?: () => void; actions?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="error" role="alert">
      <div className="h">{title}</div>
      {body && <p>{body}</p>}
      {(actions || onRetry) && (
        <div className="btns">
          {actions ?? (
            <Button size="sm" icon="refresh" onClick={onRetry}>
              {t('common.retry')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Khuôn "Đang tải": khung xám đúng kích thước hàng sắp hiện, không spinner toàn màn. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="list" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel-row">
          <div className="skel" style={{ width: 24, height: 24 }} />
          <div style={{ flex: 1, display: 'grid', gap: 'var(--space-xs)' }}>
            <div className="skel" style={{ width: '55%' }} />
            <div className="skel" style={{ width: '35%', height: 10 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
