<template>
  <header class="smart-header">
    <!-- Tầng 1: Nhận diện Môi trường & Dự án (Menu + Server + Project) -->
    <div class="server-title-row">
      <button class="server-menu-btn" @click="$emit('open-server-drawer')" :title="t('header.manageServer')">
        <i class="ri-menu-line"></i>
      </button>

      <div class="server-info-badge">
        <span class="server-status-dot" :class="serverStore.currentServer.type === 'local' ? 'local' : 'remote'"></span>
        <span class="server-title">{{ serverStore.currentServer.name }}</span>
      </div>

      <span class="server-proj-sep">/</span>

      <button class="project-selector-btn" @click="$emit('open-project-modal')" title="Project">
        <i class="ri-folder-2-line"></i>
        <span>{{ displayProjectName }}</span>
        <i class="ri-arrow-down-s-line proj-arrow"></i>
      </button>
    </div>

    <!-- Tầng 2: Phiên Làm Việc & Tác Vụ (Session Pill/Breadcrumb chiếm rộng + Lang + Action) -->
    <div class="context-row">
      <div class="smart-header-center">
        <div v-if="activeTab === 'files'" class="ctx-header-item ctx-header-session">
          <button
            id="btn-toggle-workspace-left-files"
            type="button"
            class="btn-workspace-sidebar-toggle"
            data-workspace-sidebar-toggle
            :aria-expanded="workspaceSidebarOpen ? 'true' : 'false'"
            title="Đóng / mở cột Workspace bên trái"
            aria-label="Đóng / mở cột Workspace bên trái"
            @click="$emit('toggle-workspace-sidebar')"
          >
            <i class="ri-side-bar-line"></i>
          </button>
          <div class="breadcrumb-bar">
            <button class="crumb-home-btn" @click="fileStore.fetchFiles('')" :title="t('header.rootFolder')">
              <i class="ri-folder-open-line"></i>
            </button>
            <template v-if="!fileBreadcrumbs.parts.length"><span class="crumb-segment current">/</span></template>
            <template v-else>
              <template v-if="fileBreadcrumbs.hasMore"><span class="crumb-more" @click="fileStore.fetchFiles(fileBreadcrumbs.parentPath)">...</span><span class="crumb-sep">/</span></template>
              <template v-for="(part, idx) in fileBreadcrumbs.parts" :key="part.path">
                <span class="crumb-segment" :class="{ current: part.isLast }" @click="fileStore.fetchFiles(part.path)">{{ part.name }}</span>
                <span v-if="idx < fileBreadcrumbs.parts.length - 1" class="crumb-sep">/</span>
              </template>
            </template>
          </div>
        </div>
        <div v-else-if="activeTab === 'editor'" class="ctx-header-item ctx-header-session editor-title">
          <button
            id="btn-toggle-workspace-left-editor"
            type="button"
            class="btn-workspace-sidebar-toggle"
            data-workspace-sidebar-toggle
            :aria-expanded="workspaceSidebarOpen ? 'true' : 'false'"
            title="Đóng / mở cột Workspace bên trái"
            aria-label="Đóng / mở cột Workspace bên trái"
            @click="$emit('toggle-workspace-sidebar')"
          >
            <i class="ri-side-bar-line"></i>
          </button>
          <i class="ri-file-text-line"></i> {{ fileStore.activeFile?.name || t('nav.editor') }}
          <span v-if="fileStore.activeFile?.isDirty" class="editor-dirty" title="Nội dung chưa lưu" aria-label="Nội dung chưa lưu">●</span>
        </div>
        <div v-else-if="activeTab === 'terminal'" class="ctx-header-item ctx-header-session">
          <button
            id="btn-toggle-workspace-left-term"
            type="button"
            class="btn-workspace-sidebar-toggle"
            data-workspace-sidebar-toggle
            :aria-expanded="workspaceSidebarOpen ? 'true' : 'false'"
            title="Đóng / mở cột Workspace bên trái"
            aria-label="Đóng / mở cột Workspace bên trái"
            @click="$emit('toggle-workspace-sidebar')"
          >
            <i class="ri-side-bar-line"></i>
          </button>
          <button class="term-session-pill" @click="$emit('open-session-hub')">
            <i class="ri-terminal-box-line"></i><span>{{ displaySessionName }}</span><span class="badge-count">{{ terminalStore.currentServerSessions.length }}</span><i class="ri-arrow-down-s-line"></i>
          </button>
        </div>
        <div v-else-if="activeTab === 'claude'" class="ctx-header-item ctx-header-session">
          <button
            id="btn-toggle-workspace-left-claude"
            type="button"
            class="btn-workspace-sidebar-toggle"
            data-workspace-sidebar-toggle
            :aria-expanded="workspaceSidebarOpen ? 'true' : 'false'"
            title="Đóng / mở cột Workspace bên trái"
            aria-label="Đóng / mở cột Workspace bên trái"
            @click="$emit('toggle-workspace-sidebar')"
          >
            <i class="ri-side-bar-line"></i>
          </button>
          <button class="claude-session-pill" @click="$emit('open-claude-hub')">
            <i class="ri-sparkling-fill"></i><span>{{ displayClaudeSessionName }}</span><span class="badge-count claude-badge">{{ claudeStore.currentServerSessions.length }}</span><i class="ri-arrow-down-s-line"></i>
          </button>
        </div>
        <div v-else-if="activeTab === 'git'" class="ctx-header-item ctx-header-session git-title">
          <button
            id="btn-toggle-workspace-left-git"
            type="button"
            class="btn-workspace-sidebar-toggle"
            data-workspace-sidebar-toggle
            :aria-expanded="workspaceSidebarOpen ? 'true' : 'false'"
            title="Đóng / mở cột Workspace bên trái"
            aria-label="Đóng / mở cột Workspace bên trái"
            @click="$emit('toggle-workspace-sidebar')"
          >
            <i class="ri-side-bar-line"></i>
          </button>
          <i class="ri-git-branch-line"></i> Git changes {{ gitStore.files.length }}
        </div>
        <div v-else-if="activeTab === 'settings'" class="ctx-header-item ctx-header-session git-title">
          <button
            id="btn-toggle-workspace-left-settings"
            type="button"
            class="btn-workspace-sidebar-toggle"
            data-workspace-sidebar-toggle
            :aria-expanded="workspaceSidebarOpen ? 'true' : 'false'"
            title="Đóng / mở cột Workspace bên trái"
            aria-label="Đóng / mở cột Workspace bên trái"
            @click="$emit('toggle-workspace-sidebar')"
          >
            <i class="ri-side-bar-line"></i>
          </button>
          <i class="ri-keyboard-box-line"></i> Cài đặt phím tắt
        </div>
      </div>

      <div class="smart-header-right">
        <LanguageSwitcher />
        <template v-if="activeTab === 'files'">
          <button
            type="button"
            class="btn-icon-action quick-tree-trigger"
            data-quick-tree-trigger
            data-quick-panel="files"
            aria-controls="quick-tree-panel"
            :aria-expanded="quickPanelOpen && quickPanelMode === 'files' ? 'true' : 'false'"
            :title="t('quickPanel.filesTitle')"
            :aria-label="t('quickPanel.filesTitle')"
            @click="$emit('toggle-quick-panel', 'files')"
          ><i class="ri-folder-2-line"></i></button>
          <button class="btn-icon-action" @click="$emit('prompt-create-item')" :title="t('common.create')"><i class="ri-add-line"></i></button>

          <div class="header-action-dropdown-wrapper">
            <button class="btn-icon-action" @click.stop="toggleUploadDropdown" :title="t('fileExplorer.upload') || 'Tải lên'">
              <i class="ri-upload-2-line"></i>
            </button>
            <div v-if="isUploadDropdownOpen" class="header-dropdown-menu" @click.stop>
              <button class="dropdown-item" @click="handleUploadFilesClick">
                <i class="ri-file-upload-line"></i> <span>{{ t('fileExplorer.uploadFiles') || 'Tải lên tệp' }}</span>
              </button>
              <button class="dropdown-item" @click="handleUploadFolderClick">
                <i class="ri-folder-upload-line"></i> <span>{{ t('fileExplorer.uploadFolder') || 'Tải lên thư mục' }}</span>
              </button>
            </div>
          </div>

          <button class="btn-icon-action" @click="handleDownloadCurrentFolder" :title="t('fileExplorer.downloadZip') || 'Nén zip và tải về thư mục'" :aria-label="t('fileExplorer.downloadZip') || 'Nén zip và tải về thư mục'"><i class="ri-download-2-line" aria-hidden="true"></i></button>
          <button class="btn-icon-action" @click="fileStore.fetchFiles(fileStore.currentRel)" :title="t('common.refresh')"><i class="ri-refresh-line"></i></button>
        </template>
        <template v-else-if="activeTab === 'editor'">
          <button
            type="button"
            class="btn-icon-action quick-tree-trigger"
            data-quick-tree-trigger
            data-quick-panel="files"
            aria-controls="quick-tree-panel"
            :aria-expanded="quickPanelOpen && quickPanelMode === 'files' ? 'true' : 'false'"
            :title="t('quickPanel.filesTitle')"
            :aria-label="t('quickPanel.filesTitle')"
            @click="$emit('toggle-quick-panel', 'files')"
          ><i class="ri-folder-2-line"></i></button>
          <button
            v-if="fileStore.activeFile"
            id="btn-editor-preview-toggle"
            class="btn-icon-action"
            :class="{ 'preview-active': fileStore.fileMode === 'preview' }"
            :title="fileStore.fileMode === 'code' ? t('quickPanel.mdPreview') : t('quickPanel.mdEdit')"
            :aria-label="fileStore.fileMode === 'code' ? t('quickPanel.mdPreview') : t('quickPanel.mdEdit')"
            @click="fileStore.fileMode = fileStore.fileMode === 'code' ? 'preview' : 'code'"
          ><i :class="fileStore.fileMode === 'code' ? 'ri-eye-line' : 'ri-edit-line'"></i></button>
          <button class="btn-icon-action" :disabled="!fileStore.activeFile?.isDirty || isSaving || fileStore.isSaving" title="Lưu file" @click="saveFile"><i class="ri-save-line"></i></button>
          <button class="btn-icon-action" title="Đóng file" @click="closeFile"><i class="ri-close-line"></i></button>
        </template>
        <template v-else-if="activeTab === 'terminal'">
          <button
            type="button"
            class="btn-icon-action quick-tree-trigger"
            data-quick-tree-trigger
            data-quick-panel="files"
            aria-controls="quick-tree-panel"
            :aria-expanded="quickPanelOpen && quickPanelMode === 'files' ? 'true' : 'false'"
            :title="t('quickPanel.filesTitle')"
            :aria-label="t('quickPanel.filesTitle')"
            @click="$emit('toggle-quick-panel', 'files')"
          ><i class="ri-folder-2-line"></i></button>
          <button
            type="button"
            class="btn-icon-action quick-tree-trigger"
            data-quick-tree-trigger
            data-quick-panel="git"
            aria-controls="quick-tree-panel"
            :aria-expanded="quickPanelOpen && quickPanelMode === 'git' ? 'true' : 'false'"
            :title="t('quickPanel.gitTitle')"
            :aria-label="t('quickPanel.gitTitle')"
            @click="$emit('toggle-quick-panel', 'git')"
          ><i class="ri-git-branch-line"></i></button>
          <button class="btn-icon-action" @click="$emit('open-new-terminal-modal')"><i class="ri-add-line"></i></button>
        </template>
        <template v-else-if="activeTab === 'claude'">
          <button
            type="button"
            class="btn-icon-action quick-tree-trigger"
            data-quick-tree-trigger
            data-quick-panel="files"
            aria-controls="quick-tree-panel"
            :aria-expanded="quickPanelOpen && quickPanelMode === 'files' ? 'true' : 'false'"
            :title="t('quickPanel.filesTitle')"
            :aria-label="t('quickPanel.filesTitle')"
            @click="$emit('toggle-quick-panel', 'files')"
          ><i class="ri-folder-2-line"></i></button>
          <button
            type="button"
            class="btn-icon-action quick-tree-trigger"
            data-quick-tree-trigger
            data-quick-panel="git"
            aria-controls="quick-tree-panel"
            :aria-expanded="quickPanelOpen && quickPanelMode === 'git' ? 'true' : 'false'"
            :title="t('quickPanel.gitTitle')"
            :aria-label="t('quickPanel.gitTitle')"
            @click="$emit('toggle-quick-panel', 'git')"
          ><i class="ri-git-branch-line"></i></button>
          <button class="btn-icon-action" @click="$emit('open-claude-hub')" :title="t('claudeHub.tabCliSessions') || 'Danh sách phiên Project'"><i class="ri-history-line"></i></button>
          <button class="btn-icon-action" @click="$emit('open-new-claude-modal')" :title="t('common.create')"><i class="ri-add-line"></i></button>
        </template>
        <template v-else-if="activeTab === 'git'">
          <button
            type="button"
            class="btn-icon-action quick-tree-trigger"
            data-quick-tree-trigger
            data-quick-panel="files"
            aria-controls="quick-tree-panel"
            :aria-expanded="quickPanelOpen && quickPanelMode === 'files' ? 'true' : 'false'"
            :title="t('quickPanel.filesTitle')"
            :aria-label="t('quickPanel.filesTitle')"
            @click="$emit('toggle-quick-panel', 'files')"
          ><i class="ri-folder-2-line"></i></button>
          <button class="btn-icon-action" @click="gitStore.fetchStatus"><i class="ri-refresh-line"></i></button>
        </template>
        <template v-else-if="activeTab === 'settings'">
          <button
            type="button"
            class="btn-icon-action quick-tree-trigger"
            data-quick-tree-trigger
            data-quick-panel="files"
            aria-controls="quick-tree-panel"
            :aria-expanded="quickPanelOpen && quickPanelMode === 'files' ? 'true' : 'false'"
            :title="t('quickPanel.filesTitle')"
            :aria-label="t('quickPanel.filesTitle')"
            @click="$emit('toggle-quick-panel', 'files')"
          ><i class="ri-folder-2-line"></i></button>
        </template>
      </div>
    </div>

    <!-- Hidden file inputs for Header upload action -->
    <input ref="headerFileInput" type="file" multiple style="display: none" @change="onHeaderFilesSelected" />
    <input ref="headerFolderInput" type="file" webkitdirectory directory multiple style="display: none" @change="onHeaderFolderSelected" />
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useServerStore } from '../stores/serverStore.js';
import { useProjectStore } from '../stores/projectStore.js';
import { useFileStore } from '../stores/fileStore.js';
import { useTerminalStore } from '../stores/terminalStore.js';
import { useClaudeStore } from '../stores/claudeStore.js';
import { useGitStore } from '../stores/gitStore.js';
import { useI18n } from '../composables/useI18n.js';
import LanguageSwitcher from './LanguageSwitcher.vue';

