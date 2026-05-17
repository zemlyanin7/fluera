import { migrations } from '@/db/migrations';
import { SCHEMA_VERSION } from '@/db/schema';

// WatermelonDB migration step shapes (из исходников migrations/index.js):
//   createTable → { type: 'create_table', schema: { name, columns, ... } }
//   addColumns  → { type: 'add_columns', table: string, columns: col[] }
type CreateTableStep = { type: 'create_table'; schema: { name: string } };
type AddColumnsStep = { type: 'add_columns'; table: string; columns: Array<{ name: string }> };
type MigrationStep = CreateTableStep | AddColumnsStep | { type: string };

describe('migrations', () => {
  test('migrations объект из schemaMigrations()', () => {
    expect(migrations).toBeDefined();
    expect(migrations.validated).toBe(true);
  });

  test('содержит migration step toVersion: 2', () => {
    const v2 = migrations.sortedMigrations.find((m) => m.toVersion === 2);
    expect(v2).toBeDefined();
    expect(v2!.steps.length).toBeGreaterThan(0);
  });

  test('migration v2 содержит createTable mwe_phrases', () => {
    const v2 = migrations.sortedMigrations.find((m) => m.toVersion === 2)!;
    const hasTable = (v2.steps as MigrationStep[]).some(
      (s) => s.type === 'create_table' && (s as CreateTableStep).schema?.name === 'mwe_phrases',
    );
    expect(hasTable).toBe(true);
  });

  test('migration v2 содержит createTable false_friends', () => {
    const v2 = migrations.sortedMigrations.find((m) => m.toVersion === 2)!;
    const hasTable = (v2.steps as MigrationStep[]).some(
      (s) => s.type === 'create_table' && (s as CreateTableStep).schema?.name === 'false_friends',
    );
    expect(hasTable).toBe(true);
  });

  test('migration v2 содержит createTable translation_feedback', () => {
    const v2 = migrations.sortedMigrations.find((m) => m.toVersion === 2)!;
    const hasTable = (v2.steps as MigrationStep[]).some(
      (s) => s.type === 'create_table' && (s as CreateTableStep).schema?.name === 'translation_feedback',
    );
    expect(hasTable).toBe(true);
  });

  test('migration v2 содержит addColumns для translation_cache', () => {
    const v2 = migrations.sortedMigrations.find((m) => m.toVersion === 2)!;
    const addCols = (v2.steps as MigrationStep[]).find(
      (s) => s.type === 'add_columns' && (s as AddColumnsStep).table === 'translation_cache',
    ) as AddColumnsStep | undefined;
    expect(addCols).toBeDefined();
    const colNames = addCols!.columns.map((c) => c.name);
    expect(colNames).toContain('sentence_translation');
    expect(colNames).toContain('translated_word_offset');
    expect(colNames).toContain('inference_context');
    expect(colNames).toContain('model_version');
    expect(colNames).toContain('kernel_build_id');
  });

  test('maxVersion соответствует SCHEMA_VERSION', () => {
    expect(migrations.maxVersion).toBe(SCHEMA_VERSION);
  });
});

describe('migration v2→v3', () => {
  it('содержит migration step toVersion: 3', () => {
    const v3 = migrations.sortedMigrations.find((m: any) => m.toVersion === 3);
    expect(v3).toBeDefined();
    expect(v3!.steps.length).toBeGreaterThan(0);
  });
});
