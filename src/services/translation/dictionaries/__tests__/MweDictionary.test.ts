import { MweDictionary } from '@/services/translation/dictionaries/MweDictionary';

describe('MweDictionary', () => {
  it('contiguous match via trie', () => {
    const dict = new MweDictionary();
    dict.load([
      { phrase: 'kick the bucket', translationEquivalent: 'сыграть в ящик', mweType: 'idiom', gapPattern: null, literalGloss: 'ударить ведро', domain: 'general' },
    ]);
    const hit = dict.lookup('he will kick the bucket', 13);
    expect(hit).not.toBeNull();
    expect(hit!.payload.translationEquivalent).toBe('сыграть в ящик');
  });

  it('discontinuous match via slot pattern', () => {
    const dict = new MweDictionary();
    dict.load([
      { phrase: 'give __ up', translationEquivalent: 'сдаваться', mweType: 'phrasal_verb', gapPattern: '__≤3', literalGloss: null, domain: 'general' },
    ]);
    const hit = dict.lookup('we should give it up now', 13);
    expect(hit).not.toBeNull();
    expect(hit!.payload.translationEquivalent).toBe('сдаваться');
  });

  it('returns null при no match', () => {
    const dict = new MweDictionary();
    dict.load([{ phrase: 'hello world', translationEquivalent: 'привет мир', mweType: 'idiom', gapPattern: null, literalGloss: null, domain: 'general' }]);
    expect(dict.lookup('the quick brown fox', 4)).toBeNull();
  });
});
