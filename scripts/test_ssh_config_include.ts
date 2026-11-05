import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Isolated HOME: never read or modify the user's real SSH configuration.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-ssh-include-'));
const ssh = path.join(root, '.ssh');
fs.mkdirSync(path.join(ssh, 'conf.d'), { recursive: true });
fs.mkdirSync(path.join(ssh, 'nested'), { recursive: true });
fs.writeFileSync(path.join(ssh, 'config'), [
  'Include conf.d/*.conf',
  'Host direct',
  '  HostName direct.example',
  '  User directuser',
  'Include nested/extra.conf',
  'Include nested/cycle.conf',
  '# Include conf.d/ignored.conf',
].join('\n'));
fs.writeFileSync(path.join(ssh, 'conf.d', 'a.conf'), 'Host included-one\n  HostName one.example\n  User alice\n  Port 2222\n  IdentityFile ~/.ssh/id_one\n  # Workspace /srv/one\n');
fs.writeFileSync(path.join(ssh, 'conf.d', 'b.conf'), 'Host included-two alias-two\n  HostName two.example\n  User bob\n');
fs.writeFileSync(path.join(ssh, 'conf.d', 'ignored.conf'), 'Host included-three\n  HostName three.example\n');
fs.writeFileSync(path.join(ssh, 'nested', 'extra.conf'), 'Include ../conf.d/a.conf\nHost nested\n  HostName nested.example\n');
fs.writeFileSync(path.join(ssh, 'nested', 'cycle.conf'), 'Include cycle.conf\nHost cycle-safe\n  HostName cycle.example\n');

try {
  const tsx = path.resolve('node_modules/tsx/dist/cli.mjs');
  const config = fileURLToPath(new URL('../apps/api/src/config.ts', import.meta.url));
  const appModule = fileURLToPath(new URL('../apps/api/src/app.ts', import.meta.url));
  const probe = `import { parseSshConfig, updateSshConfigHostWorkspace } from ${JSON.stringify(config)}; import { createApp } from ${JSON.stringify(appModule)}; (async () => { const app = await createApp(); try { await app.ready(); updateSshConfigHostWorkspace('included-two', '/srv/two'); const updateRes = await app.inject({method:'POST',url:'/api/servers',payload:{name:'included-two',host:'two-updated.example',user:'bob',port:2229,workspace:'/srv/two'}}); if(updateRes.statusCode!==200) throw Error('POST /api/servers: '+updateRes.statusCode); const res = await app.inject({method:'GET',url:'/api/servers'}); if(res.statusCode!==200) throw Error('GET /api/servers: '+res.statusCode); console.log('SSH_SERVERS_JSON='+JSON.stringify(res.json().servers.map(({name,host,user,port,workspace,key})=>({name,host,user,port,workspace,key})))); } finally { await app.close(); } })().catch(error => { console.error(error); process.exitCode = 1; });`;
  const proc = spawnSync(process.execPath, [tsx, '--eval', probe], { cwd: process.cwd(), env: { ...process.env, HOME: root }, encoding: 'utf8', timeout: 8000 });
  assert.equal(proc.status, 0, proc.stderr);
  const line = proc.stdout.split('\n').find(line => line.startsWith('SSH_SERVERS_JSON='));
  assert.ok(line, 'GET /api/servers response marker missing');
  const servers = JSON.parse(line.slice('SSH_SERVERS_JSON='.length));
  const byName = new Map<string, any>(servers.map((s: any) => [s.name, s]));
  for (const name of ['direct', 'included-one', 'included-two', 'nested', 'cycle-safe']) assert.ok(byName.has(name), `${name} missing from /api/servers source`);
  assert.equal(byName.get('included-one').host, 'one.example');
  assert.equal(byName.get('included-one').user, 'alice');
  assert.equal(byName.get('included-one').port, 2222);
  assert.equal(byName.get('included-one').workspace, '/srv/one');
  assert.equal(byName.get('included-one').key, '~/.ssh/id_one');
  assert.equal(byName.get('included-two').host, 'two-updated.example');
  assert.equal(byName.get('included-two').port, 2229);
  assert.equal(byName.get('included-two').workspace, '/srv/two');
  assert.ok(byName.has('included-three'), 'wildcard Include must import every matching file');
  assert.equal(byName.get('nested').host, 'nested.example');
  assert.equal(byName.get('direct').host, 'direct.example');
  assert.equal(byName.get('direct').user, 'directuser');
  assert.equal(byName.get('direct').workspace, '/home/directuser');
  assert.ok(!byName.has('*.example'), 'wildcard Host stanza is a default, not a server');
  assert.equal(byName.get('cycle-safe').host, 'cycle.example');
  assert.equal(servers.filter((s: any) => s.name === 'included-one').length, 1, 'repeated Include should not duplicate server');
  console.log('PASS SSH Include glob, nested relative Include, direct hosts, and recursion guard');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
