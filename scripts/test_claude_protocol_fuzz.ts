import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NativeFrameDecoder } from '../apps/api/src/services/claude/nativeFrameDecoder.js';

const frames = [
  { type: 'assistant', message: { id: 'm-1', content: [{ type: 'text', text: 'Tiếng Việt 🧑‍💻' }] } },
  { type: 'stream_event', event: { type: 'message_stop' } },
];
const ndjson = frames.map(frame => JSON.stringify(frame)).join('\n') + '\n';

function decode(chunks: Buffer[], finish = true) {
  const decoder = new NativeFrameDecoder();
  const records = chunks.flatMap(chunk => decoder.push(chunk));
  if (finish) records.push(...decoder.finish());
  return records;
}

test('every byte boundary preserves UTF-8 and NDJSON frame identity', () => {
  const bytes = Buffer.from(ndjson);
  for (let split = 0; split <= bytes.length; split++) {
    const records = decode([bytes.subarray(0, split), bytes.subarray(split)]);
    assert.deepEqual(records, frames.map(frame => ({ kind: 'frame', frame })), `split ${split}`);
  }
});

test('one-byte chunks, many records per chunk and missing final newline decode identically', () => {
  const bytes = Buffer.from(ndjson);
  assert.deepEqual(decode([...bytes].map(byte => Buffer.from([byte]))), frames.map(frame => ({ kind: 'frame', frame })));
  assert.deepEqual(decode([bytes]), frames.map(frame => ({ kind: 'frame', frame })));
  assert.deepEqual(decode([Buffer.from(ndjson.trimEnd())]), frames.map(frame => ({ kind: 'frame', frame })));
});

test('malformed and abruptly truncated records become bounded diagnostics', () => {
  const malformed = decode([Buffer.from('{"type":}\n')]);
  assert.equal(malformed.length, 1);
  assert.equal(malformed[0].kind, 'diagnostic');
  assert.equal(malformed[0].code, 'malformed_json');
  assert.ok(malformed[0].preview.length <= 120);

  const truncated = decode([Buffer.from('{"type":"assistant"')]);
  assert.equal(truncated.length, 1);
  assert.equal(truncated[0].kind, 'diagnostic');
  assert.equal(truncated[0].code, 'truncated_json');
});

test('oversized native lines are rejected without retaining unbounded raw payloads', () => {
  const decoder = new NativeFrameDecoder({ maxLineBytes: 64 });
  const secret = 'sensitive-value-not-for-preview';
  const records = [...decoder.push(Buffer.from(JSON.stringify({ type: 'unknown', secret, padding: 'x'.repeat(200) }) + '\n')), ...decoder.finish()];
  assert.equal(records.length, 1);
  assert.equal(records[0].kind, 'diagnostic');
  assert.equal(records[0].code, 'line_too_large');
  assert.doesNotMatch(records[0].preview, /sensitive-value-not-for-preview/);
});

test('near-limit records remain linear under one-byte chunking', () => {
  const payload = JSON.stringify({ type: 'assistant', message: { id: 'stress', content: [] }, pad: 'x'.repeat(256 * 1024) }) + '\n';
  const bytes = Buffer.from(payload);
  const decoder = new NativeFrameDecoder({ maxLineBytes: bytes.length + 16 });
  const started = performance.now();
  const records = [];
  for (const byte of bytes) records.push(...decoder.push(Uint8Array.of(byte)));
  records.push(...decoder.finish());
  const elapsedMs = performance.now() - started;
  assert.equal(records.length, 1);
  assert.equal(records[0].kind, 'frame');
  assert.ok(elapsedMs < 2000, `one-byte decode took ${elapsedMs.toFixed(1)}ms`);
});
