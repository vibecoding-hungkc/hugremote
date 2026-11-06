import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stageWorkspaceManifests } from '../desktop/stage-workspaces.mjs';

const repo = path.resolve(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-workspace-stage-'));
try {
  stageWorkspaceManifests(repo, tmp);
  for (const workspace of ['apps/api', 'apps/web', 'packages/shared']) {
    const source = fs.readFileSync(path.join(repo, workspace, 'package.json'));
    const staged = fs.readFileSync(path.join(tmp, workspace, 'package.json'));
    assert.deepEqual(staged, source, `staged ${workspace} manifest must match source`);
  }
  console.log('PASS desktop payload stages workspace manifests in nested directories');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
