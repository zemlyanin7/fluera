import { shouldShowCoverageHint } from '@/services/translation/shouldShowCoverageHint';

describe('shouldShowCoverageHint', () => {
  it('true когда both conditions met', () => {
    expect(shouldShowCoverageHint({ pageCoverage: 0.7, sentenceComplex: true })).toBe(true);
  });

  it('false когда page coverage > 0.9', () => {
    expect(shouldShowCoverageHint({ pageCoverage: 0.95, sentenceComplex: true })).toBe(false);
  });

  it('false когда sentence simple', () => {
    expect(shouldShowCoverageHint({ pageCoverage: 0.5, sentenceComplex: false })).toBe(false);
  });

  it('false когда оба условия не выполнены', () => {
    expect(shouldShowCoverageHint({ pageCoverage: 0.99, sentenceComplex: false })).toBe(false);
  });

  it('true на граничном значении coverage = 0.89', () => {
    expect(shouldShowCoverageHint({ pageCoverage: 0.89, sentenceComplex: true })).toBe(true);
  });

  it('false на граничном значении coverage = 0.90', () => {
    expect(shouldShowCoverageHint({ pageCoverage: 0.90, sentenceComplex: true })).toBe(false);
  });
});
