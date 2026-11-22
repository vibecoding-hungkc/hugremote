/** Link sâu khi chưa đăng nhập (AC-48, G-11): lưu hash đích (chỉ `#/…` nội bộ) rồi trả về sau đăng nhập. */
const KEY = 'hugremote:returnTo';

export function saveReturnTo(hash: string) {
  if (/^#\/(?!login)/.test(hash) && !hash.includes('//')) {
    try {
      sessionStorage.setItem(KEY, hash);
    } catch {
      /* chế độ riêng tư */
    }
  }
}

export function takeReturnTo(): string {
  try {
    const h = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return h && /^#\/(?!login)/.test(h) ? h.slice(1) : '/';
  } catch {
    return '/';
  }
}
