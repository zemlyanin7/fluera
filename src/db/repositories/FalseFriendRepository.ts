import { Database, Q } from '@nozbe/watermelondb';
import { FalseFriendModel, type FalseFriendConfidence } from '@/db/models';

export interface FalseFriendInput {
  sourceLang: string;
  targetLang: string;
  sourceWord: string;
  looksLikeNative: string;
  actualMeaning: string;
  confidence: FalseFriendConfidence;
  domain: string;
}

export interface FalseFriendRecord {
  id: string;
  sourceLang: string;
  targetLang: string;
  sourceWord: string;
  looksLikeNative: string;
  actualMeaning: string;
  confidence: FalseFriendConfidence;
  domain: string;
}

function toRecord(m: FalseFriendModel): FalseFriendRecord {
  return {
    id: m.id,
    sourceLang: m.sourceLang,
    targetLang: m.targetLang,
    sourceWord: m.sourceWord,
    looksLikeNative: m.looksLikeNative,
    actualMeaning: m.actualMeaning,
    confidence: m.confidence,
    domain: m.domain,
  };
}

export class FalseFriendRepository {
  constructor(private db: Database) {}

  private get collection() {
    return this.db.collections.get<FalseFriendModel>('false_friends');
  }

  async bulkInsert(rows: FalseFriendInput[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.write(async () => {
      const prepared = rows.map((r) =>
        this.collection.prepareCreate((m) => {
          m.sourceLang = r.sourceLang;
          m.targetLang = r.targetLang;
          m.sourceWord = r.sourceWord;
          m.looksLikeNative = r.looksLikeNative;
          m.actualMeaning = r.actualMeaning;
          m.confidence = r.confidence;
          m.domain = r.domain;
        }),
      );
      await this.db.batch(...prepared);
    });
  }

  /**
   * Case-insensitive lookup по sourceWord для пары языков.
   * Возвращает первый матч или null.
   */
  async lookupByWord(
    srcLang: string,
    dstLang: string,
    word: string,
  ): Promise<FalseFriendRecord | null> {
    const normalized = word.toLowerCase();
    const rows = await this.collection
      .query(
        Q.where('source_lang', srcLang),
        Q.where('target_lang', dstLang),
        Q.where('source_word', normalized),
      )
      .fetch();
    if (rows.length > 0) return toRecord(rows[0]!);
    return null;
  }

  async deleteForPair(srcLang: string, dstLang: string): Promise<void> {
    await this.db.write(async () => {
      const rows = await this.collection
        .query(Q.where('source_lang', srcLang), Q.where('target_lang', dstLang))
        .fetch();
      for (const m of rows) {
        await m.destroyPermanently();
      }
    });
  }
}
