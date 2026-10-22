<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-sheet">
      <div class="modal-header">
        <div>
          <div class="modal-title"><i class="ri-folder-open-line"></i> Projects</div>
          <div class="modal-subtitle">{{ serverStore.currentServer.name }}</div>
        </div>
        <button class="btn-close" @click="$emit('close')"><i class="ri-close-line"></i></button>
      </div>

      <div class="project-list">
        <div
          v-for="project in projectStore.currentServerProjects"
          :key="project.id"
          class="project-row"
          :class="{ active: project.id === projectStore.currentProject?.id }"
          @click="select(project.id)"
        >
          <i :class="isHomeProject(project) ? 'ri-home-4-line' : 'ri-folder-2-line'"></i>
          <span class="project-main">
            <strong>{{ project.name }}</strong>
            <small>{{ project.rootPath }}</small>
          </span>
          <i v-if="project.id === projectStore.currentProject?.id" class="ri-check-line"></i>
          <button
            v-if="!isHomeProject(project)"
            type="button"
            class="btn-project-rename"
            title="Rename project"
            aria-label="Rename project"
            @click.stop="startRename(project)"
          ><i class="ri-edit-line"></i></button>
          <button
            v-if="!isHomeProject(project)"
            type="button"
            class="btn-project-delete"
            title="Xoá khỏi danh sách Project"
            @click.stop="deleteProject(project.id)"
          >
            <i class="ri-delete-bin-line"></i>
          </button>
          <span v-else class="root-lock" title="Root user không thể xoá"><i class="ri-lock-line"></i></span>
        </div>
      </div>

      <p v-if="scopeError" class="scope-error" role="alert">{{ scopeError }}</p>

      <div v-if="renamingProject" class="rename-overlay" @click.self="!renaming && (renamingProject = null)">
        <form class="rename-form" role="dialog" aria-modal="true" aria-labelledby="rename-project-title" @submit.prevent="saveRename">
          <label id="rename-project-title" for="project-rename-name">Rename project</label>
          <input id="project-rename-name" v-model="renameName" :disabled="renaming" autofocus />
          <p v-if="renameError" class="rename-error" role="alert">{{ renameError }}</p>
          <div class="rename-actions">
            <button type="button" :disabled="renaming" @click="renamingProject = null">Cancel</button>
            <button type="submit" :disabled="renaming">{{ renaming ? 'Saving' : 'Save name' }}</button>
          </div>
        </form>
      </div>

      <div class="quick-row">
        <button :disabled="scopeBusy" @click="openHome"><i class="ri-home-4-line"></i> Home ~</button>
        <button :disabled="scopeBusy" @click="useWorkspace"><i class="ri-folder-settings-line"></i> Workspace</button>
      </div>

      <div class="open-form">
        <label>Open path as Project</label>
        <div class="open-row">
          <input v-model="pathInput" :disabled="scopeBusy" placeholder="~/projects/my-app" />
          <button :disabled="scopeBusy" @click="openPath"><i class="ri-arrow-right-line"></i></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useFileStore } from '../stores/fileStore.js';
import { useServerStore } from '../stores/serverStore.js';
import { useProjectStore, ProjectItem } from '../stores/projectStore.js';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'selected'): void }>();
const serverStore = useServerStore();
const projectStore = useProjectStore();
const fileStore = useFileStore();
const pathInput = ref('');
const renamingProject = ref<ProjectItem | null>(null);
const renameName = ref('');
const renameError = ref('');
const renaming = ref(false);
const scopeBusy = ref(false);
const scopeError = ref('');

function startRename(project: ProjectItem) {
  if (isHomeProject(project)) return;
  renamingProject.value = project;
  renameName.value = project.name;
  renameError.value = '';
}

async function saveRename() {
  if (!renamingProject.value || renaming.value) return;
  const name = renameName.value.trim();
  if (!name) {
    renameError.value = 'Enter a project name';
    return;
  }
  if (name === '~') {
    renameError.value = 'Tên "~" được dành riêng cho Home (Reserved project name "~")';
    return;
  }
  renaming.value = true;
  renameError.value = '';
  try {
    await projectStore.renameProject(renamingProject.value.id, name);
    renamingProject.value = null;
  } catch (err: any) {
    renameError.value = err.message || 'Failed to rename project';
  } finally {
    renaming.value = false;
  }
}

watch(() => props.isOpen, (open) => {
  if (open) {
    scopeError.value = '';
    pathInput.value = projectStore.currentProject?.rootPath || serverStore.currentServer.workspace || '~';
    projectStore.fetchProjects().catch(() => {});
  }
});

function isHomeProject(project: ProjectItem) {
  return project.name === '~' || project.rootPath === '~';
}

async function select(id: string) {
  if (scopeBusy.value) return;
  scopeBusy.value = true;
  scopeError.value = '';
  try {
    if (!await fileStore.confirmUnsavedChanges()) return;
    await projectStore.selectProject(id);
    emit('selected');
    emit('close');
  } catch (err: any) {
    scopeError.value = err?.message || 'Failed to select project';
  } finally {
    scopeBusy.value = false;
  }
}

