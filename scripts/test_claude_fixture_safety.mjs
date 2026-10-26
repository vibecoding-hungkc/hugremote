import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

const root = resolve('.');
const corpusRoot = resolve(root, 'fixtures/claude-protocol/2.1.308');
const manifestPath = resolve(corpusRoot, 'manifest.json');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const requiredCoverage = new Set([
  'text',
  'thinking',
  'split-snapshot',
  'sequential-tools',
  'parallel-tools',
  'tool-error',
  'cancellation',
  'child-agent',
  'unknown-frame',
  'malformed-frame',
  'truncated-frame',
  'interaction-permission',
  'interaction-user-dialog',
  'system-status',
  'system-compact-boundary',
  'system-task-progress',
]);
const allowedEvidenceClasses = new Set(['runtime-verified', 'static-derived', 'synthetic-adversarial']);
const forbiddenPatterns = [
  { name: 'credential assignment', pattern: /(?:api[_-]?key|password|authorization|bearer|access[_-]?token|refresh[_-]?token)\s*[:=]\s*["']?[^\s"']{8,}/i },
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'real Unix home path', pattern: /\/home\/(?!\[REDACTED\])[^/\s"']+/ },
  { name: 'real macOS home path', pattern: /\/Users\/(?!\[REDACTED\])[^/\s"']+/ },
  { name: 'real Windows home path', pattern: /[A-Za-z]:\\Users\\(?!\[REDACTED\])[^\\\s"']+/ },
  { name: 'production-like session identifier', pattern: /\b(?:session|conversation|request)[_-]?(?:id)?["']?\s*[:=]\s*["'](?!fixture-|synthetic-|run-|msg-|tool-|agent-)[A-Za-z0-9_-]{12,}/i },
];
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

let manifest;
await test('fixture manifest exists and has a pinned sanitized schema', async () => {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.protocolVersion, '2.1.308');
  assert.equal(manifest.sanitizedAtProducerBoundary, true);
  assert.ok(Array.isArray(manifest.fixtures) && manifest.fixtures.length > 0, 'no fixtures declared');
});

await test('fixture IDs, files, hashes, provenance and expected semantics are complete', async () => {
  const ids = new Set();
  const files = new Set();
  for (const fixture of manifest.fixtures) {
    assert.match(fixture.id || '', /^[a-z0-9][a-z0-9.-]+$/, 'invalid fixture ID');
    assert.ok(!ids.has(fixture.id), `duplicate fixture ID ${fixture.id}`);
    ids.add(fixture.id);
    assert.match(fixture.file || '', /^[a-z0-9][a-z0-9._-]+\.jsonl$/, `${fixture.id}: invalid fixture filename`);
    assert.ok(!files.has(fixture.file), `duplicate fixture file ${fixture.file}`);
    files.add(fixture.file);
    assert.ok(!fixture.file.includes('..') && !fixture.file.includes('/') && !fixture.file.includes('\\'), `${fixture.id}: unsafe fixture path`);
    assert.ok(allowedEvidenceClasses.has(fixture.evidenceClass), `${fixture.id}: invalid evidence class`);
    assert.ok(Array.isArray(fixture.provenance) && fixture.provenance.length > 0, `${fixture.id}: missing provenance`);
    for (const source of fixture.provenance) {
      assert.equal(typeof source.source, 'string', `${fixture.id}: missing provenance source`);
      assert.ok(Number.isInteger(source.byteOffset) || typeof source.fixtureId === 'string' || source.synthetic === true, `${fixture.id}: uncheckable provenance`);
    }
    assert.ok(Array.isArray(fixture.coverage) && fixture.coverage.length > 0, `${fixture.id}: missing coverage`);
    assert.equal(typeof fixture.expectedSemantic, 'object', `${fixture.id}: missing expected semantic state`);
    assert.ok(Array.isArray(fixture.expectedClassifications) && fixture.expectedClassifications.length > 0, `${fixture.id}: missing frame classifications`);
    const data = await readFile(resolve(corpusRoot, fixture.file));
    assert.equal(sha256(data), fixture.sha256, `${fixture.id}: fixture digest drift`);
    const records = data.toString('utf8').split('\n').filter(Boolean);
    assert.equal(records.length, fixture.recordCount, `${fixture.id}: record count drift`);
    for (const [index, line] of records.entries()) {
      const record = JSON.parse(line);
      assert.ok(['frame', 'transport-chunk'].includes(record.kind), `${fixture.id}:${index + 1}: invalid record kind`);
      assert.equal(typeof record.data, record.kind === 'frame' ? 'object' : 'string', `${fixture.id}:${index + 1}: invalid record data`);
    }
  }
  const actualFiles = (await readdir(corpusRoot)).filter(name => name.endsWith('.jsonl')).sort();
  assert.deepEqual(actualFiles, [...files].sort(), 'undeclared or missing fixture files');
});

await test('corpus covers every M1 safety category', () => {
  const actual = new Set(manifest.fixtures.flatMap(fixture => fixture.coverage));
  for (const category of requiredCoverage) assert.ok(actual.has(category), `missing coverage category ${category}`);
});

await test('manifest and fixtures contain no credentials, real paths, real IDs or real prompts', async () => {
  const files = [manifestPath, ...manifest.fixtures.map(fixture => resolve(corpusRoot, fixture.file))];
  for (const file of files) {
    const normalized = resolve(file);
    assert.ok(normalized === corpusRoot || normalized.startsWith(`${corpusRoot}${sep}`), `path escapes corpus: ${relative(root, normalized)}`);
    const content = await readFile(normalized, 'utf8');
    for (const forbidden of forbiddenPatterns) {
      assert.doesNotMatch(content, forbidden.pattern, `${relative(root, file)} contains ${forbidden.name}`);
    }
    assert.doesNotMatch(content, /\b(?:hungnd|Duy Hung|nguyenhungbk96|vibecoding-hungkc)\b/i, `${relative(root, file)} contains user/account identity`);
    assert.doesNotMatch(content, /"(?:prompt|userPrompt|query)"\s*:\s*"(?!\[REDACTED\]|fixture prompt|synthetic prompt)[^"]+"/i, `${relative(root, file)} contains a non-synthetic prompt`);
  }
});

if (failed) process.exitCode = 1;
