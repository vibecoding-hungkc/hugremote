import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { projectService } from '../server/src/services/projectService.js';
import { gitService } from '../server/src/services/gitService.js';

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hugcode-project-wrapper-'));
  process.env.HUGCODE_PROJECTS_FILE = path.join(tmp, 'projects.json');

  projectService.resetForTests(process.env.HUGCODE_PROJECTS_FILE);

  const home = projectService.openHomeProject('server-local');
  assert.equal(home.serverId, 'server-local');
  assert.equal(home.name, '~');
  assert.equal(home.rootPath, os.homedir());
  assert.equal(projectService.getActiveProject('server-local')?.id, home.id);

  const repo = path.join(tmp, 'demo-repo');
  fs.mkdirSync(repo, { recursive: true });
  fs.writeFileSync(path.join(repo, 'README.md'), 'old\n', 'utf8');

  const project = projectService.openProject('server-local', repo);
  assert.equal(project.name, 'demo-repo');
  assert.equal(project.rootPath, repo);
  assert.equal(projectService.getActiveProject('server-local')?.id, project.id);

  const same = projectService.openProject('server-local', repo, 'Custom Name');
  assert.equal(same.id, project.id);
  assert.equal(same.name, 'Custom Name');

  assert.equal(projectService.deleteProject(home.id), false, 'Home/root project must not be deletable');
  const removable = projectService.openProject('server-local', path.join(tmp, 'removable-repo'));
  assert.equal(projectService.deleteProject(removable.id), true, 'Non-home project must be deletable');
  assert.equal(projectService.getProject(removable.id), undefined);

  const escaped = projectService.resolveProjectPath(project.id, '../outside.txt');
  assert.equal(escaped.ok, false);
  assert.match(escaped.error || '', /outside/i);

  const inside = projectService.resolveProjectPath(project.id, 'src/index.ts');
  assert.equal(inside.ok, true);
  assert.equal(inside.path, path.join(repo, 'src/index.ts'));

  await gitService.execGit(repo, ['init']);
  await gitService.execGit(repo, ['config', 'user.email', 'test@example.com']);
  await gitService.execGit(repo, ['config', 'user.name', 'Test User']);
  await gitService.execGit(repo, ['add', 'README.md']);
  await gitService.execGit(repo, ['commit', '-m', 'init']);
  fs.writeFileSync(path.join(repo, 'README.md'), 'old\nnew\n', 'utf8');
  fs.writeFileSync(path.join(repo, 'new.txt'), 'hello\n', 'utf8');

  let status = await gitService.getStatus(repo);
  assert.ok(status.branch.length > 0);
  assert.ok(status.files.some(f => f.path === 'README.md' && f.status === 'M' && !f.staged));
  assert.ok(status.files.some(f => f.path === 'new.txt' && f.status === '??' && !f.staged));

  await gitService.stage(repo, 'README.md');
  status = await gitService.getStatus(repo);
  assert.ok(status.files.some(f => f.path === 'README.md' && f.staged));

  await gitService.unstage(repo, 'README.md');
  status = await gitService.getStatus(repo);
  assert.ok(status.files.some(f => f.path === 'README.md' && !f.staged));

  await gitService.stage(repo, 'README.md');
  await gitService.commit(repo, 'test: update readme');
  status = await gitService.getStatus(repo);
  assert.ok(!status.files.some(f => f.path === 'README.md'), 'committed file should leave changed list');

  await gitService.stage(repo, 'new.txt');
  const diff = await gitService.getDiff(repo, 'new.txt');
  assert.ok(diff.lines.some(l => l.type === 'added' && l.content.includes('hello')));

  await gitService.execGit(repo, ['checkout', '-b', 'feature/test-branch']);
  let branches = await gitService.getBranches(repo);
  assert.ok(branches.some(b => b.name === 'main' || b.name === 'master'));
  assert.ok(branches.some(b => b.name === 'feature/test-branch' && b.current));
  await gitService.checkout(repo, branches.some(b => b.name === 'main') ? 'main' : 'master');
  branches = await gitService.getBranches(repo);
  assert.ok(branches.some(b => (b.name === 'main' || b.name === 'master') && b.current));

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('project-wrapper-tests-ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
