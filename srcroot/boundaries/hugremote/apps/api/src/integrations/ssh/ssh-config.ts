import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** Một Host block cụ thể (không wildcard) đọc từ `~/.ssh/config` — nguồn sự thật của danh sách máy (A2). */
export interface SshHostEntry {
  alias: string;
  hostName: string;
  user?: string;
  port: number;
  identityFile?: string;
  proxyJump?: string;
  /** File chứa block (file gốc hoặc file Include) — để ghi/xoá đúng chỗ. */
  file: string;
}

export interface SshConfigResult {
  hosts: SshHostEntry[];
  warnings: string[];
}

interface RawBlock {
  patterns: string[];
  opts: Map<string, string>;
  file: string;
}

const MAX_INCLUDE_DEPTH = 16;

const expandHome = (p: string) => (p === '~' ? os.homedir() : p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p);

/** Glob đơn giản cho Include (`*`, `?`) — chỉ trong một cấp thư mục, như OpenSSH. */
function globFiles(pattern: string, baseDir: string): string[] {
  const abs = path.isAbsolute(expandHome(pattern)) ? expandHome(pattern) : path.join(baseDir, pattern);
  if (!/[*?]/.test(abs)) return fs.existsSync(abs) ? [abs] : [];
  const dir = path.dirname(abs);
  const re = new RegExp(
    '^' +
      path
        .basename(abs)
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$',
  );
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => re.test(f))
      .sort()
      .map((f) => path.join(dir, f))
      .filter((f) => fs.statSync(f).isFile());
  } catch {
    return [];
  }
}

function tokenize(line: string): [string, string] | null {
  const t = line.trim();
  if (!t || t.startsWith('#')) return null;
  const m = /^(\S+?)(?:\s*=\s*|\s+)(.*)$/.exec(t);
  if (!m) return null;
  let v = m[2].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  return [m[1].toLowerCase(), v];
}

function readBlocks(file: string, depth: number, seen: Set<string>, warnings: string[]): RawBlock[] {
  let real: string;
  try {
    real = fs.realpathSync(file);
  } catch {
    return [];
  }
  if (seen.has(real)) {
    warnings.push(`Include vòng lặp bị bỏ qua: ${file}`);
    return [];
  }
  if (depth > MAX_INCLUDE_DEPTH) {
    warnings.push(`Include quá sâu bị bỏ qua: ${file}`);
    return [];
  }
  seen.add(real);
  const out: RawBlock[] = [];
  let cur: RawBlock = { patterns: ['*'], opts: new Map(), file };
  let lineNo = 0;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    lineNo++;
    const kv = tokenize(line);
    if (!kv) continue;
    const [k, v] = kv;
    if (k === 'include') {
      out.push(cur);
      for (const pat of v.split(/\s+/)) {
        for (const f of globFiles(pat, path.join(os.homedir(), '.ssh'))) out.push(...readBlocks(f, depth + 1, seen, warnings));
      }
      cur = { patterns: cur.patterns, opts: new Map(), file };
      continue;
    }
    if (k === 'host') {
      out.push(cur);
      cur = { patterns: v.split(/\s+/).filter(Boolean), opts: new Map(), file };
      continue;
    }
    if (k === 'match') {
      // Match không hỗ trợ — bỏ qua cả block cho tới Host kế tiếp
      out.push(cur);
      cur = { patterns: [], opts: new Map(), file };
      continue;
    }
    if (!/^[a-z]+$/.test(k)) {
      warnings.push(`${path.basename(file)}:${lineNo}: dòng không hiểu được, bỏ qua`);
      continue;
    }
    if (!cur.opts.has(k)) cur.opts.set(k, v); // giá trị đầu tiên thắng
  }
  out.push(cur);
  return out;
}

function matches(pattern: string, alias: string): boolean {
  const neg = pattern.startsWith('!');
  const p = neg ? pattern.slice(1) : pattern;
  const re = new RegExp(
    '^' +
      p
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$',
  );
  return re.test(alias);
}

function blockApplies(b: RawBlock, alias: string): boolean {
  if (b.patterns.some((p) => p.startsWith('!') && matches(p, alias))) return false;
  return b.patterns.some((p) => !p.startsWith('!') && matches(p, alias));
}

/** Đọc config (kể cả Include đệ quy, chống vòng), trả mọi alias cụ thể với tuỳ chọn đã gộp theo luật "giá trị đầu thắng". */
export function parseSshConfig(configPath: string): SshConfigResult {
  const warnings: string[] = [];
  if (!fs.existsSync(configPath)) return { hosts: [], warnings };
  const blocks = readBlocks(configPath, 0, new Set(), warnings);
  const aliases: { alias: string; file: string }[] = [];
  for (const b of blocks) {
    for (const p of b.patterns) {
      if (!/[*?!]/.test(p) && !aliases.some((a) => a.alias === p)) aliases.push({ alias: p, file: b.file });
    }
  }
  const hosts: SshHostEntry[] = [];
  for (const { alias, file } of aliases) {
    const o = new Map<string, string>();
    for (const b of blocks) if (blockApplies(b, alias)) for (const [k, v] of b.opts) if (!o.has(k)) o.set(k, v);
    const port = Number(o.get('port') ?? 22);
    hosts.push({
      alias,
      hostName: (o.get('hostname') ?? alias).replace(/%h/g, alias),
      user: o.get('user'),
      port: Number.isInteger(port) && port > 0 ? port : 22,
      identityFile: o.get('identityfile'),
      proxyJump: o.get('proxyjump') && o.get('proxyjump') !== 'none' ? o.get('proxyjump') : undefined,
      file,
    });
  }
  return { hosts, warnings };
}

