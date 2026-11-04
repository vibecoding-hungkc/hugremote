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
    :class="{ open: isOpen }"
    aria-label="Điều hướng nhanh Project và Session"
  >
    <div class="dw-top-header">
      <div class="dw-top-title">
        <i class="ri-layout-left-2-line"></i>
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

    <!-- 1. Projects -->
    <div class="dw-section">
      <div class="dw-section-head">
        <span><i class="ri-folder-2-line"></i> Projects</span>
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
        <div
          v-for="proj in projectStore.currentServerProjects"
          :key="proj.id"
          class="dw-item proj-item"
          :class="{ active: proj.id === projectStore.currentProject?.id }"
          :data-dw-project="proj.id"
          @click="handleSelectProject(proj.id)"
        >
          <div class="dw-item-main">
            <div class="dw-item-title">
              <i :class="isHomeProject(proj) ? 'ri-home-4-line' : 'ri-folder-2-line'" style="color: #38bdf8"></i>
              <span>{{ proj.name }}</span>
            </div>
          </div>
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
      </div>
    </div>

    <!-- 2. Terminal Sessions (Scoped to Active Project) -->
    <div class="dw-section">
      <div class="dw-section-head">
        <span><i class="ri-terminal-box-line"></i> Phiên Terminal</span>
        <button
          id="btn-dw-new-term"
          type="button"
          title="Tạo cửa sổ Terminal mới trong Project này"
          @click="handleOpenNewTerminal"
        >
          <i class="ri-add-line"></i> Tạo mới
        </button>
      </div>
      <div id="dw-term-list" class="dw-list">
        <div
          v-for="s in terminalStore.currentServerSessions"
          :key="s.id"
          class="dw-item term-item"
          :class="{ active: s.id === terminalStore.activeSession?.id }"
          :data-dw-term="s.id"
          @click="handleSelectTerminal(s.id)"
        >
          <div class="dw-item-main">
            <div class="dw-item-title">
              <i class="ri-terminal-box-line" style="color: #c084fc"></i>
              <span>{{ s.name }}</span>
            </div>
          </div>
          <div class="dw-item-actions" @click.stop>
            <button
              type="button"
              class="btn-dw-term-edit"
              title="Chỉnh sửa phiên"
              @click="$emit('edit-terminal', s)"
            >
              <i class="ri-edit-line"></i>
            </button>
            <button
              v-if="terminalStore.currentServerSessions.length > 1"
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

    <!-- 3. Claude Sessions (Scoped to Active Project) -->
    <div class="dw-section">
      <div class="dw-section-head">
        <span><i class="ri-sparkling-fill" style="color: #f59e0b"></i> Phiên Claude</span>
        <button
          id="btn-dw-new-claude"
          type="button"
          title="Tạo phiên Claude mới trong Project này"
          @click="handleOpenNewClaude"
        >
          <i class="ri-add-line"></i> Tạo mới
        </button>
      </div>
      <div id="dw-claude-list" class="dw-list">
        <div
          v-for="s in claudeStore.currentServerSessions"
          :key="s.id"
          class="dw-item claude-item"
          :class="{ active: s.id === claudeStore.activeSession?.id }"
          :data-dw-claude="s.id"
          @click="handleSelectClaude(s.id)"
        >
          <div class="dw-item-main">
            <div class="dw-item-title">
              <i class="ri-sparkling-fill" style="color: #f59e0b"></i>
              <span>{{ s.name }}</span>
            </div>
          </div>
          <div class="dw-item-actions" @click.stop>
            <button
              type="button"
              class="btn-dw-claude-edit"
              title="Chỉnh sửa phiên Claude"
              @click="$emit('edit-claude', s)"
            >
              <i class="ri-edit-line"></i>
            </button>
            <button
              v-if="claudeStore.currentServerSessions.length > 1"
              type="button"
              class="danger btn-dw-claude-close"
              title="Đóng phiên Claude"
              @click="$emit('delete-claude', s)"
            >
              <i class="ri-close-line"></i>
            </button>
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
import { computed, ref } from 'vue';
import { useServerStore } from '../stores/serverStore.js';
import { useProjectStore, type ProjectItem } from '../stores/projectStore.js';
import { useTerminalStore, type TerminalSessionItem } from '../stores/terminalStore.js';
import { useClaudeStore } from '../stores/claudeStore.js';
import { useFileStore } from '../stores/fileStore.js';
import ConfirmModal from './ConfirmModal.vue';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
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

const sidebarError = ref('');
const deletingProjectTarget = ref<ProjectItem | null>(null);
const closingTermTarget = ref<TerminalSessionItem | null>(null);
const closingTermId = ref('');

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

function handleOpenNewTerminal() {
  emit('open-new-terminal');
}

function handleOpenNewClaude() {
  emit('open-new-claude');
}

