<template>
  <div class="terminal-view-container">
    <!-- Xterm Terminal Canvas Container -->
    <div class="xterm-container" ref="terminalRef" @click="focusTerminal"></div>

    <!-- Reconnect Banner if WS disconnected -->
    <div v-if="isDisconnected" class="reconnect-banner">
      <i class="ri-wifi-off-line"></i> {{ t('terminal.reconnecting') }}
    </div>

    <!-- Expandable Touch Bar Container (Hidden on Desktop devices) -->
    <div v-if="!isDesktopDevice" class="terminal-touch-bar-container" @pointerdown.prevent>
      <!-- Row 1: Quick Bar with Fixed Expand Button at Start -->
      <div class="touch-bar">
        <!-- Fixed Expand Button -->
        <button
          class="tb-expand-btn"
          :class="{ active: isDrawerOpen }"
          @click="toggleDrawer"
          :title="t('terminal.expandKeys')"
        >
          <i :class="isDrawerOpen ? 'ri-function-line' : 'ri-function-line'"></i>
          <i :class="isDrawerOpen ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line'" style="font-size:10px;"></i>
        </button>

        <!-- Toggle Full Laptop Keyboard Button -->
        <button
          class="tb-expand-btn tb-laptop-kbd-btn"
          :class="{ active: isLaptopKeyboardOpen }"
          @click="toggleLaptopKeyboard"
          title="Bật/Tắt Bàn phím ảo Laptop (PC Layout)"
        >
          <i class="ri-keyboard-line"></i>
        </button>

        <!-- Horizontal Scrollable Keys - Chỉ giữ các phím thiết yếu nhất -->
        <div class="tb-scroll-keys">
          <button class="tb-btn tb-esc" @click="sendKey('\x1b')">ESC</button>
          <button class="tb-btn tb-tab" @click="sendKey('\t')">TAB</button>
          <button class="tb-btn tb-danger" @click="sendKey('\x03')">Ctrl C</button>
          <button class="tb-btn tb-paste" @click="handlePaste" :title="t('terminal.paste')">
            <i class="ri-clipboard-line"></i>
          </button>
          <button class="tb-btn tb-enter" @click="sendKey('\r')"><i class="ri-corner-down-left-line"></i></button>
          <div class="tb-divider"></div>
          <button class="tb-btn tb-arrow" @click="scrollTerminal(-5)" title="Cuộn lên"><i class="ri-arrow-up-line"></i> Cuộn</button>
          <button class="tb-btn tb-arrow" @click="scrollTerminal(5)" title="Cuộn xuống"><i class="ri-arrow-down-line"></i></button>
          <div class="tb-divider"></div>
          <button class="tb-btn" @click="changeFontSize(-1)" title="Thu nhỏ chữ">A-</button>
          <button class="tb-btn" @click="changeFontSize(1)" :title="t('terminal.fontUp')">A+</button>
        </div>
      </div>

      <!-- Row 2: Expandable Drawer Panel -->
      <div v-show="isDrawerOpen" class="touch-bar-drawer">
        <!-- 1. Ctrl Shortcuts Group -->
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

        <!-- 2. Git Shortcuts (Đưa lên vị trí 2) -->
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

        <!-- 3. Quick 1-Touch Commands (Đưa lên vị trí 3) -->
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

        <!-- 4. Alt / Word Navigation Group -->
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

        <!-- 5. Navigation / Paging Group -->
        <div class="drawer-group">
          <span class="drawer-group-title">{{ t('terminal.navigation') }}</span>
          <div class="drawer-keys-row">
            <button class="tb-btn" @click="sendKey('\x1b[H')">Home</button>
            <button class="tb-btn" @click="sendKey('\x1b[F')">End</button>
            <button class="tb-btn" @click="scrollTerminal(-5)"><i class="ri-arrow-up-line"></i> Cuộn Lên</button>
            <button class="tb-btn" @click="scrollTerminal(5)"><i class="ri-arrow-down-line"></i> Cuộn Xuống</button>
            <button class="tb-btn" @click="sendKey('\x1b[5~')">PgUp</button>
            <button class="tb-btn" @click="sendKey('\x1b[6~')">PgDn</button>
            <button class="tb-btn" @click="sendKey('\x1b[1;5A')">Ctrl+▲</button>
            <button class="tb-btn" @click="sendKey('\x1b[1;5B')">Ctrl+▼</button>
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

    <!-- Virtual Laptop Keyboard (Custom PC Layout) -->
    <VirtualLaptopKeyboard
      v-if="isLaptopKeyboardOpen && !isDesktopDevice"
      @key="sendKey"
      @paste="handlePaste"
      @close="isLaptopKeyboardOpen = false; resizeTerminal()"
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
import { attachTerminalTouchScrolling, dispatchTerminalWheel } from '../utils/terminalScroll.js';
import InputModal from './InputModal.vue';
import VirtualLaptopKeyboard from './VirtualLaptopKeyboard.vue';
import { useI18n } from '../composables/useI18n.js';
import { useDesktopDevice } from '../utils/device.js';

