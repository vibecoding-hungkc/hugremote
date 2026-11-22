import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { workspaceApi } from '../api/workspace.api';

export const qk = {
  hosts: ['hosts'] as const,
  pins: ['pins'] as const,
  projects: (h: string) => ['projects', h] as const,
  project: (id: string) => ['project', id] as const,
  terminals: ['terminals'] as const,
};

export const useHosts = () => useQuery({ queryKey: qk.hosts, queryFn: workspaceApi.hosts, staleTime: 15_000 });
export const usePins = () => useQuery({ queryKey: qk.pins, queryFn: workspaceApi.pins });
/** Query con chỉ chạy khi đã có máy (G-11, skill luật 13). */
export const useProjects = (hostId?: string) => useQuery({ queryKey: qk.projects(hostId ?? ''), queryFn: () => workspaceApi.projects(hostId!), enabled: !!hostId });
export const useProject = (id?: string) => useQuery({ queryKey: qk.project(id ?? ''), queryFn: () => workspaceApi.project(id!), enabled: !!id });
export const useTerminals = () => useQuery({ queryKey: qk.terminals, queryFn: workspaceApi.terminals });

/** Dự án của nhiều máy (cây). */
export function useProjectsOf(hostIds: string[]) {
  return useQueries({ queries: hostIds.map((h) => ({ queryKey: qk.projects(h), queryFn: () => workspaceApi.projects(h), staleTime: 30_000 })) });
}

export function useSetPins() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: workspaceApi.setPins,
    onMutate: (ids) => qc.setQueryData(qk.pins, ids),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.pins }),
  });
}
