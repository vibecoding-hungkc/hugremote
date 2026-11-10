<template>
  <div
    ref="gitViewRoot"
    class="git-view"
    :class="{ 'mobile-detail-open': mobileDetailOpen }"
    :style="gitColCssVars"
  >
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

    <!-- 2. Main 2-Column Grid (Repos List on Left, Resizer, Active Repo Detail on Right) -->
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

      <!-- Column Resizer 1: Repo List <-> Repo Detail -->
      <div
        id="git-resizer-repos"
        class="git-col-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Kéo để chỉnh độ rộng cột danh sách repo"
        title="Kéo để chỉnh độ rộng cột danh sách repo"
        @mousedown="startResize($event, 'repos', 180, 520)"
      ></div>

      <!-- Right Column: Active Repo Toolbar + 2-Tab Mode (Working Tree | Commit History) -->
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

        <!-- 2-Tab Subview Switcher (Working Changes vs Commit History) -->
        <div class="git-detail-mode-bar">
          <div class="git-detail-mode-tabs" role="tablist" aria-label="Chế độ xem Git">
            <button
              id="git-mode-working"
              type="button"
              class="git-repo-filter-btn"
              :class="{ active: detailMode === 'working' }"
              data-git-mode="working"
              @click="switchDetailMode('working')"
            >
              <i class="ri-file-edit-line"></i>
              <span>Thay đổi hiện tại · {{ gitStore.files.length }}</span>
            </button>
            <button
              id="git-mode-history"
              type="button"
              class="git-repo-filter-btn"
              :class="{ active: detailMode === 'history' }"
              data-git-mode="history"
              @click="switchDetailMode('history')"
            >
              <i class="ri-history-line"></i>
              <span>Lịch sử Commit · {{ gitStore.commits.length }}</span>
            </button>
          </div>
          <span id="git-detail-mode-summary" class="git-detail-mode-hint">
            {{ gitStore.files.length }} tệp đang sửa · {{ gitStore.commits.length }} commit trong lịch sử
          </span>
        </div>

        <p v-if="gitStore.error" class="git-error">{{ gitStore.error }}</p>

        <!-- TAB 1: WORKING TREE CHANGES -->
        <div
          v-show="detailMode === 'working'"
          id="git-working-tree-section"
          class="git-detail-split"
          :data-mobile-step="workingMobileStep"
        >
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
                <button class="file-open" @click="openWorkingFileDiff(file.path)">
                  <span class="status" :class="file.status">{{ file.status }}</span>
                  <span class="file-path git-file-path" :title="file.path">{{ file.path }}</span>
                  <span class="stage-label">{{ file.staged ? 'staged' : 'unstaged' }}</span>
                  <span class="stat plus">+{{ file.additions }}</span>
                  <span class="stat minus">-{{ file.deletions }}</span>
                </button>
                <button
                  type="button"
                  class="git-repo-filter-btn git-track-file-btn"
                  title="Xem lịch sử các commit đã thay đổi tệp này"
                  @click.stop="trackFileInHistory(file.path)"
                >
                  Lịch sử tệp
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

          <!-- Column Resizer 2: Working Files <-> Working Diff -->
          <div
            id="git-resizer-working-files"
            class="git-col-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Kéo để chỉnh độ rộng cột tệp thay đổi"
            title="Kéo để chỉnh độ rộng cột tệp thay đổi"
            @mousedown="startResize($event, 'workingFiles', 220, 720)"
          ></div>

          <!-- Right Box: Quick Diff Viewer -->
          <div class="git-diff-box">
            <button
              id="git-working-mobile-back-files"
              type="button"
              class="git-sub-mobile-back"
              aria-label="Quay lại danh sách tệp thay đổi"
              @click="workingMobileStep = 'files'"
            >
              <i class="ri-arrow-left-line" aria-hidden="true"></i> Danh sách tệp thay đổi
            </button>
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

        <!-- TAB 2: GIT COMMIT HISTORY & CHANGED FILES PER COMMIT -->
        <div
          v-show="detailMode === 'history'"
          id="git-history-section"
          class="git-history-section"
          :data-mobile-step="historyMobileStep"
        >
          <div class="git-history-head">
            <div class="git-history-title-group">
              <i class="ri-git-commit-line"></i>
              <span>Lịch sử Commit &amp; Biến động tệp</span>
              <span id="git-history-branch-badge" class="quick-git-depth-tag">
                nhánh {{ gitStore.branch || 'main' }}
              </span>
              <span id="git-history-count-badge" class="git-repo-count ok">
                {{ gitStore.commits.length }} commit
              </span>
              <span
                v-if="gitStore.historyFileFilter"
                id="git-history-tracked-pill"
                class="git-history-tracked-pill"
              >
                <i class="ri-file-search-line"></i>
                <span id="git-history-tracked-file-name">
                  Đang theo dõi: {{ gitStore.historyFileFilter }}
                </span>
                <button
                  id="git-history-clear-file-filter"
                  type="button"
                  title="Bỏ lọc theo tệp"
                  aria-label="Bỏ lọc theo tệp"
                  @click="clearTrackedFileFilter"
                >
                  ×
                </button>
              </span>
            </div>

            <div class="git-history-controls">
              <select
                id="git-history-file-select"
                class="git-history-select"
                :value="gitStore.historyFileFilter"
                aria-label="Lọc lịch sử commit theo tệp"
                @change="onHistoryFileSelectChange($event)"
              >
                <option value="">
                  Tất cả tệp trong lịch sử · {{ gitStore.trackedHistoryFiles.length }} tệp
                </option>
                <option
                  v-for="item in gitStore.trackedHistoryFiles"
                  :key="item.path"
                  :value="item.path"
                >
                  {{ item.path }} · {{ item.count }} commit
                </option>
              </select>

              <input
                id="git-history-search-input"
                v-model="gitStore.historySearchQuery"
                class="git-history-search"
                type="text"
                placeholder="Tìm mã SHA, nội dung commit, tác giả, tên tệp..."
                aria-label="Tìm kiếm trong lịch sử commit"
                @input="onHistorySearchInput"
              />
            </div>
          </div>

          <div class="git-history-split">
            <!-- Column 1: Commit History List -->
            <div class="git-history-commits-box">
              <div class="git-box-title">
                <span>Danh sách Commit theo thời gian</span>
                <span id="git-history-filtered-count" class="quick-git-depth-tag">
                  {{ gitStore.commits.length }} commit
                </span>
              </div>

              <div
                id="git-history-commit-list"
                class="git-history-commit-list"
                role="listbox"
                aria-label="Danh sách commit của repo"
              >
                <div v-if="gitStore.commits.length === 0 && !gitStore.loadingHistory" class="git-empty">
                  Không tìm thấy commit nào khớp bộ lọc.
                </div>
                <button
                  v-for="commit in gitStore.commits"
                  :key="commit.hash"
                  type="button"
                  class="git-commit-item"
                  :class="{ active: gitStore.selectedCommit?.hash === commit.hash }"
                  :data-commit-hash="commit.hash"
                  @click="handleSelectCommit(commit.hash)"
                >
                  <span class="git-commit-timeline" aria-hidden="true">
                    <span class="git-commit-dot"></span>
                    <span class="git-commit-line"></span>
                  </span>
                  <span class="git-commit-main">
                    <span class="git-commit-top">
                      <span class="git-commit-sha">{{ commit.shortHash }}</span>
                      <span v-if="commit.ref" class="git-commit-ref">{{ commit.ref }}</span>
                      <span class="git-commit-date">{{ commit.relativeDate }}</span>
                    </span>
                    <span class="git-commit-subject">{{ commit.subject }}</span>
                    <span class="git-commit-meta">
                      <span><i class="ri-user-3-line"></i> {{ commit.author }}</span>
                      <span>·</span>
                      <span>{{ commit.files.length }} tệp thay đổi</span>
                      <span class="stat plus">+{{ sumCommitAdditions(commit) }}</span>
                      <span class="stat minus">-{{ sumCommitDeletions(commit) }}</span>
                    </span>
                  </span>
                </button>
              </div>
            </div>

            <!-- Column Resizer 3: History Commits <-> History Commit Detail -->
            <div
              id="git-resizer-history-commits"
              class="git-col-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="Kéo để chỉnh độ rộng cột danh sách commit"
              title="Kéo để chỉnh độ rộng cột danh sách commit"
              @mousedown="startResize($event, 'historyCommits', 220, 640)"
            ></div>

            <!-- Column 2: Selected Commit Summary + Side-by-Side Files & Diff -->
            <div class="git-history-detail-box">
              <div id="git-commit-detail-banner" class="git-commit-detail-banner">
                <button
                  id="git-history-mobile-back-commits"
                  type="button"
                  class="git-sub-mobile-back git-banner-mobile-back"
                  aria-label="Quay lại danh sách commit"
                  @click="historyMobileStep = 'commits'"
                >
                  <i class="ri-arrow-left-line" aria-hidden="true"></i> Danh sách Commit
                </button>

                <template v-if="gitStore.selectedCommit">
                  <div class="git-commit-detail-top">
                    <span id="git-commit-detail-subject" class="git-commit-detail-subject">
                      {{ gitStore.selectedCommit.subject }}
                    </span>
                    <button
                      id="git-copy-commit-sha-btn"
                      type="button"
                      class="git-repo-filter-btn"
                      @click="copySelectedCommitSha"
                    >
                      <i class="ri-file-copy-line"></i>
                      <span id="git-commit-detail-sha">{{ gitStore.selectedCommit.shortHash }}</span>
                    </button>
                  </div>
                  <div class="git-commit-detail-sub">
                    <span id="git-commit-detail-author">
                      <i class="ri-user-3-line"></i> {{ gitStore.selectedCommit.author }}
                    </span>
                    <span>·</span>
                    <span id="git-commit-detail-time">{{ gitStore.selectedCommit.relativeDate }}</span>
                    <span>·</span>
                    <span id="git-commit-detail-stats">
                      {{ gitStore.selectedCommit.files.length }} tệp thay đổi · +{{
                        sumCommitAdditions(gitStore.selectedCommit)
                      }}
                      -{{ sumCommitDeletions(gitStore.selectedCommit) }}
                    </span>
                  </div>
                </template>
                <div v-else class="git-commit-detail-subject">
                  Chọn một commit để xem chi tiết
                </div>
              </div>

              <div class="git-commit-inspector-split">
                <!-- Changed files inside selected commit -->
                <div id="git-commit-files-pane" class="git-commit-files-pane">
                  <div class="git-box-title">
                    <span>Tệp thay đổi trong commit</span>
                    <div class="git-box-title-actions">
                      <span id="git-commit-files-count" class="quick-git-depth-tag">
                        {{ gitStore.selectedCommit?.files.length || 0 }} tệp
                      </span>
                      <button
                        id="git-commit-view-all-diff-btn"
                        type="button"
                        class="git-repo-filter-btn"
                        :class="{ active: gitStore.commitViewAllFilesDiff }"
                        @click="handleToggleCommitAllDiff"
                      >
                        Xem gộp mọi tệp
                      </button>
                    </div>
                  </div>

                  <div id="git-commit-file-list" class="git-commit-files-list">
                    <div
                      v-if="!gitStore.selectedCommit || gitStore.selectedCommit.files.length === 0"
                      class="git-empty"
                    >
                      Không có tệp thay đổi trong commit này.
                    </div>
                    <div
                      v-for="cFile in gitStore.selectedCommit?.files || []"
                      :key="cFile.path"
                      class="file-row git-file-row git-commit-file-row"
                      :class="{
                        active:
                          !gitStore.commitViewAllFilesDiff &&
                          gitStore.selectedCommitFile === cFile.path,
                      }"
                      :data-commit-file-path="cFile.path"
                    >
                      <button
                        type="button"
                        class="file-open"
                        @click="handleSelectCommitFile(cFile.path)"
                      >
                        <span class="status" :class="cFile.status">{{ cFile.status }}</span>
                        <span class="file-path git-file-path" :title="cFile.path">
                          {{ cFile.path }}
                        </span>
                        <span class="stat plus">+{{ cFile.additions }}</span>
                        <span class="stat minus">-{{ cFile.deletions }}</span>
                      </button>
                      <button
                        type="button"
                        class="git-repo-filter-btn git-track-file-btn"
                        :class="{ active: gitStore.historyFileFilter === cFile.path }"
                        :data-commit-track-file="cFile.path"
                        @click.stop="toggleTrackFileFromCommit(cFile.path)"
                      >
                        {{ gitStore.historyFileFilter === cFile.path ? 'Đang theo dõi' : 'Theo dõi tệp' }}
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Column Resizer 4: Commit Files <-> Commit Diff -->
                <div
                  id="git-resizer-history-files"
                  class="git-col-resizer"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Kéo để chỉnh độ rộng cột tệp trong commit"
                  title="Kéo để chỉnh độ rộng cột tệp trong commit"
                  @mousedown="startResize($event, 'historyFiles', 190, 560)"
                ></div>

                <!-- Commit File Diff Viewer -->
                <div id="git-commit-diff-pane" class="git-commit-diff-pane">
                  <button
                    id="git-history-mobile-back-files"
                    type="button"
                    class="git-sub-mobile-back"
                    aria-label="Quay lại danh sách tệp trong commit"
                    @click="historyMobileStep = 'files'"
                  >
                    <i class="ri-arrow-left-line" aria-hidden="true"></i> Tệp thay đổi trong commit
                  </button>
                  <div class="git-box-title">
                    <span>Diff trong commit</span>
                    <span id="git-commit-diff-filename" class="git-diff-filename">
                      {{ commitDiffTitle }}
                    </span>
                  </div>

                  <div id="git-commit-diff-body" class="diff-lines git-diff-pre">
                    <div
                      v-if="!gitStore.selectedCommit || gitStore.commitDiffLines.length === 0"
                      class="git-diff-empty"
                    >
                      {{
                        gitStore.loadingCommitDiff
                          ? 'Đang tải Diff của commit...'
                          : '// Chọn một tệp trong commit để xem chi tiết Diff'
                      }}
                    </div>
                    <div
                      v-for="(line, idx) in gitStore.commitDiffLines"
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
        </div>
      </div>
    </div>

    <div v-if="toast" class="git-toast" :class="toast.type">{{ toast.message }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  useGitStore,
  type GitChangedFile,
  type GitCommitItem,
} from '../stores/gitStore.js';
import { useServerStore } from '../stores/serverStore.js';
import { useProjectStore } from '../stores/projectStore.js';

