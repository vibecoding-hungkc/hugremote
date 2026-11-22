/** C7 rút gọn GIỮA: giữ đầu (gốc) và đuôi (thư mục đang ở). */
export const midTrunc = (s: string, n: number) => (s.length <= n ? s : s.slice(0, Math.ceil((n - 1) / 2)) + '…' + s.slice(s.length - Math.floor((n - 1) / 2)));

/** Đường dẫn tuyệt đối trên máy đích → tương đối với gốc dự án (gốc có thể dạng `~/…`). Ngoài dự án → giữ nguyên. */
export function relToProject(p: string, root: string): string {
  const r = root.replace(/\/+$/, '');
  if (p.startsWith(r + '/')) return p.slice(r.length + 1);
  if (r.startsWith('~/')) {
    const tail = r.slice(1) + '/';
    const i = p.indexOf(tail);
    if (i >= 0) return p.slice(i + tail.length);
  }
  return p;
}
