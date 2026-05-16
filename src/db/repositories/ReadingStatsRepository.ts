// reading_stats: id = `${date}__${bookId}` deterministic. bookId = '__all__'
// для daily aggregate (см. §4.10, §6.0). UPSERT через batch() — atomic
// find/create/update без race.
import { Database, Q } from '@nozbe/watermelondb';
import { ReadingStatsModel } from '@/db/models';
import { readingStatsId, ALL_BOOKS_SENTINEL } from '@/db/deterministicIds';

export interface ReadingStatsRecord {
  id: string;
  date: string;
  bookId: string;
  secondsReading: number;
  wordsRead: number;
  wordsTranslated: number;
  wordsAddedToDeck: number;
  wordsLearned: number;
  updatedAt: number;
}

export interface StatsDelta {
  secondsReading?: number;
  wordsRead?: number;
  wordsTranslated?: number;
  wordsAddedToDeck?: number;
  wordsLearned?: number;
}

function toRecord(m: ReadingStatsModel): ReadingStatsRecord {
  return {
    id: m.id,
    date: m.date,
    bookId: m.bookId,
    secondsReading: m.secondsReading,
    wordsRead: m.wordsRead,
    wordsTranslated: m.wordsTranslated,
    wordsAddedToDeck: m.wordsAddedToDeck,
    wordsLearned: m.wordsLearned,
    updatedAt: m.updatedAt,
  };
}

export class ReadingStatsRepository {
  constructor(private db: Database) {}

  private get collection() {
    return this.db.collections.get<ReadingStatsModel>('reading_stats');
  }

  /**
   * Idempotent UPSERT с инкрементами. Запускается через db.write() — WatermelonDB
   * сериализует writes, race невозможен.
   */
  async upsertDay(
    date: string,
    bookId: string | null,
    delta: StatsDelta,
  ): Promise<ReadingStatsRecord> {
    const id = readingStatsId(date, bookId);
    const bookIdValue = bookId ?? ALL_BOOKS_SENTINEL;
    const now = Date.now();
    return this.db.write(async () => {
      try {
        const existing = await this.collection.find(id);
        await existing.update((m) => {
          if (delta.secondsReading) m.secondsReading += delta.secondsReading;
          if (delta.wordsRead) m.wordsRead += delta.wordsRead;
          if (delta.wordsTranslated) m.wordsTranslated += delta.wordsTranslated;
          if (delta.wordsAddedToDeck) m.wordsAddedToDeck += delta.wordsAddedToDeck;
          if (delta.wordsLearned) m.wordsLearned += delta.wordsLearned;
          m.updatedAt = now;
        });
        return toRecord(existing);
      } catch {
        const created = await this.collection.create((m) => {
          m._raw.id = id;
          m.date = date;
          m.bookId = bookIdValue;
          m.secondsReading = delta.secondsReading ?? 0;
          m.wordsRead = delta.wordsRead ?? 0;
          m.wordsTranslated = delta.wordsTranslated ?? 0;
          m.wordsAddedToDeck = delta.wordsAddedToDeck ?? 0;
          m.wordsLearned = delta.wordsLearned ?? 0;
          m.updatedAt = now;
        });
        return toRecord(created);
      }
    });
  }

  async getDay(date: string, bookId: string | null): Promise<ReadingStatsRecord | null> {
    const id = readingStatsId(date, bookId);
    try {
      const m = await this.collection.find(id);
      return toRecord(m);
    } catch {
      return null;
    }
  }

  async listForDateRange(
    fromDate: string,
    toDate: string,
    bookId?: string | null,
  ): Promise<ReadingStatsRecord[]> {
     
    const clauses: any[] = [
      Q.where('date', Q.gte(fromDate)),
      Q.where('date', Q.lte(toDate)),
    ];
    if (bookId !== undefined) {
      clauses.push(Q.where('book_id', bookId ?? ALL_BOOKS_SENTINEL));
    }
    clauses.push(Q.sortBy('date', Q.asc));
    const rows = await this.collection.query(...clauses).fetch();
    return rows.map(toRecord);
  }

  /** Удалить ВСЕ stats (для Clear-history / Reset). */
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
