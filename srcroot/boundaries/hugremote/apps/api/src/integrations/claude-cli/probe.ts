import * as crypto from 'node:crypto';
import type { HostRuntime } from '../host/host-runtime';
import { controlRequest, JsonlDecoder } from './protocol';

export interface CliModel {
  value: string;
  displayName: string;
  description: string;
  efforts: string[];
  /** Sức chứa context window (token) — suy từ `[1m]` trong tên model đã phân giải. */
  contextWindow: number;
}
export interface CliCommand {
  name: string;
  description: string;
  argumentHint: string;
}
export interface CliOptions {
  models: CliModel[];
  commands: CliCommand[];
}

/**
 * Hỏi CLI trên đúng máy + thư mục bằng `initialize` (không gửi prompt → không tốn hạn mức): danh sách model, effort
 * hỗ trợ và slash command (CLI + dự án). Đóng stdin ngay khi có trả lời; quá hạn → kill.
 */
export async function probeCli(rt: HostRuntime, bin: string, cwd: string, timeoutMs = 15_000): Promise<CliOptions> {
  const argv = [bin, '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--permission-prompts', 'host'];
  const proc = await rt.spawnStream(argv, cwd, { CLAUDE_CODE_ENTRYPOINT: 'hugremote' });
  const rid = `init-${crypto.randomUUID().slice(0, 8)}`;
  const dec = new JsonlDecoder();
  return new Promise<CliOptions>((resolve, reject) => {
    let done = false;
    let stderr = '';
    const finish = (err: Error | null, v?: CliOptions) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      proc.stdin.end();
      setTimeout(() => proc.signal('SIGKILL'), 1500).unref();
      if (err) reject(err);
      else resolve(v!);
    };
    const timer = setTimeout(() => finish(new Error('probe timeout')), timeoutMs);
    proc.onStderr((d) => (stderr = (stderr + d.toString('utf8')).slice(-2000)));
    proc.onExit((code) => {
      const e = new Error(code === 127 || /command not found|No such file/i.test(stderr) ? 'ENOENT' : `probe exit ${code}`);
      finish(e);
    });
    proc.onStdout((b) =>
      dec.push(b, (m) => {
        if (m.type !== 'control_response') return;
        const r = m.response as { request_id?: string; subtype?: string; response?: Record<string, unknown>; error?: string };
        if (r?.request_id !== rid) return;
        if (r.subtype !== 'success') return finish(new Error(r.error ?? 'initialize failed'));
        finish(null, parseInit(r.response ?? {}));
      }),
    );
    proc.stdin.write(controlRequest(rid, { subtype: 'initialize' }));
  });
}

const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

export function parseInit(r: Record<string, unknown>): CliOptions {
  const models = ((r.models ?? []) as Record<string, unknown>[]).map((m) => ({
    value: String(m.value),
    displayName: str(m.displayName, String(m.value)),
    description: str(m.description),
    efforts: m.supportsEffort ? ((m.supportedEffortLevels as string[] | undefined) ?? ['low', 'medium', 'high', 'max']) : [],
    contextWindow: /\[1m\]/i.test(str(m.resolvedModel, String(m.value))) ? 1_000_000 : 200_000,
  }));
  const commands = ((r.commands ?? []) as Record<string, unknown>[]).map((c) => ({
    name: String(c.name),
    description: str(c.description),
    argumentHint: str(c.argumentHint),
  }));
  return { models, commands };
}
