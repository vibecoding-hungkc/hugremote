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
          :aria-label="getAccessibleLabel(k)"
          :title="getAccessibleLabel(k)"
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
          :aria-label="getAccessibleLabel(k)"
          :title="getAccessibleLabel(k)"
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
          :aria-label="getAccessibleLabel(k)"
          :title="getAccessibleLabel(k)"
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
          :aria-label="getAccessibleLabel(k)"
          :title="getAccessibleLabel(k)"
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
          :aria-label="getAccessibleLabel(k)"
          :title="getAccessibleLabel(k)"
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
  accessibleLabel?: string;
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

function getAccessibleLabel(k: KeyDef): string {
  return k.accessibleLabel ?? getLabel(k);
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
  { id: 'bksp', defaultVal: '⌫', accessibleLabel: 'Xóa lùi', className: 'vlk-key-bksp vlk-key-action', action: 'backspace' },
]);

// Row 2: Tab q w e r t y u i o p [ ] \
const row2Keys = computed<KeyDef[]>(() => [
  { id: 'tab', defaultVal: '↹', accessibleLabel: 'Tab', className: 'vlk-key-tab vlk-key-action', action: 'tab' },
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
    defaultVal: '⇪',
    accessibleLabel: 'Caps Lock',
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
  { id: 'enter', defaultVal: '↵', accessibleLabel: 'Enter', className: 'vlk-key-enter vlk-key-action', action: 'enter' },
]);

// Row 4: Shift z x c v b n m , . / Shift
const row4Keys = computed<KeyDef[]>(() => [
  {
    id: 'lshift',
    defaultVal: '⇧',
    accessibleLabel: 'Shift trái',
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
    defaultVal: '⇧',
    accessibleLabel: 'Shift phải',
    className: 'vlk-key-rshift vlk-key-action',
    action: 'shift',
    isActive: isShiftActive.value,
  },
]);

// Row 5: Esc Ctrl Alt Paste Space Left Down Up Right
const row5Keys = computed<KeyDef[]>(() => [
  { id: 'esc', defaultVal: '⎋', accessibleLabel: 'Escape', className: 'vlk-key-esc vlk-key-action', action: 'esc' },
  {
    id: 'ctrl',
    defaultVal: '⌃',
    accessibleLabel: 'Control',
    className: 'vlk-key-ctrl vlk-key-action',
    action: 'ctrl',
    isActive: isCtrlActive.value,
  },
  {
    id: 'alt',
    defaultVal: '⌥',
    accessibleLabel: 'Alt',
    className: 'vlk-key-alt vlk-key-action',
    action: 'alt',
    isActive: isAltActive.value,
  },
  {
    id: 'paste',
    defaultVal: 'Dán',
    accessibleLabel: 'Dán',
    icon: 'ri-clipboard-line',
    className: 'vlk-key-paste vlk-key-action',
    action: 'paste',
  },
  { id: 'space', defaultVal: '␣ Space', accessibleLabel: 'Phím cách', className: 'vlk-key-space' },
  { id: 'left', defaultVal: '◄', accessibleLabel: 'Mũi tên trái', className: 'vlk-key-arrow vlk-key-action', action: 'left' },
  { id: 'up', defaultVal: '▲', accessibleLabel: 'Mũi tên lên', className: 'vlk-key-arrow vlk-key-action', action: 'up' },
  { id: 'down', defaultVal: '▼', accessibleLabel: 'Mũi tên xuống', className: 'vlk-key-arrow vlk-key-action', action: 'down' },
  { id: 'right', defaultVal: '►', accessibleLabel: 'Mũi tên phải', className: 'vlk-key-arrow vlk-key-action', action: 'right' },
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
  background: #161616;
  border-top: 1px solid #323232;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  padding: 3px 3px calc(3px + env(safe-area-inset-bottom, 0px));
  gap: 3px;
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
  padding: 1px 2px 2px;
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
  background: #1f1f1f;
  border: 1px solid #323232;
  color: #989898;
  text-transform: uppercase;
}
.vlk-badge.active {
  background: #404040;
  border-color: #7d7d7d;
  color: #fff;
  box-shadow: 0 0 6px rgba(64, 64, 64, 0.6);
}

.vlk-close-btn {
  background: transparent;
  border: 1px solid #3f3f3f;
  border-radius: 5px;
  color: #a1a1a1;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  font-size: 11px;
  cursor: pointer;
}
.vlk-close-btn:active {
  background: #282828;
  color: #e7e7e7;
}

.vlk-rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.vlk-row {
  display: flex;
  align-items: center;
  gap: 2px;
  width: 100%;
}

.vlk-key {
  height: 34px;
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #1b1b1b;
  border: 1px solid #323232;
  border-radius: 5px;
  color: #e7e7e7;
  font-family: monospace;
  font-size: 18.75px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  touch-action: manipulation;
  transition: background 0.1s, transform 0.05s;
  padding: 0;
}
.vlk-key:active {
  background: #373737;
  border-color: #7d7d7d;
  transform: translateY(1px);
}
.vlk-key.active {
  background: #404040 !important;
  border-color: #7d7d7d !important;
  color: #ffffff !important;
  box-shadow: 0 0 8px rgba(64, 64, 64, 0.7);
}

.vlk-label {
  min-width: 0;
  max-width: 100%;
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
  background: #1c1c1c;
  border-color: #323232;
  color: #b7b7b7;
  font-size: 21px;
}
.vlk-key-tab {
  flex: 1.4;
  background: #222222;
  color: #bebebe;
}
.vlk-key-backslash {
  flex: 1.4;
}
.vlk-key-caps {
  flex: 1.8;
  background: #222222;
  color: #bebebe;
  font-size: 16.5px;
}
.vlk-key-enter {
  flex: 2.1;
  background: #2d2d2d;
  border-color: #4e4e4e;
  color: #d4d4d4;
  font-weight: 700;
  font-size: 18px;
}
.vlk-key-lshift {
  flex: 2.1;
  background: #222222;
  color: #d4d4d4;
  font-size: 16.5px;
}
.vlk-key-rshift {
  flex: 2.4;
  background: #222222;
  color: #d4d4d4;
  font-size: 16.5px;
}

/* Modifier Bottom Row: Dark Charcoal & Tech Styling */
.vlk-modifier-row .vlk-key {
  height: 34px;
}
.vlk-key-esc {
  flex: 1.2;
  background: #202020;
  border-color: #323232;
  color: #b7b7b7;
  font-weight: 700;
  font-size: 16.5px;
}
.vlk-key-ctrl {
  flex: 1.6;
  background: #1e1e1e;
  border-color: #343434;
  color: #bdbdbd;
  font-weight: 700;
  font-size: 16.5px;
}
.vlk-key-alt {
  flex: 1.2;
  background: #222222;
  border-color: #393939;
  color: #bebebe;
  font-size: 16.5px;
}
.vlk-key-paste {
  flex: 1.1;
  background: #272727;
  border-color: #3f3f3f;
  color: #a5a5a5;
  font-size: 21px;
}
.vlk-key-space {
  flex: 4.8;
  background: #212121;
  color: #a1a1a1;
  font-size: 17.25px;
}
.vlk-key-arrow {
  flex: 1;
  background: #1f1f1f;
  color: #bebebe;
  font-size: 18px;
}

@media (max-width: 480px) {
  .vlk-key {
    height: 31px;
    font-size: 16.5px;
  }
  .vlk-key-enter, .vlk-key-lshift, .vlk-key-rshift {
    font-size: 15px;
  }
}
</style>
