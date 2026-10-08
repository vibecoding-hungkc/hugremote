import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiUrl } from '../utils/api.js';
import { useServerStore } from './serverStore.js';

export interface ClaudeToolCall {
  id?: string;
  type: 'read' | 'edit' | 'bash';
  title: string;
  status?: 'running' | 'done' | 'error';
  isExpanded?: boolean;
  content?: string;
  diff?: string[];
  output?: string;
}

export interface ClaudeMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  thinking?: string;
  isThinking?: boolean;
  isWorking?: boolean;
  isThinkingExpanded?: boolean;
  tools?: ClaudeToolCall[];
}

export interface ClaudeLimits {
  fiveHour: {
    usedPercent: number;
    resetIn: string;
  };
  weekly: {
    usedPercent: number;
    resetIn: string;
  };
}

export interface ClaudeSession {
  id: string;
  serverId: string;
  name: string;
  cwd: string;
  isCustomNamed: boolean;
  model: string;
  mode: string;
  bypassPermissions?: boolean;
  timer: string;
  contextTokens: string;
  messages: ClaudeMessage[];
  updatedAt: number;
}

export const useClaudeStore = defineStore('claude', () => {
  const sessions = ref<ClaudeSession[]>([]);
  const activeSessionId = ref<string>('');
  const isGenerating = ref<boolean>(false);
  const compactTaskMode = ref<boolean>(localStorage.getItem('hugcode_claude_compact_task_mode') === 'true');
  const isLimitsPopupOpen = ref<boolean>(false);
  const limits = ref<ClaudeLimits>({
    fiveHour: { usedPercent: 1, resetIn: '3h 35m' },
    weekly: { usedPercent: 94, resetIn: '20h 35m' },
  });
  const serverStore = useServerStore();

  const currentServerSessions = computed(() => {
    return sessions.value.filter((s) => s.serverId === serverStore.currentServer.id);
  });

  const activeSession = computed(() => {
    const list = currentServerSessions.value;
    if (!list.length) return null;
    return list.find((s) => s.id === activeSessionId.value) || list[0] || null;
  });

  async function fetchSessions(serverId?: string) {
    const sId = serverId || serverStore.currentServer.id;
    try {
      const defaultCwd = serverStore.currentServer.workspace || '~/projects/hugcode';
      const res = await fetch(apiUrl(`/api/claude/sessions?serverId=${encodeURIComponent(sId)}&defaultCwd=${encodeURIComponent(defaultCwd)}`));
      if (!res.ok) throw new Error('Failed to load claude sessions');
      const data = await res.json();
      if (Array.isArray(data.sessions)) {
        // Merge or replace for this server
        const others = sessions.value.filter((s) => s.serverId !== sId);
        sessions.value = [...others, ...data.sessions];
        if (data.sessions.length > 0 && (!activeSessionId.value || !data.sessions.some((s: ClaudeSession) => s.id === activeSessionId.value))) {
          activeSessionId.value = data.sessions[0].id;
        }
      }
    } catch (err) {
      console.error('fetchClaudeSessions error:', err);
    }
  }

  function switchSession(id: string) {
    activeSessionId.value = id;
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
      cwd: cwd || serverStore.currentServer.workspace || '~/projects/hugcode',
      model: model || 'Sonnet 5.5 Medium',
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

      while (true) {
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

          switch (event.type) {
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
      }

      // Refresh canonical session after stream persistence completes
      await fetchSessions(session.serverId);
    } catch (err) {
      console.error('sendClaudeMessage stream error:', err);
      reactiveMsg.isThinking = false;
      reactiveMsg.isWorking = false;
      reactiveMsg.tools?.forEach((tool) => {
        if (!tool.status || tool.status === 'running') tool.status = 'error';
      });
      reactiveMsg.text = 'Lỗi kết nối tới Claude Agent. Vui lòng thử lại.';
    } finally {
      isGenerating.value = false;
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

  async function clearMessages() {
    const session = activeSession.value;
    if (!session) return;
    try {
      const res = await fetch(apiUrl(`/api/claude/sessions/${encodeURIComponent(session.id)}/clear`), {
        method: 'POST',
      });
      const data = await res.json();
      if (data.session) {
        const idx = sessions.value.findIndex((s) => s.id === session.id);
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

  return {
    sessions,
    activeSessionId,
    activeSession,
    currentServerSessions,
    isGenerating,
    compactTaskMode,
    toggleCompactTaskMode,
    isLimitsPopupOpen,
    limits,
    fetchSessions,
    switchSession,
    createSession,
    updateSession,
    deleteSession,
    sendMessage,
    cancelGeneration,
    clearMessages,
    fetchLimits,
    updateLimits,
  };
});
