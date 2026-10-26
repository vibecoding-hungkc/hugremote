import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { ClaudeEventNormalizer } from '../apps/api/src/services/claude/eventNormalizer.js';
import { ClaudeRunAssembler } from '../apps/api/src/services/claude/runAssembler.js';

const fixtureRoot = resolve('fixtures/claude-protocol/2.1.308');

async function frames(name: string): Promise<any[]> {
  return (await readFile(resolve(fixtureRoot, name), 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .filter(record => record.kind === 'frame')
    .map(record => record.data);
}

function applyFrame(normalizer: ClaudeEventNormalizer, assembler: ClaudeRunAssembler, frame: any) {
  const events = normalizer.normalizeFrame(frame);
  assert.ok(events.length > 0, 'native frame must never be silently dropped');
  for (const event of events) {
    assert.equal(assembler.applyNormalizedEvent(event), true, `event ${event.type} must be accepted`);
  }
  return events;
}

test('M3 parallel tool input lifecycle stays partial until stop and preserves exact identity', async () => {
  const normalizer = new ClaudeEventNormalizer({ sessionId: 'tool-session', runId: 'tool-run' });
  const assembler = new ClaudeRunAssembler();
  const fixture = await frames('m1-tool-002.jsonl');

  for (const frame of fixture.slice(0, 5)) applyFrame(normalizer, assembler, frame);
  let blocks = assembler.getSnapshot().rootMessages[0].blocks;
  assert.deepEqual(blocks.map(block => block.tool_id), ['tool-G1', 'tool-G2']);
  assert.deepEqual(blocks.map(block => block.toolStatus), ['receiving-input', 'receiving-input']);
  assert.deepEqual(blocks.map(block => block.partialInput), ['{"value":"one"}', '{"value":"two"}']);
  assert.deepEqual(blocks.map(block => block.input), [{}, {}], 'partial JSON must not become canonical input');

  applyFrame(normalizer, assembler, fixture[5]);
  blocks = assembler.getSnapshot().rootMessages[0].blocks;
  assert.equal(blocks[0].toolStatus, 'receiving-input');
  assert.equal(blocks[1].toolStatus, 'ready');
  assert.deepEqual(blocks[1].input, {}, 'block stop must not promote partial JSON to canonical input');
  assert.equal(blocks[1].partialInput, '{"value":"two"}');

  for (const frame of fixture.slice(6)) applyFrame(normalizer, assembler, frame);
  blocks = assembler.getSnapshot().rootMessages[0].blocks;
  assert.deepEqual(blocks.map(block => block.toolStatus), ['running', 'running']);
  assert.deepEqual(blocks.map(block => block.input), [{ value: 'one' }, { value: 'two' }]);
  assert.deepEqual(blocks.map(block => block.tool_name), ['GenericOne', 'GenericTwo']);
});

test('M3 tool result terminal states preserve structured output and exact error/cancel status', () => {
  const assembler = new ClaudeRunAssembler();
  const base = { schemaVersion: 1 as const, sessionId: 'terminal-session', runId: 'terminal-run' };
  assert.equal(assembler.applyNormalizedEvent({
    ...base,
    type: 'message.snapshot',
    messageId: 'tools',
    content: [
      { type: 'tool_use', id: 'ok', name: 'Read', input: { file_path: 'fixture://a' } },
      { type: 'tool_use', id: 'bad', name: 'Bash', input: { command: 'fixture' } },
      { type: 'tool_use', id: 'cancel', name: 'Task', input: {} }
    ]
  }), true);
  assert.equal(assembler.applyNormalizedEvent({ ...base, type: 'tool.completed', toolUseId: 'ok', output: [{ type: 'text', text: 'structured' }] }), true);
  assert.equal(assembler.applyNormalizedEvent({ ...base, type: 'tool.completed', toolUseId: 'bad', output: 'failed', isError: true }), true);
  assert.equal(assembler.applyNormalizedEvent({ ...base, type: 'tool.cancelled', toolUseId: 'cancel' }), true);

  const blocks = assembler.getSnapshot().rootMessages[0].blocks;
  assert.deepEqual(blocks.map(block => block.toolStatus), ['done', 'error', 'cancelled']);
  assert.deepEqual(blocks[0].toolResult?.content, [{ type: 'text', text: 'structured' }]);
});

test('M3 native task lifecycle assembles one child agent without contaminating root transcript', async () => {
  const normalizer1 = new ClaudeEventNormalizer({ sessionId: 'agent-session-1', runId: 'agent-run-1' });
  const assembler1 = new ClaudeRunAssembler();
  for (const frame of await frames('m1-agent-001.jsonl')) applyFrame(normalizer1, assembler1, frame);

  const snapshot1 = assembler1.getSnapshot();
  assert.equal(snapshot1.rootMessages.map(message => message.text).join(''), 'root');
  const streamedChild = snapshot1.childAgents.find(agent => agent.parentToolUseId === 'parent-tool-N');
  assert.equal(streamedChild?.messages.map(message => message.text).join(''), 'child');

  const normalizer2 = new ClaudeEventNormalizer({ sessionId: 'agent-session-2', runId: 'agent-run-2' });
  const assembler2 = new ClaudeRunAssembler();
  for (const frame of await frames('m1-agent-002.jsonl')) applyFrame(normalizer2, assembler2, frame);

  const snapshot2 = assembler2.getSnapshot();
  const taskAgent = snapshot2.childAgents.find(agent => agent.agentId === 'task-O');
  assert.ok(taskAgent, 'task lifecycle must create a stable child agent');
  assert.equal(taskAgent.parentToolUseId, 'parent-tool-O');
  assert.equal(taskAgent.status, 'completed');
  assert.equal(taskAgent.summary, 'done');
  assert.deepEqual(taskAgent.recentTools, ['FixtureTool']);
  assert.equal(taskAgent.totalTokens, 5);
  assert.equal(snapshot2.rootMessages.some(message => /working|done/.test(message.text)), false);
});

test('M3 AC15: parallel child agents track independent lifecycle and reverse completion', () => {
  const assembler = new ClaudeRunAssembler();
  const base = { schemaVersion: 1 as const, sessionId: 'agent-session', runId: 'agent-run' };

  // Two agents started in parallel
  assert.equal(assembler.applyNormalizedEvent({
    ...base,
    type: 'agent.started',
    agentId: 'agent-alpha',
    parentToolUseId: 'tool-call-1',
    summary: 'Agent Alpha starting'
  }), true);

  assert.equal(assembler.applyNormalizedEvent({
    ...base,
    type: 'agent.started',
    agentId: 'agent-beta',
    parentToolUseId: 'tool-call-2',
    summary: 'Agent Beta starting'
  }), true);

  // Both report progress with distinct tools and tokens
  assert.equal(assembler.applyNormalizedEvent({
    ...base,
    type: 'agent.progress',
    agentId: 'agent-alpha',
    summary: 'Alpha reading file',
    recentTool: 'Read',
    totalTokens: 120
  }), true);

  assert.equal(assembler.applyNormalizedEvent({
    ...base,
    type: 'agent.progress',
    agentId: 'agent-beta',
    summary: 'Beta searching pattern',
    recentTool: 'Grep',
    totalTokens: 250
  }), true);

  // Beta finishes FIRST (reverse completion order)
  assert.equal(assembler.applyNormalizedEvent({
    ...base,
    type: 'agent.completed',
    agentId: 'agent-beta',
    status: 'completed',
    summary: 'Beta finished first'
  }), true);

  let snap = assembler.getSnapshot();
  const beta = snap.childAgents.find(a => a.agentId === 'agent-beta');
  const alpha = snap.childAgents.find(a => a.agentId === 'agent-alpha');
  assert.equal(beta?.status, 'completed');
  assert.equal(beta?.summary, 'Beta finished first');
  assert.equal(alpha?.status, 'running');
  assert.equal(alpha?.summary, 'Alpha reading file');

  // Alpha finishes afterwards
  assert.equal(assembler.applyNormalizedEvent({
    ...base,
    type: 'agent.completed',
    agentId: 'agent-alpha',
    status: 'completed',
    summary: 'Alpha finished last'
  }), true);

  snap = assembler.getSnapshot();
  assert.equal(snap.childAgents.find(a => a.agentId === 'agent-alpha')?.status, 'completed');
  assert.equal(snap.childAgents.length, 2);
});

test('M3 AC12: repeated tool IDs across messages or scoped runs do not collide or overwrite', () => {
  const assembler = new ClaudeRunAssembler();
  const base = { schemaVersion: 1 as const, sessionId: 'scope-session', runId: 'scope-run' };

  // Message 1 has a tool_use with ID "common-tool-id"
  assert.equal(assembler.applyNormalizedEvent({
    ...base,
    type: 'message.snapshot',
    messageId: 'msg-1',
    content: [
      { type: 'tool_use', id: 'common-tool-id', name: 'Bash', input: { command: 'echo 1' } }
    ]
  }), true);

  // Message 2 has ANOTHER tool_use with the SAME ID "common-tool-id" (e.g. CLI re-uses or child uses same id)
  assert.equal(assembler.applyNormalizedEvent({
    ...base,
    type: 'message.snapshot',
    messageId: 'msg-2',
    content: [
      { type: 'tool_use', id: 'common-tool-id', name: 'Read', input: { file_path: 'file.txt' } }
    ]
  }), true);

  // Tool completed applies to the latest active tool call
  assert.equal(assembler.applyNormalizedEvent({
    ...base,
    type: 'tool.completed',
    toolUseId: 'common-tool-id',
    output: 'read result'
  }), true);

  const snap = assembler.getSnapshot();
  const msg1Block = snap.rootMessages.find(m => m.messageId === 'msg-1')?.blocks[0];
  const msg2Block = snap.rootMessages.find(m => m.messageId === 'msg-2')?.blocks[0];

  assert.equal(msg2Block?.toolResult?.content, 'read result');
  assert.equal(msg2Block?.tool_name, 'Read');
  assert.equal(msg1Block?.tool_name, 'Bash');
  // msg1Block should not have been contaminated by msg2's completion
  assert.equal(msg1Block?.toolResult, undefined);
});
