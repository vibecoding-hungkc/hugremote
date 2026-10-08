<template>
  <div class="claude-extension-container">
    <!-- 1. Stream of messages -->
    <div class="claude-ext-stream" ref="streamRef">
      <!-- Empty State: Centered Claude Code Logo (Matching Image 3) -->
      <div v-if="!activeSession || activeSession.messages.length === 0" class="claude-empty-state">
        <div class="claude-brand-center">
          <svg class="claude-sparkle-logo" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C12.55 2 13 2.45 13 3V7.2C13 7.75 12.55 8.2 12 8.2C11.45 8.2 11 7.75 11 7.2V3C11 2.45 11.45 2 12 2Z" fill="#d97757"/>
            <path d="M12 15.8C12.55 15.8 13 16.25 13 16.8V21C13 21.55 12.55 22 12 22C11.45 22 11 21.55 11 21V16.8C11 16.25 11.45 15.8 12 15.8Z" fill="#d97757"/>
            <path d="M2 12C2 11.45 2.45 11 3 11H7.2C7.75 11 8.2 11.45 8.2 12C8.2 12.55 7.75 13 7.2 13H3C2.45 13 2 12.55 2 12Z" fill="#d97757"/>
            <path d="M15.8 12C15.8 11.45 16.25 11 16.8 11H21C21.55 11 22 11.45 22 12C22 12.55 21.55 13 21 13H16.8C16.25 13 15.8 12.55 15.8 12Z" fill="#d97757"/>
            <path d="M4.93 4.93C5.32 4.54 5.95 4.54 6.34 4.93L9.31 7.9C9.7 8.29 9.7 8.92 9.31 9.31C8.92 9.7 8.29 9.7 7.9 9.31L4.93 6.34C4.54 5.95 4.54 5.32 4.93 4.93Z" fill="#d97757"/>
            <path d="M14.69 14.69C15.08 14.3 15.71 14.3 16.1 14.69L19.07 17.66C19.46 18.05 19.46 18.68 19.07 19.07C18.68 19.46 18.05 19.46 17.66 19.07L14.69 16.1C14.3 15.71 14.3 15.08 14.69 14.69Z" fill="#d97757"/>
            <path d="M19.07 4.93C19.46 5.32 19.46 5.95 19.07 6.34L16.1 9.31C15.71 9.7 15.08 9.7 14.69 9.31C14.3 8.92 14.3 8.29 14.69 7.9L17.66 4.93C18.05 4.54 18.68 4.54 19.07 4.93Z" fill="#d97757"/>
            <path d="M9.31 14.69C9.7 15.08 9.7 15.71 9.31 16.1L6.34 19.07C5.95 19.46 5.32 19.46 4.93 19.07C4.54 18.68 4.54 18.05 4.93 17.66L7.9 14.69C8.29 14.3 8.92 14.3 9.31 14.69Z" fill="#d97757"/>
          </svg>
          <span class="claude-brand-text">Claude Code</span>
        </div>
      </div>

      <template v-else>
        <template v-for="msg in activeSession.messages" :key="msg.id">
          <!-- User message (Full width bordered box) -->
          <div v-if="msg.sender === 'user'" class="claude-ext-user-msg">
            {{ msg.text }}
          </div>

          <!-- Assistant message (Minimalist with ● dot) -->
          <div
            v-else
            v-show="!claudeStore.compactTaskMode || !msg.isWorking"
            class="claude-ext-asst-msg"
          >
            <span class="claude-asst-dot">●</span>
            <div class="claude-asst-content">
              <!-- Live Thinking Panel: hidden after completion in compact mode -->
              <div
                v-if="(msg.isThinking || msg.thinking) && (!claudeStore.compactTaskMode || msg.isWorking)"
                class="claude-thinking-panel"
              >
                <button
                  type="button"
                  class="claude-thinking-header"
                  @click="msg.isThinkingExpanded = !msg.isThinkingExpanded"
                >
                  <span class="thinking-status-wrap">
                    <span v-if="msg.isThinking" class="thinking-spinner"></span>
                    <i v-else class="ri-check-line thinking-complete-icon"></i>
                    <span>{{ msg.isThinking ? t('claudeView.thinkingActive') : t('claudeView.thinkingDone') }}</span>
                  </span>
                  <i :class="msg.isThinkingExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'"></i>
                </button>
                <div v-if="msg.isThinkingExpanded" class="claude-thinking-content">
                  {{ msg.thinking || t('claudeView.thinkingFallback') }}
                </div>
              </div>

              <!-- Tool Cards: hidden after completion in compact mode -->
              <div
                v-if="msg.tools && msg.tools.length && (!claudeStore.compactTaskMode || msg.isWorking)"
                class="claude-tool-cards"
              >
                <div
                  v-for="(tool, tIdx) in msg.tools"
                  :key="tool.id || tIdx"
                  class="claude-tool-card"
                  :class="{ 'bash-collapsible': tool.type === 'bash' }"
                >
                  <button
                    v-if="tool.type === 'bash'"
                    type="button"
                    class="claude-tool-header bash-expander"
                    :aria-expanded="tool.isExpanded ? 'true' : 'false'"
                    @click="toggleToolExpansion(tool)"
                  >
                    <span class="claude-tool-badge bash">
                      <i :class="toolIcon(tool.type)"></i> BASH
                    </span>
                    <span class="claude-tool-title">{{ tool.title }}</span>
                    <span class="claude-tool-status" :class="msg.isWorking ? (tool.status || 'running') : (tool.status === 'done' ? 'done' : 'error')">
                      <span v-if="msg.isWorking && (!tool.status || tool.status === 'running')" class="tool-spinner"></span>
                      <i v-else-if="tool.status === 'done'" class="ri-check-line"></i>
                      <i v-else class="ri-close-line"></i>
                    </span>
                    <i :class="tool.isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" class="bash-expand-icon"></i>
                  </button>

                  <div v-else class="claude-tool-header">
                    <span class="claude-tool-badge" :class="tool.type">
                      <i :class="toolIcon(tool.type)"></i> {{ tool.type.toUpperCase() }}
                    </span>
                    <span class="claude-tool-title">{{ tool.title }}</span>
                    <span class="claude-tool-status" :class="msg.isWorking ? (tool.status || 'running') : (tool.status === 'done' ? 'done' : 'error')">
                      <span v-if="msg.isWorking && (!tool.status || tool.status === 'running')" class="tool-spinner"></span>
                      <i v-else-if="tool.status === 'done'" class="ri-check-line"></i>
                      <i v-else class="ri-close-line"></i>
                    </span>
                  </div>

                  <!-- Read only shows filename; Bash output is opt-in via expander -->
                  <template v-if="tool.type !== 'read' && (tool.type !== 'bash' || tool.isExpanded)">
                    <pre v-if="tool.content" class="claude-tool-content">{{ tool.content }}</pre>
                    <pre v-if="tool.output" class="claude-tool-content output">{{ tool.output }}</pre>
                  </template>
                  <div v-if="tool.diff" class="claude-diff-block">
                    <div
                      v-for="(dLine, dIdx) in tool.diff"
                      :key="dIdx"
                      :class="dLine.startsWith('+') ? 'diff-add' : dLine.startsWith('-') ? 'diff-del' : 'diff-ctx'"
                    >
                      {{ dLine }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Streaming/final assistant answer -->
              <div v-if="msg.text" class="claude-asst-text" v-html="formatMarkdown(msg.text)"></div>
            </div>
          </div>
        </template>
      </template>

      <!-- Optional compact task mode: only the current live task is visible -->
      <div
        v-if="claudeStore.compactTaskMode && claudeStore.isGenerating && currentLiveTask"
        class="claude-current-task"
      >
        <div class="current-task-main">
          <span class="current-task-spinner"></span>
          <div class="current-task-copy">
            <span class="current-task-label">{{ currentLiveTask.label }}</span>
            <span class="current-task-title">{{ currentLiveTask.title }}</span>
          </div>
        </div>
        <div class="current-task-meta">
          <span>{{ currentLiveTask.phase }}</span>
          <span>·</span>
          <span>{{ elapsedSeconds }}s</span>
        </div>
      </div>

    </div>

    <!-- 2. Bottom Controls & Signature Input Box -->
    <div class="claude-ext-bottom-wrap">
      <!-- Usage Limit Warning Banner (Chỉ hiện khi tài khoản thực tế bị cảnh báo quota) -->
      <div v-if="usageWarning" class="claude-ext-usage-banner">
        <div class="claude-banner-content">
          <span>{{ usageWarning }}</span>
        </div>
        <button type="button" class="claude-banner-close" @click="usageWarning = null">✕</button>
      </div>

      <!-- Model Selector Popup Menu -->
      <ModelSelectorPopup
        :isOpen="isModelPopupOpen"
        :modelValue="currentModel"
        @update:modelValue="onModelChange"
        @close="isModelPopupOpen = false"
      />

      <!-- Limits & Usage Popup Menu -->
      <ClaudeLimitsPopup
        :isOpen="claudeStore.isLimitsPopupOpen"
        @close="claudeStore.isLimitsPopupOpen = false"
      />

      <!-- Input Box (Terracotta Highlight Border) -->
      <div class="claude-ext-input-box" :class="{ focused: isInputFocused }">
        <!-- Top Row: Input Textarea + Mic -->
        <div class="claude-ext-input-row">
          <textarea
            ref="inputRef"
            v-model="inputText"
            class="claude-ext-textarea"
            :placeholder="t('claudeView.placeholder')"
            rows="1"
            @focus="isInputFocused = true"
            @blur="isInputFocused = false"
            @keydown="handleKeyDown"
            @input="autoResize"
          ></textarea>
          <button
            type="button"
            class="claude-permission-shield-btn"
            :class="{ bypass: activeSession?.bypassPermissions }"
            :title="activeSession?.bypassPermissions ? t('claudeView.shieldBypassOn') : t('claudeView.shieldBypassOff')"
            :aria-label="activeSession?.bypassPermissions ? t('claudeView.shieldTurnOff') : t('claudeView.shieldTurnOn')"
            @click="toggleBypassPermissions"
          >
            <i :class="activeSession?.bypassPermissions ? 'ri-shield-cross-line' : 'ri-shield-check-line'"></i>
          </button>
        </div>

        <!-- Bottom Controls Bar -->
        <div class="claude-ext-controls-bar">
          <!-- Left Controls -->
          <div class="claude-ext-left-controls">
            <!-- Target button: Compact task mode toggle -->
            <button
              type="button"
              class="claude-ctrl-btn"
              :class="{ active: claudeStore.compactTaskMode }"
              :title="claudeStore.compactTaskMode ? t('header.disableCompactTask') : t('header.enableCompactTask')"
              @click.stop="claudeStore.toggleCompactTaskMode()"
            >
              <i class="ri-focus-3-line"></i>
            </button>

            <!-- Dashboard button: Limits & Usage -->
            <button
              type="button"
              class="claude-ctrl-btn"
              :title="t('header.limits')"
              @click.stop="claudeStore.isLimitsPopupOpen = true"
            >
              <i class="ri-dashboard-3-line" style="color: #f59e0b;"></i>
            </button>

            <!-- Context Window: 63k/1000k -->
            <span
              class="claude-context-pill"
              title="Context Window usage"
              @click.stop="openLimits"
            >
              <span class="ctx-used">{{ currentContextTokens }}</span>
              <span class="ctx-max">/1000k</span>
            </span>

            <!-- Model selector badge: Sonnet 5.5 Medium -->
            <button
              type="button"
              class="claude-model-badge"
              :title="t('claudeView.changeModel')"
              @click.stop="isModelPopupOpen = !isModelPopupOpen; claudeStore.isLimitsPopupOpen = false"
            >
              <span>{{ currentModel }}</span>
            </button>
          </div>

          <!-- Right Controls -->
          <div class="claude-ext-right-controls">
            <!-- Mode badge: ⚡ Auto -->
            <button
              type="button"
              class="claude-mode-badge"
              :title="t('claudeView.execMode')"
              @click="cycleMode"
            >
              <i class="ri-flashlight-line"></i>
              <span>{{ currentMode }}</span>
            </button>

            <!-- Send / Stop button -->
            <button
              type="button"
              class="claude-send-btn"
              :class="{
                active: inputText.trim().length > 0 && !claudeStore.isGenerating,
                stopping: claudeStore.isGenerating
              }"
              :title="claudeStore.isGenerating ? t('claudeView.stopRun') : t('claudeView.sendEnter')"
              :disabled="!claudeStore.isGenerating && !inputText.trim()"
              @click="claudeStore.isGenerating ? handleStop() : handleSend()"
            >
              <i :class="claudeStore.isGenerating ? 'ri-stop-fill' : 'ri-arrow-up-line'"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile Claude shortcut bar: between chat composer and bottom dock -->
    <div class="claude-shortcut-bar">
      <button type="button" class="claude-shortcut-key" :title="t('claudeView.newLine')" @click="insertNewLine">
        <span>⇧ Enter</span>
        <small>{{ t('claudeView.newLineDesc') }}</small>
      </button>
      <button type="button" class="claude-shortcut-key" :title="t('claudeView.copy')" @click="copySelectedText">
        <span>Ctrl C</span>
        <small>{{ t('claudeView.copyDesc') }}</small>
      </button>
      <button type="button" class="claude-shortcut-key" :title="t('claudeView.pasteTitle')" @click="pasteClipboard">
        <span>Ctrl V</span>
        <small>{{ t('claudeView.pasteDesc') }}</small>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue';
