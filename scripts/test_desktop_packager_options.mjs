import assert from 'node:assert/strict';
import { makePackagerOptions } from '../desktop/packager-options.mjs';
const options = makePackagerOptions({ shellDir: '/input/shell', output: '/output', payload: '/input/hugremote', nodeDir: '/input/node', arch: 'arm64' });
assert.match(options.electronVersion, /^\d+\.\d+\.\d+$/);
assert.equal(options.dir, '/input/shell');
assert.deepEqual(options.extraResource, ['/input/hugremote', '/input/node']);
console.log('PASS optional desktop packager pins installed Electron version');
