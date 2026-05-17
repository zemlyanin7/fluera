import { GenerationTokenManager } from '@/services/translation/generationToken';

describe('GenerationTokenManager', () => {
  it('next() increments + isStale returns false для current', () => {
    const m = new GenerationTokenManager();
    const t1 = m.next();
    expect(m.isStale(t1)).toBe(false);
    const t2 = m.next();
    expect(m.isStale(t1)).toBe(true);
    expect(m.isStale(t2)).toBe(false);
  });

  it('abort(token) revokes specific token', () => {
    const m = new GenerationTokenManager();
    const t = m.next();
    m.abort(t);
    expect(m.isStale(t)).toBe(true);
  });
});
