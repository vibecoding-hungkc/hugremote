<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-sheet">
      <div class="modal-header">
        <div class="modal-title">
          <i class="ri-server-line"></i> Quản lý Server &amp; SSH
        </div>
        <button class="btn-close" @click="$emit('close')">
          <i class="ri-close-line"></i>
        </button>
      </div>

      <div class="modal-subbar">
        <span class="source-hint">Đồng bộ: <code>~/.ssh/config</code></span>
        <!-- Fixed: Bỏ dấu + thừa trong text nút -->
        <button class="btn-add-host" @click="showAddForm = !showAddForm">
          <i :class="showAddForm ? 'ri-close-line' : 'ri-add-line'"></i>
          {{ showAddForm ? 'Hủy' : 'Thêm Server' }}
        </button>
      </div>

      <!-- Error Alert Banner -->
      <div v-if="serverModalError" class="server-modal-error">
        <i class="ri-error-warning-line"></i>
        <span>{{ serverModalError }}</span>
        <button type="button" class="btn-clear-err" @click="serverModalError = ''">✕</button>
      </div>

      <!-- Add SSH Host Form with Auth Options -->
      <div v-if="showAddForm" class="add-host-form">
        <div class="form-title">
          <i class="ri-shield-keyhole-line"></i> Thêm Cấu Hình Server Mới
        </div>

        <div class="form-grid-2">
          <div class="field-item">
            <label class="field-label">Tên Server (Host)</label>
            <input v-model="newHost.name" placeholder="vd: prod-vps" class="input-text" />
          </div>
          <div class="field-item">
            <label class="field-label">Địa chỉ Host / IP</label>
            <input v-model="newHost.host" placeholder="vd: 103.145.2.10" class="input-text" />
          </div>
        </div>

        <div class="form-grid-2">
          <div class="field-item">
            <label class="field-label">Tài khoản (User)</label>
            <input v-model="newHost.user" placeholder="vd: devops / root" class="input-text" />
          </div>
          <div class="field-item">
            <label class="field-label">Cổng SSH (Port)</label>
            <input v-model.number="newHost.port" placeholder="22" type="number" class="input-text" />
          </div>
        </div>

        <!-- Authentication Mode Tabs -->
        <div class="field-item">
          <label class="field-label">Phương thức xác thực</label>
          <div class="auth-toggle-bar">
            <button
              type="button"
              class="auth-toggle-btn"
              :class="{ active: newHost.authType === 'key' }"
              @click="newHost.authType = 'key'"
            >
              <i class="ri-key-2-line"></i> SSH Key
            </button>
            <button
              type="button"
              class="auth-toggle-btn"
              :class="{ active: newHost.authType === 'password' }"
              @click="newHost.authType = 'password'"
            >
              <i class="ri-lock-password-line"></i> Mật khẩu
            </button>
          </div>
        </div>

        <!-- Key Input if Auth Mode is Key -->
        <div v-if="newHost.authType === 'key'" class="field-item">
          <label class="field-label">File Private Key</label>
          <input
            v-model="newHost.key"
            placeholder="vd: /home/hermes-admin/.ssh/test_ssh_key"
            class="input-text"
          />
          <div v-if="serverStore.availableKeys.length > 0" class="key-suggestions">
            <span class="sugg-label">Key có sẵn:</span>
            <button
              v-for="k in serverStore.availableKeys"
              :key="k"
              type="button"
              class="key-chip"
              @click="newHost.key = k"
            >
              {{ k.split('/').pop() }}
            </button>
          </div>
        </div>

        <!-- Password Input if Auth Mode is Password -->
        <div v-else class="field-item">
          <label class="field-label">Mật khẩu SSH</label>
          <div class="password-input-wrap">
            <input
              v-model="newHost.password"
              :type="showPasswordText ? 'text' : 'password'"
              placeholder="Nhập mật khẩu SSH"
              class="input-text"
            />
            <button
              type="button"
              class="btn-toggle-eye"
              @click="showPasswordText = !showPasswordText"
            >
              <i :class="showPasswordText ? 'ri-eye-off-line' : 'ri-eye-line'"></i>
            </button>
          </div>
        </div>

        <!-- Default Starting Folder -->
        <div class="field-item">
          <label class="field-label">Thư mục khởi chạy</label>
          <input
            v-model="newHost.workspace"
            placeholder="vd: /home/devops/workspace hoặc ~"
            class="input-text"
          />
        </div>

        <div class="form-submit-row">
          <button class="btn-cancel" @click="showAddForm = false">Hủy</button>
          <button class="btn-submit" @click="handleAddServer">
            <i class="ri-save-line"></i> Lưu vào ~/.ssh/config &amp; Thêm
          </button>
        </div>
      </div>

      <!-- Server Cards List (Thiết kế Compact, tối ưu diện tích mobile) -->
      <div class="server-cards-list">
        <div
          v-for="server in serverStore.servers"
          :key="server.id"
          class="server-card-compact"
          :class="{ active: server.id === serverStore.currentServerId }"
          @click="handleSelect(server.id)"
        >
          <!-- Row 1: Server Info & Status (Color Indicator Only, No Text / No Vào Button) -->
          <div class="card-main-row">
            <div class="card-left-meta">
              <div class="card-title-line">
                <span
                  class="status-indicator-dot"
                  :class="{
                    local: server.id === serverStore.currentServerId,
                    remote: server.id !== serverStore.currentServerId && server.isConnected,
                    idle: !server.isConnected && server.id !== serverStore.currentServerId
                  }"
                  :title="server.id === serverStore.currentServerId ? 'Đang chọn' : (server.isConnected ? 'Kết nối nền' : 'Chưa kết nối')"
                ></span>
                <i :class="server.type === 'local' ? 'ri-computer-line' : 'ri-shield-keyhole-line'" class="type-icon"></i>
                <span class="server-name-text">{{ server.name }}</span>
                <span v-if="server.authType === 'password'" class="auth-tag">Pass</span>
                <span v-else-if="server.type === 'ssh'" class="auth-tag">Key</span>
              </div>
              <div class="card-conn-sub">{{ server.user }}@{{ server.host }}:{{ server.port }}</div>
            </div>

            <div class="card-right-status-actions" @click.stop>
              <!-- Disconnect button if remote and connected -->
              <button
                v-if="server.isConnected && server.type !== 'local'"
                class="btn-mini-disconnect"
                @click="serverStore.disconnectServer(server.id)"
                title="Ngắt kết nối SSH"
              >
                <i class="ri-shut-down-line"></i>
              </button>

              <i
                v-if="server.id === serverStore.currentServerId"
                class="ri-check-line active-check-icon"
                title="Đang chọn"
              ></i>
            </div>
          </div>

          <!-- Row 2: Compact Inline Workspace Editor (Chỉnh trực tiếp, không popup) -->
          <div class="card-ws-row" @click.stop>
            <i class="ri-folder-open-line ws-icon"></i>
            <input
              v-model="server.workspace"
              type="text"
              class="ws-input-compact"
              placeholder="vd: /home/devops hoặc ~"
              @change="handleSaveWorkspace(server)"
              title="Chỉnh thư mục khởi chạy"
            />
            <span v-if="savedSuccessServerId === server.id" class="ws-saved-badge">
              <i class="ri-check-line"></i> Đã lưu
            </span>
            <button
              type="button"
              class="ws-mini-btn"
              @click="setServerFolder(server, '~')"
              title="Về Home (~)"
            >
              <i class="ri-home-4-line"></i>
            </button>
            <button
              type="button"
              class="ws-mini-btn"
              @click="openTreePicker(server)"
              title="Duyệt cây thư mục"
            >
              <i class="ri-folder-open-line"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Folder Tree Picker Modal -->
    <FolderTreePicker
      :is-open="isTreePickerOpen"
      :server-id="treePickerServerId"
      :server-type="treePickerServerType"
      :server-workspace="treePickerWorkspace"
      :initial-path="treePickerInitialPath"
      @close="isTreePickerOpen = false"
      @confirm="handleTreeConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useServerStore, ServerItem } from '../stores/serverStore.js';
