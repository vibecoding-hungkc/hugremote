<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-sheet">
      <div class="modal-header">
        <div class="modal-title">
          <i :class="itemType === 'dir' ? 'ri-folder-add-line' : 'ri-file-add-line'"></i>
          {{ itemType === 'dir' ? 'Tạo Thư Mục Mới' : 'Tạo Tệp Tin Mới' }}
        </div>
        <button class="btn-close" @click="$emit('close')">
          <i class="ri-close-line"></i>
        </button>
      </div>

      <!-- Segmented Switch: File vs Folder -->
      <div class="type-switcher">
        <button
          type="button"
          class="switch-btn"
          :class="{ active: itemType === 'dir' }"
          @click="itemType = 'dir'"
        >
          <i class="ri-folder-fill"></i> Thư mục
        </button>
        <button
          type="button"
          class="switch-btn"
          :class="{ active: itemType === 'file' }"
          @click="itemType = 'file'"
        >
          <i class="ri-file-text-fill"></i> Tệp tin
        </button>
      </div>

      <div class="target-location" v-if="currentPath">
        <i class="ri-folder-2-line"></i>
        <span>Vị trí: <code>{{ currentPath }}</code></span>
      </div>

      <div class="input-group">
        <input
          ref="inputRef"
          v-model="itemName"
          type="text"
          class="modal-input"
          :placeholder="itemType === 'dir' ? 'Tên thư mục (ví dụ: components)' : 'Tên tệp tin (ví dụ: index.ts)'"
          enterkeyhint="done"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          @keyup.enter="handleCreate"
        />
      </div>

      <div v-if="errorMsg" class="modal-error">
        <i class="ri-error-warning-line"></i> {{ errorMsg }}
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="$emit('close')">Hủy</button>
        <button class="btn-primary" :disabled="isBusy" @click="handleCreate">
          <i v-if="isBusy" class="ri-loader-4-line spin"></i>
          <i v-else class="ri-add-line"></i>
          Tạo Mới
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

const props = defineProps<{
  isOpen: boolean;
  currentPath?: string;
  defaultType?: 'file' | 'dir';
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'create', payload: { name: string; type: 'file' | 'dir' }): void;
}>();

const itemType = ref<'file' | 'dir'>('dir');
const itemName = ref('');
const errorMsg = ref('');
const isBusy = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

watch(() => props.isOpen, (open) => {
  if (open) {
    itemType.value = props.defaultType || 'dir';
    itemName.value = '';
    errorMsg.value = '';
    isBusy.value = false;
    nextTick(() => {
      inputRef.value?.focus();
    });
  }
});

async function handleCreate() {
  const name = itemName.value.trim();
  if (!name) {
    errorMsg.value = 'Vui lòng nhập tên.';
    return;
  }
  if (name.includes('/') || name.includes('\\')) {
    errorMsg.value = 'Tên không được chứa dấu gạch chéo.';
    return;
  }
  isBusy.value = true;
  errorMsg.value = '';
  try {
    emit('create', { name, type: itemType.value });
  } catch (err: any) {
    errorMsg.value = err?.message || 'Lỗi khi tạo.';
    isBusy.value = false;
  }
}

defineExpose({
  setError: (msg: string) => {
    errorMsg.value = msg;
    isBusy.value = false;
  },
  reset: () => {
    isBusy.value = false;
    errorMsg.value = '';
  }
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  z-index: 300;
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
  padding: 14px 16px 18px;
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
.type-switcher {
  display: flex;
  background: #0b1120;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 3px;
  gap: 4px;
}
.switch-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #94a3b8;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}
.switch-btn.active {
  background: #1e293b;
  color: #60a5fa;
  font-weight: 600;
}
.target-location {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.target-location code {
  color: #93c5fd;
  font-family: monospace;
}
.input-group {
  display: flex;
}
.modal-input {
  flex: 1;
  background: #0b1120;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #f1f5f9;
  font-family: monospace;
  font-size: 13.5px;
  padding: 10px 12px;
  outline: none;
  width: 100%;
}
.modal-input:focus {
  border-color: #2563eb;
}
.modal-error {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #f87171;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.btn-secondary {
  background: transparent;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #94a3b8;
  padding: 8px 16px;
  font-size: 12.5px;
  cursor: pointer;
}
.btn-primary {
  background: #2563eb;
  border: none;
  border-radius: 6px;
  color: #fff;
  padding: 8px 16px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
}
.btn-primary:disabled { opacity: 0.6; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>