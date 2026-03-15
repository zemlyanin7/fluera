// Мок chapterStorage — избегаем реального обращения к файловой системе
jest.mock('../../../src/services/converter/chapterStorage', () => ({
  saveImage: jest.fn(),
}))

import { convertFb2 } from '../../../src/services/converter/fb2Converter'
import { saveImage } from '../../../src/services/converter/chapterStorage'

const SAMPLE_FB2 = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <author><first-name>Test</first-name><last-name>Author</last-name></author>
      <book-title>Test Book</book-title>
      <lang>en</lang>
    </title-info>
  </description>
  <body>
    <section>
      <title><p>Chapter 1</p></title>
      <p>Hello world.</p>
      <p><emphasis>Italic text</emphasis> and <strong>bold text</strong>.</p>
    </section>
    <section>
      <title><p>Chapter 2</p></title>
      <p>Second chapter content.</p>
    </section>
  </body>
</FictionBook>`

// FB2 с одной секцией без заголовка (нетипичная структура)
const FB2_NO_CHAPTER_TITLE = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <author><first-name>John</first-name><last-name>Doe</last-name></author>
      <book-title>Untitled Book</book-title>
      <lang>ru</lang>
    </title-info>
  </description>
  <body>
    <section>
      <p>Only paragraph without section title.</p>
    </section>
  </body>
</FictionBook>`

// FB2 с body notes (сносками)
const FB2_WITH_FOOTNOTES = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <author><first-name>A</first-name><last-name>B</last-name></author>
      <book-title>Book With Notes</book-title>
      <lang>en</lang>
    </title-info>
  </description>
  <body>
    <section>
      <title><p>Main Chapter</p></title>
      <p>Text with a note<a l:href="#note1" type="note">[1]</a>.</p>
    </section>
  </body>
  <body name="notes">
    <section id="note1">
      <title><p>1</p></title>
      <p>Footnote text content.</p>
    </section>
  </body>
</FictionBook>`

describe('convertFb2', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates chapters from sections', async () => {
    const result = await convertFb2(SAMPLE_FB2, 'test-book-id')
    expect(result.chapters).toHaveLength(2)
    expect(result.chapters[0].title).toBe('Chapter 1')
    expect(result.chapters[1].title).toBe('Chapter 2')
  })

  it('returns correct totalChapters', async () => {
    const result = await convertFb2(SAMPLE_FB2, 'test-book-id')
    expect(result.totalChapters).toBe(2)
  })

  it('extracts book metadata', async () => {
    const result = await convertFb2(SAMPLE_FB2, 'test-book-id')
    expect(result.title).toBe('Test Book')
    expect(result.author).toBe('Test Author')
  })

  it('converts paragraphs to ContentItem[]', async () => {
    const result = await convertFb2(SAMPLE_FB2, 'test-book-id')
    const items = result.chapters[0].items

    // Должен содержать heading + параграфы
    expect(items.length).toBeGreaterThan(0)
    const heading = items.find(i => i.type === 'heading')
    expect(heading).toBeDefined()

    const paragraphs = items.filter(i => i.type === 'paragraph')
    expect(paragraphs.length).toBeGreaterThan(0)
  })

  it('handles emphasis and strong inline formatting', async () => {
    const result = await convertFb2(SAMPLE_FB2, 'test-book-id')
    const items = result.chapters[0].items

    // Ищем параграф с italic или bold инлайнами
    const formattedPara = items.find(i =>
      i.type === 'paragraph' &&
      i.inlines.some((n: { type: string }) => n.type === 'italic' || n.type === 'bold')
    )
    expect(formattedPara).toBeDefined()
  })

  it('maps chapter indices correctly', async () => {
    const result = await convertFb2(SAMPLE_FB2, 'test-book-id')
    expect(result.chapters[0].index).toBe(0)
    expect(result.chapters[1].index).toBe(1)
  })

  it('returns empty footnotes when no notes body', async () => {
    const result = await convertFb2(SAMPLE_FB2, 'test-book-id')
    expect(result.footnotes).toEqual({})
  })

  it('parses footnotes from notes body', async () => {
    const result = await convertFb2(FB2_WITH_FOOTNOTES, 'book-notes')
    expect(result.footnotes).toBeDefined()
    // note1 должна быть в сносках
    expect('note1' in result.footnotes).toBe(true)
    const noteInlines = result.footnotes['note1']
    expect(noteInlines.length).toBeGreaterThan(0)
  })

  it('handles section without title', async () => {
    const result = await convertFb2(FB2_NO_CHAPTER_TITLE, 'book-no-title')
    // Контент должен быть помещён в главу, даже без заголовка
    expect(result.chapters).toHaveLength(1)
    expect(result.chapters[0].items.length).toBeGreaterThan(0)
  })

  it('respects maxChapters limit', async () => {
    const result = await convertFb2(SAMPLE_FB2, 'test-book-id', 1)
    expect(result.chapters).toHaveLength(1)
    // totalChapters всё равно отражает общее число глав
    expect(result.totalChapters).toBe(2)
  })

  it('does not call saveImage when no binary elements', async () => {
    await convertFb2(SAMPLE_FB2, 'test-book-id')
    expect(saveImage).not.toHaveBeenCalled()
  })
})
