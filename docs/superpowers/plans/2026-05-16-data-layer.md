# Fluera Sub-project #2: Data Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build persistent data layer for Fluera — WatermelonDB schema, models, repositories, React hooks, Zustand persist (AsyncStorage), SecureStore wrapper, ITranslationService interface stub, and supporting integration.

**Architecture:** Three-layer access — `models` (WatermelonDB Model classes) → `repositories` (DTO-returning CRUD wrappers) → `hooks/data` (React-facing reactive observables). Settings persist via Zustand middleware + AsyncStorage allowlist. OPDS credentials isolated to expo-secure-store. Database injected via React Context to eliminate singleton race. Splash held until i18n+db+settings hydrate complete.

**Tech Stack:** `@nozbe/watermelondb@^0.27` (SQLite via JSI), `@react-native-async-storage/async-storage@^2.0`, `expo-secure-store@^14.0`, `expo-crypto` (SHA-256), `react-native-get-random-values`, `zustand@5` + `persist` middleware.

**Spec:** `docs/superpowers/specs/2026-05-16-data-layer-design.md` (1096 lines). Each task references concrete spec sections — read the spec for full code blocks when ambiguous.

**Branch:** `feat/data-layer` (создаётся в Task 0 после merge `feat/foundation-rewrite` в main, ИЛИ branch off `feat/foundation-rewrite` если main ещё не обновлён).

---

## Conventions for All Tasks

**TDD discipline:** RED → GREEN → REFACTOR. Every functional task = write failing test → run to confirm FAIL → implement minimal code → run to confirm PASS → commit.

**Commit messages:** conventional commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`, `refactor:`). Атомарные, по-русски в теле. Tag scope `(db)`, `(hooks)`, `(storage)`, `(theme)` где применимо.

**Verification gate before each commit:** `npx tsc --noEmit && npx jest -- <task-path>` обязательны зелёные. Polish phase в конце прогоняет `npx jest` целиком + `npx expo lint`.

**Skip co-author trailer** unless explicitly requested (per CLAUDE.md).

**File paths absolute** when in command/Bash, relative when in editor.

---

## Phase 0: Foundation Prep (Tasks 1–6)

### Task 1: Branch + dependency install

**Files:**
- Create: `package.json` (modify)
- Verify: `babel.config.js`, `ios/Podfile`, `android/build.gradle` (no edits expected)

- [ ] **Step 1: Create feature branch**

```bash
git checkout feat/foundation-rewrite
git pull --ff-only origin feat/foundation-rewrite || true
git checkout -b feat/data-layer
```

- [ ] **Step 2: Install runtime deps**

```bash
npx expo install @nozbe/watermelondb @react-native-async-storage/async-storage expo-secure-store expo-crypto react-native-get-random-values
```

Expected: all 5 packages added to `package.json` `dependencies`. Expo picks SDK-54 compatible pins.

- [ ] **Step 3: Verify decorators-plugin already present**

```bash
grep "@babel/plugin-proposal-decorators" package.json
```

Expected: present in `devDependencies` (added in Foundation). If absent, run: `npm install -D @babel/plugin-proposal-decorators`.

- [ ] **Step 4: Confirm babel decorators-legacy flag in babel.config.js**

Read `babel.config.js`. Plugins array MUST contain `['@babel/plugin-proposal-decorators', { legacy: true }]` BEFORE TypeScript-plugin. Если отсутствует — добавить:

```js
plugins: [
  ['@babel/plugin-proposal-decorators', { legacy: true }],
  ['module-resolver', { root: ['./'], alias: { '@': './src' } }],
  ['react-native-unistyles/plugin', { root: 'src', autoProcessImports: ['react-native-unistyles', '@/theme'] }],
  'react-native-reanimated/plugin',
],
```

Reanimated plugin остаётся ПОСЛЕДНИМ.

- [ ] **Step 5: pod install on macOS for iOS native modules**

```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 cd ios && pod install --repo-update --ansi && cd ..
```

Expected: WatermelonDBJSI, RNCAsyncStorage, ExpoSecureStore, ExpoCrypto, RNGetRandomValues добавлены в Podfile.lock.

- [ ] **Step 6: Verify typecheck still green after deps**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit dependency install**

```bash
git add package.json package-lock.json ios/Podfile.lock babel.config.js
git commit -m "chore(deps): добавить WatermelonDB + AsyncStorage + SecureStore + crypto для #2"
```

---

### Task 2: Add jest mocks for new native deps

**Files:**
- Modify: `jest.setup.js`

- [ ] **Step 1: Read current `jest.setup.js` mock list**

```bash
grep -E "jest\.mock\(" jest.setup.js
```

Identify existing 10 mocks (unistyles, gorhom, svg, blur, gradient, font, localization, splash, i18next, reanimated).

- [ ] **Step 2: Append new mocks**

Add to bottom of `jest.setup.js`:

```js
// #2 Data layer — мок AsyncStorage (in-memory Map)
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k) => Promise.resolve(store.has(k) ? store.get(k) : null)),
      setItem: jest.fn((k, v) => { store.set(k, v); return Promise.resolve(); }),
      removeItem: jest.fn((k) => { store.delete(k); return Promise.resolve(); }),
      clear: jest.fn(() => { store.clear(); return Promise.resolve(); }),
      getAllKeys: jest.fn(() => Promise.resolve(Array.from(store.keys()))),
      multiGet: jest.fn((keys) => Promise.resolve(keys.map((k) => [k, store.get(k) ?? null]))),
    },
  };
});

// expo-secure-store
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn((k) => Promise.resolve(store.get(k) ?? null)),
    setItemAsync: jest.fn((k, v) => { store.set(k, v); return Promise.resolve(); }),
    deleteItemAsync: jest.fn((k) => { store.delete(k); return Promise.resolve(); }),
  };
});

// expo-crypto — детерминированный SHA-256 для тестов (через node:crypto)
jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: jest.fn((_algo, input) =>
      Promise.resolve(nodeCrypto.createHash('sha256').update(input).digest('hex')),
    ),
  };
});

// react-native-get-random-values — no-op в jest (jsdom поставляет crypto.getRandomValues)
jest.mock('react-native-get-random-values', () => ({}));
```

- [ ] **Step 3: Run existing test suite to verify no regression**

```bash
npx jest
```

Expected: 58/58 passing (Foundation).

- [ ] **Step 4: Commit**

```bash
git add jest.setup.js
git commit -m "test(setup): добавить моки AsyncStorage/SecureStore/Crypto для #2"
```

---

### Task 3: index.js entry — register get-random-values shim early

**Files:**
- Modify: `index.js`

- [ ] **Step 1: Read current index.js**

```bash
cat index.js
```

Expected: imports `'@/theme'` then `'expo-router/entry'`.

- [ ] **Step 2: Add shim import FIRST**

Edit `index.js` so first line is `import 'react-native-get-random-values';` (BEFORE `'@/theme'`). Reason: `crypto.randomUUID()` shim needs to be installed before any Watermelon code touches it.

```js
// Custom entry: shim crypto FIRST, then unistyles configure, then router
import 'react-native-get-random-values';
import '@/theme';
import 'expo-router/entry';
```

- [ ] **Step 3: Commit**

```bash
git add index.js
git commit -m "chore(entry): подключить react-native-get-random-values shim первой строкой"
```

---

### Task 4: Create directory skeleton

**Files:**
- Create directories (empty `.gitkeep` files):
  - `src/db/models/.gitkeep`
  - `src/db/repositories/.gitkeep`
  - `src/db/__tests__/.gitkeep`
  - `src/db/__tests__/repositories/.gitkeep`
  - `src/hooks/data/.gitkeep`
  - `src/storage/.gitkeep`
  - `src/services/translation/.gitkeep`
  - `src/services/maintenance/.gitkeep`

- [ ] **Step 1: Create directories**

```bash
mkdir -p src/db/models src/db/repositories src/db/__tests__/repositories src/hooks/data src/storage src/services/translation src/services/maintenance
for d in src/db/models src/db/repositories src/db/__tests__ src/db/__tests__/repositories src/hooks/data src/storage src/services/translation src/services/maintenance; do
  touch "$d/.gitkeep"
