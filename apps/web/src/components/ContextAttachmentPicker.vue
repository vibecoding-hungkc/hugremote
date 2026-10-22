<template>
  <div class="context-picker-overlay" @click.self="$emit('close')" @keydown.esc.stop="$emit('close')">
    <section class="context-picker" role="dialog" aria-modal="true" aria-labelledby="context-picker-title">
      <header>
        <h2 id="context-picker-title">Add context</h2>
        <button type="button" aria-label="Close context picker" @click="$emit('close')">✕</button>
      </header>
      <p>Select a file or folder to attach to your draft.</p>
      <div class="context-picker-path">{{ fullPath(currentRel) }}</div>
      <div class="context-picker-navigation">
        <button type="button" :disabled="loading || parentRel === null" @click="loadDirectory(parentRel ?? '')">↑ Parent folder</button>
        <button type="button" :disabled="loading" @click="selectedPath = fullPath(currentRel)">Select this folder</button>
      </div>
      <div class="context-picker-entries" :aria-busy="loading">
        <p v-if="loading" role="status">Loading files and folders…</p>
        <div v-else-if="error" role="alert">
          <p>{{ error }}</p>
          <button type="button" @click="loadDirectory(currentRel)">Retry</button>
        </div>
        <template v-else>
          <p v-if="entries.length === 0">This folder is empty.</p>
          <div v-for="entry in entries" :key="entry.relPath" class="context-picker-entry">
            <button
              type="button"
              class="context-picker-select"
              :aria-pressed="selectedPath === fullPath(entry.relPath)"
              @click="selectEntry(entry)"
            >
              <i :class="entry.isDirectory ? 'ri-folder-line' : 'ri-file-text-line'"></i>
              <span>{{ entry.name }}</span>
            </button>
            <button v-if="entry.isDirectory" type="button" :aria-label="`Open folder ${entry.name}`" @click="loadDirectory(entry.relPath)">Open →</button>
          </div>
        </template>
      </div>
      <div class="context-picker-selected">{{ selectedPath || 'No file or folder selected' }}</div>
      <footer>
        <button type="button" @click="$emit('close')">Cancel</button>
        <button type="button" :disabled="!selectedPath || loading || !!error" @click="confirmSelection">Attach context</button>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { apiUrl } from '../utils/api.js';

interface ContextEntry {
  name: string;
  relPath: string;
  isDirectory: boolean;
}

const props = defineProps<{
  serverId: string;
  projectId?: string;
  rootPath: string;
}>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', path: string): void;
}>();

const entries = ref<ContextEntry[]>([]);
const currentRel = ref('');
const parentRel = ref<string | null>(null);
const selectedPath = ref('');
const loading = ref(false);
const error = ref('');
let requestId = 0;

function fullPath(relativePath: string): string {
  const path = relativePath.startsWith('/') ? relativePath : `${props.rootPath || '~'}/${relativePath}`;
  const segments: string[] = [];
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..' && segments.length && segments.at(-1) !== '..' && segments.at(-1) !== '~') segments.pop();
    else if (segment === '..' && !path.startsWith('/')) segments.push(segment);
    else if (segment !== '..') segments.push(segment);
  }
  return `${path.startsWith('/') ? '/' : ''}${segments.join('/')}` || '/';
}

async function loadDirectory(path: string) {
  const id = ++requestId;
  loading.value = true;
  error.value = '';
  selectedPath.value = '';
  entries.value = [];
  try {
    const query = new URLSearchParams({ serverId: props.serverId, projectId: props.projectId || '', path });
    const response = await fetch(apiUrl(`/api/fs?${query.toString()}`));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to list this folder');
    if (id !== requestId) return;
    entries.value = data.entries || [];
    currentRel.value = data.currentRel || '';
    parentRel.value = data.parentRel ?? null;
  } catch (err) {
    if (id === requestId) error.value = err instanceof Error ? err.message : 'Unable to list this folder';
  } finally {
    if (id === requestId) loading.value = false;
  }
}

function selectEntry(entry: ContextEntry) {
  selectedPath.value = fullPath(entry.relPath);
}

function confirmSelection() {
  if (!selectedPath.value || loading.value || error.value) return;
  emit('confirm', selectedPath.value);
  emit('close');
}

onMounted(() => loadDirectory(''));
watch(() => [props.serverId, props.projectId, props.rootPath], () => loadDirectory(''));
onUnmounted(() => { requestId++; });
</script>

<style scoped>
.context-picker-overlay { position: fixed; inset: 0; z-index: 2200; display: flex; align-items: center; justify-content: center; padding: 16px; background: #000a; }
.context-picker { width: min(560px, 100%); max-height: 80dvh; display: flex; flex-direction: column; gap: 12px; padding: 18px; border: 1px solid #4a4540; border-radius: 12px; background: #211f1d; color: #e5e2df; box-shadow: 0 18px 60px #0008; }
header, footer, .context-picker-navigation, .context-picker-entry { display: flex; align-items: center; gap: 10px; }
header { justify-content: space-between; }
h2 { margin: 0; font-size: 16px; }
p { margin: 0; font-size: 13px; }
button { border: 1px solid #57514a; border-radius: 6px; padding: 8px 10px; background: transparent; color: inherit; cursor: pointer; }
button:hover:not(:disabled), button[aria-pressed="true"] { background: #d9775726; border-color: #d97757; }
button:focus-visible { outline: 2px solid #d97757; outline-offset: 2px; }
button:disabled { opacity: .45; cursor: default; }
.context-picker-path, .context-picker-selected { font: 12px monospace; overflow-wrap: anywhere; }
.context-picker-selected { color: #d6a18e; }
.context-picker-entries { min-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.context-picker-select { min-width: 0; flex: 1; display: flex; align-items: center; gap: 8px; text-align: left; }
.context-picker-select span { overflow-wrap: anywhere; }
.context-picker-entry > button:last-child { flex-shrink: 0; }
footer { justify-content: flex-end; }
footer button:last-child { background: #a24e35; }
</style>