import { useFileStore } from '../stores/fileStore.js';
import { useTerminalStore } from '../stores/terminalStore.js';
import FolderTreePicker from './FolderTreePicker.vue';

defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const serverStore = useServerStore();
const fileStore = useFileStore();
const terminalStore = useTerminalStore();

const showAddForm = ref(false);
const showPasswordText = ref(false);
const activeSuggestServerId = ref<string | null>(null);
const savedSuccessServerId = ref<string | null>(null);
const serverModalError = ref('');

const isTreePickerOpen = ref(false);
const treePickerServerId = ref('');
const treePickerServerType = ref<'local' | 'ssh'>('local');
const treePickerWorkspace = ref('');
const treePickerInitialPath = ref('');
const treePickerTargetServer = ref<ServerItem | null>(null);

function openTreePicker(server: ServerItem) {
  treePickerServerId.value = server.id;
  treePickerServerType.value = server.type;
  treePickerWorkspace.value = server.workspace || '~';
  treePickerInitialPath.value = server.workspace || '~';
  treePickerTargetServer.value = server;
  isTreePickerOpen.value = true;
}

async function handleTreeConfirm(path: string) {
  if (treePickerTargetServer.value) {
    await setServerFolder(treePickerTargetServer.value, path);
  }
}

const newHost = reactive<{
  name: string;
  host: string;
  user: string;
  port: number;
  authType: 'key' | 'password';
  key: string;
  password: string;
  workspace: string;
}>({
  name: '',
  host: '',
  user: 'root',
  port: 22,
  authType: 'key',
  key: '~/.ssh/test_ssh_key',
  password: '',
  workspace: '~',
});

