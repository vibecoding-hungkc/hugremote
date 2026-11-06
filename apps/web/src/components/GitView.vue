<template>
  <div class="git-view" :class="{ 'mobile-detail-open': mobileDetailOpen }">
    <!-- 1. Top Scanner Banner -->
    <div class="git-scanner-banner">
      <div class="git-scanner-info">
        <i class="ri-git-merge-line" style="color: #38bdf8"></i>
        <span class="git-view-title">Repositories trong dự án</span>
        <span>·</span>
        <b id="git-view-project-name">{{ projectStore.currentProject?.name || 'workspace' }}</b>
        <span id="git-view-scan-badge" class="quick-git-depth-tag">{{ gitStore.repos.length }} repo</span>
      </div>
      <div class="git-scanner-actions git-multi-repo-actions">
        <button
          id="git-view-filter-all"
          type="button"
          class="git-repo-filter-btn"
          :class="{ active: gitStore.repoFilter === 'all' }"
          data-git-repo-filter="all"
          @click="gitStore.repoFilter = 'all'"
        >
          Tất cả · {{ gitStore.repos.length }}
        </button>
        <button
          id="git-view-filter-dirty"
          type="button"
          class="git-repo-filter-btn"
          :class="{ active: gitStore.repoFilter === 'dirty' }"
          data-git-repo-filter="dirty"
          @click="gitStore.repoFilter = 'dirty'"
        >
          Có thay đổi · {{ gitStore.dirtyRepoCount }}
        </button>
        <button
          id="btn-rescan-git-repos"
          type="button"
          class="git-rescan-btn"
          :disabled="gitStore.scanningRepos"
          title="Quét lại các Git repository trong dự án"
          @click="refreshRepos"
        >
          <i class="ri-radar-line" :class="{ 'spin-anim': gitStore.scanningRepos }"></i>
          <span>Quét lại</span>
        </button>
      </div>
    </div>

    <!-- 2. Main 2-Column Grid (Repos List on Left, Active Repo Detail + Split Diff on Right) -->
    <div class="git-main-grid" :class="{ 'mobile-detail-open': mobileDetailOpen }">
      <!-- Left Column: Repository Cards -->
      <div id="git-multi-repo-bar" class="git-repos-column git-multi-repo-bar">
        <div class="git-repos-column-head git-multi-repo-header">
          <div class="git-multi-repo-title">
            <i class="ri-git-repository-line"></i>
            <span>Danh sách repo</span>
          </div>
          <span id="git-view-repo-count" class="git-multi-repo-badge">
            {{ gitStore.dirtyRepoCount }}/{{ gitStore.repos.length }}
          </span>
        </div>

        <div
          id="git-multi-repo-list"
          class="git-repos-scroll git-multi-repo-list"
          role="listbox"
          aria-label="Danh sách Git repository trong dự án"
        >
          <div v-if="gitStore.filteredRepos.length === 0" class="git-empty">
            Không có repository nào khớp bộ lọc
          </div>
          <button
            v-for="repo in gitStore.filteredRepos"
            :key="repo.relPath"
            type="button"
            class="git-repo-card git-multi-repo-card"
            :class="{ active: repo.relPath === gitStore.selectedRepoPath }"
            :data-git-repo-path="repo.relPath"
            :data-git-card-depth="repo.depth"
            @click="openRepo(repo.relPath)"
          >
            <i
              class="git-repo-card-icon"
              :class="repo.depth === 0 ? 'ri-git-repository-fill' : 'ri-git-repository-line'"
              aria-hidden="true"
            ></i>
            <span class="git-repo-card-main">
              <span class="git-repo-card-title">
                {{ repo.name || (repo.relPath === '.' ? 'workspace' : repo.relPath) }}
              </span>
              <span class="git-repo-card-sub">
                <span class="git-repo-card-path">
                  <i class="ri-git-branch-line"></i> {{ repo.branch }}
                </span>
                <span class="git-repo-separator">·</span>
                <span class="git-repo-card-branch">
                  {{ repo.relPath === '.' ? 'Gốc dự án' : repo.relPath }}
                </span>
              </span>
            </span>
            <span
              class="git-repo-count git-multi-repo-status"
              :class="repo.changedCount > 0 ? 'dirty status-indicator git-badge' : 'ok'"
            >
              {{ repo.changedCount > 0 ? `${repo.changedCount} file` : 'Sạch' }}
            </span>
          </button>
        </div>
      </div>

      <!-- Right Column: Active Repo Toolbar + 2-Pane Split (Changed Files + Live Diff) -->
      <div class="git-Active-detail-column git-repo-detail">
        <button
          id="git-mobile-back"
          type="button"
          class="git-mobile-back"
          aria-label="Quay lại danh sách repo"
          @click="backToRepos"
        >
          <i class="ri-arrow-left-line" aria-hidden="true"></i> Danh sách repo
        </button>

        <div class="git-active-repo-toolbar git-summary">
          <div class="git-active-repo-meta">
            <i class="ri-git-repository-fill" style="color: #38bdf8"></i>
            <strong id="git-detail-repo-name">{{ activeRepoDisplayName }}</strong>
            <span id="git-detail-repo-path" class="quick-git-depth-tag">
              {{ gitStore.selectedRepoPath === '.' ? 'Gốc dự án' : gitStore.selectedRepoPath }}
            </span>
            <span id="git-detail-repo-sync" class="quick-git-depth-tag">
              {{ syncStatusLabel }}
            </span>
          </div>

          <div class="git-remote-actions">
            <button class="branch-picker" @click="showBranches = !showBranches">
              <i class="ri-git-branch-line"></i>
              <span>{{ gitStore.branch || 'No repo' }}</span>
              <i class="ri-arrow-down-s-line"></i>
            </button>
            <button class="remote-btn" :disabled="!canPull" :title="pullTitle" @click="runRemote('pull')">
              <i :class="remoteAction === 'pull' ? 'ri-loader-4-line spin' : 'ri-download-cloud-2-line'"></i>
              Pull
              <span v-if="gitStore.behind" class="sync-badge">{{ gitStore.behind }}</span>
            </button>
            <button class="remote-btn" :disabled="!canPush" :title="pushTitle" @click="runRemote('push')">
              <i :class="remoteAction === 'push' ? 'ri-loader-4-line spin' : 'ri-upload-cloud-2-line'"></i>
              Push
              <span v-if="gitStore.ahead" class="sync-badge">{{ gitStore.ahead }}</span>
            </button>
          </div>
        </div>

        <div v-if="showBranches" class="branch-list">
          <button
            v-for="item in gitStore.branches"
            :key="item.name"
            class="branch-row"
            :class="{ active: item.current }"
            @click="switchBranch(item.name)"
          >
            <span>{{ item.name }}</span>
            <i v-if="item.current" class="ri-check-line"></i>
          </button>
        </div>

        <p v-if="gitStore.error" class="git-error">{{ gitStore.error }}</p>

        <div class="git-detail-split">
          <!-- Left Box: Changed Files + Commit Bar -->
          <div class="git-files-box">
            <div class="git-box-title">
              <span>Tệp thay đổi trong repo đang chọn</span>
              <span
                id="git-detail-file-count"
                class="git-repo-count"
                :class="gitStore.files.length > 0 ? 'git-badge' : 'ok'"
              >
                {{ gitStore.files.length > 0 ? `${gitStore.files.length} thay đổi` : 'Sạch' }}
              </span>
            </div>

            <div id="git-detail-file-list" class="git-files-scroll">
              <div v-if="gitStore.files.length === 0 && !gitStore.loading" class="git-empty">
                Không có tệp thay đổi trong repo này.
              </div>
              <div
                v-for="file in gitStore.files"
                :key="file.path"
                class="file-row git-file-row"
                :class="{ active: gitStore.selectedFile === file.path }"
              >
                <button
                  class="stage-toggle"
                  :title="file.staged ? 'Unstage' : 'Stage'"
                  @click="toggleStage(file)"
                >
                  <i :class="file.staged ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"></i>
                </button>
                <button class="file-open" @click="gitStore.fetchDiff(file.path)">
                  <span class="status" :class="file.status">{{ file.status }}</span>
                  <span class="file-path git-file-path" :title="file.path">{{ file.path }}</span>
                  <span class="stage-label">{{ file.staged ? 'staged' : 'unstaged' }}</span>
                  <span class="stat plus">+{{ file.additions }}</span>
                  <span class="stat minus">-{{ file.deletions }}</span>
                </button>
              </div>
            </div>

            <div class="commit-box git-commit-row">
              <input
                id="git-detail-commit-msg"
                v-model="commitMessage"
                placeholder="Nhập thông điệp commit cho repo đang chọn..."
              />
              <button
                id="git-detail-stage-all"
                type="button"
                class="git-stage-all-btn"
                :disabled="gitStore.loading || !hasUnstagedFiles"
                @click="stageAllFiles"
              >
                Stage tất cả
              </button>
              <button
                id="git-detail-commit-btn"
                type="button"
                class="git-commit-submit-btn"
                :disabled="!commitMessage.trim() || !hasStagedFiles || gitStore.loading"
                @click="submitCommit"
              >
                <i class="ri-git-commit-line"></i> Commit
              </button>
            </div>
          </div>

          <!-- Right Box: Quick Diff Viewer -->
          <div class="git-diff-box">
            <div class="git-box-title">
              <span>Xem nhanh Diff</span>
              <span id="git-detail-diff-filename" class="git-diff-filename">
                {{ gitStore.selectedFile || 'Chưa chọn tệp' }}
              </span>
            </div>

            <div id="git-detail-diff-body" class="diff-lines git-diff-pre">
              <div v-if="!gitStore.selectedFile || gitStore.diffLines.length === 0" class="git-diff-empty">
                {{
                  gitStore.files.length === 0
                    ? '// Repo sạch, không có khác biệt chưa commit'
                    : 'Chọn một tệp thay đổi bên trái để xem chi tiết Diff'
                }}
              </div>
              <div
                v-for="(line, idx) in gitStore.diffLines"
                :key="idx"
                class="diff-line"
                :class="line.type"
              >
                <span class="line-no">{{ line.oldLine ?? '' }}</span>
                <span class="line-no">{{ line.newLine ?? '' }}</span>
                <span class="line-code">{{ line.content }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="toast" class="git-toast" :class="toast.type">{{ toast.message }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useGitStore, type GitChangedFile } from '../stores/gitStore.js';
import { useServerStore } from '../stores/serverStore.js';
import { useProjectStore } from '../stores/projectStore.js';

const gitStore = useGitStore();
const serverStore = useServerStore();
const projectStore = useProjectStore();
const showBranches = ref(false);
const mobileDetailOpen = ref(false);
const commitMessage = ref('');
const remoteAction = ref<'pull' | 'push' | null>(null);
const toast = ref<{ type: 'ok' | 'err'; message: string } | null>(null);

const hasStagedFiles = computed(() => gitStore.files.some(file => file.staged));
const hasUnstagedFiles = computed(() => gitStore.files.some(file => !file.staged));
const isDetachedHead = computed(() => !gitStore.branch || gitStore.branch === 'HEAD');
const canPull = computed(() => Boolean(gitStore.branch && !isDetachedHead.value && gitStore.hasUpstream && !remoteAction.value && !gitStore.loading));
const canPush = computed(() => Boolean(gitStore.branch && !isDetachedHead.value && (!gitStore.hasUpstream || gitStore.ahead > 0) && !remoteAction.value && !gitStore.loading));

const activeRepoSummary = computed(() =>
  gitStore.repos.find(r => r.relPath === gitStore.selectedRepoPath) || null
);

const activeRepoDisplayName = computed(() => {
  if (activeRepoSummary.value?.name) return activeRepoSummary.value.name;
  if (gitStore.selectedRepoPath === '.') return projectStore.currentProject?.name || 'workspace';
  return gitStore.selectedRepoPath;
});

const syncStatusLabel = computed(() => {
  if (!gitStore.hasUpstream) return 'Chưa có upstream';
  if (gitStore.ahead === 0 && gitStore.behind === 0) return 'Đồng bộ origin';
  const parts: string[] = [];
  if (gitStore.ahead > 0) parts.push(`↑${gitStore.ahead}`);
  if (gitStore.behind > 0) parts.push(`↓${gitStore.behind}`);
  return parts.join(' ');
});

const pullTitle = computed(() => {
  if (!gitStore.branch || isDetachedHead.value) return 'Không thể pull ở trạng thái detached HEAD';
  if (!gitStore.hasUpstream) return 'Branch chưa có upstream';
  return gitStore.behind ? `Pull ${gitStore.behind} commit từ ${gitStore.upstream}` : `Pull từ ${gitStore.upstream}`;
});

const pushTitle = computed(() => {
  if (!gitStore.branch || isDetachedHead.value) return 'Không thể push ở trạng thái detached HEAD';
  if (!gitStore.hasUpstream) return 'Publish branch hiện tại';
  if (!gitStore.ahead) return 'Không có commit mới để push';
  return `Push ${gitStore.ahead} commit lên ${gitStore.upstream}`;
});

function showToast(type: 'ok' | 'err', message: string) {
  toast.value = { type, message };
  setTimeout(() => {
    if (toast.value?.message === message) toast.value = null;
  }, 2600);
}

async function autoLoadFirstDiffIfNeeded() {
  if (gitStore.files.length === 0) {
    gitStore.selectedFile = null;
    gitStore.diffLines = [];
    return;
  }
  const hasSelected = gitStore.selectedFile && gitStore.files.some(f => f.path === gitStore.selectedFile);
  const targetFile = hasSelected ? gitStore.selectedFile! : gitStore.files[0].path;
  if (!hasSelected || gitStore.diffLines.length === 0) {
    await gitStore.fetchDiff(targetFile);
  }
}

async function refresh() {
  await gitStore.fetchRepos();
  await Promise.all([gitStore.fetchStatus(), gitStore.fetchBranches()]);
  await autoLoadFirstDiffIfNeeded();
}

async function refreshRepos() {
  await gitStore.fetchRepos();
  await gitStore.fetchStatus();
  await autoLoadFirstDiffIfNeeded();
}

async function openRepo(relPath: string) {
  showBranches.value = false;
  await gitStore.selectRepo(relPath);
  await autoLoadFirstDiffIfNeeded();
  mobileDetailOpen.value = true;
}

function backToRepos() {
  showBranches.value = false;
  mobileDetailOpen.value = false;
}

async function switchBranch(name: string) {
  showBranches.value = false;
  await gitStore.checkout(name);
  await autoLoadFirstDiffIfNeeded();
}

async function toggleStage(file: GitChangedFile) {
  if (file.staged) await gitStore.unstageFile(file.path);
  else await gitStore.stageFile(file.path);
}

async function stageAllFiles() {
  const unstaged = gitStore.files.filter(f => !f.staged);
  for (const file of unstaged) {
    await gitStore.stageFile(file.path);
  }
}

async function submitCommit() {
  const message = commitMessage.value.trim();
  if (!message) return;
  try {
    await gitStore.commit(message);
    commitMessage.value = '';
    await autoLoadFirstDiffIfNeeded();
    showToast('ok', 'Commit thành công');
  } catch (err: any) {
    showToast('err', err.message || 'Commit thất bại');
  }
}

async function runRemote(action: 'pull' | 'push') {
  remoteAction.value = action;
  try {
    if (action === 'pull') await gitStore.pull();
    else await gitStore.push();
    await autoLoadFirstDiffIfNeeded();
    showToast('ok', action === 'pull' ? 'Pull thành công' : 'Push thành công');
  } catch (err: any) {
    showToast('err', err.message || `${action} thất bại`);
  } finally {
    remoteAction.value = null;
  }
}

onMounted(refresh);
watch(() => [serverStore.currentServerId, projectStore.currentProject?.id], () => {
  mobileDetailOpen.value = false;
  refresh();
});
</script>

<style scoped>
.git-view {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.git-scanner-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 12px;
  background: #202020;
  border: 1px solid #333333;
  border-radius: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.git-scanner-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #a3a3a3;
  flex-wrap: wrap;
}

.git-view-title {
  font-weight: 700;
  color: #eeeeee;
}

.git-scanner-info b {
  color: #eeeeee;
  font-family: monospace;
}

.quick-git-depth-tag {
  font-size: 10px;
  font-family: monospace;
  color: #9e9e9e;
  background: #1b1b1b;
  border: 1px solid #303030;
  border-radius: 4px;
  padding: 1px 6px;
}

.git-scanner-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.git-repo-filter-btn,
.git-rescan-btn {
  height: 24px;
  padding: 0 8px;
  border-radius: 5px;
  border: 1px solid #3a3a3a;
  background: #262626;
  color: #b5b5b5;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.git-repo-filter-btn.active {
  background: #3a3a3a;
  color: #ffffff;
  border-color: #525252;
}

.git-main-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 12px;
  overflow: hidden;
}

