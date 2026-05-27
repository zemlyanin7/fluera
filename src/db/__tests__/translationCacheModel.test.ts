// #4.6 — TranslationCache model surfaces source/ttl_days/chrf_score fields.
import { TranslationCacheModel } from '@/db/models/TranslationCache';

describe('TranslationCache model — prefetch fields', () => {
  it('exposes source/ttlDays/chrfScore as decorated fields', () => {
    const proto = TranslationCacheModel.prototype as any;
    expect(Object.getOwnPropertyDescriptor(proto, 'source')).toBeDefined();
    expect(Object.getOwnPropertyDescriptor(proto, 'ttlDays')).toBeDefined();
    expect(Object.getOwnPropertyDescriptor(proto, 'chrfScore')).toBeDefined();
  });
});
