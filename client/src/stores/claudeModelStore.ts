import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiUrl } from '../utils/api.js';

export interface ClaudeModelOption {
  id: string;
  title: string;
  desc: string;
  prefix: string;
  cliModel: string;
  isDefault?: boolean;
}

const fallbackModels: ClaudeModelOption[] = [
  { id: 'default', title: 'Default', desc: 'Use Claude Code default/router model · --model sonnet', prefix: 'Default', cliModel: 'sonnet', isDefault: true },
  { id: 'opus', title: 'Opus', desc: 'Most capable model alias available to Claude Code · --model opus', prefix: 'Opus', cliModel: 'opus' },
  { id: 'sonnet', title: 'Sonnet', desc: 'Balanced model alias available to Claude Code · --model sonnet', prefix: 'Sonnet', cliModel: 'sonnet' },
  { id: 'haiku', title: 'Haiku', desc: 'Fast model alias available to Claude Code · --model haiku', prefix: 'Haiku', cliModel: 'haiku' },
];

export const useClaudeModelStore = defineStore('claudeModels', () => {
  const models = ref<ClaudeModelOption[]>(fallbackModels);
  const defaultModel = ref('Default Medium');
  const loading = ref(false);
  const error = ref<string | null>(null);
  let loaded = false;

  const defaultModelName = computed(() => defaultModel.value || `${models.value[0]?.prefix || 'Default'} Medium`);

  async function fetchModels(force = false) {
    if (loaded && !force) return models.value;
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(apiUrl('/api/claude/models'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.models) && data.models.length) models.value = data.models;
      if (data.defaultModel) defaultModel.value = data.defaultModel;
      loaded = true;
    } catch (err: any) {
      error.value = err?.message || 'Cannot load Claude models';
      loaded = true;
    } finally {
      loading.value = false;
    }
    return models.value;
  }

  return { models, defaultModel, defaultModelName, loading, error, fetchModels };
});
