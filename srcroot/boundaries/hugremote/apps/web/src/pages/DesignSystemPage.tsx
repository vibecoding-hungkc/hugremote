import type { ChatItem } from '@app/shared';
import { useState, type ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { DiffBlock } from '../components/ui/DiffBlock';
import { Field } from '../components/ui/Field';
import { Icon, type IconName } from '../components/ui/Icon';
import { ICON_PATHS } from '../components/ui/icon-paths';
import { OtpInput } from '../components/ui/OtpInput';
import { EmptyState, ErrorBox, Skeleton } from '../components/ui/States';
import { StatusBadge, StatusDot, type Status } from '../components/ui/Status';
import { TreeNode } from '../components/ui/TreeNode';
import { ChatView } from '../features/claude/components/ChatView';
import { Composer } from '../features/claude/components/Composer';

/**
 * `#/_ds` — trang mẫu design system trong app (G-16): mỗi component của `components/ui` (và khối chat/ô soạn) ở các
 * trạng thái bắt buộc của `DESIGN-SYSTEM.md §4`, vẽ bằng đúng component thật — để so với `screens/` của gói và
 * cho vai `picky` đo computed style. Không cần đăng nhập, không có dữ liệu thật.
 */
const TOKENS = [
  'bg', 'surface', 'surface-raised', 'divider', 'border', 'text', 'text-muted', 'primary', 'on-primary', 'danger', 'success', 'warning', 'accent-terminal', 'accent-claude',
];
const STATUSES: Status[] = ['running', 'awaiting', 'done', 'stopped', 'exited', 'ok', 'err', 'connecting', 'idle'];
const noop = () => undefined;

function Sec({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="card" id={id} data-ds={id}>
      <h3>
        <span className="mono xs muted">{id}</span> {title}
      </h3>
      <div style={{ display: 'grid', gap: 'var(--space-md)' }}>{children}</div>
    </section>
  );
}
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
      <span className="xs muted">{label}</span>
      <div>{children}</div>
    </div>
  );
}

const CHAT: ChatItem[] = [
  { kind: 'user', id: 'u1', text: 'Thêm API đặt lịch, xem src/app.ts:12', attachments: ['src/app.ts'] },
  { kind: 'assistant', id: 'a1', text: 'Mình xem cấu trúc dự án và chạy test trước.', thinking: 'Người dùng muốn thêm API…' },
  { kind: 'tool', id: 't1', name: 'Bash', input: { command: 'pnpm test bookings' }, result: 'PASS bookings.spec.ts\n  ✓ đặt lịch (12 ms)', done: true },
  { kind: 'tool', id: 't2', name: 'Edit', input: { file_path: '/home/dev/projects/demo-api/src/bookings.service.ts' }, isError: true, result: 'File chưa đọc', done: true },
  { kind: 'tool', id: 'sub1', name: 'Agent', input: { subagent_type: 'Explore', description: 'Quét cấu trúc dự án' }, result: 'Đã tìm thấy 3 module chính', done: true },
  { kind: 'tool', id: 'sub1-r', parentId: 'sub1', name: 'Read', input: { file_path: '/home/dev/projects/demo-api/README.md' }, done: true },
  { kind: 'interaction', id: 'i1', tool: 'Write', input: { file_path: '/home/dev/projects/demo-api/src/bookings.controller.ts' } },
  {
    kind: 'interaction',
    id: 'i3',
    tool: 'AskUserQuestion',
    input: {
      questions: [
        {
          question: 'Ưu tiên phương án nào?',
          header: 'Phương án',
          options: [
            { label: 'Giữ đơn giản', description: 'Ít thay đổi, ra nhanh' },
            { label: 'Tách mô-đun', description: 'Gọn về sau' },
          ],
        },
      ],
    },
  },
  { kind: 'interaction', id: 'i2', tool: 'Bash', input: { command: 'rm -rf dist' }, decision: 'denied', at: new Date().toISOString() },
  { kind: 'assistant', id: 'a2', text: 'Xong. Kiểm tra: `src/bookings/bookings.controller.ts:3`' },
  { kind: 'summary', id: 's1', durationMs: 134_000, usage: { input: 18_200, output: 900, cacheRead: 4000 }, costUsd: 0.21, filesChanged: ['/home/dev/projects/demo-api/src/bookings.controller.ts'], context: { used: 227_000, max: 1_000_000 } },
  { kind: 'summary', id: 's2', durationMs: 9000, usage: { input: 100, output: 20, cacheRead: 0 }, filesChanged: [], stopped: true },
];

