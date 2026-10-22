<template>
  <div class="claude-extension-container">
    <!-- Floating Action Toast Notification -->
    <transition name="claude-toast-fade">
      <div v-if="actionToast" class="claude-action-toast" :class="actionToast.type">
        <i :class="actionToast.icon || 'ri-checkbox-circle-fill'"></i>
        <span>{{ actionToast.message }}</span>
      </div>
    </transition>

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
        <button
          type="button"
          class="claude-empty-hub-btn"
          @click.stop="$emit('open-session-hub')"
        >
          <i class="ri-history-line"></i>
          <span>{{ t('claudeHub.tabCliSessions') || 'Xem các phiên làm việc (Project Sessions)' }}</span>
        </button>
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
            v-show="!claudeStore.compactTaskMode || !msg.isWorking || !!msg.text"
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
                  <i v-if="msg.thinking" :class="msg.isThinkingExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'"></i>
                </button>
                <div v-if="msg.isThinkingExpanded && msg.thinking" class="claude-thinking-content">
                  {{ msg.thinking }}
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
            <span v-if="currentLiveTask.title" class="current-task-title">{{ currentLiveTask.title }}</span>
          </div>
        </div>
        <div class="current-task-meta">
          <span v-if="currentLiveTask.phase">{{ currentLiveTask.phase }}</span>
          <span v-if="currentLiveTask.phase">·</span>
          <span>{{ elapsedSeconds }}s</span>
        </div>
      </div>

      <!-- Background execution / Reconnecting banner -->
      <div v-if="claudeStore.isReconnecting" class="claude-reconnecting-banner">
        <i class="ri-loader-4-line ri-spin"></i>
        <span>Claude đang chạy nền trên máy chủ • Đang đồng bộ phản hồi...</span>
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
        :serverId="activeSession?.serverId || serverStore.currentServerId"
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
        <!-- Slash Command Autocomplete Menu (Exact Claude style: flat unified list, dark palette, terracotta highlight) -->
        <div
          v-if="isSlashMenuOpen"
          ref="slashMenuRef"
          class="claude-slash-menu"
          @mousedown.prevent
        >
          <button
            v-for="(cmd, idx) in filteredSlashCommands"
            :key="cmd.name"
            type="button"
            class="claude-slash-item"
            :class="{ active: idx === activeSlashIndex }"
            :data-index="idx"
            @mousedown.prevent="selectSlashCommand(cmd)"
            @touchstart.prevent="selectSlashCommand(cmd)"
            @click.stop.prevent="selectSlashCommand(cmd)"
            @mouseenter="activeSlashIndex = idx"
          >
            <div class="slash-item-left">
              <span class="slash-item-name">{{ cmd.name }}</span>
              <span v-if="cmd.arg" class="slash-item-arg">{{ cmd.arg }}</span>
            </div>
            <div class="slash-item-desc">{{ cmd.desc }}</div>
          </button>
        </div>

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
            <button
              type="button"
              class="claude-ctrl-btn claude-add-context-btn"
              aria-label="Add context"
              title="Add context"
              @click.stop="openContextPicker"
            >
              <i class="ri-attachment-2"></i>
            </button>
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

            <!-- Context Window: 63k/1000k -->
            <span
              class="claude-context-pill"
              title="Context Window usage"
              @click.stop="openLimits"
            >
              <span class="ctx-used">{{ currentContextTokens }}</span>
              <span class="ctx-max">/{{ maxContextLabel }}</span>
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

    <ContextAttachmentPicker
      v-if="isContextPickerOpen"
      :server-id="activeSession?.serverId || serverStore.currentServerId"
      :project-id="activeSession?.projectId || projectStore.currentProject?.id"
      :root-path="projectStore.currentProject?.rootPath || serverStore.currentServer.workspace || '~'"
      @confirm="attachContextPath"
      @close="isContextPickerOpen = false"
    />

    <!-- Mobile Claude shortcut bar: between chat composer and bottom dock -->
    <div class="claude-shortcut-bar">
      <button type="button" class="claude-shortcut-key" title="Xoá sạch hội thoại" @click="inputText = '/clear'; handleSend()">
        <span>/clear</span>
        <small>Dọn dẹp</small>
      </button>
      <button type="button" class="claude-shortcut-key" title="Chạy /init để khởi tạo dự án" @click="inputText = '/init'; handleSend()">
        <span>/init</span>
        <small>Khởi tạo</small>
      </button>
      <button type="button" class="claude-shortcut-key" title="Xem hướng dẫn lệnh Claude" @click="inputText = '/help'; handleSend()">
        <span>/help</span>
        <small>Trợ giúp</small>
      </button>
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
import { useProjectStore } from '../stores/projectStore.js';
import { useServerStore } from '../stores/serverStore.js';
import ModelSelectorPopup from './ModelSelectorPopup.vue';
import ClaudeLimitsPopup from './ClaudeLimitsPopup.vue';
import ContextAttachmentPicker from './ContextAttachmentPicker.vue';
import { useI18n } from '../composables/useI18n.js';

