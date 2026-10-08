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
                Còn {{ Math.max(0, 100 - fiveHourPercent) }}% hạn mức
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
                Còn {{ Math.max(0, 100 - weeklyPercent) }}% hạn mức
              </span>
              <span class="limit-reset-time">
                <i class="ri-time-line"></i> resets in {{ weeklyReset }}
              </span>
            </div>
          </div>

          <!-- 3. Context Window (Per Session) -->
          <div class="limit-card">
            <div class="limit-card-top">
              <div class="limit-name">
                <i class="ri-cpu-line"></i>
                <span>Phiên hiện tại (Context Window)</span>
              </div>
              <div class="limit-pct-val">{{ contextPercent }}%</div>
            </div>
            <div class="limit-progress-bar">
              <div class="limit-progress-fill" :style="{ width: `${contextPercent}%` }"></div>
            </div>
            <div class="limit-card-bottom">
              <span class="limit-tokens-detail">{{ currentTokens }} / 1,000k tokens</span>
              <span class="limit-model-tag">{{ currentModel }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue';
import { useClaudeStore } from '../stores/claudeStore.js';

const props = defineProps<{
  isOpen: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const claudeStore = useClaudeStore();

const fiveHourPercent = computed(() => claudeStore.limits.fiveHour.usedPercent);
const fiveHourReset = computed(() => claudeStore.limits.fiveHour.resetIn);
const weeklyPercent = computed(() => claudeStore.limits.weekly.usedPercent);
const weeklyReset = computed(() => claudeStore.limits.weekly.resetIn);

const activeSession = computed(() => claudeStore.activeSession);
const currentTokens = computed(() => {
  const s = activeSession.value;
  if (!s || !s.messages || s.messages.length === 0) return '0';
  if (!s.contextTokens || s.contextTokens === '0' || s.contextTokens === '0k') return '0';
  return s.contextTokens;
});
const currentModel = computed(() => activeSession.value?.model || 'Sonnet 5.5 Medium');

const contextPercent = computed(() => {
  const t = currentTokens.value;
  if (t === '0') return '0.0';
  const k = parseFloat(t.replace(/[^0-9.]/g, '') || '0');
  return ((k / 1000) * 100).toFixed(1);
});

// Tự động tải số liệu mới nhất khi mở popup
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      claudeStore.fetchLimits();
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
}
</style>