.git-repos-column {
  background: #202020;
  border: 1px solid #333333;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.git-repos-column-head {
  padding: 9px 11px;
  border-bottom: 1px solid #2e2e2e;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
  font-weight: 700;
  color: #d4d4d4;
}

.git-multi-repo-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.git-multi-repo-badge {
  font-family: monospace;
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 8px;
  background: #2e2e2e;
  color: #d4d4d4;
}

.git-repos-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.git-repo-card {
  width: 100%;
  min-height: 46px;
  padding: 7px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: #eeeeee;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  text-align: left;
}

.git-repo-card:hover {
  background: #262626;
  border-color: #363636;
}

.git-repo-card.active {
  background: #292929;
  border-color: #525252;
}

.git-repo-card-icon {
  color: #a8a8a8;
  font-size: 15px;
}

.git-repo-card-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.git-repo-card-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  font-weight: 600;
  color: #eeeeee;
}

.git-repo-card-sub {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  font-size: 11px;
  color: #9e9e9e;
  font-family: monospace;
}

.git-repo-card-path {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

.git-repo-card-branch {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.git-repo-separator {
  color: #666666;
  flex-shrink: 0;
}

.git-repo-count {
  font-size: 10px;
  font-family: monospace;
  padding: 1px 6px;
  border-radius: 999px;
  background: #2b2b2b;
  color: #d4d4d4;
  flex-shrink: 0;
}

.git-repo-count.git-badge {
  background: rgba(245, 158, 11, 0.16);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.35);
}

.git-repo-count.ok {
  color: #4ade80;
  background: rgba(34, 197, 94, 0.12);
}

.git-Active-detail-column {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: hidden;
}

.git-mobile-back {
  display: none;
  align-self: flex-start;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid #3f3f3f;
  background: #252525;
  color: #eeeeee;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.git-active-repo-toolbar {
  background: #202020;
  border: 1px solid #333333;
  border-radius: 8px;
  padding: 9px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.git-active-repo-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12.5px;
  color: #eeeeee;
}

.git-remote-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.branch-picker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #252525;
  border: 1px solid #3f3f3f;
  color: #fbbf24;
  border-radius: 6px;
  padding: 5px 10px;
  font-family: monospace;
  font-size: 12px;
  cursor: pointer;
}

