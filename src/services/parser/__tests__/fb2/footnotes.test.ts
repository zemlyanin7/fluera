import { DOMParser } from '@xmldom/xmldom';
import { parseFootnotes } from '../../fb2/footnotes';

const XML = `<?xml version="1.0"?>
<FictionBook>
  <body><section><p>main</p></section></body>
  <body name="notes">
    <section id="n1"><title><p>Note 1</p></title><p>First note body.</p></section>
    <section id="n2"><p>Second note.</p></section>
  </body>
</FictionBook>`;

describe('parseFootnotes', () => {
  it('extracts footnotes by section id', () => {
    const doc = new DOMParser().parseFromString(XML, 'text/xml');
    const fn = parseFootnotes(doc);
    expect(Object.keys(fn).sort()).toEqual(['n1', 'n2']);
    expect((fn.n1 ?? []).length).toBeGreaterThanOrEqual(2);
    expect(fn.n2?.[0]?.type).toBe('paragraph');
  });

  it('returns empty when no notes body', () => {
    const doc = new DOMParser().parseFromString(
      '<FictionBook><body><p>x</p></body></FictionBook>',
      'text/xml',
    );
    expect(parseFootnotes(doc)).toEqual({});
  });
});
