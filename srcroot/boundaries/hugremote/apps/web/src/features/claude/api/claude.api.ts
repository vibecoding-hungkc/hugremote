import { api } from '../../../lib/api-client';
import type { S } from '../../../types/schemas';

export type ClaudeSession = S['ClaudeSessionDto'];
export type QueueItem = S['QueueItemDto'];

export const claudeApi = {
  all: () => api<ClaudeSession[]>('/claude/sessions'),
  cliSessions: (projectId: string) => api<S['CliSessionDto'][]>(`/projects/${projectId}/claude/cli-sessions`),
  create: (projectId: string, b: S['CreateClaudeSessionDto']) => api<ClaudeSession>(`/projects/${projectId}/claude/sessions`, { body: b }),
  patch: (id: string, b: S['PatchClaudeDto']) => api<ClaudeSession>(`/claude/sessions/${id}`, { method: 'PATCH', body: b }),
  remove: (id: string) => api<void>(`/claude/sessions/${id}`, { method: 'DELETE' }),
  send: (id: string, text: string, attachments?: string[]) => api<S['SendResultDto']>(`/claude/sessions/${id}/messages`, { body: { text, attachments } }),
  unqueue: (id: string, qid: string) => api<void>(`/claude/sessions/${id}/queue/${qid}`, { method: 'DELETE' }),
  resumeQueue: (id: string) => api<void>(`/claude/sessions/${id}/queue/resume`, { method: 'POST' }),
  cancel: (id: string) => api<void>(`/claude/sessions/${id}/cancel`, { method: 'POST' }),
  answer: (id: string, iid: string, decision: 'allow' | 'deny' | 'always') =>
    api<void>(`/claude/sessions/${id}/interactions/${iid}`, { body: { decision } }),
  options: (projectId: string) => api<S['ClaudeOptionsDto']>(`/projects/${projectId}/claude/options`),
  limits: (projectId: string) => api<S['ClaudeLimitsDto']>(`/projects/${projectId}/claude/limits`),
  ticket: () => api<{ ticket: string }>('/auth/stream-ticket', { method: 'POST' }),
};
