import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const sourceBin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bin');
const configKeys = ['HOST', 'PORT', 'BASE_PATH', 'AUTH_MODE', 'SESSION_SECRET', 'APP_URL',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_ALLOWED_EMAILS', 'WORKSPACE_ROOT', 'ALLOWED_ROOT'];

function fixture(t, contents, env = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-env-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, 'home');
  const bin = path.join(root, 'bin');
  fs.mkdirSync(path.join(home, '.config', 'hugremote'), { recursive: true });
  fs.mkdirSync(bin);
  for (const name of fs.readdirSync(sourceBin)) {
    if (name.endsWith('.js') && !name.endsWith('.test.js')) {
      fs.copyFileSync(path.join(sourceBin, name), path.join(bin, name));
    }
  }
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
  const config = path.join(home, '.config', 'hugremote', '.env');
  if (contents !== undefined) fs.writeFileSync(config, contents);
  fs.mkdirSync(path.join(root, 'server', 'dist'), { recursive: true });
  // A harmless import probe: never start the actual server or listen on a socket.
  fs.writeFileSync(path.join(root, 'server', 'dist', 'index.js'),
    'console.log(JSON.stringify(process.env));');
  const childEnv = { ...process.env };
  for (const key of [...configKeys, 'AUTH_PASSWORD', 'NODE_OPTIONS']) delete childEnv[key];
  Object.assign(childEnv, { HOME: home, USERPROFILE: home }, env);
  return {
    root, home, config,
    run(args = []) {
      return spawnSync(process.execPath, [path.join(bin, 'hugremote.js'), ...args], {
        env: childEnv, encoding: 'utf8', timeout: 5000,
      });
    },
  };
}

function output(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('parser accepts quoted/plain values, comments, whitespace, and CRLF without executing or interpolating', t => {
  const f = fixture(t, undefined);
  const marker = path.join(f.root, 'must-not-exist');
  const unsafe = `$(touch ${marker}) \`touch ${marker}\` $HOME ${'${PORT}'} \\n`;
  fs.writeFileSync(f.config, [
    '# configuration', '   ', ' PORT = 8123 # comment',
    'AUTH_MODE = "password" # comment', "HOST='127.0.0.1'",
    `SESSION_SECRET="${unsafe} # literal"`,
    'GOOGLE_CLIENT_ID=plain#literal', 'GOOGLE_CLIENT_SECRET=hello=world',
    'GOOGLE_ALLOWED_EMAILS=one@example.com,two@example.com',
    'NODE_OPTIONS=--require=/evil.js', 'PATH=/evil', 'AUTH_PASSWORD=ignored',
  ].join('\r\n'));
  const result = output(f.run());
  assert.equal(result.PORT, '8123');
  assert.equal(result.AUTH_MODE, 'password');
  assert.equal(result.HOST, '127.0.0.1');
  assert.equal(result.SESSION_SECRET, `${unsafe} # literal`);
  assert.equal(result.GOOGLE_CLIENT_ID, 'plain#literal');
  assert.equal(result.GOOGLE_CLIENT_SECRET, 'hello=world');
  assert.equal(result.GOOGLE_ALLOWED_EMAILS, 'one@example.com,two@example.com');
  assert.equal(result.NODE_OPTIONS, undefined);
  assert.notEqual(result.PATH, '/evil');
  assert.equal(result.AUTH_PASSWORD, undefined);
  assert.equal(fs.existsSync(marker), false);
});

test('malformed known assignments fail clearly before any server import, including overridden values', t => {
  for (const contents of ['AUTH_MODE password', 'export AUTH_MODE=password',
    'AUTH_MODE="password', "AUTH_MODE='password' junk", 'SESSION_SECRET=bad\0value']) {
    const f = fixture(t, contents, { AUTH_MODE: 'password' });
    const result = f.run();
    assert.equal(result.status, 1, contents);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.includes(f.config), result.stderr);
    assert.match(result.stderr, /line 1/);
    assert.doesNotMatch(result.stderr, /bad\0value/);
  }
});

test('invalid known typed defaults error rather than silently disabling authentication', t => {
  for (const contents of ['AUTH_MODE=passwrod', 'AUTH_MODE=', 'PORT=123abc', 'PORT=65536',
    'PORT=-1', 'APP_URL=not-a-url', 'APP_URL=javascript:alert(1)']) {
    const f = fixture(t, contents);
    const result = f.run();
    assert.equal(result.status, 1, contents);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.includes(f.config), result.stderr);
    assert.match(result.stderr, /line 1/);
    assert.ok(result.stderr.includes(contents.split('=')[0]));
  }
});

test('CLI loads user config before importing the server', t => {
  const result = output(fixture(t, 'PORT=8123\nAUTH_MODE=password\nBASE_PATH=/remote\n').run());
  assert.equal(result.PORT, '8123');
  assert.equal(result.AUTH_MODE, 'password');
  assert.equal(result.BASE_PATH, '/remote');
});

test('process environment overrides .env and CLI flags override both', t => {
  const f = fixture(t, 'PORT=8123\nAUTH_MODE=password\nBASE_PATH=/from-file\n', {
    PORT: '8333', BASE_PATH: '/from-environment',
  });
  let result = output(f.run());
  assert.equal(result.PORT, '8333');
  assert.equal(result.BASE_PATH, '/from-environment');

  result = output(f.run(['--port', '8444', '--base-path', '/from-cli']));
  assert.equal(result.PORT, '8444');
  assert.equal(result.BASE_PATH, '/from-cli');
});

test('empty documented BASE_PATH is allowed', t => {
  const result = output(fixture(t, 'AUTH_MODE=password\nBASE_PATH=\n').run());
  assert.equal(result.BASE_PATH, '');
});
