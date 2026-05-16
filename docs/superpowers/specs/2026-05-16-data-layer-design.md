# Fluera Sub-project #2: Data layer — Design Spec

**Дата:** 2026-05-16
**Статус:** ready-for-review
**Зависимости:** Foundation (#1) — выполнен
**Блокирует:** #3 Reader engine, #4 Translation, #5 Library, #6 Deck, #7 Stats, #8 Onboarding/Settings polish

---

## 1. Scope

Создаём persistent data layer приложения Fluera: WatermelonDB SQLite-схема,
модели, миграции, repository-слой и React-хуки. Плюс persist для Zustand
SettingsStore через AsyncStorage. Плюс SecureStore для OPDS-кредов.

В скоупе:
- WatermelonDB setup + 10 таблиц + индексы + миграции
- Models (классы Model для каждой таблицы)
- Repository-слой (CRUD, query helpers)
- React-хуки (`useBookList`, `useWordStatus`, ...) — НЕ компоненты UI
- Zustand persist middleware на SettingsStore
- AsyncStorage и SecureStore wrappers
- Backup exclusion config (iOS `NSURLIsExcludedFromBackupKey`,
  Android `<full-backup-content>`)
- Seed/fixture для разработки (Borges sample как WatermelonDB record)

НЕ в скоупе (другие sub-projects):
- EPUB/FB2 парсеры → #3
- LLM-инференс → #4
- OPDS-клиент (HTTP, XML-парсинг) → #5 (используем `OPDSCatalog` таблицу
  определённую здесь, но клиент пишется там)
- SRS-алгоритм (вычисления FSRS) → #6 (используем `WordStatus`+`ReviewLog`
  поля определённые здесь, но алгоритм пишется там)
- UI экранов (Library/Deck/Stats/Reader/Settings) → соответствующие
  sub-projects

---

## 2. Stack

- **Pacakge:** `@nozbe/watermelondb@^0.27` (актуальный stable, RN 0.81 compatible)
- **Декораторы:** `@babel/plugin-proposal-decorators` уже установлен в Foundation
- **Адаптер:** `@nozbe/watermelondb/adapters/sqlite` (native SQLite через JSI)
- **Async storage:** `@react-native-async-storage/async-storage@^2.0`
- **Secure storage:** `expo-secure-store@^14.0`
- **Дополнительно:** `react-native-get-random-values` (для crypto.randomUUID
  shim), `expo-crypto` (для SHA-256 deterministic ID в word_statuses — §6.0;
  cache key TranslationCache использует FNV-1a sync — см. §6.5).

---

## 3. Структура файлов

```
src/db/
  index.ts              # экспорт singleton Database instance + helpers
  database.ts           # createDatabase() — конфигурация и адаптер
  schema.ts             # appSchema() — все таблицы в одном месте
  migrations.ts         # addMigrations() — incremental migrations
  models/
    Book.ts             # @model('books')
    Chapter.ts          # @model('chapters')
    ReadingPosition.ts  # @model('reading_positions')
    Bookmark.ts         # @model('bookmarks')
    WordStatus.ts       # @model('word_statuses')
    WordOccurrence.ts   # @model('word_occurrences')
    ReviewLog.ts        # @model('review_logs')
    TranslationCache.ts # @model('translation_cache')
    OPDSCatalog.ts      # @model('opds_catalogs')
    ReadingStats.ts     # @model('reading_stats')
    index.ts            # barrel
  repositories/
    BookRepository.ts
    ChapterRepository.ts
    ReadingPositionRepository.ts
    BookmarkRepository.ts
    WordRepository.ts          # WordStatus + WordOccurrence + ReviewLog
    TranslationCacheRepository.ts
    OPDSCatalogRepository.ts
    ReadingStatsRepository.ts
    index.ts                   # barrel
  __tests__/
    schema.test.ts
    migrations.test.ts
    repositories/<each>.test.ts

src/hooks/data/
  useBookList.ts
  useBookProgress.ts
  useReadingPosition.ts
  useBookmarks.ts
  useWordStatus.ts
  useDeckQueue.ts             # FSRS-6 due-cards query
  useTranslation.ts           # cache lookup + signal to TranslationService (#4)
  useOPDSCatalogs.ts
  useReadingStats.ts
  index.ts

src/storage/
  asyncStorage.ts             # тонкий wrapper над AsyncStorage с error handling
  secureStorage.ts            # wrapper над expo-secure-store с key naming

src/services/translation/
  ITranslationService.ts      # interface + TranslationInput/Result types
  NoOpTranslationService.ts   # stub impl, всегда возвращает { status: 'pending' }
  cacheKey.ts                 # computeCacheKey() — FNV-1a sync hash
```

Также:
- `src/stores/settingsStore.ts` — добавляем `persist` middleware
- `src/theme/unistyles.ts` — обновляем чтение initial theme (async-aware)
- `app.json` — iOS `infoPlist.NSURLIsExcludedFromBackupKey` через config plugin,
  Android `androidManifest.application.android:allowBackup=false` или
  custom `<full-backup-content>`
- `index.js` — initialization order: theme → DB → expo-router/entry

---

## 4. Schema (WatermelonDB)

`SCHEMA_VERSION = 1` в `src/db/schema.ts`. Все колонки следуют WatermelonDB
конвенции `snake_case`. ID — детерминированные строки для таблиц с natural key
(см. §6.0 Deterministic ID strategy); для остальных — WatermelonDB auto-id.

