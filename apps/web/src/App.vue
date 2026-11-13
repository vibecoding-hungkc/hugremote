<template>
  <AuthGate v-if="authStore.loading || authStore.needsLogin" />
  <div
    v-else
    class="app-root"
    :class="{
      'quick-tree-open': isQuickPanelActive,
      'workspace-sidebar-open': isWorkspaceSidebarOpen,
      'is-desktop-device': isDesktopDevice,
    }"
    :data-device-type="isDesktopDevice ? 'desktop' : 'mobile'"
    :style="{ '--quick-panel-width': `${quickPanelWidth}px`, '--workspace-sidebar-width': `${workspaceSidebarWidth}px` }"
  >
    <!-- 1. Smart Unified Header -->
    <SmartHeader
      :active-tab="activeTab"
      :quick-panel-open="isQuickPanelActive"
      :quick-panel-mode="quickPanelMode"
      :workspace-sidebar-open="isWorkspaceSidebarOpen"
      @open-server-drawer="isServerDrawerOpen = true"
      @open-project-modal="isProjectModalOpen = true"
      @open-session-hub="isSessionHubOpen = true"
      @open-new-terminal-modal="openNewTerminalModal"
      @open-claude-hub="isClaudeHubOpen = true"
      @open-new-claude-modal="openNewClaudeModal"
      @prompt-create-item="promptCreateItem"
      @change-tab="tab => activeTab = tab"
      @toggle-quick-panel="toggleQuickPanel"
      @toggle-workspace-sidebar="toggleWorkspaceSidebar"
    />

    <!-- 1b. Left Workspace Sidebar (Projects + Project-Scoped Terminal & Claude Sessions) -->
    <WorkspaceSidebar
      :is-open="isWorkspaceSidebarOpen"
      :panel-width="workspaceSidebarWidth"
      :active-tab="activeTab"
      @update:panel-width="handleWorkspaceSidebarWidthChange"
      @close="setWorkspaceSidebarOpen(false)"
      @open-project-modal="isProjectModalOpen = true"
      @open-server-modal="isServerModalOpen = true"
      @project-selected="handleScopeChanged"
      @open-new-terminal="openNewTerminalModal"
      @edit-terminal="handleEditTerminalSession"
      @select-terminal="activeTab = 'terminal'"
      @open-new-claude="openNewClaudeModal"
      @edit-claude="handleEditClaudeSession"
      @delete-claude="handleDeleteClaudeSession"
      @select-claude="activeTab = 'claude'"
      @open-spotlight="openSpotlight"
    />

    <SpotlightSearch
      :is-open="isSpotlightOpen"
      :items="spotlightItems"
      @close="closeSpotlight"
      @select="handleSpotlightSelect"
    />

    <!-- 2. Main Viewport Area -->
    <main class="main-content">
      <!-- Tab 1: Files View -->
      <FileExplorer
        v-if="activeTab === 'files'"
        @open-file="handleOpenFile"
        @open-folder-as-project="handleOpenFolderAsProject"
      />

      <!-- Tab 2: Editor View -->
      <CodeEditor
        v-else-if="activeTab === 'editor'"
      />

      <!-- Tab 3: Terminal View -->
      <TerminalView
        v-show="activeTab === 'terminal'"
        :is-active="activeTab === 'terminal'"
      />

      <!-- Tab 4: Claude View -->
      <ClaudeView
        v-show="activeTab === 'claude'"
        :is-active="activeTab === 'claude'"
        @open-session-hub="isClaudeHubOpen = true"
      />

      <GitView
        v-show="activeTab === 'git'"
      />

      <SettingsView
        v-show="activeTab === 'settings'"
      />
    </main>

    <!-- 2b. Quick Workspace Panel (Folder Tree + Inline Editor + Quick Git for Terminal & Claude) -->
    <QuickWorkspacePanel
      :is-open="isQuickPanelActive"
      :mode="quickPanelMode"
      :panel-width="quickPanelWidth"
      @close="isQuickPanelOpen = false"
      @update:mode="mode => quickPanelMode = mode"
      @update:panel-width="handleQuickPanelWidthChange"
    />

    <div v-if="activeTab === 'editor' && fileStore.error" class="editor-save-error" role="alert">{{ fileStore.error }}</div>

    <!-- 3. Compact Bottom Dock -->
    <BottomDock
      :active-tab="activeTab"
      @change-tab="tab => activeTab = tab"
    />

    <!-- 4. Modals -->
    <ServerDrawer
      :is-open="isServerDrawerOpen"
      @close="isServerDrawerOpen = false"
      @open-server-manager="openServerManager"
      @selected="handleScopeChanged"
    />

    <ServerModal
      :is-open="isServerModalOpen"
      @selected="handleScopeChanged"
      @close="isServerModalOpen = false"
    />

    <ProjectModal
      :is-open="isProjectModalOpen"
      @close="isProjectModalOpen = false"
      @selected="handleScopeChanged"
    />

    <TerminalSessionHubModal
      :is-open="isSessionHubOpen"
      @close="isSessionHubOpen = false"
      @open-new="openNewTerminalModalFromHub"
      @edit-session="handleEditTerminalSession"
      @select="activeTab = 'terminal'"
    />

    <!-- 5. New Terminal Modal -->
    <NewTerminalModal
      :is-open="isNewTerminalModalOpen"
      :session="editingTerminalSession"
      @close="closeTerminalForm"
      @created="activeTab = 'terminal'"
      @updated="handleTerminalSessionUpdated"
    />

    <!-- 6. Create File / Folder Modal -->
    <CreateItemModal
      ref="createItemModalRef"
      :is-open="isCreateItemModalOpen"
      :current-path="fileStore.currentRel || '/'"
      @close="isCreateItemModalOpen = false"
      @create="handleCreateItem"
    />

    <!-- 8. Claude Session Hub Modal -->
    <ClaudeSessionHubModal
      :is-open="isClaudeHubOpen"
      @close="isClaudeHubOpen = false"
      @open-new-modal="openNewClaudeModalFromHub"
      @edit-session="handleEditClaudeSession"
      @delete-session="handleDeleteClaudeSession"
    />

    <!-- 9. New Claude Session Modal -->
    <NewClaudeModal
      :is-open="isNewClaudeModalOpen"
      :session="editingClaudeSession"
      @close="closeClaudeForm"
      @created="activeTab = 'claude'"
      @updated="handleClaudeSessionUpdated"
    />

    <!-- 11. Confirm Delete Claude Session Modal -->
    <ConfirmModal
      :is-open="isConfirmDeleteClaudeOpen"
      :title="t('confirm.deleteClaudeTitle')"
      :message="t('confirm.deleteClaudeMessage', { name: deleteClaudeTargetName })"
      :confirm-label="t('confirm.deleteClaudeConfirm')"
      :is-danger="true"
      @close="isConfirmDeleteClaudeOpen = false"
      @confirm="executeDeleteClaudeSession"
    />

    <UnsavedChangesModal />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import SmartHeader from './components/SmartHeader.vue';
