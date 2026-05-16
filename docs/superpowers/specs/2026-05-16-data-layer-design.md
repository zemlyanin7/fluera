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
  shim), `expo-crypto` (для SHA-256 хэшей TranslationCache).

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
конвенции `snake_case`. ID — WatermelonDB auto-id (string-Hash) ИЛИ
crypto.randomUUID для cross-references — выбираем auto-id из коробки.

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

**Indexes:** `(language, last_read_at DESC)` (library list, filter by lang),
`(archived, last_read_at DESC)` (archived view).

### 4.2 `chapters`

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `book_id` | string (FK) | → books.id |
| `title` | string | nullable (chapters без title возможны) |
| `order_index` | number | 0-based порядок в книге |
| `start_char` | number | offset в total_chars книги (для progress %) |
| `end_char` | number | exclusive end (start_char следующего chapter) |

Не храним `parsed_content` — re-parse on-demand, LRU в памяти 3 chapters
(см. § Performance). Парсер живёт в #3 ChapterCache сервисе.

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

**Уникальность:** `(word, book_language, native_language)` — UNIQUE composite
(WatermelonDB не поддерживает native UNIQUE constraints — реализуем через
repository check + transactional insert).

**Indexes:**
- `(word, book_language, native_language)` (reader hot-path lookup)
- `(fsrs_state, fsrs_next_review)` partial WHERE `fsrs_state IN (1,2,3)`
  AND `deck_suspended = 0` (deck queue hot-path; WatermelonDB поддерживает
  multi-column обычные индексы — фильтрацию делаем в SQL query)
- `(status, book_language)` (filter by learning status в Settings/Stats)

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
| `reviewed_at` | number | timestamp |
| `elapsed_days` | number | дни с предыдущего ревью |
| `scheduled_days` | number | какой интервал был запланирован |
| `state_before` | number | состояние до этого ревью (fsrs_state) |

**Indexes:** `(word_status_id, reviewed_at DESC)` (история одного слова),
`(reviewed_at)` (daily stats aggregation).

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
| `book_id` | string (FK) | nullable (для агрегатов "any book") |
| `seconds_reading` | number | сумма за день/книгу |
| `words_read` | number | приблизительно (по диффу total_chars) |
| `words_translated` | number | количество tap-translate действий |
| `words_added_to_deck` | number | новые WordStatus.status=1 за день |
| `words_learned` | number | переходы в status=4 или 5 |
| `updated_at` | number | timestamp |

**Уникальность:** `(date, book_id)` — одна запись на пару (день, книга).

**Indexes:** `(date)` (агрегаты за день по всем книгам),
`(book_id, date)` (стрик по книге).

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

function useTranslation(word: string, context: string, bookLang: BookLanguage, nativeLang: NativeLanguage):
  { translation: TranslationRecord | null; status: 'idle' | 'cache-hit' | 'inferring' | 'error' };
  // cache check — sync; if miss, дёргает TranslationService #4 в background
```

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

**`ALLOWLIST`** — массив ключей из CLAUDE.md (см. секцию Управление состоянием).
Только non-credential preferences. Никаких секретов, токенов, кредов.

**Cold-start race с UnistylesRuntime:**
`StyleSheet.configure()` в `theme/unistyles.ts` читает `themeId` из стора
синхронно. AsyncStorage — async. На cold-start стор стартует с
`DEFAULT_SETTINGS`, потом hydrate асинхронно. Решение:
- При rehydrate из persist хук `onRehydrateStorage` вызывает `applyTheme()`
  с восстановленным `themeId` → ShadowTree обновится за один кадр после
  splash hide.
- Альтернатива: показывать SplashScreen до завершения rehydrate
  (`useSettingsStore.persist.hasHydrated()`). Это правильный путь — добавим
  в `app/_layout.tsx` параллельно с `i18nReady`.

### 6.4 OPDS креды (SecureStore)

**Flow добавления каталога:**
1. User вводит URL и опционально username/password.
2. Парсим URL: если `user:pass@` в URL — извлекаем, удаляем из URL.
3. Записываем сlean-URL в `OPDSCatalog.url`.
4. Если creds есть — пишем в SecureStore с ключом `opds:{catalog_id}`,
   значение `JSON.stringify({username, password})`.
5. `OPDSCatalog.requires_auth = true`.

**Flow чтения каталога (в #5 Library):**
1. По `catalog_id` читаем `OPDSCatalog.url` из БД.
2. Если `requires_auth` — читаем `opds:{catalog_id}` из SecureStore.
3. HTTP-запрос с `Authorization: Basic base64(username:password)`.

**Удаление:** при delete каталога — также `SecureStore.deleteItemAsync('opds:'+id)`.

### 6.5 SHA-256 cache key

```ts
// src/services/translation/cacheKey.ts
import * as Crypto from 'expo-crypto';

