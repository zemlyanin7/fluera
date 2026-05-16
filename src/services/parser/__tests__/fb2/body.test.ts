import { DOMParser, type Document as XmlDocument } from '@xmldom/xmldom';
import { parseChapters } from '../../fb2/body';

function parse(xml: string): XmlDocument {
  return new DOMParser().parseFromString(xml, 'text/xml');
}

describe('parseChapters', () => {
  it('parses single section with paragraph', () => {
    const doc = parse(`<FictionBook><body><section>
      <title><p>Ch 1</p></title>
      <p>Hello world.</p>
    </section></body></FictionBook>`);
    const chapters = parseChapters(doc);
    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.title).toBe('Ch 1');
    expect(chapters[0]?.items.length).toBeGreaterThanOrEqual(2);
    const first = chapters[0]?.items[0];
    expect(first?.type).toBe('heading');
    const para = chapters[0]?.items.find((i) => i.type === 'paragraph');
    expect(para?.type).toBe('paragraph');
  });

  it('parses emphasis as italic', () => {
    const doc = parse(`<FictionBook><body><section>
      <p>This is <emphasis>italic</emphasis> text.</p>
    </section></body></FictionBook>`);
    const items = parseChapters(doc)[0]?.items ?? [];
    const para = items.find((i) => i.type === 'paragraph');
    if (para?.type === 'paragraph') {
      const italic = para.inlines.find((n) => n.type === 'italic');
      expect(italic).toBeDefined();
    } else {
      fail('paragraph not found');
    }
  });

  it('parses strong as bold', () => {
    const doc = parse(`<FictionBook><body><section>
      <p><strong>Bold</strong></p>
    </section></body></FictionBook>`);
    const items = parseChapters(doc)[0]?.items ?? [];
    const para = items.find((i) => i.type === 'paragraph');
    if (para?.type === 'paragraph') {
      expect(para.inlines[0]).toEqual({ type: 'bold', children: [{ type: 'text', text: 'Bold' }] });
    } else {
      fail('paragraph not found');
    }
  });

  it('parses empty-line as separator', () => {
    const doc = parse(`<FictionBook><body><section>
      <p>before</p><empty-line/><p>after</p>
    </section></body></FictionBook>`);
    const items = parseChapters(doc)[0]?.items ?? [];
    expect(items.some((i) => i.type === 'separator')).toBe(true);
  });

  it('parses nested sections as heading levels', () => {
    const doc = parse(`<FictionBook><body>
      <section><title><p>Top</p></title>
        <section><title><p>Nested</p></title><p>x</p></section>
      </section>
    </body></FictionBook>`);
    const chapters = parseChapters(doc);
    expect(chapters).toHaveLength(1);
    const headings = chapters[0]?.items.filter((i) => i.type === 'heading') ?? [];
    expect(headings).toHaveLength(2);
    if (headings[0]?.type === 'heading' && headings[1]?.type === 'heading') {
      expect(headings[0].level).toBe(1);
      expect(headings[1].level).toBe(2);
    }
  });

  it('throws FB2_NO_BODY without body', () => {
    const doc = parse('<FictionBook><description/></FictionBook>');
    expect(() => parseChapters(doc)).toThrow(/FB2_NO_BODY/);
  });

  it('parses footnote-ref link with type=note', () => {
    const doc = parse(`<FictionBook><body><section>
      <p>See <a xmlns:l="http://www.w3.org/1999/xlink" l:href="#n1" type="note">1</a>.</p>
    </section></body></FictionBook>`);
    const items = parseChapters(doc)[0]?.items ?? [];
    const para = items.find((i) => i.type === 'paragraph');
    if (para?.type === 'paragraph') {
      const fn = para.inlines.find((n) => n.type === 'footnote-ref');
      expect(fn).toEqual({ type: 'footnote-ref', id: 'n1', label: '1' });
    } else {
      fail('paragraph not found');
    }
  });
});
