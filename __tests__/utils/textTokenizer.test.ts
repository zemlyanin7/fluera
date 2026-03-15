import { tokenizeIntoWords, extractSentence } from '../../src/utils/textTokenizer'

describe('tokenizeIntoWords', () => {
  it('splits text into word tokens', () => {
    const tokens = tokenizeIntoWords('Hello world')
    expect(tokens).toEqual([
      { word: 'Hello', trailing: ' ' },
      { word: 'world', trailing: '' },
    ])
  })

  it('handles empty string', () => {
    const tokens = tokenizeIntoWords('')
    expect(tokens).toEqual([])
  })

  it('handles single word', () => {
    const tokens = tokenizeIntoWords('word')
    expect(tokens).toEqual([{ word: 'word', trailing: '' }])
  })

  it('preserves trailing whitespace info', () => {
    // Пробел после слова сохраняется в поле trailing
    const tokens = tokenizeIntoWords('one two three')
    expect(tokens[0].trailing).toBe(' ')
    expect(tokens[1].trailing).toBe(' ')
    expect(tokens[2].trailing).toBe('')
  })

  it('handles multiple whitespace chars', () => {
    // Несколько пробелов подряд — trailing содержит все пробельные символы
    const tokens = tokenizeIntoWords('a  b')
    expect(tokens).toHaveLength(2)
    expect(tokens[0].trailing).toBe('  ')
    expect(tokens[1].trailing).toBe('')
  })

  it('handles punctuation attached to words', () => {
    // Пунктуация не отделяется от слова
    const tokens = tokenizeIntoWords('Hello, world!')
    expect(tokens).toEqual([
      { word: 'Hello,', trailing: ' ' },
      { word: 'world!', trailing: '' },
    ])
  })

  it('handles leading whitespace', () => {
    const tokens = tokenizeIntoWords('  hello')
    expect(tokens).toEqual([{ word: 'hello', trailing: '' }])
  })
})

describe('extractSentence', () => {
  it('finds sentence containing word', () => {
    const text = 'First sentence. Second sentence with target word. Third sentence.'
    const sentence = extractSentence(text, 'target')
    expect(sentence).toBe('Second sentence with target word.')
  })

  it('returns full text if no boundary found', () => {
    const text = 'Just one long text without period'
    const sentence = extractSentence(text, 'long')
    expect(sentence).toBe('Just one long text without period')
  })

  it('handles period boundary', () => {
    const text = 'Alpha. Beta gamma delta.'
    const sentence = extractSentence(text, 'gamma')
    expect(sentence).toBe('Beta gamma delta.')
  })

  it('handles exclamation mark boundary', () => {
    const text = 'Stop! Go now please!'
    const sentence = extractSentence(text, 'Go')
    expect(sentence).toBe('Go now please!')
  })

  it('handles question mark boundary', () => {
    const text = 'Is it done? Yes it is!'
    const sentence = extractSentence(text, 'Yes')
    expect(sentence).toBe('Yes it is!')
  })

  it('returns full text when word not found', () => {
    const text = 'Hello world.'
    const sentence = extractSentence(text, 'missing')
    expect(sentence).toBe('Hello world.')
  })

  it('handles word in first sentence', () => {
    const text = 'First sentence here. Second sentence here.'
    const sentence = extractSentence(text, 'First')
    expect(sentence).toBe('First sentence here.')
  })
})
