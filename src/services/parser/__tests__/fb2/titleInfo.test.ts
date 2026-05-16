import { DOMParser } from '@xmldom/xmldom';
import { parseTitleInfo } from '../../fb2/titleInfo';

const XML = `<?xml version="1.0"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <author><first-name>John</first-name><last-name>Doe</last-name></author>
      <book-title>My Book</book-title>
      <lang>en</lang>
      <coverpage><image xmlns:l="http://www.w3.org/1999/xlink" l:href="#cover.jpg"/></coverpage>
    </title-info>
  </description>
</FictionBook>`;

describe('parseTitleInfo', () => {
  it('extracts title, author, lang, cover', () => {
    const doc = new DOMParser().parseFromString(XML, 'text/xml');
    const info = parseTitleInfo(doc);
    expect(info.title).toBe('My Book');
    expect(info.author).toBe('John Doe');
    expect(info.language).toBe('en');
    expect(info.coverId).toBe('cover.jpg');
  });

  it('handles missing fields', () => {
    const doc = new DOMParser().parseFromString(
      '<FictionBook><description><title-info></title-info></description></FictionBook>',
      'text/xml',
    );
    const info = parseTitleInfo(doc);
    expect(info.title).toBe('Untitled');
    expect(info.author).toBeNull();
    expect(info.language).toBeNull();
    expect(info.coverId).toBeNull();
  });

  it('ignores unsupported language', () => {
    const doc = new DOMParser().parseFromString(
      `<FictionBook><description><title-info>
        <book-title>X</book-title>
        <lang>xx</lang>
      </title-info></description></FictionBook>`,
      'text/xml',
    );
    expect(parseTitleInfo(doc).language).toBeNull();
  });
});
