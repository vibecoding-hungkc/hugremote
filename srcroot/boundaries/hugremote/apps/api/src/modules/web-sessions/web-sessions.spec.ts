import { checkWebUrl } from './web-sessions';

describe('URL phiên trình duyệt (AC-59, G-17)', () => {
  it('nhận localhost / 127.0.0.1 / file trong dự án', () => {
    expect(checkWebUrl('localhost:3000')).toEqual({ url: 'http://localhost:3000/', name: 'localhost:3000' });
    expect(checkWebUrl('http://127.0.0.1:5173/admin').name).toBe('127.0.0.1:5173/admin');
    expect(checkWebUrl('https://example.com/docs').url).toBe('https://example.com/docs'); // Authority 2026-11-25: web ngoài được
    expect(checkWebUrl('file://~/projects/demo-api/README.md', '~/projects/demo-api')).toEqual({
      url: 'file://~/projects/demo-api/README.md',
      name: 'README.md',
    });
  });
  it('chặn scheme lạ, file đi lùi, cổng 0', () => {
    for (const u of ['javascript:alert(1)', 'ftp://localhost/x', 'file://../etc/passwd', 'file://a/../../b', 'http://localhost:0'])
      expect(() => checkWebUrl(u)).toThrow();
  });
  it('file:// chỉ trong gốc dự án (dogfood breaker 2026-11-25)', () => {
    const root = '~/projects/demo-api';
    for (const u of [
      'file:///etc/passwd',
      'file:///home/dev/.ssh/id_ed25519',
      'file://~/projects/demo-api-2/x',
      'file://~/projects/demo-api/x%2f..%2f..%2fetc',
    ])
      expect(() => checkWebUrl(u, root)).toThrow();
    expect(() => checkWebUrl('file://~/projects/demo-api/a')).toThrow(); // không biết gốc → chặn
  });
});
