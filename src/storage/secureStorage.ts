// SecureStore wrapper для OPDS-кредов. iOS Keychain / Android Keystore через
// expo-secure-store. По плану #2: ключ "opds:{catalog_id}", значение JSON
// {username, password}. КАТЕГОРИЧЕСКИ запрещено хранить любые секреты в
// AsyncStorage — только здесь.
import * as SecureStore from 'expo-secure-store';

export interface OPDSCreds {
  username: string;
  password: string;
}

export function opdsKey(catalogId: string): string {
  return `opds:${catalogId}`;
}

function assertCatalogId(id: string): void {
  if (!id || typeof id !== 'string') {
    throw new Error('secureStorage: catalog id must be non-empty string');
  }
}

export const secureStorage = {
  async setOPDSCreds(catalogId: string, creds: OPDSCreds): Promise<void> {
    assertCatalogId(catalogId);
    await SecureStore.setItemAsync(opdsKey(catalogId), JSON.stringify(creds));
  },
  async getOPDSCreds(catalogId: string): Promise<OPDSCreds | null> {
    assertCatalogId(catalogId);
    const raw = await SecureStore.getItemAsync(opdsKey(catalogId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OPDSCreds;
    } catch {
      return null;
    }
  },
  async deleteOPDSCreds(catalogId: string): Promise<void> {
    assertCatalogId(catalogId);
    await SecureStore.deleteItemAsync(opdsKey(catalogId));
  },
};
