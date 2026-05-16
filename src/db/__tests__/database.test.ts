import { createTestDatabase } from '@/db/testDatabase';

describe('createTestDatabase', () => {
  test('возвращает Database instance с адаптером', () => {
    const db = createTestDatabase();
    expect(db).toBeDefined();
    expect(db.adapter).toBeDefined();
  });

  test('параллельные вызовы используют изолированные dbName', () => {
    const a = createTestDatabase();
    const b = createTestDatabase();
    // оба instance существуют, no collision
    expect(a).not.toBe(b);
    expect(a.adapter).not.toBe(b.adapter);
  });
});
