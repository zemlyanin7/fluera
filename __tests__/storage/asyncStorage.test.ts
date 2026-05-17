import { asyncStorage } from '@/storage/asyncStorage';

describe('asyncStorage', () => {
  beforeEach(() => asyncStorage.clear());

  test('setJSON + getJSON roundtrip', async () => {
    await asyncStorage.setJSON('k1', { a: 1, b: 'two' });
    expect(await asyncStorage.getJSON('k1')).toEqual({ a: 1, b: 'two' });
  });

  test('getJSON returns null for missing key', async () => {
    expect(await asyncStorage.getJSON('missing')).toBeNull();
  });

  test('getJSON returns null on corrupted JSON', async () => {
    const AS = require('@react-native-async-storage/async-storage').default;
    await AS.setItem('corrupt', '{not-json}');
    expect(await asyncStorage.getJSON('corrupt')).toBeNull();
  });

  test('remove deletes the key', async () => {
    await asyncStorage.setJSON('k', 1);
    await asyncStorage.remove('k');
    expect(await asyncStorage.getJSON('k')).toBeNull();
  });

  test('setJSON with array', async () => {
    await asyncStorage.setJSON('arr', [1, 2, 3]);
    expect(await asyncStorage.getJSON<number[]>('arr')).toEqual([1, 2, 3]);
  });
});
