<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="handleCancel">
    <div class="modal-sheet">
      <div class="modal-header">
        <div class="modal-title">
          <i :class="icon"></i> {{ title.includes('.') ? t(title) : title }}
        </div>
        <button class="btn-close" @click="handleCancel">
          <i class="ri-close-line"></i>
        </button>
      </div>

      <div v-if="description" class="modal-desc">{{ description }}</div>

      <div class="input-group">
        <input
          ref="inputRef"
          v-model="inputValue"
          type="text"
          class="modal-input"
          :placeholder="placeholder"
          enterkeyhint="done"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          @keyup.enter="handleConfirm"
        />
      </div>

      <div v-if="errorMsg" class="modal-error">
        <i class="ri-error-warning-line"></i> {{ errorMsg }}
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="handleCancel">{{ t('inputModal.cancel') }}</button>
        <button class="btn-primary" :disabled="isBusy" @click="handleConfirm">
          <i v-if="isBusy" class="ri-loader-4-line spin"></i>
          {{ confirmLabel.includes('.') ? t(confirmLabel) : confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useI18n } from '../composables/useI18n.js';

const { t } = useI18n();

const props = withDefaults(defineProps<{
  isOpen: boolean;
  title?: string;
  icon?: string;
  description?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
}>(), {
  title: 'inputModal.defaultTitle',
  icon: 'ri-edit-line',
  description: '',
  placeholder: '',
  initialValue: '',
  confirmLabel: 'common.confirm',
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', value: string): void | Promise<void>;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const inputValue = ref(props.initialValue);
const errorMsg = ref('');
const isBusy = ref(false);

watch(() => props.isOpen, (open) => {
  if (open) {
    inputValue.value = props.initialValue;
    errorMsg.value = '';
    isBusy.value = false;
    nextTick(() => {
      inputRef.value?.focus();
      inputRef.value?.select();
    });
  }
});

function handleCancel() {
  if (isBusy.value) return;
  emit('close');
}

async function handleConfirm() {
  if (isBusy.value) return;
  const val = inputValue.value.trim();
  if (!val) {
    errorMsg.value = 'Vui lòng nhập giá trị.';
    return;
  }
  isBusy.value = true;
  errorMsg.value = '';
  try {
    await emit('confirm', val);
  } catch (err: any) {
    errorMsg.value = err?.message || 'Đã xảy ra lỗi.';
  } finally {
    isBusy.value = false;
  }
}

defineExpose({ setError: (msg: string) => { errorMsg.value = msg; isBusy.value = false; } });
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 2000;
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
  padding: 12px 14px 16px;
  gap: 10px;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.modal-title {
  font-size: 13.5px;
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
.modal-desc {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
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
.btn-primary:disabled {
  opacity: 0.6;
}
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
