import { mergeChatItem, type ChatItem } from '@app/shared';
import type { HostRuntime } from '../host/host-runtime';
import { Normalizer } from './protocol';

export interface CliSession {
  /** Session id của CLI (= tên file `.jsonl`). */
  id: string;
  title: string;
  updatedAt: string;
}

/** Thư mục CLI lưu phiên theo cwd: mọi ký tự không phải chữ/số → `-` (`/a/b.c` → `-a-b-c`). */
export const cliProjectSlug = (absCwd: string) => absCwd.replace(/[^a-zA-Z0-9]/g, '-');

/** Id phiên CLI hợp lệ (UUID chữ thường) — tên file, nên phải chặt trước khi ghép vào lệnh shell. */
export const isCliId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);

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

/** Đọc tối đa ngần này byte cuối file phiên khi nhập lịch sử — phiên dài hàng chục MB chỉ lấy phần gần nhất. */
const TRANSCRIPT_TAIL = 4 * 1024 * 1024;
/** Số mục giữ lại khi nhập lịch sử (mục mới nhất). */
const TRANSCRIPT_ITEMS = 400;

/** Nội dung file phiên CLI (phần cuối) — để hiện lại hội thoại cũ khi tiếp tục phiên từ CLI (Authority 2026-11-26). */
export async function readCliTranscript(rt: HostRuntime, absCwd: string, id: string): Promise<string> {
  if (!isCliId(id)) return '';
  const f = `$HOME/.claude/projects/${cliProjectSlug(absCwd)}/${id}.jsonl`;
  const r = await rt.exec(['sh', '-c', `tail -c ${TRANSCRIPT_TAIL} "${f}" 2>/dev/null`], {
    timeoutMs: 15_000,
    maxBytes: TRANSCRIPT_TAIL + 1024,
  });
  return r.stdout.toString('utf8');
}

/**
 * File phiên CLI (`~/.claude/projects/<slug>/<id>.jsonl`) → mục hội thoại như lượt chạy ở HugRemote.
 * Cùng khuôn tin nhắn với stream-json nên dùng lại `Normalizer`; bỏ agent con (`isSidechain`), dòng meta, bản tóm tắt
 * sau /compact và tin lệnh nội bộ (`<command-name>…`). Công cụ mất phần gọi (bị cắt ở đầu file) thì bỏ.
 */
export function parseCliTranscript(jsonl: string, prefix: string): ChatItem[] {
  const norm = new Normalizer(prefix);
  const items = new Map<string, ChatItem>();
  const put = (it: ChatItem) => {
    const prev = items.get(it.id);
    items.set(it.id, prev ? mergeChatItem(prev, it) : it);
  };
  let n = 0;
  for (const line of jsonl.split('\n')) {
    if (!line.startsWith('{')) continue;
    let o: Record<string, unknown>;
    try {
      o = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if ((o.type !== 'user' && o.type !== 'assistant') || o.isSidechain || o.isMeta || o.isCompactSummary) continue;
    if (o.type === 'user') {
      const c = (o.message as { content?: unknown } | undefined)?.content;
      const texts =
        typeof c === 'string'
          ? [c]
          : Array.isArray(c)
            ? (c as { type?: string; text?: string }[]).filter((b) => b.type === 'text').map((b) => b.text ?? '')
            : [];
      const text = texts.filter((x) => x.trim() && !x.startsWith('<')).join('\n\n');
      if (text) put({ kind: 'user', id: `${prefix}-u${++n}`, text });
    }
    for (const op of norm.feed({ ...o, parent_tool_use_id: null })) if (op.op === 'upsert') put(op.item);
  }
  // lịch sử đã xong: công cụ chưa có kết quả (lượt bị ngắt) cũng thôi quay
  return [...items.values()]
    .filter((it) => it.kind !== 'tool' || it.name)
    .map((it) => (it.kind === 'tool' && !it.done ? { ...it, done: true } : it))
    .slice(-TRANSCRIPT_ITEMS);
}
