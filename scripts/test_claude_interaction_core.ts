import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClaudeEventNormalizer } from '../apps/api/src/services/claude/eventNormalizer.js';
import { ClaudeRunAssembler } from '../apps/api/src/services/claude/runAssembler.js';

test('M5 AC19: interaction requested normalizes with exact id and tracks pending status', () => {
  const normalizer = new ClaudeEventNormalizer({ sessionId: 'session-ctrl', runId: 'run-ctrl' });
  const assembler = new ClaudeRunAssembler();

  const nativeFrame = {
    type: 'control_request',
    request_id: 'req-perm-1',
    request: {
      subtype: 'can_use_tool',
      tool_name: 'Bash',
      input: { command: 'rm -rf /' }
    }
  };

  const events = normalizer.normalizeFrame(nativeFrame);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'interaction.requested');
  assert.equal(events[0].interactionId, 'req-perm-1');

  assert.equal(assembler.applyNormalizedEvent(events[0]), true);

  const snap = assembler.getSnapshot();
  assert.equal(snap.interactions.length, 1);
  assert.equal(snap.interactions[0].interactionId, 'req-perm-1');
  assert.equal(snap.interactions[0].status, 'pending');
});

test('M5 AC19 & AC20: responding transitions interaction to responded and blocks double-submit', () => {
  const assembler = new ClaudeRunAssembler();
  const base = { schemaVersion: 1 as const, sessionId: 'session-ctrl', runId: 'run-ctrl' };

  // 1. Initial pending request
  assert.equal(assembler.applyNormalizedEvent({
    ...base,
    type: 'interaction.requested',
    interactionId: 'req-dialog-1',
    interactionType: 'user_dialog',
    request: { question: 'Choose target' }
  }), true);

  assert.equal(assembler.getSnapshot().interactions[0].status, 'pending');

  // 2. Respond to the interaction
  assert.equal(assembler.applyNormalizedEvent({
    ...base,
    type: 'interaction.responded',
    interactionId: 'req-dialog-1',
    response: { behavior: 'allow', optionId: 'opt-yes' }
  }), true);

  let snap = assembler.getSnapshot();
  assert.equal(snap.interactions[0].status, 'responded');
  assert.deepEqual(snap.interactions[0].response, { behavior: 'allow', optionId: 'opt-yes' });

  // 3. Double submit must be rejected (idempotent / stale guard)
  assert.equal(assembler.applyNormalizedEvent({
    ...base,
    type: 'interaction.responded',
    interactionId: 'req-dialog-1',
    response: { behavior: 'deny' }
  }), false);

  // Status and response remain unchanged
  snap = assembler.getSnapshot();
  assert.equal(snap.interactions[0].status, 'responded');
  assert.deepEqual(snap.interactions[0].response, { behavior: 'allow', optionId: 'opt-yes' });
});

test('M5 AC19: cancellation transitions pending interaction to cancelled', () => {
  const assembler = new ClaudeRunAssembler();
  const base = { schemaVersion: 1 as const, sessionId: 'session-ctrl', runId: 'run-ctrl' };

  assert.equal(assembler.applyNormalizedEvent({
    ...base,
    type: 'interaction.requested',
    interactionId: 'req-cancel-1',
    interactionType: 'permission',
    request: { tool_name: 'Edit' }
  }), true);

  assert.equal(assembler.applyNormalizedEvent({
    ...base,
    type: 'interaction.cancelled',
    interactionId: 'req-cancel-1'
  }), true);

  const snap = assembler.getSnapshot();
  assert.equal(snap.interactions[0].status, 'cancelled');

  // Stale late response after cancellation is rejected
  assert.equal(assembler.applyNormalizedEvent({
    ...base,
    type: 'interaction.responded',
    interactionId: 'req-cancel-1',
    response: { behavior: 'allow' }
  }), false);
});

