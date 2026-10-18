<template>
  <button
    type="button"
    class="language-flag-btn"
    :title="`${t('common.language')}: ${i18n.currentLabel.nativeName}`"
    :aria-label="`${t('common.language')}: ${i18n.currentLabel.nativeName}`"
    @click="cycleLocale"
  >
    <span class="flag-icon">{{ i18n.currentLabel.flag }}</span>
  </button>
</template>

<script setup lang="ts">
import { useI18n } from '../composables/useI18n.js';
import type { Locale } from '../i18n/messages.js';

const { i18n, t } = useI18n();

function cycleLocale() {
  const locales = i18n.availableLocales as readonly Locale[];
  const currentIndex = locales.indexOf(i18n.locale);
  const next = locales[(currentIndex + 1) % locales.length];
  i18n.setLocale(next);
}
</script>

<style scoped>
.language-flag-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #1e293b;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
}

.flag-icon {
  font-size: 17px;
  line-height: 1;
}
</style>
