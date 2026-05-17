import { MweTrie } from '@/services/translation/dictionaries/MweTrie';

describe('MweTrie', () => {
  it('inserts + finds contiguous longest match', () => {
    const trie = new MweTrie();
    trie.insert(['kick', 'the', 'bucket'], { phrase: 'kick the bucket', translationEquivalent: 'сыграть в ящик' });
    trie.insert(['kick'], { phrase: 'kick', translationEquivalent: 'пнуть' });
    const hit = trie.findLongestAt(['he', 'will', 'kick', 'the', 'bucket', 'soon'], 2);
    expect(hit).not.toBeNull();
    expect(hit!.payload.phrase).toBe('kick the bucket');
    expect(hit!.length).toBe(3);
  });

  it('returns null at no match', () => {
    const trie = new MweTrie();
    trie.insert(['hello', 'world'], { phrase: 'hello world' });
    const hit = trie.findLongestAt(['foo', 'bar'], 0);
    expect(hit).toBeNull();
  });

  it('matches single-token entry', () => {
    const trie = new MweTrie();
    trie.insert(['idiom'], { phrase: 'idiom' });
    const hit = trie.findLongestAt(['idiom'], 0);
    expect(hit!.length).toBe(1);
  });
});
