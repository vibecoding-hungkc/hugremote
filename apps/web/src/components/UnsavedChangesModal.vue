<template>
  <div v-if="store.isUnsavedPromptOpen" class="unsaved-overlay" @click.self="choose('cancel')" @keydown.esc.stop="choose('cancel')">
    <section class="unsaved-dialog" role="dialog" aria-modal="true" aria-labelledby="unsaved-title" tabindex="-1" ref="dialog">
      <h3 id="unsaved-title">Nội dung chưa lưu</h3>
      <p>File <strong>{{ store.activeFile?.name }}</strong> có thay đổi chưa lưu. Bạn muốn xử lý thế nào?</p>
      <p v-if="store.unsavedPromptError" class="unsaved-error" role="alert">{{ store.unsavedPromptError }}</p>
      <div class="unsaved-actions">
        <button :disabled="store.isResolvingUnsaved" @click="choose('cancel')">Hủy</button>
        <button :disabled="store.isResolvingUnsaved" class="discard" @click="choose('discard')">Không lưu</button>
        <button :disabled="store.isResolvingUnsaved" class="save" @click="choose('save')">{{ store.isResolvingUnsaved ? 'Đang lưu…' : 'Lưu' }}</button>
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useFileStore } from '../stores/fileStore.js';
const store = useFileStore();
const dialog = ref<HTMLElement | null>(null);
watch(() => store.isUnsavedPromptOpen, async open => { if (open) { await nextTick(); dialog.value?.focus(); } });
function choose(choice: 'save' | 'discard' | 'cancel') { void store.resolveUnsavedChanges(choice); }
</script>
<style scoped>
.unsaved-overlay { position: fixed; inset: 0; z-index: 3000; background: #020617b8; display: flex; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(4px); }
.unsaved-dialog { width: 100%; max-width: 440px; padding: 22px; border: 1px solid #334155; border-radius: 16px; background: #0f172a; color: #e2e8f0; box-shadow: 0 24px 80px #0008; outline: none; }
h3 { font-size: 18px; margin-bottom: 12px; } p { line-height: 1.6; font-size: 14px; overflow-wrap: anywhere; }
.unsaved-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
button { padding: 10px 14px; border: 1px solid #475569; border-radius: 8px; background: #1e293b; color: #e2e8f0; cursor: pointer; }
button.save { background: #2563eb; border-color: #3b82f6; } button.discard { color: #fda4af; } button:disabled { opacity: .5; cursor: wait; }
.unsaved-error { color: #fda4af; margin-top: 12px; }
</style>
