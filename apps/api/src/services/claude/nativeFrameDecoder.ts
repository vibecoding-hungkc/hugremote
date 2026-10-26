export type NativeFrameRecord =
  | { kind: 'frame'; frame: Record<string, unknown> }
  | { kind: 'diagnostic'; code: 'malformed_json' | 'truncated_json' | 'line_too_large'; preview: string };

export interface NativeFrameDecoderOptions {
  maxLineBytes?: number;
}

const DEFAULT_MAX_LINE_BYTES = 1024 * 1024;

/** Incremental UTF-8/NDJSON decoder with bounded line retention. */
export class NativeFrameDecoder {
  private readonly decoder = new TextDecoder('utf-8', { fatal: false });
  private readonly maxLineBytes: number;
  private readonly buffer: Buffer;
  private bufferedBytes = 0;
  private overflowed = false;

  constructor(options: NativeFrameDecoderOptions = {}) {
    this.maxLineBytes = options.maxLineBytes ?? DEFAULT_MAX_LINE_BYTES;
    this.buffer = Buffer.allocUnsafe(this.maxLineBytes);
  }

  push(chunk: Uint8Array | string): NativeFrameRecord[] {
    const text = typeof chunk === 'string' ? chunk : this.decoder.decode(chunk, { stream: true });
    return this.consume(text);
  }

  finish(): NativeFrameRecord[] {
    const records = this.consume(this.decoder.decode());
    if (this.overflowed) {
      this.resetLine();
      records.push(this.diagnostic('line_too_large'));
      return records;
    }
    const trailing = this.currentLine().trim();
    this.resetLine();
    if (!trailing) return records;
    records.push(this.parseLine(trailing, true));
    return records;
  }

  private consume(text: string): NativeFrameRecord[] {
    const records: NativeFrameRecord[] = [];
    let cursor = 0;
    while (cursor < text.length) {
      const newline = text.indexOf('\n', cursor);
      const end = newline === -1 ? text.length : newline;
      const fragment = text.slice(cursor, end);

      if (!this.overflowed && fragment) {
        const fragmentBytes = Buffer.from(fragment, 'utf8');
        if (this.bufferedBytes + fragmentBytes.length > this.maxLineBytes) {
          this.bufferedBytes = 0;
          this.overflowed = true;
        } else {
          fragmentBytes.copy(this.buffer, this.bufferedBytes);
          this.bufferedBytes += fragmentBytes.length;
        }
      }

      if (newline === -1) break;
      if (this.overflowed) records.push(this.diagnostic('line_too_large'));
      else {
        const line = this.currentLine().trim();
        if (line) records.push(this.parseLine(line, false));
      }
      this.resetLine();
      cursor = newline + 1;
    }
    return records;
  }

  private currentLine(): string {
    return this.buffer.subarray(0, this.bufferedBytes).toString('utf8');
  }

  private resetLine(): void {
    this.bufferedBytes = 0;
    this.overflowed = false;
  }

  private parseLine(line: string, trailing: boolean): NativeFrameRecord {
    try {
      const parsed = JSON.parse(line);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return this.diagnostic('malformed_json');
      }
      return { kind: 'frame', frame: parsed as Record<string, unknown> };
    } catch {
      return this.diagnostic(trailing ? 'truncated_json' : 'malformed_json');
    }
  }

  private diagnostic(code: 'malformed_json' | 'truncated_json' | 'line_too_large'): NativeFrameRecord {
    return { kind: 'diagnostic', code, preview: `native-frame:${code}` };
  }
}
