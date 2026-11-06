import fs from 'node:fs';
import path from 'node:path';

export function stageWorkspaceManifests(repo, payload) {
  for (const workspace of ['apps/api', 'apps/web', 'packages/shared']) {
    const directory = path.join(payload, workspace);
    fs.mkdirSync(directory, { recursive: true });
    fs.copyFileSync(path.join(repo, workspace, 'package.json'), path.join(directory, 'package.json'));
  }
}
