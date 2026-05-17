// Mock csvAssets before importing DictionaryLoader to prevent Jest from requiring actual
// CSV files (which are not valid JS and fail to parse outside Metro bundler).
jest.mock('@/services/translation/dictionaries/csvAssets', () => ({
  getMweAsset: jest.fn(() => null),
  getFalseFriendsAsset: jest.fn(() => null),
  csvAssets: { mwe: {}, falseFriends: {} },
}));
// expo-file-system is statically imported by DictionaryLoader
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
}));

import { DictionaryLoader } from '@/services/translation/dictionaries/DictionaryLoader';
import { MweDictionary } from '@/services/translation/dictionaries/MweDictionary';
import { FalseFriendsDictionary } from '@/services/translation/dictionaries/FalseFriendsDictionary';

describe('DictionaryLoader', () => {
  it('loadPair заполняет MWE + false-friend для пары когда CSV доступен', async () => {
    const mwe = new MweDictionary();
    const ff = new FalseFriendsDictionary();
    const loader = new DictionaryLoader({
      mweDictionary: mwe,
      falseFriendsDictionary: ff,
      readMweCsv: async () =>
        'mwe,translation_equivalent,literal_gloss,type,gap_pattern,domain,attribution\nhello world,привет мир,,idiom,,general,test',
      readFalseFriendsCsv: async () =>
        'source_word,looks_like_native,actual_meaning,confidence,domain\nмагазин,magazine,shop,high,general',
    });
    await loader.loadPair('en', 'ru');
    expect(mwe.isLoaded()).toBe(true);
    expect(ff.isLoaded()).toBe(true);
    const m = mwe.lookup('hello world', 0);
    expect(m).not.toBeNull();
  });

  it('loadPair handles null asset gracefully (degraded pair)', async () => {
    const mwe = new MweDictionary();
    const ff = new FalseFriendsDictionary();
    const loader = new DictionaryLoader({
      mweDictionary: mwe,
      falseFriendsDictionary: ff,
      readMweCsv: async () => null,
      readFalseFriendsCsv: async () => null,
    });
    await loader.loadPair('xx', 'yy');
    expect(mwe.isLoaded()).toBe(true);
    expect(ff.isLoaded()).toBe(true);
    expect(mwe.lookup('anything', 0)).toBeNull();
  });
});
