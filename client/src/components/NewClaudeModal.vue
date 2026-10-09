<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-sheet">
      <div class="modal-header">
        <div class="modal-title">
          <i class="ri-sparkling-fill" style="color: #d97757;"></i>
          {{ isEditMode ? t('claudeModal.editTitle') : t('claudeModal.createTitle') }}
        </div>
        <button class="btn-close" @click="$emit('close')">
          <i class="ri-close-line"></i>
        </button>
      </div>

      <div class="modal-body">
        <!-- Thư mục làm việc -->
        <div class="form-group">
          <label class="form-label">{{ t('claudeModal.workingDir') }}</label>
          <div class="input-with-icons">
            <input
              type="text"
              class="form-input"
              v-model="cwdInput"
              placeholder="~/projects/hugcode"
              @input="onCwdChange"
            />
            <div class="input-action-icons">
              <button
                type="button"
                class="btn-icon-inside"
                @click="resetToHome"
                :title="t('claudeModal.defaultFolder')"
              >
                <i class="ri-home-4-line"></i>
              </button>
              <button
                type="button"
                class="btn-icon-inside primary"
                @click="isTreePickerOpen = true"
                :title="t('claudeModal.pickFolder')"
              >
                <i class="ri-folder-open-line"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Tên phiên -->
        <div class="form-group">
          <label class="form-label">{{ t('claudeModal.sessionName') }}</label>
          <input
            type="text"
            class="form-input"
            v-model="nameInput"
            :placeholder="t('claudeModal.autoNamePlaceholder')"
          />
        </div>

        <!-- Model -->
        <div class="form-group">
          <label class="form-label">Model</label>
          <select v-model="modelInput" class="form-input form-select">
            <option value="Default 5.5 Medium">Default 5.5</option>
            <option value="Opus 5.5 Medium">Opus 5.5</option>
            <option value="Fable 5.1 Medium">Fable 5.1</option>
            <option value="Sonnet 5.5 Medium">Sonnet 5.5</option>
            <option value="Haiku 4.5 Medium">Haiku 4.5</option>
          </select>
        </div>

        <!-- Effort -->
        <div class="form-group">
          <label class="form-label">Effort</label>
          <div class="segmented-control effort-control">
            <button
              v-for="effort in efforts"
              :key="effort"
              type="button"
              :class="{ active: effortInput === effort }"
              @click="effortInput = effort"
            >{{ effort }}</button>
          </div>
        </div>

        <!-- Bypass permission for this session -->
        <label class="permission-option" :class="{ enabled: bypassPermissions }">
          <input v-model="bypassPermissions" type="checkbox" />
          <span class="permission-checkbox" aria-hidden="true">
            <i v-if="bypassPermissions" class="ri-check-line"></i>
          </span>
          <span class="permission-copy">
            <strong>Bypass permissions</strong>
            <small>{{ t('claudeModal.bypassHint') }}</small>
          </span>
        </label>

        <!-- Lời nhắc ban đầu: create only, not mutable session metadata -->
        <div v-if="!isEditMode" class="form-group">
          <label class="form-label">{{ t('claudeModal.initialPrompt') }}</label>
          <textarea
            class="form-textarea"
            v-model="initialPrompt"
            :placeholder="t('claudeModal.promptPlaceholder')"
            rows="2"
          ></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="$emit('close')">{{ t('claudeModal.cancel') }}</button>
        <button class="btn-confirm" @click="handleSubmit">
          <i :class="isEditMode ? 'ri-save-line' : 'ri-sparkling-line'"></i>
          {{ isEditMode ? t('claudeModal.saveChanges') : t('claudeModal.launch') }}
        </button>
      </div>
    </div>

    <!-- Cây thư mục lồng bên trong -->
    <FolderTreePicker
      :is-open="isTreePickerOpen"
      :initial-path="cwdInput || serverStore.currentServer.workspace || '~'"
      :server-id="serverStore.currentServer.id"
      :server-type="serverStore.currentServer.type"
      :server-workspace="serverStore.currentServer.workspace"
      @close="isTreePickerOpen = false"
      @confirm="onFolderSelected"
      @selected="onFolderSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useServerStore } from '../stores/serverStore.js';
import { useClaudeStore } from '../stores/claudeStore.js';
import FolderTreePicker from './FolderTreePicker.vue';
import { useI18n } from '../composables/useI18n.js';

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
const claudeStore = useClaudeStore();
const { t } = useI18n();

const cwdInput = ref('');
const nameInput = ref('');
const initialPrompt = ref('');
const modelInput = ref('Sonnet 5.5 Medium');
const effortInput = ref('Medium');
const modeInput = ref('Auto');
const bypassPermissions = ref(false);
const isTreePickerOpen = ref(false);

const efforts = ['Low', 'Medium', 'High', 'Max'];
function splitModelAndEffort(value: string) {
  const match = (value || '').match(/\b(Low|Medium|High|Max)\b/i);
  const effort = match
    ? match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()
    : 'Medium';
  const baseModel = (value || 'Sonnet 5.5 Medium')
    .replace(/\s+\b(Low|Medium|High|Max)\b/i, '')
    .trim();
  return { baseModel, effort };
}

