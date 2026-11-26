import type { HostRuntime } from '../host/host-runtime';

export interface CliSession {
  /** Session id của CLI (= tên file `.jsonl`). */
  id: string;
  title: string;
  updatedAt: string;
}

/** Thư mục CLI lưu phiên theo cwd: mọi ký tự không phải chữ/số → `-` (`/a/b.c` → `-a-b-c`). */
export const cliProjectSlug = (absCwd: string) => absCwd.replace(/[^a-zA-Z0-9]/g, '-');

const SEP = '\u0001@@HR@@';

/**
 * Đọc phiên Claude CLI có sẵn của một thư mục trên máy đích (`~/.claude/projects/<slug>/*.jsonl`) — 30 phiên mới
 * nhất, mỗi file chỉ đọc 64KB cuối để lấy tiêu đề. Một lệnh `sh` cho cả local lẫn SSH (không mở SFTP từng file).
 */
export async function listCliSessions(rt: HostRuntime, absCwd: string): Promise<CliSession[]> {
  const dir = `$HOME/.claude/projects/${cliProjectSlug(absCwd)}`;
  const script =
    `cd "${dir}" 2>/dev/null || exit 0; ` +
    `for f in $(ls -t -- *.jsonl 2>/dev/null | head -30); do ` +
    `printf '\\n${SEP} %s %s\\n' "$f" "$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f")"; tail -c 65536 "$f"; done`;
  const r = await rt.exec(['sh', '-c', script], { timeoutMs: 15_000, maxBytes: 4 * 1024 * 1024 });
  return parseCliDump(r.stdout.toString('utf8'));
}

export function parseCliDump(out: string): CliSession[] {
  const res: CliSession[] = [];
  for (const chunk of out.split(`\n${SEP} `).slice(1)) {
    const nl = chunk.indexOf('\n');
    const [file, mtime] = chunk.slice(0, nl).split(' ');
    const id = file.replace(/\.jsonl$/, '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
    let custom = '';
    let ai = '';
    let prompt = '';
    let valid = false;
    for (const line of chunk.slice(nl + 1).split('\n')) {
      if (!line.startsWith('{')) continue; // dòng đầu bị cắt giữa chừng
      let o: Record<string, unknown>;
      try {
        o = JSON.parse(line) as Record<string, unknown>;
        valid = true;
      } catch {
        continue;
      }
      if (o.type === 'custom-title' && typeof o.customTitle === 'string') custom = o.customTitle;
      else if (o.type === 'agent-name' && typeof o.agentName === 'string' && !custom) custom = o.agentName;
      else if (o.type === 'ai-title' && typeof o.aiTitle === 'string') ai = o.aiTitle;
      else if (o.type === 'user' && !prompt) {
        const c = (o.message as { content?: unknown } | undefined)?.content;
        const text =
          typeof c === 'string'
            ? c
            : Array.isArray(c)
              ? (c as { type?: string; text?: string }[]).find((b) => b.type === 'text')?.text
              : '';
        if (text && !text.startsWith('<')) prompt = text;
      }
    }
    if (!valid) continue; // file rỗng/hỏng: CLI không resume được → không đưa vào danh sách (dogfood edge L1)
    const title = (custom || ai || prompt || id.slice(0, 8)).replace(/\s+/g, ' ').trim().slice(0, 80);
    res.push({ id, title, updatedAt: new Date(Number(mtime) * 1000).toISOString() });
  }
  return res;
}