defineProps<{
  activeTab: 'files' | 'editor' | 'terminal' | 'claude' | 'git' | 'settings';
  quickPanelOpen?: boolean;
  quickPanelMode?: 'files' | 'git';
  workspaceSidebarOpen?: boolean;
}>();
const emit = defineEmits<{
  (e: 'open-server-drawer'): void; (e: 'open-project-modal'): void; (e: 'open-session-hub'): void; (e: 'open-new-terminal-modal'): void; (e: 'open-claude-hub'): void; (e: 'open-new-claude-modal'): void; (e: 'prompt-create-item'): void; (e: 'change-tab', tab: 'files' | 'editor' | 'terminal' | 'claude' | 'git' | 'settings'): void; (e: 'toggle-quick-panel', mode: 'files' | 'git'): void; (e: 'toggle-workspace-sidebar'): void;
}>();
const serverStore = useServerStore(); const projectStore = useProjectStore(); const fileStore = useFileStore(); const terminalStore = useTerminalStore(); const claudeStore = useClaudeStore(); const gitStore = useGitStore(); const { t } = useI18n();

const isUploadDropdownOpen = ref(false);
const headerFileInput = ref<HTMLInputElement | null>(null);
const headerFolderInput = ref<HTMLInputElement | null>(null);

function toggleUploadDropdown() {
  isUploadDropdownOpen.value = !isUploadDropdownOpen.value;
}

