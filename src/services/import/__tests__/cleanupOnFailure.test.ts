import * as FileSystem from 'expo-file-system/legacy';
import { cleanupOnFailure } from '../cleanupOnFailure';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock/docs/',
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  deleteAsync: jest.fn(async () => {}),
}));

describe('cleanupOnFailure', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes tmpPath if exists', async () => {
    await cleanupOnFailure({ tmpPath: '/mock/docs/books/_tmp/abc.epub' });
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      '/mock/docs/books/_tmp/abc.epub',
      { idempotent: true },
    );
  });

  it('deletes book dir if bookId provided', async () => {
    await cleanupOnFailure({ tmpPath: null, bookId: 'abc123' });
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      '/mock/docs/books/abc123',
      { idempotent: true },
    );
  });

  it('handles missing files gracefully', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: false });
    await expect(cleanupOnFailure({ tmpPath: '/x' })).resolves.not.toThrow();
  });
});
