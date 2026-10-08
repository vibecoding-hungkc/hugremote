import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { localeLabels, messages, SUPPORTED_LOCALES, type Locale } from '../i18n/messages.js';

const STORAGE_KEY = 'hugremote_locale';
const DEFAULT_LOCALE: Locale = 'vi';

type Params = Record<string, string | number>;

function normalizeLocale(value: unknown): Locale {
  return SUPPORTED_LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

function getInitialLocale(): Locale {
  if (typeof localStorage !== 'undefined') {
    const stored = normalizeLocale(localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : DEFAULT_LOCALE;
  return normalizeLocale(nav);
}

function readPath(obj: Record<string, any>, path: string): unknown {
  return path.split('.').reduce((acc: any, key) => acc?.[key], obj);
}

function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

export const useI18nStore = defineStore('i18n', () => {
  const locale = ref<Locale>(getInitialLocale());
  const availableLocales = SUPPORTED_LOCALES;
  const currentLabel = computed(() => localeLabels[locale.value]);

  function setLocale(next: Locale) {
    locale.value = normalizeLocale(next);
    localStorage.setItem(STORAGE_KEY, locale.value);
    document.documentElement.lang = locale.value;
  }

  function t(key: string, params?: Params): string {
    const current = readPath(messages[locale.value], key);
    const fallback = readPath(messages[DEFAULT_LOCALE], key);
    const value = typeof current === 'string' ? current : typeof fallback === 'string' ? fallback : key;
    return interpolate(value, params);
  }

  document.documentElement.lang = locale.value;

  return {
    locale,
    availableLocales,
    currentLabel,
    localeLabels,
    setLocale,
    t,
  };
});
