import { DOMParser } from '@xmldom/xmldom';
import { parseBinaries } from '../../fb2/binary';

const XML = `<?xml version="1.0"?>
<FictionBook>
  <binary id="cover.jpg" content-type="image/jpeg">aGVsbG8=</binary>
  <binary id="img1.png" content-type="image/png">iVBORw0KGgo=</binary>
</FictionBook>`;

describe('parseBinaries', () => {
  it('extracts all binaries', () => {
    const doc = new DOMParser().parseFromString(XML, 'text/xml');
    const bins = parseBinaries(doc);
    expect(bins).toHaveLength(2);
    expect(bins[0]?.id).toBe('cover.jpg');
    expect(bins[0]?.mime).toBe('image/jpeg');
    expect(Array.from(bins[0]?.bytes ?? [])).toEqual([104, 101, 108, 108, 111]);
    expect(bins[1]?.id).toBe('img1.png');
    expect(bins[1]?.bytes?.[0]).toBe(0x89);
  });

  it('sanitizes id', () => {
    const doc = new DOMParser().parseFromString(
      '<FictionBook><binary id="../etc/passwd" content-type="image/jpeg">aGk=</binary></FictionBook>',
      'text/xml',
    );
    const bins = parseBinaries(doc);
    expect(bins[0]?.id).toBe('___etc_passwd');
  });

  it('skips binaries without id', () => {
    const doc = new DOMParser().parseFromString(
      '<FictionBook><binary content-type="image/jpeg">aGk=</binary></FictionBook>',
      'text/xml',
    );
    expect(parseBinaries(doc)).toHaveLength(0);
  });
});