const GIT_COL_STORAGE_KEY = 'hugremote_git_col_widths';

const gitStore = useGitStore();
const serverStore = useServerStore();
const projectStore = useProjectStore();
const gitViewRoot = ref<HTMLElement | null>(null);
const showBranches = ref(false);
const mobileDetailOpen = ref(false);
const detailMode = ref<'working' | 'history'>('working');
const workingMobileStep = ref<'files' | 'diff'>('files');
const historyMobileStep = ref<'commits' | 'files' | 'diff'>('commits');
const commitMessage = ref('');
const remoteAction = ref<'pull' | 'push' | null>(null);
const toast = ref<{ type: 'ok' | 'err'; message: string } | null>(null);

const colWidths = reactive({
  repos: 280,
  workingFiles: 360,
  historyCommits: 340,
  historyFiles: 290,
});

function loadSavedColWidths() {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(GIT_COL_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.repos === 'number') colWidths.repos = parsed.repos;
      if (typeof parsed.workingFiles === 'number') colWidths.workingFiles = parsed.workingFiles;
      if (typeof parsed.historyCommits === 'number') colWidths.historyCommits = parsed.historyCommits;
      if (typeof parsed.historyFiles === 'number') colWidths.historyFiles = parsed.historyFiles;
    }
  } catch {
    // Ignore storage read failure
  }
}

