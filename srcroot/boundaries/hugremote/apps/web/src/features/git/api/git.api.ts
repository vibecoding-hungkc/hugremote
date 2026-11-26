import { api } from '../../../lib/api-client';

export interface GitChange {
  path: string;
  oldPath?: string;
  x: string;
  y: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
  added: number;
  deleted: number;
}
export interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  changes: GitChange[];
}
export interface GitCommit {
  sha: string;
  short: string;
  author: string;
  date: string;
  subject: string;
}

export interface GitRepo {
  /** Đường dẫn tương đối trong dự án; `''` = chính thư mục dự án. */
  path: string;
  branch: string | null;
  changes: number;
}

const P = (id: string) => `/projects/${id}/git`;
/** `more` = số repo bị bỏ vì vượt trần 200 (repo sâu bị bỏ trước). */
export const gitRepos = (id: string) => api<{ repos: GitRepo[]; more?: number }>(`${P(id)}/repos`);
/** Mọi lệnh git gắn với một repo trong dự án (repo lồng nhau, tối đa 4 cấp — Authority 2026-11-25). */
export const gitFor = (id: string, repo = '') => {
  const r = repo || undefined;
  return {
    status: () => api<GitStatus>(`${P(id)}/status`, { query: { repo: r } }),
    diff: (path: string, staged: boolean) => api<{ path: string; diff: string }>(`${P(id)}/diff`, { query: { path, staged, repo: r } }),
    fetch: () => api<GitStatus>(`${P(id)}/fetch`, { body: { repo: r } }),
    stage: (paths: string[]) => api<GitStatus>(`${P(id)}/stage`, { body: { paths, repo: r } }),
    unstage: (paths: string[]) => api<GitStatus>(`${P(id)}/unstage`, { body: { paths, repo: r } }),
    discard: (path: string) => api<GitStatus>(`${P(id)}/discard`, { body: { path, repo: r } }),
    commit: (message: string) => api<GitStatus>(`${P(id)}/commit`, { body: { message, repo: r } }),
    pull: () => api<GitStatus>(`${P(id)}/pull`, { body: { repo: r } }),
    push: () => api<GitStatus>(`${P(id)}/push`, { body: { repo: r } }),
    branches: () => api<{ current: string | null; local: string[]; remote: string[] }>(`${P(id)}/branches`, { query: { repo: r } }),
    checkout: (branch: string, create = false) => api<GitStatus>(`${P(id)}/checkout`, { body: { branch, create, repo: r } }),
    commits: (cursor = 0) => api<{ commits: GitCommit[]; next: number | null }>(`${P(id)}/commits`, { query: { cursor, repo: r } }),
    commit1: (sha: string, path?: string) =>
      api<{ sha: string; author: string; date: string; message: string; files: { path: string; added: number; deleted: number }[]; diff?: string }>(`${P(id)}/commit/${sha}`, { query: { path, repo: r } }),
  };
};
