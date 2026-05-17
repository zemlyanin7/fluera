// TranslationCache: id = cache_key (deterministic FNV-1a из computeCacheKey).
// Idempotent upsert. Time-based purge 90 дней + hard cap 50K rows (см. §4.8).
import { Database, Q } from '@nozbe/watermelondb';
import { TranslationCacheModel } from '@/db/models';

export interface TranslationCacheRecord {
  id: string;
  cacheKey: string;
  word: string;
  contextWindow: string;
  bookLanguage: string;
  nativeLanguage: string;
  translation: string;
  grammar: string | null;
  createdAt: number;
  sentenceTranslation: string | null;
  translatedWordOffset: number | null;
  inferenceContext: string;
  modelVersion: string;
  kernelBuildId: string | null;
}

export interface UpsertCacheInput {
  cacheKey: string;
  word: string;
  contextWindow: string;
  bookLanguage: string;
  nativeLanguage: string;
  translation: string;
  grammar?: string | null;
  createdAt?: number;
  sentenceTranslation?: string | null;
  translatedWordOffset?: number | null;
  inferenceContext?: string;
  modelVersion?: string;
  kernelBuildId?: string | null;
}

export interface UpsertSentenceCacheInput {
  cacheKey: string;
  bookLanguage: string;
  nativeLanguage: string;
  sentenceTranslation: string;
  translatedWordOffset?: number | null;
  inferenceContext?: string;
  modelVersion?: string;
  kernelBuildId?: string | null;
  createdAt?: number;
}

function toRecord(m: TranslationCacheModel): TranslationCacheRecord {
  return {
    id: m.id,
    cacheKey: m.cacheKey,
    word: m.word,
    contextWindow: m.contextWindow,
    bookLanguage: m.bookLanguage,
    nativeLanguage: m.nativeLanguage,
    translation: m.translation,
    grammar: m.grammar,
    createdAt: m.createdAt,
    sentenceTranslation: m.sentenceTranslation ?? null,
    translatedWordOffset: m.translatedWordOffset ?? null,
    inferenceContext: m.inferenceContext ?? 'warm',
    modelVersion: m.modelVersion ?? '',
    kernelBuildId: m.kernelBuildId ?? null,
  };
}

export class TranslationCacheRepository {
  constructor(private db: Database) {}

  private get collection() {
    return this.db.collections.get<TranslationCacheModel>('translation_cache');
  }

  async findByKey(cacheKey: string): Promise<TranslationCacheRecord | null> {
    // id == cache_key (deterministic), используем find для O(1) lookup
    try {
      const m = await this.collection.find(cacheKey);
      return toRecord(m);
    } catch {
      return null;
    }
  }

  async upsertByKey(input: UpsertCacheInput): Promise<TranslationCacheRecord> {
    const now = input.createdAt ?? Date.now();
    return this.db.write(async () => {
      try {
        const existing = await this.collection.find(input.cacheKey);
        await existing.update((m) => {
          m.translation = input.translation;
          m.grammar = input.grammar ?? null;
          m.createdAt = now; // refresh TTL on re-write
          if (input.sentenceTranslation !== undefined) m.sentenceTranslation = input.sentenceTranslation ?? null;
          if (input.translatedWordOffset !== undefined) m.translatedWordOffset = input.translatedWordOffset ?? null;
          if (input.inferenceContext !== undefined) m.inferenceContext = input.inferenceContext;
          if (input.modelVersion !== undefined) m.modelVersion = input.modelVersion;
          if (input.kernelBuildId !== undefined) m.kernelBuildId = input.kernelBuildId ?? null;
        });
        return toRecord(existing);
      } catch {
        const created = await this.collection.create((m) => {
          m._raw.id = input.cacheKey;
          m.cacheKey = input.cacheKey;
          m.word = input.word;
          m.contextWindow = input.contextWindow;
          m.bookLanguage = input.bookLanguage;
          m.nativeLanguage = input.nativeLanguage;
          m.translation = input.translation;
          m.grammar = input.grammar ?? null;
          m.createdAt = now;
          m.sentenceTranslation = input.sentenceTranslation ?? null;
          m.translatedWordOffset = input.translatedWordOffset ?? null;
          m.inferenceContext = input.inferenceContext ?? 'warm';
          m.modelVersion = input.modelVersion ?? '';
          m.kernelBuildId = input.kernelBuildId ?? null;
        });
        return toRecord(created);
      }
    });
  }

  /** Поиск sentence-level перевода по ключу. */
  async findSentenceByKey(key: string): Promise<TranslationCacheRecord | null> {
    try {
      const m = await this.collection.find(key);
      if (m.sentenceTranslation == null) return null;
      return toRecord(m);
    } catch {
      return null;
    }
  }

  /** Upsert sentence-level перевода. */
  async upsertSentenceByKey(input: UpsertSentenceCacheInput): Promise<TranslationCacheRecord> {
    const now = input.createdAt ?? Date.now();
    return this.db.write(async () => {
      try {
        const existing = await this.collection.find(input.cacheKey);
        await existing.update((m) => {
          m.sentenceTranslation = input.sentenceTranslation;
          m.translatedWordOffset = input.translatedWordOffset ?? null;
          m.createdAt = now;
          if (input.inferenceContext !== undefined) m.inferenceContext = input.inferenceContext;
          if (input.modelVersion !== undefined) m.modelVersion = input.modelVersion;
          if (input.kernelBuildId !== undefined) m.kernelBuildId = input.kernelBuildId ?? null;
        });
        return toRecord(existing);
      } catch {
        const created = await this.collection.create((m) => {
          m._raw.id = input.cacheKey;
          m.cacheKey = input.cacheKey;
          // sentence cache rows have no word/contextWindow — use sentinel values
          m.word = '';
          m.contextWindow = '';
          m.bookLanguage = input.bookLanguage;
          m.nativeLanguage = input.nativeLanguage;
          m.translation = '';
          m.grammar = null;
          m.createdAt = now;
          m.sentenceTranslation = input.sentenceTranslation;
          m.translatedWordOffset = input.translatedWordOffset ?? null;
          m.inferenceContext = input.inferenceContext ?? 'warm';
          m.modelVersion = input.modelVersion ?? '';
          m.kernelBuildId = input.kernelBuildId ?? null;
        });
        return toRecord(created);
      }
    });
  }

  async purgeOlderThan(cutoffMs: number): Promise<number> {
    return this.db.write(async () => {
      const rows = await this.collection
        .query(Q.where('created_at', Q.lt(cutoffMs)))
        .fetch();
      for (const m of rows) {
        await m.destroyPermanently();
      }
      return rows.length;
    });
  }

  async countAll(): Promise<number> {
    return this.collection.query().fetchCount();
  }

  async purgeOldest10Percent(): Promise<number> {
    const total = await this.countAll();
    const toPurge = Math.floor(total * 0.1);
    if (toPurge === 0) return 0;
    return this.db.write(async () => {
      const oldest = await this.collection
        .query(Q.sortBy('created_at', Q.asc), Q.take(toPurge))
        .fetch();
      for (const m of oldest) {
        await m.destroyPermanently();
      }
      return oldest.length;
    });
  }

  async clearAll(): Promise<number> {
    return this.db.write(async () => {
      const rows = await this.collection.query().fetch();
      for (const m of rows) {
        await m.destroyPermanently();
      }
      return rows.length;
    });
  }
}
