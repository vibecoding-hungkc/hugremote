<template>
  <div class="terminal-view-container">
    <!-- Xterm Terminal Canvas Container -->
    <div class="xterm-container" ref="terminalRef" @click="focusTerminal"></div>

    <!-- Reconnect Banner if WS disconnected -->
    <div v-if="isDisconnected" class="reconnect-banner">
      <i class="ri-wifi-off-line"></i> {{ t('terminal.reconnecting') }}
    </div>

    <!-- Expandable Touch Bar Container -->
    <div class="terminal-touch-bar-container">
      <!-- Row 1: Quick Bar with Fixed Expand Button at Start -->
      <div class="touch-bar">
        <!-- Fixed Expand Button -->
        <button
          class="tb-expand-btn"
          :class="{ active: isDrawerOpen }"
          @click="toggleDrawer"
          :title="t('terminal.expandKeys')"
        >
          <i :class="isDrawerOpen ? 'ri-keyboard-fill' : 'ri-keyboard-line'"></i>
          <i :class="isDrawerOpen ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line'" style="font-size:10px;"></i>
        </button>

        <!-- Horizontal Scrollable Keys - Chỉ giữ các phím thiết yếu nhất -->
        <div class="tb-scroll-keys">
          <button class="tb-btn tb-esc" @click="sendKey('\x1b')">ESC</button>
          <button class="tb-btn tb-tab" @click="sendKey('\t')">TAB</button>
          <button class="tb-btn tb-danger" @click="sendKey('\x03')">Ctrl C</button>
          <button class="tb-btn tb-arrow" @click="sendKey('\x1b[A')"><i class="ri-arrow-up-s-line"></i></button>
          <button class="tb-btn tb-arrow" @click="sendKey('\x1b[B')"><i class="ri-arrow-down-s-line"></i></button>
          <button class="tb-btn tb-arrow" @click="sendKey('\x1b[D')"><i class="ri-arrow-left-s-line"></i></button>
          <button class="tb-btn tb-arrow" @click="sendKey('\x1b[C')"><i class="ri-arrow-right-s-line"></i></button>
          <button class="tb-btn tb-enter" @click="sendKey('\r')"><i class="ri-corner-down-left-line"></i></button>
          <div class="tb-divider"></div>
          <button class="tb-btn" @click="sendKey('/')">/</button>
          <button class="tb-btn" @click="sendKey('-')">-</button>
          <button class="tb-btn" @click="sendKey('|')">|</button>
          <div class="tb-divider"></div>
          <button class="tb-btn" @click="changeFontSize(-1)" title="Thu nhỏ chữ">A-</button>
          <button class="tb-btn" @click="changeFontSize(1)" :title="t('terminal.fontUp')">A+</button>
          <button class="tb-btn tb-paste" @click="handlePaste" :title="t('terminal.paste')">
            <i class="ri-clipboard-line"></i>
          </button>
        </div>
      </div>

      <!-- Row 2: Expandable Drawer Panel -->
      <div v-show="isDrawerOpen" class="touch-bar-drawer">
        <!-- Ctrl Shortcuts Group -->
        <div class="drawer-group">
          <span class="drawer-group-title">Ctrl Shortcuts</span>
          <div class="drawer-keys-row">
            <button class="tb-btn tb-danger" @click="sendKey('\x03')">{{ t('terminal.ctrlCancel') }}</button>
            <button class="tb-btn" @click="sendKey('\x04')">Ctrl D EOF</button>
            <button class="tb-btn" @click="sendKey('\x1a')">Ctrl Z {{ t('terminal.stop') }}</button>
            <button class="tb-btn" @click="sendKey('\x0c')">Ctrl L {{ t('terminal.clear') }}</button>
            <button class="tb-btn" @click="sendKey('\x01')">{{ t('terminal.ctrlA') }}</button>
            <button class="tb-btn" @click="sendKey('\x05')">{{ t('terminal.ctrlE') }}</button>
            <button class="tb-btn" @click="sendKey('\x17')">{{ t('terminal.ctrlW') }}</button>
            <button class="tb-btn" @click="sendKey('\x15')">{{ t('terminal.ctrlU') }}</button>
            <button class="tb-btn" @click="sendKey('\x12')">{{ t('terminal.ctrlR') }}</button>
            <button class="tb-btn" @click="sendKey('\x0b')">{{ t('terminal.ctrlK') }}</button>
            <button class="tb-btn" @click="sendKey('\x19')">{{ t('terminal.ctrlY') }}</button>
            <button class="tb-btn" @click="sendKey('\x18')">Ctrl X</button>
          </div>
        </div>

        <!-- Alt / Word Navigation Group -->
        <div class="drawer-group">
          <span class="drawer-group-title">Alt / Di Chuyển Theo Từ</span>
          <div class="drawer-keys-row">
            <button class="tb-btn" @click="sendKey('\x1bb')">Alt+◄ {{ t('terminal.previousWord') }}</button>
            <button class="tb-btn" @click="sendKey('\x1bf')">Alt+► {{ t('terminal.nextWord') }}</button>
            <button class="tb-btn" @click="sendKey('\x1bd')">Alt+D {{ t('terminal.deleteNextWord') }}</button>
            <button class="tb-btn" @click="sendKey('\x7f')">⌫ Backspace</button>
            <button class="tb-btn" @click="sendKey('\x1b[3~')">Del</button>
            <button class="tb-btn" @click="sendKey('\x1b.')">Alt+. (Arg cuối)</button>
          </div>
        </div>

        <!-- Navigation / Paging Group -->
        <div class="drawer-group">
          <span class="drawer-group-title">{{ t('terminal.navigation') }}</span>
          <div class="drawer-keys-row">
            <button class="tb-btn" @click="sendKey('\x1b[H')">Home</button>
            <button class="tb-btn" @click="sendKey('\x1b[F')">End</button>
            <button class="tb-btn" @click="sendKey('\x1b[5~')">PgUp</button>
            <button class="tb-btn" @click="sendKey('\x1b[6~')">PgDn</button>
            <button class="tb-btn" @click="sendKey('\x1b[1;5A')">Ctrl+▲</button>
            <button class="tb-btn" @click="sendKey('\x1b[1;5B')">Ctrl+▼</button>
          </div>
        </div>


        <!-- Git Shortcuts -->
        <div class="drawer-group">
          <span class="drawer-group-title">{{ t('terminal.gitQuick') }}</span>
          <div class="drawer-keys-row">
            <button class="tb-btn tb-cmd" @click="sendKey('git status\r')">git status</button>
            <button class="tb-btn tb-cmd" @click="sendKey('git add .\r')">git add .</button>
            <button class="tb-btn tb-cmd" @click="sendGitCommitPrefix">git commit -m "</button>
            <button class="tb-btn tb-cmd" @click="sendKey('git push\r')">git push</button>
            <button class="tb-btn tb-cmd" @click="sendKey('git pull\r')">git pull</button>
            <button class="tb-btn tb-cmd" @click="sendKey('git log --oneline -20\r')">git log</button>
            <button class="tb-btn tb-cmd" @click="sendKey('git diff\r')">git diff</button>
            <button class="tb-btn tb-cmd" @click="sendKey('git branch\r')">git branch</button>
          </div>
        </div>

        <!-- Quick 1-Touch Commands -->
        <div class="drawer-group">
          <span class="drawer-group-title">{{ t('terminal.quickCommands') }}</span>
          <div class="drawer-keys-row">
            <button class="tb-btn tb-accent" @click="sendKey('claude\r')">claude ↵</button>
            <button class="tb-btn tb-cmd" @click="sendKey('ls -la\r')">ls -la</button>
            <button class="tb-btn tb-cmd" @click="sendKey('cd ..\r')">cd ..</button>
            <button class="tb-btn tb-cmd" @click="sendKey('cd ~\r')">cd ~</button>
            <button class="tb-btn tb-cmd" @click="sendKey('pwd\r')">pwd</button>
            <button class="tb-btn tb-cmd" @click="sendKey('clear\r')">clear</button>
            <button class="tb-btn tb-cmd" @click="sendKey('history | tail -20\r')">history</button>
            <button class="tb-btn tb-cmd" @click="sendKey('htop\r')">htop</button>
            <button class="tb-btn tb-cmd" @click="sendKey('exit\r')">exit</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Manual Paste Modal (Fallback when navigator.clipboard is unavailable) -->
    <InputModal
      :is-open="isPasteModalOpen"
      :title="t('terminal.pasteTitle')"
      icon="ri-clipboard-line"
      :placeholder="t('terminal.pastePlaceholder')"
      :confirm-label="t('terminal.pasteNow')"
      @close="isPasteModalOpen = false"
      @confirm="executeManualPaste"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useTerminalStore, extractLast3Dirs } from '../stores/terminalStore.js';
