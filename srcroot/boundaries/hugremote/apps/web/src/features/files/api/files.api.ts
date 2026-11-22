import { api } from '../../../lib/api-client';

export interface FsEntry {
  name: string;
  path: string;
  type: 'dir' | 'file' | 'link';
  size: number;
  mtime: number;
  hidden: boolean;
  ignored: boolean;
  git?: 'M' | 'A' | 'D' | 'U' | '?';
}
export interface FsRead {
  path: string;
  content: string;
  mtime: number;
  size: number;
  binary: boolean;
  truncated: boolean;
}
export interface SearchHit {
  path: string;
  line: number;
  text: string;
  col: number;
}

const P = (id: string) => `/projects/${id}`;
export const filesApi = {
  list: (id: string, path: string, hidden: boolean) => api<{ path: string; entries: FsEntry[] }>(`${P(id)}/fs`, { query: { path, hidden } }),
  read: (id: string, path: string, tail?: number) => api<FsRead>(`${P(id)}/fs/read`, { query: { path, tail } }),
  write: (id: string, path: string, content: string, baseMtime?: number) => api<{ mtime: number }>(`${P(id)}/fs/file`, { method: 'PUT', body: { path, content, baseMtime } }),
  action: (id: string, op: 'mkdir' | 'touch' | 'rename' | 'copy' | 'delete', path: string, to?: string) => api<{ ok: boolean }>(`${P(id)}/fs/action`, { body: { op, path, to } }),
  upload: (id: string, dir: string, files: { file: File; path: string }[]) => {
    const fd = new FormData();
    fd.append('dir', dir);
    for (const f of files) {
      fd.append('files', f.file);
      fd.append('paths', f.path);
    }
    return api<{ count: number }>(`${P(id)}/fs/upload`, { body: fd });
  },
  download: (id: string, path: string) => api<Response>(`${P(id)}/fs/download`, { query: { path }, raw: true }),
  search: (id: string, q: string, o: { regex?: boolean; case?: boolean; hidden?: boolean }) => api<{ engine: string; truncated: boolean; results: SearchHit[] }>(`${P(id)}/fs/search`, { query: { q, ...o } }),
  files: (id: string) => api<{ files: string[] }>(`${P(id)}/fs/files`),
  raw: (id: string, path: string) => api<Response>(`${P(id)}/fs/raw`, { query: { path }, raw: true }),
  /** Diff/bỏ thay đổi của một file — cùng git-api.v1, gọi từ Files (không import feature git). */
  gitDiff: (id: string, path: string) => api<{ path: string; diff: string }>(`${P(id)}/git/diff`, { query: { path } }),
  gitDiscard: (id: string, path: string) => api<unknown>(`${P(id)}/git/discard`, { body: { path } }),
  lineChanges: (id: string, path: string) => api<{ added: number[]; modified: number[]; tracked: boolean }>(`${P(id)}/fs/line-changes`, { query: { path } }),
};