### 4.1 `books`

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | WatermelonDB auto |
| `title` | string | required |
| `author` | string | nullable |
| `language` | string | BookLanguage code (ISO 639-1) |
| `format` | string | `epub` / `fb2` |
| `file_path` | string | absolute path в `FileSystem.documentDirectory` |
| `cover_path` | string | nullable, absolute path |
| `source` | string | `import` / `opds` / `url` |
| `opds_catalog_id` | string | nullable, FK → opds_catalogs.id |
| `total_chars` | number | character count для точного прогресса |
| `progress` | number | 0.0..1.0 (last computed) |
| `difficulty` | number | nullable, 0.0..1.0 (% unknown words) |
| `difficulty_computed_at` | number | nullable, timestamp |
| `added_at` | number | timestamp |
| `last_read_at` | number | nullable, timestamp |
| `archived` | boolean | default false (для скрытия из библиотеки) |

**Indexes:** `(last_read_at)` (сортировка по последнему чтению), `(language)`
(фильтрация по языку в библиотеке — фильтр `language` применяем в query, не в индексе),
`(archived)` (archived view). WatermelonDB не поддерживает DESC в индексах —
сортировка DESC реализуется через `sortBy` в query.

### 4.2 `chapters`

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `book_id` | string (FK) | → books.id |
| `title` | string | nullable (chapters без title возможны) |
| `order_index` | number | 0-based порядок в книге |
| `start_char` | number | offset в total_chars книги (для progress %) |
| `end_char` | number | exclusive end (start_char следующего chapter) |

Не храним `parsed_content` — re-parse on-demand, LRU в памяти max 2 chapters
с суммарным cap 8MB по bytes parsed-content (см. §7 Performance). Evict по
размеру, не по количеству. Парсер живёт в #3 ChapterCache сервисе.

**Indexes:** `(book_id, order_index)` (chapter list per book).

### 4.3 `reading_positions`

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `book_id` | string (FK, UNIQUE) | → books.id, одна позиция на книгу |
| `chapter_order_index` | number | для быстрого jump к chapter |
| `position_data` | string | JSON: `{type:'epub-cfi'\|'fb2-item', value:string}` |
| `updated_at` | number | timestamp |

**Indexes:** `(book_id)` UNIQUE.

### 4.4 `bookmarks`

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `book_id` | string (FK) | → books.id |
| `chapter_order_index` | number | |
| `position_data` | string | JSON: тот же тип что в reading_positions |
| `note` | string | nullable |
| `created_at` | number | timestamp |

**Indexes:** `(book_id, created_at DESC)` (закладки одной книги).

### 4.5 `word_statuses` (FSRS-6)

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `word` | string | lowercase, NFC-normalized |
| `book_language` | string | BookLanguage |
| `native_language` | string | NativeLanguage |
| `status` | number | 1=new, 2=recognized, 3=familiar, 4=learned, 5=known |
| `translation` | string | primary translation (last AI или user-edited) |
| `grammar_note` | string | nullable, AI-generated |
| **FSRS-6 поля:** | | |
| `fsrs_state` | number | 0=new, 1=learning, 2=review, 3=relearning |
| `fsrs_difficulty` | number | 1.0..10.0 (FSRS параметр) |
| `fsrs_stability` | number | дни, ≥0 |
| `fsrs_reps` | number | total successful reviews |
| `fsrs_lapses` | number | total forgets |
| `fsrs_last_review` | number | nullable, timestamp |
| `fsrs_next_review` | number | nullable, timestamp |
| `fsrs_elapsed_days` | number | дней с последнего ревью |
| `fsrs_scheduled_days` | number | следующий interval |
| **deck overrides:** | | |
| `deck_suspended` | boolean | default false |
| `deck_priority` | number | 0 (normal), -1 (низкий), 1 (высокий) |
| `created_at` | number | timestamp |
| `updated_at` | number | timestamp |

**Уникальность:** `(word, book_language, native_language)` — UNIQUE composite.
WatermelonDB не поддерживает native UNIQUE constraints. Решение: детерминированный
ID (см. §6.0) — `id = sha256_hex(word + '\x00' + book_language + '\x00' + native_language).slice(0, 16)`.
Upsert через `find(id)` → update или create — идемпотентно.

**Indexes:**
- `(word)` + `(book_language)` + `(native_language)` — отдельные single-column
  индексы (WatermelonDB поддерживает только `isIndexed: true` на колонку,
  без composite и partial). Фильтр `word + book_language + native_language`
  одновременно — в query, SQLite planner соединит через AND.
- `(fsrs_next_review)` — hot-path для deck queue. Фильтр
  `fsrs_state IN (1,2,3) AND deck_suspended = 0 AND fsrs_next_review <= now`
  применяется в query. При 10K rows single-column index по `fsrs_next_review`
  достаточен для v1.
- `(status)` (filter by learning status в Settings/Stats)

### 4.6 `word_occurrences`

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `word_status_id` | string (FK) | → word_statuses.id |
| `book_id` | string (FK) | → books.id |
| `chapter_order_index` | number | nullable |
| `context_sentence` | string | до 300 chars, sentence around the word |
| `created_at` | number | timestamp |

**Indexes:** `(word_status_id)` (find all contexts for a word),
`(book_id)` (find all words from a book — для difficulty recalc).

### 4.7 `review_logs` (FSRS-6 history)

История для FSRS-калибровки + миграция в случае смены алгоритма.

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `word_status_id` | string (FK) | → word_statuses.id |
| `rating` | number | 1=again, 2=hard, 3=good, 4=easy (FSRS standard) |
| `reviewed_at` | number | timestamp — когда произошло это ревью |
| `elapsed_days` | number | дни с предыдущего ревью |
| `scheduled_days` | number | какой интервал был запланирован |
| `state_before` | number | состояние до этого ревью (fsrs_state) |
| `stability_after` | number | FSRS stability ПОСЛЕ этого ревью (для калибровки) |
| `difficulty_after` | number | FSRS difficulty ПОСЛЕ этого ревью (для калибровки) |
| `due` | number | timestamp — запланированное время ревью НА МОМЕНТ этого ревью |

