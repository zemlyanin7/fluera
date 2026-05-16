import { cleanTranslation } from '../cleanTranslation';

describe('cleanTranslation', () => {
  it('strips leading/trailing whitespace and punctuation', () => {
    expect(cleanTranslation('  «кошка»  ')).toBe('кошка');
  });

  it('takes first line on multi-line', () => {
    expect(cleanTranslation('кошка\nalso cat')).toBe('кошка');
  });

  it('collapses internal whitespace', () => {
    expect(cleanTranslation('кош  ка')).toBe('кош ка');
  });

  it('caps length at 200', () => {
    expect(cleanTranslation('a'.repeat(300))).toHaveLength(200);
  });

  it('returns empty on whitespace-only input', () => {
    expect(cleanTranslation('   ')).toBe('');
  });

  it('handles CJK quotes', () => {
    expect(cleanTranslation('「猫」')).toBe('猫');
  });
});
