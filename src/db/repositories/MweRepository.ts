import { Database, Q } from '@nozbe/watermelondb';
import { MwePhraseModel } from '@/db/models';

export interface MwePhraseInput {
  sourceLang: string;
  targetLang: string;
  phrase: string;
  translationEquivalent: string;
  literalGloss: string | null;
  mweType: string | null;
  gapPattern: string | null;
  domain: string;
  attribution: string | null;
}

export interface MwePhraseRecord {
  id: string;
  sourceLang: string;
  targetLang: string;
  phrase: string;
  translationEquivalent: string;
  literalGloss: string | null;
  mweType: string | null;
  gapPattern: string | null;
  domain: string;
  attribution: string | null;
}

function toRecord(m: MwePhraseModel): MwePhraseRecord {
  return {
    id: m.id,
    sourceLang: m.sourceLang,
    targetLang: m.targetLang,
    phrase: m.phrase,
    translationEquivalent: m.translationEquivalent,
    literalGloss: m.literalGloss,
    mweType: m.mweType,
    gapPattern: m.gapPattern,
    domain: m.domain,
    attribution: m.attribution,
  };
}

export class MweRepository {
  constructor(private db: Database) {}

  private get collection() {
    return this.db.collections.get<MwePhraseModel>('mwe_phrases');
  }

  async bulkInsert(rows: MwePhraseInput[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.write(async () => {
      const prepared = rows.map((r) =>
        this.collection.prepareCreate((m) => {
          m.sourceLang = r.sourceLang;
          m.targetLang = r.targetLang;
          m.phrase = r.phrase;
          m.translationEquivalent = r.translationEquivalent;
          m.literalGloss = r.literalGloss;
          m.mweType = r.mweType;
          m.gapPattern = r.gapPattern;
          m.domain = r.domain;
          m.attribution = r.attribution;
        }),
      );
      await this.db.batch(...prepared);
    });
  }

  async findForPair(srcLang: string, dstLang: string): Promise<MwePhraseRecord[]> {
    const rows = await this.collection
      .query(Q.where('source_lang', srcLang), Q.where('target_lang', dstLang))
      .fetch();
    return rows.map(toRecord);
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