const props = defineProps<{
  isActive?: boolean;
}>();

const terminalStore = useTerminalStore();
const { t } = useI18n();
const { isDesktopDevice } = useDesktopDevice();
const serverStore = useServerStore();

const terminalRef = ref<HTMLElement | null>(null);
const isDrawerOpen = ref(false);
const isLaptopKeyboardOpen = ref(false);
const isDisconnected = ref(false);
const currentFontSize = ref(13);
const isPasteModalOpen = ref(false);

let term: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let resizeObserver: ResizeObserver | null = null;
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let wakeLock: any = null;
let cleanupTouch: (() => void) | null = null;

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

function toggleLaptopKeyboard() {
  hapticFeedback();
  isLaptopKeyboardOpen.value = !isLaptopKeyboardOpen.value;
  // If opening keyboard, close drawer to keep screen compact
  if (isLaptopKeyboardOpen.value) {
    isDrawerOpen.value = false;
    // Suppress system on-screen keyboard by bluring terminal textarea
    blurTerminalTextarea();
  }
  setTimeout(handleResize, 50);
}

function blurTerminalTextarea() {
  if (terminalRef.value) {
    const textarea = terminalRef.value.querySelector('textarea');
    if (textarea) {
      textarea.blur();
      textarea.setAttribute('readonly', 'readonly');
      textarea.setAttribute('inputmode', 'none');
    }
  }
}

function restoreTerminalTextarea() {
  if (terminalRef.value) {
    const textarea = terminalRef.value.querySelector('textarea');
    if (textarea) {
      textarea.removeAttribute('readonly');
      textarea.removeAttribute('inputmode');
    }
  }
}

watch(isLaptopKeyboardOpen, (open) => {
  if (open) {
    blurTerminalTextarea();
  } else {
    restoreTerminalTextarea();
  }
  setTimeout(handleResize, 50);
  setTimeout(handleResize, 150);
});

watch(isDrawerOpen, () => {
  setTimeout(handleResize, 50);
  setTimeout(handleResize, 150);
});

watch(
  () => props.isActive,
  (active) => {
    if (active) {
      setTimeout(handleResize, 10);
      setTimeout(handleResize, 60);
      setTimeout(handleResize, 180);
      setTimeout(focusTerminal, 80);
    }
  }
);

function resizeTerminal() {
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

let lastNativePasteAt = 0;

function pasteTextToTerminal(text: string) {
  if (!text) return;
  if (term && typeof (term as any).paste === 'function') {
    term.paste(text);
  } else {
    sendKey(`\x1b[200~${text}\x1b[201~`);
  }
}

async function writeTextToClipboard(text: string) {
  if (!text) return;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (_) {}
  }
  if (typeof document !== 'undefined' && typeof document.execCommand === 'function' && document.body) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', 'readonly');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch (_) {}
    document.body.removeChild(ta);
  }
}

async function handlePaste() {
  hapticFeedback();
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      pasteTextToTerminal(text);
    }
  } catch (err) {
    isPasteModalOpen.value = true;
  }
}

function executeManualPaste(text: string) {
  if (text) {
    pasteTextToTerminal(text);
    isPasteModalOpen.value = false;
  }
}

function disconnectSocket() {
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
  isDisconnected.value = true;
}

