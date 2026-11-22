import type { ChatItem } from '@app/shared';
import DOMPurify from 'dompurify';
import { Marked, type TokenizerAndRendererExtension } from 'marked';
import { Fragment, useEffect, useMemo, useRef, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Icon, type IconName } from '../../../components/ui/Icon';
import { StatusBadge } from '../../../components/ui/Status';
import type { QueueItem } from '../api/claude.api';

type Tool = Extract<ChatItem, { kind: 'tool' }>;
type Ask = Extract<ChatItem, { kind: 'interaction' }>;
type Sum = Extract<ChatItem, { kind: 'summary' }>;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** `đường/dẫn.ts:12` trong tin nhắn → liên kết mở file đúng dòng (AC-37). */
const pathLink: TokenizerAndRendererExtension = {
  name: 'plink',
  level: 'inline',
  start: (src) => src.match(/[\w.-]+(?:\/[\w.-]+)*\.[A-Za-z0-9]+:\d+/)?.index,
  tokenizer(src) {
    const m = /^((?:[\w.-]+\/)*[\w.-]+\.[A-Za-z0-9]+):(\d+)/.exec(src);
    return m ? { type: 'plink', raw: m[0], path: m[1], line: Number(m[2]) } : undefined;
  },
  renderer: (t) => `<a href="#" class="linkp mono" data-path="${esc(String(t.path))}" data-line="${Number(t.line)}">${esc(t.raw)}</a>`,
};
const md = new Marked({ gfm: true, breaks: true, extensions: [pathLink] });
const toHtml = (s: string) => DOMPurify.sanitize(md.parse(s, { async: false }), { ADD_ATTR: ['data-path', 'data-line'] });

const FILE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Read']);
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const TOOL_LABEL: Record<string, string> = {
  Edit: 'toolEdit',
  MultiEdit: 'toolEdit',
  NotebookEdit: 'toolEdit',
  Write: 'toolWrite',
  Read: 'toolRead',
  Bash: 'toolBash',
  Grep: 'toolGrep',
  Glob: 'toolGlob',
  WebFetch: 'toolWeb',
  WebSearch: 'toolWeb',
  Task: 'toolTask',
  Agent: 'toolTask',
  TodoWrite: 'toolTodo',
};
const filePath = (input: Record<string, unknown>) => (input.file_path ?? input.notebook_path ?? input.path) as string | undefined;
const toolTarget = (input: Record<string, unknown>) =>
  filePath(input) ?? (typeof input.command === 'string' ? input.command : typeof input.pattern === 'string' ? input.pattern : typeof input.url === 'string' ? input.url : '');

/** Đường dẫn CLI (tuyệt đối trên máy đích) → tương đối với gốc dự án nếu nằm trong dự án. */
export function relToProject(p: string, root: string): string {
  const r = root.replace(/\/+$/, '');
  if (p.startsWith(r + '/')) return p.slice(r.length + 1);
  if (r.startsWith('~/')) {
    const tail = r.slice(1) + '/';
    const i = p.indexOf(tail);
    if (i >= 0) return p.slice(i + tail.length);
  }
  return p;
}

const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n));
function fmtDur(ms: number, lang: string) {
  const s = Math.round(ms / 1000);
  const vi = lang.startsWith('vi');
  if (s < 60) return vi ? `${s} giây` : `${s}s`;
  const m = Math.floor(s / 60);
  return vi ? `${m} phút ${s % 60} giây` : `${m}m ${s % 60}s`;
}

export interface ChatHandlers {
  openFile: (path: string, line?: number) => void;
  openDiff: (path: string) => void;
  answer: (iid: string, decision: 'allow' | 'deny' | 'always') => void;
  unqueue: (qid: string) => void;
  resumeQueue: () => void;
  toggleFocus: () => void;
}

