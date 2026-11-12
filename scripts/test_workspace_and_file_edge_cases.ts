import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ProjectService, resolveProjectWorkspacePath, canonicalProjectPath, isHomeProject } from '../apps/api/src/services/projectService.js';
import { createApp } from '../apps/api/src/app.js';

test('FolderTreePicker computeRelativeRemainder handles all edge cases between workspace and target', () => {
  function computeRelativeRemainder(target: string, workspace: string): string {
    const normTarget = (target || '').trim().replace(/\/+$/, '');
    const normWs = (workspace || '~').trim().replace(/\/+$/, '');
    if (!normTarget || normTarget === normWs || normTarget === '~') return '';

    if (normWs && normWs !== '~' && normTarget.startsWith(normWs + '/')) {
      return normTarget.slice(normWs.length + 1);
    }

    if (normTarget.startsWith('~/')) {
      return normTarget.slice(2);
    }

    const homeMatch = normTarget.match(/^\/(?:home|Users)\/[^/]+\/(.+)$/);
    if (homeMatch && (normWs === '~' || normWs.startsWith('/home/') || normWs.startsWith('/Users/'))) {
      return homeMatch[1];
    }

    if (!normTarget.startsWith('/')) {
      return normTarget;
    }

    return '';
  }

  // 1. Direct workspace prefix match
  assert.equal(computeRelativeRemainder('/home/hungnd/projects/hugremote', '/home/hungnd'), 'projects/hugremote');
  assert.equal(computeRelativeRemainder('/home/aeh-acn-ttn/acn-viper', '/home/aeh-acn-ttn'), 'acn-viper');

  // 2. Target has ~/ prefix while workspace is /home/user or ~
  assert.equal(computeRelativeRemainder('~/projects/hugremote', '~'), 'projects/hugremote');
  assert.equal(computeRelativeRemainder('~/projects/hugremote', '/home/hungnd'), 'projects/hugremote');

  // 3. Workspace is ~ while target is full /home/user path
  assert.equal(computeRelativeRemainder('/home/hungnd/projects/hugremote', '~'), 'projects/hugremote');
  assert.equal(computeRelativeRemainder('/home/aeh-acn-ttn/acn-viper/src', '~'), 'acn-viper/src');
  assert.equal(computeRelativeRemainder('/Users/runner/work/hugremote', '~'), 'work/hugremote');

  // 4. Target is already relative
  assert.equal(computeRelativeRemainder('projects/hugremote', '~'), 'projects/hugremote');
  assert.equal(computeRelativeRemainder('acn-viper', '/home/aeh-acn-ttn'), 'acn-viper');

  // 5. Identical paths or root paths
  assert.equal(computeRelativeRemainder('/home/hungnd', '/home/hungnd'), '');
  assert.equal(computeRelativeRemainder('~', '~'), '');
  assert.equal(computeRelativeRemainder('/', '/'), '');
  assert.equal(computeRelativeRemainder('', '/home/hungnd'), '');
});

test('FolderTreePicker joinPath constructs canonical full path on both local and SSH servers', () => {
  function joinPath(base: string, rel: string): string {
    if (!rel) return base;
    const cleanBase = base.replace(/\/$/, '');
    return `${cleanBase}/${rel}`;
  }

  // Local server
  assert.equal(joinPath('/home/hungnd', 'projects/hugremote'), '/home/hungnd/projects/hugremote');
  assert.equal(joinPath('~', 'projects/hugremote'), '~/projects/hugremote');

  // Remote SSH server
  assert.equal(joinPath('/home/aeh-acn-ttn', 'acn-viper'), '/home/aeh-acn-ttn/acn-viper');
  assert.equal(joinPath('/home/aeh-acn-ttn', 'acn-viper/src'), '/home/aeh-acn-ttn/acn-viper/src');
  assert.equal(joinPath('~', 'acn-viper'), '~/acn-viper');

  // Root server
  assert.equal(joinPath('/', 'var/log'), '/var/log');
});

