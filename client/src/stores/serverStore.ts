import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiUrl } from '../utils/api.js';

export interface ServerItem {
  id: string;
  name: string;
  type: 'local' | 'ssh';
  label: string;
  host: string;
  user: string;
  port: number;
  authType?: 'key' | 'password';
  key?: string;
  password?: string;
  desc?: string;
  workspace?: string;
  isConnected?: boolean;
}

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
  const currentServerId = ref<string>('server-local');

  const currentServer = computed(() => {
    return servers.value.find((s) => s.id === currentServerId.value) || servers.value[0];
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
    }
  }

  function selectServer(id: string) {
    currentServerId.value = id;
    const s = servers.value.find((x) => x.id === id);
    if (s) s.isConnected = true;
  }

  return {
    servers,
    availableKeys,
    currentServerId,
    currentServer,
    connectedCount,
    fetchServers,
    fetchAvailableKeys,
    addServer,
    updateServerWorkspace,
    disconnectServer,
    selectServer,
  };
});
