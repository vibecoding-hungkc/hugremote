import fs from 'fs';
import path from 'path';
import os from 'os';

export const FILE_SERVER_BASE_URL = 'http://hugtech.buaanvuive.com/file';
const LOGS_DIR = path.join(os.homedir(), 'logs', 'telegram');

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Saves long text or terminal log to disk under /home/hermes-admin/logs/telegram
 * and returns the public HTTP link to the file server.
 */
export function saveLongOutputToFile(prefix: string, content: string, ext = 'log'): { filePath: string; fileUrl: string } {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${prefix}_${timestamp}.${ext}`;
    const filePath = path.join(LOGS_DIR, filename);

    fs.writeFileSync(filePath, content, 'utf8');

    // Calculate relative path from /home/hermes-admin
    const relFromHome = path.relative(os.homedir(), filePath).replace(/\\/g, '/');
    const fileUrl = `${FILE_SERVER_BASE_URL}/${relFromHome}`;

    return { filePath, fileUrl };
  } catch (err) {
    console.error('Failed to save long output to file:', err);
    return { filePath: '', fileUrl: '' };
  }
}

/**
 * Converts standard Markdown to Telegram-safe HTML.
 */
export function markdownToTelegramHtml(markdown: string): string {
  if (!markdown) return '';

  let text = markdown;

  // 1. Extract and protect code blocks
  const codeBlocks: string[] = [];
  text = text.replace(/```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
    const placeholder = `@@@CODE_BLOCK_${codeBlocks.length}@@@`;
    const escapedCode = escapeHtml(code.trimEnd());
    const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    codeBlocks.push(`<pre><code${langAttr}>${escapedCode}</code></pre>`);
    return placeholder;
  });

  // 2. Extract and protect inline code
  const inlineCodes: string[] = [];
  text = text.replace(/`([^`\n]+)`/g, (_match, code) => {
    const placeholder = `@@@INLINE_CODE_${inlineCodes.length}@@@`;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return placeholder;
  });

  // 3. Escape general HTML in the remaining text
  text = escapeHtml(text);

  // 4. Headings: # Heading -> <b>Heading</b>
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');

  // 5. Bold: **bold** or __bold__
  text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  text = text.replace(/__(.*?)__/g, '<b>$1</b>');

  // 6. Italic: *italic* or _italic_ (be careful with snake_case)
  text = text.replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, '<i>$1</i>');
  text = text.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<i>$1</i>');

  // 7. Strikethrough: ~~del~~
  text = text.replace(/~~(.*?)~~/g, '<s>$1</s>');

  // 8. Markdown links: [text](url)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  // 9. Reinsert inline code
  text = text.replace(/@@@INLINE_CODE_(\d+)@@@/g, (_match, idx) => {
    return inlineCodes[parseInt(idx, 10)] || '';
  });

  // 10. Reinsert code blocks
  text = text.replace(/@@@CODE_BLOCK_(\d+)@@@/g, (_match, idx) => {
    return codeBlocks[parseInt(idx, 10)] || '';
  });

  return text.trim();
}

/**
 * Split text into chunks conforming to Telegram's 4096 character limit.
 */
export function splitMessage(text: string, maxLen = 3800): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Try finding split point: double newline, single newline, space
    let splitIdx = remaining.lastIndexOf('\n\n', maxLen);
    if (splitIdx < maxLen * 0.4) {
      splitIdx = remaining.lastIndexOf('\n', maxLen);
    }
    if (splitIdx < maxLen * 0.4) {
      splitIdx = remaining.lastIndexOf(' ', maxLen);
    }
    if (splitIdx <= 0) {
      splitIdx = maxLen;
    }

    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }

  return chunks;
}
