import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  preparePayloadForBundle,
  findNestedCodePaths,
  signAndVerifyMacApp,
  buildMacDmg,
} from '../desktop/macos-installer.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hugremote-macos-installer-test-'));
try {
  // 1. Test preparePayloadForBundle removes symlinks & foreign prebuilds
  const payload = path.join(tmp, 'payload');
  fs.mkdirSync(path.join(payload, 'packages/shared/dist'), { recursive: true });
  fs.writeFileSync(path.join(payload, 'packages/shared/package.json'), '{"name":"@hugremote/shared"}');
  fs.writeFileSync(path.join(payload, 'packages/shared/dist/index.js'), 'export const ok = true;\n');
  fs.mkdirSync(path.join(payload, 'apps/api'), { recursive: true });
  fs.mkdirSync(path.join(payload, 'apps/web'), { recursive: true });
  fs.mkdirSync(path.join(payload, 'node_modules/.bin'), { recursive: true });
  fs.mkdirSync(path.join(payload, 'node_modules/@hugremote'), { recursive: true });
  fs.symlinkSync('../../packages/shared', path.join(payload, 'node_modules/@hugremote/shared'));
  fs.symlinkSync('../../apps/api', path.join(payload, 'node_modules/@hugremote/api'));
  fs.symlinkSync('../../apps/web', path.join(payload, 'node_modules/@hugremote/web'));
  for (const target of ['darwin-arm64', 'darwin-x64', 'win32-x64']) {
    const dir = path.join(payload, 'node_modules/node-pty/prebuilds', target);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'pty.node'), 'stub');
  }

  preparePayloadForBundle(payload, 'arm64');

  assert.equal(fs.existsSync(path.join(payload, 'node_modules/.bin')), false);
  assert.equal(fs.existsSync(path.join(payload, 'node_modules/@hugremote/api')), false);
  assert.equal(fs.existsSync(path.join(payload, 'node_modules/@hugremote/web')), false);
  const sharedStat = fs.lstatSync(path.join(payload, 'node_modules/@hugremote/shared'));
  assert.equal(sharedStat.isSymbolicLink(), false);
  assert.equal(sharedStat.isDirectory(), true);
  assert.equal(
    fs.existsSync(path.join(payload, 'node_modules/@hugremote/shared/dist/index.js')),
    true,
  );
  assert.equal(fs.existsSync(path.join(payload, 'node_modules/node-pty/prebuilds/darwin-arm64')), true);
  assert.equal(fs.existsSync(path.join(payload, 'node_modules/node-pty/prebuilds/darwin-x64')), false);
  assert.equal(fs.existsSync(path.join(payload, 'node_modules/node-pty/prebuilds/win32-x64')), false);

  // 2. Test findNestedCodePaths + signAndVerifyMacApp
  const appPath = path.join(tmp, 'HugRemote.app');
  const resources = path.join(appPath, 'Contents/Resources');
  const nodeBin = path.join(resources, 'node/bin/node');
  const ptyNode = path.join(resources, 'hugremote/node_modules/node-pty/prebuilds/darwin-arm64/pty.node');
  const spawnHelper = path.join(resources, 'hugremote/node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper');
  const winNode = path.join(resources, 'hugremote/node_modules/other/win.node');
  const htmlFile = path.join(resources, 'hugremote/apps/api/public/index.html');

  const machoHeader = Buffer.from([0xcf, 0xfa, 0xed, 0xfe, 0x00, 0x00, 0x00, 0x00]);
  for (const file of [nodeBin, ptyNode, spawnHelper]) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, machoHeader);
  }
  fs.mkdirSync(path.dirname(winNode), { recursive: true });
  fs.writeFileSync(winNode, Buffer.from('MZnotmacho'));
  fs.mkdirSync(path.dirname(htmlFile), { recursive: true });
  fs.writeFileSync(htmlFile, '<html></html>');

  const nested = findNestedCodePaths(resources);
  assert.deepEqual(new Set(nested), new Set([nodeBin, ptyNode, spawnHelper]));
  assert.ok(
    nested.indexOf(ptyNode) < nested.indexOf(nodeBin),
    'Deeper nested binaries must be signed before shallower ones',
  );

  const calls = [];
  const fakeRun = (cmd, args) => {
    calls.push([cmd, args]);
  };
  signAndVerifyMacApp(appPath, fakeRun);
  assert.equal(calls.length, 5);
  for (let i = 0; i < 3; i++) {
    assert.equal(calls[i][0], 'codesign');
    assert.deepEqual(calls[i][1].slice(0, 3), ['--force', '--sign', '-']);
  }
  assert.deepEqual(calls[3], [
    'codesign',
    [
      '--force',
      '--deep',
      '--preserve-metadata=entitlements,requirements,flags,runtime',
      '--sign',
      '-',
      appPath,
    ],
  ]);
  assert.deepEqual(calls[4], [
    'codesign',
    ['--verify', '--deep', '--strict', '--verbose=2', appPath],
  ]);

  // 3. Test buildMacDmg stages HugRemote.app + /Applications symlink, builds UDZO dmg, and signs it
  const dmgStageDir = path.join(tmp, 'dmg-stage');
  const dmgPath = path.join(tmp, 'out/HugRemote-macOS-arm64.dmg');
  const dmgCalls = [];
  const returnedDmg = buildMacDmg({
    appPath,
    dmgStageDir,
    dmgPath,
    volumeName: 'HugRemote',
    run: (cmd, args) => {
      dmgCalls.push([cmd, args]);
    },
  });
  assert.equal(returnedDmg, dmgPath);
  assert.equal(fs.readlinkSync(path.join(dmgStageDir, 'Applications')), '/Applications');
  assert.deepEqual(dmgCalls, [
    ['ditto', [appPath, path.join(dmgStageDir, 'HugRemote.app')]],
    [
      'hdiutil',
      ['create', '-volname', 'HugRemote', '-srcfolder', dmgStageDir, '-ov', '-format', 'UDZO', dmgPath],
    ],
    ['codesign', ['--force', '--sign', '-', dmgPath]],
  ]);

  console.log('PASS macOS payload cleanup, inside-out ad-hoc codesign, and DMG installer builder');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
