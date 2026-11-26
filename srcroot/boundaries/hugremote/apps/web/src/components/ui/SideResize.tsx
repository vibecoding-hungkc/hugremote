import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

const MIN = 180;
const read = (key: string, def: number) => {
  try {
    const v = Number(localStorage.getItem(key));
    return v >= MIN && v <= 1200 ? v : def;
  } catch {
    return def;
  }
};

/**
 * Cột trái kéo đổi độ rộng (Files: cây thư mục · Git: danh sách thay đổi — Authority 2026-11-26).
 * Trả `style` (biến `--side-w` cho grid cha) + tay kéo đặt trong khung cha; nhớ theo trình duyệt (localStorage), ←/→ chỉnh bằng phím,
 * bấm đúp về mặc định. Phần bên phải luôn giữ ≥ 320px.
 */
export function useSideWidth(key: string, def: number) {
  const { t } = useTranslation();
  const [w, setW] = useState(() => read(key, def));
  const [drag, setDrag] = useState(false);
  const save = (v: number) => {
    try {
      localStorage.setItem(key, String(v));
    } catch {
      /* chế độ riêng tư */
    }
  };
  const clamp = (v: number, el: HTMLElement) => Math.round(Math.max(MIN, Math.min(v, (el.parentElement?.clientWidth ?? 1200) - 320)));
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault(); // không bôi đen chữ khi kéo
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const left = e.currentTarget.parentElement?.getBoundingClientRect().left ?? 0;
    setW(clamp(e.clientX - left, e.currentTarget));
  };
  const onPointerUp = () => {
    setDrag(false);
    save(w);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const v = clamp(w + (e.key === 'ArrowRight' ? 16 : -16), e.currentTarget);
    setW(v);
    save(v);
  };
  const handle = (
    <div
      className={`sresize ${drag ? 'drag' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={w}
      aria-label={t('split.resize')}
      title={t('split.resize')}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onDoubleClick={() => (setW(def), save(def))}
    />
  );
  return { style: { '--side-w': `${w}px` } as CSSProperties, handle };
}