Поля `stability_after`, `difficulty_after`, `due` необходимы для FSRS-калибровки
и возможной миграции алгоритма. В `word_statuses` хранятся текущие значения
(latest), в `review_logs` — исторические снапшоты по каждому ревью.

**Retention:** сохраняем логи за последние 365 дней ИЛИ последние 100 записей
на каждое `word_status_id` — что больше. Purge job запускается ежедневно при
cold-start через `cachePurge.ts`. Старые логи не нужны FSRS-алгоритму в
runtime — только для офлайн-калибровки.

**Indexes:** `(word_status_id)` + `(reviewed_at)` — отдельные single-column
индексы. Сортировка DESC в query. `(reviewed_at)` также для daily stats
aggregation и retention purge.

### 4.8 `translation_cache`

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `cache_key` | string (UNIQUE) | SHA-256 truncated 32 chars (см. §6.5) |
| `word` | string | NFC-normalized, lowercase |
| `context_window` | string | до 80 chars |
| `book_language` | string | |
| `native_language` | string | |
| `translation` | string | LLM-generated текст |
| `grammar` | string | nullable, грамматическая заметка |
| `created_at` | number | timestamp |

**Indexes:** `(cache_key)` UNIQUE, `(created_at)` (для TTL purge).

**Eviction:** time-based 90 дней (по `created_at`). Запуск каждый cold-start
приложения через сервис в `src/services/maintenance/cachePurge.ts`. Не LRU.
Если размер > 50K rows — дополнительный hard cap: удаляем oldest 10%.

### 4.9 `opds_catalogs`

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `name` | string | user-friendly name |
| `url` | string | **БЕЗ userinfo** — креды отдельно в SecureStore |
| `requires_auth` | boolean | true если есть creds в SecureStore |
| `kind` | string | `preset` / `custom` |
| `last_fetched_at` | number | nullable, timestamp |
| `created_at` | number | timestamp |

**Креды в SecureStore:** ключ `opds:{catalog_id}`, значение JSON
`{username:string, password:string}`. См. § 6.4 для flow.

**Indexes:** `(created_at)` (list view).

### 4.10 `reading_stats`

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `date` | string | ISO `YYYY-MM-DD` в локальной TZ устройства |
| `book_id` | string | НЕ NULL — для агрегатов "любая книга" используем sentinel `'__all__'` |
| `seconds_reading` | number | сумма за день/книгу |
| `words_read` | number | приблизительно (по диффу total_chars) |
| `words_translated` | number | количество tap-translate действий |
| `words_added_to_deck` | number | новые WordStatus.status=1 за день |
| `words_learned` | number | переходы в status=4 или 5 |
| `updated_at` | number | timestamp |

**Уникальность через deterministic ID:** `id = ${date}__${book_id}`, где для
суточных агрегатов "все книги" — `book_id = '__all__'`. SQLite NULL != NULL —
UNIQUE composite с NULL допускает дубли. Sentinel `'__all__'` делает поле NOT NULL
и ID детерминированным. Всегда используем строчный литерал `'__all__'`.

**UPSERT policy:** обновления `reading_stats` ОБЯЗАНЫ идти через
`database.batch()` для atomicity. Шаблон:
```ts
// findOrCreate через deterministic id → increment counters → batch.commit()
// НИКОГДА не использовать find + update без транзакции — race condition
await database.write(async () => {
  const id = `${date}__${bookId ?? '__all__'}`;
  let record = await tryFind(collection, id);
  if (record) {
    await record.update((r) => { r.secondsReading += delta; /* ... */ });
  } else {
    await collection.create((r) => { r._raw.id = id; r.secondsReading = delta; /* ... */ });
  }
});
```

**Indexes:** `(date)` + `(book_id)` — отдельные single-column индексы.

---

## 5. Migration strategy

`src/db/migrations.ts`:
```ts
import { schemaMigrations, addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    // version 1 — initial schema (см. schema.ts)
    // future: { toVersion: 2, steps: [addColumns(...), ...] }
  ],
});
```

`SCHEMA_VERSION = 1` в `schema.ts`. При каждом изменении схемы:
1. Bump `SCHEMA_VERSION`.
2. Добавить миграционный step в `migrations.ts` с `toVersion = новый номер`.
3. Никогда не редактировать прошлые миграции in-place.

WatermelonDB сам применяет миграции на старте — НЕ требует ручного вызова.
Логирование результата миграций через `console.warn` (или Sentry в v2).

**Тестирование миграций:** in-memory адаптер
(`@nozbe/watermelondb/adapters/lokijs`) — создаём DB с старым schema,
применяем миграцию, проверяем что новые колонки есть и значения по
дефолту корректны.

---

## 6. Стандарты и политики

### 6.0 Deterministic ID strategy

WatermelonDB не имеет нативных UNIQUE constraints. Паттерн «проверить→вставить»
внутри `database.write()` всё равно даёт race при параллельных write-транзакциях.
Решение — **детерминированные ID, производные от natural key**.

| Таблица | Формула ID |
|---|---|
| `word_statuses` | `sha256_hex(word + '\x00' + book_language + '\x00' + native_language).slice(0, 16)` |
| `translation_cache` | `cache_key` — уже является FNV-1a хэшем (см. §6.5) |
| `reading_positions` | `book_id` — отношение 1:1 |
| `reading_stats` | `` `${date}__${book_id ?? '__all__'}` `` |

**Idempotent upsert-паттерн** в каждом repository:
```ts
async upsert(naturalKey: NaturalKey, data: UpsertData): Promise<Record> {
  const id = computeDeterministicId(naturalKey);
  return this.db.write(async () => {
    let record = await this.findRaw(id); // db.collections.get(...).find(id)
    if (record) {
      await record.update((r) => applyData(r, data));
    } else {
      record = await collection.create((r) => { r._raw.id = id; applyData(r, data); });
    }
    return toDTO(record);
  });
}
```

