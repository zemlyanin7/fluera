import { tryAlignWord } from '@/services/translation/sentence/tryAlignWord';

describe('tryAlignWord', () => {
  it('finds target word при known word-level translation', () => {
    const result = tryAlignWord({
      sourceSentence: 'The spring of life is short.',
      wordOffset: 4,
      sourceWord: 'spring',
      translatedSentence: 'Источник жизни короток.',
      knownWordTranslation: 'источник',
    });
    expect(result).toBe(0);
  });

  it('returns undefined when translation NOT found в target', () => {
    const result = tryAlignWord({
      sourceSentence: 'The spring of life.',
      wordOffset: 4,
      sourceWord: 'spring',
      translatedSentence: 'Источник жизни.',
      knownWordTranslation: 'весна',
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined when knownWordTranslation is undefined', () => {
    const result = tryAlignWord({
      sourceSentence: 'The spring of life.',
      wordOffset: 4,
      sourceWord: 'spring',
      translatedSentence: 'Источник жизни.',
      knownWordTranslation: undefined,
    });
    expect(result).toBeUndefined();
  });

  it('case-insensitive match', () => {
    const result = tryAlignWord({
      sourceSentence: 'Spring is here.',
      wordOffset: 0,
      sourceWord: 'Spring',
      translatedSentence: 'Источник здесь.',
      knownWordTranslation: 'источник',
    });
    expect(result).toBe(0);
  });
});
