import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  escapeHtml,
  markdownToTelegramHtml,
  splitMessage,
  saveLongOutputToFile,
  FILE_SERVER_BASE_URL,
} from '../server/src/telegram/formatter.js';
import { topicManager } from '../server/src/telegram/topicManager.js';
import { runTerminalCommand, formatTerminalResponse } from '../server/src/telegram/terminalRunner.js';
import { claudeService } from '../server/src/services/claudeService.js';
import { getTelegramConfig, isTelegramConfigured } from '../server/src/telegram/config.js';

console.log('🧪 Starting Telegram Bot Integration Test Suite...\n');

let totalTests = 0;
let passedTests = 0;

function test(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          passedTests++;
          console.log(`  ✅ PASS: ${name}`);
        })
        .catch((err) => {
          console.error(`  ❌ FAIL: ${name}`);
          console.error(err);
          process.exitCode = 1;
        });
    } else {
      passedTests++;
      console.log(`  ✅ PASS: ${name}`);
    }
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runAll() {
  // --- Group 1: Formatter & HTML Safety ---
  console.log('--- 1. Formatter & Telegram HTML Tests ---');

  test('escapeHtml handles dangerous characters', () => {
    const raw = '<script>alert("test" & \'foo\')</script>';
    const escaped = escapeHtml(raw);
    assert.strictEqual(escaped.includes('<script>'), false);
    assert.strictEqual(escaped.includes('&amp;'), true);
    assert.strictEqual(escaped.includes('&lt;'), true);
    assert.strictEqual(escaped.includes('&gt;'), true);
  });

  test('markdownToTelegramHtml converts bold, code blocks and links safely', () => {
    const md = [
      '# Tiêu đề',
      'Đây là **chữ đậm** và `code inline`.',
      '```typescript',
      'const a = 1 < 2 && 3 > 1;',
      'console.log(a);',
      '```',
      'Xem thêm tại [HugRemote](https://example.com).',
    ].join('\n');

    const html = markdownToTelegramHtml(md);
    assert.strictEqual(html.includes('<b>Tiêu đề</b>'), true);
    assert.strictEqual(html.includes('<b>chữ đậm</b>'), true);
    assert.strictEqual(html.includes('<code>code inline</code>'), true);
    assert.strictEqual(html.includes('<pre><code class="language-typescript">'), true);
    assert.strictEqual(html.includes('1 &lt; 2 &amp;&amp; 3 &gt; 1;'), true);
    assert.strictEqual(html.includes('<a href="https://example.com">HugRemote</a>'), true);
  });

  test('splitMessage splits long text into chunks <= 3800 chars', () => {
    const longText = 'A'.repeat(5000) + '\n\n' + 'B'.repeat(4000);
    const chunks = splitMessage(longText, 3800);
    assert.ok(chunks.length >= 3, `Expected at least 3 chunks, got ${chunks.length}`);
    for (const c of chunks) {
      assert.ok(c.length <= 3800, `Chunk length ${c.length} exceeds 3800`);
    }
  });

  test('saveLongOutputToFile saves file and produces correct file server URL', () => {
    const content = 'Line 1\nLine 2: Test output from Telegram suite';
    const { filePath, fileUrl } = saveLongOutputToFile('test_suite', content, 'txt');

    assert.ok(fs.existsSync(filePath), `File ${filePath} must exist`);
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), content);
    assert.ok(fileUrl.startsWith(FILE_SERVER_BASE_URL), `URL ${fileUrl} must start with ${FILE_SERVER_BASE_URL}`);

    // Cleanup
    try {
      fs.unlinkSync(filePath);
    } catch (_) {}
  });

  // --- Group 2: TopicManager & Session Persistence ---
  console.log('\n--- 2. TopicManager & Multi-Session Topic Mode Tests ---');

  test('TopicManager manages topic mode toggle per chat', () => {
    const testChatId = 'test-chat-999';
    topicManager.setTopicMode(testChatId, true);
    assert.strictEqual(topicManager.isTopicModeEnabled(testChatId), true);

    topicManager.setTopicMode(testChatId, false);
    assert.strictEqual(topicManager.isTopicModeEnabled(testChatId), false);

    topicManager.setTopicMode(testChatId, true);
  });

  test('TopicManager binds threadId to sessionId and unbinds cleanly', () => {
    const testChatId = 'test-chat-888';
    const threadId = '42';
    const sessionId = 'claude-test-session-123';

    topicManager.bind(testChatId, threadId, sessionId, 'Test Thread');
    const binding = topicManager.getBinding(testChatId, threadId);

    assert.ok(binding, 'Binding should exist');
    assert.strictEqual(binding.sessionId, sessionId);
    assert.strictEqual(binding.sessionName, 'Test Thread');

    topicManager.unbind(testChatId, threadId);
    assert.strictEqual(topicManager.getBinding(testChatId, threadId), undefined);
  });

  test('TopicManager unbindSession clears binding when session is removed', () => {
    const testChatId = 'test-chat-777';
    const threadId = '99';
    const sessionId = 'claude-session-to-delete';

    topicManager.bind(testChatId, threadId, sessionId, 'Delete Me');
    assert.ok(topicManager.getBinding(testChatId, threadId));

    topicManager.unbindSession(sessionId);
    assert.strictEqual(topicManager.getBinding(testChatId, threadId), undefined);
  });

  // --- Group 3: Terminal Runner Execution ---
  console.log('\n--- 3. Terminal Execution Tests ---');

  await test('runTerminalCommand executes simple command successfully', async () => {
    const res = await runTerminalCommand('echo "Hello from HugRemote"', os.homedir());
    assert.strictEqual(res.exitCode, 0);
    assert.strictEqual(res.stdout.trim(), 'Hello from HugRemote');
    assert.strictEqual(res.stderr, '');
    assert.ok(res.durationMs >= 0);
  });

  await test('runTerminalCommand captures command errors and exit codes', async () => {
    const res = await runTerminalCommand('sh -c "echo error_output >&2; exit 2"', os.homedir());
    assert.strictEqual(res.exitCode, 2);
    assert.strictEqual(res.stderr.trim(), 'error_output');
  });

  await test('runTerminalCommand handles long output with file link', async () => {
    // Generate 5000 characters
    const res = await runTerminalCommand('python3 -c "print(\'A\' * 4500)"', os.homedir());
    assert.strictEqual(res.exitCode, 0);
    assert.ok(res.outputFileUrl, 'outputFileUrl must be present for long outputs');
    assert.ok(res.outputFileUrl?.startsWith(FILE_SERVER_BASE_URL));

    const formatted = formatTerminalResponse('python3 -c ...', os.homedir(), res);
    assert.ok(formatted.includes('Xem log đầy đủ:'));
    assert.ok(formatted.includes(res.outputFileUrl!));
  });

  // --- Group 4: Claude Session Core Integration ---
  console.log('\n--- 4. Claude Service Integration Tests ---');

  test('ClaudeService creates and manages sessions accessed by Telegram', () => {
    const session = claudeService.createSession(
      'server-local',
      'TeleSessionTest',
      os.homedir(),
      'Sonnet 5.5 Medium',
      'Auto',
      undefined,
      true
    );

    assert.ok(session.id.startsWith('claude-server-local'));
    assert.strictEqual(session.name, 'TeleSessionTest');
    assert.strictEqual(session.bypassPermissions, true);

    const fetched = claudeService.getSession(session.id);
    assert.strictEqual(fetched?.id, session.id);

    claudeService.clearMessages(session.id);
    assert.strictEqual(claudeService.getSession(session.id)?.messages.length, 0);

    const limits = claudeService.getLimits();
    assert.ok(typeof limits.fiveHour.usedPercent === 'number');
    assert.ok(typeof limits.weekly.usedPercent === 'number');

    claudeService.deleteSession(session.id);
    assert.strictEqual(claudeService.getSession(session.id), undefined);
  });

  // --- Summary ---
  console.log(`\n========================================`);
  console.log(`🎉 TEST SUMMARY: ${passedTests}/${totalTests} tests passed`);
  console.log(`========================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAll();
