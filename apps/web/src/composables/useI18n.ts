import { useI18nStore } from '../stores/i18nStore.js';

export function useI18n() {
  const i18n = useI18nStore();
  return {
    i18n,
    t: i18n.t,
  };
}