import { useClaudeStore } from '../stores/claudeStore.js';
import ModelSelectorPopup from './ModelSelectorPopup.vue';
import ClaudeLimitsPopup from './ClaudeLimitsPopup.vue';
import { useI18n } from '../composables/useI18n.js';

const emit = defineEmits<{
  (e: 'open-tree-picker'): void;
}>();

const claudeStore = useClaudeStore();
const { t } = useI18n();
const streamRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLTextAreaElement | null>(null);

const inputText = ref('');
const isInputFocused = ref(false);
const usageWarning = ref<string | null>(null);
const isModelPopupOpen = ref(false);

function openLimits() {
  isModelPopupOpen.value = false;
  claudeStore.isLimitsPopupOpen = true;
}

const activeSession = computed(() => claudeStore.activeSession);
const currentModel = computed(() => activeSession.value?.model || 'Sonnet 5.5 Medium');
const currentMode = computed(() => activeSession.value?.mode || 'Auto');
const currentContextTokens = computed(() => {
  const s = activeSession.value;
  if (!s || !s.messages || s.messages.length === 0) return '0';
  if (!s.contextTokens || s.contextTokens === '0' || s.contextTokens === '0k') return '0';
  return s.contextTokens;
});

const elapsedSeconds = ref(0);
let elapsedTimer: ReturnType<typeof setInterval> | null = null;

