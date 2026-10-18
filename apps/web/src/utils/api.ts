// Dynamic Base Path Resolver
// Reads BASE_PATH injected by server (via BASE_PATH environment variable).
// Defaults to empty string when not set.

export function getBasePath(): string {
  if (typeof window !== 'undefined' && typeof (window as any).__BASE_PATH__ === 'string') {
    return (window as any).__BASE_PATH__;
  }
  return '';
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
