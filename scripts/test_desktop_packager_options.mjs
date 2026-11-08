import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makePackagerOptions } from '../desktop/packager-options.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const icnsPath = path.join(repoRoot, 'desktop', 'icon.icns');
const pngPath = path.join(repoRoot, 'desktop', 'icon.png');
const mainCjsPath = path.join(repoRoot, 'desktop', 'main.cjs');

const options = makePackagerOptions({ shellDir: '/input/shell', output: '/output', payload: '/input/hugremote', nodeDir: '/input/node', arch: 'arm64' });
assert.match(options.electronVersion, /^\d+\.\d+\.\d+$/);
assert.equal(options.dir, '/input/shell');
assert.deepEqual(options.extraResource, ['/input/hugremote', '/input/node']);
assert.equal(options.icon, icnsPath, 'makePackagerOptions must set options.icon to desktop/icon.icns');

assert.ok(fs.existsSync(icnsPath), 'desktop/icon.icns must exist');
const icnsBuf = fs.readFileSync(icnsPath);
assert.equal(icnsBuf.subarray(0, 4).toString('ascii'), 'icns', 'desktop/icon.icns must have valid icns magic header');
assert.equal(icnsBuf.readUInt32BE(4), icnsBuf.length, 'desktop/icon.icns total length header must match file size');
for (const chunkType of ['ic07', 'ic08', 'ic09', 'ic10', 'ic11', 'ic12', 'ic13', 'ic14']) {
  assert.ok(icnsBuf.includes(Buffer.from(chunkType, 'ascii')), `desktop/icon.icns must contain ${chunkType} icon entry`);
}

assert.ok(fs.existsSync(pngPath), 'desktop/icon.png must exist');
const pngBuf = fs.readFileSync(pngPath);
assert.deepEqual(pngBuf.subarray(0, 8), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'desktop/icon.png must be a valid PNG');

const mainCjs = fs.readFileSync(mainCjsPath, 'utf8');
assert.match(mainCjs, /icon\.png/, 'desktop/main.cjs must reference icon.png for BrowserWindow and macOS dock');
assert.match(mainCjs, /app\.dock\.setIcon/, 'desktop/main.cjs must set macOS dock icon');

console.log('PASS optional desktop packager pins installed Electron version and configures web favicon as macOS icon');
