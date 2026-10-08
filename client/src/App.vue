<template>
  <AuthGate v-if="authStore.loading || authStore.needsLogin" />
  <div v-else class="app-root">
    <!-- 1. Smart Unified Header -->
    <SmartHeader
      :active-tab="activeTab"
      @open-server-modal="isServerModalOpen = true"
      @open-session-hub="isSessionHubOpen = true"
      @open-new-terminal-modal="openNewTerminalModal"
      @open-claude-hub="isClaudeHubOpen = true"
      @open-new-claude-modal="openNewClaudeModal"
      @prompt-create-item="promptCreateItem"
      @change-tab="tab => activeTab = tab"
    />

    <!-- 2. Main Viewport Area -->
    <main class="main-content">
      <!-- Tab 1: Files View -->
      <FileExplorer
        v-if="activeTab === 'files'"
        @open-file="handleOpenFile"
      />

      <!-- Tab 2: Editor View -->
      <CodeEditor
        v-else-if="activeTab === 'editor'"
      />

      <!-- Tab 3: Terminal View -->
      <TerminalView
        v-show="activeTab === 'terminal'"
      />

      <!-- Tab 4: Claude View -->
      <ClaudeView
        v-show="activeTab === 'claude'"
        @open-tree-picker="isClaudeAttachTreePickerOpen = true"
      />
    </main>

    <!-- 3. Compact Bottom Dock -->
    <BottomDock
      :active-tab="activeTab"
      @change-tab="tab => activeTab = tab"
    />

    <!-- 4. Modals -->
    <ServerModal
      :is-open="isServerModalOpen"
      @close="isServerModalOpen = false"
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
      title="Đóng Phiên Claude"
      :message="`Bạn có chắc chắn muốn đóng phiên chat '${deleteClaudeTargetName}' không?`"
      confirm-label="Đóng Phiên"
      :is-danger="true"
      @close="isConfirmDeleteClaudeOpen = false"
      @confirm="executeDeleteClaudeSession"
    />

    <!-- 12. Context Attachment Folder Tree Picker -->
    <FolderTreePicker
      :is-open="isClaudeAttachTreePickerOpen"
      :initial-path="serverStore.currentServer.workspace || '~'"
      :server-id="serverStore.currentServer.id"
      :server-type="serverStore.currentServer.type"
      :server-workspace="serverStore.currentServer.workspace"
      @close="isClaudeAttachTreePickerOpen = false"
      @confirm="handleClaudeAttachFolder"
      @selected="handleClaudeAttachFolder"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import SmartHeader from './components/SmartHeader.vue';
import FileExplorer from './components/FileExplorer.vue';
import CodeEditor from './components/CodeEditor.vue';
import TerminalView from './components/TerminalView.vue';
import ClaudeView from './components/ClaudeView.vue';
import BottomDock from './components/BottomDock.vue';
import ServerModal from './components/ServerModal.vue';
import NewTerminalModal from './components/NewTerminalModal.vue';
import TerminalSessionHubModal from './components/TerminalSessionHubModal.vue';
import ClaudeSessionHubModal from './components/ClaudeSessionHubModal.vue';
import NewClaudeModal from './components/NewClaudeModal.vue';
import CreateItemModal from './components/CreateItemModal.vue';
import ConfirmModal from './components/ConfirmModal.vue';
import FolderTreePicker from './components/FolderTreePicker.vue';
import AuthGate from './components/AuthGate.vue';

import { useServerStore } from './stores/serverStore.js';
import { useFileStore } from './stores/fileStore.js';
import { useTerminalStore } from './stores/terminalStore.js';
import { useClaudeStore } from './stores/claudeStore.js';
import { useAppBootstrap } from './composables/useAppBootstrap.js';

const { authStore } = useAppBootstrap();
const serverStore = useServerStore();
const fileStore = useFileStore();
const terminalStore = useTerminalStore();
const claudeStore = useClaudeStore();

const activeTab = ref<'files' | 'editor' | 'terminal' | 'claude'>('files');
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
const isClaudeAttachTreePickerOpen = ref(false);

async function handleOpenFile(relPath: string) {
  await fileStore.openFile(relPath);
  activeTab.value = 'editor';
}

function promptCreateItem() {
  isCreateItemModalOpen.value = true;
}

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

function handleClaudeAttachFolder(folderPath: string) {
  isClaudeAttachTreePickerOpen.value = false;
  const session = claudeStore.activeSession;
  if (session) {
    claudeStore.updateSession(session.id, { cwd: folderPath });
  }
}

</script>

<style>
/* Reset & Global Mobile-First CSS */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

html, body {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  background: #090d16;
  color: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.app-root {
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
  background: #0f172a;
  border-top: 1px solid #334155;
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
  color: #f1f5f9;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-hub-close {
  background: transparent;
  border: none;
  color: #94a3b8;
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
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
}
.hub-card.active {
  border-color: #6366f1;
  background: #312e8122;
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
  color: #c7d2fe;
}

.hub-badge-active {
  font-size: 9.5px;
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
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
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #cbd5e1;
  font-size: 15px;
  cursor: pointer;
  touch-action: manipulation;
  flex-shrink: 0;
}

.btn-action-icon:hover {
  background: #273549;
  color: #f1f5f9;
}

.btn-action-icon:active {
  background: #334155;
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
  background: #2563eb;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-weight: 600;
  font-size: 12.5px;
  padding: 8px;
  cursor: pointer;
}
</style>
