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

  function projectsForServer(serverId: string): ProjectItem[] {
    return projects.value.filter((p) => p.serverId === serverId);
  }

  const currentProject = computed(() => {
    const activeId = activeProjectIdByServer.value[serverStore.currentServerId];
    return currentServerProjects.value.find((p) => p.id === activeId) || currentServerProjects.value[0] || null;
  });

  async function fetchProjects(serverId = serverStore.currentServerId, preferredProjectId = '') {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(apiUrl(`/api/projects?serverId=${encodeURIComponent(serverId)}`));
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load projects');
      const data = await res.json();
      const others = projects.value.filter((p) => p.serverId !== serverId);
      const nextProjects: ProjectItem[] = [...others, ...(data.projects || [])];

      let chosenId = preferredProjectId;
      if (!chosenId && typeof localStorage !== 'undefined') {
        chosenId = localStorage.getItem(`hugremote_active_project_${serverId}`) || '';
      }
      const serverProjects = nextProjects.filter((p) => p.serverId === serverId);
      if (!chosenId || !serverProjects.some((p) => p.id === chosenId)) {
        chosenId = data.activeProjectId || serverProjects[0]?.id || '';
      }

      projects.value = nextProjects;
      activeProjectIdByServer.value[serverId] = chosenId;
      if (chosenId) {
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
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function openProject(rootPath: string, name?: string, serverId = serverStore.currentServerId) {
    const cleanRoot = (rootPath || '~').trim().replace(/\/+$/, '') || '/';
    // If project already exists in this server's workspace, select it instead of creating duplicate
    const existing = projectsForServer(serverId).find((p) => {
      const pRoot = p.rootPath.trim().replace(/\/+$/, '') || '/';
      if (pRoot === cleanRoot) return true;
      if (cleanRoot === '~' && (p.name === '~' || pRoot === '~')) return true;
      if (cleanRoot.startsWith('~/') && pRoot.endsWith(cleanRoot.slice(2))) return true;
      if (pRoot.startsWith('~/') && cleanRoot.endsWith(pRoot.slice(2))) return true;
      return false;
    });

    if (existing) {
      await selectProject(existing.id, serverId);
      return existing;
    }

    const res = await fetch(apiUrl('/api/projects'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId, rootPath: cleanRoot, name }),
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
    const res = await fetch(apiUrl(`/api/projects/${encodeURIComponent(projectId)}/select`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to select project');
    const data = await res.json();
    await fetchProjects(serverId, data.project.id);
    return data.project as ProjectItem;
  }

  async function updateProject(projectId: string, updates: { name?: string; rootPath?: string }) {
    const res = await fetch(apiUrl(`/api/projects/${encodeURIComponent(projectId)}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to update project');
    const data = await res.json();
    await fetchProjects(data.project.serverId);
    return data.project as ProjectItem;
  }

  async function renameProject(projectId: string, name: string) {
    return updateProject(projectId, { name });
  }

  async function deleteProject(projectId: string, serverId?: string) {
    const target = projects.value.find((p) => p.id === projectId);
    const effServerId = serverId || target?.serverId || serverStore.currentServerId;

    const res = await fetch(apiUrl(`/api/projects/${encodeURIComponent(projectId)}`), { method: 'DELETE' });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete project');
    const data = await res.json().catch(() => ({}));

    if (typeof localStorage !== 'undefined') {
      const savedKey = `hugremote_active_project_${effServerId}`;
      if (localStorage.getItem(savedKey) === projectId) {
        if (data.activeProjectId) {
          localStorage.setItem(savedKey, data.activeProjectId);
        } else {
          localStorage.removeItem(savedKey);
        }
      }
    }

    await fetchProjects(effServerId, data.activeProjectId);
    if (effServerId !== serverStore.currentServerId) {
      await fetchProjects(serverStore.currentServerId);
    }
  }

  return {
    projects,
    activeProjectIdByServer,
    currentServerProjects,
    projectsForServer,
    currentProject,
    loading,
    error,
    fetchProjects,
    openProject,
    openHomeProject,
    selectProject,
    updateProject,
    renameProject,
    deleteProject,
  };
});
