import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import {
  ClaudeReplayBuffer,
  migrateSessionRecord,
  CURRENT_SESSION_SCHEMA_VERSION
} from '../apps/api/src/services/claude/sessionMigration.js';

after(async () => {
  try {
    const { sessionManager } = await import('../apps/api/src/services/sessionManager.js');
    const { tempZipService } = await import('../apps/api/src/services/tempZipService.js');
    clearInterval((sessionManager as any).cleanupInterval);
    clearInterval((tempZipService as any).cleanupTimer);
  } catch (_) {}
});

test('M6 AC21: ClaudeReplayBuffer tracks monotonic sequence and replays events after cursor', () => {
  const buffer = new ClaudeReplayBuffer(10); // max 10 events

  for (let i = 1; i <= 8; i++) {
    buffer.append({ type: 'text_delta', text: `chunk-${i}` });
  }

  assert.equal(buffer.getLastSequence(), 8);

  // Client reconnects asking for events after sequence 5
  const replayed = buffer.getEventsAfter(5);
  assert.equal(replayed.type, 'replay');
  if (replayed.type === 'replay') {
    assert.equal(replayed.events.length, 3);
    assert.equal(replayed.events[0].sequence, 6);
    assert.equal(replayed.events[2].sequence, 8);
  }
});

test('M6 AC21 & AC22: ClaudeReplayBuffer signals snapshot fallback when cursor is older than evicted window', () => {
  const buffer = new ClaudeReplayBuffer(5); // max 5 events

  // Append 10 events (1..10); events 1..5 will be evicted
  for (let i = 1; i <= 10; i++) {
    buffer.append({ type: 'text_delta', text: `chunk-${i}` });
  }

  assert.equal(buffer.getLastSequence(), 10);

  // Client requests cursor 2 (which was evicted)
  const result = buffer.getEventsAfter(2);
  assert.equal(result.type, 'fallback_snapshot');
  if (result.type === 'fallback_snapshot') {
    assert.equal(result.lastSequence, 10);
  }
});

test('M6 AC23: migrateSessionRecord upgrades legacy v1.5.3 session safely and idempotently', () => {
  const legacySession = {
    id: 'legacy-sess-1',
    name: 'Old Session',
    cwd: '/home/user/project',
    model: 'Claude Sonnet 3.5',
    messages: [
      {
        id: 'msg-u1',
        sender: 'user',
        text: 'hello',
        time: '12:00'
      },
      {
        id: 'msg-a1',
        sender: 'assistant',
        text: 'done',
        time: '12:01',
        thinking: 'thought',
        tools: [
          {
            id: 'tool-legacy-1',
            type: 'bash',
            title: 'run command',
            content: 'npm test'
          }
        ]
      }
    ]
  };

  const migrated = migrateSessionRecord(legacySession);

  // 1. Schema version upgraded
  assert.equal(migrated.schemaVersion, CURRENT_SESSION_SCHEMA_VERSION);
  assert.equal(migrated.schemaVersion, 2);

  // 2. Data integrity preserved
  assert.equal(migrated.id, 'legacy-sess-1');
  assert.equal(migrated.messages.length, 2);
  assert.equal(migrated.messages[1].text, 'done');
  assert.equal(migrated.messages[1].thinking, 'thought');

  // 3. New schema fields initialized safely
  const tool = migrated.messages[1].tools?.[0];
  assert.ok(tool);
  assert.equal(tool.status, 'done'); // completed legacy tool defaults to terminal done
  assert.deepEqual(migrated.messages[1].childAgents, []);
  assert.deepEqual(migrated.messages[1].interactions, []);

  // 4. Idempotency: re-migrating an already upgraded record returns identical data
  const reMigrated = migrateSessionRecord(migrated);
  assert.deepEqual(reMigrated, migrated);
});

test('M6 AC21 & AC22: Fastify SSE GET /stream supports ?after=N replay and snapshot fallback', async () => {
  const http = await import('node:http');
  const { claudeService } = await import('../apps/api/src/services/claudeService.js');
  const { createApp } = await import('../apps/api/src/app.js');

  const app = await createApp();
  const origin = await app.listen({ port: 0, host: '127.0.0.1' });
  const sessionId = 'session-replay-sse';

  const replayBuffer = new ClaudeReplayBuffer(10);
  replayBuffer.append({ type: 'text_delta', text: 'part-1' }); // seq 1
  replayBuffer.append({ type: 'text_delta', text: 'part-2' }); // seq 2
  replayBuffer.append({ type: 'text_delta', text: 'part-3' }); // seq 3
  replayBuffer.append({ type: 'text_delta', text: 'part-4' }); // seq 4
  replayBuffer.append({ type: 'text_delta', text: 'part-5' }); // seq 5

  const liveMessage = { id: 'msg-live', sender: 'assistant' as const, text: 'part-1part-2part-3part-4part-5' };
  const mockTask = {
    sessionId,
    userPrompt: 'test',
    status: 'running' as const,
    startTime: Date.now(),
    liveMessage,
    events: [],
    listeners: new Set<(e: any) => void>(),
    replayBuffer
  };

  (claudeService as any).sessions.set(sessionId, {
    id: sessionId,
    name: 'Replay Session',
    cwd: '/tmp',
    model: 'Default',
    messages: [liveMessage]
  });
  (claudeService as any).activeTasks.set(sessionId, mockTask);

  async function fetchStream(query = '', expectedCount = 1) {
    let text = '';
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        req.destroy();
        resolve(text);
      }, 500);

      const req = http.request(`${origin}/api/claude/sessions/${sessionId}/stream${query}`, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          text += chunk;
          const matches = text.match(/data: /g);
          if (matches && matches.length >= expectedCount) {
            clearTimeout(timer);
            req.destroy();
            res.destroy();
            resolve(text);
          }
        });
      });
      req.on('error', (err: any) => {
        clearTimeout(timer);
        if (err.code === 'ECONNRESET' || req.destroyed) {
          resolve(text);
        } else {
          reject(err);
        }
      });
      req.end();
    });
  }

  try {
    // 1. Reconnect with after=3: should replay events 4 and 5 directly without sync snapshot
    const replayBody = await fetchStream('?after=3', 2);
    assert.ok(!replayBody.includes('"type":"sync"'), 'Replay must not re-emit initial sync snapshot');
    assert.ok(replayBody.includes('part-4'), 'Replayed event 4 present');
    assert.ok(replayBody.includes('part-5'), 'Replayed event 5 present');
    assert.ok(!replayBody.includes('part-2'), 'Past event 2 excluded');

    // 2. Reconnect without after parameter: should emit initial sync snapshot with lastSequence
    const snapBody = await fetchStream('', 1);
    assert.ok(snapBody.includes('"type":"sync"'), 'Fallback sends initial sync snapshot');
    assert.ok(snapBody.includes('"lastSequence":5'), 'Snapshot includes lastSequence');
  } finally {
    // Cleanup
    (claudeService as any).sessions.delete(sessionId);
    (claudeService as any).activeTasks.delete(sessionId);
    await app.close();
  }
});
