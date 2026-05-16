jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/test/Documents/',
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { ModelStore } from '../ModelStore';

describe('ModelStore', () => {
  beforeEach(() => jest.clearAllMocks());

  it('isInstalled() true when file exists + SecureStore mark present', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 700_000_000 });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('valid-sha');
    expect(await new ModelStore().isInstalled()).toBe(true);
  });

  it('isInstalled() false when file missing', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('valid-sha');
    expect(await new ModelStore().isInstalled()).toBe(false);
  });

  it('isInstalled() false when mark missing', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    expect(await new ModelStore().isInstalled()).toBe(false);
  });

  it('markInstalled() writes SecureStore', async () => {
    await new ModelStore().markInstalled('sha-hash');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('llm:model-installed-v1', 'sha-hash');
  });

  it('wipe() deletes file and clears mark', async () => {
    await new ModelStore().wipe();
    expect(FileSystem.deleteAsync).toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('llm:model-installed-v1');
  });
});