/** C19 tin nhắn · C20 thẻ công cụ · C21 thẻ xin quyền · C33 tóm tắt lượt · C34 tin xếp hàng · C37 chế độ gọn. */
export function ChatView({
  items,
  status,
  pending,
  queue,
  focus,
  rootPath,
  hostName,
  h,
  head,
}: {
  items: ChatItem[];
  status: string;
  pending: string[];
  queue: QueueItem[];
  focus: boolean;
  rootPath: string;
  hostName: string;
  h: ChatHandlers;
  head?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const running = status === 'running' || status === 'awaiting_input';
  const rel = (p: string) => relToProject(p, rootPath);

  // bám đáy khi đang ở đáy; người dùng cuộn lên đọc thì không giật xuống
  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  });

  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('a[data-path]');
    if (!a) return;
    e.preventDefault();
    h.openFile(rel(a.dataset.path!), Number(a.dataset.line) || undefined);
  };

  const toolLabel = (name: string) => (TOOL_LABEL[name] ? t(`claude.${TOOL_LABEL[name]}`) : name);
  const askWhat = (a: Ask) => {
    const fp = filePath(a.input);
    if (EDIT_TOOLS.has(a.tool) && fp) return `${t('claude.askWrite')} ${fp.split('/').pop()}`;
    if (a.tool === 'Bash' && typeof a.input.command === 'string') return `${t('claude.askRun')} ${a.input.command.slice(0, 80)}`;
    return t('claude.askUse', { tool: a.tool });
  };

  const renderTool = (m: Tool) => {
    const fp = filePath(m.input);
    const st = m.isError ? 'err' : m.done ? 'done' : running ? 'running' : 'stopped';
    const icon: IconName = FILE_TOOLS.has(m.name) ? 'file' : m.name === 'Bash' ? 'term' : 'bolt';
    return (
      <div className="tool" key={m.id}>
        <div className="th">
          <Icon name={icon} />
          <b className="sm">{toolLabel(m.name)}</b>
          {fp ? (
            <button className="linkp mono xs grow ell" title={t('claude.openAt', { line: 1 })} onClick={() => h.openFile(rel(fp))}>
              {rel(fp)}
            </button>
          ) : (
            <span className="mono xs muted grow ell">{toolTarget(m.input)}</span>
          )}
          {st === 'err' ? (
            <span className="badge">
              <span className="dot err" />
              {t('claude.toolErr')}
            </span>
          ) : (
            <StatusBadge status={st} />
          )}
        </div>
        {m.result && m.name !== 'Read' && <div className="tb">{m.result.length > 1200 ? `${m.result.slice(0, 1200)}…` : m.result}</div>}
      </div>
    );
  };

  const renderAsk = (m: Ask) => {
    const open = !m.decision && pending.includes(m.id);
    if (!open) {
      const d = m.decision ?? 'cancelled';
      const key = d === 'allowed' ? 'decidedAllowed' : d === 'denied' ? 'decidedDenied' : d === 'always' ? 'decidedAlways' : 'decidedCancelled';
      return (
        <div className="note" key={m.id}>
          <Icon name={d === 'denied' || d === 'cancelled' ? 'x' : 'check'} />
          {t(`claude.${key}`, { what: askWhat(m) })}
          {m.at && ` · ${new Date(m.at).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}`}
        </div>
      );
    }
    const fp = filePath(m.input);
    return (
      <div className="ask" role="group" aria-label={t('claude.askGroup')} key={m.id}>
        <div className="h">
          <Icon name="shield" />
          {t('claude.askTitle', { what: askWhat(m) })}
        </div>
        {fp ? <div className="mono sm">{rel(fp)}</div> : typeof m.input.command === 'string' ? <div className="tb mono sm">{m.input.command}</div> : null}
        <div className="btns">
          <Button variant="primary" icon="check" write title={`${t('claude.allow')} (⌥Y)`} onClick={() => h.answer(m.id, 'allow')}>
            {t('claude.allow')}
          </Button>
          <Button icon="x" write title={`${t('claude.deny')} (⌥N)`} onClick={() => h.answer(m.id, 'deny')}>
            {t('claude.deny')}
          </Button>
          {EDIT_TOOLS.has(m.tool) && (
            <Button write onClick={() => h.answer(m.id, 'always')}>
              {t('claude.allowAlways')}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderSummary = (m: Sum) => (
    <div className="summary" key={m.id}>
      <div className="stats">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          <Icon name={m.stopped ? 'stop' : m.error ? 'warn' : 'check'} />
          {m.stopped ? t('claude.sumStopped') : m.error ? t('claude.sumError') : t('claude.sumDone')}
        </span>
        <span>{fmtDur(m.durationMs, i18n.language)}</span>
        <span>{t('claude.sumTokens', { in: fmtK(m.usage.input + m.usage.cacheRead), out: fmtK(m.usage.output) })}</span>
        {m.costUsd !== undefined && <span>${m.costUsd.toFixed(2)}</span>}
        <span>{t('claude.sumFiles', { count: m.filesChanged.length })}</span>
      </div>
      {m.error && !m.stopped && <div className="xs muted">{m.error}</div>}
      {m.filesChanged.length > 0 && (
        <div className="files">
          {m.filesChanged.map((f) => (
            <button key={f} className="chip" title={t('claude.sumDiff', { file: rel(f) })} onClick={() => h.openDiff(rel(f))}>
              <Icon name="git" />
              {f.split('/').pop()}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderItem = (m: ChatItem, opts: { thinking: boolean }): ReactNode => {
    switch (m.kind) {
      case 'user':
        return (
          <div className="msg user" key={m.id}>
            {m.attachments?.length ? (
              <div className="btns">
                {m.attachments.map((a) => (
                  <span className="attach" key={a}>
                    <Icon name="file" />
                    {a.split('/').filter(Boolean).pop()}
                  </span>
                ))}
              </div>
            ) : null}
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
          </div>
        );
      case 'assistant':
        if (!m.text && !(opts.thinking && m.thinking)) return null;
        return (
          <div className="msg" key={m.id}>
            <div className="who">
              <Icon name="claude" />
              {t('claude.who')}
            </div>
            {opts.thinking && m.thinking && (
              <details className="think">
                <summary>{t('claude.thinking')}</summary>
                {m.thinking}
              </details>
            )}
            {m.text && <div className="md" dangerouslySetInnerHTML={{ __html: toHtml(m.text) }} />}
          </div>
        );
      case 'tool':
        return renderTool(m);
      case 'interaction':
        return renderAsk(m);
      case 'summary':
        return renderSummary(m);
      case 'note':
        return (
          <div className="note" key={m.id}>
            <Icon name={m.text === 'CLI_RESUMED' ? 'claude' : 'stop'} />
            {m.text === 'CLAUDE_NOT_INSTALLED' ? t('claude.notInstalled', { host: hostName }) : m.text === 'CLI_RESUMED' ? t('claude.cliResumed') : m.text}
          </div>
        );
    }
  };

  // Chế độ gọn (C37): gom thẻ công cụ + lời dẫn giữa các bước thành một dòng "N bước · …"; bấm → tắt chế độ gọn.
  const body = useMemo(() => {
    if (!focus) return items.map((m) => renderItem(m, { thinking: true }));
    const out: ReactNode[] = [];
    let steps: Tool[] = [];
    let held: ChatItem[] = [];
    const flush = (k: string) => {
      if (steps.length) {
        const e = steps.filter((s) => EDIT_TOOLS.has(s.name)).length;
        const b = steps.filter((s) => s.name === 'Bash').length;
        const err = steps.filter((s) => s.isError).length;
        out.push(
          <button key={`steps-${k}`} className="note linkp" style={{ color: 'var(--color-text-muted)' }} title={t('claude.stepsTip')} onClick={h.toggleFocus}>
            <Icon name="more" />
            {[t('claude.steps', { count: steps.length }), e && t('claude.stepsEdit', { n: e }), b && t('claude.stepsRun', { n: b }), err && t('claude.stepsErr', { n: err })]
              .filter(Boolean)
              .join(' · ')}
          </button>,
        );
      }
      steps = [];
    };
    items.forEach((m, i) => {
      if (m.kind === 'tool') {
        held = []; // lời dẫn trước công cụ là bước trung gian → ẩn
        steps.push(m);
        return;
      }
      if (m.kind === 'assistant') {
        held.push(m);
        return;
      }
      for (const x of held) out.push(renderItem(x, { thinking: false }));
      held = [];
      flush(String(i));
      out.push(renderItem(m, { thinking: false }));
    });
    // lời cuối của lượt luôn hiện; bước còn dở khi đang chạy gộp vào dòng "đang làm"
    if (!running) flush('end');
    for (const x of held) out.push(renderItem(x, { thinking: false }));
    return out;
  }, [items, focus, pending, running, i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastTool = [...items].reverse().find((m): m is Tool => m.kind === 'tool' && !m.done);
  // lượt lỗi hoặc bị dừng → server không tự gửi tin kế (AC-40), người dùng bấm Gửi tiếp
  const stalled = !running && (status === 'error' || status === 'cancelled') && queue.length > 0;

  return (
    <div
      className="chat"
      tabIndex={0}
      ref={ref}
      onClick={onClick}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}
    >
      <div className="col">
        {head}
        {body.map((n, i) => (
          <Fragment key={i}>{n}</Fragment>
        ))}
        {running && (
          <div className="note">
            <Icon name="claude" className="claude-ic" />
            <span className="grow">
              {t('claude.working')}
              {focus && lastTool && (
                <>
                  {' · '}
                  {toolLabel(lastTool.name)} <span className="mono xs">{toolTarget(lastTool.input).slice(0, 80)}</span>
                </>
              )}{' '}
              <span className="caret" />
            </span>
          </div>
        )}
        {stalled && (
          <div className="note">
            <Icon name="warn" />
            <span className="grow">{t('claude.queueStalled')}</span>
            <Button size="sm" write onClick={h.resumeQueue}>
              {t('claude.queueResume')}
            </Button>
          </div>
        )}
        {queue.map((q) => (
          <div className="msg user queued" key={q.id}>
            <div style={{ whiteSpace: 'pre-wrap' }}>{q.text}</div>
            <div className="xs muted">
              {t('claude.queued')} ·{' '}
              <button className="linkp xs" onClick={() => h.unqueue(q.id)}>
                {t('claude.unqueue')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
