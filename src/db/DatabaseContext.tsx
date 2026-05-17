// DatabaseProvider — React Context для inj Database в hooks/components.
// Решает singleton race: module-level singleton инициализируется ДО dbReady,
// а Context гарантирует что children rendering происходит только после
// успешного createDatabase() (см. §6.1.1 спеки).
import React from 'react';
import { Database } from '@nozbe/watermelondb';
import { createDatabase } from './database';

const DatabaseContext = React.createContext<Database | null>(null);

export interface DatabaseProviderProps {
  children: React.ReactNode;
  /** Для тестов: пробросить готовый test database, минуя createDatabase(). */
  initialDatabase?: Database;
  /** Что показывать пока БД не готова. По дефолту — null (для splash сценария). */
  fallback?: React.ReactNode;
  /** Callback после успешной инициализации БД. Используется для splash hide. */
  onReady?: (db: Database) => void;
}

export function DatabaseProvider({
  children,
  initialDatabase,
  fallback = null,
  onReady,
}: DatabaseProviderProps) {
  const [db, setDb] = React.useState<Database | null>(initialDatabase ?? null);

  React.useEffect(() => {
    if (initialDatabase) {
      onReady?.(initialDatabase);
      return;
    }
    let mounted = true;
    void createDatabase().then((created) => {
      if (mounted) {
        setDb(created);
        onReady?.(created);
      }
    });
    return () => {
      mounted = false;
    };
  }, [initialDatabase, onReady]);

  if (!db) return <>{fallback}</>;
  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): Database {
  const db = React.useContext(DatabaseContext);
  if (!db) {
    throw new Error('useDatabase must be used inside DatabaseProvider');
  }
  return db;
}
