import { scriptForLang } from '@/theme/scripts';

describe('scriptForLang', () => {
  test.each([['en','latin'],['es','latin'],['fr','latin'],['de','latin'],
    ['it','latin'],['pt','latin'],['pl','latin']])('%s → latin', (lang, exp) => {
    expect(scriptForLang(lang)).toBe(exp);
  });
  test.each([['ru','cyrillic'],['uk','cyrillic'],['be','cyrillic'],['sr','cyrillic']])
    ('%s → cyrillic', (lang, exp) => expect(scriptForLang(lang)).toBe(exp));
  test('ja → cjk_jp', () => expect(scriptForLang('ja')).toBe('cjk_jp'));
  test('ko → cjk_kr', () => expect(scriptForLang('ko')).toBe('cjk_kr'));
  // I9: zh пока aliased в cjk_jp (workaround до полноценного cjk_zh).
  test('zh → cjk_jp (workaround alias)', () => expect(scriptForLang('zh')).toBe('cjk_jp'));
  test.each([['ar','arabic'],['fa','arabic'],['ur','arabic']])
    ('%s → arabic', (lang, exp) => expect(scriptForLang(lang)).toBe(exp));
  test.each([['hi','devanagari'],['mr','devanagari'],['sa','devanagari']])
    ('%s → devanagari', (lang, exp) => expect(scriptForLang(lang)).toBe(exp));
  test('unknown → latin', () => {
    expect(scriptForLang('xx')).toBe('latin');
    expect(scriptForLang('')).toBe('latin');
  });
});
