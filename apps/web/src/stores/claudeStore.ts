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

  type StreamOwner = {
    sessionId: string;
    messageId: string;
    controller: AbortController;
    reconnecting: boolean;
    awaitingSync?: boolean;
  };
  const streams = new Map<string, StreamOwner>();
  const resumes = new Map<string, Promise<void>>();
  let hydrationRequest = 0;

  function updateStreamFlags() {
    const session = activeSession.value;
    const owner = session && streams.get(session.id);
    isGenerating.value = !!owner || !!session?.isRunning;
    isReconnecting.value = !!owner?.reconnecting;
  }

  function releaseStream(owner: StreamOwner) {
    if (streams.get(owner.sessionId) !== owner) return;
    streams.delete(owner.sessionId);
    owner.controller.abort();
    updateStreamFlags();
  }

  function ownStream(session: ClaudeSession, message: ClaudeMessage): StreamOwner {
    const previous = streams.get(session.id);
    if (previous) releaseStream(previous);
    const owner = { sessionId: session.id, messageId: message.id, controller: new AbortController(), reconnecting: false };
    streams.set(session.id, owner);
    updateStreamFlags();
    return owner;
  }

  async function fetchSessions(serverId?: string, attach = true) {
    const request = ++hydrationRequest;
    const ownersAtRequest = new Map(streams);
    const sId = serverId || serverStore.currentServer.id;
    if (!modelsByServer.value[sId]) {
      fetchModels(sId).catch(() => {});
    }
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
      // Late foreground requests must not hydrate a newer context or transport.
      if (request !== hydrationRequest || sId !== serverStore.currentServer.id
        || projectId !== currentProjectId.value || defaultCwd !== currentProjectRoot.value) return;
      if (Array.isArray(data.sessions)) {
        const normPRoot = defaultCwd.replace(/\/+$/, '');
        const others = sessions.value.filter((s) => {
          if (s.serverId !== sId) return true;
          if (projectId && s.projectId === projectId) return false;
          if (s.cwd && normPRoot && s.cwd.replace(/\/+$/, '') === normPRoot) return false;
          return true;
        });
        // Keep Vue identities held by a live reader. A server snapshot may rename
        // the optimistic assistant ID before the POST's first sync reaches us.
        const hydrated = data.sessions.map((incoming: ClaudeSession) => {
          const existing = sessions.value.find((s) => s.id === incoming.id);
          if (!existing) return incoming;
          const owner = streams.get(incoming.id);
          if (owner && ownersAtRequest.get(incoming.id) !== owner) return existing;
          const messages = incoming.messages.map((message) => {
            const previous = existing.messages.find((m) => m.id === message.id)
              || (incoming.isRunning && message.sender === 'assistant' && message.isWorking
                ? existing.messages.find((m) => m.sender === 'assistant' && m.isWorking) : undefined);
            if (previous && owner && incoming.isRunning
              && (previous.id === owner.messageId || previous.isWorking)) {
              // Session-list snapshots have no event cursor. Mixing their text
              // with queued deltas loses or duplicates progress. Only the owned
              // SSE sync/content_sync may replace running content (even shrink it).
              previous.id = message.id;
              owner.messageId = message.id;
              return previous;
            }
            return previous ? Object.assign(previous, message) : message;
          });
          Object.assign(existing, incoming, { messages });
          return existing;
        });
        sessions.value = [...others, ...hydrated];
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

        for (const session of hydrated) {
          if (!session.isRunning) {
            const owner = streams.get(session.id);
            if (owner && ownersAtRequest.get(session.id) === owner) releaseStream(owner);
            session.messages.forEach((message: ClaudeMessage) => {
              message.isWorking = false;
              message.isThinking = false;
            });
          }
        }
        if (attach) attachActiveStream();
        updateStreamFlags();
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
          if (typeof event.liveMessage.text === 'string') reactiveMsg.text = event.liveMessage.text;
          if (typeof event.liveMessage.thinking === 'string') reactiveMsg.thinking = event.liveMessage.thinking;
          reactiveMsg.isThinking = Boolean(event.liveMessage.isThinking);
          reactiveMsg.isWorking = event.liveMessage.isWorking !== false;
          if (Array.isArray(event.liveMessage.tools)) {
            reactiveMsg.tools = event.liveMessage.tools;
          }
        }
        if (['done', 'cancelled', 'error'].includes(event.status)) {
          reactiveMsg.isThinking = false;
          reactiveMsg.isWorking = false;
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
      case 'content_sync':
        reactiveMsg.text = event.text ?? '';
        reactiveMsg.thinking = event.thinking ?? '';
        break;
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
        if (typeof event.text === 'string') reactiveMsg.text = event.text;
        if (event.contextTokens) session.contextTokens = event.contextTokens;
        break;
      case 'finish':
        reactiveMsg.isThinking = false;
        reactiveMsg.isWorking = false;
        if (event.assistantMessage) {
          reactiveMsg.id = event.assistantMessage.id || reactiveMsg.id;
          reactiveMsg.text = event.assistantMessage.text ?? reactiveMsg.text;
          reactiveMsg.thinking = event.assistantMessage.thinking ?? reactiveMsg.thinking;
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

  function attachActiveStream(force = false) {
    const session = activeSession.value;
    if (!session?.isRunning) return;
    const current = streams.get(session.id);
    if (current && (!force || current.awaitingSync)) return;
    const message = [...session.messages].reverse().find((m) => m.sender === 'assistant');
    if (!message) return;
    const owner = ownStream(session, message);
    owner.awaitingSync = true;
    void reconnectToBackgroundStream(owner);
  }

  function resumeActiveStream(force = true): Promise<void> {
    const session = activeSession.value;
    if (!session) return Promise.resolve();
    const pending = resumes.get(session.id);
    if (pending) return pending;
    const id = session.id;
    const promise = (async () => {
      await fetchSessions(session.serverId, false);
      if (activeSession.value?.id === id) attachActiveStream(force);
    })().finally(() => { if (resumes.get(id) === promise) resumes.delete(id); });
    resumes.set(id, promise);
    return promise;
  }

  function streamRow(owner: StreamOwner) {
    const session = sessions.value.find((s) => s.id === owner.sessionId);
    const message = session?.messages.find((m) => m.id === owner.messageId)
      || (session && [...session.messages].reverse().find((m) => m.sender === 'assistant' && m.isWorking));
    return { session, message };
  }

  async function readStream(owner: StreamOwner, response: Response): Promise<boolean> {
    if (!response.ok || !response.body) throw new Error(`Claude stream status ${response.status}`);
    const reader = response.body.getReader();
    const cancel = () => { void reader.cancel().catch(() => {}); };
    owner.controller.signal.addEventListener('abort', cancel, { once: true });
    if (owner.controller.signal.aborted) cancel();
    const decoder = new TextDecoder();
    // The API emits SSE heartbeats while Claude is quiet; missing even those
    // means the mobile transport is half-dead, not that Claude is finished.
    let idleTimer = setTimeout(cancel, 30000);
    let buffer = '';
    let terminal = false;
    try {
      while (!owner.controller.signal.aborted && streams.get(owner.sessionId) === owner) {
        const { value, done } = await reader.read();
        if (done || owner.controller.signal.aborted) break;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(cancel, 30000);
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || '';
        for (const block of blocks) {
          const raw = block.split(/\r?\n/).find((line) => line.startsWith('data:'))?.slice(5).trim();
          if (!raw) continue;
          if (raw === '[DONE]') { terminal = true; return true; }
          let event: any;
          try { event = JSON.parse(raw); } catch { continue; }
          if (streams.get(owner.sessionId) !== owner || owner.controller.signal.aborted) return false;
          const { session, message } = streamRow(owner);
          if (!session || !message) return false;
          owner.awaitingSync = false;
          applyStreamEvent(event, message, session);
          owner.messageId = message.id;
          if (event.type === 'finish' || event.type === 'done' || event.type === 'error'
            || (event.type === 'sync' && ['done', 'cancelled', 'error'].includes(event.status))) { terminal = true; return true; }
        }
      }
      return false;
    } finally {
      clearTimeout(idleTimer);
      owner.controller.signal.removeEventListener('abort', cancel);
      if (!terminal) await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }

  async function completeStream(owner: StreamOwner) {
    if (streams.get(owner.sessionId) !== owner) return;
    const { session, message } = streamRow(owner);
    if (message) { message.isWorking = false; message.isThinking = false; }
    if (session) session.isRunning = false;
    releaseStream(owner);
    if (session) await fetchSessions(session.serverId, false);
  }

  async function readBackgroundConnection(owner: StreamOwner): Promise<boolean> {
    // A GET may stall before headers, before readStream's byte watchdog exists.
    // Abort this attempt, not the lifetime owner, so it consumes one retry.
    const connection = new AbortController();
    const signal = owner.controller.signal;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort = () => {};
    let response: Response | undefined;
    const discard = (late: Response) => { void late.body?.cancel().catch(() => {}); };
    try {
      response = await new Promise<Response>((resolve, reject) => {
        let settled = false;
        const fail = (reason: string) => {
          clearTimeout(timer);
          connection.abort();
          if (settled) return;
          settled = true;
          reject(new Error(reason));
        };
        abort = () => fail('Claude stream owner aborted');
        signal.addEventListener('abort', abort, { once: true });
        timer = setTimeout(() => fail('Claude stream headers timed out'), 30000);
        if (signal.aborted) { abort(); return; }
        // Explicit settlement bounds even noncompliant fetch implementations
        // that ignore AbortSignal; late bodies never become orphaned readers.
        void fetch(apiUrl(`/api/claude/sessions/${encodeURIComponent(owner.sessionId)}/stream`), {
          signal: connection.signal,
          headers: { Accept: 'text/event-stream' },
        }).then((result) => {
          if (settled) { discard(result); return; }
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }, (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        });
      });
      if (signal.aborted || streams.get(owner.sessionId) !== owner) return false;
      owner.reconnecting = false;
      updateStreamFlags();
      return await readStream(owner, response);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      connection.abort();
      if (response && !response.body?.locked) discard(response);
    }
  }

  async function reconnectToBackgroundStream(owner: StreamOwner, maxRetries = 15) {
    for (let attempt = 0; attempt < maxRetries && streams.get(owner.sessionId) === owner; attempt++) {
      owner.reconnecting = true;
      updateStreamFlags();
      try {
        if (await readBackgroundConnection(owner)) { await completeStream(owner); return; }
      } catch (error) {
        if (owner.controller.signal.aborted) return;
      }
      if (streams.get(owner.sessionId) !== owner) return;
      owner.reconnecting = true;
      updateStreamFlags();
      await new Promise<void>((resolve) => {
        const signal = owner.controller.signal;
        const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
        const timer = setTimeout(finish, Math.min(5000, 1000 + attempt * 800));
        signal.addEventListener('abort', finish, { once: true });
        if (signal.aborted) finish();
      });
    }
    if (streams.get(owner.sessionId) === owner) {
      const session = sessions.value.find((s) => s.id === owner.sessionId);
      releaseStream(owner);
      // Do not manufacture a terminal answer when transport recovery is exhausted.
      if (session) await fetchSessions(session.serverId, false);
    }
  }

  async function sendMessage(prompt: string) {
    if (!prompt.trim() || isGenerating.value || activeSession.value?.isRunning) return;

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

    session.isRunning = true;
    const owner = ownStream(session, reactiveMsg);
    try {
      const response = await fetch(apiUrl(`/api/claude/sessions/${encodeURIComponent(session.id)}/messages/stream`), {
        method: 'POST',
        signal: owner.controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      if (await readStream(owner, response)) { await completeStream(owner); return; }
    } catch (error) {
      if (owner.controller.signal.aborted) return;
    }
    if (streams.get(owner.sessionId) === owner) await reconnectToBackgroundStream(owner);
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

  interface NativeModel {
    id: string;
    title: string;
    desc: string;
    prefix: string;
    resolvedModel?: string;
    supportsEffort?: boolean;
    disabled?: boolean;
  }

  const modelsByServer = ref<Record<string, NativeModel[]>>({});
  const modelSourceByServer = ref<Record<string, string>>({});
  const defaultModelByServer = ref<Record<string, string>>({});
  const modelErrorsByServer = ref<Record<string, string>>({});
  const modelCwdByServer = ref<Record<string, string>>({});
  const loadingModelsByServer = ref<Record<string, boolean>>({});
  const modelRequestIds = new Map<string, number>();
  interface ModelsResponse { source: string; defaultModel: string; models: NativeModel[] }
  const modelRequests = new Map<string, { id: number; promise: Promise<ModelsResponse> }>();
  const isLoadingModels = computed(() => !!loadingModelsByServer.value[serverStore.currentServerId || 'server-local']);

  const availableModels = computed(() => {
    const sId = serverStore.currentServerId || 'server-local';
    return modelsByServer.value[sId] || [];
  });

  function fetchModels(serverId?: string, cwd?: string): Promise<ModelsResponse> {
    const sId = serverId || serverStore.currentServerId || 'server-local';
    const targetCwd = cwd ?? (activeSession.value?.serverId === sId ? activeSession.value.cwd : '') ?? '';
    const key = JSON.stringify([sId, targetCwd]);
    const pending = modelRequests.get(key);
    if (pending && modelRequestIds.get(sId) === pending.id) return pending.promise;
    const requestId = (modelRequestIds.get(sId) || 0) + 1;
    modelRequestIds.set(sId, requestId);
    if (modelCwdByServer.value[sId] !== targetCwd) {
      modelsByServer.value[sId] = [];
      modelSourceByServer.value[sId] = '';
      defaultModelByServer.value[sId] = '';
    }
    modelCwdByServer.value[sId] = targetCwd;
    modelErrorsByServer.value[sId] = '';
    loadingModelsByServer.value[sId] = true;
    const isCurrent = () => modelRequestIds.get(sId) === requestId;
    const promise = (async (): Promise<ModelsResponse> => {
      try {
        const query = new URLSearchParams({ serverId: sId });
        if (targetCwd) query.set('cwd', targetCwd);
        const res = await fetch(apiUrl(`/api/claude/models?${query}`));
        const data = await res.json();
        if (!res.ok || data?.error) throw new Error(data?.error || 'Failed to fetch native models');
        if (!Array.isArray(data?.models)) throw new Error('Invalid native model metadata');
        if (isCurrent()) {
          modelsByServer.value[sId] = data.models;
          modelSourceByServer.value[sId] = data.source || '';
          defaultModelByServer.value[sId] = data.defaultModel || '';
        }
        return data;
      } catch (err) {
        if (isCurrent()) {
          modelsByServer.value[sId] = [];
          modelSourceByServer.value[sId] = '';
          defaultModelByServer.value[sId] = '';
          modelErrorsByServer.value[sId] = err instanceof Error ? err.message : 'Failed to fetch native models';
        }
        return { source: '', defaultModel: '', models: [] };
      } finally {
        if (isCurrent()) loadingModelsByServer.value[sId] = false;
        if (modelRequests.get(key)?.id === requestId) modelRequests.delete(key);
      }
    })();
    modelRequests.set(key, { id: requestId, promise });
    return promise;
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

  watch(() => JSON.stringify([
    serverStore.currentServer.id, currentProjectId.value, currentProjectRoot.value, activeSession.value?.id,
  ]), () => {
    const id = activeSession.value?.id;
    for (const owner of streams.values()) {
      if (owner.sessionId !== id) releaseStream(owner);
    }
    updateStreamFlags();
    attachActiveStream();
  }, { flush: 'sync' });

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
    resumeActiveStream,
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
    modelErrorsByServer,
    modelCwdByServer,
    loadingModelsByServer,
    availableModels,
    isLoadingModels,
    fetchModels,
  };
});
