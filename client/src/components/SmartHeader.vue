<template>
  <header class="smart-header">
    <div class="server-title-row">
      <span class="server-status-dot" :class="serverStore.currentServer.type === 'local' ? 'local' : 'remote'"></span>
      <span class="server-title">{{ serverStore.currentServer.name }}</span>
    </div>

    <div class="context-row">
      <button class="server-menu-btn" @click="$emit('open-server-drawer')" :title="t('header.manageServer')">
        <i class="ri-menu-line"></i>
      </button>

      <button class="project-selector-btn" @click="$emit('open-project-modal')" title="Project">
        <i class="ri-folder-2-line"></i>
        <span>{{ projectStore.currentProject?.name || '~' }}</span>
      </button>

      <div class="smart-header-center">
        <div v-if="activeTab === 'files'" class="ctx-header-item">
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
        <div v-else-if="activeTab === 'editor'" class="ctx-header-item editor-title">
          <i class="ri-file-text-line"></i> {{ fileStore.activeFile?.name || t('nav.editor') }}
        </div>
        <div v-else-if="activeTab === 'terminal'" class="ctx-header-item">
          <button class="term-session-pill" @click="$emit('open-session-hub')">
            <i class="ri-terminal-box-line"></i><span>{{ terminalStore.activeSession?.name || 'terminal' }}</span><span class="badge-count">{{ terminalStore.currentServerSessions.length }}</span><i class="ri-arrow-down-s-line"></i>
          </button>
        </div>
        <div v-else-if="activeTab === 'claude'" class="ctx-header-item">
          <button class="claude-session-pill" @click="$emit('open-claude-hub')">
            <i class="ri-sparkling-fill"></i><span>{{ claudeStore.activeSession?.name || 'claude' }}</span><span class="badge-count claude-badge">{{ claudeStore.currentServerSessions.length }}</span><i class="ri-arrow-down-s-line"></i>
          </button>
        </div>
        <div v-else-if="activeTab === 'git'" class="ctx-header-item git-title">
          <i class="ri-git-branch-line"></i> Git changes {{ gitStore.files.length }}
        </div>
      </div>

      <div class="smart-header-right">
        <LanguageSwitcher />
        <template v-if="activeTab === 'files'">
          <button class="btn-icon-action" @click="$emit('prompt-create-item')" :title="t('common.create')"><i class="ri-add-line"></i></button>
          <button class="btn-icon-action" @click="fileStore.fetchFiles(fileStore.currentRel)" :title="t('common.refresh')"><i class="ri-refresh-line"></i></button>
        </template>
        <template v-else-if="activeTab === 'editor'">
          <button v-if="isMarkdownFile" class="btn-icon-action" @click="fileStore.fileMode = fileStore.fileMode === 'code' ? 'preview' : 'code'"><i :class="fileStore.fileMode === 'code' ? 'ri-eye-line' : 'ri-edit-line'"></i></button>
          <button class="btn-icon-action" @click="fileStore.saveActiveFile"><i class="ri-save-line"></i></button>
          <button class="btn-icon-action" @click="fileStore.closeActiveFile(); $emit('change-tab', 'files')"><i class="ri-close-line"></i></button>
        </template>
        <template v-else-if="activeTab === 'terminal'"><button class="btn-icon-action" @click="$emit('open-new-terminal-modal')"><i class="ri-add-line"></i></button></template>
        <template v-else-if="activeTab === 'claude'"><button class="btn-icon-action" @click="$emit('open-new-claude-modal')"><i class="ri-add-line"></i></button></template>
        <template v-else-if="activeTab === 'git'"><button class="btn-icon-action" @click="gitStore.fetchStatus"><i class="ri-refresh-line"></i></button></template>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useServerStore } from '../stores/serverStore.js';
import { useProjectStore } from '../stores/projectStore.js';
import { useFileStore } from '../stores/fileStore.js';
import { useTerminalStore } from '../stores/terminalStore.js';
import { useClaudeStore } from '../stores/claudeStore.js';
import { useGitStore } from '../stores/gitStore.js';
import { useI18n } from '../composables/useI18n.js';
import LanguageSwitcher from './LanguageSwitcher.vue';

