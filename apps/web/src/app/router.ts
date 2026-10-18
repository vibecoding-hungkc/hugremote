import { ref, readonly, watch, type Ref } from 'vue';

export type AppTab = 'files' | 'editor' | 'terminal' | 'claude' | 'git';

export const VALID_TABS: readonly AppTab[] = ['files', 'editor', 'terminal', 'claude', 'git'] as const;
export const ROUTER_STORAGE_KEY = 'hugremote_last_tab';

export interface RouteState {
  tab: AppTab;
  params: Record<string, string>;
  rawHash: string;
}

function isValidTab(val: any): val is AppTab {
  return typeof val === 'string' && VALID_TABS.includes(val as AppTab);
}

export function parseHash(hashStr: string = (typeof window !== 'undefined' ? window.location.hash : '')): RouteState {
  const cleaned = hashStr.replace(/^#\/?/, '').trim();
  if (!cleaned) {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(ROUTER_STORAGE_KEY);
      if (saved && isValidTab(saved)) {
        return { tab: saved, params: {}, rawHash: `#/${saved}` };
      }
    }
    return { tab: 'files', params: {}, rawHash: '#/files' };
  }

  const [pathPart, queryPart] = cleaned.split('?');
  const normalizedTab = pathPart.toLowerCase().replace(/^\/+|\/+$/g, '') as AppTab;

  const params: Record<string, string> = {};
  if (queryPart) {
    const sp = new URLSearchParams(queryPart);
    for (const [k, v] of sp.entries()) {
      params[k] = v;
    }
  }

  if (isValidTab(normalizedTab)) {
    return { tab: normalizedTab, params, rawHash: hashStr };
  }

  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(ROUTER_STORAGE_KEY);
    if (saved && isValidTab(saved)) {
      return { tab: saved, params: {}, rawHash: `#/${saved}` };
    }
  }
  return { tab: 'files', params: {}, rawHash: '#/files' };
}

// Global singleton reactive route state
const initialRoute = typeof window !== 'undefined' ? parseHash() : { tab: 'files' as AppTab, params: {}, rawHash: '#/files' };
export const activeTab = ref<AppTab>(initialRoute.tab);
export const routeParams = ref<Record<string, string>>(initialRoute.params);

let isSyncingHash = false;

export function applyRoute(route: RouteState, updateHistory = true) {
  activeTab.value = route.tab;
  routeParams.value = route.params;

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ROUTER_STORAGE_KEY, route.tab);
    } catch (_) {}
  }

  if (typeof window !== 'undefined' && updateHistory) {
    const search = Object.keys(route.params).length > 0
      ? '?' + new URLSearchParams(route.params).toString()
      : '';
    const targetHash = `#/${route.tab}${search}`;

    if (window.location.hash !== targetHash) {
      isSyncingHash = true;
      window.location.hash = targetHash;
      setTimeout(() => {
        isSyncingHash = false;
      }, 0);
    }
  }
}

export function navigateTo(tab: AppTab, params: Record<string, string> = {}) {
  applyRoute({
    tab,
    params,
    rawHash: `#/${tab}`,
  }, true);
}

// Watch activeTab so any programmatic assignment (activeTab.value = '...') syncs to hash
watch(activeTab, (newTab) => {
  if (isSyncingHash) return;
  applyRoute({
    tab: newTab,
    params: routeParams.value,
    rawHash: `#/${newTab}`,
  }, true);
});

// Setup hashchange listener once in window
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    if (isSyncingHash) return;
    const parsed = parseHash();
    applyRoute(parsed, false);
  });

  // Ensure initial hash is visible on first load
  if (!window.location.hash) {
    const initial = parseHash();
    applyRoute(initial, true);
  }
}

export function useAppRouter() {
  return {
    activeTab,
    routeParams: readonly(routeParams),
    navigateTo,
    parseHash,
  };
}