import WorkspaceSidebar from './components/WorkspaceSidebar.vue';
import SpotlightSearch from './components/SpotlightSearch.vue';
import QuickWorkspacePanel from './components/QuickWorkspacePanel.vue';
import FileExplorer from './components/FileExplorer.vue';
import CodeEditor from './components/CodeEditor.vue';
import TerminalView from './components/TerminalView.vue';
import ClaudeView from './components/ClaudeView.vue';
import GitView from './components/GitView.vue';
import SettingsView from './components/SettingsView.vue';
import BottomDock from './components/BottomDock.vue';
import ServerModal from './components/ServerModal.vue';
import ServerDrawer from './components/ServerDrawer.vue';
import ProjectModal from './components/ProjectModal.vue';
import NewTerminalModal from './components/NewTerminalModal.vue';
import TerminalSessionHubModal from './components/TerminalSessionHubModal.vue';
import ClaudeSessionHubModal from './components/ClaudeSessionHubModal.vue';
import NewClaudeModal from './components/NewClaudeModal.vue';
import CreateItemModal from './components/CreateItemModal.vue';
import ConfirmModal from './components/ConfirmModal.vue';
import UnsavedChangesModal from './components/UnsavedChangesModal.vue';
import AuthGate from './components/AuthGate.vue';

import { useServerStore } from './stores/serverStore.js';
import { useFileStore } from './stores/fileStore.js';
import { useTerminalStore } from './stores/terminalStore.js';
import { useClaudeStore } from './stores/claudeStore.js';
import { useProjectStore } from './stores/projectStore.js';
import { useGitStore } from './stores/gitStore.js';
import { useAppBootstrap } from './composables/useAppBootstrap.js';
import { useI18n } from './composables/useI18n.js';
import { useAppRouter } from './app/router.js';
import { useDesktopDevice } from './utils/device.js';
import { buildSpotlightItems, isSpotlightHotkey } from './utils/spotlight.js';

