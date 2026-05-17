import { FalseFriendsDictionary } from '@/services/translation/dictionaries/FalseFriendsDictionary';

describe('FalseFriendsDictionary', () => {
  it('lookup hit for known word', () => {
    const d = new FalseFriendsDictionary();
    d.load([
      { sourceLang: 'ru', targetLang: 'en', sourceWord: 'магазин', looksLikeNative: 'magazine', actualMeaning: 'shop', confidence: 'high', domain: 'general' },
    ]);
    const hit = d.lookup('магазин');
    expect(hit).not.toBeNull();
    expect(hit!.looksLikeNative).toBe('magazine');
  });

  it('case insensitive', () => {
    const d = new FalseFriendsDictionary();
    d.load([
      { sourceLang: 'ru', targetLang: 'en', sourceWord: 'магазин', looksLikeNative: 'magazine', actualMeaning: 'shop', confidence: 'high', domain: 'general' },
    ]);
    expect(d.lookup('МАГАЗИН')).not.toBeNull();
  });

  it('returns null at miss', () => {
    const d = new FalseFriendsDictionary();
    d.load([]);
    expect(d.lookup('unknown')).toBeNull();
  });
});
