import type { MouseEvent, ReactNode } from 'react';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { StatusDot, type Status } from './Status';

/** C11 — Hàng cây (máy · dự án · phiên). Hai nút cuối: + và ⋯ — hiện khi hover/chọn (desktop), luôn hiện (mobile). */
export function TreeNode({
  level,
  icon,
  iconClass,
  name,
  title,
  expanded,
  onToggle,
  selected,
  muted,
  error,
  count,
  meta,
  metaWarn,
  status,
  statusTitle,
  extra,
  onClick,
  onMore,
  moreLabel,
}: {
  level: 0 | 1 | 2;
  icon: IconName;
  iconClass?: string;
  name: string;
  title?: string;
  expanded?: boolean;
  onToggle?: () => void;
  selected?: boolean;
  muted?: boolean;
  error?: boolean;
  count?: number;
  meta?: string;
  metaWarn?: boolean;
  status?: Status;
  statusTitle?: string;
  extra?: ReactNode;
  onClick: () => void;
  onMore?: (e: MouseEvent<HTMLElement>) => void;
  moreLabel?: string;
}) {
  const cls = ['node', level === 0 ? 'host' : level === 1 ? 'l1' : 'l2', selected ? 'sel' : '', muted ? 'muted' : '', error ? 'err' : ''].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      role="treeitem"
      aria-expanded={onToggle ? !!expanded : undefined}
      aria-selected={selected || undefined}
      tabIndex={0}
      title={title}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onClick(); // Enter trên nút ⋯ bên trong không chuyển trang (dogfood a11y #6)
        if (onToggle && ((e.key === 'ArrowRight' && !expanded) || (e.key === 'ArrowLeft' && expanded))) (e.preventDefault(), onToggle());
      }}
      onContextMenu={
        onMore
          ? (e) => {
              e.preventDefault();
              onMore(e);
            }
          : undefined
      }
    >
      {onToggle && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          <Icon name="chev" className={`chev ${expanded ? 'open' : ''}`} />
        </span>
      )}
      <Icon name={icon} className={iconClass} />
      <span className="nm">{name}</span>
      {extra}
      {!!count && <span className="cnt">{count}</span>}
      {meta && <span className={`meta ${metaWarn ? 'warn' : ''}`}>{meta}</span>}
      {status && <StatusDot status={status} title={statusTitle} />}
      {onMore && (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon="more"
          label={moreLabel}
          className="act"
          onClick={(e) => {
            e.stopPropagation();
            onMore(e);
          }}
        />
      )}
    </div>
  );
}