const currentLiveMessage = computed(() => {
  const messages = activeSession.value?.messages || [];
  return [...messages].reverse().find((m) => m.sender === 'assistant' && m.isWorking) || null;
});

const currentLiveTask = computed(() => {
  const msg = currentLiveMessage.value;
  if (!msg) return null;
  const tools = msg.tools || [];
  const running = [...tools].reverse().find((t) => t.status === 'running');
  const latest = running || tools[tools.length - 1];

  if (latest) {
    const cleanTitle = latest.title.replace(new RegExp(`^(${t('claudeView.stripRun')}|${t('claudeView.stripRead')}|${t('claudeView.stripEdit')}):\\s*`, 'i'), '');
    let label = 'Running';
    let phase = 'Running';
    if (latest.type === 'read') {
      label = 'Reading';
      phase = 'Reading file';
    } else if (latest.type === 'edit') {
      label = 'Writing';
      phase = 'Writing file';
    } else if (latest.type === 'bash') {
      label = 'Running';
      phase = 'Running command';
    }
    return { title: cleanTitle, label, phase };
  }

  return { title: t('claudeView.analyzingCodebase'), label: 'Thinking', phase: 'Thinking' };
});

watch(() => claudeStore.isGenerating, (running) => {
  if (elapsedTimer) {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
  if (running) {
    elapsedSeconds.value = 0;
    elapsedTimer = setInterval(() => {
      elapsedSeconds.value += 1;
    }, 1000);
  }
}, { immediate: true });

function scrollToBottom() {
  nextTick(() => {
    if (streamRef.value) {
      streamRef.value.scrollTop = streamRef.value.scrollHeight;
    }
  });
}

watch(
  () => activeSession.value?.messages.length,
  () => {
    scrollToBottom();
  }
);

function closeModelPopupOnDocumentClick() {
  isModelPopupOpen.value = false;
}

onMounted(() => {
  scrollToBottom();
  claudeStore.fetchLimits();
  document.addEventListener('click', closeModelPopupOnDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener('click', closeModelPopupOnDocumentClick);
  if (elapsedTimer) clearInterval(elapsedTimer);
});

function autoResize() {
  const el = inputRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && claudeStore.isGenerating) {
    e.preventDefault();
    handleStop();
    return;
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

async function handleStop() {
  if (!claudeStore.isGenerating) return;
  await claudeStore.cancelGeneration();
}

function replaceInputSelection(text: string) {
  const el = inputRef.value;
  if (!el) return;
  const start = el.selectionStart ?? inputText.value.length;
  const end = el.selectionEnd ?? start;
  inputText.value = inputText.value.slice(0, start) + text + inputText.value.slice(end);
  nextTick(() => {
    el.focus();
    const cursor = start + text.length;
    el.setSelectionRange(cursor, cursor);
    autoResize();
  });
}

function insertNewLine() {
  replaceInputSelection('\n');
}

async function copySelectedText() {
  const el = inputRef.value;
  if (!el) return;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const selected = inputText.value.slice(start, end);
  if (!selected) {
    el.focus();
    return;
  }
  try {
    await navigator.clipboard.writeText(selected);
  } catch (_) {
    el.focus();
  }
}

async function pasteClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) replaceInputSelection(text);
  } catch (_) {
    inputRef.value?.focus();
  }
}

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || claudeStore.isGenerating) return;

  inputText.value = '';
  if (inputRef.value) {
    inputRef.value.style.height = 'auto';
  }
  scrollToBottom();

  await claudeStore.sendMessage(text);
  scrollToBottom();
}

