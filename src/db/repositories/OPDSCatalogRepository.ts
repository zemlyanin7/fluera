// OPDSCatalog: URL валидация (https/http only) + strip userinfo + cred-wipe
// при delete (см. §6.4 спеки).
import { Database, Q } from '@nozbe/watermelondb';
import { OPDSCatalogModel } from '@/db/models';
import { secureStorage, type OPDSCreds } from '@/storage/secureStorage';

export interface CreateCatalogInput {
  name: string;
  url: string;
  kind?: 'preset' | 'custom';
  creds?: OPDSCreds | null;
}

export interface OPDSCatalogRecord {
  id: string;
  name: string;
  url: string;
  requiresAuth: boolean;
  kind: string;
  lastFetchedAt: number | null;
  createdAt: number;
}

function toRecord(m: OPDSCatalogModel): OPDSCatalogRecord {
  return {
    id: m.id,
    name: m.name,
    url: m.url,
    requiresAuth: m.requiresAuth,
    kind: m.kind,
    lastFetchedAt: m.lastFetchedAt,
    createdAt: m.createdAt,
  };
}

/**
 * Парсит URL и:
 * 1. Отвергает не-http(s) схемы (file://, javascript:, и т.п.).
 * 2. Извлекает userinfo (если есть), возвращает creds + clean URL.
 */
export function sanitizeOPDSUrl(raw: string): { cleanUrl: string; extractedCreds: OPDSCreds | null } {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Invalid OPDS URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`OPDS URL scheme not allowed: ${parsed.protocol}`);
  }
  let extractedCreds: OPDSCreds | null = null;
  if (parsed.username || parsed.password) {
    extractedCreds = {
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    };
    parsed.username = '';
    parsed.password = '';
  }
  return { cleanUrl: parsed.toString(), extractedCreds };
}

export class OPDSCatalogRepository {
  constructor(private db: Database) {}

  private get collection() {
    return this.db.collections.get<OPDSCatalogModel>('opds_catalogs');
  }

  async create(input: CreateCatalogInput): Promise<OPDSCatalogRecord> {
    const { cleanUrl, extractedCreds } = sanitizeOPDSUrl(input.url);
    const creds = input.creds ?? extractedCreds;
    const requiresAuth = creds !== null;

    const record = await this.db.write(async () => {
      const m = await this.collection.create((c) => {
        c.name = input.name;
        c.url = cleanUrl;
        c.requiresAuth = requiresAuth;
        c.kind = input.kind ?? 'custom';
        c.lastFetchedAt = null;
        c.createdAt = Date.now();
      });
      return toRecord(m);
    });
    // Креды пишем ПОСЛЕ создания (нам нужен id для namespace).
    if (creds) {
      await secureStorage.setOPDSCreds(record.id, creds);
    }
    return record;
  }

  async list(): Promise<OPDSCatalogRecord[]> {
    const rows = await this.collection
      .query(Q.sortBy('created_at', Q.desc))
      .fetch();
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<OPDSCatalogRecord | null> {
    try {
      const m = await this.collection.find(id);
      return toRecord(m);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.write(async () => {
      const m = await this.collection.find(id);
      await m.destroyPermanently();
    });
    // SecureStore очистка — после успешного destroy
    await secureStorage.deleteOPDSCreds(id);
  }

  async updateLastFetched(id: string, when: number = Date.now()): Promise<void> {
    return this.db.write(async () => {
      const m = await this.collection.find(id);
      await m.update((c) => {
        c.lastFetchedAt = when;
      });
    });
  }
}