function composeModel() {
  const base = modelInput.value.replace(/\s+\b(Low|Medium|High|Max)\b/i, '').trim();
  return `${base} ${effortInput.value}`;
}

watch(
  () => [props.isOpen, props.session] as const,
  ([open, session]) => {
    if (!open) return;

    if (session?.id) {
      const { baseModel, effort } = splitModelAndEffort(session.model);
      cwdInput.value = session.cwd || serverStore.currentServer.workspace || '~';
      nameInput.value = session.name || 'chat';
      modelInput.value = `${baseModel} Medium`;
      effortInput.value = effort;
      modeInput.value = session.mode || 'Auto';
      bypassPermissions.value = Boolean(session.bypassPermissions);
      initialPrompt.value = '';
      return;
    }

    const defaultWs = serverStore.currentServer.workspace || '/home/hermes-admin/projects';
    cwdInput.value = defaultWs;
    suggestName(defaultWs);
    initialPrompt.value = '';
    modelInput.value = 'Sonnet 5.5 Medium';
    effortInput.value = 'Medium';
    modeInput.value = 'Auto';
    bypassPermissions.value = false;
  },
  { immediate: true }
);

function suggestName(pathStr: string) {
  const clean = (pathStr || '').replace(/\/+$/, '').trim();
  if (!clean) {
    nameInput.value = 'chat';
    return;
  }
  const parts = clean.split('/').filter(Boolean);
  const dirName = parts[parts.length - 1];
  nameInput.value = dirName || 'chat';
}

function onCwdChange() {
  if (!isEditMode.value) suggestName(cwdInput.value);
}

function resetToHome() {
  const ws = serverStore.currentServer.workspace || '~';
  cwdInput.value = ws;
  if (!isEditMode.value) suggestName(ws);
}

function onFolderSelected(path: string) {
  cwdInput.value = path;
  if (!isEditMode.value) suggestName(path);
  isTreePickerOpen.value = false;
}

async function handleSubmit() {
  const updates = {
    name: nameInput.value.trim() || 'chat',
    cwd: cwdInput.value.trim(),
    model: composeModel(),
    mode: modeInput.value,
    bypassPermissions: bypassPermissions.value,
  };

  if (isEditMode.value && props.session?.id) {
    await claudeStore.updateSession(props.session.id, updates);
    emit('updated');
  } else {
    await claudeStore.createSession(
      updates.name,
      updates.cwd,
      updates.model,
      updates.mode,
      initialPrompt.value.trim(),
      updates.bypassPermissions
    );
    emit('created');
  }
  emit('close');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.modal-sheet {
  width: 100%;
  max-width: 500px;
  max-height: 88dvh;
  overflow-y: auto;
  background: #18181b;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px 16px 0 0;
  padding: 16px 16px calc(24px + env(safe-area-inset-bottom, 0px));
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: #f1f5f9;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 18px;
  cursor: pointer;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  font-weight: 500;
  color: #94a3b8;
}

.form-select {
  width: 100%;
  appearance: none;
}

.segmented-control {
  display: grid;
  gap: 4px;
  padding: 3px;
  background: #222226;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.effort-control {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.segmented-control button {
  min-height: 30px;
  padding: 5px 6px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: #929aa8;
  font-size: 11px;
  cursor: pointer;
  touch-action: manipulation;
}

.segmented-control button.active {
  background: rgba(217, 119, 87, 0.16);
  border-color: rgba(217, 119, 87, 0.55);
  color: #f7d2c4;
}

.permission-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 11px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 9px;
  background: #222226;
  cursor: pointer;
  touch-action: manipulation;
}

.permission-option.enabled {
  border-color: rgba(217, 119, 87, 0.65);
  background: rgba(217, 119, 87, 0.09);
}

.permission-option > input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.permission-checkbox {
  width: 19px;
  height: 19px;
  flex: 0 0 19px;
  margin-top: 1px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #52525b;
  border-radius: 5px;
  color: white;
  font-size: 14px;
}

.permission-option.enabled .permission-checkbox {
  background: #d97757;
  border-color: #d97757;
}

.permission-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.permission-copy strong {
  color: #f1f5f9;
  font-size: 12.5px;
  font-weight: 600;
}

.permission-copy small {
  color: #8f98a7;
  font-size: 10.5px;
  line-height: 1.35;
}

.form-input,
.form-textarea {
  background: #27272a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #f1f5f9;
  font-size: 13.5px;
  padding: 8px 10px;
  outline: none;
}

.form-input:focus,
.form-textarea:focus {
  border-color: #d97757;
}

.input-with-icons {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-icons .form-input {
  width: 100%;
  padding-right: 68px;
}

.input-action-icons {
  position: absolute;
  right: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-icon-inside {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 15px;
}

.btn-icon-inside:hover {
  color: #f1f5f9;
}

.btn-icon-inside.primary {
  color: #d97757;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

.btn-secondary {
  background: #27272a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}

.btn-confirm {
  background: #d97757;
  border: none;
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
</style>
