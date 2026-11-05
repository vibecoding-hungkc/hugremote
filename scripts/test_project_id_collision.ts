import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ProjectService } from '../apps/api/src/services/projectService.ts';

const serverId = 'server-remote';
const left = '/home/aeh-acn-ttn/projects/kiennt/acn4e-viper';
const right = '/home/aeh-acn-ttn/projects/dungbh/acn4e-viper';

test('same-named folders under one server have unique IDs and independently selectable roots', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-project-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new ProjectService(path.join(dir, 'projects.json'));
  const a = store.openProject(serverId, left);
  const b = store.openProject(serverId, right);
  assert.equal(a.name, b.name);
  assert.notEqual(a.id, b.id);
  assert.equal(store.list(serverId).projects.length, 2);
  assert.equal(store.selectProject(serverId, a.id)?.rootPath, left);
  assert.equal(store.list(serverId).activeProjectId, a.id);
  assert.equal(store.selectProject(serverId, b.id)?.rootPath, right);
  assert.equal(store.list(serverId).activeProjectId, b.id);
  const reloaded = new ProjectService(path.join(dir, 'projects.json'));
  assert.equal(reloaded.getActiveProject(serverId)?.rootPath, right);
});

test('legacy collisions migrate preserving active selection and session cwd association', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-project-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'projects.json');
  const oldId = `${serverId}:acn4e-viper:${Buffer.from(left).toString('base64url').slice(0, 10)}`;
  assert.equal(oldId, `${serverId}:acn4e-viper:${Buffer.from(right).toString('base64url').slice(0, 10)}`);
  fs.writeFileSync(file, JSON.stringify({ activeProjectByServer: { [serverId]: oldId }, projects: [
    { id: oldId, serverId, name: 'acn4e-viper', rootPath: left, updatedAt: 100 },
    { id: oldId, serverId, name: 'acn4e-viper', rootPath: right, updatedAt: 200 },
  ] }));
  const store = new ProjectService(file);
  const projects = store.list(serverId).projects;
  assert.equal(projects.length, 2);
  assert.equal(new Set(projects.map(p => p.id)).size, 2);
  assert.equal(store.getActiveProject(serverId)?.rootPath, left);
  assert.equal(store.selectProject(serverId, projects.find(p => p.rootPath === right)!.id)?.rootPath, right);
  assert.equal(new ProjectService(file).getActiveProject(serverId)?.rootPath, right);
  assert.equal(store.openProject(serverId, left).id, projects.find(p => p.rootPath === left)!.id);
});
