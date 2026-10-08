<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-sheet">
      <div class="modal-header">
        <div class="modal-title">
          <i class="ri-terminal-box-line"></i>
          {{ isEditMode ? 'Chỉnh sửa Cửa Sổ Terminal' : 'Tạo Cửa Sổ Terminal Mới' }}
        </div>
        <button class="btn-close" @click="$emit('close')">
          <i class="ri-close-line"></i>
        </button>
      </div>

      <div class="form-body">
        <!-- Server Target Info -->
        <div class="form-group">
          <label class="form-label">
            <i class="ri-server-line"></i> Server mục tiêu
          </label>
          <div class="server-badge">
            <span class="dot" :class="serverStore.currentServer.type === 'local' ? 'local' : 'remote'"></span>
            <b>{{ serverStore.currentServer.name }}</b> ({{ serverStore.currentServer.user }}@{{ serverStore.currentServer.host }})
          </div>
        </div>

        <!-- Target Directory with Home and Folder icon buttons at end of input -->
        <div class="form-group">
          <label class="form-label">
            <i class="ri-folder-open-line"></i> Thư mục khởi chạy (Target Directory)
          </label>
          <div class="input-with-actions">
            <input
              v-model="targetCwd"
              type="text"
              class="input-field-grouped"
              placeholder="vd: /home/devops/workspace hoặc ~"
            />
            <div class="input-actions-end">
              <!-- Nút Home icon cạnh nút Folder -->
              <button
                type="button"
                class="btn-input-icon"
                @click="setHomeDir"
                title="Về thư mục Home (~)"
              >
                <i class="ri-home-4-line"></i>
              </button>
              <!-- Nút Folder icon ở cuối input - mở Tree Picker -->
              <button
                type="button"
                class="btn-input-icon"
                @click="openTreePicker"
                title="Duyệt cây thư mục"
              >
                <i class="ri-folder-open-line"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Optional Custom Session Name -->
        <div class="form-group">
          <label class="form-label">
            <i class="ri-edit-line"></i> Tên cửa sổ (Tùy chọn)
          </label>
          <input
            v-model="customName"
            type="text"
            class="input-field"
            :placeholder="`Để trống sẽ lấy 3 cấp cuối (${previewDefaultName})`"
          />
          <span class="hint-text">
            * Nếu để trống, tên sẽ tự động cập nhật theo <b>3 cấp thư mục cuối của pwd</b> khi bạn chạy lệnh hoặc <code>cd</code>.
          </span>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="$emit('close')">Hủy</button>
        <button class="btn-primary" @click="handleSubmit">
          <i :class="isEditMode ? 'ri-save-line' : 'ri-add-line'"></i>
          {{ isEditMode ? 'Lưu thay đổi' : 'Tạo Cửa Sổ' }}
        </button>
      </div>
    </div>

    <!-- Folder Tree Picker Modal -->
    <FolderTreePicker
      :is-open="isTreePickerOpen"
      :server-id="serverStore.currentServer.id"
      :server-type="serverStore.currentServer.type"
      :server-workspace="serverStore.currentServer.workspace || '~'"
      :initial-path="targetCwd"
      @close="isTreePickerOpen = false"
      @confirm="handleTreeConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useServerStore } from '../stores/serverStore.js';
import { useFileStore } from '../stores/fileStore.js';
import { useTerminalStore, extractLast3Dirs } from '../stores/terminalStore.js';
import { apiUrl } from '../utils/api.js';
import FolderTreePicker from './FolderTreePicker.vue';

const props = defineProps<{
  isOpen: boolean;
  session?: any | null;
}>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created'): void;
  (e: 'updated'): void;
}>();

const isEditMode = computed(() => Boolean(props.session?.id));

const serverStore = useServerStore();
const fileStore = useFileStore();
const terminalStore = useTerminalStore();

const targetCwd = ref('');
const customName = ref('');
const isTreePickerOpen = ref(false);

