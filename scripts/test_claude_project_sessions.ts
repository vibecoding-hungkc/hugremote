import assert from 'node:assert';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { ClaudeService } from '../apps/api/src/services/claudeService.js';

async function runTests() {
  console.log('Testing Claude Code CLI Project Sessions integration...');

  const claudeService = new ClaudeService();

  // Test 1: resolveClaudeProjectDir for hugremote
  const cwd = path.resolve('/home/hungnd/projects/hugremote');
  const projectDir = claudeService.resolveClaudeProjectDir(cwd);
  console.log('Resolved project dir:', projectDir);
  assert.ok(projectDir, 'Must resolve project dir for /home/hungnd/projects/hugremote');
  assert.ok(fs.existsSync(projectDir), 'Project dir must exist on disk');

  // Test 2: listProjectSessions returns array of project sessions
  const existingJsonls = fs.readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'));
  const fixtureFile = path.join(projectDir, 'test-fixture-session.jsonl');
  if (existingJsonls.length === 0) {
    fs.writeFileSync(
      fixtureFile,
      JSON.stringify({ type: 'user', message: { content: 'Sample prompt for test' }, timestamp: new Date().toISOString() }) + '\n' +
      JSON.stringify({ type: 'assistant', message: { content: 'Sample assistant response' }, timestamp: new Date().toISOString() }) + '\n',
      'utf8'
    );
  }

  const sessions = await claudeService.listProjectSessions(cwd, 'server-local');
  console.log(`Found ${sessions.length} Claude Code CLI project sessions`);
  assert.ok(sessions.length > 0, 'Must find at least one CLI project session in hugremote');
  
  const first = sessions[0];
  console.log('Sample session:', {
    id: first.id,
    summary: first.summary,
    userMsgs: first.userMsgs,
    updatedAt: new Date(first.updatedAt).toISOString(),
  });
  assert.ok(first.id, 'Session must have an ID');
  assert.ok(first.summary, 'Session must have a summary');
  assert.ok(first.updatedAt > 0, 'Session must have a valid timestamp');

  // Test 3: getProjectSessionDetail retrieves messages
  const detail = await claudeService.getProjectSessionDetail(first.id, cwd, 'server-local');
  assert.ok(detail, 'Session detail must be found');
  assert.strictEqual(detail.id, first.id, 'Detail ID must match');
  console.log(`Loaded ${detail.messages.length} messages from session detail`);

  // Test 4: resumeProjectSession attaches cliSessionId to a session
  const resumed = await claudeService.resumeProjectSession(first.id, cwd, undefined, 'server-local');
  assert.ok(resumed, 'Resume must return a session');
  assert.strictEqual(resumed.cliSessionId, first.id, 'Resumed session must have cliSessionId set');
  assert.strictEqual(resumed.messages.length, detail.messages.length, 'Messages count must match');
  console.log(`Successfully resumed session ${resumed.id} with cliSessionId ${resumed.cliSessionId}`);

  // Test 5: renameProjectSession updates custom title in metadata and jsonl
  const testSessionId = `test-dummy-${Date.now()}`;
  const testFile = path.join(projectDir, `${testSessionId}.jsonl`);
  fs.writeFileSync(
    testFile,
    JSON.stringify({ type: 'user', message: { content: 'Original dummy prompt' } }) + '\n',
    'utf8'
  );
  try {
    const preList = await claudeService.listProjectSessions(cwd, 'server-local');
    const createdItem = preList.find((s) => s.id === testSessionId);
    assert.ok(createdItem, 'Created dummy session must appear in session list');

    const renameOk = await claudeService.renameProjectSession(testSessionId, 'Tên Mới Phiên Test', cwd, 'server-local');
    assert.strictEqual(renameOk, true, 'renameProjectSession must return true');

    const postList = await claudeService.listProjectSessions(cwd, 'server-local');
    const renamedItem = postList.find((s) => s.id === testSessionId);
    assert.ok(renamedItem, 'Renamed session must exist');
    assert.strictEqual(renamedItem.summary, 'Tên Mới Phiên Test', 'Summary must match updated name');
    console.log('Successfully tested renameProjectSession: name updated to "Tên Mới Phiên Test"');

    // Test 6: deleteProjectSession removes jsonl file and metadata
    const deleteOk = await claudeService.deleteProjectSession(testSessionId, cwd, 'server-local');
    assert.strictEqual(deleteOk, true, 'deleteProjectSession must return true');
    assert.strictEqual(fs.existsSync(testFile), false, 'Session jsonl file must be deleted');

    const afterDeleteList = await claudeService.listProjectSessions(cwd, 'server-local');
    assert.ok(!afterDeleteList.some((s) => s.id === testSessionId), 'Deleted session must not appear in list');
    console.log('Successfully tested deleteProjectSession: session file removed cleanly');
  } finally {
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  }

  // Test 7: Verify token extraction from jsonl and preservation in resumeProjectSession
  const testTokenSessionId = `test-token-${Date.now()}`;
  const testTokenFile = path.join(projectDir, `${testTokenSessionId}.jsonl`);
  fs.writeFileSync(
    testTokenFile,
    JSON.stringify({ type: 'user', message: { content: 'User question for tokens test' } }) + '\n' +
    JSON.stringify({
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: 'Assistant answer' }],
        usage: {
          input_tokens: 15420,
          output_tokens: 80,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      },
    }) + '\n',
    'utf8'
  );
  try {
    const detailWithTokens = await claudeService.getProjectSessionDetail(testTokenSessionId, cwd, 'server-local');
    assert.ok(detailWithTokens, 'Detail must be loaded');
    assert.strictEqual(detailWithTokens.contextTokens, '15.5k', 'contextTokens must be 15.5k (15420 + 80 = 15500)');

    const resumedWithTokens = await claudeService.resumeProjectSession(testTokenSessionId, cwd, undefined, 'server-local');
    assert.ok(resumedWithTokens, 'Resumed session must exist');
    assert.strictEqual(resumedWithTokens.contextTokens, '15.5k', 'Resumed session must preserve authentic 15.5k context tokens');

    // Adding message without explicitContextTokens must not wipe out 15.5k
    const dummyMsg = { id: 'm1', sender: 'assistant' as const, text: 'Another message', time: '12:00' };
    claudeService.addMessage(resumedWithTokens.id, dummyMsg);
    const afterAdd = claudeService.getSession(resumedWithTokens.id);
    assert.strictEqual(afterAdd?.contextTokens, '15.5k', 'addMessage must not overwrite existing 15.5k with a crude character estimate');
    console.log('Successfully tested token extraction and preservation: contextTokens = 15.5k maintained!');
  } finally {
    if (fs.existsSync(testTokenFile)) {
      fs.unlinkSync(testTokenFile);
    }
  }

  console.log('All Claude Code CLI Project Sessions tests PASSED! ✔');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
