// Cache maintenance: time-based purge (90 дней) + hard cap 50K rows (purge
// oldest 10%). Запускается каждый cold-start (см. §4.8 спеки).
import { Database } from '@nozbe/watermelondb';
import { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';

export const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
export const CACHE_HARD_CAP = 50_000;

export interface CachePurgeResult {
  purgedExpired: number;
  purgedOverCap: number;
  totalAfter: number;
}

export async function runCachePurge(
  db: Database,
  opts: { now?: number; ttlMs?: number; hardCap?: number } = {},
): Promise<CachePurgeResult> {
  const now = opts.now ?? Date.now();
  const ttl = opts.ttlMs ?? NINETY_DAYS_MS;
  const cap = opts.hardCap ?? CACHE_HARD_CAP;

  const cache = new TranslationCacheRepository(db);
  const purgedExpired = await cache.purgeOlderThan(now - ttl);
  const totalAfterExpired = await cache.countAll();
  let purgedOverCap = 0;
  if (totalAfterExpired > cap) {
    purgedOverCap = await cache.purgeOldest10Percent();
  }
  return {
    purgedExpired,
    purgedOverCap,
    totalAfter: await cache.countAll(),
  };
}