const emit = defineEmits<{
  (e: 'open-session-hub'): void;
}>();

const claudeStore = useClaudeStore();
const projectStore = useProjectStore();
const serverStore = useServerStore();
const { t, i18n } = useI18n();
const streamRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLTextAreaElement | null>(null);

const inputText = ref('');
const isInputFocused = ref(false);
const usageWarning = ref<string | null>(null);
const isModelPopupOpen = ref(false);
const isContextPickerOpen = ref(false);

function openContextPicker() {
  isContextPickerOpen.value = true;
}

function attachContextPath(path: string) {
  if (!path) return;
  const separator = inputText.value && !/\s$/.test(inputText.value) ? ' ' : '';
  inputText.value += `${separator}@${path} `;
  isContextPickerOpen.value = false;
  nextTick(() => {
    inputRef.value?.focus();
    const end = inputText.value.length;
    inputRef.value?.setSelectionRange(end, end);
    autoResize();
  });
}

const actionToast = ref<{ message: string; icon?: string; type?: 'success' | 'info' } | null>(null);
let toastTimer: any = null;

function showActionToast(message: string, icon = 'ri-checkbox-circle-fill', type: 'success' | 'info' = 'success') {
  if (toastTimer) clearTimeout(toastTimer);
  actionToast.value = { message, icon, type };
  toastTimer = setTimeout(() => {
    actionToast.value = null;
  }, 3500);
}

async function executeClearSession() {
  if (activeSession.value) {
    await claudeStore.clearMessages(activeSession.value.id);
    showActionToast('🧹 Đã xóa sạch lịch sử hội thoại của phiên này.');
  }
}

interface SlashCommandDef {
  name: string;
  arg?: string;
  descVi: string;
  descEn: string;
  action?: 'clear' | 'model' | 'limits' | 'resume' | 'help' | 'status' | 'permissions';
}

