import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { vi } from '../src/i18n/vi';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const srcRoot = path.join(webRoot, 'src');

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flattenKeys(v as Record<string, unknown>, key));
    else out.push(key);
  }
  return out.sort();
}

function walkFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkFiles(p, exts));
    else if (exts.some((e) => ent.name.endsWith(e))) out.push(p);
  }
  return out;
}

describe('i18n vi <-> en (AC-27)', () => {
  it('khớp 100% khoá giữa vi và en, không khoá rỗng', () => {
    const vk = flattenKeys(vi as unknown as Record<string, unknown>);
    const ek = flattenKeys(en as unknown as Record<string, unknown>);
    const missingInEn = vk.filter((k) => !ek.includes(k));
    const extraInEn = ek.filter((k) => !vk.includes(k));
    expect(missingInEn).toEqual([]);
    expect(extraInEn).toEqual([]);
  });
});

describe('Design system token & #/_ds (AC-13, G-10, G-16)', () => {
  it('không có mã màu thô (hex/rgb/hsl) trong apps/web/src ngoài tokens.css', () => {
    const files = walkFiles(srcRoot, ['.ts', '.tsx', '.css']).filter((f) => !f.endsWith('tokens.css'));
    const offenders: string[] = [];
    const re = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
    for (const f of files) {
      const txt = fs.readFileSync(f, 'utf8');
      txt.split('\n').forEach((line, idx) => {
        if (re.test(line)) offenders.push(`${path.relative(webRoot, f)}:${idx + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('mọi var(--…) trong CSS/TSX đều đã khai trong tokens.css hoặc được gán cục bộ', () => {
    const tokensCss = fs.readFileSync(path.join(srcRoot, 'styles/tokens.css'), 'utf8');
    const declared = new Set<string>();
    for (const m of tokensCss.matchAll(/(--[a-z0-9-]+)\s*:/gi)) declared.add(m[1]);

    const files = walkFiles(srcRoot, ['.ts', '.tsx', '.css']);
    // Biến cục bộ do CSS component tự đặt (vd --d, --l, --w) cũng được coi là hợp lệ
    for (const f of files) {
      const txt = fs.readFileSync(f, 'utf8');
      for (const m of txt.matchAll(/(--[a-z0-9-]+)\s*:/gi)) declared.add(m[1]);
    }
    const unknown: string[] = [];
    for (const f of files) {
      if (f.endsWith('tokens.css')) continue;
      const txt = fs.readFileSync(f, 'utf8');
      for (const m of txt.matchAll(/var\(\s*(--[a-z0-9-]+)\s*[,)]/gi)) {
        if (!declared.has(m[1])) unknown.push(`${path.relative(webRoot, f)} -> ${m[1]}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('tokens.css đủ toàn bộ token của gói intake/design-systems/hugremote/tokens.json (khi có gói)', () => {
    const pkgPath = path.resolve(webRoot, '../../../../../intake/design-systems/hugremote/tokens.json');
    if (!fs.existsSync(pkgPath)) return;
    const tokens = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
    const expected: string[] = [];
    (function walk(node: unknown, trail: string[]) {
      if (node && typeof node === 'object' && ('$value' in node || 'value' in node)) {
        expected.push('--' + trail.join('-'));
        return;
      }
      if (!node || typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k.startsWith('$') || k.startsWith('_')) continue;
        if (typeof v === 'string') expected.push('--' + [...trail, k].join('-'));
        else walk(v, [...trail, k]);
      }
    })(tokens, []);
    const css = fs.readFileSync(path.join(srcRoot, 'styles/tokens.css'), 'utf8');
    const missing = expected.filter((k) => !css.includes(`${k}:`));
    expect(missing).toEqual([]);
  });
});