export async function computeCacheKey(
  word: string,
  contextWindow: string,
  bookLanguage: BookLanguage,
  nativeLanguage: NativeLanguage,
): Promise<string> {
  const normalized = word.toLowerCase().normalize('NFC');
  const contextNormalized = contextWindow.normalize('NFC');
  const input = `${normalized}\x00${contextNormalized}\x00${bookLanguage}-${nativeLanguage}`;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input,
  );
  return hash.slice(0, 32);
}
```

`\x00` separator чтобы избежать коллизий между значениями полей.

### 6.6 Backup exclusion

**iOS:** SQLite-файл WatermelonDB лежит в `Library/Application Support/`.
Через `expo-file-system` API после `database.createDatabase()` устанавливаем:
```ts
import * as FileSystem from 'expo-file-system';
await FileSystem.setBackupAttributeAsync(dbPath, { iCloudBackupEnabled: false });
```
Альтернатива — config plugin `withInfoPlist` для `NSURLIsExcludedFromBackupKey`
на сам DB файл через post-install hook.

**Android:** `app.json` → `android.allowBackup: false` ИЛИ custom
`<full-backup-content>` с `<exclude domain="database"/>`. Выбираем
**granular exclusion** — `<full-backup-content>` правила:
```xml
<full-backup-content>
  <include domain="file" path="Books/"/>
  <exclude domain="database" path="watermelon.db"/>
  <exclude domain="database" path="watermelon.db-journal"/>
  <exclude domain="database" path="watermelon.db-shm"/>
  <exclude domain="database" path="watermelon.db-wal"/>
</full-backup-content>
```

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
  if (/<!DOCTYPE[^>]*\b(ENTITY|SYSTEM|PUBLIC)\b/i.test(source)) {
    throw new Error('XML DOCTYPE with external entities not allowed');
  }
  // ... парсинг через выбранную lib (см. #3 для FB2, #5 для OPDS — но
  // правила в этом файле едины)
}
```

В #2 пишем тесты для:
- Размер cap (50MB / 5MB)
- Reject DOCTYPE с ENTITY/SYSTEM/PUBLIC
- Reject billion-laughs (>1000 entity expansion)
- Reject max depth >100

Сам парсер в #2 — НЕ реализуем, только signature + tests. Реализация в #3/#5.

---

## 7. Performance budgets

- **Cold-start with hydration:** <800ms на Pixel 7 / iPhone 13 (от запуска
  app до showing onboarding/library). DB open + persist rehydrate +
  i18n init параллельно через `Promise.all`.
- **Reader word lookup (`useWordStatus`):** <10ms cache hit (через WatermelonDB
  `find` с индексом). >10ms — recompute планер deck.
- **Translation cache hit:** <5ms (in-memory LRU поверх DB).
- **Deck queue load (50 cards):** <30ms — query с partial index по
  `(fsrs_state, fsrs_next_review)`.
- **Book list (10 книг):** <20ms — `observe()` + map в DTO.

In-memory LRU для translation cache: 200 entries последних tap-words.
Эвикция при превышении — простой Map с insertion order (Map iterator
сохраняет порядок).

---

## 8. Testing strategy

**Unit-тесты на каждый repository** — in-memory LokiJSAdapter:
```ts
import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

function createTestDb(): Database {
  return new Database({
    adapter: new LokiJSAdapter({ schema, dbName: 'test', useWebWorker: false, useIncrementalIndexedDB: false }),
    modelClasses: [BookModel, ChapterModel, /* ... */],
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
   ~200 байт = 10MB. Acceptable для оффлайн-приложения.
3. **Очистка orphan WordOccurrence при delete book?** Через WatermelonDB
   cascade-by-relation. Repository.deleteBook вызывает batch delete всех
   связанных таблиц (book → chapters → reading_position → bookmarks →
   word_occurrences для этой книги).
4. **OPDS preset-каталоги?** В #2 НЕ seedим. В #5 (Library) — добавим
   3-5 публичных каталогов как preset.
5. **Borges fixture в DB?** На старте приложения если БД пустая —
   добавляем 1 demo-книгу (Borges sample). Для удобства разработки.
   Решение: ДА в #2, в seed-сервисе. Можно отключить через env var.
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
6. **Cache key utility**: `src/services/translation/cacheKey.ts` + tests.
7. **Safe XML parser signature**: `src/services/xml/safeParser.ts` +
   tests (без реализации парсинга — только защитные проверки).
8. **Zustand persist**: подключить `persist` middleware к SettingsStore,
   определить ALLOWLIST, написать `onRehydrateStorage` hook → applyTheme.
9. **App root integration**: обновить `app/_layout.tsx` — ждать
   `Promise.all([i18nReady, dbReady, settingsHydrated])` до splash hide.
10. **Backup exclusion**: вызвать `setBackupAttributeAsync` после
    `createDatabase`, обновить `app.json` Android `<full-backup-content>`.
11. **Seed fixture (Borges)**: на пустой БД добавить sample book + chapter.
12. **Data hooks**: `src/hooks/data/use*` — 8 хуков + tests.
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
- Safe XML parser отвергает DOCTYPE с ENTITY (test).
- `npx tsc --noEmit` 0 errors.
- `npx jest` 100% passing.
- Linter clean.

---

## 12. Risks

- **WatermelonDB + RN 0.81 + new arch:** проверить compatibility до
  начала имплементации. Если есть issue — fallback на op-sqlite + Drizzle
  (но это меняет всё подход).
- **AsyncStorage + Zustand persist + cold-start race:** требует тщательного
  тестирования. Splash screen должен ждать hydrate.
- **expo-secure-store на iOS Simulator:** работает через Keychain
  (sandboxed), тесты проходят. На реальном устройстве — также.
- **Decorators babel-plugin:** должен быть в правильной позиции в plugin
  order (legacy decorators before TS plugin). Проверить.

---

## 13. Out of scope (явное упоминание)

- Cloud sync (v2+, ничего не закладываем в #2)
- SQLCipher (не нужен в v1)
- E2E тесты (Foundation не имеет — добавим в pre-release sprint)
- Performance benchmarks через автоматизированные тесты (manual smoke в #2)
- Analytics / telemetry (см. observability policy в CLAUDE.md)