.remote-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #252525;
  border: 1px solid #3f3f3f;
  color: #e5e5e5;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.remote-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.sync-badge {
  background: #3f3f3f;
  color: #ffffff;
  border-radius: 8px;
  padding: 0 5px;
  font-family: monospace;
  font-size: 10.5px;
}

.branch-list {
  display: flex;
  flex-direction: column;
  background: #252525;
  border: 1px solid #3f3f3f;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.branch-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: #eeeeee;
  font-family: monospace;
  font-size: 12px;
  cursor: pointer;
}

.branch-row.active {
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.1);
}

.git-detail-split {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(280px, 1.15fr);
  gap: 10px;
  overflow: hidden;
}

.git-files-box,
.git-diff-box {
  background: #202020;
  border: 1px solid #333333;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.git-box-title {
  padding: 8px 11px;
  border-bottom: 1px solid #2e2e2e;
  font-size: 11.5px;
  font-weight: 700;
  color: #d4d4d4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.git-diff-filename {
  font-family: monospace;
  font-weight: 400;
  color: #9e9e9e;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.git-files-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.file-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid #292929;
}

.file-row.active {
  background: #282828;
}

.stage-toggle {
  background: transparent;
  border: none;
  color: #22c55e;
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
}

.file-open {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  background: transparent;
  border: none;
  color: #eeeeee;
  text-align: left;
  cursor: pointer;
  font-family: monospace;
  font-size: 12px;
}

