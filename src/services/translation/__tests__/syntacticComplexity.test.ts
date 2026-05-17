import { isSentenceComplex } from '@/services/translation/syntacticComplexity';

describe('isSentenceComplex', () => {
  it('simple sentence = false', () => {
    expect(isSentenceComplex('The cat sat.', 'en')).toBe(false);
  });

  it('3+ clauses = true', () => {
    expect(isSentenceComplex('The cat sat, the dog ran, the bird flew.', 'en')).toBe(true);
  });

  it('passive voice EN detected', () => {
    expect(isSentenceComplex('The book was written by him.', 'en')).toBe(true);
  });

  it('subordinate clause marker triggers', () => {
    expect(isSentenceComplex('The book that I read was great.', 'en')).toBe(true);
  });

  it('RU subordinate marker detected', () => {
    expect(isSentenceComplex('Книга, которую я прочитал, была хороша.', 'ru')).toBe(true);
  });

  it('unknown language — no false positive on simple sentence', () => {
    expect(isSentenceComplex('简单的句子。', 'zh')).toBe(false);
  });
});
