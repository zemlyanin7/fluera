// Тонкий wrapper над AsyncStorage с JSON-сериализацией и graceful fallback.
// При corrupted JSON / read-ошибке возвращаем null вместо throw — чтобы
// один битый ключ не валил всю rehydration стора.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const asyncStorage = {
  async getJSON<T = unknown>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  async setJSON(key: string, value: unknown): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
  async clear(): Promise<void> {
    await AsyncStorage.clear();
  },
};
