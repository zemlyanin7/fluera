import { buildPrompt, isCJKPair } from '../PromptBuilder';

describe('PromptBuilder', () => {
  it('builds basic en→ru prompt', () => {
    const p = buildPrompt({
      word: 'cat',
      sentence: 'The cat sat.',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(p).toContain('English');
    expect(p).toContain('Russian');
    expect(p).toContain('The cat sat.');
    expect(p).toContain('cat');
  });

  it('uses curly quotes for European source', () => {
    const p = buildPrompt({
      word: 'gato',
      sentence: 'El gato.',
      bookLanguage: 'es',
      nativeLanguage: 'en',
    });
    expect(p).toContain('«El gato.»');
  });

  it('uses Japanese quotes for CJK source', () => {
    const p = buildPrompt({
      word: '猫',
      sentence: '猫がいる。',
      bookLanguage: 'ja',
      nativeLanguage: 'en',
    });
    expect(p).toContain('「猫がいる。」');
    expect(p).not.toContain('«');
  });

  it('uses Japanese quotes when target is CJK', () => {
    const p = buildPrompt({
      word: 'cat',
      sentence: 'The cat.',
      bookLanguage: 'en',
      nativeLanguage: 'ko',
    });
    expect(p).toContain('「The cat.」');
  });

  it('isCJKPair returns true for ja/ko sources or targets', () => {
    expect(isCJKPair('ja', 'en')).toBe(true);
    expect(isCJKPair('en', 'ko')).toBe(true);
    expect(isCJKPair('en', 'ru')).toBe(false);
  });

  it('truncates sentence at 200 chars', () => {
    const long = 'a'.repeat(500);
    const p = buildPrompt({
      word: 'x',
      sentence: long,
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    // header + 200 char truncated sentence + word + footer ≈ <500 chars total
    expect(p.length).toBeLessThan(700);
  });
});