/** Cache theo mtime của mọi file đã đọc — file đổi bên ngoài thì đọc lại (ARCHITECTURE §6 "Sửa đồng thời"). */
export class SshConfigCache {
  private cached?: { stamp: string; result: SshConfigResult };
  constructor(private readonly configPath: string) {}

  private stamp(): string {
    const files = [this.configPath, ...(this.cached?.result.hosts.map((h) => h.file) ?? [])];
    return [...new Set(files)]
      .map((f) => {
        try {
          return `${f}:${fs.statSync(f).mtimeMs}`;
        } catch {
          return `${f}:-`;
        }
      })
      .join('|');
  }

  get(): SshConfigResult {
    const s = this.stamp();
    if (!this.cached || this.cached.stamp !== s) {
      const result = parseSshConfig(this.configPath);
      this.cached = { stamp: '', result };
      this.cached.stamp = this.stamp();
    }
    return this.cached.result;
  }

  invalidate() {
    this.cached = undefined;
  }

  get path() {
    return this.configPath;
  }
}

// ---------------- ghi Host block (G-7) ----------------

export interface HostBlockInput {
  alias: string;
  hostName: string;
  user?: string;
  port?: number;
  identityFile?: string;
  proxyJump?: string;
}

const SAFE = /^[A-Za-z0-9._@:~/+-]+$/;

/** Kiểm từng giá trị trước khi ghi vào file — không cho xuống dòng/khoảng trắng chèn tuỳ chọn lạ. */
export function assertSafeHostInput(h: HostBlockInput) {
  for (const [k, v] of Object.entries(h)) {
    if (v === undefined || v === '') continue;
    if (!SAFE.test(String(v))) throw new Error(`Giá trị không hợp lệ cho ${k}`);
  }
}

function renderBlock(h: HostBlockInput): string {
  assertSafeHostInput(h);
  const lines = [`Host ${h.alias}`, `  HostName ${h.hostName}`];
  if (h.user) lines.push(`  User ${h.user}`);
  if (h.port && h.port !== 22) lines.push(`  Port ${h.port}`);
  if (h.identityFile) lines.push(`  IdentityFile ${h.identityFile}`);
  if (h.proxyJump) lines.push(`  ProxyJump ${h.proxyJump}`);
  return lines.join('\n') + '\n';
}

export class SshConfigChangedError extends Error {}

/** Tìm vị trí [start, end) của block `Host <alias>` (alias đứng một mình) trong nội dung file. */
function findBlock(text: string, alias: string): [number, number] | null {
  const lines = text.split('\n');
  let start = -1;
  let offset = 0;
  const offsets: number[] = [];
  for (const l of lines) {
    offsets.push(offset);
    offset += l.length + 1;
  }
  for (let i = 0; i < lines.length; i++) {
    const kv = tokenize(lines[i]);
    if (!kv) continue;
    if (kv[0] === 'host' || kv[0] === 'match') {
      if (start >= 0) return [offsets[start], offsets[i]];
      if (kv[0] === 'host' && kv[1].split(/\s+/).length === 1 && kv[1] === alias) start = i;
    }
  }
  return start >= 0 ? [offsets[start], text.length] : null;
}

/**
 * Ghi block: đọc mtime → sửa đúng block (thêm mới vào cuối file gốc) → ghi file tạm + rename;
 * mtime đổi giữa chừng → SshConfigChangedError (api trả 409 `SSH_CONFIG_CHANGED`). Giữ nguyên comment và block khác.
 */
export function writeHostBlock(file: string, h: HostBlockInput, expectMtime?: number) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const exists = fs.existsSync(file);
  const before = exists ? fs.statSync(file).mtimeMs : 0;
  if (expectMtime !== undefined && exists && before !== expectMtime) throw new SshConfigChangedError();
  const text = exists ? fs.readFileSync(file, 'utf8') : '';
  const block = renderBlock(h);
  const at = findBlock(text, h.alias);
  let next: string;
  if (at) {
    const tail = text.slice(at[1]);
    next = text.slice(0, at[0]) + block + (tail && !tail.startsWith('\n') ? '\n' : '') + tail;
  } else {
    next = text + (text && !text.endsWith('\n') ? '\n' : '') + (text ? '\n' : '') + block;
  }
  atomicWrite(file, next, before, exists);
}

export function removeHostBlock(file: string, alias: string) {
  if (!fs.existsSync(file)) return;
  const before = fs.statSync(file).mtimeMs;
  const text = fs.readFileSync(file, 'utf8');
  const at = findBlock(text, alias);
  if (!at) return;
  atomicWrite(file, text.slice(0, at[0]) + text.slice(at[1]).replace(/^\n+/, ''), before, true);
}

function atomicWrite(file: string, content: string, beforeMtime: number, existed: boolean) {
  const tmp = `${file}.hugremote-${process.pid}-${Date.now()}`;
  const modeBits = existed ? fs.statSync(file).mode & 0o777 : 0o600;
  fs.writeFileSync(tmp, content, { mode: modeBits });
  if (existed && fs.statSync(file).mtimeMs !== beforeMtime) {
    fs.unlinkSync(tmp);
    throw new SshConfigChangedError();
  }
  fs.renameSync(tmp, file);
}
