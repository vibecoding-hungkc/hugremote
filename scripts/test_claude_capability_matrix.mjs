import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const root = resolve('.');
const evidenceRoot = process.env.CLAUDE_PARITY_EVIDENCE_ROOT
  ? resolve(process.env.CLAUDE_PARITY_EVIDENCE_ROOT)
  : resolve(homedir(), '.hermes/cache/scratch/claude-parity-m0');
const matrixPath = resolve(root, 'docs/claude/response-parity-matrix.json');
const reportPath = resolve(root, 'docs/claude/response-protocol-v2.1.308.md');
const manifestPath = resolve(root, 'docs/claude/response-evidence-manifest-v2.1.308.json');
const allowedStatuses = new Set(['supported', 'partially-supported', 'unsupported', 'not-applicable', 'unverified']);
const allowedEvidenceKinds = new Set(['artifact', 'runtime', 'hugremote']);
const expectedPins = {
  cli: '356733f185fa988e6bf3aa9a555269fdd167982a2e2a80d3c8a78037bb92ad58',
  extension: '59c875324e0d0cfcc0977896096ad36eb448d002e86bb54494d2a65fabf80df2',
};
const expectedSourceHashes = {
  'apps/api/src/routes/api.ts': '88aadf0f2aeedd055bc75974b9fff1ade26e9a99e1426c63a75a2f8266f87e17',
  'apps/api/src/services/claudeService.ts': '2e0eb3c7399efbb318becceb86d3f93b8e9e4d8999df845a1517739803cadb26',
  'official-cli:claude-2.1.308': expectedPins.cli,
  'official-vsix:extension/extension.js': 'f0e1eb4ca34b00edcaebba7544d67df31317aefee726698efa24a07083ebec81',
  'official-vsix:extension/webview/index.js': 'c1f17b25dcc10e1d22290f2bbd960d7dd9016907adf50e12db1206a929d61f9c',
  'packages/shared/src/types/claude.ts': '86f0a75135508c9478bccd2c68c255f46fa24ddd04bca26dd96ac93e9d449666',
};
const expectedCapabilityIds = [
  'agent.parent-namespace',
  'agent.task-lifecycle',
  'block.document',
  'block.image',
  'block.redacted-thinking',
  'block.server-tool-use',
  'block.text',
  'block.thinking',
  'block.tool-result',
  'block.tool-use',
  'block.unknown-fallback',
  'delta.citations',
  'delta.compaction',
  'delta.input-json',
  'delta.signature',
  'delta.text',
  'delta.thinking',
  'frame.assistant',
  'frame.auth-status',
  'frame.command-lifecycle',
  'frame.conversation-reset',
  'frame.prompt-suggestion',
  'frame.rate-limit-event',
  'frame.result',
  'frame.system',
  'frame.tool-progress',
  'frame.tool-use-summary',
  'frame.user',
  'interaction.permission',
  'interaction.runtime-roundtrip',
  'interaction.user-dialog',
  'reconnect.pending-interactions',
  'reconnect.sequence-replay',
  'reconnect.snapshot-future',
  'stream.content-block-delta',
  'stream.content-block-start',
  'stream.content-block-stop',
  'stream.message-delta',
  'stream.message-start',
  'stream.message-stop',
  'system.account-usage',
  'system.compact-boundary',
  'system.native-context-usage',
  'system.status',
  'system.task-progress',
  'tool.generic-renderer',
  'tool.lifecycle',
  'transport.control-duplex',
  'transport.partial-local',
  'transport.partial-ssh',
];
const expectedRuntimeFixtures = [
  'CLI-CTRL-CONTEXT-001',
  'CLI-CTRL-COST-001',
  'CLI-CTRL-INIT-001',
  'CLI-CTRL-MODELS-001',
  'CLI-CTRL-USAGE-001',
  'CLI-HELP-001',
  'CLI-VERSION-001',
];
const expectedCliEvidenceSha256 = '13239ee369e47474b39e262769f9a78d2579e7531900f4126221286ab7a072a8';
const primaryArtifactPaths = {
  'official-cli:claude-2.1.308': resolve(homedir(), '.local/share/claude/versions/2.1.308'),
  'official-vsix:extension/extension.js': resolve(evidenceRoot, 'vsix/extracted/extension/extension.js'),
  'official-vsix:extension/webview/index.js': resolve(evidenceRoot, 'vsix/extracted/extension/webview/index.js'),
};
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

const sha256 = value => createHash('sha256').update(value).digest('hex');
const matrix = JSON.parse(await readFile(matrixPath, 'utf8'));
const report = await readFile(reportPath, 'utf8');
let manifest;