const CLAUDE_SLASH_COMMANDS: SlashCommandDef[] = [
  { name: '/clear', descVi: 'Xóa sạch lịch sử hội thoại hiện tại', descEn: 'Clear conversation history and reset context', action: 'clear' },
  { name: '/compact', arg: '[focus]', descVi: 'Nén ngữ cảnh cuộc trò chuyện để tiết kiệm token', descEn: 'Compact conversation history to save tokens' },
  { name: '/resume', arg: '[id]', descVi: 'Mở danh sách phiên làm việc hoặc đổi phiên', descEn: 'Resume or switch to a different session', action: 'resume' },
  { name: '/model', arg: '[name]', descVi: 'Chọn hoặc chuyển đổi model Claude', descEn: 'Select or switch Claude model', action: 'model' },
  { name: '/usage', descVi: 'Xem hạn mức sử dụng (quota 5 giờ và tuần)', descEn: 'View plan limits and rate limit status', action: 'limits' },
  { name: '/cost', descVi: 'Xem chi phí và token đã dùng của phiên', descEn: 'Show token usage and cost for this session' },
  { name: '/context', descVi: 'Trực quan hóa mức độ chiếm dụng Context Window', descEn: 'Visualize context window usage' },
  { name: '/review', descVi: 'Review toàn bộ thay đổi git diff tìm lỗi & code style', descEn: 'Review code changes for bugs and style' },
  { name: '/security-review', descVi: 'Quét và phân tích các lỗ hổng bảo mật trong code', descEn: 'Security analysis of code changes' },
  { name: '/plan', arg: '[task]', descVi: 'Lập kế hoạch giải pháp trước khi code', descEn: 'Plan tasks before implementation' },
  { name: '/commit', descVi: 'Tự động tạo commit message từ git diff', descEn: 'Generate commit message from git diff' },
  { name: '/init', descVi: 'Khởi tạo file hướng dẫn CLAUDE.md cho dự án', descEn: 'Initialize CLAUDE.md project guide' },
  { name: '/memory', descVi: 'Xem hoặc chỉnh sửa bộ nhớ dự án (CLAUDE.md)', descEn: 'Edit project memory (CLAUDE.md)' },
  { name: '/effort', arg: '[level]', descVi: 'Đặt mức độ tư duy/suy nghĩ (low, medium, high, max)', descEn: 'Set reasoning effort (low, medium, high, max)' },
  { name: '/rewind', descVi: 'Quay lui về checkpoint trước của code hoặc chat', descEn: 'Revert to a previous checkpoint' },
  { name: '/todos', descVi: 'Xem danh sách các việc cần làm đang theo dõi', descEn: 'List tracked action items' },
  { name: '/permissions', descVi: 'Bật/tắt chế độ bỏ qua hỏi quyền thực thi', descEn: 'Toggle bypass tool permissions', action: 'permissions' },
  { name: '/mcp', descVi: 'Quản lý các kết nối MCP server', descEn: 'Manage Model Context Protocol (MCP) servers' },
  { name: '/status', descVi: 'Xem thông tin phiên, kết nối mạng và hệ thống', descEn: 'Show version, connectivity, and session info', action: 'status' },
  { name: '/btw', arg: '[question]', descVi: 'Đặt câu hỏi phụ nhanh ngoài lề mà không tốn context', descEn: 'Ask a side question without context cost' },
  { name: '/help', descVi: 'Xem tất cả các lệnh và phím tắt hỗ trợ', descEn: 'Show available commands and shortcuts', action: 'help' },
  { name: '/exit', descVi: 'Kết thúc phiên làm việc hiện tại', descEn: 'End current Claude session' },
];

const isSlashMenuDismissed = ref(false);
const activeSlashIndex = ref(0);
const slashMenuRef = ref<HTMLElement | null>(null);

const availableSlashCommands = computed(() => {
  const isEn = i18n?.locale === 'en';
  return CLAUDE_SLASH_COMMANDS.map((cmd) => ({
    name: cmd.name,
    arg: cmd.arg,
    desc: isEn ? cmd.descEn : cmd.descVi,
    action: cmd.action,
  }));
});

const slashQuery = computed(() => {
  const text = inputText.value;
  if (!text.startsWith('/')) return null;
  if (text.includes('\n')) return null;
  if (text.includes(' ')) return null;
  return text.slice(1).toLowerCase();
});

const filteredSlashCommands = computed(() => {
  const q = slashQuery.value;
  if (q === null) return [];
  if (!q) return availableSlashCommands.value;
  const byNameStart = availableSlashCommands.value.filter((cmd) =>
    cmd.name.slice(1).toLowerCase().startsWith(q)
  );
  const byNameInclude = availableSlashCommands.value.filter(
    (cmd) =>
      !cmd.name.slice(1).toLowerCase().startsWith(q) &&
      cmd.name.slice(1).toLowerCase().includes(q)
  );
  return [...byNameStart, ...byNameInclude];
});

const isSlashMenuOpen = computed(() => {
  return (
    !isSlashMenuDismissed.value &&
    slashQuery.value !== null &&
    filteredSlashCommands.value.length > 0
  );
});

watch(
  () => inputText.value,
  () => {
    isSlashMenuDismissed.value = false;
    activeSlashIndex.value = 0;
  }
);

function scrollActiveSlashIntoView() {
  nextTick(() => {
    if (!slashMenuRef.value) return;
    const activeEl = slashMenuRef.value.querySelector<HTMLElement>(
      `.claude-slash-item[data-index="${activeSlashIndex.value}"]`
    );
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  });
}

function addLocalExchange(userText: string, assistantText: string) {
  let session = activeSession.value;
  if (!session) return;
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  session.messages.push({
    id: `u-${Date.now()}`,
    sender: 'user',
    text: userText,
    time: timeStr,
  });
  session.messages.push({
    id: `a-${Date.now() + 1}`,
    sender: 'assistant',
    text: assistantText,
    time: timeStr,
  });
  scrollToBottom();
}

