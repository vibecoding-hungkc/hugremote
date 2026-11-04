import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parse, compileScript } from '@vue/compiler-sfc';
import { transform } from 'esbuild';

// Execute the actual ClaudeView event handlers with a tiny reactive harness.
// This catches the race where Enter confirms a Vietnamese IME word while Vue's
// v-model still holds the previous value and compositionend restores the draft.
const source = fs.readFileSync(path.join(process.cwd(), 'apps/web/src/components/ClaudeView.vue'), 'utf8');
const { descriptor, errors } = parse(source);
assert.deepEqual(errors, []);
assert.match(descriptor.template.content, /@compositionstart="onComposerCompositionStart"/);
assert.match(descriptor.template.content, /@compositionend="onComposerCompositionEnd"/);
const script = compileScript(descriptor, { id: 'claude-ime-regression' }).content;
const start = script.indexOf('function handleKeyDown(e: KeyboardEvent) {');
const end = script.indexOf('\nasync function handleStop()', start);
assert.ok(start >= 0 && end > start);
const startSend = script.indexOf('async function handleSend() {');
const endSend = script.indexOf('\nfunction onModelChange(', startSend);
assert.ok(startSend >= 0 && endSend > startSend);
const startComposition = script.indexOf('function onComposerCompositionStart() {');
const endComposition = script.indexOf('\nfunction handleKeyDown(', startComposition);
assert.ok(startComposition >= 0 && endComposition > startComposition);
const handlers = script.slice(startComposition, endComposition) + '\n' + script.slice(start, end) + '\n' + script.slice(startSend, endSend);
const { code } = await transform(handlers, { loader: 'ts', format: 'cjs' });

const sent = [];
const inputText = { value: 'trạng thái Hoàn tiền một phần có phải là trạng thái chính thức của đơn hàng' };
const textarea = { value: inputText.value, style: { height: '90px' } };
const globals = {
  inputText, inputRef: { value: textarea },
  claudeStore: { isGenerating: false, sendMessage: async text => { sent.push(text); } },
  isSlashMenuOpen: { value: false }, isSlashMenuDismissed: { value: false },
  isModelPopupOpen: { value: false }, isContextPickerOpen: { value: false },
  scrollToBottom() {},
};
const setup = new Function(...Object.keys(globals), `${code}\nreturn { handleKeyDown, onComposerCompositionStart, onComposerCompositionEnd };`);
const handlersUnderTest = setup(...Object.values(globals));
function keydown(options = {}) {
  let prevented = false;
  handlersUnderTest.handleKeyDown({ key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false,
    preventDefault: () => { prevented = true; }, ...options });
  return prevented;
}

handlersUnderTest.onComposerCompositionStart();
assert.equal(keydown({ isComposing: true, keyCode: 229 }), false, 'IME Enter should confirm text, not send');
await new Promise(resolve => setTimeout(resolve, 0));
assert.deepEqual(sent, [], 'IME confirmation must not send incomplete question');
assert.equal(inputText.value, textarea.value, 'draft must remain during composition');
textarea.value += ' không';
handlersUnderTest.onComposerCompositionEnd({ target: textarea });
assert.equal(inputText.value, textarea.value, 'compositionend must synchronize final text');
assert.equal(keydown(), true, 'subsequent Enter should send');
await new Promise(resolve => setTimeout(resolve, 0));
assert.deepEqual(sent, ['trạng thái Hoàn tiền một phần có phải là trạng thái chính thức của đơn hàng không']);
assert.equal(inputText.value, '', 'draft should clear after send');
console.log('Claude composer IME confirmation and clear regression passed.');