function toggleSuggest(id: string) {
  if (activeSuggestServerId.value === id) {
    activeSuggestServerId.value = null;
  } else {
    activeSuggestServerId.value = id;
  }
}

async function handleSaveWorkspace(server: ServerItem) {
  const ws = (server.workspace || '~').trim();
  try {
    await serverStore.updateServerWorkspace(server.id, ws);
    savedSuccessServerId.value = server.id;
    setTimeout(() => {
      if (savedSuccessServerId.value === server.id) {
        savedSuccessServerId.value = null;
      }
    }, 2500);
  } catch (err: any) {
    serverModalError.value = `Lỗi lưu thư mục: ${err.message}`;
  }
}

async function setServerFolder(server: ServerItem, folder: string) {
  server.workspace = folder;
  activeSuggestServerId.value = null;
  await handleSaveWorkspace(server);
}

async function handleAddServer() {
  serverModalError.value = '';
  if (!newHost.name || !newHost.host) {
    serverModalError.value = 'Vui lòng nhập tên server và địa chỉ IP';
    return;
  }
  try {
    await serverStore.addServer({
      name: newHost.name,
      host: newHost.host,
      user: newHost.user,
      port: newHost.port,
      authType: newHost.authType,
      key: newHost.authType === 'key' ? newHost.key : undefined,
      password: newHost.authType === 'password' ? newHost.password : undefined,
      workspace: newHost.workspace || '~',
    });
    showAddForm.value = false;
    newHost.name = '';
    newHost.host = '';
    newHost.password = '';
  } catch (err: any) {
    serverModalError.value = `Lỗi thêm server: ${err.message}`;
  }
}

async function handleSelect(id: string) {
  serverStore.selectServer(id);
  terminalStore.ensureServerSession();
  const current = serverStore.currentServer;
  const targetDir = current.workspace === '~' ? '' : (current.workspace || '');
  await fileStore.fetchFiles(targetDir);
  emit('close');
}

onMounted(() => {
  serverStore.fetchAvailableKeys();
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.modal-sheet {
  background: #0f172a;
  border-top: 1px solid #334155;
  border-radius: 14px 14px 0 0;
  width: 100%;
  max-width: 600px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  gap: 10px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  font-size: 14px;
  font-weight: 700;
  color: #f1f5f9;
  display: flex;
  align-items: center;
  gap: 6px;
}

.server-modal-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 8px;
}
.btn-clear-err {
  background: transparent;
  border: none;
  color: #fca5a5;
  cursor: pointer;
  font-size: 13px;
  padding: 0 4px;
}

.btn-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 20px;
  cursor: pointer;
}

.modal-subbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
}

