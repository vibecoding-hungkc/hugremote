import assert from 'node:assert/strict';
import { parseCliModelOutput } from '../apps/api/src/services/claudeService.js';

const text =
  'Current model: `Opus 5.5 (default)`\nUsage: /model <name>. Available: sonnet, opus, haiku, fable, best, sonnet[1m], opus[1m], fable[1m], opusplan, default, or a full model ID.';

// 1. Default follows what the CLI reports, "(default)" suffix stripped
const plain = parseCliModelOutput(text)!;
assert.equal(plain.source, 'cli');
assert.equal(plain.defaultModel, 'Opus 5.5');
assert.equal(plain.models[0].title, 'Default (Opus 5.5)');

// 2. Exactly the aliases the CLI lists (+ default once), no "a full model ID" artefact
assert.deepEqual(
  plain.models.map((m) => m.id),
  ['default', 'sonnet', 'opus', 'haiku', 'fable', 'best', 'sonnet[1m]', 'opus[1m]', 'fable[1m]', 'opusplan']
);

// 3. [1m] alias keeps exact prefix so `--model sonnet[1m]` is not collapsed to `sonnet`
const s1m = plain.models.find((m) => m.id === 'sonnet[1m]')!;
assert.equal(s1m.prefix, 'sonnet[1m]');
assert.match(s1m.title, /1M/);

// 4. env only decorates descriptions (what the alias resolves to), never adds/removes entries
const withEnv = parseCliModelOutput(text.replace('Opus 5.5', 'hermes-claude[1m]'), {
  ANTHROPIC_DEFAULT_SONNET_MODEL: 'hermes-claude[1m]',
});
assert.equal(withEnv!.models.length, plain.models.length);
assert.match(withEnv!.models.find((m) => m.id === 'sonnet')!.desc, /hermes-claude\[1m\]/);
assert.doesNotMatch(withEnv!.models.find((m) => m.id === 'opus')!.desc, /hermes/);

// 5. Unparseable output -> null so caller falls back instead of inventing models
assert.equal(parseCliModelOutput('Not logged in'), null);
console.log('claude models parser tests PASSED');
