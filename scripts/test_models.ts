import test from 'node:test';
import assert from 'node:assert/strict';
import { claudeService } from '../server/src/services/claudeService.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

test('claudeService.getAvailableModels parses CLI and fallback properly', async () => {
  // Test local / fallback or cli
  const res = await claudeService.getAvailableModels('server-local');
  assert.ok(res, 'Result should exist');
  assert.ok(['settings', 'cli', 'fallback'].includes(res.source), `Source should be valid: ${res.source}`);
  assert.ok(Array.isArray(res.models), 'Models should be an array');
  assert.ok(res.models.length > 0, 'Models should not be empty');

  // Verify model items structure
  for (const m of res.models) {
    assert.ok(typeof m.id === 'string' && m.id.length > 0, 'Model id should be valid');
    assert.ok(typeof m.title === 'string' && m.title.length > 0, 'Model title should be valid');
    assert.ok(typeof m.prefix === 'string' && m.prefix.length > 0, 'Model prefix should be valid');
    assert.ok(typeof m.desc === 'string', 'Model desc should be valid');
  }

  // Verify default model presence
  const hasDefault = res.models.some((m) => m.id === 'default');
  assert.ok(hasDefault, 'Default model should be present');
});

test('claudeService parses settings.json with ANTHROPIC_BASE_URL (Mechanism 1)', async () => {
  const settingsDir = path.join(os.homedir(), '.claude');
  const settingsPath = path.join(settingsDir, 'settings.json');
  const backupPath = path.join(settingsDir, 'settings.json.bak_test');

  const hadSettings = fs.existsSync(settingsPath);
  if (hadSettings) {
    fs.copyFileSync(settingsPath, backupPath);
  } else {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  try {
    // Write mock settings with custom router & models
    const mockSettings = {
      env: {
        ANTHROPIC_BASE_URL: 'https://llm-router.test.com/v1',
        ANTHROPIC_AUTH_TOKEN: 'mock-token',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'custom-sonnet-model',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'custom-opus-model',
      },
      availableModels: ['extra-model-1', 'extra-model-2'],
    };
    fs.writeFileSync(settingsPath, JSON.stringify(mockSettings));

    const res = await claudeService.getAvailableModels('server-local');
    assert.strictEqual(res.source, 'settings', 'Should identify source as settings');
    assert.ok(res.models.some((m) => m.id === 'default'), 'Has default model');
    assert.ok(res.models.some((m) => m.id === 'sonnet' && m.desc.includes('custom-sonnet-model')), 'Has custom sonnet');
    assert.ok(res.models.some((m) => m.id === 'opus' && m.desc.includes('custom-opus-model')), 'Has custom opus');
    assert.ok(res.models.some((m) => m.id === 'extra-model-1'), 'Has extra-model-1');
  } finally {
    if (hadSettings) {
      fs.copyFileSync(backupPath, settingsPath);
      fs.unlinkSync(backupPath);
    } else {
      try { fs.unlinkSync(settingsPath); } catch (_) {}
    }
  }
});

test('claudeService parses remote server Claude CLI models via SSH', async () => {
  const res = await claudeService.getAvailableModels('server-ssh-claude-server');
  assert.ok(res, 'Remote result should exist');
  assert.ok(res.models.length > 0, 'Should return models for remote server');
  // Remote server hungnd@localhost:2222 has standard Claude CLI installed without custom base url
  assert.ok(res.source === 'cli' || res.source === 'fallback', `Source should be cli or fallback: ${res.source}`);
  assert.ok(res.models.some((m) => m.id === 'default'), 'Remote should have default model');
  assert.ok(res.models.some((m) => m.id === 'sonnet'), 'Remote should have sonnet');
});


