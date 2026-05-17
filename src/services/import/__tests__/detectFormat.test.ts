import { detectFormatFromBytes } from '../detectFormat';

describe('detectFormatFromBytes', () => {
  it('detects EPUB by ZIP magic', () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new Array(60).fill(0)]);
    expect(detectFormatFromBytes(zip, 'book.epub')).toBe('epub');
  });

  it('detects FB2 by FictionBook tag', () => {
    const xml = new TextEncoder().encode('<?xml version="1.0"?><FictionBook xmlns="...">');
    expect(detectFormatFromBytes(xml, 'book.fb2')).toBe('fb2');
  });

  it('handles UTF-8 BOM', () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const body = new TextEncoder().encode('<?xml version="1.0"?><FictionBook');
    const buf = new Uint8Array(bom.length + body.length);
    buf.set(bom);
    buf.set(body, bom.length);
    expect(detectFormatFromBytes(buf, 'x.fb2')).toBe('fb2');
  });

  it('falls back to extension when magic ambiguous', () => {
    const garbage = new Uint8Array([0x00, 0x01, 0x02]);
    expect(detectFormatFromBytes(garbage, 'book.epub')).toBe('epub');
    expect(detectFormatFromBytes(garbage, 'book.fb2')).toBe('fb2');
  });

  it('throws on unknown format', () => {
    const garbage = new Uint8Array([0x00, 0x01, 0x02]);
    expect(() => detectFormatFromBytes(garbage, 'book.pdf')).toThrow();
  });
});
