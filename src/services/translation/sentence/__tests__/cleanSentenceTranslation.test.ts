import { cleanSentenceTranslation } from '../cleanSentenceTranslation';

describe('cleanSentenceTranslation', () => {
  it('strips leading/trailing whitespace + newlines', () => {
    expect(cleanSentenceTranslation('  Hello world.\n\n')).toBe('Hello world.');
  });
  it('strips leading "Translation:" / "Перевод:" prefix', () => {
    expect(cleanSentenceTranslation('Translation: Hello world.')).toBe('Hello world.');
    expect(cleanSentenceTranslation('Перевод: Привет мир.')).toBe('Привет мир.');
  });
  it('keeps internal newlines intact (multi-line sentences)', () => {
    expect(cleanSentenceTranslation('Line one.\nLine two.')).toBe('Line one.\nLine two.');
  });
  it('returns empty string if input is whitespace only', () => {
    expect(cleanSentenceTranslation('   \n  ')).toBe('');
  });
});
