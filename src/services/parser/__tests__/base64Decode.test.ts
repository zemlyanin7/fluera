import { base64Decode } from '../shared/base64Decode';

describe('base64Decode', () => {
  it('decodes simple string', () => {
    // "hello" в base64 = "aGVsbG8="
    const out = base64Decode('aGVsbG8=');
    expect(Array.from(out)).toEqual([104, 101, 108, 108, 111]);
  });

  it('strips whitespace/newlines (FB2 typically wraps base64)', () => {
    const out = base64Decode('aGVs\n  bG8=');
    expect(Array.from(out)).toEqual([104, 101, 108, 108, 111]);
  });

  it('decodes a tiny PNG header', () => {
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const out = base64Decode('iVBORw0KGgo=');
    expect(out[0]).toBe(0x89);
    expect(out[1]).toBe(0x50);
  });

  it('throws on invalid input', () => {
    expect(() => base64Decode('!!!not base64!!!')).toThrow();
  });
});
