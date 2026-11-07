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
    aria-label="Điều hướng nhanh Project và Session"
  >
    <div class="dw-top-header">
      <div class="dw-top-title">
        <i class="ri-layout-left-2-line" style="color: #38bdf8"></i>
        <span>Workspace</span>
        <span id="dw-active-project-pill" class="dw-project-scope-pill">
          {{ activeProjectName }}
        </span>
      </div>
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

    <!-- Project tree -->
    <div class="dw-scroll-content"><div class="dw-section">
      <div class="dw-section-head">
        <span><i class="ri-folder-2-line" style="color: #38bdf8"></i> Projects</span>
        <button
          id="btn-dw-manage-proj"
          type="button"
          title="Quản lý hoặc thêm Project"
          @click="handleOpenProjectModal"
        >
          <i class="ri-equalizer-line"></i> Quản lý
        </button>
      </div>
      <div id="dw-project-list" class="dw-list">
        <div v-for="(proj, projIdx) in projectStore.currentServerProjects" :key="proj.id"
          class="dw-project-group" :data-dw-project-group="proj.id">
          <div class="dw-item proj-item" :class="{ active: proj.id === projectStore.currentProject?.id }"
            :data-dw-project="proj.id" @click="handleSelectProject(proj.id)">
            <button type="button" class="dw-caret" :aria-label="collapsedProjectIds.has(proj.id) ? 'Mở nhóm Project' : 'Thu gọn nhóm Project'"
              :aria-expanded="!collapsedProjectIds.has(proj.id)" @click.stop="toggleProject(proj.id)">
              <i :class="collapsedProjectIds.has(proj.id) ? 'ri-arrow-right-s-line' : 'ri-arrow-down-s-line'"></i>
            </button>
            <div class="dw-item-main"><div class="dw-item-title">
              <span class="dw-idx-badge" :data-proj-index="projIdx + 1">{{ projIdx + 1 }}</span>
              <i :class="isHomeProject(proj) ? 'ri-home-4-line' : 'ri-folder-2-line'" style="color: #38bdf8"></i>
              <span>{{ proj.name }}</span>
            </div></div>
            <kbd v-if="shortcutStore.getItemShortcut('project', projIdx + 1)" class="dw-kbd-tag">{{ shortcutStore.getItemShortcut('project', projIdx + 1) }}</kbd>
            <span v-if="proj.id === projectStore.currentProject?.id" class="dw-active-dot" aria-label="Project đang chọn"></span>
            <div class="dw-item-actions" @click.stop>
              <button v-if="!isHomeProject(proj)" type="button" class="danger btn-dw-proj-del"
                title="Xóa project" @click="requestDeleteProject(proj)"><i class="ri-delete-bin-line"></i></button>
            </div>
          </div>
          <div v-if="!collapsedProjectIds.has(proj.id)" class="dw-proj-children">
            <div class="dw-sub-group">
              <div class="dw-sub-header"><span><i class="ri-terminal-box-line" style="color: #c084fc"></i> Terminal</span>
                <button type="button" :id="proj.id === projectStore.currentProject?.id ? 'btn-dw-new-term' : undefined"
                  title="Tạo Terminal trong Project" @click="handleOpenNewTerminal(proj.id)"><i class="ri-add-line"></i></button>
              </div>
              <div class="dw-session-list">
                <div v-for="s in sessionsForProject(proj.id, proj.rootPath, 'terminal')" :key="s.id"
                  class="dw-item term-item" :class="{ active: proj.id === projectStore.currentProject?.id && s.id === terminalStore.activeSession?.id }"
                  :data-dw-term="s.id" :data-dw-term-project="proj.id" @click="handleSelectTerminal(s)">
                  <div class="dw-item-main"><div class="dw-item-title"><span class="dw-idx-badge" :data-term-index="getTermIndex(s.id)">{{ getTermIndex(s.id) }}</span><i class="ri-terminal-box-line" style="color: #c084fc"></i><span>{{ s.name }}</span></div></div>
                  <kbd v-if="shortcutStore.getItemShortcut('terminal', getTermIndex(s.id))" class="dw-kbd-tag">{{ shortcutStore.getItemShortcut('terminal', getTermIndex(s.id)) }}</kbd>
                  <span v-if="proj.id === projectStore.currentProject?.id && s.id === terminalStore.activeSession?.id" class="dw-active-dot" aria-label="Terminal đang chọn"></span>
                  <div class="dw-item-actions" @click.stop>
                    <button type="button" class="btn-dw-term-edit" title="Chỉnh sửa phiên" @click="handleEditTerminal(s)"><i class="ri-edit-line"></i></button>
                    <button v-if="sessionsForProject(proj.id, proj.rootPath, 'terminal').length > 1" type="button" class="danger btn-dw-term-close"
                      title="Đóng phiên" :disabled="Boolean(closingTermId)" @click="requestCloseTerminal(s)"><i class="ri-close-line"></i></button>
                  </div>
                </div>
              </div>
            </div>
            <div class="dw-sub-group">
              <div class="dw-sub-header"><span><i class="ri-sparkling-fill" style="color: #f59e0b"></i> Claude</span>
                <button type="button" :id="proj.id === projectStore.currentProject?.id ? 'btn-dw-new-claude' : undefined"
                  title="Tạo Claude trong Project" @click="handleOpenNewClaude(proj.id)"><i class="ri-add-line"></i></button>
              </div>
              <div class="dw-session-list">
                <div v-for="s in sessionsForProject(proj.id, proj.rootPath, 'claude')" :key="s.id"
                  class="dw-item claude-item" :class="{ active: proj.id === projectStore.currentProject?.id && s.id === claudeStore.activeSession?.id, running: isClaudeSessionRunning(s) }"
                  :data-dw-claude="s.id" :data-dw-claude-project="proj.id" @click="handleSelectClaude(s)">
                  <div class="dw-item-main"><div class="dw-item-title"><span class="dw-idx-badge" :data-claude-index="getClaudeIndex(s.id)">{{ getClaudeIndex(s.id) }}</span><i class="ri-sparkling-fill" style="color: #f59e0b"></i><span>{{ displayClaudeName(s) }}</span></div></div>
                  <span v-if="isClaudeSessionRunning(s)" class="dw-claude-running status-indicator" aria-label="Claude đang làm việc"></span>
                  <kbd v-if="shortcutStore.getItemShortcut('claude', getClaudeIndex(s.id))" class="dw-kbd-tag">{{ shortcutStore.getItemShortcut('claude', getClaudeIndex(s.id)) }}</kbd>
                  <span v-if="proj.id === projectStore.currentProject?.id && s.id === claudeStore.activeSession?.id" class="dw-active-dot" aria-label="Claude đang chọn"></span>
                  <div class="dw-item-actions" @click.stop>
                    <button type="button" class="btn-dw-claude-edit" title="Chỉnh sửa phiên Claude" @click="handleEditClaude(s)"><i class="ri-edit-line"></i></button>
                    <button v-if="sessionsForProject(proj.id, proj.rootPath, 'claude').length > 1" type="button" class="danger btn-dw-claude-close"
                      title="Đóng phiên Claude" @click="handleDeleteClaude(s)"><i class="ri-close-line"></i></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div></div>

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
}>(), { panelWidth: 256 });

