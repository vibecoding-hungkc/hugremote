import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveMacAppPath } from '../desktop/packager-options.mjs';

assert.equal(
  resolveMacAppPath(['/build/dist/HugRemote-darwin-arm64'], 'HugRemote'),
  path.join('/build/dist/HugRemote-darwin-arm64', 'HugRemote.app'),
);
console.log('PASS packager result directory resolves to macOS app bundle');
