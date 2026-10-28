// Dynamic Base Path Resolver
// Reads the server-provided meta value so the production shell needs no inline script.
// Defaults to empty string when not set.

export function getBasePath(): string {
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return '';
  const value = document
    .querySelector<HTMLMetaElement>('meta[name="hugremote-base-path"]')
    ?.content;
  return typeof value === 'string' ? value : '';
}

export function apiUrl(endpoint: string): string {
  const base = getBasePath();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
}

export function wsUrl(path: string): string {
  const base = getBasePath();
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${protocol}//${window.location.host}${base}${cleanPath}`;
}
