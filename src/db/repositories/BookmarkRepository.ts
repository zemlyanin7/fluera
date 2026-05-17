import { Database, Q } from '@nozbe/watermelondb';
import { BookmarkModel } from '@/db/models';
import type { PositionData } from './ReadingPositionRepository';

export interface CreateBookmarkInput {
  bookId: string;
  chapterOrderIndex: number;
  positionData: PositionData;
  note?: string | null;
}

export interface BookmarkRecord {
  id: string;
  bookId: string;
  chapterOrderIndex: number;
  positionData: PositionData;
  note: string | null;
  createdAt: number;
}

function toRecord(m: BookmarkModel): BookmarkRecord {
  return {
    id: m.id,
    bookId: m.bookId,
    chapterOrderIndex: m.chapterOrderIndex,
    positionData: JSON.parse(m.positionData) as PositionData,
    note: m.note,
    createdAt: m.createdAt,
  };
}

export class BookmarkRepository {
  constructor(private db: Database) {}

  private get collection() {
    return this.db.collections.get<BookmarkModel>('bookmarks');
  }

  async create(input: CreateBookmarkInput): Promise<BookmarkRecord> {
    return this.db.write(async () => {
      const m = await this.collection.create((b) => {
        b.bookId = input.bookId;
        b.chapterOrderIndex = input.chapterOrderIndex;
        b.positionData = JSON.stringify(input.positionData);
        b.note = input.note ?? null;
        b.createdAt = Date.now();
      });
      return toRecord(m);
    });
  }

  async listByBook(bookId: string): Promise<BookmarkRecord[]> {
    const rows = await this.collection
      .query(Q.where('book_id', bookId), Q.sortBy('created_at', Q.desc))
      .fetch();
    return rows.map(toRecord);
  }

  async delete(id: string): Promise<void> {
    return this.db.write(async () => {
      const m = await this.collection.find(id);
      await m.destroyPermanently();
    });
  }

  async deleteByBook(bookId: string): Promise<void> {
    return this.db.write(async () => {
      const rows = await this.collection.query(Q.where('book_id', bookId)).fetch();
      for (const m of rows) {
        await m.destroyPermanently();
      }
    });
  }
}