function saveColWidths() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(GIT_COL_STORAGE_KEY, JSON.stringify({ ...colWidths }));
  } catch {
    // Ignore storage write failure
  }
}

const gitColCssVars = computed(() => ({
  '--git-repos-col-width': `${colWidths.repos}px`,
  '--git-working-files-col-width': `${colWidths.workingFiles}px`,
  '--git-history-commits-col-width': `${colWidths.historyCommits}px`,
  '--git-history-files-col-width': `${colWidths.historyFiles}px`,
}));

function startResize(
  ev: MouseEvent,
  key: 'repos' | 'workingFiles' | 'historyCommits' | 'historyFiles',
  minPx: number,
  maxPx: number,
) {
  ev.preventDefault();
  const startX = ev.clientX;
  const initialWidth = colWidths[key];
  const targetEl = ev.currentTarget as HTMLElement | null;
  targetEl?.classList.add('is-dragging');

  const onMove = (moveEv: MouseEvent) => {
    const delta = moveEv.clientX - startX;
    colWidths[key] = Math.max(minPx, Math.min(maxPx, Math.round(initialWidth + delta)));
  };

  const onUp = () => {
    targetEl?.classList.remove('is-dragging');
    saveColWidths();
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

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

const commitDiffTitle = computed(() => {
  const c = gitStore.selectedCommit;
  if (!c) return 'Chưa chọn commit';
  if (gitStore.commitViewAllFilesDiff) {
    return `Tất cả ${c.files.length} tệp @ ${c.shortHash}`;
  }
  return gitStore.selectedCommitFile
    ? `${gitStore.selectedCommitFile} @ ${c.shortHash}`
    : `Commit ${c.shortHash}`;
});

function sumCommitAdditions(commit: GitCommitItem): number {
  return (commit.files || []).reduce((sum, f) => sum + (f.additions || 0), 0);
}

function sumCommitDeletions(commit: GitCommitItem): number {
  return (commit.files || []).reduce((sum, f) => sum + (f.deletions || 0), 0);
}

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
  await Promise.all([gitStore.fetchStatus(), gitStore.fetchBranches(), gitStore.fetchCommits()]);
  await autoLoadFirstDiffIfNeeded();
}

async function refreshRepos() {
  await gitStore.fetchRepos();
  await Promise.all([gitStore.fetchStatus(), gitStore.fetchCommits()]);
  await autoLoadFirstDiffIfNeeded();
}

async function openRepo(relPath: string) {
  showBranches.value = false;
  workingMobileStep.value = 'files';
  historyMobileStep.value = 'commits';
  await gitStore.selectRepo(relPath);
  await autoLoadFirstDiffIfNeeded();
  mobileDetailOpen.value = true;
}

function backToRepos() {
  showBranches.value = false;
  mobileDetailOpen.value = false;
}

function switchDetailMode(mode: 'working' | 'history') {
  detailMode.value = mode;
  workingMobileStep.value = 'files';
  historyMobileStep.value = 'commits';
  if (mode === 'history' && gitStore.commits.length === 0) {
    gitStore.fetchCommits();
  }
}

async function openWorkingFileDiff(filePath: string) {
  workingMobileStep.value = 'diff';
  await gitStore.fetchDiff(filePath);
}

async function trackFileInHistory(filePath: string) {
  detailMode.value = 'history';
  historyMobileStep.value = 'commits';
  await gitStore.setHistoryFileFilter(filePath);
  showToast('ok', `Đang lọc lịch sử commit của tệp ${filePath}`);
}

async function handleSelectCommit(hash: string) {
  historyMobileStep.value = 'files';
  await gitStore.selectCommit(hash);
}

async function handleSelectCommitFile(filePath: string) {
  historyMobileStep.value = 'diff';
  await gitStore.selectCommitFile(filePath);
}

async function handleToggleCommitAllDiff() {
  await gitStore.toggleCommitAllFilesDiff();
  if (gitStore.commitViewAllFilesDiff) {
    historyMobileStep.value = 'diff';
  }
}

async function toggleTrackFileFromCommit(filePath: string) {
  const next = gitStore.historyFileFilter === filePath ? '' : filePath;
  historyMobileStep.value = 'commits';
  await gitStore.setHistoryFileFilter(next);
  showToast('ok', next ? `Đang lọc các commit thay đổi tệp ${next}` : `Đã bỏ lọc theo tệp ${filePath}`);
}

async function clearTrackedFileFilter() {
  historyMobileStep.value = 'commits';
  await gitStore.setHistoryFileFilter('');
}

async function onHistoryFileSelectChange(ev: Event) {
  const val = (ev.target as HTMLSelectElement | null)?.value || '';
  historyMobileStep.value = 'commits';
  await gitStore.setHistoryFileFilter(val);
}

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
function onHistorySearchInput() {
  historyMobileStep.value = 'commits';
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    gitStore.fetchCommits();
  }, 180);
}