async function handleSelectProject(projectId: string) {
  if (projectId === projectStore.currentProject?.id) return;
  sidebarError.value = '';
  try {
    if (!(await fileStore.confirmUnsavedChanges())) return;
    await projectStore.selectProject(projectId);
    emit('project-selected');
  } catch (err: any) {
    sidebarError.value = err?.message || 'Không thể chuyển Project.';
  }
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

function handleSelectTerminal(sessionId: string) {
  terminalStore.switchSession(sessionId);
  emit('select-terminal');
  closeOnMobileIfNeeded();
}

function requestCloseTerminal(session: TerminalSessionItem) {
  if (closingTermId.value || terminalStore.currentServerSessions.length <= 1) return;
  closingTermTarget.value = session;
}

async function executeCloseTerminal() {
  const target = closingTermTarget.value;
  if (!target) return;
  closingTermTarget.value = null;
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

function handleSelectClaude(sessionId: string) {
  claudeStore.switchSession(sessionId);
  emit('select-claude');
  closeOnMobileIfNeeded();
}
</script>

<style scoped>
.workspace-sidebar-backdrop {
  display: none;
  position: fixed;
  inset: calc(var(--header-h, 64px) + env(safe-area-inset-top, 0px)) 0 calc(var(--dock-h, 42px) + env(safe-area-inset-bottom, 0px)) 0;
  background: rgba(22, 22, 22, 0.62);
  backdrop-filter: blur(2px);
  z-index: 86;
}
.workspace-sidebar-backdrop.open {
  display: block;
}
@media (min-width: 900px) {
  .workspace-sidebar-backdrop,
  .workspace-sidebar-backdrop.open {
    display: none !important;
  }
}

.desktop-workspace-sidebar {
  position: fixed;
  top: calc(var(--header-h, 64px) + env(safe-area-inset-top, 0px));
  left: 0;
  bottom: calc(var(--dock-h, 42px) + env(safe-area-inset-bottom, 0px));
  width: 256px;
  max-width: calc(100vw - 48px);
  background:
    linear-gradient(180deg, rgba(22, 22, 22, 0.99) 0%, rgba(22, 22, 22, 0.99) 100%),
    repeating-linear-gradient(0deg, rgba(64, 64, 64, 0.03) 0px, rgba(64, 64, 64, 0.03) 1px, transparent 1px, transparent 24px);
  border-right: 1px solid #323232;
  box-shadow: 12px 0 32px rgba(0, 0, 0, 0.45);
  z-index: 87;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 10px 8px 14px;
  gap: 12px;
  transform: translateX(-100%);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}
.desktop-workspace-sidebar.open {
  transform: translateX(0);
  pointer-events: auto;
}
@media (min-width: 900px) {
  .desktop-workspace-sidebar {
    box-shadow: none;
  }
}

.dw-top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 6px 8px;
  border-bottom: 1px solid rgba(125, 125, 125, 0.12);
  gap: 6px;
}
.dw-top-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 800;
  color: #e7e7e7;
  min-width: 0;
}
.dw-top-title i {
  color: #a5a5a5;
  font-size: 15px;
}
.dw-project-scope-pill {
  font-family: monospace;
  font-size: 10px;
  font-weight: 700;
  color: #c4c4c4;
  background: rgba(64, 64, 64, 0.14);
  border: 1px solid rgba(125, 125, 125, 0.3);
  border-radius: 999px;
  padding: 1px 7px;
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dw-close-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.04);
  color: #a1a1a1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 15px;
  flex-shrink: 0;
}
.dw-close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f8fafc;
}

.dw-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.dw-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 6px;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #989898;
}
.dw-section-head button {
  border: 1px solid #343434;
  background: #1b1b1b;
  color: #bebebe;
  border-radius: 5px;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}
.dw-section-head button:hover {
  background: #3a3a3a;
  border-color: #7b7b7b;
  color: #fff;
}

.dw-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dw-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 7px;
  border: 1px solid rgba(63, 63, 63, 0.45);
  background: rgba(23, 23, 23, 0.65);
  color: #d4d4d4;
  cursor: pointer;
  transition: all 0.14s ease;
}
.dw-item:hover {
  border-color: #535353;
  background: rgba(40, 40, 40, 0.9);
}
.dw-item.active.proj-item {
  border-color: #7d7d7d;
  background: linear-gradient(135deg, rgba(64, 64, 64, 0.2), rgba(58, 58, 58, 0.24));
  color: #eeeeee;
}
.dw-item.active.term-item {
  border-color: #727272;
  background: linear-gradient(135deg, rgba(64, 64, 64, 0.22), rgba(64, 64, 64, 0.14));
  color: #ececec;
}
.dw-item.active.claude-item {
  border-color: #7d7d7d;
  background: linear-gradient(135deg, rgba(64, 64, 64, 0.22), rgba(64, 64, 64, 0.14));
  color: #eeeeee;
}
.dw-item-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: 2px;
}
.dw-item-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: monospace;
  font-size: 11.5px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dw-item-sub {
  font-family: monospace;
  font-size: 10px;
  color: #989898;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dw-item-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.dw-item-actions button {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #a1a1a1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}
.dw-item-actions button:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.dw-item-actions button.danger:hover {
  background: rgba(239, 68, 68, 0.22);
  color: #fca5a5;
}
.dw-error-msg {
  font-size: 11px;
  color: #989898;
  padding: 4px 6px;
}
</style>
