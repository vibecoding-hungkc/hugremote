import { describe, expect, it } from 'vitest';
import { macKeySeq } from './mac-keys';

const k = (key: string, mods: Partial<{ metaKey: boolean; altKey: boolean; shiftKey: boolean; ctrlKey: boolean }> = {}) =>
  macKeySeq({ key, metaKey: false, altKey: false, shiftKey: false, ctrlKey: false, ...mods });

describe('macKeySeq (AC-53)', () => {
  it('⇧↵ gửi ESC CR', () => expect(k('Enter', { shiftKey: true })).toBe('\x1b\r'));
  it('⌘←/→/⌫ theo dòng', () => {
    expect(k('ArrowLeft', { metaKey: true })).toBe('\x01');
    expect(k('ArrowRight', { metaKey: true })).toBe('\x05');
    expect(k('Backspace', { metaKey: true })).toBe('\x15');
  });
  it('⌥←/→/⌫ theo từ', () => {
    expect(k('ArrowLeft', { altKey: true })).toBe('\x1bb');
    expect(k('ArrowRight', { altKey: true })).toBe('\x1bf');
    expect(k('Backspace', { altKey: true })).toBe('\x1b\x7f');
  });
  it('phím khác để xterm xử lý', () => {
    expect(k('Enter')).toBeNull();
    expect(k('a', { metaKey: true })).toBeNull();
    expect(k('c', { metaKey: true })).toBeNull();
    expect(k('ArrowLeft', { ctrlKey: true, metaKey: true })).toBeNull();
    expect(k('ArrowLeft', { shiftKey: true, altKey: true })).toBeNull();
  });
});
