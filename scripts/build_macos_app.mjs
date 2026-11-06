import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { stageWorkspaceManifests } from '../desktop/stage-workspaces.mjs';
const requireDesktop = createRequire(new URL('../desktop/package.json', import.meta.url));
const { packager } = requireDesktop('@electron/packager');

if (process.platform !== 'darwin') throw new Error('Build macOS .app on a Mac (or a macOS CI runner).');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildRoot = path.join(repo, 'dist', 'macos-build');
const payload = path.join(buildRoot, 'hugremote');
const nodeDir = path.join(buildRoot, 'node');
const shellDir = path.join(buildRoot, 'shell');
const output = path.join(repo, 'dist', 'macos-app');
fs.rmSync(buildRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(payload, 'apps/api'), { recursive: true });
fs.mkdirSync(path.join(nodeDir, 'bin'), { recursive: true });
fs.mkdirSync(shellDir, { recursive: true });
for (const part of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(repo, part), path.join(payload, part));
fs.cpSync(path.join(repo, 'apps/api/dist'), path.join(payload, 'apps/api/dist'), { recursive: true });
fs.cpSync(path.join(repo, 'apps/api/public'), path.join(payload, 'apps/api/public'), { recursive: true });
stageWorkspaceManifests(repo, payload);
fs.cpSync(path.join(repo, 'packages/shared/dist'), path.join(payload, 'packages/shared/dist'), { recursive: true });
// Native node-pty must be installed on the target Mac with the bundled Node ABI.
execFileSync('npm', ['ci', '--omit=dev', '--foreground-scripts'], { cwd: payload, stdio: 'inherit' });
fs.copyFileSync(process.execPath, path.join(nodeDir, 'bin/node'));
fs.chmodSync(path.join(nodeDir, 'bin/node'), 0o755);
if (!fs.existsSync(path.join(payload, 'node_modules/node-pty'))) throw new Error('Native node-pty missing from payload');
// macOS signing/notarization requires signing these binaries inside Contents/Resources too.
const pty = path.join(payload, 'node_modules/node-pty');
for (const helper of [
  path.join(pty, 'build/Release/spawn-helper'),
  path.join(pty, `prebuilds/darwin-${process.arch}/spawn-helper`),
]) if (fs.existsSync(helper)) fs.chmodSync(helper, 0o755);
execFileSync(path.join(nodeDir, 'bin/node'), ['-e', "require('node-pty'); console.log('PTY_OK')"], { cwd: payload, stdio: 'inherit' });
for (const file of ['main.cjs', 'launcher.mjs']) fs.copyFileSync(path.join(repo, 'desktop', file), path.join(shellDir, file));
fs.writeFileSync(path.join(shellDir, 'package.json'), JSON.stringify({
  name: 'hugremote-desktop', version: JSON.parse(fs.readFileSync(path.join(repo, 'package.json'))).version,
  productName: 'HugRemote', main: 'main.cjs', private: true,
}, null, 2));
fs.mkdirSync(output, { recursive: true });
const results = await packager({
  dir: shellDir, out: output, overwrite: true, platform: 'darwin', arch: process.arch,
  appBundleId: 'com.hugtech.hugremote', name: 'HugRemote', asar: false,
  extraResource: [payload, nodeDir],
});
const appPath = results[0];
const resources = path.join(appPath, 'Contents/Resources');
for (const file of [
  'node/bin/node', 'hugremote/apps/api/dist/main.js', 'hugremote/apps/api/public/index.html',
]) if (!fs.existsSync(path.join(resources, file))) throw new Error(`Incomplete bundle: ${file}`);
console.log(`Built optional macOS app: ${appPath}`);
