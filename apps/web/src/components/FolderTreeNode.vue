<template>
  <div class="tree-node">
    <div
      class="tree-node-row"
      :class="{ selected: node.fullPath === selectedPath, dir: node.isDirectory }"
      :style="{ paddingLeft: (depth * 16 + 6) + 'px' }"
      @click="$emit('select', node.fullPath)"
    >
      <button
        v-if="node.isDirectory"
        type="button"
        class="toggle-btn"
        @click.stop="toggleExpand"
      >
        <i :class="node.expanded ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'"></i>
      </button>
      <span v-else class="toggle-spacer"></span>

      <span class="node-label">
        <i :class="node.isDirectory ? 'ri-folder-fill folder-ic' : 'ri-file-line file-ic'"></i>
        <span class="node-name">{{ node.name }}</span>
      </span>

      <i
        v-if="node.fullPath === selectedPath"
        class="ri-check-line selected-check"
      ></i>
    </div>

    <div v-if="node.isDirectory && node.expanded" class="tree-children">
      <div v-if="node.loading" class="tree-loading" :style="{ paddingLeft: ((depth + 1) * 16 + 6) + 'px' }">
        <i class="ri-loader-4-line spin"></i> {{ t('folderTree.loading') }}
      </div>
      <div v-else-if="node.children && node.children.length === 0" class="tree-empty" :style="{ paddingLeft: ((depth + 1) * 16 + 6) + 'px' }">
        {{ t('fileList.empty') }}
      </div>
      <FolderTreeNode
        v-for="child in node.children"
        :key="child.fullPath"
        :node="child"
        :server-id="serverId"
        :server-type="serverType"
        :server-workspace="serverWorkspace"
        :selected-path="selectedPath"
        :depth="depth + 1"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { apiUrl } from '../utils/api.js';
import { useI18n } from '../composables/useI18n.js';

defineOptions({
  name: 'FolderTreeNode',
});

interface TreeNode {
  name: string;
  apiPath: string;
  fullPath: string;
  isDirectory: boolean;
  children: TreeNode[] | null;
  expanded: boolean;
  loading: boolean;
}

const { t } = useI18n();

const props = defineProps<{
  node: TreeNode;
  serverId: string;
  serverType: 'local' | 'ssh';
  serverWorkspace: string;
  selectedPath: string;
  depth: number;
}>();

const emit = defineEmits<{ (e: 'select', path: string): void }>();

function joinPath(base: string, rel: string): string {
  if (!rel) return base;
  const cleanBase = base.replace(/\/$/, '');
  return `${cleanBase}/${rel}`;
}

async function loadChildren() {
  if (props.node.children !== null || props.node.loading) return;

  props.node.loading = true;
  try {
    const res = await fetch(
      apiUrl(`/api/fs?serverId=${encodeURIComponent(props.serverId || 'server-local')}&path=${encodeURIComponent(props.node.apiPath || '')}`)
    );
    if (!res.ok) throw new Error('Failed to list directory');
    const data = await res.json();

    const dirEntries = (data.entries || []).filter((e: any) => e.isDirectory);

    props.node.children = dirEntries.map((e: any) => {
      let childApiPath: string;
      let childFullPath: string;
      if (props.serverType === 'local') {
        childApiPath = e.relPath;
        childFullPath = joinPath(props.serverWorkspace, e.relPath);
      } else {
        childApiPath = e.relPath;
        childFullPath = e.relPath;
      }
      return {
        name: e.name,
        apiPath: childApiPath,
        fullPath: childFullPath,
        isDirectory: true,
        children: null,
        expanded: false,
        loading: false,
      } as TreeNode;
    });
  } catch (err) {
    props.node.children = [];
  } finally {
    props.node.loading = false;
  }
}

async function toggleExpand() {
  if (!props.node.isDirectory) return;

  if (props.node.expanded) {
    props.node.expanded = false;
    return;
  }

  props.node.expanded = true;
  await loadChildren();
}

defineExpose({ loadChildren });

// If the node starts already expanded (e.g. the root node) and has no
// children loaded yet, load them immediately so expand/collapse works
// correctly the first time the user interacts with any node.
onMounted(() => {
  if (props.node.isDirectory && props.node.expanded && props.node.children === null) {
    loadChildren();
  }
});

watch(
  () => props.node.expanded,
  (expanded) => {
    if (expanded && props.node.children === null) {
      loadChildren();
    }
  }
);
</script>

<style scoped>
.tree-node {
  display: flex;
  flex-direction: column;
}

.tree-node-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 5px;
  padding-bottom: 5px;
  padding-right: 8px;
  cursor: pointer;
  border-radius: 4px;
}
.tree-node-row:hover {
  background: #1e293b;
}
.tree-node-row.selected {
  background: #1e3a8a33;
}

.toggle-btn {
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 14px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
}

.toggle-spacer {
  width: 18px;
  flex-shrink: 0;
}

.node-label {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
}

.folder-ic {
  color: #f59e0b;
  font-size: 14px;
  flex-shrink: 0;
}
.file-ic {
  color: #64748b;
  font-size: 14px;
  flex-shrink: 0;
}

.node-name {
  font-size: 12.5px;
  font-family: monospace;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.selected-check {
  color: #3b82f6;
  font-size: 14px;
  flex-shrink: 0;
}

.tree-children {
  display: flex;
  flex-direction: column;
}

.tree-loading, .tree-empty {
  font-size: 11px;
  color: #64748b;
  padding-top: 4px;
  padding-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
