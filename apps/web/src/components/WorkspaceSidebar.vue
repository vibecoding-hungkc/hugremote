<template>
  <div
    id="workspace-sidebar-backdrop"
    class="workspace-sidebar-backdrop"
    :class="{ open: isOpen }"
    @click="$emit('close')"
  ></div>

  <aside
    id="desktop-workspace-sidebar"
    class="desktop-workspace-sidebar"
    :class="{ open: isOpen, resizing: isResizing, 'shortcut-labels-visible': shortcutStore.showLabels }"
    :style="{ width: `${panelWidth}px` }"
    aria-label="Điều hướng nhanh Server, Project và Session"
  >
    <div class="dw-top-header">
      <div class="dw-top-title">
        <i class="ri-layout-left-2-line" style="color: #38bdf8"></i>
        <span>Workspace</span>
        <span id="dw-active-project-pill" class="dw-project-scope-pill">
          {{ activeProjectName }}
        </span>
      </div>
      <div class="dw-top-actions">
        <button
          id="btn-dw-add-server"
          type="button"
          class="dw-add-server-btn"
          :class="{ active: showAddServerMenu }"
          title="Thêm Server vào Workspace"
          aria-label="Thêm Server vào Workspace"
          @click="showAddServerMenu = !showAddServerMenu"
        >
          <i class="ri-add-line"></i>
        </button>
        <button
          id="btn-close-workspace-sidebar"
          type="button"
          class="dw-close-btn"
          title="Đóng cột Workspace"
          aria-label="Đóng cột Workspace"
          @click="$emit('close')"
        >
          <i class="ri-close-line"></i>
        </button>
      </div>
    </div>

    <div
      id="dw-workspace-resize"
      class="dw-workspace-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label="Điều chỉnh độ rộng Workspace"
      title="Kéo để đổi độ rộng Workspace"
      tabindex="0"
      :aria-valuemin="minWidth"
      :aria-valuemax="effectiveMaxWidth"
      :aria-valuenow="panelWidth"
      @pointerdown="onResizePointerDown"
      @keydown="onResizeKeyDown"
    ></div>

    <!-- Multi-Server & Project Tree -->
    <div class="dw-scroll-content">
      <div class="dw-section">
        <!-- Inline Add Server to Workspace Picker -->
        <div v-if="showAddServerMenu" id="dw-add-server-menu" class="dw-add-server-menu">
          <div class="dw-add-server-title">Thêm Server vào Workspace</div>
          <div v-if="serverStore.availableServersToAdd.length === 0" class="dw-add-server-empty">
            Tất cả Server đã có trong Workspace
          </div>
          <button
            v-for="availSrv in serverStore.availableServersToAdd"
            :key="availSrv.id"
            type="button"
            class="dw-add-server-option"
            :data-dw-add-server-item="availSrv.id"
            @click="handleAddServerToWorkspace(availSrv.id)"
          >
            <i :class="availSrv.type === 'local' ? 'ri-hard-drive-2-line' : 'ri-server-line'" style="color: #34d399"></i>
            <span>{{ availSrv.name }}</span>
            <i class="ri-add-circle-line dw-add-server-plus"></i>
          </button>
          <button
            id="btn-dw-open-server-modal"
            type="button"
            class="dw-add-server-manage-btn"
            @click="handleOpenServerModal"
          >
            <i class="ri-settings-3-line"></i>
            <span>Kết nối / Quản lý Server SSH...</span>
          </button>
        </div>

        <div id="dw-project-list" class="dw-list">
          <div
            v-for="(srv, srvIdx) in serverStore.workspaceServers"
            :key="srv.id"
            class="dw-server-group"
            :data-dw-server-group="srv.id"
          >
            <!-- Server Row -->
            <div
              class="dw-item server-item"
              :class="{ active: srv.id === serverStore.currentServerId }"
              :data-dw-server="srv.id"
              @click="handleSelectServer(srv.id)"
            >
              <button
                type="button"
                class="dw-caret"
                :aria-label="collapsedServerIds.has(srv.id) ? 'Mở nhóm Server' : 'Thu gọn nhóm Server'"
                :aria-expanded="!collapsedServerIds.has(srv.id)"
                @click.stop="toggleServer(srv.id)"
              >
                <i :class="collapsedServerIds.has(srv.id) ? 'ri-arrow-right-s-line' : 'ri-arrow-down-s-line'"></i>
              </button>
              <div class="dw-item-main">
                <div class="dw-item-title">
                  <span class="dw-idx-badge" :data-server-index="srvIdx + 1">{{ srvIdx + 1 }}</span>
                  <i
                    :class="srv.type === 'local' ? 'ri-hard-drive-2-line' : 'ri-server-line'"
                    style="color: #34d399"
                  ></i>
                  <span>{{ srv.name }}</span>
                </div>
              </div>
              <kbd
                v-if="shortcutStore.getItemShortcut('server', srvIdx + 1)"
                class="dw-kbd-tag"
              >
                {{ shortcutStore.getItemShortcut('server', srvIdx + 1) }}
              </kbd>
              <div class="dw-item-actions" @click.stop>
                <button
                  type="button"
                  class="btn-dw-server-proj"
                  title="Quản lý hoặc thêm Project trên Server này"
                  @click="handleManageServerProjects(srv.id)"
                >
                  <i class="ri-folder-add-line"></i>
                </button>
                <button
                  v-if="serverStore.workspaceServers.length > 1"
                  type="button"
                  class="danger btn-dw-server-remove"
                  title="Gỡ Server khỏi Workspace"
                  @click="handleRemoveServerFromWorkspace(srv.id)"
                >
                  <i class="ri-close-line"></i>
                </button>
              </div>
            </div>

            <!-- Projects inside this Server -->
            <div v-if="!collapsedServerIds.has(srv.id)" class="dw-server-children">
              <div
                v-for="proj in projectStore.projectsForServer(srv.id)"
                :key="proj.id"
                class="dw-project-group"
                :data-dw-project-group="proj.id"
              >
                <div
                  class="dw-item proj-item"
                  :class="{ active: srv.id === serverStore.currentServerId && proj.id === projectStore.currentProject?.id }"
                  :data-dw-project="proj.id"
                  :data-dw-project-server="srv.id"
                  @click="handleSelectProject(proj.id, srv.id)"
                >
                  <button
                    type="button"
                    class="dw-caret"
                    :aria-label="collapsedProjectIds.has(proj.id) ? 'Mở nhóm Project' : 'Thu gọn nhóm Project'"
                    :aria-expanded="!collapsedProjectIds.has(proj.id)"
                    @click.stop="toggleProject(proj.id)"
                  >
                    <i :class="collapsedProjectIds.has(proj.id) ? 'ri-arrow-right-s-line' : 'ri-arrow-down-s-line'"></i>
                  </button>
                  <div class="dw-item-main">
                    <div class="dw-item-title">
                      <span class="dw-idx-badge" :data-proj-index="getProjIndex(proj.id)">
                        {{ getProjIndex(proj.id) }}
                      </span>
                      <i
                        :class="isHomeProject(proj) ? 'ri-home-4-line' : 'ri-folder-2-line'"
                        style="color: #38bdf8"
                      ></i>
                      <span>{{ proj.name }}</span>
                    </div>
                  </div>
                  <kbd
                    v-if="shortcutStore.getItemShortcut('project', getProjIndex(proj.id))"
                    class="dw-kbd-tag"
                  >
                    {{ shortcutStore.getItemShortcut('project', getProjIndex(proj.id)) }}
                  </kbd>
                  <div class="dw-item-actions" @click.stop>
                    <button
                      v-if="!isHomeProject(proj)"
                      type="button"
                      class="danger btn-dw-proj-del"
                      title="Xóa project"
                      @click="requestDeleteProject(proj)"
                    >
                      <i class="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </div>

                <div v-if="!collapsedProjectIds.has(proj.id)" class="dw-proj-children">
                  <div class="dw-sub-group">
                    <div class="dw-sub-header">
                      <span><i class="ri-terminal-box-line" style="color: #c084fc"></i> Terminal</span>
                      <button
                        type="button"
                        :id="srv.id === serverStore.currentServerId && proj.id === projectStore.currentProject?.id ? 'btn-dw-new-term' : undefined"
                        title="Tạo Terminal trong Project"
                        @click="handleOpenNewTerminal(proj.id, srv.id)"
                      >
                        <i class="ri-add-line"></i>
                      </button>
                    </div>
                    <div class="dw-session-list">
                      <div
                        v-for="s in sessionsForProject(proj.id, proj.rootPath, 'terminal', srv.id)"
                        :key="s.id"
                        class="dw-item term-item"
                        :class="{
                          active:
                            props.activeTab === 'terminal' &&
                            srv.id === serverStore.currentServerId &&
                            proj.id === projectStore.currentProject?.id &&
                            s.id === terminalStore.activeSession?.id,
                        }"
                        :data-dw-term="s.id"
                        :data-dw-term-project="proj.id"
                        :data-dw-term-server="srv.id"
                        @click="handleSelectTerminal(s)"
                      >
                        <div class="dw-item-main">
                          <div class="dw-item-title">
                            <span class="dw-idx-badge" :data-term-index="getTermIndex(s.id)">
                              {{ getTermIndex(s.id) }}
                            </span>
                            <i class="ri-terminal-box-line" style="color: #c084fc"></i>
                            <span>{{ s.name }}</span>
                          </div>
                        </div>
                        <kbd
                          v-if="shortcutStore.getItemShortcut('terminal', getTermIndex(s.id))"
                          class="dw-kbd-tag"
                        >
                          {{ shortcutStore.getItemShortcut('terminal', getTermIndex(s.id)) }}
                        </kbd>
                        <div class="dw-item-actions" @click.stop>
                          <button
                            type="button"
                            class="btn-dw-term-edit"
                            title="Chỉnh sửa phiên"
                            @click="handleEditTerminal(s)"
                          >
                            <i class="ri-edit-line"></i>
                          </button>
                          <button
                            v-if="sessionsForProject(proj.id, proj.rootPath, 'terminal', srv.id).length > 1"
                            type="button"
                            class="danger btn-dw-term-close"
                            title="Đóng phiên"
                            :disabled="Boolean(closingTermId)"
                            @click="requestCloseTerminal(s)"
                          >
                            <i class="ri-close-line"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="dw-sub-group">
                    <div class="dw-sub-header">
                      <span><i class="ri-sparkling-fill" style="color: #f59e0b"></i> Claude</span>
                      <button
                        type="button"
                        :id="srv.id === serverStore.currentServerId && proj.id === projectStore.currentProject?.id ? 'btn-dw-new-claude' : undefined"
                        title="Tạo Claude trong Project"
                        @click="handleOpenNewClaude(proj.id, srv.id)"
                      >
                        <i class="ri-add-line"></i>
                      </button>
                    </div>
                    <div class="dw-session-list">
                      <div
                        v-for="s in sessionsForProject(proj.id, proj.rootPath, 'claude', srv.id)"
                        :key="s.id"
                        class="dw-item claude-item"
                        :class="{
                          active:
                            props.activeTab === 'claude' &&
                            srv.id === serverStore.currentServerId &&
                            proj.id === projectStore.currentProject?.id &&
                            s.id === claudeStore.activeSession?.id,
                          running: isClaudeSessionRunning(s),
                        }"
                        :data-dw-claude="s.id"
                        :data-dw-claude-project="proj.id"
                        :data-dw-claude-server="srv.id"
                        @click="handleSelectClaude(s)"
                      >
                        <div class="dw-item-main">
                          <div class="dw-item-title">
                            <span class="dw-idx-badge" :data-claude-index="getClaudeIndex(s.id)">
                              {{ getClaudeIndex(s.id) }}
                            </span>
                            <i class="ri-sparkling-fill" style="color: #f59e0b"></i>
                            <span>{{ displayClaudeName(s) }}</span>
                          </div>
                        </div>
                        <span
                          v-if="isClaudeSessionRunning(s)"
                          class="dw-claude-running status-indicator"
                          aria-label="Claude đang làm việc"
                        ></span>
                        <kbd
                          v-if="shortcutStore.getItemShortcut('claude', getClaudeIndex(s.id))"
                          class="dw-kbd-tag"
                        >
                          {{ shortcutStore.getItemShortcut('claude', getClaudeIndex(s.id)) }}
                        </kbd>
                        <div class="dw-item-actions" @click.stop>
                          <button
                            type="button"
                            class="btn-dw-claude-edit"
                            title="Chỉnh sửa phiên Claude"
                            @click="handleEditClaude(s)"
                          >
                            <i class="ri-edit-line"></i>
                          </button>
                          <button
                            v-if="sessionsForProject(proj.id, proj.rootPath, 'claude', srv.id).length > 1"
                            type="button"
                            class="danger btn-dw-claude-close"
                            title="Đóng phiên Claude"
                            @click="handleDeleteClaude(s)"
                          >
                            <i class="ri-close-line"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <p v-if="sidebarError" class="dw-error-msg" role="alert">{{ sidebarError }}</p>

    <ConfirmModal
      :is-open="Boolean(deletingProjectTarget)"
      title="Xác Nhận Xóa Project"
      icon="ri-delete-bin-line"
      :message="`Bạn có chắc chắn muốn xóa project &quot;${deletingProjectTarget?.name || ''}&quot; khỏi danh sách không?`"
      confirm-label="Xóa Ngay"
      :is-danger="true"
      @close="deletingProjectTarget = null"
      @confirm="executeDeleteProject"
    />

    <ConfirmModal
      :is-open="Boolean(closingTermTarget)"
      title="Đóng Cửa Sổ Terminal"
      icon="ri-delete-bin-line"
      :message="`Bạn có chắc chắn muốn đóng cửa sổ &quot;${closingTermTarget?.name || ''}&quot;? Tiến trình đang chạy sẽ bị dừng.`"
      confirm-label="Đóng Cửa Sổ"
      :is-danger="true"
      @close="closingTermTarget = null"
      @confirm="executeCloseTerminal"
    />
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { apiUrl } from '../utils/api.js';
import { useServerStore } from '../stores/serverStore.js';
import { useProjectStore, type ProjectItem } from '../stores/projectStore.js';
import { useTerminalStore, type TerminalSessionItem } from '../stores/terminalStore.js';
import { useClaudeStore, type ClaudeSession } from '../stores/claudeStore.js';
import { useFileStore } from '../stores/fileStore.js';
import { useShortcutStore } from '../stores/shortcutStore.js';
import ConfirmModal from './ConfirmModal.vue';