function cleanupCurrentTerminal() {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (cleanupTouch) {
    cleanupTouch();
    cleanupTouch = null;
  }
  disconnectSocket();
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

function setupTouchScrolling() {
  if (!terminalRef.value || !term) return;

  // Wheel/trackpad events are intentionally left to xterm itself. Xterm v6
  // distinguishes normal scrollback, alternate-buffer cursor scrolling, and
  // tmux mouse tracking. Touch drags are translated to the same native wheel
  // path so all three modes retain identical protocol behavior.
  cleanupTouch = attachTerminalTouchScrolling(terminalRef.value, () => term);
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
      scrollbarSliderBackground: '#64748b',
      scrollbarSliderHoverBackground: '#60a5fa',
      scrollbarSliderActiveBackground: '#93c5fd',
    },
    convertEol: true,
    scrollback: 10000,
    scrollSensitivity: 1,
    smoothScrollDuration: 80,
    allowTransparency: true,
    macOptionIsMeta: true,
    macOptionClickForcesSelection: true,
  });

  fitAddon = new FitAddon();
  const webLinksAddon = new WebLinksAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(webLinksAddon);
  term.open(terminalRef.value);

  if (typeof (term as any).attachCustomKeyEventHandler === 'function') {
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.type !== 'keydown') return true;
      const key = (event.key || '').toLowerCase();
      const hasCtrlOrMeta = event.ctrlKey || event.metaKey;

      if (event.key === 'Escape') {
        if (term?.hasSelection?.()) {
          term.clearSelection?.();
        }
        return true;
      }

      if (hasCtrlOrMeta && !event.altKey && key === 'c') {
        const selected =
          (term?.hasSelection?.() ? term.getSelection?.() || '' : '') ||
          (typeof window !== 'undefined' ? window.getSelection?.()?.toString() || '' : '');
        if (selected.length > 0 || event.shiftKey || (event.metaKey && !event.ctrlKey)) {
          if (selected.length > 0) {
            void writeTextToClipboard(selected);
            term?.clearSelection?.();
            if (typeof window !== 'undefined') window.getSelection?.()?.removeAllRanges?.();
          }
          event.preventDefault();
          return false;
        }
        return true;
      }

      if (hasCtrlOrMeta && !event.altKey && key === 'v') {
        const beforePasteAt = lastNativePasteAt;
        setTimeout(() => {
          if (lastNativePasteAt === beforePasteAt) {
            void handlePaste();
          }
        }, 35);
        return false;
      }

      return true;
    });
  }

  // Setup ResizeObserver to automatically fit on container resize, tab switch, and font render
  if (typeof ResizeObserver !== 'undefined' && terminalRef.value) {
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          handleResize();
        }
      }
    });
    resizeObserver.observe(terminalRef.value);
  }

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
  if (props.isActive !== false) {
    setTimeout(focusTerminal, 40);
  }

  // Enable touch scrolling for mobile devices on xterm canvas/screen
  setupTouchScrolling();

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
  if (terminalStore.isSessionSuspended(curSession.id)) return;

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
    if (props.isActive !== false) {
      setTimeout(focusTerminal, 30);
    }
  };

  socket.onmessage = (event) => {
    if (term) {
      term.write(event.data);
    }
  };

  socket.onclose = () => {
    isDisconnected.value = true;
    const session = terminalStore.activeSession;
    if (session && terminalStore.isSessionSuspended(session.id)) return;
    scheduleReconnect();
  };

  socket.onerror = () => {
    isDisconnected.value = true;
  };
}

function scheduleReconnect() {
  const curSession = terminalStore.activeSession;
  if (!curSession || terminalStore.isSessionSuspended(curSession.id)) return;
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
    const el = terminalRef.value;
    if (el.offsetWidth === 0 || el.offsetHeight === 0) return;
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
  if (isLaptopKeyboardOpen.value) {
    // When virtual laptop keyboard is active, do not focus the hidden textarea
    // to prevent iOS/Android virtual on-screen keyboard from popping up
    return;
  }
  if (term) {
    term.focus();
  }
}

function scrollTerminal(lines: number) {
  hapticFeedback();
  if (term) {
    dispatchTerminalWheel(term, lines * 18);
  }
}

function sendKey(data: string) {
  hapticFeedback();
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(data);
  }
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

watch(
  () => {
    const curSession = terminalStore.activeSession;
    return curSession ? terminalStore.isSessionSuspended(curSession.id) : false;
  },
  (suspended) => {
    if (suspended) {
      disconnectSocket();
    }
  },
  { flush: 'sync' }
);

