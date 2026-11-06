import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ShortcutCategory = 'project' | 'claude' | 'terminal' | 'server';

export interface ShortcutGroupPrefixes {
  project: string;
  claude: string;
  terminal: string;
  server: string;
}

export interface ShortcutConfigState {
  enabled: boolean;
  showLabels: boolean;
  toggleLabelsCombo: string;
  groupPrefixes: ShortcutGroupPrefixes;
}

export const SHORTCUT_STORAGE_KEY = 'hugremote_shortcuts_v1';

export const DEFAULT_SHORTCUT_CONFIG: ShortcutConfigState = {
  enabled: true,
  showLabels: false,
  toggleLabelsCombo: 'Alt+K',
  groupPrefixes: {
    project: 'Alt',
    claude: 'Alt+Shift',
    terminal: 'Ctrl+Alt',
    server: 'Ctrl+Shift',
  },
};

export function normalizeModifierPrefix(event: KeyboardEvent): string {
  const mods: string[] = [];
  if (event.ctrlKey) mods.push('Ctrl');
  if (event.metaKey) mods.push('Meta');
  if (event.altKey) mods.push('Alt');
  if (event.shiftKey) mods.push('Shift');
  return mods.join('+');
}

export function normalizeKeyToken(event: KeyboardEvent): string {
  const code = event.code || '';
  if (/^Digit[1-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[1-9]$/.test(code)) return code.slice(6);
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toUpperCase();
  if (code === 'Slash') return '/';
  if (/^F([1-9]|1[0-2])$/.test(event.key || '')) return event.key.toUpperCase();
  const k = String(event.key || '').trim();
  if (/^[1-9]$/.test(k)) return k;
  if (/^[a-zA-Z/]$/.test(k)) return k.toUpperCase();
  return '';
}

export function normalizeKeyComboFromEvent(event: KeyboardEvent): string {
  const prefix = normalizeModifierPrefix(event);
  const keyToken = normalizeKeyToken(event);
  if (!keyToken) return '';
  if (/^F([1-9]|1[0-2])$/.test(keyToken)) {
    return prefix ? `${prefix}+${keyToken}` : keyToken;
  }
  if (!prefix) return '';
  return `${prefix}+${keyToken}`;
}

function loadStoredConfig(): ShortcutConfigState {
  try {
    if (typeof localStorage === 'undefined') {
      return JSON.parse(JSON.stringify(DEFAULT_SHORTCUT_CONFIG));
    }
    const raw = localStorage.getItem(SHORTCUT_STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SHORTCUT_CONFIG));
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed.enabled !== false,
      showLabels: Boolean(parsed.showLabels),
      toggleLabelsCombo: parsed.toggleLabelsCombo || DEFAULT_SHORTCUT_CONFIG.toggleLabelsCombo,
      groupPrefixes: {
        project: parsed.groupPrefixes?.project || DEFAULT_SHORTCUT_CONFIG.groupPrefixes.project,
        claude: parsed.groupPrefixes?.claude || DEFAULT_SHORTCUT_CONFIG.groupPrefixes.claude,
        terminal: parsed.groupPrefixes?.terminal || DEFAULT_SHORTCUT_CONFIG.groupPrefixes.terminal,
        server: parsed.groupPrefixes?.server || DEFAULT_SHORTCUT_CONFIG.groupPrefixes.server,
      },
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_SHORTCUT_CONFIG));
  }
}

export const useShortcutStore = defineStore('shortcut', () => {
  const initial = loadStoredConfig();
  const enabled = ref<boolean>(initial.enabled);
  const showLabels = ref<boolean>(initial.showLabels);
  const toggleLabelsCombo = ref<string>(initial.toggleLabelsCombo);
  const groupPrefixes = ref<ShortcutGroupPrefixes>({ ...initial.groupPrefixes });

  function persist() {
    try {
      if (typeof localStorage === 'undefined') return;
      const payload: ShortcutConfigState = {
        enabled: enabled.value,
        showLabels: showLabels.value,
        toggleLabelsCombo: toggleLabelsCombo.value,
        groupPrefixes: { ...groupPrefixes.value },
      };
      localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage error
    }
  }

  function getItemShortcut(category: ShortcutCategory, indexNum: number): string {
    const prefix = groupPrefixes.value[category] || '';
    if (!prefix || indexNum < 1 || indexNum > 9) return '';
    return `${prefix}+${indexNum}`;
  }

  function toggleEnabled(forceValue?: boolean): boolean {
    enabled.value = typeof forceValue === 'boolean' ? forceValue : !enabled.value;
    persist();
    return enabled.value;
  }

  function toggleLabelsVisibility(forceValue?: boolean): boolean {
    showLabels.value = typeof forceValue === 'boolean' ? forceValue : !showLabels.value;
    persist();
    return showLabels.value;
  }

  function setGroupPrefix(category: ShortcutCategory, prefix: string) {
    if (!prefix.trim()) return;
    groupPrefixes.value = {
      ...groupPrefixes.value,
      [category]: prefix.trim(),
    };
    persist();
  }

  function setToggleLabelsCombo(combo: string) {
    if (!combo.trim()) return;
    toggleLabelsCombo.value = combo.trim();
    persist();
  }

  function resetToDefaults() {
    enabled.value = DEFAULT_SHORTCUT_CONFIG.enabled;
    showLabels.value = DEFAULT_SHORTCUT_CONFIG.showLabels;
    toggleLabelsCombo.value = DEFAULT_SHORTCUT_CONFIG.toggleLabelsCombo;
    groupPrefixes.value = { ...DEFAULT_SHORTCUT_CONFIG.groupPrefixes };
    persist();
  }

  return {
    enabled,
    showLabels,
    toggleLabelsCombo,
    groupPrefixes,
    getItemShortcut,
    toggleEnabled,
    toggleLabelsVisibility,
    setGroupPrefix,
    setToggleLabelsCombo,
    resetToDefaults,
  };
});
