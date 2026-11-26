import { JsonlDecoder, Normalizer, parseRateLimit, parseRateLimits, permissionResponse } from './protocol';
import { parseCliTranscript } from './cli-sessions';
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

  it('agent con (parent_tool_use_id) giữ parentId và không trộn delta vào stream chính (AC-20)', () => {
    const n = new Normalizer('t1');
    n.feed(tool('sub1', 'Agent', { subagent_type: 'Explore', description: 'Đọc cấu trúc' }));
    // agent chính mở block text
    n.feed({ type: 'stream_event', event: { type: 'message_start' } });
    n.feed({ type: 'stream_event', event: { type: 'content_block_start', index: 0, content_block: { type: 'text' } } });
    // agent con mở block text song song
    n.feed({ type: 'stream_event', parent_tool_use_id: 'sub1', event: { type: 'message_start' } });
    n.feed({
      type: 'stream_event',
      parent_tool_use_id: 'sub1',
      event: { type: 'content_block_start', index: 0, content_block: { type: 'text' } },
    });
    const [dMain] = n.feed({
      type: 'stream_event',
      event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Chính' } },
    });
    const [dSub] = n.feed({
      type: 'stream_event',
      parent_tool_use_id: 'sub1',
      event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Phụ' } },
    });
    expect(dMain).toMatchObject({ op: 'delta', text: 'Chính' });
    expect((dMain as { parentId?: string }).parentId).toBeUndefined();
    expect(dSub).toMatchObject({ op: 'delta', text: 'Phụ', parentId: 'sub1' });
    expect((dSub as { itemId: string }).itemId).not.toBe((dMain as { itemId: string }).itemId);

    const subOps = n.feed({
      type: 'assistant',
      parent_tool_use_id: 'sub1',
      message: { content: [{ type: 'tool_use', id: 'st1', name: 'Read', input: { file_path: 'README.md' } }] },
    });
    expect(subOps[0]).toMatchObject({ op: 'upsert', item: { kind: 'tool', id: 'st1', parentId: 'sub1' } });
    const [subRes] = n.feed({
      type: 'user',
      parent_tool_use_id: 'sub1',
      message: { content: [{ type: 'tool_result', tool_use_id: 'st1', content: 'ok' }] },
    });
    expect(subRes).toMatchObject({ op: 'upsert', item: { kind: 'tool', id: 'st1', parentId: 'sub1', done: true } });
  });

  it('permissionResponse nhúng answers vào updatedInput cho AskUserQuestion (AC-21)', () => {
    const raw = permissionResponse('q1', true, { questions: [{ question: 'Chọn DB?' }] }, { 'Chọn DB?': 'SQLite' });
    const parsed = JSON.parse(raw) as { response: { response: { behavior: string; updatedInput: Record<string, unknown> } } };
    expect(parsed.response.response.behavior).toBe('allow');
    expect(parsed.response.response.updatedInput).toEqual({
      questions: [{ question: 'Chọn DB?' }],
      answers: { 'Chọn DB?': 'SQLite' },
    });
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
  it('đọc % trong unifiedWindows (dạng CLI 2.1.332 thật)', () => {
    const l = parseRateLimits({
      type: 'rate_limit_event',
      rate_limit_info: {
        status: 'allowed',
        resetsAt: 1795734000,
        rateLimitType: 'seven_day',
        unifiedWindows: {
          seven_day: { utilization: 0.53, resetsAt: 1795734000, status: 'allowed' },
          five_hour: { utilization: 0.12, resetsAt: 1795700000, status: 'allowed' },
        },
      },
    });
    expect(l.find((x) => x.kind === 'weekly' && x.pct === 53)).toBeTruthy();
    expect(l.find((x) => x.kind === 'five_hour')?.pct).toBe(12);
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

describe('parseCliTranscript', () => {
  it('file phiên CLI → user/assistant/tool; bỏ meta, agent con, lệnh nội bộ, tool mất phần gọi', () => {
    const L = (o: object) => JSON.stringify(o);
    const jsonl = [
      '{"type":"user","message":{"content":"bị cắt', // dòng đầu dở dang
      L({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'gone', content: 'x' }] } }),
      L({ type: 'user', message: { content: 'sửa lỗi đăng nhập' } }),
      L({ type: 'user', isMeta: true, message: { content: 'meta' } }),
      L({ type: 'user', message: { content: '<command-name>/model</command-name>' } }),
      L({ type: 'assistant', message: { content: [{ type: 'text', text: 'Để tôi xem.' }] } }),
      L({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'a.ts' } }] } }),
      L({ type: 'assistant', isSidechain: true, message: { content: [{ type: 'text', text: 'agent con' }] } }),
      L({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'nội dung' }] } }),
      L({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'ls' } }] } }),
      L({ type: 'mode', mode: 'x' }),
    ].join('\n');
    const items = parseCliTranscript(jsonl, 'cli');
    expect(items.map((i) => i.kind)).toEqual(['user', 'assistant', 'tool', 'tool']);
    expect(items[0]).toMatchObject({ text: 'sửa lỗi đăng nhập' });
    expect(items[2]).toMatchObject({ id: 't1', name: 'Read', input: { file_path: 'a.ts' }, result: 'nội dung', done: true });
    expect(items[3]).toMatchObject({ id: 't2', done: true }); // lượt bị ngắt: không quay mãi
  });
});
