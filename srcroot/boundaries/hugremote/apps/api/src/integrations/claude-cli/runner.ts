import * as crypto from 'node:crypto';
import type { HostRuntime, StreamProc } from '../host/host-runtime';
import { controlRequest, JsonlDecoder, Normalizer, permissionResponse, userLine, type NormOp } from './protocol';

export interface TurnOptions {
  bin: string;
  cwd: string;
  cliSessionId: string;
  /** Phiên đã có lượt trước → `--resume`, lần đầu → `--session-id`. */
  resume: boolean;
  model?: string | null;
  effort?: string | null;
  permissionMode: string;
  name?: string;
}

export interface TurnHandlers {
  onOp(op: NormOp): void;
  /** Tiến trình kết thúc; `notInstalled` khi không tìm thấy `claude` trên máy đích. */
  onExit(info: { code: number | null; stderr: string; notInstalled: boolean; gotResult: boolean }): void;
}

/**
 * Một lượt Claude = một tiến trình CLI (stream-json hai chiều). stdin để mở tới khi nhận `result` để còn trả
 * lời yêu cầu quyền (`--permission-prompts host`) và gửi interrupt; nhận `result` thì đóng stdin, CLI tự thoát.
 * Tác vụ chạy độc lập với trình duyệt (G-14) — runner không biết gì về SSE/HTTP.
 */
export const LINGER_MS = 10_000;

export class ClaudeTurn {
  private proc?: StreamProc;
  private readonly norm: Normalizer;
  private readonly decoder = new JsonlDecoder();
  private stderr = '';
  private gotResult = false;
  private ended = false;
  private readonly pending = new Map<string, Record<string, unknown>>();
  /** `result` giữ lại tới khi CLI trả `get_context_usage` (≤3s) để tóm tắt lượt mang luôn Context a/b. */
  private held?: Extract<NormOp, { op: 'result' }>;
  /**
   * CLI đã trả `result` + đóng stdin mà chưa thoát (chờ mạng khi thoát, hook, tác vụ nền…) → quá LINGER_MS không in gì
   * thì kết thúc hộ. Trước đây phiên kẹt "Claude đang làm" tới khi tiến trình tự thoát (Authority 2026-11-26).
   */
  private linger?: NodeJS.Timeout;
  private lingerKilled = false;
  private stdinEnded = false;
  private ctxReq?: string;
  private ctxTimer?: NodeJS.Timeout;

  constructor(
    readonly turnId: string,
    private readonly h: TurnHandlers,
  ) {
    this.norm = new Normalizer(turnId);
  }

  static argv(o: TurnOptions): string[] {
    const a = [
      o.bin,
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--permission-prompts',
      'host',
    ];
    a.push(o.resume ? '--resume' : '--session-id', o.cliSessionId);
    a.push('--permission-mode', o.permissionMode);
    if (o.permissionMode === 'bypassPermissions') a.push('--allow-dangerously-skip-permissions');
    if (o.model) a.push('--model', o.model);
    if (o.effort) a.push('--effort', o.effort);
    // mọi lượt đều gửi tên → đổi tên ở HugRemote đồng bộ sang CLI từ lượt kế tiếp (AC-23)
    if (o.name) a.push('--name', o.name);
    return a;
  }

