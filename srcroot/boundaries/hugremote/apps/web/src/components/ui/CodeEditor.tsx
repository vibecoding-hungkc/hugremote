import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/lang-yaml';
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { highlightSelectionMatches, openSearchPanel, closeSearchPanel, search, searchKeymap, gotoLine } from '@codemirror/search';
import { Compartment, EditorState, RangeSetBuilder, StateEffect, StateField, type Extension } from '@codemirror/state';
import { drawSelection, EditorView, GutterMarker, gutter, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import i18n from '../../i18n';

/** Tô cú pháp theo token (cùng màu với prototype: từ khoá tím terminal, chuỗi xanh lá, chú thích chữ phụ). */
const hl = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword, tags.definitionKeyword, tags.operatorKeyword], color: 'var(--color-accent-terminal)' },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: 'var(--color-success)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--color-text-muted)', fontStyle: 'italic' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--color-warning)' },
  { tag: [tags.typeName, tags.className], color: 'var(--color-primary)' },
  { tag: tags.heading, fontWeight: '600', color: 'var(--color-primary)' },
  { tag: tags.link, color: 'var(--color-primary)', textDecoration: 'underline' },
]);

const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 'var(--text-sm)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.55', fontVariantLigatures: 'none' },
  '.cm-content': { caretColor: 'var(--color-text)', padding: 'var(--space-md) 0' },
  '.cm-gutters': { backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)', border: 'none' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 var(--space-md) 0 var(--space-sm)', minWidth: '44px' },
  // dòng đang đứng nằm TRÊN lớp bôi đen của CodeMirror → phải trong suốt một phần, không thì che mất vùng chọn;
  // vùng chọn dùng màu nhấn (trước trùng màu dòng đang đứng nên bôi rồi cũng không thấy — Authority 2026-11-26)
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--color-surface-raised) 60%, transparent)' },
  // nền dòng đang đứng vẫn che phần chọn trên chính dòng đó → đưa lớp bôi đen (35% alpha) lên trên chữ
  '.cm-selectionLayer': { zIndex: '0 !important', pointerEvents: 'none' },
  // !important: rule mặc định "&light.cm-focused > .cm-scroller > .cm-selectionLayer …" của CodeMirror nặng specificity hơn → tím nhạt #d7d4f0
  '.cm-selectionLayer .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--color-primary) 35%, transparent) !important',
  },
  '.cm-searchMatch': { backgroundColor: 'var(--color-warning)', color: 'var(--color-bg)', borderRadius: '2px' },
  '.cm-searchMatch-selected': { outline: '2px solid var(--color-primary)' },
  '.cm-panels': { backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderTop: '1px solid var(--color-divider)' },
  '.cm-panels-top': { borderBottom: '1px solid var(--color-divider)' },
  '.cm-panel input, .cm-panel button': { fontSize: 'var(--text-sm)' },
  '.cm-textfield': { backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', color: 'var(--color-text)', padding: 'var(--space-xs) var(--space-sm)' },
  '.cm-button': { backgroundImage: 'none', backgroundColor: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', color: 'var(--color-text)' },
  '.cm-change-add': { boxShadow: 'inset -3px 0 0 var(--color-success)', width: '3px' },
  '.cm-change-mod': { boxShadow: 'inset -3px 0 0 var(--color-primary)', width: '3px' },
});

function langFor(name: string): Extension {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['ts', 'tsx', 'mts', 'cts'].includes(ext)) return javascript({ typescript: true, jsx: ext.endsWith('x') });
  if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) return javascript({ jsx: ext.endsWith('x') });
  if (ext === 'json') return json();
  if (['md', 'markdown'].includes(ext)) return markdown();
  if (ext === 'py') return python();
  if (['html', 'htm', 'vue', 'svelte'].includes(ext)) return html();
  if (['css', 'scss', 'less'].includes(ext)) return css();
  if (['yml', 'yaml'].includes(ext)) return yaml();
  return [];
}

// ----- vạch dòng mới / đã sửa so với commit (AC-37) -----
class ChangeMarker extends GutterMarker {
  constructor(readonly kind: 'add' | 'mod') {
    super();
  }
  toDOM() {
    const el = document.createElement('div');
    el.className = `cm-change-${this.kind}`;
    el.title = i18n.t(this.kind === 'add' ? 'files.newMark' : 'files.modMark');
    el.style.height = '100%';
    return el;
  }
}
const setChanges = StateEffect.define<{ added: number[]; modified: number[] }>();
const changeField = StateField.define<{ added: Set<number>; modified: Set<number> }>({
  create: () => ({ added: new Set(), modified: new Set() }),
  update(v, tr) {
    for (const e of tr.effects) if (e.is(setChanges)) return { added: new Set(e.value.added), modified: new Set(e.value.modified) };
    return tr.docChanged ? { added: new Set(), modified: new Set() } : v;
  },
});
const changeGutter = gutter({
  class: 'cm-change-gutter',
  markers: (view) => {
    const b = new RangeSetBuilder<GutterMarker>();
    const { added, modified } = view.state.field(changeField);
    for (let i = 1; i <= view.state.doc.lines; i++) {
      if (added.has(i)) b.add(view.state.doc.line(i).from, view.state.doc.line(i).from, new ChangeMarker('add'));
      else if (modified.has(i)) b.add(view.state.doc.line(i).from, view.state.doc.line(i).from, new ChangeMarker('mod'));
    }
    return b.finish();
  },
});

