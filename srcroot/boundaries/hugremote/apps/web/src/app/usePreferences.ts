import { useEffect } from 'react';
import i18n from '../i18n';
import type { Me } from '../features/auth/api/auth.api';

type Prefs = Me['preferences'];
const KEY = 'hugremote:prefs';

/** Áp chủ đề + ngôn ngữ (AC-27). Lưu thêm bản sao ở trình duyệt để màn đăng nhập (chưa có /me) cũng đúng. */
export function applyPreferences(p: Prefs) {
  const theme = p.theme ?? 'dark';
  if (theme === 'dark') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  const lang = p.locale ?? 'vi';
  document.documentElement.lang = lang;
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
  try {
    localStorage.setItem(KEY, JSON.stringify({ theme, locale: lang }));
  } catch {
    /* chế độ riêng tư */
  }
}

export function applyCachedPreferences() {
  try {
    applyPreferences(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Prefs);
  } catch {
    /* bỏ qua */
  }
}

export function usePreferences(p?: Prefs) {
  useEffect(() => {
    if (p) applyPreferences(p);
  }, [p]);
}
