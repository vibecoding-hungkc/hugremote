import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';

// RED test: import future normalizer and assembler
// When these files do not exist yet or are empty, the test suite will fail (RED)
let ClaudeEventNormalizer: any;
let ClaudeRunAssembler: any;

try {
  const modNormalizer = await import('../apps/api/src/services/claude/eventNormalizer.js');
  ClaudeEventNormalizer = modNormalizer.ClaudeEventNormalizer;
  const modAssembler = await import('../apps/api/src/services/claude/runAssembler.js');
  ClaudeRunAssembler = modAssembler.ClaudeRunAssembler;
} catch (e: any) {
  // Expected in RED phase
}

const root = resolve('.');
const manifestPath = resolve(root, 'analysis/claude-protocol/fixtures/2.1.308/manifest.json');

test('T2.1 & T2.2: Normalizer exists and implements schemaVersion 1 with full corpus coverage (AC5)', async () => {
  assert.ok(ClaudeEventNormalizer, 'ClaudeEventNormalizer must be implemented');

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const normalizer = new ClaudeEventNormalizer({ sessionId: 'test-session', runId: 'run-1' });

  let totalFrames = 0;
  let normalizedEvents = 0;

  for (const fixtureMeta of manifest.fixtures) {
    const fixturePath = resolve(root, 'analysis/claude-protocol/fixtures/2.1.308', fixtureMeta.file);
    const lines = (await readFile(fixturePath, 'utf8')).split('\n').filter(Boolean);

    for (const line of lines) {
      const record = JSON.parse(line);
      if (record.kind === 'frame') {
        totalFrames++;
        const events = normalizer.normalizeFrame(record.data);
        assert.ok(Array.isArray(events), 'normalizeFrame must return an array of events');
        assert.ok(events.length > 0, 'No frame can be silently dropped; must produce normalized or diagnostic event');
        for (const ev of events) {
          assert.equal(ev.schemaVersion, 1, 'schemaVersion must be 1');
          assert.ok(typeof ev.type === 'string' && ev.type.length > 0);
          normalizedEvents++;
        }
      }
    }
  }

  assert.ok(totalFrames > 100, 'Must process over 100 corpus frames');
  assert.ok(normalizedEvents >= totalFrames, 'Normalized event count must meet or exceed total frames');
});

test('T2.3: Canonical Run Assembler reconstructs root and child state with snapshot deduplication (AC9 & AC10)', async () => {
  assert.ok(ClaudeRunAssembler, 'ClaudeRunAssembler must be implemented');

  const assembler = new ClaudeRunAssembler();

  // 1. Text streaming followed by identical snapshot -> no duplicated text
  assembler.applyNormalizedEvent({
    schemaVersion: 1,
    type: 'message.started',
    sessionId: 'session-1',
    runId: 'run-1',
    messageId: 'msg-1',
    parentToolUseId: null
  });
  assembler.applyNormalizedEvent({
    schemaVersion: 1,
    type: 'content.block_started',
    sessionId: 'session-1',
    runId: 'run-1',
    messageId: 'msg-1',
    parentToolUseId: null,
    blockIndex: 0,
    blockType: 'text'
  });
  assembler.applyNormalizedEvent({
    schemaVersion: 1,
    type: 'content.block_delta',
    sessionId: 'session-1',
    runId: 'run-1',
    messageId: 'msg-1',
    parentToolUseId: null,
    blockIndex: 0,
    deltaType: 'text_delta',
    text: 'Hello world'
  });
  assembler.applyNormalizedEvent({
    schemaVersion: 1,
    type: 'message.snapshot',
    sessionId: 'session-1',
    runId: 'run-1',
    messageId: 'msg-1',
    parentToolUseId: null,
    content: [{ type: 'text', text: 'Hello world' }]
  });

  const state = assembler.getSnapshot();
  assert.equal(state.rootMessages.length, 1);
  assert.equal(state.rootMessages[0].text, 'Hello world');

  // 2. Child agent namespace isolation
  assembler.applyNormalizedEvent({
    schemaVersion: 1,
    type: 'message.started',
    sessionId: 'session-1',
    runId: 'run-1',
    messageId: 'child-msg-1',
    parentToolUseId: 'parent-tool-xyz'
  });
  assembler.applyNormalizedEvent({
    schemaVersion: 1,
    type: 'content.block_started',
    sessionId: 'session-1',
    runId: 'run-1',
    messageId: 'child-msg-1',
    parentToolUseId: 'parent-tool-xyz',
    blockIndex: 0,
    blockType: 'text'
  });
  assembler.applyNormalizedEvent({
    schemaVersion: 1,
    type: 'content.block_delta',
    sessionId: 'session-1',
    runId: 'run-1',
    messageId: 'child-msg-1',
    parentToolUseId: 'parent-tool-xyz',
    blockIndex: 0,
    deltaType: 'text_delta',
    text: 'Child output'
  });

  const stateWithChild = assembler.getSnapshot();
  assert.equal(stateWithChild.rootMessages[0].text, 'Hello world', 'Root message must not be contaminated by child');
  assert.equal(stateWithChild.childAgents.length, 1, 'Child agent must be isolated in childAgents');
  assert.equal(stateWithChild.childAgents[0].parentToolUseId, 'parent-tool-xyz');
  assert.equal(stateWithChild.childAgents[0].messages[0].text, 'Child output');
});

