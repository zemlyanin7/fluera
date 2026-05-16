jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('@/services/parser/shared/base64Decode', () => ({
  base64Decode: jest.fn(),
}));

import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { base64Decode } from '@/services/parser/shared/base64Decode';
import { verifyModelSha256 } from '../verifyModel';

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

describe('verifyModelSha256', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('FAKEBASE64');
    (base64Decode as jest.Mock).mockReturnValue(new Uint8Array([1, 2, 3]));
  });

  it('returns true on hash match', async () => {
    (Crypto.digest as jest.Mock).mockResolvedValue(hexToBuffer('abc123'));
    expect(await verifyModelSha256('/path/x.gguf', 'abc123')).toBe(true);
  });

  it('returns false on hash mismatch', async () => {
    (Crypto.digest as jest.Mock).mockResolvedValue(hexToBuffer('abc123'));
    expect(await verifyModelSha256('/path/x.gguf', 'deadbeef')).toBe(false);
  });

  it('case-insensitive comparison', async () => {
    (Crypto.digest as jest.Mock).mockResolvedValue(hexToBuffer('abc123'));
    expect(await verifyModelSha256('/path/x.gguf', 'ABC123')).toBe(true);
  });
});