function validateMatrix(candidate, evidenceManifest) {
  assert.equal(candidate.schemaVersion, 1);
  assert.equal(candidate.baseline?.cli?.version, '2.1.308');
  assert.equal(candidate.baseline?.cli?.sha256, expectedPins.cli, 'unexpected CLI digest');
  assert.equal(candidate.baseline?.extension?.version, '2.1.308');
  assert.equal(candidate.baseline?.extension?.platform, 'linux-x64');
  assert.equal(candidate.baseline?.extension?.sha256, expectedPins.extension, 'unexpected VSIX digest');
  assert.match(candidate.baseline?.extension?.sourceUrl || '', /^https:\/\//);
  assert.equal(evidenceManifest.cliSha256, expectedPins.cli);
  assert.equal(evidenceManifest.vsixSha256, expectedPins.extension);
  assert.deepEqual(evidenceManifest.sourceHashes, expectedSourceHashes, 'source hash trust roots drift');
  assert.deepEqual([...evidenceManifest.expectedCapabilityIds].sort(), [...expectedCapabilityIds].sort(), 'manifest capability IDs drift');
  assert.deepEqual([...evidenceManifest.runtimeFixtures].sort(), [...expectedRuntimeFixtures].sort(), 'runtime fixture trust roots drift');

  assert.equal(candidate.capabilities.length, expectedCapabilityIds.length, 'capability count drift');
  assert.deepEqual(candidate.capabilities.map(row => row.id).sort(), [...expectedCapabilityIds].sort(), 'capability IDs drift');
  assert.equal(candidate.capabilities.filter(row => row.releaseScope).length, 48, 'release scope policy drift');
  assert.equal(candidate.capabilities.filter(row => !row.releaseScope).length, 2, 'out-of-scope policy drift');
  assert.deepEqual(
    candidate.capabilities.filter(row => !row.releaseScope).map(row => row.id).sort(),
    ['interaction.runtime-roundtrip', 'system.account-usage'],
  );

  const ids = new Set();
  for (const row of candidate.capabilities) {
    assert.match(row.id || '', /^[a-z0-9][a-z0-9.-]+$/, 'invalid capability id');
    assert.ok(!ids.has(row.id), `duplicate capability id ${row.id}`);
    ids.add(row.id);
    assert.ok(['frame', 'stream-event', 'content-block', 'delta', 'tool', 'agent', 'interaction', 'system', 'transport', 'reconnect'].includes(row.family), `${row.id}: invalid family`);
    assert.ok(allowedStatuses.has(row.status), `${row.id}: invalid status`);
    assert.equal(typeof row.releaseScope, 'boolean', `${row.id}: releaseScope must be boolean`);
    assert.ok(['verified', 'static-only', 'hugremote-only'].includes(row.packageEvidence), `${row.id}: invalid packageEvidence`);
    assert.ok(Array.isArray(row.evidence) && row.evidence.length > 0, `${row.id}: missing evidence`);
    if (row.packageEvidence === 'verified') {
      assert.ok(row.evidence.some(e => ['artifact', 'runtime'].includes(e.kind) && e.certainty === 'verified'), `${row.id}: verified package claim lacks primary evidence`);
    }
    if (row.packageEvidence === 'hugremote-only') {
      assert.ok(row.evidence.every(e => e.kind === 'hugremote'), `${row.id}: hugremote-only row has external evidence`);
    }
    for (const evidence of row.evidence) {
      assert.ok(allowedEvidenceKinds.has(evidence.kind), `${row.id}: invalid evidence kind`);
      assert.ok(typeof evidence.source === 'string' && evidence.source.length > 0, `${row.id}: missing evidence source`);
      assert.ok(['verified', 'inferred'].includes(evidence.certainty), `${row.id}: invalid certainty`);
      if (evidence.kind === 'artifact') {
        const anchor = evidenceManifest.artifactAnchors?.[evidence.source]?.[String(evidence.byteOffset)];
        assert.ok(anchor, `${row.id}: unresolved artifact anchor ${evidence.source}:${evidence.byteOffset}`);
        assert.equal(anchor.verified, true, `${row.id}: artifact anchor not verified`);
      } else if (evidence.kind === 'runtime') {
        assert.ok(evidenceManifest.runtimeFixtures.includes(evidence.fixtureId), `${row.id}: unknown runtime fixture ${evidence.fixtureId}`);
      } else {
        const anchor = evidenceManifest.hugremoteAnchors?.[evidence.source]?.[String(evidence.line)];
        assert.ok(anchor, `${row.id}: unresolved HugRemote anchor ${evidence.source}:${evidence.line}`);
        assert.equal(anchor.verified, true, `${row.id}: HugRemote anchor not verified`);
      }
    }
  }
  assert.deepEqual(candidate.capabilities.filter(row => row.releaseScope && row.status === 'unverified').map(row => row.id), []);
}

await test('matrix, report and compact evidence manifest exist', async () => {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.ok(report.length > 1000, 'protocol report is unexpectedly short');
});

await test('matrix validates against exact pins, IDs, scope policy and evidence manifest', () => {
  validateMatrix(matrix, manifest);
});

await test('compact evidence anchors remain bound to repository sources', async () => {
  for (const [source, sourceInfo] of Object.entries(manifest.hugremoteAnchors)) {
    const data = await readFile(resolve(root, source));
    assert.equal(sha256(data), expectedSourceHashes[source], `${source}: source hash drift`);
    const lines = data.toString('utf8').split('\n');
    for (const [line, anchor] of Object.entries(sourceInfo)) {
      const start = Number(line);
      assert.ok(lines[start - 1]?.includes(anchor.needle), `${source}:${line}: line needle mismatch`);
      if (anchor.lineEnd !== undefined) {
        assert.ok(Number.isInteger(anchor.lineEnd) && anchor.lineEnd >= start && anchor.lineEnd <= lines.length, `${source}:${line}: invalid audited range`);
      }
    }
  }
});

await test('official anchors resolve against independently pinned primary artifacts', async () => {
  const vsix = await readFile(resolve(evidenceRoot, 'vsix/artifact/Anthropic.claude-code-2.1.308@linux-x64.vsix'));
  assert.equal(sha256(vsix), expectedPins.extension, 'primary VSIX digest drift');
  for (const [source, anchors] of Object.entries(manifest.artifactAnchors)) {
    const data = await readFile(primaryArtifactPaths[source]);
    assert.equal(sha256(data), expectedSourceHashes[source], `${source}: primary source hash drift`);
    for (const [offsetText, anchor] of Object.entries(anchors)) {
      const offset = Number(offsetText);
      assert.ok(Number.isInteger(offset) && offset >= 0 && offset < data.length, `${source}: invalid offset`);
      assert.equal(typeof anchor.needle, 'string');
      assert.ok(anchor.needle.length >= 8, `${source}:${offset}: needle too short`);
      const needle = Buffer.from(anchor.needle, 'utf8');
      assert.ok(data.subarray(offset, offset + needle.length).equals(needle), `${source}:${offset}: byte needle mismatch`);
      assert.equal(anchor.verified, true);
    }
  }
  const fixtureIndex = await readFile(resolve(evidenceRoot, 'cli/evidence.json'));
  assert.equal(sha256(fixtureIndex), expectedCliEvidenceSha256, 'CLI fixture index digest drift');
  const fixtureIds = JSON.parse(fixtureIndex).runtime_fixtures.map(fixture => fixture.fixture_id).sort();
  assert.deepEqual(fixtureIds, [...expectedRuntimeFixtures].sort(), 'CLI fixture index IDs drift');
});

await test('validator rejects fabricated hashes, sources, offsets, fixtures and scope policy', () => {
  const clone = value => structuredClone(value);
  const mutations = [
    (candidate) => { candidate.baseline.cli.sha256 = '0'.repeat(64); },
    (candidate) => { candidate.baseline.extension.sha256 = 'f'.repeat(64); },
    (candidate) => { candidate.capabilities.forEach(row => { row.releaseScope = false; }); },
    (candidate) => { candidate.capabilities[0].id = 'fabricated.capability'; },
    (candidate) => { candidate.capabilities[0].evidence[0].source = 'nonexistent-artifact'; },
    (candidate) => { const e = candidate.capabilities.find(row => row.evidence.some(x => x.kind === 'artifact')).evidence.find(x => x.kind === 'artifact'); e.byteOffset = 1; },
    (candidate) => { const e = candidate.capabilities.find(row => row.evidence.some(x => x.kind === 'runtime')).evidence.find(x => x.kind === 'runtime'); e.fixtureId = 'UNKNOWN-FIXTURE'; },
    (_candidate, evidenceManifest) => { evidenceManifest.sourceHashes['official-vsix:extension/webview/index.js'] = 'a'.repeat(64); },
    (candidate, evidenceManifest) => {
      const oldId = candidate.capabilities[1].id;
      const newId = 'coordinated.fabricated-capability';
      candidate.capabilities[1].id = newId;
      evidenceManifest.expectedCapabilityIds[evidenceManifest.expectedCapabilityIds.indexOf(oldId)] = newId;
    },
    (candidate, evidenceManifest) => {
      const evidence = candidate.capabilities.find(row => row.evidence.some(item => item.kind === 'runtime')).evidence.find(item => item.kind === 'runtime');
      evidenceManifest.runtimeFixtures[evidenceManifest.runtimeFixtures.indexOf(evidence.fixtureId)] = 'COORDINATED-FIXTURE';
      evidence.fixtureId = 'COORDINATED-FIXTURE';
    },
  ];
  for (const mutate of mutations) {
    const candidate = clone(matrix);
    const evidenceManifest = clone(manifest);
    mutate(candidate, evidenceManifest);
    assert.throws(() => validateMatrix(candidate, evidenceManifest));
  }
});

await test('documentation contains evidence boundaries and no secrets or local usernames', () => {
  for (const heading of ['Verified', 'Inferred', 'Unverified', 'HugRemote gap', 'Interaction boundary']) {
    assert.match(report, new RegExp(`#{2,4}\\s+${heading}`, 'i'), `missing ${heading} section`);
  }
  const combined = `${JSON.stringify(matrix)}\n${JSON.stringify(manifest)}\n${report}`;
  assert.doesNotMatch(combined, /(?:api[_-]?key|password|authorization|bearer)\s*[:=]\s*["']?[^\s"']{8,}/i);
  assert.doesNotMatch(combined, /\/home\/(?!\[REDACTED\])[^/\s]+/);
});

if (failed) process.exitCode = 1;