test('T2.4: Unknown native events produce bounded diagnostics without throwing or leaking raw values (AC5)', () => {
  assert.ok(ClaudeEventNormalizer, 'ClaudeEventNormalizer must be implemented');
  const normalizer = new ClaudeEventNormalizer({ sessionId: 'session-x', runId: 'run-x' });

  const unknownFrame = {
    type: 'some_future_unrecognized_native_frame',
    data: { custom: 123, secretValue: 'must-not-leak' }
  };

  const events = normalizer.normalizeFrame(unknownFrame);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'diagnostic.unsupported_native_event');
  assert.equal(events[0].nativeFrameType, 'some_future_unrecognized_native_frame');
  assert.ok(events[0].preview.length <= 120);
  assert.doesNotMatch(events[0].preview, /must-not-leak/);
});

test('T2.2: Interleaved root and child native frames retain independent message identities', () => {
  const normalizer = new ClaudeEventNormalizer({ sessionId: 'session-i', runId: 'run-i' });
  const normalize = (frame: any) => normalizer.normalizeFrame(frame)[0];

  normalize({ type: 'stream_event', parent_tool_use_id: null, event: { type: 'message_start', message: { id: 'root-message' } } });
  normalize({ type: 'stream_event', parent_tool_use_id: 'parent-tool', event: { type: 'message_start', message: { id: 'child-message' } } });
  normalize({ type: 'stream_event', parent_tool_use_id: null, event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } });
  normalize({ type: 'stream_event', parent_tool_use_id: 'parent-tool', event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } });
  const rootDelta = normalize({ type: 'stream_event', parent_tool_use_id: null, event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'root' } } });
  const childDelta = normalize({ type: 'stream_event', parent_tool_use_id: 'parent-tool', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'child' } } });

  assert.equal(rootDelta.messageId, 'root-message');
  assert.equal(childDelta.messageId, 'child-message');
});

test('T2.3: Assembler rejects stale sequence and foreign session/run without state mutation', () => {
  const assembler = new ClaudeRunAssembler();
  const initial = {
    schemaVersion: 1,
    type: 'message.started',
    sessionId: 'session-a',
    runId: 'run-a',
    sequence: 2,
    messageId: 'message-a',
    parentToolUseId: null
  };
  assert.equal(assembler.applyNormalizedEvent(initial), true);
  const before = assembler.getSnapshot();

  assert.equal(assembler.applyNormalizedEvent({ ...initial, sequence: 1, messageId: 'stale' }), false);
  assert.equal(assembler.applyNormalizedEvent({ ...initial, sequence: 3, sessionId: 'session-b', messageId: 'foreign-session' }), false);
  assert.equal(assembler.applyNormalizedEvent({ ...initial, sequence: 3, runId: 'run-b', messageId: 'foreign-run' }), false);
  assert.deepEqual(assembler.getSnapshot(), before);
});

