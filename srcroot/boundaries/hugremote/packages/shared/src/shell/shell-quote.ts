/** Quote một tham số cho shell POSIX — chỉ dùng khi buộc phải đi qua shell remote (G-5). */
export function shellQuote(arg: string): string {
  if (arg === '') return "''";
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(arg)) return arg;
  return "'" + arg.replace(/'/g, `'\\''`) + "'";
}

/** Nhóm lệnh `cd` an toàn trên máy remote: vào thư mục, không được thì về $HOME (G-4). */
export function remoteCd(dir: string): string {
  const d = dir === '~' ? '"$HOME"' : dir.startsWith('~/') ? '"$HOME"/' + shellQuote(dir.slice(2)) : shellQuote(dir);
  return `{ cd -- ${d} 2>/dev/null || cd "$HOME"; }`;
}
