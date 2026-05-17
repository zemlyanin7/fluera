import { computeFeedbackCutoff } from '@/services/translation/feedbackRetention';

describe('computeFeedbackCutoff', () => {
  it('returns now - 365 days в ms', () => {
    const now = 1_700_000_000_000;
    const cutoff = computeFeedbackCutoff(now, 365);
    expect(cutoff).toBe(now - 365 * 24 * 60 * 60 * 1000);
  });
});
