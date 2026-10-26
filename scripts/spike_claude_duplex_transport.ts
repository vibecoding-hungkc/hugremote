import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';

test('Spike S1: Positional -p without stream-json input does not negotiate control protocol', async () => {
  const proc = spawn('claude', ['-p', '--input-format=stream-json', '--output-format=stream-json'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const initMsg = JSON.stringify({
    type: 'control_request',
    request_id: 'probe-s1',
    request: { subtype: 'initialize' }
  }) + '\n';

  proc.stdin.write(initMsg);
  proc.stdin.end();

  let stderr = '';
  proc.stderr.on('data', (d: any) => { stderr += d.toString(); });

  const exitCode = await new Promise<number | null>(resolve => {
    proc.on('close', resolve);
  });

  // Fails because --verbose is strictly required by the CLI when using stream-json
  assert.equal(exitCode, 1);
  assert.match(stderr, /--output-format=stream-json requires --verbose/i);
});

test('Spike S2 & S3: SDK duplex stream-json completes control handshake and stays alive while stdin open', async () => {
  const proc = spawn(
    'claude',
    ['-p', '--verbose', '--input-format=stream-json', '--output-format=stream-json', '--permission-mode', 'dontAsk'],
    { stdio: ['pipe', 'pipe', 'pipe'] }
  );

  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', (d: any) => { stdout += d.toString(); });
  proc.stderr.on('data', (d: any) => { stderr += d.toString(); });

  const initMsg = JSON.stringify({
    type: 'control_request',
    request_id: 'probe-s2',
    request: { subtype: 'initialize' }
  }) + '\n';

  proc.stdin.write(initMsg);

  // Wait for initialize control_response
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for initialize')), 6000);
    const check = setInterval(() => {
      if (stdout.includes('"control_response"') && stdout.includes('"probe-s2"')) {
        clearInterval(check);
        clearTimeout(timer);
        resolve();
      }
    }, 50);
  });

  // Verify process remains alive while stdin is kept open
  assert.equal(proc.killed, false);
  assert.equal(proc.exitCode, null);

  // Close stdin and verify graceful exit 0
  proc.stdin.end();

  const exitCode = await new Promise<number | null>(resolve => {
    proc.on('close', resolve);
  });

  assert.equal(exitCode, 0);
  assert.ok(stdout.includes('"control_response"'));
  assert.ok(stdout.includes('"subtype":"success"'));
});