export function DesignSystemPage() {
  const [otp, setOtp] = useState('12');
  const [focus, setFocus] = useState(false);
  const chatH = { openFile: noop, openDiff: noop, answer: noop, unqueue: noop, resumeQueue: noop, toggleFocus: () => setFocus(!focus) };
  return (
    <div className="content" data-screen="_ds" style={{ height: '100%', overflow: 'auto' }}>
      <div className="wrap">
        <h1 style={{ fontSize: 'var(--text-xl)' }}>Design system — HugRemote</h1>
        <p className="muted sm">
          Component thật của <span className="mono">apps/web/src/components/ui</span>, đủ trạng thái bắt buộc (DESIGN-SYSTEM §4). Đổi chủ đề:{' '}
          <button className="linkp" onClick={() => (document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'light' ? '' : 'light')}>
            tối ⇄ sáng
          </button>
        </p>

        <Sec id="T" title="Token màu">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--space-sm)' }}>
            {TOKENS.map((k) => (
              <div key={k} style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                <span style={{ width: 28, height: 28, borderRadius: 'var(--radius)', background: `var(--color-${k})`, border: '1px solid var(--color-divider)' }} />
                <span className="mono xs">--color-{k}</span>
              </div>
            ))}
          </div>
        </Sec>

        <Sec id="C1" title="Nút">
          <div className="btns">
            <Button variant="primary">Chính</Button>
            <Button>Phụ</Button>
            <Button variant="ghost">Mờ</Button>
            <Button variant="danger" icon="trash">
              Nguy hiểm
            </Button>
            <Button size="sm" icon="plus">
              Nhỏ
            </Button>
            <Button iconOnly icon="save" label="Lưu (icon)" />
            <Button iconOnly icon="bell" tone="primary" label="Đang bật" />
          </div>
          <div className="btns">
            <Cell label="đang gửi">
              <Button variant="primary" loading loadingLabel="Đang lưu…">
                Lưu
              </Button>
            </Cell>
            <Cell label="vô hiệu (có lý do)">
              <Button disabled disabledReason="Chưa chọn file nào">
                Commit 0 file
              </Button>
            </Cell>
          </div>
        </Sec>

        <Sec id="C2" title="Ô nhập">
          <div className="grid2">
            <Field label="Mặc định" placeholder="Nhập…" hint="Gợi ý dưới ô" />
            <Field label="Lỗi" defaultValue="abc" error="Mật khẩu cần ít nhất 10 ký tự" />
            <Field label="Mono" mono defaultValue="~/projects/demo-api" />
            <Field label="Vô hiệu" disabled defaultValue="khoá" />
          </div>
          <Cell label="C2b mã 6 số">
            <OtpInput value={otp} onChange={setOtp} />
          </Cell>
        </Sec>

        <Sec id="C14" title="Trạng thái">
          <div className="btns">
            {STATUSES.map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
          <div className="btns">
            {STATUSES.map((s) => (
              <StatusDot key={s} status={s} title={s} />
            ))}
          </div>
        </Sec>

        <Sec id="C5–C7" title="Rỗng · Lỗi · Đang tải (§5)">
          <EmptyState icon="folder" message="Chưa có dự án nào." action={<Button variant="primary">Dự án mới</Button>} />
          <ErrorBox title="Không tới được máy" body="Kiểm địa chỉ, mạng hoặc máy trung gian." onRetry={noop} />
          <Skeleton rows={3} />
        </Sec>

        <Sec id="C10" title="Nút cây">
          <div role="tree" style={{ maxWidth: 320 }}>
            <TreeNode level={0} icon="server" name="demo-sshd" expanded onToggle={noop} status="ok" onClick={noop} onMore={noop} moreLabel="Thao tác" />
            <TreeNode level={1} icon="folder" name="demo-api" expanded onToggle={noop} count={2} onClick={noop} />
            <TreeNode level={2} icon="claude" iconClass="claude-ic" name="Thêm API đặt lịch" meta="duyệt" metaWarn status="awaiting" onClick={noop} selected />
            <TreeNode level={2} icon="term" iconClass="term-ic" name="zsh" meta="35p" status="running" onClick={noop} />
            <TreeNode level={0} icon="server" name="staging-vps" error status="err" onClick={noop} />
          </div>
        </Sec>

        <Sec id="C18" title="Diff">
          <DiffBlock diff={'@@ -1,3 +1,4 @@\n # demo-api\n-API cũ\n+API đặt lịch\n+## Chạy'} />
        </Sec>

        <Sec id="C12" title="Biểu tượng">
          <div className="btns">
            {(Object.keys(ICON_PATHS) as IconName[]).map((n) => (
              <span key={n} title={n} style={{ display: 'inline-flex', padding: 'var(--space-xs)' }}>
                <Icon name={n} />
              </span>
            ))}
          </div>
        </Sec>

        <Sec id="C19–C21 C33 C34 C37" title="Hội thoại Claude (tin, công cụ, xin quyền, tóm tắt, hàng chờ, chế độ gọn)">
          <div className="btns">
            <Button size="sm" icon="target" tone={focus ? 'primary' : undefined} onClick={() => setFocus(!focus)}>
              Chế độ gọn: {focus ? 'bật' : 'tắt'}
            </Button>
          </div>
          <div style={{ height: 520, display: 'flex', flexDirection: 'column', border: '1px solid var(--color-divider)', borderRadius: 'var(--radius)' }}>
            <ChatView
              items={CHAT}
              status="awaiting_input"
              pending={['i1', 'i3']}
              queue={[{ id: 'q1', text: 'nhớ cập nhật README', createdAt: new Date().toISOString() }]}
              focus={focus}
              rootPath="~/projects/demo-api"
              hostName="demo-sshd"
              h={chatH}
            />
          </div>
        </Sec>

        <Sec id="C36" title="Ô soạn Claude (đang chạy, Context, hạn mức, model, quyền Bypass)">
          <div style={{ border: '1px solid var(--color-divider)', borderRadius: 'var(--radius)' }}>
            <Composer
              sid="ds-demo"
              userId="ds"
              running
              mode="bypassPermissions"
              model="default"
              effort="high"
              options={{
                models: [{ value: 'default', displayName: 'Opus', description: '1M context', efforts: ['low', 'medium', 'high', 'max'], contextWindow: 1_000_000 }],
                commands: [{ name: 'compact', description: 'Nén hội thoại', argumentHint: '' }],
              }}
              context={{ used: 850_000, max: 1_000_000 }}
              limits={{ fiveHour: { pct: 81, resetAt: new Date().toISOString() }, weekly: { pct: 46, resetAt: new Date().toISOString() } }}
              hostName="demo-sshd"
              focus={focus}
              ask={{ id: 'i1', what: 'Write bookings.controller.ts' }}
              onToggleFocus={() => setFocus(!focus)}
              onMode={noop}
              onBypass={noop}
              onModel={noop}
              onSend={() => Promise.resolve(false)}
              onStop={noop}
              onAnswer={noop}
              onPickAttach={noop}
            />
          </div>
        </Sec>
      </div>
    </div>
  );
}