function copySelectedCommitSha() {
  const sha = gitStore.selectedCommit?.hash || gitStore.selectedCommit?.shortHash;
  if (!sha) return;
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(sha).catch(() => {});
  }
  showToast('ok', `Đã sao chép mã commit ${sha.slice(0, 7)}`);
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

onMounted(() => {
  loadSavedColWidths();
  refresh();
});
watch(() => [serverStore.currentServerId, projectStore.currentProject?.id], () => {
  mobileDetailOpen.value = false;
  workingMobileStep.value = 'files';
  historyMobileStep.value = 'commits';
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
  height: 26px;
  padding: 0 9px;
  border-radius: 5px;
  border: 1px solid #3a3a3a;
  background: #262626;
  color: #b5b5b5;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
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
  grid-template-columns: var(--git-repos-col-width, 280px) 8px minmax(0, 1fr);
  gap: 0;
  overflow: hidden;
}

.git-col-resizer {
  width: 100%;
  height: 100%;
  min-width: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: col-resize;
  position: relative;
  touch-action: none;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  user-select: none;
}

.git-col-resizer::before {
  content: '';
  width: 2px;
  height: 36px;
  border-radius: 2px;
  background: #383838;
  transition: background 0.15s, height 0.15s;
}

.git-col-resizer:hover::before,
.git-col-resizer.is-dragging::before {
  background: #8a8a8a;
  height: 54px;
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

.git-mobile-back,
.git-sub-mobile-back {
  display: none;
  align-self: flex-start;
  align-items: center;
  gap: 6px;
  min-height: 34px;
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

.git-detail-mode-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 11px;
  border-radius: 8px;
  background: #1b1b1b;
  border: 1px solid #303030;
  flex-shrink: 0;
}

.git-detail-mode-tabs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.git-detail-mode-hint {
  font-size: 11px;
  color: #9e9e9e;
  font-family: monospace;
}

.git-detail-split {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: var(--git-working-files-col-width, 360px) 8px minmax(0, 1fr);
  gap: 0;
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

.git-box-title-actions {
  display: flex;
  align-items: center;
  gap: 6px;
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

.git-track-file-btn {
  height: 22px;
  padding: 0 7px;
  font-size: 10px;
  flex-shrink: 0;
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

/* Git Commit History Styles */
.git-history-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #181818;
  border: 1px solid #303030;
  border-radius: 8px;
  padding: 10px 12px;
  overflow: hidden;
}

.git-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2b2b2b;
  flex-shrink: 0;
}

.git-history-title-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 700;
  color: #ececec;
}

.git-history-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
  justify-content: flex-end;
  min-width: 240px;
}

.git-history-select {
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid #424242;
  background: #222222;
  color: #ececec;
  font-family: monospace;
  font-size: 11.5px;
}

.git-history-search {
  min-width: 190px;
  max-width: 280px;
  flex: 1;
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid #424242;
  background: #141414;
  color: #ececec;
  font-size: 11.5px;
}

.git-history-tracked-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #262626;
  border: 1px solid #525252;
  color: #e8e8e8;
  font-family: monospace;
  font-size: 10.5px;
}