const { authStore } = useAppBootstrap();
const { isDesktopDevice } = useDesktopDevice();
const serverStore = useServerStore();
const fileStore = useFileStore();
const terminalStore = useTerminalStore();
const claudeStore = useClaudeStore();
const projectStore = useProjectStore();
const gitStore = useGitStore();
const { t } = useI18n();

const { activeTab, navigateTo } = useAppRouter();
const isWorkspaceSidebarOpen = ref(
  typeof window !== 'undefined' && typeof window.innerWidth === 'number'
    ? window.innerWidth >= 900
    : false
);
const storedWorkspaceWidthText = typeof localStorage !== 'undefined'
  ? localStorage.getItem('hugremote_workspace_sidebar_width') : null;
const storedWorkspaceWidth = storedWorkspaceWidthText === null ? NaN : Number(storedWorkspaceWidthText);
const workspaceSidebarWidth = ref(Number.isFinite(storedWorkspaceWidth)
  ? Math.min(520, Math.max(220, storedWorkspaceWidth)) : 256);
function handleWorkspaceSidebarWidthChange(width: number) {
  workspaceSidebarWidth.value = width;
  if (typeof localStorage !== 'undefined') localStorage.setItem('hugremote_workspace_sidebar_width', String(width));
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}
const isQuickPanelOpen = ref(false);
const quickPanelMode = ref<'files' | 'git'>('files');
const quickPanelWidth = ref(320);
const isQuickPanelActive = computed(() => isQuickPanelOpen.value);

