import { parseXhtmlBody } from '../../epub/xhtml';

const xhtml = (body: string) =>
  `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body>${body}</body></html>`;

describe('parseXhtmlBody', () => {
  it('parses paragraph', () => {
    const items = parseXhtmlBody(xhtml('<p>Hello world</p>'));
    expect(items).toEqual([{ type: 'paragraph', inlines: [{ type: 'text', text: 'Hello world' }] }]);
  });

  it('parses heading levels', () => {
    const items = parseXhtmlBody(xhtml('<h1 id="ch1">Title</h1><h2>Sub</h2>'));
    expect(items[0]).toEqual({ type: 'heading', level: 1, id: 'ch1', inlines: [{ type: 'text', text: 'Title' }] });
    expect(items[1]).toEqual({ type: 'heading', level: 2, inlines: [{ type: 'text', text: 'Sub' }] });
  });

  it('parses italic and bold', () => {
    const items = parseXhtmlBody(xhtml('<p>A <em>B</em> <strong>C</strong></p>'));
    const first = items[0];
    expect(first?.type).toBe('paragraph');
    if (first?.type === 'paragraph') {
      expect(first.inlines.find((n) => n.type === 'italic')).toBeDefined();
      expect(first.inlines.find((n) => n.type === 'bold')).toBeDefined();
    }
  });

  it('parses image', () => {
    const items = parseXhtmlBody(xhtml('<p><img src="images/cover.jpg" alt="Cover"/></p>'));
    expect(items.some((i) => i.type === 'image')).toBe(true);
  });

  it('parses hr as separator', () => {
    const items = parseXhtmlBody(xhtml('<p>before</p><hr/><p>after</p>'));
    expect(items[1]).toEqual({ type: 'separator' });
  });

  it('parses blockquote recursively', () => {
    const items = parseXhtmlBody(xhtml('<blockquote><p>q1</p><p>q2</p></blockquote>'));
    expect(items[0]?.type).toBe('blockquote');
    if (items[0]?.type === 'blockquote') expect(items[0].items).toHaveLength(2);
  });

  it('parses list', () => {
    const items = parseXhtmlBody(xhtml('<ul><li>a</li><li>b</li></ul>'));
    expect(items[0]?.type).toBe('list');
    if (items[0]?.type === 'list') {
      expect(items[0].ordered).toBe(false);
      expect(items[0].items).toHaveLength(2);
    }
  });

  it('drops script/style/head', () => {
    const items = parseXhtmlBody(xhtml('<script>evil()</script><p>safe</p>'));
    expect(items).toHaveLength(1);
    expect(items[0]?.type).toBe('paragraph');
  });

  it('rejects DOCTYPE with ENTITY', () => {
    const unsafe = `<?xml version="1.0"?>
<!DOCTYPE html [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<html xmlns="http://www.w3.org/1999/xhtml"><body><p>&xxe;</p></body></html>`;
    expect(() => parseXhtmlBody(unsafe)).toThrow(/Unsafe DOCTYPE/);
  });
});
