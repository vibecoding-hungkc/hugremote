import assert from 'node:assert';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { ClaudeService } from '../server/src/services/claudeService.js';

async function runTests() {
  console.log('Testing Claude Code CLI Project Sessions integration...');

  const mockServerResolver = () => undefined;
  const claudeService = new ClaudeService(mockServerResolver);

  // Test 1: resolveClaudeProjectDir for hugremote
  const cwd = path.resolve('/home/hungnd/projects/hugremote');
  const projectDir = claudeService.resolveClaudeProjectDir(cwd);
  console.log('Resolved project dir:', projectDir);
  assert.ok(projectDir, 'Must resolve project dir for /home/hungnd/projects/hugremote');
  assert.ok(fs.existsSync(projectDir), 'Project dir must exist on disk');

  // Test 2: listProjectSessions returns array of project sessions
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

  console.log('All Claude Code CLI Project Sessions tests PASSED! ✔');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