function showHelpGuide() {
  addLocalExchange(
    '/help',
    `### 💡 Danh sách Slash Commands hỗ trợ trong Claude Chat\n\n` +
    `- **/clear**: Xoá sạch lịch sử tin nhắn trong phiên hiện tại.\n` +
    `- **/resume [id]**: Mở trình quản lý phiên (Hub) hoặc chuyển sang phiên khác bằng ID/tên.\n` +
    `- **/model [name]**: Mở menu chọn Model hoặc đổi nhanh (\`sonnet\`, \`opus\`, \`haiku\`).\n` +
    `- **/usage**: Xem hạn mức sử dụng (quota 5 giờ và theo tuần).\n` +
    `- **/status**: Xem thông tin trạng thái phiên hiện tại, model và máy chủ.\n` +
    `- **/context**: Trực quan hoá mức độ chiếm dụng của Context Window.\n` +
    `- **/cost**: Thống kê số lượng token và chi phí API của phiên làm việc.\n` +
    `- **/compact [focus]**: Tóm tắt và nén ngữ cảnh hội thoại để tiết kiệm token.\n` +
    `- **/review**: Yêu cầu Claude review toàn bộ git diff tìm lỗi và cải thiện code.\n` +
    `- **/security-review**: Quét và phân tích các lỗ hổng bảo mật trong mã nguồn.\n` +
    `- **/plan [nhiệm vụ]**: Bật chế độ lập kế hoạch giải pháp trước khi code.\n` +
    `- **/commit**: Phân tích git diff và tự động tạo git commit message.\n` +
    `- **/init**: Khởi tạo file hướng dẫn \`CLAUDE.md\` cho dự án.\n` +
    `- **/permissions**: Bật / tắt chế độ bỏ qua hỏi quyền thực thi (Bypass Permissions).\n` +
    `- **/effort [low|medium|high|max]**: Đặt mức độ tư duy/suy nghĩ cho Claude.\n` +
    `- **/todos**: Kiểm tra danh sách các đầu việc đang theo dõi trong dự án.\n` +
    `- **/help**: Hiển thị bảng hướng dẫn này.`
  );
}

function showStatusInfo() {
  const s = activeSession.value;
  const srv = s?.serverId || serverStore.currentServerId || 'server-local';
  addLocalExchange(
    '/status',
    `### ℹ️ Trạng thái phiên làm việc Claude\n\n` +
    `- **Phiên:** ${s?.name || 'Không xác định'} (\`${s?.id || 'N/A'}\`)\n` +
    `- **Model:** \`${s?.model || 'Default Medium'}\`\n` +
    `- **Chế độ:** \`${s?.mode || 'Auto'}\` (Bypass Permissions: **${s?.bypassPermissions ? 'Bật' : 'Tắt'}**)\n` +
    `- **Thư mục (CWD):** \`${s?.cwd || 'N/A'}\`\n` +
    `- **Máy chủ:** \`${srv}\`\n` +
    `- **Số tin nhắn:** ${s?.messages.length || 0}\n` +
    `- **CLI Session ID:** \`${s?.cliSessionId || 'Chưa khởi tạo'}\``
  );
}

function selectSlashCommand(cmd: { name: string; arg?: string }) {
  const completed = cmd.name + ' ';
  inputText.value = completed;
  isSlashMenuDismissed.value = true;
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus();
      const pos = completed.length;
      inputRef.value.setSelectionRange(pos, pos);
    }
    autoResize();
  });
}

function openLimits() {
  isModelPopupOpen.value = false;
  claudeStore.isLimitsPopupOpen = true;
}

const activeSession = computed(() => claudeStore.activeSession);
const currentModel = computed(() => activeSession.value?.model || 'Default Medium');
const currentMode = computed(() => activeSession.value?.mode || 'Auto');

function parseTokenCount(t: string | undefined): number {
  if (!t || t === '0' || t === '0k') return 0;
  const lower = t.toLowerCase().trim();
  if (lower.endsWith('k')) {
    return (parseFloat(lower.slice(0, -1)) || 0) * 1000;
  }
  if (lower.endsWith('m')) {
    return (parseFloat(lower.slice(0, -1)) || 0) * 1000000;
  }
  return parseFloat(lower) || 0;
}