.git-history-tracked-pill button {
  border: 0;
  background: transparent;
  color: #cccccc;
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
}

.git-history-split {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: var(--git-history-commits-col-width, 340px) 8px minmax(0, 1fr);
  gap: 0;
  overflow: hidden;
}

.git-history-commits-box,
.git-history-detail-box {
  background: #202020;
  border: 1px solid #333333;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.git-history-commit-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.git-commit-item {
  display: flex;
  align-items: stretch;
  gap: 10px;
  width: 100%;
  padding: 9px 11px;
  border: 0;
  border-bottom: 1px solid #292929;
  background: transparent;
  color: #e5e5e5;
  text-align: left;
  cursor: pointer;
}

.git-commit-item:hover {
  background: #262626;
}

.git-commit-item.active {
  background: #2b2b2b;
  box-shadow: inset 2px 0 #b5b5b5;
}

.git-commit-timeline {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 14px;
  flex-shrink: 0;
  padding-top: 3px;
}

.git-commit-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #787878;
  border: 2px solid #2b2b2b;
  flex-shrink: 0;
}

.git-commit-item.active .git-commit-dot {
  background: #f0f0f0;
  border-color: #8a8a8a;
}

.git-commit-line {
  flex: 1;
  width: 1px;
  background: #333333;
  margin-top: 4px;
}