async function deleteProject(id: string) {
  if (scopeBusy.value) return;
  scopeBusy.value = true;
  scopeError.value = '';
  try {
    const changesScope = id === projectStore.currentProject?.id;
    if (changesScope && !await fileStore.confirmUnsavedChanges()) return;
    await projectStore.deleteProject(id);
    if (changesScope) emit('selected');
  } catch (err: any) {
    scopeError.value = err?.message || 'Failed to delete project';
  } finally {
    scopeBusy.value = false;
  }
}

async function openHome() {
  if (scopeBusy.value) return;
  scopeBusy.value = true;
  scopeError.value = '';
  try {
    if (!await fileStore.confirmUnsavedChanges()) return;
    await projectStore.openHomeProject();
    emit('selected');
    emit('close');
  } catch (err: any) {
    scopeError.value = err?.message || 'Failed to open home project';
  } finally {
    scopeBusy.value = false;
  }
}
async function useWorkspace() {
  if (scopeBusy.value) return;
  scopeBusy.value = true;
  scopeError.value = '';
  try {
    if (!await fileStore.confirmUnsavedChanges()) return;
    await projectStore.openProject(serverStore.currentServer.workspace || '~');
    emit('selected');
    emit('close');
  } catch (err: any) {
    scopeError.value = err?.message || 'Failed to open workspace';
  } finally {
    scopeBusy.value = false;
  }
}
async function openPath() {
  if (scopeBusy.value) return;
  const p = pathInput.value.trim();
  if (!p) return;
  scopeBusy.value = true;
  scopeError.value = '';
  try {
    if (!await fileStore.confirmUnsavedChanges()) return;
    await projectStore.openProject(p);
    emit('selected');
    emit('close');
  } catch (err: any) {
    scopeError.value = err?.message || 'Failed to open path';
  } finally {
    scopeBusy.value = false;
  }
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; z-index: 110; background: rgba(0,0,0,.62); display:flex; align-items:flex-end; justify-content:center; }
.modal-sheet { width:100%; max-width:620px; max-height:75vh; background:#0f172a; border-top:1px solid #334155; border-radius:16px 16px 0 0; padding:14px; display:flex; flex-direction:column; gap:12px; }
.modal-header { display:flex; align-items:flex-start; justify-content:space-between; }
.modal-title { color:#f8fafc; font-weight:800; display:flex; gap:7px; align-items:center; }
.modal-subtitle { color:#64748b; font-size:11px; margin-top:2px; }
.btn-close { width:30px; height:30px; border-radius:8px; border:1px solid #334155; background:#1e293b; color:#cbd5e1; }
.project-list { display:flex; flex-direction:column; gap:6px; overflow:auto; }
.project-row { display:flex; align-items:center; gap:10px; min-height:52px; border:1px solid #1e293b; background:#111827; border-radius:10px; padding:9px 10px; color:#cbd5e1; text-align:left; cursor:pointer; }
.project-row.active { border-color:#38bdf8; background:rgba(14,165,233,.09); }
.project-main { min-width:0; flex:1; display:flex; flex-direction:column; gap:2px; }
.project-main strong { color:#f1f5f9; font-size:13px; font-family:monospace; }
.project-main small { color:#64748b; font-size:10.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.btn-project-rename { width:28px; height:28px; border-radius:7px; border:1px solid #334155; background:#1e293b; color:#93c5fd; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }
.rename-overlay { position:fixed; inset:0; z-index:1; background:rgba(2,6,23,.8); display:flex; align-items:center; justify-content:center; padding:20px; }
.rename-form { width:min(100%,360px); padding:18px; border:1px solid #334155; border-radius:12px; background:#0f172a; display:flex; flex-direction:column; gap:12px; color:#f1f5f9; }
.rename-form label { font-weight:700; }
.rename-form input { width:100%; box-sizing:border-box; height:38px; border:1px solid #475569; border-radius:7px; padding:0 10px; background:#020617; color:#f1f5f9; }
.rename-error { color:#fca5a5; margin:0; font-size:12px; }
.scope-error { color:#fca5a5; margin:0; font-size:12px; padding: 4px 6px; background: rgba(239,68,68,0.1); border-radius: 6px; }
.rename-actions { display:flex; justify-content:flex-end; gap:8px; }
.rename-actions button { min-height:34px; padding:0 12px; border:1px solid #334155; border-radius:7px; background:#1e293b; color:#e2e8f0; }
.rename-actions button[type=submit] { background:#2563eb; border-color:#2563eb; color:white; }
.rename-actions button:disabled { opacity:.5; }
.btn-project-delete { width:28px; height:28px; border-radius:7px; border:1px solid rgba(239,68,68,.32); background:rgba(239,68,68,.08); color:#f87171; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }
.root-lock { width:28px; height:28px; border-radius:7px; color:#64748b; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }
.quick-row { display:flex; gap:8px; }
.quick-row button { flex:1; height:34px; border-radius:8px; border:1px solid #334155; background:#1e293b; color:#bfdbfe; font-weight:700; }
.open-form { display:flex; flex-direction:column; gap:6px; }
.open-form label { color:#94a3b8; font-size:11px; font-weight:700; text-transform:uppercase; }
.open-row { display:flex; gap:8px; }
.open-row input { flex:1; min-width:0; height:36px; border:1px solid #334155; border-radius:8px; background:#020617; color:#f1f5f9; padding:0 10px; font-family:monospace; }
.open-row button { width:40px; border-radius:8px; border:0; background:#2563eb; color:white; }
</style>
