const DEFAULT_MAX_LINE_BYTES = 1024 * 1024;
/** Incremental UTF-8/NDJSON decoder with bounded line retention. */
export class NativeFrameDecoder {
    decoder = new TextDecoder('utf-8', { fatal: false });
    maxLineBytes;
    buffer;
    bufferedBytes = 0;
    overflowed = false;
    constructor(options = {}) {
        this.maxLineBytes = options.maxLineBytes ?? DEFAULT_MAX_LINE_BYTES;
        this.buffer = Buffer.allocUnsafe(this.maxLineBytes);
    }
    push(chunk) {
        const text = typeof chunk === 'string' ? chunk : this.decoder.decode(chunk, { stream: true });
        return this.consume(text);
    }
    finish() {
        const records = this.consume(this.decoder.decode());
        if (this.overflowed) {
            this.resetLine();
            records.push(this.diagnostic('line_too_large'));
            return records;
        }
        const trailing = this.currentLine().trim();
        this.resetLine();
        if (!trailing)
            return records;
        records.push(this.parseLine(trailing, true));
        return records;
    }
    consume(text) {
        const records = [];
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
                }
                else {
                    fragmentBytes.copy(this.buffer, this.bufferedBytes);
                    this.bufferedBytes += fragmentBytes.length;
                }
            }
            if (newline === -1)
                break;
            if (this.overflowed)
                records.push(this.diagnostic('line_too_large'));
            else {
                const line = this.currentLine().trim();
                if (line)
                    records.push(this.parseLine(line, false));
            }
            this.resetLine();
            cursor = newline + 1;
        }
        return records;
    }
    currentLine() {
        return this.buffer.subarray(0, this.bufferedBytes).toString('utf8');
    }
    resetLine() {
        this.bufferedBytes = 0;
        this.overflowed = false;
    }
    parseLine(line, trailing) {
        try {
            const parsed = JSON.parse(line);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return this.diagnostic('malformed_json');
            }
            return { kind: 'frame', frame: parsed };
        }
        catch {
            return this.diagnostic(trailing ? 'truncated_json' : 'malformed_json');
        }
    }
    diagnostic(code) {
        return { kind: 'diagnostic', code, preview: `native-frame:${code}` };
    }
}
