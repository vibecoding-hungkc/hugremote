<template>
  <div class="virtual-laptop-keyboard" @pointerdown.prevent>
    <!-- Header bar: status & close -->
    <div class="vlk-header">
      <div class="vlk-status">
        <span class="vlk-badge" :class="{ active: isCtrlActive }">Ctrl</span>
        <span class="vlk-badge" :class="{ active: isAltActive }">Alt</span>
        <span class="vlk-badge" :class="{ active: isShiftActive }">Shift</span>
        <span class="vlk-badge" :class="{ active: isCapsLock }">Caps</span>
      </div>
      <div class="vlk-actions">
        <button type="button" class="vlk-close-btn" @click="$emit('close')" title="Thu gọn bàn phím">
          <i class="ri-keyboard-line"></i>
          <i class="ri-arrow-down-s-line"></i>
        </button>
      </div>
    </div>

    <!-- 5 Rows ANSI Keyboard Layout -->
    <div class="vlk-rows">
      <!-- Row 1: Number row -->
      <div class="vlk-row">
        <button
          v-for="k in row1Keys"
          :key="k.id"
          type="button"
          class="vlk-key"
          :class="[k.className, { active: k.isActive }]"
          @click="handleKeyPress(k)"
        >
          <span class="vlk-label">{{ getLabel(k) }}</span>
        </button>
      </div>

      <!-- Row 2: QWERTY upper row -->
      <div class="vlk-row">
        <button
          v-for="k in row2Keys"
          :key="k.id"
          type="button"
          class="vlk-key"
          :class="[k.className, { active: k.isActive }]"
          @click="handleKeyPress(k)"
        >
          <span class="vlk-label">{{ getLabel(k) }}</span>
        </button>
      </div>

      <!-- Row 3: Home row -->
      <div class="vlk-row">
        <button
          v-for="k in row3Keys"
          :key="k.id"
          type="button"
          class="vlk-key"
          :class="[k.className, { active: k.isActive }]"
          @click="handleKeyPress(k)"
        >
          <span class="vlk-label">{{ getLabel(k) }}</span>
        </button>
      </div>

      <!-- Row 4: Bottom letter row -->
      <div class="vlk-row">
        <button
          v-for="k in row4Keys"
          :key="k.id"
          type="button"
          class="vlk-key"
          :class="[k.className, { active: k.isActive }]"
          @click="handleKeyPress(k)"
        >
          <span class="vlk-label">{{ getLabel(k) }}</span>
        </button>
      </div>

      <!-- Row 5: Modifier & Space row -->
      <div class="vlk-row vlk-modifier-row">
        <button
          v-for="k in row5Keys"
          :key="k.id"
          type="button"
          class="vlk-key"
          :class="[k.className, { active: k.isActive }]"
          @click="handleKeyPress(k)"
        >
          <i v-if="k.icon" :class="k.icon"></i>
          <span v-else class="vlk-label">{{ getLabel(k) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const emit = defineEmits<{
  (e: 'key', data: string): void;
  (e: 'close'): void;
  (e: 'paste'): void;
}>();

const isShiftActive = ref(false);
const isCapsLock = ref(false);
const isCtrlActive = ref(false);
const isAltActive = ref(false);

interface KeyDef {
  id: string;
  defaultVal: string;
  shiftVal?: string;
  className?: string;
  icon?: string;
  action?: 'shift' | 'caps' | 'ctrl' | 'alt' | 'backspace' | 'tab' | 'enter' | 'esc' | 'paste' | 'up' | 'down' | 'left' | 'right';
  isActive?: boolean;
}

const isUpper = computed(() => {
  return (isShiftActive.value && !isCapsLock.value) || (!isShiftActive.value && isCapsLock.value);
});

function getLabel(k: KeyDef): string {
  if (isShiftActive.value && k.shiftVal) {
    return k.shiftVal;
  }
  if (isUpper.value && k.defaultVal.length === 1 && /[a-z]/i.test(k.defaultVal)) {
    return k.defaultVal.toUpperCase();
  }
  return k.defaultVal;
}

// Row 1: ` 1 2 3 4 5 6 7 8 9 0 - = Backspace
const row1Keys = computed<KeyDef[]>(() => [
  { id: 'grave', defaultVal: '`', shiftVal: '~', className: 'vlk-key-1u' },
  { id: '1', defaultVal: '1', shiftVal: '!', className: 'vlk-key-1u' },
  { id: '2', defaultVal: '2', shiftVal: '@', className: 'vlk-key-1u' },
  { id: '3', defaultVal: '3', shiftVal: '#', className: 'vlk-key-1u' },
  { id: '4', defaultVal: '4', shiftVal: '$', className: 'vlk-key-1u' },
  { id: '5', defaultVal: '5', shiftVal: '%', className: 'vlk-key-1u' },
  { id: '6', defaultVal: '6', shiftVal: '^', className: 'vlk-key-1u' },
  { id: '7', defaultVal: '7', shiftVal: '&', className: 'vlk-key-1u' },
  { id: '8', defaultVal: '8', shiftVal: '*', className: 'vlk-key-1u' },
  { id: '9', defaultVal: '9', shiftVal: '(', className: 'vlk-key-1u' },
  { id: '0', defaultVal: '0', shiftVal: ')', className: 'vlk-key-1u' },
  { id: 'minus', defaultVal: '-', shiftVal: '_', className: 'vlk-key-1u' },
  { id: 'equal', defaultVal: '=', shiftVal: '+', className: 'vlk-key-1u' },
  { id: 'bksp', defaultVal: '⌫', className: 'vlk-key-bksp vlk-key-action', action: 'backspace' },
]);

// Row 2: Tab q w e r t y u i o p [ ] \
const row2Keys = computed<KeyDef[]>(() => [
  { id: 'tab', defaultVal: 'Tab ↹', className: 'vlk-key-tab vlk-key-action', action: 'tab' },
  { id: 'q', defaultVal: 'q', className: 'vlk-key-1u' },
  { id: 'w', defaultVal: 'w', className: 'vlk-key-1u' },
  { id: 'e', defaultVal: 'e', className: 'vlk-key-1u' },
  { id: 'r', defaultVal: 'r', className: 'vlk-key-1u' },
  { id: 't', defaultVal: 't', className: 'vlk-key-1u' },
  { id: 'y', defaultVal: 'y', className: 'vlk-key-1u' },
  { id: 'u', defaultVal: 'u', className: 'vlk-key-1u' },
  { id: 'i', defaultVal: 'i', className: 'vlk-key-1u' },
  { id: 'o', defaultVal: 'o', className: 'vlk-key-1u' },
  { id: 'p', defaultVal: 'p', className: 'vlk-key-1u' },
  { id: 'lbracket', defaultVal: '[', shiftVal: '{', className: 'vlk-key-1u' },
  { id: 'rbracket', defaultVal: ']', shiftVal: '}', className: 'vlk-key-1u' },
  { id: 'backslash', defaultVal: '\\', shiftVal: '|', className: 'vlk-key-backslash' },
]);

// Row 3: Caps a s d f g h j k l ; ' Enter
const row3Keys = computed<KeyDef[]>(() => [
  {
    id: 'caps',
    defaultVal: 'Caps ⇪',
    className: 'vlk-key-caps vlk-key-action',
    action: 'caps',
    isActive: isCapsLock.value,
  },
  { id: 'a', defaultVal: 'a', className: 'vlk-key-1u' },
  { id: 's', defaultVal: 's', className: 'vlk-key-1u' },
  { id: 'd', defaultVal: 'd', className: 'vlk-key-1u' },
  { id: 'f', defaultVal: 'f', className: 'vlk-key-1u' },
  { id: 'g', defaultVal: 'g', className: 'vlk-key-1u' },
  { id: 'h', defaultVal: 'h', className: 'vlk-key-1u' },
  { id: 'j', defaultVal: 'j', className: 'vlk-key-1u' },
  { id: 'k', defaultVal: 'k', className: 'vlk-key-1u' },
  { id: 'l', defaultVal: 'l', className: 'vlk-key-1u' },
  { id: 'semicolon', defaultVal: ';', shiftVal: ':', className: 'vlk-key-1u' },
  { id: 'quote', defaultVal: "'", shiftVal: '"', className: 'vlk-key-1u' },
  { id: 'enter', defaultVal: 'Enter ↵', className: 'vlk-key-enter vlk-key-action', action: 'enter' },
]);

// Row 4: Shift z x c v b n m , . / Shift
const row4Keys = computed<KeyDef[]>(() => [
  {
    id: 'lshift',
    defaultVal: '⇧ Shift',
    className: 'vlk-key-lshift vlk-key-action',
    action: 'shift',
    isActive: isShiftActive.value,
  },
  { id: 'z', defaultVal: 'z', className: 'vlk-key-1u' },
  { id: 'x', defaultVal: 'x', className: 'vlk-key-1u' },
  { id: 'c', defaultVal: 'c', className: 'vlk-key-1u' },
  { id: 'v', defaultVal: 'v', className: 'vlk-key-1u' },
  { id: 'b', defaultVal: 'b', className: 'vlk-key-1u' },
  { id: 'n', defaultVal: 'n', className: 'vlk-key-1u' },
  { id: 'm', defaultVal: 'm', className: 'vlk-key-1u' },
  { id: 'comma', defaultVal: ',', shiftVal: '<', className: 'vlk-key-1u' },
  { id: 'period', defaultVal: '.', shiftVal: '>', className: 'vlk-key-1u' },
  { id: 'slash', defaultVal: '/', shiftVal: '?', className: 'vlk-key-1u' },
  {
    id: 'rshift',
    defaultVal: '⇧ Shift',
    className: 'vlk-key-rshift vlk-key-action',
    action: 'shift',
    isActive: isShiftActive.value,
  },
]);

// Row 5: Esc Ctrl Alt Paste Space Left Down Up Right
const row5Keys = computed<KeyDef[]>(() => [
  { id: 'esc', defaultVal: 'ESC', className: 'vlk-key-esc vlk-key-action', action: 'esc' },
  {
    id: 'ctrl',
    defaultVal: 'Ctrl',
    className: 'vlk-key-ctrl vlk-key-action',
    action: 'ctrl',
    isActive: isCtrlActive.value,
  },
  {
    id: 'alt',
    defaultVal: 'Alt',
    className: 'vlk-key-alt vlk-key-action',
    action: 'alt',
    isActive: isAltActive.value,
  },
  {
    id: 'paste',
    defaultVal: 'Dán',
    icon: 'ri-clipboard-line',
    className: 'vlk-key-paste vlk-key-action',
    action: 'paste',
  },
  { id: 'space', defaultVal: '␣ Space', className: 'vlk-key-space' },
  { id: 'left', defaultVal: '◄', className: 'vlk-key-arrow vlk-key-action', action: 'left' },
  { id: 'up', defaultVal: '▲', className: 'vlk-key-arrow vlk-key-action', action: 'up' },
  { id: 'down', defaultVal: '▼', className: 'vlk-key-arrow vlk-key-action', action: 'down' },
  { id: 'right', defaultVal: '►', className: 'vlk-key-arrow vlk-key-action', action: 'right' },
]);

function handleKeyPress(k: KeyDef) {
  // Toggle modifiers
  if (k.action === 'shift') {
    isShiftActive.value = !isShiftActive.value;
    return;
  }
  if (k.action === 'caps') {
    isCapsLock.value = !isCapsLock.value;
    return;
  }
  if (k.action === 'ctrl') {
    isCtrlActive.value = !isCtrlActive.value;
    return;
  }
  if (k.action === 'alt') {
    isAltActive.value = !isAltActive.value;
    return;
  }
  if (k.action === 'paste') {
    emit('paste');
    return;
  }
  if (k.action === 'esc') {
    emit('key', '\x1b');
    return;
  }
  if (k.action === 'tab') {
    emit('key', '\t');
    return;
  }
  if (k.action === 'enter') {
    emit('key', '\r');
    return;
  }
  if (k.action === 'backspace') {
    emit('key', '\x7f');
    return;
  }
  if (k.action === 'up') {
    emit('key', '\x1b[A');
    return;
  }
  if (k.action === 'down') {
    emit('key', '\x1b[B');
    return;
  }
  if (k.action === 'left') {
    emit('key', '\x1b[D');
    return;
  }
  if (k.action === 'right') {
    emit('key', '\x1b[C');
    return;
  }
  if (k.id === 'space') {
    emit('key', ' ');
    return;
  }

  // Handle standard keys + Ctrl/Alt combinations
  let char = getLabel(k);

  if (isCtrlActive.value) {
    const lower = char.toLowerCase();
    const code = lower.charCodeAt(0);
    if (code >= 97 && code <= 122) {
      // Ctrl+a to Ctrl+z -> ASCII 1 to 26
      const ctrlChar = String.fromCharCode(code - 96);
      emit('key', ctrlChar);
      isCtrlActive.value = false;
      return;
    }
  }

  if (isAltActive.value) {
    emit('key', `\x1b${char}`);
    isAltActive.value = false;
    return;
  }

  emit('key', char);

  // If shift was one-time pressed (not CapsLock), deactivate after typing 1 character
  if (isShiftActive.value) {
    isShiftActive.value = false;
  }
}
</script>

<style>
/* Virtual Laptop Keyboard: HugRemote Tech Dark Theme */
.virtual-laptop-keyboard {
  background: #090e1a;
  border-top: 1px solid #1e293b;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  padding: 6px 6px calc(6px + env(safe-area-inset-bottom, 0px));
  gap: 5px;
  width: 100%;
  box-sizing: border-box;
  z-index: 50;
  user-select: none;
  -webkit-user-select: none;
}

.vlk-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px 4px;
  height: 24px;
}

.vlk-status {
  display: flex;
  align-items: center;
  gap: 5px;
}

.vlk-badge {
  font-family: monospace;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  background: #162035;
  border: 1px solid #223252;
  color: #64748b;
  text-transform: uppercase;
}
.vlk-badge.active {
  background: #0369a1;
  border-color: #38bdf8;
  color: #fff;
  box-shadow: 0 0 6px rgba(56, 189, 248, 0.6);
}

.vlk-close-btn {
  background: transparent;
  border: 1px solid #334155;
  border-radius: 5px;
  color: #94a3b8;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  font-size: 11px;
  cursor: pointer;
}
.vlk-close-btn:active {
  background: #1e293b;
  color: #e2e8f0;
}

.vlk-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.vlk-row {
  display: flex;
  align-items: center;
  gap: 3px;
  width: 100%;
}

.vlk-key {
  height: 34px;
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #131b2e;
  border: 1px solid #223252;
  border-radius: 5px;
  color: #e2e8f0;
  font-family: monospace;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  touch-action: manipulation;
  transition: background 0.1s, transform 0.05s;
  padding: 0;
}
.vlk-key:active {
  background: #253860;
  border-color: #38bdf8;
  transform: translateY(1px);
}
.vlk-key.active {
  background: #0369a1 !important;
  border-color: #38bdf8 !important;
  color: #ffffff !important;
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.7);
}