const props = withDefaults(defineProps<{
  isOpen: boolean;
  panelWidth?: number;
  activeTab?: string;
}>(), { panelWidth: 256, activeTab: '' });

const emit = defineEmits<{
  (e: 'update:panelWidth', width: number): void;
  (e: 'close'): void;
  (e: 'open-project-modal'): void;
  (e: 'open-server-modal'): void;
  (e: 'project-selected'): void;
  (e: 'open-new-terminal'): void;
  (e: 'edit-terminal', session: any): void;
  (e: 'select-terminal'): void;
  (e: 'open-new-claude'): void;
  (e: 'edit-claude', session: any): void;
  (e: 'delete-claude', session: any): void;
  (e: 'select-claude'): void;
}>();

const serverStore = useServerStore();
const projectStore = useProjectStore();
const terminalStore = useTerminalStore();
const claudeStore = useClaudeStore();
const fileStore = useFileStore();
const shortcutStore = useShortcutStore();

const sidebarError = ref('');
const showAddServerMenu = ref(false);
const deletingProjectTarget = ref<ProjectItem | null>(null);
const closingTermTarget = ref<TerminalSessionItem | null>(null);
const closingTermId = ref('');
const collapsedServerIds = ref<Set<string>>(new Set());
const collapsedProjectIds = ref<Set<string>>(new Set());
const allClaudeSessions = ref<ClaudeSession[]>([]);
const minWidth = 220;
const isResizing = ref(false);
const effectiveMaxWidth = computed(() => typeof window === 'undefined' ? 520 : Math.max(minWidth, Math.min(520, window.innerWidth - 320)));

