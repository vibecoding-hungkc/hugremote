<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="handleCancel">
    <div class="modal-sheet">
      <div class="modal-header">
        <div class="modal-title" :class="{ danger: isDanger }">
          <i :class="icon"></i> {{ title }}
        </div>
        <button class="btn-close" @click="handleCancel">
          <i class="ri-close-line"></i>
        </button>
      </div>

      <div class="modal-desc">{{ message }}</div>

      <div v-if="errorMsg" class="modal-error">
        <i class="ri-error-warning-line"></i> {{ errorMsg }}
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="handleCancel">Hủy</button>
        <button
          class="btn-confirm"
          :class="{ danger: isDanger }"
          :disabled="isBusy"
          @click="handleConfirm"
        >
          <i v-if="isBusy" class="ri-loader-4-line spin"></i>
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  isOpen: boolean;
  title?: string;
  icon?: string;
  message?: string;
  confirmLabel?: string;
  isDanger?: boolean;
}>(), {
  title: 'Xác nhận',
  icon: 'ri-question-line',
  message: '',
  confirmLabel: 'Đồng ý',
  isDanger: false,
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm'): void | Promise<void>;
}>();

const errorMsg = ref('');
const isBusy = ref(false);

watch(() => props.isOpen, (open) => {
  if (open) {
    errorMsg.value = '';
    isBusy.value = false;
  }
});

function handleCancel() {
  if (isBusy.value) return;
  emit('close');
}

async function handleConfirm() {
  if (isBusy.value) return;
  isBusy.value = true;
  errorMsg.value = '';
  try {
    await emit('confirm');
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
.modal-title.danger { color: #f87171; }
.btn-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 20px;
  cursor: pointer;
}
.modal-desc {
  font-size: 12.5px;
  color: #cbd5e1;
  line-height: 1.6;
  font-family: monospace;
  word-break: break-word;
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
.btn-confirm {
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
.btn-confirm.danger { background: #dc2626; }
.btn-confirm:disabled { opacity: 0.6; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
