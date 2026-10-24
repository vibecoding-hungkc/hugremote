<template>
  <Teleport to="body">
    <div v-if="isOpen" class="claude-limits-overlay" @click.self="$emit('close')">
      <div class="claude-limits-sheet" @click.stop>
        <div class="sheet-handle"></div>
        <div class="claude-limits-header">
          <div class="claude-limits-title">
            <i class="ri-dashboard-3-line" style="color: #f59e0b;"></i>
            <span>Claude Code Limits & Usage</span>
          </div>
          <button type="button" class="btn-limits-close" @click="$emit('close')">✕</button>
        </div>

        <!-- Limits Visual Rows -->
        <div class="claude-limits-body">
          <!-- 1. 5-Hour Limit (Usage) -->
          <div class="limit-card" :class="{ warning: fiveHourPercent >= 80 }">
            <div class="limit-card-top">
              <div class="limit-name">
                <i class="ri-hourglass-2-line"></i>
                <span>Usage (5-Hour Rolling Limit)</span>
              </div>
              <div class="limit-pct-val" :class="fiveHourPercent >= 80 ? 'warning' : 'ok'">
                {{ fiveHourPercent }}%
              </div>
            </div>
            <div class="limit-progress-bar">
              <div
                class="limit-progress-fill"
                :class="fiveHourPercent >= 80 ? 'warning' : 'ok'"
                :style="{ width: `${Math.min(100, Math.max(0, fiveHourPercent))}%` }"
              ></div>
            </div>
            <div class="limit-card-bottom">
              <span class="limit-sub-info" :class="{ warning: fiveHourPercent >= 80 }">
                {{ t('limits.remaining', { percent: Math.max(0, 100 - fiveHourPercent) }) }}
              </span>
              <span class="limit-reset-time">
                <i class="ri-time-line"></i> resets in {{ fiveHourReset }}
              </span>
            </div>
          </div>

          <!-- 2. Weekly Limit -->
          <div class="limit-card" :class="{ warning: weeklyPercent >= 80 }">
            <div class="limit-card-top">
              <div class="limit-name">
                <i class="ri-calendar-check-line"></i>
                <span>Weekly Limit</span>
              </div>
              <div class="limit-pct-val" :class="weeklyPercent >= 80 ? 'warning' : 'ok'">
                {{ weeklyPercent }}%
              </div>
            </div>
            <div class="limit-progress-bar">
              <div
                class="limit-progress-fill"
                :class="weeklyPercent >= 80 ? 'warning' : 'ok'"
                :style="{ width: `${Math.min(100, Math.max(0, weeklyPercent))}%` }"
              ></div>
            </div>
            <div class="limit-card-bottom">
              <span class="limit-sub-info" :class="{ warning: weeklyPercent >= 80 }">
                {{ t('limits.remaining', { percent: Math.max(0, 100 - weeklyPercent) }) }}
              </span>
              <span class="limit-reset-time">
                <i class="ri-time-line"></i> resets in {{ weeklyReset }}
              </span>
            </div>
          </div>

          <!-- 3. Native Context Window (exact selected session/target/model) -->
          <div class="limit-card">
            <div class="limit-card-top">
              <div class="limit-name">
                <i class="ri-cpu-line"></i>
                <span>{{ t('limits.contextWindow') }}</span>
              </div>
              <div class="limit-pct-val">{{ contextPercentLabel }}</div>
            </div>
            <div class="limit-progress-bar">
              <div class="limit-progress-fill" :style="{ width: `${contextProgressPercent}%` }"></div>
            </div>
            <div class="limit-card-bottom">
              <span class="limit-tokens-detail">{{ currentTokensLabel }} / {{ contextLimitLabel }} tokens</span>
              <span class="limit-model-tag">{{ effectiveModel }}</span>
            </div>
            <div v-if="contextStatusLabel" class="limit-context-status" :class="contextUsage.status">
              {{ contextStatusLabel }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue';
import {
  formatContextPercentage,
  formatContextTokenCount,
  nativeContextLimit,
  useClaudeStore,
} from '../stores/claudeStore.js';
import { useI18n } from '../composables/useI18n.js';

const props = defineProps<{
  isOpen: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const claudeStore = useClaudeStore();
const { t } = useI18n();

const fiveHourPercent = computed(() => claudeStore.limits.fiveHour.usedPercent);
const fiveHourReset = computed(() => claudeStore.limits.fiveHour.resetIn);
const weeklyPercent = computed(() => claudeStore.limits.weekly.usedPercent);
const weeklyReset = computed(() => claudeStore.limits.weekly.resetIn);

const contextUsage = computed(() => claudeStore.currentContextUsage);
const currentTokensLabel = computed(() =>
  formatContextTokenCount(contextUsage.value.context?.totalTokens)
);
const contextLimitLabel = computed(() =>
  formatContextTokenCount(nativeContextLimit(contextUsage.value.context))
);
const contextPercentLabel = computed(() =>
  formatContextPercentage(contextUsage.value.context?.percentage)
);
const contextProgressPercent = computed(() => {
  const value = contextUsage.value.context?.percentage;
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : 0;
});
const effectiveModel = computed(() => contextUsage.value.context?.model || 'Chưa xác định');
const contextStatusLabel = computed(() => {
  if (contextUsage.value.status === 'loading') return 'Đang tải ngữ cảnh native…';
  if (contextUsage.value.status === 'error') return 'Không thể tải ngữ cảnh native';
  if (contextUsage.value.status !== 'available') return 'Chưa xác định';
  return '';
});

// Tự động tải số liệu mới nhất khi mở popup
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      claudeStore.fetchLimits();
      const status = claudeStore.currentContextUsage.status;
      if (status === 'idle' || status === 'unavailable' || status === 'error') {
        claudeStore.fetchContextUsage();
      }
    }
  },
  { immediate: true }
);

