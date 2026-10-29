#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [basePath, currentPath, stashedPath] = process.argv.slice(2);
const marker = 'package-lock.json merge=hugremote-updater';
const root = process.cwd();

function cleanup() {
  try {
    const gitDirRaw = execFileSync('git', ['rev-parse', '--git-dir'], { cwd: root, encoding: 'utf8' }).trim();
    const attributesPath = path.resolve(root, gitDirRaw, 'info', 'attributes');
    try {
      const lines = fs.readFileSync(attributesPath, 'utf8')
        .split(/\r?\n/)
        .filter(line => line && line !== marker);
      if (lines.length) fs.writeFileSync(attributesPath, `${lines.join('\n')}\n`);
      else fs.rmSync(attributesPath, { force: true });
    } catch (_) {}
    try { execFileSync('git', ['config', '--unset-all', 'merge.hugremote-updater.driver'], { cwd: root }); } catch (_) {}
  } catch (_) {}
}

function normalize(lockfile) {
  const copy = structuredClone(lockfile);
  for (const metadata of Object.values(copy.packages || {})) {
    if (!metadata || metadata.optional !== true) continue;
    delete metadata.peer;
    delete metadata.libc;
  }
  return copy;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

let accepted = false;
try {
  if (!basePath || !currentPath || !stashedPath) throw new Error('missing merge paths');
  const base = normalize(JSON.parse(fs.readFileSync(basePath, 'utf8')));
  const stashed = normalize(JSON.parse(fs.readFileSync(stashedPath, 'utf8')));
  accepted = stable(base) === stable(stashed);
} catch (_) {
  accepted = false;
} finally {
  cleanup();
}
process.exit(accepted ? 0 : 1);