import { useServerStore } from '../stores/serverStore.js';
import { wsUrl as buildWsUrl } from '../utils/api.js';
import InputModal from './InputModal.vue';
import { useI18n } from '../composables/useI18n.js';

const terminalStore = useTerminalStore();
const { t } = useI18n();
const serverStore = useServerStore();

const terminalRef = ref<HTMLDivElement | null>(null);
const isDrawerOpen = ref(false);
const isDisconnected = ref(false);
const currentFontSize = ref(13);
const isPasteModalOpen = ref(false);

let term: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let wakeLock: any = null;

// --- WAKE LOCK API ---
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await (navigator as any).wakeLock.request('screen');
    } catch (_) {}
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    try {
      wakeLock.release();
    } catch (_) {}
    wakeLock = null;
  }
}

// --- HAPTIC FEEDBACK ---
function hapticFeedback() {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(12);
    } catch (_) {}
  }
}

function toggleDrawer() {
  hapticFeedback();
  isDrawerOpen.value = !isDrawerOpen.value;
  setTimeout(handleResize, 50);
}

function changeFontSize(delta: number) {
  hapticFeedback();
  currentFontSize.value = Math.max(10, Math.min(20, currentFontSize.value + delta));
  if (term) {
    term.options.fontSize = currentFontSize.value;
    handleResize();
  }
}