function initDefaults() {
  if (props.session?.id) {
    targetCwd.value = props.session.cwd || serverStore.currentServer.workspace || '~';
    customName.value = props.session.isCustomNamed ? (props.session.name || '') : '';
    isTreePickerOpen.value = false;
    return;
  }

  const curServer = serverStore.currentServer;
  if (fileStore.currentRel) {
    if (fileStore.currentRel.startsWith('/')) {
      targetCwd.value = fileStore.currentRel;
    } else {
      const base = curServer.workspace || '';
      targetCwd.value = base ? `${base}/${fileStore.currentRel}` : fileStore.currentRel;
    }
  } else {
    targetCwd.value = curServer.workspace || '~';
  }
  customName.value = '';
  isTreePickerOpen.value = false;
}

function openTreePicker() {
  isTreePickerOpen.value = true;
}

function handleTreeConfirm(path: string) {
  targetCwd.value = path;
}

function setHomeDir() {
  targetCwd.value = '~';
}

const previewDefaultName = computed(() => {
  return extractLast3Dirs(targetCwd.value || serverStore.currentServer.workspace || '~');
});

watch(
  () => [props.isOpen, props.session] as const,
  ([open]) => {
    if (open) initDefaults();
  },
  { immediate: true }
);

async function handleSubmit() {
  const cwd = targetCwd.value.trim() || serverStore.currentServer.workspace || '~';
  const name = customName.value.trim();

  if (isEditMode.value && props.session?.id) {
    const cwdChanged = cwd !== (props.session.cwd || '');
    terminalStore.updateSession(props.session.id, {
      name,
      cwd,
      isCustomNamed: Boolean(name),
    });
    if (cwdChanged) {
      try {
        await fetch(apiUrl(`/api/sessions/${encodeURIComponent(props.session.id)}`), {
          method: 'DELETE',
        });
      } catch (_) {}
    }
    emit('updated');
  } else {
    terminalStore.createSession({
      name: name || undefined,
      cwd,
      isCustomNamed: Boolean(name),
    });
    emit('created');
  }
  emit('close');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  z-index: 110;
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
  display: flex;
  flex-direction: column;
  padding: 14px 16px;
  gap: 12px;
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

.btn-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 20px;
  cursor: pointer;
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-label {
  font-size: 11.5px;
  font-weight: 600;
  color: #cbd5e1;
  display: flex;
  align-items: center;
  gap: 4px;
}

.server-badge {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  font-family: monospace;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.dot.local { background: #3b82f6; }
.dot.remote { background: #10b981; }

/* Grouped Input with End Action Buttons */
.input-with-actions {
  display: flex;
  align-items: center;
  background: #090e1a;
  border: 1px solid #334155;
  border-radius: 6px;
  overflow: hidden;
}
.input-with-actions:focus-within {
  border-color: #3b82f6;
}

.input-field-grouped {
  flex: 1;
  background: transparent;
  border: none;
  color: #f1f5f9;
  padding: 8px 10px;
  font-size: 12.5px;
  font-family: monospace;
  outline: none;
  min-width: 0;
}

.input-actions-end {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-right: 4px;
}

.btn-input-icon {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 5px;
  color: #94a3b8;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
}
.btn-input-icon:hover, .btn-input-icon.active {
  background: #2563eb;
  color: #fff;
  border-color: #3b82f6;
}

/* Folder Picker Dropdown / Box */
.folder-picker-box {
  background: #111827;
  border: 1px solid #374151;
  border-radius: 8px;
  padding: 8px;
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
  padding-bottom: 4px;
  border-bottom: 1px solid #1f2937;
}

.btn-picker-close {
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
}

.picker-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 5px;
  color: #f1f5f9;
  cursor: pointer;
  text-align: left;
}
.picker-item:hover {
  background: #2563eb22;
  border-color: #3b82f6;
}

.picker-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.picker-name {
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
}

.picker-path {
  font-size: 10px;
  font-family: monospace;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-icon {
  color: #f59e0b;
}

/* Regular Input */
.input-field {
  background: #090e1a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #f1f5f9;
  padding: 8px 10px;
  font-size: 12.5px;
  font-family: monospace;
}
.input-field:focus {
  outline: none;
  border-color: #3b82f6;
}

.hint-text {
  font-size: 11px;
  color: #64748b;
  line-height: 1.4;
}
.hint-text b {
  color: #cbd5e1;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}

.btn-secondary {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 14px;
  cursor: pointer;
}

.btn-primary {
  background: #2563eb;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 14px;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
</style>