function handleUploadFilesClick() {
  isUploadDropdownOpen.value = false;
  headerFileInput.value?.click();
}

function handleUploadFolderClick() {
  isUploadDropdownOpen.value = false;
  headerFolderInput.value?.click();
}

async function onHeaderFilesSelected(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    await fileStore.uploadFiles(target.files);
    target.value = '';
  }
}

async function onHeaderFolderSelected(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    await fileStore.uploadFiles(target.files);
    target.value = '';
  }
}

function handleDownloadCurrentFolder() {
  fileStore.downloadItem(fileStore.currentRel);
}

function handleGlobalClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest('.header-action-dropdown-wrapper')) {
    isUploadDropdownOpen.value = false;
  }
}

onMounted(() => {
  window.addEventListener('click', handleGlobalClick);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleGlobalClick);
});
interface BreadcrumbPart { name: string; path: string; isLast: boolean; }
const fileBreadcrumbs = computed(() => { const rel = (fileStore.currentRel || '').trim(); if (!rel) return { hasMore:false, parentPath:'', parts: [] as BreadcrumbPart[] }; const all = rel.split('/').filter(Boolean); const items = all.map((name, index) => ({ name, path: all.slice(0,index+1).join('/'), isLast:index===all.length-1 })); return items.length <= 3 ? { hasMore:false, parentPath:'', parts:items } : { hasMore:true, parentPath:items[items.length-4].path, parts:items.slice(-3) }; });

