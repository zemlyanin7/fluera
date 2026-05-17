import { Database, Q } from '@nozbe/watermelondb';
import { TranslationFeedbackModel } from '@/db/models';

export interface TranslationFeedbackInput {
  sourceSentence: string;
  translatedSentence: string;
  bookLanguage: string;
  nativeLanguage: string;
  modelVersion: string;
  kernelBuildId: string | null;
  bookId: string | null;
  createdAt: number;
}

export interface TranslationFeedbackRecord {
  id: string;
  sourceSentence: string;
  translatedSentence: string;
  bookLanguage: string;
  nativeLanguage: string;
  modelVersion: string;
  kernelBuildId: string | null;
  bookId: string | null;
  createdAt: number;
}

function toRecord(m: TranslationFeedbackModel): TranslationFeedbackRecord {
  return {
    id: m.id,
    sourceSentence: m.sourceSentence,
    translatedSentence: m.translatedSentence,
    bookLanguage: m.bookLanguage,
    nativeLanguage: m.nativeLanguage,
    modelVersion: m.modelVersion,
    kernelBuildId: m.kernelBuildId,
    bookId: m.bookId,
    createdAt: m.createdAt,
  };
}

export class TranslationFeedbackRepository {
  constructor(private db: Database) {}

  private get collection() {
    return this.db.collections.get<TranslationFeedbackModel>('translation_feedback');
  }

  async insert(input: TranslationFeedbackInput): Promise<string> {
    return this.db.write(async () => {
      const m = await this.collection.create((r) => {
        r.sourceSentence = input.sourceSentence;
        r.translatedSentence = input.translatedSentence;
        r.bookLanguage = input.bookLanguage;
        r.nativeLanguage = input.nativeLanguage;
        r.modelVersion = input.modelVersion;
        r.kernelBuildId = input.kernelBuildId;
        r.bookId = input.bookId;
        r.createdAt = input.createdAt;
      });
      return m.id;
    });
  }

  async listRecent(limit: number): Promise<TranslationFeedbackRecord[]> {
    const rows = await this.collection
      .query(Q.sortBy('created_at', Q.desc), Q.take(limit))
      .fetch();
    return rows.map(toRecord);
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