function getModelContextWindow(modelName: string): { maxTokens: number; label: string } {
  const m = (modelName || '').toLowerCase();
  if (m.includes('1m') || m.includes('1000k')) {
    return { maxTokens: 1000000, label: '1000k' };
  }
  return { maxTokens: 200000, label: '200k' };
}

const maxContextInfo = computed(() => getModelContextWindow(currentModel.value));
const maxContextLabel = computed(() => maxContextInfo.value.label);

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

  return { title: '', label: 'Thinking…', phase: '' };
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

function closeModelPopupOnDocumentClick(e?: MouseEvent) {
  isModelPopupOpen.value = false;
  if (isSlashMenuOpen.value && e) {
    const target = e.target as HTMLElement | null;
    if (!target?.closest('.claude-slash-menu') && !target?.closest('.claude-ext-textarea')) {
      isSlashMenuDismissed.value = true;
    }
  }
}

async function handleVisibilityOrFocus() {
  if (document.visibilityState === 'visible') {
    await claudeStore.fetchSessions();
  }
}

onMounted(() => {
  scrollToBottom();
  claudeStore.fetchLimits();
  document.addEventListener('click', closeModelPopupOnDocumentClick);
  document.addEventListener('visibilitychange', handleVisibilityOrFocus);
  window.addEventListener('focus', handleVisibilityOrFocus);
});

onUnmounted(() => {
  document.removeEventListener('click', closeModelPopupOnDocumentClick);
  document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
  window.removeEventListener('focus', handleVisibilityOrFocus);
  if (elapsedTimer) clearInterval(elapsedTimer);
});

