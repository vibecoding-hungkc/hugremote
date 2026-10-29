#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const backupSubject = /(?:^|: )hugremote-update-backup-[0-9A-Za-z-]{8,128}$/;
const attributeMarker = 'package-lock.json merge=hugremote-updater';

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function gitBytes(args) {
  return execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
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

function parseLock(bytes) {
  return JSON.parse(bytes.toString('utf8'));
}

function untrackedFingerprint(commit) {
  try {
    const parent = git(['rev-parse', `${commit}^3`]);
    const hex = gitBytes(['ls-tree', '-r', '-z', parent]).toString('hex');
    return hex || 'empty';
  } catch (_) {
    return 'empty';
  }
}

function inspectBackup(commit, subject, order) {
  try {
    const base = git(['rev-parse', `${commit}^1`]);
    const indexCommit = git(['rev-parse', `${commit}^2`]);
    const changed = git(['diff', '--name-only', base, commit]).split(/\r?\n/).filter(Boolean);
    if (changed.length !== 1 || changed[0] !== 'package-lock.json') {
      return { valid: false, commit, subject, order, reason: 'tracked diff không chỉ có package-lock.json' };
    }
    const baseBytes = gitBytes(['show', `${base}:package-lock.json`]);
    const indexBytes = gitBytes(['show', `${indexCommit}:package-lock.json`]);
    const stashedBytes = gitBytes(['show', `${commit}:package-lock.json`]);
    const baseLock = parseLock(baseBytes);
    const stashedLock = parseLock(stashedBytes);
    return {
      valid: true,
      commit,
      subject,
      order,
      base,
      baseBytes,
      indexMatchesBase: indexBytes.equals(baseBytes),
      stashedBytes,
      metadataOnly: stable(normalize(baseLock)) === stable(normalize(stashedLock)),
      untracked: untrackedFingerprint(commit),
    };
  } catch (error) {
    return { valid: false, commit, subject, order, reason: error.message };
  }
}

function isReleaseRestoreContext() {
  try {
    return git(['rev-parse', '--abbrev-ref', 'HEAD']) === 'HEAD' &&
      /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(git(['describe', '--tags', '--exact-match']));
  } catch (_) {
    return false;
  }
}

function prepareMergeDriver() {
  let existingConfig = '';
  try { existingConfig = git(['config', '--get-all', 'merge.hugremote-updater.driver']); } catch (_) {}
  const gitDir = path.resolve(root, git(['rev-parse', '--git-dir']));
  const infoDir = path.join(gitDir, 'info');
  const attributesPath = path.join(infoDir, 'attributes');
  let attributes = '';
  try { attributes = fs.readFileSync(attributesPath, 'utf8'); } catch (_) {}
  const attributeLines = attributes.split(/\r?\n/).filter(Boolean);
  if (existingConfig || attributeLines.some(line => /^package-lock\.json\s+.*\bmerge(?:=|\s)/.test(line))) {
    throw new Error('Recovery updater từ chối ghi đè merge config/attribute có sẵn cho package-lock.json.');
  }

  fs.mkdirSync(infoDir, { recursive: true });
  fs.writeFileSync(attributesPath, `${[...attributeLines, attributeMarker].join('\n')}\n`);
  const driverPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'updater_lock_merge_driver.js');
  const quotedDriver = `'${driverPath.replaceAll("'", "'\\''")}'`;
  git(['config', 'merge.hugremote-updater.driver', `node ${quotedDriver} %O %A %B`]);
}

if (isReleaseRestoreContext()) {
  const rawBackups = git(['stash', 'list', '--format=%H%x00%gs'])
    .split(/\r?\n/)
    .map((line, order) => {
      const [commit, subject] = line.split('\u0000');
      return /^[0-9a-f]{40,64}$/.test(commit) && backupSubject.test(subject || '')
        ? { commit, subject, order }
        : null;
    })
    .filter(Boolean);

  if (rawBackups.length > 0) {
    const latest = inspectBackup(rawBackups[0].commit, rawBackups[0].subject, 0);
    const previous = rawBackups[1]
      ? inspectBackup(rawBackups[1].commit, rawBackups[1].subject, 1)
      : null;

    if (!latest.valid) {
      console.error(`Recovery updater từ chối latest backup không hợp lệ: ${latest.reason}`);
      process.exit(1);
    }

    if (latest.metadataOnly) {
      if (!previous?.valid || previous.metadataOnly || !previous.indexMatchesBase ||
          typeof latest.untracked !== 'string' || latest.untracked !== previous.untracked) {
        console.error('Recovery updater không xác minh được immediate original backup hoặc exact untracked tree.');
        process.exit(1);
      }
      const status = git(['status', '--porcelain=v1']);
      if (status) {
        console.error(`Recovery updater yêu cầu working tree sạch sau reconcile, nhận: ${JSON.stringify(status)}`);
        process.exit(1);
      }
      try {
        prepareMergeDriver();
        fs.writeFileSync(path.join(root, 'package-lock.json'), previous.stashedBytes);
        console.log(`✓ Đã chuẩn bị tự động khôi phục byte-exact backup ${previous.commit} qua retry ${latest.commit}.`);
      } catch (error) {
        console.error(error.message);
        process.exit(1);
      }
    } else if (previous?.valid && (previous.metadataOnly || (typeof latest.untracked === 'string' && latest.untracked === previous.untracked))) {
      console.error('Recovery updater phát hiện thứ tự backup bất thường hoặc latest không phải metadata-only retry; dừng fail-closed.');
      process.exit(1);
    }
  }
}
