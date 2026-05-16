import * as fs from 'node:fs';
import * as path from 'node:path';
import { Fb2Parser } from '../Fb2Parser';

const minimalPath = path.join(__dirname, 'fixtures/fb2/minimal.fb2');

function makeCp1251Fixture(): Uint8Array {
  // FB2 prolog в cp1251, cyrillic в title/author/text
  const parts: Uint8Array[] = [
    new TextEncoder().encode(
      '<?xml version="1.0" encoding="windows-1251"?>\n' +
        '<FictionBook><description><title-info><author><first-name>',
    ),
    new Uint8Array([0xc8, 0xe2, 0xe0, 0xed]), // "Иван"
    new TextEncoder().encode('</first-name><last-name>'),
    new Uint8Array([0xd2, 0xe5, 0xf1, 0xf2]), // "Тест"
    new TextEncoder().encode('</last-name></author><book-title>'),
    new Uint8Array([0xca, 0xed, 0xe8, 0xe3, 0xe0]), // "Книга"
    new TextEncoder().encode('</book-title><lang>ru</lang></title-info></description><body><section><p>'),
    new Uint8Array([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]), // "Привет"
    new TextEncoder().encode('</p></section></body></FictionBook>'),
  ];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

describe('Fb2Parser', () => {
  it('parses minimal.fb2', async () => {
    const bytes = new Uint8Array(fs.readFileSync(minimalPath));
    const parser = new Fb2Parser();
    const parsed = await parser.parse(bytes);
    expect(parsed.title).toBe('Minimal FB2');
    expect(parsed.author).toBe('Test Author');
    expect(parsed.language).toBe('en');
    expect(parsed.chapters).toHaveLength(1);
    expect(parsed.chapters[0]?.title).toBe('Chapter 1');
    expect(parsed.images).toHaveLength(0);
    expect(parsed.totalChars).toBeGreaterThan(0);
  });

  it('rejects file > MAX_FB2_FILE_SIZE', async () => {
    const huge = new Uint8Array(51 * 1024 * 1024);
    const parser = new Fb2Parser();
    await expect(parser.parse(huge)).rejects.toThrow(/FILE_TOO_LARGE/);
  });

  it('rejects file with DOCTYPE (XXE)', async () => {
    const xml = `<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<FictionBook><body><p>&xxe;</p></body></FictionBook>`;
    const bytes = new TextEncoder().encode(xml);
    const parser = new Fb2Parser();
    await expect(parser.parse(bytes)).rejects.toThrow(/XML_UNSAFE/);
  });

  it('parses windows-1251 cyrillic', async () => {
    const bytes = makeCp1251Fixture();
    const parser = new Fb2Parser();
    const parsed = await parser.parse(bytes);
    expect(parsed.title).toBe('Книга');
    expect(parsed.author).toBe('Иван Тест');
    expect(parsed.language).toBe('ru');
  });

  it('extracts cover binary', async () => {
    const bytes = new Uint8Array(
      fs.readFileSync(path.join(__dirname, 'fixtures/fb2/with-binary.fb2')),
    );
    const parsed = await new Fb2Parser().parse(bytes);
    expect(parsed.coverId).toBe('cover.jpg');
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]?.id).toBe('cover.jpg');
    expect(parsed.images[0]?.mime).toBe('image/jpeg');
    expect(parsed.images[0]?.bytes[0]).toBe(0xff); // JPEG SOI
  });
});
