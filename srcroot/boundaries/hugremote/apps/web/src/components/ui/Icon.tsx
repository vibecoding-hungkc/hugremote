import { ICON_PATHS, type IconName } from './icon-paths';

/** Biểu tượng nét 24×24 (bộ của prototype đã chốt). Luôn `aria-hidden` — nhãn nằm ở nút chứa nó. */
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`i ${className}`} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />;
}

export type { IconName };
