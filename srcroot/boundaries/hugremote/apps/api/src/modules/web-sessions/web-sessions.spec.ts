import { checkWebUrl } from './web-sessions';

describe('URL phiên trình duyệt (AC-59, G-17)', () => {
  it('nhận localhost / 127.0.0.1 / file trong dự án', () => {
    expect(checkWebUrl('localhost:3000')).toEqual({ url: 'http://localhost:3000/', name: 'localhost:3000' });
    expect(checkWebUrl('http://127.0.0.1:5173/admin').name).toBe('127.0.0.1:5173/admin');
    expect(checkWebUrl('file://~/projects/demo-api/README.md')).toEqual({ url: 'file://~/projects/demo-api/README.md', name: 'README.md' });
  });
  it('chặn domain ngoài, scheme lạ, file đi lùi', () => {
    for (const u of [
      'http://example.com',
      'https://localhost.evil.com',
      'javascript:alert(1)',
      'ftp://localhost/x',
      'file://../etc/passwd',
      'file://a/../../b',
    ])
      expect(() => checkWebUrl(u)).toThrow();
  });
});
