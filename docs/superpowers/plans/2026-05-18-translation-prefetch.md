# Translation Prefetch + Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Реализовать sub-project #4.6 — lifecycle state machine для on-device LLM (idle unload + lazy reload + permanent disable), prefetch scheduler с unknown-word detection и MWE/sentence enqueue, battery-aware throttle через `expo-battery`, atomic model upgrade и kernel verification в CI, поверх существующего #4 Translation engine и #4.5 Popup redesign.

**Architecture:** Новый `ModelLifecycleManager` инкапсулирует state machine (`unloaded | loading | ready | inferring | error | error_permanent`), сериализует inference через priority queue (`user > prefetch`) и владеет idle timer + bridges (AppState, Battery). `PrefetchScheduler` подписан на reader scroll/tap события, извлекает kandidate words/MWE/sentences из N+1..N+3 страниц и enqueues prefetch jobs c word-mode budget cap (≤32 tokens, ≤3s) чтобы user tap преемптил at job boundary. Cache `source: 'prefetch'` имеет TTL 30 дней vs on-demand 90.

**Tech Stack:** React Native 0.81.5 + Expo SDK 54, TypeScript strict, Jest 29 + jest-expo, Zustand v5, WatermelonDB 0.28 (schema v3 → v4), `expo-battery` (new), `expo-secure-store`, `expo-file-system` (legacy API + `next` для disk-space), `js-sha256`, llama.rn vendored.

---

## Changelog v1 → v2

Edits applied to v1 of this plan after 3 rounds of code review. Each item lists
the P0 ID and the task(s) where the fix lives.

P0s addressed in v2:

- **A0-1 — 2-queue dispatcher (user > prefetch) preempts at job boundary.** Task 2.2 rewritten: replaces `private serial: Promise<unknown>` with `userQueue` + `prefetchQueue` + `drain()` cooperative loop. Test asserts USER job runs AFTER first prefetch completes, not last.
- **A0-2 — Word-mode 32-token cap on prefetch.** Task 2.2: `runInference` applies `cappedConfig = { ...config, max_tokens: 32 }` when `priority === 'prefetch'`. Two regression tests added.
- **A0-3 — unload() is in-flight aware.** Task 2.1: unload waits for `draining` to settle (queued jobs aborted, current in-flight completes) before `release()`. Test asserts release NOT called while completion pending.
- **A0-5 — Consecutive failure semantics one-shot.** Task 2.4: `failureCounterIncremented` flag prevents concurrent waiters on same failing load from triple-counting one failure. Comment block documents counter reset rules.
- **E0-1 — `getPowerStateAsync` removed, composed from 3 calls.** Task 3.3 + Task 0.3 mock: `Battery.getBatteryLevelAsync` + `getBatteryStateAsync` + `isLowPowerModeEnabledAsync` ran in parallel. `addBatteryStateListener` also wired for charging transitions.
- **E0-2 — SHA-256 chunked streaming via js-sha256.** New Task 0.5 installs `js-sha256`. Task 7.3 defines `sha256OfFile(path)` reading 1 MB chunks via `FileSystem.readAsStringAsync({position, length, encoding: Base64})` + Hermes-safe `atob` → `Uint8Array` → `hasher.update()`.
- **E0-3 — legacy expo-file-system API pinned.** Task 7.3 note: use `getInfoAsync/moveAsync/deleteAsync/readAsStringAsync`. `expo-file-system/next` reserved only for `Paths.availableDiskSpace`.
- **E0-4 — disk space via `expo-file-system/next` Paths.availableDiskSpace.** Task 7.4 uses `Paths.availableDiskSpace`.
- **E0-5 — SecureStore mock confirmed in jest.setup.js.** Project already has the mock (jest.setup.js:136-143). Task 0.4 (new) adds a one-line confirmation step.
- **T0-1 — About app-version site explicit.** Task 6.4: no existing AboutSection — creates `src/components/settings/AboutSection.tsx` with code and wires into `app/(tabs)/settings.tsx` via mount step. Long-press on version `<Text>` opens overlay.
- **T0-2 — Reader wire-up patches concrete.** Task 5.4 lists three explicit Edit blocks against `app/reader/[bookId].tsx` with real surrounding context: (1) `usePrefetchScheduler` hook + start effect, (2) `prefetch.onUserTap()` at start of `onWordTap`, (3) `prefetch.onScroll()` piggybacked on `onTopFlatItemChange`.
- **T0-3 — extractPageTexts implemented.** Task 5.4a: extractPageTexts flattens `ContentItem[].inlines` from reader state chapters.
- **T0-4 — freq fixture generator script.** Task 4.3 replaces "Continue with ~500 entries" with `scripts/generate-freq-fixtures.ts` + 13 seed lists (50 entries each). Real curation deferred to v2 backlog.
- **T0-5 — 11-locale fallback explicit.** Task 6.2: each new locale gets verbatim en-fallback strings + `"_NEEDS_TRANSLATION": true` marker. Task 8.5 v2-backlog entry added.
- **T0-6 — LlamaContextManager deletion deterministic.** Task 8.3 adds a grep verification step; Task 8.4 has NO conditional branch — straight `git rm`.
- **T0-7 — Anti-TDD test rewrite removed.** Task 7.3 Step 1 writes the correct test from the start: third case uses `contextLoadSucceeded: true` + `isPendingRevert: false`, expects cleanup. No "Adjust test expectations" step.

P1s addressed (highlights):

- **P1-A:** idle timer reset on drain's INFERRING→READY transition (Task 2.2 / Task 3.2).
- **P1-B:** re-entry guard via `currentBatch: Promise<void> | null` in `PrefetchScheduler.runBatch` (Task 5.2).
- **P1-C:** user tap requeues in-flight prefetch word back to `pendingWords` set (Task 5.4 patches).
- **P1-D:** orphan `.partial` cleanup on bootstrap (new Task 7.3a).
- **P1-E:** disk purge `pause()` then purge then `resume()` (Task 7.4 note).
- **P1-F:** `onMemoryPressure` API removed from spec — comment added.
- **P1-G:** TTL 30d lazy sweep on CacheLayer.lookup (Task 1.4 + 1.5).
- **P1-H:** i18n key ordering — Task 3.4 commits en+ru keys it uses; Task 6.1 adds remaining keys.
- **P1-I:** Task 1.4 shows full repository signature changes for both word and sentence upserts.
- **P1-J:** Task 7.1 verify-kernel uses two-arg `completion(messages, config)` matching real adapter.
- **P1-K:** AppStateBridge: `inactive` → pause scheduler (no unload); only `background` triggers unload.
- **P1-L:** LazyReloadIndicator: `accessibilityLiveRegion="polite"` + `AccessibilityInfo.announceForAccessibility`.
- **P1-M:** Component renamed `LazyReloadShimmer` → `LazyReloadIndicator` (Reanimated shimmer animation deferred to v2).
- **P1-N:** `usePrefetchScheduler` start+cleanup in same useEffect.
- **P1-O:** KeepReady picker is radiogroup (a11y).
- **P1-P:** Plural keys for counts in Task 6.1.

Round-2 verification patches (after 2 specialists re-reviewed v2):

- **A0-3 loading-state edge case** (Task 2.1): `unload()` now awaits `this.loading` first when state='loading'. Without this, loader's late `.then()` would set context AFTER unload thinks it's done, leaving orphan context. New test "unload during loading awaits loader, then releases" added (6 tests total in `state.test.ts`, was 5).
- **A0-2 changelog correction**: per-sentence prefetch split claim was overstated — v1 prefetch enqueues word-path only (`translation.translate`), no `translateSentence` calls. The 32-token cap still works (applied in `runInference` regardless of source), but the splitting story is moot until sentence prefetch lands in v2 backlog.
- **E0-6 explicit Battery event types** (Task 3.3): `addBatteryLevelListener` / `addBatteryStateListener` / `addLowPowerModeListener` callbacks typed with `Battery.BatteryLevelEvent` / `Battery.BatteryStateEvent` / `Battery.PowerModeEvent` instead of relying on TS inference.

---

## Phase 0 — Branch + dependencies

### Task 0.1: Branch creation

**Files:**
- Modify: working tree (git only).

- [ ] **Step 1: Verify clean tree on main**

Run: `git status --short && git rev-parse --abbrev-ref HEAD`
Expected: empty output + `main`.

- [ ] **Step 2: Create branch**

Run: `git checkout -b feat/translation-prefetch`
Expected: `Switched to a new branch 'feat/translation-prefetch'`.

- [ ] **Step 3: Commit (empty marker)**

```bash
git commit --allow-empty -m "chore(prefetch): start #4.6 translation prefetch + lifecycle"
```

---

### Task 0.2: Install expo-battery

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `ios/Podfile.lock` (pod install side-effect)

- [ ] **Step 1: Add dependency**

Run: `npx expo install expo-battery`
Expected: package added to dependencies, autolinked.

- [ ] **Step 2: Verify import resolves**

Run: `node -e "console.log(require.resolve('expo-battery'))"`
Expected: path under `node_modules/expo-battery`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(prefetch): install expo-battery for lifecycle battery gates"
```

---

### Task 0.3: Mock expo-battery в jest.setup.js

**Files:**
- Modify: `jest.setup.js:158-162` (после `expo-document-picker` mock)

- [ ] **Step 1: Write failing test**

Create test stub `src/services/translation/__tests__/expoBatteryMock.test.ts`:

```typescript
import * as Battery from 'expo-battery';

describe('expo-battery jest mock (E0-1)', () => {
  it('provides addBatteryLevelListener returning unsubscribe', () => {
    const sub = Battery.addBatteryLevelListener(() => {});
    expect(typeof sub.remove).toBe('function');
  });

  it('provides addLowPowerModeListener returning unsubscribe', () => {
    const sub = Battery.addLowPowerModeListener(() => {});
    expect(typeof sub.remove).toBe('function');
  });

  it('provides addBatteryStateListener returning unsubscribe', () => {
    const sub = Battery.addBatteryStateListener(() => {});
    expect(typeof sub.remove).toBe('function');
  });

  it('provides getBatteryLevelAsync', async () => {
    expect(typeof await Battery.getBatteryLevelAsync()).toBe('number');
  });

  it('provides getBatteryStateAsync', async () => {
    expect(typeof await Battery.getBatteryStateAsync()).toBe('number');
  });

  it('provides isLowPowerModeEnabledAsync', async () => {
    expect(typeof await Battery.isLowPowerModeEnabledAsync()).toBe('boolean');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/__tests__/expoBatteryMock.test.ts`
Expected: FAIL with `Cannot find module 'expo-battery'` (native, no mock).

- [ ] **Step 3: Add mock to jest.setup.js (E0-1)**

Append before `// expo-document-picker` block. NOTE: `getPowerStateAsync`
was removed from `expo-battery` in SDK 54 — DO NOT include it. Bridges
compose the three independent calls.

```javascript
// expo-battery — нативный модуль, мок для unit-тестов (#4.6).
// Мокаем три independent calls + три listeners; getPowerStateAsync removed
// in SDK 54 (BatteryBridge composes via Promise.all).
jest.mock('expo-battery', () => ({
  __esModule: true,
  BatteryState: { UNKNOWN: 0, UNPLUGGED: 1, CHARGING: 2, FULL: 3 },
  getBatteryLevelAsync: jest.fn().mockResolvedValue(0.8),
  getBatteryStateAsync: jest.fn().mockResolvedValue(2),
  isLowPowerModeEnabledAsync: jest.fn().mockResolvedValue(false),
  addBatteryLevelListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addBatteryStateListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addLowPowerModeListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
}));
```

(Step 1 above already exercises the three independent calls + three
listeners; no further test updates needed.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/__tests__/expoBatteryMock.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add jest.setup.js src/services/translation/__tests__/expoBatteryMock.test.ts
git commit -m "test(prefetch): mock expo-battery in jest.setup"
```

> **Note (E0-1):** Mock above replaces deprecated `getPowerStateAsync` (removed
> in SDK 54) with three independent functions + `addBatteryStateListener`.
> BatteryBridge (Task 3.3) composes the three calls. Do not re-add
> `getPowerStateAsync` to the mock.

---

### Task 0.4: Confirm expo-secure-store mock exists in jest.setup.js

**Files:**
- Verify (no edit if present): `jest.setup.js:136-143`.

The project already mocks `expo-secure-store` (in-memory Map). This task
just verifies it before later tasks (2.4, 7.3) rely on it.

- [ ] **Step 1: Write minimal test**

```typescript
// src/services/translation/__tests__/expoSecureStoreMock.test.ts
import * as SecureStore from 'expo-secure-store';

describe('expo-secure-store jest mock', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync('key_x');
  });
  it('setItemAsync/getItemAsync round-trips', async () => {
    await SecureStore.setItemAsync('key_x', '1');
    expect(await SecureStore.getItemAsync('key_x')).toBe('1');
  });
  it('deleteItemAsync clears', async () => {
    await SecureStore.setItemAsync('key_x', '1');
    await SecureStore.deleteItemAsync('key_x');
    expect(await SecureStore.getItemAsync('key_x')).toBeNull();
  });
});
```

- [ ] **Step 2: Run**

Run: `npx jest src/services/translation/__tests__/expoSecureStoreMock.test.ts`
Expected: PASS (jest.setup.js mock satisfies API).

If FAIL: re-check `jest.setup.js` block `jest.mock('expo-secure-store', ...)`
exists (it should — added in #2 Data layer). If absent, add:

```javascript
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn((k) => Promise.resolve(store.get(k) ?? null)),
    setItemAsync: jest.fn((k, v) => { store.set(k, v); return Promise.resolve(); }),
    deleteItemAsync: jest.fn((k) => { store.delete(k); return Promise.resolve(); }),
  };
});
```

- [ ] **Step 3: Commit**

```bash
git add src/services/translation/__tests__/expoSecureStoreMock.test.ts
git commit -m "test(prefetch): confirm expo-secure-store mock for permanent-disable + atomic upgrade tests"
```

---

### Task 0.5: Install js-sha256 (for chunked SHA-256 streaming)

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

`expo-crypto.digestStringAsync` cannot stream — it requires the full string
in memory, OOM-killing on ~600 MB GGUF files. We use `js-sha256` (pure JS,
~5 KB, no native module) with `hasher.update(chunk)` chunked API.

- [ ] **Step 1: Install**

Run: `npm i js-sha256`
Expected: package added to dependencies (no Expo SDK conflict — pure JS).

- [ ] **Step 2: Verify import resolves**

Run: `node -e "const {sha256} = require('js-sha256'); const h = sha256.create(); h.update(Buffer.from([1,2,3])); console.log(h.hex());"`
Expected: hex string printed.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (js-sha256 ships its own .d.ts).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(prefetch): install js-sha256 for chunked model-file hashing"
```

---

## Phase 1 — DB schema v4 + Cache columns

### Task 1.1: Schema bump to v4 with new translation_cache columns

**Files:**
- Modify: `src/db/schema.ts:8` (`SCHEMA_VERSION = 3` → `4`).
- Modify: `src/db/schema.ts:120-138` (translation_cache columns add).
- Test: `src/db/__tests__/schemaV4.test.ts` (new).

- [ ] **Step 1: Write failing test**

```typescript
// src/db/__tests__/schemaV4.test.ts
import { SCHEMA_VERSION, schema } from '@/db/schema';

describe('schema v4 — translation_cache prefetch columns', () => {
  it('SCHEMA_VERSION is 4', () => {
    expect(SCHEMA_VERSION).toBe(4);
  });

  it('translation_cache has source column', () => {
    const tc = schema.tables.translation_cache;
    expect(tc.columns.source).toEqual(expect.objectContaining({ name: 'source', type: 'string' }));
  });

  it('translation_cache has ttl_days column', () => {
    const tc = schema.tables.translation_cache;
    expect(tc.columns.ttl_days).toEqual(expect.objectContaining({ name: 'ttl_days', type: 'number' }));
  });

  it('translation_cache has chrf_score optional column', () => {
    const tc = schema.tables.translation_cache;
    expect(tc.columns.chrf_score).toEqual(expect.objectContaining({ name: 'chrf_score', type: 'number', isOptional: true }));
  });

  it('translation_cache retains inference_context column (no duplicate)', () => {
    const tc = schema.tables.translation_cache;
    expect(tc.columns.inference_context).toEqual(expect.objectContaining({ name: 'inference_context', type: 'string' }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/__tests__/schemaV4.test.ts`
Expected: FAIL — `SCHEMA_VERSION` is 3, `source`/`ttl_days`/`chrf_score` columns missing.

- [ ] **Step 3: Bump SCHEMA_VERSION and add columns**

In `src/db/schema.ts`:

```typescript
export const SCHEMA_VERSION = 4;
```

In `translation_cache` table, after the existing `kernel_build_id` column add:

```typescript
        // #4.6 Translation prefetch — provenance + TTL по source
        { name: 'source', type: 'string', isIndexed: true },
        { name: 'ttl_days', type: 'number' },
        { name: 'chrf_score', type: 'number', isOptional: true },
```

Note: `inference_context` уже существует в v3 (line 134), не дублировать.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/db/__tests__/schemaV4.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/__tests__/schemaV4.test.ts
git commit -m "feat(prefetch): schema v4 adds source/ttl_days/chrf_score on translation_cache"
```

---

### Task 1.2: Migration 0004 v3 → v4

**Files:**
- Create: `src/db/migrations/0004-prefetch-source-ttl.ts`.
- Modify: `src/db/migrations.ts` (register).
- Test: `src/db/__tests__/migration0004.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/db/__tests__/migration0004.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/__tests__/migration0004.test.ts`
Expected: FAIL — `Cannot find module '@/db/migrations/0004-prefetch-source-ttl'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/db/migrations/0004-prefetch-source-ttl.ts
import { addColumns } from '@nozbe/watermelondb/Schema/migrations';

