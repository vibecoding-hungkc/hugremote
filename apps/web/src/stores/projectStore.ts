import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { apiUrl } from '../utils/api.js';
import { useServerStore } from './serverStore.js';
import type { ProjectItem } from '@hugremote/shared';

export type { ProjectItem };

export const useProjectStore = defineStore('project', () => {
  const serverStore = useServerStore();
  const projects = ref<ProjectItem[]>([]);
  const activeProjectIdByServer = ref<Record<string, string>>({});
  const loading = ref(false);
  const error = ref<string | null>(null);

  const currentServerProjects = computed(() =>
    projects.value.filter((p) => p.serverId === serverStore.currentServerId)
  );

  const currentProject = computed(() => {
    const activeId = activeProjectIdByServer.value[serverStore.currentServerId];
    return currentServerProjects.value.find((p) => p.id === activeId) || currentServerProjects.value[0] || null;
  });

  async function fetchProjects(serverId = serverStore.currentServerId) {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(apiUrl(`/api/projects?serverId=${encodeURIComponent(serverId)}`));
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load projects');
      const data = await res.json();
      const others = projects.value.filter((p) => p.serverId !== serverId);
      projects.value = [...others, ...(data.projects || [])];

      let chosenId = '';
      if (typeof localStorage !== 'undefined') {
        chosenId = localStorage.getItem(`hugremote_active_project_${serverId}`) || '';
      }
      const serverProjects = projects.value.filter((p) => p.serverId === serverId);
      if (!chosenId || !serverProjects.some((p) => p.id === chosenId)) {
        chosenId = data.activeProjectId || serverProjects[0]?.id || '';
      }

      if (chosenId) {
        activeProjectIdByServer.value[serverId] = chosenId;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`hugremote_active_project_${serverId}`, chosenId);
        }
        if (chosenId !== data.activeProjectId) {
          // Sync active project state to backend asynchronously
          fetch(apiUrl(`/api/projects/${encodeURIComponent(chosenId)}/select`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serverId }),
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  async function openProject(rootPath: string, name?: string, serverId = serverStore.currentServerId) {
    const res = await fetch(apiUrl('/api/projects'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId, rootPath, name }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to open project');
    const data = await res.json();
    await fetchProjects(serverId);
    activeProjectIdByServer.value[serverId] = data.project.id;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`hugremote_active_project_${serverId}`, data.project.id);
    }
    return data.project as ProjectItem;
  }

  async function openHomeProject(serverId = serverStore.currentServerId) {
    const res = await fetch(apiUrl('/api/projects/home'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to open home project');
    const data = await res.json();
    await fetchProjects(serverId);
    activeProjectIdByServer.value[serverId] = data.project.id;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`hugremote_active_project_${serverId}`, data.project.id);
    }
    return data.project as ProjectItem;
  }

  async function selectProject(projectId: string, serverId = serverStore.currentServerId) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`hugremote_active_project_${serverId}`, projectId);
    }
    activeProjectIdByServer.value[serverId] = projectId;
    const res = await fetch(apiUrl(`/api/projects/${encodeURIComponent(projectId)}/select`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to select project');
    const data = await res.json();
    activeProjectIdByServer.value[serverId] = data.project.id;
    await fetchProjects(serverId);
    return data.project as ProjectItem;
  }

  async function renameProject(projectId: string, name: string) {
    const res = await fetch(apiUrl(`/api/projects/${encodeURIComponent(projectId)}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to rename project');
    const data = await res.json();
    await fetchProjects(data.project.serverId);
  }

  async function deleteProject(projectId: string) {
    const res = await fetch(apiUrl(`/api/projects/${encodeURIComponent(projectId)}`), { method: 'DELETE' });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete project');
    await fetchProjects(serverStore.currentServerId);
  }

  return {
    projects,
    activeProjectIdByServer,
    currentServerProjects,
    currentProject,
    loading,
    error,
    fetchProjects,
    openProject,
    openHomeProject,
    selectProject,
    renameProject,
    deleteProject,
  };
});