Это делает upsert идемпотентным без race — `find(id)` бросает, если нет, catch →
create с тем же ID. Параллельные write в WatermelonDB сериализованы через
`db.write()` queue.

### 6.1 Repository pattern

**Каждый repository:**
- Принимает `Database` instance в конструкторе (для тестирования).
- Возвращает PLAIN-TS objects (DTO), НЕ WatermelonDB `Model` instances.
- Использует `database.collections.get<TModel>('table_name')` внутри.
- Все mutations в `database.write(async () => { ... })`.
- Все queries — через `query()` + `fetch()` (а не `observe()` напрямую).
  Reactivity — в hooks-слое.

**Пример:**
```ts
export class BookRepository {
  constructor(private db: Database) {}

  async create(input: CreateBookInput): Promise<BookRecord> {
    return this.db.write(async () => {
      const book = await this.db.collections.get<BookModel>('books').create((b) => {
        b.title = input.title;
        // ...
      });
      return toBookRecord(book);
    });
  }

  async findById(id: string): Promise<BookRecord | null> {
    try {
      const book = await this.db.collections.get<BookModel>('books').find(id);
      return toBookRecord(book);
    } catch {
      return null;
    }
  }

  async list(opts: { language?: BookLanguage; sortBy?: 'lastRead' | 'added' } = {}): Promise<BookRecord[]> {
    // ...
  }
}
```

### 6.1.1 Database injection via React Context

**Проблема:** `src/db/index.ts` экспортирует singleton `bookRepo` на уровне модуля.
Singleton инициализируется при импорте модуля — **до** того, как `dbReady` resolve.
Хуки, импортирующие `bookRepo` из index.ts, получают repository до готовности DB.

**Решение — React Context с `DatabaseProvider`:**

```ts
// src/db/DatabaseContext.tsx
const DatabaseContext = React.createContext<Database | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = React.useState<Database | null>(null);

  React.useEffect(() => {
    createDatabase().then(setDb);
  }, []);

  if (!db) return null; // splash screen держит этот экран, пока db не готова

  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): Database {
  const db = React.useContext(DatabaseContext);
  if (!db) throw new Error('useDatabase must be used inside DatabaseProvider');
  return db;
}
```

`DatabaseProvider` оборачивает дерево приложения в `app/_layout.tsx` **внутри**
`Promise.all` barri — splash показан, пока `DatabaseProvider` не передал `db`.

**Repositories в хуках** создаются через `useMemo`:
```ts
function useBookList(opts?: BookListOpts) {
  const db = useDatabase();
  const repo = React.useMemo(() => new BookRepository(db), [db]);
  // ...
}
```

Это исключает module-level singleton race: ни одна строка repository-кода
не выполняется до `dbReady`.

### 6.1.2 Hard delete policy

В v1 нет синхронизации с сервером, поэтому tombstones не нужны.

**Правило:** каждый repository в методе `delete*` ОБЯЗАН вызывать
`record.destroyPermanently()`, а НЕ `record.markAsDeleted()`.

```ts
// ПРАВИЛЬНО — v1:
async deleteBook(id: string): Promise<void> {
  return this.db.write(async () => {
    const book = await collection.find(id);
    await book.destroyPermanently();
  });
}

// НЕПРАВИЛЬНО — оставляет tombstone без нужды:
// await book.markAsDeleted();
```

**Причина:** `markAsDeleted()` только ставит `_status = 'deleted'` и скрывает
из queries. Без sync-сервера строки накапливаются, раздувая БД.

**v2:** если добавим sync — потребуется migrate на `markAsDeleted()` через
миграцию и добавление tombstone-cleanup policy.

### 6.2 Hooks API

**Принципы:**
- Каждый хук — для ОДНОЙ data shape.
- Возвращают `{ data, isLoading, error }` shape (даже если loading мгновенный).
- Используют WatermelonDB `observe()` через `useObservable` wrapper для
  реактивности на изменения в DB.
- НЕ принимают callback'и для mutations — это repositories job, хук
  только read.

**Пример контрактов:**
```ts
function useBookList(opts?: { language?: BookLanguage; archived?: boolean }):
  { books: BookRecord[]; isLoading: boolean };

function useBookProgress(bookId: string):
  { progress: number; lastReadAt: Date | null; isLoading: boolean };

function useWordStatus(word: string, bookLang: BookLanguage, nativeLang: NativeLanguage):
  { status: WordStatusRecord | null; isLoading: boolean };

function useDeckQueue(bookLang: BookLanguage, nativeLang: NativeLanguage, limit?: number):
  { queue: WordStatusRecord[]; isLoading: boolean };

function useBookmarks(bookId: string):
  { bookmarks: BookmarkRecord[]; isLoading: boolean };
  // Мутации — через BookmarkRepository напрямую (хуки только read)

function useTranslation(word: string, context: string, bookLang: BookLanguage, nativeLang: NativeLanguage):
  { translation: TranslationRecord | null; status: 'idle' | 'cache-hit' | 'inferring' | 'error' };
  // cache check — sync; if miss, вызывает ITranslationService.translate() (stub в #2, реализация в #4)
```

**`ITranslationService` interface** (определяем в #2, реализуем в #4):

```ts
// src/services/translation/ITranslationService.ts
export interface TranslationInput {
  word: string;
  contextWindow: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
}

export interface TranslationResult {
  status: 'ok' | 'pending' | 'error';
  translation?: string;
  grammarNote?: string;
}

export interface ITranslationService {
  translate(input: TranslationInput): Promise<TranslationResult>;
}
```

```ts
// src/services/translation/NoOpTranslationService.ts
// TODO: заменить реальной реализацией в #4 (DeepSeek / Gemini / Claude)
export class NoOpTranslationService implements ITranslationService {
  async translate(_input: TranslationInput): Promise<TranslationResult> {
    return { status: 'pending' };
  }
}
```

`useTranslation` в #2 принимает `service: ITranslationService` (defaulted к
`NoOpTranslationService`) — тесты хука в #2 проходят без реального LLM.

