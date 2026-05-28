// Migration 0004 — prefetch source/ttl_days/chrf_score on translation_cache
// (#4.6 Translation Prefetch + Lifecycle).
import { migration0004 } from '@/db/migrations/0004-prefetch-source-ttl';

describe('migration 0004 — prefetch source/ttl_days/chrf_score', () => {
  it('targets schema version 4', () => {
    expect(migration0004.toVersion).toBe(4);
  });

  it('adds source/ttl_days/chrf_score to translation_cache', () => {
    const step = migration0004.steps[0] as any;
    expect(step.type).toBe('add_columns');
    expect(step.table).toBe('translation_cache');
    const names = step.columns.map((c: any) => c.name);
    expect(names).toEqual(expect.arrayContaining(['source', 'ttl_days', 'chrf_score']));
  });

  it('marks source column as indexed', () => {
    const step = migration0004.steps[0] as any;
    const sourceCol = step.columns.find((c: any) => c.name === 'source');
    expect(sourceCol.isIndexed).toBe(true);
  });
});