.status {
  width: 20px;
  color: #f59e0b;
  font-weight: 700;
  flex-shrink: 0;
}

.file-path {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stage-label {
  color: #989898;
  font-size: 10.5px;
  text-transform: uppercase;
  flex-shrink: 0;
}

.stat {
  font-size: 11px;
  flex-shrink: 0;
}

.plus {
  color: #22c55e;
}

.minus {
  color: #ef4444;
}

.commit-box {
  padding: 8px;
  border-top: 1px solid #2e2e2e;
  display: flex;
  gap: 6px;
  background: #1a1a1a;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.commit-box input {
  flex: 1;
  min-width: 150px;
  height: 30px;
  background: #252525;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  color: #eeeeee;
  padding: 0 9px;
  font-size: 12px;
}

.git-stage-all-btn,
.git-commit-submit-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid #3f3f3f;
  background: #2a2a2a;
  color: #eeeeee;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.git-commit-submit-btn {
  background: #3b3b3b;
  border-color: #525252;
}

.git-stage-all-btn:disabled,
.git-commit-submit-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.diff-lines {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 10px;
  font-family: monospace;
  font-size: 11.5px;
  line-height: 1.5;
  background: #171717;
}

.git-diff-empty {
  color: #8a8a8a;
  padding: 8px 4px;
}

