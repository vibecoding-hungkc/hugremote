<template>
  <div class="code-editor-container">
    <!-- View 1: Markdown Preview Mode -->
    <div
      v-if="fileStore.fileMode === 'preview' && isMarkdown"
      class="markdown-preview-box"
      v-html="renderedMarkdown"
      @click="handlePreviewClick"
    ></div>

    <!-- View 2: CodeMirror 6 Editor -->
    <div v-show="fileStore.fileMode === 'code' || !isMarkdown" class="cm-wrapper" ref="editorContainer"></div>

    <!-- Quick Programming Accessory Keybar -->
    <div class="editor-keybar">
      <div class="keybar-scroll">
        <button class="key-pill" @click="insertText('\t')">Tab</button>
        <button class="key-pill" @click="insertText('{')">{</button>
        <button class="key-pill" @click="insertText('}')">}</button>
        <button class="key-pill" @click="insertText('(')">(</button>
        <button class="key-pill" @click="insertText(')')">)</button>
        <button class="key-pill" @click="insertText('[')">[</button>
        <button class="key-pill" @click="insertText(']')">]</button>
        <button class="key-pill" @click="insertText('=>')">=&gt;</button>
        <button class="key-pill" @click="insertText('===')">===</button>
        <button class="key-pill" @click="insertText('const ')">const</button>
        <button class="key-pill" @click="insertText('function ')">fn</button>
        <button class="key-pill" @click="insertText('return ')">ret</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { EditorView, lineNumbers, highlightActiveLineGutter, highlightSpecialChars } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { keymap } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { marked } from 'marked';
import { useFileStore } from '../stores/fileStore.js';

const fileStore = useFileStore();
const editorContainer = ref<HTMLDivElement | null>(null);
let view: EditorView | null = null;

const isMarkdown = computed(() => {
  const name = fileStore.activeFile?.name?.toLowerCase() || '';
  return name.endsWith('.md') || name.endsWith('.markdown');
});

const renderedMarkdown = computed(() => {
  if (!fileStore.activeFile?.content) return '';
  return marked.parse(fileStore.activeFile.content);
});

function handlePreviewClick(e: MouseEvent) {
  const target = (e.target as HTMLElement)?.closest('a');
  if (target && target.href) {
    e.preventDefault();
    window.open(target.href, '_blank', 'noopener,noreferrer');
  }
}

function getLanguageExtension(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.js') || lower.endsWith('.ts')) return javascript();
  if (lower.endsWith('.json')) return json();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return markdown();
  if (lower.endsWith('.py')) return python();
  if (lower.endsWith('.html') || lower.endsWith('.vue')) return html();
  return [];
}

function initEditor() {
  if (!editorContainer.value || !fileStore.activeFile) return;

  if (view) {
    view.destroy();
  }

  const state = EditorState.create({
    doc: fileStore.activeFile.content,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      oneDark,
      EditorView.lineWrapping,
      getLanguageExtension(fileStore.activeFile.name),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && fileStore.activeFile) {
          fileStore.activeFile.content = update.state.doc.toString();
          fileStore.activeFile.isDirty =
            fileStore.activeFile.content !== fileStore.activeFile.originalContent;
        }
      }),
    ],
  });

  view = new EditorView({
    state,
    parent: editorContainer.value,
  });
}

function insertText(text: string) {
  if (!view) return;
  const state = view.state;
  const range = state.selection.main;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: text },
    selection: { anchor: range.from + text.length },
  });
  view.focus();
}

watch(
  () => fileStore.activeFile?.relPath,
  () => {
    initEditor();
  }
);

onMounted(() => {
  initEditor();
});

onBeforeUnmount(() => {
  if (view) view.destroy();
});
</script>

<style scoped>
.code-editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #090d16;
}

.cm-wrapper {
  flex: 1;
  overflow: hidden;
  font-size: 13.5px;
  font-family: monospace;
}

:deep(.cm-editor) {
  height: 100%;
  background: #0a0f1d !important;
}

:deep(.cm-scroller) {
  overflow: auto;
  font-family: monospace;
}

:deep(.cm-gutters) {
  background: #0e162b !important;
  border-right: 1px solid #1e293b !important;
  color: #64748b !important;
}

.markdown-preview-box {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  background: #0b1120;
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.6;
  font-size: 14px;
}

:deep(.markdown-preview-box h1) {
  font-size: 22px;
  border-bottom: 1px solid #1e293b;
  padding-bottom: 8px;
  margin-top: 16px;
  margin-bottom: 12px;
  color: #60a5fa;
}

:deep(.markdown-preview-box h2) {
  font-size: 18px;
  margin-top: 16px;
  margin-bottom: 10px;
  color: #93c5fd;
}

:deep(.markdown-preview-box pre) {
  background: #050811;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  font-family: monospace;
  font-size: 12.5px;
}

:deep(.markdown-preview-box code) {
  background: #1e293b;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12.5px;
}

:deep(.markdown-preview-box a) {
  color: #38bdf8;
  text-decoration: none;
}

.editor-keybar {
  height: 38px;
  background: #0f172a;
  border-top: 1px solid #1e293b;
  display: flex;
  align-items: center;
  padding: 0 6px;
  flex-shrink: 0;
}

.keybar-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  white-space: nowrap;
}

.key-pill {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 5px;
  color: #cbd5e1;
  font-family: monospace;
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
  flex-shrink: 0;
}
.key-pill:active {
  background: #334155;
  color: #fff;
}
</style>
