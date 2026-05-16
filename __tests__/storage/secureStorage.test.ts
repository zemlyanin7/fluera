import { secureStorage, opdsKey } from '@/storage/secureStorage';

describe('secureStorage', () => {
  test('opdsKey produces "opds:" prefix', () => {
    expect(opdsKey('abc123')).toBe('opds:abc123');
  });

  test('setOPDSCreds + getOPDSCreds roundtrip', async () => {
    await secureStorage.setOPDSCreds('cat1', { username: 'u', password: 'p' });
    expect(await secureStorage.getOPDSCreds('cat1')).toEqual({ username: 'u', password: 'p' });
  });

  test('getOPDSCreds returns null для отсутствующего каталога', async () => {
    expect(await secureStorage.getOPDSCreds('nope')).toBeNull();
  });

  test('deleteOPDSCreds удаляет creds', async () => {
    await secureStorage.setOPDSCreds('cat2', { username: 'u', password: 'p' });
    await secureStorage.deleteOPDSCreds('cat2');
    expect(await secureStorage.getOPDSCreds('cat2')).toBeNull();
  });

  test('rejects empty catalog id', async () => {
    await expect(
      secureStorage.setOPDSCreds('', { username: 'u', password: 'p' }),
    ).rejects.toThrow();
  });

  test('rejects undefined catalog id', async () => {
    await expect(
      secureStorage.setOPDSCreds(undefined as unknown as string, { username: 'u', password: 'p' }),
    ).rejects.toThrow();
  });

  test('возвращает null если SecureStore хранит corrupted JSON', async () => {
    const SS = require('expo-secure-store');
    await SS.setItemAsync('opds:bad', '{broken');
    expect(await secureStorage.getOPDSCreds('bad')).toBeNull();
  });
});