async function handlePaste() {
  hapticFeedback();
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      // Bracketed paste wrapping
      sendKey(`\x1b[200~${text}\x1b[201~`);
    }
  } catch (err) {
    isPasteModalOpen.value = true;
  }
}

function executeManualPaste(text: string) {
  if (text) {
    sendKey(`\x1b[200~${text}\x1b[201~`);
    isPasteModalOpen.value = false;
  }
}

function cleanupCurrentTerminal() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    try {
      socket.close();
    } catch (_) {}
    socket = null;
  }
  if (term) {
    try {
      term.dispose();
    } catch (_) {}
    term = null;
    fitAddon = null;
  }
  if (terminalRef.value) {
    terminalRef.value.innerHTML = '';
  }
}

function initTerminal() {
  if (!terminalRef.value) return;

  cleanupCurrentTerminal();

  term = new Terminal({
    cursorBlink: true,
    fontSize: currentFontSize.value,
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace",
    theme: {
      background: '#050811',
      foreground: '#e2e8f0',
      cursor: '#60a5fa',
      cursorAccent: '#050811',
      selectionBackground: '#1d4ed844',
      black: '#0f172a',
      red: '#ef4444',
      green: '#10b981',
      yellow: '#f59e0b',
      blue: '#3b82f6',
      magenta: '#a855f7',
      cyan: '#06b6d4',
      white: '#f8fafc',
    },
    convertEol: true,
    scrollback: 10000,
    allowTransparency: true,
    macOptionIsMeta: true,
    macOptionClickForcesSelection: true,
  });

  fitAddon = new FitAddon();
  const webLinksAddon = new WebLinksAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(webLinksAddon);
  term.open(terminalRef.value);

  // SANITIZE MOBILE TEXTAREA (Prevent mobile autocorrect/autocapitalize from messing up commands)
  const textarea = terminalRef.value.querySelector('textarea');
  if (textarea) {
    textarea.setAttribute('autocomplete', 'off');
    textarea.setAttribute('autocorrect', 'off');
    textarea.setAttribute('autocapitalize', 'off');
    textarea.setAttribute('spellcheck', 'false');
    textarea.setAttribute('enterkeyhint', 'go');
  }

  // OSC TITLE AUTO-DETECTION (Default to last 3 directory levels from pwd)
  term.onTitleChange((title) => {
    const curSession = terminalStore.activeSession;
    if (curSession && title && title.trim()) {
      // Do not overwrite user custom names
      if (curSession.isCustomNamed) return;

      const cleanTitle = title.trim();
      if (cleanTitle.includes(':')) {
        const afterColon = cleanTitle.split(':').slice(1).join(':').trim();
        const dirName = extractLast3Dirs(afterColon);
        if (dirName && dirName !== 'terminal') {
          terminalStore.renameSession(curSession.id, dirName);
          return;
        }
      }
      terminalStore.renameSession(curSession.id, extractLast3Dirs(cleanTitle));
    }
  });

  setTimeout(handleResize, 60);

  connectWebSocket();

  term.onData((data) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    }
  });
}

function connectWebSocket() {
  const curServer = serverStore.currentServer;
  const curSession = terminalStore.activeSession;
  if (!curSession || !term) return;

  const cols = term.cols || 80;
  const rows = term.rows || 24;
  const wsPath = `/ws/terminal?serverId=${encodeURIComponent(
    curServer.id
  )}&sessionId=${encodeURIComponent(curSession.id)}&name=${encodeURIComponent(
    curSession.name
  )}&cols=${cols}&rows=${rows}${curSession.cwd ? `&cwd=${encodeURIComponent(curSession.cwd)}` : ''}`;

  socket = new WebSocket(buildWsUrl(wsPath));

  socket.onopen = () => {
    isDisconnected.value = false;
    if (reconnectAttempts > 0 && term) {
      term.reset();
    }
    reconnectAttempts = 0;
    handleResize();
  };

  socket.onmessage = (event) => {
    if (term) {
      term.write(event.data);
    }
  };

  socket.onclose = () => {
    isDisconnected.value = true;
    scheduleReconnect();
  };

  socket.onerror = () => {
    isDisconnected.value = true;
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(30000, 1000 * Math.pow(1.5, reconnectAttempts));
  reconnectAttempts++;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWebSocket();
  }, delay);
}