watch(
  () => {
    const curSession = terminalStore.activeSession;
    const curServer = serverStore.currentServer;
    const id = curSession?.id || '';
    return [
      id,
      curServer?.id || '',
      curSession?.cwd || '',
      id ? terminalStore.isSessionSuspended(id) : false,
    ] as const;
  },
  ([newId, newServer, newCwd, newSuspended], oldVal) => {
    const [oldId, oldServer, oldCwd, oldSuspended] = oldVal || [];
    if (newSuspended) return;

    if (newId !== oldId || newServer !== oldServer) {
      initTerminal();
    } else if (oldSuspended || newCwd !== oldCwd) {
      disconnectSocket();
      connectWebSocket();
    }
  }
);

function isExternalEditableOrModal(target: EventTarget | null): boolean {
  if (isPasteModalOpen.value) return true;
  if (typeof document !== 'undefined') {
    const openModal = document.querySelector(
      '.modal-overlay, .confirm-modal-overlay, .unsaved-overlay, .context-picker-overlay'
    );
    if (openModal) return true;
  }
  const checkNode = (node: any): boolean => {
    if (!node || typeof node !== 'object') return false;
    if (terminalRef.value && typeof terminalRef.value.contains === 'function' && terminalRef.value.contains(node)) {
      return false;
    }
    const tag = String(node.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable) {
      return true;
    }
    return false;
  };
  if (checkNode(target)) return true;
  if (typeof document !== 'undefined' && checkNode(document.activeElement)) return true;
  return false;
}

function handleWindowKeyDown(e: KeyboardEvent) {
  if (props.isActive === false) return;
  if (isExternalEditableOrModal(e.target)) return;
  if (terminalRef.value && typeof terminalRef.value.contains === 'function' && terminalRef.value.contains(e.target as Node)) {
    return;
  }

  const key = (e.key || '').toLowerCase();
  const hasCtrlOrMeta = e.ctrlKey || e.metaKey;

  if (e.key === 'Escape') {
    e.preventDefault();
    if (term?.hasSelection?.()) {
      term.clearSelection?.();
    }
    focusTerminal();
    sendKey('\x1b');
    return;
  }

  if (hasCtrlOrMeta && !e.altKey && key === 'c') {
    const selected =
      (term?.hasSelection?.() ? term.getSelection?.() || '' : '') ||
      (typeof window !== 'undefined' ? window.getSelection?.()?.toString() || '' : '');
    if (selected.length > 0 || e.shiftKey || (e.metaKey && !e.ctrlKey)) {
      if (selected.length > 0) {
        e.preventDefault();
        void writeTextToClipboard(selected);
        term?.clearSelection?.();
        if (typeof window !== 'undefined') window.getSelection?.()?.removeAllRanges?.();
      }
      focusTerminal();
      return;
    }
    if (e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      focusTerminal();
      sendKey('\x03');
      return;
    }
  }

  if (hasCtrlOrMeta && !e.altKey && key === 'v') {
    focusTerminal();
    const beforePasteAt = lastNativePasteAt;
    setTimeout(() => {
      if (lastNativePasteAt === beforePasteAt) {
        void handlePaste();
      }
    }, 35);
    return;
  }
}

function handleWindowPaste(e: ClipboardEvent) {
  if (props.isActive === false) return;
  if (isExternalEditableOrModal(e.target)) return;
  const text = e.clipboardData?.getData('text/plain') || '';
  e.preventDefault();
  e.stopImmediatePropagation();
  if (text) {
    lastNativePasteAt = Date.now();
    focusTerminal();
    pasteTextToTerminal(text);
  }
}

