import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { OfficialReducerOracle } = require('./claude_oracle_engine.cjs');
const { ClaudeEventNormalizer } = await import('../apps/api/src/services/claude/eventNormalizer.js');
const { ClaudeRunAssembler } = await import('../apps/api/src/services/claude/runAssembler.js');

const root = resolve('.');
const manifestPath = resolve(root, 'analysis/claude-protocol/fixtures/2.1.308/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

await test('official oracle processes all 43 fixtures and preserves expected semantic states', async () => {
  for (const fixtureMeta of manifest.fixtures) {
    const fixturePath = resolve(root, 'analysis/claude-protocol/fixtures/2.1.308', fixtureMeta.file);
    const lines = (await readFile(fixturePath, 'utf8')).split('\n').filter(Boolean);
    const oracle = new OfficialReducerOracle();

    for (const line of lines) {
      const record = JSON.parse(line);
      if (record.kind === 'frame') {
        oracle.processMessage(record.data);
      }
    }

    const state = oracle.getCanonicalState();
    assert.ok(state, `${fixtureMeta.id}: state must be defined`);

    // Verify root vs child namespace separation
    if (fixtureMeta.category === 'agents') {
      const childMessages = state.messages.filter(m => m.parentToolUseId !== null);
      assert.ok(childMessages.length > 0, `${fixtureMeta.id}: child messages must exist in child namespace`);
      const rootMessages = state.messages.filter(m => m.parentToolUseId === null);
      assert.ok(rootMessages.length > 0, `${fixtureMeta.id}: root messages must exist in root namespace`);
    }

    // Verify interaction capture
    if (fixtureMeta.category === 'interactions') {
      assert.ok(state.interactions.length > 0, `${fixtureMeta.id}: interactions must be captured`);
    }

    // Verify system event capture
    if (fixtureMeta.category === 'system') {
      assert.ok(oracle.systemEvents.length > 0, `${fixtureMeta.id}: system events must be captured`);
    }
  }
});

function canonicalMessages(messages, official) {
  const groups = new Map();
  for (const message of messages) {
    const namespace = message.parentToolUseId ?? message.namespace ?? null;
    const messageId = message.betaMessageId ?? message.messageId;
    const groupKey = `${namespace ?? 'root'}\u0000${messageId}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = { namespace, messageId, blocks: new Map() };
      groups.set(groupKey, group);
    }

    const typeCounts = new Map();
    const blocks = official ? message.blocks : message.blocks.filter(Boolean);
    for (const wrapper of blocks) {
      const block = official ? wrapper : (wrapper.content ?? wrapper);
      const typeCount = typeCounts.get(block.type) ?? 0;
      typeCounts.set(block.type, typeCount + 1);
      const toolId = block.tool_id ?? block.id ?? null;
      const blockKey = toolId ? `${block.type}:${toolId}` : `${block.type}:${typeCount}`;
      const toolResult = official ? wrapper.toolResult : block.toolResult;
      const toolResultValue = toolResult?.value ?? toolResult;
      group.blocks.set(blockKey, {
        type: block.type,
        text: block.text ?? null,
        thinking: block.thinking ?? null,
        toolId,
        toolName: block.tool_name ?? block.name ?? null,
        input: block.input ?? null,
        result: toolResultValue?.content ?? null,
        isError: Boolean(toolResultValue?.isError),
        partial: Boolean(official ? wrapper.partial : block.isPartial)
      });
    }
  }

  return [...groups.values()]
    .map(group => ({
      namespace: group.namespace,
      messageId: group.messageId,
      blocks: [...group.blocks.values()]
    }))
    .sort((left, right) =>
      JSON.stringify(left.namespace ?? '').localeCompare(JSON.stringify(right.namespace ?? '')) ||
      left.messageId.localeCompare(right.messageId)
    );
}

await test('M2 normalizer and assembler match the official canonical message model across all 43 fixtures', async () => {
  assert.equal(manifest.fixtures.length, 43, 'fixture count is an independent coverage root');
  let frameCount = 0;

  for (const fixtureMeta of manifest.fixtures) {
    const fixturePath = resolve(root, 'analysis/claude-protocol/fixtures/2.1.308', fixtureMeta.file);
    const lines = (await readFile(fixturePath, 'utf8')).split('\n').filter(Boolean);
    const oracle = new OfficialReducerOracle();
    const normalizer = new ClaudeEventNormalizer({ sessionId: 'differential-session', runId: 'differential-run' });
    const assembler = new ClaudeRunAssembler();
    let lastAcceptedSequence;

    for (const line of lines) {
      const record = JSON.parse(line);
      if (record.kind !== 'frame') continue;
      frameCount += 1;
      const nativeFrame = record.data;
      const officialFrame = nativeFrame.transport_event === 'semantic-envelope'
        ? nativeFrame.frame
        : nativeFrame;
      oracle.processMessage(officialFrame);
      const events = normalizer.normalizeFrame(nativeFrame);
      assert.ok(events.length > 0, `${fixtureMeta.id}: every frame must be classified`);
      for (const event of events) {
        const staleOrDuplicate = event.sequence !== undefined &&
          lastAcceptedSequence !== undefined &&
          event.sequence <= lastAcceptedSequence;
        const accepted = assembler.applyNormalizedEvent(event);
        assert.equal(
          accepted,
          !staleOrDuplicate,
          `${fixtureMeta.id}: ${event.type} acceptance must match sequence freshness`
        );
        if (accepted && event.sequence !== undefined) lastAcceptedSequence = event.sequence;
      }
    }

    const officialMessages = canonicalMessages(oracle.getCanonicalState().messages, true);
    const m2State = assembler.getSnapshot();
    const m2Messages = canonicalMessages([
      ...m2State.rootMessages.map(message => ({ ...message, namespace: null })),
      ...m2State.childAgents.flatMap(agent =>
        agent.messages.map(message => ({ ...message, namespace: agent.parentToolUseId }))
      )
    ], false);
    assert.deepEqual(m2Messages, officialMessages, `${fixtureMeta.id}: canonical messages differ`);
  }

  assert.equal(frameCount, 134, 'all corpus frames must pass through both implementations');
});

await test('oracle enforces strict schema and rejects invalid frame mutations', () => {
  // Mutation 1: text delta on thinking block must throw
  const oracle = new OfficialReducerOracle();
  oracle.processMessage({
    type: 'stream_event',
    event: { type: 'message_start', message: { id: 'm1' } }
  });
  oracle.processMessage({
    type: 'stream_event',
    event: { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } }
  });
  assert.throws(() => {
    oracle.processMessage({
      type: 'stream_event',
      event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'illegal' } }
    });
  }, /expected block of type text/);

  // Mutation 2: input_json_delta on text block must throw
  const oracle2 = new OfficialReducerOracle();
  oracle2.processMessage({
    type: 'stream_event',
    event: { type: 'message_start', message: { id: 'm2' } }
  });
  oracle2.processMessage({
    type: 'stream_event',
    event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }
  });
  assert.throws(() => {
    oracle2.processMessage({
      type: 'stream_event',
      event: { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{}' } }
    });
  }, /expected block of type tool_use/);
});

await test('differential evaluation against HugRemote v1.5.3 baseline proves non-tautological gap detection', async () => {
  // Import HugRemote ClaudeService
  const { ClaudeService } = await import('../apps/api/src/services/claudeService.js');
  const service = new ClaudeService();

  // Test 1: Child agent namespace gap (v1.5.3 drops parent_tool_use_id != null)
  const agentFixture = manifest.fixtures.find(f => f.id === 'm1-agent-001');
  assert.ok(agentFixture);
  const agentLines = (await readFile(resolve(root, 'analysis/claude-protocol/fixtures/2.1.308', agentFixture.file), 'utf8'))
    .split('\n').filter(Boolean);

  let hugEvents = [];
  const session = { id: 'test-session', cwd: root, serverId: 'server-local', messages: [], model: 'Default', mode: 'Auto' };

  // Feed through a mock spawn harness like test_claude_streaming.ts
  const child = new (await import('node:events')).EventEmitter();
  child.stdin = new (await import('node:stream')).PassThrough();
  child.stdout = new (await import('node:stream')).PassThrough();
  child.stderr = new (await import('node:stream')).PassThrough();
  child.kill = () => {};
  service.spawnLocalClaude = () => child;

  const resultPromise = service.streamClaudePrompt(session, 'test', e => hugEvents.push(e));
  for (const line of agentLines) {
    const rec = JSON.parse(line);
    if (rec.kind === 'frame') child.stdout.write(JSON.stringify(rec.data) + '\n');
  }
  child.emit('close', 0, null);
  const result = await resultPromise;

  // Oracle preserves child agent text in child namespace:
  const oracle = new OfficialReducerOracle();
  for (const line of agentLines) {
    const rec = JSON.parse(line);
    if (rec.kind === 'frame') oracle.processMessage(rec.data);
  }
  const oracleState = oracle.getCanonicalState();
  const childBlock = oracleState.messages.find(m => m.parentToolUseId === 'parent-tool-N');
  assert.ok(childBlock, 'Oracle must preserve child agent blocks in child namespace');
  assert.equal(childBlock.blocks[0].text, 'child', 'Child message text must match');

  // HugRemote v1.5.3 baseline: child agent output is completely absent in result and stream!
  assert.equal(hugEvents.some(e => e.type === 'text_delta' && e.text.includes('child')), false,
    'HugRemote v1.5.3 must drop child agent frames, proving gap detection is working');
  assert.equal(result.text, 'root', 'HugRemote v1.5.3 must only contain root text');

  // Test 2: Tool permission interaction gap (v1.5.3 ignores control_request)
  const interactFixture = manifest.fixtures.find(f => f.id === 'm1-interact-001');
  assert.ok(interactFixture);
  const interactLines = (await readFile(resolve(root, 'analysis/claude-protocol/fixtures/2.1.308', interactFixture.file), 'utf8'))
    .split('\n').filter(Boolean);

  let interactEvents = [];
  const child2 = new (await import('node:events')).EventEmitter();
  child2.stdin = new (await import('node:stream')).PassThrough();
  child2.stdout = new (await import('node:stream')).PassThrough();
  child2.stderr = new (await import('node:stream')).PassThrough();
  child2.kill = () => {};
  service.spawnLocalClaude = () => child2;
  const p2 = service.streamClaudePrompt(session, 'test', e => interactEvents.push(e));
  for (const line of interactLines) {
    const rec = JSON.parse(line);
    if (rec.kind === 'frame') child2.stdout.write(JSON.stringify(rec.data) + '\n');
  }
  child2.emit('close', 0, null);
  await p2;

  // Oracle captures control_request interaction:
  const oracleInteract = new OfficialReducerOracle();
  for (const line of interactLines) {
    const rec = JSON.parse(line);
    if (rec.kind === 'frame') oracleInteract.processMessage(rec.data);
  }
  assert.equal(oracleInteract.getCanonicalState().interactions.length, 1, 'Oracle must capture control_request');

  // HugRemote v1.5.3 baseline emits NO interaction event whatsoever:
  assert.equal(interactEvents.some(e => e.type === 'interaction' || e.type === 'permission'), false,
    'HugRemote v1.5.3 must not emit interaction event, proving gap detection is working');
});

if (failed) process.exitCode = 1;
