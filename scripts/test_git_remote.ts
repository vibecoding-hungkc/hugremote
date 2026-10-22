import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';

async function main() {
  const home = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'git-remote-unit-'));
  const oldHome = process.env.HOME;
  process.env.HOME = home;
  fs.mkdirSync(path.join(home, '.ssh'));
  fs.writeFileSync(path.join(home, '.ssh/config'), 'Host git-unit\n HostName 127.0.0.1\n User unit\n');
  const { default: Fastify } = await import('fastify');
  const { apiRoutes } = await import('../apps/api/src/routes/api.js');
  const { projectService } = await import('../apps/api/src/services/projectService.js');
  const { sshPool } = await import('../apps/api/src/services/sshPool.js');
  const { gitService } = await import('../apps/api/src/services/gitService.js');
  const { parseSshConfig } = await import('../apps/api/src/config.js');
  const server = parseSshConfig().find(s => s.type === 'ssh')!;
  assert.ok(server);
  const remoteProject = { id: 'remote', serverId: server.id, rootPath: "~/repo 'quoted'", name: 'remote', updatedAt: 0 };
  const localProject = { ...remoteProject, id: 'local', serverId: 'server-local', rootPath: '/local-only' };
  projectService.getProject = (id: string) => id === 'remote' ? remoteProject : id === 'local' ? localProject : undefined;
  projectService.getActiveProject = id => id === server.id ? remoteProject : localProject;
  const commands: string[] = [];
  sshPool.executeCommand = async (target, command) => {
    assert.equal(target.id, server.id);
    commands.push(command);
    const stream = new EventEmitter() as any;
    stream.stderr = new EventEmitter();
    stream.close = () => {};
    stream.signal = () => {};
    setImmediate(() => {
      let output = '';
      if (command.includes("'--show-toplevel'")) output = '/remote/repo\n';
      else if (command.includes("'--symbolic-full-name'")) output = 'origin/main\n';
      else if (command.includes("'--abbrev-ref'")) output = 'main\n';
      else if (command.includes("'--left-right'")) output = '1\t2\n';
      else if (command.includes("'--porcelain=v1'")) output = ' M remote.txt\n';
      else if (command.includes("'--numstat'")) output = '1\t0\tremote.txt\n';
      else if (command.includes("'branch'")) output = '*|main\n';
      else if (command.includes("'diff'")) output = '@@ -1 +1 @@\n-old\n+remote\n';
      stream.emit('data', Buffer.from(output));
      stream.emit('exit', 0);
      stream.emit('close', 0);
    });
    return stream;
  };
  let localCalls = 0;
  gitService.execGit = async () => { localCalls++; throw new Error('LOCAL EXECUTION FORBIDDEN'); };
  const app = Fastify();
  try {
    await app.register(apiRoutes);
    const response = await app.inject({ method: 'GET', url: `/api/git/status?serverId=${server.id}&projectId=remote` });
    assert.equal(response.statusCode, 200, `remote status must dispatch over SSH, got ${response.statusCode}: ${response.body}`);
    assert.equal(response.json().repoRoot, '/remote/repo');
    assert.equal(response.json().files[0].path, 'remote.txt');
    const routes = ['status', 'diff', 'branches', 'stage', 'unstage', 'commit', 'checkout', 'pull', 'push'];
    for (const route of routes) {
      const method = ['status', 'diff', 'branches'].includes(route) ? 'GET' : 'POST';
      const fields = { serverId: server.id, projectId: 'remote', file: "x ' ;$(touch forbidden)", message: "unit ' ;$(touch forbidden)", branch: 'topic' };
      const result = await app.inject(method === 'GET' ? { method, url: `/api/git/${route}?${new URLSearchParams(fields)}` } : { method, url: `/api/git/${route}`, payload: fields });
      assert.equal(result.statusCode, 200, `${route}: ${result.body}`);
      for (const scope of [{serverId: 'missing', projectId: 'remote'}, {serverId: server.id, projectId: 'local'}, {serverId: 'server-local', projectId: 'remote'}]) {
        const before = commands.length;
        const bad = await app.inject(method === 'GET' ? {method, url: `/api/git/${route}?${new URLSearchParams({...fields, ...scope})}`} : {method, url: `/api/git/${route}`, payload: {...fields, ...scope}});
        assert.equal(bad.statusCode, 404, `${route} scope rejection: ${bad.body}`);
        assert.equal(commands.length, before);
      }
    }
    assert.equal(localCalls, 0, 'remote operations must not use local singleton executor');
    assert.ok(commands.every(c => c.includes('GIT_TERMINAL_PROMPT=0')));
    assert.ok(commands.every(c => c.includes('"$HOME"/')));
    const before = commands.length;
    const badBranch = await app.inject({method: 'POST', url: '/api/git/checkout', payload: {serverId: server.id, projectId: 'remote', branch: '--detach'}});
    assert.equal(badBranch.statusCode, 400);
    assert.equal(commands.length, before);
    gitService.execGit = async (_cwd, args) => { localCalls++; return args.includes('--show-toplevel') ? '/local-only\n' : args.includes('--abbrev-ref') ? 'main\n' : ''; };
    const local = await app.inject({method: 'GET', url: '/api/git/status?projectId=local'});
    assert.equal(local.statusCode, 200);
    assert.equal(local.json().repoRoot, '/local-only');
    assert.ok(localCalls > 0);
    const { createRemoteGitExecutor, GitService } = await import('../apps/api/src/services/gitService.js');
    const channel = () => {
      const stream = new EventEmitter() as any;
      stream.stderr = new EventEmitter();
      stream.close = () => {};
      stream.signal = () => {};
      return stream;
    };
    for (const event of ['nonzero', 'signal', 'error', 'stderr-error', 'close']) {
      const stream = channel();
      const executor = createRemoteGitExecutor(server, async () => {
        setImmediate(() => {
          stream.stderr.emit('data', Buffer.from('secret://do-not-echo'));
          if (event === 'nonzero') stream.emit('exit', 7);
          else if (event === 'signal') stream.emit('exit', null, 'TERM');
          else if (event === 'error') stream.emit('error', new Error('secret://do-not-echo'));
          else if (event === 'stderr-error') stream.stderr.emit('error', new Error('secret://do-not-echo'));
          else stream.emit('close');
        });
        return stream;
      }, 100);
      await assert.rejects(executor('~', ['status']), error => error instanceof Error && error.message.includes('Remote Git status failed') && !error.message.includes('secret'));
    }
    await assert.rejects(createRemoteGitExecutor(server, async () => { throw new Error('secret'); }, 100)('~', ['status']), /SSH connection or execution error/);
    await assert.rejects(createRemoteGitExecutor(server, () => new Promise(() => {}), 10)('~', ['status']), /timed out/);
    const hanging = channel();
    let closed = false;
    hanging.close = () => { closed = true; };
    await assert.rejects(createRemoteGitExecutor(server, async () => hanging, 10)('~', ['status']), /timed out/);
    assert.ok(closed);
    const unicode = channel();
    const unicodeResult = createRemoteGitExecutor(server, async () => {
      setImmediate(() => {
        const bytes = Buffer.from('café');
        unicode.emit('data', bytes.subarray(0, 4));
        unicode.emit('data', bytes.subarray(4));
        unicode.emit('exit', 0);
        unicode.emit('close');
      });
      return unicode;
    }, 100)('~', ['status']);
    assert.equal(await unicodeResult, 'café');
    const trailing = channel();
    const trailingResult = createRemoteGitExecutor(server, async () => {
      setImmediate(() => {
        trailing.emit('data', Buffer.from('before'));
        trailing.emit('exit', 0);
        trailing.emit('data', Buffer.from('after'));
        trailing.emit('close');
      });
      return trailing;
    }, 100)('~', ['status']);
    assert.equal(await trailingResult, 'beforeafter');
    const late = channel();
    let lateSignalled = false;
    let lateClosed = false;
    late.signal = () => { lateSignalled = true; };
    late.close = () => { lateClosed = true; };
    let resolveLate!: (stream: any) => void;
    const lateChannel = new Promise<any>(resolve => { resolveLate = resolve; });
    await assert.rejects(createRemoteGitExecutor(server, () => lateChannel, 10)('~', ['status']), /timed out/);
    resolveLate(late);
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(lateSignalled && lateClosed, 'Late channels must be terminated after timeout');
    // Execute only the shell serialization through a fake git shell function.
    const { execFileSync } = await import('node:child_process');
    const hostile = "space ' ;$(touch forbidden)\nline";
    let serialized = '';
    const capture = channel();
    const serialize = createRemoteGitExecutor(server, async (_server, command) => {
      serialized = command;
      setImmediate(() => capture.emit('close', 0));
      return capture;
    }, 100);
    await serialize(`~/${hostile}`, ['commit', '-m', hostile]);
    const argv = execFileSync('/bin/sh', ['-c', `git() { printf '%s\\0' "$@"; }; ${serialized}`], {env: {...process.env, HOME: '/remote-home'}}).toString().split('\0').slice(0, -1);
    assert.deepEqual(argv, ['-C', `/remote-home/${hostile}`, 'commit', '-m', hostile]);
    const oversized = channel();
    await assert.rejects(createRemoteGitExecutor(server, async () => {
      setImmediate(() => oversized.emit('data', Buffer.alloc(8 * 1024 * 1024 + 1)));
      return oversized;
    }, 100)('~', ['status']), /output limit exceeded/);
    const previousActive = projectService.getActiveProject;
    projectService.getActiveProject = () => localProject;
    for (const route of routes) {
      const method = ['status', 'diff', 'branches'].includes(route) ? 'GET' : 'POST';
      const fields = {serverId: server.id, file: 'file', branch: 'topic', message: 'message'};
      const before = commands.length;
      const result = await app.inject(method === 'GET' ? {method, url: `/api/git/${route}?${new URLSearchParams(fields)}`} : {method, url: `/api/git/${route}`, payload: fields});
      assert.equal(result.statusCode, 404, `${route}: active project must also belong to server`);
      assert.equal(commands.length, before);
    }
    projectService.getActiveProject = previousActive;
    const failingDiff = new GitService(async () => { throw new Error('explicit diff failure'); });
    await assert.rejects(failingDiff.getDiff('~', 'file'), /explicit diff failure/);
    console.log('PASS remote API operations, all route scope guards, no local executor, local compatibility, branch injection, lifecycle/timeouts, Buffer UTF-8, shell argv, explicit diff errors');
  } finally {
    await app.close();
    process.env.HOME = oldHome;
    fs.rmSync(home, {recursive: true, force: true});
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
