jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(),
}));

import * as FileSystem from 'expo-file-system/legacy';
import { verifyModelSha256 } from '../verifyModel';
import { MODEL_MANIFEST } from '../modelManifest';

describe('verifyModelSha256 (size-only v1)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns true when file size matches manifest', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true,
      size: MODEL_MANIFEST.sizeBytes,
    });
    expect(await verifyModelSha256('/path/x.gguf', 'anyhash')).toBe(true);
  });

  it('returns false when size mismatch (truncated)', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true,
      size: MODEL_MANIFEST.sizeBytes - 1000,
    });
    expect(await verifyModelSha256('/path/x.gguf', 'anyhash')).toBe(false);
  });

  it('returns false when file missing', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    expect(await verifyModelSha256('/path/x.gguf', 'anyhash')).toBe(false);
  });

  it('returns false when size missing', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    expect(await verifyModelSha256('/path/x.gguf', 'anyhash')).toBe(false);
  });
});
