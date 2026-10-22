import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const template = readFileSync(new URL('../apps/web/src/components/FileExplorer.vue', import.meta.url), 'utf8');
const iconFor = handler => template.split('@click="' + handler + '(item)"')[1]?.match(/<i class="([^"]+)"/)?.[1];
assert.equal(iconFor('handleDownloadFile'), 'ri-download-2-line');
assert.equal(iconFor('handleDownloadFolder'), iconFor('handleDownloadFile'), 'Folder and file row downloads must share the download icon');
console.log('PASS folder/file row download icons match; separate handlers preserved');