function handleResize() {
  if (fitAddon && term && terminalRef.value) {
    try {
      fitAddon.fit();
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: 'resize',
            cols: term.cols,
            rows: term.rows,
          })
        );
      }
    } catch (_) {}
  }
}

function focusTerminal() {
  if (term) {
    term.focus();
  }
}

function sendKey(data: string) {
  hapticFeedback();
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(data);
  }
  focusTerminal();
}

function sendQuote() {
  sendKey('"');
}

function sendSingleQuote() {
  sendKey("'");
}

function sendGitCommitPrefix() {
  sendKey('git commit -m "');
}

let switchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => [terminalStore.activeSessionId, serverStore.currentServerId],
  () => {
    if (switchDebounceTimer) clearTimeout(switchDebounceTimer);
    switchDebounceTimer = setTimeout(() => {
      initTerminal();
    }, 50);
  }
);

onMounted(() => {
  initTerminal();
  requestWakeLock();
  window.addEventListener('resize', handleResize);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
      handleResize();
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        connectWebSocket();
      }
    }
  });
});

onBeforeUnmount(() => {
  releaseWakeLock();
  window.removeEventListener('resize', handleResize);
  if (switchDebounceTimer) clearTimeout(switchDebounceTimer);
  cleanupCurrentTerminal();
});
</script>

<style scoped>
.terminal-view-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #050811;
  position: relative;
}

.reconnect-banner {
  background: #78350f;
  color: #fef3c7;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.xterm-container {
  flex: 1;
  overflow: hidden;
  padding: 6px 8px;
}

:deep(.xterm) {
  height: 100%;
  padding: 0;
}

:deep(.xterm-viewport) {
  background: #050811 !important;
}

.terminal-touch-bar-container {
  display: flex;
  flex-direction: column;
  background: #090e1a;
  border-top: 1px solid #1e293b;
  flex-shrink: 0;
  z-index: 30;
}

.touch-bar {
  display: flex;
  align-items: center;
  height: 34px;
  background: #0d1322;
}

.tb-expand-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 38px;
  height: 34px;
  background: #1e1b4b;
  border: none;
  border-right: 1px solid #312e81;
  color: #a5b4fc;
  font-size: 13px;
  cursor: pointer;
  flex-shrink: 0;
}
.tb-expand-btn.active {
  background: #3730a3;
  color: #fff;
}

.tb-scroll-keys {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 0 5px;
  overflow-x: auto;
  white-space: nowrap;
  flex: 1;
}

.tb-divider {
  width: 1px;
  height: 18px;
  background: #223252;
  flex-shrink: 0;
  margin: 0 2px;
}

.tb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 25px;
  min-width: 25px;
  padding: 0 7px;
  background: #162035;
  border: 1px solid #223252;
  border-radius: 5px;
  color: #e2e8f0;
  font-family: monospace;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
.tb-btn:active {
  background: #253860;
  border-color: #3b82f6;
}

.tb-esc { background: #3b1825; border-color: #622236; color: #fca5a5; }
.tb-tab { background: #1e293b; border-color: #334155; color: #94a3b8; }
.tb-enter { background: #064e3b; border-color: #047857; color: #6ee7b7; font-weight: 700; font-size: 14px; }
.tb-danger { background: #450a0a; border-color: #7f1d1d; color: #f87171; font-weight: 700; }
.tb-arrow { background: #1e293b; color: #93c5fd; font-size: 14px; padding: 0 5px; }
.tb-accent { background: #78350f; border-color: #b45309; color: #fde68a; font-weight: 700; }
.tb-cmd { background: #132742; border-color: #1e40af; color: #93c5fd; }
.tb-paste { background: #1f2937; border-color: #374151; color: #a5b4fc; }
.tb-num { min-width: 28px; justify-content: center; background: #1e293b; }

.touch-bar-drawer {
  background: #090e1a;
  border-top: 1px solid #1e293b;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 260px;
  overflow-y: auto;
}

.drawer-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drawer-group-title {
  font-size: 10.5px;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.drawer-keys-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
</style>
