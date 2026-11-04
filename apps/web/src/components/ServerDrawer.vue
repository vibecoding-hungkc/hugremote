<template>
  <div v-if="isOpen" class="drawer-overlay" @click.self="$emit('close')">
    <aside class="drawer-panel">
      <div class="drawer-header">
        <div>
          <div class="drawer-title"><i class="ri-server-line"></i> Servers</div>
          <div class="drawer-subtitle">Chọn môi trường làm việc</div>
        </div>
        <button class="drawer-close" @click="$emit('close')"><i class="ri-close-line"></i></button>
      </div>

      <p v-if="scopeError" class="scope-error" role="alert">{{ scopeError }}</p>
      <div class="server-list" :aria-busy="scopeBusy">
        <div
          v-for="server in serverStore.servers"
          :key="server.id"
          class="server-row"
          :class="{ active: server.id === serverStore.currentServerId }"
          @click="selectServer(server.id)"
        >
          <span class="server-dot" :class="server.type === 'local' ? 'local' : (server.isConnected ? 'remote' : 'idle')"></span>
          <div class="server-main">
            <div class="server-name">{{ server.name }}</div>
            <div class="server-meta">{{ server.type === 'local' ? 'Local' : `${server.user}@${server.host}` }} · {{ projectCount(server.id) }} Project</div>
          </div>
          <div class="server-actions">
            <i v-if="server.id === serverStore.currentServerId" class="ri-check-line server-check"></i>
            <button class="home-btn" title="Home ~" @click.stop="openHome(server.id)">
              <i class="ri-home-4-line"></i>
              <span>~</span>
            </button>
          </div>
        </div>
      </div>

      <button class="add-server" @click="$emit('open-server-manager')">
        <i class="ri-add-line"></i> Thêm SSH Server
      </button>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useFileStore } from '../stores/fileStore.js';
import { useServerStore } from '../stores/serverStore.js';
import { useProjectStore } from '../stores/projectStore.js';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'open-server-manager'): void; (e: 'selected'): void }>();
const serverStore = useServerStore();
const projectStore = useProjectStore();
const fileStore = useFileStore();

function projectCount(serverId: string) {
  return projectStore.projects.filter((p) => p.serverId === serverId).length || 1;
}

const scopeBusy = ref(false);
const scopeError = ref('');
async function changeServer(serverId: string, home = false) {
  if (scopeBusy.value) return;
  scopeBusy.value = true;
  scopeError.value = '';
  try {
    if (!await fileStore.confirmUnsavedChanges()) return;
    // Load target scope before committing the visible server selection.
    if (home) await projectStore.openHomeProject(serverId);
    else await projectStore.fetchProjects(serverId);
    serverStore.selectServer(serverId);
    emit('selected');
    emit('close');
  } catch (err: any) {
    scopeError.value = err.message || 'Không thể đổi server';
  } finally { scopeBusy.value = false; }
}
async function selectServer(serverId: string) { await changeServer(serverId); }
async function openHome(serverId: string) { await changeServer(serverId, true); }
</script>

<style scoped>
.scope-error { color: #b8b8b8; font-size: 13px; }
.drawer-overlay { position: fixed; inset: 0; z-index: 120; background: rgba(22, 22, 22, .58); display: flex; justify-content: flex-start; }
.drawer-panel { width: min(320px, 86vw); height: 100%; background: #171717; border-right: 1px solid #3f3f3f; box-shadow: 18px 0 40px rgba(0,0,0,.36); padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.drawer-header { display:flex; align-items:flex-start; justify-content:space-between; }
.drawer-title { color:#f8fafc; font-weight:800; font-size:14px; display:flex; align-items:center; gap:7px; }
.drawer-subtitle { color:#989898; font-size:11px; margin-top:2px; }
.drawer-close { width:30px; height:30px; border-radius:8px; border:1px solid #3f3f3f; background:#282828; color:#d4d4d4; }
.server-list { display:flex; flex-direction:column; gap:6px; overflow:auto; }
.server-row { display:flex; align-items:center; gap:10px; min-height:54px; padding:8px 10px; border-bottom:1px solid rgba(63, 63, 63, .72); color:#d4d4d4; cursor:pointer; transition:background 0.15s ease; }
.server-row.active { background: rgba(64, 64, 64, .09); }
.server-dot { width:8px; height:8px; border-radius:999px; background:#404040; flex-shrink:0; }
.server-dot.local { background:#404040; box-shadow:0 0 8px rgba(64, 64, 64, .7); }
.server-dot.remote { background:#404040; box-shadow:0 0 8px rgba(64, 64, 64, .7); }
.server-main { flex:1; min-width:0; }
.server-name { font-family:monospace; font-size:12.5px; font-weight:800; color:#eeeeee; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.server-meta { font-size:10.5px; color:#989898; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }
.server-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
.server-check { color:#9c9c9c; font-size:16px; }
.home-btn { height:26px; padding:0 8px; border-radius:6px; border:1px solid rgba(123, 123, 123, .28); background:rgba(23, 23, 23, .92); color:#d8d8d8; font-size:11.5px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; gap:5px; white-space:nowrap; cursor:pointer; flex-shrink:0; transition:all 0.15s ease; }
.home-btn:hover { background:rgba(64, 64, 64, 0.2); border-color:rgba(123, 123, 123, 0.5); color:#ffffff; }
.add-server { margin-top:auto; height:38px; border:1px dashed #3f3f3f; border-radius:10px; background:#181818; color:#bebebe; font-weight:700; }
</style>
