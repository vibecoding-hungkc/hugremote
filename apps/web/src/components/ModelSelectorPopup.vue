<template>
  <div v-if="isOpen" class="claude-model-popup" @click.stop>
    <div class="claude-model-popup-header">Select a model</div>
    <div v-if="isLoadingModels" class="claude-model-state" role="status">Loading native models…</div>
    <div v-else-if="modelError" class="claude-model-state" role="alert">
      {{ modelError }}
      <button type="button" class="claude-model-retry" @click="loadModels">Retry</button>
    </div>
    <div v-else-if="!models.length" class="claude-model-state" role="status">
      No native models available.
      <button type="button" class="claude-model-retry" @click="loadModels">Retry</button>
    </div>
    <div v-else class="claude-model-list" aria-label="Native models">
      <button
        v-for="item in models"
        :key="item.id"
        type="button"
        :aria-pressed="currentModelId === item.id"
        :disabled="item.disabled"
        class="claude-model-item"
        :class="{ active: currentModelId === item.id }"
        @click="selectModel(item)"
      >
        <div class="claude-model-info">
          <div class="claude-model-title">{{ item.title }}</div>
          <div class="claude-model-desc">{{ item.desc }}</div>
        </div>
        <i v-if="currentModelId === item.id" class="ri-check-line claude-model-check" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Effort Row -->
    <div class="claude-effort-row">
      <div class="claude-effort-label">Effort ({{ currentEffort }})</div>
      <div class="claude-effort-slider-track" @click="cycleEffort">
        <div
          v-for="step in effortSteps"
          :key="step"
          class="claude-effort-step"
          :class="{ active: currentEffort === step }"
          :title="step"
          @click.stop="setEffort(step)"
        ></div>
        <div class="claude-effort-thumb" :style="{ left: thumbLeft }"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useClaudeStore } from '../stores/claudeStore';
import { useServerStore } from '../stores/serverStore';

const props = defineProps<{
  isOpen: boolean;
  modelValue: string; // e.g. "Sonnet 5.5 Medium"
  serverId?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
  (e: 'close'): void;
}>();

const claudeStore = useClaudeStore();
const serverStore = useServerStore();

interface ModelItem {
  id: string;
  title: string;
  desc: string;
  prefix: string;
  disabled?: boolean;
}

const targetServerId = computed(() => {
  return props.serverId || claudeStore.activeSession?.serverId || serverStore.currentServerId || 'server-local';
});

const targetCwd = computed(() => claudeStore.activeSession?.serverId === targetServerId.value
  ? claudeStore.activeSession.cwd || '' : '');
const hasCurrentContext = computed(() => (claudeStore.modelCwdByServer[targetServerId.value] || '') === targetCwd.value);
const models = computed<ModelItem[]>(() => hasCurrentContext.value
  ? claudeStore.modelsByServer[targetServerId.value] || [] : []);
const isLoadingModels = computed(() => hasCurrentContext.value && !!claudeStore.loadingModelsByServer[targetServerId.value]);
const modelError = computed(() => hasCurrentContext.value ? claudeStore.modelErrorsByServer[targetServerId.value] || '' : '');

async function loadModels() {
  await claudeStore.fetchModels(targetServerId.value, targetCwd.value);
}

onMounted(() => {
  loadModels();
});

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      loadModels();
    }
  }
);

watch([targetServerId, targetCwd], () => {
  loadModels();
});

const effortSteps = ['Low', 'Medium', 'High', 'Max'] as const;
type EffortLevel = typeof effortSteps[number];

const currentModelBase = computed(() => (props.modelValue || '')
  .replace(/\s+\b(Low|Medium|High|Max)\b\s*$/i, '')
  .trim());
const currentModelId = computed(() => {
  const base = currentModelBase.value.toLowerCase();
  if (!base) return '';
  return models.value.find((m) => m.prefix.toLowerCase() === base)?.id
    || models.value.find((m) => m.id.toLowerCase() === base)?.id || '';
});

const currentEffort = computed<EffortLevel>(() => {
  const val = props.modelValue || '';
  if (val.includes('Low')) return 'Low';
  if (val.includes('High')) return 'High';
  if (val.includes('Max')) return 'Max';
  return 'Medium';
});

const thumbLeft = computed(() => {
  switch (currentEffort.value) {
    case 'Low':
      return '4px';
    case 'Medium':
      return '26px';
    case 'High':
      return '48px';
    case 'Max':
      return '68px';
    default:
      return '26px';
  }
});

function selectModel(item: ModelItem) {
  if (item.disabled || isLoadingModels.value || modelError.value) return;
  const newName = `${item.id === 'default' ? 'Default' : item.prefix} ${currentEffort.value}`;
  emit('update:modelValue', newName);
  emit('close');
}

function setEffort(step: EffortLevel) {
  // Changing effort must never replace an unknown/custom model with a catalog row.
  if (!currentModelBase.value) return;
  emit('update:modelValue', `${currentModelBase.value} ${step}`);
}

function cycleEffort() {
  const idx = effortSteps.indexOf(currentEffort.value);
  const next = effortSteps[(idx + 1) % effortSteps.length];
  setEffort(next);
}
</script>

<style scoped>
.claude-model-popup {
  position: absolute;
  bottom: 100%;
  left: 10px;
  right: 10px;
  margin-bottom: 8px;
  background: #1e1e24;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.65), 0 0 1px rgba(255, 255, 255, 0.2);
  z-index: 100;
  backdrop-filter: blur(8px);
}

.claude-model-popup-header {
  font-size: 11px;
  font-weight: 500;
  color: #9ca3af;
  padding: 4px 10px 6px 10px;
}

.claude-model-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: min(360px, 45dvh);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.claude-model-state {
  padding: 12px 10px;
  color: #cbd5e1;
  font-size: 12px;
}

.claude-model-retry {
  margin-left: 8px;
  cursor: pointer;
}

.claude-model-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.claude-model-item:focus-visible {
  outline: 2px solid #93c5fd;
  outline-offset: -2px;
}

.claude-model-item {
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s ease;
  user-select: none;
}

.claude-model-item:hover,
.claude-model-item:active {
  background: rgba(255, 255, 255, 0.06);
}

.claude-model-item.active {
  background: #2a3b63;
  color: #fff;
}

.claude-model-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.claude-model-title {
  font-size: 13px;
  font-weight: 500;
  color: #f1f5f9;
}

.claude-model-desc {
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.35;
}

.claude-model-item.active .claude-model-desc {
  color: #cbd5e1;
}

.claude-model-check {
  font-size: 16px;
  color: #fff;
  margin-left: 10px;
  flex-shrink: 0;
}

.claude-effort-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 10px 6px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 4px;
}

.claude-effort-label {
  font-size: 12.5px;
  color: #d1d5db;
  font-weight: 500;
}

.claude-effort-slider-track {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 88px;
  height: 22px;
  background: #2a2a34;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 2px 5px;
  position: relative;
  cursor: pointer;
}

.claude-effort-step {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #6b7280;
  z-index: 1;
}

.claude-effort-thumb {
  position: absolute;
  top: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  transition: left 0.15s ease;
}
</style>
