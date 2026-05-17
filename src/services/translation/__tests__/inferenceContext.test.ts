import { InferenceContextTracker } from '@/services/translation/inferenceContext';

describe('InferenceContextTracker', () => {
  it('first inference after warmup = cold', () => {
    const t = new InferenceContextTracker({ coldWindowMs: 30000, now: () => 1000 });
    t.markWarmupComplete();
    expect(t.current()).toBe('cold');
  });

  it('after coldWindowMs = warm', () => {
    let now = 1000;
    const t = new InferenceContextTracker({ coldWindowMs: 30000, now: () => now });
    t.markWarmupComplete();
    expect(t.current()).toBe('cold');
    now = 1000 + 31000;
    expect(t.current()).toBe('warm');
  });

  it('without warmup mark = warm (safe default)', () => {
    const t = new InferenceContextTracker({ coldWindowMs: 30000, now: () => 1000 });
    expect(t.current()).toBe('warm');
  });

  it('reset returns to cold after next warmup', () => {
    let now = 1000;
    const t = new InferenceContextTracker({ coldWindowMs: 30000, now: () => now });
    t.markWarmupComplete();
    now = 35000;
    expect(t.current()).toBe('warm');
    t.reset();
    t.markWarmupComplete();
    now = 36000;
    expect(t.current()).toBe('cold');
  });
});
