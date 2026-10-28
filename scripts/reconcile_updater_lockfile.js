#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const lockfilePath = path.join(root, 'package-lock.json');

function git(...args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function isUpdaterRestoreContext() {
  try {
    if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'HEAD') return false;
    if (!/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
      git('describe', '--tags', '--exact-match')
    )) return false;
    return git('stash', 'list', '--format=%gs')
      .split(/\r?\n/)
      .some(subject => /(?:^|: )hugremote-update-backup-[0-9A-Za-z-]{8,128}$/.test(subject));
  } catch (_) {
    return false;
  }
}

function normalizeKnownNpmMetadata(lockfile) {
  const copy = structuredClone(lockfile);
  for (const metadata of Object.values(copy.packages || {})) {
    if (!metadata || metadata.optional !== true) continue;
    delete metadata.peer;
    delete metadata.libc;
  }
  return copy;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

if (isUpdaterRestoreContext()) {
  const trackedChanges = git('status', '--porcelain', '--untracked-files=no')
    .split(/\r?\n/)
    .filter(Boolean);

  if (trackedChanges.length > 0) {
    if (trackedChanges.length !== 1 || !/^\s*M\s+package-lock\.json$/.test(trackedChanges[0])) {
      console.error(`Updater prebuild từ chối dọn tracked changes ngoài package-lock.json: ${JSON.stringify(trackedChanges)}`);
      process.exit(1);
    }

    try {
      const expectedText = execFileSync('git', ['show', 'HEAD:package-lock.json'], {
        cwd: root,
        encoding: 'utf8',
      });
      const expected = JSON.parse(expectedText);
      const actual = JSON.parse(readFileSync(lockfilePath, 'utf8'));
      if (stableJson(normalizeKnownNpmMetadata(actual)) !== stableJson(normalizeKnownNpmMetadata(expected))) {
        console.error('Thay đổi package-lock.json không phải metadata tương thích giữa các phiên bản npm.');
        process.exit(1);
      }
      writeFileSync(lockfilePath, expectedText);
      console.log('✓ Đã hoàn nguyên metadata package-lock.json do npm phiên bản cũ tạo ra.');
    } catch (error) {
      if (error?.status) throw error;
      console.error(`Không thể xác minh package-lock.json trước khi restore backup: ${error.message}`);
      process.exit(1);
    }
  }
}