export const migration0004 = {
  toVersion: 4,
  steps: [
    addColumns({
      table: 'translation_cache',
      columns: [
        { name: 'source', type: 'string', isIndexed: true },
        { name: 'ttl_days', type: 'number' },
        { name: 'chrf_score', type: 'number', isOptional: true },
      ],
    }),
  ],
};
```

Register в `src/db/migrations.ts` (append к sortedMigrations array):

```typescript
import { migration0004 } from './migrations/0004-prefetch-source-ttl';
// ...
export const migrations = schemaMigrations({
  migrations: [
    // ... existing entries
    migration0004,
  ],
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/db/__tests__/migration0004.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/db/migrations/0004-prefetch-source-ttl.ts src/db/migrations.ts src/db/__tests__/migration0004.test.ts
git commit -m "feat(prefetch): migration 0004 adds prefetch source/ttl columns"
```

---

### Task 1.3: TranslationCache model — surface source/ttl_days/chrf_score

**Files:**
- Modify: `src/db/models/TranslationCache.ts`.
- Test: `src/db/__tests__/translationCacheModel.test.ts` (extend if exists, else create).

- [ ] **Step 1: Write failing test**

```typescript
// src/db/__tests__/translationCacheModel.test.ts
import { TranslationCacheModel } from '@/db/models/TranslationCache';

describe('TranslationCache model — prefetch fields', () => {
  it('exposes source/ttl_days/chrf_score as decorated fields', () => {
    const proto = TranslationCacheModel.prototype as any;
    // WatermelonDB decorators define getters via field('name')
    expect(Object.getOwnPropertyDescriptor(proto, 'source')).toBeDefined();
    expect(Object.getOwnPropertyDescriptor(proto, 'ttlDays')).toBeDefined();
    expect(Object.getOwnPropertyDescriptor(proto, 'chrfScore')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/__tests__/translationCacheModel.test.ts`
Expected: FAIL — properties undefined on prototype.

- [ ] **Step 3: Add decorated fields**

In `src/db/models/TranslationCache.ts`, add (alongside existing fields):

```typescript
  @field('source') source!: 'on_demand' | 'prefetch';
  @field('ttl_days') ttlDays!: number;
  @field('chrf_score') chrfScore!: number | null;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/db/__tests__/translationCacheModel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/models/TranslationCache.ts src/db/__tests__/translationCacheModel.test.ts
git commit -m "feat(prefetch): TranslationCache model surfaces source/ttl_days/chrf_score"
```

---

### Task 1.4: TranslationCacheRepository — write/read source + ttl_days

**Files:**
- Modify: `src/db/repositories/TranslationCacheRepository.ts`.
- Test: `src/db/repositories/__tests__/TranslationCacheRepository.test.ts` (extend).

- [ ] **Step 1: Write failing test**

```typescript
// src/db/repositories/__tests__/TranslationCacheRepository.test.ts (append)
describe('TranslationCacheRepository — prefetch source', () => {
  it('upsertByKey persists source + ttl_days', async () => {
    const db = makeInMemoryDb();
    const repo = new TranslationCacheRepository(db);
    await repo.upsertByKey({
      cacheKey: 'k1',
      word: 'hello',
      contextWindow: 'hello world',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      translation: 'привет',
      inferenceContext: 'warm',
      modelVersion: '1.0',
      kernelBuildId: 'build-x',
      source: 'prefetch',
      ttlDays: 30,
    });
    const row = await repo.findByKey('k1');
    expect(row?.source).toBe('prefetch');
    expect(row?.ttlDays).toBe(30);
  });

  it('purgeExpiredBySource removes prefetch entries older than ttl_days', async () => {
    const db = makeInMemoryDb();
    const repo = new TranslationCacheRepository(db);
    const past = Date.now() - 40 * 24 * 60 * 60 * 1000; // 40 days ago
    await repo.upsertByKey({
      cacheKey: 'k_old',
      word: 'a', contextWindow: 'b',
      bookLanguage: 'en', nativeLanguage: 'ru',
      translation: 't',
      inferenceContext: 'warm',
      modelVersion: '1', kernelBuildId: 'x',
      source: 'prefetch', ttlDays: 30,
      createdAt: past,
    });
    const n = await repo.purgeExpiredBySource();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(await repo.findByKey('k_old')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/repositories/__tests__/TranslationCacheRepository.test.ts -t 'prefetch source'`
Expected: FAIL — `upsertByKey` signature missing `source`/`ttlDays`, `purgeExpiredBySource` undefined.

- [ ] **Step 3: Extend repository**

In `src/db/repositories/TranslationCacheRepository.ts`:

```typescript
export interface UpsertByKeyInput {
  cacheKey: string;
  word: string;
  contextWindow: string;
  bookLanguage: string;
  nativeLanguage: string;
  translation: string;
  inferenceContext: 'cold' | 'warm' | 'thermal_throttled';
  modelVersion: string;
  kernelBuildId: string;
  source: 'on_demand' | 'prefetch';
  ttlDays: number;
  createdAt?: number; // override for tests
}

// inside class:
async upsertByKey(input: UpsertByKeyInput): Promise<void> {
  await this.db.write(async () => {
    const collection = this.db.get<TranslationCacheModel>('translation_cache');
    const existing = await collection.query(Q.where('cache_key', input.cacheKey)).fetch();
    if (existing.length > 0) {
      await existing[0].update((r: any) => {
        r.translation = input.translation;
        r.source = input.source;
        r.ttlDays = input.ttlDays;
        r.inferenceContext = input.inferenceContext;
        r.modelVersion = input.modelVersion;
        r.kernelBuildId = input.kernelBuildId;
      });
    } else {
      await collection.create((r: any) => {
        r.cacheKey = input.cacheKey;
        r.word = input.word;
        r.contextWindow = input.contextWindow;
        r.bookLanguage = input.bookLanguage;
        r.nativeLanguage = input.nativeLanguage;
        r.translation = input.translation;
        r.source = input.source;
        r.ttlDays = input.ttlDays;
        r.inferenceContext = input.inferenceContext;
        r.modelVersion = input.modelVersion;
        r.kernelBuildId = input.kernelBuildId;
        r._raw.created_at = input.createdAt ?? Date.now();
      });
    }
  });
}

async purgeExpiredBySource(): Promise<number> {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  return this.db.write(async () => {
    const collection = this.db.get<TranslationCacheModel>('translation_cache');
    const all = await collection.query().fetch();
    const expired = all.filter((r: any) => {
      const created = r._raw.created_at as number;
      const ttl = (r.ttlDays as number) || 90;
      return now - created > ttl * dayMs;
    });
    await this.db.batch(...expired.map((r) => r.prepareDestroyPermanently()));
    return expired.length;
  });
}

// P1-G: lazy TTL sweep. Called by CacheLayer.lookup on hit when expires_at
// passed. Single-row inline delete; bulk sweep happens via
// purgeExpiredBySource on schedule.
async deleteByKey(cacheKey: string): Promise<void> {
  await this.db.write(async () => {
    const collection = this.db.get<TranslationCacheModel>('translation_cache');
    const existing = await collection.query(Q.where('cache_key', cacheKey)).fetch();
    if (existing.length === 0) return;
    await this.db.batch(...existing.map((r) => r.prepareDestroyPermanently()));
  });
}
```

**P1-I — Sentence upsert MUST mirror word upsert.** Same file (`TranslationCacheRepository.ts`) — `upsertSentenceByKey` signature MUST also accept `source` + `ttlDays`. Add to the existing `UpsertSentenceByKeyInput` interface:

```typescript
export interface UpsertSentenceByKeyInput {
  // ... existing fields ...
  source: 'on_demand' | 'prefetch';
  ttlDays: number;
  createdAt?: number;
}
```

And in `upsertSentenceByKey` body, persist `r.source = input.source; r.ttlDays = input.ttlDays;` mirroring the word path.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/db/repositories/__tests__/TranslationCacheRepository.test.ts -t 'prefetch source'`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/db/repositories/TranslationCacheRepository.ts src/db/repositories/__tests__/TranslationCacheRepository.test.ts
git commit -m "feat(prefetch): repository persists source/ttl_days + purgeExpiredBySource"
```

---

### Task 1.5: CacheLayer accepts source + chooses TTL

**Files:**
- Modify: `src/services/translation/CacheLayer.ts:20-23` (WriteOptions interface).
- Modify: `src/services/translation/CacheLayer.ts:92-122` (write method).
- Test: `src/services/translation/__tests__/CacheLayer.source.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/__tests__/CacheLayer.source.test.ts
import { CacheLayer } from '@/services/translation/CacheLayer';

function makeRepoSpy() {
  const calls: any[] = [];
  return {
    calls,
    findByKey: jest.fn(async () => null),
    findSentenceByKey: jest.fn(async () => null),
    upsertByKey: jest.fn(async (input: any) => { calls.push(input); }),
    upsertSentenceByKey: jest.fn(async (input: any) => { calls.push(input); }),
    clearAll: jest.fn(async () => {}),
  } as any;
}

describe('CacheLayer — source + ttl_days', () => {
  it('default write tags on_demand + ttl 90', async () => {
    const repo = makeRepoSpy();
    const layer = new CacheLayer(repo, 100, () => 'm1', () => 'k1');
    await layer.write('hello', 'ctx', 'en', 'ru', 'привет', { inferenceContext: 'warm' });
    await new Promise((r) => setImmediate(r));
    expect(repo.calls[0]).toMatchObject({ source: 'on_demand', ttlDays: 90 });
  });

  it('prefetch write tags prefetch + ttl 30', async () => {
    const repo = makeRepoSpy();
    const layer = new CacheLayer(repo, 100, () => 'm1', () => 'k1');
    await layer.write('hello', 'ctx', 'en', 'ru', 'привет', { inferenceContext: 'warm', source: 'prefetch' });
    await new Promise((r) => setImmediate(r));
    expect(repo.calls[0]).toMatchObject({ source: 'prefetch', ttlDays: 30 });
  });

  it('cold inference does NOT persist regardless of source', async () => {
    const repo = makeRepoSpy();
    const layer = new CacheLayer(repo, 100, () => 'm1', () => 'k1');
    await layer.write('hello', 'ctx', 'en', 'ru', 'привет', { inferenceContext: 'cold', source: 'prefetch' });
    await new Promise((r) => setImmediate(r));
    expect(repo.upsertByKey).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/__tests__/CacheLayer.source.test.ts`
Expected: FAIL — `WriteOptions` does not accept `source`, calls miss `source`/`ttlDays`.

- [ ] **Step 3: Extend CacheLayer**

In `src/services/translation/CacheLayer.ts`, update `WriteOptions`:

```typescript
export type TranslationSource = 'on_demand' | 'prefetch';

export interface WriteOptions {
  inferenceContext: InferenceContext;
  source?: TranslationSource;
}

const TTL_BY_SOURCE: Record<TranslationSource, number> = {
  on_demand: 90,
  prefetch: 30,
};
```

Update `write` body — when calling `repo.upsertByKey`, pass:

```typescript
      this.repo
        .upsertByKey({
          cacheKey: key,
          word,
          contextWindow,
          bookLanguage,
          nativeLanguage,
          translation,
          inferenceContext: opts.inferenceContext,
          modelVersion: this.getModelVersion(),
          kernelBuildId: this.getKernelBuildId(),
          source: opts.source ?? 'on_demand',
          ttlDays: TTL_BY_SOURCE[opts.source ?? 'on_demand'],
        })
```

Update `writeSentence` similarly — call `upsertSentenceByKey` with `source` + `ttlDays` (already extended in Task 1.4 per P1-I).

**P1-G — Lazy TTL sweep on lookup.** Also extend `CacheLayer.lookup`:

```typescript
async lookup(word, contextWindow, bookLanguage, nativeLanguage): Promise<LookupHit | null> {
  const key = this.makeKey(word, contextWindow, bookLanguage, nativeLanguage);
  // 1. memory LRU
  const mem = this.memCache.get(key);
  if (mem) return mem;
  // 2. repo
  const row = await this.repo.findByKey(key);
  if (!row) return null;
  // P1-G: TTL check inline. If expired, delete + treat as miss.
  const ttlMs = (row.ttlDays ?? 90) * 24 * 60 * 60 * 1000;
  if (Date.now() - row.createdAt > ttlMs) {
    void this.repo.deleteByKey(key).catch(() => {});
    return null;
  }
  // ...existing memCache.set + return path...
}
```

Add a test in `CacheLayer.source.test.ts`:

```typescript
it('lookup on TTL-expired row returns null and deletes the row', async () => {
  const past = Date.now() - 40 * 24 * 60 * 60 * 1000;
  const repo = {
    findByKey: jest.fn(async () => ({
      cacheKey: 'k', word: 'hello', contextWindow: 'ctx',
      bookLanguage: 'en', nativeLanguage: 'ru',
      translation: 'привет', source: 'prefetch', ttlDays: 30,
      createdAt: past, inferenceContext: 'warm',
    })),
    deleteByKey: jest.fn(async () => {}),
    findSentenceByKey: jest.fn(async () => null),
    upsertByKey: jest.fn(async () => {}),
    upsertSentenceByKey: jest.fn(async () => {}),
    clearAll: jest.fn(async () => {}),
  } as any;
  const layer = new CacheLayer(repo, 100, () => 'm1', () => 'k1');
  const hit = await layer.lookup('hello', 'ctx', 'en', 'ru');
  expect(hit).toBeNull();
  expect(repo.deleteByKey).toHaveBeenCalledWith('k');
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/__tests__/CacheLayer.source.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/CacheLayer.ts src/services/translation/__tests__/CacheLayer.source.test.ts src/db/repositories/TranslationCacheRepository.ts
git commit -m "feat(prefetch): CacheLayer.write accepts source param, ttl by source"
```

---

## Phase 2 — Lifecycle state machine

### Task 2.1: ModelLifecycleManager — initial state + ensureLoaded idempotency

**Files:**
- Create: `src/services/translation/ModelLifecycleManager.ts`.
- Create: `src/services/translation/__tests__/ModelLifecycleManager.state.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/__tests__/ModelLifecycleManager.state.test.ts
import { ModelLifecycleManager } from '@/services/translation/ModelLifecycleManager';
import type { LlamaContext } from '@/services/translation/llamaTypes';

const fakeCtx = (): LlamaContext => ({
  completion: jest.fn(async () => ({ text: 'ok' })),
  release: jest.fn(async () => {}),
});

describe('ModelLifecycleManager — initial state + ensureLoaded', () => {
  beforeEach(() => ModelLifecycleManager.resetForTests());

  it('starts in unloaded state', () => {
    const m = new ModelLifecycleManager({ loader: async () => fakeCtx() });
    expect(m.getSnapshot().state).toBe('unloaded');
  });

  it('ensureLoaded transitions to ready', async () => {
    const m = new ModelLifecycleManager({ loader: async () => fakeCtx() });
    await m.ensureLoaded();
    expect(m.getSnapshot().state).toBe('ready');
  });

  it('concurrent ensureLoaded calls dedupe loader invocations', async () => {
    const loader = jest.fn(async () => fakeCtx());
    const m = new ModelLifecycleManager({ loader });
    await Promise.all([m.ensureLoaded(), m.ensureLoaded(), m.ensureLoaded()]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('unload returns to unloaded and releases context', async () => {
    const ctx = fakeCtx();
    const m = new ModelLifecycleManager({ loader: async () => ctx });
    await m.ensureLoaded();
    await m.unload();
    expect(m.getSnapshot().state).toBe('unloaded');
    expect(ctx.release).toHaveBeenCalledTimes(1);
  });

  it('unload while unloaded is a no-op', async () => {
    const m = new ModelLifecycleManager({ loader: async () => fakeCtx() });
    await expect(m.unload()).resolves.toBeUndefined();
    expect(m.getSnapshot().state).toBe('unloaded');
  });

  // A0-3: unload waits for in-flight inference before release.
  it('unload waits for in-flight inference before release', async () => {
    let completionResolve: ((v: any) => void) | null = null;
    const release = jest.fn(async () => {});
    const ctx: any = {
      completion: () => new Promise((r) => { completionResolve = r; }),
      release,
    };
    const m = new ModelLifecycleManager({ loader: async () => ctx });
    await m.ensureLoaded();
    const inferP = m.runInference('p', {} as any, 'user');
    // Yield once to allow drain to start the inference promise
    await new Promise((r) => setTimeout(r, 10));
    const unloadP = m.unload();
    // unload MUST NOT release while inference still pending
    await new Promise((r) => setTimeout(r, 30));
    expect(release).not.toHaveBeenCalled();
    // Resolve the in-flight inference
    completionResolve!({ text: 'ok' });
    await inferP;
    await unloadP;
    expect(release).toHaveBeenCalledTimes(1);
    expect(m.getSnapshot().state).toBe('unloaded');
  });

  // A0-3 edge case: unload called while state='loading' (loader in-flight).
  // Must await loading completion, THEN release context. Otherwise loader's
  // late .then() leaves orphan context (state='unloaded' but this.context set).
  it('unload during loading awaits loader, then releases', async () => {
    let loaderResolve: ((ctx: any) => void) | null = null;
    const ctx = fakeCtx();
    const m = new ModelLifecycleManager({
      loader: () => new Promise<any>((r) => { loaderResolve = (c) => r(c); }),
    });
    const loadP = m.ensureLoaded(); // state → 'loading', promise pending
    // Yield once so ensureLoaded reaches `await this.loading`
    await new Promise((r) => setTimeout(r, 5));
    expect(m.getSnapshot().state).toBe('loading');
    // Call unload before loader settles
    const unloadP = m.unload();
    // Now resolve the loader — loadInternal's .then() will run BEFORE
    // unload proceeds to release(), because unload awaits this.loading.
    loaderResolve!(ctx);
    await loadP;
    await unloadP;
    // Final state: unloaded, AND context that was just loaded was released.
    expect(m.getSnapshot().state).toBe('unloaded');
    expect(ctx.release).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/__tests__/ModelLifecycleManager.state.test.ts`
Expected: FAIL — `Cannot find module '@/services/translation/ModelLifecycleManager'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/services/translation/ModelLifecycleManager.ts
import type { LlamaContext, InferenceConfig, InferenceResult } from './llamaTypes';

export type LifecycleState =
  | 'unloaded'
  | 'loading'
  | 'ready'
  | 'inferring'
  | 'unloading'
  | 'error'
  | 'error_permanent';

// A0-1 — pending job entry for 2-queue dispatcher
export type PendingJob<T> = {
  fn: () => Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
  priority: 'user' | 'prefetch';
  aborted?: boolean;
};

export type InferencePriority = 'user' | 'prefetch';
export type ThermalLevel = 'nominal' | 'fair' | 'serious' | 'critical';

export interface LifecycleSnapshot {
  state: LifecycleState;
  loadedAt: number | null;
  idleSinceMs: number;
  thermalLevel: ThermalLevel;
  batteryPct: number;
  charging: boolean;
  lowPowerMode: boolean;
  consecutiveLoadFailures: number;
  prefetchActive: boolean;
}

export interface LifecycleManagerOptions {
  loader: () => Promise<LlamaContext>;
  idleTimeoutMs?: number;
  prefetchBatteryFloor?: number;
}

export class ModelLifecycleManager {
  private static singleton: ModelLifecycleManager | null = null;
  private state: LifecycleState = 'unloaded';
  private context: LlamaContext | null = null;
  private loading: Promise<LlamaContext> | null = null;
  private loadedAt: number | null = null;
  private idleSince: number = Date.now();
  private consecutiveLoadFailures = 0;
  private batteryPct = 1.0;
  private charging = true;
  private lowPowerMode = false;
  private thermalLevel: ThermalLevel = 'nominal';
  private prefetchActive = false;
  // A0-1: 2-queue dispatcher (full impl in Task 2.2). Declared here so
  // unload() (A0-3) can reference them safely from initial state.
  private userQueue: PendingJob<unknown>[] = [];
  private prefetchQueue: PendingJob<unknown>[] = [];
  private draining = false;

  constructor(private opts: LifecycleManagerOptions) {}

  static instance(opts?: LifecycleManagerOptions): ModelLifecycleManager {
    if (!this.singleton) {
      if (!opts) throw new Error('ModelLifecycleManager.instance requires opts on first call');
      this.singleton = new ModelLifecycleManager(opts);
    }
    return this.singleton;
  }

  static resetForTests(): void {
    this.singleton = null;
  }

  async ensureLoaded(): Promise<void> {
    if (this.state === 'ready' || this.state === 'inferring') return;
    if (this.loading) {
      await this.loading;
      return;
    }
    this.state = 'loading';
    this.loading = this.opts.loader().then((ctx) => {
      this.context = ctx;
      this.loadedAt = Date.now();
      this.idleSince = Date.now();
      this.state = 'ready';
      this.consecutiveLoadFailures = 0;
      this.loading = null;
      return ctx;
    }).catch((e) => {
      this.loading = null;
      this.consecutiveLoadFailures += 1;
      this.state = 'error';
      throw e;
    });
    await this.loading;
  }

  // A0-3: unload waits for any in-flight inference to finish + aborts
  // queued jobs before release(). Queues + draining flag are declared in
  // Task 2.2 (A0-1) — this is the final shape after both patches land.
  // userQueue/prefetchQueue are also declared here as `[]` so initial
  // unload from `unloaded` is a no-op (covered by 'unload while unloaded'
  // test). The full 2-queue dispatcher logic lives in Task 2.2 below.
  async unload(): Promise<void> {
    if (this.state === 'unloaded' || this.state === 'unloading') return;
    // A0-3 edge case: unload() during state='loading'. Without this guard,
    // unload would set state='unloaded' synchronously while loadInternal()
    // continues in the background, eventually assigning this.context = ctx
    // and state = 'ready' — leaving an orphan context the manager thinks is
    // unloaded. Fix: await this.loading first so loadInternal completes
    // (sets context + state='ready' OR throws + state='error'), then proceed
    // to release whatever the loader actually produced.
    if (this.state === 'loading' && this.loading) {
      try { await this.loading; } catch { /* loader rejected — context null */ }
    }
    this.state = 'unloading';
    // Mark queued jobs aborted — drain loop will reject them
    for (const j of this.userQueue ?? []) j.aborted = true;
    for (const j of this.prefetchQueue ?? []) j.aborted = true;
    // Wait for current in-flight inference (≤3s due to 32-token prefetch
    // cap; user jobs may take longer but unload from background is rare
    // mid-user-translation).
    while (this.draining) await new Promise((r) => setTimeout(r, 50));
    const ctx = this.context;
    this.context = null;
    this.loadedAt = null;
    if (ctx) {
      try {
        await ctx.release();
      } catch {
        // release() failures non-fatal — context handle dropped either way
      }
    }
    this.state = 'unloaded';
    this.clearIdleTimer?.();
  }

  getSnapshot(): LifecycleSnapshot {
    return {
      state: this.state,
      loadedAt: this.loadedAt,
      idleSinceMs: Date.now() - this.idleSince,
      thermalLevel: this.thermalLevel,
      batteryPct: this.batteryPct,
      charging: this.charging,
      lowPowerMode: this.lowPowerMode,
      consecutiveLoadFailures: this.consecutiveLoadFailures,
      prefetchActive: this.prefetchActive,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/__tests__/ModelLifecycleManager.state.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/ModelLifecycleManager.ts src/services/translation/__tests__/ModelLifecycleManager.state.test.ts
git commit -m "feat(prefetch): ModelLifecycleManager skeleton + ensureLoaded idempotency"
```

---

### Task 2.2: runInference(prompt, config, priority) with serial queue

**Files:**
- Modify: `src/services/translation/ModelLifecycleManager.ts`.
- Test: `src/services/translation/__tests__/ModelLifecycleManager.runInference.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/__tests__/ModelLifecycleManager.runInference.test.ts
import { ModelLifecycleManager } from '@/services/translation/ModelLifecycleManager';

describe('ModelLifecycleManager.runInference', () => {
  beforeEach(() => ModelLifecycleManager.resetForTests());

  it('serializes user inference calls', async () => {
    const order: string[] = [];
    const ctx = {
      completion: jest.fn(async (p: string) => {
        order.push(`start:${p}`);
        await new Promise((r) => setTimeout(r, 10));
        order.push(`end:${p}`);
        return { text: p };
      }),
      release: jest.fn(),
    };
    const m = new ModelLifecycleManager({ loader: async () => ctx as any });
    await Promise.all([
      m.runInference('a', {}, 'user'),
      m.runInference('b', {}, 'user'),
    ]);
    expect(order).toEqual(['start:a', 'end:a', 'start:b', 'end:b']);
  });

  it('user inference resets idle timer; prefetch does not', async () => {
    jest.useFakeTimers();
    const ctx = { completion: jest.fn(async () => ({ text: 'x' })), release: jest.fn() };
    const m = new ModelLifecycleManager({ loader: async () => ctx as any });
    await m.ensureLoaded();
    jest.advanceTimersByTime(120_000);
    const beforeUser = m.getSnapshot().idleSinceMs;
    expect(beforeUser).toBeGreaterThan(100_000);
    await m.runInference('p', {}, 'user');
    expect(m.getSnapshot().idleSinceMs).toBeLessThan(1000);

    jest.advanceTimersByTime(60_000);
    await m.runInference('p', {}, 'prefetch');
    expect(m.getSnapshot().idleSinceMs).toBeGreaterThanOrEqual(60_000);
    jest.useRealTimers();
  });

  it('throws if state is error_permanent', async () => {
    const ctx = { completion: jest.fn(), release: jest.fn() };
    const m = new ModelLifecycleManager({ loader: async () => ctx as any });
    (m as any).state = 'error_permanent';
    await expect(m.runInference('x', {}, 'user')).rejects.toThrow(/permanently/i);
  });

  // A0-1: user job preempts pending prefetch jobs at the next job boundary.
  it('user job preempts pending prefetch jobs at next boundary', async () => {
    const calls: string[] = [];
    const ctx: any = {
      completion: jest.fn(async (prompt: string) => {
        calls.push(prompt);
        await new Promise((r) => setTimeout(r, 30));
        return { text: prompt };
      }),
      release: jest.fn(),
    };
    const m = new ModelLifecycleManager({ loader: async () => ctx });
    await m.ensureLoaded();
    // Enqueue 5 prefetch jobs first.
    const pfPromises = ['p1', 'p2', 'p3', 'p4', 'p5'].map((p) =>
      m.runInference(p, {} as any, 'prefetch'),
    );
    // Wait until drain has dequeued p1 and started it.
    await new Promise((r) => setTimeout(r, 10));
    // Now enqueue a user job — it must be served BEFORE p2..p5.
    const userP = m.runInference('USER', {} as any, 'user');
    await Promise.all([userP, ...pfPromises]);
    expect(calls[0]).toBe('p1');
    // After p1 completes, USER comes next (preempts p2..p5 at boundary).
    expect(calls[1]).toBe('USER');
  });

  // A0-2: prefetch priority caps max_tokens to 32.
  it('prefetch priority caps max_tokens to 32', async () => {
    const spy = jest.fn(async () => ({ text: 'ok' }));
    const ctx: any = { completion: spy, release: jest.fn() };
    const m = new ModelLifecycleManager({ loader: async () => ctx });
    await m.ensureLoaded();
    await m.runInference('hello', { max_tokens: 200 } as any, 'prefetch');
    expect(spy).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({ max_tokens: 32 }),
    );
  });

  // A0-2: user priority preserves max_tokens.
  it('user priority preserves max_tokens', async () => {
    const spy = jest.fn(async () => ({ text: 'ok' }));
    const ctx: any = { completion: spy, release: jest.fn() };
    const m = new ModelLifecycleManager({ loader: async () => ctx });
    await m.ensureLoaded();
    await m.runInference('hello', { max_tokens: 200 } as any, 'user');
    expect(spy).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({ max_tokens: 200 }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/__tests__/ModelLifecycleManager.runInference.test.ts`
Expected: FAIL — `runInference` undefined.

- [ ] **Step 3: Extend manager (A0-1 + A0-2)**

Add the 2-queue dispatcher + 32-tok prefetch cap to `ModelLifecycleManager`.
The `userQueue` / `prefetchQueue` / `draining` fields were declared in
Task 2.1's class block already (so `unload()` could reference them).

```typescript
import type { ChatMsg } from './LlamaContextAdapter';

  async runInference(
    promptOrMessages: string | ChatMsg[],
    config: InferenceConfig,
    priority: InferencePriority,
  ): Promise<InferenceResult> {
    if (this.state === 'error_permanent') {
      throw new Error('LLM permanently disabled');
    }
    // A0-2: word-mode 32-token cap for prefetch so user-tap preempts at
    // boundary ≤3s. Sentence prefetch (Task 5.3) is gated separately; word
    // path is the hot one.
    const cappedConfig: InferenceConfig =
      priority === 'prefetch'
        ? { ...config, max_tokens: Math.min(config.max_tokens ?? 32, 32) }
        : config;
    // user jobs ensure-load. prefetch jobs assume scheduler already
    // checked canPrefetch (which implies ready).
    if (priority === 'user') await this.ensureLoaded();
    if (this.state === 'error_permanent') {
      throw new Error('LLM permanently disabled');
    }
    return new Promise<InferenceResult>((resolve, reject) => {
      const job: PendingJob<InferenceResult> = {
        fn: () => this.context!.completion(promptOrMessages as any, cappedConfig),
        resolve,
        reject,
        priority,
      };
      if (priority === 'user') this.userQueue.push(job as PendingJob<unknown>);
      else this.prefetchQueue.push(job as PendingJob<unknown>);
      // P1-A: user activity resets idle timer at enqueue (not just on
      // completion) so long-running inference doesn't expire the timer.
      if (priority === 'user') this.resetIdleTimer?.();
      void this.drain();
    });
  }

  // A0-1: 2-queue dispatcher. After every job completes, re-check both
  // queues, prioritising user. This gives user-tap preemption at the next
  // boundary without canceling the in-flight prefetch (which is ≤32 tok ≤3s).
  private async drain(): Promise<void> {
    if (this.draining) return;
    if (this.state !== 'ready' && this.state !== 'inferring') return;
    this.draining = true;
    try {
      while (this.userQueue.length > 0 || this.prefetchQueue.length > 0) {
        if (this.state === 'unloading' || this.state === 'unloaded') break;
        const job = this.userQueue.shift() ?? this.prefetchQueue.shift()!;
        if (job.aborted) {
          job.reject(new Error('aborted'));
          continue;
        }
        const prev = this.state;
        this.state = 'inferring';
        try {
          const result = await job.fn();
          // P1-A: reset idle timer on USER inference completion too.
          if (job.priority === 'user') {
            this.idleSince = Date.now();
            this.resetIdleTimer?.();
          }
          job.resolve(result);
        } catch (e) {
          job.reject(e);
        } finally {
          // Return to ready unless we're already mid-unload.
          this.state = this.state === 'unloading' ? 'unloading' : 'ready';
        }
      }
    } finally {
      this.draining = false;
    }
  }
```

Note: `resetIdleTimer` is declared in Task 3.2 (idle timer). The optional
chaining `this.resetIdleTimer?.()` allows Task 2.2 to land first while the
method is added in Task 3.2.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/__tests__/ModelLifecycleManager.runInference.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/ModelLifecycleManager.ts src/services/translation/__tests__/ModelLifecycleManager.runInference.test.ts
git commit -m "feat(prefetch): runInference with priority + serial queue"
```

---

### Task 2.3: canPrefetch + battery/lowPower gating

**Files:**
- Modify: `src/services/translation/ModelLifecycleManager.ts`.
- Test: `src/services/translation/__tests__/ModelLifecycleManager.canPrefetch.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/__tests__/ModelLifecycleManager.canPrefetch.test.ts
import { ModelLifecycleManager } from '@/services/translation/ModelLifecycleManager';

describe('ModelLifecycleManager.canPrefetch', () => {
  beforeEach(() => ModelLifecycleManager.resetForTests());

  function make() {
    const ctx = { completion: jest.fn(), release: jest.fn() };
    return new ModelLifecycleManager({ loader: async () => ctx as any });
  }

  it('false when state is unloaded', () => {
    expect(make().canPrefetch()).toBe(false);
  });

  it('false when battery < 20% and not charging', async () => {
    const m = make();
    await m.ensureLoaded();
    m.onBatteryStateChange({ pct: 0.15, charging: false, lowPower: false });
    expect(m.canPrefetch()).toBe(false);
  });

  it('true when battery < 20% but charging', async () => {
    const m = make();
    await m.ensureLoaded();
    m.onBatteryStateChange({ pct: 0.15, charging: true, lowPower: false });
    expect(m.canPrefetch()).toBe(true);
  });

  it('false when lowPowerMode regardless of battery', async () => {
    const m = make();
    await m.ensureLoaded();
    m.onBatteryStateChange({ pct: 0.95, charging: true, lowPower: true });
    expect(m.canPrefetch()).toBe(false);
  });

  it('false when error_permanent', async () => {
    const m = make();
    await m.ensureLoaded();
    (m as any).state = 'error_permanent';
    expect(m.canPrefetch()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/__tests__/ModelLifecycleManager.canPrefetch.test.ts`
Expected: FAIL — `canPrefetch` undefined.

- [ ] **Step 3: Add methods**

```typescript
  onBatteryStateChange(snapshot: { pct: number; charging: boolean; lowPower: boolean }): void {
    this.batteryPct = snapshot.pct;
    this.charging = snapshot.charging;
    this.lowPowerMode = snapshot.lowPower;
  }

  canPrefetch(): boolean {
    if (this.state === 'error_permanent') return false;
    if (this.state === 'unloaded' && this.consecutiveLoadFailures >= 3) return false;
    if (this.state === 'unloaded') return false;
    if (this.lowPowerMode) return false;
    if (!this.charging && this.batteryPct < 0.20) return false;
    if (this.thermalLevel === 'serious' || this.thermalLevel === 'critical') return false;
    return true;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/__tests__/ModelLifecycleManager.canPrefetch.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/ModelLifecycleManager.ts src/services/translation/__tests__/ModelLifecycleManager.canPrefetch.test.ts
git commit -m "feat(prefetch): canPrefetch + onBatteryStateChange gates"
```

---

### Task 2.4: Permanent disable after 3 load failures (SecureStore flag)

**Files:**
- Modify: `src/services/translation/ModelLifecycleManager.ts`.
- Test: `src/services/translation/__tests__/ModelLifecycleManager.permanentDisable.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/__tests__/ModelLifecycleManager.permanentDisable.test.ts
import * as SecureStore from 'expo-secure-store';
import { ModelLifecycleManager } from '@/services/translation/ModelLifecycleManager';

describe('ModelLifecycleManager — permanent disable', () => {
  beforeEach(async () => {
    ModelLifecycleManager.resetForTests();
    await SecureStore.deleteItemAsync('llm_permanently_disabled');
  });

  it('sets SecureStore flag after 3 consecutive load failures', async () => {
    const loader = jest.fn(async () => { throw new Error('boom'); });
    const m = new ModelLifecycleManager({ loader });
    for (let i = 0; i < 3; i++) {
      await m.ensureLoaded().catch(() => {});
    }
    const flag = await SecureStore.getItemAsync('llm_permanently_disabled');
    expect(flag).toBe('1');
    expect(m.getSnapshot().state).toBe('error_permanent');
  });

  it('hydrateFromSecureStore restores error_permanent state', async () => {
    await SecureStore.setItemAsync('llm_permanently_disabled', '1');
    const m = new ModelLifecycleManager({ loader: jest.fn() });
    await m.hydrateFromSecureStore();
    expect(m.getSnapshot().state).toBe('error_permanent');
  });

  it('clearPermanentDisable resets state and flag', async () => {
    await SecureStore.setItemAsync('llm_permanently_disabled', '1');
    const m = new ModelLifecycleManager({ loader: jest.fn() });
    await m.hydrateFromSecureStore();
    await m.clearPermanentDisable();
    expect(m.getSnapshot().state).toBe('unloaded');
    expect(await SecureStore.getItemAsync('llm_permanently_disabled')).toBeNull();
    expect(m.getSnapshot().consecutiveLoadFailures).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/__tests__/ModelLifecycleManager.permanentDisable.test.ts`
Expected: FAIL — methods undefined.

- [ ] **Step 3: Extend manager (A0-5)**

```typescript
import * as SecureStore from 'expo-secure-store';

const PERMANENT_DISABLE_KEY = 'llm_permanently_disabled';
const MAX_LOAD_FAILURES = 3;
```

**A0-5 — Counter semantics (one-shot):**

The `consecutiveLoadFailures` counter is volatile (in-memory only) and MUST
be incremented exactly once per load attempt, even when multiple concurrent
`ensureLoaded()` callers await the same failing `loading` promise. A
`failureCounterIncremented` flag scoped to each load attempt guarantees the
one-shot semantics.

Reset rules:

- Successful load (state reaches `ready`) → counter = 0.
- `clearPermanentDisable()` user action → counter = 0, SecureStore flag deleted.
- App restart → counter starts at 0; SecureStore flag persists across launches,
  so if it was set, app boot hydrates back to `error_permanent` via
  `hydrateFromSecureStore()`.

Replace the existing `ensureLoaded()` body with the `loadInternal` shape so
the one-shot guard works:

```typescript
  private failureCounterIncremented = false;

  async ensureLoaded(): Promise<void> {
    if (this.state === 'ready' || this.state === 'inferring') return;
    if (this.state === 'error_permanent') {
      throw new Error('LLM permanently disabled');
    }
    if (this.loading) {
      await this.loading;
      return;
    }
    this.loading = this.loadInternal();
    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  private async loadInternal(): Promise<void> {
    this.failureCounterIncremented = false;
    this.state = 'loading';
    try {
      this.context = await this.opts.loader();
      this.loadedAt = Date.now();
      this.consecutiveLoadFailures = 0;
      this.state = 'ready';
      this.resetIdleTimer?.();
    } catch (e) {
      if (!this.failureCounterIncremented) {
        this.consecutiveLoadFailures += 1;
        this.failureCounterIncremented = true;
        if (this.consecutiveLoadFailures >= MAX_LOAD_FAILURES) {
          await SecureStore.setItemAsync(PERMANENT_DISABLE_KEY, '1');
          this.state = 'error_permanent';
        } else {
          this.state = 'error';
        }
      }
      throw e;
    }
  }
```

Add methods:

```typescript
  async hydrateFromSecureStore(): Promise<void> {
    const flag = await SecureStore.getItemAsync(PERMANENT_DISABLE_KEY);
    if (flag === '1') {
      this.state = 'error_permanent';
    }
  }

  async clearPermanentDisable(): Promise<void> {
    await SecureStore.deleteItemAsync(PERMANENT_DISABLE_KEY);
    this.consecutiveLoadFailures = 0;
    this.state = 'unloaded';
  }
```

Add an A0-5 regression test in Task 2.4's test file:

```typescript
it('concurrent ensureLoaded waiters increment counter ONCE per failure', async () => {
  const loader = jest.fn(async () => { throw new Error('boom'); });
  const m = new ModelLifecycleManager({ loader });
  // Three concurrent waiters on the SAME load attempt.
  await Promise.all([
    m.ensureLoaded().catch(() => {}),
    m.ensureLoaded().catch(() => {}),
    m.ensureLoaded().catch(() => {}),
  ]);
  expect(m.getSnapshot().consecutiveLoadFailures).toBe(1);
  expect(loader).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/__tests__/ModelLifecycleManager.permanentDisable.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/ModelLifecycleManager.ts src/services/translation/__tests__/ModelLifecycleManager.permanentDisable.test.ts
git commit -m "feat(prefetch): permanent disable after 3 load failures via SecureStore"
```

---

## Phase 3 — Triggers (AppState + Idle + Battery)

### Task 3.1: AppStateBridge — background → unload

**Files:**
- Create: `src/services/translation/AppStateBridge.ts`.
- Test: `src/services/translation/__tests__/AppStateBridge.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/__tests__/AppStateBridge.test.ts
import { AppState } from 'react-native';
import { AppStateBridge } from '@/services/translation/AppStateBridge';

describe('AppStateBridge', () => {
  it('calls lifecycle.unload on background transition', () => {
    const handlers: Array<(s: string) => void> = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
      handlers.push(cb as any);
      return { remove: jest.fn() } as any;
    });
    const lifecycle = { unload: jest.fn(async () => {}) } as any;
    const bridge = new AppStateBridge(lifecycle);
    bridge.start();
    handlers.forEach((h) => h('background'));
    expect(lifecycle.unload).toHaveBeenCalled();
  });

  it('does NOT unload on active transition', () => {
    const handlers: Array<(s: string) => void> = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
      handlers.push(cb as any);
      return { remove: jest.fn() } as any;
    });
    const lifecycle = { unload: jest.fn(async () => {}) } as any;
    const bridge = new AppStateBridge(lifecycle);
    bridge.start();
    handlers.forEach((h) => h('active'));
    expect(lifecycle.unload).not.toHaveBeenCalled();
  });

  it('stop removes subscription', () => {
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove } as any));
    const lifecycle = { unload: jest.fn() } as any;
    const bridge = new AppStateBridge(lifecycle);
    bridge.start();
    bridge.stop();
    expect(remove).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/__tests__/AppStateBridge.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

P1-K: only `background` triggers unload. `inactive` is a transient state
(notification banner, call interrupt) and the user often returns within
seconds — unloading there would force a cold reload. Instead, `inactive`
pauses the prefetch scheduler so we stop spending battery, but the model
stays warm. `active` resumes.

```typescript
// src/services/translation/AppStateBridge.ts
import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import type { ModelLifecycleManager } from './ModelLifecycleManager';
import type { PrefetchScheduler } from './prefetch/PrefetchScheduler';

export class AppStateBridge {
  private sub: NativeEventSubscription | null = null;
  private scheduler: PrefetchScheduler | null = null;

  constructor(private lifecycle: ModelLifecycleManager) {}

  attachScheduler(scheduler: PrefetchScheduler): void {
    this.scheduler = scheduler;
  }

  start(): void {
    this.sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'background') {
        void this.lifecycle.unload();
        this.scheduler?.pause();
      } else if (s === 'inactive') {
        // Transient — pause prefetch but keep model warm.
        this.scheduler?.pause();
      } else if (s === 'active') {
        this.scheduler?.resume();
      }
    });
  }

  stop(): void {
    this.sub?.remove();
    this.sub = null;
  }
}
```

Update the second test in Task 3.1 so `inactive` does NOT trigger unload:

```typescript
it('does NOT unload on inactive — pauses scheduler instead', () => {
  const handlers: Array<(s: string) => void> = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
    handlers.push(cb as any);
    return { remove: jest.fn() } as any;
  });
  const lifecycle = { unload: jest.fn(async () => {}) } as any;
  const scheduler = { pause: jest.fn(), resume: jest.fn() } as any;
  const bridge = new AppStateBridge(lifecycle);
  bridge.attachScheduler(scheduler);
  bridge.start();
  handlers.forEach((h) => h('inactive'));
  expect(lifecycle.unload).not.toHaveBeenCalled();
  expect(scheduler.pause).toHaveBeenCalled();
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/__tests__/AppStateBridge.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/AppStateBridge.ts src/services/translation/__tests__/AppStateBridge.test.ts
git commit -m "feat(prefetch): AppStateBridge unloads on background"
```

---

### Task 3.2: Idle timer 5min — user resets, prefetch does not

**Files:**
- Modify: `src/services/translation/ModelLifecycleManager.ts`.
- Test: `src/services/translation/__tests__/ModelLifecycleManager.idleTimer.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/__tests__/ModelLifecycleManager.idleTimer.test.ts
import { ModelLifecycleManager } from '@/services/translation/ModelLifecycleManager';

describe('ModelLifecycleManager — idle timer', () => {
  beforeEach(() => ModelLifecycleManager.resetForTests());

  it('unloads after idleTimeoutMs of inactivity', async () => {
    jest.useFakeTimers();
    const ctx = { completion: jest.fn(async () => ({ text: 'x' })), release: jest.fn(async () => {}) };
    const m = new ModelLifecycleManager({
      loader: async () => ctx as any,
      idleTimeoutMs: 1000,
    });
    await m.ensureLoaded();
    expect(m.getSnapshot().state).toBe('ready');
    jest.advanceTimersByTime(1100);
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.release).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('user inference resets idle timer', async () => {
    jest.useFakeTimers();
    const ctx = { completion: jest.fn(async () => ({ text: 'x' })), release: jest.fn(async () => {}) };
    const m = new ModelLifecycleManager({
      loader: async () => ctx as any,
      idleTimeoutMs: 1000,
    });
    await m.ensureLoaded();
    jest.advanceTimersByTime(800);
    await m.runInference('p', {}, 'user');
    jest.advanceTimersByTime(800);
    await Promise.resolve();
    expect(ctx.release).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('prefetch inference does NOT reset idle timer', async () => {
    jest.useFakeTimers();
    const ctx = { completion: jest.fn(async () => ({ text: 'x' })), release: jest.fn(async () => {}) };
    const m = new ModelLifecycleManager({
      loader: async () => ctx as any,
      idleTimeoutMs: 1000,
    });
    await m.ensureLoaded();
    jest.advanceTimersByTime(800);
    await m.runInference('p', {}, 'prefetch');
    jest.advanceTimersByTime(300);
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.release).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/__tests__/ModelLifecycleManager.idleTimer.test.ts`
Expected: FAIL — auto-unload not implemented.

- [ ] **Step 3: Add idle timer**

In `ModelLifecycleManager`:

```typescript
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimeoutMs: number;
```

Init in constructor:

```typescript
    this.idleTimeoutMs = opts.idleTimeoutMs ?? 5 * 60 * 1000;
```

Add helpers:

```typescript
  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleSince = Date.now();
    this.idleTimer = setTimeout(() => {
      if (this.state === 'ready') void this.unload();
    }, this.idleTimeoutMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
```

Hook in:

- After successful load (state → ready) call `this.resetIdleTimer()`.
- After `user` priority runInference success call `this.resetIdleTimer()`. For `prefetch`, do NOT.
- In `unload()` call `this.clearIdleTimer()`.

Also export `onUserActivity()` for reader scroll:

```typescript
  onUserActivity(): void {
    if (this.state === 'ready' || this.state === 'inferring') {
      this.resetIdleTimer();
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/__tests__/ModelLifecycleManager.idleTimer.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/ModelLifecycleManager.ts src/services/translation/__tests__/ModelLifecycleManager.idleTimer.test.ts
git commit -m "feat(prefetch): 5min idle timer auto-unload (user resets, prefetch does not)"
```

---

### Task 3.3: BatteryBridge — wire expo-battery → lifecycle

**Files:**
- Create: `src/services/translation/BatteryBridge.ts`.
- Test: `src/services/translation/__tests__/BatteryBridge.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/__tests__/BatteryBridge.test.ts (E0-1)
import * as Battery from 'expo-battery';
import { BatteryBridge } from '@/services/translation/BatteryBridge';

describe('BatteryBridge', () => {
  beforeEach(() => {
    (Battery.getBatteryLevelAsync as jest.Mock).mockResolvedValue(1);
    (Battery.getBatteryStateAsync as jest.Mock).mockResolvedValue(Battery.BatteryState.CHARGING);
    (Battery.isLowPowerModeEnabledAsync as jest.Mock).mockResolvedValue(false);
  });

  it('start fetches initial state via 3 composed calls and emits', async () => {
    (Battery.getBatteryLevelAsync as jest.Mock).mockResolvedValueOnce(0.42);
    (Battery.getBatteryStateAsync as jest.Mock).mockResolvedValueOnce(Battery.BatteryState.UNPLUGGED);
    (Battery.isLowPowerModeEnabledAsync as jest.Mock).mockResolvedValueOnce(false);
    const lifecycle = { onBatteryStateChange: jest.fn() } as any;
    const bridge = new BatteryBridge(lifecycle);
    await bridge.start();
    expect(lifecycle.onBatteryStateChange).toHaveBeenCalledWith({
      pct: 0.42, charging: false, lowPower: false,
    });
  });

  it('battery level listener forwards updates', async () => {
    let captured: ((e: any) => void) | null = null;
    (Battery.addBatteryLevelListener as jest.Mock).mockImplementationOnce((cb) => {
      captured = cb;
      return { remove: jest.fn() };
    });
    const lifecycle = { onBatteryStateChange: jest.fn() } as any;
    const bridge = new BatteryBridge(lifecycle);
    await bridge.start();
    captured!({ batteryLevel: 0.18 });
    expect(lifecycle.onBatteryStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ pct: 0.18 }),
    );
  });

  it('battery state listener forwards charging transitions', async () => {
    let captured: ((e: any) => void) | null = null;
    (Battery.addBatteryStateListener as jest.Mock).mockImplementationOnce((cb) => {
      captured = cb;
      return { remove: jest.fn() };
    });
    const lifecycle = { onBatteryStateChange: jest.fn() } as any;
    const bridge = new BatteryBridge(lifecycle);
    await bridge.start();
    captured!({ batteryState: Battery.BatteryState.UNPLUGGED });
    expect(lifecycle.onBatteryStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ charging: false }),
    );
  });

  it('stop removes all three listeners', async () => {
    const remove1 = jest.fn();
    const remove2 = jest.fn();
    const remove3 = jest.fn();
    (Battery.addBatteryLevelListener as jest.Mock).mockReturnValueOnce({ remove: remove1 });
    (Battery.addBatteryStateListener as jest.Mock).mockReturnValueOnce({ remove: remove2 });
    (Battery.addLowPowerModeListener as jest.Mock).mockReturnValueOnce({ remove: remove3 });
    const lifecycle = { onBatteryStateChange: jest.fn() } as any;
    const bridge = new BatteryBridge(lifecycle);
    await bridge.start();
    bridge.stop();
    expect(remove1).toHaveBeenCalled();
    expect(remove2).toHaveBeenCalled();
    expect(remove3).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/__tests__/BatteryBridge.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation (E0-1)**

`Battery.getPowerStateAsync` was removed from `expo-battery` in SDK 54. We
compose the same data from three independent calls run in parallel, and
listen on three separate listeners (level, state, low-power).

```typescript
// src/services/translation/BatteryBridge.ts
import * as Battery from 'expo-battery';
import type { ModelLifecycleManager } from './ModelLifecycleManager';

export class BatteryBridge {
  private levelSub: { remove: () => void } | null = null;
  private stateSub: { remove: () => void } | null = null;
  private lowPowerSub: { remove: () => void } | null = null;
  private currentLevel = 1;
  private currentCharging = true;
  private currentLowPower = false;
  private started = false;

  constructor(private lifecycle: ModelLifecycleManager) {}

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const [pct, state, lowPower] = await Promise.all([
      Battery.getBatteryLevelAsync(),
      Battery.getBatteryStateAsync(),
      Battery.isLowPowerModeEnabledAsync(),
    ]);
    this.currentLevel = pct;
    this.currentCharging =
      state === Battery.BatteryState.CHARGING ||
      state === Battery.BatteryState.FULL;
    this.currentLowPower = lowPower;
    this.emit();

    // E0-6: explicit event types (not `(e: any)`) so SDK breaking changes
    // in event shape surface at tsc time instead of as runtime undefined.
    this.levelSub = Battery.addBatteryLevelListener(
      ({ batteryLevel }: Battery.BatteryLevelEvent) => {
        this.currentLevel = batteryLevel;
        this.emit();
      },
    );
    this.stateSub = Battery.addBatteryStateListener(
      ({ batteryState }: Battery.BatteryStateEvent) => {
        this.currentCharging =
          batteryState === Battery.BatteryState.CHARGING ||
          batteryState === Battery.BatteryState.FULL;
        this.emit();
      },
    );
    this.lowPowerSub = Battery.addLowPowerModeListener(
      ({ lowPowerMode }: Battery.PowerModeEvent) => {
        this.currentLowPower = lowPowerMode;
        this.emit();
      },
    );
  }

  stop(): void {
    this.levelSub?.remove();
    this.stateSub?.remove();
    this.lowPowerSub?.remove();
    this.levelSub = null;
    this.stateSub = null;
    this.lowPowerSub = null;
    this.started = false;
  }

  private emit(): void {
    this.lifecycle.onBatteryStateChange({
      pct: this.currentLevel,
      charging: this.currentCharging,
      lowPower: this.currentLowPower,
    });
  }
}
```

(Step 1 above already exercises the composed Promise.all + `stateSub.remove`
assertion. No further test edits needed.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/__tests__/BatteryBridge.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/BatteryBridge.ts src/services/translation/__tests__/BatteryBridge.test.ts
git commit -m "feat(prefetch): BatteryBridge wires expo-battery to lifecycle gates"
```

---

### Task 3.4: Lazy reload indicator + accessibilityLiveRegion

**Files:**
- Create: `src/components/translation/LazyReloadIndicator.tsx`.
- Test: `src/components/translation/__tests__/LazyReloadIndicator.test.tsx`.
- Modify: `src/i18n/locales/en.json` + `src/i18n/locales/ru.json` (P1-H — Task 3.4 commits keys it depends on; Task 6.1 adds remaining prefetch UI keys).

> **P1-M:** Renamed `LazyReloadShimmer` → `LazyReloadIndicator`. There is no
> actual Reanimated shimmer animation in v1 — just a static bar + label. The
> shimmer animation is deferred to v2. The name now matches the visual.

- [ ] **Step 1: Write failing test**

```typescript
// src/components/translation/__tests__/LazyReloadIndicator.test.tsx
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render } from '@testing-library/react-native';
import { LazyReloadIndicator } from '@/components/translation/LazyReloadIndicator';

describe('LazyReloadIndicator', () => {
  it('renders nothing when not visible', () => {
    const { queryByTestId } = render(<LazyReloadIndicator visible={false} />);
    expect(queryByTestId('lazy-reload-indicator')).toBeNull();
  });

  it('renders with accessibilityLiveRegion="polite" when visible', () => {
    const { getByTestId } = render(<LazyReloadIndicator visible={true} />);
    const node = getByTestId('lazy-reload-indicator');
    expect(node.props.accessibilityLiveRegion).toBe('polite');
  });

  // P1-L: also announces via AccessibilityInfo for VoiceOver/TalkBack.
  it('calls AccessibilityInfo.announceForAccessibility when toggled visible', () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const { rerender } = render(<LazyReloadIndicator visible={false} />);
    rerender(<LazyReloadIndicator visible={true} />);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/translation/__tests__/LazyReloadIndicator.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write component**

```tsx
// src/components/translation/LazyReloadIndicator.tsx
import React, { useEffect } from 'react';
import { View, Text, AccessibilityInfo } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';

interface Props {
  visible: boolean;
}

export const LazyReloadIndicator: React.FC<Props> = ({ visible }) => {
  const { t } = useTranslation();
  // P1-L: belt + braces accessibility. accessibilityLiveRegion (Android)
  // and AccessibilityInfo.announceForAccessibility (iOS VoiceOver) together
  // guarantee the announcement on both platforms.
  useEffect(() => {
    if (visible) {
      AccessibilityInfo.announceForAccessibility(t('translation.lazyReload.preparing'));
    }
  }, [visible, t]);
  if (!visible) return null;
  return (
    <View
      testID="lazy-reload-indicator"
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      style={styles.container}
    >
      <View style={styles.bar} />
      <Text style={styles.label}>{t('translation.lazyReload.preparing')}</Text>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  bar: {
    height: 4,
    flex: 1,
    backgroundColor: theme.accentSoft,
    borderRadius: 2,
  },
  label: {
    color: theme.ink2,
    fontSize: 13,
  },
}));
```

P1-H: Task 3.4 commits both the EN AND RU strings it depends on, so it can
land before Task 6.1 without breaking the ru locale. Task 6.1 adds the
remaining prefetch UI keys (toggleLabel, keepReadyLabel, etc) on top.

```json
// src/i18n/locales/en.json — under "translation":
"lazyReload": { "preparing": "Preparing translator…" }
```

```json
// src/i18n/locales/ru.json — under "translation":
"lazyReload": { "preparing": "Готовим переводчик…" }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/translation/__tests__/LazyReloadIndicator.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/translation/LazyReloadIndicator.tsx src/components/translation/__tests__/LazyReloadIndicator.test.tsx src/i18n/locales/en.json src/i18n/locales/ru.json
git commit -m "feat(prefetch): LazyReloadIndicator with liveRegion + announceForAccessibility"
```

---

## Phase 4 — Prefetch building blocks

### Task 4.1: lemmatizeHeuristic — en/es/fr/it/pt suffix strip

**Files:**
- Create: `src/services/translation/prefetch/lemmatizeHeuristic.ts`.
- Test: `src/services/translation/prefetch/__tests__/lemmatizeHeuristic.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/prefetch/__tests__/lemmatizeHeuristic.test.ts
import { lemmatizeHeuristic } from '@/services/translation/prefetch/lemmatizeHeuristic';

describe('lemmatizeHeuristic', () => {
  describe('English', () => {
    it('strips -ing', () => expect(lemmatizeHeuristic('running', 'en')).toBe('run'));
    it('strips -ed', () => expect(lemmatizeHeuristic('walked', 'en')).toBe('walk'));
    it('strips -es', () => expect(lemmatizeHeuristic('boxes', 'en')).toBe('box'));
    it('strips -s', () => expect(lemmatizeHeuristic('cats', 'en')).toBe('cat'));
    it('keeps short words intact', () => expect(lemmatizeHeuristic('is', 'en')).toBe('is'));
    it('lowercases', () => expect(lemmatizeHeuristic('Running', 'en')).toBe('run'));
  });

  describe('Romance languages', () => {
    it('es: strips -ando/-iendo', () => expect(lemmatizeHeuristic('hablando', 'es')).toBe('habl'));
    it('fr: strips -ant/-ent verb plurals', () => expect(lemmatizeHeuristic('chantent', 'fr')).toBe('chant'));
    it('it: strips -ando/-endo', () => expect(lemmatizeHeuristic('parlando', 'it')).toBe('parl'));
    it('pt: strips -ndo', () => expect(lemmatizeHeuristic('falando', 'pt')).toBe('fal'));
  });

  describe('surface form fallback', () => {
    it('ru: returns surface lowercase', () => expect(lemmatizeHeuristic('Книгами', 'ru')).toBe('книгами'));
    it('de: returns surface lowercase', () => expect(lemmatizeHeuristic('Häuser', 'de')).toBe('häuser'));
    it('ja: returns surface lowercase', () => expect(lemmatizeHeuristic('読書', 'ja')).toBe('読書'));
    it('ko: returns surface lowercase', () => expect(lemmatizeHeuristic('읽기', 'ko')).toBe('읽기'));
    it('ar: returns surface lowercase', () => expect(lemmatizeHeuristic('كتاب', 'ar')).toBe('كتاب'));
    it('hi: returns surface lowercase', () => expect(lemmatizeHeuristic('किताब', 'hi')).toBe('किताब'));
    it('pl: returns surface lowercase', () => expect(lemmatizeHeuristic('Książkami', 'pl')).toBe('książkami'));
    it('uk: returns surface lowercase', () => expect(lemmatizeHeuristic('Книжок', 'uk')).toBe('книжок'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/prefetch/__tests__/lemmatizeHeuristic.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

```typescript
// src/services/translation/prefetch/lemmatizeHeuristic.ts
import type { BookLanguage } from '@/types/settings';

const EN_SUFFIXES = ['ing', 'ed', 'ies', 'es', 's'];
const ROMANCE_GERUND_ES = ['iendo', 'ando'];
const ROMANCE_GERUND_IT = ['endo', 'ando'];
const ROMANCE_GERUND_PT = ['indo', 'ndo', 'ando'];
const FR_VERB_ENDINGS = ['ent', 'ant', 'ons', 'ez'];

function stripSuffix(word: string, suffixes: string[]): string {
  for (const suf of suffixes) {
    if (word.length > suf.length + 2 && word.endsWith(suf)) {
      return word.slice(0, -suf.length);
    }
  }
  return word;
}

export function lemmatizeHeuristic(word: string, lang: BookLanguage): string {
  const lower = word.toLowerCase();
  switch (lang) {
    case 'en':
      return stripSuffix(lower, EN_SUFFIXES);
    case 'es':
      return stripSuffix(lower, ROMANCE_GERUND_ES);
    case 'it':
      return stripSuffix(lower, ROMANCE_GERUND_IT);
    case 'pt':
      return stripSuffix(lower, ROMANCE_GERUND_PT);
    case 'fr':
      return stripSuffix(lower, FR_VERB_ENDINGS);
    case 'ru':
    case 'uk':
    case 'pl':
    case 'de':
    case 'ar':
    case 'hi':
    case 'ja':
    case 'ko':
    default:
      return lower;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/prefetch/__tests__/lemmatizeHeuristic.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/prefetch/lemmatizeHeuristic.ts src/services/translation/prefetch/__tests__/lemmatizeHeuristic.test.ts
git commit -m "feat(prefetch): lemmatizeHeuristic for en/es/fr/it/pt + surface fallback"
```

---

### Task 4.2: properNounHeuristic — capital + not sentence-initial (DE disabled)

**Files:**
- Create: `src/services/translation/prefetch/properNounHeuristic.ts`.
- Test: `src/services/translation/prefetch/__tests__/properNounHeuristic.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/prefetch/__tests__/properNounHeuristic.test.ts
import { isProperNounHeuristic } from '@/services/translation/prefetch/properNounHeuristic';

describe('isProperNounHeuristic', () => {
  it('capital word mid-sentence is proper noun (en)', () => {
    expect(isProperNounHeuristic('Pierre', 'I met Pierre yesterday.', 'en')).toBe(true);
  });

  it('lowercase word is never proper noun', () => {
    expect(isProperNounHeuristic('book', 'A book is here.', 'en')).toBe(false);
  });

  it('sentence-initial capital is NOT proper noun', () => {
    expect(isProperNounHeuristic('The', 'The book is here.', 'en')).toBe(false);
  });

  it('after period+space, capital is NOT proper noun (sentence start)', () => {
    expect(isProperNounHeuristic('She', 'He left. She arrived.', 'en')).toBe(false);
  });

  it('always returns false for German (all nouns capitalized)', () => {
    expect(isProperNounHeuristic('Haus', 'Das Haus ist groß.', 'de')).toBe(false);
    expect(isProperNounHeuristic('Buch', 'Ich lese ein Buch.', 'de')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/prefetch/__tests__/properNounHeuristic.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

```typescript
// src/services/translation/prefetch/properNounHeuristic.ts
import type { BookLanguage } from '@/types/settings';

export function isProperNounHeuristic(
  word: string,
  sentenceText: string,
  lang: BookLanguage,
): boolean {
  if (lang === 'de') return false;
  if (!word) return false;
  const first = word[0];
  if (first !== first.toUpperCase() || first === first.toLowerCase()) return false;
  const idx = sentenceText.indexOf(word);
  if (idx <= 0) return false;
  const prev = sentenceText[idx - 1];
  const prevPrev = idx >= 2 ? sentenceText[idx - 2] : '';
  if (prev === ' ' && (prevPrev === '.' || prevPrev === '!' || prevPrev === '?')) return false;
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/prefetch/__tests__/properNounHeuristic.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/prefetch/properNounHeuristic.ts src/services/translation/prefetch/__tests__/properNounHeuristic.test.ts
git commit -m "feat(prefetch): properNounHeuristic with DE disabled"
```

---

### Task 4.3: frequencyLists loader + placeholder fixtures (generator-driven)

**Files:**
- Create: `scripts/generate-freq-fixtures.ts` (T0-4 fixture generator).
- Create: `assets/freq/{en,ru,pl,uk,es,fr,de,it,pt,ja,ko,ar,hi}.txt` (output of generator).
- Create: `src/services/translation/prefetch/frequencyLists.ts`.
- Test: `src/services/translation/prefetch/__tests__/frequencyLists.test.ts`.

> **T0-4:** v1 ships seed lists of 50 entries × 13 langs from a hand-picked
> table. Real curation (full ~5k frequency lists per lang from corpus +
> license clearance) is deferred — see CLAUDE.md v2 backlog
> "Frequency-list curation". The runtime loader is identical; only the
> fixture sizes change in v2.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/prefetch/__tests__/frequencyLists.test.ts
import { loadFrequencyList, freqCutoffByCEFR } from '@/services/translation/prefetch/frequencyLists';

describe('frequencyLists', () => {
  it('freqCutoffByCEFR maps A1..C2 to numeric cutoffs', () => {
    expect(freqCutoffByCEFR('A1')).toBe(500);
    expect(freqCutoffByCEFR('A2')).toBe(1000);
    expect(freqCutoffByCEFR('B1')).toBe(3000);
    expect(freqCutoffByCEFR('B2')).toBe(6000);
    expect(freqCutoffByCEFR('C1')).toBe(10000);
    expect(freqCutoffByCEFR('C2')).toBe(20000);
  });

  it('loadFrequencyList(en) returns non-empty array', async () => {
    const list = await loadFrequencyList('en');
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('list is cached on second call', async () => {
    const a = await loadFrequencyList('en');
    const b = await loadFrequencyList('en');
    expect(a).toBe(b);
  });

  it('falls back to empty list for missing lang', async () => {
    const list = await loadFrequencyList('xx' as any);
    expect(list).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/prefetch/__tests__/frequencyLists.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write fixture generator script (T0-4)**

```typescript
// scripts/generate-freq-fixtures.ts
// Generates placeholder frequency lists (50 entries × 13 langs) from a
// hand-picked seed table. Run via:
//   npx ts-node scripts/generate-freq-fixtures.ts
// Production-quality curation (full ~5k lists from corpora + license
// clearance) is a v2 backlog item — see CLAUDE.md "Frequency-list curation".
//
// Output: assets/freq/{lang}.txt (newline-separated surface forms).

import * as fs from 'fs';
import * as path from 'path';

const SEED: Record<string, string[]> = {
  en: ['the','of','and','to','a','in','that','is','was','it','for','with','as','on','be','at','by','this','have','from','or','one','had','not','but','what','all','were','when','we','there','can','an','your','which','their','said','if','do','will','each','about','how','up','out','them','then','she','many','some'],
  ru: ['и','в','не','на','я','быть','что','он','с','а','как','это','по','но','они','к','у','ты','из','мы','за','вы','так','же','от','для','о','все','то','один','свой','который','этот','наш','такой','еще','уже','очень','можно','когда','если','только','тогда','здесь','там','теперь','хорошо','что-то'],
  es: ['de','la','que','el','en','y','a','los','del','se','las','por','un','para','con','no','una','su','al','lo','como','más','pero','sus','le','ya','o','este','sí','porque','esta','entre','cuando','muy','sin','sobre','también','me','hasta','hay','donde','quien','desde','todo','nos','durante','todos','uno','les','ni'],
  fr: ['le','de','un','être','et','à','il','avoir','ne','je','son','que','se','qui','ce','dans','en','du','elle','au','pour','pas','vous','par','sur','faire','plus','dire','me','on','mon','lui','nous','comme','mais','pouvoir','avec','tout','y','aller','voir','bien','où','sans','tu','ou','leur','homme','femme','jour'],
  it: ['di','a','da','in','con','su','per','tra','fra','il','lo','la','i','gli','le','un','uno','una','e','che','non','si','è','sono','sei','ho','hai','ha','abbiamo','avete','hanno','ero','eri','era','molto','poco','più','meno','bene','male','qui','là','dove','quando','come','perché','ora','sempre','mai','poi'],
  pt: ['de','a','o','que','e','do','da','em','um','para','com','não','uma','os','no','se','na','por','mais','as','dos','como','mas','foi','ao','ele','das','tem','à','seu','sua','ou','ser','quando','muito','há','nos','já','está','eu','também','só','pelo','pela','até','isso','ela','entre','era','depois'],
  de: ['der','die','und','in','den','von','zu','das','mit','sich','des','auf','für','ist','im','dem','nicht','ein','eine','als','auch','es','an','werden','aus','er','hat','dass','sie','nach','wird','bei','einer','um','am','sind','noch','wie','einem','über','einen','so','zum','war','haben','nur','oder','aber','vor','zur'],
  pl: ['i','w','nie','na','się','z','do','jest','to','że','o','a','tak','ale','jak','co','już','tylko','być','jeszcze','przez','przy','po','dla','tu','tam','gdzie','kiedy','kto','dlaczego','też','aż','niż','więc','bo','czy','albo','lub','jednak','więcej','mniej','dobry','zły','duży','mały','nowy','stary','dom','dzień','rok'],
  uk: ['і','в','не','на','я','з','що','він','а','як','це','по','але','вони','до','у','ти','ми','за','ви','так','же','від','для','о','все','то','один','свій','який','цей','наш','такий','ще','вже','дуже','можна','коли','якщо','тільки','тепер','тут','там','зараз','добре','щось','хто','чий','знову','день'],
  ja: ['の','に','は','を','た','が','と','で','て','だ','し','れ','さ','ある','いる','する','から','な','こと','として','まで','その','ない','ね','よ','か','です','ます','でした','ました','私','あなた','彼','彼女','彼ら','これ','それ','あれ','どれ','ここ','そこ','あそこ','どこ','いつ','なぜ','どう','何','誰','日','人'],
  ko: ['이','는','을','를','에','의','와','과','도','로','으로','만','부터','까지','에서','에게','한테','보다','처럼','같이','하다','있다','없다','되다','이다','아니다','그','이','저','어떤','무슨','어느','언제','어디','왜','어떻게','얼마나','매우','조금','많이','적게','잘','못','좋다','나쁘다','크다','작다','새','오래','날'],
  ar: ['في','من','على','إلى','أن','عن','مع','هذا','هذه','ذلك','تلك','الذي','التي','الذين','هو','هي','هم','هن','أنا','أنت','نحن','أنتم','كان','كانت','كانوا','يكون','تكون','يصبح','عند','عندما','حيث','بعد','قبل','بين','تحت','فوق','أمام','خلف','يمين','يسار','كثير','قليل','جيد','سيء','كبير','صغير','جديد','قديم','جميل','سريع'],
  hi: ['है','में','का','की','के','और','से','को','यह','वह','था','थी','थे','हैं','हो','होगा','होगी','मैं','तुम','हम','आप','वे','यहाँ','वहाँ','कब','कहाँ','क्यों','कैसे','क्या','कौन','सब','कुछ','कोई','हर','अच्छा','बुरा','बड़ा','छोटा','नया','पुराना','तेज़','धीमा','दिन','रात','साल','महीना','समय','पानी','खाना','घर'],
};

const SUPPORTED = Object.keys(SEED);
const OUT_DIR = path.join(__dirname, '..', 'assets', 'freq');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
for (const lang of SUPPORTED) {
  const list = SEED[lang].slice(0, 50);
  fs.writeFileSync(path.join(OUT_DIR, `${lang}.txt`), list.join('\n') + '\n');
}
console.log(`Generated ${SUPPORTED.length} fixture files in ${OUT_DIR}`);
```

Run the generator once to produce 13 .txt files:

```bash
npx ts-node scripts/generate-freq-fixtures.ts
```

Then write the loader. We use `.txt` (newline-separated) rather than JSON
arrays because (a) smaller bundle size, (b) easier to diff in PRs:

```typescript
// src/services/translation/prefetch/frequencyLists.ts
import type { BookLanguage } from '@/types/settings';
import type { ProficiencyLevel } from '@/types/settings';

const cache = new Map<string, string[]>();

// Static require'd asset modules — Metro inlines these at build time.
// The .txt files ship in `assets/freq/` (see scripts/generate-freq-fixtures.ts).
const LOADERS: Record<BookLanguage, () => string> = {
  en: () => require('@/../assets/freq/en.txt') as string,
  ru: () => require('@/../assets/freq/ru.txt') as string,
  pl: () => require('@/../assets/freq/pl.txt') as string,
  uk: () => require('@/../assets/freq/uk.txt') as string,
  es: () => require('@/../assets/freq/es.txt') as string,
  fr: () => require('@/../assets/freq/fr.txt') as string,
  de: () => require('@/../assets/freq/de.txt') as string,
  it: () => require('@/../assets/freq/it.txt') as string,
  pt: () => require('@/../assets/freq/pt.txt') as string,
  ja: () => require('@/../assets/freq/ja.txt') as string,
  ko: () => require('@/../assets/freq/ko.txt') as string,
  ar: () => require('@/../assets/freq/ar.txt') as string,
  hi: () => require('@/../assets/freq/hi.txt') as string,
};

export async function loadFrequencyList(lang: BookLanguage): Promise<string[]> {
  if (cache.has(lang)) return cache.get(lang)!;
  const loader = LOADERS[lang];
  if (!loader) {
    cache.set(lang, []);
    return [];
  }
  try {
    const raw = loader();
    const list = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    cache.set(lang, list);
    return list;
  } catch {
    cache.set(lang, []);
    return [];
  }
}

const CUTOFFS: Record<ProficiencyLevel, number> = {
  A1: 500, A2: 1000, B1: 3000, B2: 6000, C1: 10000, C2: 20000,
};

export function freqCutoffByCEFR(level: ProficiencyLevel): number {
  return CUTOFFS[level] ?? 1000;
}
```

Note: if Metro doesn't ship `.txt` as text by default, add this to
`metro.config.js`:
`config.resolver.assetExts.push('txt');`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/prefetch/__tests__/frequencyLists.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-freq-fixtures.ts src/services/translation/prefetch/frequencyLists.ts src/services/translation/prefetch/__tests__/frequencyLists.test.ts assets/freq/
git commit -m "feat(prefetch): frequencyLists loader + 13-lang seed fixtures (50 entries each)"
```

---

### Task 4.4: findCandidateWords — combine freq cutoff + known words + lemmatize

**Files:**
- Create: `src/services/translation/prefetch/findCandidateWords.ts`.
- Test: `src/services/translation/prefetch/__tests__/findCandidateWords.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/prefetch/__tests__/findCandidateWords.test.ts
import { findCandidateWords } from '@/services/translation/prefetch/findCandidateWords';

describe('findCandidateWords', () => {
  it('returns words above CEFR cutoff that are not known', async () => {
    const result = await findCandidateWords({
      texts: ['She demonstrated extraordinary perseverance during the experiment.'],
      bookLanguage: 'en',
      bookLanguageLevel: 'A2',
      knownWords: new Set<string>(),
    });
    // 'demonstrated', 'extraordinary', 'perseverance', 'experiment' are uncommon → candidates
    expect(result.words).toEqual(expect.arrayContaining(['demonstrat', 'extraordinary', 'perseverance', 'experiment']));
    // 'the', 'she', 'during' are common → filtered
    expect(result.words).not.toContain('the');
  });

  it('filters out proper nouns', async () => {
    const result = await findCandidateWords({
      texts: ['Pierre walked to the marketplace.'],
      bookLanguage: 'en',
      bookLanguageLevel: 'A2',
      knownWords: new Set<string>(),
    });
    expect(result.words).not.toContain('pierre');
  });

  it('respects knownWords set', async () => {
    const result = await findCandidateWords({
      texts: ['The marketplace was crowded.'],
      bookLanguage: 'en',
      bookLanguageLevel: 'A2',
      knownWords: new Set(['marketplace']),
    });
    expect(result.words).not.toContain('marketplace');
  });

  it('returns deduplicated lemmas', async () => {
    const result = await findCandidateWords({
      texts: ['running runs ran runner runners'],
      bookLanguage: 'en',
      bookLanguageLevel: 'A2',
      knownWords: new Set<string>(),
    });
    // After lemmatization "running"→"run", "runs"→"run", "runner"→"runner" etc.
    const unique = new Set(result.words);
    expect(unique.size).toBe(result.words.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/prefetch/__tests__/findCandidateWords.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

```typescript
// src/services/translation/prefetch/findCandidateWords.ts
import type { BookLanguage, ProficiencyLevel } from '@/types/settings';
import { lemmatizeHeuristic } from './lemmatizeHeuristic';
import { isProperNounHeuristic } from './properNounHeuristic';
import { loadFrequencyList, freqCutoffByCEFR } from './frequencyLists';

export interface FindCandidatesInput {
  texts: string[];
  bookLanguage: BookLanguage;
  bookLanguageLevel: ProficiencyLevel;
  knownWords: Set<string>;
}

export interface CandidateResult {
  words: string[];
}

const WORD_REGEX = /[\p{L}\p{N}]+/gu;

export async function findCandidateWords(
  input: FindCandidatesInput,
): Promise<CandidateResult> {
  const freq = await loadFrequencyList(input.bookLanguage);
  const cutoff = freqCutoffByCEFR(input.bookLanguageLevel);
  const known = new Set(freq.slice(0, cutoff).map((w) => w.toLowerCase()));
  const candidates = new Set<string>();

  for (const text of input.texts) {
    const tokens = text.match(WORD_REGEX) ?? [];
    for (const token of tokens) {
      if (isProperNounHeuristic(token, text, input.bookLanguage)) continue;
      const lemma = lemmatizeHeuristic(token, input.bookLanguage);
      if (!lemma || lemma.length < 2) continue;
      if (known.has(lemma)) continue;
      if (input.knownWords.has(lemma)) continue;
      candidates.add(lemma);
    }
  }

  return { words: Array.from(candidates) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/prefetch/__tests__/findCandidateWords.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/prefetch/findCandidateWords.ts src/services/translation/prefetch/__tests__/findCandidateWords.test.ts
git commit -m "feat(prefetch): findCandidateWords combines freq cutoff + lemma + proper noun filter"
```

---

### Task 4.5: extractMweCandidates — scan via mweDictionary

**Files:**
- Create: `src/services/translation/prefetch/extractMweCandidates.ts`.
- Test: `src/services/translation/prefetch/__tests__/extractMweCandidates.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/prefetch/__tests__/extractMweCandidates.test.ts
import { extractMweCandidates } from '@/services/translation/prefetch/extractMweCandidates';

describe('extractMweCandidates', () => {
  it('finds known MWE phrases in text', () => {
    const dict = [
      { phrase: 'pick up', sourceLang: 'en', targetLang: 'ru', translationEquivalent: 'подбирать' },
      { phrase: 'kick the bucket', sourceLang: 'en', targetLang: 'ru', translationEquivalent: 'умереть' },
    ];
    const hits = extractMweCandidates({
      texts: ['She decided to pick up the book.'],
      mweDictionary: dict as any,
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(hits.map((h) => h.phrase)).toContain('pick up');
    expect(hits.map((h) => h.phrase)).not.toContain('kick the bucket');
  });

  it('deduplicates MWE found multiple times', () => {
    const dict = [{ phrase: 'on the way', sourceLang: 'en', targetLang: 'ru', translationEquivalent: 'по пути' }];
    const hits = extractMweCandidates({
      texts: ['On the way home. On the way back. On the way out.'],
      mweDictionary: dict as any,
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(hits.length).toBe(1);
  });

  it('filters by language pair', () => {
    const dict = [{ phrase: 'pick up', sourceLang: 'en', targetLang: 'fr', translationEquivalent: 'ramasser' }];
    const hits = extractMweCandidates({
      texts: ['Pick up the book.'],
      mweDictionary: dict as any,
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(hits).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/prefetch/__tests__/extractMweCandidates.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

```typescript
// src/services/translation/prefetch/extractMweCandidates.ts
import type { BookLanguage, NativeLanguage } from '@/types/settings';

export interface MwePhraseRow {
  phrase: string;
  sourceLang: string;
  targetLang: string;
  translationEquivalent: string;
  literalGloss?: string | null;
}

export interface ExtractInput {
  texts: string[];
  mweDictionary: MwePhraseRow[];
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
}

export function extractMweCandidates(input: ExtractInput): MwePhraseRow[] {
  const pairMatches = input.mweDictionary.filter(
    (m) => m.sourceLang === input.bookLanguage && m.targetLang === input.nativeLanguage,
  );
  const seen = new Set<string>();
  const result: MwePhraseRow[] = [];
  for (const text of input.texts) {
    const lower = text.toLowerCase();
    for (const m of pairMatches) {
      if (seen.has(m.phrase)) continue;
      if (lower.includes(m.phrase.toLowerCase())) {
        result.push(m);
        seen.add(m.phrase);
      }
    }
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/prefetch/__tests__/extractMweCandidates.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/prefetch/extractMweCandidates.ts src/services/translation/prefetch/__tests__/extractMweCandidates.test.ts
git commit -m "feat(prefetch): extractMweCandidates scans text via MWE dictionary"
```

---

## Phase 5 — PrefetchScheduler + reader wire-up

### Task 5.1: PrefetchScheduler skeleton — start/pause/resume/stop

**Files:**
- Create: `src/services/translation/prefetch/PrefetchScheduler.ts`.
- Test: `src/services/translation/prefetch/__tests__/PrefetchScheduler.lifecycle.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/prefetch/__tests__/PrefetchScheduler.lifecycle.test.ts
import { PrefetchScheduler } from '@/services/translation/prefetch/PrefetchScheduler';

function makeDeps(): any {
  return {
    lifecycle: { canPrefetch: () => true, runInference: jest.fn(), getSnapshot: () => ({ state: 'ready' }) },
    translation: { translate: jest.fn(), translateSentence: jest.fn() },
    loadFrequencyList: jest.fn(async () => []),
    extractPageTexts: jest.fn(async () => []),
    getKnownWords: jest.fn(async () => new Set<string>()),
    getMweDictionary: jest.fn(async () => []),
  };
}

describe('PrefetchScheduler — lifecycle', () => {
  it('initial state is idle', () => {
    const s = new PrefetchScheduler(makeDeps());
    expect(s.getProgress().status).toBe('idle');
  });

  it('start transitions to active for given book', () => {
    const s = new PrefetchScheduler(makeDeps());
    s.start({ bookId: 'b1', chapterIndex: 0, flatIndex: 0, bookLanguage: 'en', nativeLanguage: 'ru', bookLanguageLevel: 'A2' });
    expect(s.getProgress().status).toBe('active');
  });

  it('pause transitions to paused', () => {
    const s = new PrefetchScheduler(makeDeps());
    s.start({ bookId: 'b1', chapterIndex: 0, flatIndex: 0, bookLanguage: 'en', nativeLanguage: 'ru', bookLanguageLevel: 'A2' });
    s.pause();
    expect(s.getProgress().status).toBe('paused');
  });

  it('resume after pause goes back to active', () => {
    const s = new PrefetchScheduler(makeDeps());
    s.start({ bookId: 'b1', chapterIndex: 0, flatIndex: 0, bookLanguage: 'en', nativeLanguage: 'ru', bookLanguageLevel: 'A2' });
    s.pause();
    s.resume();
    expect(s.getProgress().status).toBe('active');
  });

  it('stop returns to idle', () => {
    const s = new PrefetchScheduler(makeDeps());
    s.start({ bookId: 'b1', chapterIndex: 0, flatIndex: 0, bookLanguage: 'en', nativeLanguage: 'ru', bookLanguageLevel: 'A2' });
    s.stop();
    expect(s.getProgress().status).toBe('idle');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/prefetch/__tests__/PrefetchScheduler.lifecycle.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write skeleton**

```typescript
// src/services/translation/prefetch/PrefetchScheduler.ts
import type { ModelLifecycleManager, ThermalLevel } from '../ModelLifecycleManager';
import type { ITranslationService } from '../ITranslationService';
import type { BookLanguage, NativeLanguage, ProficiencyLevel } from '@/types/settings';
import type { MwePhraseRow } from './extractMweCandidates';

export interface PrefetchSchedulerDeps {
  lifecycle: ModelLifecycleManager;
  translation: ITranslationService;
  loadFrequencyList: (lang: BookLanguage) => Promise<string[]>;
  extractPageTexts: (bookId: string, fromChapter: number, fromFlat: number, count: number) => Promise<string[]>;
  getKnownWords: (bookLanguage: BookLanguage) => Promise<Set<string>>;
  getMweDictionary: (bookLanguage: BookLanguage, nativeLanguage: NativeLanguage) => Promise<MwePhraseRow[]>;
}

export interface PrefetchStartOptions {
  bookId: string;
  chapterIndex: number;
  flatIndex: number;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
  bookLanguageLevel: ProficiencyLevel;
}

export type PrefetchStatus = 'idle' | 'active' | 'paused';

export class PrefetchScheduler {
  private status: PrefetchStatus = 'idle';
  private opts: PrefetchStartOptions | null = null;
  private done = 0;
  private total = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private currentBatch: Promise<void> | null = null;

  constructor(private deps: PrefetchSchedulerDeps) {}

  start(opts: PrefetchStartOptions): void {
    this.opts = opts;
    this.status = 'active';
    this.done = 0;
    this.total = 0;
  }

  pause(): void {
    if (this.status === 'active') this.status = 'paused';
  }

  resume(): void {
    if (this.status === 'paused') this.status = 'active';
  }

  stop(): void {
    this.status = 'idle';
    this.opts = null;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  onScroll(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.status !== 'active') return;
    this.idleTimer = setTimeout(() => this.runBatch().catch(() => {}), 20_000);
  }

  onUserTap(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
  }

  onBatteryChange(): void {
    if (!this.deps.lifecycle.canPrefetch()) this.pause();
    else if (this.status === 'paused') this.resume();
  }

  onThermalChange(level: ThermalLevel): void {
    if (level === 'serious' || level === 'critical') this.pause();
    else if (this.status === 'paused') this.resume();
  }

  getProgress(): { done: number; total: number; status: PrefetchStatus } {
    return { done: this.done, total: this.total, status: this.status };
  }

  private async runBatch(): Promise<void> {
    // Implemented in Task 5.2
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/prefetch/__tests__/PrefetchScheduler.lifecycle.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/prefetch/PrefetchScheduler.ts src/services/translation/prefetch/__tests__/PrefetchScheduler.lifecycle.test.ts
git commit -m "feat(prefetch): PrefetchScheduler skeleton (start/pause/resume/stop)"
```

---

### Task 5.2: runBatch — 20s idle, candidate gather, word translate

**Files:**
- Modify: `src/services/translation/prefetch/PrefetchScheduler.ts`.
- Test: `src/services/translation/prefetch/__tests__/PrefetchScheduler.runBatch.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/prefetch/__tests__/PrefetchScheduler.runBatch.test.ts
import { PrefetchScheduler } from '@/services/translation/prefetch/PrefetchScheduler';

describe('PrefetchScheduler.runBatch', () => {
  it('20s after onScroll triggers candidate translation', async () => {
    jest.useFakeTimers();
    const translate = jest.fn(async () => ({ status: 'ok', translation: 'x', source: 'inference' }));
    const deps: any = {
      lifecycle: { canPrefetch: () => true, runInference: jest.fn(), getSnapshot: () => ({ state: 'ready' }) },
      translation: { translate, translateSentence: jest.fn() },
      loadFrequencyList: async () => [],
      extractPageTexts: async () => ['extraordinary perseverance experiment'],
      getKnownWords: async () => new Set<string>(),
      getMweDictionary: async () => [],
    };
    const s = new PrefetchScheduler(deps);
    s.start({ bookId: 'b', chapterIndex: 0, flatIndex: 0, bookLanguage: 'en', nativeLanguage: 'ru', bookLanguageLevel: 'A2' });
    s.onScroll();
    jest.advanceTimersByTime(21_000);
    jest.useRealTimers();
    await new Promise((r) => setTimeout(r, 50));
    expect(translate).toHaveBeenCalled();
  });

  it('skips batch when canPrefetch returns false', async () => {
    jest.useFakeTimers();
    const translate = jest.fn();
    const deps: any = {
      lifecycle: { canPrefetch: () => false, runInference: jest.fn(), getSnapshot: () => ({ state: 'unloaded' }) },
      translation: { translate, translateSentence: jest.fn() },
      loadFrequencyList: async () => [],
      extractPageTexts: async () => ['extraordinary'],
      getKnownWords: async () => new Set<string>(),
      getMweDictionary: async () => [],
    };
    const s = new PrefetchScheduler(deps);
    s.start({ bookId: 'b', chapterIndex: 0, flatIndex: 0, bookLanguage: 'en', nativeLanguage: 'ru', bookLanguageLevel: 'A2' });
    s.onScroll();
    jest.advanceTimersByTime(21_000);
    jest.useRealTimers();
    await new Promise((r) => setTimeout(r, 20));
    expect(translate).not.toHaveBeenCalled();
  });

  it('user tap cancels pending batch timer', () => {
    jest.useFakeTimers();
    const translate = jest.fn();
    const deps: any = {
      lifecycle: { canPrefetch: () => true, runInference: jest.fn(), getSnapshot: () => ({ state: 'ready' }) },
      translation: { translate, translateSentence: jest.fn() },
      loadFrequencyList: async () => [],
      extractPageTexts: async () => ['extraordinary'],
      getKnownWords: async () => new Set<string>(),
      getMweDictionary: async () => [],
    };
    const s = new PrefetchScheduler(deps);
    s.start({ bookId: 'b', chapterIndex: 0, flatIndex: 0, bookLanguage: 'en', nativeLanguage: 'ru', bookLanguageLevel: 'A2' });
    s.onScroll();
    jest.advanceTimersByTime(15_000);
    s.onUserTap();
    jest.advanceTimersByTime(10_000);
    expect(translate).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/prefetch/__tests__/PrefetchScheduler.runBatch.test.ts`
Expected: FAIL — runBatch is no-op.

- [ ] **Step 3: Implement runBatch (P1-B + P1-C)**

Replace `runBatch` in `PrefetchScheduler.ts`. We add a re-entry guard
(`currentBatch: Promise<void> | null`) so overlapping `onScroll` timers
can't kick off duplicate batches, and a `pendingWords: Set<string>` so a
user-tap during prefetch can requeue the in-flight word back to the front
of the queue for the next batch.

```typescript
import { findCandidateWords } from './findCandidateWords';
import { extractMweCandidates } from './extractMweCandidates';

  // P1-B: re-entry guard. Concurrent timers / battery transitions could
  // otherwise spawn overlapping batches against the same opts.
  private currentBatch: Promise<void> | null = null;
  // P1-C: words queued for next batch (user-tap requeue, cancelled, etc).
  private pendingWords = new Set<string>();
  // P1-C: word currently being inferred — set before await, cleared after.
  private inflightWord: string | null = null;

  private async runBatch(): Promise<void> {
    if (this.currentBatch) return;
    this.currentBatch = this._doRunBatch();
    try {
      await this.currentBatch;
    } finally {
      this.currentBatch = null;
    }
  }

  private async _doRunBatch(): Promise<void> {
    if (this.status !== 'active') return;
    if (!this.opts) return;
    if (!this.deps.lifecycle.canPrefetch()) {
      this.pause();
      return;
    }
    const opts = this.opts;
    const texts = await this.deps.extractPageTexts(opts.bookId, opts.chapterIndex, opts.flatIndex, 3);
    const known = await this.deps.getKnownWords(opts.bookLanguage);
    const { words } = await findCandidateWords({
      texts,
      bookLanguage: opts.bookLanguage,
      bookLanguageLevel: opts.bookLanguageLevel,
      knownWords: known,
    });
    const mwes = extractMweCandidates({
      texts,
      mweDictionary: await this.deps.getMweDictionary(opts.bookLanguage, opts.nativeLanguage),
      bookLanguage: opts.bookLanguage,
      nativeLanguage: opts.nativeLanguage,
    });

    // P1-C: prepend pendingWords (requeued from previous batch / user-tap
    // interruption) so they retry first.
    const requeue = Array.from(this.pendingWords);
    this.pendingWords.clear();
    const wordBatch = [...requeue, ...words].slice(0, 50);
    const mweBatch = mwes.slice(0, 10);
    this.total = wordBatch.length + mweBatch.length;
    this.done = 0;

    for (const w of wordBatch) {
      if (this.status !== 'active') {
        // remaining words requeue for next batch.
        for (let i = wordBatch.indexOf(w); i < wordBatch.length; i++) {
          this.pendingWords.add(wordBatch[i]);
        }
        return;
      }
      if (!this.deps.lifecycle.canPrefetch()) {
        this.pause();
        return;
      }
      this.inflightWord = w;
      try {
        await this.deps.translation.translate({
          word: w,
          contextWindow: w,
          bookLanguage: opts.bookLanguage,
          nativeLanguage: opts.nativeLanguage,
          priority: 'prefetch',
        } as any);
      } catch {
        // continue with next
      } finally {
        this.inflightWord = null;
      }
      this.done += 1;
    }
    for (const m of mweBatch) {
      if (this.status !== 'active') return;
      try {
        await this.deps.translation.translate({
          word: m.phrase,
          contextWindow: m.phrase,
          bookLanguage: opts.bookLanguage,
          nativeLanguage: opts.nativeLanguage,
          priority: 'prefetch',
        } as any);
      } catch {}
      this.done += 1;
    }
  }
```

Extend `onUserTap()` in Task 5.1's skeleton to requeue the in-flight word
(P1-C). The actual in-flight inference still completes (we don't cancel
mid-call), but the LLM lifecycle's user-priority dispatcher (A0-1) will
serve the user tap right after the in-flight prefetch finishes — so the
in-flight word's translation also lands. The requeue is for the case where
`pause()` triggers before the word finishes (e.g. battery drop during user
activity).

```typescript
  onUserTap(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.inflightWord) {
      // P1-C: re-add to pendingWords so next batch retries if pause hits
      // before the in-flight word's translation gets cached.
      this.pendingWords.add(this.inflightWord);
    }
    this.deps.lifecycle.onUserActivity?.();
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/prefetch/__tests__/PrefetchScheduler.runBatch.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/prefetch/PrefetchScheduler.ts src/services/translation/prefetch/__tests__/PrefetchScheduler.runBatch.test.ts
git commit -m "feat(prefetch): runBatch translates 50 words + 10 MWE after 20s idle"
```

---

### Task 5.3: Sentence prefetch path — split + gate by enableJaKoPrefetch

**Files:**
- Modify: `src/services/translation/prefetch/PrefetchScheduler.ts`.
- Modify: `src/types/settings.ts` (add `enableJaKoPrefetch: boolean` default false).
- Modify: `src/stores/settingsStore.ts` (allowlist + setter).
- Test: `src/services/translation/prefetch/__tests__/PrefetchScheduler.sentence.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/prefetch/__tests__/PrefetchScheduler.sentence.test.ts
import { PrefetchScheduler } from '@/services/translation/prefetch/PrefetchScheduler';

describe('PrefetchScheduler — sentence prefetch + JA/KO gate', () => {
  it('skips JA when enableJaKoPrefetch=false', async () => {
    jest.useFakeTimers();
    const translate = jest.fn();
    const deps: any = {
      lifecycle: { canPrefetch: () => true, runInference: jest.fn(), getSnapshot: () => ({ state: 'ready' }) },
      translation: { translate, translateSentence: jest.fn() },
      loadFrequencyList: async () => [],
      extractPageTexts: async () => ['見知らぬ単語'],
      getKnownWords: async () => new Set<string>(),
      getMweDictionary: async () => [],
      isJaKoPrefetchEnabled: () => false,
    };
    const s = new PrefetchScheduler(deps);
    s.start({ bookId: 'b', chapterIndex: 0, flatIndex: 0, bookLanguage: 'ja', nativeLanguage: 'en', bookLanguageLevel: 'A2' });
    s.onScroll();
    jest.advanceTimersByTime(21_000);
    jest.useRealTimers();
    await new Promise((r) => setTimeout(r, 20));
    expect(translate).not.toHaveBeenCalled();
  });

  it('runs JA when enableJaKoPrefetch=true', async () => {
    jest.useFakeTimers();
    const translate = jest.fn(async () => ({ status: 'ok', translation: 'x', source: 'inference' }));
    const deps: any = {
      lifecycle: { canPrefetch: () => true, runInference: jest.fn(), getSnapshot: () => ({ state: 'ready' }) },
      translation: { translate, translateSentence: jest.fn() },
      loadFrequencyList: async () => [],
      extractPageTexts: async () => ['見知らぬ単語'],
      getKnownWords: async () => new Set<string>(),
      getMweDictionary: async () => [],
      isJaKoPrefetchEnabled: () => true,
    };
    const s = new PrefetchScheduler(deps);
    s.start({ bookId: 'b', chapterIndex: 0, flatIndex: 0, bookLanguage: 'ja', nativeLanguage: 'en', bookLanguageLevel: 'A2' });
    s.onScroll();
    jest.advanceTimersByTime(21_000);
    jest.useRealTimers();
    await new Promise((r) => setTimeout(r, 20));
    expect(translate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/prefetch/__tests__/PrefetchScheduler.sentence.test.ts`
Expected: FAIL — `isJaKoPrefetchEnabled` not consulted.

- [ ] **Step 3: Add gate + wire setting**

In `src/types/settings.ts` add (inside `SettingsState`):

```typescript
  enableJaKoPrefetch: boolean;
```

And to `DEFAULT_SETTINGS`:

```typescript
  enableJaKoPrefetch: false,
```

In `src/stores/settingsStore.ts` add to ALLOWLIST:

```typescript
'enableJaKoPrefetch',
```

Add setter to actions:

```typescript
  setEnableJaKoPrefetch: (v: boolean) => void;
```

And implementation:

```typescript
  setEnableJaKoPrefetch: (v) => set({ enableJaKoPrefetch: v }),
```

In `PrefetchSchedulerDeps` add:

```typescript
  isJaKoPrefetchEnabled: () => boolean;
```

In `runBatch`, before extracting texts:

```typescript
    const lang = opts.bookLanguage;
    if ((lang === 'ja' || lang === 'ko') && !this.deps.isJaKoPrefetchEnabled()) {
      this.pause();
      return;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/prefetch/__tests__/PrefetchScheduler.sentence.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/prefetch/PrefetchScheduler.ts src/services/translation/prefetch/__tests__/PrefetchScheduler.sentence.test.ts src/types/settings.ts src/stores/settingsStore.ts
git commit -m "feat(prefetch): JA/KO prefetch gated by enableJaKoPrefetch setting (default off)"
```

---

### Task 5.4: usePrefetchScheduler hook + wire in reader

**Files:**
- Create: `src/services/translation/prefetch/usePrefetchScheduler.ts`.
- Modify: `app/reader/[bookId].tsx` (mount + onScroll/onUserTap hooks).
- Test: `src/services/translation/prefetch/__tests__/usePrefetchScheduler.test.tsx`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/prefetch/__tests__/usePrefetchScheduler.test.tsx
import { renderHook, act } from '@testing-library/react-native';
import { usePrefetchScheduler } from '@/services/translation/prefetch/usePrefetchScheduler';

jest.mock('@/services/translation/prefetch/PrefetchScheduler', () => {
  const start = jest.fn();
  const stop = jest.fn();
  const onScroll = jest.fn();
  const onUserTap = jest.fn();
  return {
    PrefetchScheduler: jest.fn().mockImplementation(() => ({
      start, stop, pause: jest.fn(), resume: jest.fn(),
      onScroll, onUserTap, onBatteryChange: jest.fn(), onThermalChange: jest.fn(),
      getProgress: () => ({ done: 0, total: 0, status: 'active' }),
    })),
    __mocks: { start, stop, onScroll, onUserTap },
  };
});

describe('usePrefetchScheduler', () => {
  it('returns scheduler control surface', () => {
    const { result } = renderHook(() => usePrefetchScheduler());
    expect(result.current).toHaveProperty('start');
    expect(result.current).toHaveProperty('onScroll');
    expect(result.current).toHaveProperty('onUserTap');
    expect(result.current).toHaveProperty('stop');
  });

  it('stops on unmount', () => {
    const { unmount } = renderHook(() => usePrefetchScheduler());
    unmount();
    const mocks = require('@/services/translation/prefetch/PrefetchScheduler').__mocks;
    expect(mocks.stop).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/prefetch/__tests__/usePrefetchScheduler.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write hook + minimal wire (P1-N + T0-2 + T0-3)**

P1-N: scheduler creation, start, and stop all live in the SAME `useEffect`
keyed on book identity, so cleanup is deterministic.

T0-3: `extractPageTexts` flattens `ContentItem.inlines` from the reader's
chapter array — see new Task 5.4a below for the helper.

```typescript
// src/services/translation/prefetch/usePrefetchScheduler.ts
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTranslationService } from '../TranslationServiceContext';
import { ModelLifecycleManager } from '../ModelLifecycleManager';
import { PrefetchScheduler } from './PrefetchScheduler';
import { loadFrequencyList } from './frequencyLists';
import { extractPageTexts } from './extractPageTexts';
import type { BookChapter } from '@/types/content';

export interface UsePrefetchSchedulerArgs {
  chapters: BookChapter[];
}

export function usePrefetchScheduler({ chapters }: UsePrefetchSchedulerArgs) {
  const enableJaKo = useSettingsStore((s) => s.enableJaKoPrefetch);
  const prefetchEnabled = useSettingsStore((s) => s.prefetchEnabled);
  const translation = useTranslationService();
  // Stable ref to chapters so closures don't re-create scheduler every nav.
  const chaptersRef = useRef(chapters);
  useEffect(() => { chaptersRef.current = chapters; }, [chapters]);

  const scheduler = useMemo(() => {
    if (!prefetchEnabled) return null;
    return new PrefetchScheduler({
      lifecycle: ModelLifecycleManager.instance(),
      translation,
      loadFrequencyList,
      extractPageTexts: async (_bookId, fromChapter, _fromFlat, count) =>
        extractPageTexts(chaptersRef.current, fromChapter, count),
      getKnownWords: async () => new Set<string>(),
      getMweDictionary: async () => [],
      isJaKoPrefetchEnabled: () => enableJaKo,
    });
  }, [translation, enableJaKo, prefetchEnabled]);

  useEffect(() => () => { scheduler?.stop(); }, [scheduler]);

  // No-op fallbacks when prefetchEnabled === false so callers don't need
  // null-check at every call-site.
  const noop = useCallback(() => {}, []);
  return {
    start: (opts: Parameters<PrefetchScheduler['start']>[0]) =>
      scheduler ? scheduler.start(opts) : undefined,
    stop: () => scheduler?.stop(),
    pause: () => scheduler?.pause(),
    resume: () => scheduler?.resume(),
    onScroll: scheduler ? () => scheduler.onScroll() : noop,
    onUserTap: scheduler ? () => scheduler.onUserTap() : noop,
    onBatteryChange: () => scheduler?.onBatteryChange(),
    getProgress: () =>
      scheduler?.getProgress() ?? { done: 0, total: 0, status: 'idle' as const },
  };
}
```

**T0-2 — Concrete reader wire-up patches** against
`app/reader/[bookId].tsx`. The reader's current shape (verified from
`grep -n` 2026-05-18):
- `onWordTap = useCallback(async (word, _sentence, inlines, charOffset) => {...}` (line ~90).
- `onTopFlatItemChange = useCallback((flatIndex) => {...})` (line ~256) — runs on every FlatList scroll position update from BookRenderer (so we piggyback `prefetch.onScroll()` here; there's no direct `onScroll` prop).
- `state.chapters` is the BookChapter[] array used for rendering.

Patch 1 — add the hook + start effect, near top of component (after
`useReaderEngine` line):

```typescript
// In app/reader/[bookId].tsx, after `const { state, jumpToChapter, ...`
// line, add:
import { usePrefetchScheduler } from '@/services/translation/prefetch/usePrefetchScheduler';

// ...later in the function body, after state derived:
const prefetch = usePrefetchScheduler({ chapters: state.chapters });
// Single useEffect for start + cleanup (P1-N).
useEffect(() => {
  if (state.status !== 'ready' || !state.book) return;
  prefetch.start({
    bookId: state.book.id,
    chapterIndex: state.currentChapterIndex,
    flatIndex: lastFlatIndexRef.current,
    bookLanguage: bookLang,
    nativeLanguage: nativeLanguage as NativeLanguage,
    bookLanguageLevel: 'A2', // TODO: read from settings.bookLanguageLevel when wired
  });
  return () => prefetch.stop();
}, [state.status, state.book?.id, state.currentChapterIndex, bookLang, nativeLanguage]);
```

Patch 2 — `onWordTap` must call `prefetch.onUserTap()` at the very top of
the callback. Use Edit with the existing function header as anchor:

`old_string`:
```
  const onWordTap = useCallback(
    async (word: string, _sentence: string, inlines: InlineNode[], charOffset: number) => {
      const gen = ++generationRef.current;

      const ctx = extractContextForWord(inlines, word, charOffset, bookLang);
```

`new_string`:
```
  const onWordTap = useCallback(
    async (word: string, _sentence: string, inlines: InlineNode[], charOffset: number) => {
      const gen = ++generationRef.current;
      // #4.6: tell prefetch scheduler about user activity. Cancels pending
      // 20s batch timer, requeues any in-flight prefetch word (P1-C).
      prefetch.onUserTap();

      const ctx = extractContextForWord(inlines, word, charOffset, bookLang);
```

Patch 3 — `onTopFlatItemChange` is BookRenderer's scroll-position callback.
Hook `prefetch.onScroll()` there so the 20s idle timer restarts on every
scroll position update.

`old_string`:
```
  const onTopFlatItemChange = useCallback(
    (flatIndex: number) => {
      lastFlatIndexRef.current = flatIndex;
      // Во время restore (veil активен) не save — иначе промежуточные индексы
      // от FlatList'a OVERWRITE'ят сохранённую позицию пользователя.
      if (veilTarget !== null) return;
      savePosition(state.currentChapterIndex, flatIndex);
    },
    [savePosition, state.currentChapterIndex, veilTarget],
  );
```

`new_string`:
```
  const onTopFlatItemChange = useCallback(
    (flatIndex: number) => {
      lastFlatIndexRef.current = flatIndex;
      // #4.6: scroll activity restarts 20s prefetch idle timer.
      prefetch.onScroll();
      // Во время restore (veil активен) не save — иначе промежуточные индексы
      // от FlatList'a OVERWRITE'ят сохранённую позицию пользователя.
      if (veilTarget !== null) return;
      savePosition(state.currentChapterIndex, flatIndex);
    },
    [savePosition, state.currentChapterIndex, veilTarget, prefetch],
  );
```

Add `prefetch` to `onWordTap`'s dependency array as well (the existing
useCallback already lists `bookLang`, `nativeLanguage`, etc — append
`prefetch`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/prefetch/__tests__/usePrefetchScheduler.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/prefetch/usePrefetchScheduler.ts src/services/translation/prefetch/__tests__/usePrefetchScheduler.test.tsx app/reader/\[bookId\].tsx
git commit -m "feat(prefetch): usePrefetchScheduler hook + wire reader onScroll/onUserTap"
```

---

### Task 5.4a: extractPageTexts helper

**Files:**
- Create: `src/services/translation/prefetch/extractPageTexts.ts`.
- Test: `src/services/translation/prefetch/__tests__/extractPageTexts.test.ts`.

> **T0-3:** flattens `BookChapter[]` → text strings for N+1..N+lookahead
> chapters. Used by `usePrefetchScheduler`'s scheduler config (Task 5.4).

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/prefetch/__tests__/extractPageTexts.test.ts
import { extractPageTexts } from '@/services/translation/prefetch/extractPageTexts';
import type { BookChapter } from '@/types/content';

function chap(index: number, text: string): BookChapter {
  return {
    index,
    title: `Ch ${index}`,
    items: [{ type: 'paragraph', inlines: [{ type: 'text', text }] }],
  } as any;
}

describe('extractPageTexts', () => {
  it('returns N+1..N+count chapter texts', () => {
    const chapters = [chap(0, 'a'), chap(1, 'b'), chap(2, 'c'), chap(3, 'd')];
    const out = extractPageTexts(chapters, 0, 2);
    expect(out).toEqual(['b', 'c']);
  });

  it('caps at end of book', () => {
    const chapters = [chap(0, 'a'), chap(1, 'b')];
    const out = extractPageTexts(chapters, 0, 5);
    expect(out).toEqual(['b']);
  });

  it('flattens heading + paragraph items', () => {
    const chapters: BookChapter[] = [
      { index: 0, title: 't', items: [] } as any,
      {
        index: 1, title: 't',
        items: [
          { type: 'heading', level: 1, inlines: [{ type: 'text', text: 'Title' }] },
          { type: 'paragraph', inlines: [{ type: 'text', text: 'Body' }] },
        ],
      } as any,
    ];
    const out = extractPageTexts(chapters, 0, 1);
    expect(out[0]).toContain('Title');
    expect(out[0]).toContain('Body');
  });
});
```

- [ ] **Step 2: Run**

Run: `npx jest src/services/translation/prefetch/__tests__/extractPageTexts.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/prefetch/extractPageTexts.ts
import type { BookChapter, ContentItem, InlineNode } from '@/types/content';

function flattenInlines(inlines: InlineNode[]): string {
  return inlines
    .map((n) => ('text' in n ? n.text : ''))
    .join('');
}

function flattenItem(item: ContentItem): string {
  switch (item.type) {
    case 'heading':
    case 'paragraph':
      return flattenInlines(item.inlines);
    case 'blockquote':
      return item.items.map(flattenItem).join('\n');
    case 'list':
      return item.items.map((row) => row.map(flattenItem).join(' ')).join('\n');
    default:
      return '';
  }
}

export function extractPageTexts(
  chapters: BookChapter[],
  currentChapterIdx: number,
  lookahead: number,
): string[] {
  const out: string[] = [];
  const start = currentChapterIdx + 1;
  const end = Math.min(currentChapterIdx + lookahead, chapters.length - 1);
  for (let i = start; i <= end; i++) {
    out.push(chapters[i].items.map(flattenItem).join('\n'));
  }
  return out;
}
```

- [ ] **Step 4: Run**

Run: `npx jest src/services/translation/prefetch/__tests__/extractPageTexts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/prefetch/extractPageTexts.ts src/services/translation/prefetch/__tests__/extractPageTexts.test.ts
git commit -m "feat(prefetch): extractPageTexts flattens BookChapter[] for lookahead prefetch"
```

---

## Phase 6 — Settings UI + i18n + dev overlay

### Task 6.1: i18n strings for prefetch UI (en + ru)

**Files:**
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`.
- Test: `src/i18n/__tests__/prefetchStrings.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/i18n/__tests__/prefetchStrings.test.ts
import en from '@/i18n/locales/en.json';
import ru from '@/i18n/locales/ru.json';

const KEYS = [
  'settings.prefetch.title',
  'settings.prefetch.toggleLabel',
  'settings.prefetch.keepReadyLabel',
  'settings.prefetch.keepReady.fiveMin',
  'settings.prefetch.keepReady.onDemand',
  'settings.prefetch.advanced',
  'settings.prefetch.enableJaKo',
  'settings.prefetch.resetCoachMark',
  'settings.prefetch.redownload',
  'settings.prefetch.statusReady',
  'settings.prefetch.statusPaused',
  'settings.prefetch.permanentlyDisabled',
  'settings.prefetch.retry',
  'translation.lazyReload.preparing',
];

function dig(obj: any, path: string): any {
  return path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), obj);
}

describe('prefetch UI i18n strings', () => {
  it('en locale has all prefetch keys', () => {
    for (const k of KEYS) expect(typeof dig(en, k)).toBe('string');
  });
  it('ru locale has all prefetch keys', () => {
    for (const k of KEYS) expect(typeof dig(ru, k)).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/i18n/__tests__/prefetchStrings.test.ts`
Expected: FAIL — keys missing.

- [ ] **Step 3: Add keys to en.json + ru.json**

In `src/i18n/locales/en.json`, add to existing `settings` block:

```json
"prefetch": {
  "title": "Translation model",
  "toggleLabel": "Pre-translate following pages",
  "keepReadyLabel": "Keep translator ready",
  "keepReady": {
    "fiveMin": "5 min after use (recommended)",
    "onDemand": "Only when needed (saves battery, slower first tap)"
  },
  "advanced": "Advanced",
  "enableJaKo": "Enable Japanese/Korean prefetch (slower, can cache wrong forms)",
  "resetCoachMark": "Reset coach mark hint",
  "redownload": "Delete and re-download model",
  "statusReady": "Pre-translation: Ready",
  "statusPaused": "Pre-translation: Paused — {{reason}}",
  "permanentlyDisabled": "Translation unavailable on this device.",
  "retry": "Retry"
}
```

And under `translation`:

```json
"lazyReload": { "preparing": "Preparing translator…" }
```

Mirror in `src/i18n/locales/ru.json` with Russian copy.

> **P1-H:** `translation.lazyReload.preparing` was already added to both
> en.json + ru.json by Task 3.4 (which depends on it). Task 6.1 may
> re-declare the key in the patch text — it's idempotent (same value), so
> the second JSON merge is a no-op. The prefetchStrings test still passes.

> **P1-P — Plural-form keys for counts.** Where the UI shows
> "{n} translations cached" (e.g. dev overlay, settings stats), use
> i18next's plural-suffix convention. For ru add `_one`/`_few`/`_many`/`_other`,
> for en add `_one`/`_other`. Example:
>
> ```json
> "prefetchProgress_one":  "{{count}} translation ready",
> "prefetchProgress_other":"{{count}} translations ready"
> ```
>
> Russian:
>
> ```json
> "prefetchProgress_one":  "{{count}} перевод готов",
> "prefetchProgress_few":  "{{count}} перевода готовы",
> "prefetchProgress_many": "{{count}} переводов готовы",
> "prefetchProgress_other":"{{count}} переводов готовы"
> ```
>
> For the other 11 locales, copy ru-style plural forms where needed (pl, uk
> need _few/_many; ar needs _zero/_two/_few/_many; ja/ko/de/fr/es/it/pt/hi
> have simpler plural rules). i18next handles selection automatically given
> the `count` interpolation variable.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/i18n/__tests__/prefetchStrings.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/__tests__/prefetchStrings.test.ts
git commit -m "feat(prefetch): i18n strings for settings + lazy reload (en+ru)"
```

---

### Task 6.2: Propagate prefetch strings to remaining 11 locales

**Files:**
- Modify: `src/i18n/locales/{pl,uk,es,fr,de,it,pt,ja,ko,ar,hi}.json`.

- [ ] **Step 1: Write failing test**

```typescript
// src/i18n/__tests__/prefetchStrings.allLocales.test.ts
import en from '@/i18n/locales/en.json';
import pl from '@/i18n/locales/pl.json';
import uk from '@/i18n/locales/uk.json';
import es from '@/i18n/locales/es.json';
import fr from '@/i18n/locales/fr.json';
import de from '@/i18n/locales/de.json';
import it from '@/i18n/locales/it.json';
import pt from '@/i18n/locales/pt.json';
import ja from '@/i18n/locales/ja.json';
import ko from '@/i18n/locales/ko.json';
import ar from '@/i18n/locales/ar.json';
import hi from '@/i18n/locales/hi.json';

const REQUIRED = [
  'settings.prefetch.title', 'settings.prefetch.toggleLabel',
  'settings.prefetch.keepReadyLabel', 'settings.prefetch.advanced',
  'settings.prefetch.statusReady', 'translation.lazyReload.preparing',
];
const dig = (obj: any, p: string) => p.split('.').reduce((a, k) => a?.[k], obj);

describe.each([
  ['pl', pl], ['uk', uk], ['es', es], ['fr', fr], ['de', de], ['it', it],
  ['pt', pt], ['ja', ja], ['ko', ko], ['ar', ar], ['hi', hi],
])('%s locale has core prefetch keys', (_name, locale) => {
  it.each(REQUIRED)('%s', (key) => {
    expect(typeof dig(locale, key)).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/i18n/__tests__/prefetchStrings.allLocales.test.ts`
Expected: FAIL — keys missing in 11 locales.

- [ ] **Step 3: Add prefetch + lazyReload sections to each of 11 locales (T0-5)**

> **T0-5 — honest fallback policy.** Translating these UX-heavy strings into
> 11 languages without a native review is hallucination per CLAUDE.md
> ("Never hallucinate"). v1 ships English fallback for the 11 non-en/ru
> locales, with an explicit marker so v2 can pick them up for professional
> translation.

In each of `pl.json, uk.json, es.json, fr.json, de.json, it.json, pt.json,
ja.json, ko.json, ar.json, hi.json` add the SAME JSON shape as en.json
(Task 6.1), with VERBATIM English values, plus a `_NEEDS_TRANSLATION: true`
marker at the parent level so we can grep for pending-translation locales:

```json
// e.g. src/i18n/locales/pl.json, under existing "settings":
"prefetch": {
  "_NEEDS_TRANSLATION": true,
  "title": "Translation model",
  "toggleLabel": "Pre-translate following pages",
  "keepReadyLabel": "Keep translator ready",
  "keepReady": {
    "fiveMin": "5 min after use (recommended)",
    "onDemand": "Only when needed (saves battery, slower first tap)"
  },
  "advanced": "Advanced",
  "enableJaKo": "Enable Japanese/Korean prefetch (slower, can cache wrong forms)",
  "resetCoachMark": "Reset coach mark hint",
  "redownload": "Delete and re-download model",
  "statusReady": "Pre-translation: Ready",
  "statusPaused": "Pre-translation: Paused — {{reason}}",
  "permanentlyDisabled": "Translation unavailable on this device.",
  "retry": "Retry"
}
```

And under `translation` (sibling key already present from Task 6.1
mirror): same fallback shape.

```json
"translation": {
  // ... existing keys ...
  "lazyReload": {
    "_NEEDS_TRANSLATION": true,
    "preparing": "Preparing translator…"
  }
}
```

The `_NEEDS_TRANSLATION` keys are scoped under `prefetch` / `lazyReload`
parents (not at root), so they don't pollute other parts of each locale.
Task 8.5 (CLAUDE.md update) appends a v2-backlog item:

> **Professional translation pass — #4.6 prefetch UI keys.** 11 locales
> currently ship English fallbacks for `settings.prefetch.*` and
> `translation.lazyReload.*` (marked `_NEEDS_TRANSLATION: true`). Source via
> native speakers / translation service before v2 release.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/i18n/__tests__/prefetchStrings.allLocales.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/pl.json src/i18n/locales/uk.json src/i18n/locales/es.json src/i18n/locales/fr.json src/i18n/locales/de.json src/i18n/locales/it.json src/i18n/locales/pt.json src/i18n/locales/ja.json src/i18n/locales/ko.json src/i18n/locales/ar.json src/i18n/locales/hi.json src/i18n/__tests__/prefetchStrings.allLocales.test.ts
git commit -m "feat(prefetch): propagate prefetch i18n keys to 11 remaining locales"
```

---

### Task 6.3: Prefetch toggle + KeepReady dropdown + Advanced disclosure

**Files:**
- Create: `src/components/settings/PrefetchSection.tsx`.
- Test: `src/components/settings/__tests__/PrefetchSection.test.tsx`.
- Modify: `src/types/settings.ts` (`prefetchEnabled: boolean`, `keepTranslatorReady: 'five_min' | 'on_demand'`).
- Modify: `src/stores/settingsStore.ts` (ALLOWLIST + setters).

- [ ] **Step 1: Write failing test**

```typescript
// src/components/settings/__tests__/PrefetchSection.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PrefetchSection } from '@/components/settings/PrefetchSection';

describe('PrefetchSection', () => {
  it('renders toggle and keep-ready dropdown', () => {
    const { getByTestId } = render(<PrefetchSection />);
    expect(getByTestId('prefetch-toggle')).toBeTruthy();
    expect(getByTestId('keep-ready-dropdown')).toBeTruthy();
  });

  it('Advanced disclosure expands to show JA/KO toggle', () => {
    const { getByTestId, queryByTestId } = render(<PrefetchSection />);
    expect(queryByTestId('ja-ko-toggle')).toBeNull();
    fireEvent.press(getByTestId('advanced-disclosure'));
    expect(getByTestId('ja-ko-toggle')).toBeTruthy();
  });

  it('renders binary status indicator', () => {
    const { getByTestId } = render(<PrefetchSection />);
    expect(getByTestId('prefetch-status')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/settings/__tests__/PrefetchSection.test.tsx`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement section + settings**

In `src/types/settings.ts`:

```typescript
export type KeepTranslatorReady = 'five_min' | 'on_demand';

// inside SettingsState:
prefetchEnabled: boolean;
keepTranslatorReady: KeepTranslatorReady;

// inside DEFAULT_SETTINGS:
prefetchEnabled: true,
keepTranslatorReady: 'five_min',
```

In `src/stores/settingsStore.ts` ALLOWLIST add `'prefetchEnabled', 'keepTranslatorReady'`. Add to actions:

```typescript
  setPrefetchEnabled: (v: boolean) => void;
  setKeepTranslatorReady: (v: KeepTranslatorReady) => void;
```

Implementation:

```typescript
  setPrefetchEnabled: (v) => set({ prefetchEnabled: v }),
  setKeepTranslatorReady: (v) => set({ keepTranslatorReady: v }),
```

Create component:

```tsx
// src/components/settings/PrefetchSection.tsx
import React, { useState } from 'react';
import { View, Text, Switch, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import { useSettingsStore } from '@/stores/settingsStore';

export const PrefetchSection: React.FC = () => {
  const { t } = useTranslation();
  const prefetchEnabled = useSettingsStore((s) => s.prefetchEnabled);
  const setPrefetchEnabled = useSettingsStore((s) => s.setPrefetchEnabled);
  const keepReady = useSettingsStore((s) => s.keepTranslatorReady);
  const setKeepReady = useSettingsStore((s) => s.setKeepTranslatorReady);
  const jaKo = useSettingsStore((s) => s.enableJaKoPrefetch);
  const setJaKo = useSettingsStore((s) => s.setEnableJaKoPrefetch);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('settings.prefetch.title')}</Text>
      <View style={styles.row}>
        <Text style={styles.label}>{t('settings.prefetch.toggleLabel')}</Text>
        <Switch
          testID="prefetch-toggle"
          value={prefetchEnabled}
          onValueChange={setPrefetchEnabled}
          accessibilityLabel={t('settings.prefetch.toggleLabel')}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t('settings.prefetch.keepReadyLabel')}</Text>
        {/* P1-O: radio group for a11y (was a toggling Pressable). */}
        <View
          testID="keep-ready-dropdown"
          accessibilityRole="radiogroup"
          style={{ flexDirection: 'row', gap: 8 }}
        >
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: keepReady === 'five_min' }}
            onPress={() => setKeepReady('five_min')}
          >
            <Text style={styles.value}>{t('settings.prefetch.keepReady.fiveMin')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: keepReady === 'on_demand' }}
            onPress={() => setKeepReady('on_demand')}
          >
            <Text style={styles.value}>{t('settings.prefetch.keepReady.onDemand')}</Text>
          </Pressable>
        </View>
      </View>
      <Text testID="prefetch-status" style={styles.status}>
        {prefetchEnabled ? t('settings.prefetch.statusReady') : t('settings.prefetch.statusPaused', { reason: 'off' })}
      </Text>
      <Pressable
        testID="advanced-disclosure"
        onPress={() => setAdvancedOpen((v) => !v)}
        accessibilityRole="button"
      >
        <Text style={styles.label}>{t('settings.prefetch.advanced')}</Text>
      </Pressable>
      {advancedOpen && (
        <View style={styles.advanced}>
          <View style={styles.row}>
            <Text style={styles.label}>{t('settings.prefetch.enableJaKo')}</Text>
            <Switch
              testID="ja-ko-toggle"
              value={jaKo}
              onValueChange={setJaKo}
              accessibilityLabel={t('settings.prefetch.enableJaKo')}
            />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: { paddingVertical: 16, gap: 12 },
  title: { color: theme.ink, fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: theme.ink2, fontSize: 14 },
  value: { color: theme.accent, fontSize: 14 },
  status: { color: theme.ink3, fontSize: 13 },
  advanced: { paddingVertical: 8, gap: 12 },
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/settings/__tests__/PrefetchSection.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/PrefetchSection.tsx src/components/settings/__tests__/PrefetchSection.test.tsx src/types/settings.ts src/stores/settingsStore.ts
git commit -m "feat(prefetch): Settings PrefetchSection with toggle/dropdown/advanced disclosure"
```

---

### Task 6.4: Dev overlay behind long-press on About app-version (T0-1)

**Files:**
- Create: `src/components/settings/PrefetchDevOverlay.tsx`.
- Create: `src/components/settings/AboutSection.tsx` (NEW — verified 2026-05-18, no existing About section in the project).
- Modify: `app/(tabs)/settings.tsx` (mount `<AboutSection />` at bottom of ScrollView).
- Test: `src/components/settings/__tests__/PrefetchDevOverlay.test.tsx`.
- Test: `src/components/settings/__tests__/AboutSection.test.tsx`.

> **T0-1 verification (2026-05-18):** `find src/components/settings/` shows
> `FeedbackList.tsx`, `TranslationModelSection.tsx`, `TranslationSection.tsx`,
> no `AboutSection.tsx`. `app/(tabs)/settings.tsx` does NOT currently render
> version info. We create `AboutSection.tsx` and mount it.

- [ ] **Step 1: Write failing test**

```typescript
// src/components/settings/__tests__/PrefetchDevOverlay.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { PrefetchDevOverlay } from '@/components/settings/PrefetchDevOverlay';

const fakeSnapshot = {
  state: 'ready' as const,
  loadedAt: Date.now() - 60_000,
  idleSinceMs: 1000,
  thermalLevel: 'nominal' as const,
  batteryPct: 0.67,
  charging: false,
  lowPowerMode: false,
  consecutiveLoadFailures: 0,
  prefetchActive: true,
};

describe('PrefetchDevOverlay', () => {
  it('renders nothing when not visible', () => {
    const { queryByTestId } = render(<PrefetchDevOverlay visible={false} snapshot={fakeSnapshot} progress={{ done: 18, total: 45, status: 'active' }} />);
    expect(queryByTestId('prefetch-dev-overlay')).toBeNull();
  });

  it('renders lifecycle state + progress + battery', () => {
    const { getByTestId } = render(<PrefetchDevOverlay visible={true} snapshot={fakeSnapshot} progress={{ done: 18, total: 45, status: 'active' }} />);
    const node = getByTestId('prefetch-dev-overlay');
    expect(node).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/settings/__tests__/PrefetchDevOverlay.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write component**

```tsx
// src/components/settings/PrefetchDevOverlay.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { LifecycleSnapshot } from '@/services/translation/ModelLifecycleManager';

interface Props {
  visible: boolean;
  snapshot: LifecycleSnapshot;
  progress: { done: number; total: number; status: string };
}

export const PrefetchDevOverlay: React.FC<Props> = ({ visible, snapshot, progress }) => {
  if (!visible) return null;
  return (
    <View testID="prefetch-dev-overlay" style={styles.container} accessibilityLabel="Dev prefetch overlay">
      <Text style={styles.text}>LLM lifecycle: {snapshot.state}</Text>
      <Text style={styles.text}>Prefetch: {progress.done}/{progress.total} ({progress.status})</Text>
      <Text style={styles.text}>Battery: {Math.round(snapshot.batteryPct * 100)}% {snapshot.charging ? '(charging)' : '(not charging)'}</Text>
      <Text style={styles.text}>Thermal: {snapshot.thermalLevel}</Text>
      <Text style={styles.text}>Consecutive load failures: {snapshot.consecutiveLoadFailures}</Text>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: { padding: 12, backgroundColor: theme.paper2, borderRadius: theme.sizes.radii.md, gap: 4 },
  text: { color: theme.ink2, fontSize: 12, fontFamily: 'Courier' },
}));
```

Create `AboutSection.tsx` which owns the long-press → overlay state:

```tsx
// src/components/settings/AboutSection.tsx
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { PrefetchDevOverlay } from './PrefetchDevOverlay';
import { ModelLifecycleManager } from '@/services/translation/ModelLifecycleManager';

export const AboutSection: React.FC = () => {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const [showDev, setShowDev] = useState(false);
  const version = Constants.expoConfig?.version ?? '0.0.0';
  // Read snapshot lazily — dev overlay is rare path.
  const snapshot = showDev ? ModelLifecycleManager.instance().getSnapshot() : null;
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Pressable
        onLongPress={() => setShowDev((s) => !s)}
        accessibilityRole="text"
        accessibilityLabel={t('settings.about.version', { defaultValue: 'App version' })}
      >
        <Text style={{ color: theme.ink3, fontSize: 12 }}>v{version}</Text>
      </Pressable>
      {showDev && snapshot && (
        <PrefetchDevOverlay
          visible
          snapshot={snapshot}
          progress={{ done: 0, total: 0, status: 'idle' }}
        />
      )}
    </View>
  );
};
```

Test for `AboutSection`:

```tsx
// src/components/settings/__tests__/AboutSection.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AboutSection } from '@/components/settings/AboutSection';
import { ModelLifecycleManager } from '@/services/translation/ModelLifecycleManager';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

describe('AboutSection', () => {
  beforeEach(() => {
    ModelLifecycleManager.resetForTests();
    // Initialize singleton with no-op loader so getSnapshot() works.
    ModelLifecycleManager.instance({ loader: async () => ({} as any) });
  });

  it('renders version text', () => {
    const { getByText } = render(<AboutSection />);
    expect(getByText(/v1\.0\.0/)).toBeTruthy();
  });

  it('long-press on version toggles dev overlay', () => {
    const { getByText, queryByTestId } = render(<AboutSection />);
    expect(queryByTestId('prefetch-dev-overlay')).toBeNull();
    fireEvent(getByText(/v1\.0\.0/), 'longPress');
    expect(queryByTestId('prefetch-dev-overlay')).toBeTruthy();
  });
});
```

Mount `<AboutSection />` at the bottom of `app/(tabs)/settings.tsx`'s
ScrollView:

```typescript
import { AboutSection } from '@/components/settings/AboutSection';
// ...inside JSX, after existing sections:
<AboutSection />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/settings/__tests__/PrefetchDevOverlay.test.tsx src/components/settings/__tests__/AboutSection.test.tsx`
Expected: PASS, 4 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/PrefetchDevOverlay.tsx src/components/settings/AboutSection.tsx src/components/settings/__tests__/PrefetchDevOverlay.test.tsx src/components/settings/__tests__/AboutSection.test.tsx app/\(tabs\)/settings.tsx
git commit -m "feat(prefetch): dev overlay behind long-press on About app-version"
```

---

## Phase 7 — Kernel verify + atomic upgrade + disk purge

### Task 7.1: scripts/verify-kernel.ts — 10 fixtures, temp=0, exit 1 on mismatch

**Files:**
- Create: `scripts/verify-kernel.ts`.
- Create: `scripts/fixtures/kernel-fixtures.json`.
- Test: `scripts/__tests__/verifyKernel.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// scripts/__tests__/verifyKernel.test.ts
import { runVerification, KernelFixture } from '@/../scripts/verify-kernel';

describe('verify-kernel runner', () => {
  it('returns 0 when all fixtures match', async () => {
    const fixtures: KernelFixture[] = [
      { prompt: 'hi', expectedOutput: 'hello' },
    ];
    const fakeCompletion = jest.fn(async () => ({ text: 'hello' }));
    const code = await runVerification(fixtures, fakeCompletion);
    expect(code).toBe(0);
  });

  it('returns 1 when any fixture mismatches', async () => {
    const fixtures: KernelFixture[] = [
      { prompt: 'hi', expectedOutput: 'hello' },
    ];
    const fakeCompletion = jest.fn(async () => ({ text: 'goodbye' }));
    const code = await runVerification(fixtures, fakeCompletion);
    expect(code).toBe(1);
  });

  it('normalizes output (trim + lowercase) before compare', async () => {
    const fixtures: KernelFixture[] = [
      { prompt: 'hi', expectedOutput: 'hello' },
    ];
    const fakeCompletion = jest.fn(async () => ({ text: '  HELLO  \n' }));
    const code = await runVerification(fixtures, fakeCompletion);
    expect(code).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/__tests__/verifyKernel.test.ts`
Expected: FAIL — script missing.

- [ ] **Step 3: Write script**

```typescript
// scripts/verify-kernel.ts
export interface KernelFixture {
  prompt: string;
  expectedOutput: string;
}

export type FakeCompletion = (prompt: string, config: any) => Promise<{ text: string }>;

export async function runVerification(
  fixtures: KernelFixture[],
  completion: FakeCompletion,
): Promise<0 | 1> {
  for (const f of fixtures) {
    const result = await completion(f.prompt, {
      temperature: 0.0,
      top_k: 1,
      n_predict: 8,
    });
    const normalized = result.text.trim().toLowerCase();
    if (normalized !== f.expectedOutput.toLowerCase()) {
      console.error(`MISMATCH: prompt="${f.prompt}" expected="${f.expectedOutput}" got="${normalized}"`);
      return 1;
    }
  }
  console.log(`All ${fixtures.length} fixtures passed.`);
  return 0;
}

// CLI entry — only runs in node script context, not under jest.
// P1-J: real adapter's completion signature is (messages, config) two-arg
// (see src/services/translation/LlamaContextAdapter.ts). The CLI wraps a
// fresh raw initLlama context — which uses the single-object params form
// — through LlamaContextAdapter so the call shape matches production.
if (require.main === module) {
  const fixtures = require('./fixtures/kernel-fixtures.json') as KernelFixture[];
  (async () => {
    try {
      const { initLlama } = require('llama.rn');
      const { getModelLocalPath } = require('../src/services/translation/modelManifest');
      const { LlamaContextAdapter } = require('../src/services/translation/LlamaContextAdapter');
      const native = await initLlama({ model: getModelLocalPath(), n_ctx: 512 });
      const ctx = new LlamaContextAdapter(native);
      const code = await runVerification(fixtures, async (prompt, cfg) => {
        // Two-arg call matching real production path.
        const result = await ctx.completion(
          [{ role: 'user', content: prompt }],
          { temperature: 0.0, top_k: 1, max_tokens: 8, ...cfg },
        );
        return { text: result.text };
      });
      process.exit(code);
    } catch (e) {
      console.error('verify-kernel error:', (e as Error).message);
      process.exit(1);
    }
  })();
}
```

```json
// scripts/fixtures/kernel-fixtures.json
[
  { "prompt": "Translate to Russian: hello", "expectedOutput": "привет" },
  { "prompt": "Translate to Russian: world", "expectedOutput": "мир" },
  { "prompt": "Translate to Russian: book", "expectedOutput": "книга" },
  { "prompt": "Translate to Russian: water", "expectedOutput": "вода" },
  { "prompt": "Translate to Russian: sun", "expectedOutput": "солнце" },
  { "prompt": "Translate to Russian: night", "expectedOutput": "ночь" },
  { "prompt": "Translate to Russian: day", "expectedOutput": "день" },
  { "prompt": "Translate to Russian: house", "expectedOutput": "дом" },
  { "prompt": "Translate to Russian: love", "expectedOutput": "любовь" },
  { "prompt": "Translate to Russian: friend", "expectedOutput": "друг" }
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest scripts/__tests__/verifyKernel.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-kernel.ts scripts/fixtures/kernel-fixtures.json scripts/__tests__/verifyKernel.test.ts
git commit -m "feat(prefetch): kernel verification script with 10 fixtures + normalize"
```

---

### Task 7.2: .github/workflows/kernel-verify.yml — block PR on mismatch

**Files:**
- Create: `.github/workflows/kernel-verify.yml`.

- [ ] **Step 1: Write file**

```yaml
# .github/workflows/kernel-verify.yml
name: Kernel Verification

on:
  pull_request:
    paths:
      - 'vendor/llama.rn/cpp/**'
      - 'src/services/translation/modelManifest.ts'
      - 'scripts/verify-kernel.ts'
      - 'scripts/fixtures/kernel-fixtures.json'

jobs:
  verify-kernel:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Run kernel verification unit tests
        run: npx jest scripts/__tests__/verifyKernel.test.ts
      # NOTE: device-level kernel verification (full model load) deferred —
      # macOS GH runner cannot host the GGUF model file (~700 MB) without
      # storage credentials; CI here gates only the script wiring.
```

- [ ] **Step 2: No test possible — type-check only**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/kernel-verify.yml
git commit -m "ci(prefetch): kernel verification workflow blocks PRs on script failure"
```

---

### Task 7.3: Atomic model upgrade — .partial → SHA verify → rename + revert-on-next-launch (E0-2 + E0-3 + T0-7)

**Files:**
- Create: `src/services/translation/atomicModelUpgrade.ts`.
- Create: `src/services/translation/sha256OfFile.ts` (chunked streaming hasher, E0-2).
- Test: `src/services/translation/__tests__/atomicModelUpgrade.test.ts`.
- Test: `src/services/translation/__tests__/sha256OfFile.test.ts`.

> **E0-3 — File-system API pin.** Use the legacy `expo-file-system` namespace
> (`getInfoAsync`, `moveAsync`, `deleteAsync`, `readAsStringAsync`). The
> `expo-file-system/next` namespace is reserved ONLY for
> `Paths.availableDiskSpace` in Task 7.4. Cross-volume `moveAsync` on Android
> is copy+delete (not atomic): partial-commit risk is mitigated by
> `revertModelUpgradeIfNeeded` re-SHA-verifying on next launch before
> deleting the previous file.

> **T0-7 — Test must be correct from the start.** v1 of this plan included a
> "Step 3.5: Adjust test expectations" that retroactively edited the test
> after writing implementation — anti-TDD. The third test case below uses
> `contextLoadSucceeded: true` + `isPendingRevert: false` from the start,
> exercising the cleanup path properly.

- [ ] **Step 1: Write failing test for sha256OfFile (E0-2)**

```typescript
// src/services/translation/__tests__/sha256OfFile.test.ts
import * as FileSystem from 'expo-file-system';
import nodeCrypto from 'crypto';
import { sha256OfFile } from '@/services/translation/sha256OfFile';

jest.mock('expo-file-system', () => {
  const fs = require('fs');
  return {
    EncodingType: { Base64: 'base64' },
    getInfoAsync: jest.fn(async (path: string) => {
      const stat = fs.statSync(path);
      return { exists: true, size: stat.size };
    }),
    readAsStringAsync: jest.fn(async (
      path: string,
      opts: { position: number; length: number; encoding: string },
    ) => {
      const buf = fs.readFileSync(path);
      const slice = buf.subarray(opts.position, opts.position + opts.length);
      return slice.toString('base64');
    }),
  };
});

describe('sha256OfFile', () => {
  it('matches node:crypto SHA-256 on small known file', async () => {
    const path = '/tmp/sha256test.bin';
    const data = Buffer.from('hello world\n'.repeat(100), 'utf8');
    require('fs').writeFileSync(path, data);
    const expected = nodeCrypto.createHash('sha256').update(data).digest('hex');
    const actual = await sha256OfFile(path);
    expect(actual).toBe(expected);
  });

  it('handles a multi-chunk file (≥1 MB)', async () => {
    const path = '/tmp/sha256big.bin';
    const data = Buffer.alloc(2.5 * 1024 * 1024); // 2.5 MB
    for (let i = 0; i < data.length; i++) data[i] = i & 0xff;
    require('fs').writeFileSync(path, data);
    const expected = nodeCrypto.createHash('sha256').update(data).digest('hex');
    const actual = await sha256OfFile(path);
    expect(actual).toBe(expected);
  });
});
```

- [ ] **Step 2: Run sha256OfFile test (FAIL)**

Run: `npx jest src/services/translation/__tests__/sha256OfFile.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement sha256OfFile (E0-2)**

`expo-crypto.digestStringAsync` requires the whole file in memory and OOMs
on the ~600 MB GGUF. We stream via `expo-file-system.readAsStringAsync`'s
position/length API in 1 MB chunks, decode base64 to Uint8Array (Hermes-safe
via `globalThis.atob`, no Buffer required), and feed `js-sha256.update()`.

```typescript
// src/services/translation/sha256OfFile.ts
import { sha256 } from 'js-sha256';
import * as FileSystem from 'expo-file-system';

const CHUNK = 1024 * 1024; // 1 MB

export async function sha256OfFile(path: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists || info.size === undefined || info.size === 0) {
    throw new Error(`sha256OfFile: file_not_found_or_empty: ${path}`);
  }
  const hasher = sha256.create();
  let position = 0;
  while (position < info.size) {
    const length = Math.min(CHUNK, info.size - position);
    const b64 = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.Base64,
      position,
      length,
    } as any);
    // Hermes-safe base64 decode: atob → charCode → Uint8Array.
    const bin = (globalThis as any).atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    hasher.update(bytes);
    position += length;
  }
  return hasher.hex();
}
```

- [ ] **Step 4: Re-run sha256OfFile test (PASS)**

Run: `npx jest src/services/translation/__tests__/sha256OfFile.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write failing test for atomicModelUpgrade (T0-7 — correct from start)**

```typescript
// src/services/translation/__tests__/atomicModelUpgrade.test.ts
import { commitModelUpgrade, revertModelUpgradeIfNeeded } from '@/services/translation/atomicModelUpgrade';

const mockFs = (() => {
  const files = new Map<string, string>();
  return {
    files,
    exists: (p: string) => files.has(p),
    write: (p: string, c: string) => files.set(p, c),
    rename: (a: string, b: string) => { const v = files.get(a); files.delete(a); files.set(b, v ?? ''); },
    delete: (p: string) => files.delete(p),
    read: (p: string) => files.get(p) ?? null,
  };
})();

describe('atomicModelUpgrade', () => {
  beforeEach(() => mockFs.files.clear());

  it('commit fails if .partial SHA does not match expected', async () => {
    mockFs.write('/m/model.partial', 'data');
    await expect(commitModelUpgrade({
      partialPath: '/m/model.partial',
      finalPath: '/m/model.gguf',
      previousPath: '/m/model.previous.gguf',
      expectedSha: 'wrong_sha',
      computeSha: async () => 'real_sha',
      fs: mockFs as any,
    })).rejects.toThrow(/sha/i);
    expect(mockFs.exists('/m/model.partial')).toBe(false);
  });

  it('commit renames .partial to final + flags previous for revert', async () => {
    mockFs.write('/m/model.partial', 'new');
    mockFs.write('/m/model.gguf', 'old');
    const setRevert = jest.fn();
    await commitModelUpgrade({
      partialPath: '/m/model.partial',
      finalPath: '/m/model.gguf',
      previousPath: '/m/model.previous.gguf',
      expectedSha: 'sha',
      computeSha: async () => 'sha',
      fs: mockFs as any,
      markPendingRevert: setRevert,
    });
    expect(mockFs.read('/m/model.gguf')).toBe('new');
    expect(mockFs.read('/m/model.previous.gguf')).toBe('old');
    expect(setRevert).toHaveBeenCalledWith(true);
  });

  it('revertModelUpgradeIfNeeded restores previous when load failed', async () => {
    mockFs.write('/m/model.gguf', 'bad_new');
    mockFs.write('/m/model.previous.gguf', 'good_old');
    await revertModelUpgradeIfNeeded({
      finalPath: '/m/model.gguf',
      previousPath: '/m/model.previous.gguf',
      isPendingRevert: async () => true,
      clearPendingRevert: jest.fn(async () => {}),
      fs: mockFs as any,
      contextLoadSucceeded: false,
    });
    expect(mockFs.read('/m/model.gguf')).toBe('good_old');
    expect(mockFs.exists('/m/model.previous.gguf')).toBe(false);
  });

  // T0-7: success path — load succeeded, no pending revert → previous
  // gets cleaned up so disk doesn't accumulate old models.
  it('cleans up previous when not pending revert AND load succeeded', async () => {
    mockFs.write('/m/model.gguf', 'new');
    mockFs.write('/m/model.previous.gguf', 'old');
    const clear = jest.fn(async () => {});
    await revertModelUpgradeIfNeeded({
      finalPath: '/m/model.gguf',
      previousPath: '/m/model.previous.gguf',
      isPendingRevert: async () => false,
      clearPendingRevert: clear,
      fs: mockFs as any,
      contextLoadSucceeded: true,
    });
    expect(mockFs.read('/m/model.gguf')).toBe('new');
    expect(mockFs.exists('/m/model.previous.gguf')).toBe(false);
    expect(clear).toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run atomicModelUpgrade test (FAIL)**

Run: `npx jest src/services/translation/__tests__/atomicModelUpgrade.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 7: Implement atomicModelUpgrade**

```typescript
// src/services/translation/atomicModelUpgrade.ts
export interface FsAdapter {
  exists: (path: string) => boolean;
  rename: (from: string, to: string) => void;
  delete: (path: string) => void;
  read: (path: string) => string | null;
}

export interface CommitUpgradeInput {
  partialPath: string;
  finalPath: string;
  previousPath: string;
  expectedSha: string;
  computeSha: (path: string) => Promise<string>;
  fs: FsAdapter;
  markPendingRevert?: (v: boolean) => void;
}

export async function commitModelUpgrade(input: CommitUpgradeInput): Promise<void> {
  const sha = await input.computeSha(input.partialPath);
  if (sha !== input.expectedSha) {
    input.fs.delete(input.partialPath);
    throw new Error(`SHA mismatch: expected ${input.expectedSha} got ${sha}`);
  }
  if (input.fs.exists(input.finalPath)) {
    input.fs.rename(input.finalPath, input.previousPath);
  }
  input.fs.rename(input.partialPath, input.finalPath);
  input.markPendingRevert?.(true);
}

export interface RevertInput {
  finalPath: string;
  previousPath: string;
  isPendingRevert: () => Promise<boolean>;
  clearPendingRevert: () => Promise<void>;
  fs: FsAdapter;
  contextLoadSucceeded?: boolean;
}

export async function revertModelUpgradeIfNeeded(input: RevertInput): Promise<void> {
  const pending = await input.isPendingRevert();
  if (pending && input.contextLoadSucceeded === false) {
    // Revert: previous is good, new is bad
    if (input.fs.exists(input.previousPath)) {
      input.fs.delete(input.finalPath);
      input.fs.rename(input.previousPath, input.finalPath);
    }
    await input.clearPendingRevert();
    return;
  }
  if (pending && input.contextLoadSucceeded !== false) {
    // No-op revert (still pending, no failure yet)
    return;
  }
  // Not pending — clean up previous if exists.
  if (input.fs.exists(input.previousPath)) {
    input.fs.delete(input.previousPath);
  }
  await input.clearPendingRevert();
}
```

- [ ] **Step 8: Run all tests (PASS)**

Run: `npx jest src/services/translation/__tests__/atomicModelUpgrade.test.ts src/services/translation/__tests__/sha256OfFile.test.ts`
Expected: PASS, 6 tests total (2 sha256 + 4 atomic).

- [ ] **Step 9: Commit**

```bash
git add src/services/translation/atomicModelUpgrade.ts src/services/translation/sha256OfFile.ts src/services/translation/__tests__/atomicModelUpgrade.test.ts src/services/translation/__tests__/sha256OfFile.test.ts
git commit -m "feat(prefetch): atomic model upgrade with chunked SHA-256 + revert on next launch"
```

---

### Task 7.3a: Orphan `.partial` cleanup on bootstrap (P1-D)

**Files:**
- Create: `src/services/translation/cleanupOrphanPartial.ts`.
- Test: `src/services/translation/__tests__/cleanupOrphanPartial.test.ts`.
- Modify: `src/services/translation/LlmBootstrap.tsx` (call at mount, before Task 8.3 wires lifecycle).

A `.partial` file on disk at boot means a download was interrupted. We
SHA-verify it against the manifest's `expectedSha`:
- match → commit (rename to final) — continue boot normally;
- mismatch → delete `.partial` and let the next user-initiated download start fresh.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/__tests__/cleanupOrphanPartial.test.ts
import { cleanupOrphanPartial } from '@/services/translation/cleanupOrphanPartial';

const mockFs = (() => {
  const files = new Map<string, string>();
  return {
    files,
    exists: (p: string) => files.has(p),
    write: (p: string, c: string) => files.set(p, c),
    rename: (a: string, b: string) => { const v = files.get(a); files.delete(a); files.set(b, v ?? ''); },
    delete: (p: string) => files.delete(p),
    read: (p: string) => files.get(p) ?? null,
  };
})();

describe('cleanupOrphanPartial', () => {
  beforeEach(() => mockFs.files.clear());

  it('no-op when no .partial exists', async () => {
    await cleanupOrphanPartial({
      partialPath: '/m/model.partial',
      finalPath: '/m/model.gguf',
      previousPath: '/m/model.previous.gguf',
      expectedSha: 'sha',
      computeSha: async () => 'sha',
      fs: mockFs as any,
    });
    expect(mockFs.exists('/m/model.gguf')).toBe(false);
  });

  it('commits .partial when SHA matches', async () => {
    mockFs.write('/m/model.partial', 'new');
    await cleanupOrphanPartial({
      partialPath: '/m/model.partial',
      finalPath: '/m/model.gguf',
      previousPath: '/m/model.previous.gguf',
      expectedSha: 'sha',
      computeSha: async () => 'sha',
      fs: mockFs as any,
    });
    expect(mockFs.read('/m/model.gguf')).toBe('new');
    expect(mockFs.exists('/m/model.partial')).toBe(false);
  });

  it('deletes .partial when SHA mismatches', async () => {
    mockFs.write('/m/model.partial', 'corrupt');
    await cleanupOrphanPartial({
      partialPath: '/m/model.partial',
      finalPath: '/m/model.gguf',
      previousPath: '/m/model.previous.gguf',
      expectedSha: 'good_sha',
      computeSha: async () => 'bad_sha',
      fs: mockFs as any,
    });
    expect(mockFs.exists('/m/model.partial')).toBe(false);
    expect(mockFs.exists('/m/model.gguf')).toBe(false);
  });
});
```

- [ ] **Step 2: Run (FAIL)**

Run: `npx jest src/services/translation/__tests__/cleanupOrphanPartial.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/cleanupOrphanPartial.ts
import { commitModelUpgrade, type FsAdapter } from './atomicModelUpgrade';

export interface CleanupInput {
  partialPath: string;
  finalPath: string;
  previousPath: string;
  expectedSha: string;
  computeSha: (path: string) => Promise<string>;
  fs: FsAdapter;
  markPendingRevert?: (v: boolean) => void;
}

export async function cleanupOrphanPartial(input: CleanupInput): Promise<void> {
  if (!input.fs.exists(input.partialPath)) return;
  try {
    await commitModelUpgrade({
      partialPath: input.partialPath,
      finalPath: input.finalPath,
      previousPath: input.previousPath,
      expectedSha: input.expectedSha,
      computeSha: input.computeSha,
      fs: input.fs,
      markPendingRevert: input.markPendingRevert,
    });
  } catch {
    // SHA mismatch already deleted .partial inside commitModelUpgrade.
    // Other errors: defensive delete to ensure stale .partial is gone.
    if (input.fs.exists(input.partialPath)) input.fs.delete(input.partialPath);
  }
}
```

- [ ] **Step 4: Wire into LlmBootstrap mount effect**

```typescript
useEffect(() => {
  void (async () => {
    await cleanupOrphanPartial({
      partialPath: getModelLocalPath() + '.partial',
      finalPath: getModelLocalPath(),
      previousPath: getModelLocalPath() + '.previous',
      expectedSha: MODEL_MANIFEST.sha256,
      computeSha: sha256OfFile,
      fs: realFsAdapter,
    });
  })();
}, []);
```

- [ ] **Step 5: Run (PASS) + commit**

Run: `npx jest src/services/translation/__tests__/cleanupOrphanPartial.test.ts`

```bash
git add src/services/translation/cleanupOrphanPartial.ts src/services/translation/__tests__/cleanupOrphanPartial.test.ts src/services/translation/LlmBootstrap.tsx
git commit -m "feat(prefetch): cleanup orphan .partial on bootstrap (P1-D)"
```

---

### Task 7.4: Disk space runtime purge — <200MB free → auto-purge prefetch sentences

**Files:**
- Create: `src/services/translation/diskSpacePurge.ts`.
- Test: `src/services/translation/__tests__/diskSpacePurge.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/__tests__/diskSpacePurge.test.ts
import { evaluateDiskSpaceAction } from '@/services/translation/diskSpacePurge';

describe('evaluateDiskSpaceAction', () => {
  it('returns ok when free > 200 MB', () => {
    expect(evaluateDiskSpaceAction({ freeBytes: 500 * 1024 * 1024 })).toEqual({ action: 'ok' });
  });

  it('returns purge_sentences when free is 100-200 MB', () => {
    expect(evaluateDiskSpaceAction({ freeBytes: 150 * 1024 * 1024 })).toEqual({ action: 'purge_sentences' });
  });

  it('returns prompt_delete_model when free < 100 MB', () => {
    expect(evaluateDiskSpaceAction({ freeBytes: 50 * 1024 * 1024 })).toEqual({ action: 'prompt_delete_model' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/__tests__/diskSpacePurge.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write implementation (E0-4 + P1-E)**

```typescript
// src/services/translation/diskSpacePurge.ts
import { Paths } from 'expo-file-system/next';

const MB = 1024 * 1024;

export type DiskSpaceAction =
  | { action: 'ok' }
  | { action: 'purge_sentences' }
  | { action: 'prompt_delete_model' };

// E0-4: SDK 54 — Paths.availableDiskSpace is the supported way; do not
// use expo-file-system's legacy FileSystem.getFreeDiskStorageAsync (removed).
export async function freeDiskBytes(): Promise<number> {
  return Paths.availableDiskSpace;
}

export function evaluateDiskSpaceAction(input: { freeBytes: number }): DiskSpaceAction {
  if (input.freeBytes < 100 * MB) return { action: 'prompt_delete_model' };
  if (input.freeBytes < 200 * MB) return { action: 'purge_sentences' };
  return { action: 'ok' };
}

// P1-E: scheduler pause → purge → resume coordination. Caller passes the
// scheduler so the purge doesn't race with an in-flight prefetch batch.
export interface PurgeCoordinator {
  pause(): void;
  resume(): void;
}

export async function purgeIfLowDisk(
  scheduler: PurgeCoordinator,
  repo: { purgeExpiredBySource(): Promise<number> },
): Promise<void> {
  const free = await freeDiskBytes();
  const decision = evaluateDiskSpaceAction({ freeBytes: free });
  if (decision.action === 'purge_sentences') {
    scheduler.pause();
    try {
      await repo.purgeExpiredBySource();
    } finally {
      scheduler.resume();
    }
  }
  // 'prompt_delete_model' is surfaced by UI layer (Settings → Translation
  // model section CTA). 'ok' is no-op.
}
```

Add jest mock for `expo-file-system/next`:

```javascript
// jest.setup.js — append near expo-file-system block (if any):
jest.mock('expo-file-system/next', () => ({
  Paths: { availableDiskSpace: 500 * 1024 * 1024 },
}));
```

Add a test for `purgeIfLowDisk`:

```typescript
it('purgeIfLowDisk pauses → purges → resumes when low', async () => {
  const { Paths } = require('expo-file-system/next');
  (Paths as any).availableDiskSpace = 150 * 1024 * 1024;
  const scheduler = { pause: jest.fn(), resume: jest.fn() };
  const repo = { purgeExpiredBySource: jest.fn(async () => 5) };
  await purgeIfLowDisk(scheduler, repo);
  expect(scheduler.pause).toHaveBeenCalled();
  expect(repo.purgeExpiredBySource).toHaveBeenCalled();
  expect(scheduler.resume).toHaveBeenCalled();
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/__tests__/diskSpacePurge.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/diskSpacePurge.ts src/services/translation/__tests__/diskSpacePurge.test.ts
git commit -m "feat(prefetch): disk space runtime purge policy thresholds"
```

---

## Phase 8 — Migration + finalize + PR

### Task 8.1: createLlamaLoader — n_ctx 2048 + cache_prompt: true

**Files:**
- Modify: `src/services/translation/createLlamaLoader.ts`.
- Test: `src/services/translation/__tests__/createLlamaLoader.config.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/__tests__/createLlamaLoader.config.test.ts
jest.mock('llama.rn', () => ({
  initLlama: jest.fn(async (_cfg: any) => ({ completion: jest.fn(), release: jest.fn() })),
}));
jest.mock('@/services/translation/modelManifest', () => ({
  MODEL_MANIFEST: { version: '1.0' },
  getModelLocalPath: () => '/tmp/model.gguf',
}));

import { initLlama } from 'llama.rn';
import { createLlamaLoader } from '@/services/translation/createLlamaLoader';

describe('createLlamaLoader config', () => {
  beforeEach(() => (initLlama as jest.Mock).mockClear());

  it('initLlama is called with n_ctx 2048', async () => {
    await createLlamaLoader();
    expect(initLlama).toHaveBeenCalledWith(expect.objectContaining({ n_ctx: 2048 }));
  });

  it('initLlama is called with cache_prompt: true', async () => {
    await createLlamaLoader();
    expect(initLlama).toHaveBeenCalledWith(expect.objectContaining({ cache_prompt: true }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/__tests__/createLlamaLoader.config.test.ts`
Expected: FAIL — second test fails (`cache_prompt` missing).

- [ ] **Step 3: Modify createLlamaLoader**

In `src/services/translation/createLlamaLoader.ts`:

```typescript
  const native = await initLlama({
    model: getModelLocalPath(),
    n_ctx: 2048,
    n_gpu_layers: 99,
    n_threads: 4,
    cache_prompt: true,
  } as any);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/__tests__/createLlamaLoader.config.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/createLlamaLoader.ts src/services/translation/__tests__/createLlamaLoader.config.test.ts
git commit -m "perf(translation): enable cache_prompt for KV reuse across sentence translations"
```

---

### Task 8.2: LlamaTranslationService — route via ModelLifecycleManager.runInference

**Files:**
- Modify: `src/services/translation/LlamaTranslationService.ts`.
- Test: `src/services/translation/__tests__/LlamaTranslationService.priority.test.ts`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/__tests__/LlamaTranslationService.priority.test.ts
import { LlamaTranslationService } from '@/services/translation/LlamaTranslationService';
import { useLlmStatusStore } from '@/stores/llmStatusStore';

describe('LlamaTranslationService — priority routing', () => {
  beforeEach(() => useLlmStatusStore.setState({ status: 'ready', progress: 0, errorMessage: null }));

  it('translate({priority:"prefetch"}) calls lifecycle.runInference with priority="prefetch"', async () => {
    const runInference = jest.fn(async () => ({ text: 'привет' }));
    const cache: any = {
      lookup: jest.fn(async () => null),
      write: jest.fn(async () => {}),
    };
    const lifecycle: any = { runInference, getSnapshot: () => ({ state: 'ready' }) };
    const queue: any = { run: (fn: () => Promise<any>) => fn() };
    const service = new LlamaTranslationService({
      contextProvider: () => ({ completion: runInference, release: jest.fn() } as any),
      cache,
      queue,
      lifecycle,
    } as any);
    await service.translate({
      word: 'hello',
      contextWindow: 'hello world',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      priority: 'prefetch',
    } as any);
    expect(runInference).toHaveBeenCalled();
  });

  it('write tags source="prefetch" when priority is prefetch', async () => {
    const cache: any = {
      lookup: jest.fn(async () => null),
      write: jest.fn(async () => {}),
    };
    const lifecycle: any = {
      runInference: jest.fn(async () => ({ text: 'hi' })),
      getSnapshot: () => ({ state: 'ready' }),
    };
    const queue: any = { run: (fn: () => Promise<any>) => fn() };
    const service = new LlamaTranslationService({
      contextProvider: () => ({ completion: jest.fn(async () => ({ text: 'hi' })), release: jest.fn() } as any),
      cache,
      queue,
      lifecycle,
    } as any);
    await service.translate({
      word: 'hello',
      contextWindow: 'hello world',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      priority: 'prefetch',
    } as any);
    expect(cache.write).toHaveBeenCalledWith(
      'hello', 'hello world', 'en', 'ru', 'hi',
      expect.objectContaining({ source: 'prefetch' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/__tests__/LlamaTranslationService.priority.test.ts`
Expected: FAIL — service does not accept `lifecycle` or `priority`.

- [ ] **Step 3: Extend service**

In `src/services/translation/ITranslationService.ts` (if absent), ensure `TranslationInput` accepts optional `priority?: 'user' | 'prefetch'`.

In `LlamaTranslationService.ts`:

```typescript
export interface LlamaTranslationServiceDeps {
  contextProvider: () => LlamaContext | null;
  cache: CacheLayer;
  queue: InferenceQueue;
  timeoutMs?: number;
  sentenceTimeoutMs?: number;
  inferenceTracker?: InferenceContextTracker;
  lifecycle?: { runInference: (prompt: string, config: InferenceConfig, priority: 'user' | 'prefetch') => Promise<InferenceResult> };
}
```

In `translate()`, replace direct `ctx.completion(...)` and queue run with:

```typescript
      const priority = (input as any).priority === 'prefetch' ? 'prefetch' as const : 'user' as const;
      let raw: { text: string };
      if (this.deps.lifecycle) {
        raw = await withTimeout(
          this.deps.lifecycle.runInference(prompt, INFERENCE_CONFIG, priority),
          this.timeoutMs,
        );
      } else {
        raw = await this.deps.queue.run(() => withTimeout(ctx.completion(prompt, INFERENCE_CONFIG), this.timeoutMs));
      }
```

And cache write extended:

```typescript
      await this.deps.cache.write(
        input.word, input.contextWindow,
        input.bookLanguage, input.nativeLanguage,
        cleaned,
        { inferenceContext: 'warm', source: priority === 'prefetch' ? 'prefetch' : 'on_demand' },
      );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/__tests__/LlamaTranslationService.priority.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/LlamaTranslationService.ts src/services/translation/__tests__/LlamaTranslationService.priority.test.ts src/services/translation/ITranslationService.ts
git commit -m "refactor(translation): route translate() through ModelLifecycleManager with priority"
```

---

### Task 8.3: LlmBootstrap — wire lifecycle + bridges + remove LlamaContextManager

**Files:**
- Modify: `src/services/translation/LlmBootstrap.tsx`.
- Test: `src/services/translation/__tests__/LlmBootstrap.lifecycle.test.tsx`.

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/__tests__/LlmBootstrap.lifecycle.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { LlmBootstrap } from '@/services/translation/LlmBootstrap';
import { ModelLifecycleManager } from '@/services/translation/ModelLifecycleManager';

jest.mock('@/db/DatabaseContext', () => ({
  useDatabase: () => ({ get: () => ({ query: () => ({ fetch: async () => [] }) }) }),
}));

describe('LlmBootstrap — lifecycle integration', () => {
  beforeEach(() => ModelLifecycleManager.resetForTests());

  it('initializes ModelLifecycleManager singleton on mount', () => {
    render(
      <LlmBootstrap>
        <></>
      </LlmBootstrap>,
    );
    expect(() => ModelLifecycleManager.instance()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/translation/__tests__/LlmBootstrap.lifecycle.test.tsx`
Expected: FAIL — singleton not initialized in bootstrap.

- [ ] **Step 3: Replace LlamaContextManager wiring with ModelLifecycleManager**

In `src/services/translation/LlmBootstrap.tsx`:

```typescript
import { ModelLifecycleManager } from './ModelLifecycleManager';
import { AppStateBridge } from './AppStateBridge';
import { BatteryBridge } from './BatteryBridge';
// remove: import { LlamaContextManager } from './LlamaContextManager';
```

In the component, replace `contextProvider: () => LlamaContextManager.instance().getContext()` with lifecycle-routed service:

```typescript
  const service = useMemo(() => {
    const repo = new TranslationCacheRepository(db);
    const cache = new CacheLayer(repo, 500, () => String(MODEL_MANIFEST.version), getKernelBuildId);
    const queue = new InferenceQueue();
    const lifecycle = ModelLifecycleManager.instance({ loader: createLlamaLoader });
    void lifecycle.hydrateFromSecureStore();
    return new LlamaTranslationService({
      contextProvider: () => null, // unused when lifecycle is wired
      cache, queue,
      lifecycle,
    } as any);
  }, [db]);

  useEffect(() => {
    const lifecycle = ModelLifecycleManager.instance({ loader: createLlamaLoader });
    const appBridge = new AppStateBridge(lifecycle);
    appBridge.start();
    const batteryBridge = new BatteryBridge(lifecycle);
    void batteryBridge.start();
    return () => {
      appBridge.stop();
      batteryBridge.stop();
    };
  }, []);
```

Update auto-load effect to call `ModelLifecycleManager.instance().ensureLoaded()` instead of `useLlmRuntime.load`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/translation/__tests__/LlmBootstrap.lifecycle.test.tsx`
Expected: PASS.

- [ ] **Step 5: T0-6 — Verify no callers remain (deterministic gate)**

Before committing, run:

```bash
grep -rn "LlamaContextManager" src/ app/ --include="*.ts" --include="*.tsx" \
  | grep -v "src/services/translation/LlamaContextManager.ts" \
  | grep -v "src/services/translation/__tests__/LlamaContextManager"
```

Expected output: empty. If any line is printed, replace each remaining
caller with `ModelLifecycleManager.instance()` (and matching `lifecycle`
param on `LlamaTranslationService`) in this same commit, then re-run grep.

Task 8.4 then performs the deletion unconditionally — no "if callers
remain" branch.

- [ ] **Step 6: Commit**

```bash
git add src/services/translation/LlmBootstrap.tsx src/services/translation/__tests__/LlmBootstrap.lifecycle.test.tsx
git commit -m "refactor(translation): LlmBootstrap wires lifecycle + AppState/Battery bridges"
```

---

### Task 8.4: Delete LlamaContextManager after callers migrated

**Files:**
- Delete: `src/services/translation/LlamaContextManager.ts`.
- Delete: any test importing it.
- Modify: any remaining import sites (search via `grep`).

- [ ] **Step 1: Pre-deletion check is in Task 8.3 (T0-6)**

Task 8.3 Step 5 already gated this with a grep verification. If you arrive
here, the grep is empty — proceed straight to deletion. No conditional.

- [ ] **Step 2: Delete file (unconditional)**

```bash
git rm src/services/translation/LlamaContextManager.ts
git rm src/services/translation/__tests__/LlamaContextManager.test.ts
```

(Delete both files unconditionally. The test file shipping in #4 references
the manager directly.)

- [ ] **Step 3: Run typecheck + full test suite**

Run: `npx tsc --noEmit && npx jest`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(translation): remove LlamaContextManager, superseded by ModelLifecycleManager"
```

---

### Task 8.5: CLAUDE.md update — #4.6 status + persist allowlist additions

**Files:**
- Modify: `CLAUDE.md` (sub-projects roadmap section + AsyncStorage allowlist).

- [ ] **Step 1: No test — type-check only**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Update CLAUDE.md**

In the `Sub-projects roadmap` section, change the #4.6 entry from `v2.1` planned to:

```markdown
  - **#4.6 Translation Prefetch + Lifecycle** (готов) — ModelLifecycleManager
    (idle unload 5 мин, lazy reload, permanent disable после 3-х фейлов),
    PrefetchScheduler (20s idle, 30-50 слов + 5-10 MWE на batch, word-mode
    budget cap для preempt), expo-battery throttle, atomic model upgrade,
    kernel verify в CI.
```

In the AsyncStorage allowlist block under `Управление состоянием`, append to UI preferences list:

```markdown
    `enableJaKoPrefetch`, `prefetchEnabled`, `keepTranslatorReady`.
```

In the **v2 backlog** section of CLAUDE.md (top of file), append these new
items (T0-4 + T0-5):

```markdown
- **Frequency-list curation для #4.6 prefetch**: v1 ships 50-entry seed
  lists from a hand-picked table (см. `scripts/generate-freq-fixtures.ts`).
  v2: source full ~5k frequency lists per lang from corpora (e.g.
  OpenSubtitles, Wikipedia frequency lists), clear license, ship as .txt
  assets. Tracker: #4.6.fixtures-v2.
- **Professional translation pass для #4.6 prefetch UI keys**: 11 locales
  (pl, uk, es, fr, de, it, pt, ja, ko, ar, hi) ship English fallback values
  for `settings.prefetch.*` and `translation.lazyReload.*`, marked with
  `_NEEDS_TRANSLATION: true` parent flag. v2: source native-speaker
  translations before release. Tracker: #4.6.locales-v2.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(prefetch): mark #4.6 готов + persist allowlist + v2-backlog items"
```

---

### Task 8.6: Real-device benchmark doc placeholder

**Files:**
- Create: `docs/superpowers/specs/2026-05-18-prefetch-bench-template.md`.

- [ ] **Step 1: No test — placeholder file only**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Write file**

```markdown
# Prefetch real-device benchmark — template

> Заполняется при ручном замере на iPhone 13 + Pixel 7 перед v1 release.

## iPhone 13 (iOS X)
- Cold model load (s):
- Warm word inference (s):
- Warm sentence inference (s):
- Prefetch batch 50 words (s):
- Battery delta за 15 мин reading c prefetch ON:
- Battery delta за 15 мин reading c prefetch OFF:
- Thermal state observed:

## Pixel 7 (Android X)
- Cold model load (s):
- Warm word inference (s):
- Warm sentence inference (s):
- Prefetch batch 50 words (s):
- Battery delta за 15 мин reading c prefetch ON:
- Battery delta за 15 мин reading c prefetch OFF:
- Thermal state observed:

## Notes / regressions
- ...
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-05-18-prefetch-bench-template.md
git commit -m "docs(prefetch): real-device benchmark template (iPhone 13 / Pixel 7)"
```

---

### Task 8.7: Final typecheck + lint + push + PR

**Files:**
- None (workflow).

- [ ] **Step 1: Run full quality gate**

Run: `npx tsc --noEmit && npx jest && npx expo lint`
Expected: all three exit 0.

- [ ] **Step 2: Push branch**

```bash
git push -u origin feat/translation-prefetch
```

- [ ] **Step 3: Create PR**

```bash
gh pr create --title "feat: Translation Prefetch + Lifecycle (#4.6)" --body "$(cat <<'EOF'
## Summary

Реализует sub-project #4.6 — Translation Prefetch + Lifecycle (v2.1):

- `ModelLifecycleManager` со state machine (unloaded/loading/ready/inferring/error/error_permanent), idle 5-мин unload, permanent disable после 3-х фейлов (SecureStore).
- `PrefetchScheduler` — 20s idle trigger, 30-50 слов + 5-10 MWE на batch, JA/KO gated (default off), word-mode budget cap для user-tap preempt at job boundary.
- Bridges: AppState (background → unload), expo-battery (level + lowPower → throttle), idle timer.
- Schema v4 миграция: добавляет `source`/`ttl_days`/`chrf_score` в `translation_cache`; TTL 30 дней для prefetch vs 90 для on_demand.
- Lemmatization heuristic для en/es/fr/it/pt (surface fallback для остальных 8 langs).
- Atomic model upgrade (.partial → SHA verify → atomic rename → revert on next-launch failure).
- Disk space runtime purge policy thresholds.
- Kernel verification script + CI workflow.
- `createLlamaLoader` bump: `n_ctx: 2048` + `cache_prompt: true` (KV reuse).
- Settings UI: production binary indicator + Advanced disclosure (JA/KO toggle + redownload) + dev overlay за long-press на app-version.
- i18n strings во всех 13 локалях.

Спека: `docs/superpowers/specs/2026-05-17-translation-prefetch-design.md`.

## Test plan

- [ ] `npx tsc --noEmit` — passes
- [ ] `npx jest` — full suite passes
- [ ] `npx expo lint` — passes
- [ ] iPhone 13 real-device: 20s idle → prefetch fires, user tap preempts ≤3s, 5 min idle → unload, background → unload immediate
- [ ] Pixel 7 real-device: same scenarios
- [ ] Battery: prefetch pauses при <20% не charging + low-power mode
- [ ] Permanent disable: 3 force-fail load → SecureStore flag set → UI shows "Translation unavailable" + Retry CTA → clear works
- [ ] Settings: toggle persists, JA/KO advanced toggle persists
- [ ] Заполнить `docs/superpowers/specs/2026-05-18-prefetch-bench-template.md` метриками

EOF
)"
```

- [ ] **Step 4: Verify PR open**

Run: `gh pr view --json url,state`
Expected: `state: OPEN`.

- [ ] **Step 5: Done — no commit (PR is the artifact)**
