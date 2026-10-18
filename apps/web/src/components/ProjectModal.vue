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
            class="btn-project-delete"
            title="Xoá khỏi danh sách Project"
            @click.stop="deleteProject(project.id)"
          >
            <i class="ri-delete-bin-line"></i>
          </button>
          <span v-else class="root-lock" title="Root user không thể xoá"><i class="ri-lock-line"></i></span>
        </div>
      </div>

      <div class="quick-row">
        <button @click="openHome"><i class="ri-home-4-line"></i> Home ~</button>
        <button @click="useWorkspace"><i class="ri-folder-settings-line"></i> Workspace</button>
      </div>

      <div class="open-form">
        <label>Open path as Project</label>
        <div class="open-row">
          <input v-model="pathInput" placeholder="~/projects/my-app" />
          <button @click="openPath"><i class="ri-arrow-right-line"></i></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useServerStore } from '../stores/serverStore.js';
import { useProjectStore, ProjectItem } from '../stores/projectStore.js';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'selected'): void }>();
const serverStore = useServerStore();
const projectStore = useProjectStore();
const pathInput = ref('');

watch(() => props.isOpen, (open) => {
  if (open) {
    pathInput.value = projectStore.currentProject?.rootPath || serverStore.currentServer.workspace || '~';
    projectStore.fetchProjects();
  }
});

function isHomeProject(project: ProjectItem) {
  return project.name === '~' || project.rootPath === '~';
}

async function select(id: string) {
  await projectStore.selectProject(id);
  emit('selected');
  emit('close');
}

async function deleteProject(id: string) {
  await projectStore.deleteProject(id);
  emit('selected');
}

async function openHome() {
  await projectStore.openHomeProject();
  emit('selected');
  emit('close');
}
async function useWorkspace() {
  await projectStore.openProject(serverStore.currentServer.workspace || '~');
  emit('selected');
  emit('close');
}
async function openPath() {
  const p = pathInput.value.trim();
  if (!p) return;
  await projectStore.openProject(p);
  emit('selected');
  emit('close');
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