const displayProjectName = computed(() => {
  const proj = projectStore.currentProject;
  if (!proj) return '~';
  if (proj.name && proj.name.trim() && proj.name !== '~') {
    return proj.name.trim();
  }
  if (proj.rootPath) {
    const clean = proj.rootPath.replace(/[/\\]+$/, '');
    const parts = clean.split(/[/\\]/);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return '~';
});

const displaySessionName = computed(() => {
  const sess = terminalStore.activeSession;
  if (!sess) return 'terminal';
  if (sess.name && sess.name.trim() && sess.name !== 'terminal') {
    const clean = sess.name.trim();
    // Nếu là đường dẫn thư mục, lấy cấp cuối cùng nếu có
    if (clean.includes('/')) {
      const parts = clean.split('/').filter(Boolean);
      return parts[parts.length - 1] || clean;
    }
    return clean;
  }
  if (sess.cwd) {
    const clean = sess.cwd.replace(/[/\\]+$/, '');
    const parts = clean.split(/[/\\]/).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return 'terminal';
});
const displayClaudeSessionName = computed(() => {
  const sess = claudeStore.activeSession;
  if (!sess) return 'claude';

  // 1. Always prioritize the session name set in HugRemote
  if (sess.name && sess.name.trim()) {
    const clean = sess.name.trim();
    if (!sess.isCustomNamed && sess.cwd && clean === sess.cwd.trim()) {
      const parts = clean.replace(/[/\\]+$/, '').split(/[/\\]/).filter(Boolean);
      return parts[parts.length - 1] || clean;
    }
    return clean;
  }

  // 2. Fallback to linked Claude CLI session summary only when session has no custom name
  if (sess.cliSessionId) {
    const cliSess = claudeStore.projectSessions.find((p) => p.id === sess.cliSessionId);
    if (cliSess?.summary && cliSess.summary !== 'Phiên chưa đặt tên') {
      return cliSess.summary;
    }
  }

  // 3. Fallback to folder name from cwd
  if (sess.cwd) {
    const clean = sess.cwd.replace(/[/\\]+$/, '');
    const parts = clean.split(/[/\\]/).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return sess.name || 'claude';
});
const isSaving = ref(false);
async function saveFile() {
  isSaving.value = true;
  try { await fileStore.saveActiveFile(); }
  catch { /* The file store exposes the save error to the editor. */ }
  finally { isSaving.value = false; }
}
async function closeFile() {
  if (await fileStore.closeActiveFile()) emit('change-tab', 'files');
}
</script>

<style>
.editor-dirty { color: #c1c1c1; font-size: 11px; flex-shrink: 0; }
/* SmartHeader: Unified layout compatible with existing template */
.smart-header {
  height: 64px;
  background: #171717;
  border-bottom: 1px solid #323232;
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-shrink: 0;
  z-index: 40;
  width: 100%;
  box-sizing: border-box;
}

.server-title-row {
  height: 28px;
  background: #161616;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  padding: 0 10px;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.server-info-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-shrink: 0;
}

.server-proj-sep {
  color: #989898;
  font-family: monospace;
  font-weight: 700;
  font-size: 12px;
  user-select: none;
  flex-shrink: 0;
}

.server-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #e7e7e7;
  font-family: monospace;
  font-size: 11.5px;
  font-weight: 800;
}

.server-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.server-status-dot.local {
  background: #404040;
  box-shadow: 0 0 6px rgba(64, 64, 64, 0.7);
}
.server-status-dot.remote {
  background: #404040;
  box-shadow: 0 0 6px rgba(64, 64, 64, 0.7);
}

.context-row {
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.server-menu-btn {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid #3f3f3f;
  background: #282828;
  color: #d4d4d4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  cursor: pointer;
}

.btn-icon-action, .crumb-home-btn {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid #3f3f3f;
  background: #282828;
  color: #d4d4d4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
}

.btn-icon-action.quick-tree-trigger {
  width: 30px;
  min-width: 30px;
  height: 30px;
  font-size: 16px;
}

.btn-icon-action.quick-tree-trigger[aria-expanded="true"] {
  color: #d5d5d5;
  background: linear-gradient(135deg, #2f2f2f, #2a2a2a);
  border-color: #38bdf8;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.btn-icon-action.quick-tree-trigger[data-quick-panel="git"][aria-expanded="true"] {
  color: #d6d6d6;
  background: linear-gradient(135deg, #343434, #353535);
  border-color: #fbbf24;
}

.project-selector-btn {
  height: 22px;
  max-width: calc(100% - 130px);
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid rgba(245, 158, 11, 0.62);
  background: rgba(64, 64, 64, 0.09);
  color: #dedede;
  border-radius: 6px;
  padding: 0 6px;
  font-family: monospace;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.project-selector-btn span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.project-selector-btn .proj-arrow {
  font-size: 12px;
  color: #c4c4c4;
  flex-shrink: 0;
  margin-left: 1px;
}

.smart-header-center {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  overflow: hidden;
  padding: 0 4px;
}

.ctx-header-item {
  min-width: 0;
  max-width: 100%;
  display: flex;
  align-items: center;
}
.ctx-header-item.ctx-header-session {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
}

.btn-workspace-sidebar-toggle {
  width: 28px;
  min-width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid #3f3f3f;
  background: #282828;
  color: #d4d4d4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  font-size: 14px;
  transition: all 0.16s ease;
}
.btn-workspace-sidebar-toggle:hover {
  border-color: #535353;
  color: #f8fafc;
}
.btn-workspace-sidebar-toggle[aria-expanded="true"] {
  color: #a5a5a5;
  background: linear-gradient(135deg, rgba(64, 64, 64, 0.22), rgba(58, 58, 58, 0.35));
  border-color: #7d7d7d;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 0 8px rgba(64, 64, 64, 0.25);
}

.breadcrumb-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  color: #a1a1a1;
  font-family: monospace;
  font-size: 11.5px;
}
.crumb-segment, .crumb-more {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #d4d4d4;
}
.crumb-segment.current {
  color: #a5a5a5;
  font-weight: 800;
}
.crumb-sep {
  color: #989898;
}

.smart-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.term-session-pill, .claude-session-pill {
  height: 28px;
  border-radius: 6px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
  border: 1px solid rgba(56, 189, 248, 0.62);
  background: rgba(48, 48, 48, 0.18);
  color: #dcdcdc;
  font-family: monospace;
  font-size: 11.5px;
  font-weight: 800;
  cursor: pointer;
}
.term-session-pill span, .claude-session-pill span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.claude-session-pill {
  border-color: rgba(217, 119, 87, 0.68);
  background: #222222;
  color: #dcdcdc;
}
.claude-session-pill i:first-child {
  color: #989898;
}

.badge-count {
  background: #404040;
  color: white;
  border-radius: 8px;
  padding: 1px 5px;
  font-size: 9px;
  flex-shrink: 0;
}
.claude-badge {
  background: #404040;
}

.editor-title, .git-title {
  gap: 5px;
  color: #d4d4d4;
  font-size: 12px;
  font-weight: 800;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.git-title {
  color: #c1c1c1;
}

@media (max-width: 600px) {
  .project-selector-btn {
    max-width: calc(100% - 130px);
    padding: 0 6px;
  }
  .crumb-segment, .crumb-more {
    max-width: 100px;
  }
}

.header-action-dropdown-wrapper {
  position: relative;
  display: inline-flex;
}
.header-action-dropdown-wrapper:has(.header-dropdown-menu) > .btn-icon-action {
  border-color: #38bdf8;
}

.header-dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #181818;
  border: 1px solid #38bdf8;
  border-radius: 8px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
  min-width: 170px;
  padding: 5px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.header-dropdown-menu .dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #e7e7e7;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  white-space: nowrap;
}

.header-dropdown-menu .dropdown-item:hover {
  background: #282828;
  color: #a5a5a5;
}

.header-dropdown-menu .dropdown-item i {
  font-size: 16px;
}
</style>