test('T2.3: Snapshot reconciliation uses UUID first and type-safe fallback', () => {
  const assembler = new ClaudeRunAssembler();
  const base = { schemaVersion: 1, sessionId: 'session-s', runId: 'run-s', parentToolUseId: null };
  assembler.applyNormalizedEvent({ ...base, type: 'message.started', messageId: 'same-id' });
  assembler.applyNormalizedEvent({ ...base, type: 'content.block_started', messageId: 'same-id', blockIndex: 0, blockType: 'text' });
  assembler.applyNormalizedEvent({ ...base, type: 'content.block_delta', messageId: 'same-id', blockIndex: 0, deltaType: 'text_delta', text: 'streamed text' });
  assembler.applyNormalizedEvent({ ...base, type: 'message.snapshot', messageId: 'same-id', uuid: 'thinking-snapshot', content: [{ type: 'thinking', thinking: 'separate reasoning' }] });

  let state = assembler.getSnapshot();
  assert.equal(state.rootMessages.length, 2, 'type-mismatched snapshot must not overwrite a streamed text row');
  assert.equal(state.rootMessages[0].text, 'streamed text');
  assert.equal(state.rootMessages[1].thinking, 'separate reasoning');

  assembler.applyNormalizedEvent({ ...base, type: 'message.snapshot', messageId: 'different-id', uuid: 'thinking-snapshot', content: [{ type: 'thinking', thinking: 'updated reasoning' }] });
  state = assembler.getSnapshot();
  assert.equal(state.rootMessages.length, 2, 'UUID reconciliation must replace instead of append');
  assert.equal(state.rootMessages[1].thinking, 'updated reasoning');
});

test('T2.4: Diagnostic retention is bounded and snapshots are defensive copies', () => {
  const assembler = new ClaudeRunAssembler();
  for (let index = 0; index < 150; index++) {
    assembler.applyNormalizedEvent({
      schemaVersion: 1,
      type: 'diagnostic.unsupported_native_event',
      sessionId: 'session-d',
      runId: 'run-d',
      nativeFrameType: `unknown-${index}`,
      preview: 'keys:data,type'
    });
  }
  const snapshot = assembler.getSnapshot();
  assert.equal(snapshot.diagnostics.length, 100);
  snapshot.diagnostics.length = 0;
  assert.equal(assembler.getSnapshot().diagnostics.length, 100, 'external mutation must not alter assembler state');
});

test('T2.2: Normalizer rejects foreign native scope, unwraps semantic envelopes and propagates sequence', () => {
  const normalizer = new ClaudeEventNormalizer({
    sessionId: 'app-session',
    runId: 'app-run',
    nativeSessionId: 'session-owned',
    nativeRunId: 'run-owned'
  });
  const foreignSession = normalizer.normalizeFrame({
    type: 'assistant', session_id: 'session-foreign', message: { id: 'm', content: [{ type: 'text', text: 'foreign' }] }
  });
  assert.equal(foreignSession[0].type, 'diagnostic.unsupported_native_event');
  assert.equal(foreignSession[0].nativeFrameType, 'scope_mismatch');

  const foreignRun = normalizer.normalizeFrame({
    type: 'assistant', session_id: 'session-owned', run_id: 'run-foreign', message: { id: 'm', content: [] }
  });
  assert.equal(foreignRun[0].type, 'diagnostic.unsupported_native_event');
  assert.equal(foreignRun[0].nativeFrameType, 'scope_mismatch');

  const enveloped = normalizer.normalizeFrame({
    transport_event: 'semantic-envelope',
    sequence: 10,
    frame: { type: 'assistant', session_id: 'session-owned', run_id: 'run-owned', message: { id: 'm', content: [{ type: 'text', text: 'canonical' }] } }
  });
  assert.equal(enveloped[0].type, 'message.snapshot');
  assert.equal(enveloped[0].sequence, 10);
});

