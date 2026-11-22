import { JsonlDecoder, Normalizer, parseRateLimit } from './protocol';
import { parseInit } from './probe';

describe('JsonlDecoder', () => {
  it('không cắt ngang ký tự UTF-8 khi chunk vỡ giữa chừng', () => {
    const line = Buffer.from(JSON.stringify({ t: 'Tiếng Việt có dấu' }) + '\n');
    const out: unknown[] = [];
    const d = new JsonlDecoder();
    // cắt ở giữa một ký tự nhiều byte
    const cut = line.indexOf(Buffer.from('ế')) + 1;
    d.push(line.subarray(0, cut), (o) => out.push(o));
    expect(out).toHaveLength(0);
    d.push(line.subarray(cut), (o) => out.push(o));
    expect(out).toEqual([{ t: 'Tiếng Việt có dấu' }]);
  });

  it('dòng hỏng đi vào onBad, không làm dừng luồng', () => {
    const bad: string[] = [];
    const out: unknown[] = [];
    new JsonlDecoder().push(
      Buffer.from('{hỏng\n{"a":1}\n'),
      (o) => out.push(o),
      (l) => bad.push(l),
    );
    expect(bad).toEqual(['{hỏng']);
    expect(out).toEqual([{ a: 1 }]);
  });
});

describe('Normalizer', () => {
  const tool = (id: string, name: string, input: Record<string, unknown>) => ({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', id, name, input }] },
  });
  const result = (id: string, isError = false) => ({
    type: 'user',
    message: { content: [{ type: 'tool_result', tool_use_id: id, content: 'ok', is_error: isError }] },
  });

  it('ghép delta văn bản vào cùng một mục assistant', () => {
    const n = new Normalizer('t1');
    n.feed({ type: 'stream_event', event: { type: 'message_start' } });
    n.feed({ type: 'stream_event', event: { type: 'content_block_start', index: 0, content_block: { type: 'text' } } });
    const a = n.feed({
      type: 'stream_event',
      event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Xin ' } },
    });
    const b = n.feed({
      type: 'stream_event',
      event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'chào' } },
    });
    expect(a[0]).toMatchObject({ op: 'delta', field: 'text', text: 'Xin ' });
    expect(b[0]).toMatchObject({ op: 'delta', itemId: (a[0] as { itemId: string }).itemId, text: 'chào' });
  });

  it('filesChanged chỉ tính công cụ sửa file đã chạy thành công (AC-41)', () => {
    const n = new Normalizer('t1');
    n.feed(tool('w1', 'Write', { file_path: '/p/a.ts' }));
    n.feed(tool('w2', 'Edit', { file_path: '/p/b.ts' }));
    n.feed(tool('r1', 'Read', { file_path: '/p/c.ts' }));
    n.feed(result('w1'));
    n.feed(result('w2', true));
    n.feed(result('r1'));
    const [r] = n.feed({ type: 'result', subtype: 'success', duration_ms: 10, usage: { input_tokens: 1, output_tokens: 2 } });
    expect(r).toMatchObject({ op: 'result', isError: false, item: { filesChanged: ['/p/a.ts'] } });
  });

  it('yêu cầu quyền can_use_tool → mục interaction', () => {
    const [op] = new Normalizer('t1').feed({
      type: 'control_request',
      request_id: 'perm_1',
      request: { subtype: 'can_use_tool', tool_name: 'Bash', input: { command: 'ls' } },
    });
    expect(op).toEqual({
      op: 'permission',
      requestId: 'perm_1',
      item: { kind: 'interaction', id: 'perm_1', tool: 'Bash', input: { command: 'ls' } },
    });
  });

  it('result lỗi mang thông điệp lỗi', () => {
    const [op] = new Normalizer('t1').feed({ type: 'result', subtype: 'error_during_execution', is_error: true, result: 'hỏng' });
    expect(op).toMatchObject({ op: 'result', isError: true, item: { error: 'hỏng' } });
  });
});

describe('parseRateLimit', () => {
  it('đổi utilization 0–1 sang %, resetsAt giây sang ISO (AC-25)', () => {
    const r = parseRateLimit({
      rate_limit_info: { rateLimitType: 'five_hour', utilization: 0.81, resetsAt: 1_800_000_000, status: 'allowed_warning' },
    });
    expect(r).toEqual({ kind: 'five_hour', pct: 81, resetAt: new Date(1_800_000_000_000).toISOString(), status: 'allowed_warning' });
    expect(parseRateLimit({ rate_limit_info: { rateLimitType: 'seven_day_opus' } })).toMatchObject({ kind: 'weekly', pct: null });
    expect(parseRateLimit({})).toBeNull();
  });
});

describe('parseInit', () => {
  it('sức chứa context theo [1m], model không hỗ trợ effort → danh sách rỗng (AC-22)', () => {
    const o = parseInit({
      models: [
        {
          value: 'default',
          resolvedModel: 'claude-opus-5-5[1m]',
          displayName: 'Default',
          supportsEffort: true,
          supportedEffortLevels: ['low', 'max'],
        },
        { value: 'haiku', resolvedModel: 'claude-haiku-4-5', displayName: 'Haiku', supportsEffort: false },
      ],
      commands: [{ name: 'compact', description: 'Nén', argumentHint: '' }],
    });
    expect(o.models.map((m) => [m.value, m.contextWindow, m.efforts])).toEqual([
      ['default', 1_000_000, ['low', 'max']],
      ['haiku', 200_000, []],
    ]);
    expect(o.commands[0].name).toBe('compact');
  });
});
