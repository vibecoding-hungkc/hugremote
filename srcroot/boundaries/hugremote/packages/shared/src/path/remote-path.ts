/**
 * Chuẩn hoá đường dẫn trên máy SSH: giữ dạng `~/…` (không mở rộng bằng home local — G-4),
 * gộp `//`, bỏ `/` cuối, xử `.` và `..` mà không vượt lên trên gốc (`~` hoặc `/`).
 */
export function normalizeRemotePath(input: string): string {
  let p = input.trim();
  if (p === '' || p === '~') return '~';
  const home = p === '~' || p.startsWith('~/');
  if (home) p = p.slice(2);
  else if (!p.startsWith('/')) p = p; // tương đối → tính từ ~
  const parts: string[] = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  if (input.trim().startsWith('/')) return '/' + parts.join('/');
  return parts.length ? '~/' + parts.join('/') : '~';
}

/** `a/b` có nằm trong (hoặc bằng) `root` không — so theo chuỗi đã chuẩn hoá. */
export function isWithin(root: string, target: string): boolean {
  const r = root.endsWith('/') ? root.slice(0, -1) : root;
  return target === r || target.startsWith(r + '/');
}

/** Bỏ dấu tiếng Việt + hạ chữ — dùng cho tìm kiếm không dấu (AC-26). */
export function foldVietnamese(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}
