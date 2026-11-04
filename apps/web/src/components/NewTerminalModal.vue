<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="requestClose">
    <div class="modal-sheet">
      <div class="modal-header">
        <div class="modal-title">
          <i class="ri-terminal-box-line"></i>
          {{ isEditMode ? t('terminalModal.editTitle') : t('terminalModal.createTitle') }}
        </div>
        <button class="btn-close" :disabled="isSubmitting" @click="requestClose">
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
            <i class="ri-folder-open-line"></i> {{ t('terminalModal.targetDir') }}
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

      <p v-if="submitError" role="alert" style="color: #f87171">{{ submitError }}</p>
      <div class="modal-footer">
        <button class="btn-secondary" :disabled="isSubmitting" @click="requestClose">{{ t('terminalModal.cancel') }}</button>
        <button class="btn-primary" :disabled="isSubmitting" @click="handleSubmit">
          <i :class="isEditMode ? 'ri-save-line' : 'ri-add-line'"></i>
          {{ isEditMode ? t('terminalModal.saveChanges') : t('terminalModal.createWindow') }}
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

    <!-- Confirm CWD Restart Modal -->
    <ConfirmModal
      :is-open="isConfirmRestartOpen"
      title="Khởi Động Lại Terminal"
      icon="ri-restart-line"
      message="Đổi thư mục sẽ khởi động lại terminal và dừng tiến trình đang chạy. Tiếp tục?"
      confirm-label="Tiếp Tục"
      :is-danger="true"
      @close="cancelRestartConfirm"
      @confirm="confirmRestartConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useServerStore } from '../stores/serverStore.js';
import { useProjectStore } from '../stores/projectStore.js';
import { useFileStore } from '../stores/fileStore.js';
import { useTerminalStore, extractLast3Dirs } from '../stores/terminalStore.js';
import { apiUrl } from '../utils/api.js';
import FolderTreePicker from './FolderTreePicker.vue';
import ConfirmModal from './ConfirmModal.vue';
import { useI18n } from '../composables/useI18n.js';

const { t } = useI18n();

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
const projectStore = useProjectStore();

const targetCwd = ref('');
const customName = ref('');
const isTreePickerOpen = ref(false);
const isSubmitting = ref(false);
const submitError = ref('');

function initDefaults() {
  submitError.value = '';
  if (props.session?.id) {
    targetCwd.value = props.session.cwd || projectStore.currentProject?.rootPath || serverStore.currentServer.workspace || '~';
    customName.value = props.session.isCustomNamed ? (props.session.name || '') : '';
    isTreePickerOpen.value = false;
    return;
  }

  const curServer = serverStore.currentServer;
  if (fileStore.currentRel) {
    if (fileStore.currentRel.startsWith('/')) {
      targetCwd.value = fileStore.currentRel;
    } else {
      const base = projectStore.currentProject?.rootPath || curServer.workspace || '';
      targetCwd.value = base ? `${base}/${fileStore.currentRel}` : fileStore.currentRel;
    }
  } else {
    targetCwd.value = projectStore.currentProject?.rootPath || curServer.workspace || '~';
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
  return extractLast3Dirs(targetCwd.value || projectStore.currentProject?.rootPath || serverStore.currentServer.workspace || '~');
});

watch(
  () => [props.isOpen, props.session] as const,
  ([open]) => {
    if (open) initDefaults();
  },
  { immediate: true }
);

const isConfirmRestartOpen = ref(false);
let pendingRestartResolve: ((confirmed: boolean) => void) | null = null;

function requestRestartConfirm(): Promise<boolean> {
  isConfirmRestartOpen.value = true;
  return new Promise<boolean>((resolve) => {
    pendingRestartResolve = resolve;
  });
}

function confirmRestartConfirm() {
  const resolve = pendingRestartResolve;
  pendingRestartResolve = null;
  isConfirmRestartOpen.value = false;
  resolve?.(true);
}

function cancelRestartConfirm() {
  const resolve = pendingRestartResolve;
  pendingRestartResolve = null;
  isConfirmRestartOpen.value = false;
  resolve?.(false);
}

function requestClose() {
  if (!isSubmitting.value) emit('close');
}