export interface CodeEditorHandle {
  goto(line: number): void;
  openFind(): void;
  closeFind(): void;
  gotoPrompt(): void;
  insert(text: string): void;
  value(): string;
  focus(): void;
}

/** C17 — Editor (CodeMirror 6): tô màu cú pháp, ⌘F tìm/thay (C28), Ctrl+G tới dòng, vạch dòng đổi, xuống dòng bật/tắt. */
export const CodeEditor = forwardRef<CodeEditorHandle, { name: string; value: string; readOnly?: boolean; wrap?: boolean; changes?: { added: number[]; modified: number[] }; onChange?: (v: string) => void; onSave?: () => void; label?: string }>(
  function CodeEditor({ name, value, readOnly, wrap, changes, onChange, onSave, label }, ref) {
    const host = useRef<HTMLDivElement>(null);
    const view = useRef<EditorView | null>(null);
    const wrapC = useRef(new Compartment());
    const roC = useRef(new Compartment());
    const cb = useRef({ onChange, onSave });
    cb.current = { onChange, onSave };

    useEffect(() => {
      const v = new EditorView({
        parent: host.current!,
        state: EditorState.create({
          doc: value,
          extensions: [
            lineNumbers(),
            changeField,
            changeGutter,
            highlightActiveLineGutter(),
            highlightActiveLine(),
            drawSelection(),
            history(),
            indentOnInput(),
            bracketMatching(),
            highlightSelectionMatches(),
            search({ top: true }),
            syntaxHighlighting(hl),
            langFor(name),
            theme,
            wrapC.current.of(wrap ? EditorView.lineWrapping : []),
            roC.current.of(EditorState.readOnly.of(!!readOnly)),
            EditorView.contentAttributes.of({ 'aria-label': label ?? name, spellcheck: 'false', autocapitalize: 'off' }),
            keymap.of([
              { key: 'Mod-s', preventDefault: true, run: () => (cb.current.onSave?.(), true) },
              { key: 'Ctrl-g', preventDefault: true, run: gotoLine },
              ...searchKeymap,
              ...historyKeymap,
              ...defaultKeymap,
              indentWithTab,
            ]),
            EditorView.updateListener.of((u) => {
              if (u.docChanged) cb.current.onChange?.(u.state.doc.toString());
            }),
          ],
        }),
      });
      view.current = v;
      return () => v.destroy();
    }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

    // nội dung đổi từ ngoài (tải lại sau khi Claude sửa) → thay cả tài liệu, giữ con trỏ trong giới hạn
    useEffect(() => {
      const v = view.current;
      if (!v || v.state.doc.toString() === value) return;
      const pos = Math.min(v.state.selection.main.head, value.length);
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value }, selection: { anchor: pos } });
    }, [value]);
    useEffect(() => view.current?.dispatch({ effects: wrapC.current.reconfigure(wrap ? EditorView.lineWrapping : []) }), [wrap]);
    useEffect(() => view.current?.dispatch({ effects: roC.current.reconfigure(EditorState.readOnly.of(!!readOnly)) }), [readOnly]);
    useEffect(() => {
      if (changes) view.current?.dispatch({ effects: setChanges.of(changes) });
    }, [changes]);

    useImperativeHandle(ref, () => ({
      goto(line: number) {
        const v = view.current;
        if (!v) return;
        const l = v.state.doc.line(Math.max(1, Math.min(line, v.state.doc.lines)));
        v.dispatch({ selection: { anchor: l.from }, effects: EditorView.scrollIntoView(l.from, { y: 'center' }) });
        v.focus();
      },
      openFind: () => view.current && openSearchPanel(view.current),
      closeFind: () => view.current && closeSearchPanel(view.current),
      gotoPrompt: () => view.current && gotoLine(view.current),
      insert(text: string) {
        const v = view.current;
        if (!v) return;
        const { from, to } = v.state.selection.main;
        v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
        v.focus();
      },
      value: () => view.current?.state.doc.toString() ?? '',
      focus: () => view.current?.focus(),
    }));

    return <div ref={host} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }} />;
  },
);
