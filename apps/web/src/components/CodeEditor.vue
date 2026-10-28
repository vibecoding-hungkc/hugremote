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

    <div v-if="fileStore.saveNotice" class="save-toast">
      <i class="ri-check-line"></i> {{ fileStore.saveNotice }}
    </div>

    <!-- Quick Programming Accessory Keybar -->
    <div v-if="fileStore.fileMode === 'code' || !isMarkdown" class="editor-keybar" @pointerdown.prevent>
      <div class="keybar-row">
        <div class="keybar-scroll">
          <button type="button" class="key-pill" title="Undo" aria-label="Undo" @click="runEditorCommand(undo)">Undo</button>
          <button type="button" class="key-pill" title="Move cursor left" aria-label="Move cursor left" @click="runEditorCommand(cursorCharLeft)">←</button>
          <button type="button" class="key-pill" title="Move cursor right" aria-label="Move cursor right" @click="runEditorCommand(cursorCharRight)">→</button>
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
        <button type="button" class="key-pill" title="Toggle snippets" aria-label="Toggle snippets" :aria-expanded="snippetsExpanded" aria-controls="editor-snippets" @click="snippetsExpanded = !snippetsExpanded">Snippets</button>
      </div>
      <div v-if="snippetsExpanded" id="editor-snippets" class="keybar-scroll">
        <button v-for="snippet in extraSnippets" :key="snippet" type="button" class="key-pill" :title="`Insert ${snippet.trim()}`" :aria-label="`Insert ${snippet.trim()}`" @click="insertText(snippet)">{{ snippet.trim() }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { EditorView, lineNumbers, highlightActiveLineGutter, highlightSpecialChars } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, undo, cursorCharLeft, cursorCharRight } from '@codemirror/commands';
import type { Command } from '@codemirror/view';
import { keymap } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { marked, Renderer } from 'marked';
import { useFileStore } from '../stores/fileStore.js';

const fileStore = useFileStore();
const editorContainer = ref<HTMLDivElement | null>(null);
const snippetsExpanded = ref(false);
const extraSnippets = ['!==', '&&', '||', 'import ', 'export '];
let view: EditorView | null = null;

const isMarkdown = computed(() => {
  const name = fileStore.activeFile?.name?.toLowerCase() || '';
  return name.endsWith('.md') || name.endsWith('.markdown');
});

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeHref(value: string): string {
  const href = value.trim();
  if (/^(?:https?:|mailto:|tel:|\/|#)/i.test(href)) return escapeHtml(href);
  return '#';
}

const markdownRenderer = new Renderer();
markdownRenderer.html = ({ text }: { text: string }) => escapeHtml(text);
markdownRenderer.link = function ({ href, title, tokens }: { href: string; title?: string | null; tokens: any[] }) {
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<a href="${safeHref(href)}"${titleAttr}>${this.parser.parseInline(tokens)}</a>`;
};
markdownRenderer.image = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<img src="${safeHref(href)}" alt="${escapeHtml(text)}"${titleAttr}>`;
};

const renderedMarkdown = computed(() => {
  if (!fileStore.activeFile?.content) return '';
  const parsed = marked.parse(fileStore.activeFile.content, { renderer: markdownRenderer });
  return typeof parsed === 'string' ? parsed : '';
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

function runEditorCommand(command: Command) {
  if (!view) return;
  command(view);
  view.focus();
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

.save-toast {
  position: absolute;
  right: 12px;
  bottom: 48px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(34, 197, 94, .28);
  background: rgba(6, 78, 59, .94);
  color: #bbf7d0;
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 10px 28px rgba(0, 0, 0, .32);
}

.editor-keybar {
  background: #0f172a;
  border-top: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  flex-shrink: 0;
}

.keybar-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.keybar-row > .keybar-scroll {
  flex: 1;
  min-width: 0;
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
