import { parseOpf } from '../../epub/opf';

const OPF = `<?xml version="1.0"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:creator>Jane Doe</dc:creator>
    <dc:language>en</dc:language>
    <meta name="cover" content="cover-img"/>
  </metadata>
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover-img" href="images/cover.jpg" media-type="image/jpeg"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`;

describe('parseOpf', () => {
  it('extracts metadata, manifest, spine', () => {
    const opf = parseOpf(OPF, 'OEBPS/content.opf');
    expect(opf.metadata.title).toBe('Test Book');
    expect(opf.metadata.creator).toBe('Jane Doe');
    expect(opf.metadata.language).toBe('en');
    expect(opf.metadata.coverId).toBe('cover-img');
    expect(opf.manifest.ch1).toBe('chapter1.xhtml');
    expect(opf.manifest['cover-img']).toBe('images/cover.jpg');
    expect(opf.spine).toEqual(['ch1', 'ch2']);
    expect(opf.opfDir).toBe('OEBPS');
  });

  it('reads EPUB 3 cover via properties="cover-image"', () => {
    const xml = OPF.replace(
      '<item id="cover-img" href="images/cover.jpg" media-type="image/jpeg"/>',
      '<item id="cover-img" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>',
    ).replace('<meta name="cover" content="cover-img"/>', '');
    const opf = parseOpf(xml, 'OEBPS/content.opf');
    expect(opf.metadata.coverId).toBe('cover-img');
  });

  it('throws when no spine', () => {
    expect(() => parseOpf(
      '<package xmlns="http://www.idpf.org/2007/opf"><metadata/><manifest/></package>',
      'x.opf',
    )).toThrow(/EPUB_NO_SPINE/);
  });
});