  async start(rt: HostRuntime, o: TurnOptions, prompt: string) {
    try {
      this.proc = await rt.spawnStream(ClaudeTurn.argv(o), o.cwd, { CLAUDE_CODE_ENTRYPOINT: 'hugremote' });
    } catch (e) {
      const notInstalled = (e as NodeJS.ErrnoException).code === 'ENOENT';
      this.ended = true;
      this.h.onExit({ code: null, stderr: (e as Error).message, notInstalled, gotResult: false });
      return;
    }
    this.proc.onStdout((d) => {
      this.linger?.refresh(); // còn in ra (CLI làm tiếp sau result) → chưa phải treo
      this.decoder.push(d, (obj) => {
        for (const op of this.norm.feed(obj)) {
          if (op.op === 'permission') this.pending.set(op.requestId, op.item.input);
          if (op.op === 'result') {
            this.gotResult = true;
            this.holdResult(op);
            continue;
          }
          if (op.op === 'control_response' && op.requestId === this.ctxReq) {
            this.releaseResult(op.response);
            continue;
          }
          this.h.onOp(op);
        }
      });
    });
    this.proc.onStderr((d) => (this.stderr = (this.stderr + d.toString('utf8')).slice(-4000)));
    this.proc.onExit((code) => {
      this.releaseResult(null);
      this.ended = true;
      clearTimeout(this.linger);
      if (this.lingerKilled) code = 0; // đã xong lượt, chỉ là thoát chậm — không phải lỗi
      const notInstalled = code === 127 || /command not found|not found: claude|No such file/i.test(this.stderr);
      this.h.onExit({ code, stderr: this.stderr, notInstalled: notInstalled && !this.gotResult, gotResult: this.gotResult });
    });
    this.proc.stdin.write(userLine(prompt, o.cliSessionId));
  }

  private holdResult(op: Extract<NormOp, { op: 'result' }>) {
    this.held = op;
    if (this.stdinEnded) return this.releaseResult(null); // result lần hai (CLI làm tiếp sau khi đã đóng stdin): không hỏi context được
    this.ctxReq = `ctx-${this.turnId}`;
    this.proc?.stdin.write(controlRequest(this.ctxReq, { subtype: 'get_context_usage' }));
    this.ctxTimer = setTimeout(() => this.releaseResult(null), 3000);
    this.ctxTimer.unref();
  }

  private releaseResult(resp: Record<string, unknown> | null) {
    const r = this.held;
    if (!r) return;
    this.held = undefined;
    clearTimeout(this.ctxTimer);
    if (resp && typeof resp.totalTokens === 'number' && typeof resp.maxTokens === 'number')
      r.item.context = { used: resp.totalTokens, max: resp.maxTokens };
    this.h.onOp(r);
    if (this.ended) return;
    this.stdinEnded = true;
    this.proc?.stdin.end();
    this.linger ??= setTimeout(() => {
      if (!this.running) return;
      this.lingerKilled = true;
      this.proc!.signal('SIGTERM');
    }, LINGER_MS);
    this.linger.unref();
  }

  /** Đã nhận `result` — lượt xong về nội dung, tiến trình có thể còn đang thoát. */
  get finished() {
    return this.gotResult && !this.held;
  }

  get running() {
    return !!this.proc && !this.ended;
  }

  /** Trả lời yêu cầu quyền hoặc AskUserQuestion. false nếu yêu cầu không còn chờ (đã trả lời ở thiết bị khác). */
  answer(requestId: string, allow: boolean, answers?: Record<string, string>): boolean {
    const input = this.pending.get(requestId);
    if (!this.proc || this.ended || this.stdinEnded || input === undefined) return false;
    this.pending.delete(requestId);
    this.proc.stdin.write(permissionResponse(requestId, allow, input, answers));
    return true;
  }

  isPending(requestId: string) {
    return this.pending.has(requestId);
  }

  setPermissionMode(mode: string) {
    if (this.running && !this.stdinEnded)
      this.proc!.stdin.write(controlRequest(crypto.randomUUID(), { subtype: 'set_permission_mode', mode }));
  }

  /** Dừng lượt: interrupt qua giao thức, quá 3s chưa thoát thì SIGINT, 8s thì SIGKILL. */
  interrupt() {
    if (!this.running) return;
    // stdin đã đóng sau result → không gửi được interrupt qua giao thức (ghi vào stream đã end), kết thúc thẳng
    if (this.finished) return void ((this.lingerKilled = true), this.proc!.signal('SIGTERM'));
    this.proc!.stdin.write(controlRequest(crypto.randomUUID(), { subtype: 'interrupt' }));
    setTimeout(() => this.running && this.proc!.signal('SIGINT'), 3000).unref();
    setTimeout(() => this.running && this.proc!.signal('SIGKILL'), 8000).unref();
  }

  kill() {
    if (this.running) this.proc!.signal('SIGKILL');
  }
}
