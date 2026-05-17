import type {
  SentenceTranslationInput,
  SentenceTranslationResult,
  ITranslationService,
  TranslationResult,
} from '@/services/translation/ITranslationService';

describe('ITranslationService types', () => {
  it('SentenceTranslationResult has experimental boolean', () => {
    const r: SentenceTranslationResult = { status: 'ok', experimental: true };
    expect(r.experimental).toBe(true);
  });

  it('TranslationResult has optional false-friend + MWE + encounter fields', () => {
    const r: TranslationResult = {
      status: 'ok',
      translation: 'hi',
      falseFriend: { looksLike: 'magazine', actualMeaning: 'shop', confidence: 'high', domain: 'general' },
      mwePhrase: { phrase: 'give up', translationEquivalent: 'сдаваться', type: 'phrasal_verb' },
      encounterCount: 5,
    };
    expect(r.falseFriend?.confidence).toBe('high');
  });

  it('ITranslationService has translateSentence method signature', () => {
    const stub: ITranslationService = {
      translate: jest.fn(),
      translateSentence: jest.fn(),
      clearCache: jest.fn(),
    };
    expect(typeof stub.translateSentence).toBe('function');
  });

  it('SentenceTranslationInput accepts optional wordOffset + sourceWord', () => {
    const input: SentenceTranslationInput = {
      sentence: 'Hello world.',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      wordOffset: 6,
      sourceWord: 'world',
    };
    expect(input.wordOffset).toBe(6);
    expect(input.sourceWord).toBe('world');
  });
});