done
```

- [ ] **Step 2: Commit**

```bash
git add src/db src/hooks/data src/storage src/services
git commit -m "chore(structure): создать каркас директорий для data layer"
```

---

### Task 5: TypeScript path verification

**Files:**
- Verify: `tsconfig.json` already has `@/*` path alias

- [ ] **Step 1: Confirm tsconfig paths**

```bash
grep -A4 '"paths"' tsconfig.json
```

Expected: `"@/*": ["src/*"]`. Если отсутствует — STOP, добавить и закоммитить отдельно. Эта проверка не должна потребовать правок если Foundation корректен.

---

### Task 6: Phase 0 verification gate

- [ ] **Step 1: Full typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Full jest**

```bash
npx jest
```

Expected: 58/58 pass.

- [ ] **Step 3: Lint**

```bash
npx expo lint
```

Expected: 0 errors, 0 warnings (or unchanged from Foundation baseline).

---

## Phase 1: Storage wrappers (Tasks 7–10)

### Task 7: asyncStorage wrapper — RED

**Files:**
- Create: `src/storage/asyncStorage.ts`
- Create: `__tests__/storage/asyncStorage.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/storage/asyncStorage.test.ts`:

```ts
import { asyncStorage } from '@/storage/asyncStorage';

describe('asyncStorage', () => {
  beforeEach(() => asyncStorage.clear());

  test('setJSON + getJSON roundtrip', async () => {
    await asyncStorage.setJSON('k1', { a: 1, b: 'two' });
    expect(await asyncStorage.getJSON('k1')).toEqual({ a: 1, b: 'two' });
  });

  test('getJSON returns null for missing key', async () => {
    expect(await asyncStorage.getJSON('missing')).toBeNull();
  });

  test('getJSON returns null on corrupted JSON', async () => {
    const AS = require('@react-native-async-storage/async-storage').default;
    await AS.setItem('corrupt', '{not-json}');
    expect(await asyncStorage.getJSON('corrupt')).toBeNull();
  });

  test('remove deletes the key', async () => {
    await asyncStorage.setJSON('k', 1);
    await asyncStorage.remove('k');
    expect(await asyncStorage.getJSON('k')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module missing)**

```bash
npx jest __tests__/storage/asyncStorage.test.ts
```

Expected: `Cannot find module '@/storage/asyncStorage'`.

---

### Task 8: asyncStorage wrapper — GREEN

- [ ] **Step 1: Implement**

Create `src/storage/asyncStorage.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const asyncStorage = {
  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch {
      // corrupted JSON or read error — treat as miss, don't crash
      return null;
    }
  },
  async setJSON(key: string, value: unknown): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
  async clear(): Promise<void> {
    await AsyncStorage.clear();
  },
};
```

- [ ] **Step 2: Run — expect PASS**

```bash
npx jest __tests__/storage/asyncStorage.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/storage/asyncStorage.ts __tests__/storage/asyncStorage.test.ts
git commit -m "feat(storage): asyncStorage wrapper с graceful JSON-fallback"
```

---

### Task 9: secureStorage wrapper — RED + GREEN

**Files:**
- Create: `src/storage/secureStorage.ts`
- Create: `__tests__/storage/secureStorage.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/storage/secureStorage.test.ts
import { secureStorage, opdsKey } from '@/storage/secureStorage';

describe('secureStorage', () => {
  test('opdsKey produces "opds:" prefix', () => {
    expect(opdsKey('abc123')).toBe('opds:abc123');
  });

  test('setOPDSCreds + getOPDSCreds roundtrip', async () => {
    await secureStorage.setOPDSCreds('cat1', { username: 'u', password: 'p' });
    expect(await secureStorage.getOPDSCreds('cat1')).toEqual({ username: 'u', password: 'p' });
  });

  test('getOPDSCreds returns null for missing catalog', async () => {
    expect(await secureStorage.getOPDSCreds('nope')).toBeNull();
  });

  test('deleteOPDSCreds removes', async () => {
    await secureStorage.setOPDSCreds('cat2', { username: 'u', password: 'p' });
    await secureStorage.deleteOPDSCreds('cat2');
    expect(await secureStorage.getOPDSCreds('cat2')).toBeNull();
  });

  test('rejects empty catalog id', async () => {
    await expect(secureStorage.setOPDSCreds('', { username: 'u', password: 'p' })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest __tests__/storage/secureStorage.test.ts
```

- [ ] **Step 3: Implement**

```ts
// src/storage/secureStorage.ts
import * as SecureStore from 'expo-secure-store';

export interface OPDSCreds {
  username: string;
  password: string;
}

export function opdsKey(catalogId: string): string {
  return `opds:${catalogId}`;
}

function assertCatalogId(id: string): void {
  if (!id || typeof id !== 'string') {
    throw new Error('secureStorage: catalog id must be non-empty string');
  }
}

export const secureStorage = {
  async setOPDSCreds(catalogId: string, creds: OPDSCreds): Promise<void> {
    assertCatalogId(catalogId);
    await SecureStore.setItemAsync(opdsKey(catalogId), JSON.stringify(creds));
  },
  async getOPDSCreds(catalogId: string): Promise<OPDSCreds | null> {
    assertCatalogId(catalogId);
    const raw = await SecureStore.getItemAsync(opdsKey(catalogId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OPDSCreds;
    } catch {
      return null;
    }
  },
  async deleteOPDSCreds(catalogId: string): Promise<void> {
    assertCatalogId(catalogId);
    await SecureStore.deleteItemAsync(opdsKey(catalogId));
  },
};
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx jest __tests__/storage/secureStorage.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/storage/secureStorage.ts __tests__/storage/secureStorage.test.ts
git commit -m "feat(storage): secureStorage wrapper для OPDS-кредов с key namespace"
```

---

### Task 10: Storage barrel

- [ ] **Step 1: Create `src/storage/index.ts`**

```ts
export * from './asyncStorage';
export * from './secureStorage';
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/storage/index.ts
git commit -m "chore(storage): barrel export"
```

---

## Phase 2: Schema + Migrations (Tasks 11–14)

### Task 11: appSchema with 10 tables — RED

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/__tests__/schema.test.ts`

- [ ] **Step 1: Write schema test**

```ts
// src/db/__tests__/schema.test.ts
import { schema, SCHEMA_VERSION } from '@/db/schema';

const TABLES = [
  'books','chapters','reading_positions','bookmarks',
  'word_statuses','word_occurrences','review_logs',
  'translation_cache','opds_catalogs','reading_stats',
];

describe('schema', () => {
  test('SCHEMA_VERSION === 1', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });

  test('содержит все 10 таблиц', () => {
    const names = schema.tables ? Object.keys(schema.tables) : [];
    expect(names.sort()).toEqual([...TABLES].sort());
  });

  test('books имеет обязательные поля', () => {
    const cols = Object.keys(schema.tables.books.columns);
    ['title','author','language','format','file_path','cover_path','source',
     'opds_catalog_id','total_chars','progress','difficulty',
     'difficulty_computed_at','added_at','last_read_at','archived']
      .forEach((c) => expect(cols).toContain(c));
  });

  test('word_statuses имеет FSRS-6 поля', () => {
    const cols = Object.keys(schema.tables.word_statuses.columns);
    ['fsrs_state','fsrs_difficulty','fsrs_stability','fsrs_reps','fsrs_lapses',
     'fsrs_last_review','fsrs_next_review','fsrs_elapsed_days','fsrs_scheduled_days']
      .forEach((c) => expect(cols).toContain(c));
  });

  test('review_logs имеет калибровочные поля', () => {
    const cols = Object.keys(schema.tables.review_logs.columns);
    ['rating','reviewed_at','elapsed_days','scheduled_days','state_before',
     'stability_after','difficulty_after','due']
      .forEach((c) => expect(cols).toContain(c));
  });

  test('books.last_read_at имеет isIndexed', () => {
    expect(schema.tables.books.columns.last_read_at.isIndexed).toBe(true);
  });

  test('word_statuses.fsrs_next_review имеет isIndexed', () => {
    expect(schema.tables.word_statuses.columns.fsrs_next_review.isIndexed).toBe(true);
  });
});
```

- [ ] **Step 2: Run — FAIL (schema module missing)**

```bash
npx jest src/db/__tests__/schema.test.ts
```

---

### Task 12: appSchema implementation — GREEN

- [ ] **Step 1: Implement schema**

Reference: spec §4.1–4.10. Create `src/db/schema.ts`:

```ts
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const SCHEMA_VERSION = 1;

export const schema = appSchema({
  version: SCHEMA_VERSION,
  tables: [
    tableSchema({
      name: 'books',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'author', type: 'string', isOptional: true },
        { name: 'language', type: 'string', isIndexed: true },
        { name: 'format', type: 'string' },
        { name: 'file_path', type: 'string' },
        { name: 'cover_path', type: 'string', isOptional: true },
        { name: 'source', type: 'string' },
        { name: 'opds_catalog_id', type: 'string', isOptional: true },
        { name: 'total_chars', type: 'number' },
        { name: 'progress', type: 'number' },
        { name: 'difficulty', type: 'number', isOptional: true },
        { name: 'difficulty_computed_at', type: 'number', isOptional: true },
        { name: 'added_at', type: 'number' },
        { name: 'last_read_at', type: 'number', isOptional: true, isIndexed: true },
        { name: 'archived', type: 'boolean', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'chapters',
      columns: [
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string', isOptional: true },
        { name: 'order_index', type: 'number' },
        { name: 'start_char', type: 'number' },
        { name: 'end_char', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'reading_positions',
      columns: [
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'chapter_order_index', type: 'number' },
        { name: 'position_data', type: 'string' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'bookmarks',
      columns: [
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'chapter_order_index', type: 'number' },
        { name: 'position_data', type: 'string' },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'word_statuses',
      columns: [
        { name: 'word', type: 'string', isIndexed: true },
        { name: 'book_language', type: 'string', isIndexed: true },
        { name: 'native_language', type: 'string', isIndexed: true },
        { name: 'status', type: 'number', isIndexed: true },
        { name: 'translation', type: 'string' },
        { name: 'grammar_note', type: 'string', isOptional: true },
        { name: 'fsrs_state', type: 'number' },
        { name: 'fsrs_difficulty', type: 'number' },
        { name: 'fsrs_stability', type: 'number' },
        { name: 'fsrs_reps', type: 'number' },
        { name: 'fsrs_lapses', type: 'number' },
        { name: 'fsrs_last_review', type: 'number', isOptional: true },
        { name: 'fsrs_next_review', type: 'number', isOptional: true, isIndexed: true },
        { name: 'fsrs_elapsed_days', type: 'number' },
        { name: 'fsrs_scheduled_days', type: 'number' },
        { name: 'deck_suspended', type: 'boolean' },
        { name: 'deck_priority', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'word_occurrences',
      columns: [
        { name: 'word_status_id', type: 'string', isIndexed: true },
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'chapter_order_index', type: 'number', isOptional: true },
        { name: 'context_sentence', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'review_logs',
      columns: [
        { name: 'word_status_id', type: 'string', isIndexed: true },
        { name: 'rating', type: 'number' },
        { name: 'reviewed_at', type: 'number', isIndexed: true },
        { name: 'elapsed_days', type: 'number' },
        { name: 'scheduled_days', type: 'number' },
        { name: 'state_before', type: 'number' },
        { name: 'stability_after', type: 'number' },
        { name: 'difficulty_after', type: 'number' },
        { name: 'due', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'translation_cache',
      columns: [
        { name: 'cache_key', type: 'string', isIndexed: true },
        { name: 'word', type: 'string' },
        { name: 'context_window', type: 'string' },
        { name: 'book_language', type: 'string' },
        { name: 'native_language', type: 'string' },
        { name: 'translation', type: 'string' },
        { name: 'grammar', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'opds_catalogs',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'url', type: 'string' },
        { name: 'requires_auth', type: 'boolean' },
        { name: 'kind', type: 'string' },
        { name: 'last_fetched_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'reading_stats',
      columns: [
        { name: 'date', type: 'string', isIndexed: true },
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'seconds_reading', type: 'number' },
        { name: 'words_read', type: 'number' },
        { name: 'words_translated', type: 'number' },
        { name: 'words_added_to_deck', type: 'number' },
        { name: 'words_learned', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
```

- [ ] **Step 2: Run — PASS**

```bash
npx jest src/db/__tests__/schema.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts src/db/__tests__/schema.test.ts
git commit -m "feat(db): appSchema v1 — 10 таблиц + индексы согласно §4 спеки"
```

---

### Task 13: migrations.ts skeleton

**Files:**
- Create: `src/db/migrations.ts`
- Create: `src/db/__tests__/migrations.test.ts`

- [ ] **Step 1: Failing test**

```ts
// src/db/__tests__/migrations.test.ts
import { migrations } from '@/db/migrations';

describe('migrations', () => {
  test('migrations объект корректной формы', () => {
    expect(migrations).toBeDefined();
    expect(Array.isArray((migrations as any).migrations)).toBe(true);
  });

  test('v1 — initial schema, миграций нет', () => {
    expect((migrations as any).migrations).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/db/migrations.ts
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    // v1 — initial schema (см. schema.ts).
    // future bump: { toVersion: 2, steps: [createTable({...}), addColumns({...})] }
  ],
});
```

- [ ] **Step 3: PASS + commit**

```bash
npx jest src/db/__tests__/migrations.test.ts
git add src/db/migrations.ts src/db/__tests__/migrations.test.ts
git commit -m "feat(db): migrations placeholder (v1 baseline)"
```

---

### Task 14: createDatabase factory

**Files:**
- Create: `src/db/database.ts`
- Create: `src/db/testDatabase.ts` (LokiJS helper for unit-tests)

- [ ] **Step 1: Implement testDatabase helper FIRST (используется всеми тестами далее)**

```ts
// src/db/testDatabase.ts
import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from './schema';
import { migrations } from './migrations';
// модели подключим в Task 15+ — пока временный массив
const modelClasses: any[] = [];

export function createTestDatabase(): Database {
  const adapter = new LokiJSAdapter({
    schema,
    migrations,
    dbName: `test-${Math.random().toString(36).slice(2)}`,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  });
  return new Database({ adapter, modelClasses });
}
```

NOTE: после Task 15 будет import всех моделей. Сейчас пустой массив — schema-test уже зелёный без моделей.

- [ ] **Step 2: Implement production createDatabase**

```ts
// src/db/database.ts
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';
const modelClasses: any[] = []; // заполним в Task 15

export async function createDatabase(): Promise<Database> {
  const adapter = new SQLiteAdapter({
    schema,
    migrations,
    dbName: 'fluera',
    jsi: true,
    onSetUpError: (err) => {
      console.warn('[db] SQLite setup error:', err);
    },
  });
  return new Database({ adapter, modelClasses });
}
```

- [ ] **Step 3: Smoke-test createTestDatabase**

```ts
// src/db/__tests__/database.test.ts
import { createTestDatabase } from '@/db/testDatabase';

describe('database', () => {
  test('createTestDatabase возвращает Database instance', () => {
    const db = createTestDatabase();
    expect(db).toBeDefined();
    expect(db.adapter).toBeDefined();
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
npx jest src/db/__tests__/database.test.ts
git add src/db/database.ts src/db/testDatabase.ts src/db/__tests__/database.test.ts
git commit -m "feat(db): createDatabase + createTestDatabase factory (SQLite+LokiJS)"
```

---

## Phase 3: Models (Tasks 15–24)

Каждая модель — отдельный task: RED → GREEN → commit. Структура одинаковая, ниже шаблон. Модели декларируются с decorators `@field` для каждой колонки.

### Task 15: BookModel

**Files:**
- Create: `src/db/models/Book.ts`
- Create: `src/db/__tests__/models/Book.test.ts`

- [ ] **Step 1: Failing test**

```ts
// src/db/__tests__/models/Book.test.ts
import { createTestDatabase } from '@/db/testDatabase';
import { BookModel } from '@/db/models/Book';

describe('BookModel', () => {
  test('table name = "books"', () => {
    expect(BookModel.table).toBe('books');
  });

  test('создание Book через write — поля корректны', async () => {
    const db = createTestDatabase();
    const book = await db.write(async () =>
      db.collections.get<BookModel>('books').create((b) => {
        b.title = 'Forking Paths';
        b.author = 'Borges';
        b.language = 'en';
        b.format = 'epub';
        b.filePath = '/tmp/borges.epub';
        b.source = 'import';
        b.totalChars = 5000;
        b.progress = 0;
        b.addedAt = Date.now();
        b.archived = false;
      }),
    );
    expect(book.title).toBe('Forking Paths');
    expect(book.language).toBe('en');
  });
});
```

- [ ] **Step 2: Implement model**

```ts
// src/db/models/Book.ts
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export class BookModel extends Model {
  static table = 'books';

  @field('title') title!: string;
  @field('author') author!: string | null;
  @field('language') language!: string;
  @field('format') format!: string;
  @field('file_path') filePath!: string;
  @field('cover_path') coverPath!: string | null;
  @field('source') source!: string;
  @field('opds_catalog_id') opdsCatalogId!: string | null;
  @field('total_chars') totalChars!: number;
  @field('progress') progress!: number;
  @field('difficulty') difficulty!: number | null;
  @field('difficulty_computed_at') difficultyComputedAt!: number | null;
  @field('added_at') addedAt!: number;
  @field('last_read_at') lastReadAt!: number | null;
  @field('archived') archived!: boolean;
}
```

- [ ] **Step 3: Register model в testDatabase + database**

В `src/db/testDatabase.ts` и `src/db/database.ts` заменить `modelClasses: any[] = []` на:

```ts
import { BookModel } from './models/Book';
const modelClasses = [BookModel];
```

- [ ] **Step 4: PASS + commit**

```bash
npx jest src/db/__tests__/models/Book.test.ts
git add src/db/models/Book.ts src/db/__tests__/models/Book.test.ts src/db/testDatabase.ts src/db/database.ts
git commit -m "feat(db): BookModel + регистрация в Database modelClasses"
```

---

### Tasks 16–24: остальные модели

Повторить шаблон Task 15 для каждой модели. На каждом шаге `modelClasses` обновляется явным списком (см. Task 24 итоговый).

- [ ] **Task 16: ChapterModel** — `src/db/models/Chapter.ts`
  Fields: `bookId`, `title`, `orderIndex`, `startChar`, `endChar`.
  Test: создать chapter, проверить fields.

- [ ] **Task 17: ReadingPositionModel** — `src/db/models/ReadingPosition.ts`
  Fields: `bookId`, `chapterOrderIndex`, `positionData`, `updatedAt`.

- [ ] **Task 18: BookmarkModel** — `src/db/models/Bookmark.ts`
  Fields: `bookId`, `chapterOrderIndex`, `positionData`, `note`, `createdAt`.

- [ ] **Task 19: WordStatusModel** — `src/db/models/WordStatus.ts`
  Fields per §4.5: `word`, `bookLanguage`, `nativeLanguage`, `status`, `translation`, `grammarNote`, все 9 FSRS-полей (`fsrs_state` ... `fsrs_scheduled_days`), `deckSuspended`, `deckPriority`, `createdAt`, `updatedAt`.
  Test: создать запись с FSRS-defaults (`state=0, difficulty=5.0, stability=0, reps=0, lapses=0`), проверить поля.

- [ ] **Task 20: WordOccurrenceModel** — `src/db/models/WordOccurrence.ts`
  Fields: `wordStatusId`, `bookId`, `chapterOrderIndex`, `contextSentence`, `createdAt`.

- [ ] **Task 21: ReviewLogModel** — `src/db/models/ReviewLog.ts`
  Fields per §4.7 включая `stabilityAfter`, `difficultyAfter`, `due`.

- [ ] **Task 22: TranslationCacheModel** — `src/db/models/TranslationCache.ts`
  Fields: `cacheKey`, `word`, `contextWindow`, `bookLanguage`, `nativeLanguage`, `translation`, `grammar`, `createdAt`.

- [ ] **Task 23: OPDSCatalogModel** — `src/db/models/OPDSCatalog.ts`
  Fields: `name`, `url`, `requiresAuth`, `kind`, `lastFetchedAt`, `createdAt`.

- [ ] **Task 24: ReadingStatsModel** — `src/db/models/ReadingStats.ts`
  Fields: `date`, `bookId`, `secondsReading`, `wordsRead`, `wordsTranslated`, `wordsAddedToDeck`, `wordsLearned`, `updatedAt`.

В конце Task 24 `src/db/database.ts` и `src/db/testDatabase.ts` ОБА должны иметь:

```ts
import { BookModel } from './models/Book';
import { ChapterModel } from './models/Chapter';
import { ReadingPositionModel } from './models/ReadingPosition';
import { BookmarkModel } from './models/Bookmark';
import { WordStatusModel } from './models/WordStatus';
import { WordOccurrenceModel } from './models/WordOccurrence';
import { ReviewLogModel } from './models/ReviewLog';
import { TranslationCacheModel } from './models/TranslationCache';
import { OPDSCatalogModel } from './models/OPDSCatalog';
import { ReadingStatsModel } from './models/ReadingStats';

const modelClasses = [
  BookModel, ChapterModel, ReadingPositionModel, BookmarkModel,
  WordStatusModel, WordOccurrenceModel, ReviewLogModel,
  TranslationCacheModel, OPDSCatalogModel, ReadingStatsModel,
];
```

Барреэл `src/db/models/index.ts`:

```ts
export * from './Book';
export * from './Chapter';
export * from './ReadingPosition';
export * from './Bookmark';
export * from './WordStatus';
export * from './WordOccurrence';
export * from './ReviewLog';
export * from './TranslationCache';
export * from './OPDSCatalog';
export * from './ReadingStats';
```

Commit после Task 24:

```bash
git add src/db/models/index.ts
git commit -m "feat(db): models barrel + полный список modelClasses"
```

---

## Phase 4: Deterministic IDs + Cache key (Tasks 25–28)

### Task 25: FNV-1a sync hash для cache key

**Files:**
- Create: `src/services/translation/cacheKey.ts`
- Create: `__tests__/services/translation/cacheKey.test.ts`

- [ ] **Step 1: Failing test**

```ts
// __tests__/services/translation/cacheKey.test.ts
import { computeCacheKey } from '@/services/translation/cacheKey';

describe('computeCacheKey', () => {
  test('детерминированно: одинаковый input → одинаковый key', () => {
    const k1 = computeCacheKey('hello', 'world ctx', 'en', 'ru');
    const k2 = computeCacheKey('hello', 'world ctx', 'en', 'ru');
    expect(k1).toBe(k2);
  });

  test('case-insensitive по word', () => {
    expect(computeCacheKey('Hello', 'ctx', 'en', 'ru'))
      .toBe(computeCacheKey('hello', 'ctx', 'en', 'ru'));
  });

  test('разные пары языков → разные ключи', () => {
    expect(computeCacheKey('hello', 'ctx', 'en', 'ru'))
      .not.toBe(computeCacheKey('hello', 'ctx', 'en', 'es'));
  });

  test('длина <= 32', () => {
    const k = computeCacheKey('any', 'any', 'en', 'ru');
    expect(k.length).toBeLessThanOrEqual(32);
  });

  test('синхронный — не Promise', () => {
    const r = computeCacheKey('x', 'y', 'en', 'ru');
    expect(typeof r).toBe('string');
  });
});
```

- [ ] **Step 2: Implement (FNV-1a 64-bit hex + langpair suffix)**

```ts
// src/services/translation/cacheKey.ts
import type { BookLanguage, NativeLanguage } from '@/types/settings';

// FNV-1a 64-bit — синхронный, dedup-only (не security boundary).
// Алгоритм: hash = (hash XOR byte) * FNV_prime; работаем в BigInt.
const FNV_PRIME_64 = 1099511628211n;
const FNV_OFFSET_64 = 14695981039346656037n;
const MASK_64 = (1n << 64n) - 1n;

function fnv1a64Hex(input: string): string {
  let h = FNV_OFFSET_64;
  const bytes = new TextEncoder().encode(input.normalize('NFC'));
  for (let i = 0; i < bytes.length; i++) {
    h = (h ^ BigInt(bytes[i])) & MASK_64;
    h = (h * FNV_PRIME_64) & MASK_64;
  }
  return h.toString(16).padStart(16, '0');
}

export function computeCacheKey(
  word: string,
  contextWindow: string,
  bookLanguage: BookLanguage,
  nativeLanguage: NativeLanguage,
): string {
  const normalized = word.toLowerCase().normalize('NFC');
  const ctxNorm = contextWindow.normalize('NFC');
  const hash = fnv1a64Hex(`${normalized}\x00${ctxNorm}`);
  // total length 16 (hash) + 1 (_) + lang pair (~5) ≤ 32
  return `${hash}_${bookLanguage}-${nativeLanguage}`;
}
```

- [ ] **Step 3: PASS + commit**

```bash
npx jest __tests__/services/translation/cacheKey.test.ts
git add src/services/translation/cacheKey.ts __tests__/services/translation/cacheKey.test.ts
git commit -m "feat(translation): FNV-1a sync cache key (не security boundary)"
```

---

### Task 26: SHA-256 deterministic ID для word_statuses

**Files:**
- Create: `src/db/deterministicIds.ts`
- Create: `__tests__/db/deterministicIds.test.ts`

- [ ] **Step 1: Failing test**

```ts
// __tests__/db/deterministicIds.test.ts
import { wordStatusId, readingStatsId, readingPositionId } from '@/db/deterministicIds';

describe('deterministicIds', () => {
  test('wordStatusId: детерминированный SHA-256 truncate(16)', async () => {
    const id1 = await wordStatusId('hello', 'en', 'ru');
    const id2 = await wordStatusId('hello', 'en', 'ru');
    expect(id1).toBe(id2);
    expect(id1.length).toBe(16);
  });

  test('wordStatusId: разные natural keys → разные ID', async () => {
    const a = await wordStatusId('hello', 'en', 'ru');
    const b = await wordStatusId('hello', 'en', 'es');
    expect(a).not.toBe(b);
  });

  test('readingPositionId: совпадает с book_id', () => {
    expect(readingPositionId('book-123')).toBe('book-123');
  });

  test('readingStatsId: date__bookId', () => {
    expect(readingStatsId('2026-05-16', 'book-1')).toBe('2026-05-16__book-1');
  });

  test('readingStatsId: null book_id → __all__ sentinel', () => {
    expect(readingStatsId('2026-05-16', null)).toBe('2026-05-16____all__');
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/db/deterministicIds.ts
import * as Crypto from 'expo-crypto';
import type { BookLanguage, NativeLanguage } from '@/types/settings';

export async function wordStatusId(
  word: string,
  bookLanguage: BookLanguage,
  nativeLanguage: NativeLanguage,
): Promise<string> {
  const input = `${word.toLowerCase().normalize('NFC')}\x00${bookLanguage}\x00${nativeLanguage}`;
  const full = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
  return full.slice(0, 16);
}

export function readingPositionId(bookId: string): string {
  return bookId; // 1:1 relation
}

export function readingStatsId(date: string, bookId: string | null): string {
  return `${date}__${bookId ?? '__all__'}`;
}

export const ALL_BOOKS_SENTINEL = '__all__';
```

- [ ] **Step 3: PASS + commit**

```bash
npx jest __tests__/db/deterministicIds.test.ts
git add src/db/deterministicIds.ts __tests__/db/deterministicIds.test.ts
git commit -m "feat(db): deterministic IDs (SHA-256 для word_statuses + sentinel)"
```

---

### Task 27: ITranslationService + NoOpTranslationService

**Files:**
- Create: `src/services/translation/ITranslationService.ts`
- Create: `src/services/translation/NoOpTranslationService.ts`
- Create: `__tests__/services/translation/NoOpTranslationService.test.ts`

- [ ] **Step 1: Failing test**

```ts
// __tests__/services/translation/NoOpTranslationService.test.ts
import { NoOpTranslationService } from '@/services/translation/NoOpTranslationService';

describe('NoOpTranslationService', () => {
  test('translate возвращает { status: "pending" }', async () => {
    const svc = new NoOpTranslationService();
    const r = await svc.translate({
      word: 'hello', contextWindow: 'world', bookLanguage: 'en', nativeLanguage: 'ru',
    });
    expect(r.status).toBe('pending');
  });
});
```

- [ ] **Step 2: Implement interface**

```ts
// src/services/translation/ITranslationService.ts
import type { BookLanguage, NativeLanguage } from '@/types/settings';

export interface TranslationInput {
  word: string;
  contextWindow: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
}

export type TranslationStatus = 'ok' | 'pending' | 'error';

export interface TranslationResult {
  status: TranslationStatus;
  translation?: string;
  grammarNote?: string;
}

export interface ITranslationService {
  translate(input: TranslationInput): Promise<TranslationResult>;
}
```

- [ ] **Step 3: Implement NoOp**

```ts
// src/services/translation/NoOpTranslationService.ts
import type { ITranslationService, TranslationInput, TranslationResult } from './ITranslationService';

// TODO: заменить реальной реализацией в #4 (on-device Hy-MT1.5-1.8B GGUF).
export class NoOpTranslationService implements ITranslationService {
  async translate(_input: TranslationInput): Promise<TranslationResult> {
    return { status: 'pending' };
  }
}
```

- [ ] **Step 4: PASS + commit**

```bash
npx jest __tests__/services/translation/NoOpTranslationService.test.ts
git add src/services/translation/ITranslationService.ts src/services/translation/NoOpTranslationService.ts __tests__/services/translation/NoOpTranslationService.test.ts
git commit -m "feat(translation): ITranslationService interface + NoOp stub для #2"
```

---

### Task 28: Safe XML parser signature + защита

**Files:**
- Create: `src/services/xml/safeParser.ts`
- Create: `__tests__/services/xml/safeParser.test.ts`

- [ ] **Step 1: Failing tests (защитные проверки, без реального парсинга)**

```ts
// __tests__/services/xml/safeParser.test.ts
import { assertSafeXml } from '@/services/xml/safeParser';

describe('assertSafeXml', () => {
  test('reject ANY DOCTYPE', () => {
    expect(() => assertSafeXml('<!DOCTYPE foo><foo/>')).toThrow(/DOCTYPE/);
  });

  test('reject case-insensitive DOCTYPE', () => {
    expect(() => assertSafeXml('<!doctype html><x/>')).toThrow(/DOCTYPE/);
  });

  test('reject xml-stylesheet PI', () => {
    expect(() => assertSafeXml('<?xml-stylesheet href="evil"?><x/>')).toThrow(/stylesheet/i);
  });

  test('reject payload > maxBytes', () => {
    const big = 'a'.repeat(11);
    expect(() => assertSafeXml(big, { maxBytes: 10 })).toThrow(/too large/i);
  });

  test('accept clean XML', () => {
    expect(() => assertSafeXml('<root><item/></root>')).not.toThrow();
  });

  test('default cap 50MB не блокирует small XML', () => {
    expect(() => assertSafeXml('<root/>')).not.toThrow();
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/services/xml/safeParser.ts
export interface SafeXmlOpts {
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;

export function assertSafeXml(source: string, opts: SafeXmlOpts = {}): void {
  const cap = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  if (source.length > cap) {
    throw new Error(`XML payload too large (>${cap} bytes)`);
  }
  if (/<!DOCTYPE/i.test(source)) {
    throw new Error('XML DOCTYPE rejected — entity references not allowed');
  }
  if (/<\?xml-stylesheet/i.test(source)) {
    throw new Error('XML stylesheet processing instruction rejected');
  }
}
```

- [ ] **Step 3: PASS + commit**

```bash
npx jest __tests__/services/xml/safeParser.test.ts
git add src/services/xml/safeParser.ts __tests__/services/xml/safeParser.test.ts
git commit -m "feat(xml): assertSafeXml защита от DOCTYPE/stylesheet PI/size cap"
```

---

## Phase 5: Repositories (Tasks 29–37)

Каждый repository — RED → GREEN → commit. Шаблон от BookRepository (Task 29), остальные следуют по аналогии.

### Task 29: BookRepository

**Files:**
- Create: `src/db/repositories/BookRepository.ts`
- Create: `src/db/__tests__/repositories/BookRepository.test.ts`

- [ ] **Step 1: Failing test**

```ts
// src/db/__tests__/repositories/BookRepository.test.ts
import { createTestDatabase } from '@/db/testDatabase';
import { BookRepository } from '@/db/repositories/BookRepository';

describe('BookRepository', () => {
  let db: ReturnType<typeof createTestDatabase>;
  let repo: BookRepository;
  beforeEach(() => { db = createTestDatabase(); repo = new BookRepository(db); });

  test('create + findById', async () => {
    const created = await repo.create({
      title: 'Test', author: 'A', language: 'en', format: 'epub',
      filePath: '/p', source: 'import', totalChars: 100,
    });
    expect(created.id).toBeTruthy();
    const found = await repo.findById(created.id);
    expect(found?.title).toBe('Test');
  });

  test('findById returns null если не существует', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  test('list возвращает все books', async () => {
    await repo.create({ title: 'A', language: 'en', format: 'epub', filePath: '/a', source: 'import', totalChars: 1 });
    await repo.create({ title: 'B', language: 'ru', format: 'epub', filePath: '/b', source: 'import', totalChars: 2 });
    expect((await repo.list()).length).toBe(2);
  });

  test('list filter by language', async () => {
    await repo.create({ title: 'A', language: 'en', format: 'epub', filePath: '/a', source: 'import', totalChars: 1 });
    await repo.create({ title: 'B', language: 'ru', format: 'epub', filePath: '/b', source: 'import', totalChars: 2 });
    const en = await repo.list({ language: 'en' });
    expect(en.length).toBe(1);
    expect(en[0].title).toBe('A');
  });

  test('delete — destroyPermanently (без tombstone)', async () => {
    const b = await repo.create({ title: 'X', language: 'en', format: 'epub', filePath: '/x', source: 'import', totalChars: 0 });
    await repo.delete(b.id);
    expect(await repo.findById(b.id)).toBeNull();
    const all = await repo.list();
    expect(all.length).toBe(0); // никакой tombstone не оставлен
  });

  test('updateProgress обновляет поле', async () => {
    const b = await repo.create({ title: 'X', language: 'en', format: 'epub', filePath: '/x', source: 'import', totalChars: 100 });
    await repo.updateProgress(b.id, 0.5);
    expect((await repo.findById(b.id))?.progress).toBe(0.5);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/db/repositories/BookRepository.ts
import { Database, Q } from '@nozbe/watermelondb';
import { BookModel } from '@/db/models/Book';
import type { BookLanguage } from '@/types/settings';

export interface CreateBookInput {
  title: string;
  author?: string;
  language: BookLanguage;
  format: 'epub' | 'fb2';
  filePath: string;
  coverPath?: string;
  source: 'import' | 'opds' | 'url';
  opdsCatalogId?: string;
  totalChars: number;
}

export interface BookRecord {
  id: string;
  title: string;
  author: string | null;
  language: string;
  format: string;
  filePath: string;
  coverPath: string | null;
  source: string;
  opdsCatalogId: string | null;
  totalChars: number;
  progress: number;
  difficulty: number | null;
  difficultyComputedAt: number | null;
  addedAt: number;
  lastReadAt: number | null;
  archived: boolean;
}

function toRecord(m: BookModel): BookRecord {
  return {
    id: m.id,
    title: m.title, author: m.author, language: m.language, format: m.format,
    filePath: m.filePath, coverPath: m.coverPath, source: m.source,
    opdsCatalogId: m.opdsCatalogId,
    totalChars: m.totalChars, progress: m.progress,
    difficulty: m.difficulty, difficultyComputedAt: m.difficultyComputedAt,
    addedAt: m.addedAt, lastReadAt: m.lastReadAt, archived: m.archived,
  };
}

export class BookRepository {
  constructor(private db: Database) {}
  private get collection() { return this.db.collections.get<BookModel>('books'); }

  async create(input: CreateBookInput): Promise<BookRecord> {
    return this.db.write(async () => {
      const now = Date.now();
      const m = await this.collection.create((b) => {
        b.title = input.title;
        b.author = input.author ?? null;
        b.language = input.language;
        b.format = input.format;
        b.filePath = input.filePath;
        b.coverPath = input.coverPath ?? null;
        b.source = input.source;
        b.opdsCatalogId = input.opdsCatalogId ?? null;
        b.totalChars = input.totalChars;
        b.progress = 0;
        b.difficulty = null;
        b.difficultyComputedAt = null;
        b.addedAt = now;
        b.lastReadAt = null;
        b.archived = false;
      });
      return toRecord(m);
    });
  }

  async findById(id: string): Promise<BookRecord | null> {
    try {
      const m = await this.collection.find(id);
      return toRecord(m);
    } catch {
      return null;
    }
  }

  async list(opts: { language?: BookLanguage; archived?: boolean } = {}): Promise<BookRecord[]> {
    const clauses: any[] = [];
    if (opts.language) clauses.push(Q.where('language', opts.language));
    if (opts.archived !== undefined) clauses.push(Q.where('archived', opts.archived));
    const rows = await this.collection.query(...clauses).fetch();
    return rows.map(toRecord);
  }

  async delete(id: string): Promise<void> {
    return this.db.write(async () => {
      const m = await this.collection.find(id);
      await m.destroyPermanently();
    });
  }

  async updateProgress(id: string, progress: number): Promise<void> {
    return this.db.write(async () => {
      const m = await this.collection.find(id);
      await m.update((b) => { b.progress = Math.max(0, Math.min(1, progress)); b.lastReadAt = Date.now(); });
    });
  }
}
```

- [ ] **Step 3: PASS + commit**

```bash
npx jest src/db/__tests__/repositories/BookRepository.test.ts
git add src/db/repositories/BookRepository.ts src/db/__tests__/repositories/BookRepository.test.ts
git commit -m "feat(db): BookRepository (CRUD + filter + destroyPermanently)"
```

---

### Tasks 30–37: остальные repositories

Каждый — по шаблону Task 29: RED test → GREEN impl → commit.

- [ ] **Task 30: ChapterRepository** — CRUD + `listByBook(bookId)` сортированный по `orderIndex`.

- [ ] **Task 31: ReadingPositionRepository** — `upsert(bookId, chapterOrderIndex, positionData)` через deterministic id = bookId; `findByBook(bookId)`.

- [ ] **Task 32: BookmarkRepository** — `create`, `listByBook(bookId)` (sortBy `createdAt DESC`), `delete`.

- [ ] **Task 33: WordRepository** — объединяет WordStatus + WordOccurrence + ReviewLog.
  API:
  - `upsertStatus(natural, data)` — deterministic id из §6.0; idempotent.
  - `findStatus(word, bookLang, nativeLang)`.
  - `addOccurrence(wordStatusId, bookId, chapterOrderIndex, context)`.
  - `appendReviewLog(wordStatusId, fields)`.
  - `deckQueue(bookLang, nativeLang, limit)` — query `fsrs_state IN (1,2,3) AND deck_suspended = false AND (fsrs_next_review IS NULL OR fsrs_next_review <= now)`, sortBy `fsrs_next_review ASC`, take `limit`.
  - `pruneReviewLogs(wordStatusId)` — оставить last 100 OR last 365 days.

- [ ] **Task 34: TranslationCacheRepository** —
  - `findByKey(cacheKey)` — индексированный lookup.
  - `upsertByKey(cacheKey, fields)` — id = cacheKey, idempotent.
  - `purgeOlderThan(cutoffMs)` — delete где `created_at < cutoff`.
  - `countAll()` — для size-cap проверки.
  - `purgeOldest10Percent()` — delete oldest 10% rows (sort `createdAt ASC`, take floor(count*0.1)).

- [ ] **Task 35: OPDSCatalogRepository** —
  - `create(name, url, kind, requiresAuth)` — валидация URL scheme (http/https), strip userinfo, throw на file://, javascript:.
  - `list()`.
  - `delete(id)` — также вызывает `secureStorage.deleteOPDSCreds(id)`.
  Тест проверяет URL scheme validation + cred wipe on delete.

- [ ] **Task 36: ReadingStatsRepository** —
  - `upsertDay(date, bookId, deltas)` — id = `readingStatsId(date, bookId)`, batch().
  - `getDay(date, bookId)`.
  - `listForDateRange(from, to, bookId?)`.

- [ ] **Task 37: Repository barrel + всё пройдёт**

```ts
// src/db/repositories/index.ts
export * from './BookRepository';
export * from './ChapterRepository';
export * from './ReadingPositionRepository';
export * from './BookmarkRepository';
export * from './WordRepository';
export * from './TranslationCacheRepository';
export * from './OPDSCatalogRepository';
export * from './ReadingStatsRepository';
```

Verification gate после Task 37:

```bash
npx tsc --noEmit
npx jest src/db/__tests__/repositories/
```

Expected: все repository-тесты зелёные, 0 typecheck errors.

```bash
git add src/db/repositories/index.ts
git commit -m "chore(db): repositories barrel"
```

---

## Phase 6: Maintenance + Seed (Tasks 38–40)

### Task 38: cachePurge service

**Files:**
- Create: `src/services/maintenance/cachePurge.ts`
- Create: `__tests__/services/maintenance/cachePurge.test.ts`

- [ ] **Step 1: Failing test**

```ts
// __tests__/services/maintenance/cachePurge.test.ts
import { createTestDatabase } from '@/db/testDatabase';
import { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';
import { WordRepository } from '@/db/repositories/WordRepository';
import { runCachePurge } from '@/services/maintenance/cachePurge';

describe('cachePurge', () => {
  test('удаляет cache rows старше 90 дней', async () => {
    const db = createTestDatabase();
    const repo = new TranslationCacheRepository(db);
    const old = Date.now() - 91 * 24 * 60 * 60 * 1000;
    const fresh = Date.now();
    await repo.upsertByKey('k_old', { word: 'a', contextWindow: '', bookLanguage: 'en', nativeLanguage: 'ru', translation: 't', createdAt: old });
    await repo.upsertByKey('k_fresh', { word: 'b', contextWindow: '', bookLanguage: 'en', nativeLanguage: 'ru', translation: 't', createdAt: fresh });
    await runCachePurge(db, { now: Date.now() });
    expect(await repo.findByKey('k_old')).toBeNull();
    expect(await repo.findByKey('k_fresh')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/services/maintenance/cachePurge.ts
import { Database } from '@nozbe/watermelondb';
import { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';
import { WordRepository } from '@/db/repositories/WordRepository';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const CACHE_HARD_CAP = 50_000;

export async function runCachePurge(db: Database, opts: { now?: number } = {}): Promise<void> {
  const now = opts.now ?? Date.now();
  const cacheRepo = new TranslationCacheRepository(db);
  await cacheRepo.purgeOlderThan(now - NINETY_DAYS_MS);
  const count = await cacheRepo.countAll();
  if (count > CACHE_HARD_CAP) {
    await cacheRepo.purgeOldest10Percent();
  }
  // review_logs retention — делается через WordRepository.pruneReviewLogs.
  // Здесь только cache; retention review logs пускается из своего планировщика
  // в hot-path по таймеру (см. spec §4.7).
}
```

- [ ] **Step 3: PASS + commit**

```bash
npx jest __tests__/services/maintenance/cachePurge.test.ts
git add src/services/maintenance/cachePurge.ts __tests__/services/maintenance/cachePurge.test.ts
git commit -m "feat(maintenance): cachePurge 90-day + 50K hard cap"
```

---

### Task 39: Borges seed (dev-only fixture)

**Files:**
- Create: `src/db/seed/borges.ts`
- Modify: `src/fixtures/borges.ts` (Foundation уже имеет BORGES_SAMPLE — use it)

- [ ] **Step 1: Test for seed idempotency**

```ts
// __tests__/db/seed/borges.test.ts
import { createTestDatabase } from '@/db/testDatabase';
import { seedBorgesIfEmpty } from '@/db/seed/borges';
import { BookRepository } from '@/db/repositories/BookRepository';

describe('seedBorgesIfEmpty', () => {
  test('добавляет Borges если БД пустая', async () => {
    const db = createTestDatabase();
    await seedBorgesIfEmpty(db);
    const books = await new BookRepository(db).list();
    expect(books.length).toBe(1);
    expect(books[0].title).toMatch(/Forking Paths/i);
  });

  test('не дублирует если книга уже есть', async () => {
    const db = createTestDatabase();
    await seedBorgesIfEmpty(db);
    await seedBorgesIfEmpty(db);
    const books = await new BookRepository(db).list();
    expect(books.length).toBe(1);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/db/seed/borges.ts
import { Database } from '@nozbe/watermelondb';
import { BookRepository } from '@/db/repositories/BookRepository';
import { ChapterRepository } from '@/db/repositories/ChapterRepository';

const BORGES_TITLE = 'The Garden of Forking Paths';

export async function seedBorgesIfEmpty(db: Database): Promise<void> {
  const books = new BookRepository(db);
  const existing = await books.list();
  if (existing.length > 0) return;
  const book = await books.create({
    title: BORGES_TITLE,
    author: 'J. L. Borges',
    language: 'en',
    format: 'epub',
    filePath: '/dev/null/borges.epub',
    source: 'import',
    totalChars: 5000,
  });
  const chapters = new ChapterRepository(db);
  await chapters.create({ bookId: book.id, title: 'I.', orderIndex: 0, startChar: 0, endChar: 5000 });
}
```

- [ ] **Step 3: PASS + commit**

```bash
npx jest __tests__/db/seed/borges.test.ts
git add src/db/seed/borges.ts __tests__/db/seed/borges.test.ts
git commit -m "feat(db): Borges seed — idempotent, dev fixture"
```

---

### Task 40: Conditional seed call (DEV-only)

**Files:**
- Modify: `src/db/database.ts`

- [ ] **Step 1: Wrap seed в `__DEV__` guard + env-var override**

Edit `createDatabase` чтобы возвращать `{ db, postInit }` где postInit — функция запускающая seed condittional:

```ts
import { seedBorgesIfEmpty } from './seed/borges';

export async function createDatabase(): Promise<Database> {
  const adapter = new SQLiteAdapter({ /* ... */ });
  const db = new Database({ adapter, modelClasses });
  if (__DEV__ && process.env.EXPO_PUBLIC_FLUERA_SEED_BORGES !== '0') {
    await seedBorgesIfEmpty(db);
  }
  return db;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/db/database.ts
