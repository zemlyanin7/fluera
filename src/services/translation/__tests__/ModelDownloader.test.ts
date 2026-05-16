const mockResumable = {
  downloadAsync: jest.fn(),
  pauseAsync: jest.fn().mockResolvedValue(undefined),
  resumeAsync: jest.fn().mockResolvedValue(undefined),
};

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/test/Documents/',
  createDownloadResumable: jest.fn(() => mockResumable),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  moveAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: jest.fn(),
}));

import { ModelDownloader } from '../ModelDownloader';

describe('ModelDownloader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResumable.pauseAsync.mockResolvedValue(undefined);
  });

  it('start() returns ok on successful download + verify', async () => {
    mockResumable.downloadAsync.mockResolvedValue({ uri: '/test/Documents/llm/model.gguf.partial' });
    const verify = jest.fn().mockResolvedValue(true);
    const downloader = new ModelDownloader({ verifySha256: verify });
    const res = await downloader.start({ onProgress: () => {} });
    expect(res.ok).toBe(true);
  });

  it('start() returns CHECKSUM_MISMATCH on SHA mismatch', async () => {
    mockResumable.downloadAsync.mockResolvedValue({ uri: '/test/Documents/llm/model.gguf.partial' });
    const verify = jest.fn().mockResolvedValue(false);
    const downloader = new ModelDownloader({ verifySha256: verify });
    const res = await downloader.start({ onProgress: () => {} });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('CHECKSUM_MISMATCH');
  });

  it('start() returns NETWORK_ERROR on download exception', async () => {
    mockResumable.downloadAsync.mockRejectedValue(new Error('net'));
    const downloader = new ModelDownloader({ verifySha256: jest.fn() });
    const res = await downloader.start({ onProgress: () => {} });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('NETWORK_ERROR');
  });

  it('reports progress fraction via callback', async () => {
    const FileSystem = require('expo-file-system/legacy');
    (FileSystem.createDownloadResumable as jest.Mock).mockImplementation(
      (_url: string, _path: string, _opts: unknown, cb: (e: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void) => {
        cb({ totalBytesWritten: 50, totalBytesExpectedToWrite: 100 });
        return mockResumable;
      },
    );
    mockResumable.downloadAsync.mockResolvedValue({ uri: '/x' });
    const onProgress = jest.fn();
    const downloader = new ModelDownloader({ verifySha256: jest.fn().mockResolvedValue(true) });
    await downloader.start({ onProgress });
    expect(onProgress).toHaveBeenCalledWith(0.5);
  });
});
