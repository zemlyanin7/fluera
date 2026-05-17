import { migrations } from '@/db/migrations';
import { SCHEMA_VERSION } from '@/db/schema';

describe('migrations', () => {
  test('migrations объект из schemaMigrations()', () => {
    expect(migrations).toBeDefined();
    expect(migrations.validated).toBe(true);
  });

  test('v1 — initial schema, миграций нет', () => {
    expect(migrations.sortedMigrations).toEqual([]);
  });

  test('minVersion/maxVersion соответствуют SCHEMA_VERSION', () => {
    expect(migrations.minVersion).toBe(SCHEMA_VERSION);
    expect(migrations.maxVersion).toBe(SCHEMA_VERSION);
  });
});
