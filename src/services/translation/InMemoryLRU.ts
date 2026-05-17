// Simple LRU built on Map's insertion-order property. On get(), promotes
// entry by delete + re-insert. On set() at capacity, evicts oldest entry.
export class InMemoryLRU<V> {
  private map = new Map<string, V>();

  constructor(private capacity: number) {
    if (capacity <= 0) throw new Error('LRU capacity must be > 0');
  }

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}
