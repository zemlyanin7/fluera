import { tokenize } from '@/services/translation/dictionaries/tokenize';

describe('tokenize', () => {
  it('split whitespace EN', () => {
    expect(tokenize('give it up now')).toEqual(['give', 'it', 'up', 'now']);
  });
  it('lowercase normalize', () => {
    expect(tokenize('GIVE IT UP')).toEqual(['give', 'it', 'up']);
  });
  it('strip trailing punctuation', () => {
    expect(tokenize('give it up!')).toEqual(['give', 'it', 'up']);
  });
  it('handles empty', () => {
    expect(tokenize('')).toEqual([]);
  });
});
