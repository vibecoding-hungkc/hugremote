import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useServerStore } from './serverStore.js';

export interface TerminalSessionItem {
  id: string;
  name: string;
  serverId: string;
  cwd?: string;
  isCustomNamed?: boolean;
}

export function extractLast3Dirs(pathStr: string): string {
  if (!pathStr) return 'terminal';
  let clean = pathStr.replace(/^[a-zA-Z0-9_\-]+@[^:]+:\s*/, '').trim();
  if (clean.includes(':')) {
    clean = clean.split(':').slice(1).join(':').trim();
  }
  clean = clean.replace(/\s*\([^)]*\)$/, '').replace(/\s*\[[^\]]*\]$/, '').trim();
  const parts = clean.split('/').filter(Boolean);
  if (parts.length >= 3) {
    return parts.slice(-3).join('/');
  } else if (parts.length > 0) {
    return parts.join('/');
  }
  return clean || 'terminal';
}

export const useTerminalStore = defineStore('terminal', () => {
  const serverStore = useServerStore();

  const sessions = ref<TerminalSessionItem[]>([
    {
      id: 'term-local-main',
      name: 'hermes-admin/projects',
      serverId: 'server-local',
      cwd: '/home/hermes-admin/projects',
      isCustomNamed: false,
    },
  ]);

  const activeSessionId = ref('term-local-main');

  const currentServerSessions = computed(() => {
    return sessions.value.filter((s) => s.serverId === serverStore.currentServerId);
  });

  const activeSession = computed(() => {
    return (
      currentServerSessions.value.find((s) => s.id === activeSessionId.value) ||
      currentServerSessions.value[0] ||
      null
    );
  });

  function getDefaultSessionName(targetCwd?: string): string {
    const server = serverStore.currentServer;
    const ws = targetCwd || server.workspace || '';
    return extractLast3Dirs(ws);
  }

  function createSession(options?: { name?: string; cwd?: string; isCustomNamed?: boolean }) {
    const curServerId = serverStore.currentServerId;
    const curServer = serverStore.currentServer;
    const targetCwd = options?.cwd || curServer.workspace || '';
    const hasCustomName = options?.isCustomNamed ?? Boolean(options?.name && options.name.trim());
    const defaultName = getDefaultSessionName(targetCwd);
    const sessionName = options?.name?.trim() || defaultName;

    const newSession: TerminalSessionItem = {
      id: `term-${curServerId}-${Date.now()}`,
      name: sessionName,
      serverId: curServerId,
      cwd: targetCwd,
      isCustomNamed: hasCustomName,
    };
    sessions.value.push(newSession);
    activeSessionId.value = newSession.id;
    return newSession;
  }

  function switchSession(id: string) {
    activeSessionId.value = id;
  }

  function closeSession(id: string) {
    if (currentServerSessions.value.length <= 1) {
      return;
    }
    const idx = sessions.value.findIndex((s) => s.id === id);
    if (idx !== -1) {
      sessions.value.splice(idx, 1);
      const remaining = currentServerSessions.value;
      if (remaining.length > 0) {
        activeSessionId.value = remaining[0].id;
      }
    }
  }

  function updateSession(
    id: string,
    updates: { name?: string; cwd?: string; isCustomNamed?: boolean }
  ) {
    const sess = sessions.value.find((s) => s.id === id);
    if (!sess) return null;

    if (updates.cwd !== undefined) sess.cwd = updates.cwd;
    if (updates.isCustomNamed !== undefined) sess.isCustomNamed = updates.isCustomNamed;
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      sess.name = trimmed || getDefaultSessionName(updates.cwd ?? sess.cwd);
    } else if (updates.isCustomNamed === false) {
      sess.name = getDefaultSessionName(updates.cwd ?? sess.cwd);
    }
    return sess;
  }

  function renameSession(id: string, newName: string, isCustom = false) {
    updateSession(id, { name: newName, isCustomNamed: isCustom || undefined });
  }

  function ensureServerSession() {
    if (currentServerSessions.value.length === 0) {
      createSession();
    } else if (!currentServerSessions.value.some((s) => s.id === activeSessionId.value)) {
      activeSessionId.value = currentServerSessions.value[0].id;
    }
  }

  return {
    sessions,
    activeSessionId,
    currentServerSessions,
    activeSession,
    getDefaultSessionName,
    createSession,
    switchSession,
    closeSession,
    renameSession,
    updateSession,
    ensureServerSession,
  };
});
