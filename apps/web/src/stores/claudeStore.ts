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

export interface ClaudeNativeContextUsage {
  model: string;
  totalTokens: number;
  maxTokens: number;
  rawMaxTokens: number | null;
  percentage: number;
}

export interface ClaudeContextUsageScope {
  sessionId: string;
  serverId: string;
  cwd: string;
  model: string;
  cliSessionId: string;
  generation: number;
}

export interface ClaudeContextUsageState {
  scope: ClaudeContextUsageScope | null;
  status: 'idle' | 'loading' | 'available' | 'unavailable' | 'error';
  context: ClaudeNativeContextUsage | null;
  source: 'native' | null;
  error: string;
}

function trimDisplayNumber(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}

export function formatContextTokenCount(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '—';
  if (value >= 1_000_000) return `${trimDisplayNumber(value / 1_000_000)}M`;
  if (value >= 1_000) return `${trimDisplayNumber(value / 1_000)}k`;
  return String(Math.round(value));
}

export function formatContextPercentage(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}%`;
}

export function nativeContextLimit(context: ClaudeNativeContextUsage | null | undefined): number | null {
  if (typeof context?.rawMaxTokens === 'number' && Number.isFinite(context.rawMaxTokens) && context.rawMaxTokens > 0) {
    return context.rawMaxTokens;
  }
  if (typeof context?.maxTokens === 'number' && Number.isFinite(context.maxTokens) && context.maxTokens > 0) {
    return context.maxTokens;
  }
  return null;
}

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

  const contextUsageBySession = ref<Record<string, ClaudeContextUsageState>>({});
  const contextUsageGenerations = new Map<string, number>();
  const sessionUpdateGenerations = new Map<string, number>();
  const sessionFieldGenerations = new Map<string, Map<keyof ClaudeSession, number>>();
  const sessionClearGenerations = new Map<string, number>();
  const contextUsageControllers = new Map<string, AbortController>();
  const contextUsageRequests = new Map<string, {
    generation: number;
    promise: Promise<ClaudeContextUsageState>;
  }>();

  function contextScopeKey(scope: Omit<ClaudeContextUsageScope, 'generation'> | null): string {
    if (!scope) return '';
    return JSON.stringify([scope.sessionId, scope.serverId, scope.cwd, scope.model, scope.cliSessionId]);
  }

  function selectedContextScope(generation?: number): ClaudeContextUsageScope | null {
    const session = activeSession.value;
    if (!session) return null;
    return {
      sessionId: session.id,
      serverId: session.serverId || serverStore.currentServer.id || 'server-local',
      cwd: session.cwd || '',
      model: session.model || '',
      cliSessionId: session.cliSessionId || '',
      generation: generation ?? (contextUsageGenerations.get(session.id) || 0),
    };
  }

  function sameContextScope(a: ClaudeContextUsageScope | null, b: ClaudeContextUsageScope | null) {
    return !!a && !!b && a.sessionId === b.sessionId && a.serverId === b.serverId
      && a.cwd === b.cwd && a.model === b.model && a.cliSessionId === b.cliSessionId
      && a.generation === b.generation;
  }

  function blankContextUsage(scope: ClaudeContextUsageScope | null, status: ClaudeContextUsageState['status']): ClaudeContextUsageState {
    return { scope, status, context: null, source: null, error: '' };
  }

  const currentContextUsage = computed<ClaudeContextUsageState>(() => {
    const scope = selectedContextScope();
    if (!scope) return blankContextUsage(null, 'idle');
    const state = contextUsageBySession.value[scope.sessionId];
    return state && sameContextScope(state.scope, scope) ? state : blankContextUsage(scope, 'idle');
  });

  function invalidateContextUsage(
    sessionId?: string,
    status: ClaudeContextUsageState['status'] = 'idle',
    error = ''
  ) {
    const id = sessionId || activeSession.value?.id;
    if (!id) return;
    const generation = (contextUsageGenerations.get(id) || 0) + 1;
    contextUsageGenerations.set(id, generation);
    const oldCtrl = contextUsageControllers.get(id);
    if (oldCtrl) {
      oldCtrl.abort();
      contextUsageControllers.delete(id);
    }
    const session = sessions.value.find((item) => item.id === id);
    if (!session) {
      delete contextUsageBySession.value[id];
      return;
    }
    const scope = activeSession.value?.id === id ? selectedContextScope(generation) : null;
    contextUsageBySession.value[id] = { ...blankContextUsage(scope, status), error };
  }

  function validNativeContext(value: unknown): value is ClaudeNativeContextUsage {
    if (!value || typeof value !== 'object') return false;
    const context = value as Record<string, unknown>;
    return typeof context.model === 'string'
      && typeof context.totalTokens === 'number' && Number.isFinite(context.totalTokens)
      && typeof context.maxTokens === 'number' && Number.isFinite(context.maxTokens)
      && (typeof context.rawMaxTokens === 'number' || context.rawMaxTokens === null)
      && typeof context.percentage === 'number' && Number.isFinite(context.percentage);
  }

  async function fetchContextUsage(): Promise<ClaudeContextUsageState> {
    const initial = selectedContextScope();
    if (!initial) return blankContextUsage(null, 'idle');
    const scopeKey = contextScopeKey(initial);

    // Request coalescing by exact scope: repeated identical fetches share one request
    const pending = contextUsageRequests.get(scopeKey);
    if (pending && contextUsageGenerations.get(initial.sessionId) === pending.generation) {
      return pending.promise;
    }

    // Changed scope aborts old in-flight request for this session
    const oldController = contextUsageControllers.get(initial.sessionId);
    if (oldController) {
      oldController.abort();
      contextUsageControllers.delete(initial.sessionId);
    }

    const generation = (contextUsageGenerations.get(initial.sessionId) || 0) + 1;
    contextUsageGenerations.set(initial.sessionId, generation);
    const scope = { ...initial, generation };

    const controller = new AbortController();
    contextUsageControllers.set(scope.sessionId, controller);

    const loading = blankContextUsage(scope, 'loading');
    contextUsageBySession.value[scope.sessionId] = loading;

    const isCurrent = () => sameContextScope(selectedContextScope(), scope)
      && contextUsageGenerations.get(scope.sessionId) === generation
      && !controller.signal.aborted;

    const promise = (async (): Promise<ClaudeContextUsageState> => {
      try {
        const query = new URLSearchParams({
          serverId: scope.serverId,
          cwd: scope.cwd,
          model: scope.model,
        });
        const res = await fetch(
          apiUrl(`/api/claude/sessions/${encodeURIComponent(scope.sessionId)}/context-usage?${query.toString()}`),
          { signal: controller.signal }
        );
        const data = await res.json().catch(() => ({}));
        if (!isCurrent()) return currentContextUsage.value;
        if (!res.ok || data?.error) throw new Error(data?.error || 'Không thể tải ngữ cảnh native');
        if (data?.source !== 'native' || !validNativeContext(data?.context)) {
          const unavailable = blankContextUsage(scope, 'unavailable');
          contextUsageBySession.value[scope.sessionId] = unavailable;
          return unavailable;
        }
        const available: ClaudeContextUsageState = {
          scope,
          status: 'available',
          context: data.context,
          source: 'native',
          error: '',
        };
        contextUsageBySession.value[scope.sessionId] = available;
        return available;
      } catch (err: any) {
        if (!isCurrent() || err?.name === 'AbortError' || controller.signal.aborted) {
          return currentContextUsage.value;
        }
        const failed: ClaudeContextUsageState = {
          ...blankContextUsage(scope, 'error'),
          error: err instanceof Error ? err.message : 'Không thể tải ngữ cảnh native',
        };
        contextUsageBySession.value[scope.sessionId] = failed;
        return failed;
      } finally {
        if (contextUsageControllers.get(scope.sessionId) === controller) {
          contextUsageControllers.delete(scope.sessionId);
        }
        if (contextUsageRequests.get(scopeKey)?.generation === generation) {
          contextUsageRequests.delete(scopeKey);
        }
      }
    })();

    contextUsageRequests.set(scopeKey, { generation, promise });
    return promise;
  }

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
    // Never retain an array index across the request. Session lists can be
    // reordered or the target can be deleted while PATCH is pending.
    const initial = sessions.value.find((session) => session.id === id);
    if (!initial) return;

    const updateGen = (sessionUpdateGenerations.get(id) || 0) + 1;
    sessionUpdateGenerations.set(id, updateGen);
    const fieldGenerations = sessionFieldGenerations.get(id) || new Map<keyof ClaudeSession, number>();
    sessionFieldGenerations.set(id, fieldGenerations);
    for (const key of Object.keys(updates) as (keyof ClaudeSession)[]) {
      fieldGenerations.set(key, updateGen);
    }
    Object.assign(initial, updates);

    try {
      const res = await fetch(apiUrl(`/api/claude/sessions/${encodeURIComponent(id)}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      const current = sessions.value.find((session) => session.id === id);
      if (!data.session || !current || sessionFieldGenerations.get(id) !== fieldGenerations) return;

      // PATCH responses contain full server snapshots. Merge only the fields
      // this request owns, and only if no newer request has touched that field.
      // This prevents a rename response carrying an old model/effort label from
      // undoing a model selection made while requests overlap.
      for (const key of Object.keys(updates) as (keyof ClaudeSession)[]) {
        if (fieldGenerations.get(key) !== updateGen) continue;
        const serverValue = data.session[key];
        (current as any)[key] = serverValue === undefined ? updates[key] : serverValue;
      }
      return current;
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
        delete contextUsageBySession.value[id];
        contextUsageGenerations.delete(id);
        sessionUpdateGenerations.delete(id);
        sessionFieldGenerations.delete(id);
        sessionClearGenerations.delete(id);
        const ctrl = contextUsageControllers.get(id);
        if (ctrl) {
          ctrl.abort();
          contextUsageControllers.delete(id);
        }
        const requestKeyPrefix = `${JSON.stringify([id]).slice(0, -1)},`;
        for (const key of Array.from(contextUsageRequests.keys())) {
          if (key.startsWith(requestKeyPrefix)) {
            contextUsageRequests.delete(key);
          }
        }
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
          if (Array.isArray(event.liveMessage.childAgents)) {
            reactiveMsg.childAgents = event.liveMessage.childAgents;
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
      case 'tool_use': {
        reactiveMsg.isThinking = false;
        reactiveMsg.tools = reactiveMsg.tools || [];
        const existingIdx = event.tool?.id ? reactiveMsg.tools.findIndex((t) => t.id === event.tool.id) : -1;
        if (existingIdx !== -1) {
          const prev = reactiveMsg.tools[existingIdx];
          reactiveMsg.tools[existingIdx] = {
            ...prev,
            ...event.tool,
            isExpanded: prev.isExpanded ?? (event.tool?.type === 'bash' ? false : undefined),
          };
        } else {
          reactiveMsg.tools.push({
            ...event.tool,
            isExpanded: event.tool?.type === 'bash' ? false : undefined,
          });
        }
        break;
      }
      case 'tool_result': {
        reactiveMsg.tools = reactiveMsg.tools || [];
        const tool = [...reactiveMsg.tools].reverse().find((t) => t.id === event.tool_use_id);
        if (tool) {
          tool.output = event.output;
          tool.status = event.status || 'done';
        }
        break;
      }
      case 'child_agent':
      case 'agent_update': {
        const agent = event.agent;
        if (agent) {
          reactiveMsg.childAgents = reactiveMsg.childAgents || [];
          const idx = reactiveMsg.childAgents.findIndex(
            (a) => a.agentId === agent.agentId || (agent.parentToolUseId && a.parentToolUseId === agent.parentToolUseId)
          );
          if (idx !== -1) {
            reactiveMsg.childAgents[idx] = {
              ...reactiveMsg.childAgents[idx],
              ...agent,
            };
          } else {
            reactiveMsg.childAgents.push(agent);
          }
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
    const session = sessions.value.find((item) => item.id === targetId);
    if (!session) return;

    const clearGeneration = (sessionClearGenerations.get(targetId) || 0) + 1;
    sessionClearGenerations.set(targetId, clearGeneration);

    // Invalidate before starting POST so no old native total remains visible.
    // The replacement probe starts only after the clear succeeds; otherwise it
    // could briefly republish the pre-clear native total.
    invalidateContextUsage(targetId, 'loading');

    session.messages = [];
    session.contextTokens = '0';
    session.updatedAt = Date.now();

    const isCurrent = () => sessionClearGenerations.get(targetId) === clearGeneration
      && sessions.value.some((item) => item.id === targetId);

    try {
      const res = await fetch(apiUrl(`/api/claude/sessions/${encodeURIComponent(targetId)}/clear`), {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`Clear messages failed (${res.status || 'unknown'})`);
      const data = await res.json().catch(() => ({}));
      if (!isCurrent()) return;
      const current = sessions.value.find((item) => item.id === targetId);
      if (data.session && current) {
        if (Array.isArray(data.session.messages)) current.messages = data.session.messages;
        if (data.session.contextTokens !== undefined) current.contextTokens = data.session.contextTokens;
        if (typeof data.session.updatedAt === 'number') current.updatedAt = data.session.updatedAt;
      }
      if (activeSession.value?.id === targetId) void fetchContextUsage();
    } catch (err) {
      console.error('clearClaudeMessages error:', err);
      if (!isCurrent()) return;
      invalidateContextUsage(
        targetId,
        'error',
        err instanceof Error ? err.message : 'Không thể xoá hội thoại'
      );
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

  watch(() => JSON.stringify([
    activeSession.value?.id || '',
    activeSession.value?.serverId || serverStore.currentServer.id || 'server-local',
    activeSession.value?.cwd || '',
    activeSession.value?.model || '',
    activeSession.value?.cliSessionId || '',
  ]), () => {
    const session = activeSession.value;
    if (!session) return;
    invalidateContextUsage(session.id);
    void fetchContextUsage();
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
    contextUsageBySession,
    currentContextUsage,
    invalidateContextUsage,
    fetchContextUsage,
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