function toggleServer(id: string) {
  const next = new Set(collapsedServerIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  collapsedServerIds.value = next;
}

function toggleProject(id: string) {
  const next = new Set(collapsedProjectIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  collapsedProjectIds.value = next;
}

// Fetch projects and sessions across all servers present in the Workspace
let sessionRequest = 0;
async function refreshAllClaudeSessions() {
  const request = ++sessionRequest;
  const targetServers = serverStore.workspaceServers.map((s) => s.id);
  try {
    const results = await Promise.all(
      targetServers.map(async (srvId) => {
        try {
          const response = await fetch(apiUrl(`/api/claude/sessions?serverId=${encodeURIComponent(srvId)}`));
          if (!response.ok) return [];
          const data = await response.json();
          if (Array.isArray(data.sessions)) {
            claudeStore.syncServerSessionsStatus?.(srvId, data.sessions);
            return data.sessions as ClaudeSession[];
          }
        } catch {}
        return [];
      })
    );
    if (request === sessionRequest) {
      allClaudeSessions.value = results.flat();
    }
  } catch { /* Keep the previously fetched tree if offline. */ }
}

async function ensureWorkspaceServersLoaded() {
  for (const srv of serverStore.workspaceServers) {
    try {
      const projs = projectStore.projectsForServer(srv.id);
      if (projs.length === 0) {
        await projectStore.fetchProjects(srv.id);
      }
      const allProjs = projectStore.projectsForServer(srv.id);
      for (const proj of allProjs) {
        terminalStore.ensureProjectSession(srv.id, proj.id, proj.rootPath);
      }
    } catch (_) {}
  }
  await refreshAllClaudeSessions();
}

watch(
  () => [
    serverStore.currentServerId,
    serverStore.workspaceServers.map(s => s.id).join(','),
  ],
  () => {
    ensureWorkspaceServersLoaded();
  }
);
watch(
  () => [
    projectStore.currentProject?.id,
    claudeStore.isGenerating,
    claudeStore.runningSessionIds.join('|'),
    claudeStore.sessions.map(s => `${s.id}:${s.name}:${s.isRunning ? 1 : 0}`).join('|'),
  ],
  () => {
    refreshAllClaudeSessions();
    setTimeout(() => refreshAllClaudeSessions(), 350);
  }
);
let runningPollTimer: ReturnType<typeof setInterval> | null = null;
function syncRunningPoll() {
  const hasAnyRunning =
    claudeStore.isGenerating ||
    claudeStore.runningSessionIds.length > 0 ||
    claudeStore.sessions.some((s) => s.isRunning) ||
    allClaudeSessions.value.some((s) => s.isRunning);
  if (hasAnyRunning && !runningPollTimer && typeof window !== 'undefined') {
    runningPollTimer = setInterval(() => {
      refreshAllClaudeSessions();
    }, 1200);
  } else if (!hasAnyRunning && runningPollTimer) {
    clearInterval(runningPollTimer);
    runningPollTimer = null;
  }
}
watch(
  () => [
    claudeStore.isGenerating,
    claudeStore.runningSessionIds.length,
    claudeStore.sessions.some((s) => s.isRunning),
    allClaudeSessions.value.some((s) => s.isRunning),
  ],
  () => syncRunningPoll()
);
onMounted(() => {
  ensureWorkspaceServersLoaded();
  syncRunningPoll();
});
onBeforeUnmount(() => {
  sessionRequest++;
  stopResize();
  if (runningPollTimer) {
    clearInterval(runningPollTimer);
    runningPollTimer = null;
  }
});

function isClaudeSessionRunning(session: ClaudeSession): boolean {
  return Boolean(session.isRunning) || claudeStore.isSessionRunning(session.id);
}

function displayClaudeName(session: ClaudeSession): string {
  const raw = (session.name || '').trim();
  if (!raw) return 'chat';
  if (!session.isCustomNamed && session.cwd && raw === session.cwd.trim()) {
    const parts = raw.replace(/[/\\]+$/, '').split(/[/\\]/).filter(Boolean);
    return parts[parts.length - 1] || raw;
  }
  return raw;
}

function resolveClaudeProjectId(session: ClaudeSession, serverId = session.serverId || serverStore.currentServerId) {
  const srvId = serverId;
  return session.projectId || projectStore.projectsForServer(srvId).find(p =>
    p.rootPath.replace(/\/+$/, '') === session.cwd?.replace(/\/+$/, '')
  )?.id;
}

function sessionsForProject(id: string, rootPath: string, kind: 'terminal', serverId?: string): TerminalSessionItem[];
function sessionsForProject(id: string, rootPath: string, kind: 'claude', serverId?: string): ClaudeSession[];
function sessionsForProject(
  id: string,
  rootPath: string,
  kind: 'terminal' | 'claude',
  serverId = serverStore.currentServerId
): TerminalSessionItem[] | ClaudeSession[] {
  if (kind === 'terminal') {
    return terminalStore.sessions.filter(s => s.serverId === serverId && s.projectId === id);
  }
  const byId = new Map<string, ClaudeSession>();
  const cleanRoot = (rootPath || '').trim().replace(/\/+$/, '') || '/';
  for (const s of [...allClaudeSessions.value, ...claudeStore.sessions]) {
    if (s.serverId !== serverId) continue;
    const sCwd = (s.cwd || '').trim().replace(/\/+$/, '') || '/';
    if (s.projectId ? s.projectId === id : sCwd === cleanRoot) {
      const prev = byId.get(s.id);
      const isRunning = Boolean(prev?.isRunning || s.isRunning || claudeStore.isSessionRunning(s.id));
      byId.set(s.id, prev ? { ...prev, ...s, isRunning } : { ...s, isRunning });
    }
  }
  return [...byId.values()];
}

const projIndexMap = computed(() => {
  const map = new Map<string, number>();
  let idx = 0;
  for (const srv of serverStore.workspaceServers) {
    for (const proj of projectStore.projectsForServer(srv.id)) {
      idx++;
      map.set(proj.id, idx);
    }
  }
  return map;
});

const termIndexMap = computed(() => {
  const map = new Map<string, number>();
  let idx = 0;
  for (const srv of serverStore.workspaceServers) {
    for (const proj of projectStore.projectsForServer(srv.id)) {
      for (const s of sessionsForProject(proj.id, proj.rootPath, 'terminal', srv.id)) {
        idx++;
        map.set(s.id, idx);
      }
    }
  }
  return map;
});

const claudeIndexMap = computed(() => {
  const map = new Map<string, number>();
  let idx = 0;
  for (const srv of serverStore.workspaceServers) {
    for (const proj of projectStore.projectsForServer(srv.id)) {
      for (const s of sessionsForProject(proj.id, proj.rootPath, 'claude', srv.id)) {
        idx++;
        map.set(s.id, idx);
      }
    }
  }
  return map;
});

function getProjIndex(projectId: string): number {
  return projIndexMap.value.get(projectId) || 1;
}

function getTermIndex(sessionId: string): number {
  return termIndexMap.value.get(sessionId) || 1;
}

function getClaudeIndex(sessionId: string): number {
  return claudeIndexMap.value.get(sessionId) || 1;
}

function clampWidth(width: number) {
  return Math.round(Math.max(minWidth, Math.min(effectiveMaxWidth.value, width)));
}
let resizePointerId: number | null = null;
function stopResize() {
  isResizing.value = false;
  resizePointerId = null;
  if (typeof window !== 'undefined') {
    window.removeEventListener('pointermove', onResizePointerMove);
    window.removeEventListener('pointerup', stopResize);
    window.removeEventListener('pointercancel', stopResize);
  }
}
function onResizePointerMove(event: PointerEvent) {
  if (!isResizing.value || event.pointerId !== resizePointerId) return;
  emit('update:panelWidth', clampWidth(event.clientX));
}
function onResizePointerDown(event: PointerEvent) {
  if (typeof window === 'undefined' || window.innerWidth < 900) return;
  event.preventDefault();
  isResizing.value = true;
  resizePointerId = event.pointerId;
  window.addEventListener('pointermove', onResizePointerMove);
  window.addEventListener('pointerup', stopResize);
  window.addEventListener('pointercancel', stopResize);
}
function onResizeKeyDown(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  emit('update:panelWidth', clampWidth(props.panelWidth + (event.key === 'ArrowRight' ? 24 : -24)));
}

const activeProjectName = computed(() => {
  if (projectStore.currentProject?.name) return projectStore.currentProject.name;
  const ws = serverStore.currentServer.workspace || '~';
  const parts = ws.split('/').filter(Boolean);
  return parts[parts.length - 1] || '~';
});

function isHomeProject(project: ProjectItem) {
  const norm = (project.rootPath || '').trim().replace(/\/+$/, '') || '/';
  if (norm === '~') return true;
  if (project.name === '~' && norm !== '/') return true;
  return false;
}

function closeOnMobileIfNeeded() {
  if (typeof window !== 'undefined' && window.innerWidth < 900) {
    emit('close');
  }
}

async function handleAddServerToWorkspace(serverId: string) {
  showAddServerMenu.value = false;
  serverStore.addServerToWorkspace(serverId);
  const nextCollapsed = new Set(collapsedServerIds.value);
  nextCollapsed.delete(serverId);
  collapsedServerIds.value = nextCollapsed;
  try {
    await projectStore.fetchProjects(serverId);
    const projs = projectStore.projectsForServer(serverId);
    const activeId = projectStore.activeProjectIdByServer[serverId] || projs[0]?.id;
    const activeProj = projs.find(p => p.id === activeId) || projs[0];
    if (activeProj) {
      terminalStore.ensureProjectSession(serverId, activeProj.id, activeProj.rootPath);
    }
    await refreshAllClaudeSessions();
  } catch (err: any) {
    sidebarError.value = err?.message || 'Không thể tải danh sách Project của Server.';
  }
}

function handleRemoveServerFromWorkspace(serverId: string) {
  const wasCurrent = serverId === serverStore.currentServerId;
  serverStore.removeServerFromWorkspace(serverId);
  if (wasCurrent) {
    emit('project-selected');
  }
}

function handleOpenServerModal() {
  showAddServerMenu.value = false;
  emit('open-server-modal');
}

async function handleSelectServer(serverId: string) {
  if (serverId === serverStore.currentServerId) {
    toggleServer(serverId);
    return;
  }
  sidebarError.value = '';
  try {
    if (!(await fileStore.confirmUnsavedChanges())) return;
    if (projectStore.projectsForServer(serverId).length === 0) {
      await projectStore.fetchProjects(serverId);
    }
    serverStore.selectServer(serverId);
    const nextCollapsed = new Set(collapsedServerIds.value);
    nextCollapsed.delete(serverId);
    collapsedServerIds.value = nextCollapsed;
    emit('project-selected');
  } catch (err: any) {
    sidebarError.value = err?.message || 'Không thể chuyển Server.';
  }
}

async function handleManageServerProjects(serverId: string) {
  if (serverId !== serverStore.currentServerId) {
    await handleSelectServer(serverId);
  }
  emit('open-project-modal');
}

function handleOpenProjectModal() {
  emit('open-project-modal');
}

async function handleOpenNewTerminal(projectId: string, serverId = serverStore.currentServerId) {
  if (!await selectProjectScope(projectId, serverId)) return;
  emit('open-new-terminal');
}

async function handleOpenNewClaude(projectId: string, serverId = serverStore.currentServerId) {
  if (!await selectProjectScope(projectId, serverId)) return;
  emit('open-new-claude');
}

async function selectProjectScope(projectId: string, serverId = serverStore.currentServerId): Promise<boolean> {
  if (serverId === serverStore.currentServerId && projectId === projectStore.currentProject?.id) return true;
  sidebarError.value = '';
  try {
    if (!(await fileStore.confirmUnsavedChanges())) return false;
    if (serverId !== serverStore.currentServerId) {
      serverStore.selectServer(serverId);
    }
    await projectStore.selectProject(projectId, serverId);
    emit('project-selected');
    return true;
  } catch (err: any) {
    sidebarError.value = err?.message || 'Không thể chuyển Project.';
    return false;
  }
}

async function handleSelectProject(projectId: string, serverId = serverStore.currentServerId) {
  await selectProjectScope(projectId, serverId);
}

function requestDeleteProject(project: ProjectItem) {
  if (isHomeProject(project)) return;
  deletingProjectTarget.value = project;
}

async function executeDeleteProject() {
  const target = deletingProjectTarget.value;
  if (!target) return;
  deletingProjectTarget.value = null;
  sidebarError.value = '';
  try {
    const wasCurrent = target.id === projectStore.currentProject?.id && target.serverId === serverStore.currentServerId;
    if (wasCurrent && !(await fileStore.confirmUnsavedChanges())) return;

    // Clean up any terminal sessions belonging to this project
    const termSessions = terminalStore.sessions.filter(s => s.serverId === target.serverId && s.projectId === target.id);
    for (const term of termSessions) {
      terminalStore.closeSession(term.id).catch(() => {});
    }

    // Clean up any claude sessions belonging to this project
    const claudeSessions = claudeStore.sessions.filter(s => s.serverId === target.serverId && s.projectId === target.id);
    for (const cs of claudeSessions) {
      claudeStore.deleteSession(cs.id).catch(() => {});
    }

    await projectStore.deleteProject(target.id, target.serverId);
    if (target.serverId && target.serverId !== serverStore.currentServerId) {
      await projectStore.fetchProjects(target.serverId);
    }
    if (wasCurrent) {
      emit('project-selected');
    }
  } catch (err: any) {
    sidebarError.value = err?.message || 'Không thể xóa Project.';
  }
}

async function handleSelectTerminal(session: TerminalSessionItem) {
  emit('select-terminal');
  terminalStore.switchSession(session.id);
  const targetServerId = session.serverId || serverStore.currentServerId;
  if (session.projectId && !await selectProjectScope(session.projectId, targetServerId)) return;
  if (!session.projectId && targetServerId !== serverStore.currentServerId) {
    serverStore.selectServer(targetServerId);
    emit('project-selected');
  }
  closeOnMobileIfNeeded();
}

async function handleEditTerminal(session: TerminalSessionItem) {
  if (session.projectId && !await selectProjectScope(session.projectId, session.serverId)) return;
  emit('edit-terminal', session);
}

function requestCloseTerminal(session: TerminalSessionItem) {
  if (closingTermId.value || (session.projectId ? sessionsForProject(session.projectId, '', 'terminal').length <= 1 : terminalStore.currentServerSessions.length <= 1)) return;
  closingTermTarget.value = session;
}

async function executeCloseTerminal() {
  const target = closingTermTarget.value;
  if (!target) return;
  closingTermTarget.value = null;
  if (target.projectId && !await selectProjectScope(target.projectId, target.serverId)) return;
  closingTermId.value = target.id;
  sidebarError.value = '';
  try {
    await terminalStore.closeSession(target.id);
  } catch (err: any) {
    sidebarError.value = err?.message || 'Không thể đóng phiên Terminal.';
  } finally {
    closingTermId.value = '';
  }
}

async function handleSelectClaude(session: ClaudeSession) {
  emit('select-claude');
  const targetServerId = session.serverId || serverStore.currentServerId;
  const targetProjectId = resolveClaudeProjectId(session, targetServerId);
  if (targetProjectId) {
    if (!await selectProjectScope(targetProjectId, targetServerId)) return;
  } else if (targetServerId !== serverStore.currentServerId) {
    serverStore.selectServer(targetServerId);
    emit('project-selected');
  }
  claudeStore.switchSession(session.id);
  closeOnMobileIfNeeded();
}

async function handleEditClaude(session: ClaudeSession) {
  const projectId = resolveClaudeProjectId(session);
  if (projectId && !await selectProjectScope(projectId, session.serverId)) return;
  emit('edit-claude', session);
}

async function handleDeleteClaude(session: ClaudeSession) {
  const projectId = resolveClaudeProjectId(session);
  if (projectId && !await selectProjectScope(projectId, session.serverId)) return;
  emit('delete-claude', session);
}
</script>

<style scoped>
.workspace-sidebar-backdrop { display: none; position: fixed; inset: calc(var(--header-h, 64px) + env(safe-area-inset-top, 0px)) 0 calc(var(--dock-h, 42px) + env(safe-area-inset-bottom, 0px)) 0; background: rgba(0, 0, 0, .62); z-index: 86; }
@media (max-width: 899px) { .workspace-sidebar-backdrop.open { display: block; } }
.desktop-workspace-sidebar {
  position: fixed; top: calc(var(--header-h, 64px) + env(safe-area-inset-top, 0px)); left: 0;
  bottom: calc(var(--dock-h, 42px) + env(safe-area-inset-bottom, 0px));
  max-width: calc(100vw - 48px); background: #171717; color: #d4d4d4;
  border-right: 1px solid #343434; z-index: 87; display: flex; flex-direction: column;
  overflow: visible; padding: 10px 9px 16px; gap: 12px;
  transform: translateX(-100%); transition: transform .18s ease; pointer-events: none;
}
.desktop-workspace-sidebar.open { transform: translateX(0); pointer-events: auto; }
.desktop-workspace-sidebar.resizing { transition: none; user-select: none; }
.dw-workspace-resize {
  position: absolute; top: 0; bottom: 0; right: -5px; width: 10px;
  cursor: ew-resize; z-index: 2; touch-action: none;
}
.dw-workspace-resize:hover, .dw-workspace-resize:focus-visible { background: rgba(160, 160, 160, .3); outline: none; }
@media (max-width: 899px) { .dw-workspace-resize { display: none; } }
.dw-top-header, .dw-section-head, .dw-sub-header { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.dw-top-header { padding: 2px 6px 6px; }
.dw-top-title { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 12px; font-weight: 800; }
.dw-top-title > i { color: #a5a5a5; font-size: 15px; }
.dw-project-scope-pill { color: #a6a6a6; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 110px; }
.dw-top-actions { display: flex; align-items: center; gap: 3px; }
.dw-close-btn, .dw-add-server-btn, .dw-section-head button, .dw-sub-header button, .dw-caret, .dw-item-actions button {
  background: transparent; border: 0; color: #a8a8a8; cursor: pointer; border-radius: 4px;
}
.dw-close-btn, .dw-add-server-btn { width: 25px; height: 25px; font-size: 16px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
.dw-add-server-btn:hover, .dw-add-server-btn.active { background: rgba(255, 255, 255, .08); color: #f5f5f5; }
.dw-scroll-content { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }
.dw-section { display: flex; flex-direction: column; gap: 5px; min-height: 0; }
.dw-section-head { padding: 1px 6px; color: #a5a5a5; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
.dw-section-actions { display: flex; align-items: center; gap: 4px; }
.dw-section-head button { font-size: 10px; padding: 3px 6px; display: inline-flex; align-items: center; gap: 3px; }
.dw-section-head button.active { background: #2c2c2c; color: #f5f5f5; }
.dw-add-server-menu {
  background: #1f1f1f;
  border: 1px solid #363636;
  border-radius: 6px;
  padding: 6px;
  margin: 2px 4px 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dw-add-server-title {
  font-size: 10px;
  font-weight: 700;
  color: #9e9e9e;
  padding: 2px 4px;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.dw-add-server-empty {
  font-size: 11px;
  color: #888888;
  padding: 4px 6px;
}
.dw-add-server-option,
.dw-add-server-manage-btn {
  width: 100%;
  min-height: 28px;
  padding: 4px 8px;
  border-radius: 5px;
  border: 0;
  background: #262626;
  color: #e5e5e5;
  font-family: monospace;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  text-align: left;
}
.dw-add-server-option:hover,
.dw-add-server-manage-btn:hover {
  background: #323232;
  color: #ffffff;
}
.dw-add-server-option span,
.dw-add-server-manage-btn span {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dw-add-server-plus {
  color: #a8a8a8;
  font-size: 13px;
}
.dw-add-server-manage-btn {
  border-top: 1px solid #333333;
  background: transparent;
  color: #b5b5b5;
  font-family: inherit;
}
.dw-list { display: flex; flex-direction: column; gap: 6px; padding-left: 8px; border-left: 1px solid #454545; }
.dw-server-group { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dw-server-children { display: flex; flex-direction: column; gap: 3px; margin-left: 10px; padding-left: 7px; border-left: 1px solid #363636; }
.dw-project-group { display: flex; flex-direction: column; min-width: 0; }
.dw-item {
  display: flex; align-items: center; gap: 5px; min-width: 0; min-height: 29px;
  padding: 3px 5px; color: #c5c5c5; cursor: pointer; border-radius: 5px;
  background: transparent;
}
.dw-item.server-item { background: rgba(255, 255, 255, .03); font-weight: 700; }
.dw-item:hover, .dw-sub-header button:hover, .dw-section-head button:hover, .dw-item-actions button:hover { background: rgba(255,255,255,.07); color: #f5f5f5; }
.dw-item.active { color: #f5f5f5; }
.dw-item.server-item.active {
  border: 1px solid rgba(52, 211, 153, 0.45);
  background: rgba(52, 211, 153, 0.08);
}
.dw-item.proj-item.active {
  border: 1px solid rgba(56, 189, 248, 0.45);
  background: rgba(56, 189, 248, 0.08);
}
.dw-item.term-item.active {
  border: 1px solid rgba(192, 132, 252, 0.45);
  background: rgba(192, 132, 252, 0.08);
}
.dw-item.claude-item.active {
  border: 1px solid rgba(245, 158, 11, 0.45);
  background: rgba(245, 158, 11, 0.08);
}
.dw-caret { width: 18px; height: 22px; flex-shrink: 0; font-size: 15px; }
.dw-item-main { display: flex; min-width: 0; flex: 1; }
.dw-item-title { display: flex; align-items: center; gap: 6px; min-width: 0; font-family: monospace; font-size: 11.5px; font-weight: 650; }
.dw-item-title > i { color: #a8a8a8; flex-shrink: 0; }
.dw-item-title > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dw-idx-badge { display: inline-block; font-family: monospace; font-size: 10px; font-weight: 400; line-height: 1; color: #787878; min-width: 11px; text-align: right; flex-shrink: 0; opacity: .78; user-select: none; }
.dw-item.active .dw-idx-badge { color: #d4d4d4; opacity: 1; font-weight: 600; }
.dw-kbd-tag { display: none; align-items: center; justify-content: center; font-family: monospace; font-size: 9.5px; color: #9a9a9a; background: #1d1d1d; border: 1px solid #2f2f2f; border-radius: 4px; padding: 1px 4px; flex-shrink: 0; line-height: 1.2; }
.desktop-workspace-sidebar.shortcut-labels-visible .dw-kbd-tag,
:global(.app-root.shortcut-labels-visible .dw-kbd-tag) { display: inline-flex; }
.dw-claude-running.status-indicator {
  width: 11px; height: 11px; border-radius: 50%;
  border: 1.8px solid rgba(245, 158, 11, .28); border-top-color: #f59e0b;
  animation: dwClaudeSpin .75s linear infinite; flex-shrink: 0;
}
.dw-item-actions { display: flex; align-items: center; flex-shrink: 0; gap: 2px; }
.dw-item-actions button { width: 19px; height: 20px; font-size: 11px; }
.dw-item-actions button.danger:hover { color: #fca5a5; }
@keyframes dwClaudeSpin { to { transform: rotate(360deg); } }
.dw-proj-children { display: flex; flex-direction: column; gap: 8px; margin-left: 13px; padding: 3px 0 8px 9px; }
.dw-sub-group { display: flex; flex-direction: column; gap: 2px; }
.dw-sub-header { min-height: 24px; padding: 2px 3px; color: #aaa; font-size: 10.5px; font-weight: 700; }
.dw-sub-header span { display: inline-flex; align-items: center; gap: 5px; }
.dw-sub-header button { width: 20px; height: 20px; font-size: 13px; }
.dw-session-list { display: flex; flex-direction: column; gap: 1px; margin-left: 6px; padding-left: 8px; border-left: 1px solid #343434; }
.dw-session-list .dw-item { min-height: 26px; }
.dw-error-msg { font-size: 11px; color: #a8a8a8; padding: 4px 6px; }
</style>
