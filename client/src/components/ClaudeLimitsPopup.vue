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

        <!-- Normal View -->
        <div v-if="!isEditing" class="claude-limits-body">
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

        <!-- Edit / Sync View -->
        <div v-else class="claude-limits-edit-view">
          <div class="edit-intro">
            Dán kết quả lệnh <code>/usage</code> từ terminal hoặc tự điều chỉnh % thực tế:
          </div>
          
          <textarea
            v-model="rawInput"
            class="edit-raw-textarea"
            rows="3"
            placeholder="Ví dụ:&#10;Usage ░░░░░░░░░░ 1% (resets in 3h 35m)&#10;Weekly █████████░ 94% (resets in 20h 35m)"
            @input="onRawInput"
          ></textarea>

          <div class="edit-fields-row">
            <div class="edit-col">
              <label>5-Hour (%):</label>
              <input type="number" v-model.number="editFivePercent" min="0" max="100" />
            </div>
            <div class="edit-col">
              <label>5h Reset In:</label>
              <input type="text" v-model="editFiveReset" placeholder="3h 35m" />
            </div>
          </div>

          <div class="edit-fields-row">
            <div class="edit-col">
              <label>Weekly (%):</label>
              <input type="number" v-model.number="editWeeklyPercent" min="0" max="100" />
            </div>
            <div class="edit-col">
              <label>Weekly Reset In:</label>
              <input type="text" v-model="editWeeklyReset" placeholder="20h 35m" />
            </div>
          </div>

          <div class="edit-actions">
            <button type="button" class="btn-edit-cancel" @click="cancelEdit">Hủy</button>
            <button type="button" class="btn-edit-save" @click="saveEdit" :disabled="isSaving">
              {{ isSaving ? 'Đang lưu...' : 'Lưu cập nhật' }}
            </button>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="claude-limits-footer">
          <button type="button" class="btn-limits-sync" @click="toggleEdit">
            <i class="ri-edit-line"></i> {{ isEditing ? 'Xem thông số' : 'Cập nhật số liệu' }}
          </button>
          <button type="button" class="btn-limits-refresh" @click="handleRefresh" :disabled="isRefreshing">
            <i class="ri-refresh-line" :class="{ spin: isRefreshing }"></i> Làm mới
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useClaudeStore } from '../stores/claudeStore.js';

const props = defineProps<{
  isOpen: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const claudeStore = useClaudeStore();
const isRefreshing = ref(false);
const isEditing = ref(false);
const isSaving = ref(false);

const rawInput = ref('');
const editFivePercent = ref(1);
const editFiveReset = ref('3h 35m');
const editWeeklyPercent = ref(94);
const editWeeklyReset = ref('20h 35m');

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

function syncEditValues() {
  editFivePercent.value = fiveHourPercent.value;
  editFiveReset.value = fiveHourReset.value;
  editWeeklyPercent.value = weeklyPercent.value;
  editWeeklyReset.value = weeklyReset.value;
}

watch(() => props.isOpen, (open) => {
  if (open) {
    isEditing.value = false;
    syncEditValues();
    claudeStore.fetchLimits();
  }
});

function toggleEdit() {
  if (!isEditing.value) {
    syncEditValues();
  }
  isEditing.value = !isEditing.value;
}

function cancelEdit() {
  isEditing.value = false;
  rawInput.value = '';
}

function onRawInput() {
  const text = rawInput.value;
  const usageMatch = text.match(/Usage[^\d]*(\d+)%\s*\((?:resets in\s*)?([^)]+)\)/i);
  if (usageMatch) {
    editFivePercent.value = parseInt(usageMatch[1], 10);
    editFiveReset.value = usageMatch[2].trim();
  }
  const weeklyMatch = text.match(/Weekly[^\d]*(\d+)%\s*\((?:resets in\s*)?([^)]+)\)/i);
  if (weeklyMatch) {
    editWeeklyPercent.value = parseInt(weeklyMatch[1], 10);
    editWeeklyReset.value = weeklyMatch[2].trim();
  }
}

async function saveEdit() {
  isSaving.value = true;
  await claudeStore.updateLimits({
    rawText: rawInput.value.trim() || undefined,
    fiveHour: {
      usedPercent: editFivePercent.value,
      resetIn: editFiveReset.value,
    },
    weekly: {
      usedPercent: editWeeklyPercent.value,
      resetIn: editWeeklyReset.value,
    },
  });
  isSaving.value = false;
  isEditing.value = false;
  rawInput.value = '';
}

async function handleRefresh() {
  isRefreshing.value = true;
  await claudeStore.fetchLimits();
  syncEditValues();
  setTimeout(() => {
    isRefreshing.value = false;
  }, 300);
}

// Auto update limits countdown every 60s
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

/* Edit / Sync View */
.claude-limits-edit-view {
  background: #202029;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-intro {
  font-size: 11px;
  color: #94a3b8;
}

.edit-intro code {
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 4px;
  border-radius: 3px;
  color: #e2e8f0;
}

.edit-raw-textarea {
  width: 100%;
  background: #141419;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 11px;
  font-family: var(--font-mono, monospace);
  padding: 6px 8px;
  resize: none;
  outline: none;
}

.edit-raw-textarea:focus {
  border-color: #d97757;
}

.edit-fields-row {
  display: flex;
  gap: 8px;
}

.edit-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.edit-col label {
  font-size: 10.5px;
  color: #94a3b8;
}

.edit-col input {
  background: #141419;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 5px;
  padding: 4px 6px;
  color: #f1f5f9;
  font-size: 11.5px;
  outline: none;
}

.edit-col input:focus {
  border-color: #d97757;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 4px;
}

.btn-edit-cancel {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  padding: 4px 10px;
  border-radius: 5px;
  font-size: 11px;
  cursor: pointer;
}

.btn-edit-save {
  background: #d97757;
  border: none;
  color: #fff;
  padding: 4px 12px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

/* Footer Actions */
.claude-limits-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.btn-limits-sync,
.btn-limits-refresh {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 11.5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s ease;
  touch-action: manipulation;
}

.btn-limits-sync:hover,
.btn-limits-refresh:hover,
.btn-limits-sync:active,
.btn-limits-refresh:active {
  background: rgba(255, 255, 255, 0.12);
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
