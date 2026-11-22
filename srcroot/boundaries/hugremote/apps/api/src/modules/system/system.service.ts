import { Inject, Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { APP_CONFIG } from '../../config/app-config';
import type { AppConfig } from '../../config/app-config';

export type LogKind = 'app' | 'ssh' | 'update';
export interface Check {
  name: string;
  ok: boolean;
  /** Thiếu mục không bắt buộc → chỉ cảnh báo. */
  required?: boolean;
  detail: string;
  hint?: string;
}

const LEVEL: Record<number, string> = { 10: 'TRACE', 20: 'DEBUG', 30: 'INFO ', 40: 'WARN ', 50: 'ERROR', 60: 'FATAL' };

function version(cmd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) =>
    execFile(cmd, args, { timeout: 5000 }, (err, out, errOut) => {
      if (err) return resolve(null);
      resolve(`${out}${errOut}`.split('\n')[0].trim() || 'có');
    }),
  );
}

function modeOf(p: string) {
  try {
    return fs.statSync(p).mode & 0o777;
  } catch {
    return null;
  }
}

/** Thông tin phiên bản, tình trạng máy chạy HugRemote và nhật ký trong app (AC-15, AC-46). Chỉ owner. */
@Injectable()
export class SystemService {
  private readonly startedAt = new Date().toISOString();
  private readonly version: string;

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {
    let v = '0.0.0';
    for (const p of [path.resolve(__dirname, '../../../../../package.json'), path.resolve(process.cwd(), '../../package.json')])
      try {
        v = (JSON.parse(fs.readFileSync(p, 'utf8')) as { version: string }).version;
        break;
      } catch {
        /* thử đường khác */
      }
    this.version = v;
  }

  info() {
    return {
      version: this.version,
      channel: this.cfg.updateChannel,
      node: process.versions.node,
      address: `${this.cfg.host}:${this.cfg.port}`,
      basePath: this.cfg.basePath || '/',
      appUrl: this.cfg.appUrl,
      dataDir: this.cfg.dataDir,
      startedAt: this.startedAt,
    };
  }

  async checks(): Promise<Check[]> {
    const rows: Check[] = [];
    const node = Number(process.versions.node.split('.')[0]);
    rows.push({ name: 'Node.js', ok: node >= 22, required: true, detail: process.versions.node, hint: 'Cần Node 22 trở lên' });
    const tools: [string, string[], string, boolean][] = [
      ['git', ['--version'], 'git', true],
      ['ssh', ['-V'], 'OpenSSH', true],
      ['rg', ['--version'], 'ripgrep (tìm trong dự án)', false],
      ['python3', ['--version'], 'python3 (nén zip)', false],
      [this.cfg.claudeBinPath ?? 'claude', ['--version'], 'Claude Code CLI (máy này)', false],
    ];
    const vs = await Promise.all(tools.map(([c, a]) => version(c, a)));
    const hints: Record<string, string> = {
      rg: 'Nên cài ripgrep — tìm trong dự án nhanh hơn',
      python3: 'Nên cài python3 — tải thư mục dạng zip',
    };
    tools.forEach(([c, , name, need], i) =>
      rows.push({
        name,
        ok: !!vs[i],
        required: need,
        detail: vs[i] ?? 'không có',
        hint: need ? `Cài ${c}` : (hints[c] ?? 'Cài Claude Code: npm i -g @anthropic-ai/claude-code (rồi đăng nhập)'),
      }),
    );
    const d = this.cfg.dataDir;
    const dm = modeOf(d);
    const dbm = modeOf(path.join(d, 'hugremote.db'));
    const km = modeOf(path.join(d, 'secret.key'));
    const permOk = dm === 0o700 && dbm === 0o600 && km === 0o600;
    rows.push({
      name: 'Quyền dữ liệu 0700 / DB 0600',
      ok: permOk,
      required: true,
      detail: `thư mục ${dm?.toString(8) ?? '—'} · DB ${dbm?.toString(8) ?? '—'} · khoá ${km?.toString(8) ?? '—'}`,
      hint: 'Chạy `hugremote doctor --fix`',
    });
    if (this.cfg.appUrl.startsWith('http://') && !['127.0.0.1', 'localhost', '::1'].includes(this.cfg.host))
      rows.push({
        name: 'HTTPS',
        ok: false,
        detail: this.cfg.appUrl,
        hint: 'Đặt sau reverse proxy/Cloudflare Tunnel và đặt APP_URL https://…',
      });
    return rows;
  }

  /** 300 dòng cuối (đọc tối đa 512KB cuối file), dạng `HH:MM:SS LEVEL thông điệp`. */
  logs(kind: LogKind, lines = 300): string[] {
    const file = path.join(this.cfg.dataDir, 'logs', kind === 'update' ? 'update.log' : 'app.log');
    let text = '';
    try {
      const fd = fs.openSync(file, 'r');
      const size = fs.fstatSync(fd).size;
      const len = Math.min(size, 512 * 1024);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, size - len);
      fs.closeSync(fd);
      text = buf.toString('utf8');
    } catch {
      return [];
    }
    const out: string[] = [];
    for (const raw of text.split('\n')) {
      if (!raw.trim()) continue;
      if (!raw.startsWith('{')) {
        if (kind === 'update') out.push(raw);
        continue;
      }
      let o: Record<string, unknown>;
      try {
        o = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        continue;
      }
      const ctx = typeof o.context === 'string' ? o.context : '';
      const msg = typeof o.msg === 'string' ? o.msg : '';
      // bỏ log từng request (quá nhiều), giữ sự kiện của app
      if (o.req && msg === 'request completed' && Number((o.res as { statusCode?: number } | undefined)?.statusCode) < 500) continue;
      if (['RouterExplorer', 'RoutesResolver', 'InstanceLoader'].includes(ctx) || msg === 'request aborted') continue;
      if (kind === 'ssh' && !/ssh|host/i.test(`${ctx} ${msg}`)) continue;
      const time = new Date(Number(o.time)).toTimeString().slice(0, 8);
      const err = (o.err as { message?: string } | undefined)?.message;
      out.push(`${time} ${LEVEL[Number(o.level)] ?? 'INFO '} ${ctx ? `[${ctx}] ` : ''}${msg}${err ? ` — ${err}` : ''}`);
    }
    return out.slice(-lines);
  }
}
