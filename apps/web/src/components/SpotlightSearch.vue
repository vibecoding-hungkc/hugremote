<template>
  <Teleport to="body">
    <Transition name="spl">
      <div
        v-if="isOpen"
        id="spotlight-overlay"
        class="spl-overlay"
        @mousedown.self="$emit('close')"
      >
        <div
          id="spotlight-panel"
          class="spl-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Tìm nhanh dự án và phiên"
        >
          <div class="spl-search">
            <i class="ri-search-2-line spl-search-icon"></i>
            <input
              id="spotlight-input"
              ref="inputRef"
              v-model="query"
              class="spl-input"
              type="text"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              placeholder="Tìm dự án, Claude, Terminal"
              role="combobox"
              aria-expanded="true"
              aria-controls="spotlight-list"
              :aria-activedescendant="activeDomId"
              @keydown="onInputKeyDown"
              @compositionstart="composing = true"
              @compositionend="composing = false"
            />
            <kbd class="spl-kbd">Esc</kbd>
          </div>

          <div id="spotlight-list" ref="listRef" class="spl-list" role="listbox">
            <template v-for="group in groups" :key="group.kind">
              <div class="spl-group-title">
                <i :class="group.icon"></i>
                <span>{{ group.title }}</span>
              </div>
              <button
                v-for="row in group.rows"
                :id="`spotlight-row-${row.index}`"
                :key="row.item.key"
                type="button"
                class="spl-row"
                :class="{ active: row.index === activeIndex }"
                role="option"
                :aria-selected="row.index === activeIndex ? 'true' : 'false'"
                :data-spotlight-kind="row.item.kind"
                :data-spotlight-id="row.item.id"
                :data-spotlight-index="row.index"
                @mousemove="activeIndex = row.index"
                @click="choose(row.item)"
              >
                <span class="spl-row-icon"><i :class="kindIcon(row.item.kind)"></i></span>
                <span class="spl-row-main">
                  <span class="spl-row-title">{{ row.item.title }}</span>
                  <span class="spl-row-sub">{{ row.item.subtitle }}</span>
                </span>
                <span v-if="row.item.isCurrent" class="spl-row-current">Đang mở</span>
                <i class="ri-corner-down-left-line spl-row-enter"></i>
              </button>
            </template>

            <div v-if="results.length === 0" id="spotlight-empty" class="spl-empty">
              <i class="ri-search-eye-line"></i>
              <span>Không có kết quả</span>
            </div>
          </div>

          <div class="spl-footer">
            <span class="spl-hint"><kbd class="spl-kbd">↑</kbd><kbd class="spl-kbd">↓</kbd>Di chuyển</span>
            <span class="spl-hint"><kbd class="spl-kbd">Enter</kbd>Mở</span>
            <span class="spl-footer-count">{{ results.length }} kết quả</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import {
  filterSpotlightItems,
  type SpotlightItem,
  type SpotlightKind,
} from '../utils/spotlight.js';

export type SpotlightRowItem = SpotlightItem & { isCurrent?: boolean };

const props = defineProps<{
  isOpen: boolean;
  items: SpotlightRowItem[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', item: SpotlightRowItem): void;
}>();

const query = ref('');
const activeIndex = ref(0);
const composing = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLElement | null>(null);

const GROUPS: Array<{ kind: SpotlightKind; title: string; icon: string }> = [
  { kind: 'project', title: 'Dự án', icon: 'ri-folder-2-line' },
  { kind: 'claude', title: 'Phiên Claude', icon: 'ri-sparkling-2-line' },
  { kind: 'terminal', title: 'Phiên Terminal', icon: 'ri-terminal-box-line' },
];

const results = computed<SpotlightRowItem[]>(
  () => filterSpotlightItems(props.items, query.value) as SpotlightRowItem[]
);

// With a query, rank across kinds in one flat list; otherwise keep grouped sections.
const groups = computed(() => {
  const list = results.value;
  const indexOf = new Map(list.map((item, index) => [item.key, index]));
  if (query.value.trim()) {
    return list.length
      ? [{
          kind: 'all' as const,
          title: 'Kết quả',
          icon: 'ri-search-2-line',
          rows: list.map(item => ({ item, index: indexOf.get(item.key) as number })),
        }]
      : [];
  }
  return GROUPS
    .map(g => ({
      ...g,
      rows: list
        .filter(item => item.kind === g.kind)
        .map(item => ({ item, index: indexOf.get(item.key) as number })),
    }))
    .filter(g => g.rows.length > 0);
});

const activeDomId = computed(() =>
  results.value.length ? `spotlight-row-${activeIndex.value}` : undefined
);

function kindIcon(kind: SpotlightKind): string {
  if (kind === 'project') return 'ri-folder-2-line';
  if (kind === 'claude') return 'ri-sparkling-2-line';
  return 'ri-terminal-box-line';
}

function scrollActiveIntoView() {
  const el = listRef.value?.querySelector<HTMLElement>(`#spotlight-row-${activeIndex.value}`);
  el?.scrollIntoView({ block: 'nearest' });
}

function move(delta: number) {
  const n = results.value.length;
  if (!n) return;
  activeIndex.value = (activeIndex.value + delta + n) % n;
  nextTick(scrollActiveIntoView);
}

function choose(item: SpotlightRowItem) {
  emit('select', item);
}

function onInputKeyDown(event: KeyboardEvent) {
  // Vietnamese Telex/VNI composition uses Enter and arrows; never act while composing.
  if (event.isComposing || composing.value || event.keyCode === 229) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    move(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    move(-1);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const item = results.value[activeIndex.value];
    if (item) choose(item);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
  }
}

watch(query, () => {
  activeIndex.value = 0;
  nextTick(() => {
    if (listRef.value) listRef.value.scrollTop = 0;
  });
});

watch(
  () => props.isOpen,
  async open => {
    if (!open) return;
    query.value = '';
    activeIndex.value = 0;
    composing.value = false;
    await nextTick();
    inputRef.value?.focus();
    inputRef.value?.select();
  },
  { immediate: true }
);
</script>

<style scoped>
.spl-overlay {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 13vh 16px 16px;
  background:
    radial-gradient(900px 420px at 50% 0%, rgba(255, 255, 255, 0.07), transparent 70%),
    rgba(10, 10, 10, 0.62);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
}

.spl-panel {
  position: relative;
  width: 100%;
  max-width: 640px;
  max-height: min(560px, 72vh);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 16px;
  background: linear-gradient(180deg, #232323 0%, #171717 46%, #131313 100%);
  border: 1px solid #3a3a3a;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.04) inset,
    0 1px 0 rgba(255, 255, 255, 0.09) inset,
    0 30px 80px rgba(0, 0, 0, 0.78),
    0 8px 24px rgba(0, 0, 0, 0.5);
}

.spl-panel::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent);
  pointer-events: none;
}