function autoResize() {
  const el = inputRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleKeyDown(e: KeyboardEvent) {
  if (isSlashMenuOpen.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeSlashIndex.value =
        (activeSlashIndex.value + 1) % filteredSlashCommands.value.length;
      scrollActiveSlashIntoView();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeSlashIndex.value =
        (activeSlashIndex.value - 1 + filteredSlashCommands.value.length) %
        filteredSlashCommands.value.length;
      scrollActiveSlashIntoView();
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const selected = filteredSlashCommands.value[activeSlashIndex.value];
      if (selected) {
        selectSlashCommand(selected);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      isSlashMenuDismissed.value = true;
      return;
    }
  }

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
  isSlashMenuDismissed.value = false;
  if (inputRef.value) {
    inputRef.value.style.height = 'auto';
  }
  scrollToBottom();

  if (text === '/help') {
    showHelpGuide();
    return;
  }
  if (text === '/status') {
    showStatusInfo();
    return;
  }
  if (text === '/usage') {
    claudeStore.isLimitsPopupOpen = true;
    return;
  }
  if (text === '/clear' || text.startsWith('/clear ')) {
    await executeClearSession();
    return;
  }
  if (text === '/cost') {
    const s = activeSession.value;
    const tokens = currentContextTokens.value;
    const maxInfo = getModelContextWindow(currentModel.value);
    const parsedTokens = parseTokenCount(tokens);
    const pct = ((parsedTokens / maxInfo.maxTokens) * 100).toFixed(1);
    addLocalExchange(
      '/cost',
      `### 📊 Thống kê Token & Context Window\n\n` +
      `• **Model:** \`${currentModel.value}\`\n` +
      `• **Context Window:** \`${tokens} / ${maxInfo.label}\` tokens (${pct}% dung lượng)\n` +
      `• **Số tin nhắn trong phiên:** \`${s?.messages?.length || 0}\` tin nhắn\n` +
      `• **Chế độ thực thi:** \`${currentMode.value}\`\n\n` +
      `💡 *Mẹo: Gõ \`/compact\` nếu context window vượt quá 70% để nén bớt lịch sử.*`
    );
    return;
  }
  if (text === '/model') {
    isModelPopupOpen.value = true;
    return;
  }
  if (text.startsWith('/model ')) {
    const requested = text.slice(7).trim().toLowerCase();
    if (activeSession.value && requested) {
      const curServerId = activeSession.value.serverId || serverStore.currentServerId || 'server-local';
      const serverModels = claudeStore.modelsByServer[curServerId] || claudeStore.availableModels;
      const match = serverModels.find(
        (m) =>
          m.id.toLowerCase().includes(requested) ||
          m.title.toLowerCase().includes(requested) ||
          m.prefix.toLowerCase().includes(requested)
      );
      const targetModel = match ? `${match.prefix} Medium` : requested;
      claudeStore.updateSession(activeSession.value.id, { model: targetModel });
      const label = match?.title || targetModel;
      showActionToast(`🤖 Đã chuyển sang model ${label}`);
      addLocalExchange(text, `🤖 Đã chuyển model sang **${label}**.`);
    }
    return;
  }
  if (text === '/resume') {
    emit('open-session-hub');
    const targetCwd = projectStore.currentProject?.rootPath || activeSession.value?.cwd || '~';
    const projectSessions = await claudeStore.fetchProjectSessions(targetCwd, serverStore.currentServerId);
    const list = projectSessions.slice(0, 15).map((s, idx) => {
      const isCur = s.id === activeSession.value?.cliSessionId;
      const timeStr = new Date(s.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      return `${idx + 1}. \`${s.id.slice(0, 8)}\` • **"${s.summary}"** (${s.userMsgs} tin nhắn, ${timeStr})${isCur ? ' *(đang kết nối)*' : ''}`;
    }).join('\n');
    addLocalExchange(
      '/resume',
      `### 📂 Danh sách phiên làm việc Claude Code (Project Sessions)\n\n` +
      `📁 **Thư mục dự án:** \`${targetCwd}\`\n\n` +
      `${list || '*Chưa tìm thấy phiên Claude CLI nào trong thư mục dự án này.*'}\n\n` +
      `👉 *Gõ \`/resume <số thứ tự hoặc ID>\` (ví dụ \`/resume 1\` hoặc \`/resume ${projectSessions[0]?.id ? projectSessions[0].id.slice(0, 8) : 'uuid'}\`) để khôi phục phiên.*`
    );
    return;
  }
  if (text.startsWith('/resume ')) {
    const query = text.slice(8).trim().toLowerCase();
    if (!query) {
      emit('open-session-hub');
      return;
    }
    const targetCwd = projectStore.currentProject?.rootPath || activeSession.value?.cwd || '~';
    const projectSessions = await claudeStore.fetchProjectSessions(targetCwd, serverStore.currentServerId);
    const idxNum = parseInt(query, 10);
    let target = (!isNaN(idxNum) && idxNum >= 1 && idxNum <= projectSessions.length) ? projectSessions[idxNum - 1] : null;
    if (!target) {
      target = projectSessions.find((s) =>
        s.id.toLowerCase() === query ||
        s.id.toLowerCase().startsWith(query) ||
        s.summary.toLowerCase().includes(query)
      ) || null;
    }
    if (target) {
      const resumed = await claudeStore.resumeProjectSession(
        target.id,
        target.cwd || targetCwd,
        activeSession.value?.id,
        serverStore.currentServerId
      );
      showActionToast(`✅ Đã khôi phục phiên Claude Code: ${target.id.slice(0, 8)}`);
      addLocalExchange(
        text,
        `✅ **Đã khôi phục phiên Claude Code:** \`${target.id}\`\n\n` +
        `- **Chủ đề / Prompt:** "${target.summary}"\n` +
        `- **Số tin nhắn:** ${resumed?.messages.length || target.userMsgs}\n` +
        `- **Model:** ${resumed?.model || target.model}\n\n` +
        `Ngữ cảnh đã sẵn sàng. Bạn có thể tiếp tục gửi tin nhắn trong phiên này.`
      );
    } else {
      addLocalExchange(
        text,
        `❌ Không tìm thấy phiên Claude CLI nào khớp với "${query}". Gõ \`/resume\` để xem danh sách phiên dự án.`
      );
    }
    return;
  }
  if (text === '/permissions') {
    await toggleBypassPermissions();
    const isBypass = activeSession.value?.bypassPermissions;
    showActionToast(
      isBypass ? '🛡️ Đã BẬT bỏ qua hỏi quyền' : '🛡️ Đã TẮT bỏ qua hỏi quyền'
    );
    addLocalExchange(
      '/permissions',
      `🛡️ Chế độ bỏ qua hỏi quyền (Bypass Permissions) hiện đang **${isBypass ? 'BẬT' : 'TẮT'}**.`
    );
    return;
  }
  if (text.startsWith('/effort')) {
    const level = text.replace('/effort', '').trim().toLowerCase();
    if (['low', 'medium', 'high', 'max'].includes(level)) {
      const capLevel = level.charAt(0).toUpperCase() + level.slice(1);
      if (activeSession.value) {
        const currentM = activeSession.value.model || 'Default';
        const baseName = currentM.replace(/\b(Low|Medium|High|Max)\b/i, '').trim();
        const newModel = `${baseName || 'Default'} ${capLevel}`.trim();
        claudeStore.updateSession(activeSession.value.id, { model: newModel });
        addLocalExchange(
          text,
          `⚡ Đã đặt mức độ tư duy (Effort) thành **${capLevel}** (Model: \`${newModel}\`).`
        );
      }
    } else {
      const curEffort = activeSession.value?.model?.match(/\b(Low|Medium|High|Max)\b/i)?.[1] || 'Medium';
      addLocalExchange(
        text,
        `⚡ Mức độ tư duy hiện tại: **${curEffort}**.\n\nCú pháp: \`/effort low\` | \`/effort medium\` | \`/effort high\` | \`/effort max\``
      );
    }
    return;
  }
  if (text === '/plan') {
    if (activeSession.value) {
      claudeStore.updateSession(activeSession.value.id, { mode: 'Plan' });
      addLocalExchange(
        '/plan',
        `📋 Đã kích hoạt **Plan Mode**. Claude sẽ lập kế hoạch chi tiết trước khi chỉnh sửa mã nguồn.`
      );
    }
    return;
  }

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

<style>
/* ClaudeView: Global styling to protect against hash drift */
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

.claude-reconnecting-banner {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 10px auto;
  padding: 6px 14px;
  background: rgba(234, 179, 8, 0.12);
  border: 1px solid rgba(234, 179, 8, 0.3);
  border-radius: 20px;
  color: #facc15;
  font-size: 12.5px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  animation: currentTaskIn 0.2s ease;
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
  position: relative;
  background: #1e1e24;
  border: 1px solid rgba(217, 119, 87, 0.55);
  border-radius: 12px;
  padding: 8px 10px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

/* Slash Command Autocomplete Menu (Claude Design System) */
.claude-slash-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
  max-height: 250px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: #18181d;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(217, 119, 87, 0.15);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 100;
  backdrop-filter: blur(12px);
}

.claude-slash-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 10px;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s ease;
  user-select: none;
  touch-action: manipulation;
}

.claude-slash-item:hover,
.claude-slash-item.active {
  background: rgba(217, 119, 87, 0.15);
}

.slash-item-left {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  flex-shrink: 0;
}

.slash-item-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
  color: #f4f4f5;
}

.claude-slash-item.active .slash-item-name {
  color: #d97757;
}

.slash-item-arg {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11.5px;
  color: #71717a;
}

.slash-item-desc {
  font-size: 11.5px;
  color: #a1a1aa;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

@media (max-width: 480px) {
  .claude-slash-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 7px 9px;
  }
  .slash-item-desc {
    text-align: left;
    font-size: 11px;
    color: #71717a;
  }
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

.claude-add-context-btn {
  width: auto;
  gap: 5px;
  padding: 0 8px;
  font-size: 11px;
  white-space: nowrap;
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
  flex-direction: column;
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

.claude-empty-hub-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 18px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  color: #cbd5e1;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.claude-empty-hub-btn:hover {
  background: rgba(217, 119, 87, 0.15);
  border-color: rgba(217, 119, 87, 0.4);
  color: #f8fafc;
  transform: translateY(-1px);
}

.claude-empty-hub-btn:active {
  transform: translateY(0);
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

/* Floating Action Toast Notification */
.claude-action-toast {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 150;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(24, 24, 29, 0.95);
  border: 1px solid rgba(217, 119, 87, 0.45);
  border-radius: 20px;
  color: #f5f5f7;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 14px rgba(217, 119, 87, 0.25);
  backdrop-filter: blur(10px);
  pointer-events: none;
}

.claude-action-toast i {
  color: #d97757;
  font-size: 15px;
}

.claude-toast-fade-enter-active,
.claude-toast-fade-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.claude-toast-fade-enter-from {
  opacity: 0;
  transform: translate(-50%, -12px) scale(0.95);
}

.claude-toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px) scale(0.98);
}

</style>
