// Sinh src/styles/tokens.css từ gói design system (hợp đồng — G-10, G-16). Không sửa tay tokens.css.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.resolve(here, '../../../../../../intake/design-systems/hugremote/tokens.json');
const out = path.resolve(here, '../src/styles/tokens.css');
if (!fs.existsSync(pkg)) {
  // bản phát hành chỉ chứa target (không có intake/) → dùng tokens.css đã sinh và commit sẵn
  if (!fs.existsSync(out)) throw new Error(`Thiếu ${pkg} và ${out}`);
  console.log('gen-tokens: không có gói design system — giữ tokens.css đã commit');
  process.exit(0);
}
const tokens = JSON.parse(fs.readFileSync(pkg, 'utf8'));

const flat = [];
(function walk(node, trail) {
  if (node && typeof node === 'object' && ('$value' in node || 'value' in node)) {
    flat.push(['--' + trail.join('-'), String(node.$value ?? node.value)]);
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('$') || k.startsWith('_')) continue;
    if (typeof v === 'string') flat.push(['--' + [...trail, k].join('-'), v]);
    else walk(v, [...trail, k]);
  }
})(tokens, []);

const root = flat.map(([k, v]) => `  ${k}: ${v};`).join('\n');
const light = flat
  .filter(([k]) => k.startsWith('--light-'))
  .map(([k]) => `  --color-${k.slice('--light-'.length)}: var(${k});`)
  .join('\n');

const css = `/* SINH TỰ ĐỘNG từ intake/design-systems/hugremote/tokens.json — chạy \`pnpm tokens\`. KHÔNG SỬA TAY. */
:root {
${root}
}
:root[data-theme="light"] {
${light}
}
@media (prefers-color-scheme: light) {
  :root[data-theme="system"] {
${light.replace(/^/gm, '  ')}
  }
}
/* Dưới 1024px (cảm ứng) các thanh cao bằng vùng chạm */
@media (max-width: 1023px) {
  :root { --bar-h: var(--bar-h-touch); }
}
`;
fs.writeFileSync(out, css);
console.log(`tokens.css: ${flat.length} token`);