### 6.3 Zustand persist

```ts
// src/stores/settingsStore.ts
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useSettingsStore = create<SettingsStore>()(
  persist(
    subscribeWithSelector((set) => ({ /* ... */ })),
    {
      name: 'fluera-settings-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ALLOWLIST.reduce((acc, k) => ({ ...acc, [k]: s[k] }), {}),
      version: 1,
      // migrate: (state, fromVersion) => { ... } // на будущее
    },
  ),
);
```

**`ALLOWLIST`** — полный перечень ключей (17 полей):

```ts
// UI preferences
const ALLOWLIST = [
  'themeId', 'themeAuto', 'fontFamilyMode', 'fontSize', 'scrollMode',
  'highlightUnknown', 'showSentenceTranslation', 'pageFlipAnim',
  'showPhonetics', 'lookupHistoryEnabled',
  // Language pair
  'uiLanguage', 'nativeLanguage', 'bookLanguage',
  // Pedagogy
  'bookLanguageLevel', 'tapToTranslateBehavior', 'autoAddToDeck',
  'readingSessionGoalMinutes',
  // Onboarding state
  'onboardingCompleted',
] as const;
```

**ЗАПРЕЩЕНО** в ALLOWLIST: любые `*token*`, `*auth*`, `*password*`, OPDS keys —
они идут исключительно в SecureStore.

**Cold-start theme flash — ОБЯЗАТЕЛЬНОЕ требование:**

`StyleSheet.configure()` в `theme/unistyles.ts` читает `themeId` синхронно.
AsyncStorage — async. На cold-start стор стартует с `DEFAULT_SETTINGS.themeId`,
затем hydrate происходит асинхронно. Если `DEFAULT_SETTINGS.themeId = 'light'`,
а пользователь сохранил `'night'` — виден flash.

**ОБЯЗАТЕЛЬНО:** `app/_layout.tsx` ДОЛЖЕН держать `SplashScreen` видимым до
полного завершения `persist.hasHydrated() === true`. Порядок инициализации:

```
┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────┐
│  i18nReady   │  │   dbReady    │  │  useSettingsStore.persist         │
│  (Promise)   │  │  (Promise)   │  │  .hasHydrated() === true          │
└──────┬───────┘  └──────┬───────┘  └───────────────┬──────────────────┘
       │                 │                           │
       └─────────────────┴───────────────────────────┘
                         │
                  Promise.all(all three)
                         │
                  applyTheme(persistedTheme)   ← НЕ DEFAULT_SETTINGS
                         │
                  SplashScreen.hideAsync()
```

Splash ДОЛЖЕН оставаться виден, пока все три Promise не resolved. Это
**обязательно**, не опционально.

**`applyThemeImmediate` для onRehydrateStorage:**

Существующий `applyTheme()` оборачивает `setTheme()` в `requestAnimationFrame`.
Если `onRehydrateStorage` срабатывает до монтирования дерева компонентов —
rAF выполнится после скрытия splash → flash.

Добавить в `src/theme/applyTheme.ts`:

```ts
/**
 * Синхронный вызов — ТОЛЬКО для onRehydrateStorage cold-start.
 * Не использовать при runtime theme change (компоненты уже смонтированы).
 * Причина: ShadowTreeManager race (issue #1179) не возникает при cold-start,
 * т.к. рендеры React ещё не выполнялись.
 */
export function applyThemeImmediate(id: ThemeId, auto: boolean): void {
  if (auto) {
    UnistylesRuntime.setAdaptiveThemes(true);
  } else {
    UnistylesRuntime.setTheme(id); // синхронно, без rAF
  }
}
```

`onRehydrateStorage` вызывает `applyThemeImmediate`, а НЕ `applyTheme`. После
`Promise.all` + `SplashScreen.hideAsync()` последующие theme changes идут через
обычный `applyTheme` (с rAF).

### 6.4 OPDS креды (SecureStore)

**Flow добавления каталога:**
1. User вводит URL и опционально username/password.
2. **Валидация scheme до записи:** `new URL(input).protocol` должен быть `'http:'`
   или `'https:'`. Если нет — reject с ошибкой пользователю. Никаких `file://`,
   `ftp://`, custom schemes. Валидация происходит до любой записи в БД или SecureStore.
3. Парсим URL: если `user:pass@` в URL — извлекаем, удаляем из URL.
4. Записываем clean-URL в `OPDSCatalog.url`.
5. Если creds есть — пишем в SecureStore с ключом `opds:{catalog_id}`,
   значение `JSON.stringify({username, password})`.
6. `OPDSCatalog.requires_auth = true`.

