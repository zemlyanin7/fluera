import { zipSync } from 'fflate';
import { EpubParser } from '../EpubParser';
import { buildEpub, simpleXhtml } from './fixtures/buildEpub';

describe('EpubParser', () => {
  it('parses single-chapter EPUB', async () => {
    const bytes = buildEpub({
      metadata: { title: 'My Book', creator: 'Jane', language: 'en' },
      manifest: [{ id: 'ch1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' }],
      spine: ['ch1'],
      files: { 'chapter1.xhtml': simpleXhtml('<h1>Title</h1><p>Hello</p>') },
    });
    const parsed = await new EpubParser().parse(bytes);
    expect(parsed.title).toBe('My Book');
    expect(parsed.author).toBe('Jane');
    expect(parsed.language).toBe('en');
    expect(parsed.chapters).toHaveLength(1);
    expect(parsed.chapters[0]?.title).toBe('Title');
  });

  it('rejects encrypted EPUB', async () => {
    const bytes = buildEpub({
      encrypted: true,
      metadata: { title: 'DRM' },
      manifest: [{ id: 'ch1', href: 'c.xhtml', mediaType: 'application/xhtml+xml' }],
      spine: ['ch1'],
      files: { 'c.xhtml': simpleXhtml('<p>x</p>') },
    });
    await expect(new EpubParser().parse(bytes)).rejects.toThrow(/EPUB_ENCRYPTED/);
  });

  it('rejects file > MAX_EPUB_FILE_SIZE', async () => {
    const huge = new Uint8Array(101 * 1024 * 1024);
    huge[0] = 0x50;
    huge[1] = 0x4b;
    huge[2] = 0x03;
    huge[3] = 0x04;
    await expect(new EpubParser().parse(huge)).rejects.toThrow(/FILE_TOO_LARGE/);
  });

  it('parses multi-chapter EPUB', async () => {
    const bytes = buildEpub({
      metadata: { title: 'Multi', language: 'en' },
      manifest: [
        { id: 'ch1', href: 'c1.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'ch2', href: 'c2.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'ch3', href: 'c3.xhtml', mediaType: 'application/xhtml+xml' },
      ],
      spine: ['ch1', 'ch2', 'ch3'],
      files: {
        'c1.xhtml': simpleXhtml('<h1>One</h1><p>p1</p>'),
        'c2.xhtml': simpleXhtml('<h1>Two</h1><p>p2</p>'),
        'c3.xhtml': simpleXhtml('<h1>Three</h1><p>p3</p>'),
      },
    });
    const parsed = await new EpubParser().parse(bytes);
    expect(parsed.chapters).toHaveLength(3);
    expect(parsed.chapters.map((c) => c.title)).toEqual(['One', 'Two', 'Three']);
  });

  it('extracts cover image', async () => {
    const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    const bytes = buildEpub({
      metadata: { title: 'C', coverId: 'cov', language: 'en' },
      manifest: [
        { id: 'ch1', href: 'c.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'cov', href: 'images/cover.jpg', mediaType: 'image/jpeg' },
      ],
      spine: ['ch1'],
      files: { 'c.xhtml': simpleXhtml('<p>x</p>'), 'images/cover.jpg': fakeJpeg },
    });
    const parsed = await new EpubParser().parse(bytes);
    expect(parsed.coverId).toBe('cover.jpg');
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]?.mime).toBe('image/jpeg');
  });

  it('flattens deeply nested inline (pathological-nesting)', async () => {
    let body = '<p>start';
    for (let i = 0; i < 25; i++) body += '<em>';
    body += 'deep';
    for (let i = 0; i < 25; i++) body += '</em>';
    body += '</p>';
    const bytes = buildEpub({
      metadata: { title: 'Deep' },
      manifest: [{ id: 'c', href: 'c.xhtml', mediaType: 'application/xhtml+xml' }],
      spine: ['c'],
      files: { 'c.xhtml': simpleXhtml(body) },
    });
    const parsed = await new EpubParser().parse(bytes);
    const text = JSON.stringify(parsed.chapters[0]?.items);
    expect(text).toContain('deep');
  });

  it('rejects EPUB with bad mimetype', async () => {
    // Manually build zip without proper mimetype
    const enc = new TextEncoder();
    const archive: Record<string, Uint8Array> = {
      'mimetype': enc.encode('text/plain'),
      'META-INF/container.xml': enc.encode('<container/>'),
    };
    const bytes = zipSync(archive);
    await expect(new EpubParser().parse(bytes)).rejects.toThrow(/EPUB_BAD_MIMETYPE/);
  });
});
