import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ProjectService, resolveProjectWorkspacePath, canonicalProjectPath, isHomeProject } from '../apps/api/src/services/projectService.ts';

test('ProjectService deduplicates project paths across trailing slashes, tilde, and redundant slashes', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-dedupe-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new ProjectService(path.join(dir, 'projects.json'));
  const serverId = 'server-local';

  // 1. Home project deduplication
  const home1 = store.openHomeProject(serverId);
  assert.equal(isHomeProject(home1), true);
  assert.equal(store.isHome(home1), true);

  const home2 = store.openProject(serverId, '~');
  assert.equal(home2.id, home1.id);

  const home3 = store.openProject(serverId, '~/');
  assert.equal(home3.id, home1.id);

  const home4 = store.openProject(serverId, os.homedir());
  assert.equal(home4.id, home1.id);

  const home5 = store.openProject(serverId, os.homedir() + '/');
  assert.equal(home5.id, home1.id);

  // Still only 1 project in list
  assert.equal(store.list(serverId).projects.length, 1);

  // 2. Custom folder deduplication
  const repoPath = path.join(dir, 'my-repo');
  fs.mkdirSync(repoPath, { recursive: true });

  const p1 = store.openProject(serverId, repoPath, 'my-repo');
  assert.equal(store.list(serverId).projects.length, 2);

  // Open with trailing slash
  const p2 = store.openProject(serverId, repoPath + '/', 'my-repo');
  assert.equal(p2.id, p1.id);
  assert.equal(store.list(serverId).projects.length, 2, 'Must not add duplicate project with trailing slash');

  // Open with redundant slashes
  const p3 = store.openProject(serverId, repoPath + '//', 'my-repo');
  assert.equal(p3.id, p1.id);
  assert.equal(store.list(serverId).projects.length, 2, 'Must not add duplicate project with redundant slashes');

  // 3. Deleting projects
  // Home project must not be deletable
  assert.equal(store.deleteProject(home1.id), false, 'Home project must not be deletable');
  assert.equal(store.list(serverId).projects.length, 2);

  // Regular project must be deletable
  assert.equal(store.getActiveProject(serverId)?.id, p1.id);
  assert.equal(store.deleteProject(p1.id), true, 'Regular project must be deletable');
  assert.equal(store.list(serverId).projects.length, 1);
  assert.equal(store.getActiveProject(serverId)?.id, home1.id, 'Active project should revert to Home project');
});

test('ProjectService deduplicates legacy corrupt duplicates on file load', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-dedupe-load-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'projects.json');
  const serverId = 'server-local';
  const targetPath = path.join(dir, 'dup-repo');
  fs.mkdirSync(targetPath, { recursive: true });

  fs.writeFileSync(file, JSON.stringify({
    activeProjectByServer: { [serverId]: 'dup-2' },
    projects: [
      { id: 'home', serverId, name: '~', rootPath: os.homedir(), updatedAt: 10 },
      { id: 'dup-1', serverId, name: 'dup-repo', rootPath: targetPath, updatedAt: 20 },
      { id: 'dup-2', serverId, name: 'dup-repo', rootPath: targetPath + '/', updatedAt: 30 },
    ],
  }));

  const store = new ProjectService(file);
  const projects = store.list(serverId).projects;
  assert.equal(projects.length, 2, 'Duplicate project must be pruned on load');
  assert.equal(store.getActiveProject(serverId)?.rootPath, path.resolve(targetPath));
});

test('ProjectService multi-server deletion edge case preserves isolation', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-multi-del-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'projects.json');
  const store = new ProjectService(file);

  const localHome = store.openHomeProject('server-local');
  const remoteHome = store.openHomeProject('server-remote');
  const remoteP1 = store.openProject('server-remote', '/srv/remote-app', 'remote-app');

  assert.equal(store.list('server-local').projects.length, 1);
  assert.equal(store.list('server-remote').projects.length, 2);

  // Deleting remote Home project should be rejected
  assert.equal(store.deleteProject(remoteHome.id), false, 'Remote home project cannot be deleted');

  // Deleting remote non-home project succeeds and resets remote active project to remote Home
  assert.equal(store.deleteProject(remoteP1.id), true);
  assert.equal(store.list('server-remote').projects.length, 1);
  assert.equal(store.getActiveProject('server-remote')?.id, remoteHome.id);

  // Local server state completely unaffected
  assert.equal(store.list('server-local').projects.length, 1);
  assert.equal(store.getActiveProject('server-local')?.id, localHome.id);
});

