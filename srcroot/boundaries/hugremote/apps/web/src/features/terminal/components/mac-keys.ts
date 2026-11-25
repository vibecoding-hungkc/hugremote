/**
 * Phím tắt macOS trong terminal (AC-53) — chuẩn macOS như iTerm: ⌥ = một từ, ⌘ = cả dòng.
 * Trả chuỗi byte gửi vào PTY, hoặc null nếu để xterm xử lý như thường.
 * ⌘C/⌘V không ở đây: chúng đi qua sự kiện copy/paste (menu Electron nuốt phím trước trang).
 */
export interface KeyLike {
  key: string;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
}

export function macKeySeq(e: KeyLike): string | null {
  if (e.ctrlKey) return null;
  const { key, metaKey: m, altKey: a, shiftKey: s } = e;
  if (key === 'Enter' && s && !m && !a) return '\x1b\r'; // ⇧↵ xuống dòng trong Claude CLI
  if (s) return null;
  if (m && !a) {
    if (key === 'ArrowLeft') return '\x01'; // đầu dòng
    if (key === 'ArrowRight') return '\x05'; // cuối dòng
    if (key === 'Backspace') return '\x15'; // xoá tới đầu dòng
  }
  if (a && !m) {
    if (key === 'ArrowLeft') return '\x1bb'; // lùi một từ
    if (key === 'ArrowRight') return '\x1bf'; // tiến một từ
    if (key === 'Backspace') return '\x1b\x7f'; // xoá một từ
  }
  return null;
}

export const isMac = () => typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
