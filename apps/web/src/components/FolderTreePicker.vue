<template>
  <div v-if="isOpen" class="tree-modal-overlay" @click.self="$emit('close')">
    <div class="tree-modal-sheet">
      <div class="tree-modal-header">
        <div class="tree-modal-title">
          <i class="ri-folder-open-line"></i> {{ t('claudeModal.pickFolder') }}
        </div>
        <button class="btn-close" @click="$emit('close')">
          <i class="ri-close-line"></i>
        </button>
      </div>

      <div class="tree-current-path">
        <i class="ri-map-pin-line"></i>
        <span class="path-text">{{ selectedPath || rootNode.fullPath }}</span>
      </div>

      <div v-if="isNavigating" class="tree-nav-loading">
        <i class="ri-loader-4-line spin"></i> {{ t('folderTree.navigating') }}
      </div>

      <div class="tree-scroll-container" ref="scrollContainerRef">
        <FolderTreeNode
          :node="rootNode"
          :server-id="serverId"
          :server-type="serverType"
          :server-workspace="serverWorkspace"
          :selected-path="selectedPath"
          :depth="0"
          @select="handleSelect"
        />
      </div>

      <div class="tree-modal-footer">
        <button class="btn-cancel" @click="$emit('close')">{{ t('folderTree.cancel') }}</button>
        <button class="btn-confirm" @click="handleConfirm">
          <i class="ri-check-line"></i> {{ t('claudeModal.pickFolder') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import FolderTreeNode from './FolderTreeNode.vue';
import { apiUrl } from '../utils/api.js';
import { useI18n } from '../composables/useI18n.js';

const { t } = useI18n();

interface TreeNode {
  name: string;
  apiPath: string;
  fullPath: string;
  isDirectory: boolean;
  children: TreeNode[] | null;
  expanded: boolean;
  loading: boolean;
}

const props = defineProps<{
  isOpen: boolean;
  serverId: string;
  serverType: 'local' | 'ssh';
  serverWorkspace: string;
  initialPath?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', path: string): void;
  (e: 'selected', path: string): void;
}>();

function makeRootNode(): TreeNode {
  const ws = props.serverWorkspace || '~';
  const name = ws.replace(/\/+$/, '').split('/').filter(Boolean).pop() || ws;
  return {
    name,
    apiPath: '',
    fullPath: ws,
    isDirectory: true,
    children: null,
    expanded: true,
    loading: false,
  };
}

const rootNode = ref<TreeNode>(makeRootNode());
const selectedPath = ref(props.initialPath || props.serverWorkspace || '~');
const isNavigating = ref(false);
const scrollContainerRef = ref<HTMLDivElement | null>(null);

function handleSelect(path: string) {
  selectedPath.value = path;
}

function handleConfirm() {
  emit('confirm', selectedPath.value);
  emit('selected', selectedPath.value);
  emit('close');
}

function joinPath(base: string, rel: string): string {
  if (!rel) return base;
  const cleanBase = base.replace(/\/$/, '');
  return `${cleanBase}/${rel}`;
}

async function fetchDirEntries(apiPath: string): Promise<any[]> {
  try {
    const res = await fetch(
      apiUrl(`/api/fs?serverId=${encodeURIComponent(props.serverId || 'server-local')}&path=${encodeURIComponent(apiPath || '')}`)
    );
    if (!res.ok) {
      console.warn('Failed to fetch dir entries for path:', apiPath, res.status);
      return [];
    }
    const data = await res.json();
    return (data.entries || []).filter((e: any) => e.isDirectory);
  } catch (err) {
    console.warn('Error fetching dir entries for path:', apiPath, err);
    return [];
  }
}

function buildChildNode(entry: any): TreeNode {
  let childApiPath: string;
  let childFullPath: string;
  if (props.serverType === 'local') {
    childApiPath = entry.relPath;
    childFullPath = joinPath(props.serverWorkspace, entry.relPath);
  } else {
    childApiPath = entry.relPath;
    childFullPath = entry.relPath;
  }
  return {
    name: entry.name,
    apiPath: childApiPath,
    fullPath: childFullPath,
    isDirectory: true,
    children: null,
    expanded: false,
    loading: false,
  };
}

// Tự động mở rộng cây xuống đúng thư mục đã lưu trước đó (nếu có).
async function expandToSavedPath(targetPath: string) {
  const workspace = (props.serverWorkspace || '~').replace(/\/$/, '');
  const cleanTarget = (targetPath || '').replace(/\/$/, '');

  // Tải danh sách con cho root trước
  if (rootNode.value.children === null) {
    rootNode.value.loading = true;
    const entries = await fetchDirEntries(rootNode.value.apiPath);
    rootNode.value.children = entries.map(buildChildNode);
    rootNode.value.loading = false;
  }

  // Không có gì để mở rộng sâu nếu target trùng workspace hoặc rỗng
  if (!cleanTarget || cleanTarget === workspace) {
    return;
  }

  // Tính các đoạn thư mục còn lại giữa workspace và target
  let relativeRemainder = '';
  if (cleanTarget.startsWith(workspace + '/')) {
    relativeRemainder = cleanTarget.slice(workspace.length + 1);
  } else if (!cleanTarget.startsWith('/')) {
    // target đã là dạng tương đối
    relativeRemainder = cleanTarget;
  } else {
    // target nằm ngoài workspace (vd: root server khác)
    return;
  }

  const segments = relativeRemainder.split('/').filter(Boolean);

  let currentNode = rootNode.value;
  currentNode.expanded = true;

  for (const segment of segments) {
    if (currentNode.children === null) {
      currentNode.loading = true;
      const entries = await fetchDirEntries(currentNode.apiPath);
      currentNode.children = entries.map(buildChildNode);
      currentNode.loading = false;
    }

    const match = currentNode.children.find((c) => c.name === segment);
    if (!match) {
      break; // Thư mục đã lưu không còn tồn tại, dừng lại ở cấp gần nhất
    }
    match.expanded = true;
    currentNode = match;
  }

  // Tải luôn danh sách con của thư mục đích để hiển thị ngữ cảnh xung quanh
  if (currentNode.children === null) {
    currentNode.loading = true;
    const entries = await fetchDirEntries(currentNode.apiPath);
    currentNode.children = entries.map(buildChildNode);
    currentNode.loading = false;
  }
}

async function scrollToSelected() {
  await nextTick();
  const container = scrollContainerRef.value;
  if (!container) return;
  const selectedEl = container.querySelector('.tree-node-row.selected') as HTMLElement | null;
  if (selectedEl) {
    selectedEl.scrollIntoView({ block: 'center' });
  }
}

watch(
  () => [props.isOpen, props.serverWorkspace, props.serverId] as const,
  async ([open]) => {
    if (open) {
      rootNode.value = makeRootNode();
      selectedPath.value = props.initialPath || props.serverWorkspace || '~';

      isNavigating.value = true;
      try {
        await expandToSavedPath(selectedPath.value);
      } finally {
        isNavigating.value = false;
      }

      await scrollToSelected();
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.tree-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 2100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.tree-modal-sheet {
  background: #0f172a;
  border-top: 1px solid #334155;
  border-radius: 14px 14px 0 0;
  width: 100%;
  max-width: 600px;
  height: 72vh;
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  gap: 8px;
}

.tree-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.tree-modal-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #f1f5f9;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 20px;
  cursor: pointer;
}

.tree-current-path {
  display: flex;
  align-items: center;
  gap: 5px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 11.5px;
  font-family: monospace;
  color: #93c5fd;
  flex-shrink: 0;
}

.path-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-nav-loading {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #64748b;
  flex-shrink: 0;
  padding: 2px 2px;
}

.tree-scroll-container {
  flex: 1;
  min-height: 240px;
  max-height: 50vh;
  overflow-y: auto;
  background: #0b1120;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 6px 4px;
}

.tree-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

.btn-cancel {
  background: transparent;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #94a3b8;
  padding: 7px 14px;
  font-size: 12px;
  cursor: pointer;
}

.btn-confirm {
  background: #2563eb;
  border: none;
  border-radius: 6px;
  color: #fff;
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
