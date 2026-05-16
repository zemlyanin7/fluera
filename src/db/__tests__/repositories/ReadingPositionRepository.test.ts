import { createTestDatabase } from '@/db/testDatabase';
import { ReadingPositionRepository } from '@/db/repositories/ReadingPositionRepository';

function newRepo() {
  return new ReadingPositionRepository(createTestDatabase());
}

describe('ReadingPositionRepository', () => {
  test('upsert: create then update, id == bookId', async () => {
    const repo = newRepo();
    const a = await repo.upsert({
      bookId: 'book-1',
      chapterOrderIndex: 0,
      positionData: { type: 'epub-cfi', value: '/6/4[chap01]!/4/1:0' },
    });
    expect(a.id).toBe('book-1');
    expect(a.chapterOrderIndex).toBe(0);

    const b = await repo.upsert({
      bookId: 'book-1',
      chapterOrderIndex: 5,
      positionData: { type: 'epub-cfi', value: '/6/4[chap06]!/4/1:100' },
    });
    expect(b.id).toBe('book-1'); // тот же ID — upsert идемпотентный
    expect(b.chapterOrderIndex).toBe(5);
    expect(b.positionData.value).toContain('chap06');
  });

  test('findByBook returns null если позиции нет', async () => {
    const repo = newRepo();
    expect(await repo.findByBook('nope')).toBeNull();
  });

  test('findByBook возвращает записанную позицию', async () => {
    const repo = newRepo();
    await repo.upsert({
      bookId: 'book-x',
      chapterOrderIndex: 3,
      positionData: { type: 'fb2-item', value: '42' },
    });
    const found = await repo.findByBook('book-x');
    expect(found?.chapterOrderIndex).toBe(3);
    expect(found?.positionData).toEqual({ type: 'fb2-item', value: '42' });
  });

  test('deleteByBook удаляет позицию', async () => {
    const repo = newRepo();
    await repo.upsert({
      bookId: 'book-z',
      chapterOrderIndex: 0,
      positionData: { type: 'epub-cfi', value: '/1' },
    });
    await repo.deleteByBook('book-z');
    expect(await repo.findByBook('book-z')).toBeNull();
  });

  test('deleteByBook на отсутствующей книге не падает', async () => {
    const repo = newRepo();
    await expect(repo.deleteByBook('never-existed')).resolves.toBeUndefined();
  });
});
