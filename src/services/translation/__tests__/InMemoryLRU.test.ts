import { InMemoryLRU } from '../InMemoryLRU';

describe('InMemoryLRU', () => {
  it('stores and retrieves', () => {
    const lru = new InMemoryLRU<string>(3);
    lru.set('a', '1');
    expect(lru.get('a')).toBe('1');
  });

  it('returns undefined for missing', () => {
    const lru = new InMemoryLRU<string>(3);
    expect(lru.get('missing')).toBeUndefined();
  });

  it('evicts LRU entry when full', () => {
    const lru = new InMemoryLRU<string>(2);
    lru.set('a', '1');
    lru.set('b', '2');
    lru.set('c', '3');
    expect(lru.get('a')).toBeUndefined();
    expect(lru.get('b')).toBe('2');
    expect(lru.get('c')).toBe('3');
  });

  it('promotes accessed entry to most-recent', () => {
    const lru = new InMemoryLRU<string>(2);
    lru.set('a', '1');
    lru.set('b', '2');
    lru.get('a'); // promote a
    lru.set('c', '3'); // should evict b, not a
    expect(lru.get('a')).toBe('1');
    expect(lru.get('b')).toBeUndefined();
    expect(lru.get('c')).toBe('3');
  });

  it('size() returns current count', () => {
    const lru = new InMemoryLRU<string>(3);
    lru.set('a', '1');
    lru.set('b', '2');
    expect(lru.size()).toBe(2);
  });

  it('clear() wipes', () => {
    const lru = new InMemoryLRU<string>(3);
    lru.set('a', '1');
    lru.clear();
    expect(lru.size()).toBe(0);
  });

  it('throws on capacity <= 0', () => {
    expect(() => new InMemoryLRU<string>(0)).toThrow();
  });
});
