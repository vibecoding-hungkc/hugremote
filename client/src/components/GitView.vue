<template>
  <div class="git-view">
    <div class="git-summary">
      <div><i class="ri-git-branch-line"></i> {{ gitStore.branch || 'No repo' }}</div>
      <span>{{ gitStore.files.length }} changed</span>
    </div>

    <div v-if="gitStore.error" class="state" :class="{ error: !isNoRepo }">
      <i :class="isNoRepo ? 'ri-git-repository-line' : 'ri-error-warning-line'"></i>
      {{ isNoRepo ? 'Project này chưa phải Git repository' : gitStore.error }}
    </div>
    <div v-else-if="gitStore.loading && !gitStore.files.length" class="state"><i class="ri-loader-4-line spin"></i> Loading Git...</div>

    <template v-else-if="!gitStore.selectedFile">
      <button v-for="file in gitStore.files" :key="file.path" class="file-row" @click="gitStore.fetchDiff(file.path)">
        <span class="status" :class="file.status">{{ file.status }}</span>
        <span class="file-path">{{ file.path }}</span>
        <span class="stat plus">+{{ file.additions }}</span>
        <span class="stat minus">-{{ file.deletions }}</span>
      </button>
      <div v-if="!gitStore.files.length" class="state">Working tree clean</div>
    </template>

    <template v-else>
      <div class="diff-header">
        <button @click="gitStore.backToList"><i class="ri-arrow-left-line"></i></button>
        <span>{{ gitStore.selectedFile }}</span>
      </div>
      <div class="diff-body">
        <div v-for="(line, idx) in gitStore.diffLines" :key="idx" class="diff-line" :class="line.type">
          <span class="line-no">{{ line.oldLine || '' }}</span>
          <span class="line-no">{{ line.newLine || '' }}</span>
          <code>{{ prefix(line.type) }}{{ line.content }}</code>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useGitStore } from '../stores/gitStore.js';
import { useProjectStore } from '../stores/projectStore.js';

const gitStore = useGitStore();
const projectStore = useProjectStore();

onMounted(() => gitStore.fetchStatus());
watch(() => projectStore.currentProject?.id, () => gitStore.fetchStatus());
const isNoRepo = computed(() => /not a git repository/i.test(gitStore.error || ''));
function prefix(type: string) { return type === 'added' ? '+' : type === 'deleted' ? '-' : type === 'hunk' ? '' : ' '; }
</script>

<style scoped>
.git-view { flex:1; min-height:0; background:#090d16; color:#cbd5e1; display:flex; flex-direction:column; overflow:hidden; }
.git-summary { height:42px; flex-shrink:0; display:flex; align-items:center; justify-content:space-between; padding:0 12px; border-bottom:1px solid #1e293b; background:#0f172a; font-size:12px; font-weight:800; }
.git-summary div { display:flex; align-items:center; gap:6px; color:#fbbf24; }
.git-summary span { color:#94a3b8; font-size:11px; }
.state { padding:28px; text-align:center; color:#64748b; font-size:13px; }
.state.error { color:#f87171; }
.file-row { display:grid; grid-template-columns: 34px minmax(0,1fr) auto auto; align-items:center; gap:8px; min-height:44px; border:0; border-bottom:1px solid #172033; background:transparent; color:#cbd5e1; padding:0 12px; text-align:left; }
.status { font-family:monospace; font-size:11px; font-weight:900; color:#fbbf24; }
.status.A, .status.\?\? { color:#34d399; }
.status.D { color:#fb7185; }
.file-path { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:monospace; font-size:12px; }
.stat { font-family:monospace; font-size:11px; }
.plus { color:#34d399; } .minus { color:#fb7185; }
.diff-header { height:40px; flex-shrink:0; display:flex; align-items:center; gap:8px; padding:0 10px; border-bottom:1px solid #1e293b; background:#0f172a; }
.diff-header button { width:28px; height:28px; border-radius:7px; border:1px solid #334155; background:#1e293b; color:#cbd5e1; }
.diff-header span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:monospace; font-size:12px; color:#f1f5f9; }
.diff-body { flex:1; overflow:auto; font-family:monospace; font-size:11.5px; }
.diff-line { display:grid; grid-template-columns: 36px 36px minmax(max-content,1fr); min-height:22px; align-items:center; }
.diff-line.added { background:rgba(34,197,94,.16); }
.diff-line.deleted { background:rgba(239,68,68,.16); }
.diff-line.hunk { background:rgba(59,130,246,.14); color:#93c5fd; }
.line-no { color:#64748b; text-align:right; padding-right:8px; user-select:none; }
.diff-line code { white-space:pre; padding-right:12px; color:#cbd5e1; }
.diff-line.added code { color:#bbf7d0; }
.diff-line.deleted code { color:#fecaca; }
</style>
