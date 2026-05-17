import { LANG_LABELS, langLabel } from '../promptLabels';

describe('promptLabels', () => {
  it('has entries for all 13 MVP languages', () => {
    const codes = ['en', 'ru', 'pl', 'uk', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'ar', 'hi'] as const;
    for (const c of codes) expect(LANG_LABELS).toHaveProperty(c);
  });

  it('langLabel returns label', () => {
    expect(langLabel('en')).toBe('English');
    expect(langLabel('ru')).toBe('Russian');
  });

  it('langLabel throws on unsupported', () => {
    expect(() => langLabel('zz' as never)).toThrow();
  });
});