const emit = defineEmits<{
  (e: 'update:panelWidth', width: number): void;
  (e: 'close'): void;
  (e: 'open-project-modal'): void;
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
const deletingProjectTarget = ref<ProjectItem | null>(null);
const closingTermTarget = ref<TerminalSessionItem | null>(null);
const closingTermId = ref('');
const collapsedProjectIds = ref<Set<string>>(new Set());
const allClaudeSessions = ref<ClaudeSession[]>([]);
const minWidth = 220;
const isResizing = ref(false);
const effectiveMaxWidth = computed(() => typeof window === 'undefined' ? 520 : Math.max(minWidth, Math.min(520, window.innerWidth - 320)));

function toggleProject(id: string) {
  const next = new Set(collapsedProjectIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  collapsedProjectIds.value = next;
}

// Session store deliberately holds only the current Project's fetch. The tree
// loads an all-project snapshot separately and never overwrites an active stream.
let sessionRequest = 0;
async function refreshAllClaudeSessions() {
  const request = ++sessionRequest;
  const serverId = serverStore.currentServerId;
  try {
    const response = await fetch(apiUrl(`/api/claude/sessions?serverId=${encodeURIComponent(serverId)}`));
    if (!response.ok) return;
    const data = await response.json();
    if (request === sessionRequest && serverId === serverStore.currentServerId && Array.isArray(data.sessions)) {
      allClaudeSessions.value = data.sessions;
      claudeStore.syncServerSessionsStatus?.(serverId, data.sessions);
    }
  } catch { /* Keep the previously fetched tree if offline. */ }
}
watch(() => serverStore.currentServerId, () => {
  allClaudeSessions.value = [];
  refreshAllClaudeSessions();
});
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
  refreshAllClaudeSessions();
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

function resolveClaudeProjectId(session: ClaudeSession) {
  return session.projectId || projectStore.currentServerProjects.find(p =>
    p.rootPath.replace(/\/+$/, '') === session.cwd?.replace(/\/+$/, '')
  )?.id;
}

function sessionsForProject(id: string, rootPath: string, kind: 'terminal'): TerminalSessionItem[];
function sessionsForProject(id: string, rootPath: string, kind: 'claude'): ClaudeSession[];
function sessionsForProject(id: string, rootPath: string, kind: 'terminal' | 'claude'): TerminalSessionItem[] | ClaudeSession[] {
  if (kind === 'terminal') return terminalStore.sessions.filter(s => s.serverId === serverStore.currentServerId && s.projectId === id);
  const byId = new Map<string, ClaudeSession>();
  for (const s of [...allClaudeSessions.value, ...claudeStore.sessions]) {
    if (s.serverId !== serverStore.currentServerId) continue;
    if (s.projectId ? s.projectId === id : s.cwd?.replace(/\/+$/, '') === rootPath.replace(/\/+$/, '')) {
      const prev = byId.get(s.id);
      const isRunning = Boolean(prev?.isRunning || s.isRunning || claudeStore.isSessionRunning(s.id));
      byId.set(s.id, prev ? { ...prev, ...s, isRunning } : { ...s, isRunning });
    }
  }
  return [...byId.values()];
}

const termIndexMap = computed(() => {
  const map = new Map<string, number>();
  let idx = 0;
  for (const proj of projectStore.currentServerProjects) {
    for (const s of sessionsForProject(proj.id, proj.rootPath, 'terminal')) {
      idx++;
      map.set(s.id, idx);
    }
  }
  return map;
});

const claudeIndexMap = computed(() => {
  const map = new Map<string, number>();
  let idx = 0;
  for (const proj of projectStore.currentServerProjects) {
    for (const s of sessionsForProject(proj.id, proj.rootPath, 'claude')) {
      idx++;
      map.set(s.id, idx);
    }
  }
  return map;
});

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
  return project.name === '~' || project.rootPath === '~';
}

function closeOnMobileIfNeeded() {
  if (typeof window !== 'undefined' && window.innerWidth < 900) {
    emit('close');
  }
}

function handleOpenProjectModal() {
  emit('open-project-modal');
}

async function handleOpenNewTerminal(projectId: string) {
  if (!await selectProjectScope(projectId)) return;
  emit('open-new-terminal');
}

async function handleOpenNewClaude(projectId: string) {
  if (!await selectProjectScope(projectId)) return;
  emit('open-new-claude');
}

async function selectProjectScope(projectId: string): Promise<boolean> {
  if (projectId === projectStore.currentProject?.id) return true;
  sidebarError.value = '';
  try {
    if (!(await fileStore.confirmUnsavedChanges())) return false;
    await projectStore.selectProject(projectId);
    emit('project-selected');
    return true;
  } catch (err: any) {
    sidebarError.value = err?.message || 'Không thể chuyển Project.';
    return false;
  }
}

async function handleSelectProject(projectId: string) {
  await selectProjectScope(projectId);
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
    const wasCurrent = target.id === projectStore.currentProject?.id;
    if (wasCurrent && !(await fileStore.confirmUnsavedChanges())) return;
    await projectStore.deleteProject(target.id);
    if (wasCurrent) {
      emit('project-selected');
    }
  } catch (err: any) {
    sidebarError.value = err?.message || 'Không thể xóa Project.';
  }
}

