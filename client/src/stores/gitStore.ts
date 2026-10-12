import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiUrl } from '../utils/api.js';
import { useServerStore } from './serverStore.js';
import { useProjectStore } from './projectStore.js';

export interface GitChangedFile {
  path: string;
  status: 'M' | 'A' | 'D' | 'R' | '??';
  additions: number;
  deletions: number;
}

export interface GitDiffLine {
  type: 'context' | 'added' | 'deleted' | 'hunk';
  oldLine?: number;
  newLine?: number;
  content: string;
}

export const useGitStore = defineStore('git', () => {
  const serverStore = useServerStore();
  const projectStore = useProjectStore();
  const branch = ref('');
  const repoRoot = ref('');
  const ahead = ref(0);
  const behind = ref(0);
  const files = ref<GitChangedFile[]>([]);
  const selectedFile = ref<string | null>(null);
  const diffLines = ref<GitDiffLine[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchStatus() {
    const projectId = projectStore.currentProject?.id;
    if (!projectId) return;
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(apiUrl(`/api/git/status?serverId=${encodeURIComponent(serverStore.currentServerId)}&projectId=${encodeURIComponent(projectId)}`));
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load git status');
      const data = await res.json();
      branch.value = data.branch || '';
      repoRoot.value = data.repoRoot || '';
      ahead.value = data.ahead || 0;
      behind.value = data.behind || 0;
      files.value = data.files || [];
    } catch (err: any) {
      error.value = err.message;
      files.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function fetchDiff(file: string) {
    const projectId = projectStore.currentProject?.id;
    if (!projectId) return;
    selectedFile.value = file;
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(apiUrl(`/api/git/diff?serverId=${encodeURIComponent(serverStore.currentServerId)}&projectId=${encodeURIComponent(projectId)}&file=${encodeURIComponent(file)}`));
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load git diff');
      const data = await res.json();
      diffLines.value = data.lines || [];
    } catch (err: any) {
      error.value = err.message;
      diffLines.value = [];
    } finally {
      loading.value = false;
    }
  }

  function backToList() {
    selectedFile.value = null;
    diffLines.value = [];
  }

  return { branch, repoRoot, ahead, behind, files, selectedFile, diffLines, loading, error, fetchStatus, fetchDiff, backToList };
});