async function handleSubmit() {
  if (isSubmitting.value || isConfirmRestartOpen.value) return;
  submitError.value = '';
  const cwd = targetCwd.value.trim() || projectStore.currentProject?.rootPath || serverStore.currentServer.workspace || '~';
  const name = customName.value.trim();
  const sessionId = props.session?.id;
  const cwdChanged = Boolean(sessionId && cwd !== (props.session.cwd || ''));
  if (cwdChanged) {
    const confirmed = await requestRestartConfirm();
    if (!confirmed) return;
  }

  isSubmitting.value = true;
  try {
    if (isEditMode.value && sessionId) {
      if (cwdChanged) {
        if (!terminalStore.beginRestart(sessionId)) return;
        try {
          const response = await fetch(apiUrl(`/api/sessions/${encodeURIComponent(sessionId)}`), { method: 'DELETE' });
          if (!response.ok) throw new Error('Không thể khởi động lại terminal. Vui lòng thử lại.');
          terminalStore.updateSession(sessionId, { name, cwd, isCustomNamed: Boolean(name) });
          terminalStore.endRestart(sessionId, true);
        } catch (err) {
          terminalStore.endRestart(sessionId, false);
          throw err;
        }
      } else {
        terminalStore.updateSession(sessionId, { name, cwd, isCustomNamed: Boolean(name) });
      }
      emit('updated');
    } else {
      terminalStore.createSession({ name: name || undefined, cwd, isCustomNamed: Boolean(name) });
      emit('created');
    }
    emit('close');
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'Không thể lưu terminal. Vui lòng thử lại.';
  } finally {
    isSubmitting.value = false;
  }
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
  background: #171717;
  border-top: 1px solid #3f3f3f;
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
  color: #eeeeee;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-close {
  background: transparent;
  border: none;
  color: #a1a1a1;
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
  color: #d4d4d4;
  display: flex;
  align-items: center;
  gap: 4px;
}

.server-badge {
  background: #282828;
  border: 1px solid #3f3f3f;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  font-family: monospace;
  color: #a1a1a1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.dot.local { background: #404040; }
.dot.remote { background: #404040; }

/* Grouped Input with End Action Buttons */
.input-with-actions {
  display: flex;
  align-items: center;
  background: #161616;
  border: 1px solid #3f3f3f;
  border-radius: 6px;
  overflow: hidden;
}
.input-with-actions:focus-within {
  border-color: #7b7b7b;
}

.input-field-grouped {
  flex: 1;
  background: transparent;
  border: none;
  color: #eeeeee;
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
  background: #282828;
  border: 1px solid #3f3f3f;
  border-radius: 5px;
  color: #a1a1a1;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
}
.btn-input-icon:hover, .btn-input-icon.active {
  background: #404040;
  color: #fff;
  border-color: #7b7b7b;
}

/* Folder Picker Dropdown / Box */
.folder-picker-box {
  background: #181818;
  border: 1px solid #404040;
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
  color: #a1a1a1;
  padding-bottom: 4px;
  border-bottom: 1px solid #323232;
}

.btn-picker-close {
  background: transparent;
  border: none;
  color: #989898;
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
  background: #282828;
  border: 1px solid #404040;
  border-radius: 5px;
  color: #eeeeee;
  cursor: pointer;
  text-align: left;
}
.picker-item:hover {
  background: rgba(64, 64, 64, 0.133);
  border-color: #7b7b7b;
}

.picker-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.picker-name {
  font-size: 12px;
  font-weight: 600;
  color: #e7e7e7;
}

.picker-path {
  font-size: 10px;
  font-family: monospace;
  color: #a1a1a1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-icon {
  color: #f59e0b;
}

/* Regular Input */
.input-field {
  background: #161616;
  border: 1px solid #3f3f3f;
  border-radius: 6px;
  color: #eeeeee;
  padding: 8px 10px;
  font-size: 12.5px;
  font-family: monospace;
}
.input-field:focus {
  outline: none;
  border-color: #7b7b7b;
}

.hint-text {
  font-size: 11px;
  color: #989898;
  line-height: 1.4;
}
.hint-text b {
  color: #d4d4d4;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}

.btn-secondary {
  background: #282828;
  border: 1px solid #3f3f3f;
  border-radius: 6px;
  color: #d4d4d4;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 14px;
  cursor: pointer;
}

.btn-primary {
  background: #404040;
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
