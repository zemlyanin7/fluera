import { OpdsParser } from '../../../src/services/parser/OpdsParser'

const SAMPLE_OPDS = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
  <title>Project Gutenberg</title>
  <entry>
    <id>urn:gutenberg:book:1342</id>
    <title>Pride and Prejudice</title>
    <author><name>Jane Austen</name></author>
    <summary>A classic novel of manners.</summary>
    <updated>2024-01-01T00:00:00Z</updated>
    <link rel="http://opds-spec.org/acquisition" type="application/epub+zip" href="/books/1342.epub"/>
    <link rel="http://opds-spec.org/image" type="image/jpeg" href="/covers/1342.jpg"/>
  </entry>
  <link rel="next" type="application/atom+xml" href="/catalog?page=2"/>
</feed>`

describe('OpdsParser', () => {
  it('parses catalog title', () => {
    const catalog = OpdsParser.parse(SAMPLE_OPDS)
    expect(catalog.title).toBe('Project Gutenberg')
  })

  it('parses entries', () => {
    const catalog = OpdsParser.parse(SAMPLE_OPDS)
    expect(catalog.entries).toHaveLength(1)
    expect(catalog.entries[0].title).toBe('Pride and Prejudice')
    expect(catalog.entries[0].author).toBe('Jane Austen')
  })

  it('parses download links', () => {
    const catalog = OpdsParser.parse(SAMPLE_OPDS)
    const entry = catalog.entries[0]
    expect(entry.downloadLinks).toHaveLength(1)
    expect(entry.downloadLinks[0].type).toBe('application/epub+zip')
    expect(entry.downloadLinks[0].href).toBe('/books/1342.epub')
  })

  it('parses cover URL', () => {
    const catalog = OpdsParser.parse(SAMPLE_OPDS)
    expect(catalog.entries[0].coverUrl).toBe('/covers/1342.jpg')
  })

  it('parses pagination (next link)', () => {
    const catalog = OpdsParser.parse(SAMPLE_OPDS)
    expect(catalog.nextUrl).toBe('/catalog?page=2')
  })

  it('throws on invalid XML', () => {
    expect(() => OpdsParser.parse('not xml at all')).toThrow()
  })
})
