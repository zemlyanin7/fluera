import { createTestDatabase } from '@/db/testDatabase';
import { BookRepository } from '@/db/repositories/BookRepository';

function newRepo() {
  return new BookRepository(createTestDatabase());
}

describe('BookRepository', () => {
  test('create + findById', async () => {
    const repo = newRepo();
    const created = await repo.create({
      title: 'Test', author: 'A', language: 'en', format: 'epub',
      filePath: '/p', source: 'import', totalChars: 100,
    });
    expect(created.id).toBeTruthy();
    expect(created.progress).toBe(0);
    expect(created.archived).toBe(false);
    const found = await repo.findById(created.id);
    expect(found?.title).toBe('Test');
  });

  test('findById returns null если книги нет', async () => {
    const repo = newRepo();
    expect(await repo.findById('nope')).toBeNull();
  });

  test('list возвращает все books', async () => {
    const repo = newRepo();
    await repo.create({ title: 'A', language: 'en', format: 'epub', filePath: '/a', source: 'import', totalChars: 1 });
    await repo.create({ title: 'B', language: 'ru', format: 'epub', filePath: '/b', source: 'import', totalChars: 2 });
    expect((await repo.list()).length).toBe(2);
  });

  test('list filter by language', async () => {
    const repo = newRepo();
    await repo.create({ title: 'A', language: 'en', format: 'epub', filePath: '/a', source: 'import', totalChars: 1 });
    await repo.create({ title: 'B', language: 'ru', format: 'epub', filePath: '/b', source: 'import', totalChars: 2 });
    const en = await repo.list({ language: 'en' });
    expect(en.length).toBe(1);
    expect(en[0]?.title).toBe('A');
  });

  test('list filter archived', async () => {
    const repo = newRepo();
    const a = await repo.create({ title: 'A', language: 'en', format: 'epub', filePath: '/a', source: 'import', totalChars: 1 });
    await repo.create({ title: 'B', language: 'en', format: 'epub', filePath: '/b', source: 'import', totalChars: 2 });
    await repo.setArchived(a.id, true);
    const active = await repo.list({ archived: false });
    expect(active.length).toBe(1);
    expect(active[0]?.title).toBe('B');
    const archived = await repo.list({ archived: true });
    expect(archived.length).toBe(1);
    expect(archived[0]?.title).toBe('A');
  });

  test('delete — destroyPermanently без tombstone', async () => {
    const repo = newRepo();
    const b = await repo.create({
      title: 'X', language: 'en', format: 'epub', filePath: '/x', source: 'import', totalChars: 0,
    });
    await repo.delete(b.id);
    expect(await repo.findById(b.id)).toBeNull();
    expect((await repo.list()).length).toBe(0);
  });

  test('updateProgress обновляет поле и lastReadAt', async () => {
    const repo = newRepo();
    const b = await repo.create({
      title: 'X', language: 'en', format: 'epub', filePath: '/x', source: 'import', totalChars: 100,
    });
    expect(b.lastReadAt).toBeNull();
    await repo.updateProgress(b.id, 0.5);
    const updated = await repo.findById(b.id);
    expect(updated?.progress).toBe(0.5);
    expect(updated?.lastReadAt).not.toBeNull();
  });

  test('updateProgress clamp [0,1]', async () => {
    const repo = newRepo();
    const b = await repo.create({
      title: 'X', language: 'en', format: 'epub', filePath: '/x', source: 'import', totalChars: 100,
    });
    await repo.updateProgress(b.id, 5);
    expect((await repo.findById(b.id))?.progress).toBe(1);
    await repo.updateProgress(b.id, -1);
    expect((await repo.findById(b.id))?.progress).toBe(0);
  });

  test('list sortBy lastReadAt DESC по умолчанию', async () => {
    const repo = newRepo();
    const a = await repo.create({ title: 'A', language: 'en', format: 'epub', filePath: '/a', source: 'import', totalChars: 1 });
    const b = await repo.create({ title: 'B', language: 'en', format: 'epub', filePath: '/b', source: 'import', totalChars: 1 });
    await repo.updateProgress(a.id, 0.1);
    await new Promise((r) => setTimeout(r, 5)); // ensure later timestamp
    await repo.updateProgress(b.id, 0.1);
    const list = await repo.list();
    expect(list[0]?.title).toBe('B');
    expect(list[1]?.title).toBe('A');
  });
});
