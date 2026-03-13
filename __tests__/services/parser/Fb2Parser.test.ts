import { Fb2Parser } from '../../../src/services/parser/Fb2Parser'

const SAMPLE_FB2 = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <genre>fiction</genre>
      <author><first-name>Jane</first-name><last-name>Austen</last-name></author>
      <book-title>Pride and Prejudice</book-title>
      <lang>en</lang>
      <annotation><p>A classic novel.</p></annotation>
    </title-info>
  </description>
  <body>
    <section>
      <title><p>Chapter 1</p></title>
      <p>It is a truth universally acknowledged, that a <emphasis>single man</emphasis> in possession of a good fortune, must be in want of a wife.</p>
      <p>However little known the feelings or views of such a man may be.</p>
    </section>
  </body>
</FictionBook>`

describe('Fb2Parser', () => {
  it('parses book metadata', () => {
    const book = Fb2Parser.parse(SAMPLE_FB2)
    expect(book.title).toBe('Pride and Prejudice')
    expect(book.author).toBe('Jane Austen')
    expect(book.lang).toBe('en')
  })

  it('parses sections and paragraphs', () => {
    const book = Fb2Parser.parse(SAMPLE_FB2)
    expect(book.sections).toHaveLength(1)
    expect(book.sections[0].title).toBe('Chapter 1')
    expect(book.sections[0].paragraphs).toHaveLength(2)
  })

  it('parses inline formatting (emphasis)', () => {
    const book = Fb2Parser.parse(SAMPLE_FB2)
    const firstPara = book.sections[0].paragraphs[0]
    const emphasisChild = firstPara.children.find(c => c.type === 'emphasis')
    expect(emphasisChild).toBeDefined()
    expect(emphasisChild!.text).toBe('single man')
  })

  it('throws on invalid XML', () => {
    expect(() => Fb2Parser.parse('not xml')).toThrow()
  })
})