function setWorkspaceSidebarOpen(open: boolean) {
  isWorkspaceSidebarOpen.value = Boolean(open);
  if (typeof window !== 'undefined') {
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
}

function toggleWorkspaceSidebar() {
  setWorkspaceSidebarOpen(!isWorkspaceSidebarOpen.value);
}

function toggleQuickPanel(mode: 'files' | 'git') {
  if (isQuickPanelOpen.value && quickPanelMode.value === mode) {
    isQuickPanelOpen.value = false;
  } else {
    quickPanelMode.value = mode;
    isQuickPanelOpen.value = true;
  }
  if (typeof window !== 'undefined') {
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
}

function handleQuickPanelWidthChange(width: number) {
  quickPanelWidth.value = width;
  if (typeof window !== 'undefined') {
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
}
const isServerDrawerOpen = ref(false);
const isProjectModalOpen = ref(false);
const isServerModalOpen = ref(false);
const isSessionHubOpen = ref(false);
const isNewTerminalModalOpen = ref(false);
const editingTerminalSession = ref<any | null>(null);
const isCreateItemModalOpen = ref(false);
const createItemModalRef = ref<any>(null);

// Claude Modals State
const isClaudeHubOpen = ref(false);
const isNewClaudeModalOpen = ref(false);
const editingClaudeSession = ref<any | null>(null);
const isConfirmDeleteClaudeOpen = ref(false);
const deleteClaudeTargetId = ref('');
const deleteClaudeTargetName = ref('');
// Tab switches preserve the buffer in the store. Browser unload must still warn.
function warnUnsaved(event: BeforeUnloadEvent) {
  if (!fileStore.activeFile?.isDirty) return;
  event.preventDefault();
  event.returnValue = '';
}

onMounted(() => {
  window.addEventListener('beforeunload', warnUnsaved);
  window.addEventListener('keydown', handleSpotlightHotkey, true);
});
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', warnUnsaved);
  window.removeEventListener('keydown', handleSpotlightHotkey, true);
});

async function handleOpenFile(relPath: string) {
  if (await fileStore.openFile(relPath)) activeTab.value = 'editor';
}

async function handleOpenFolderAsProject(relPath: string) {
  if (!(await fileStore.confirmUnsavedChanges())) return;
  const root = serverStore.currentServer.workspace || '~';
  const fullPath = root.endsWith('/') ? `${root}${relPath}` : `${root}/${relPath}`;
  await projectStore.openProject(fullPath);
  await handleScopeChanged();
}

function promptCreateItem() {
  isCreateItemModalOpen.value = true;
}


function openServerManager() {
  isServerDrawerOpen.value = false;
  isServerModalOpen.value = true;
}

async function handleScopeChanged() {
  if (!(await fileStore.closeActiveFile())) return;
  if (activeTab.value === 'editor') activeTab.value = 'files';
  terminalStore.ensureServerSession();
  await fileStore.fetchFiles();
  await Promise.all([
    claudeStore.fetchModels(serverStore.currentServerId),
    claudeStore.ensureProjectSession(),
  ]);
  await gitStore.fetchStatus();
}


// ---- Spotlight quick search (single global hotkey) ----
const isSpotlightOpen = ref(false);

const spotlightItems = computed(() => {
  const servers = serverStore.workspaceServers;
  const projects = servers.flatMap(srv => projectStore.projectsForServer(srv.id));
  const serverIds = new Set(servers.map(s => s.id));
  const items = buildSpotlightItems({
    servers: servers.map(s => ({ id: s.id, name: s.name })),
    projects: projects.map(p => ({ id: p.id, serverId: p.serverId, name: p.name, rootPath: p.rootPath })),
    terminals: terminalStore.sessions.filter(s => serverIds.has(s.serverId)),
    claudes: claudeStore.sessions.filter(s => serverIds.has(s.serverId)),
  });
  return items.map(item => ({
    ...item,
    isCurrent:
      item.kind === 'project'
        ? item.serverId === serverStore.currentServerId && item.id === projectStore.currentProject?.id
        : item.kind === 'claude'
          ? item.id === claudeStore.activeSessionId && activeTab.value === 'claude'
          : item.id === terminalStore.activeSessionId && activeTab.value === 'terminal',
  }));
});

function openSpotlight() {
  isSpotlightOpen.value = true;
}

function closeSpotlight() {
  isSpotlightOpen.value = false;
}

async function handleSpotlightSelect(item: { kind: 'project' | 'claude' | 'terminal'; id: string; serverId: string; projectId?: string }) {
  closeSpotlight();
  const needsScope =
    item.serverId !== serverStore.currentServerId ||
    (!!item.projectId && item.projectId !== projectStore.currentProject?.id);
  if (needsScope) {
    if (!(await fileStore.confirmUnsavedChanges())) return;
    if (item.serverId !== serverStore.currentServerId) {
      serverStore.selectServer(item.serverId);
    }
    if (item.projectId) {
      await projectStore.selectProject(item.projectId, item.serverId);
    }
    await handleScopeChanged();
  }
  if (item.kind === 'terminal') {
    terminalStore.switchSession(item.id);
    activeTab.value = 'terminal';
  } else if (item.kind === 'claude') {
    claudeStore.switchSession(item.id);
    activeTab.value = 'claude';
  }
}

function handleSpotlightHotkey(event: KeyboardEvent) {
  if (!isSpotlightHotkey(event, navigator.platform || navigator.userAgent)) return;
  event.preventDefault();
  event.stopPropagation();
  isSpotlightOpen.value = !isSpotlightOpen.value;
}

// Scope selectors emit only after projects are loaded; avoid duplicate watcher refreshes.

watch(activeTab, async (tab) => {
  if (isQuickPanelOpen.value && quickPanelMode.value === 'git' && tab !== 'terminal' && tab !== 'claude') {
    quickPanelMode.value = 'files';
  }
  if (tab === 'git') {
    await gitStore.fetchStatus();
    await gitStore.fetchBranches();
  }
});

async function handleCreateItem({ name, type }: { name: string; type: 'file' | 'dir' }) {
  try {
    await fileStore.createItem(name, type);
    isCreateItemModalOpen.value = false;
  } catch (err: any) {
    createItemModalRef.value?.setError(`Lỗi tạo: ${err.message}`);
  }
}

function openNewTerminalModal() {
  editingTerminalSession.value = null;
  isNewTerminalModalOpen.value = true;
}

function openNewTerminalModalFromHub() {
  isSessionHubOpen.value = false;
  openNewTerminalModal();
}

function handleEditTerminalSession(session: any) {
  editingTerminalSession.value = { ...session };
  isSessionHubOpen.value = false;
  isNewTerminalModalOpen.value = true;
}

function closeTerminalForm() {
  isNewTerminalModalOpen.value = false;
  editingTerminalSession.value = null;
}

function handleTerminalSessionUpdated() {
  activeTab.value = 'terminal';
}

// Claude Handlers
function openNewClaudeModal() {
  editingClaudeSession.value = null;
  isNewClaudeModalOpen.value = true;
}

function openNewClaudeModalFromHub() {
  isClaudeHubOpen.value = false;
  openNewClaudeModal();
}

function handleEditClaudeSession(session: any) {
  editingClaudeSession.value = { ...session };
  isClaudeHubOpen.value = false;
  isNewClaudeModalOpen.value = true;
}

function closeClaudeForm() {
  isNewClaudeModalOpen.value = false;
  editingClaudeSession.value = null;
}

function handleClaudeSessionUpdated() {
  activeTab.value = 'claude';
}

function handleDeleteClaudeSession(session: any) {
  deleteClaudeTargetId.value = session.id;
  deleteClaudeTargetName.value = session.name;
  isConfirmDeleteClaudeOpen.value = true;
}

async function executeDeleteClaudeSession() {
  if (deleteClaudeTargetId.value) {
    await claudeStore.deleteSession(deleteClaudeTargetId.value);
    isConfirmDeleteClaudeOpen.value = false;
  }
}


</script>

<style>
.editor-save-error { color: #b8b8b8; padding: 8px 16px; background: #171717; font-size: 13px; }
/* Reset & Global Mobile-First CSS */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
  scrollbar-width: thin;
  scrollbar-color: rgba(163, 163, 163, 0.4) transparent;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(163, 163, 163, 0.35);
  border-radius: 9999px;
  transition: background 0.15s ease;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(163, 163, 163, 0.6);
}

::-webkit-scrollbar-thumb:active {
  background: rgba(163, 163, 163, 0.85);
}

::-webkit-scrollbar-corner {
  background: transparent;
}

html, body {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  background: #161616;
  color: #eeeeee;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.app-root {
  --header-h: 64px;
  --dock-h: 42px;
  position: fixed;
  inset: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-top: env(safe-area-inset-top, 0px);
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}

.main-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  overflow-x: hidden;
  position: relative;
  width: 100%;
  max-width: 100vw;
  overscroll-behavior-x: none;
  transition:
    padding-left 0.18s cubic-bezier(0.16, 1, 0.3, 1),
    padding-right 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (min-width: 900px) {
  .app-root.workspace-sidebar-open .main-content {
    padding-left: var(--workspace-sidebar-width, 256px);
  }
  .app-root.workspace-sidebar-open .smart-header-center {
    padding-left: calc(var(--workspace-sidebar-width, 256px) + 6px);
  }
}

@media (min-width: 800px) {
  .app-root.quick-tree-open .main-content {
    padding-right: var(--quick-panel-width, 320px);
  }
  .app-root.quick-tree-open .smart-header-right {
    padding-right: calc(var(--quick-panel-width, 320px) + 6px) !important;
  }
}

/* Hub Overlay */
.hub-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.hub-sheet {
  background: #171717;
  border-top: 1px solid #3f3f3f;
  border-radius: 14px 14px 0 0;
  width: 100%;
  max-width: 600px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  padding: 14px 16px;
  gap: 12px;
}

.hub-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hub-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #eeeeee;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-hub-close {
  background: transparent;
  border: none;
  color: #a1a1a1;
  font-size: 18px;
  cursor: pointer;
}

