/** C7 rút gọn GIỮA: giữ đầu (gốc) và đuôi (thư mục đang ở). */
export const midTrunc = (s: string, n: number) => (s.length <= n ? s : s.slice(0, Math.ceil((n - 1) / 2)) + '…' + s.slice(s.length - Math.floor((n - 1) / 2)));