onMounted(() => {
  initTerminal();
  requestWakeLock();
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleWindowKeyDown);
  window.addEventListener('paste', handleWindowPaste, true);
  if (document.fonts) {
    document.fonts.ready.then(() => {
      handleResize();
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
      handleResize();
      const curSession = terminalStore.activeSession;
      if (curSession && terminalStore.isSessionSuspended(curSession.id)) return;
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
  window.removeEventListener('keydown', handleWindowKeyDown);
  window.removeEventListener('paste', handleWindowPaste, true);
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  cleanupCurrentTerminal();
});

defineExpose({
  initTerminal,
  connectWebSocket,
  scheduleReconnect,
  cleanupCurrentTerminal,
  disconnectSocket,
  terminalRef,
  isDisconnected,
});
</script>

<style>
/* TerminalView: Global styling to protect against hash drift */
.terminal-view-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #161616;
  position: relative;
}

.reconnect-banner {
  background: #404040;
  color: #eeeeee;
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
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 6px 8px;
  touch-action: pan-y;
  box-sizing: border-box;
}

.terminal-view-container .xterm {
  width: 100%;
  height: 100%;
  padding: 0;
}

.terminal-view-container .xterm-viewport {
  background: #161616 !important;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
  width: 100% !important;
  scrollbar-width: thin;
  scrollbar-color: rgba(152, 152, 152, 0.8) transparent;
}

/* Xterm v6 owns scrolling through this VS Code-style scroll surface. */
.terminal-view-container .xterm-scrollable-element > .scrollbar.vertical {
  width: 14px !important;
  right: 0 !important;
  border-radius: 999px;
  background: transparent !important;
}

.terminal-view-container .xterm-scrollable-element > .scrollbar > .slider {
  min-height: 34px;
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: padding-box !important;
  box-shadow: 0 0 0 1px rgba(64, 64, 64, 0.1);
  transition: background-color 120ms ease, box-shadow 120ms ease;
}

.terminal-view-container .xterm-scrollable-element > .scrollbar > .slider:hover {
  box-shadow: 0 0 0 1px rgba(64, 64, 64, 0.34), 0 0 10px rgba(64, 64, 64, 0.22);
}

.terminal-view-container .xterm-scrollable-element > .scrollbar > .slider.active {
  box-shadow: 0 0 0 1px rgba(64, 64, 64, 0.5), 0 0 12px rgba(64, 64, 64, 0.34);
}

.terminal-view-container .xterm-viewport::-webkit-scrollbar {
  width: 10px;
}

.terminal-view-container .xterm-viewport::-webkit-scrollbar-track,
.terminal-view-container .xterm-viewport::-webkit-scrollbar-corner {
  background: transparent;
}

.terminal-view-container .xterm-viewport::-webkit-scrollbar-thumb {
  min-height: 34px;
  border: 2px solid transparent;
  border-radius: 999px;
  background: #404040;
  background-clip: padding-box;
}

.terminal-view-container .xterm-viewport::-webkit-scrollbar-thumb:hover {
  background: #404040;
  background-clip: padding-box;
}

.terminal-view-container .xterm-viewport::-webkit-scrollbar-thumb:active {
  background: #404040;
  background-clip: padding-box;
}

.terminal-touch-bar-container {
  display: flex;
  flex-direction: column;
  background: #161616;
  border-top: 1px solid #323232;
  flex-shrink: 0;
  z-index: 30;
}

.touch-bar {
  display: flex;
  align-items: center;
  height: 34px;
  background: #161616;
}

.tb-expand-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 38px;
  height: 34px;
  background: #1f1f1f;
  border: none;
  border-right: 1px solid #353535;
  color: #b6b6b6;
  font-size: 13px;
  cursor: pointer;
  flex-shrink: 0;
}
.tb-expand-btn.active {
  background: #3a3a3a;
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
  background: #313131;
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
  background: #1f1f1f;
  border: 1px solid #323232;
  border-radius: 5px;
  color: #e7e7e7;
  font-family: monospace;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
.tb-btn:active {
  background: #373737;
  border-color: #7b7b7b;
}

.tb-esc { background: #202020; border-color: #323232; color: #b7b7b7; }
.tb-tab { background: #282828; border-color: #3f3f3f; color: #a1a1a1; }
.tb-enter { background: #3d3d3d; border-color: #5d5d5d; color: #cacaca; font-weight: 700; font-size: 14px; }
.tb-danger { background: #171717; border-color: #323232; color: #989898; font-weight: 700; }
.tb-arrow { background: #282828; color: #bebebe; font-size: 14px; padding: 0 5px; }
.tb-accent { background: #404040; border-color: #626262; color: #e4e4e4; font-weight: 700; }
.tb-cmd { background: #252525; border-color: #414141; color: #bebebe; }
.tb-paste { background: #282828; border-color: #404040; color: #b6b6b6; }
.tb-num { min-width: 28px; justify-content: center; background: #282828; }

.touch-bar-drawer {
  background: #161616;
  border-top: 1px solid #323232;
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
  color: #989898;
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
