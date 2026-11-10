import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiUrl } from '../utils/api.js';
import type { ServerItem } from '@hugremote/shared';

export type { ServerItem };

export const useServerStore = defineStore('server', () => {
  const servers = ref<ServerItem[]>([
    {
      id: 'server-local',
      name: 'localhost',
      type: 'local',
      label: 'Máy hiện tại (Local Machine)',
      host: '127.0.0.1',
      user: '',
      port: 22,
      desc: 'Local Host',
      workspace: '',
      isConnected: true,
    },
  ]);

  const availableKeys = ref<string[]>([]);
  const SAVED_SERVER_KEY = 'hugremote_active_server';
  const SAVED_WORKSPACE_SERVERS_KEY = 'hugremote_workspace_servers';
  const currentServerId = ref<string>(
    (typeof localStorage !== 'undefined' && localStorage.getItem(SAVED_SERVER_KEY)) || 'server-local'
  );

  function loadInitialWorkspaceServers(): string[] {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(SAVED_WORKSPACE_SERVERS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const list = parsed.map((id) => String(id)).filter(Boolean);
            if (!list.includes(currentServerId.value)) {
              list.push(currentServerId.value);
            }
            return list;
          }
        }
      }
    } catch {}
    return [currentServerId.value];
  }

  const workspaceServerIds = ref<string[]>(loadInitialWorkspaceServers());

  function saveWorkspaceServers() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SAVED_WORKSPACE_SERVERS_KEY, JSON.stringify(workspaceServerIds.value));
      }
    } catch {}
  }

  const currentServer = computed(() => {
    return servers.value.find((s) => s.id === currentServerId.value) || servers.value[0];
  });

  const workspaceServers = computed<ServerItem[]>(() => {
    const ids = [...workspaceServerIds.value];
    if (currentServerId.value && !ids.includes(currentServerId.value)) {
      ids.push(currentServerId.value);
    }
    const found: ServerItem[] = [];
    for (const id of ids) {
      const srv = servers.value.find((s) => s.id === id);
      if (srv && !found.some((x) => x.id === srv.id)) {
        found.push(srv);
      }
    }
    if (found.length === 0 && servers.value[0]) {
      found.push(servers.value[0]);
    }
    return found;
  });

  const availableServersToAdd = computed<ServerItem[]>(() => {
    const activeSet = new Set(workspaceServers.value.map((s) => s.id));
    return servers.value.filter((s) => !activeSet.has(s.id));
  });

  const connectedCount = computed(() => {
    return servers.value.filter((s) => s.isConnected).length;
  });

  async function fetchServers() {
    try {
      const res = await fetch(apiUrl('/api/servers'));
      if (res.ok) {
        const data = await res.json();
        if (data.servers && Array.isArray(data.servers)) {
          servers.value = data.servers;
          const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(SAVED_SERVER_KEY) : null;
          if (stored && servers.value.some((s) => s.id === stored)) {
            currentServerId.value = stored;
          }
        }
      }
    } catch (err) {
      console.warn('Failed to fetch servers:', err);
    }
  }

  async function fetchAvailableKeys() {
    try {
      const res = await fetch(apiUrl('/api/ssh-keys'));
      if (res.ok) {
        const data = await res.json();
        availableKeys.value = data.keys || [];
      }
    } catch (err) {
      console.warn('Failed to fetch ssh keys:', err);
    }
  }

  async function addServer(newServer: Partial<ServerItem>) {
    const res = await fetch(apiUrl('/api/servers'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newServer),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add server');
    }
    const data = await res.json();
    await fetchServers();
    return data.server;
  }

  async function updateServerWorkspace(serverId: string, workspace: string) {
    const res = await fetch(apiUrl('/api/servers/workspace'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId, workspace }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update workspace');
    }
    const s = servers.value.find((x) => x.id === serverId);
    if (s) {
      s.workspace = workspace;
    }
  }

  async function disconnectServer(id: string) {
    if (id === 'server-local') return;
    await fetch(apiUrl('/api/servers/disconnect'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId: id }),
    });
    const s = servers.value.find((x) => x.id === id);
    if (s) s.isConnected = false;
    if (currentServerId.value === id) {
      currentServerId.value = 'server-local';
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SAVED_SERVER_KEY, 'server-local');
      }
    }
  }

  function selectServer(id: string) {
    currentServerId.value = id;
    if (!workspaceServerIds.value.includes(id)) {
      workspaceServerIds.value = [...workspaceServerIds.value, id];
      saveWorkspaceServers();
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SAVED_SERVER_KEY, id);
    }
    const s = servers.value.find((x) => x.id === id);
    if (s) s.isConnected = true;
  }

  function addServerToWorkspace(id: string) {
    if (!id) return;
    if (!workspaceServerIds.value.includes(id)) {
      workspaceServerIds.value = [...workspaceServerIds.value, id];
      saveWorkspaceServers();
    }
    const s = servers.value.find((x) => x.id === id);
    if (s) s.isConnected = true;
  }

  function removeServerFromWorkspace(id: string) {
    if (workspaceServerIds.value.length <= 1) return;
    workspaceServerIds.value = workspaceServerIds.value.filter((x) => x !== id);
    saveWorkspaceServers();
    if (currentServerId.value === id) {
      const nextId = workspaceServerIds.value[0] || 'server-local';
      selectServer(nextId);
    }
  }

  return {
    servers,
    availableKeys,
    currentServerId,
    currentServer,
    workspaceServerIds,
    workspaceServers,
    availableServersToAdd,
    connectedCount,
    fetchServers,
    fetchAvailableKeys,
    addServer,
    updateServerWorkspace,
    disconnectServer,
    selectServer,
    addServerToWorkspace,
    removeServerFromWorkspace,
  };
});