function onModelChange(newModel: string) {
  if (activeSession.value) {
    claudeStore.updateSession(activeSession.value.id, { model: newModel });
  }
}

async function toggleBypassPermissions() {
  const session = activeSession.value;
  if (!session || claudeStore.isGenerating) return;
  await claudeStore.updateSession(session.id, {
    bypassPermissions: !session.bypassPermissions,
  });
}

function cycleMode() {
  const modes = ['Auto', 'Manual', 'Plan', 'AcceptEdits'];
  const curIdx = modes.indexOf(currentMode.value);
  const next = modes[(curIdx + 1) % modes.length];
  if (activeSession.value) {
    claudeStore.updateSession(activeSession.value.id, { mode: next });
  }
}

function toolIcon(type: string) {
  switch (type) {
    case 'read':
      return 'ri-file-search-line';
    case 'edit':
      return 'ri-edit-2-line';
    case 'bash':
      return 'ri-terminal-line';
    default:
      return 'ri-tools-line';
  }
}

function toggleToolExpansion(tool: any) {
  tool.isExpanded = tool.isExpanded !== true;
}

function formatMarkdown(text: string): string {
  if (!text) return '';
  let str = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold
  str = str.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  str = str.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Inline code
  str = str.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');
  // Linebreaks
  str = str.replace(/\n/g, '<br>');
  return str;
}

