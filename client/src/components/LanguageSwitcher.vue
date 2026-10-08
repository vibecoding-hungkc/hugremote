<template>
  <div class="language-switcher" :title="t('common.language')">
    <i class="ri-translate-2"></i>
    <select
      class="language-select"
      :aria-label="t('common.language')"
      :value="i18n.locale"
      @change="onChange"
    >
      <option v-for="loc in i18n.availableLocales" :key="loc" :value="loc">
        {{ i18n.localeLabels[loc].shortName }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '../composables/useI18n.js';
import type { Locale } from '../i18n/messages.js';

const { i18n, t } = useI18n();

function onChange(event: Event) {
  const next = (event.target as HTMLSelectElement).value as Locale;
  i18n.setLocale(next);
}
</script>

<style scoped>
.language-switcher {
  height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 4px 0 6px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #1e293b;
  color: #cbd5e1;
  flex-shrink: 0;
}

.language-switcher i {
  font-size: 13px;
  color: #38bdf8;
}

.language-select {
  height: 24px;
  min-width: 42px;
  border: 0;
  outline: none;
  background: transparent;
  color: #f8fafc;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  appearance: none;
  text-align: center;
}

.language-select option {
  background: #0f172a;
  color: #f8fafc;
}
</style>
