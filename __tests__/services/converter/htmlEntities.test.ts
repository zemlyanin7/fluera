import { decodeHtmlEntities } from '../../../src/services/converter/htmlEntities'

describe('decodeHtmlEntities', () => {
  it('decodes named entities', () => {
    expect(decodeHtmlEntities('&amp;')).toBe('&')
    expect(decodeHtmlEntities('&lt;')).toBe('<')
    expect(decodeHtmlEntities('&gt;')).toBe('>')
    expect(decodeHtmlEntities('&quot;')).toBe('"')
    expect(decodeHtmlEntities('&apos;')).toBe("'")
  })

  it('decodes typographic named entities', () => {
    expect(decodeHtmlEntities('&mdash;')).toBe('\u2014')
    expect(decodeHtmlEntities('&ndash;')).toBe('\u2013')
    expect(decodeHtmlEntities('&nbsp;')).toBe('\u00A0')
    expect(decodeHtmlEntities('&hellip;')).toBe('\u2026')
    expect(decodeHtmlEntities('&laquo;')).toBe('\u00AB')
    expect(decodeHtmlEntities('&raquo;')).toBe('\u00BB')
  })

  it('decodes numeric decimal entities', () => {
    // &#160; → неразрывный пробел (U+00A0)
    expect(decodeHtmlEntities('&#160;')).toBe('\u00A0')
    expect(decodeHtmlEntities('&#65;')).toBe('A')
    expect(decodeHtmlEntities('&#8212;')).toBe('\u2014') // em dash
  })

  it('decodes numeric hex entities', () => {
    // &#x00A0; → неразрывный пробел (U+00A0)
    expect(decodeHtmlEntities('&#x00A0;')).toBe('\u00A0')
    expect(decodeHtmlEntities('&#x41;')).toBe('A')
    expect(decodeHtmlEntities('&#X2014;')).toBe('\u2014') // заглавный X тоже поддерживается
  })

  it('handles mixed entities in text', () => {
    const result = decodeHtmlEntities('Tom &amp; Jerry &mdash; a classic.')
    expect(result).toBe('Tom & Jerry \u2014 a classic.')
  })

  it('leaves unknown entities unchanged', () => {
    // Неизвестная сущность остаётся как есть
    expect(decodeHtmlEntities('&unknownEntity;')).toBe('&unknownEntity;')
  })

  it('handles text without entities', () => {
    const text = 'Plain text without any entities.'
    expect(decodeHtmlEntities(text)).toBe(text)
  })

  it('handles multiple entities in sequence', () => {
    const result = decodeHtmlEntities('&lt;div&gt;hello&lt;/div&gt;')
    expect(result).toBe('<div>hello</div>')
  })

  it('decodes copyright and registered trademark symbols', () => {
    expect(decodeHtmlEntities('&copy;')).toBe('\u00A9')
    expect(decodeHtmlEntities('&reg;')).toBe('\u00AE')
    expect(decodeHtmlEntities('&trade;')).toBe('\u2122')
  })

  it('decodes euro and currency symbols', () => {
    expect(decodeHtmlEntities('&euro;')).toBe('\u20AC')
    expect(decodeHtmlEntities('&pound;')).toBe('\u00A3')
  })
})
