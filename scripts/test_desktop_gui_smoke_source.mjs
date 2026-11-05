import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('desktop/main.cjs'), 'utf8');
assert.match(source, /HUGREMOTE_DESKTOP_SMOKE_FILE/, 'desktop GUI must expose an opt-in CI smoke marker');
assert.match(source, /await window\.loadURL\(origin\)/);
assert.match(source, /app\.quit\(\)/);
console.log('PASS GUI smoke hook exists after page load');
