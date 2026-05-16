import React from 'react';
import { useDatabase } from '@/db/DatabaseContext';
import { OPDSCatalogRepository, type OPDSCatalogRecord } from '@/db/repositories/OPDSCatalogRepository';

export interface UseOPDSCatalogsResult {
  catalogs: OPDSCatalogRecord[];
  isLoading: boolean;
}

export function useOPDSCatalogs(): UseOPDSCatalogsResult {
  const db = useDatabase();
  const repo = React.useMemo(() => new OPDSCatalogRepository(db), [db]);
  const [catalogs, setCatalogs] = React.useState<OPDSCatalogRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void repo.list().then((rows) => {
        if (!mounted) return;
        setCatalogs(rows);
        setIsLoading(false);
      });
    };
    refresh();
    const sub = db.collections.get('opds_catalogs').changes.subscribe(() => refresh());
    return () => {
      mounted = false;
      sub.unsubscribe();
    };
  }, [db, repo]);

  return { catalogs, isLoading };
}
