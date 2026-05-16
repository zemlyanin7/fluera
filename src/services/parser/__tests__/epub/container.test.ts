import { findOpfPath } from '../../epub/container';

describe('findOpfPath', () => {
  it('reads rootfile full-path', () => {
    const xml = `<?xml version="1.0"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;
    expect(findOpfPath(xml)).toBe('OEBPS/content.opf');
  });

  it('throws when no rootfile', () => {
    expect(() => findOpfPath('<container/>')).toThrow();
  });
});
