import React from 'react';
import { useDatabase } from '@/db/DatabaseContext';
import { ReadingStatsRepository, type ReadingStatsRecord } from '@/db/repositories/ReadingStatsRepository';

export interface UseReadingStatsOpts {
  fromDate: string; // YYYY-MM-DD
  toDate: string;
  bookId?: string | null; // undefined = all books (aggregate + per-book), null = '__all__' only
}

export interface UseReadingStatsResult {
  stats: ReadingStatsRecord[];
  isLoading: boolean;
}

export function useReadingStats(opts: UseReadingStatsOpts): UseReadingStatsResult {
  const db = useDatabase();
  const repo = React.useMemo(() => new ReadingStatsRepository(db), [db]);
  const [stats, setStats] = React.useState<ReadingStatsRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const optsKey = `${opts.fromDate}|${opts.toDate}|${opts.bookId ?? 'ALL'}`;

  React.useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void repo.listForDateRange(opts.fromDate, opts.toDate, opts.bookId).then((rows) => {
        if (!mounted) return;
        setStats(rows);
        setIsLoading(false);
      });
    };
    refresh();
    const sub = db.collections.get('reading_stats').changes.subscribe(() => refresh());
    return () => {
      mounted = false;
      sub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, repo, optsKey]);

  return { stats, isLoading };
}
