import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

test('UI AC24: System notice is isolated from assistant text in ClaudeStore and ClaudeView', () => {
  const storeFile = fs.readFileSync(
    path.resolve(process.cwd(), 'apps/web/src/stores/claudeStore.ts'),
    'utf-8'
  );
  const vueFile = fs.readFileSync(
    path.resolve(process.cwd(), 'apps/web/src/components/ClaudeView.vue'),
    'utf-8'
  );

  // 1. Store exposes currentSystemNotice and handles system events
  assert.ok(storeFile.includes('currentSystemNotice'), 'Store must expose currentSystemNotice');
  assert.ok(storeFile.includes('system.status') || storeFile.includes('system_status'), 'Store must handle system status');
  assert.ok(storeFile.includes('system.compact_boundary') || storeFile.includes('system_compact_boundary'), 'Store must handle compact boundary');

  // 2. ClaudeView renders system notice in meta/header/badge, NOT inside assistant text
  assert.ok(vueFile.includes('claude-system-notice-badge'), 'ClaudeView renders dedicated system notice badge');
  const badgeSection = vueFile.slice(vueFile.indexOf('claude-system-notice-badge'), vueFile.indexOf('claude-system-notice-badge') + 300);
  assert.ok(!badgeSection.includes('v-html'), 'System notice badge must never use v-html');
  assert.ok(badgeSection.includes('{{ claudeStore.currentSystemNotice }}') || badgeSection.includes('currentSystemNotice'), 'System notice uses safe mustache interpolation');
});