.hub-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.hub-card {
  background: #282828;
  border: 1px solid #3f3f3f;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
}
.hub-card.active {
  border-color: #6f6f6f;
  background: rgba(53, 53, 53, 0.133);
}

.hub-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hub-card-name {
  font-family: monospace;
  font-weight: 600;
  font-size: 13px;
  color: #d3d3d3;
}

.hub-badge-active {
  font-size: 9.5px;
  background: rgba(64, 64, 64, 0.2);
  color: #989898;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
}

.hub-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hub-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.btn-action-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #282828;
  border: 1px solid #3f3f3f;
  border-radius: 6px;
  color: #d4d4d4;
  font-size: 15px;
  cursor: pointer;
  touch-action: manipulation;
  flex-shrink: 0;
}

.btn-action-icon:hover {
  background: #333333;
  color: #eeeeee;
}

.btn-action-icon:active {
  background: #3f3f3f;
  transform: scale(0.96);
}

.btn-action-icon.danger {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.08);
}

.btn-action-icon.danger:hover {
  background: rgba(239, 68, 68, 0.18);
  border-color: rgba(239, 68, 68, 0.5);
  color: #f87171;
}

.btn-action-icon.danger:active {
  background: rgba(239, 68, 68, 0.28);
}

.btn-hub-create {
  background: #404040;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-weight: 600;
  font-size: 12.5px;
  padding: 8px;
  cursor: pointer;
}
</style>
