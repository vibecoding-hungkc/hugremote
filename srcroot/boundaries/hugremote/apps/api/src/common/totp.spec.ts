import { base32Decode, base32Encode, totp, verifyTotp } from './totp';

// Vector chuẩn RFC 6238 phụ lục B (SHA-1, khoá ASCII "12345678901234567890"), lấy 6 chữ số cuối
const SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP RFC 6238', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('t=%i → %s', (t, code) => {
    expect(totp(SECRET, t * 1000)).toBe(code);
  });

  it('chấp nhận lệch ±1 bước, từ chối lệch 2 bước', () => {
    const t = 1234567890 * 1000;
    expect(verifyTotp(SECRET, totp(SECRET, t - 30_000), t)).toBe(true);
    expect(verifyTotp(SECRET, totp(SECRET, t + 30_000), t)).toBe(true);
    expect(verifyTotp(SECRET, totp(SECRET, t - 60_000), t)).toBe(false);
    expect(verifyTotp(SECRET, 'abcdef', t)).toBe(false);
  });

  it('base32 đi hai chiều', () => {
    const b = Buffer.from('hugremote-2fa');
    expect(base32Decode(base32Encode(b)).equals(b)).toBe(true);
  });
});