.spl-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid #2c2c2c;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent);
}

.spl-search-icon {
  font-size: 19px;
  color: #8a8a8a;
  flex-shrink: 0;
}

.spl-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: #f2f2f2;
  font-size: 17px;
  font-weight: 500;
  letter-spacing: 0.01em;
  caret-color: #ffffff;
}

.spl-input::placeholder {
  color: #6c6c6c;
}

.spl-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 5px;
  border: 1px solid #3a3a3a;
  border-bottom-width: 2px;
  background: #1e1e1e;
  color: #a8a8a8;
  font-family: monospace;
  font-size: 10.5px;
  line-height: 1;
}

.spl-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 8px 14px;
  scrollbar-width: thin;
  scrollbar-color: #3a3a3a transparent;
}

.spl-group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 10px 5px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #7a7a7a;
}

.spl-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: #d4d4d4;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.spl-row.active {
  background: linear-gradient(180deg, #333333, #282828);
  border-color: #4a4a4a;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.07) inset, 0 4px 12px rgba(0, 0, 0, 0.35);
  color: #ffffff;
}

.spl-row-icon {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 16px;
  color: #bdbdbd;
  background: linear-gradient(180deg, #2b2b2b, #1c1c1c);
  border: 1px solid #353535;
}

.spl-row.active .spl-row-icon {
  color: #ffffff;
  border-color: #555555;
}

.spl-row-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.spl-row-title {
  font-size: 13.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spl-row-sub {
  font-family: monospace;
  font-size: 11px;
  color: #7e7e7e;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spl-row.active .spl-row-sub {
  color: #a6a6a6;
}

.spl-row-current {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #bdbdbd;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid #444444;
  background: #202020;
}

.spl-row-enter {
  flex-shrink: 0;
  font-size: 14px;
  color: #8a8a8a;
  opacity: 0;
}

.spl-row.active .spl-row-enter {
  opacity: 1;
}

.spl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 34px 0;
  color: #777777;
  font-size: 13px;
}

.spl-empty i {
  font-size: 26px;
  color: #5a5a5a;
}

.spl-footer {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 16px;
  border-top: 1px solid #2c2c2c;
  background: #121212;
  font-size: 11px;
  color: #7a7a7a;
}

.spl-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.spl-hint .spl-kbd {
  margin-right: 2px;
}

.spl-footer-count {
  margin-left: auto;
  font-family: monospace;
}

.spl-enter-active,
.spl-leave-active {
  transition: opacity 0.14s ease;
}

.spl-enter-active .spl-panel,
.spl-leave-active .spl-panel {
  transition: transform 0.16s cubic-bezier(0.2, 0.9, 0.3, 1.1), opacity 0.14s ease;
}

.spl-enter-from,
.spl-leave-to {
  opacity: 0;
}

.spl-enter-from .spl-panel,
.spl-leave-to .spl-panel {
  opacity: 0;
  transform: translateY(-10px) scale(0.97);
}

@media (max-width: 640px) {
  .spl-overlay {
    padding-top: 8vh;
  }

  .spl-input {
    font-size: 16px;
  }

  .spl-footer .spl-hint {
    display: none;
  }

  .spl-footer-count {
    margin-left: 0;
  }
}
</style>