async function handleSelectTerminal(session: TerminalSessionItem) {
  if (session.projectId && !await selectProjectScope(session.projectId)) return;
  terminalStore.switchSession(session.id);
  emit('select-terminal');
  closeOnMobileIfNeeded();
}

async function handleEditTerminal(session: TerminalSessionItem) {
  if (session.projectId && !await selectProjectScope(session.projectId)) return;
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
  if (target.projectId && !await selectProjectScope(target.projectId)) return;
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
  const projectId = resolveClaudeProjectId(session);
  if (projectId && !await selectProjectScope(projectId)) return;
  claudeStore.switchSession(session.id);
  emit('select-claude');
  closeOnMobileIfNeeded();
}

async function handleEditClaude(session: ClaudeSession) {
  const projectId = resolveClaudeProjectId(session);
  if (projectId && !await selectProjectScope(projectId)) return;
  emit('edit-claude', session);
}

async function handleDeleteClaude(session: ClaudeSession) {
  const projectId = resolveClaudeProjectId(session);
  if (projectId && !await selectProjectScope(projectId)) return;
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
.dw-close-btn, .dw-section-head button, .dw-sub-header button, .dw-caret, .dw-item-actions button {
  background: transparent; border: 0; color: #a8a8a8; cursor: pointer; border-radius: 4px;
}
.dw-close-btn { width: 25px; height: 25px; font-size: 16px; flex-shrink: 0; }
.dw-scroll-content { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }
.dw-section { display: flex; flex-direction: column; gap: 5px; min-height: 0; }
.dw-section-head { padding: 1px 6px; color: #a5a5a5; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
.dw-section-head button { font-size: 10px; padding: 3px 5px; }
.dw-list { display: flex; flex-direction: column; gap: 3px; padding-left: 8px; border-left: 1px solid #454545; }
.dw-project-group { display: flex; flex-direction: column; min-width: 0; }
.dw-item { display: flex; align-items: center; gap: 5px; min-width: 0; min-height: 29px; padding: 3px 4px; color: #c5c5c5; cursor: pointer; border-radius: 4px; background: transparent; }
.dw-item:hover, .dw-sub-header button:hover, .dw-section-head button:hover, .dw-item-actions button:hover { background: rgba(255,255,255,.07); color: #f5f5f5; }
.dw-item.active { color: #f5f5f5; }
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
.dw-active-dot { width: 6px; height: 6px; border-radius: 50%; background: #e7e7e7; flex-shrink: 0; }
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