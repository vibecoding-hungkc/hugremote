import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiUrl } from '../utils/api.js';
import { useServerStore } from './serverStore.js';
import { useProjectStore } from './projectStore.js';

export interface GitChangedFile {
  path: string;
  status: 'M' | 'A' | 'D' | 'R' | '??';
  staged: boolean;
  additions: number;
  deletions: number;
}

export interface GitDiffLine {
  type: 'context' | 'added' | 'deleted' | 'hunk';
  oldLine?: number;
  newLine?: number;
  content: string;
}

export interface GitBranchItem {
  name: string;
  current: boolean;
}

export const useGitStore = defineStore('git', () => {
  const serverStore = useServerStore();
  const projectStore = useProjectStore();
  const branch = ref('');
  const repoRoot = ref('');
  const ahead = ref(0);
  const behind = ref(0);
  const files = ref<GitChangedFile[]>([]);
  const branches = ref<GitBranchItem[]>([]);
  const selectedFile = ref<string | null>(null);
  const diffLines = ref<GitDiffLine[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const actionMessage = ref<string | null>(null);

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

  async function fetchBranches() {
    const projectId = projectStore.currentProject?.id;
    if (!projectId) return;
    try {
      const res = await fetch(apiUrl(`/api/git/branches?serverId=${encodeURIComponent(serverStore.currentServerId)}&projectId=${encodeURIComponent(projectId)}`));
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load git branches');
      const data = await res.json();
      branches.value = data.branches || [];
    } catch (err: any) {
      error.value = err.message;
      branches.value = [];
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

  function applyStatus(data: any) {
    branch.value = data.branch || '';
    repoRoot.value = data.repoRoot || '';
    ahead.value = data.ahead || 0;
    behind.value = data.behind || 0;
    files.value = data.files || [];
  }

  function applyActionData(data: any) {
    if (data.status) applyStatus(data.status);
    if (data.branches) branches.value = data.branches;
  }

  async function postGitAction(endpoint: string, body: Record<string, any>) {
    const projectId = projectStore.currentProject?.id;
    if (!projectId) return;
    loading.value = true;
    error.value = null;
    actionMessage.value = null;
    try {
      const res = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: serverStore.currentServerId, projectId, ...body }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Git action failed');
      const data = await res.json();
      applyActionData(data);
      return data;
    } catch (err: any) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function pull() {
    await postGitAction('/api/git/pull', {});
    actionMessage.value = 'Pull complete';
  }

  async function push() {
    await postGitAction('/api/git/push', {});
    actionMessage.value = 'Push complete';
  }

  async function checkout(branch: string) {
    await postGitAction('/api/git/checkout', { branch });
  }

  async function stageFile(file: string) {
    await postGitAction('/api/git/stage', { file });
  }

  async function unstageFile(file: string) {
    await postGitAction('/api/git/unstage', { file });
  }

  async function commit(message: string) {
    await postGitAction('/api/git/commit', { message });
  }

  function backToList() {
    selectedFile.value = null;
    diffLines.value = [];
  }

  return { branch, repoRoot, ahead, behind, files, branches, selectedFile, diffLines, loading, error, actionMessage, fetchStatus, fetchBranches, fetchDiff, pull, push, checkout, stageFile, unstageFile, commit, backToList };
});