test('Project at root "/" has name "root", is not home project, and is deletable', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-root-proj-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'projects.json');
  const store = new ProjectService(file);

  const home = store.openHomeProject('server-local');
  assert.equal(isHomeProject(home), true);

  const rootProj = store.openProject('server-local', '/');
  assert.equal(rootProj.name, 'root', 'Project at "/" must be named "root", not "~"');
  assert.equal(rootProj.rootPath, '/');
  assert.equal(isHomeProject(rootProj), false, 'Project at "/" must NOT be considered Home project');

  assert.equal(store.list('server-local').projects.length, 2);

  // Must be deletable
  assert.equal(store.deleteProject(rootProj.id), true, 'Project at root "/" must be deletable');
  assert.equal(store.list('server-local').projects.length, 1);
  assert.equal(store.getActiveProject('server-local')?.id, home.id);
});

test('Legacy project at "/" with corrupt name "~" is automatically repaired on load', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-root-repair-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'projects.json');

  fs.writeFileSync(file, JSON.stringify({
    activeProjectByServer: { 'server-local': 'root-corrupt' },
    projects: [
      { id: 'real-home', serverId: 'server-local', name: '~', rootPath: os.homedir(), updatedAt: 10 },
      { id: 'root-corrupt', serverId: 'server-local', name: '~', rootPath: '/', updatedAt: 20 },
    ],
  }));

  const store = new ProjectService(file);
  const projects = store.list('server-local').projects;
  assert.equal(projects.length, 2);

  const root = projects.find(p => p.id === 'root-corrupt');
  assert.equal(root?.name, 'root', 'Legacy corrupt name "~" on "/" must be repaired to "root"');
  assert.equal(isHomeProject(root!), false);

  // Must be deletable
  assert.equal(store.deleteProject('root-corrupt'), true);
  assert.equal(store.list('server-local').projects.length, 1);
});

test('ProjectService persists workspaceServerIds across restarts', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-ws-srv-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'projects.json');

  const store1 = new ProjectService(file);
  assert.deepEqual(store1.getWorkspaceServers(), ['server-local']);

  store1.setWorkspaceServers(['server-local', 'server-ssh-aeh-acn-ttn-201']);
  assert.deepEqual(store1.getWorkspaceServers(), ['server-local', 'server-ssh-aeh-acn-ttn-201']);

  // Reload from disk
  const store2 = new ProjectService(file);
  assert.deepEqual(store2.getWorkspaceServers(), ['server-local', 'server-ssh-aeh-acn-ttn-201']);
});

test('Fastify route DELETE /api/projects/:id handles long URL-encoded project IDs (>100 chars) without 414 error', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-long-param-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'projects.json');
  process.env.HUGCODE_PROJECTS_FILE = file;
  process.env.AUTH_MODE = 'none';

  const { projectService } = await import('../apps/api/src/services/projectService.ts');
  const { createApp } = await import('../apps/api/src/app.ts');

  projectService.resetForTests(file);
  const longServerId = 'server-ssh-aeh-acn-ttn-201';
  projectService.openHomeProject(longServerId);
  const longProj = projectService.openProject(longServerId, '/home/aeh-acn-ttn/projects/kiennt/acn4e-viper', 'acn-viper');

  const encodedId = encodeURIComponent(longProj.id);
  assert.ok(encodedId.length > 100, `Expected encoded project ID length > 100, got ${encodedId.length}`);

  const app = await createApp();
  t.after(() => app.close());

  const delRes = await app.inject({
    method: 'DELETE',
    url: `/api/projects/${encodedId}`,
  });

  assert.equal(delRes.statusCode, 200, `Expected 200 OK for deleting long project ID, got ${delRes.statusCode}: ${delRes.body}`);
  const body = JSON.parse(delRes.body);
  assert.equal(body.success, true);
  assert.equal(projectService.getProject(longProj.id), undefined);
});
