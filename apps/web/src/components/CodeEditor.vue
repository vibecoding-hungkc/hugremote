<template>
  <div class="code-editor-container">
    <!-- View 1a: Markdown Preview Mode -->
    <div
      v-if="fileStore.fileMode === 'preview' && isMarkdown"
      class="markdown-preview-box"
      v-html="renderedMarkdown"
      @click="handlePreviewClick"
    ></div>

    <!-- View 1b: HTML Preview Mode -->
    <iframe
      v-else-if="fileStore.fileMode === 'preview' && isHtml"
      class="html-preview-box"
      sandbox="allow-scripts"
      :srcdoc="fileStore.activeFile?.content || ''"
      :title="fileStore.activeFile?.name || 'HTML Preview'"
    ></iframe>

    <!-- Read-only source preview: no editor focus or virtual keyboard until Edit is chosen. -->
    <div v-else-if="fileStore.fileMode === 'preview'" class="code-preview-box" role="region" aria-label="Xem trước mã nguồn">
      <div v-for="(line, index) in previewLines" :key="index" class="code-preview-line">
        <span class="code-preview-number" aria-hidden="true">{{ index + 1 }}</span>
        <span class="code-preview-text">{{ line || ' ' }}</span>
      </div>
    </div>

    <!-- View 2: CodeMirror 6 Editor -->
    <div v-show="fileStore.fileMode === 'code'" class="cm-wrapper" ref="editorContainer"></div>

    <div v-if="fileStore.saveNotice" class="save-toast">
      <i class="ri-check-line"></i> {{ fileStore.saveNotice }}
    </div>

    <!-- Quick Programming Accessory Keybar (Hidden on Desktop devices) -->
    <div v-if="!isDesktopDevice && fileStore.fileMode === 'code'" class="editor-keybar" @pointerdown.prevent>
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
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue';
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
import { useDesktopDevice } from '../utils/device.js';

const fileStore = useFileStore();
const editorContainer = ref<HTMLDivElement | null>(null);
const snippetsExpanded = ref(false);
const extraSnippets = ['!==', '&&', '||', 'import ', 'export '];
let view: EditorView | null = null;

const isMarkdown = computed(() => {
  const name = fileStore.activeFile?.name?.toLowerCase() || '';
  return name.endsWith('.md') || name.endsWith('.markdown');
});

const isHtml = computed(() => {
  const name = fileStore.activeFile?.name?.toLowerCase() || '';
  return name.endsWith('.html') || name.endsWith('.htm');
});

const previewLines = computed(() => (fileStore.activeFile?.content || '').split('\n'));
const { isDesktopDevice } = useDesktopDevice();

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
  const parsed = marked.parse(fileStore.activeFile.content, {
    gfm: true,
    breaks: true,
    renderer: markdownRenderer,
  });
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

let lastEditorPasteAt = 0;

function handleEditorPaste(e: ClipboardEvent) {
  const text = e?.clipboardData?.getData('text/plain') || '';
  if (text) {
    lastEditorPasteAt = Date.now();
  }
}

function handleEditorKeyDown(e: KeyboardEvent) {
  const key = (e.key || '').toLowerCase();
  const hasCtrlOrMeta = e.ctrlKey || e.metaKey;
  if (hasCtrlOrMeta && !e.altKey && key === 's') {
    e.preventDefault();
    void fileStore.saveActiveFile();
    return;
  }
  if (hasCtrlOrMeta && !e.altKey && key === 'c' && e.ctrlKey && !e.metaKey) {
    const cmSel = view ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to) : '';
    const domSel = typeof window !== 'undefined' ? window.getSelection()?.toString() || '' : '';
    const sel = cmSel || domSel;
    if (sel && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(sel).catch(() => {});
    }
    return;
  }
  if (hasCtrlOrMeta && !e.altKey && key === 'v' && fileStore.fileMode === 'code') {
    const beforePasteAt = lastEditorPasteAt;
    setTimeout(async () => {
      if (lastEditorPasteAt === beforePasteAt && typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        try {
          const text = await navigator.clipboard.readText();
          if (text) insertText(text);
        } catch (_) {}
      }
    }, 35);
  }
}

watch(
  () => fileStore.activeFile?.relPath,
  () => {
    initEditor();
  }
);

watch(
  () => fileStore.fileMode,
  (mode) => {
    if (mode === 'code') {
      nextTick(() => {
        if (!view) initEditor();
        if (view && typeof (view as any).requestMeasure === 'function') {
          view.requestMeasure();
        }
        if (view && typeof (view as any).focus === 'function') {
          view.focus();
        }
      });
    }
  }
);

onMounted(() => {
  initEditor();
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('keydown', handleEditorKeyDown);
    window.addEventListener('paste', handleEditorPaste, true);
  }
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
    window.removeEventListener('keydown', handleEditorKeyDown);
    window.removeEventListener('paste', handleEditorPaste, true);
  }
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
  background: #161616;
}

.code-preview-box {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #161616;
  color: #e7e7e7;
  font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre;
  padding: 12px 0;
  user-select: text;
}
.code-preview-line { display: flex; min-width: max-content; }
.code-preview-number {
  display: inline-block;
  position: sticky;
  left: 0;
  flex: none;
  width: 48px;
  padding: 0 12px 0 4px;
  box-sizing: border-box;
  text-align: right;
  color: #989898;
  background: #161616;
  border-right: 1px solid #323232;
  user-select: none;
}
.code-preview-text { padding: 0 16px; }

.html-preview-box {
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
  border: none;
  background: #ffffff;
  display: block;
}

.cm-wrapper {
  flex: 1;
  overflow: hidden;
  font-size: 13.5px;
  font-family: monospace;
}

:deep(.cm-editor) {
  height: 100%;
  background: #161616 !important;
}

:deep(.cm-scroller) {
  overflow: auto;
  font-family: monospace;
}

:deep(.cm-gutters) {
  background: #161616 !important;
  border-right: 1px solid #323232 !important;
  color: #989898 !important;
}

.markdown-preview-box {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  background: #161616;
  color: #e7e7e7;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.6;
  font-size: 14px;
}

:deep(.markdown-preview-box h1) {
  font-size: 22px;
  border-bottom: 1px solid #323232;
  padding-bottom: 8px;
  margin-top: 16px;
  margin-bottom: 12px;
  color: #9c9c9c;
}

:deep(.markdown-preview-box h2) {
  font-size: 18px;
  margin-top: 16px;
  margin-bottom: 10px;
  color: #bebebe;
}

:deep(.markdown-preview-box pre) {
  background: #161616;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  font-family: monospace;
  font-size: 12.5px;
}

:deep(.markdown-preview-box code) {
  background: #282828;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12.5px;
}

:deep(.markdown-preview-box a) {
  color: #a5a5a5;
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
  border: 1px solid rgba(125, 125, 125, .28);
  background: rgba(61, 61, 61, .94);
  color: #e7e7e7;
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 10px 28px rgba(0, 0, 0, .32);
}

.editor-keybar {
  background: #171717;
  border-top: 1px solid #323232;
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
  background: #282828;
  border: 1px solid #3f3f3f;
  border-radius: 5px;
  color: #d4d4d4;
  font-family: monospace;
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
  flex-shrink: 0;
}
.key-pill:active {
  background: #3f3f3f;
  color: #fff;
}
</style>
