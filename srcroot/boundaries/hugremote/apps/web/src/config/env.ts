/** Nơi DUY NHẤT đọc cấu hình phía web. Base path do api chèn vào index.html lúc phục vụ (TECHSTACK §1). */
const meta = document.querySelector<HTMLMetaElement>('meta[name="hugremote-base-path"]');

export const env = {
  basePath: (meta?.content ?? '').replace(/\/+$/, ''),
  /** `/api` cùng origin; dev đi qua proxy của Vite. */
  get apiBase() {
    return `${this.basePath}/api`;
  },
  get wsBase() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}${this.basePath}`;
  },
};