function showContextToast() {
  alert(`Context Window: ${currentContextTokens.value} / 1000k tokens (6.3% used)`);
}

function showUsageToast() {
  alert(`Weekly limit: 81% used. Resets in 19 minutes.`);
}
</script>

<style scoped>
.claude-extension-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  max-width: 100%;
  background: #1e1e24;
  position: relative;
  overflow: hidden;
  overflow-x: hidden;
  overscroll-behavior-x: none;
  touch-action: pan-y;
}

.claude-shortcut-bar {
  height: 36px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  overflow-x: auto;
  scrollbar-width: none;
  background: #11131a;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
  -webkit-overflow-scrolling: touch;
}

.claude-shortcut-bar::-webkit-scrollbar {
  display: none;
}

.claude-shortcut-key {
  height: 28px;
  min-width: max-content;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 9px;
  border: 1px solid #343843;
  border-radius: 6px;
  background: #242731;
  color: #e2e8f0;
  font-size: 10.5px;
  font-family: var(--font-mono, monospace);
  cursor: pointer;
  touch-action: manipulation;
  flex-shrink: 0;
}

.claude-shortcut-key small {
  color: #71717a;
  font-size: 9px;
  font-family: inherit;
}

.claude-shortcut-key:active {
  background: #353946;
  border-color: #64748b;
}

/* 1. Stream Area */
.claude-ext-stream {
  flex: 1;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior-x: none;
  overscroll-behavior-y: contain;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
  padding: 16px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-sizing: border-box;
}

/* User Message Card */
.claude-ext-user-msg {
  background: #25252b;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13.5px;
  color: #f1f5f9;
  line-height: 1.45;
  word-break: break-word;
  overflow-wrap: anywhere;
  max-width: 100%;
  box-sizing: border-box;
}

