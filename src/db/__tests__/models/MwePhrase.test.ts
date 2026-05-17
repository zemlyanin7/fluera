import { MwePhraseModel } from '@/db/models/MwePhrase';

describe('MwePhraseModel', () => {
  it('decorates fields correctly', () => {
    expect(MwePhraseModel.table).toBe('mwe_phrases');
  });
});
