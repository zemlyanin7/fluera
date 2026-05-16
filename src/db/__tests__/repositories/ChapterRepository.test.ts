import { createTestDatabase } from '@/db/testDatabase';
import { ChapterRepository } from '@/db/repositories/ChapterRepository';

function newRepo() {
  return new ChapterRepository(createTestDatabase());
}

describe('ChapterRepository', () => {
  test('create + listByBook отсортирован по orderIndex ASC', async () => {
    const repo = newRepo();
    await repo.create({ bookId: 'b1', title: 'III', orderIndex: 2, startChar: 200, endChar: 300 });
    await repo.create({ bookId: 'b1', title: 'I', orderIndex: 0, startChar: 0, endChar: 100 });
    await repo.create({ bookId: 'b1', title: 'II', orderIndex: 1, startChar: 100, endChar: 200 });
    const chs = await repo.listByBook('b1');
    expect(chs.map((c) => c.title)).toEqual(['I', 'II', 'III']);
  });

  test('listByBook фильтрует по bookId', async () => {
    const repo = newRepo();
    await repo.create({ bookId: 'b1', orderIndex: 0, startChar: 0, endChar: 100 });
    await repo.create({ bookId: 'b2', orderIndex: 0, startChar: 0, endChar: 100 });
    expect((await repo.listByBook('b1')).length).toBe(1);
    expect((await repo.listByBook('b2')).length).toBe(1);
    expect((await repo.listByBook('b3')).length).toBe(0);
  });

  test('deleteByBook удаляет все chapters книги', async () => {
    const repo = newRepo();
    await repo.create({ bookId: 'b1', orderIndex: 0, startChar: 0, endChar: 100 });
    await repo.create({ bookId: 'b1', orderIndex: 1, startChar: 100, endChar: 200 });
    await repo.create({ bookId: 'b2', orderIndex: 0, startChar: 0, endChar: 100 });
    await repo.deleteByBook('b1');
    expect((await repo.listByBook('b1')).length).toBe(0);
    expect((await repo.listByBook('b2')).length).toBe(1);
  });
});
