import { SlotMatcher } from '@/services/translation/dictionaries/SlotMatcher';

describe('SlotMatcher', () => {
  it('matches give __ up with gap=1', () => {
    const m = new SlotMatcher();
    m.addPattern({
      tokens: ['give', '__', 'up'],
      gapMax: 3,
      payload: { phrase: 'give __ up', translationEquivalent: 'сдаваться' },
    });
    const hit = m.findAt(['we', 'should', 'give', 'it', 'up', 'now'], 2);
    expect(hit).not.toBeNull();
    expect(hit!.payload.translationEquivalent).toBe('сдаваться');
    expect(hit!.length).toBe(3);
  });

  it('matches with gap=3 inclusive', () => {
    const m = new SlotMatcher();
    m.addPattern({ tokens: ['give', '__', 'up'], gapMax: 3, payload: { phrase: 'give __ up', translationEquivalent: 'сдаваться' } });
    const hit = m.findAt(['give', 'the', 'old', 'book', 'up'], 0);
    expect(hit).not.toBeNull();
    expect(hit!.length).toBe(5);
  });

  it('rejects gap >3', () => {
    const m = new SlotMatcher();
    m.addPattern({ tokens: ['give', '__', 'up'], gapMax: 3, payload: { phrase: 'give __ up', translationEquivalent: 'сдаваться' } });
    const hit = m.findAt(['give', 'the', 'old', 'red', 'book', 'up'], 0);
    expect(hit).toBeNull();
  });

  it('returns null при no head match', () => {
    const m = new SlotMatcher();
    m.addPattern({ tokens: ['give', '__', 'up'], gapMax: 3, payload: { phrase: 'give __ up' } });
    expect(m.findAt(['take', 'it', 'up'], 0)).toBeNull();
  });
});
