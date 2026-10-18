import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { apiUrl } from '../utils/api.js';
import { useServerStore } from './serverStore.js';
import { useProjectStore } from './projectStore.js';
import type {
  ClaudeToolCall,
  ClaudeMessage,
  ClaudeLimits,
  ClaudeProjectSessionSummary,
  ClaudeSession,
} from '@hugremote/shared';

export type {
  ClaudeToolCall,
  ClaudeMessage,
  ClaudeLimits,
  ClaudeProjectSessionSummary,
  ClaudeSession,
};

export const useClaudeStore = defineStore('claude', () => {
  const SAVED_SESSION_KEY_PREFIX = 'hugremote_active_claude_session_';

  function getStoredActiveSessionId(sId: string, pId?: string): string {
    if (typeof localStorage === 'undefined') return '';
    if (pId) {
      const perProject = localStorage.getItem(`${SAVED_SESSION_KEY_PREFIX}${sId}_${pId}`);
      if (perProject) return perProject;
    }
    return localStorage.getItem(`${SAVED_SESSION_KEY_PREFIX}${sId}`) || '';
  }

  function storeActiveSessionId(id: string, sId: string, pId?: string) {
    if (typeof localStorage === 'undefined' || !id) return;
    if (pId) {
      localStorage.setItem(`${SAVED_SESSION_KEY_PREFIX}${sId}_${pId}`, id);
    }
    localStorage.setItem(`${SAVED_SESSION_KEY_PREFIX}${sId}`, id);
  }

  const sessions = ref<ClaudeSession[]>([]);
  const activeSessionId = ref<string>('');
  const isGenerating = ref<boolean>(false);
  const isReconnecting = ref<boolean>(false);
  const compactTaskMode = ref<boolean>(localStorage.getItem('hugcode_claude_compact_task_mode') === 'true');
  const isLimitsPopupOpen = ref<boolean>(false);
  const limits = ref<ClaudeLimits>({
    fiveHour: { usedPercent: 1, resetIn: '3h 35m' },
    weekly: { usedPercent: 94, resetIn: '20h 35m' },
  });
  const serverStore = useServerStore();
  const projectStore = useProjectStore();

  const currentProjectRoot = computed(() => {
    return projectStore.currentProject?.rootPath || serverStore.currentServer.workspace || '~';
  });

  const currentProjectId = computed(() => {
    return projectStore.currentProject?.id || '';
  });

  const currentServerSessions = computed(() => {
    const sId = serverStore.currentServer.id;
    const pId = currentProjectId.value;
    const pRoot = currentProjectRoot.value;
    const normPRoot = pRoot.replace(/\/+$/, '');

    return sessions.value.filter((s) => {
      if (s.serverId !== sId) return false;
      if (pId && s.projectId && s.projectId === pId) return true;
      if (s.cwd && normPRoot && (s.cwd === normPRoot || s.cwd.replace(/\/+$/, '') === normPRoot)) {
        return true;
      }
      if (!pId && !normPRoot) return true;
      return false;
    });
  });

  const activeSession = computed(() => {
    const list = currentServerSessions.value;
    if (!list.length) return null;
    return list.find((s) => s.id === activeSessionId.value) || list[0] || null;
  });

  async function fetchSessions(serverId?: string) {
    const sId = serverId || serverStore.currentServer.id;
    try {
      const projectId = currentProjectId.value;
      const defaultCwd = currentProjectRoot.value;
      const q = new URLSearchParams({
        serverId: sId,
        projectId,
        defaultCwd,
      });
      const res = await fetch(apiUrl(`/api/claude/sessions?${q.toString()}`));
      if (!res.ok) throw new Error('Failed to load claude sessions');
      const data = await res.json();
      if (Array.isArray(data.sessions)) {
        const normPRoot = defaultCwd.replace(/\/+$/, '');
        const others = sessions.value.filter((s) => {
          if (s.serverId !== sId) return true;
          if (projectId && s.projectId === projectId) return false;
          if (s.cwd && normPRoot && s.cwd.replace(/\/+$/, '') === normPRoot) return false;
          return true;
        });
        sessions.value = [...others, ...data.sessions];
        const currentList = currentServerSessions.value;
        if (currentList.length > 0) {
          const storedId = getStoredActiveSessionId(sId, projectId);
          if (storedId && currentList.some((s: ClaudeSession) => s.id === storedId)) {
            activeSessionId.value = storedId;
          } else if (!activeSessionId.value || !currentList.some((s: ClaudeSession) => s.id === activeSessionId.value)) {
            activeSessionId.value = currentList[0].id;
            storeActiveSessionId(currentList[0].id, sId, projectId);
          }
        }

        // Auto-attach if active session is currently running in background on server
        const curActive = activeSession.value;
        if (curActive && curActive.isRunning && !isGenerating.value) {
          const lastMsg = curActive.messages[curActive.messages.length - 1];
          if (lastMsg && lastMsg.sender === 'assistant' && lastMsg.isWorking) {
            isGenerating.value = true;
            reconnectToBackgroundStream(curActive.id, lastMsg);
          }
        } else if (curActive && !curActive.isRunning && isGenerating.value) {
          // Task completed on server while user was away / in another app
          isGenerating.value = false;
          isReconnecting.value = false;
          const lastMsg = curActive.messages[curActive.messages.length - 1];
          if (lastMsg && lastMsg.sender === 'assistant') {
            lastMsg.isWorking = false;
            lastMsg.isThinking = false;
          }
        }
      }
    } catch (err) {
      console.error('fetchClaudeSessions error:', err);
    }
  }

  async function ensureProjectSession() {
    await fetchSessions();
    if (!currentServerSessions.value.length) {
      const pName = projectStore.currentProject?.name;
      const defaultName = (!pName || pName === '~') ? 'chat' : pName;
      await createSession(defaultName, currentProjectRoot.value);
    } else {
      const storedId = getStoredActiveSessionId(serverStore.currentServer.id, currentProjectId.value);
      if (storedId && currentServerSessions.value.some((s) => s.id === storedId)) {
        activeSessionId.value = storedId;
      }
    }
  }

  function switchSession(id: string) {
    activeSessionId.value = id;
    storeActiveSessionId(id, serverStore.currentServer.id, currentProjectId.value);
  }

  async function createSession(
    name?: string,
    cwd?: string,
    model?: string,
    mode?: string,
    initialPrompt?: string,
    bypassPermissions = false
  ) {
    const sId = serverStore.currentServer.id;
    const body = {
      serverId: sId,
      name: name || 'chat',
      projectId: projectStore.currentProject?.id || '',
      cwd: cwd || projectStore.currentProject?.rootPath || serverStore.currentServer.workspace || '~',
      model: model || 'Default Medium',
      mode: mode || 'Auto',
      initialPrompt,
      bypassPermissions,
    };
    try {
      const res = await fetch(apiUrl('/api/claude/sessions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.session) {
        sessions.value.unshift(data.session);
        activeSessionId.value = data.session.id;
        storeActiveSessionId(data.session.id, sId, currentProjectId.value);
        return data.session;
      }
    } catch (err) {
      console.error('createClaudeSession error:', err);
    }
  }

  async function updateSession(id: string, updates: Partial<ClaudeSession>) {
    // Optimistic local update
    const idx = sessions.value.findIndex((s) => s.id === id);
    if (idx !== -1) {
      Object.assign(sessions.value[idx], updates);
    }
    try {
      const res = await fetch(apiUrl(`/api/claude/sessions/${encodeURIComponent(id)}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.session && idx !== -1) {
        sessions.value[idx] = data.session;
        return data.session;
      }
    } catch (err) {
      console.error('updateClaudeSession error:', err);
    }
  }

  async function deleteSession(id: string) {
    try {
      const res = await fetch(apiUrl(`/api/claude/sessions/${encodeURIComponent(id)}`), {
        method: 'DELETE',
      });
      if (res.ok) {
        sessions.value = sessions.value.filter((s) => s.id !== id);
        const remaining = currentServerSessions.value;
        if (activeSessionId.value === id && remaining.length > 0) {
          activeSessionId.value = remaining[0].id;
          storeActiveSessionId(remaining[0].id, serverStore.currentServer.id, currentProjectId.value);
        }
      }
    } catch (err) {
      console.error('deleteClaudeSession error:', err);
    }
  }

  function toggleCompactTaskMode() {
    compactTaskMode.value = !compactTaskMode.value;
    localStorage.setItem('hugcode_claude_compact_task_mode', compactTaskMode.value ? 'true' : 'false');
  }

  function applyStreamEvent(event: any, reactiveMsg: ClaudeMessage, session: ClaudeSession) {
    switch (event.type) {
      case 'sync':
        if (event.liveMessage) {
          reactiveMsg.id = event.liveMessage.id || reactiveMsg.id;
          if (event.liveMessage.text) reactiveMsg.text = event.liveMessage.text;
          if (event.liveMessage.thinking) reactiveMsg.thinking = event.liveMessage.thinking;
          reactiveMsg.isThinking = Boolean(event.liveMessage.isThinking);
          reactiveMsg.isWorking = event.liveMessage.isWorking !== false;
          if (Array.isArray(event.liveMessage.tools)) {
            reactiveMsg.tools = event.liveMessage.tools;
          }
        }
        if (event.status === 'done' || event.status === 'cancelled') {
          reactiveMsg.isThinking = false;
          reactiveMsg.isWorking = false;
          isGenerating.value = false;
        }
        if (event.contextTokens) session.contextTokens = event.contextTokens;
        break;
      case 'thinking_start':
        reactiveMsg.isThinking = true;
        reactiveMsg.isThinkingExpanded = true;
        break;
      case 'thinking':
        reactiveMsg.isThinking = true;
        reactiveMsg.thinking = (reactiveMsg.thinking || '') + (event.text || '');
        break;
      case 'tool_use':
        reactiveMsg.isThinking = false;
        reactiveMsg.tools = reactiveMsg.tools || [];
        reactiveMsg.tools.push({
          ...event.tool,
          isExpanded: event.tool?.type === 'bash' ? false : undefined,
        });
        break;
      case 'tool_result': {
        reactiveMsg.tools = reactiveMsg.tools || [];
        const tool = reactiveMsg.tools.find((t) => t.id === event.tool_use_id);
        if (tool) {
          tool.output = event.output;
          tool.status = event.status || 'done';
        }
        break;
      }
      case 'text_delta':
        reactiveMsg.isThinking = false;
        reactiveMsg.text = (reactiveMsg.text || '') + (event.text || '');
        break;
      case 'done':
        reactiveMsg.isThinking = false;
        reactiveMsg.isWorking = false;
        reactiveMsg.tools?.forEach((tool) => {
          if (!tool.status || tool.status === 'running') tool.status = 'error';
        });
        if (event.text) reactiveMsg.text = event.text;
        if (event.contextTokens) session.contextTokens = event.contextTokens;
        break;
      case 'finish':
        reactiveMsg.isThinking = false;
        reactiveMsg.isWorking = false;
        if (event.assistantMessage) {
          reactiveMsg.id = event.assistantMessage.id || reactiveMsg.id;
          reactiveMsg.text = event.assistantMessage.text || reactiveMsg.text;
          reactiveMsg.thinking = event.assistantMessage.thinking || reactiveMsg.thinking;
          reactiveMsg.tools = event.assistantMessage.tools || reactiveMsg.tools;
        }
        reactiveMsg.tools?.forEach((tool) => {
          if (!tool.status || tool.status === 'running') tool.status = 'error';
        });
        if (event.contextTokens) session.contextTokens = event.contextTokens;
        break;
      case 'error':
        reactiveMsg.isThinking = false;
        reactiveMsg.isWorking = false;
        reactiveMsg.tools?.forEach((tool) => {
          if (!tool.status || tool.status === 'running') tool.status = 'error';
        });
        reactiveMsg.text = event.error || 'Lỗi từ Claude Agent.';
        break;
    }
  }

  async function reconnectToBackgroundStream(sessionId: string, reactiveMsg: ClaudeMessage, maxRetries = 15) {
    const session = sessions.value.find((s) => s.id === sessionId);
    if (!session) return;
    isReconnecting.value = true;

    let retryCount = 0;
    while (retryCount < maxRetries && isGenerating.value) {
      try {
        const streamUrl = apiUrl(`/api/claude/sessions/${encodeURIComponent(sessionId)}/stream`);
        const res = await fetch(streamUrl);
        if (!res.ok || !res.body) {
          throw new Error(`Reconnection status ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let completed = false;

        // Connected to stream!
        isReconnecting.value = false;

        while (!completed) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() || '';

          for (const block of blocks) {
            const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
            if (!dataLine) continue;
            const raw = dataLine.slice(6).trim();
            if (!raw) continue;
            if (raw === '[DONE]') {
              completed = true;
              break;
            }
            try {
              const event = JSON.parse(raw);
              applyStreamEvent(event, reactiveMsg, session);
              if (event.type === 'finish' || event.type === 'done' || event.type === 'error') {
                completed = true;
              }
            } catch (_) {}
          }
        }

        if (completed) {
          isGenerating.value = false;
          reactiveMsg.isWorking = false;
          reactiveMsg.isThinking = false;
          await fetchSessions(session.serverId);
          return;
        }
      } catch (err) {
        retryCount++;
        isReconnecting.value = true;
        const delay = Math.min(5000, 1000 + retryCount * 800);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    isReconnecting.value = false;
    isGenerating.value = false;
    reactiveMsg.isWorking = false;
    reactiveMsg.isThinking = false;
    await fetchSessions(session.serverId);
  }

  async function sendMessage(prompt: string) {
    if (!prompt.trim() || isGenerating.value) return;

    let session = activeSession.value;
    if (!session) {
      session = await createSession();
    }
    if (!session) return;

    isGenerating.value = true;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Optimistically push user message
    const tempUserMsg: ClaudeMessage = {
      id: `temp-${Date.now()}`,
      sender: 'user',
      text: prompt.trim(),
      time: timeStr,
    };
    session.messages.push(tempUserMsg);

    // Create a live assistant message immediately so thinking/tools can appear in-place
    const liveAsstMsg: ClaudeMessage = {
      id: `live-${Date.now()}`,
      sender: 'assistant',
      text: '',
      thinking: '',
      isThinking: true,
      isWorking: true,
      isThinkingExpanded: true,
      tools: [],
      time: timeStr,
    };
    session.messages.push(liveAsstMsg);
    // Vue 3 wraps the pushed object into a NEW reactive proxy; grab that proxy
    // back and mutate it instead of the original object so UI updates fire.
    const reactiveMsg = session.messages[session.messages.length - 1] as ClaudeMessage;

    try {
      const res = await fetch(apiUrl(`/api/claude/sessions/${encodeURIComponent(session.id)}/messages/stream`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Claude stream request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completed = false;

      while (!completed) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
          if (!dataLine) continue;
          const raw = dataLine.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;

          let event: any;
          try {
            event = JSON.parse(raw);
          } catch (_) {
            continue;
          }

          applyStreamEvent(event, reactiveMsg, session);
          if (event.type === 'finish' || event.type === 'done' || event.type === 'error') {
            completed = true;
          }
        }
      }

      if (completed) {
        isGenerating.value = false;
        await fetchSessions(session.serverId);
        return;
      }
    } catch (err) {
      console.warn('sendClaudeMessage stream disconnected. Attempting resilient reconnection...', err);
      // Background execution continues on server, reconnect to background stream!
      await reconnectToBackgroundStream(session.id, reactiveMsg);
    } finally {
      if (!isReconnecting.value) {
        isGenerating.value = false;
      }
    }
  }

  async function cancelGeneration() {
    const session = activeSession.value;
    if (!session || !isGenerating.value) return false;

    // Stop every local activity indicator immediately; the stream's done/finish
    // event will reconcile the canonical persisted message afterwards.
    const workingMessage = [...session.messages]
      .reverse()
      .find((message) => message.sender === 'assistant' && message.isWorking);
    if (workingMessage) {
      workingMessage.isThinking = false;
      workingMessage.isWorking = false;
      workingMessage.tools?.forEach((tool) => {
        if (!tool.status || tool.status === 'running') tool.status = 'error';
      });
    }

    try {
      const res = await fetch(apiUrl(`/api/claude/sessions/${encodeURIComponent(session.id)}/cancel`), {
        method: 'POST',
      });
      return res.ok;
    } catch (err) {
      console.error('cancelClaudeGeneration error:', err);
      return false;
    }
  }

  async function clearMessages(sessionId?: string) {
    const targetId = sessionId || activeSession.value?.id;
    if (!targetId) return;

    // Immediately clear in-memory state for instant UI response
    const session = sessions.value.find((s) => s.id === targetId);
    if (session) {
      session.messages = [];
      session.contextTokens = '0';
      session.updatedAt = Date.now();
    }

    try {
      const res = await fetch(apiUrl(`/api/claude/sessions/${encodeURIComponent(targetId)}/clear`), {
        method: 'POST',
      });
      const data = await res.json();
      if (data.session) {
        const idx = sessions.value.findIndex((s) => s.id === targetId);
        if (idx !== -1) {
          sessions.value[idx] = data.session;
        }
      }
    } catch (err) {
      console.error('clearClaudeMessages error:', err);
    }
  }

  async function fetchLimits() {
    try {
      const res = await fetch(apiUrl('/api/claude/limits'));
      if (!res.ok) return;
      const data = await res.json();
      if (data.limits) {
        limits.value = data.limits;
      }
    } catch (err) {
      console.error('fetchLimits error:', err);
    }
  }

  async function updateLimits(payload: {
    rawText?: string;
    fiveHour?: { usedPercent?: number; resetIn?: string };
    weekly?: { usedPercent?: number; resetIn?: string };
  }) {
    try {
      const res = await fetch(apiUrl('/api/claude/limits'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.limits) {
        limits.value = data.limits;
      }
      return true;
    } catch (err) {
      console.error('updateLimits error:', err);
      return false;
    }
  }

  const defaultFallbackModels = [
    {
      id: 'default',
      title: 'Default (recommended)',
      desc: 'Claude Code default model · Uses your active CLI configuration',
      prefix: 'Default',
    },
    {
      id: 'sonnet',
      title: 'Sonnet',
      desc: 'Sonnet · Standard model for daily coding & agentic tasks',
      prefix: 'Sonnet',
    },
    {
      id: 'opus',
      title: 'Opus',
      desc: 'Opus · Frontier model for complex reasoning and architecture',
      prefix: 'Opus',
    },
    {
      id: 'haiku',
      title: 'Haiku',
      desc: 'Haiku · Fastest model for lightweight queries & quick answers',
      prefix: 'Haiku',
    },
  ];

  const modelsByServer = ref<Record<string, Array<{ id: string; title: string; desc: string; prefix: string }>>>({});
  const modelSourceByServer = ref<Record<string, string>>({});
  const defaultModelByServer = ref<Record<string, string>>({});
  const isLoadingModels = ref(false);

  const availableModels = computed(() => {
    const sId = serverStore.currentServerId || 'server-local';
    return modelsByServer.value[sId] || defaultFallbackModels;
  });

  async function fetchModels(serverId?: string): Promise<{
    source: string;
    defaultModel: string;
    models: Array<{ id: string; title: string; desc: string; prefix: string }>;
  }> {
    const sId = serverId || serverStore.currentServerId || 'server-local';
    try {
      isLoadingModels.value = true;
      const res = await fetch(apiUrl(`/api/claude/models?serverId=${encodeURIComponent(sId)}`));
      if (!res.ok) throw new Error('Failed to fetch models');
      const data = await res.json();
      if (data && Array.isArray(data.models)) {
        modelsByServer.value[sId] = data.models;
        modelSourceByServer.value[sId] = data.source || 'fallback';
        defaultModelByServer.value[sId] = data.defaultModel || 'default';
      }
      return data;
    } catch (err) {
      console.error('fetchModels error:', err);
      const fallback = {
        source: 'fallback',
        defaultModel: 'Sonnet 5.5',
        models: defaultFallbackModels,
      };
      modelsByServer.value[sId] = fallback.models;
      modelSourceByServer.value[sId] = fallback.source;
      defaultModelByServer.value[sId] = fallback.defaultModel;
      return fallback;
    } finally {
      isLoadingModels.value = false;
    }
  }

  const projectSessions = ref<ClaudeProjectSessionSummary[]>([]);
  const isLoadingProjectSessions = ref(false);

  async function fetchProjectSessions(cwd?: string, serverId?: string) {
    const sId = serverId || serverStore.currentServer.id;
    const targetCwd = cwd || activeSession.value?.cwd || '';
    isLoadingProjectSessions.value = true;
    try {
      const q = new URLSearchParams({
        cwd: targetCwd,
        serverId: sId,
      });
      const res = await fetch(apiUrl(`/api/claude/project-sessions?${q.toString()}`));
      if (!res.ok) return [];
      const data = await res.json();
      if (data.sessions) {
        projectSessions.value = data.sessions;
        return data.sessions as ClaudeProjectSessionSummary[];
      }
      return [];
    } catch (err) {
      console.error('fetchProjectSessions error:', err);
      return [];
    } finally {
      isLoadingProjectSessions.value = false;
    }
  }

  async function resumeProjectSession(
    cliSessionId: string,
    cwd?: string,
    targetSessionId?: string,
    serverId?: string
  ) {
    const sId = serverId || serverStore.currentServer.id;
    const targetCwd = cwd || activeSession.value?.cwd || '';
    const tSessionId = targetSessionId || activeSession.value?.id || '';

    try {
      const res = await fetch(
        apiUrl(`/api/claude/project-sessions/${encodeURIComponent(cliSessionId)}/resume`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cwd: targetCwd,
            targetSessionId: tSessionId,
            serverId: sId,
            projectId: currentProjectId.value,
          }),
        }
      );
      const data = await res.json();
      if (data.session) {
        const cliSess = projectSessions.value.find((p) => p.id === cliSessionId);
        if (cliSess?.summary && cliSess.summary !== 'Phiên chưa đặt tên') {
          data.session.name = cliSess.summary;
          data.session.isCustomNamed = true;
        }
        const idx = sessions.value.findIndex((s) => s.id === data.session.id);
        if (idx !== -1) {
          sessions.value[idx] = data.session;
        } else {
          sessions.value.unshift(data.session);
        }
        activeSessionId.value = data.session.id;
        storeActiveSessionId(data.session.id, sId, currentProjectId.value);
        return data.session as ClaudeSession;
      }
      return null;
    } catch (err) {
      console.error('resumeProjectSession error:', err);
      return null;
    }
  }

  async function renameProjectSession(
    cliSessionId: string,
    newName: string,
    cwd?: string,
    serverId?: string
  ): Promise<boolean> {
    const sId = serverId || serverStore.currentServer.id;
    const targetCwd = cwd || activeSession.value?.cwd || '';

    try {
      const res = await fetch(
        apiUrl(`/api/claude/project-sessions/${encodeURIComponent(cliSessionId)}`),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newName,
            cwd: targetCwd,
            serverId: sId,
          }),
        }
      );
      if (!res.ok) return false;
      const data = await res.json();
      if (data.success) {
        const item = projectSessions.value.find((s) => s.id === cliSessionId);
        if (item) {
          item.summary = newName;
        }
        for (const s of sessions.value) {
          if (s.cliSessionId === cliSessionId) {
            s.name = newName;
            s.isCustomNamed = true;
          }
        }
        if (activeSession.value?.cliSessionId === cliSessionId) {
          activeSession.value.name = newName;
          activeSession.value.isCustomNamed = true;
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('renameProjectSession error:', err);
      return false;
    }
  }

  async function deleteProjectSession(
    cliSessionId: string,
    cwd?: string,
    serverId?: string
  ): Promise<boolean> {
    const sId = serverId || serverStore.currentServer.id;
    const targetCwd = cwd || activeSession.value?.cwd || '';

    try {
      const q = new URLSearchParams({
        cwd: targetCwd,
        serverId: sId,
      });
      const res = await fetch(
        apiUrl(`/api/claude/project-sessions/${encodeURIComponent(cliSessionId)}?${q.toString()}`),
        {
          method: 'DELETE',
        }
      );
      if (!res.ok) return false;
      const data = await res.json();
      if (data.success) {
        projectSessions.value = projectSessions.value.filter((s) => s.id !== cliSessionId);
        for (const s of sessions.value) {
          if (s.cliSessionId === cliSessionId) {
            s.cliSessionId = undefined;
          }
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('deleteProjectSession error:', err);
      return false;
    }
  }

  watch(activeSessionId, (id) => {
    if (id) {
      storeActiveSessionId(id, serverStore.currentServer.id, currentProjectId.value);
    }
  });

  return {
    sessions,
    activeSessionId,
    activeSession,
    currentServerSessions,
    projectSessions,
    isLoadingProjectSessions,
    fetchProjectSessions,
    resumeProjectSession,
    renameProjectSession,
    deleteProjectSession,
    isGenerating,
    isReconnecting,
    compactTaskMode,
    toggleCompactTaskMode,
    isLimitsPopupOpen,
    limits,
    fetchSessions,
    ensureProjectSession,
    switchSession,
    createSession,
    updateSession,
    deleteSession,
    sendMessage,
    cancelGeneration,
    clearMessages,
    clearSession: clearMessages,
    fetchLimits,
    updateLimits,
    modelsByServer,
    modelSourceByServer,
    defaultModelByServer,
    availableModels,
    isLoadingModels,
    fetchModels,
  };
});