test('T2.2: Malformed native schemas are diagnostics and diagnostic fields are bounded', () => {
  const normalizer = new ClaudeEventNormalizer({ sessionId: 'session-v', runId: 'run-v' });
  const longType = `unknown-${'x'.repeat(500)}`;
  const longDiagnostic = normalizer.normalizeFrame({ type: longType, secret: 'must-not-leak' })[0];
  assert.equal(longDiagnostic.type, 'diagnostic.unsupported_native_event');
  assert.ok(longDiagnostic.nativeFrameType.length <= 80);
  assert.ok(longDiagnostic.preview.length <= 120);
  assert.doesNotMatch(JSON.stringify(longDiagnostic), /must-not-leak/);

  const badSystem = normalizer.normalizeFrame({ type: 'system', subtype: { invalid: true } });
  assert.equal(badSystem[0].type, 'diagnostic.unsupported_native_event');
  assert.equal(badSystem[0].nativeFrameType, 'invalid_schema.system');

  const badDelta = normalizer.normalizeFrame({
    type: 'stream_event',
    event: { type: 'message_start', message: { id: 'm' } }
  });
  assert.equal(badDelta[0].type, 'message.started');
  const wrongDelta = normalizer.normalizeFrame({
    type: 'stream_event',
    event: { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } }
  });
  assert.equal(wrongDelta[0].type, 'content.block_started');
  const incompatible = normalizer.normalizeFrame({
    type: 'stream_event',
    event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'wrong block' } }
  });
  assert.equal(incompatible[0].type, 'diagnostic.unsupported_native_event');
  assert.equal(incompatible[0].nativeFrameType, 'invalid_delta_block_type');
});

test('T2.3: Unsupported events cannot poison sequence before acceptance', () => {
  const assembler = new ClaudeRunAssembler();
  const unsupported = assembler.applyNormalizedEvent({
    schemaVersion: 1, type: 'run.started', sessionId: 'session-p', runId: 'run-p', sequence: 100
  });
  assert.equal(unsupported, false);
  assert.equal(assembler.getSnapshot().lastSequence, undefined);
  assert.equal(assembler.applyNormalizedEvent({
    schemaVersion: 1, type: 'message.started', sessionId: 'session-p', runId: 'run-p', sequence: 2, messageId: 'valid'
  }), true);
  assert.equal(assembler.getSnapshot().lastSequence, 2);
});

test('T2.3: Diagnostics and rejected initial events cannot poison sequence or lock scope', () => {
  const assembler = new ClaudeRunAssembler();
  assert.equal(assembler.applyNormalizedEvent({
    schemaVersion: 1,
    type: 'diagnostic.unsupported_native_event',
    sessionId: 'diagnostic-session',
    runId: 'diagnostic-run',
    sequence: 100,
    nativeFrameType: 'future',
    preview: 'keys:type'
  }), true);
  assert.equal(assembler.getSnapshot().lastSequence, undefined);
  assert.equal(assembler.applyNormalizedEvent({
    schemaVersion: 1,
    type: 'message.started',
    sessionId: 'session-real',
    runId: 'run-real',
    sequence: 2,
    messageId: 'valid'
  }), true);

  const rejectedFirst = new ClaudeRunAssembler();
  assert.equal(rejectedFirst.applyNormalizedEvent({
    schemaVersion: 1,
    type: 'run.started',
    sessionId: 'poison-session',
    runId: 'poison-run'
  }), false);
  assert.equal(rejectedFirst.applyNormalizedEvent({
    schemaVersion: 1,
    type: 'message.started',
    sessionId: 'real-session',
    runId: 'real-run',
    messageId: 'first-valid'
  }), true);
  assert.equal(rejectedFirst.getSnapshot().sessionId, 'real-session');
});

test('T2.3: Multiple normalized events in one sequence apply once and replay is rejected', () => {
  const normalizer = new ClaudeEventNormalizer({ sessionId: 'session-m', runId: 'run-m' });
  const assembler = new ClaudeRunAssembler();
  const base = { schemaVersion: 1, sessionId: 'session-m', runId: 'run-m' };
  assembler.applyNormalizedEvent({ ...base, type: 'message.snapshot', messageId: 'tools', content: [
    { type: 'tool_use', id: 'tool-1', name: 'One', input: {} },
    { type: 'tool_use', id: 'tool-2', name: 'Two', input: {} }
  ] });
  const frame = {
    transport_event: 'semantic-envelope',
    sequence: 7,
    frame: { type: 'user', message: { content: [
      { type: 'tool_result', tool_use_id: 'tool-1', content: 'one' },
      { type: 'tool_result', tool_use_id: 'tool-2', content: 'two' }
    ] } }
  };
  const events = normalizer.normalizeFrame(frame);
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event: any) => assembler.applyNormalizedEvent(event)), [true, true]);
  assert.deepEqual(events.map((event: any) => assembler.applyNormalizedEvent(event)), [false, false]);
  const blocks = assembler.getSnapshot().rootMessages[0].blocks;
  assert.equal(blocks[0].toolResult?.content, 'one');
  assert.equal(blocks[1].toolResult?.content, 'two');
});