.git-commit-item:last-child .git-commit-line {
  display: none;
}

.git-commit-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.git-commit-top {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.git-commit-sha {
  font-family: monospace;
  font-weight: 700;
  font-size: 11px;
  color: #ececec;
  background: #262626;
  border: 1px solid #3f3f3f;
  border-radius: 4px;
  padding: 1px 6px;
}

.git-commit-ref {
  font-family: monospace;
  font-size: 10px;
  color: #d4d4d4;
  background: #2b2b2b;
  border: 1px solid #484848;
  border-radius: 999px;
  padding: 1px 7px;
}

.git-commit-date {
  margin-left: auto;
  font-family: monospace;
  font-size: 10.5px;
  color: #9e9e9e;
}

.git-commit-subject {
  font-size: 12px;
  font-weight: 600;
  color: #f0f0f0;
  line-height: 1.35;
  word-break: break-word;
}

.git-commit-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  font-family: monospace;
  font-size: 11px;
  color: #9e9e9e;
}

.git-commit-detail-banner {
  padding: 9px 12px;
  border-bottom: 1px solid #2e2e2e;
  background: #1b1b1b;
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex-shrink: 0;
}

.git-commit-detail-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.git-commit-detail-subject {
  font-size: 12.5px;
  font-weight: 700;
  color: #f0f0f0;
  line-height: 1.35;
}

