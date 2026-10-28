import assert from 'node:assert/strict';
import { transformWithEsbuild } from 'vite';
import { readFile } from 'node:fs/promises';
import { parse, compileScript } from '@vue/compiler-sfc';
import { createRenderer, nextTick, reactive } from 'vue';
import { EditorState } from '@codemirror/state';
import { history } from '@codemirror/commands';
import { Direction, EditorView } from '@codemirror/view';

// Compile the actual SFC with its inline template. Only the DOM-bound view
// construction and unrelated file-store access are replaced in this harness.
const source = await readFile('apps/web/src/components/CodeEditor.vue', 'utf8');
const { descriptor } = parse(source);
let compiled = compileScript(descriptor, { id: 'editor-keys', inlineTemplate: true }).content
  .replace('let view: EditorView | null = null;', 'let view: EditorView | null = globalThis.__editorKeysView;')
  .replace(/import \{ useFileStore \} from ['"]\.\.\/stores\/fileStore\.js['"];?/, 'const useFileStore = () => globalThis.__editorKeysStore;')
  .replace(/new EditorView\(\{[\s\S]*?parent: editorContainer.value,?\s*\}\)/, 'globalThis.__editorKeysView');
compiled = compiled.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => `from ${quote}${import.meta.resolve(name)}${quote}`);
const { code } = await transformWithEsbuild(compiled, 'CodeEditor.ts', { loader: 'ts', format: 'esm' });
const { default: CodeEditor } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
let failures = 0;
{
  const node = (type, text = '') => ({ type, text, props: {}, style: {}, children: [], parent: null });
  const renderer = createRenderer({
    createElement: node, createText: text => node('#text', text), createComment: text => node('#comment', text),
    setText: (el, text) => { el.text = text; },
    setElementText: (el, text) => { el.text = text; el.children = []; },
    patchProp: (el, key, old, value) => { el.props[key] = value; },
    insert(el, parent, anchor = null) {
      if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1);
      el.parent = parent;
      const index = anchor ? parent.children.indexOf(anchor) : -1;
      parent.children.splice(index < 0 ? parent.children.length : index, 0, el);
    },
    remove(el) { el.parent?.children.splice(el.parent.children.indexOf(el), 1); },
    parentNode: el => el.parent,
    nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] || null,
  });
  const descendants = el => [el, ...el.children.flatMap(descendants)];
  async function test(name, run) {
    const store = reactive({ activeFile: null, fileMode: 'code', saveNotice: '' });
    globalThis.__editorKeysStore = store;
    const view = {
      state: EditorState.create({ doc: 'abc', selection: { anchor: 2 }, extensions: [history()] }),
      focusCalls: 0, bidiCache: [],
      focus() { this.focusCalls++; },
      destroy() {},
      textDirectionAt() { return Direction.LTR; },
      moveByChar: EditorView.prototype.moveByChar,
      bidiSpans: EditorView.prototype.bidiSpans,
    };
    view.dispatch = transaction => {
      view.state = transaction.state || view.state.update(transaction).state;
      view.bidiCache = [];
    };
    globalThis.__editorKeysView = view;
    const root = node('root');
    const app = renderer.createApp(CodeEditor);
    const instance = app.mount(root);
    const buttons = () => descendants(root).filter(el => el.type === 'button');
    const button = title => {
      const found = buttons().find(el => el.props.title === title);
      assert.ok(found, `missing accessible titled control: ${title}`);
      assert.equal(found.props['aria-label'], title);
      return found;
    };
    const click = el => el.props.onClick({});
    try { await run({ view, root, instance, store, buttons, button, click, nextTick }); console.log('PASS', name); }
    catch (error) { failures++; console.error('FAIL', name, error.stack); }
    finally { app.unmount(); delete globalThis.__editorKeysView; }
  }

  await test('Undo restores the real CodeMirror history without losing pointer focus', ({ view, button, click }) => {
    view.dispatch({ changes: { from: 2, insert: '!' } });
    assert.equal(view.state.doc.toString(), 'ab!c');
    const undo = button('Undo');
    let prevented = false;
    for (let el = undo; el; el = el.parent) {
      el.props.onPointerdown?.({ preventDefault() { prevented = true; } });
    }
    assert.equal(prevented, true, 'pointerdown must not move focus out of the editor');
    click(undo);
    assert.equal(view.state.doc.toString(), 'abc');
    assert.equal(view.focusCalls, 1);
  });
  await test('Left and right use CodeMirror character movement and collapse selections', ({ view, button, click }) => {
    click(button('Move cursor left'));
    assert.equal(view.state.selection.main.head, 1);
    click(button('Move cursor right'));
    assert.equal(view.state.selection.main.head, 2);
    view.dispatch({ selection: { anchor: 0, head: 3 } });
    click(button('Move cursor left'));
    assert.equal(view.state.selection.main.head, 0);
    assert.equal(view.state.selection.main.empty, true);
    click(button('Move cursor left'));
    assert.equal(view.state.selection.main.head, 0, 'start boundary');
    view.dispatch({ selection: { anchor: 0, head: 3 } });
    click(button('Move cursor right'));
    assert.equal(view.state.selection.main.head, 3);
    click(button('Move cursor right'));
    assert.equal(view.state.selection.main.head, 3, 'end boundary');
    view.dispatch({ changes: { from: 0, to: 3, insert: 'a😀b' }, selection: { anchor: 3 } });
    click(button('Move cursor left'));
    assert.equal(view.state.selection.main.head, 1, 'must not split a surrogate pair');
    click(button('Move cursor right'));
    assert.equal(view.state.selection.main.head, 3);
    assert.equal(view.state.doc.toString(), 'a😀b');
  });
  await test('Expandable snippets insert operators and import/export at the current selection', async ({ view, root, buttons, button, click, nextTick }) => {
    const toggle = button('Toggle snippets');
    assert.equal(toggle.props['aria-expanded'], false);
    assert.equal(buttons().some(el => el.props.title === 'Insert !=='), false);
    click(toggle);
    await nextTick();
    assert.equal(toggle.props['aria-expanded'], true);
    assert.ok(descendants(root).some(el => el.props.id === toggle.props['aria-controls']));
    for (const snippet of ['!==', '&&', '||', 'import ', 'export ']) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'abc' }, selection: { anchor: 1, head: 2 } });
      const key = button(`Insert ${snippet.trim()}`);
      let prevented = false;
      for (let el = key; el; el = el.parent) el.props.onPointerdown?.({ preventDefault() { prevented = true; } });
      assert.equal(prevented, true);
      click(key);
      assert.equal(view.state.doc.toString(), `a${snippet}c`);
      assert.equal(view.state.selection.main.head, 1 + snippet.length);
    }
    click(toggle);
    await nextTick();
    assert.equal(toggle.props['aria-expanded'], false);
    assert.equal(buttons().some(el => el.props.title === 'Insert !=='), false);
  });
  await test('Markdown preview keeps rendering, sanitizes hostile HTML and hides editing controls', async ({ view, root, store, buttons, nextTick }) => {
    store.activeFile = {
      relPath: 'readme.md',
      name: 'readme.md',
      content: '[Docs](https://example.com)\n<img src="x" onerror="alert(1)">\n<script>alert(2)</script>\n[Bad](javascript:alert(3))',
      originalContent: '',
      isDirty: false
    };
    store.fileMode = 'preview';
    await nextTick();
    const preview = descendants(root).find(el => el.props.class === 'markdown-preview-box');
    assert.ok(preview);
    assert.match(preview.props.innerHTML, /href="https:\/\/example.com"/);
    assert.doesNotMatch(preview.props.innerHTML, /<img[^>]+onerror/i);
    assert.doesNotMatch(preview.props.innerHTML, /<script/i);
    assert.doesNotMatch(preview.props.innerHTML, /href="javascript:/i);
    assert.equal(buttons().length, 0, 'preview must not expose commands for the hidden editor');
    assert.equal(descendants(root).find(el => el.props.class === 'cm-wrapper').style.display, 'none');
    let opened, prevented = false;
    globalThis.window = { open: (...args) => { opened = args; } };
    try {
      preview.props.onClick({ target: { closest: () => ({ href: 'https://example.com/' }) }, preventDefault() { prevented = true; } });
      assert.equal(prevented, true);
      assert.deepEqual(opened, ['https://example.com/', '_blank', 'noopener,noreferrer']);
    } finally { delete globalThis.window; }
    assert.equal(view.state.doc.toString(), 'abc');
    store.fileMode = 'code';
    await nextTick();
    assert.ok(buttons().some(el => el.props.title === 'Undo'));
    store.fileMode = 'preview';
    store.activeFile.name = 'code.js';
    await nextTick();
    assert.ok(buttons().some(el => el.props.title === 'Undo'), 'non-Markdown files remain editable');
  });
}
process.exitCode = failures ? 1 : 0;
