import { createTestDatabase } from '@/db/testDatabase';
import { BookmarkRepository } from '@/db/repositories/BookmarkRepository';

function newRepo() {
  return new BookmarkRepository(createTestDatabase());
}

describe('BookmarkRepository', () => {
  test('create + listByBook отсортирован по createdAt DESC', async () => {
    const repo = newRepo();
    const a = await repo.create({
      bookId: 'b1', chapterOrderIndex: 0,
      positionData: { type: 'epub-cfi', value: '/1' }, note: 'first',
    });
    await new Promise((r) => setTimeout(r, 5));
    const b = await repo.create({
      bookId: 'b1', chapterOrderIndex: 1,
      positionData: { type: 'epub-cfi', value: '/2' }, note: 'second',
    });
    const list = await repo.listByBook('b1');
    expect(list[0]?.id).toBe(b.id); // последний созданный — первым
    expect(list[1]?.id).toBe(a.id);
  });

  test('listByBook фильтрует по bookId', async () => {
    const repo = newRepo();
    await repo.create({ bookId: 'b1', chapterOrderIndex: 0, positionData: { type: 'epub-cfi', value: '/1' } });
    await repo.create({ bookId: 'b2', chapterOrderIndex: 0, positionData: { type: 'epub-cfi', value: '/1' } });
    expect((await repo.listByBook('b1')).length).toBe(1);
    expect((await repo.listByBook('b2')).length).toBe(1);
    expect((await repo.listByBook('b3')).length).toBe(0);
  });

  test('note может быть null', async () => {
    const repo = newRepo();
    const bm = await repo.create({
      bookId: 'b1', chapterOrderIndex: 0,
      positionData: { type: 'fb2-item', value: '7' },
    });
    expect(bm.note).toBeNull();
  });

  test('delete удаляет конкретную закладку', async () => {
    const repo = newRepo();
    const a = await repo.create({ bookId: 'b1', chapterOrderIndex: 0, positionData: { type: 'epub-cfi', value: '/1' } });
    const b = await repo.create({ bookId: 'b1', chapterOrderIndex: 1, positionData: { type: 'epub-cfi', value: '/2' } });
    await repo.delete(a.id);
    const list = await repo.listByBook('b1');
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe(b.id);
  });

  test('deleteByBook удаляет все bookmarks книги', async () => {
    const repo = newRepo();
    await repo.create({ bookId: 'b1', chapterOrderIndex: 0, positionData: { type: 'epub-cfi', value: '/1' } });
    await repo.create({ bookId: 'b1', chapterOrderIndex: 1, positionData: { type: 'epub-cfi', value: '/2' } });
    await repo.create({ bookId: 'b2', chapterOrderIndex: 0, positionData: { type: 'epub-cfi', value: '/1' } });
    await repo.deleteByBook('b1');
    expect((await repo.listByBook('b1')).length).toBe(0);
    expect((await repo.listByBook('b2')).length).toBe(1);
  });
});
