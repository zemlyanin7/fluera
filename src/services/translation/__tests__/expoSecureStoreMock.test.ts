import * as SecureStore from 'expo-secure-store';

describe('expo-secure-store jest mock', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync('key_x');
  });

  it('setItemAsync/getItemAsync round-trips', async () => {
    await SecureStore.setItemAsync('key_x', '1');
    expect(await SecureStore.getItemAsync('key_x')).toBe('1');
  });

  it('deleteItemAsync clears', async () => {
    await SecureStore.setItemAsync('key_x', '1');
    await SecureStore.deleteItemAsync('key_x');
    expect(await SecureStore.getItemAsync('key_x')).toBeNull();
  });
});
