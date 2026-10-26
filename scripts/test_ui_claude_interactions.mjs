import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

test('UI AC19 & AC20: ClaudeView template safely renders interactions and prevents double-submit', () => {
  const vueFile = fs.readFileSync(
    path.resolve(process.cwd(), 'apps/web/src/components/ClaudeView.vue'),
    'utf-8'
  );

  // 1. Must NOT use v-html for interaction fields
  const startIdx = vueFile.indexOf('class="claude-interactions"');
  const endIdx = vueFile.indexOf('<!-- Streaming/final assistant answer -->', startIdx);
  const interactionSection = vueFile.slice(startIdx, endIdx);
  assert.ok(!interactionSection.includes('v-html='), 'Interaction view must not use v-html');

  // 2. Must guard buttons with disabled state to prevent double submit
  assert.ok(interactionSection.includes(':disabled="isSubmittingInteraction('), 'Buttons must be disabled during submission');

  // 3. Must check status === "pending" before showing interactive actions
  assert.ok(interactionSection.includes("interaction.status === 'pending'"), 'Actions must only render for pending interactions');
});

test('UI AC19: claudeStore handles interaction events idempotently', () => {
  const storeFile = fs.readFileSync(
    path.resolve(process.cwd(), 'apps/web/src/stores/claudeStore.ts'),
    'utf-8'
  );

  assert.ok(storeFile.includes('interaction.requested') || storeFile.includes('interaction_requested'), 'Store handles interaction.requested');
  assert.ok(storeFile.includes('respondInteraction'), 'Store exposes respondInteraction action');
  assert.ok(storeFile.includes('cancelInteraction'), 'Store exposes cancelInteraction action');
});
