import { decodeBytes, detectXmlEncoding } from '../shared/decodeEncoding';

const utf8 = (s: string) => new TextEncoder().encode(s);

describe('detectXmlEncoding', () => {
  it('reads encoding from XML prolog', () => {
    expect(detectXmlEncoding(utf8('<?xml version="1.0" encoding="UTF-8"?><a/>'))).toBe('utf-8');
    expect(detectXmlEncoding(utf8('<?xml version="1.0" encoding="windows-1251"?>'))).toBe('windows-1251');
    expect(detectXmlEncoding(utf8('<?xml version="1.0" encoding="WINDOWS-1251"?>'))).toBe('windows-1251');
  });

  it('falls back to utf-8 when no prolog', () => {
    expect(detectXmlEncoding(utf8('<a/>'))).toBe('utf-8');
  });
});

describe('decodeBytes', () => {
  it('decodes utf-8', () => {
    expect(decodeBytes(utf8('Hello world'), 'utf-8')).toBe('Hello world');
    expect(decodeBytes(utf8('Привет'), 'utf-8')).toBe('Привет');
  });

  it('decodes windows-1251 cyrillic', () => {
    // 'Привет' в cp1251: 0xCF 0xF0 0xE8 0xE2 0xE5 0xF2
    const cp1251 = new Uint8Array([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]);
    expect(decodeBytes(cp1251, 'windows-1251')).toBe('Привет');
  });

  it('throws on unsupported encoding', () => {
    expect(() => decodeBytes(utf8('x'), 'koi8-r' as never)).toThrow();
  });
});
