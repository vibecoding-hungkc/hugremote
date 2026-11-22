import { api } from '../../../lib/api-client';
import type { Browse, HostList, Project, S, Terminal } from '../../../types/schemas';

export const workspaceApi = {
  hosts: () => api<HostList>('/hosts'),
  pins: () => api<string[]>('/workspace/pins'),
  setPins: (hostIds: string[]) => api<string[]>('/workspace/pins', { method: 'PUT', body: { hostIds } }),
  projects: (hostId: string) => api<Project[]>(`/hosts/${encodeURIComponent(hostId)}/projects`),
  project: (id: string) => api<Project>(`/projects/${id}`),
  createProject: (b: S['CreateProjectDto']) => api<Project>('/projects', { body: b }),
  renameProject: (id: string, name: string) => api<Project>(`/projects/${id}`, { method: 'PATCH', body: { name } }),
  removePreview: (id: string) => api<S['DryRunDto']>(`/projects/${id}/remove-preview`),
  removeProject: (id: string) => api<void>(`/projects/${id}`, { method: 'DELETE' }),
  browse: (hostId: string, path?: string) => api<Browse>(`/hosts/${encodeURIComponent(hostId)}/browse`, { query: { path } }),
  mkdir: (hostId: string, path: string) => api<Browse>(`/hosts/${encodeURIComponent(hostId)}/mkdir`, { body: { path } }),
  terminals: () => api<Terminal[]>('/terminals'),
  createTerminal: (projectId: string, b: S['CreateTerminalDto'] = {}) => api<Terminal>(`/projects/${projectId}/terminals`, { body: b }),
  renameTerminal: (id: string, name: string) => api<Terminal>(`/terminals/${id}`, { method: 'PATCH', body: { name } }),
  closeTerminal: (id: string) => api<void>(`/terminals/${id}`, { method: 'DELETE' }),
};
