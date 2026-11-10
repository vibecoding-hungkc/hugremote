import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
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

export interface GitRepoSummary {
  relPath: string;
  name: string;
  depth: number;
  branch: string;
  ahead: number;
  behind: number;
  hasUpstream: boolean;
  upstream: string;
  changedCount: number;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  clean: boolean;
}

export interface GitCommitFileChange {
  path: string;
  status: 'M' | 'A' | 'D' | 'R';
  additions: number;
  deletions: number;
}

export interface GitCommitItem {
  hash: string;
  shortHash: string;
  ref: string;
  subject: string;
  author: string;
  date: string;
  relativeDate: string;
  files: GitCommitFileChange[];
}

export interface GitHistoryTrackedFile {
  path: string;
  count: number;
}

export const useGitStore = defineStore('git', () => {
  const serverStore = useServerStore();
  const projectStore = useProjectStore();
  const maxDepth = ref(5);
  const repos = ref<GitRepoSummary[]>([]);
  const selectedRepoPath = ref('.');
  const repoFilter = ref<'all' | 'dirty'>('all');
  const scanningRepos = ref(false);

  const branch = ref('');
  const upstream = ref('');
  const hasUpstream = ref(false);
  const repoRoot = ref('');
  const ahead = ref(0);
  const behind = ref(0);
  const fetchedAt = ref('');
  const files = ref<GitChangedFile[]>([]);
  const branches = ref<GitBranchItem[]>([]);
  const selectedFile = ref<string | null>(null);
  const diffLines = ref<GitDiffLine[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const actionMessage = ref<string | null>(null);

  // Commit history & per-commit changed files state
  const commits = ref<GitCommitItem[]>([]);
  const trackedHistoryFiles = ref<GitHistoryTrackedFile[]>([]);
  const selectedCommitHash = ref<string | null>(null);
  const selectedCommitFile = ref<string | null>(null);
  const commitViewAllFilesDiff = ref(false);
  const commitDiffLines = ref<GitDiffLine[]>([]);
  const historyFileFilter = ref('');
  const historySearchQuery = ref('');
  const loadingHistory = ref(false);
  const loadingCommitDiff = ref(false);

  const selectedCommit = computed<GitCommitItem | null>(() => {
    if (!commits.value.length) return null;
    return commits.value.find(c => c.hash === selectedCommitHash.value) || commits.value[0] || null;
  });

  watch(
    () => `${serverStore.currentServerId}:${projectStore.currentProject?.id || ''}`,
    () => {
      selectedRepoPath.value = '.';
      repos.value = [];
      selectedFile.value = null;
      diffLines.value = [];
      commits.value = [];
      trackedHistoryFiles.value = [];
      selectedCommitHash.value = null;
      selectedCommitFile.value = null;
      commitDiffLines.value = [];
      historyFileFilter.value = '';
      historySearchQuery.value = '';
    }
  );

  const dirtyRepoCount = computed(() =>
    repos.value.filter(r => !r.clean || r.changedCount > 0).length
  );

  const filteredRepos = computed(() => {
    if (repoFilter.value === 'dirty') {
      return repos.value.filter(
        r => !r.clean || r.changedCount > 0 || r.relPath === selectedRepoPath.value
      );
    }
    return repos.value;
  });

  function repoQuerySuffix(): string {
    const rel = (selectedRepoPath.value || '.').trim();
    return rel && rel !== '.' ? `&repoPath=${encodeURIComponent(rel)}` : '';
  }

  function syncActiveRepoSummaryFromStatus() {
    const idx = repos.value.findIndex(r => r.relPath === selectedRepoPath.value);
    if (idx === -1) return;
    const stagedCount = files.value.filter(f => f.staged).length;
    const untrackedCount = files.value.filter(f => f.status === '??').length;
    const unstagedCount = files.value.filter(f => !f.staged && f.status !== '??').length;
    const changedCount = files.value.length;
    repos.value[idx] = {
      ...repos.value[idx],
      branch: branch.value || repos.value[idx].branch,
      ahead: ahead.value,
      behind: behind.value,
      hasUpstream: hasUpstream.value,
      upstream: upstream.value,
      changedCount,
      stagedCount,
      unstagedCount,
      untrackedCount,
      clean: changedCount === 0,
    };
  }

  async function fetchRepos() {
    const projectId = projectStore.currentProject?.id;
    if (!projectId) {
      repos.value = [];
      selectedRepoPath.value = '.';
      return;
    }
    scanningRepos.value = true;
    try {
      const res = await fetch(
        apiUrl(
          `/api/git/repos?serverId=${encodeURIComponent(serverStore.currentServerId)}&projectId=${encodeURIComponent(projectId)}`
        )
      );
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.maxDepth === 'number') maxDepth.value = data.maxDepth;
      const list: GitRepoSummary[] = Array.isArray(data.repos) ? data.repos : [];
      repos.value = list;
      if (list.length > 0 && !list.some(r => r.relPath === selectedRepoPath.value)) {
        selectedRepoPath.value = list[0].relPath;
      }
    } catch {
      // Keep existing repo list if scan fails
    } finally {
      scanningRepos.value = false;
    }
  }

  async function selectRepo(relPath: string) {
    const next = (relPath || '.').trim() || '.';
    selectedRepoPath.value = next;
    selectedFile.value = null;
    diffLines.value = [];
    selectedCommitHash.value = null;
    selectedCommitFile.value = null;
    commitDiffLines.value = [];
    historyFileFilter.value = '';
    await Promise.all([fetchStatus(), fetchBranches(), fetchCommits()]);
  }

  async function fetchStatus() {
    const projectId = projectStore.currentProject?.id;
    if (!projectId) {
      repos.value = [];
      selectedRepoPath.value = '.';
      applyStatus({});
      error.value = null;
      loading.value = false;
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(
        apiUrl(
          `/api/git/status?serverId=${encodeURIComponent(serverStore.currentServerId)}&projectId=${encodeURIComponent(projectId)}${repoQuerySuffix()}`
        )
      );
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load git status');
      const data = await res.json();
      applyStatus(data);
      syncActiveRepoSummaryFromStatus();
    } catch (err: any) {
      error.value = err.message;
      applyStatus({});
    } finally {
      loading.value = false;
    }
  }

  async function fetchBranches() {
    const projectId = projectStore.currentProject?.id;
    if (!projectId) return;
    try {
      const res = await fetch(
        apiUrl(
          `/api/git/branches?serverId=${encodeURIComponent(serverStore.currentServerId)}&projectId=${encodeURIComponent(projectId)}${repoQuerySuffix()}`
        )
      );
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
      const res = await fetch(
        apiUrl(
          `/api/git/diff?serverId=${encodeURIComponent(serverStore.currentServerId)}&projectId=${encodeURIComponent(projectId)}&file=${encodeURIComponent(file)}${repoQuerySuffix()}`
        )
      );
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

  async function fetchCommits() {
    const projectId = projectStore.currentProject?.id;
    if (!projectId) {
      commits.value = [];
      trackedHistoryFiles.value = [];
      return;
    }
    loadingHistory.value = true;
    try {
      let query = `/api/git/commits?serverId=${encodeURIComponent(serverStore.currentServerId)}&projectId=${encodeURIComponent(projectId)}&limit=40${repoQuerySuffix()}`;
      if (historyFileFilter.value.trim()) {
        query += `&file=${encodeURIComponent(historyFileFilter.value.trim())}`;
      }
      if (historySearchQuery.value.trim()) {
        query += `&search=${encodeURIComponent(historySearchQuery.value.trim())}`;
      }
      const res = await fetch(apiUrl(query));
      if (!res.ok) return;
      const data = await res.json();
      const list: GitCommitItem[] = Array.isArray(data.commits) ? data.commits : [];
      commits.value = list;
      if (Array.isArray(data.trackedFiles)) {
        trackedHistoryFiles.value = data.trackedFiles;
      }
      if (list.length === 0) {
        selectedCommitHash.value = null;
        selectedCommitFile.value = null;
        commitDiffLines.value = [];
        return;
      }
      const hasCurrent = selectedCommitHash.value && list.some(c => c.hash === selectedCommitHash.value);
      const targetCommit = hasCurrent
        ? list.find(c => c.hash === selectedCommitHash.value)!
        : list[0];
      selectedCommitHash.value = targetCommit.hash;
      const preferredFile =
        historyFileFilter.value && targetCommit.files.some(f => f.path === historyFileFilter.value)
          ? historyFileFilter.value
          : selectedCommitFile.value && targetCommit.files.some(f => f.path === selectedCommitFile.value)
          ? selectedCommitFile.value
          : targetCommit.files[0]?.path || null;
      selectedCommitFile.value = preferredFile;
      await fetchCommitDiff(
        targetCommit.hash,
        commitViewAllFilesDiff.value ? null : preferredFile
      );
    } catch {
      // Ignore commit history error if endpoint not mocked in legacy unit tests
    } finally {
      loadingHistory.value = false;
    }
  }

  async function fetchCommitDiff(hash: string, file?: string | null) {
    const projectId = projectStore.currentProject?.id;
    if (!projectId || !hash) return;
    loadingCommitDiff.value = true;
    try {
      let query = `/api/git/commit-diff?serverId=${encodeURIComponent(serverStore.currentServerId)}&projectId=${encodeURIComponent(projectId)}&hash=${encodeURIComponent(hash)}${repoQuerySuffix()}`;
      if (file) {
        query += `&file=${encodeURIComponent(file)}`;
      }
      const res = await fetch(apiUrl(query));
      if (!res.ok) {
        commitDiffLines.value = [];
        return;
      }
      const data = await res.json();
      commitDiffLines.value = Array.isArray(data.lines) ? data.lines : [];
    } catch {
      commitDiffLines.value = [];
    } finally {
      loadingCommitDiff.value = false;
    }
  }

  async function selectCommit(hash: string) {
    const found = commits.value.find(c => c.hash === hash);
    if (!found) return;
    selectedCommitHash.value = found.hash;
    const nextFile =
      historyFileFilter.value && found.files.some(f => f.path === historyFileFilter.value)
        ? historyFileFilter.value
        : found.files.some(f => f.path === selectedCommitFile.value)
        ? selectedCommitFile.value
        : found.files[0]?.path || null;
    selectedCommitFile.value = nextFile;
    await fetchCommitDiff(found.hash, commitViewAllFilesDiff.value ? null : nextFile);
  }

  async function selectCommitFile(filePath: string) {
    if (!selectedCommit.value) return;
    commitViewAllFilesDiff.value = false;
    selectedCommitFile.value = filePath;
    await fetchCommitDiff(selectedCommit.value.hash, filePath);
  }

  async function toggleCommitAllFilesDiff() {
    if (!selectedCommit.value) return;
    commitViewAllFilesDiff.value = !commitViewAllFilesDiff.value;
    await fetchCommitDiff(
      selectedCommit.value.hash,
      commitViewAllFilesDiff.value ? null : selectedCommitFile.value
    );
  }

  async function setHistoryFileFilter(filePath: string) {
    historyFileFilter.value = filePath.trim();
    if (historyFileFilter.value) {
      commitViewAllFilesDiff.value = false;
      selectedCommitFile.value = historyFileFilter.value;
    }
    await fetchCommits();
  }

  function applyStatus(data: any) {
    branch.value = data.branch || '';
    upstream.value = data.upstream || '';
    hasUpstream.value = Boolean(data.hasUpstream);
    repoRoot.value = data.repoRoot || '';
    ahead.value = data.ahead || 0;
    behind.value = data.behind || 0;
    fetchedAt.value = data.fetchedAt || '';
    files.value = data.files || [];
  }

  function applyActionData(data: any) {
    if (data.status) {
      applyStatus(data.status);
      syncActiveRepoSummaryFromStatus();
    }
    if (data.branches) branches.value = data.branches;
  }

  async function postGitAction(endpoint: string, body: Record<string, any>) {
    const projectId = projectStore.currentProject?.id;
    if (!projectId) return;
    loading.value = true;
    error.value = null;
    actionMessage.value = null;
    const rel = (selectedRepoPath.value || '.').trim();
    const payload = rel && rel !== '.'
      ? { serverId: serverStore.currentServerId, projectId, repoPath: rel, ...body }
      : { serverId: serverStore.currentServerId, projectId, ...body };
    try {
      const res = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    await fetchCommits();
  }

  async function push() {
    await postGitAction('/api/git/push', {});
    actionMessage.value = 'Push complete';
    await fetchCommits();
  }

  async function checkout(branchName: string) {
    await postGitAction('/api/git/checkout', { branch: branchName });
    await fetchCommits();
  }

  async function stageFile(file: string) {
    await postGitAction('/api/git/stage', { file });
  }

  async function unstageFile(file: string) {
    await postGitAction('/api/git/unstage', { file });
  }

  async function commit(message: string) {
    await postGitAction('/api/git/commit', { message });
    await fetchCommits();
  }

  function backToList() {
    selectedFile.value = null;
    diffLines.value = [];
  }

  return {
    maxDepth,
    repos,
    selectedRepoPath,
    repoFilter,
    scanningRepos,
    dirtyRepoCount,
    filteredRepos,
    branch,
    upstream,
    hasUpstream,
    repoRoot,
    ahead,
    behind,
    fetchedAt,
    files,
    branches,
    selectedFile,
    diffLines,
    loading,
    error,
    actionMessage,
    commits,
    trackedHistoryFiles,
    selectedCommitHash,
    selectedCommit,
    selectedCommitFile,
    commitViewAllFilesDiff,
    commitDiffLines,
    historyFileFilter,
    historySearchQuery,
    loadingHistory,
    loadingCommitDiff,
    fetchRepos,
    selectRepo,
    fetchStatus,
    fetchBranches,
    fetchDiff,
    fetchCommits,
    fetchCommitDiff,
    selectCommit,
    selectCommitFile,
    toggleCommitAllFilesDiff,
    setHistoryFileFilter,
    pull,
    push,
    checkout,
    stageFile,
    unstageFile,
    commit,
    backToList,
  };
});
