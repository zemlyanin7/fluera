// Schema v4 — prefetch source/ttl_days/chrf_score on translation_cache
// (#4.6 Translation Prefetch + Lifecycle).
import { SCHEMA_VERSION, schema } from '@/db/schema';

describe('schema v4 — translation_cache prefetch columns', () => {
  it('SCHEMA_VERSION is 4', () => {
    expect(SCHEMA_VERSION).toBe(4);
  });

  it('translation_cache has source column', () => {
    const tc = schema.tables.translation_cache!;
    expect(tc.columns.source).toEqual(
      expect.objectContaining({ name: 'source', type: 'string' }),
    );
  });

  it('translation_cache has ttl_days column', () => {
    const tc = schema.tables.translation_cache!;
    expect(tc.columns.ttl_days).toEqual(
      expect.objectContaining({ name: 'ttl_days', type: 'number' }),
    );
  });

  it('translation_cache has chrf_score optional column', () => {
    const tc = schema.tables.translation_cache!;
    expect(tc.columns.chrf_score).toEqual(
      expect.objectContaining({ name: 'chrf_score', type: 'number', isOptional: true }),
    );
  });

  it('translation_cache retains inference_context column (no duplicate)', () => {
    const tc = schema.tables.translation_cache!;
    expect(tc.columns.inference_context).toEqual(
      expect.objectContaining({ name: 'inference_context', type: 'string' }),
    );
  });
});