// Tự động cập nhật countdown mỗi 60s khi popup đang mở
let intervalId: any = null;
onMounted(() => {
  intervalId = setInterval(() => {
    if (props.isOpen) {
      claudeStore.fetchLimits();
    }
  }, 60000);
});

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId);
});
</script>

<style scoped>
.claude-limits-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.claude-limits-sheet {
  width: 100%;
  max-width: 500px;
  background: #18181f;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px 16px 0 0;
  padding: 12px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.8);
  animation: sheetSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  touch-action: manipulation;
}

.sheet-handle {
  width: 36px;
  height: 4px;
  background: #3f3f46;
  border-radius: 2px;
  margin: 0 auto 4px;
}

@keyframes sheetSlideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.claude-limits-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.claude-limits-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13.5px;
  font-weight: 600;
  color: #f1f5f9;
}

.btn-limits-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  touch-action: manipulation;
}

.btn-limits-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.claude-limits-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.limit-card {
  background: #202029;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 9px;
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.limit-card.warning {
  border-color: rgba(245, 158, 11, 0.35);
  background: #26211a;
}

.limit-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.limit-name {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  color: #cbd5e1;
}

.limit-name i {
  font-size: 13px;
  color: #94a3b8;
}

.limit-pct-val {
  font-size: 12.5px;
  font-weight: 700;
  font-family: var(--font-mono, monospace);
  color: #93c5fd;
}

.limit-pct-val.ok {
  color: #34d399;
}

.limit-pct-val.warning {
  color: #fbbf24;
}

.limit-progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.limit-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: #3b82f6;
  transition: width 0.3s ease;
}

.limit-progress-fill.ok {
  background: #10b981;
}

.limit-progress-fill.warning {
  background: linear-gradient(90deg, #f59e0b, #ef4444);
}

.limit-card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #9ca3af;
}

.limit-sub-info {
  font-size: 11px;
  color: #94a3b8;
}

.limit-sub-info.warning {
  color: #f59e0b;
}

.limit-reset-time {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #9ca3af;
}

.limit-tokens-detail {
  font-family: var(--font-mono, monospace);
  color: #e2e8f0;
}

.limit-model-tag {
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  color: #cbd5e1;
  max-width: 48%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.limit-context-status {
  font-size: 10.5px;
  color: #94a3b8;
}

.limit-context-status.error {
  color: #fca5a5;
}
</style>