.vlk-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Specific key sizes according to 60% ANSI form factor */
.vlk-key-1u {
  flex: 1;
}
.vlk-key-bksp {
  flex: 1.8;
  background: #2b1720;
  border-color: #552020;
  color: #fca5a5;
  font-size: 14px;
}
.vlk-key-tab {
  flex: 1.4;
  background: #1a2336;
  color: #93c5fd;
}
.vlk-key-backslash {
  flex: 1.4;
}
.vlk-key-caps {
  flex: 1.6;
  background: #1a2336;
  color: #93c5fd;
  font-size: 11px;
}
.vlk-key-enter {
  flex: 2.1;
  background: #0e3725;
  border-color: #1c5e3d;
  color: #86efac;
  font-weight: 700;
  font-size: 12px;
}
.vlk-key-lshift {
  flex: 2.1;
  background: #1a2336;
  color: #cbd5e1;
  font-size: 11px;
}
.vlk-key-rshift {
  flex: 2.4;
  background: #1a2336;
  color: #cbd5e1;
  font-size: 11px;
}

/* Modifier Bottom Row: Dark Charcoal & Tech Styling */
.vlk-modifier-row .vlk-key {
  height: 34px;
}
.vlk-key-esc {
  flex: 1.1;
  background: #3b1825;
  border-color: #622236;
  color: #fca5a5;
  font-weight: 700;
  font-size: 11px;
}
.vlk-key-ctrl {
  flex: 1.2;
  background: #1f1b3b;
  border-color: #3b2d6a;
  color: #c4b5fd;
  font-weight: 700;
  font-size: 11px;
}
.vlk-key-alt {
  flex: 1.1;
  background: #1a2336;
  border-color: #2b3a55;
  color: #93c5fd;
  font-size: 11px;
}
.vlk-key-paste {
  flex: 1.1;
  background: #162a3d;
  border-color: #1e4566;
  color: #38bdf8;
  font-size: 14px;
}
.vlk-key-space {
  flex: 4.8;
  background: #182236;
  color: #94a3b8;
  font-size: 11.5px;
}
.vlk-key-arrow {
  flex: 1;
  background: #162035;
  color: #93c5fd;
  font-size: 12px;
}

@media (max-width: 480px) {
  .vlk-key {
    height: 31px;
    font-size: 11px;
  }
  .vlk-key-enter, .vlk-key-lshift, .vlk-key-rshift {
    font-size: 10px;
  }
}
</style>