defineProps<{ activeTab: 'files' | 'editor' | 'terminal' | 'claude' | 'git'; }>();
defineEmits<{
  (e: 'open-server-drawer'): void; (e: 'open-project-modal'): void; (e: 'open-session-hub'): void; (e: 'open-new-terminal-modal'): void; (e: 'open-claude-hub'): void; (e: 'open-new-claude-modal'): void; (e: 'prompt-create-item'): void; (e: 'change-tab', tab: 'files' | 'editor' | 'terminal' | 'claude' | 'git'): void;
}>();
const serverStore = useServerStore(); const projectStore = useProjectStore(); const fileStore = useFileStore(); const terminalStore = useTerminalStore(); const claudeStore = useClaudeStore(); const gitStore = useGitStore(); const { t } = useI18n();
const isMarkdownFile = computed(() => (fileStore.activeFile?.name?.toLowerCase() || '').endsWith('.md') || (fileStore.activeFile?.name?.toLowerCase() || '').endsWith('.markdown'));
interface BreadcrumbPart { name: string; path: string; isLast: boolean; }
const fileBreadcrumbs = computed(() => { const rel = (fileStore.currentRel || '').trim(); if (!rel) return { hasMore:false, parentPath:'', parts: [] as BreadcrumbPart[] }; const all = rel.split('/').filter(Boolean); const items = all.map((name, index) => ({ name, path: all.slice(0,index+1).join('/'), isLast:index===all.length-1 })); return items.length <= 3 ? { hasMore:false, parentPath:'', parts:items } : { hasMore:true, parentPath:items[items.length-4].path, parts:items.slice(-3) }; });
</script>

<style scoped>
.smart-header { height:64px; background:#0f172a; border-bottom:1px solid #1e293b; display:flex; flex-direction:column; flex-shrink:0; z-index:40; }
.server-title-row { height:24px; display:flex; align-items:center; justify-content:center; gap:6px; min-width:0; }
.server-title { max-width:72vw; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#e2e8f0; font-family:monospace; font-size:12px; font-weight:800; }
.server-status-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; } .server-status-dot.local { background:#3b82f6; box-shadow:0 0 6px rgba(59,130,246,.7); } .server-status-dot.remote { background:#10b981; box-shadow:0 0 6px rgba(16,185,129,.7); }
.context-row { height:40px; display:flex; align-items:center; gap:6px; padding:0 8px; min-width:0; }
.server-menu-btn, .btn-icon-action, .crumb-home-btn { width:28px; height:28px; border-radius:7px; border:1px solid #334155; background:#1e293b; color:#cbd5e1; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }
.project-selector-btn { height:28px; max-width:96px; display:inline-flex; align-items:center; gap:5px; border:1px solid rgba(56,189,248,.28); background:rgba(14,165,233,.09); color:#bae6fd; border-radius:7px; padding:0 7px; font-family:monospace; font-size:11.5px; font-weight:800; flex-shrink:0; }
.project-selector-btn span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.smart-header-center { flex:1; min-width:0; display:flex; align-items:center; justify-content:center; overflow:hidden; }
.ctx-header-item { min-width:0; max-width:100%; display:flex; align-items:center; }
.breadcrumb-bar { display:flex; align-items:center; gap:4px; min-width:0; color:#94a3b8; font-family:monospace; font-size:11.5px; }
.crumb-segment, .crumb-more { max-width:72px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#cbd5e1; } .crumb-segment.current { color:#38bdf8; font-weight:800; } .crumb-sep { color:#475569; }
.smart-header-right { display:flex; align-items:center; gap:5px; flex-shrink:0; }
.term-session-pill, .claude-session-pill { height:26px; border-radius:14px; padding:0 8px; display:flex; align-items:center; gap:5px; max-width:132px; border:1px solid rgba(168,85,247,.28); background:rgba(88,28,135,.18); color:#e9d5ff; font-family:monospace; font-size:11px; font-weight:800; }
.term-session-pill span, .claude-session-pill span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.claude-session-pill { border-color:rgba(217,119,87,.34); background:#2a201c; color:#fed7aa; } .claude-session-pill i:first-child { color:#d97757; }
.badge-count { background:#6366f1; color:white; border-radius:8px; padding:1px 5px; font-size:9px; } .claude-badge { background:#d97757; }
.editor-title, .git-title { gap:5px; color:#cbd5e1; font-size:12px; font-weight:800; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.git-title { color:#fbbf24; }
@media (max-width:390px){ .project-selector-btn{max-width:82px;padding:0 6px;} .term-session-pill,.claude-session-pill{max-width:108px;} .crumb-segment,.crumb-more{max-width:54px;} }
</style>