**Flow чтения каталога (в #5 Library):**
1. По `catalog_id` читаем `OPDSCatalog.url` из БД.
2. Если `requires_auth` — читаем `opds:{catalog_id}` из SecureStore.
3. HTTP-запрос с `Authorization: Basic base64(username:password)`.

**Удаление:** при delete каталога — также `SecureStore.deleteItemAsync('opds:'+id)`.

### 6.4.1 Privacy actions

Scope операций очистки данных (реализуется в Settings → Privacy):

**"Clear translation history" (деструктивная):**
```
- DELETE FROM translation_cache (все строки)
- UPDATE word_occurrences SET context_sentence = ''
  (ссылка на слово сохраняется, предложение-контекст удаляется)
- reading_stats НЕ трогаем (агрегаты безличны — только счётчики)
```

**"Clear all my data" (полная очистка):**
```
- Всё из "Clear translation history" выше +
- DELETE FROM reading_stats
- DELETE FROM bookmarks
- DELETE FROM reading_positions
- word_statuses: предлагаем пользователю выбор (оставить vocab / удалить всё)
```

**НЕ трогаем:** файлы книг, список OPDSCatalog (это конфигурация, не личные данные).

### 6.5 Cache key (FNV-1a)

`cache_key` — это **только ключ дедупликации**, а не криптографический барьер.
SHA-256 через `expo-crypto` — асинхронный вызов (5-15ms) — создаёт bottleneck
на hot reader path. Заменяем на синхронный FNV-1a 64-bit (~0.1ms).

```ts
// src/services/translation/cacheKey.ts
// FNV-1a 64-bit, реализован как два 32-bit числа (BigInt не нужен в JS)
function fnv1a32(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

export function computeCacheKey(
  word: string,
  contextWindow: string,
  bookLanguage: BookLanguage,
  nativeLanguage: NativeLanguage,
): string {
  const normalized = word.toLowerCase().normalize('NFC');
  const contextNormalized = contextWindow.normalize('NFC');
  const input = `${normalized}\x00${contextNormalized}\x00${bookLanguage}-${nativeLanguage}`;
  const h1 = fnv1a32(input).toString(16).padStart(8, '0');
  // второй проход со смещением для снижения коллизий
  const h2 = fnv1a32(input + '\x01').toString(16).padStart(8, '0');
  return `${h1}${h2}_${bookLanguage}-${nativeLanguage}`;
}
```

Функция **синхронная** — можно вызывать в render loop без await.
Формат: `{16 hex chars}_{lang_pair}`, например `a3f2b1c4d5e6f7a8_ru-en`.

`\x00` separator предотвращает коллизии между полями. `expo-crypto` больше
не нужен для cache key (может остаться в зависимостях для других нужд).

**Deterministic ID для `word_statuses`** (см. §6.0) по-прежнему использует
SHA-256 через `expo-crypto` — там это разовая операция при первом показе слова,
не hot-path. Или может использовать тот же FNV-1a для единообразия.

### 6.6 Backup exclusion

**iOS:** SQLite-файл WatermelonDB лежит в `Library/Application Support/`.
Через `expo-file-system` API после `database.createDatabase()` устанавливаем
атрибут на **все 4 sibling-файла SQLite**:
```ts
import * as FileSystem from 'expo-file-system';
const base = dbPath; // путь к .db файлу
for (const suffix of ['', '-wal', '-shm', '-journal']) {
  const p = base + suffix;
  // setBackupAttributeAsync может вернуть ошибку если файл ещё не создан
  // (особенно -journal, -shm, -wal — появляются только при первой записи)
  try {
    await FileSystem.setBackupAttributeAsync(p, { iCloudBackupEnabled: false });
  } catch {
    // файл не существует — пропускаем, атрибут не нужен
  }
}
```

Альтернатива — config plugin `withInfoPlist` для `NSURLIsExcludedFromBackupKey`
на сам DB файл через post-install hook.

**Android:** нужны **оба** файла backup-правил для поддержки всех версий Android.

**Legacy Auto Backup (Android <12)** — `res/xml/backup_rules.xml`:
```xml
<full-backup-content>
  <include domain="file" path="Books/"/>
  <exclude domain="database" path="watermelon.db"/>
  <exclude domain="database" path="watermelon.db-journal"/>
  <exclude domain="database" path="watermelon.db-shm"/>
  <exclude domain="database" path="watermelon.db-wal"/>
</full-backup-content>
```
Ссылка в `AndroidManifest.xml`: `android:fullBackupContent="@xml/backup_rules"`.

**Android 12+ Data Extraction Rules** — `res/xml/data_extraction_rules.xml`:
```xml
<data-extraction-rules>
  <cloud-backup>
    <include domain="file" path="Books/"/>
    <exclude domain="database" path="watermelon.db"/>
    <exclude domain="database" path="watermelon.db-journal"/>
    <exclude domain="database" path="watermelon.db-shm"/>
    <exclude domain="database" path="watermelon.db-wal"/>
  </cloud-backup>
  <device-transfer>
    <include domain="file" path="Books/"/>
    <exclude domain="database" path="watermelon.db"/>
    <exclude domain="database" path="watermelon.db-journal"/>
    <exclude domain="database" path="watermelon.db-shm"/>
    <exclude domain="database" path="watermelon.db-wal"/>
  </device-transfer>
</data-extraction-rules>
```
Ссылка в `AndroidManifest.xml`: `android:dataExtractionRules="@xml/data_extraction_rules"`.

**Оба файла ОБЯЗАТЕЛЬНЫ** — `<full-backup-content>` игнорируется на Android 12+,
`<data-extraction-rules>` игнорируется на Android <12.

Книги (user-imported) — сохраняются в backup; БД с переводами и кешем —
исключается.

### 6.7 OPDS XXE защита

В sub-project #2 определяем ОБЩИЙ XML-парсер для будущих использований
(OPDS feed в #5, FB2 в #3) — `src/services/xml/safeParser.ts`:

```ts
export function parseXmlSafe(source: string, opts?: { maxBytes?: number }): unknown {
  if (source.length > (opts?.maxBytes ?? 50 * 1024 * 1024)) {
    throw new Error('XML payload too large');
  }
  // STRICT: отвергаем ЛЮБОЙ DOCTYPE без исключений.
  // Regex `/<!DOCTYPE[^>]*\b(ENTITY|SYSTEM|PUBLIC)\b/i` можно обойти через
  // whitespace в internal subset, unicode normalization, chars внутри атрибутов.
  // OPDS и FB2 не используют DOCTYPE легитимно.
  if (/<!DOCTYPE/i.test(source)) {
    throw new Error('XML DOCTYPE not allowed');
  }
  // Отвергаем xml-stylesheet с внешними ссылками
  if (/<\?xml-stylesheet[^?]*href\s*=/i.test(source)) {
    throw new Error('xml-stylesheet processing instruction not allowed');
  }
  // ... парсинг через выбранную lib с явными настройками безопасности:
  // { processEntities: false, htmlEntities: false }
  // (см. #3 для FB2, #5 для OPDS — но правила в этом файле едины)
}
```

В #2 пишем тесты для:
- Размер cap (50MB / 5MB)
- Reject ЛЮБОГО DOCTYPE (не только с ENTITY/SYSTEM/PUBLIC)
- Reject `<?xml-stylesheet` с `href=`
- Reject billion-laughs (>1000 entity expansion)
- Reject max depth >100

Сам парсер в #2 — НЕ реализуем, только signature + tests. Реализация в #3/#5.

---

## 7. Performance budgets

**Cold-start:**
- **iOS (iPhone 13):** <800ms от запуска до interactive (данные hydrated, ready to use)
- **Android (Pixel 7):** <1000ms от запуска до interactive
- "time-to-first-pixel" (splash gone, skeleton visible) фиксируется в #5/#8 через skeleton.
  В #2 фокус на TTI: `Promise.all([i18nReady, dbReady, settingsHydrated])` → interactive.
- DB open + persist rehydrate + i18n init параллельно через `Promise.all`.

**Reader word lookup:**
- JSI roundtrip 3-8ms (steady), GC spikes до 30ms. Бурстовые чтения при скролле
  вызывают jank.
- **Prefetch при открытии chapter:** собираем все unique words из chapter через
  `Q.where('word', Q.oneOf(uniqueWords))` — одна batch query. Результат —
  `Map<word, WordStatusRecord>` в памяти. Hot-path `useWordStatus` читает из Map
  синхронно, НЕ из БД. Map evict при уходе с этого chapter (screen blur / chapter change).
- Target: <1ms hot-path lookup при наличии prefetch Map.

**Translation cache hit:** <5ms (in-memory LRU поверх DB).

**Deck queue load (50 cards):** <30ms — query с фильтром
`fsrs_state IN (1,2,3) AND deck_suspended = 0 AND fsrs_next_review <= now`
по single-column индексу `(fsrs_next_review)`.

**Book list (10 книг):** <20ms — `observe()` + map в DTO.

**reading_positions write policy:**
```
- In-memory debounce 500ms (trailing) при scroll/swipe — НЕ пишем в БД на каждый кадр.
- Immediate flush при AppState: active → background / inactive.
- Immediate flush при screen blur (navigation away from Reader).
```
Ответственность: `useReadingPositionSync()` хук или ReaderProvider — уточнить в #3.

**Book difficulty recalc policy:**
```
- НЕ на hot-path открытия книги.
- InteractionManager.runAfterInteractions() после открытия Reader.
- Idle queue: recalc если difficulty_computed_at старше 7 дней
  ИЛИ WordStatus.updated_at > Book.difficulty_computed_at.
- Результат: Book.difficulty + Book.difficulty_computed_at обновляются.
```

**Chapter content LRU:** max 2 chapters в памяти, суммарный бюджет 8MB
по bytes parsed-content. Evict по размеру (LRU-size), не по количеству.
Low-RAM устройства не получат OOM от большого EPUB.

**Translation cache LRU:** 200 entries последних tap-words. Eviction при
превышении — простой Map с insertion order (Map iterator сохраняет порядок).

---

## 8. Testing strategy

**Unit-тесты на каждый repository** — in-memory LokiJSAdapter:
```ts
import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

function createTestDb(): Database {
  return new Database({
    adapter: new LokiJSAdapter({ schema, dbName: 'test', useWebWorker: false, useIncrementalIndexedDB: false }),
    modelClasses: [
      BookModel, ChapterModel, ReadingPositionModel, BookmarkModel,
      WordStatusModel, WordOccurrenceModel, ReviewLogModel,
      TranslationCacheModel, OPDSCatalogModel, ReadingStatsModel,
    ],
  });
}
```

**Покрытие:**
- Schema test: количество таблиц, все колонки определены, индексы существуют.
- Migration test: создаём DB на v1, applyMigrations(2), проверяем результат.
- Каждый Repository: CRUD + edge cases (not found, unique violation,
  foreign-key cascade).
- WordRepository: FSRS-6 поля валидируются (state в [0,3], rating в [1,4]).
- TranslationCache: cache_key вычисляется детерминированно; purge удаляет
  по `created_at < cutoff`.
- OPDS credential roundtrip: save → SecureStore mock → load → assert.
- Backup exclusion API call: mock `FileSystem.setBackupAttributeAsync` —
  проверяем что вызывается с правильным путём.

**Hooks тесты** через `renderHook` из `@testing-library/react-native`:
- `useBookList` возвращает данные после mount.
- `useBookList` re-renders при insert.
- `useWordStatus` correctly memoizes by word+langPair.

**Foundation jest.setup.js** уже содержит моки для большинства expo-libs.
Добавляем:
- `@nozbe/watermelondb/adapters/sqlite` → подменяется на LokiJS в тестах.
- `expo-secure-store` mock с in-memory Map.
- `@react-native-async-storage/async-storage` mock с in-memory Map
  (или встроенный jest mock).

---

## 9. Open questions (для review)

1. **OPDSCatalog в #2 или #5?** Решено: схема таблицы и SecureStore wrapper —
   в #2. HTTP-клиент и XML-парсинг — в #5. Использовать общий `safeParser`
   из #2.
2. **TranslationCache initial size cap?** 50K rows. При среднем размере
   500-800 байт на запись (word + context_window + translation + grammar)
   = 25-40MB. Acceptable для оффлайн-приложения.
3. **Очистка orphan WordOccurrence при delete book?** Через WatermelonDB
   cascade-by-relation. Repository.deleteBook вызывает batch delete всех
   связанных таблиц (book → chapters → reading_position → bookmarks →
   word_occurrences для этой книги).
4. **OPDS preset-каталоги?** В #2 НЕ seedим. В #5 (Library) — добавим
   3-5 публичных каталогов как preset.
5. **Borges fixture в DB?** На старте приложения если БД пустая —
   добавляем 1 demo-книгу (Borges sample). Для удобства разработки.
   Решение: ДА в #2, в seed-сервисе. Активируется через
   `EXPO_PUBLIC_FLUERA_SEED_BORGES=1` (только `__DEV__`). Production/preview
   EAS профили НЕ устанавливают эту переменную (см. шаг 11 в §10).
6. **FSRS-6 default params?** Используем ts-fsrs дефолты как baseline.
   Тонкая настройка — в #6.

---

## 10. Implementation order

Логические фазы для #2 plan:

1. **Foundation prep**: install deps (`@nozbe/watermelondb`,
   `@react-native-async-storage/async-storage`, `expo-secure-store`,
   `expo-crypto`, `react-native-get-random-values`), update `babel.config.js`
   с decorators-plugin, обновить native dev-client (`pod install`).
2. **Storage wrappers**: `src/storage/asyncStorage.ts`,
   `src/storage/secureStorage.ts` + tests.
3. **Schema + migrations**: `src/db/schema.ts`, `src/db/migrations.ts`,
   `src/db/database.ts` (createDatabase factory) + schema test.
4. **Models**: 10 моделей в `src/db/models/` + index. Минимальный кода,
   все поля типизированы.
5. **Repositories**: один за раз с TDD —
   BookRepository → ChapterRepository → ReadingPositionRepository →
   BookmarkRepository → WordRepository → TranslationCacheRepository →
   OPDSCatalogRepository → ReadingStatsRepository.
6. **Cache key utility**: `src/services/translation/cacheKey.ts` (FNV-1a sync) +
   `ITranslationService.ts` + `NoOpTranslationService.ts` + tests.
7. **Safe XML parser signature**: `src/services/xml/safeParser.ts` +
   tests (без реализации парсинга — только защитные проверки).
8. **Zustand persist**: подключить `persist` middleware к SettingsStore,
   определить ALLOWLIST, написать `onRehydrateStorage` hook → applyTheme.
9. **App root integration**: обновить `app/_layout.tsx` — ждать
   `Promise.all([i18nReady, dbReady, settingsHydrated])` до splash hide.
10. **Backup exclusion**: вызвать `setBackupAttributeAsync` после
    `createDatabase`, обновить `app.json` Android `<full-backup-content>`.
11. **Seed fixture (Borges)**: на пустой БД добавить sample book + chapter.
    Активируется ТОЛЬКО при `__DEV__ === true` И наличии env-переменной
    `EXPO_PUBLIC_FLUERA_SEED_BORGES=1`. По умолчанию `false` в production.
    В `eas.json` профили `production` и `preview` НИКОГДА не устанавливают эту
    переменную. Только `development` профиль может её включать.
12. **Data hooks**: `src/hooks/data/use*` — 9 хуков (включая `useBookmarks`) + tests.
13. **Smoke**: запустить app, проверить что books видны, settings
    переживают restart, темы корректно hydrate.

---

## 11. Acceptance criteria

- 10 таблиц созданы, все индексы присутствуют.
- Migrations работают (test проверяет from v1 без миграций — initial setup).
- Все repositories покрыты unit-тестами с in-memory adapter.
- Zustand SettingsStore persist через AsyncStorage: тема и язык переживают
  restart приложения (manual smoke).
- OPDS-креды: save → read roundtrip через SecureStore (test).
- Backup exclusion attribute установлен на SQLite-файле (iOS smoke).
- Translation cache key детерминирован (test).
- Safe XML parser отвергает ЛЮБОЙ DOCTYPE (test), `<?xml-stylesheet` с href (test).
- `npx tsc --noEmit` 0 errors.
- `npx jest` 100% passing.
- Linter clean.

---

## 12. Risks

- **WatermelonDB + RN 0.81 + new arch:** проверить compatibility до
  начала имплементации. Если есть issue — fallback на op-sqlite + Drizzle
  (но это меняет всё подход).
- **AsyncStorage + Zustand persist + cold-start race:** требует тщательного
  тестирования. Splash screen должен ждать hydrate (реализовано как ОБЯЗАТЕЛЬНОЕ
  требование в §6.3 — не опционально).
- **expo-secure-store на iOS Simulator:** работает через Keychain
  (sandboxed), тесты проходят. На реальном устройстве — также.
- **Decorators babel-plugin:** должен быть в правильной позиции в plugin
  order (legacy decorators before TS plugin). Проверить.
- **TranslationCache — plaintext privacy:** `word`, `context_window`, `translation`,
  `grammar` хранятся как plaintext — это reading history пользователя,
  sensitive при компрометации устройства. Mitigation в v1: backup-исключение БД
  (§6.6) + iOS/Android sandbox encryption (при установленном passcode).
  Пользователь может вызвать "Clear translation history" для явной очистки (§6.4.1).
  v2 может добавить SQLCipher для дополнительного слоя защиты.

---

## 13. Out of scope (явное упоминание)

- Cloud sync (v2+, ничего не закладываем в #2)
- SQLCipher (не нужен в v1, см. §12 о privacy рисках)
- E2E тесты (Foundation не имеет — добавим в pre-release sprint)
- Performance benchmarks через автоматизированные тесты (manual smoke в #2)
- Analytics / telemetry (см. observability policy в CLAUDE.md)
- **EPUB XHTML JavaScript execution как attack vector:** Reader реализован
  как нативные компоненты React Native (НЕ WebView, согласно CLAUDE.md).
  FB2 парсится через fast-xml-parser в нативный RN. EPUB через @epubjs-react-native
  использует WebView, однако JS execution из EPUB content — ответственность #3
  (Reader engine), не #2 (Data layer). В #2 этот вектор не актуален.
