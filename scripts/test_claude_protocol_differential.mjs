import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { OfficialReducerOracle } = require('./claude_oracle_engine.cjs');

const root = resolve('.');
const manifestPath = resolve(root, 'fixtures/claude-protocol/2.1.308/manifest.json');
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
    const fixturePath = resolve(root, 'fixtures/claude-protocol/2.1.308', fixtureMeta.file);
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
  const agentLines = (await readFile(resolve(root, 'fixtures/claude-protocol/2.1.308', agentFixture.file), 'utf8'))
    .split('\n').filter(Boolean);

  let hugEvents = [];
  const session = { id: 'test-session', cwd: root, serverId: 'server-local', messages: [], model: 'Default', mode: 'Auto' };

  // Feed through a mock spawn harness like test_claude_streaming.ts
  const child = new (await import('node:events')).EventEmitter();
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
  const interactLines = (await readFile(resolve(root, 'fixtures/claude-protocol/2.1.308', interactFixture.file), 'utf8'))
    .split('\n').filter(Boolean);

  let interactEvents = [];
  const child2 = new (await import('node:events')).EventEmitter();
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
