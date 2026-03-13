import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { schema } from './schema'
import migrations from './migrations'
import { Book } from './models/Book'
import { Chapter } from './models/Chapter'
import { WordStatus } from './models/WordStatus'
import { WordOccurrence } from './models/WordOccurrence'
import { TranslationCacheEntry } from './models/TranslationCacheEntry'
import { OpdsCatalog } from './models/OpdsCatalog'
import { ReadingStats } from './models/ReadingStats'
import { UserSettings } from './models/UserSettings'

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true,
  onSetUpError: (error) => {
    console.error('Database setup error:', error)
  },
})

export const database = new Database({
  adapter,
  modelClasses: [
    Book,
    Chapter,
    WordStatus,
    WordOccurrence,
    TranslationCacheEntry,
    OpdsCatalog,
    ReadingStats,
    UserSettings,
  ],
})
