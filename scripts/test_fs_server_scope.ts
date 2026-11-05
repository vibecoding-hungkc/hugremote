import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/src/app.js';
import { parseSshConfig } from '../apps/api/src/config.js';
import { projectService } from '../apps/api/src/services/projectService.js';

// Use two distinct real roots; the active project must not affect server-scoped FS calls.
const workspace = parseSshConfig().find(s => s.id === 'server-local')?.workspace;
assert.ok(workspace, 'local server workspace is configured');
const marker = `hugremote-fs-scope-${randomUUID()}`;
const root = path.join(workspace, marker);
const projectRoot = path.join(root, 'project');
fs.mkdirSync(projectRoot, { recursive: true });
fs.writeFileSync(path.join(root, 'server.txt'), 'server scope');
fs.writeFileSync(path.join(projectRoot, 'project.txt'), 'project scope');
const previous = projectService.getActiveProject('server-local');
const project = projectService.openProject('server-local', projectRoot, marker);
const app = await createApp();
try {
  await app.ready();
  const rel = (name: string) => `${marker}/${name}`;
  const list = await app.inject({ method: 'GET', url: `/api/fs?serverId=server-local&fsScope=server&path=${encodeURIComponent(marker)}` });
  assert.equal(list.statusCode, 200, list.payload);
  assert.ok(list.json().entries.some((e: any) => e.name === 'server.txt'));
  assert.ok(list.json().entries.some((e: any) => e.name === 'project'));
  const defaultList = await app.inject({ method: 'GET', url: '/api/fs?serverId=server-local' });
  assert.equal(defaultList.statusCode, 200);
  assert.ok(defaultList.json().entries.some((e: any) => e.name === 'project.txt'), 'default remains project-scoped');
  const read = await app.inject({ method: 'GET', url: `/api/fs/read?fsScope=server&path=${encodeURIComponent(rel('server.txt'))}` });
  assert.equal(read.statusCode, 200, read.payload);
  assert.equal(read.json().content, 'server scope');
  const save = await app.inject({ method: 'POST', url: '/api/fs/save', payload: { fsScope: 'server', path: rel('server.txt'), content: 'updated' } });
  assert.equal(save.statusCode, 200, save.payload);
  assert.equal(fs.readFileSync(path.join(root, 'server.txt'), 'utf8'), 'updated');
  const create = await app.inject({ method: 'POST', url: '/api/fs/action', payload: { fsScope: 'server', action: 'create', path: rel('created.txt'), type: 'file' } });
  assert.equal(create.statusCode, 200, create.payload);
  assert.ok(fs.existsSync(path.join(root, 'created.txt')));
  const rename = await app.inject({ method: 'POST', url: '/api/fs/action', payload: { fsScope: 'server', action: 'rename', oldPath: rel('created.txt'), newPath: rel('renamed.txt') } });
  assert.equal(rename.statusCode, 200, rename.payload);
  const download = await app.inject({ method: 'GET', url: `/api/fs/download?fsScope=server&path=${encodeURIComponent(rel('server.txt'))}` });
  assert.equal(download.statusCode, 200, download.payload);
  assert.equal(download.payload, 'updated');
  const boundary = '----hugremote-fs-scope';
  const payload = `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="uploaded.txt"\r\nContent-Type: text/plain\r\n\r\nuploaded\r\n--${boundary}--\r\n`;
  const upload = await app.inject({ method: 'POST', url: `/api/fs/upload?fsScope=server&targetDir=${encodeURIComponent(marker)}`, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }, payload });
  assert.equal(upload.statusCode, 200, upload.payload);
  assert.equal(fs.readFileSync(path.join(root, 'uploaded.txt'), 'utf8'), 'uploaded');
  const removal = await app.inject({ method: 'POST', url: '/api/fs/action', payload: { fsScope: 'server', action: 'delete', path: rel('renamed.txt') } });
  assert.equal(removal.statusCode, 200, removal.payload);
  const escape = await app.inject({ method: 'GET', url: `/api/fs?fsScope=server&path=${encodeURIComponent('../../outside')}` });
  assert.notEqual(escape.statusCode, 200, 'server scope cannot escape allowed root');
  const absolute = await app.inject({ method: 'GET', url: `/api/fs/read?fsScope=server&path=${encodeURIComponent(path.join(projectRoot, 'project.txt'))}` });
  assert.notEqual(absolute.statusCode, 200, 'absolute path cannot bypass server workspace');
  const link = path.join(root, 'link-out');
  fs.symlinkSync(path.dirname(workspace), link, 'dir');
  const symlinkEscape = await app.inject({ method: 'GET', url: `/api/fs?fsScope=server&path=${encodeURIComponent(rel('link-out'))}` });
  assert.notEqual(symlinkEscape.statusCode, 200, 'symlink cannot escape server workspace');
  const sibling = fs.mkdtempSync(path.join(workspace, `${marker}-sibling-`));
  fs.writeFileSync(path.join(sibling, 'secret.txt'), 'sibling secret');
  const localWsFile = path.join(process.env.HOME || '/home/hungnd', '.ssh', 'hugcode_local_workspace.txt');
  const prevWsFile = fs.existsSync(localWsFile) ? fs.readFileSync(localWsFile, 'utf8') : null;
  try {
    fs.writeFileSync(localWsFile, root, { mode: 0o600 });
    fs.symlinkSync(sibling, path.join(root, 'link-sibling'), 'dir');
    const siblingEscape = await app.inject({ method: 'GET', url: '/api/fs?fsScope=server&path=link-sibling' });
    assert.notEqual(siblingEscape.statusCode, 200, 'symlink cannot escape into sibling outside server workspace');
    const siblingReadEscape = await app.inject({ method: 'GET', url: '/api/fs/read?fsScope=server&path=link-sibling/secret.txt' });
    assert.notEqual(siblingReadEscape.statusCode, 200, 'read cannot follow symlink outside server workspace');
  } finally {
    if (prevWsFile === null) fs.rmSync(localWsFile, { force: true });
    else fs.writeFileSync(localWsFile, prevWsFile, { mode: 0o600 });
    fs.rmSync(sibling, { recursive: true, force: true });
  }
  console.log('PASS server-scoped list/read/save/create/rename/delete/download/upload, project default and containment');
} finally {
  await app.close();
  if (previous) projectService.selectProject('server-local', previous.id);
  projectService.deleteProject(project.id);
  fs.rmSync(root, { recursive: true, force: true });
}
