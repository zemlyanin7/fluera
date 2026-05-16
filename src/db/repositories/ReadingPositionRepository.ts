// reading_positions: 1:1 с book. ID = bookId (см. §6.0). Upsert идемпотентный
// через find(id) → update / not found → create. WatermelonDB сериализует
// db.write() — race невозможен внутри одного процесса.
import { Database } from '@nozbe/watermelondb';
import { ReadingPositionModel } from '@/db/models';
import { readingPositionId } from '@/db/deterministicIds';

export interface PositionData {
  type: 'epub-cfi' | 'fb2-item';
  value: string;
}

export interface ReadingPositionRecord {
  id: string;
  bookId: string;
  chapterOrderIndex: number;
  positionData: PositionData;
  updatedAt: number;
}

export interface UpsertPositionInput {
  bookId: string;
  chapterOrderIndex: number;
  positionData: PositionData;
}

function toRecord(m: ReadingPositionModel): ReadingPositionRecord {
  return {
    id: m.id,
    bookId: m.bookId,
    chapterOrderIndex: m.chapterOrderIndex,
    positionData: JSON.parse(m.positionData) as PositionData,
    updatedAt: m.updatedAt,
  };
}

export class ReadingPositionRepository {
  constructor(private db: Database) {}

  private get collection() {
    return this.db.collections.get<ReadingPositionModel>('reading_positions');
  }

  async upsert(input: UpsertPositionInput): Promise<ReadingPositionRecord> {
    const id = readingPositionId(input.bookId);
    const now = Date.now();
    return this.db.write(async () => {
      try {
        const existing = await this.collection.find(id);
        await existing.update((m) => {
          m.chapterOrderIndex = input.chapterOrderIndex;
          m.positionData = JSON.stringify(input.positionData);
          m.updatedAt = now;
        });
        return toRecord(existing);
      } catch {
        const created = await this.collection.create((m) => {
          m._raw.id = id;
          m.bookId = input.bookId;
          m.chapterOrderIndex = input.chapterOrderIndex;
          m.positionData = JSON.stringify(input.positionData);
          m.updatedAt = now;
        });
        return toRecord(created);
      }
    });
  }

  async findByBook(bookId: string): Promise<ReadingPositionRecord | null> {
    try {
      const m = await this.collection.find(readingPositionId(bookId));
      return toRecord(m);
    } catch {
      return null;
    }
  }

  async deleteByBook(bookId: string): Promise<void> {
    return this.db.write(async () => {
      try {
        const m = await this.collection.find(readingPositionId(bookId));
        await m.destroyPermanently();
      } catch {
        // not found — ok
      }
    });
  }
}
