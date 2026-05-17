import { estimatePageCoverage } from '@/services/translation/coverageEstimator';

describe('estimatePageCoverage', () => {
  it('returns 1.0 когда все words known', () => {
    const r = estimatePageCoverage({
      pageWords: ['the', 'quick', 'fox'],
      knownLemmas: new Set(['the', 'quick', 'fox']),
    });
    expect(r).toBeCloseTo(1.0);
  });

  it('returns 0.5 при 2 of 4 known', () => {
    const r = estimatePageCoverage({
      pageWords: ['the', 'quick', 'brown', 'fox'],
      knownLemmas: new Set(['the', 'fox']),
    });
    expect(r).toBeCloseTo(0.5);
  });

  it('returns 0 при empty pageWords', () => {
    const r = estimatePageCoverage({ pageWords: [], knownLemmas: new Set() });
    expect(r).toBe(0);
  });

  it('case-insensitive matching', () => {
    const r = estimatePageCoverage({
      pageWords: ['The', 'Quick'],
      knownLemmas: new Set(['the', 'quick']),
    });
    expect(r).toBeCloseTo(1.0);
  });
});