/* Assistant Message */
.claude-ext-asst-msg {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 2px 4px;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.claude-asst-dot {
  color: #9ca3af;
  font-size: 12px;
  line-height: 1.5;
  user-select: none;
  flex-shrink: 0;
}

.claude-asst-dot.pulsing {
  color: #d97757;
  animation: pulse 1s infinite alternate;
}

@keyframes pulse {
  from { opacity: 0.3; }
  to { opacity: 1; }
}

.claude-asst-content {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-x: hidden;
}

.claude-asst-text {
  font-size: 13.5px;
  color: #e2e8f0;
  line-height: 1.55;
  word-break: break-word;
  overflow-wrap: anywhere;
  max-width: 100%;
}

:deep(.inline-code) {
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 5px;
  border-radius: 4px;
  color: #93c5fd;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  word-break: break-all;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

/* Tool Cards */
.claude-current-task {
  margin: auto 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #18181d;
  border-radius: 8px;
  padding: 9px 11px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
  animation: currentTaskIn 0.16s ease-out;
}

.current-task-main {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.current-task-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(217, 119, 87, 0.28);
  border-top-color: #d97757;
  border-radius: 50%;
  flex-shrink: 0;
  animation: thinkingSpin 0.8s linear infinite;
}

.current-task-copy {
  min-width: 0;
  display: flex;
  gap: 6px;
  align-items: baseline;
  font-size: 12px;
}

.current-task-label {
  color: #d97757;
  font-weight: 700;
  flex-shrink: 0;
}

.current-task-title {
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.current-task-meta {
  margin-top: 5px;
  padding-left: 22px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  color: #71717a;
  font-size: 10.5px;
  font-family: var(--font-mono, monospace);
}

@keyframes currentTaskIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.claude-tool-cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
  max-width: 100%;
  min-width: 0;
}

.claude-tool-card {
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow-x: hidden;
}

.claude-tool-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.bash-expander {
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  touch-action: manipulation;
}

.bash-expander .claude-tool-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bash-expand-icon {
  color: #94a3b8;
  font-size: 15px;
  flex-shrink: 0;
}

.claude-tool-card.bash-collapsible .claude-tool-header {
  margin-bottom: 0;
}

.claude-tool-card.bash-collapsible .claude-tool-content {
  margin-top: 7px;
}

.claude-tool-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.claude-tool-badge.read {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.claude-tool-badge.edit {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.claude-tool-badge.bash {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.claude-tool-title {
  color: #cbd5e1;
  font-weight: 500;
}

.claude-tool-content {
  background: #09090b;
  padding: 6px 8px;
  border-radius: 4px;
  color: #94a3b8;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  touch-action: pan-x pan-y;
  margin: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.claude-diff-block {
  background: #09090b;
  padding: 6px 8px;
  border-radius: 4px;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  touch-action: pan-x pan-y;
  max-width: 100%;
  box-sizing: border-box;
}

.diff-add {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
}

.diff-del {
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}

.diff-ctx {
  color: #94a3b8;
}

/* Live Thinking Panel */
.claude-thinking-panel {
  border-left: 2px solid rgba(217, 119, 87, 0.45);
  background: rgba(217, 119, 87, 0.05);
  border-radius: 0 6px 6px 0;
  overflow: hidden;
  max-width: 100%;
  box-sizing: border-box;
}

.claude-thinking-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: transparent;
  border: 0;
  color: #c9a493;
  padding: 7px 9px;
  font-size: 11.5px;
  cursor: pointer;
  touch-action: manipulation;
}

.thinking-status-wrap {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.thinking-spinner,
.tool-spinner {
  width: 11px;
  height: 11px;
  border: 1.5px solid rgba(217, 119, 87, 0.3);
  border-top-color: #d97757;
  border-radius: 50%;
  animation: thinkingSpin 0.8s linear infinite;
}

.thinking-complete-icon {
  color: #34d399;
  font-size: 13px;
}

.claude-thinking-content {
  padding: 0 9px 8px 27px;
  color: #a1a1aa;
  font-size: 11.5px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.claude-tool-status {
  margin-left: auto;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}

.claude-tool-status.done {
  color: #34d399;
}

.claude-tool-status.error {
  color: #f87171;
}

.claude-tool-content.output {
  margin-top: 5px;
  max-height: 160px;
  overflow: auto;
  color: #a7f3d0;
}

@keyframes thinkingSpin {
  to { transform: rotate(360deg); }
}

/* 2. Bottom Wrap & Signature Input */
.claude-ext-bottom-wrap {
  position: relative;
  padding: 0 12px 14px;
  background: #1e1e24;
}

/* Banner */
.claude-ext-usage-banner {
  background: #2b2319;
  border: 1px solid #574127;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 8px;
  font-size: 11.5px;
  color: #e5a54b;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.claude-banner-content {
  flex: 1;
  line-height: 1.35;
}

.claude-banner-link {
  color: #e5a54b;
  text-decoration: underline;
  cursor: pointer;
}

.claude-banner-close {
  background: transparent;
  border: none;
  color: #e5a54b;
  font-size: 14px;
  cursor: pointer;
  padding: 0 4px;
}

/* Signature Input Box */
.claude-ext-input-box {
  background: #1e1e24;
  border: 1px solid rgba(217, 119, 87, 0.55);
  border-radius: 12px;
  padding: 8px 10px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.claude-ext-input-box.focused {
  border-color: #d97757;
  box-shadow: 0 0 0 1px rgba(217, 119, 87, 0.3);
}

.claude-ext-input-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.claude-ext-textarea {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #f1f5f9;
  font-size: 13.5px;
  resize: none;
  padding: 4px 0;
  max-height: 120px;
  line-height: 1.4;
  font-family: inherit;
}

.claude-ext-textarea::placeholder {
  color: #6b7280;
}

.claude-permission-shield-btn {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(34, 197, 94, 0.09);
  border: 1px solid rgba(34, 197, 94, 0.28);
  border-radius: 7px;
  color: #4ade80;
  font-size: 16px;
  cursor: pointer;
  padding: 0;
  touch-action: manipulation;
}

.claude-permission-shield-btn.bypass {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.45);
  color: #fbbf24;
}

.claude-permission-shield-btn:active {
  transform: scale(0.94);
}

/* Controls Bar */
.claude-ext-controls-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.claude-ext-left-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  flex: 1;
  min-width: 0;
  -webkit-overflow-scrolling: touch;
}

.claude-ext-left-controls::-webkit-scrollbar {
  display: none;
}

.claude-ext-right-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.claude-ctrl-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #cbd5e1;
  font-size: 14px;
  cursor: pointer;
  touch-action: manipulation;
  flex-shrink: 0;
}

.claude-ctrl-btn:hover {
  background: #273549;
  color: #f1f5f9;
}

.claude-ctrl-btn:active {
  background: #334155;
  transform: scale(0.96);
}

.claude-ctrl-btn.active {
  background: rgba(217, 119, 87, 0.2);
  border-color: rgba(217, 119, 87, 0.45);
  color: #d97757;
}

/* Context Window Pill */
.claude-context-pill {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #9ca3af;
  font-size: 11px;
  font-family: var(--font-mono, monospace);
  padding: 2px 7px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  flex-shrink: 0;
  touch-action: manipulation;
}

.claude-context-pill .ctx-used {
  color: #f1f5f9;
  font-weight: 600;
}

.claude-context-pill .ctx-max {
  color: #6b7280;
}

/* Model Badge */
.claude-model-badge {
  background: #25252d;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
  touch-action: manipulation;
  white-space: nowrap;
}

.claude-model-badge:hover {
  background: #2f2f38;
}

/* Mode Badge */
.claude-mode-badge {
  background: transparent;
  border: none;
  color: #9ca3af;
  font-size: 11.5px;
  display: flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  padding: 2px 4px;
}

.claude-mode-badge:hover {
  color: #f1f5f9;
}

/* Send Button */
.claude-send-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: none;
  background: #38312d;
  color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: not-allowed;
  font-size: 15px;
  transition: all 0.15s ease;
}

.claude-send-btn.active {
  background: #d97757;
  color: #fff;
  cursor: pointer;
}

.claude-send-btn.stopping {
  background: #dc2626;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.3);
}

.claude-send-btn.stopping:active {
  background: #b91c1c;
  transform: scale(0.94);
}

/* Empty State (Image 3) */
.claude-empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 250px;
  user-select: none;
}

.claude-brand-center {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  animation: fadeInLogo 0.4s ease;
}

.claude-sparkle-logo {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.claude-brand-text {
  font-family: "Georgia", "Charter", "Times New Roman", serif;
  font-size: 26px;
  font-weight: 500;
  color: #f1f5f9;
  letter-spacing: -0.3px;
}

@keyframes fadeInLogo {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

</style>