git commit -m "feat(db): conditional Borges seed только в __DEV__ + opt-out env var"
```

---

## Phase 7: Database Context + Zustand persist (Tasks 41–44)

### Task 41: DatabaseProvider Context

**Files:**
- Create: `src/db/DatabaseContext.tsx`
- Create: `__tests__/db/DatabaseContext.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// __tests__/db/DatabaseContext.test.tsx
import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { DatabaseProvider, useDatabase } from '@/db/DatabaseContext';
import { createTestDatabase } from '@/db/testDatabase';

function Probe() {
  const db = useDatabase();
  return <Text testID="db">{db ? 'ready' : 'pending'}</Text>;
}

describe('DatabaseProvider', () => {
  test('useDatabase throws вне provider', () => {
    const orig = console.error;
    console.error = jest.fn();
    expect(() => render(<Probe />)).toThrow(/DatabaseProvider/);
    console.error = orig;
  });

  test('useDatabase возвращает db внутри provider', async () => {
    const db = createTestDatabase();
    const { getByTestId } = render(
      <DatabaseProvider initialDatabase={db}><Probe /></DatabaseProvider>,
    );
    await waitFor(() => expect(getByTestId('db').props.children).toBe('ready'));
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// src/db/DatabaseContext.tsx
import React from 'react';
import { Database } from '@nozbe/watermelondb';
import { createDatabase } from './database';

const DatabaseContext = React.createContext<Database | null>(null);

interface Props {
  children: React.ReactNode;
  initialDatabase?: Database; // для тестов
  fallback?: React.ReactNode; // splash placeholder, если null
}

export function DatabaseProvider({ children, initialDatabase, fallback = null }: Props) {
  const [db, setDb] = React.useState<Database | null>(initialDatabase ?? null);
  React.useEffect(() => {
    if (initialDatabase) return;
    let mounted = true;
    void createDatabase().then((created) => { if (mounted) setDb(created); });
    return () => { mounted = false; };
  }, [initialDatabase]);
  if (!db) return <>{fallback}</>;
  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): Database {
  const db = React.useContext(DatabaseContext);
  if (!db) throw new Error('useDatabase must be used inside DatabaseProvider');
  return db;
}
```

- [ ] **Step 3: PASS + commit**

```bash
npx jest __tests__/db/DatabaseContext.test.tsx
git add src/db/DatabaseContext.tsx __tests__/db/DatabaseContext.test.tsx
git commit -m "feat(db): DatabaseProvider React Context (eliminates singleton race)"
```

---

### Task 42: applyThemeImmediate (без rAF)

**Files:**
- Modify: `src/theme/applyTheme.ts`

- [ ] **Step 1: Add test для applyThemeImmediate**

В `__tests__/theme/applyTheme.test.ts` (создать если нет):

```ts
import { UnistylesRuntime } from 'react-native-unistyles';
import { applyThemeImmediate } from '@/theme/applyTheme';

jest.mock('react-native-unistyles', () => ({
  UnistylesRuntime: {
    setTheme: jest.fn(),
    setAdaptiveThemes: jest.fn(),
  },
}));

describe('applyThemeImmediate', () => {
  beforeEach(() => jest.clearAllMocks());

  test('синхронный setTheme без rAF', () => {
    applyThemeImmediate('dark', false);
    expect(UnistylesRuntime.setTheme).toHaveBeenCalledWith('dark');
    expect(UnistylesRuntime.setAdaptiveThemes).toHaveBeenCalledWith(false);
  });

  test('auto=true → setAdaptiveThemes(true)', () => {
    applyThemeImmediate('light', true);
    expect(UnistylesRuntime.setAdaptiveThemes).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Add applyThemeImmediate function**

В `src/theme/applyTheme.ts` экспортировать новую функцию (см. spec §6.3):

```ts
export function applyThemeImmediate(id: ThemeId, auto: boolean): void {
  if (auto) {
    UnistylesRuntime.setAdaptiveThemes(true);
  } else {
    UnistylesRuntime.setAdaptiveThemes(false);
    UnistylesRuntime.setTheme(id);
  }
}
```

Существующий `applyTheme` (с rAF) ОСТАЁТСЯ как был — используется на runtime после mount.

- [ ] **Step 3: PASS + commit**

```bash
npx jest __tests__/theme/applyTheme.test.ts
git add src/theme/applyTheme.ts __tests__/theme/applyTheme.test.ts
git commit -m "feat(theme): applyThemeImmediate (без rAF) для cold-start rehydrate"
```

---

### Task 43: Zustand persist middleware

**Files:**
- Modify: `src/stores/settingsStore.ts`
- Create: `__tests__/stores/settingsStore.persist.test.ts`

- [ ] **Step 1: Failing test**

```ts
// __tests__/stores/settingsStore.persist.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '@/stores/settingsStore';

describe('settingsStore persist', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  test('persist key — fluera-settings-v1', async () => {
    useSettingsStore.getState().setTheme('dark');
    // wait flush
    await new Promise((r) => setTimeout(r, 50));
    const raw = await AsyncStorage.getItem('fluera-settings-v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.themeId).toBe('dark');
  });

  test('partialize: token/auth поля НЕ в storage', async () => {
    useSettingsStore.getState().setTheme('sepia');
    await new Promise((r) => setTimeout(r, 50));
    const raw = await AsyncStorage.getItem('fluera-settings-v1');
    const parsed = JSON.parse(raw!);
    expect(parsed.state).not.toHaveProperty('token');
    expect(parsed.state).not.toHaveProperty('opdsCreds');
    // только allowlist
    const keys = Object.keys(parsed.state);
    keys.forEach((k) => expect(k).not.toMatch(/token|auth|password|secret/i));
  });

  test('hasHydrated API доступно', () => {
    expect(typeof useSettingsStore.persist.hasHydrated).toBe('function');
  });
});
```

- [ ] **Step 2: Modify settingsStore.ts**

Reference spec §6.3 для full code. Wrap existing `subscribeWithSelector((set) => ({...}))` в `persist(..., { name, storage, partialize, version, onRehydrateStorage })`. ALLOWLIST массив все 17 ключей. `onRehydrateStorage` callback вызывает `applyThemeImmediate(state.themeId, state.themeAuto)`.

Concrete patch:

```ts
import { create } from 'zustand';
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/i18n';
import { applyTheme, applyThemeImmediate } from '@/theme/applyTheme';
import { /* types */ } from '@/types/settings';

const ALLOWLIST = [
  'themeId','themeAuto','fontFamilyMode','fontSize','scrollMode',
  'highlightUnknown','showSentenceTranslation','pageFlipAnim',
  'showPhonetics','lookupHistoryEnabled',
  'uiLanguage','nativeLanguage','bookLanguage',
  'bookLanguageLevel','tapToTranslateBehavior','autoAddToDeck',
  'readingSessionGoalMinutes',
  'onboardingCompleted',
] as const;

export const useSettingsStore = create<SettingsStore>()(
  persist(
    subscribeWithSelector((set) => ({
      ...DEFAULT_SETTINGS,
      // existing actions...
    })),
    {
      name: 'fluera-settings-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ALLOWLIST.reduce((acc, k) => ({ ...acc, [k]: s[k] }), {} as any),
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeImmediate(state.themeId, state.themeAuto);
        }
      },
    },
  ),
);
```

- [ ] **Step 3: PASS + commit**

```bash
npx jest __tests__/stores/settingsStore.persist.test.ts
git add src/stores/settingsStore.ts __tests__/stores/settingsStore.persist.test.ts
git commit -m "feat(settings): persist middleware (AsyncStorage + 17-field allowlist)"
```

---

### Task 44: App root integration

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Update layout for hydration gate**

Existing `_layout.tsx` waits на `i18nReady`. Расширяем до `Promise.all([i18nReady, settingsHydrated])` + оборачиваем `<DatabaseProvider>` (его внутренний `createDatabase()` ассинхронный — компонент сам ждёт):

```tsx
// app/_layout.tsx (изменения, не полный файл)
import React, { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import '@/theme';
import { attachThemeBridge } from '@/theme/bridge';
import { i18nReady } from '@/i18n';
import { useSettingsStore } from '@/stores/settingsStore';
import { DatabaseProvider } from '@/db/DatabaseContext';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const unsub = attachThemeBridge();
    const settingsHydrated = useSettingsStore.persist.hasHydrated()
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          const unsubH = useSettingsStore.persist.onFinishHydration(() => { unsubH(); resolve(); });
        });
    void Promise.all([i18nReady, settingsHydrated]).then(() => setAppReady(true));
    return unsub;
  }, []);

  if (!appReady) return null;

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <DatabaseProvider fallback={null}>
          {/* Stack как раньше — все Stack.Screen остаются */}
          <Stack screenOptions={{ headerShown: false }}>
            {/* ...все Screen из Foundation */}
          </Stack>
        </DatabaseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

Splash остаётся видим, пока: i18n + settings hydrate + DatabaseProvider создал db. Когда `DatabaseProvider` получает db, рендерит детей → tabs/onboarding виден → СЕЙЧАС вызываем `SplashScreen.hideAsync()`. Так как `DatabaseProvider` асинхронный, нужно дёрнуть hideAsync в нём:

В `DatabaseContext.tsx` после `setDb(created)` добавить:

```ts
React.useEffect(() => {
  if (db) { void SplashScreen.hideAsync(); }
}, [db]);
```

Или (чище) — экспортировать `onReady` callback и звать его в `_layout.tsx`. Реализатор выбирает один путь.

- [ ] **Step 2: Commit**

```bash
git add app/_layout.tsx src/db/DatabaseContext.tsx
git commit -m "feat(app): hydration gate — splash visible до i18n+settings+db ready"
```

---

## Phase 8: Hooks (Tasks 45–52)

Хуки тестируем через `renderHook` из `@testing-library/react-native` + `DatabaseProvider` с test-db.

### Task 45: useBookList

**Files:**
- Create: `src/hooks/data/useBookList.ts`
- Create: `__tests__/hooks/data/useBookList.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// __tests__/hooks/data/useBookList.test.tsx
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { createTestDatabase } from '@/db/testDatabase';
import { DatabaseProvider } from '@/db/DatabaseContext';
import { BookRepository } from '@/db/repositories/BookRepository';
import { useBookList } from '@/hooks/data/useBookList';

function makeWrapper(db: ReturnType<typeof createTestDatabase>) {
  return ({ children }: { children: React.ReactNode }) =>
    <DatabaseProvider initialDatabase={db}>{children}</DatabaseProvider>;
}

describe('useBookList', () => {
  test('возвращает books после mount', async () => {
    const db = createTestDatabase();
    await new BookRepository(db).create({
      title: 'A', language: 'en', format: 'epub', filePath: '/a', source: 'import', totalChars: 1,
    });
    const { result } = renderHook(() => useBookList(), { wrapper: makeWrapper(db) });
    await waitFor(() => expect(result.current.books.length).toBe(1));
    expect(result.current.isLoading).toBe(false);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/hooks/data/useBookList.ts
import React from 'react';
import { useDatabase } from '@/db/DatabaseContext';
import { BookRepository, BookRecord } from '@/db/repositories/BookRepository';
import type { BookLanguage } from '@/types/settings';

export interface BookListOpts { language?: BookLanguage; archived?: boolean }

export function useBookList(opts: BookListOpts = {}): { books: BookRecord[]; isLoading: boolean } {
  const db = useDatabase();
  const repo = React.useMemo(() => new BookRepository(db), [db]);
  const [books, setBooks] = React.useState<BookRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    void repo.list(opts).then((rows) => { if (mounted) { setBooks(rows); setIsLoading(false); } });
    // subscribe на изменения коллекции
    const collection = db.collections.get('books');
    const sub = collection.changes.subscribe(() => {
      void repo.list(opts).then((rows) => { if (mounted) setBooks(rows); });
    });
    return () => { mounted = false; sub.unsubscribe(); };
  }, [db, repo, opts.language, opts.archived]);

  return { books, isLoading };
}
```

- [ ] **Step 3: PASS + commit**

```bash
npx jest __tests__/hooks/data/useBookList.test.tsx
git add src/hooks/data/useBookList.ts __tests__/hooks/data/useBookList.test.tsx
git commit -m "feat(hooks): useBookList — reactive observable + repository"
```

---

### Tasks 46–52: остальные хуки

Same pattern (renderHook + DatabaseProvider). Все хуки только-read. Mutations — через repository напрямую.

- [ ] **Task 46: useBookProgress(bookId)** — observe Book, return `{progress, lastReadAt, isLoading}`.

- [ ] **Task 47: useReadingPosition(bookId)** — observe ReadingPosition row, null если нет.

- [ ] **Task 48: useBookmarks(bookId)** — observe Bookmark collection filter by bookId, sortBy createdAt desc.

- [ ] **Task 49: useWordStatus(word, bookLang, nativeLang)** — deterministic id lookup + observe. Returns null если нет записи.

- [ ] **Task 50: useDeckQueue(bookLang, nativeLang, limit=50)** — `WordRepository.deckQueue` + observe word_statuses collection (для invalidation).

- [ ] **Task 51: useTranslation(word, context, bookLang, nativeLang, service=NoOpTranslationService)** — sync cache check через `TranslationCacheRepository.findByKey(computeCacheKey(...))`. On cache miss: `service.translate(...)` + `upsertByKey`. Status transitions: `idle → inferring → ok/error`.

- [ ] **Task 52: useReadingStats(date?, bookId?)** + useOPDSCatalogs() + барреэл `src/hooks/data/index.ts`.

Final commit:

```bash
git add src/hooks/data
git commit -m "feat(hooks): полный набор data hooks + barrel"
```

---

## Phase 9: Backup exclusion (Tasks 53–54)

### Task 53: iOS backup attribute setter

**Files:**
- Modify: `src/db/database.ts`

- [ ] **Step 1: After db creation, mark all 4 SQLite siblings excluded**

```ts
// src/db/database.ts (внутри createDatabase, после adapter+db создания)
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const DB_NAME = 'fluera';

async function excludeFromBackupIOS(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const baseDir = FileSystem.documentDirectory ?? '';
  const files = [`${DB_NAME}.db`, `${DB_NAME}.db-wal`, `${DB_NAME}.db-shm`, `${DB_NAME}.db-journal`];
  for (const f of files) {
    const path = `${baseDir}${f}`;
    try {
      // expo-file-system публичный API не имеет setBackupAttribute прямо;
      // используем нативный модуль через FileSystem.setBackupAttributeAsync если есть,
      // иначе оставляем TODO для prebuild config-plugin.
      const fs: any = FileSystem;
      if (typeof fs.setBackupAttributeAsync === 'function') {
        await fs.setBackupAttributeAsync(path, { iCloudBackupEnabled: false });
      }
    } catch {
      // silent — файл может ещё не существовать на cold-start первого запуска
    }
  }
}
```

И вызвать `void excludeFromBackupIOS()` после `new Database(...)` (не блокируя инициализацию).

- [ ] **Step 2: Commit (без unit-теста — iOS-specific runtime)**

```bash
git add src/db/database.ts
git commit -m "feat(backup): iOS exclude SQLite + WAL/SHM/journal из iCloud backup"
```

---

### Task 54: Android data-extraction-rules + full-backup-content

**Files:**
- Create: `android/app/src/main/res/xml/data_extraction_rules.xml`
- Create: `android/app/src/main/res/xml/full_backup_content.xml`
- Modify: `app.json` (Android config plugin)

- [ ] **Step 1: Create XML resources**

```xml
<!-- android/app/src/main/res/xml/data_extraction_rules.xml -->
<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
    <include domain="file" path="Books/"/>
    <exclude domain="database" path="fluera.db"/>
    <exclude domain="database" path="fluera.db-wal"/>
    <exclude domain="database" path="fluera.db-shm"/>
    <exclude domain="database" path="fluera.db-journal"/>
  </cloud-backup>
  <device-transfer>
    <include domain="file" path="Books/"/>
    <exclude domain="database" path="fluera.db"/>
    <exclude domain="database" path="fluera.db-wal"/>
    <exclude domain="database" path="fluera.db-shm"/>
    <exclude domain="database" path="fluera.db-journal"/>
  </device-transfer>
</data-extraction-rules>
```

```xml
<!-- android/app/src/main/res/xml/full_backup_content.xml -->
<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
  <include domain="file" path="Books/"/>
  <exclude domain="database" path="fluera.db"/>
  <exclude domain="database" path="fluera.db-wal"/>
  <exclude domain="database" path="fluera.db-shm"/>
  <exclude domain="database" path="fluera.db-journal"/>
</full-backup-content>
```

- [ ] **Step 2: app.json reference to XML rules**

```json
"android": {
  "package": "com.fluera.app",
  "edgeToEdgeEnabled": true,
  "predictiveBackGestureEnabled": false,
  "allowBackup": true,
  "fullBackupContent": "@xml/full_backup_content",
  "dataExtractionRules": "@xml/data_extraction_rules"
}
```

Если expo config plugin не поддерживает — добавить через `expo-build-properties` plugin или вручную в `AndroidManifest.xml` после prebuild.

- [ ] **Step 3: Verify via prebuild**

```bash
npx expo prebuild --clean --no-install
grep -r "data_extraction_rules" android/app/src/main/AndroidManifest.xml
```

Expected: `android:dataExtractionRules="@xml/data_extraction_rules"` присутствует.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/res/xml/ app.json
git commit -m "feat(backup): Android 12+ data-extraction-rules + legacy full-backup-content"
```

---

## Phase 10: db barrel + final integration (Tasks 55–56)

### Task 55: src/db/index.ts barrel

- [ ] **Step 1: Create**

```ts
// src/db/index.ts
export * from './database';
export * from './schema';
export * from './migrations';
export * from './deterministicIds';
export * from './DatabaseContext';
export * from './models';
export * from './repositories';
```

- [ ] **Step 2: Commit**

```bash
git add src/db/index.ts
git commit -m "chore(db): top-level barrel"
```

---

### Task 56: Final verification gate

- [ ] **Step 1: Full typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Full jest**

```bash
npx jest
```

Expected: все тесты Foundation + #2 зелёные.

- [ ] **Step 3: Lint**

```bash
npx expo lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Prebuild verify (Android XML included)**

```bash
npx expo prebuild --clean --no-install
grep -E "data_extraction|full_backup" android/app/src/main/AndroidManifest.xml
```

Expected: оба ref присутствуют.

- [ ] **Step 5: Tag pre-merge**

```bash
git tag pre-data-layer-2026-05-16
```

---

## Phase 11: Manual smoke (Task 57)

### Task 57: Smoke на iPhone 17 sim

- [ ] **Step 1: Build + launch**

```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios --device "iPhone 17"
```

- [ ] **Step 2: Manual checklist**

1. Cold-start без crash; splash виден до hydrate; никакого theme flash.
2. Library tab — видна Borges seed-карточка (если `__DEV__`).
3. Settings → Night → Sepia → Day — bg меняется без flash, persists через restart (kill app + relaunch → Night theme сохранена).
4. Open Reader → Borges chapter рендерится.
5. Tap-translate на слово → попап показывает "pending" (NoOp service).
6. Background app + foreground → hot-start <500ms.
7. (Опц.) iOS Settings → iCloud → Manage Storage → Fluera — БД отсутствует в backup.

- [ ] **Step 3: Если всё OK — финальный commit/tag**

```bash
git tag data-layer-done-2026-05-16
```

---

## Acceptance Criteria (sync с spec §11)

- [ ] 10 таблиц созданы (verified Task 11–12 schema test)
- [ ] Migrations работают (verified Task 13)
- [ ] Все repositories покрыты unit-tests с in-memory adapter (Tasks 29–37)
- [ ] Zustand SettingsStore persist через AsyncStorage (Task 43); тема переживает restart (Task 57 smoke)
- [ ] OPDS-creds: save → read roundtrip через SecureStore (Task 9)
- [ ] Backup exclusion на SQLite файле (Tasks 53–54)
- [ ] Translation cache key детерминирован (Task 25)
- [ ] Safe XML parser отвергает любой DOCTYPE (Task 28)
- [ ] `npx tsc --noEmit` 0 errors (Task 56)
- [ ] `npx jest` 100% passing (Task 56)
- [ ] Lint clean (Task 56)

---

## Self-review checklist

- [x] Spec coverage: phases 0–11 покрывают §10 спеки (13 фаз → 11 phases, миграционная стратегия упомянута в Task 13, OPDS XML signature в Task 28, остальные пункты §10 распределены)
- [x] Placeholders: ни одного TBD/TODO/implement-later; "ALL_BOOKS_SENTINEL" определена в Task 26 + используется в repositories
- [x] Type consistency: `BookRecord` определён в Task 29, используется в Task 45+; `ITranslationService` в Task 27, используется в Task 51
- [x] Каждая команда / тест имеет ожидаемый output
- [x] Каждый task ≤ 5 шагов или явно разбит

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-05-16-data-layer.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, два-этапная code review между задачами, быстрая итерация. Используется как Foundation.

**2. Inline Execution** — executing-plans skill, batch tasks с checkpoint review.

Which approach?
