import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gitService } from '../apps/api/src/services/gitService.js';

let failures = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err: any) {
    failures++;
    console.error(`FAIL ${name}: ${err?.stack || err?.message || err}`);
  }
}

await test('AC-1: GitService.getCommitHistory and getCommitDiff return commit list, per-commit changed files, file-filtered history, and commit diff', async () => {
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-git-history-test-'));
  try {
    execFileSync('git', ['init', '-b', 'main'], { cwd: tmpRepo });
    execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: tmpRepo });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmpRepo });

    fs.mkdirSync(path.join(tmpRepo, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpRepo, 'src', 'app.ts'), 'export const v = 1;\n', 'utf8');
    fs.writeFileSync(path.join(tmpRepo, 'README.md'), '# Demo\n', 'utf8');
    execFileSync('git', ['add', '.'], { cwd: tmpRepo });
    execFileSync('git', ['commit', '-m', 'feat: initial commit'], { cwd: tmpRepo });

    fs.writeFileSync(path.join(tmpRepo, 'src', 'app.ts'), 'export const v = 2;\nexport const ready = true;\n', 'utf8');
    execFileSync('git', ['add', '.'], { cwd: tmpRepo });
    execFileSync('git', ['commit', '-m', 'fix: update app version'], { cwd: tmpRepo });

    assert.equal(typeof (gitService as any).getCommitHistory, 'function', 'gitService.getCommitHistory must exist');
    assert.equal(typeof (gitService as any).getCommitDiff, 'function', 'gitService.getCommitDiff must exist');

    const historyRes = await (gitService as any).getCommitHistory(tmpRepo, { limit: 20 });
    assert.ok(Array.isArray(historyRes.commits), 'historyRes.commits must be an array');
    assert.equal(historyRes.commits.length, 2, 'must return 2 commits');
    assert.equal(historyRes.commits[0].subject, 'fix: update app version');
    assert.equal(historyRes.commits[0].files.length, 1);
    assert.equal(historyRes.commits[0].files[0].path, 'src/app.ts');
    assert.equal(historyRes.commits[0].files[0].status, 'M');
    assert.equal(historyRes.commits[0].files[0].additions, 2);
    assert.equal(historyRes.commits[0].files[0].deletions, 1);

    assert.equal(historyRes.commits[1].subject, 'feat: initial commit');
    assert.equal(historyRes.commits[1].files.length, 2);

    // Filter by README.md -> only initial commit touched README.md
    const filteredByFile = await (gitService as any).getCommitHistory(tmpRepo, {
      limit: 20,
      file: 'README.md',
    });
    assert.equal(filteredByFile.commits.length, 1);
    assert.equal(filteredByFile.commits[0].subject, 'feat: initial commit');

    // Get diff of src/app.ts in latest commit
    const latestHash = historyRes.commits[0].hash;
    const singleFileDiff = await (gitService as any).getCommitDiff(tmpRepo, latestHash, 'src/app.ts');
    assert.ok(
      singleFileDiff.lines.some((l: any) => l.type === 'added' && l.content.includes('export const v = 2;')),
      'singleFileDiff must include added line from commit'
    );
    assert.ok(
      singleFileDiff.lines.some((l: any) => l.type === 'deleted' && l.content.includes('export const v = 1;')),
      'singleFileDiff must include deleted line from commit'
    );

    // Get combined diff of all files in initial commit
    const initialHash = historyRes.commits[1].hash;
    const allFilesDiff = await (gitService as any).getCommitDiff(tmpRepo, initialHash);
    assert.ok(allFilesDiff.lines.length >= 2, 'allFilesDiff must return combined diff lines');

    // Reject invalid commit hash
    await assert.rejects(
      () => (gitService as any).getCommitDiff(tmpRepo, 'bad;rm -rf /'),
      /Invalid commit hash/i
    );
  } finally {
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  }
});

await test('AC-2, AC-3, AC-4: API routes, gitStore, GitView.vue, and prototype.html support 2-tab Git History, Mobile List->Detail drill-down, and Resizable Columns', async () => {
  const apiSource = fs.readFileSync(
    fileURLToPath(new URL('../apps/api/src/routes/api.ts', import.meta.url)),
    'utf8'
  );
  assert.match(apiSource, /\/api\/git\/commits/, 'api.ts must expose GET /api/git/commits');
  assert.match(apiSource, /\/api\/git\/commit-diff/, 'api.ts must expose GET /api/git/commit-diff');

  const storeSource = fs.readFileSync(
    fileURLToPath(new URL('../apps/web/src/stores/gitStore.ts', import.meta.url)),
    'utf8'
  );
  assert.match(storeSource, /fetchCommits/, 'gitStore.ts must implement fetchCommits');
  assert.match(storeSource, /fetchCommitDiff/, 'gitStore.ts must implement fetchCommitDiff');

  const gitViewSource = fs.readFileSync(
    fileURLToPath(new URL('../apps/web/src/components/GitView.vue', import.meta.url)),
    'utf8'
  );
  const protoSource = fs.readFileSync(
    fileURLToPath(new URL('../analysis/prototypes/prototype.html', import.meta.url)),
    'utf8'
  );

  for (const [label, src] of [
    ['GitView.vue', gitViewSource],
    ['prototype.html', protoSource],
  ] as const) {
    assert.doesNotMatch(src, /id="git-mode-all"/, `${label} must not render #git-mode-all button`);
    assert.match(src, /id="git-mode-working"/, `${label} must render #git-mode-working tab`);
    assert.match(src, /id="git-mode-history"/, `${label} must render #git-mode-history tab`);
    assert.match(src, /id="git-history-commit-list"/, `${label} must render #git-history-commit-list`);
    assert.match(src, /id="git-commit-file-list"/, `${label} must render #git-commit-file-list`);
    assert.match(src, /id="git-commit-diff-body"/, `${label} must render #git-commit-diff-body`);
    assert.match(src, /id="git-working-mobile-back-files"/, `${label} must render #git-working-mobile-back-files`);
    assert.match(src, /id="git-history-mobile-back-commits"/, `${label} must render #git-history-mobile-back-commits`);
    assert.match(src, /id="git-history-mobile-back-files"/, `${label} must render #git-history-mobile-back-files`);
    assert.match(src, /id="git-resizer-repos"/, `${label} must render #git-resizer-repos column resizer`);
    assert.match(src, /id="git-resizer-working-files"/, `${label} must render #git-resizer-working-files column resizer`);
    assert.match(src, /id="git-resizer-history-commits"/, `${label} must render #git-resizer-history-commits column resizer`);
    assert.match(src, /id="git-resizer-history-files"/, `${label} must render #git-resizer-history-files column resizer`);
    assert.match(src, /hugremote_git_col_widths/, `${label} must persist column widths in localStorage`);
  }
});

if (failures > 0) {
  process.exit(1);
}