.git-commit-detail-sub {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-family: monospace;
  font-size: 11px;
  color: #a3a3a3;
}

.git-commit-inspector-split {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: var(--git-history-files-col-width, 290px) 6px minmax(0, 1fr);
  overflow: hidden;
}

.git-commit-files-pane {
  border-right: 1px solid #2e2e2e;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.git-commit-files-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.git-commit-diff-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
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

  .git-col-resizer {
    display: none !important;
  }

  .git-view:not(.mobile-detail-open) .git-repo-detail {
    display: none;
  }

  .git-view.mobile-detail-open .git-multi-repo-bar {
    display: none;
  }

  .git-mobile-back,
  .git-sub-mobile-back {
    display: inline-flex;
  }

  .git-banner-mobile-back {
    margin-bottom: 4px;
  }

  .git-detail-split {
    grid-template-columns: 1fr;
    overflow: visible;
  }

  /* Working Tree Mobile List -> Detail drill-down */
  #git-working-tree-section[data-mobile-step="files"] .git-diff-box {
    display: none;
  }

  #git-working-tree-section[data-mobile-step="diff"] .git-files-box {
    display: none;
  }

  #git-working-tree-section[data-mobile-step="diff"] .git-diff-box {
    display: flex;
    min-height: 360px;
  }

  /* Commit History Mobile 3-Step List -> Detail drill-down */
  .git-history-split {
    display: block;
    overflow: visible;
  }

  .git-history-controls {
    justify-content: stretch;
    min-width: 100%;
  }

  .git-history-search {
    max-width: none;
    width: 100%;
  }

  .git-commit-inspector-split {
    display: block;
    overflow: visible;
  }

  .git-commit-files-pane {
    border-right: 0;
  }

  #git-history-section[data-mobile-step="commits"] .git-history-detail-box {
    display: none;
  }

  #git-history-section[data-mobile-step="files"] .git-history-head,
  #git-history-section[data-mobile-step="files"] .git-history-commits-box,
  #git-history-section[data-mobile-step="files"] .git-commit-diff-pane {
    display: none;
  }

  #git-history-section[data-mobile-step="diff"] .git-history-head,
  #git-history-section[data-mobile-step="diff"] .git-history-commits-box,
  #git-history-section[data-mobile-step="diff"] .git-commit-detail-banner,
  #git-history-section[data-mobile-step="diff"] .git-commit-files-pane {
    display: none;
  }
}
</style>