.btn-add-host {
  background: #2563eb;
  border: none;
  border-radius: 5px;
  color: #fff;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Add Server Form */
.add-host-form {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 380px;
  overflow-y: auto;
}

.form-title {
  font-size: 12.5px;
  font-weight: 700;
  color: #93c5fd;
  display: flex;
  align-items: center;
  gap: 5px;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
}

.input-text {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 5px;
  color: #f1f5f9;
  padding: 6px 8px;
  font-size: 12px;
  font-family: monospace;
}
.input-text:focus {
  outline: none;
  border-color: #3b82f6;
}

.auth-toggle-bar {
  display: flex;
  gap: 6px;
}

.auth-toggle-btn {
  flex: 1;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 5px;
  color: #94a3b8;
  font-size: 11.5px;
  font-weight: 600;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
}
.auth-toggle-btn.active {
  background: #2563eb;
  border-color: #3b82f6;
  color: #fff;
}

.key-suggestions {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.sugg-label {
  font-size: 10px;
  color: #64748b;
}

.key-chip {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 4px;
  color: #60a5fa;
  font-size: 10.5px;
  font-family: monospace;
  padding: 2px 6px;
  cursor: pointer;
}

.password-input-wrap {
  display: flex;
  align-items: center;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 5px;
  overflow: hidden;
}
.password-input-wrap .input-text {
  border: none;
  flex: 1;
}

.btn-toggle-eye {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 0 8px;
  cursor: pointer;
}

.form-submit-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.btn-cancel {
  background: transparent;
  border: 1px solid #334155;
  border-radius: 5px;
  color: #94a3b8;
  padding: 6px 12px;
  font-size: 11.5px;
  cursor: pointer;
}

.btn-submit {
  background: #10b981;
  border: none;
  border-radius: 5px;
  color: #fff;
  padding: 6px 12px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* --- ULTRA COMPACT SERVER CARD --- */
.server-cards-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  padding-bottom: 8px;
}

.server-card-compact {
  background: #162035;
  border: 1px solid #23324d;
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}
.server-card-compact.active {
  border-color: #3b82f6;
  background: #172a4c;
}

.card-main-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.card-left-meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.card-title-line {
  display: flex;
  align-items: center;
  gap: 5px;
}

.type-icon {
  font-size: 14px;
  color: #60a5fa;
  flex-shrink: 0;
}

.server-name-text {
  font-family: monospace;
  font-size: 13px;
  font-weight: 700;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.auth-tag {
  font-size: 9px;
  font-family: monospace;
  background: #0f172a;
  border: 1px solid #334155;
  color: #94a3b8;
  padding: 0 4px;
  border-radius: 3px;
  line-height: 1.4;
}

.card-conn-sub {
  font-family: monospace;
  font-size: 10.5px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-right-status-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.status-indicator-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-indicator-dot.local {
  background: #3b82f6;
  box-shadow: 0 0 6px rgba(59, 130, 246, 0.9);
}
.status-indicator-dot.remote {
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.9);
}
.status-indicator-dot.idle {
  background: #475569;
}

.active-check-icon {
  color: #3b82f6;
  font-size: 17px;
  font-weight: 700;
}

.btn-mini-disconnect {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  cursor: pointer;
}

/* Compact Workspace Row */
.card-ws-row {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 5px;
  padding: 2px 6px;
}

.ws-icon {
  font-size: 12px;
  color: #64748b;
  flex-shrink: 0;
}

.ws-input-compact {
  flex: 1;
  background: transparent;
  border: none;
  color: #cbd5e1;
  font-family: monospace;
  font-size: 11px;
  outline: none;
  min-width: 0;
  padding: 2px 0;
}
.ws-input-compact:focus {
  color: #60a5fa;
}

.ws-saved-badge {
  font-size: 9.5px;
  color: #34d399;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
  animation: fadeIn 0.2s;
}

.ws-mini-btn {
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
}
.ws-mini-btn:hover, .ws-mini-btn.active {
  color: #60a5fa;
  background: #1e293b;
}

.card-suggestions-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding: 4px 6px;
  background: #0b1120;
  border-radius: 4px;
  border: 1px dashed #1e293b;
}

.sugg-chip {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 3px;
  color: #93c5fd;
  font-size: 10px;
  font-family: monospace;
  padding: 1px 6px;
  cursor: pointer;
}
.sugg-chip:hover {
  background: #2563eb33;
  border-color: #3b82f6;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-2px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
