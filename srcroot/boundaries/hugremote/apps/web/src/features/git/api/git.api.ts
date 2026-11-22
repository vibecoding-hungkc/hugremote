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

const P = (id: string) => `/projects/${id}/git`;
export const gitApi = {
  status: (id: string) => api<GitStatus>(`${P(id)}/status`),
  diff: (id: string, path: string, staged: boolean) => api<{ path: string; diff: string }>(`${P(id)}/diff`, { query: { path, staged } }),
  fetch: (id: string) => api<GitStatus>(`${P(id)}/fetch`, { body: {} }),
  stage: (id: string, paths: string[]) => api<GitStatus>(`${P(id)}/stage`, { body: { paths } }),
  unstage: (id: string, paths: string[]) => api<GitStatus>(`${P(id)}/unstage`, { body: { paths } }),
  discard: (id: string, path: string) => api<GitStatus>(`${P(id)}/discard`, { body: { path } }),
  commit: (id: string, message: string) => api<GitStatus>(`${P(id)}/commit`, { body: { message } }),
  pull: (id: string) => api<GitStatus>(`${P(id)}/pull`, { body: {} }),
  push: (id: string) => api<GitStatus>(`${P(id)}/push`, { body: {} }),
  branches: (id: string) => api<{ current: string | null; local: string[]; remote: string[] }>(`${P(id)}/branches`),
  checkout: (id: string, branch: string, create = false) => api<GitStatus>(`${P(id)}/checkout`, { body: { branch, create } }),
  commits: (id: string, cursor = 0) => api<{ commits: GitCommit[]; next: number | null }>(`${P(id)}/commits`, { query: { cursor } }),
  commit1: (id: string, sha: string, path?: string) =>
    api<{ sha: string; author: string; date: string; message: string; files: { path: string; added: number; deleted: number }[]; diff?: string }>(`${P(id)}/commit/${sha}`, { query: { path } }),
};