test('T2.2: Redacted thinking delta semantics and malformed content match fail-closed oracle behavior', () => {
  const normalizer = new ClaudeEventNormalizer({ sessionId: 'session-r', runId: 'run-r' });
  const assembler = new ClaudeRunAssembler();
  for (const frame of [
    { type: 'stream_event', event: { type: 'message_start', message: { id: 'redacted' } } },
    { type: 'stream_event', event: { type: 'content_block_start', index: 0, content_block: { type: 'redacted_thinking' } } },
    { type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'must-not-store' } } }
  ]) {
    for (const event of normalizer.normalizeFrame(frame)) assembler.applyNormalizedEvent(event);
  }
  assert.equal(assembler.getSnapshot().rootMessages[0].blocks[0].thinking, undefined);
  const signature = normalizer.normalizeFrame({
    type: 'stream_event',
    event: { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'opaque' } }
  });
  assert.equal(signature[0].type, 'diagnostic.unsupported_native_event');
  assert.equal(signature[0].nativeFrameType, 'invalid_delta_block_type');

  for (const malformed of [
    { type: 'assistant', message: { id: 'bad', content: { type: 'text', text: 'x' } } },
    { type: 'user', message: { content: { type: 'tool_result', tool_use_id: 'x' } } }
  ]) {
    assert.doesNotThrow(() => normalizer.normalizeFrame(malformed));
    assert.equal(normalizer.normalizeFrame(malformed)[0].type, 'diagnostic.unsupported_native_event');
  }
});

test('T2.2: Native session and run ownership bind once and cannot be switched', () => {
  const normalizer = new ClaudeEventNormalizer({ sessionId: 'app', runId: 'app-run' });
  normalizer.bindNativeSession('native-session-1');
  normalizer.bindNativeSession('native-session-2');
  assert.equal(normalizer.normalizeFrame({
    type: 'assistant', session_id: 'native-session-2', message: { id: 'm', content: [] }
  })[0].nativeFrameType, 'scope_mismatch');

  assert.equal(normalizer.normalizeFrame({
    type: 'assistant', session_id: 'native-session-1', run_id: 'native-run-1', message: { id: 'm1', content: [] }
  })[0].type, 'message.snapshot');
  assert.equal(normalizer.normalizeFrame({
    type: 'assistant', session_id: 'native-session-1', run_id: 'native-run-2', message: { id: 'm2', content: [] }
  })[0].nativeFrameType, 'scope_mismatch');
});

test('T2.3: Tool result resolves by globally newest message and forward block order', () => {
  const assembler = new ClaudeRunAssembler();
  const base = { schemaVersion: 1, sessionId: 'session-t', runId: 'run-t' };
  assembler.applyNormalizedEvent({ ...base, type: 'message.snapshot', sequence: 1, messageId: 'child-old', parentToolUseId: 'parent', content: [
    { type: 'tool_use', id: 'duplicate-id', name: 'ChildOld', input: {} }
  ] });
  assembler.applyNormalizedEvent({ ...base, type: 'message.snapshot', sequence: 2, messageId: 'root-new', parentToolUseId: null, content: [
    { type: 'tool_use', id: 'duplicate-id', name: 'RootFirst', input: {} },
    { type: 'tool_use', id: 'duplicate-id', name: 'RootSecond', input: {} }
  ] });
  assert.equal(assembler.applyNormalizedEvent({
    ...base, type: 'tool.completed', sequence: 3, toolUseId: 'duplicate-id', output: 'newest-result'
  }), true);
  const snapshot = assembler.getSnapshot();
  assert.equal(snapshot.rootMessages[0].blocks[0].toolResult?.content, 'newest-result');
  assert.equal(snapshot.rootMessages[0].blocks[1].toolResult, undefined);
  assert.equal(snapshot.childAgents[0].messages[0].blocks[0].toolResult, undefined);
});