.diff-line {
  display: grid;
  grid-template-columns: 34px 34px minmax(0, 1fr);
  gap: 6px;
  padding: 1px 6px;
  white-space: pre-wrap;
  word-break: break-word;
}

.diff-line.added {
  background: rgba(34, 197, 94, 0.14);
}

.diff-line.deleted {
  background: rgba(239, 68, 68, 0.14);
}

.line-no {
  color: #6b6b6b;
  text-align: right;
  user-select: none;
}

.git-empty,
.git-error {
  color: #989898;
  font-size: 12.5px;
  padding: 12px;
}

.git-toast {
  position: fixed;
  right: 12px;
  bottom: 54px;
  z-index: 60;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  background: #1f2937;
  border: 1px solid #38bdf8;
  color: #f8fafc;
}

.git-toast.err {
  border-color: #ef4444;
  color: #fecaca;
}

.spin {
  animation: git-spin 0.9s linear infinite;
}

@keyframes git-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 860px) {
  .git-view {
    overflow-y: auto;
  }

  .git-main-grid {
    grid-template-columns: 1fr;
    overflow: visible;
  }

  .git-view:not(.mobile-detail-open) .git-repo-detail {
    display: none;
  }

  .git-view.mobile-detail-open .git-multi-repo-bar {
    display: none;
  }

  .git-mobile-back {
    display: inline-flex;
  }

  .git-detail-split {
    grid-template-columns: 1fr;
    overflow: visible;
  }

  .git-files-box,
  .git-diff-box {
    max-height: 360px;
  }
}
</style>
