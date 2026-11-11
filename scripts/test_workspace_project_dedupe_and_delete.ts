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
