// Persistent state модели на устройстве: проверка файла + SecureStore mark.
// Двойная проверка нужна потому что только наличие файла не гарантирует
// что он был successfully verified (мог остаться от crashed download).
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { getModelLocalPath } from './modelManifest';

// SecureStore keys: только alphanumeric + `.`, `-`, `_`. `:` запрещён.
const SECURE_STORE_KEY = 'llm_model_installed_v1';

export class ModelStore {
  async isInstalled(): Promise<boolean> {
    const [info, mark] = await Promise.all([
      FileSystem.getInfoAsync(getModelLocalPath()),
      SecureStore.getItemAsync(SECURE_STORE_KEY),
    ]);
    return info.exists && mark !== null;
  }

  async markInstalled(sha256: string): Promise<void> {
    await SecureStore.setItemAsync(SECURE_STORE_KEY, sha256);
  }

  async wipe(): Promise<void> {
    await Promise.all([
      FileSystem.deleteAsync(getModelLocalPath(), { idempotent: true }),
      SecureStore.deleteItemAsync(SECURE_STORE_KEY),
    ]);
  }
}
