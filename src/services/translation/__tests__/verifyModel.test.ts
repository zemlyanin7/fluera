jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));

import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { verifyModelSha256 } from '../verifyModel';

describe('verifyModelSha256', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns true on hash match', async () => {
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('FAKEBASE64');
    (Crypto.digestStringAsync as jest.Mock).mockResolvedValue('abc123');
    const ok = await verifyModelSha256('/path/x.gguf', 'abc123');
    expect(ok).toBe(true);
  });

  it('returns false on hash mismatch', async () => {
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('FAKEBASE64');
    (Crypto.digestStringAsync as jest.Mock).mockResolvedValue('different');
    const ok = await verifyModelSha256('/path/x.gguf', 'abc123');
    expect(ok).toBe(false);
  });

  it('case-insensitive comparison', async () => {
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('FAKEBASE64');
    (Crypto.digestStringAsync as jest.Mock).mockResolvedValue('ABC123');
    const ok = await verifyModelSha256('/path/x.gguf', 'abc123');
    expect(ok).toBe(true);
  });
});
