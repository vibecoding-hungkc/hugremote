import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@vue/compiler-sfc';

const file = parse(readFileSync('apps/web/src/components/FileExplorer.vue', 'utf8')).descriptor;
const header = parse(readFileSync('apps/web/src/components/SmartHeader.vue', 'utf8')).descriptor;
const toolbarButton = file.template.content.match(/<button\s+type="button"\s+class="btn-tool-action download"[\s\S]*?<\/button>/)?.[0];
assert.ok(toolbarButton, 'File toolbar ZIP download button must remain');
assert.match(toolbarButton, /@click="handleDownloadCurrentFolder"/, 'Keep ZIP download behavior');
assert.match(toolbarButton, /:title="t\('fileExplorer.downloadZip'\)"/, 'Keep descriptive tooltip');
assert.match(toolbarButton, /:aria-label="t\('fileExplorer.downloadZip'\)"/, 'Icon-only button needs an accessible name');
assert.match(toolbarButton, /<i class="ri-download-2-line"/);
assert.doesNotMatch(toolbarButton, /<span/);
assert.match(file.styles.map(s => s.content).join('\n'), /\.btn-tool-action\.download\s*\{[^}]*width:\s*30px;[^}]*height:\s*30px;/);
assert.match(header.template.content, /@click="handleDownloadCurrentFolder"[^>]*><i class="ri-download-2-line"/);
const proto = readFileSync('analysis/prototypes/prototype.html', 'utf8');
assert.match(proto, /id="btn-quick-download-zip"[^>]*><i class="ri-download-2-line"/);
console.log('PASS ZIP action unchanged; File toolbar and header use accessible download icons');