test('Workspace project deduplication and multi-server isolation under edge cases', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-edge-cases-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'projects.json');

  const store = new ProjectService(file);

  // Server A: Home project
  const homeA = store.openHomeProject('server-a');
  assert.equal(isHomeProject(homeA), true);
  assert.equal(store.deleteProject(homeA.id), false, 'Home project cannot be deleted');

  // Server A: Project with trailing slashes, redundant slashes
  const p1 = store.openProject('server-a', '/home/user/projects/app//', 'my-app');
  const p1Dup = store.openProject('server-a', '/home/user/projects/app', 'renamed-app');
  assert.equal(p1.id, p1Dup.id, 'Duplicate paths must map to existing project');
  assert.equal(store.list('server-a').projects.length, 2);

  // Server B: Same path on different server must remain isolated
  const p1ServerB = store.openProject('server-b', '/home/user/projects/app', 'my-app');
  assert.notEqual(p1.id, p1ServerB.id, 'Same path on different server must have unique project ID');
  assert.equal(store.list('server-b').projects.length, 1);

  // Root project "/" is deletable and distinct from Home "~"
  const rootProj = store.openProject('server-a', '/', 'root');
  assert.equal(rootProj.name, 'root');
  assert.equal(isHomeProject(rootProj), false);
  assert.equal(store.deleteProject(rootProj.id), true, 'Root "/" project must be deletable');

  // Persistence of workspace servers
  store.setWorkspaceServers(['server-a', 'server-b', 'server-ssh-remote']);
  assert.deepEqual(store.getWorkspaceServers(), ['server-local', 'server-a', 'server-b', 'server-ssh-remote']);

  // Reload store from disk
  const store2 = new ProjectService(file);
  assert.deepEqual(store2.getWorkspaceServers(), ['server-local', 'server-a', 'server-b', 'server-ssh-remote']);
  assert.equal(store2.list('server-a').projects.length, 2);
  assert.equal(store2.list('server-b').projects.length, 1);
});

test('Fastify routes handle fs and project delete edge cases without 400/404/414', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-api-edge-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'projects.json');
  process.env.HUGCODE_PROJECTS_FILE = file;
  process.env.AUTH_MODE = 'none';

  const { projectService } = await import('../apps/api/src/services/projectService.js');
  projectService.resetForTests(file);

  const app = await createApp();
  t.after(() => app.close());

  // 1. GET /api/fs with fsScope=server on local server
  const fsRes = await app.inject({
    method: 'GET',
    url: '/api/fs?serverId=server-local&fsScope=server&path=',
  });
  assert.equal(fsRes.statusCode, 200);
  const fsData = JSON.parse(fsRes.body);
  assert.ok(Array.isArray(fsData.entries));

  // 2. GET /api/projects returns workspaceServerIds
  const projRes = await app.inject({
    method: 'GET',
    url: '/api/projects?serverId=server-local',
  });
  assert.equal(projRes.statusCode, 200);
  const projData = JSON.parse(projRes.body);
  assert.ok(Array.isArray(projData.workspaceServerIds));
  assert.ok(projData.workspaceServerIds.includes('server-local'));

  // 3. POST /api/projects/workspace-servers persists servers
  const postWsRes = await app.inject({
    method: 'POST',
    url: '/api/projects/workspace-servers',
    payload: { serverIds: ['server-local', 'server-ssh-aeh-acn-ttn-201'] },
  });
  assert.equal(postWsRes.statusCode, 200);
  const postWsData = JSON.parse(postWsRes.body);
  assert.deepEqual(postWsData.workspaceServerIds, ['server-local', 'server-ssh-aeh-acn-ttn-201']);

  // 4. DELETE long project ID (>100 characters) on remote SSH server succeeds
  const longServerId = 'server-ssh-aeh-acn-ttn-201';
  projectService.openHomeProject(longServerId);
  const longProj = projectService.openProject(longServerId, '/home/aeh-acn-ttn/projects/kiennt/acn4e-viper', 'acn-viper');
  const encodedId = encodeURIComponent(longProj.id);
  assert.ok(encodedId.length > 100);

  const delRes = await app.inject({
    method: 'DELETE',
    url: `/api/projects/${encodedId}`,
  });
  assert.equal(delRes.statusCode, 200);
  assert.equal(JSON.parse(delRes.body).success, true);
  assert.equal(projectService.getProject(longProj.id), undefined);
});