test('M5 AC19: HTTP API routes respond and cancel active interactions with process stdin dispatch', async () => {
  const { claudeService } = await import('../apps/api/src/services/claudeService.js');
  const { createApp } = await import('../apps/api/src/app.js');

  const app = await createApp();

  // 1. Non-existent session returns 404
  const resNotFound = await app.inject({
    method: 'POST',
    url: '/api/claude/sessions/non-existent/interactions/int-1/respond',
    payload: { response: { behavior: 'allow' } }
  });
  assert.equal(resNotFound.statusCode, 404);

  // 2. Setup mock task and process with writable stdin
  const sessionId = 'session-mock-interaction';
  let written = '';
  const mockStdin = {
    write(chunk: string) {
      written += chunk;
      return true;
    }
  };

  const assembler = new ClaudeRunAssembler();
  assembler.applyNormalizedEvent({
    schemaVersion: 1,
    sessionId,
    runId: sessionId,
    type: 'interaction.requested',
    interactionId: 'int-perm-42',
    interactionType: 'permission',
    request: { tool: 'Bash' }
  });

  (claudeService as any).activeTasks.set(sessionId, {
    sessionId,
    userPrompt: 'test',
    status: 'running',
    startTime: Date.now(),
    liveMessage: { id: 'msg-1', sender: 'assistant', text: '' },
    events: [],
    listeners: new Set(),
    assembler
  });

  (claudeService as any).activeProcesses.set(sessionId, {
    stdin: mockStdin,
    stdout: {} as any,
    stderr: {} as any,
    on: () => {},
    kill: () => {}
  });

  // Respond via HTTP endpoint
  const resRespond = await app.inject({
    method: 'POST',
    url: `/api/claude/sessions/${sessionId}/interactions/int-perm-42/respond`,
    payload: { response: { behavior: 'allow' } }
  });

  assert.equal(resRespond.statusCode, 200);
  assert.deepEqual(JSON.parse(resRespond.body), { success: true });
  assert.ok(written.includes('"control_response"'));
  assert.ok(written.includes('"int-perm-42"'));
  assert.ok(written.includes('"allow"'));

  // Assembler reflects responded status
  assert.equal(assembler.getSnapshot().interactions[0].status, 'responded');

  // Double submit is rejected with 404/settled error
  const resDouble = await app.inject({
    method: 'POST',
    url: `/api/claude/sessions/${sessionId}/interactions/int-perm-42/respond`,
    payload: { response: { behavior: 'deny' } }
  });
  assert.equal(resDouble.statusCode, 404);

  // Test Cancel endpoint on another interaction
  assembler.applyNormalizedEvent({
    schemaVersion: 1,
    sessionId,
    runId: sessionId,
    type: 'interaction.requested',
    interactionId: 'int-dialog-99',
    interactionType: 'user_dialog',
    request: { question: 'Confirm?' }
  });

  written = '';
  const resCancel = await app.inject({
    method: 'POST',
    url: `/api/claude/sessions/${sessionId}/interactions/int-dialog-99/cancel`
  });

  assert.equal(resCancel.statusCode, 200);
  assert.deepEqual(JSON.parse(resCancel.body), { success: true });
  assert.ok(written.includes('"control_cancel_request"'));
  assert.ok(written.includes('"int-dialog-99"'));

  assert.equal(assembler.getSnapshot().interactions.find(i => i.interactionId === 'int-dialog-99')?.status, 'cancelled');

  // Cleanup
  (claudeService as any).activeTasks.delete(sessionId);
  (claudeService as any).activeProcesses.delete(sessionId);
  await app.close();
});

test('M5 SEC-001: normalizer allowlists and bounds control_request fields, dropping arbitrary secrets and huge payloads', () => {
  const normalizer = new ClaudeEventNormalizer({ sessionId: 'session-sec', runId: 'run-sec' });
  const rawFrame = {
    type: 'control_request',
    request_id: 'req-sec-1',
    request: {
      subtype: 'can_use_tool',
      tool_name: 'Bash',
      input: { command: 'echo hello' },
      secret_token: 'SUPER_SECRET_TOKEN',
      arbitrary_env: { PATH: '/bin' },
      large_blob: 'x'.repeat(100_000),
    }
  };

  const [event] = normalizer.normalizeFrame(rawFrame);
  assert.equal(event.type, 'interaction.requested');
  assert.equal(event.interactionId, 'req-sec-1');
  assert.equal(event.request.tool_name, 'Bash');
  assert.deepEqual(event.request.input, { command: 'echo hello' });
  assert.equal((event.request as any).secret_token, undefined, 'un-allowlisted secrets must be stripped');
  assert.equal((event.request as any).arbitrary_env, undefined, 'un-allowlisted env must be stripped');
  assert.equal((event.request as any).large_blob, undefined, 'un-allowlisted large blobs must be stripped');
});

test('M5 LOGIC-003: duplicate interaction.requested with same id is rejected by assembler', () => {
  const assembler = new ClaudeRunAssembler();
  const event = {
    schemaVersion: 1 as const,
    sessionId: 'session-dup',
    runId: 'run-dup',
    type: 'interaction.requested' as const,
    interactionId: 'req-dup-1',
    interactionType: 'permission' as const,
    request: { tool_name: 'Bash' }
  };

  assert.equal(assembler.applyNormalizedEvent(event), true);
  // Duplicate application MUST return false
  assert.equal(assembler.applyNormalizedEvent(event), false, 'assembler must reject duplicate interaction.requested');
  assert.equal(assembler.getSnapshot().interactions.length, 1);
});

test('M5 LOGIC-002: respondInteraction and cancelInteraction reject when stdin is ended or destroyed', async () => {
  const { claudeService } = await import('../apps/api/src/services/claudeService.js');
  const sessionId = 'session-ended-stdin';
  const assembler = new ClaudeRunAssembler();
  assembler.applyNormalizedEvent({
    schemaVersion: 1,
    sessionId,
    runId: sessionId,
    type: 'interaction.requested',
    interactionId: 'int-ended-1',
    interactionType: 'permission',
    request: { tool_name: 'Bash' }
  });

  const endedStdin = {
    writable: false,
    writableEnded: true,
    write() { return true; }
  };

  (claudeService as any).activeTasks.set(sessionId, {
    sessionId,
    userPrompt: 'test',
    status: 'running',
    startTime: Date.now(),
    liveMessage: { id: 'msg-ended', sender: 'assistant', text: '' },
    events: [],
    listeners: new Set(),
    assembler
  });

  (claudeService as any).activeProcesses.set(sessionId, {
    stdin: endedStdin,
    stdout: {} as any,
    stderr: {} as any,
    on: () => {},
    kill: () => {}
  });

  assert.equal(claudeService.respondInteraction(sessionId, 'int-ended-1', { behavior: 'allow' }), false);
  assert.equal(claudeService.cancelInteraction(sessionId, 'int-ended-1'), false);

  (claudeService as any).activeTasks.delete(sessionId);
  (claudeService as any).activeProcesses.delete(sessionId);
});
