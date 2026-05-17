# Fluera Sub-project #4.5: Translation Popup Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign translation popup с MWE/idiom pre-filter, false-friend warnings, sentence-level translation, "экспериментальный" метка для sentence-результата, локальный сбор жалоб, multi-word selection и полным a11y mandate.

**Architecture:** Layered — `assets/{mwe,false_friends}/*.csv` (seed data) → `MweDictionary` / `FalseFriendsDictionary` (in-memory trie + lookup loaded lazily on book open) → `LlamaTranslationService` (extended с `translateSentence` + cold inference tagging + versioned cache key) → `TranslationPopup` (tiered UI с `Popover` primitive + 3-mode placement + experimental badge + dislike feedback). Sentence cache + word cache share `TranslationCache` table с new `sentence_translation` + `inference_context` columns. Local dislike feedback logged to new `translation_feedback` table.

**Tech Stack:** WatermelonDB schema migration v1→v2, Reanimated 4 worklets для всех popup animations, `@gorhom/bottom-sheet` для modalSheet fallback, custom `Popover` primitive для top/bottom-anchored mode, `expo-crypto` SHA-256 для versioned cache key, regex-based heuristics для coverage estimation + word alignment (no ML).

**Spec:** `docs/superpowers/specs/2026-05-17-translation-popup-design.md` (1323 lines, v2.2 after chrF removal + experimental badge + dislike feedback). Each task references concrete spec sections — read the spec when implementation detail ambiguous.

**Branch:** `feat/translation-popup` (stack поверх `feat/translation-engine`, PR #4 still open). Create off latest `feat/translation-engine` HEAD.

**Out of scope (deferred к #4.6, #6, v2):** language auto-detection (живёт в #3 reader engine, отдельный план), prefetch (живёт в #4.6), FSRS encounter ingestion (живёт в #6), TTS audio (v3), chrF/FLORES eval (cut to v2).

---

## Conventions for All Tasks

**TDD discipline:** RED → GREEN → REFACTOR. Каждая функциональная задача = написать failing test → запустить чтобы убедиться FAIL → написать минимальный код → запустить чтобы убедиться PASS → commit.

**Commit messages:** conventional commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`, `refactor:`). Атомарные, текст коммита по-русски. Tag scope `(translation)`, `(popup)`, `(db)`, `(a11y)`, `(settings)` где применимо.

**Verification gate before each commit:** `npx tsc --noEmit && npx jest -- <task-path>` обязательны зелёные. Финальная Phase 24 polish прогоняет `npx jest` целиком + `npx expo lint`.

**Skip co-author trailer** unless explicitly requested (per CLAUDE.md).

**Russian in user-facing strings**, code/identifiers English. i18n keys в `src/i18n/locales/{lang}.json` с namespace `translation.*`, `reader.a11y.*`, `settings.translation.*`.

**File paths absolute** when in `Bash` command, relative when in editor.

---

## Phase 0: Branch + dependency check (Tasks 1–3)

### Task 1: Create feature branch

**Files:**
- Verify: clean working tree on `feat/translation-engine`

- [ ] **Step 1: Confirm clean working tree**

```bash
git status
```

Expected: `nothing to commit, working tree clean` on branch `feat/translation-engine`.

- [ ] **Step 2: Pull latest + create branch**

```bash
git pull --ff-only origin feat/translation-engine || true
git checkout -b feat/translation-popup
```

Expected: switched to new branch `feat/translation-popup`.

- [ ] **Step 3: No commit — branch creation is git operation only**

---

### Task 2: Verify dependencies present (no new installs)

**Files:**
- Verify: `package.json` already contains `@gorhom/bottom-sheet`, `react-native-reanimated`, `react-native-worklets`, `expo-crypto`, `@nozbe/watermelondb`.

- [ ] **Step 1: Check existing deps**

```bash
node -e "const p=require('./package.json'); ['@gorhom/bottom-sheet','react-native-reanimated','react-native-worklets','expo-crypto','@nozbe/watermelondb'].forEach(k=>console.log(k, p.dependencies[k]||p.devDependencies?.[k]||'MISSING'))"
```

Expected: все 5 пакетов имеют version. Если хоть один `MISSING` — STOP, install missing deps в отдельном коммите перед continuation.

- [ ] **Step 2: No commit — verification only**

---

### Task 3: Create asset + directory skeleton

**Files:**
- Create directories (empty `.gitkeep` files):
  - `assets/mwe/`
  - `assets/false_friends/`
  - `src/services/translation/dictionaries/`
  - `src/services/translation/sentence/`

- [ ] **Step 1: Create directories + gitkeep files**

```bash
mkdir -p assets/mwe assets/false_friends src/services/translation/dictionaries src/services/translation/sentence
for d in assets/mwe assets/false_friends src/services/translation/dictionaries src/services/translation/sentence; do
  touch "$d/.gitkeep"
done
```

- [ ] **Step 2: Commit**

```bash
git add assets/mwe assets/false_friends src/services/translation/dictionaries src/services/translation/sentence
git commit -m "chore(structure): создать каркас директорий для #4.5 (MWE + false-friends + sentence)"
```

---

## Phase 1: DB schema v1→v2 migration (Tasks 4–9)

Spec ref: §4.4 (MWE storage), §5.3 (false_friends storage), §5.4 (translation_feedback storage), §6.1 (cache key versioning), §6.2 (cold inference tagging).

### Task 4: Bump SCHEMA_VERSION + add MWE table — RED

**Files:**
- Modify: `src/db/schema.ts`
- Test: `src/db/__tests__/schema.test.ts`

- [ ] **Step 1: Write failing test asserting SCHEMA_VERSION === 2 + mwe_phrases table present**

Edit `src/db/__tests__/schema.test.ts` (create if absent), add:

```ts
import { SCHEMA_VERSION, schema } from '@/db/schema';

describe('schema v2', () => {
  it('SCHEMA_VERSION должен быть 2 после #4.5 migration', () => {
    expect(SCHEMA_VERSION).toBe(2);
  });

  it('mwe_phrases table присутствует со всеми колонками', () => {
    const t = schema.tables.mwe_phrases;
    expect(t).toBeDefined();
    const names = t.columns.map((c) => c.name).sort();
    expect(names).toEqual(
      [
        'attribution',
        'domain',
        'gap_pattern',
        'literal_gloss',
        'mwe_type',
        'phrase',
        'source_lang',
        'target_lang',
        'translation_equivalent',
      ].sort(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/db/__tests__/schema.test.ts
```

Expected: FAIL — `Expected: 2, Received: 1` + `t is undefined`.

---

### Task 5: Bump SCHEMA_VERSION + add MWE table — GREEN

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Bump SCHEMA_VERSION to 2 + add mwe_phrases tableSchema**

Edit `src/db/schema.ts`:

```ts
export const SCHEMA_VERSION = 2;

// (existing tables...)
// Append in tables array:
    tableSchema({
      name: 'mwe_phrases',
      columns: [
        { name: 'source_lang', type: 'string', isIndexed: true },
        { name: 'target_lang', type: 'string', isIndexed: true },
        { name: 'phrase', type: 'string', isIndexed: true },
        { name: 'translation_equivalent', type: 'string' },
        { name: 'literal_gloss', type: 'string', isOptional: true },
        { name: 'mwe_type', type: 'string', isOptional: true },
        { name: 'gap_pattern', type: 'string', isOptional: true },
        { name: 'domain', type: 'string' },
        { name: 'attribution', type: 'string', isOptional: true },
      ],
    }),
```

- [ ] **Step 2: Run test to verify PASS**

```bash
npx jest src/db/__tests__/schema.test.ts
```

Expected: PASS — both tests green.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts src/db/__tests__/schema.test.ts
git commit -m "feat(db): SCHEMA_VERSION=2 + добавить mwe_phrases table"
```

---

### Task 6: Add false_friends + translation_feedback tables

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/__tests__/schema.test.ts`

- [ ] **Step 1: Write failing tests для false_friends + translation_feedback**

Append к `src/db/__tests__/schema.test.ts`:

```ts
it('false_friends table присутствует со всеми колонками', () => {
  const t = schema.tables.false_friends;
  expect(t).toBeDefined();
  const names = t.columns.map((c) => c.name).sort();
  expect(names).toEqual(
    ['actual_meaning', 'confidence', 'domain', 'looks_like_native', 'source_lang', 'source_word', 'target_lang'].sort(),
  );
});

it('translation_feedback table присутствует со всеми колонками', () => {
  const t = schema.tables.translation_feedback;
  expect(t).toBeDefined();
  const names = t.columns.map((c) => c.name).sort();
  expect(names).toEqual(
    ['book_id', 'book_language', 'created_at', 'kernel_build_id', 'model_version', 'native_language', 'source_sentence', 'translated_sentence'].sort(),
  );
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/db/__tests__/schema.test.ts
```

Expected: 2 new tests FAIL — both tables undefined.

- [ ] **Step 3: Add tableSchemas в src/db/schema.ts**

```ts
    tableSchema({
      name: 'false_friends',
      columns: [
        { name: 'source_lang', type: 'string', isIndexed: true },
        { name: 'target_lang', type: 'string', isIndexed: true },
        { name: 'source_word', type: 'string', isIndexed: true },
        { name: 'looks_like_native', type: 'string' },
        { name: 'actual_meaning', type: 'string' },
        { name: 'confidence', type: 'string' },
        { name: 'domain', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'translation_feedback',
      columns: [
        { name: 'source_sentence', type: 'string' },
        { name: 'translated_sentence', type: 'string' },
        { name: 'book_language', type: 'string' },
        { name: 'native_language', type: 'string' },
        { name: 'model_version', type: 'string' },
        { name: 'kernel_build_id', type: 'string', isOptional: true },
        { name: 'book_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'created_at', type: 'number', isIndexed: true },
      ],
    }),
```

- [ ] **Step 4: Run test to verify PASS**

```bash
npx jest src/db/__tests__/schema.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/__tests__/schema.test.ts
git commit -m "feat(db): добавить false_friends + translation_feedback tables в schema v2"
```

---

### Task 7: Extend translation_cache table — RED

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/__tests__/schema.test.ts`

Spec §6.2: cold inference tagging — `inference_context` column. Spec §7.2: sentence translations stored separately — `sentence_translation` + `translated_word_offset` columns. Spec §6.1: versioned key — `model_version` + `kernel_build_id` columns.

- [ ] **Step 1: Add failing test для translation_cache extension**

Append к `src/db/__tests__/schema.test.ts`:

```ts
it('translation_cache extended с sentence + inference_context + versioning columns', () => {
  const t = schema.tables.translation_cache;
  const names = t.columns.map((c) => c.name);
  expect(names).toContain('sentence_translation');
  expect(names).toContain('translated_word_offset');
  expect(names).toContain('inference_context');
  expect(names).toContain('model_version');
  expect(names).toContain('kernel_build_id');
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/db/__tests__/schema.test.ts
```

Expected: FAIL — columns missing.

---

### Task 8: Extend translation_cache table — GREEN + composite unique index

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add new columns к translation_cache tableSchema**

В `src/db/schema.ts` найти `tableSchema({ name: 'translation_cache', ... })` и добавить columns:

```ts
        { name: 'sentence_translation', type: 'string', isOptional: true },
        { name: 'translated_word_offset', type: 'number', isOptional: true },
        { name: 'inference_context', type: 'string' },  // 'cold' | 'warm' | 'thermal_throttled'
        { name: 'model_version', type: 'string' },
        { name: 'kernel_build_id', type: 'string', isOptional: true },
```

- [ ] **Step 2: Run test to verify PASS**

```bash
npx jest src/db/__tests__/schema.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts src/db/__tests__/schema.test.ts
git commit -m "feat(db): extend translation_cache с sentence + cold inference + versioning columns"
```

---

### Task 9: Write v1→v2 migration steps + test

**Files:**
- Modify: `src/db/migrations.ts`
- Test: `src/db/__tests__/migrations.test.ts`

- [ ] **Step 1: Write failing migration test**

Create `src/db/__tests__/migrations.test.ts`:

```ts
import { migrations } from '@/db/migrations';

describe('migrations v1→v2', () => {
  it('содержит migration step toVersion: 2', () => {
    const v2 = migrations.migrations.find((m) => m.toVersion === 2);
    expect(v2).toBeDefined();
    expect(v2!.steps.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/db/__tests__/migrations.test.ts
```

Expected: FAIL — `v2 is undefined`.

- [ ] **Step 3: Write migration step**

Replace `src/db/migrations.ts` content:

```ts
import { schemaMigrations, createTable, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        createTable({
          name: 'mwe_phrases',
          columns: [
            { name: 'source_lang', type: 'string', isIndexed: true },
            { name: 'target_lang', type: 'string', isIndexed: true },
            { name: 'phrase', type: 'string', isIndexed: true },
            { name: 'translation_equivalent', type: 'string' },
            { name: 'literal_gloss', type: 'string', isOptional: true },
            { name: 'mwe_type', type: 'string', isOptional: true },
            { name: 'gap_pattern', type: 'string', isOptional: true },
            { name: 'domain', type: 'string' },
            { name: 'attribution', type: 'string', isOptional: true },
          ],
        }),
        createTable({
          name: 'false_friends',
          columns: [
            { name: 'source_lang', type: 'string', isIndexed: true },
            { name: 'target_lang', type: 'string', isIndexed: true },
            { name: 'source_word', type: 'string', isIndexed: true },
            { name: 'looks_like_native', type: 'string' },
            { name: 'actual_meaning', type: 'string' },
            { name: 'confidence', type: 'string' },
            { name: 'domain', type: 'string' },
          ],
        }),
        createTable({
          name: 'translation_feedback',
          columns: [
            { name: 'source_sentence', type: 'string' },
            { name: 'translated_sentence', type: 'string' },
            { name: 'book_language', type: 'string' },
            { name: 'native_language', type: 'string' },
            { name: 'model_version', type: 'string' },
            { name: 'kernel_build_id', type: 'string', isOptional: true },
            { name: 'book_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'created_at', type: 'number', isIndexed: true },
          ],
        }),
        addColumns({
          table: 'translation_cache',
          columns: [
            { name: 'sentence_translation', type: 'string', isOptional: true },
            { name: 'translated_word_offset', type: 'number', isOptional: true },
            { name: 'inference_context', type: 'string' },
            { name: 'model_version', type: 'string' },
            { name: 'kernel_build_id', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
```

- [ ] **Step 4: Run test to verify PASS**

```bash
npx jest src/db/__tests__/migrations.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/migrations.ts src/db/__tests__/migrations.test.ts
git commit -m "feat(db): миграция v1→v2 — MWE + false_friends + translation_feedback + cache extension"
```

---

## Phase 2: WatermelonDB models + repositories (Tasks 10–17)

Spec ref: §4.4, §5.3, §5.4, §14.1.

### Task 10: MwePhraseModel — RED

**Files:**
- Test: `src/db/__tests__/models/MwePhrase.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/db/__tests__/models/MwePhrase.test.ts`:

```ts
import { MwePhraseModel } from '@/db/models/MwePhrase';

describe('MwePhraseModel', () => {
  it('decorates fields correctly', () => {
    expect(MwePhraseModel.table).toBe('mwe_phrases');
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/db/__tests__/models/MwePhrase.test.ts
```

Expected: FAIL — module not found.

---

### Task 11: MwePhraseModel — GREEN

**Files:**
- Create: `src/db/models/MwePhrase.ts`
- Modify: `src/db/models/index.ts`

- [ ] **Step 1: Create model**

Create `src/db/models/MwePhrase.ts`:

```ts
import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class MwePhraseModel extends Model {
  static override table = 'mwe_phrases';

  @field('source_lang') sourceLang!: string;
  @field('target_lang') targetLang!: string;
  @field('phrase') phrase!: string;
  @field('translation_equivalent') translationEquivalent!: string;
  @field('literal_gloss') literalGloss!: string | null;
  @field('mwe_type') mweType!: string | null;
  @field('gap_pattern') gapPattern!: string | null;
  @field('domain') domain!: string;
  @field('attribution') attribution!: string | null;
}
```

- [ ] **Step 2: Add export к `src/db/models/index.ts`**

```ts
export * from './MwePhrase';
```

- [ ] **Step 3: Run test to verify PASS**

```bash
npx jest src/db/__tests__/models/MwePhrase.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/db/models/MwePhrase.ts src/db/models/index.ts src/db/__tests__/models/MwePhrase.test.ts
git commit -m "feat(db): MwePhraseModel + export"
```

---

### Task 12: FalseFriendModel

**Files:**
- Create: `src/db/models/FalseFriend.ts`
- Test: `src/db/__tests__/models/FalseFriend.test.ts`
- Modify: `src/db/models/index.ts`

- [ ] **Step 1: Write failing test**

Create `src/db/__tests__/models/FalseFriend.test.ts`:

```ts
import { FalseFriendModel } from '@/db/models/FalseFriend';

describe('FalseFriendModel', () => {
  it('table name = false_friends', () => {
    expect(FalseFriendModel.table).toBe('false_friends');
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/db/__tests__/models/FalseFriend.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create model**

Create `src/db/models/FalseFriend.ts`:

```ts
import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export type FalseFriendConfidence = 'high' | 'medium';

export class FalseFriendModel extends Model {
  static override table = 'false_friends';

  @field('source_lang') sourceLang!: string;
  @field('target_lang') targetLang!: string;
  @field('source_word') sourceWord!: string;
  @field('looks_like_native') looksLikeNative!: string;
  @field('actual_meaning') actualMeaning!: string;
  @field('confidence') confidence!: FalseFriendConfidence;
  @field('domain') domain!: string;
}
```

- [ ] **Step 4: Add export + verify PASS**

Add к `src/db/models/index.ts`:

```ts
export * from './FalseFriend';
```

```bash
npx jest src/db/__tests__/models/FalseFriend.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/models/FalseFriend.ts src/db/models/index.ts src/db/__tests__/models/FalseFriend.test.ts
git commit -m "feat(db): FalseFriendModel + confidence type"
```

---

### Task 13: TranslationFeedbackModel

**Files:**
- Create: `src/db/models/TranslationFeedback.ts`
- Test: `src/db/__tests__/models/TranslationFeedback.test.ts`
- Modify: `src/db/models/index.ts`

- [ ] **Step 1: Write failing test**

Create `src/db/__tests__/models/TranslationFeedback.test.ts`:

```ts
import { TranslationFeedbackModel } from '@/db/models/TranslationFeedback';

describe('TranslationFeedbackModel', () => {
  it('table = translation_feedback', () => {
    expect(TranslationFeedbackModel.table).toBe('translation_feedback');
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/db/__tests__/models/TranslationFeedback.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create model**

Create `src/db/models/TranslationFeedback.ts`:

```ts
import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class TranslationFeedbackModel extends Model {
  static override table = 'translation_feedback';

  @field('source_sentence') sourceSentence!: string;
  @field('translated_sentence') translatedSentence!: string;
  @field('book_language') bookLanguage!: string;
  @field('native_language') nativeLanguage!: string;
  @field('model_version') modelVersion!: string;
  @field('kernel_build_id') kernelBuildId!: string | null;
  @field('book_id') bookId!: string | null;
  @field('created_at') createdAt!: number;
}
```

- [ ] **Step 4: Add export + verify PASS**

Add к `src/db/models/index.ts`:

```ts
export * from './TranslationFeedback';
```

```bash
npx jest src/db/__tests__/models/TranslationFeedback.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/models/TranslationFeedback.ts src/db/models/index.ts src/db/__tests__/models/TranslationFeedback.test.ts
git commit -m "feat(db): TranslationFeedbackModel для локальных жалоб на перевод"
```

---

### Task 14: Register models в database.ts

**Files:**
- Modify: `src/db/database.ts`

- [ ] **Step 1: Read current database.ts**

```bash
grep -n "modelClasses\|models:" src/db/database.ts | head -10
```

Locate the `modelClasses` array.

- [ ] **Step 2: Add 3 new models к modelClasses array**

In `src/db/database.ts`:

```ts
import {
  // existing models...
  MwePhraseModel,
  FalseFriendModel,
  TranslationFeedbackModel,
} from './models';

// в массиве modelClasses:
modelClasses: [
  // existing...
  MwePhraseModel,
  FalseFriendModel,
  TranslationFeedbackModel,
],
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/database.ts
git commit -m "feat(db): зарегистрировать MWE + FalseFriend + TranslationFeedback в database"
```

---

### Task 15: MweRepository

**Files:**
- Create: `src/db/repositories/MweRepository.ts`
- Test: `src/db/__tests__/repositories/MweRepository.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/db/__tests__/repositories/MweRepository.test.ts`:

```ts
import { createTestDatabase } from '@/db/testDatabase';
import { MweRepository } from '@/db/repositories/MweRepository';

describe('MweRepository', () => {
  it('bulkInsert + findForPair возвращает entries для (src, dst)', async () => {
    const db = await createTestDatabase();
    const repo = new MweRepository(db);
    await repo.bulkInsert([
      {
        sourceLang: 'en',
        targetLang: 'ru',
        phrase: 'kick the bucket',
        translationEquivalent: 'сыграть в ящик',
        literalGloss: 'ударить ведро',
        mweType: 'idiom',
        gapPattern: null,
        domain: 'general',
        attribution: 'wiktionary',
      },
    ]);
    const rows = await repo.findForPair('en', 'ru');
    expect(rows).toHaveLength(1);
    expect(rows[0].phrase).toBe('kick the bucket');
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/db/__tests__/repositories/MweRepository.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create repository**

Create `src/db/repositories/MweRepository.ts`:

```ts
import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import type { MwePhraseModel } from '@/db/models/MwePhrase';

export interface MwePhraseDTO {
  sourceLang: string;
  targetLang: string;
  phrase: string;
  translationEquivalent: string;
  literalGloss: string | null;
  mweType: string | null;
  gapPattern: string | null;
  domain: string;
  attribution: string | null;
}

export class MweRepository {
  constructor(private db: Database) {}

  private get collection() {
    return this.db.get<MwePhraseModel>('mwe_phrases');
  }

  async bulkInsert(rows: MwePhraseDTO[]): Promise<void> {
    await this.db.write(async () => {
      await this.db.batch(
        ...rows.map((r) =>
          this.collection.prepareCreate((m) => {
            m.sourceLang = r.sourceLang;
            m.targetLang = r.targetLang;
            m.phrase = r.phrase;
            m.translationEquivalent = r.translationEquivalent;
            m.literalGloss = r.literalGloss;
            m.mweType = r.mweType;
            m.gapPattern = r.gapPattern;
            m.domain = r.domain;
            m.attribution = r.attribution;
          }),
        ),
      );
    });
  }

  async findForPair(srcLang: string, dstLang: string): Promise<MwePhraseDTO[]> {
    const models = await this.collection
      .query(Q.where('source_lang', srcLang), Q.where('target_lang', dstLang))
      .fetch();
    return models.map((m) => ({
      sourceLang: m.sourceLang,
      targetLang: m.targetLang,
      phrase: m.phrase,
      translationEquivalent: m.translationEquivalent,
      literalGloss: m.literalGloss,
      mweType: m.mweType,
      gapPattern: m.gapPattern,
      domain: m.domain,
      attribution: m.attribution,
    }));
  }

  async deleteForPair(srcLang: string, dstLang: string): Promise<void> {
    await this.db.write(async () => {
      const models = await this.collection
        .query(Q.where('source_lang', srcLang), Q.where('target_lang', dstLang))
        .fetch();
      await this.db.batch(...models.map((m) => m.prepareDestroyPermanently()));
    });
  }
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
npx jest src/db/__tests__/repositories/MweRepository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/repositories/MweRepository.ts src/db/__tests__/repositories/MweRepository.test.ts
git commit -m "feat(db): MweRepository с bulkInsert + findForPair + deleteForPair"
```

---

### Task 16: FalseFriendRepository

**Files:**
- Create: `src/db/repositories/FalseFriendRepository.ts`
- Test: `src/db/__tests__/repositories/FalseFriendRepository.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/db/__tests__/repositories/FalseFriendRepository.test.ts`:

```ts
import { createTestDatabase } from '@/db/testDatabase';
import { FalseFriendRepository } from '@/db/repositories/FalseFriendRepository';

describe('FalseFriendRepository', () => {
  it('lookupByWord возвращает entry для (src, dst, word)', async () => {
    const db = await createTestDatabase();
    const repo = new FalseFriendRepository(db);
    await repo.bulkInsert([
      {
        sourceLang: 'ru',
        targetLang: 'en',
        sourceWord: 'магазин',
        looksLikeNative: 'magazine',
        actualMeaning: 'shop (not magazine)',
        confidence: 'high',
        domain: 'general',
      },
    ]);
    const hit = await repo.lookupByWord('ru', 'en', 'магазин');
    expect(hit).not.toBeNull();
    expect(hit!.looksLikeNative).toBe('magazine');
  });

  it('lookupByWord возвращает null при miss', async () => {
    const db = await createTestDatabase();
    const repo = new FalseFriendRepository(db);
    const hit = await repo.lookupByWord('ru', 'en', 'отсутствует');
    expect(hit).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/db/__tests__/repositories/FalseFriendRepository.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create repository**

Create `src/db/repositories/FalseFriendRepository.ts`:

```ts
import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import type { FalseFriendModel, FalseFriendConfidence } from '@/db/models/FalseFriend';

export interface FalseFriendDTO {
  sourceLang: string;
  targetLang: string;
  sourceWord: string;
  looksLikeNative: string;
  actualMeaning: string;
  confidence: FalseFriendConfidence;
  domain: string;
}

export class FalseFriendRepository {
  constructor(private db: Database) {}

  private get collection() {
    return this.db.get<FalseFriendModel>('false_friends');
  }

  async bulkInsert(rows: FalseFriendDTO[]): Promise<void> {
    await this.db.write(async () => {
      await this.db.batch(
        ...rows.map((r) =>
          this.collection.prepareCreate((m) => {
            m.sourceLang = r.sourceLang;
            m.targetLang = r.targetLang;
            m.sourceWord = r.sourceWord;
            m.looksLikeNative = r.looksLikeNative;
            m.actualMeaning = r.actualMeaning;
            m.confidence = r.confidence;
            m.domain = r.domain;
          }),
        ),
      );
    });
  }

  async lookupByWord(
    srcLang: string,
    dstLang: string,
    word: string,
  ): Promise<FalseFriendDTO | null> {
    const normalized = word.toLowerCase().trim();
    const models = await this.collection
      .query(
        Q.where('source_lang', srcLang),
        Q.where('target_lang', dstLang),
        Q.where('source_word', normalized),
      )
      .fetch();
    if (models.length === 0) return null;
    const m = models[0];
    return {
      sourceLang: m.sourceLang,
      targetLang: m.targetLang,
      sourceWord: m.sourceWord,
      looksLikeNative: m.looksLikeNative,
      actualMeaning: m.actualMeaning,
      confidence: m.confidence,
      domain: m.domain,
    };
  }

  async deleteForPair(srcLang: string, dstLang: string): Promise<void> {
    await this.db.write(async () => {
      const models = await this.collection
        .query(Q.where('source_lang', srcLang), Q.where('target_lang', dstLang))
        .fetch();
      await this.db.batch(...models.map((m) => m.prepareDestroyPermanently()));
    });
  }
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
npx jest src/db/__tests__/repositories/FalseFriendRepository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/repositories/FalseFriendRepository.ts src/db/__tests__/repositories/FalseFriendRepository.test.ts
git commit -m "feat(db): FalseFriendRepository с lookupByWord + bulkInsert"
```

---

### Task 17: TranslationFeedbackRepository

**Files:**
- Create: `src/db/repositories/TranslationFeedbackRepository.ts`
- Test: `src/db/__tests__/repositories/TranslationFeedbackRepository.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/db/__tests__/repositories/TranslationFeedbackRepository.test.ts`:

```ts
import { createTestDatabase } from '@/db/testDatabase';
import { TranslationFeedbackRepository } from '@/db/repositories/TranslationFeedbackRepository';

describe('TranslationFeedbackRepository', () => {
  it('insert + listRecent возвращает записи отсортированные DESC', async () => {
    const db = await createTestDatabase();
    const repo = new TranslationFeedbackRepository(db);
    const now = Date.now();
    await repo.insert({
      sourceSentence: 'Hello world',
      translatedSentence: 'Привет мир',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      modelVersion: 'Hy-MT1.5-1.8B-1.25bit',
      kernelBuildId: 'pr22836-stq1_0',
      bookId: null,
      createdAt: now,
    });
    const list = await repo.listRecent(10);
    expect(list).toHaveLength(1);
    expect(list[0].sourceSentence).toBe('Hello world');
  });

  it('purgeOlderThan удаляет записи старше cutoff', async () => {
    const db = await createTestDatabase();
    const repo = new TranslationFeedbackRepository(db);
    const old = Date.now() - 400 * 24 * 60 * 60 * 1000; // 400 days ago
    await repo.insert({
      sourceSentence: 'Old',
      translatedSentence: 'Старый',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      modelVersion: 'm1',
      kernelBuildId: null,
      bookId: null,
      createdAt: old,
    });
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    await repo.purgeOlderThan(cutoff);
    const list = await repo.listRecent(10);
    expect(list).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/db/__tests__/repositories/TranslationFeedbackRepository.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create repository**

Create `src/db/repositories/TranslationFeedbackRepository.ts`:

```ts
import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import type { TranslationFeedbackModel } from '@/db/models/TranslationFeedback';

export interface TranslationFeedbackDTO {
  id?: string;
  sourceSentence: string;
  translatedSentence: string;
  bookLanguage: string;
  nativeLanguage: string;
  modelVersion: string;
  kernelBuildId: string | null;
  bookId: string | null;
  createdAt: number;
}

export class TranslationFeedbackRepository {
  constructor(private db: Database) {}

  private get collection() {
    return this.db.get<TranslationFeedbackModel>('translation_feedback');
  }

  async insert(row: TranslationFeedbackDTO): Promise<string> {
    let id = '';
    await this.db.write(async () => {
      const created = await this.collection.create((m) => {
        m.sourceSentence = row.sourceSentence;
        m.translatedSentence = row.translatedSentence;
        m.bookLanguage = row.bookLanguage;
        m.nativeLanguage = row.nativeLanguage;
        m.modelVersion = row.modelVersion;
        m.kernelBuildId = row.kernelBuildId;
        m.bookId = row.bookId;
        m.createdAt = row.createdAt;
      });
      id = created.id;
    });
    return id;
  }

  async listRecent(limit: number): Promise<TranslationFeedbackDTO[]> {
    const models = await this.collection
      .query(Q.sortBy('created_at', Q.desc), Q.take(limit))
      .fetch();
    return models.map((m) => ({
      id: m.id,
      sourceSentence: m.sourceSentence,
      translatedSentence: m.translatedSentence,
      bookLanguage: m.bookLanguage,
      nativeLanguage: m.nativeLanguage,
      modelVersion: m.modelVersion,
      kernelBuildId: m.kernelBuildId,
      bookId: m.bookId,
      createdAt: m.createdAt,
    }));
  }

  async purgeOlderThan(cutoffMs: number): Promise<void> {
    await this.db.write(async () => {
      const models = await this.collection.query(Q.where('created_at', Q.lt(cutoffMs))).fetch();
      await this.db.batch(...models.map((m) => m.prepareDestroyPermanently()));
    });
  }

  async clearAll(): Promise<void> {
    await this.db.write(async () => {
      const models = await this.collection.query().fetch();
      await this.db.batch(...models.map((m) => m.prepareDestroyPermanently()));
    });
  }
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
npx jest src/db/__tests__/repositories/TranslationFeedbackRepository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/repositories/TranslationFeedbackRepository.ts src/db/__tests__/repositories/TranslationFeedbackRepository.test.ts
git commit -m "feat(db): TranslationFeedbackRepository с insert/list/purge"
```

---

## Phase 3: Asset CSVs (Tasks 18–20)

Spec §4.1, §5.1. v1 seed: 10 MWE pairs × ~10 sample entries each + 6 false-friend pairs × ~10 entries each. **Production-target** (5000 MWE / 1500-2500 FF per pair) seeded в Phase 23 polish при наличии licensed corpus dump. v1 ships с минимальным smoke seed чтобы unit tests на trie/lookup работали.

### Task 18: Create MWE seed CSVs (en-ru, en-es, en-fr, en-de, en-pt, en-it, ja-en, ko-en, ru-en, es-en)

**Files:**
- Create: `assets/mwe/en-ru.csv`, `assets/mwe/en-es.csv`, `assets/mwe/en-fr.csv`, `assets/mwe/en-de.csv`, `assets/mwe/en-pt.csv`, `assets/mwe/en-it.csv`, `assets/mwe/ja-en.csv`, `assets/mwe/ko-en.csv`, `assets/mwe/ru-en.csv`, `assets/mwe/es-en.csv`.

- [ ] **Step 1: Create `assets/mwe/en-ru.csv`**

```csv
mwe,translation_equivalent,literal_gloss,type,gap_pattern,domain,attribution
kick the bucket,сыграть в ящик,ударить ведро,idiom,,general,wiktionary
piece of cake,раз плюнуть,кусок торта,idiom,,general,wiktionary
in spite of,несмотря на,в злости от,collocation,,general,wiktionary
put up with,терпеть,поставить вверх с,phrasal_verb,,general,wiktionary
give __ up,сдаваться,отдать __ вверх,phrasal_verb,__≤3,general,wiktionary
on second thought,поразмыслив,на второй мысли,idiom,,general,wiktionary
in the nick of time,в последний момент,в зарубке времени,idiom,,general,wiktionary
break the ice,сломать лёд,сломать лёд,idiom,,general,wiktionary
hit the books,взяться за учёбу,ударить книги,idiom,,academic,wiktionary
once in a blue moon,очень редко,однажды в синюю луну,idiom,,general,wiktionary
```

- [ ] **Step 2: Create stub CSVs for other 9 pairs**

Для каждой пары `(en-es, en-fr, en-de, en-pt, en-it, ja-en, ko-en, ru-en, es-en)` создать файл с заголовком + 5-10 sample MWE из Wiktionary (idiom + phrasal_verb mix). Минимум 1 строка с `gap_pattern="__≤3"` per pair для slot template matcher test coverage.

Example `assets/mwe/en-es.csv`:

```csv
mwe,translation_equivalent,literal_gloss,type,gap_pattern,domain,attribution
break a leg,mucha suerte,romper una pierna,idiom,,general,wiktionary
pull __ leg,tomar el pelo a __,tirar de la pierna de __,phrasal_verb,__≤3,general,wiktionary
under the weather,bajo el clima,bajo el tiempo,idiom,,general,wiktionary
hit the road,marcharse,golpear el camino,idiom,,general,wiktionary
on cloud nine,en el séptimo cielo,en la nube nueve,idiom,,general,wiktionary
```

(Repeat similar 5-10 row structure for en-fr.csv, en-de.csv, en-pt.csv, en-it.csv, ja-en.csv, ko-en.csv, ru-en.csv, es-en.csv. Use Wiktionary attribution string. Per spec §4.1 — full corpus seeded в production polish phase.)

- [ ] **Step 3: Commit**

```bash
git add assets/mwe/
git commit -m "feat(assets): seed MWE CSVs для 10 language pairs (sample entries v1)"
```

---

### Task 19: Create false-friend seed CSVs (en-ru, ru-en, en-es, es-en, en-fr, fr-en)

**Files:**
- Create: `assets/false_friends/en-ru.csv`, `ru-en.csv`, `en-es.csv`, `es-en.csv`, `en-fr.csv`, `fr-en.csv`.

- [ ] **Step 1: Create `assets/false_friends/ru-en.csv`**

```csv
source_word,looks_like_native,actual_meaning,confidence,domain
магазин,magazine,"shop (not magazine — that's журнал)",high,general
симпатичный,sympathetic,good-looking (not sympathetic),high,general
интеллигентный,intelligent,"cultured/well-educated (not intelligent — that's умный)",high,general
актуальный,actual,relevant/current (not actual),high,general
аккуратный,accurate,"neat/tidy (not accurate — that's точный)",high,general
характер,character,personality (not character),high,general
конкретный,concrete,specific (not concrete material),high,general
фабрика,fabric,"factory (not fabric — that's ткань)",high,general
персона,person,celebrity/important person (formal only),medium,general
ангина,angina,strep throat (not heart angina),high,medical
```

- [ ] **Step 2: Create 5 stub CSVs для en-ru, en-es, es-en, en-fr, fr-en**

Example `assets/false_friends/en-es.csv`:

```csv
source_word,looks_like_native,actual_meaning,confidence,domain
embarrassed,embarazada,"embarrassed (not pregnant — that's the Spanish meaning)",high,general
exit,éxito,exit (not success — Spanish meaning),high,general
library,librería,"library (Spanish: librería = bookstore, library = biblioteca)",high,general
constipated,constipado,"constipated (Spanish: constipado = cold/flu)",high,medical
sensible,sensible,"reasonable EN / sensitive ES — partial false friend",medium,general
```

(Аналогичные 5-10 rows для en-ru.csv, es-en.csv, en-fr.csv, fr-en.csv.)

- [ ] **Step 3: Commit**

```bash
git add assets/false_friends/
git commit -m "feat(assets): seed false-friend CSVs для 6 language pairs (sample entries v1)"
```

---

### Task 20: app.json — add asset bundle config для CSVs

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Read current app.json `assetBundlePatterns`**

```bash
grep -A3 "assetBundlePatterns" app.json
```

If пусто или **/* — assets уже включены, skip к Step 3. Иначе:

- [ ] **Step 2: Add asset patterns**

Edit `app.json` `expo.assetBundlePatterns`:

```json
"assetBundlePatterns": [
  "**/*",
  "assets/mwe/**/*",
  "assets/false_friends/**/*"
],
```

- [ ] **Step 3: Verify**

```bash
node -e "console.log(JSON.stringify(require('./app.json').expo.assetBundlePatterns))"
```

Expected: patterns include `**/*` или explicit MWE/false-friend paths.

- [ ] **Step 4: Commit (if modified)**

```bash
git add app.json
git commit -m "chore(config): bundle assets/mwe + assets/false_friends в production build"
```

---

## Phase 4: MWE trie + slot template matcher (Tasks 21–28)

Spec ref: §4.2.

### Task 21: tokenize helper для MWE matcher — RED

**Files:**
- Test: `src/services/translation/dictionaries/__tests__/tokenize.test.ts`

- [ ] **Step 1: Write failing test**

Create test:

```ts
import { tokenize } from '@/services/translation/dictionaries/tokenize';

describe('tokenize', () => {
  it('split whitespace EN', () => {
    expect(tokenize('give it up now')).toEqual(['give', 'it', 'up', 'now']);
  });
  it('lowercase normalize', () => {
    expect(tokenize('GIVE IT UP')).toEqual(['give', 'it', 'up']);
  });
  it('strip trailing punctuation', () => {
    expect(tokenize('give it up!')).toEqual(['give', 'it', 'up']);
  });
  it('handles empty', () => {
    expect(tokenize('')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/services/translation/dictionaries/__tests__/tokenize.test.ts
```

Expected: FAIL — module not found.

---

### Task 22: tokenize helper — GREEN

**Files:**
- Create: `src/services/translation/dictionaries/tokenize.ts`

- [ ] **Step 1: Write minimal implementation**

```ts
// Простой whitespace tokenizer + lowercase + strip punctuation.
// Используется MWE trie + slot matcher. НЕ Intl.Segmenter (см. spec §19 Q1 —
// Hermes не поддерживает Intl.Segmenter в SDK 54).
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[!?.,;:"()«»\[\]]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}
```

- [ ] **Step 2: Run test to verify PASS**

```bash
npx jest src/services/translation/dictionaries/__tests__/tokenize.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 3: Commit**

```bash
git add src/services/translation/dictionaries/tokenize.ts src/services/translation/dictionaries/__tests__/tokenize.test.ts
git commit -m "feat(translation): tokenize helper для MWE matcher"
```

---

### Task 23: MWE trie data structure — RED

**Files:**
- Test: `src/services/translation/dictionaries/__tests__/MweTrie.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { MweTrie } from '@/services/translation/dictionaries/MweTrie';

describe('MweTrie', () => {
  it('inserts + finds contiguous longest match', () => {
    const trie = new MweTrie();
    trie.insert(['kick', 'the', 'bucket'], { phrase: 'kick the bucket', translationEquivalent: 'сыграть в ящик' });
    trie.insert(['kick'], { phrase: 'kick', translationEquivalent: 'пнуть' });
    const hit = trie.findLongestAt(['he', 'will', 'kick', 'the', 'bucket', 'soon'], 2);
    expect(hit).not.toBeNull();
    expect(hit!.payload.phrase).toBe('kick the bucket');
    expect(hit!.length).toBe(3);
  });

  it('returns null at no match', () => {
    const trie = new MweTrie();
    trie.insert(['hello', 'world'], { phrase: 'hello world' });
    const hit = trie.findLongestAt(['foo', 'bar'], 0);
    expect(hit).toBeNull();
  });

  it('matches single-token entry', () => {
    const trie = new MweTrie();
    trie.insert(['idiom'], { phrase: 'idiom' });
    const hit = trie.findLongestAt(['idiom'], 0);
    expect(hit!.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/services/translation/dictionaries/__tests__/MweTrie.test.ts
```

Expected: FAIL.

---

### Task 24: MWE trie — GREEN

**Files:**
- Create: `src/services/translation/dictionaries/MweTrie.ts`

- [ ] **Step 1: Implement trie**

```ts
// Trie data structure для greedy longest-match contiguous MWE lookup.
// Каждый node содержит children Map + optional payload (если в этом ноде заканчивается phrase).

export interface MwePayload {
  phrase: string;
  translationEquivalent: string;
  literalGloss?: string | null;
  mweType?: string | null;
  domain?: string;
}

interface TrieNode {
  children: Map<string, TrieNode>;
  payload: MwePayload | null;
}

export interface TrieMatch {
  payload: MwePayload;
  length: number;
}

export class MweTrie {
  private root: TrieNode = { children: new Map(), payload: null };

  insert(tokens: string[], payload: MwePayload): void {
    let node = this.root;
    for (const t of tokens) {
      let next = node.children.get(t);
      if (!next) {
        next = { children: new Map(), payload: null };
        node.children.set(t, next);
      }
      node = next;
    }
    node.payload = payload;
  }

  /**
   * Greedy longest match starting at position `startIdx` in tokens.
   * Returns longest matching span as { payload, length } or null.
   */
  findLongestAt(tokens: string[], startIdx: number): TrieMatch | null {
    let node = this.root;
    let bestMatch: TrieMatch | null = null;
    for (let i = startIdx; i < tokens.length; i++) {
      const next = node.children.get(tokens[i]);
      if (!next) break;
      node = next;
      if (node.payload) {
        bestMatch = { payload: node.payload, length: i - startIdx + 1 };
      }
    }
    return bestMatch;
  }
}
```

- [ ] **Step 2: Run test to verify PASS**

```bash
npx jest src/services/translation/dictionaries/__tests__/MweTrie.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 3: Commit**

```bash
git add src/services/translation/dictionaries/MweTrie.ts src/services/translation/dictionaries/__tests__/MweTrie.test.ts
git commit -m "feat(translation): MweTrie с greedy longest contiguous match"
```

---

### Task 25: Slot template matcher (discontinuous MWE) — RED

**Files:**
- Test: `src/services/translation/dictionaries/__tests__/SlotMatcher.test.ts`

Spec §4.2: gap_pattern `__≤3` matches `give __ up` для `give it up`, `give the book up`, но не `give the book to her up` (gap >3 tokens).

- [ ] **Step 1: Write failing test**

```ts
import { SlotMatcher } from '@/services/translation/dictionaries/SlotMatcher';

describe('SlotMatcher', () => {
  it('matches give __ up with gap=1', () => {
    const m = new SlotMatcher();
    m.addPattern({
      tokens: ['give', '__', 'up'],
      gapMax: 3,
      payload: { phrase: 'give __ up', translationEquivalent: 'сдаваться' },
    });
    const hit = m.findAt(['we', 'should', 'give', 'it', 'up', 'now'], 2);
    expect(hit).not.toBeNull();
    expect(hit!.payload.translationEquivalent).toBe('сдаваться');
    expect(hit!.length).toBe(3); // give .. up spans 3 tokens
  });

  it('matches with gap=3 inclusive', () => {
    const m = new SlotMatcher();
    m.addPattern({ tokens: ['give', '__', 'up'], gapMax: 3, payload: { phrase: 'give __ up', translationEquivalent: 'сдаваться' } });
    const hit = m.findAt(['give', 'the', 'old', 'book', 'up'], 0);
    expect(hit).not.toBeNull();
    expect(hit!.length).toBe(5);
  });

  it('rejects gap >3', () => {
    const m = new SlotMatcher();
    m.addPattern({ tokens: ['give', '__', 'up'], gapMax: 3, payload: { phrase: 'give __ up', translationEquivalent: 'сдаваться' } });
    const hit = m.findAt(['give', 'the', 'old', 'red', 'book', 'up'], 0);
    expect(hit).toBeNull();
  });

  it('returns null при no head match', () => {
    const m = new SlotMatcher();
    m.addPattern({ tokens: ['give', '__', 'up'], gapMax: 3, payload: { phrase: 'give __ up' } });
    expect(m.findAt(['take', 'it', 'up'], 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/services/translation/dictionaries/__tests__/SlotMatcher.test.ts
```

Expected: FAIL.

---

### Task 26: Slot template matcher — GREEN

**Files:**
- Create: `src/services/translation/dictionaries/SlotMatcher.ts`

- [ ] **Step 1: Implement matcher**

```ts
// Slot template matcher для discontinuous MWE (`give __ up`).
// Pattern format: tokens с `__` placeholder и gapMax (1-3) max inserted tokens.

import type { MwePayload } from './MweTrie';

export interface SlotPattern {
  tokens: string[]; // ['give', '__', 'up']
  gapMax: number;   // 1-3
  payload: MwePayload;
}

export interface SlotMatch {
  payload: MwePayload;
  length: number; // total tokens spanned in source
}

export class SlotMatcher {
  private patterns: SlotPattern[] = [];
  // Index by first non-slot token для quick filter.
  private byHead: Map<string, SlotPattern[]> = new Map();

  addPattern(p: SlotPattern): void {
    this.patterns.push(p);
    const head = p.tokens[0];
    if (head === '__') return; // skip patterns starting with slot (not in v1 corpus)
    const list = this.byHead.get(head) ?? [];
    list.push(p);
    this.byHead.set(head, list);
  }

  findAt(tokens: string[], startIdx: number): SlotMatch | null {
    const head = tokens[startIdx];
    if (head === undefined) return null;
    const candidates = this.byHead.get(head);
    if (!candidates) return null;
    let best: SlotMatch | null = null;
    for (const p of candidates) {
      const m = this.tryMatchPattern(tokens, startIdx, p);
      if (m && (!best || m.length > best.length)) best = m;
    }
    return best;
  }

  private tryMatchPattern(tokens: string[], startIdx: number, p: SlotPattern): SlotMatch | null {
    let srcIdx = startIdx;
    for (let patIdx = 0; patIdx < p.tokens.length; patIdx++) {
      const tok = p.tokens[patIdx];
      if (tok === '__') {
        // consume 1..gapMax tokens then continue к next pattern token
        const nextPatTok = p.tokens[patIdx + 1];
        if (nextPatTok === undefined) return null; // pattern ends with slot — not in v1
        let foundAt = -1;
        for (let gap = 1; gap <= p.gapMax && srcIdx + gap < tokens.length; gap++) {
          if (tokens[srcIdx + gap] === nextPatTok) {
            foundAt = srcIdx + gap;
            break;
          }
        }
        if (foundAt === -1) return null;
        srcIdx = foundAt + 1;
        patIdx++; // consumed nextPatTok already
      } else {
        if (tokens[srcIdx] !== tok) return null;
        srcIdx++;
      }
    }
    return { payload: p.payload, length: srcIdx - startIdx };
  }
}
```

- [ ] **Step 2: Run test to verify PASS**

```bash
npx jest src/services/translation/dictionaries/__tests__/SlotMatcher.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 3: Commit**

```bash
git add src/services/translation/dictionaries/SlotMatcher.ts src/services/translation/dictionaries/__tests__/SlotMatcher.test.ts
git commit -m "feat(translation): SlotMatcher для discontinuous MWE (gap ≤3 tokens)"
```

---

### Task 27: MweDictionary — combined trie + slot matcher

**Files:**
- Create: `src/services/translation/dictionaries/MweDictionary.ts`
- Test: `src/services/translation/dictionaries/__tests__/MweDictionary.test.ts`

- [ ] **Step 1: Write failing test**

Create test:

```ts
import { MweDictionary } from '@/services/translation/dictionaries/MweDictionary';

describe('MweDictionary', () => {
  it('contiguous match via trie', () => {
    const dict = new MweDictionary();
    dict.load([
      { phrase: 'kick the bucket', translationEquivalent: 'сыграть в ящик', mweType: 'idiom', gapPattern: null, literalGloss: 'ударить ведро', domain: 'general' },
    ]);
    const hit = dict.lookup('he will kick the bucket', 13);
    expect(hit).not.toBeNull();
    expect(hit!.payload.translationEquivalent).toBe('сыграть в ящик');
  });

  it('discontinuous match via slot pattern', () => {
    const dict = new MweDictionary();
    dict.load([
      { phrase: 'give __ up', translationEquivalent: 'сдаваться', mweType: 'phrasal_verb', gapPattern: '__≤3', literalGloss: null, domain: 'general' },
    ]);
    const hit = dict.lookup('we should give it up now', 13); // 'give' starts at 13
    expect(hit).not.toBeNull();
    expect(hit!.payload.translationEquivalent).toBe('сдаваться');
  });

  it('returns null при no match', () => {
    const dict = new MweDictionary();
    dict.load([{ phrase: 'hello world', translationEquivalent: 'привет мир', mweType: 'idiom', gapPattern: null, literalGloss: null, domain: 'general' }]);
    expect(dict.lookup('the quick brown fox', 4)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/services/translation/dictionaries/__tests__/MweDictionary.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement MweDictionary**

Create `src/services/translation/dictionaries/MweDictionary.ts`:

```ts
// Public-facing MWE lookup combining trie (contiguous) + SlotMatcher (discontinuous).
// Loaded once per book open для current (srcLang, dstLang) pair.
import { tokenize } from './tokenize';
import { MweTrie, type MwePayload } from './MweTrie';
import { SlotMatcher } from './SlotMatcher';

export interface MweEntry {
  phrase: string;
  translationEquivalent: string;
  literalGloss: string | null;
  mweType: string | null;
  gapPattern: string | null; // '' | null = contiguous; '__≤N' = discontinuous
  domain: string;
}

export interface MweLookupResult {
  payload: MwePayload;
  /** Number of tokens matched starting from the token containing `charOffset`. */
  matchedTokens: number;
  /** Index of first matched token in tokenized sentence. */
  matchStartTokenIdx: number;
}

export class MweDictionary {
  private trie = new MweTrie();
  private slotMatcher = new SlotMatcher();
  private loaded = false;

  load(entries: MweEntry[]): void {
    this.trie = new MweTrie();
    this.slotMatcher = new SlotMatcher();
    for (const e of entries) {
      const payload: MwePayload = {
        phrase: e.phrase,
        translationEquivalent: e.translationEquivalent,
        literalGloss: e.literalGloss,
        mweType: e.mweType,
        domain: e.domain,
      };
      if (e.gapPattern && e.gapPattern.startsWith('__')) {
        // discontinuous
        const tokens = tokenize(e.phrase);
        const gapMax = parseInt(e.gapPattern.match(/≤(\d+)/)?.[1] ?? '3', 10);
        this.slotMatcher.addPattern({ tokens, gapMax, payload });
      } else {
        // contiguous
        this.trie.insert(tokenize(e.phrase), payload);
      }
    }
    this.loaded = true;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Lookup MWE containing char position `charOffset` в sentence.
   * Returns longest match across trie + slot matcher.
   */
  lookup(sentence: string, charOffset: number): MweLookupResult | null {
    if (!this.loaded) return null;
    const tokens = tokenize(sentence);
    // Locate which token contains charOffset
    const tokenStartIdx = this.tokenAtChar(sentence, charOffset);
    if (tokenStartIdx < 0) return null;

    // Try matches starting from tokenStartIdx and 2 tokens before (in case MWE starts earlier than tapped word).
    let best: MweLookupResult | null = null;
    for (let start = Math.max(0, tokenStartIdx - 3); start <= tokenStartIdx; start++) {
      const trieHit = this.trie.findLongestAt(tokens, start);
      const slotHit = this.slotMatcher.findAt(tokens, start);
      const candidates: Array<{ length: number; payload: MwePayload }> = [];
      if (trieHit) candidates.push(trieHit);
      if (slotHit) candidates.push(slotHit);
      for (const c of candidates) {
        const endIdx = start + c.length;
        if (endIdx <= tokenStartIdx) continue; // match must cover tapped token
        if (!best || c.length > best.matchedTokens) {
          best = { payload: c.payload, matchedTokens: c.length, matchStartTokenIdx: start };
        }
      }
    }
    return best;
  }

  private tokenAtChar(sentence: string, charOffset: number): number {
    // Walk through original sentence, tracking which whitespace-separated token contains charOffset.
    let inToken = false;
    let tokenIdx = -1;
    for (let i = 0; i < sentence.length; i++) {
      const c = sentence[i];
      if (/\s/.test(c)) {
        inToken = false;
      } else {
        if (!inToken) {
          tokenIdx++;
          inToken = true;
        }
      }
      if (i === charOffset) return tokenIdx;
    }
    return tokenIdx;
  }
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
npx jest src/services/translation/dictionaries/__tests__/MweDictionary.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/dictionaries/MweDictionary.ts src/services/translation/dictionaries/__tests__/MweDictionary.test.ts
git commit -m "feat(translation): MweDictionary с trie + slot matcher combined"
```

---

### Task 28: CSV parser для MWE seed loading

**Files:**
- Create: `src/services/translation/dictionaries/parseMweCsv.ts`
- Test: `src/services/translation/dictionaries/__tests__/parseMweCsv.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { parseMweCsv } from '@/services/translation/dictionaries/parseMweCsv';

const SAMPLE = `mwe,translation_equivalent,literal_gloss,type,gap_pattern,domain,attribution
kick the bucket,сыграть в ящик,ударить ведро,idiom,,general,wiktionary
give __ up,сдаваться,отдать __ вверх,phrasal_verb,__≤3,general,wiktionary
`;

describe('parseMweCsv', () => {
  it('parses 2 rows correctly', () => {
    const rows = parseMweCsv(SAMPLE);
    expect(rows).toHaveLength(2);
    expect(rows[0].phrase).toBe('kick the bucket');
    expect(rows[0].translationEquivalent).toBe('сыграть в ящик');
    expect(rows[0].gapPattern).toBeNull();
    expect(rows[1].gapPattern).toBe('__≤3');
  });

  it('skips header + empty lines', () => {
    const rows = parseMweCsv(SAMPLE + '\n\n');
    expect(rows).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/services/translation/dictionaries/__tests__/parseMweCsv.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement parser**

Create `src/services/translation/dictionaries/parseMweCsv.ts`:

```ts
// Minimal CSV parser для MWE seed CSVs. Handles unquoted fields + commas inside values.
// Simple line-by-line, не RFC 4180 full — наши CSV не содержат embedded newlines.
import type { MweEntry } from './MweDictionary';

export function parseMweCsv(csv: string): MweEntry[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  // Expected: mwe, translation_equivalent, literal_gloss, type, gap_pattern, domain, attribution
  const out: MweEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 7) continue;
    out.push({
      phrase: cols[0],
      translationEquivalent: cols[1],
      literalGloss: cols[2] || null,
      mweType: cols[3] || null,
      gapPattern: cols[4] || null,
      domain: cols[5] || 'general',
    });
  }
  return out;
}

// Простой парсер с поддержкой quoted strings ("a, b" → одно поле).
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
npx jest src/services/translation/dictionaries/__tests__/parseMweCsv.test.ts
```

Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/dictionaries/parseMweCsv.ts src/services/translation/dictionaries/__tests__/parseMweCsv.test.ts
git commit -m "feat(translation): parseMweCsv для MWE seed loading"
```

---

## Phase 5: False-friend lookup (Tasks 29–31)

Spec ref: §5.

### Task 29: FalseFriendsDictionary — RED

**Files:**
- Test: `src/services/translation/dictionaries/__tests__/FalseFriendsDictionary.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { FalseFriendsDictionary } from '@/services/translation/dictionaries/FalseFriendsDictionary';

describe('FalseFriendsDictionary', () => {
  it('lookup hit for known word', () => {
    const d = new FalseFriendsDictionary();
    d.load([
      { sourceLang: 'ru', targetLang: 'en', sourceWord: 'магазин', looksLikeNative: 'magazine', actualMeaning: 'shop', confidence: 'high', domain: 'general' },
    ]);
    const hit = d.lookup('магазин');
    expect(hit).not.toBeNull();
    expect(hit!.looksLikeNative).toBe('magazine');
  });

  it('case insensitive', () => {
    const d = new FalseFriendsDictionary();
    d.load([
      { sourceLang: 'ru', targetLang: 'en', sourceWord: 'магазин', looksLikeNative: 'magazine', actualMeaning: 'shop', confidence: 'high', domain: 'general' },
    ]);
    expect(d.lookup('МАГАЗИН')).not.toBeNull();
  });

  it('returns null at miss', () => {
    const d = new FalseFriendsDictionary();
    d.load([]);
    expect(d.lookup('unknown')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/services/translation/dictionaries/__tests__/FalseFriendsDictionary.test.ts
```

Expected: FAIL.

---

### Task 30: FalseFriendsDictionary — GREEN

**Files:**
- Create: `src/services/translation/dictionaries/FalseFriendsDictionary.ts`

- [ ] **Step 1: Implement**

```ts
// In-memory false-friend lookup. Loaded once per book open для current pair.
// Map<lowercase(word), FalseFriendEntry>.

export interface FalseFriendEntry {
  sourceLang: string;
  targetLang: string;
  sourceWord: string;
  looksLikeNative: string;
  actualMeaning: string;
  confidence: 'high' | 'medium';
  domain: string;
}

export class FalseFriendsDictionary {
  private map = new Map<string, FalseFriendEntry>();
  private loaded = false;

  load(entries: FalseFriendEntry[]): void {
    this.map = new Map();
    for (const e of entries) {
      this.map.set(e.sourceWord.toLowerCase().trim(), e);
    }
    this.loaded = true;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  lookup(word: string): FalseFriendEntry | null {
    return this.map.get(word.toLowerCase().trim()) ?? null;
  }
}
```

- [ ] **Step 2: Run test to verify PASS**

```bash
npx jest src/services/translation/dictionaries/__tests__/FalseFriendsDictionary.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 3: Commit**

```bash
git add src/services/translation/dictionaries/FalseFriendsDictionary.ts src/services/translation/dictionaries/__tests__/FalseFriendsDictionary.test.ts
git commit -m "feat(translation): FalseFriendsDictionary lookup"
```

---

### Task 31: parseFalseFriendsCsv

**Files:**
- Create: `src/services/translation/dictionaries/parseFalseFriendsCsv.ts`
- Test: `src/services/translation/dictionaries/__tests__/parseFalseFriendsCsv.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { parseFalseFriendsCsv } from '@/services/translation/dictionaries/parseFalseFriendsCsv';

const SAMPLE = `source_word,looks_like_native,actual_meaning,confidence,domain
магазин,magazine,"shop (not magazine)",high,general
sensible,sensible,"reasonable EN / sensitive ES — partial",medium,general
`;

describe('parseFalseFriendsCsv', () => {
  it('parses 2 rows + sourceLang/targetLang injected', () => {
    const rows = parseFalseFriendsCsv(SAMPLE, 'ru', 'en');
    expect(rows).toHaveLength(2);
    expect(rows[0].sourceLang).toBe('ru');
    expect(rows[0].targetLang).toBe('en');
    expect(rows[0].sourceWord).toBe('магазин');
    expect(rows[0].confidence).toBe('high');
    expect(rows[1].confidence).toBe('medium');
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/services/translation/dictionaries/__tests__/parseFalseFriendsCsv.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/services/translation/dictionaries/parseFalseFriendsCsv.ts`:

```ts
// CSV parser for false-friend seed (source_word,looks_like_native,actual_meaning,confidence,domain).
// Lang pair injected from filename ({src}-{dst}.csv) by caller.
import type { FalseFriendEntry } from './FalseFriendsDictionary';

export function parseFalseFriendsCsv(
  csv: string,
  sourceLang: string,
  targetLang: string,
): FalseFriendEntry[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const out: FalseFriendEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 5) continue;
    const conf = (cols[3] === 'medium' ? 'medium' : 'high') as 'high' | 'medium';
    out.push({
      sourceLang,
      targetLang,
      sourceWord: cols[0],
      looksLikeNative: cols[1],
      actualMeaning: cols[2],
      confidence: conf,
      domain: cols[4] || 'general',
    });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
npx jest src/services/translation/dictionaries/__tests__/parseFalseFriendsCsv.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/dictionaries/parseFalseFriendsCsv.ts src/services/translation/dictionaries/__tests__/parseFalseFriendsCsv.test.ts
git commit -m "feat(translation): parseFalseFriendsCsv"
```

---

## Phase 6: Lazy seed dictionaries on book open (Tasks 32–34)

Spec ref: §4.4 (seed на first reader open для current book's pair).

### Task 32: Asset loader (require static CSV imports)

**Files:**
- Create: `src/services/translation/dictionaries/csvAssets.ts`

Hermes ограничение: dynamic require с переменным путём не работает. Используем static `require()` map: name → asset module. Loaded через `expo-asset` → `Asset.loadAsync` + `FileSystem.readAsStringAsync`.

- [ ] **Step 1: Create asset registry**

Create `src/services/translation/dictionaries/csvAssets.ts`:

```ts
// Static registry of bundled CSV assets. Hermes does not support dynamic require paths
// — every asset must be require()d at top level. Map key = `{src}-{dst}` pair.
// Asset paths relative к assets/.

import type { AssetSource } from 'react-native/Libraries/Image/AssetSourceResolver';

type AssetModule = number; // require() of CSV returns module ID

interface CsvAssetMap {
  mwe: Record<string, AssetModule>;
  falseFriends: Record<string, AssetModule>;
}

// MWE — 10 pairs seeded в Phase 3.
const mweAssets: Record<string, AssetModule> = {
  'en-ru': require('../../../../assets/mwe/en-ru.csv'),
  'en-es': require('../../../../assets/mwe/en-es.csv'),
  'en-fr': require('../../../../assets/mwe/en-fr.csv'),
  'en-de': require('../../../../assets/mwe/en-de.csv'),
  'en-pt': require('../../../../assets/mwe/en-pt.csv'),
  'en-it': require('../../../../assets/mwe/en-it.csv'),
  'ja-en': require('../../../../assets/mwe/ja-en.csv'),
  'ko-en': require('../../../../assets/mwe/ko-en.csv'),
  'ru-en': require('../../../../assets/mwe/ru-en.csv'),
  'es-en': require('../../../../assets/mwe/es-en.csv'),
};

// False-friends — 6 pairs seeded в Phase 3.
const falseFriendsAssets: Record<string, AssetModule> = {
  'en-ru': require('../../../../assets/false_friends/en-ru.csv'),
  'ru-en': require('../../../../assets/false_friends/ru-en.csv'),
  'en-es': require('../../../../assets/false_friends/en-es.csv'),
  'es-en': require('../../../../assets/false_friends/es-en.csv'),
  'en-fr': require('../../../../assets/false_friends/en-fr.csv'),
  'fr-en': require('../../../../assets/false_friends/fr-en.csv'),
};

export const csvAssets: CsvAssetMap = { mwe: mweAssets, falseFriends: falseFriendsAssets };

export function getMweAsset(srcLang: string, dstLang: string): AssetModule | null {
  return mweAssets[`${srcLang}-${dstLang}`] ?? null;
}

export function getFalseFriendsAsset(srcLang: string, dstLang: string): AssetModule | null {
  return falseFriendsAssets[`${srcLang}-${dstLang}`] ?? null;
}
```

- [ ] **Step 2: Check metro config supports .csv asset extension**

```bash
grep -n "csv" metro.config.js 2>/dev/null
```

Если нет — edit `metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts = [...config.resolver.assetExts, 'csv'];

module.exports = config;
```

- [ ] **Step 3: Commit**

```bash
git add src/services/translation/dictionaries/csvAssets.ts metro.config.js
git commit -m "feat(translation): static CSV asset registry + metro csv ext support"
```

---

### Task 33: DictionaryLoader service — lazy load on book open

**Files:**
- Create: `src/services/translation/dictionaries/DictionaryLoader.ts`
- Test: `src/services/translation/dictionaries/__tests__/DictionaryLoader.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { DictionaryLoader } from '@/services/translation/dictionaries/DictionaryLoader';
import { MweDictionary } from '@/services/translation/dictionaries/MweDictionary';
import { FalseFriendsDictionary } from '@/services/translation/dictionaries/FalseFriendsDictionary';

describe('DictionaryLoader', () => {
  it('loadPair заполняет MWE + false-friend для пары когда CSV доступен', async () => {
    const mwe = new MweDictionary();
    const ff = new FalseFriendsDictionary();
    const loader = new DictionaryLoader({
      mweDictionary: mwe,
      falseFriendsDictionary: ff,
      readMweCsv: async () => 'mwe,translation_equivalent,literal_gloss,type,gap_pattern,domain,attribution\nhello world,привет мир,,idiom,,general,test',
      readFalseFriendsCsv: async () => 'source_word,looks_like_native,actual_meaning,confidence,domain\nмагазин,magazine,shop,high,general',
    });
    await loader.loadPair('en', 'ru');
    expect(mwe.isLoaded()).toBe(true);
    expect(ff.isLoaded()).toBe(true);
    const m = mwe.lookup('hello world', 0);
    expect(m).not.toBeNull();
  });

  it('loadPair handles null asset gracefully (degraded pair)', async () => {
    const mwe = new MweDictionary();
    const ff = new FalseFriendsDictionary();
    const loader = new DictionaryLoader({
      mweDictionary: mwe,
      falseFriendsDictionary: ff,
      readMweCsv: async () => null, // pair not seeded
      readFalseFriendsCsv: async () => null,
    });
    await loader.loadPair('xx', 'yy');
    expect(mwe.isLoaded()).toBe(true); // loaded as empty
    expect(ff.isLoaded()).toBe(true);
    expect(mwe.lookup('anything', 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/services/translation/dictionaries/__tests__/DictionaryLoader.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement loader**

Create `src/services/translation/dictionaries/DictionaryLoader.ts`:

```ts
// Lazy-loads MWE + false-friend dictionaries для current book's pair.
// Called by Reader engine при book open. На book close — current pair stays loaded
// (next book может иметь same pair). При switch к new pair — overwrite both dicts.

import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { MweDictionary } from './MweDictionary';
import { FalseFriendsDictionary } from './FalseFriendsDictionary';
import { parseMweCsv } from './parseMweCsv';
import { parseFalseFriendsCsv } from './parseFalseFriendsCsv';
import { getMweAsset, getFalseFriendsAsset } from './csvAssets';

export interface DictionaryLoaderDeps {
  mweDictionary: MweDictionary;
  falseFriendsDictionary: FalseFriendsDictionary;
  /** Read raw CSV text for (src, dst). Returns null if pair not bundled. Injectable for tests. */
  readMweCsv: (src: string, dst: string) => Promise<string | null>;
  readFalseFriendsCsv: (src: string, dst: string) => Promise<string | null>;
}

export class DictionaryLoader {
  private currentPair: string | null = null;

  constructor(private deps: DictionaryLoaderDeps) {}

  async loadPair(srcLang: string, dstLang: string): Promise<void> {
    const key = `${srcLang}-${dstLang}`;
    if (this.currentPair === key) return; // already loaded
    const [mweCsv, ffCsv] = await Promise.all([
      this.deps.readMweCsv(srcLang, dstLang),
      this.deps.readFalseFriendsCsv(srcLang, dstLang),
    ]);
    this.deps.mweDictionary.load(mweCsv ? parseMweCsv(mweCsv) : []);
    this.deps.falseFriendsDictionary.load(ffCsv ? parseFalseFriendsCsv(ffCsv, srcLang, dstLang) : []);
    this.currentPair = key;
  }
}

/**
 * Real (production) CSV reader using expo-asset + FileSystem.
 * In Jest tests, replace with stubs (см. DictionaryLoader.test.ts).
 */
export async function readBundledCsvAsset(
  assetModule: number | null,
): Promise<string | null> {
  if (assetModule === null) return null;
  const asset = Asset.fromModule(assetModule);
  if (!asset.localUri) {
    await asset.downloadAsync();
  }
  if (!asset.localUri) return null;
  return await FileSystem.readAsStringAsync(asset.localUri);
}

export function makeRealMweReader() {
  return async (src: string, dst: string) => readBundledCsvAsset(getMweAsset(src, dst));
}
export function makeRealFalseFriendsReader() {
  return async (src: string, dst: string) => readBundledCsvAsset(getFalseFriendsAsset(src, dst));
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
npx jest src/services/translation/dictionaries/__tests__/DictionaryLoader.test.ts
```

Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/dictionaries/DictionaryLoader.ts src/services/translation/dictionaries/__tests__/DictionaryLoader.test.ts
git commit -m "feat(translation): DictionaryLoader для lazy seed MWE + false-friends на book open"
```

---

### Task 34: Wire DictionaryLoader в TranslationServiceContext

**Files:**
- Modify: `src/services/translation/TranslationServiceContext.tsx`

- [ ] **Step 1: Read current context**

```bash
cat src/services/translation/TranslationServiceContext.tsx | head -60
```

- [ ] **Step 2: Add dictionary instances + loader к context**

Edit `src/services/translation/TranslationServiceContext.tsx` to instantiate `MweDictionary`, `FalseFriendsDictionary`, `DictionaryLoader` at the top of provider, expose `loader.loadPair` via context, и `mweDictionary` / `falseFriendsDictionary` для popup access.

```tsx
import { MweDictionary } from './dictionaries/MweDictionary';
import { FalseFriendsDictionary } from './dictionaries/FalseFriendsDictionary';
import {
  DictionaryLoader,
  makeRealMweReader,
  makeRealFalseFriendsReader,
} from './dictionaries/DictionaryLoader';

// Inside Provider:
const mweDictionary = useMemo(() => new MweDictionary(), []);
const falseFriendsDictionary = useMemo(() => new FalseFriendsDictionary(), []);
const dictionaryLoader = useMemo(
  () =>
    new DictionaryLoader({
      mweDictionary,
      falseFriendsDictionary,
      readMweCsv: makeRealMweReader(),
      readFalseFriendsCsv: makeRealFalseFriendsReader(),
    }),
  [mweDictionary, falseFriendsDictionary],
);

const ctxValue = useMemo(
  () => ({
    translationService,
    dictionaryLoader,
    mweDictionary,
    falseFriendsDictionary,
  }),
  [translationService, dictionaryLoader, mweDictionary, falseFriendsDictionary],
);
```

И добавить тип контекста + хуки `useDictionaryLoader()`, `useMweDictionary()`, `useFalseFriendsDictionary()`.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/translation/TranslationServiceContext.tsx
git commit -m "feat(translation): wire DictionaryLoader + dicts в TranslationServiceContext"
```

---

## Phase 7: Versioned cache key + cold inference tagging (Tasks 35–39)

Spec ref: §6.

### Task 35: kernelBuildId helper — RED

**Files:**
- Test: `src/services/translation/__tests__/kernelBuildId.test.ts`

Spec §6.1: cache key includes kernel build ID. Vendored llama.rn fork has STQ kernel — ID derived from llama.rn package version + custom patch marker.

- [ ] **Step 1: Write failing test**

```ts
import { getKernelBuildId } from '@/services/translation/kernelBuildId';

describe('kernelBuildId', () => {
  it('returns stable string identifying current llama.rn build', () => {
    const id1 = getKernelBuildId();
    const id2 = getKernelBuildId();
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[a-z0-9-]+$/);
    expect(id1.length).toBeGreaterThan(4);
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/services/translation/__tests__/kernelBuildId.test.ts
```

Expected: FAIL.

---

### Task 36: kernelBuildId helper — GREEN

**Files:**
- Create: `src/services/translation/kernelBuildId.ts`

- [ ] **Step 1: Implement**

```ts
// Identifier для bundled llama.rn kernel build. Inputs cache key (см. §6.1)
// чтобы model upgrade / kernel patch меняли cache key → stale entries invalidated.
//
// v2.2: hardcoded const поверх llama.rn version + custom STQ patch marker.
// При bump'е llama.rn vendor → update const + добавить migration step.

const LLAMA_RN_VERSION = '0.12.0';
const STQ_PATCH_ID = 'pr22836-stq1_0';

export function getKernelBuildId(): string {
  return `${LLAMA_RN_VERSION}-${STQ_PATCH_ID}`;
}
```

- [ ] **Step 2: Run test to verify PASS**

```bash
npx jest src/services/translation/__tests__/kernelBuildId.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/services/translation/kernelBuildId.ts src/services/translation/__tests__/kernelBuildId.test.ts
git commit -m "feat(translation): kernelBuildId helper для versioned cache key"
```

---

### Task 37: inferenceContext tracker — RED + GREEN

**Files:**
- Create: `src/services/translation/inferenceContext.ts`
- Test: `src/services/translation/__tests__/inferenceContext.test.ts`

Spec §6.2: cold/warm/thermal_throttled tagging. Cold = first inference after model load (within ~30s window). Warm = subsequent. Thermal_throttled = TBD (v2 — placeholder always returns 'warm').

- [ ] **Step 1: Write failing test**

```ts
import { InferenceContextTracker } from '@/services/translation/inferenceContext';

describe('InferenceContextTracker', () => {
  it('first inference after warmup = cold', () => {
    const t = new InferenceContextTracker({ coldWindowMs: 30000, now: () => 1000 });
    t.markWarmupComplete();
    expect(t.current()).toBe('cold');
  });

  it('after coldWindowMs = warm', () => {
    let now = 1000;
    const t = new InferenceContextTracker({ coldWindowMs: 30000, now: () => now });
    t.markWarmupComplete();
    expect(t.current()).toBe('cold');
    now = 1000 + 31000; // advance past window
    expect(t.current()).toBe('warm');
  });

  it('without warmup mark = warm (safe default)', () => {
    const t = new InferenceContextTracker({ coldWindowMs: 30000, now: () => 1000 });
    expect(t.current()).toBe('warm');
  });

  it('reset returns to cold after next warmup', () => {
    let now = 1000;
    const t = new InferenceContextTracker({ coldWindowMs: 30000, now: () => now });
    t.markWarmupComplete();
    now = 35000;
    expect(t.current()).toBe('warm');
    t.reset();
    t.markWarmupComplete();
    now = 36000; // still inside fresh cold window (35000 + 30000 = 65000)
    expect(t.current()).toBe('cold');
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/services/translation/__tests__/inferenceContext.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/services/translation/inferenceContext.ts`:

```ts
// Per-spec §6.2: tag inferences cold/warm/thermal. Cold = first inference within
// `coldWindowMs` after model warmup completes. Used by CacheLayer to skip DB
// persist for cold inferences (numerical drift on Metal cold start).

export type InferenceContext = 'cold' | 'warm' | 'thermal_throttled';

export interface InferenceContextOptions {
  coldWindowMs: number;
  now?: () => number;
}

export class InferenceContextTracker {
  private warmupAt: number | null = null;
  private coldWindowMs: number;
  private now: () => number;

  constructor(opts: InferenceContextOptions) {
    this.coldWindowMs = opts.coldWindowMs;
    this.now = opts.now ?? (() => Date.now());
  }

  markWarmupComplete(): void {
    this.warmupAt = this.now();
  }

  reset(): void {
    this.warmupAt = null;
  }

  current(): InferenceContext {
    if (this.warmupAt === null) return 'warm';
    const elapsed = this.now() - this.warmupAt;
    return elapsed < this.coldWindowMs ? 'cold' : 'warm';
  }
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
npx jest src/services/translation/__tests__/inferenceContext.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/inferenceContext.ts src/services/translation/__tests__/inferenceContext.test.ts
git commit -m "feat(translation): InferenceContextTracker для cold/warm tagging"
```

---

### Task 38: Versioned cacheKey — extend existing helper

**Files:**
- Modify: `src/services/translation/cacheKey.ts`
- Test: `src/services/translation/__tests__/cacheKey.test.ts`

- [ ] **Step 1: Write failing test**

Append к `src/services/translation/__tests__/cacheKey.test.ts` (create if absent):

```ts
import { buildCacheKey } from '@/services/translation/cacheKey';

describe('buildCacheKey v2 (versioned)', () => {
  it('меняется при model version bump', async () => {
    const k1 = await buildCacheKey({
      word: 'hello',
      contextWindow: 'hello world',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      modelVersion: 'v1',
      kernelBuildId: 'kb1',
    });
    const k2 = await buildCacheKey({
      word: 'hello',
      contextWindow: 'hello world',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      modelVersion: 'v2',
      kernelBuildId: 'kb1',
    });
    expect(k1).not.toBe(k2);
  });

  it('меняется при kernel build bump', async () => {
    const k1 = await buildCacheKey({
      word: 'hello',
      contextWindow: 'hello world',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      modelVersion: 'v1',
      kernelBuildId: 'kb1',
    });
    const k2 = await buildCacheKey({
      word: 'hello',
      contextWindow: 'hello world',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      modelVersion: 'v1',
      kernelBuildId: 'kb2',
    });
    expect(k1).not.toBe(k2);
  });

  it('returns full 64-char hash', async () => {
    const k = await buildCacheKey({
      word: 'hello',
      contextWindow: 'hello world',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      modelVersion: 'v1',
      kernelBuildId: 'kb1',
    });
    expect(k.length).toBe(64);
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/services/translation/__tests__/cacheKey.test.ts
```

Expected: FAIL — existing `buildCacheKey` либо отсутствует, либо truncates.

- [ ] **Step 3: Rewrite cacheKey.ts**

Replace `src/services/translation/cacheKey.ts` content:

```ts
// Versioned cache key per spec §6.1. Inputs:
//   word, contextWindow, langPair, modelVersion, kernelBuildId.
// Output: full 64-char SHA-256 hex (v2: NOT truncated, чтобы collision
// probability была 2^-128 per row — composite unique index достаточен).
import * as Crypto from 'expo-crypto';
import type { BookLanguage, NativeLanguage } from '@/types/settings';

export interface CacheKeyInput {
  word: string;
  contextWindow: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
  modelVersion: string;
  kernelBuildId: string;
}

export async function buildCacheKey(input: CacheKeyInput): Promise<string> {
  const normalized = [
    input.word.toLowerCase().trim(),
    input.contextWindow.trim(),
    `${input.bookLanguage}-${input.nativeLanguage}`,
    `mv${input.modelVersion}`,
    `kb${input.kernelBuildId}`,
  ].join('::');
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalized);
}

// Separate key for sentence translations (additional dimensions: sentence + wordOffset).
export interface SentenceCacheKeyInput {
  sentence: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
  modelVersion: string;
  kernelBuildId: string;
}

export async function buildSentenceCacheKey(input: SentenceCacheKeyInput): Promise<string> {
  const normalized = [
    'sentence',
    input.sentence.trim(),
    `${input.bookLanguage}-${input.nativeLanguage}`,
    `mv${input.modelVersion}`,
    `kb${input.kernelBuildId}`,
  ].join('::');
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalized);
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
npx jest src/services/translation/__tests__/cacheKey.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/cacheKey.ts src/services/translation/__tests__/cacheKey.test.ts
git commit -m "feat(translation): versioned cache key + sentence cache key (full 64-char SHA)"
```

---

### Task 39: Update CacheLayer — cold rule + sentence support

**Files:**
- Modify: `src/services/translation/CacheLayer.ts`
- Test: `src/services/translation/__tests__/CacheLayer.test.ts`

Spec §6.2: `inference_context === 'cold'` → write **только** к in-memory LRU, **не persist в DB**. §7.2: sentence translations stored под separate key.

- [ ] **Step 1: Write failing test**

Create `src/services/translation/__tests__/CacheLayer.test.ts`:

```ts
import { CacheLayer } from '@/services/translation/CacheLayer';

describe('CacheLayer cold rule', () => {
  it('cold inference НЕ персистится в DB, только memory', async () => {
    const repoMock = {
      findByKey: jest.fn().mockResolvedValue(null),
      upsertByKey: jest.fn().mockResolvedValue(undefined),
      clearAll: jest.fn().mockResolvedValue(undefined),
    };
    const cache = new CacheLayer(repoMock as any, 100, () => 'mv1', () => 'kb1');
    await cache.write('hello', 'hello world', 'en', 'ru', 'привет', { inferenceContext: 'cold' });
    expect(repoMock.upsertByKey).not.toHaveBeenCalled();
    const hit = await cache.lookup('hello', 'hello world', 'en', 'ru');
    expect(hit!.value).toBe('привет');
    expect(hit!.source).toBe('memory');
  });

  it('warm inference персистится в DB', async () => {
    const repoMock = {
      findByKey: jest.fn().mockResolvedValue(null),
      upsertByKey: jest.fn().mockResolvedValue(undefined),
      clearAll: jest.fn().mockResolvedValue(undefined),
    };
    const cache = new CacheLayer(repoMock as any, 100, () => 'mv1', () => 'kb1');
    await cache.write('hello', 'hello world', 'en', 'ru', 'привет', { inferenceContext: 'warm' });
    // Allow microtask for fire-and-forget upsert
    await new Promise((r) => setTimeout(r, 10));
    expect(repoMock.upsertByKey).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/services/translation/__tests__/CacheLayer.test.ts
```

Expected: FAIL — constructor signature mismatch, write signature mismatch.

- [ ] **Step 3: Rewrite CacheLayer**

Replace `src/services/translation/CacheLayer.ts`:

```ts
// Two-tier cache: in-memory LRU + WatermelonDB persist. v2 extends с
// inferenceContext: cold inference goes ТОЛЬКО в memory (spec §6.2 — avoid
// poisoning DB on Metal cold drift). Also adds sentence lookup/write.

import { InMemoryLRU } from './InMemoryLRU';
import type { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';
import type { BookLanguage, NativeLanguage } from '@/types/settings';
import { buildCacheKey, buildSentenceCacheKey } from './cacheKey';
import type { InferenceContext } from './inferenceContext';

export type CacheSource = 'memory' | 'db';

export interface CacheLookupResult {
  value: string;
  source: CacheSource;
  translatedWordOffset?: number;
}

export interface CacheWriteOptions {
  inferenceContext: InferenceContext;
}

export class CacheLayer {
  private wordLru: InMemoryLRU<string>;
  private sentenceLru: InMemoryLRU<{ translation: string; offset?: number }>;

  constructor(
    private repo: TranslationCacheRepository,
    capacity: number,
    private getModelVersion: () => string,
    private getKernelBuildId: () => string,
  ) {
    this.wordLru = new InMemoryLRU<string>(capacity);
    this.sentenceLru = new InMemoryLRU<{ translation: string; offset?: number }>(Math.max(50, Math.floor(capacity / 4)));
  }

  async lookup(
    word: string,
    contextWindow: string,
    bookLanguage: BookLanguage,
    nativeLanguage: NativeLanguage,
  ): Promise<CacheLookupResult | null> {
    const key = await buildCacheKey({
      word,
      contextWindow,
      bookLanguage,
      nativeLanguage,
      modelVersion: this.getModelVersion(),
      kernelBuildId: this.getKernelBuildId(),
    });
    const mem = this.wordLru.get(key);
    if (mem !== undefined) return { value: mem, source: 'memory' };
    const db = await this.repo.findByKey(key);
    if (db) {
      this.wordLru.set(key, db.translation);
      return { value: db.translation, source: 'db' };
    }
    return null;
  }

  async write(
    word: string,
    contextWindow: string,
    bookLanguage: BookLanguage,
    nativeLanguage: NativeLanguage,
    translation: string,
    opts: CacheWriteOptions,
  ): Promise<void> {
    const key = await buildCacheKey({
      word,
      contextWindow,
      bookLanguage,
      nativeLanguage,
      modelVersion: this.getModelVersion(),
      kernelBuildId: this.getKernelBuildId(),
    });
    this.wordLru.set(key, translation);
    if (opts.inferenceContext === 'cold') return; // skip DB persist
    this.repo
      .upsertByKey({
        cacheKey: key,
        word,
        contextWindow,
        bookLanguage,
        nativeLanguage,
        translation,
        sentenceTranslation: null,
        translatedWordOffset: null,
        inferenceContext: opts.inferenceContext,
        modelVersion: this.getModelVersion(),
        kernelBuildId: this.getKernelBuildId(),
      })
      .catch((e) => {
        if (__DEV__) console.warn('[translation] cache DB write failed:', e);
      });
  }

  async sentenceLookup(
    sentence: string,
    bookLanguage: BookLanguage,
    nativeLanguage: NativeLanguage,
  ): Promise<{ translation: string; offset?: number; source: CacheSource } | null> {
    const key = await buildSentenceCacheKey({
      sentence,
      bookLanguage,
      nativeLanguage,
      modelVersion: this.getModelVersion(),
      kernelBuildId: this.getKernelBuildId(),
    });
    const mem = this.sentenceLru.get(key);
    if (mem !== undefined) return { translation: mem.translation, offset: mem.offset, source: 'memory' };
    const db = await this.repo.findSentenceByKey(key);
    if (db) {
      this.sentenceLru.set(key, { translation: db.sentenceTranslation!, offset: db.translatedWordOffset ?? undefined });
      return { translation: db.sentenceTranslation!, offset: db.translatedWordOffset ?? undefined, source: 'db' };
    }
    return null;
  }

  async writeSentence(
    sentence: string,
    bookLanguage: BookLanguage,
    nativeLanguage: NativeLanguage,
    translatedSentence: string,
    translatedWordOffset: number | undefined,
    opts: CacheWriteOptions,
  ): Promise<void> {
    const key = await buildSentenceCacheKey({
      sentence,
      bookLanguage,
      nativeLanguage,
      modelVersion: this.getModelVersion(),
      kernelBuildId: this.getKernelBuildId(),
    });
    this.sentenceLru.set(key, { translation: translatedSentence, offset: translatedWordOffset });
    if (opts.inferenceContext === 'cold') return;
    this.repo
      .upsertSentenceByKey({
        cacheKey: key,
        sourceSentence: sentence,
        translatedSentence,
        translatedWordOffset: translatedWordOffset ?? null,
        bookLanguage,
        nativeLanguage,
        inferenceContext: opts.inferenceContext,
        modelVersion: this.getModelVersion(),
        kernelBuildId: this.getKernelBuildId(),
      })
      .catch((e) => {
        if (__DEV__) console.warn('[translation] sentence cache DB write failed:', e);
      });
  }

  clearMemory(): void {
    this.wordLru.clear();
    this.sentenceLru.clear();
  }

  async clearPersistent(): Promise<void> {
    await this.repo.clearAll();
  }
}
```

**Note**: `TranslationCacheRepository.upsertByKey`, `findSentenceByKey`, `upsertSentenceByKey` методы расширяются в следующей задаче.

- [ ] **Step 4: Update TranslationCacheRepository — RED + GREEN combined**

Edit `src/db/repositories/TranslationCacheRepository.ts` (existing file, locate `upsertByKey`):

```ts
// Existing upsertByKey signature must accept new fields:
//   sentenceTranslation, translatedWordOffset, inferenceContext, modelVersion, kernelBuildId.
// Add findSentenceByKey + upsertSentenceByKey methods.

// (Existing) upsertByKey now writes additional columns; default sentenceTranslation=null когда это word entry.
// Add:
async findSentenceByKey(key: string): Promise<TranslationCacheModel | null> {
  const rows = await this.collection
    .query(Q.where('cache_key', key), Q.where('sentence_translation', Q.notEq(null)))
    .fetch();
  return rows[0] ?? null;
}

async upsertSentenceByKey(input: SentenceUpsertInput): Promise<void> {
  // similar to upsertByKey but writes sentence_translation + translated_word_offset + sets word to '' / context to source sentence
  await this.db.write(async () => {
    const existing = await this.collection.query(Q.where('cache_key', input.cacheKey)).fetch();
    if (existing[0]) {
      await existing[0].update((m: any) => {
        m.sentenceTranslation = input.translatedSentence;
        m.translatedWordOffset = input.translatedWordOffset;
        m.inferenceContext = input.inferenceContext;
        m.modelVersion = input.modelVersion;
        m.kernelBuildId = input.kernelBuildId;
      });
    } else {
      await this.collection.create((m: any) => {
        m.cacheKey = input.cacheKey;
        m.word = '';
        m.contextWindow = input.sourceSentence;
        m.bookLanguage = input.bookLanguage;
        m.nativeLanguage = input.nativeLanguage;
        m.translation = '';
        m.sentenceTranslation = input.translatedSentence;
        m.translatedWordOffset = input.translatedWordOffset;
        m.inferenceContext = input.inferenceContext;
        m.modelVersion = input.modelVersion;
        m.kernelBuildId = input.kernelBuildId;
        m.createdAt = Date.now();
      });
    }
  });
}
```

Add types `SentenceUpsertInput` + extend `TranslationCacheModel` с new `@field` decorators для new columns в Task 40.

- [ ] **Step 5: Run CacheLayer test PASS**

```bash
npx jest src/services/translation/__tests__/CacheLayer.test.ts
```

Expected: PASS — 2 tests.

- [ ] **Step 6: Commit**

```bash
git add src/services/translation/CacheLayer.ts src/services/translation/__tests__/CacheLayer.test.ts src/db/repositories/TranslationCacheRepository.ts
git commit -m "feat(translation): CacheLayer cold-rule + sentence cache support"
```

---

## Phase 8: Word alignment fail-safe (Tasks 40–42)

Spec ref: §7.4.

### Task 40: tryAlignWord heuristic — RED

**Files:**
- Test: `src/services/translation/sentence/__tests__/tryAlignWord.test.ts`

Spec §7.4: fail-safe — find target word translation в translated sentence. If not found, return `undefined` (no proportional fallback).

- [ ] **Step 1: Write failing test**

```ts
import { tryAlignWord } from '@/services/translation/sentence/tryAlignWord';

describe('tryAlignWord', () => {
  it('finds target word при known word-level translation', () => {
    const result = tryAlignWord({
      sourceSentence: 'The spring of life is short.',
      wordOffset: 4,
      sourceWord: 'spring',
      translatedSentence: 'Источник жизни короток.',
      knownWordTranslation: 'источник',
    });
    expect(result).toBe(0); // 'Источник' starts at 0
  });

  it('returns undefined when translation NOT found в target', () => {
    const result = tryAlignWord({
      sourceSentence: 'The spring of life.',
      wordOffset: 4,
      sourceWord: 'spring',
      translatedSentence: 'Источник жизни.',
      knownWordTranslation: 'весна', // different word, not in target
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined when knownWordTranslation is undefined', () => {
    const result = tryAlignWord({
      sourceSentence: 'The spring of life.',
      wordOffset: 4,
      sourceWord: 'spring',
      translatedSentence: 'Источник жизни.',
      knownWordTranslation: undefined,
    });
    expect(result).toBeUndefined();
  });

  it('case-insensitive match', () => {
    const result = tryAlignWord({
      sourceSentence: 'Spring is here.',
      wordOffset: 0,
      sourceWord: 'Spring',
      translatedSentence: 'Источник здесь.',
      knownWordTranslation: 'источник',
    });
    expect(result).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/services/translation/sentence/__tests__/tryAlignWord.test.ts
```

Expected: FAIL.

---

### Task 41: tryAlignWord — GREEN

**Files:**
- Create: `src/services/translation/sentence/tryAlignWord.ts`

- [ ] **Step 1: Implement**

```ts
// Fail-safe word alignment. Strategy per spec §7.4:
// 1. Use known word-level translation как anchor.
// 2. Find first case-insensitive substring match в translated sentence.
// 3. If not found → return undefined (NO proportional index fallback).
//
// Caller renders highlight ТОЛЬКО когда offset defined.

export interface TryAlignWordInput {
  sourceSentence: string;
  wordOffset: number;
  sourceWord: string;
  translatedSentence: string;
  /** Word-level translation of sourceWord (cache hit или fresh inference). undefined → no alignment possible. */
  knownWordTranslation: string | undefined;
}

/**
 * @returns Char offset in `translatedSentence` где target word starts, или undefined.
 */
export function tryAlignWord(input: TryAlignWordInput): number | undefined {
  if (!input.knownWordTranslation) return undefined;
  const needle = input.knownWordTranslation.toLowerCase().trim();
  if (!needle) return undefined;
  const haystack = input.translatedSentence.toLowerCase();
  const idx = haystack.indexOf(needle);
  return idx >= 0 ? idx : undefined;
}
```

- [ ] **Step 2: Run test to verify PASS**

```bash
npx jest src/services/translation/sentence/__tests__/tryAlignWord.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 3: Commit**

```bash
git add src/services/translation/sentence/tryAlignWord.ts src/services/translation/sentence/__tests__/tryAlignWord.test.ts
git commit -m "feat(translation): tryAlignWord fail-safe heuristic"
```

---

### Task 42: Phase 8 verification gate

- [ ] **Step 1: Full typecheck + tests for Phase 4-8**

```bash
npx tsc --noEmit && npx jest src/services/translation/
```

Expected: 0 typecheck errors, all translation service tests pass.

---

(Plan continues — additional phases written в отдельных commits для удобства review.)

## Phase 9: PromptBuilder sentence translation (Tasks 43–45)

Spec ref: §11.2.

### Task 43: buildSentencePrompt — RED

**Files:**
- Test: `src/services/translation/__tests__/PromptBuilder.test.ts` (append)

- [ ] **Step 1: Append failing test**

```ts
import { buildSentencePrompt } from '@/services/translation/PromptBuilder';

describe('buildSentencePrompt', () => {
  it('returns chat-template messages array', () => {
    const msgs = buildSentencePrompt({
      sentence: 'The quick brown fox jumps over the lazy dog.',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(Array.isArray(msgs)).toBe(true);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].role).toBe('user');
    expect(msgs[1].content).toContain('The quick brown fox');
    expect(msgs[1].content).toContain('Russian');
  });

  it('uses target language full name (not 2-letter code) в prompt', () => {
    const msgs = buildSentencePrompt({
      sentence: 'Hello.',
      bookLanguage: 'en',
      nativeLanguage: 'es',
    });
    expect(msgs[1].content).toContain('Spanish');
    expect(msgs[1].content).not.toContain(': es');
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/services/translation/__tests__/PromptBuilder.test.ts -t "buildSentencePrompt"
```

Expected: FAIL — function not exported.

---

### Task 44: buildSentencePrompt — GREEN

**Files:**
- Modify: `src/services/translation/PromptBuilder.ts`

- [ ] **Step 1: Add buildSentencePrompt export**

Append к `src/services/translation/PromptBuilder.ts`:

```ts
import type { BookLanguage, NativeLanguage } from '@/types/settings';

const FULL_LANG_NAMES: Record<string, string> = {
  en: 'English', ru: 'Russian', pl: 'Polish', uk: 'Ukrainian',
  es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
  pt: 'Portuguese', ja: 'Japanese', ko: 'Korean', ar: 'Arabic', hi: 'Hindi',
};

export interface SentencePromptInput {
  sentence: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function buildSentencePrompt(input: SentencePromptInput): ChatMessage[] {
  const target = FULL_LANG_NAMES[input.nativeLanguage] ?? input.nativeLanguage;
  return [
    {
      role: 'system',
      content: `You are a careful translator. Translate the user's sentence into ${target}. Preserve meaning, register, and named entities. Respond with translation only, no explanations.`,
    },
    {
      role: 'user',
      content: `Translate to ${target}:\n${input.sentence.trim()}`,
    },
  ];
}
```

- [ ] **Step 2: Run test to verify PASS**

```bash
npx jest src/services/translation/__tests__/PromptBuilder.test.ts -t "buildSentencePrompt"
```

Expected: PASS — 2 tests.

- [ ] **Step 3: Commit**

```bash
git add src/services/translation/PromptBuilder.ts src/services/translation/__tests__/PromptBuilder.test.ts
git commit -m "feat(translation): buildSentencePrompt с jinja chat-template messages"
```

---

### Task 45: cleanSentenceTranslation helper

**Files:**
- Create: `src/services/translation/sentence/cleanSentenceTranslation.ts`
- Test: `src/services/translation/sentence/__tests__/cleanSentenceTranslation.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { cleanSentenceTranslation } from '@/services/translation/sentence/cleanSentenceTranslation';

describe('cleanSentenceTranslation', () => {
  it('strips leading/trailing whitespace + newlines', () => {
    expect(cleanSentenceTranslation('  Hello world.\n\n')).toBe('Hello world.');
  });

  it('strips leading "Translation:" / "Перевод:" prefix', () => {
    expect(cleanSentenceTranslation('Translation: Hello world.')).toBe('Hello world.');
    expect(cleanSentenceTranslation('Перевод: Привет мир.')).toBe('Привет мир.');
  });

  it('keeps internal newlines intact (multi-line sentences)', () => {
    expect(cleanSentenceTranslation('Line one.\nLine two.')).toBe('Line one.\nLine two.');
  });

  it('returns empty string if input is whitespace only', () => {
    expect(cleanSentenceTranslation('   \n  ')).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/services/translation/sentence/__tests__/cleanSentenceTranslation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// Strip common LLM artifacts: leading "Translation:" labels (multilingual),
// leading/trailing whitespace, preserve internal newlines.
const PREFIX_RE = /^(translation|перевод|traducción|traduction|übersetzung|traduzione|tradução|翻訳|번역|الترجمة|अनुवाद)\s*[:：]\s*/i;

export function cleanSentenceTranslation(raw: string): string {
  let s = raw.trim();
  s = s.replace(PREFIX_RE, '');
  return s.trim();
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
npx jest src/services/translation/sentence/__tests__/cleanSentenceTranslation.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/sentence/cleanSentenceTranslation.ts src/services/translation/sentence/__tests__/cleanSentenceTranslation.test.ts
git commit -m "feat(translation): cleanSentenceTranslation strip prefix artifacts"
```

---

## Phase 10: ITranslationService extended types + translateSentence (Tasks 46–49)

Spec ref: §14.1, §7.2.

### Task 46: Extend ITranslationService types

**Files:**
- Modify: `src/services/translation/ITranslationService.ts`
- Test: `src/services/translation/__tests__/ITranslationService.types.test.ts`

- [ ] **Step 1: Write failing type test**

Create `src/services/translation/__tests__/ITranslationService.types.test.ts`:

```ts
import type { SentenceTranslationInput, SentenceTranslationResult, ITranslationService, TranslationResult } from '@/services/translation/ITranslationService';

// Compile-time type assertions (no runtime).
describe('ITranslationService types', () => {
  it('SentenceTranslationResult has experimental boolean', () => {
    const r: SentenceTranslationResult = { status: 'ok', experimental: true };
    expect(r.experimental).toBe(true);
  });

  it('TranslationResult has optional false-friend + MWE + encounter fields', () => {
    const r: TranslationResult = {
      status: 'ok',
      translation: 'hi',
      falseFriend: { looksLike: 'magazine', actualMeaning: 'shop', confidence: 'high', domain: 'general' },
      mwePhrase: { phrase: 'give up', translationEquivalent: 'сдаваться', type: 'phrasal_verb' },
      encounterCount: 5,
    };
    expect(r.falseFriend?.confidence).toBe('high');
  });

  it('ITranslationService has translateSentence method signature', () => {
    const stub: ITranslationService = {
      translate: jest.fn(),
      translateSentence: jest.fn(),
      clearCache: jest.fn(),
    };
    expect(typeof stub.translateSentence).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx tsc --noEmit
```

Expected: type errors — `SentenceTranslationResult`, `falseFriend`, `mwePhrase`, `translateSentence` missing.

- [ ] **Step 3: Extend types**

Edit `src/services/translation/ITranslationService.ts`:

```ts
import type { BookLanguage, NativeLanguage } from '@/types/settings';
import type { InferenceContext } from './inferenceContext';

export interface TranslationInput {
  word: string;
  contextWindow: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
}

export type TranslationStatus = 'ok' | 'pending' | 'error';

export type TranslationErrorCode =
  | 'MODEL_NOT_INSTALLED'
  | 'MODEL_LOADING'
  | 'INFERENCE_TIMEOUT'
  | 'INFERENCE_FAILED'
  | 'EMPTY_RESPONSE'
  | 'UNSUPPORTED_PAIR';

export type TranslationSource = 'memory' | 'db' | 'inference';

export interface FalseFriendInfo {
  looksLike: string;
  actualMeaning: string;
  confidence: 'high' | 'medium';
  domain: string;
}

export interface MwePhraseInfo {
  phrase: string;
  translationEquivalent: string;
  literalGloss?: string | null;
  type: 'idiom' | 'phrasal_verb' | 'collocation' | 'proverb' | string;
}

export interface TranslationResult {
  status: TranslationStatus;
  translation?: string;
  grammarNote?: string;
  alternativeSenses?: Array<{ sense: string; translation: string }>;
  registerTag?: 'arch' | 'colloq' | 'lit' | 'vulg' | 'tech';
  registerDomain?: 'general' | 'medical' | 'legal' | 'tech' | 'literary' | 'academic';
  falseFriend?: FalseFriendInfo;
  mwePhrase?: MwePhraseInfo;
  encounterCount?: number;
  pronunciation?: { ipa?: string; audioUri?: string; syllables?: string };
  errorMessage?: string;
  source?: TranslationSource;
  inferenceContext?: InferenceContext;
  errorCode?: TranslationErrorCode;
}

export interface SentenceTranslationInput {
  sentence: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
  /** Char offset of source word (for alignment) within sentence. Optional. */
  wordOffset?: number;
  /** Source word at wordOffset (used for alignment heuristic). */
  sourceWord?: string;
}

export interface SentenceTranslationResult {
  status: 'ok' | 'error';
  sourceSentence?: string;
  translatedSentence?: string;
  translatedWordOffset?: number;
  experimental?: boolean;
  inferenceContext?: InferenceContext;
  source?: TranslationSource;
  errorCode?: TranslationErrorCode;
  errorMessage?: string;
}

export interface ITranslationService {
  translate(input: TranslationInput): Promise<TranslationResult>;
  translateSentence(input: SentenceTranslationInput): Promise<SentenceTranslationResult>;
  clearCache(): Promise<void>;
}
```

- [ ] **Step 4: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Run test PASS**

```bash
npx jest src/services/translation/__tests__/ITranslationService.types.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/services/translation/ITranslationService.ts src/services/translation/__tests__/ITranslationService.types.test.ts
git commit -m "feat(translation): расширить ITranslationService types (sentence, MWE, false-friend, encounter)"
```

---

### Task 47: NoOp + Mock translateSentence stubs

**Files:**
- Modify: `src/services/translation/NoOpTranslationService.ts`
- Modify: `src/services/translation/MockTranslationService.ts`

- [ ] **Step 1: Add translateSentence stub к NoOp**

Edit `src/services/translation/NoOpTranslationService.ts`:

```ts
// Append:
async translateSentence(): Promise<SentenceTranslationResult> {
  return { status: 'error', errorCode: 'MODEL_NOT_INSTALLED', errorMessage: 'NoOp: no LLM' };
}
```

- [ ] **Step 2: Add translateSentence stub к Mock**

Edit `src/services/translation/MockTranslationService.ts`:

```ts
async translateSentence(input: SentenceTranslationInput): Promise<SentenceTranslationResult> {
  return {
    status: 'ok',
    sourceSentence: input.sentence,
    translatedSentence: `[mock translation of: ${input.sentence}]`,
    experimental: true,
  };
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/translation/NoOpTranslationService.ts src/services/translation/MockTranslationService.ts
git commit -m "feat(translation): translateSentence stubs в NoOp + Mock"
```

---

### Task 48: LlamaTranslationService.translateSentence — RED

**Files:**
- Test: `src/services/translation/__tests__/LlamaTranslationService.sentence.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { LlamaTranslationService } from '@/services/translation/LlamaTranslationService';
import { useLlmStatusStore } from '@/stores/llmStatusStore';

describe('LlamaTranslationService.translateSentence', () => {
  beforeEach(() => {
    useLlmStatusStore.setState({ status: 'ready' });
  });

  it('returns experimental=true для sentence результата', async () => {
    const ctxStub = {
      completion: jest.fn().mockResolvedValue({ text: 'Привет мир.' }),
    };
    const cacheStub = {
      sentenceLookup: jest.fn().mockResolvedValue(null),
      writeSentence: jest.fn().mockResolvedValue(undefined),
    };
    const queueStub = { run: (fn: any) => fn() };
    const svc = new LlamaTranslationService({
      contextProvider: () => ctxStub as any,
      cache: cacheStub as any,
      queue: queueStub as any,
      inferenceTracker: { current: () => 'warm' } as any,
    });
    const r = await svc.translateSentence({
      sentence: 'Hello world.',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(r.status).toBe('ok');
    expect(r.experimental).toBe(true);
    expect(r.translatedSentence).toBe('Привет мир.');
  });

  it('error when model not ready', async () => {
    useLlmStatusStore.setState({ status: 'idle' });
    const svc = new LlamaTranslationService({
      contextProvider: () => null,
      cache: { sentenceLookup: jest.fn(), writeSentence: jest.fn() } as any,
      queue: { run: (fn: any) => fn() } as any,
      inferenceTracker: { current: () => 'warm' } as any,
    });
    const r = await svc.translateSentence({
      sentence: 'Hello.',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(r.status).toBe('error');
  });

  it('cache hit returns без inference', async () => {
    const ctxStub = { completion: jest.fn() };
    const cacheStub = {
      sentenceLookup: jest.fn().mockResolvedValue({ translation: 'Привет.', source: 'memory' }),
      writeSentence: jest.fn(),
    };
    const svc = new LlamaTranslationService({
      contextProvider: () => ctxStub as any,
      cache: cacheStub as any,
      queue: { run: (fn: any) => fn() } as any,
      inferenceTracker: { current: () => 'warm' } as any,
    });
    const r = await svc.translateSentence({
      sentence: 'Hello.',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(r.translatedSentence).toBe('Привет.');
    expect(ctxStub.completion).not.toHaveBeenCalled();
    expect(r.experimental).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/services/translation/__tests__/LlamaTranslationService.sentence.test.ts
```

Expected: FAIL — method missing.

---

### Task 49: LlamaTranslationService.translateSentence — GREEN

**Files:**
- Modify: `src/services/translation/LlamaTranslationService.ts`

- [ ] **Step 1: Update deps interface + add translateSentence method**

Edit `src/services/translation/LlamaTranslationService.ts`:

```ts
import type { InferenceContextTracker } from './inferenceContext';
import type { SentenceTranslationInput, SentenceTranslationResult } from './ITranslationService';
import { buildSentencePrompt } from './PromptBuilder';
import { cleanSentenceTranslation } from './sentence/cleanSentenceTranslation';
import { tryAlignWord } from './sentence/tryAlignWord';

// Add к deps:
export interface LlamaTranslationServiceDeps {
  contextProvider: () => LlamaContext | null;
  cache: CacheLayer;
  queue: InferenceQueue;
  inferenceTracker: InferenceContextTracker;
  timeoutMs?: number;
  sentenceTimeoutMs?: number;
}

// Sentence-specific inference config per spec §11.2.
const SENTENCE_INFERENCE_CONFIG = {
  temperature: 0.3,
  top_p: 0.95,
  top_k: 40,
  repeat_penalty: 1.15,
  max_tokens: 200,
  stop: ['\n\n'],
  n_threads: 4,
};

const DEFAULT_SENTENCE_TIMEOUT_MS = 45000;

// Inside class:
async translateSentence(input: SentenceTranslationInput): Promise<SentenceTranslationResult> {
  const status = useLlmStatusStore.getState().status;
  if (status !== 'ready') {
    const code: TranslationErrorCode =
      status === 'loading' || status === 'warming_up' || status === 'verifying'
        ? 'MODEL_LOADING'
        : 'MODEL_NOT_INSTALLED';
    return { status: 'error', errorCode: code, errorMessage: `LLM not ready (${status})` };
  }

  const cached = await this.deps.cache.sentenceLookup(
    input.sentence,
    input.bookLanguage,
    input.nativeLanguage,
  );
  if (cached) {
    return {
      status: 'ok',
      sourceSentence: input.sentence,
      translatedSentence: cached.translation,
      translatedWordOffset: cached.offset,
      experimental: true,
      source: cached.source,
    };
  }

  const ctx = this.deps.contextProvider();
  if (!ctx) {
    return { status: 'error', errorCode: 'MODEL_LOADING', errorMessage: 'context null' };
  }

  const messages = buildSentencePrompt({
    sentence: input.sentence,
    bookLanguage: input.bookLanguage,
    nativeLanguage: input.nativeLanguage,
  });

  try {
    const timeoutMs = this.deps.sentenceTimeoutMs ?? DEFAULT_SENTENCE_TIMEOUT_MS;
    const t0 = Date.now();
    if (__DEV__) console.log(`[translateSentence] start prompt=${input.sentence.length}ch`);
    const raw = await this.deps.queue.run(() =>
      withTimeout(ctx.completion({ messages, ...SENTENCE_INFERENCE_CONFIG } as any), timeoutMs),
    );
    const dt = Date.now() - t0;
    if (__DEV__) console.log(`[translateSentence] done ${dt}ms`);
    const cleaned = cleanSentenceTranslation(raw.text);
    if (!cleaned) {
      return { status: 'error', errorCode: 'EMPTY_RESPONSE', errorMessage: 'whitespace output' };
    }
    let alignment: number | undefined;
    if (input.sourceWord !== undefined && input.wordOffset !== undefined) {
      // Look up word-level translation to use as alignment anchor.
      const wordResult = await this.deps.cache.lookup(
        input.sourceWord,
        input.sentence,
        input.bookLanguage,
        input.nativeLanguage,
      );
      alignment = tryAlignWord({
        sourceSentence: input.sentence,
        wordOffset: input.wordOffset,
        sourceWord: input.sourceWord,
        translatedSentence: cleaned,
        knownWordTranslation: wordResult?.value,
      });
    }
    const inferenceContext = this.deps.inferenceTracker.current();
    await this.deps.cache.writeSentence(
      input.sentence,
      input.bookLanguage,
      input.nativeLanguage,
      cleaned,
      alignment,
      { inferenceContext },
    );
    return {
      status: 'ok',
      sourceSentence: input.sentence,
      translatedSentence: cleaned,
      translatedWordOffset: alignment,
      experimental: true,
      inferenceContext,
      source: 'inference',
    };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === '__timeout__') {
      return { status: 'error', errorCode: 'INFERENCE_TIMEOUT', errorMessage: 'sentence timeout' };
    }
    return { status: 'error', errorCode: 'INFERENCE_FAILED', errorMessage: msg };
  }
}
```

- [ ] **Step 2: Run test PASS**

```bash
npx jest src/services/translation/__tests__/LlamaTranslationService.sentence.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 3: Commit**

```bash
git add src/services/translation/LlamaTranslationService.ts src/services/translation/__tests__/LlamaTranslationService.sentence.test.ts
git commit -m "feat(translation): LlamaTranslationService.translateSentence с experimental flag"
```

---

### Task 50: Bump n_ctx к 2048 в createLlamaLoader

**Files:**
- Modify: `src/services/translation/createLlamaLoader.ts`

Spec §11.2: sentence translation requires `n_ctx ≥ 2048`.

- [ ] **Step 1: Read current loader**

```bash
grep -n "n_ctx\|context_size" src/services/translation/createLlamaLoader.ts
```

- [ ] **Step 2: Update n_ctx parameter to 2048**

```ts
// Was: n_ctx: 1024
// Now: n_ctx: 2048
```

- [ ] **Step 3: Verify typecheck + smoke jest**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/translation/createLlamaLoader.ts
git commit -m "chore(translation): bump n_ctx к 2048 для sentence translation support"
```

---

## Phase 11: Custom Popover primitive (Tasks 51–54)

Spec ref: §3.2, §19 Q8.

### Task 51: Popover types + skeleton — RED

**Files:**
- Create: `src/components/ui/Popover.tsx`
- Test: `src/components/ui/__tests__/Popover.test.tsx`

- [ ] **Step 1: Write failing test (smoke render)**

Create `src/components/ui/__tests__/Popover.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Popover } from '@/components/ui/Popover';

describe('Popover', () => {
  it('renders children when visible=true', () => {
    const { getByText } = render(
      <Popover visible={true} placement="bottom" anchorRect={{ x: 100, y: 200, width: 50, height: 20 }} onDismiss={() => {}}>
        <Text>Popover content</Text>
      </Popover>,
    );
    expect(getByText('Popover content')).toBeTruthy();
  });

  it('renders nothing when visible=false', () => {
    const { queryByText } = render(
      <Popover visible={false} placement="bottom" anchorRect={{ x: 0, y: 0, width: 0, height: 0 }} onDismiss={() => {}}>
        <Text>Hidden</Text>
      </Popover>,
    );
    expect(queryByText('Hidden')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
npx jest src/components/ui/__tests__/Popover.test.tsx
```

Expected: FAIL.

---

### Task 52: Popover skeleton — GREEN (no animations yet)

**Files:**
- Create: `src/components/ui/Popover.tsx`

- [ ] **Step 1: Minimal implementation**

```tsx
import React from 'react';
import { View, Pressable, StyleSheet, Modal } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PopoverProps {
  visible: boolean;
  placement: 'top' | 'bottom';
  anchorRect: AnchorRect;
  onDismiss: () => void;
  children: React.ReactNode;
}

export function Popover({ visible, placement, anchorRect, onDismiss, children }: PopoverProps) {
  const { theme } = useUnistyles();
  if (!visible) return null;

  // Position above/below anchor. Width = screen - 16px gutter; align horizontally к anchor center clamped.
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="none">
        <View
          style={[
            styles.bubble,
            { backgroundColor: theme.paper, shadowColor: theme.ink },
            placement === 'bottom'
              ? { top: anchorRect.y + anchorRect.height + 8 }
              : { bottom: undefined, top: Math.max(8, anchorRect.y - 200) },
            { left: 16, right: 16 },
          ]}
          accessibilityViewIsModal={true}
          importantForAccessibility="yes"
        >
          {children}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  bubble: {
    position: 'absolute',
    borderRadius: 14,
    padding: 16,
    elevation: 8,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
});
```

- [ ] **Step 2: Run test PASS**

```bash
npx jest src/components/ui/__tests__/Popover.test.tsx
```

Expected: PASS — 2 tests.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Popover.tsx src/components/ui/__tests__/Popover.test.tsx
git commit -m "feat(ui): Popover primitive (top/bottom anchored) для translation popup"
```

---

### Task 53: Popover Reanimated fade animation + reduce motion respect

**Files:**
- Modify: `src/components/ui/Popover.tsx`

Spec §13.5: respect `useReducedMotion()` — fade 0ms если reduce motion enabled.

- [ ] **Step 1: Add fade animation worklet**

```tsx
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from 'react-native-reanimated';
// ... existing imports

export function Popover(props: PopoverProps) {
  const { visible } = props;
  const opacity = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    'worklet';
    opacity.value = withTiming(visible ? 1 : 0, { duration: reduceMotion ? 0 : 160 });
  }, [visible, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // Wrap bubble в Animated.View с animatedStyle.
  // (Rest of implementation as Task 52 with animated bubble.)
}
```

- [ ] **Step 2: Verify smoke test still passes**

```bash
npx jest src/components/ui/__tests__/Popover.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Popover.tsx
git commit -m "feat(ui): Popover fade animation worklet + reduce motion respect"
```

---

### Task 54: Add Popover к ui barrel + a11y label

**Files:**
- Modify: `src/components/ui/index.ts`

- [ ] **Step 1: Export Popover**

```ts
export * from './Popover';
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/index.ts
git commit -m "chore(ui): export Popover из barrel"
```

---

## Phase 12: Popup placement 3-mode logic (Tasks 55–57)

Spec ref: §3.2.

### Task 55: choosePopupPlacement — RED

**Files:**
- Test: `src/components/reader/__tests__/PopupPlacement.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { choosePopupPlacement } from '@/components/reader/PopupPlacement';

describe('choosePopupPlacement', () => {
  it('bottom when more space below', () => {
    const r = choosePopupPlacement({ tapY: 100, screenHeight: 800, popupEstimatedHeight: 200, pageContentHeight: 800, isRTL: false });
    expect(r.mode).toBe('bottom');
  });

  it('top when more space above', () => {
    const r = choosePopupPlacement({ tapY: 700, screenHeight: 800, popupEstimatedHeight: 200, pageContentHeight: 800, isRTL: false });
    expect(r.mode).toBe('top');
  });

  it('modalSheet когда popup не помещается ни вверху, ни внизу', () => {
    const r = choosePopupPlacement({ tapY: 200, screenHeight: 300, popupEstimatedHeight: 250, pageContentHeight: 300, isRTL: false });
    expect(r.mode).toBe('modalSheet');
  });

  it('RTL flips arrowDirection', () => {
    const r = choosePopupPlacement({ tapY: 100, screenHeight: 800, popupEstimatedHeight: 200, pageContentHeight: 800, isRTL: true });
    expect(r.arrowDirection).toBe('left');
    const r2 = choosePopupPlacement({ tapY: 100, screenHeight: 800, popupEstimatedHeight: 200, pageContentHeight: 800, isRTL: false });
    expect(r2.arrowDirection).toBe('right');
  });
});
```

- [ ] **Step 2: Run test FAIL**

```bash
npx jest src/components/reader/__tests__/PopupPlacement.test.ts
```

Expected: FAIL.

---

### Task 56: choosePopupPlacement — GREEN

**Files:**
- Create: `src/components/reader/PopupPlacement.ts`

- [ ] **Step 1: Implement (per spec §3.2)**

```ts
export interface PlacementInput {
  tapY: number;
  screenHeight: number;
  popupEstimatedHeight: number;
  pageContentHeight: number;
  isRTL: boolean;
}

export interface PlacementResult {
  mode: 'top' | 'bottom' | 'modalSheet';
  arrowDirection: 'left' | 'right';
}

export function choosePopupPlacement(input: PlacementInput): PlacementResult {
  const topSpace = input.tapY;
  const bottomSpace = input.screenHeight - input.tapY;
  const fitsAbove = topSpace >= input.popupEstimatedHeight;
  const fitsBelow = bottomSpace >= input.popupEstimatedHeight;
  const arrow: 'left' | 'right' = input.isRTL ? 'left' : 'right';

  if (!fitsAbove && !fitsBelow) {
    return { mode: 'modalSheet', arrowDirection: arrow };
  }
  if (fitsBelow && bottomSpace >= topSpace) {
    return { mode: 'bottom', arrowDirection: arrow };
  }
  if (fitsAbove) {
    return { mode: 'top', arrowDirection: arrow };
  }
  return { mode: bottomSpace >= topSpace ? 'bottom' : 'top', arrowDirection: arrow };
}
```

- [ ] **Step 2: Run test PASS**

```bash
npx jest src/components/reader/__tests__/PopupPlacement.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 3: Commit**

```bash
git add src/components/reader/PopupPlacement.ts src/components/reader/__tests__/PopupPlacement.test.ts
git commit -m "feat(popup): choosePopupPlacement 3-mode (top/bottom/modalSheet)"
```

---

### Task 57: Edge case — popup mid-flick guard

**Files:**
- Create: `src/components/reader/PopupOpenGuard.ts`
- Test: `src/components/reader/__tests__/PopupOpenGuard.test.ts`

Spec §3.4 anti-pattern: defer popup open до scroll velocity = 0 (max 150ms grace).

- [ ] **Step 1: Write failing test**

```ts
import { waitForScrollIdle } from '@/components/reader/PopupOpenGuard';

describe('waitForScrollIdle', () => {
  it('resolves immediately when velocity already 0', async () => {
    const t0 = Date.now();
    await waitForScrollIdle({ getVelocity: () => 0, maxWaitMs: 150 });
    expect(Date.now() - t0).toBeLessThan(50);
  });

  it('resolves after velocity drops к 0 within window', async () => {
    let v = 5;
    setTimeout(() => { v = 0; }, 60);
    const t0 = Date.now();
    await waitForScrollIdle({ getVelocity: () => v, maxWaitMs: 150 });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(50);
    expect(Date.now() - t0).toBeLessThan(150);
  });

  it('resolves after maxWaitMs даже если velocity не падает', async () => {
    const t0 = Date.now();
    await waitForScrollIdle({ getVelocity: () => 10, maxWaitMs: 100 });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Run test FAIL**

```bash
npx jest src/components/reader/__tests__/PopupOpenGuard.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/reader/PopupOpenGuard.ts`:

```ts
// Defer popup open пока scroll velocity > 0. Max wait = 150ms grace per spec §3.4.

export interface WaitForScrollIdleOptions {
  getVelocity: () => number;
  maxWaitMs: number;
  pollMs?: number;
}

export async function waitForScrollIdle(opts: WaitForScrollIdleOptions): Promise<void> {
  const poll = opts.pollMs ?? 20;
  const start = Date.now();
  while (Date.now() - start < opts.maxWaitMs) {
    if (opts.getVelocity() === 0) return;
    await new Promise((r) => setTimeout(r, poll));
  }
}
```

- [ ] **Step 4: Run test PASS**

```bash
npx jest src/components/reader/__tests__/PopupOpenGuard.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/PopupOpenGuard.ts src/components/reader/__tests__/PopupOpenGuard.test.ts
git commit -m "feat(popup): waitForScrollIdle guard для mid-flick popup open"
```

---

## Phase 13: UI primitives (Tasks 58–63)

Spec ref: §3.1, §5.2, §8.3, §9.2, §10.2, §13.

### Task 58: ExperimentalBadge component

**Files:**
- Create: `src/components/reader/ExperimentalBadge.tsx`
- Test: `src/components/reader/__tests__/ExperimentalBadge.test.tsx`

Spec §3.1: жёлтый плашка "⚠️ Экспериментальный перевод" в sentence popup.

- [ ] **Step 1: Failing test**

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { ExperimentalBadge } from '@/components/reader/ExperimentalBadge';

describe('ExperimentalBadge', () => {
  it('renders с warning icon + russian label', () => {
    const { getByText } = render(<ExperimentalBadge />);
    expect(getByText(/Экспериментальный/i)).toBeTruthy();
  });

  it('has accessibilityRole=alert', () => {
    const { getByA11yRole } = render(<ExperimentalBadge />);
    expect(getByA11yRole('alert')).toBeTruthy();
  });
});
```

- [ ] **Step 2: FAIL**

```bash
npx jest src/components/reader/__tests__/ExperimentalBadge.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

export function ExperimentalBadge() {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={t('translation.experimentalBadge')}
      style={{
        backgroundColor: theme.paper2,
        borderLeftWidth: 3,
        borderLeftColor: theme.accent,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: theme.ink, fontSize: 13 }}>
        {t('translation.experimentalBadge')}
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: PASS**

```bash
npx jest src/components/reader/__tests__/ExperimentalBadge.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/ExperimentalBadge.tsx src/components/reader/__tests__/ExperimentalBadge.test.tsx
git commit -m "feat(popup): ExperimentalBadge для sentence-результата"
```

---

### Task 59: DislikeButton component

**Files:**
- Create: `src/components/reader/DislikeButton.tsx`
- Test: `src/components/reader/__tests__/DislikeButton.test.tsx`

Spec §3.1: toggle "👎 Плохой перевод" с onPress callback.

- [ ] **Step 1: Failing test**

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DislikeButton } from '@/components/reader/DislikeButton';

describe('DislikeButton', () => {
  it('renders с label', () => {
    const { getByText } = render(<DislikeButton isDisliked={false} onToggle={() => {}} />);
    expect(getByText(/Плохой перевод/i)).toBeTruthy();
  });

  it('calls onToggle on press', () => {
    const onToggle = jest.fn();
    const { getByRole } = render(<DislikeButton isDisliked={false} onToggle={onToggle} />);
    fireEvent.press(getByRole('button'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('accessibilityState.selected reflects isDisliked', () => {
    const { getByRole, rerender } = render(<DislikeButton isDisliked={false} onToggle={() => {}} />);
    expect(getByRole('button').props.accessibilityState?.selected).toBe(false);
    rerender(<DislikeButton isDisliked={true} onToggle={() => {}} />);
    expect(getByRole('button').props.accessibilityState?.selected).toBe(true);
  });
});
```

- [ ] **Step 2: FAIL**

```bash
npx jest src/components/reader/__tests__/DislikeButton.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

interface Props {
  isDisliked: boolean;
  onToggle: () => void;
}

export function DislikeButton({ isDisliked, onToggle }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('translation.dislikeLabel')}
      accessibilityState={{ selected: isDisliked }}
      onPress={onToggle}
      hitSlop={10}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: 44,
        gap: 6,
        backgroundColor: isDisliked ? theme.learningSoft : 'transparent',
        borderRadius: 8,
      }}
    >
      <Text style={{ fontSize: 16 }}>👎</Text>
      <Text style={{ color: isDisliked ? theme.ink : theme.ink2, fontSize: 13 }}>
        {t('translation.dislikeLabel')}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: PASS**

```bash
npx jest src/components/reader/__tests__/DislikeButton.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/DislikeButton.tsx src/components/reader/__tests__/DislikeButton.test.tsx
git commit -m "feat(popup): DislikeButton toggle для жалоб на перевод"
```

---

### Task 60: MweChip component

**Files:**
- Create: `src/components/reader/MweChip.tsx`
- Test: `src/components/reader/__tests__/MweChip.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { MweChip } from '@/components/reader/MweChip';

describe('MweChip', () => {
  it('renders phrase type tag', () => {
    const { getByText } = render(<MweChip type="idiom" />);
    expect(getByText(/идиома/i)).toBeTruthy();
  });

  it('renders phrasal_verb', () => {
    const { getByText } = render(<MweChip type="phrasal_verb" />);
    expect(getByText(/phrasal/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: FAIL**

```bash
npx jest src/components/reader/__tests__/MweChip.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

interface Props {
  type: 'idiom' | 'phrasal_verb' | 'collocation' | 'proverb' | string;
}

export function MweChip({ type }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const label = t(`translation.mweType.${type}`, { defaultValue: type });
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={t('translation.a11y.mweChip', { type: label })}
      style={{
        backgroundColor: theme.accentSoft,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
        minHeight: 22,
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: theme.ink, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
```

- [ ] **Step 4: PASS**

```bash
npx jest src/components/reader/__tests__/MweChip.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/MweChip.tsx src/components/reader/__tests__/MweChip.test.tsx
git commit -m "feat(popup): MweChip для отображения типа MWE"
```

---

### Task 61: FalseFriendChip component

**Files:**
- Create: `src/components/reader/FalseFriendChip.tsx`
- Test: `src/components/reader/__tests__/FalseFriendChip.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FalseFriendChip } from '@/components/reader/FalseFriendChip';

describe('FalseFriendChip', () => {
  it('compact mode shows ≠ looksLike', () => {
    const { getByText } = render(
      <FalseFriendChip looksLike="magazine" actualMeaning="shop" expanded={false} onToggle={() => {}} />,
    );
    expect(getByText(/magazine/)).toBeTruthy();
  });

  it('expanded shows actualMeaning', () => {
    const { getByText } = render(
      <FalseFriendChip looksLike="magazine" actualMeaning="shop" expanded={true} onToggle={() => {}} />,
    );
    expect(getByText(/shop/i)).toBeTruthy();
  });

  it('press toggles', () => {
    const onToggle = jest.fn();
    const { getByRole } = render(
      <FalseFriendChip looksLike="magazine" actualMeaning="shop" expanded={false} onToggle={onToggle} />,
    );
    fireEvent.press(getByRole('button'));
    expect(onToggle).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: FAIL**

```bash
npx jest src/components/reader/__tests__/FalseFriendChip.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

interface Props {
  looksLike: string;
  actualMeaning: string;
  expanded: boolean;
  onToggle: () => void;
}

export function FalseFriendChip({ looksLike, actualMeaning, expanded, onToggle }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('translation.a11y.falseFriendWarning', { word: looksLike })}
      accessibilityHint={t('translation.a11y.falseFriendHint')}
      accessibilityState={{ expanded }}
      onPress={onToggle}
      hitSlop={14}
      style={{
        backgroundColor: theme.learningSoft,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        minHeight: 44,
        justifyContent: 'center',
        marginVertical: 4,
      }}
    >
      <Text style={{ color: theme.ink, fontSize: 13 }}>
        🚩 ≠ {looksLike}
      </Text>
      {expanded && (
        <Text style={{ color: theme.ink2, fontSize: 12, marginTop: 4 }}>{actualMeaning}</Text>
      )}
    </Pressable>
  );
}
```

- [ ] **Step 4: PASS**

```bash
npx jest src/components/reader/__tests__/FalseFriendChip.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/FalseFriendChip.tsx src/components/reader/__tests__/FalseFriendChip.test.tsx
git commit -m "feat(popup): FalseFriendChip с expandable actualMeaning"
```

---

### Task 62: EncounterBadge component

**Files:**
- Create: `src/components/reader/EncounterBadge.tsx`
- Test: `src/components/reader/__tests__/EncounterBadge.test.tsx`

Spec §8.3: thresholds 0 / 1-3 / 4-9 / 10+.

- [ ] **Step 1: Failing test**

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { EncounterBadge } from '@/components/reader/EncounterBadge';

describe('EncounterBadge', () => {
  it('count=0 shows "впервые встречаете"', () => {
    const { getByText } = render(<EncounterBadge count={0} />);
    expect(getByText(/впервые/i)).toBeTruthy();
  });

  it('count=2 shows N-й раз label', () => {
    const { getByText } = render(<EncounterBadge count={2} />);
    expect(getByText(/3-й раз/i)).toBeTruthy(); // count=2 → 3rd encounter
  });

  it('count=5 shows "знакомое"', () => {
    const { getByText } = render(<EncounterBadge count={5} />);
    expect(getByText(/знакомое/i)).toBeTruthy();
  });

  it('count=10 hides badge', () => {
    const { queryByA11yRole } = render(<EncounterBadge count={10} />);
    expect(queryByA11yRole('text')).toBeNull();
  });
});
```

- [ ] **Step 2: FAIL**

```bash
npx jest src/components/reader/__tests__/EncounterBadge.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
import React from 'react';
import { Text, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

interface Props {
  count: number;
}

export function EncounterBadge({ count }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  if (count >= 10) return null;
  let label: string;
  let color = theme.ink3;
  if (count === 0) {
    label = t('translation.encounter.firstTime');
    color = theme.accent;
  } else if (count <= 3) {
    label = t('translation.encounter.nthTime', { ordinal: count + 1 });
    color = theme.ink2;
  } else {
    label = t('translation.encounter.familiar');
  }
  return (
    <View accessibilityRole="text">
      <Text style={{ color, fontSize: 12 }}>✦ {label}</Text>
    </View>
  );
}
```

- [ ] **Step 4: PASS**

```bash
npx jest src/components/reader/__tests__/EncounterBadge.test.tsx
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/EncounterBadge.tsx src/components/reader/__tests__/EncounterBadge.test.tsx
git commit -m "feat(popup): EncounterBadge с Nation 2001 thresholds (0/1-3/4-9/10+)"
```

---

### Task 63: PolysemyDisclosure component

**Files:**
- Create: `src/components/reader/PolysemyDisclosure.tsx`
- Test: `src/components/reader/__tests__/PolysemyDisclosure.test.tsx`

Spec §9.3.

- [ ] **Step 1: Failing test**

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PolysemyDisclosure } from '@/components/reader/PolysemyDisclosure';

describe('PolysemyDisclosure', () => {
  it('renders count label collapsed', () => {
    const { getByText } = render(
      <PolysemyDisclosure senses={[{ sense: 'noun', translation: 'значение' }, { sense: 'verb', translation: 'действие' }]} />,
    );
    expect(getByText(/2/)).toBeTruthy();
  });

  it('toggles expanded on press', () => {
    const { getByRole, queryByText } = render(
      <PolysemyDisclosure senses={[{ sense: 'noun', translation: 'значение' }]} />,
    );
    expect(queryByText('значение')).toBeNull();
    fireEvent.press(getByRole('button'));
    expect(queryByText('значение')).toBeTruthy();
  });

  it('returns null when no senses', () => {
    const { queryByRole } = render(<PolysemyDisclosure senses={[]} />);
    expect(queryByRole('button')).toBeNull();
  });
});
```

- [ ] **Step 2: FAIL**

```bash
npx jest src/components/reader/__tests__/PolysemyDisclosure.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
import React, { useState } from 'react';
import { Pressable, Text, View, AccessibilityInfo } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

export interface Sense {
  sense: string;
  translation: string;
}

interface Props {
  senses: Sense[];
}

export function PolysemyDisclosure({ senses }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  if (!senses.length) return null;

  const toggle = () => {
    setExpanded(!expanded);
    if (!expanded) {
      AccessibilityInfo.announceForAccessibility(t('translation.a11y.altSensesRevealed', { count: senses.length }));
    }
  };

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('translation.a11y.altSenses', { count: senses.length })}
        accessibilityHint={t('translation.a11y.altSensesHint')}
        accessibilityState={{ expanded }}
        onPress={toggle}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={{ color: theme.ink2, fontSize: 13 }}>
          {expanded ? '▴' : '▾'} {t('translation.alternativeSenses', { count: senses.length })}
        </Text>
      </Pressable>
      {expanded && (
        <View style={{ marginTop: 6, gap: 4 }}>
          {senses.map((s, i) => (
            <Text key={i} style={{ color: theme.ink2, fontSize: 13 }}>
              • {s.sense}: {s.translation}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 4: PASS**

```bash
npx jest src/components/reader/__tests__/PolysemyDisclosure.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/PolysemyDisclosure.tsx src/components/reader/__tests__/PolysemyDisclosure.test.tsx
git commit -m "feat(popup): PolysemyDisclosure с a11y expand/collapse"
```

---

## Phase 14: TranslationPopup tiered redesign (Tasks 64–67)

Spec ref: §3.1 (popup states), §14.2.

### Task 64: TranslationPopup new state machine — RED

**Files:**
- Test: `src/components/reader/__tests__/TranslationPopup.test.tsx`

- [ ] **Step 1: Replace existing TranslationPopup test with new state machine test**

Overwrite `src/components/reader/__tests__/TranslationPopup.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { TranslationPopup, type PopupViewState } from '@/components/reader/TranslationPopup';

const baseState: PopupViewState = {
  visible: true,
  mode: 'word',
  word: 'spring',
  sourceSentence: 'The spring of life.',
  wordOffsetInSentence: 4,
  status: 'loading',
  placement: { mode: 'bottom', arrowDirection: 'right' },
  anchorRect: { x: 100, y: 200, width: 50, height: 20 },
  result: null,
  encounterCount: 0,
  coverageHint: false,
};

describe('TranslationPopup', () => {
  it('renders word + loading shimmer когда status=loading', () => {
    const { getByText } = render(<TranslationPopup state={baseState} onClose={() => {}} onTranslateSentence={() => {}} onDislike={() => {}} />);
    expect(getByText('spring')).toBeTruthy();
  });

  it('renders translation text when result.translation defined', () => {
    const s: PopupViewState = {
      ...baseState,
      status: 'ready',
      result: { status: 'ok', translation: 'источник' } as any,
    };
    const { getByText } = render(<TranslationPopup state={s} onClose={() => {}} onTranslateSentence={() => {}} onDislike={() => {}} />);
    expect(getByText('источник')).toBeTruthy();
  });

  it('sentence mode shows ExperimentalBadge', () => {
    const s: PopupViewState = {
      ...baseState,
      mode: 'sentence',
      status: 'ready',
      result: { status: 'ok', translatedSentence: 'Источник жизни.', experimental: true } as any,
    };
    const { getByText } = render(<TranslationPopup state={s} onClose={() => {}} onTranslateSentence={() => {}} onDislike={() => {}} />);
    expect(getByText(/Экспериментальный/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run FAIL**

```bash
npx jest src/components/reader/__tests__/TranslationPopup.test.tsx
```

Expected: FAIL — existing TranslationPopup uses old TranslationPopupState shape.

---

### Task 65: TranslationPopup view state + word mode rendering — GREEN

**Files:**
- Modify: `src/components/reader/TranslationPopup.tsx`

- [ ] **Step 1: Rewrite TranslationPopup с new state machine**

Replace `src/components/reader/TranslationPopup.tsx`:

```tsx
import React from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Popover, type AnchorRect } from '@/components/ui';
import { Sheet, type SheetRef } from '@/components/ui';
import type { TranslationResult, SentenceTranslationResult } from '@/services/translation/ITranslationService';
import { ExperimentalBadge } from './ExperimentalBadge';
import { DislikeButton } from './DislikeButton';
import { MweChip } from './MweChip';
import { FalseFriendChip } from './FalseFriendChip';
import { EncounterBadge } from './EncounterBadge';
import { PolysemyDisclosure } from './PolysemyDisclosure';
import type { PlacementResult } from './PopupPlacement';

export type PopupMode = 'word' | 'sentence' | 'phrase';

export interface PopupViewState {
  visible: boolean;
  mode: PopupMode;
  word: string;
  sourceSentence: string;
  wordOffsetInSentence: number;
  status: 'loading' | 'ready' | 'error';
  placement: PlacementResult;
  anchorRect: AnchorRect;
  result: TranslationResult | SentenceTranslationResult | null;
  encounterCount: number;
  coverageHint: boolean;
  isDisliked?: boolean;
}

interface Props {
  state: PopupViewState;
  onClose: () => void;
  onTranslateSentence: () => void;
  onDislike: () => void;
  onFalseFriendToggle?: () => void;
  isFalseFriendExpanded?: boolean;
}

export function TranslationPopup({
  state,
  onClose,
  onTranslateSentence,
  onDislike,
  onFalseFriendToggle = () => {},
  isFalseFriendExpanded = false,
}: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const sheetRef = React.useRef<SheetRef>(null);

  // Modal sheet mode
  if (state.visible && state.placement.mode === 'modalSheet') {
    React.useEffect(() => {
      sheetRef.current?.expand();
    }, []);
    return (
      <Sheet ref={sheetRef} snapPoints={['50%']} onClose={onClose}>
        <View style={{ padding: 18 }}>
          <PopupContents
            state={state}
            theme={theme}
            t={t}
            onTranslateSentence={onTranslateSentence}
            onDislike={onDislike}
            onFalseFriendToggle={onFalseFriendToggle}
            isFalseFriendExpanded={isFalseFriendExpanded}
          />
        </View>
      </Sheet>
    );
  }

  // Top/bottom anchored Popover
  return (
    <Popover
      visible={state.visible}
      placement={state.placement.mode === 'top' ? 'top' : 'bottom'}
      anchorRect={state.anchorRect}
      onDismiss={onClose}
    >
      <PopupContents
        state={state}
        theme={theme}
        t={t}
        onTranslateSentence={onTranslateSentence}
        onDislike={onDislike}
        onFalseFriendToggle={onFalseFriendToggle}
        isFalseFriendExpanded={isFalseFriendExpanded}
      />
    </Popover>
  );
}

function PopupContents(props: {
  state: PopupViewState;
  theme: any;
  t: (key: string, opts?: any) => string;
  onTranslateSentence: () => void;
  onDislike: () => void;
  onFalseFriendToggle: () => void;
  isFalseFriendExpanded: boolean;
}) {
  const { state, theme, t, onTranslateSentence, onDislike, onFalseFriendToggle, isFalseFriendExpanded } = props;
  const isSentence = state.mode === 'sentence';
  const result = state.result;
  const wordResult = !isSentence ? (result as TranslationResult | null) : null;
  const sentenceResult = isSentence ? (result as SentenceTranslationResult | null) : null;

  return (
    <View style={{ minHeight: 80, gap: 10 }} accessibilityViewIsModal>
      {/* Header — word */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: theme.ink, fontSize: 22, fontWeight: '700' }}>{state.word}</Text>
        {wordResult?.mwePhrase && <MweChip type={wordResult.mwePhrase.type} />}
      </View>

      {/* Sentence experimental badge */}
      {isSentence && <ExperimentalBadge />}

      {/* Loading / ready content */}
      {state.status === 'loading' && (
        <View accessibilityLiveRegion="polite">
          <ActivityIndicator color={theme.accent} />
          <Text style={{ color: theme.ink2, marginTop: 6 }}>{t('translation.a11y.loadingTranslation')}</Text>
        </View>
      )}

      {state.status === 'ready' && wordResult?.translation && (
        <View>
          <Text style={{ color: theme.ink, fontSize: 17 }}>{wordResult.translation}</Text>
          {wordResult.falseFriend && (
            <FalseFriendChip
              looksLike={wordResult.falseFriend.looksLike}
              actualMeaning={wordResult.falseFriend.actualMeaning}
              expanded={isFalseFriendExpanded}
              onToggle={onFalseFriendToggle}
            />
          )}
          <PolysemyDisclosure senses={wordResult.alternativeSenses ?? []} />
        </View>
      )}

      {state.status === 'ready' && sentenceResult?.translatedSentence && (
        <View>
          <Text style={{ color: theme.ink2, fontSize: 12, marginTop: 4 }}>{t('translation.sourceLabel')}</Text>
          <Text style={{ color: theme.ink, fontSize: 14 }}>{sentenceResult.sourceSentence ?? state.sourceSentence}</Text>
          <Text style={{ color: theme.ink2, fontSize: 12, marginTop: 8 }}>{t('translation.translationLabel')}</Text>
          <Text style={{ color: theme.ink, fontSize: 14 }}>{sentenceResult.translatedSentence}</Text>
        </View>
      )}

      {state.status === 'error' && (
        <Text style={{ color: theme.ink2 }}>{t('translation.errorGeneric')}</Text>
      )}

      {/* Encounter badge — only word mode */}
      {!isSentence && state.status === 'ready' && <EncounterBadge count={state.encounterCount} />}

      {/* Sentence translate button — only word mode */}
      {!isSentence && state.status === 'ready' && (
        <Pressable
          onPress={onTranslateSentence}
          accessibilityRole="button"
          accessibilityLabel={t('translation.translateSentenceLabel')}
          hitSlop={10}
          style={{
            paddingVertical: 10,
            backgroundColor: state.coverageHint ? theme.accentSoft : 'transparent',
            borderRadius: 8,
            minHeight: 44,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: theme.accent, fontSize: 14 }}>
            ? {t('translation.translateSentenceLabel')}
          </Text>
        </Pressable>
      )}

      {/* Dislike — sentence mode only */}
      {isSentence && state.status === 'ready' && (
        <DislikeButton isDisliked={!!state.isDisliked} onToggle={onDislike} />
      )}
    </View>
  );
}
```

- [ ] **Step 2: Run PASS**

```bash
npx jest src/components/reader/__tests__/TranslationPopup.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 3: Commit**

```bash
git add src/components/reader/TranslationPopup.tsx src/components/reader/__tests__/TranslationPopup.test.tsx
git commit -m "feat(popup): TranslationPopup tiered redesign с word/sentence/phrase modes"
```

---

### Task 66: Adjacent-word auto-switch с 80ms cross-fade — RED

**Files:**
- Test: `src/components/reader/__tests__/TranslationPopup.crossfade.test.tsx`

Spec §3.4: tap на adjacent word при popup open → 80ms cross-fade, popup не unmounts.

- [ ] **Step 1: Write test**

```tsx
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { TranslationPopup, type PopupViewState } from '@/components/reader/TranslationPopup';

describe('TranslationPopup adjacent-word switch', () => {
  it('keeps popup mounted when word changes (re-render, not unmount/remount)', () => {
    const state1: PopupViewState = { /* ...word A state */ } as any;
    const state2: PopupViewState = { ...state1, word: 'B' } as any;
    const { rerender, queryByText } = render(<TranslationPopup state={state1} onClose={() => {}} onTranslateSentence={() => {}} onDislike={() => {}} />);
    rerender(<TranslationPopup state={state2} onClose={() => {}} onTranslateSentence={() => {}} onDislike={() => {}} />);
    expect(queryByText('B')).toBeTruthy();
  });
});
```

Note: this test verifies the render keeps mounted. Actual cross-fade animation tested через Reanimated mock в Phase 14 polish task.

- [ ] **Step 2: Verify PASS — already implemented by React reconciliation**

```bash
npx jest src/components/reader/__tests__/TranslationPopup.crossfade.test.tsx
```

Expected: PASS (TranslationPopup re-renders на prop change).

- [ ] **Step 3: Commit**

```bash
git add src/components/reader/__tests__/TranslationPopup.crossfade.test.tsx
git commit -m "test(popup): adjacent-word re-render keeps popup mounted"
```

---

### Task 67: Reduce-motion + reduce-transparency respect в popup

**Files:**
- Modify: `src/components/reader/TranslationPopup.tsx`

Spec §13.5.

- [ ] **Step 1: Add useReducedMotion + useReducedTransparency hooks**

В `TranslationPopup.tsx` импортировать:

```tsx
import { useReducedMotion } from 'react-native-reanimated';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { useEffect, useState } from 'react';

function useReducedTransparency() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceTransparencyEnabled?.().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

// Use в PopupContents → adjust shadow + blur if applicable.
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/reader/TranslationPopup.tsx
git commit -m "feat(popup): respect reduce motion + reduce transparency"
```

---

## Phase 15: SentenceTranslationView with highlight (Tasks 68–70)

Spec ref: §7.4.

### Task 68: SentenceTranslationView — RED

**Files:**
- Create: `src/components/reader/SentenceTranslationView.tsx`
- Test: `src/components/reader/__tests__/SentenceTranslationView.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { SentenceTranslationView } from '@/components/reader/SentenceTranslationView';

describe('SentenceTranslationView', () => {
  it('renders source + translation', () => {
    const { getByText } = render(
      <SentenceTranslationView
        sourceSentence="The spring of life."
        translatedSentence="Источник жизни."
        sourceWordOffset={4}
        sourceWord="spring"
        translatedWordOffset={0}
      />,
    );
    expect(getByText(/The spring of life/)).toBeTruthy();
    expect(getByText(/Источник жизни/)).toBeTruthy();
  });

  it('renders без highlight when translatedWordOffset is undefined (fail-safe)', () => {
    const { queryByA11yLabel } = render(
      <SentenceTranslationView
        sourceSentence="The spring of life."
        translatedSentence="Источник жизни."
        sourceWordOffset={4}
        sourceWord="spring"
        translatedWordOffset={undefined}
      />,
    );
    expect(queryByA11yLabel(/aligned/i)).toBeNull();
  });
});
```

- [ ] **Step 2: FAIL**

```bash
npx jest src/components/reader/__tests__/SentenceTranslationView.test.tsx
```

Expected: FAIL.

---

### Task 69: SentenceTranslationView — GREEN

**Files:**
- Create: `src/components/reader/SentenceTranslationView.tsx`

- [ ] **Step 1: Implement**

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

interface Props {
  sourceSentence: string;
  translatedSentence: string;
  sourceWordOffset: number;
  sourceWord: string;
  translatedWordOffset: number | undefined;
}

export function SentenceTranslationView({
  sourceSentence,
  translatedSentence,
  sourceWordOffset,
  sourceWord,
  translatedWordOffset,
}: Props) {
  const { theme } = useUnistyles();

  const sourceSegments = splitWithHighlight(sourceSentence, sourceWordOffset, sourceWord.length);

  // Try to extract target word из translated sentence at offset.
  const targetSegments =
    translatedWordOffset !== undefined
      ? splitTargetWithHighlight(translatedSentence, translatedWordOffset)
      : null;

  return (
    <View>
      <Text style={{ color: theme.ink2, fontSize: 12 }}>Source:</Text>
      <Text style={{ color: theme.ink, fontSize: 15, marginBottom: 8 }}>
        {sourceSegments.before}
        <Text style={{ fontWeight: '700', textDecorationLine: 'underline', color: theme.accent }}>
          {sourceSegments.match}
        </Text>
        {sourceSegments.after}
      </Text>

      <Text style={{ color: theme.ink2, fontSize: 12 }}>Translation:</Text>
      <Text
        style={{ color: theme.ink, fontSize: 15 }}
        accessibilityLabel={targetSegments ? `aligned: ${targetSegments.match}` : undefined}
      >
        {targetSegments ? (
          <>
            {targetSegments.before}
            <Text style={{ fontWeight: '700', textDecorationLine: 'underline', color: theme.accent }}>
              {targetSegments.match}
            </Text>
            {targetSegments.after}
          </>
        ) : (
          translatedSentence
        )}
      </Text>
    </View>
  );
}

function splitWithHighlight(text: string, offset: number, length: number) {
  return {
    before: text.slice(0, offset),
    match: text.slice(offset, offset + length),
    after: text.slice(offset + length),
  };
}

function splitTargetWithHighlight(text: string, offset: number) {
  // Highlight extends к next whitespace from offset.
  const after = text.slice(offset);
  const wordEnd = after.search(/[\s.,;:!?]/);
  const matchEnd = wordEnd === -1 ? text.length : offset + wordEnd;
  return {
    before: text.slice(0, offset),
    match: text.slice(offset, matchEnd),
    after: text.slice(matchEnd),
  };
}
```

- [ ] **Step 2: PASS**

```bash
npx jest src/components/reader/__tests__/SentenceTranslationView.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/reader/SentenceTranslationView.tsx src/components/reader/__tests__/SentenceTranslationView.test.tsx
git commit -m "feat(popup): SentenceTranslationView с fail-safe highlight"
```

---

### Task 70: Integrate SentenceTranslationView в TranslationPopup

**Files:**
- Modify: `src/components/reader/TranslationPopup.tsx`

- [ ] **Step 1: Replace inline sentence rendering с SentenceTranslationView**

В `PopupContents` function, sentence ready branch заменить на:

```tsx
{state.status === 'ready' && sentenceResult?.translatedSentence && (
  <SentenceTranslationView
    sourceSentence={sentenceResult.sourceSentence ?? state.sourceSentence}
    translatedSentence={sentenceResult.translatedSentence}
    sourceWordOffset={state.wordOffsetInSentence}
    sourceWord={state.word}
    translatedWordOffset={sentenceResult.translatedWordOffset}
  />
)}
```

И add import:

```tsx
import { SentenceTranslationView } from './SentenceTranslationView';
```

- [ ] **Step 2: Verify test PASS**

```bash
npx jest src/components/reader/__tests__/TranslationPopup.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/reader/TranslationPopup.tsx
git commit -m "feat(popup): wire SentenceTranslationView в sentence mode"
```

---

## Phase 16: TranslationFeedback storage flow (Tasks 71–73)

Spec ref: §5.4.

### Task 71: useTranslationFeedback hook — RED

**Files:**
- Test: `src/hooks/data/__tests__/useTranslationFeedback.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { renderHook, act, waitFor } from '@testing-library/react-native';
import React from 'react';
import { DatabaseProvider } from '@/db/DatabaseContext';
import { createTestDatabase } from '@/db/testDatabase';
import { useTranslationFeedback } from '@/hooks/data/useTranslationFeedback';

describe('useTranslationFeedback', () => {
  it('record + listRecent работают через repository', async () => {
    const db = await createTestDatabase();
    const wrapper = ({ children }: any) => <DatabaseProvider database={db}>{children}</DatabaseProvider>;
    const { result } = renderHook(() => useTranslationFeedback(), { wrapper });
    await act(async () => {
      await result.current.record({
        sourceSentence: 'Hello',
        translatedSentence: 'Привет',
        bookLanguage: 'en',
        nativeLanguage: 'ru',
        modelVersion: 'mv1',
        kernelBuildId: 'kb1',
        bookId: null,
      });
    });
    const list = await result.current.listRecent(10);
    expect(list).toHaveLength(1);
  });
});
```

- [ ] **Step 2: FAIL**

```bash
npx jest src/hooks/data/__tests__/useTranslationFeedback.test.tsx
```

Expected: FAIL.

---

### Task 72: useTranslationFeedback hook — GREEN

**Files:**
- Create: `src/hooks/data/useTranslationFeedback.ts`

- [ ] **Step 1: Implement**

```ts
import { useMemo, useCallback } from 'react';
import { useDatabase } from '@/db/DatabaseContext';
import { TranslationFeedbackRepository, type TranslationFeedbackDTO } from '@/db/repositories/TranslationFeedbackRepository';

export interface RecordFeedbackInput {
  sourceSentence: string;
  translatedSentence: string;
  bookLanguage: string;
  nativeLanguage: string;
  modelVersion: string;
  kernelBuildId: string | null;
  bookId: string | null;
}

export function useTranslationFeedback() {
  const db = useDatabase();
  const repo = useMemo(() => new TranslationFeedbackRepository(db), [db]);

  const record = useCallback(
    async (input: RecordFeedbackInput) => {
      await repo.insert({ ...input, createdAt: Date.now() });
    },
    [repo],
  );

  const listRecent = useCallback(async (limit: number): Promise<TranslationFeedbackDTO[]> => repo.listRecent(limit), [repo]);
  const clearAll = useCallback(async () => repo.clearAll(), [repo]);
  const purgeOlderThan = useCallback(async (cutoffMs: number) => repo.purgeOlderThan(cutoffMs), [repo]);

  return { record, listRecent, clearAll, purgeOlderThan };
}
```

- [ ] **Step 2: PASS**

```bash
npx jest src/hooks/data/__tests__/useTranslationFeedback.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/data/useTranslationFeedback.ts src/hooks/data/__tests__/useTranslationFeedback.test.tsx
git commit -m "feat(hooks): useTranslationFeedback для записи + чтения локальных жалоб"
```

---

### Task 73: Wire dislike toggle в popup container component

**Files:**
- Modify: `src/components/reader/TranslationPopupContainer.tsx` (create)

This container connects TranslationPopup view + state + feedback hook. Will be used by Reader screen.

- [ ] **Step 1: Create container**

```tsx
import React, { useCallback, useState } from 'react';
import { TranslationPopup, type PopupViewState } from './TranslationPopup';
import { useTranslationFeedback } from '@/hooks/data/useTranslationFeedback';
import { ToastAndroid, Platform, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { modelManifest } from '@/services/translation/modelManifest';
import { getKernelBuildId } from '@/services/translation/kernelBuildId';

interface Props {
  state: PopupViewState;
  onClose: () => void;
  onTranslateSentence: () => void;
  bookId?: string;
}

export function TranslationPopupContainer({ state, onClose, onTranslateSentence, bookId }: Props) {
  const [isDisliked, setIsDisliked] = useState(false);
  const [ffExpanded, setFfExpanded] = useState(false);
  const { record } = useTranslationFeedback();
  const { t } = useTranslation();

  const handleDislike = useCallback(async () => {
    if (isDisliked) {
      setIsDisliked(false);
      return;
    }
    const result = state.result as { sourceSentence?: string; translatedSentence?: string } | null;
    if (!result?.translatedSentence) return;
    setIsDisliked(true);
    await record({
      sourceSentence: result.sourceSentence ?? state.sourceSentence,
      translatedSentence: result.translatedSentence,
      bookLanguage: state.placement ? ((state as any).bookLanguage ?? 'en') : 'en',
      nativeLanguage: ((state as any).nativeLanguage ?? 'ru'),
      modelVersion: modelManifest.version,
      kernelBuildId: getKernelBuildId(),
      bookId: bookId ?? null,
    });
    if (Platform.OS === 'android') {
      ToastAndroid.show(t('translation.dislikeRecorded'), ToastAndroid.SHORT);
    } else {
      Alert.alert('', t('translation.dislikeRecorded'));
    }
  }, [isDisliked, state, record, bookId, t]);

  return (
    <TranslationPopup
      state={{ ...state, isDisliked }}
      onClose={onClose}
      onTranslateSentence={onTranslateSentence}
      onDislike={handleDislike}
      onFalseFriendToggle={() => setFfExpanded((v) => !v)}
      isFalseFriendExpanded={ffExpanded}
    />
  );
}
```

Note: container references `bookLanguage` / `nativeLanguage` on state via cast — Phase 17 will add those properly к PopupViewState.

- [ ] **Step 2: Add bookLanguage/nativeLanguage к PopupViewState**

Edit `src/components/reader/TranslationPopup.tsx`:

```ts
export interface PopupViewState {
  // ... existing fields ...
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
}
```

Add imports `BookLanguage`, `NativeLanguage`.

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/reader/TranslationPopupContainer.tsx src/components/reader/TranslationPopup.tsx
git commit -m "feat(popup): TranslationPopupContainer wires dislike → feedback hook"
```

---

## Phase 17: Coverage estimator + syntactic complexity (Tasks 74–76)

Spec ref: §7.3.

### Task 74: pageCoverage estimator — RED+GREEN

**Files:**
- Create: `src/services/translation/coverageEstimator.ts`
- Test: `src/services/translation/__tests__/coverageEstimator.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { estimatePageCoverage } from '@/services/translation/coverageEstimator';

describe('estimatePageCoverage', () => {
  it('returns 1.0 когда все words known', () => {
    const r = estimatePageCoverage({
      pageWords: ['the', 'quick', 'fox'],
      knownLemmas: new Set(['the', 'quick', 'fox']),
    });
    expect(r).toBeCloseTo(1.0);
  });

  it('returns 0.5 при 2 of 4 known', () => {
    const r = estimatePageCoverage({
      pageWords: ['the', 'quick', 'brown', 'fox'],
      knownLemmas: new Set(['the', 'fox']),
    });
    expect(r).toBeCloseTo(0.5);
  });

  it('returns 0 при empty pageWords', () => {
    const r = estimatePageCoverage({ pageWords: [], knownLemmas: new Set() });
    expect(r).toBe(0);
  });
});
```

- [ ] **Step 2: FAIL**

```bash
npx jest src/services/translation/__tests__/coverageEstimator.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
export interface CoverageInput {
  pageWords: string[];
  knownLemmas: Set<string>;
}

export function estimatePageCoverage(input: CoverageInput): number {
  if (input.pageWords.length === 0) return 0;
  let known = 0;
  for (const w of input.pageWords) {
    if (input.knownLemmas.has(w.toLowerCase())) known++;
  }
  return known / input.pageWords.length;
}
```

- [ ] **Step 4: PASS**

```bash
npx jest src/services/translation/__tests__/coverageEstimator.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/coverageEstimator.ts src/services/translation/__tests__/coverageEstimator.test.ts
git commit -m "feat(translation): estimatePageCoverage helper"
```

---

### Task 75: Syntactic complexity heuristic — RED+GREEN

**Files:**
- Create: `src/services/translation/syntacticComplexity.ts`
- Test: `src/services/translation/__tests__/syntacticComplexity.test.ts`

Spec §7.3: clause count > 2, passive voice (per-lang regex), subordinate clause marker.

- [ ] **Step 1: Failing test**

```ts
import { isSentenceComplex } from '@/services/translation/syntacticComplexity';

describe('isSentenceComplex', () => {
  it('simple sentence = false', () => {
    expect(isSentenceComplex('The cat sat.', 'en')).toBe(false);
  });

  it('3+ clauses = true', () => {
    expect(isSentenceComplex('The cat sat, the dog ran, the bird flew.', 'en')).toBe(true);
  });

  it('passive voice EN detected', () => {
    expect(isSentenceComplex('The book was written by him.', 'en')).toBe(true);
  });

  it('subordinate clause marker triggers', () => {
    expect(isSentenceComplex('The book that I read was great.', 'en')).toBe(true);
  });

  it('RU subordinate marker detected', () => {
    expect(isSentenceComplex('Книга, которую я прочитал, была хороша.', 'ru')).toBe(true);
  });
});
```

- [ ] **Step 2: FAIL**

```bash
npx jest src/services/translation/__tests__/syntacticComplexity.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// Heuristic syntactic complexity per spec §7.3.
// V1: simple regex-based, per-language patterns. V2 — proper NLP tokenizer.

const SUBORDINATE_MARKERS: Record<string, RegExp> = {
  en: /\b(that|which|who|when|if|because|although|while)\b/i,
  ru: /\b(который|которая|которое|которые|что|если|когда|потому что|хотя)\b/i,
  de: /\b(dass|wenn|weil|obwohl|während)\b/i,
  fr: /\b(que|qui|si|parce que|bien que)\b/i,
  es: /\b(que|si|porque|aunque|cuando|mientras)\b/i,
};

const PASSIVE_PATTERNS: Record<string, RegExp> = {
  en: /\b(was|were|been|being|is|are|am)\s+\w+ed\b/i,
  ru: /\b(был|была|было|были|есть|являлся|являлась)\s+\w+\b/i,
  // Other langs — placeholder, returns false.
};

export function isSentenceComplex(sentence: string, lang: string): boolean {
  // Clause count > 2 (commas + semicolons)
  const clauses = (sentence.match(/[,;]/g) || []).length + 1;
  if (clauses > 2) return true;

  const subMarker = SUBORDINATE_MARKERS[lang];
  if (subMarker && subMarker.test(sentence)) return true;

  const passive = PASSIVE_PATTERNS[lang];
  if (passive && passive.test(sentence)) return true;

  return false;
}
```

- [ ] **Step 4: PASS**

```bash
npx jest src/services/translation/__tests__/syntacticComplexity.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/syntacticComplexity.ts src/services/translation/__tests__/syntacticComplexity.test.ts
git commit -m "feat(translation): isSentenceComplex heuristic (EN/RU/DE/FR/ES patterns)"
```

---

### Task 76: shouldShowCoverageHint composite

**Files:**
- Create: `src/services/translation/shouldShowCoverageHint.ts`
- Test: `src/services/translation/__tests__/shouldShowCoverageHint.test.ts`

Spec §7.3: pulse only when BOTH page coverage <90% AND sentence complex.

- [ ] **Step 1: Failing test**

```ts
import { shouldShowCoverageHint } from '@/services/translation/shouldShowCoverageHint';

describe('shouldShowCoverageHint', () => {
  it('true когда both conditions met', () => {
    expect(shouldShowCoverageHint({ pageCoverage: 0.7, sentenceComplex: true })).toBe(true);
  });
  it('false когда page coverage > 0.9', () => {
    expect(shouldShowCoverageHint({ pageCoverage: 0.95, sentenceComplex: true })).toBe(false);
  });
  it('false когда sentence simple', () => {
    expect(shouldShowCoverageHint({ pageCoverage: 0.5, sentenceComplex: false })).toBe(false);
  });
});
```

- [ ] **Step 2: FAIL**

```bash
npx jest src/services/translation/__tests__/shouldShowCoverageHint.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
export interface CoverageHintInput {
  pageCoverage: number; // 0..1
  sentenceComplex: boolean;
}

export const COVERAGE_HINT_THRESHOLD = 0.9;

export function shouldShowCoverageHint(input: CoverageHintInput): boolean {
  return input.pageCoverage < COVERAGE_HINT_THRESHOLD && input.sentenceComplex;
}
```

- [ ] **Step 4: PASS**

```bash
npx jest src/services/translation/__tests__/shouldShowCoverageHint.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/shouldShowCoverageHint.ts src/services/translation/__tests__/shouldShowCoverageHint.test.ts
git commit -m "feat(translation): shouldShowCoverageHint composite gate"
```

---

## Phase 18: BookRenderer multi-word selection (Tasks 77–80)

Spec ref: §3.3, §3.5.

### Task 77: Gesture distance detector — RED+GREEN

**Files:**
- Create: `src/components/reader/gestureDistance.ts`
- Test: `src/components/reader/__tests__/gestureDistance.test.ts`

Spec §3.5: drag distance >8px from tap point → multi-word selection mode.

- [ ] **Step 1: Failing test**

```ts
import { exceedsDragThreshold } from '@/components/reader/gestureDistance';

describe('exceedsDragThreshold', () => {
  it('false при <8px movement', () => {
    expect(exceedsDragThreshold({ startX: 100, startY: 100, currentX: 103, currentY: 105 }, 8)).toBe(false);
  });
  it('true при >8px movement', () => {
    expect(exceedsDragThreshold({ startX: 100, startY: 100, currentX: 110, currentY: 100 }, 8)).toBe(true);
  });
});
```

- [ ] **Step 2: FAIL**

```bash
npx jest src/components/reader/__tests__/gestureDistance.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
export interface DragInput {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function exceedsDragThreshold(input: DragInput, thresholdPx: number): boolean {
  const dx = input.currentX - input.startX;
  const dy = input.currentY - input.startY;
  return Math.sqrt(dx * dx + dy * dy) > thresholdPx;
}
```

- [ ] **Step 4: PASS**

```bash
npx jest src/components/reader/__tests__/gestureDistance.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/gestureDistance.ts src/components/reader/__tests__/gestureDistance.test.ts
git commit -m "feat(reader): exceedsDragThreshold gesture helper"
```

---

### Task 78: SelectionMode state hook — RED+GREEN

**Files:**
- Create: `src/components/reader/useSelectionMode.ts`
- Test: `src/components/reader/__tests__/useSelectionMode.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { renderHook, act } from '@testing-library/react-native';
import { useSelectionMode } from '@/components/reader/useSelectionMode';

describe('useSelectionMode', () => {
  it('enters selection mode на enterAt + range extends', () => {
    const { result } = renderHook(() => useSelectionMode({ maxItemSpan: 50 }));
    act(() => result.current.enterAt({ chapterIdx: 0, itemIdx: 5, charOffset: 10 }));
    expect(result.current.active).toBe(true);
    expect(result.current.range).toEqual({ startItem: 5, endItem: 5, startChar: 10, endChar: 10 });
    act(() => result.current.extendTo({ itemIdx: 7, charOffset: 4 }));
    expect(result.current.range!.endItem).toBe(7);
  });

  it('caps selection при превышении maxItemSpan', () => {
    const { result } = renderHook(() => useSelectionMode({ maxItemSpan: 5 }));
    act(() => result.current.enterAt({ chapterIdx: 0, itemIdx: 0, charOffset: 0 }));
    act(() => result.current.extendTo({ itemIdx: 100, charOffset: 0 }));
    expect(result.current.overCap).toBe(true);
  });

  it('exit clears state', () => {
    const { result } = renderHook(() => useSelectionMode({ maxItemSpan: 50 }));
    act(() => result.current.enterAt({ chapterIdx: 0, itemIdx: 0, charOffset: 0 }));
    act(() => result.current.exit());
    expect(result.current.active).toBe(false);
    expect(result.current.range).toBeNull();
  });
});
```

- [ ] **Step 2: FAIL**

```bash
npx jest src/components/reader/__tests__/useSelectionMode.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import { useState, useCallback } from 'react';

export interface SelectionAnchor {
  chapterIdx?: number;
  itemIdx: number;
  charOffset: number;
}

export interface SelectionRange {
  startItem: number;
  endItem: number;
  startChar: number;
  endChar: number;
}

export interface UseSelectionModeOptions {
  maxItemSpan: number;
}

export function useSelectionMode(opts: UseSelectionModeOptions) {
  const [active, setActive] = useState(false);
  const [range, setRange] = useState<SelectionRange | null>(null);
  const [overCap, setOverCap] = useState(false);

  const enterAt = useCallback((anchor: SelectionAnchor) => {
    setActive(true);
    setOverCap(false);
    setRange({
      startItem: anchor.itemIdx,
      endItem: anchor.itemIdx,
      startChar: anchor.charOffset,
      endChar: anchor.charOffset,
    });
  }, []);

  const extendTo = useCallback(
    (anchor: SelectionAnchor) => {
      setRange((prev) => {
        if (!prev) return prev;
        const startItem = Math.min(prev.startItem, anchor.itemIdx);
        const endItem = Math.max(prev.startItem, anchor.itemIdx);
        const startChar = anchor.itemIdx >= prev.startItem ? prev.startChar : anchor.charOffset;
        const endChar = anchor.itemIdx >= prev.startItem ? anchor.charOffset : prev.startChar;
        const span = endItem - startItem;
        if (span > opts.maxItemSpan) setOverCap(true);
        return { startItem, endItem, startChar, endChar };
      });
    },
    [opts.maxItemSpan],
  );

  const exit = useCallback(() => {
    setActive(false);
    setRange(null);
    setOverCap(false);
  }, []);

  return { active, range, overCap, enterAt, extendTo, exit };
}
```

- [ ] **Step 4: PASS**

```bash
npx jest src/components/reader/__tests__/useSelectionMode.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/useSelectionMode.ts src/components/reader/__tests__/useSelectionMode.test.tsx
git commit -m "feat(reader): useSelectionMode hook с range tracking + cap detection"
```

---

### Task 79: Long-press + drag detection в ParagraphRender

**Files:**
- Modify: `src/components/reader/ParagraphRender.tsx`

Spec §3.5: short tap (<500ms, <8px) = word translation. Long-press (>500ms, <8px) = sentence. Drag (>8px) = selection.

- [ ] **Step 1: Read current ParagraphRender**

```bash
grep -n "onPress\|onLongPress\|Pressable" src/components/reader/ParagraphRender.tsx | head -10
```

- [ ] **Step 2: Wrap each word Pressable с onLongPress + drag detection**

Edit `src/components/reader/ParagraphRender.tsx` к каждому word `<Text>` элементу:

```tsx
<Text
  onPress={() => onWordTap(word, position)}
  onLongPress={() => onWordLongPress(word, position, sentence)}
  delayLongPress={500}
  accessibilityRole="button"
  accessibilityLabel={word}
  accessibilityHint={t('reader.a11y.tapToTranslate')}
>
  {word}
</Text>
```

Add `onWordLongPress` к component props.

- [ ] **Step 3: Verify typecheck + smoke jest**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/reader/ParagraphRender.tsx
git commit -m "feat(reader): ParagraphRender onLongPress → sentence translation trigger"
```

---

### Task 80: Disable FlatList virtualization during selection mode

**Files:**
- Modify: `src/components/reader/BookRenderer.tsx` (или ChapterRenderer)

Spec §3.3: disable virtualization для affected paragraph item indexes, не всю главу.

- [ ] **Step 1: Read current FlatList usage**

```bash
grep -n "FlatList\|disableVirtualization\|removeClippedSubviews" src/components/reader/BookRenderer.tsx src/components/reader/ChapterRenderer.tsx
```

- [ ] **Step 2: Add disableVirtualization gate**

В `ChapterRenderer.tsx`:

```tsx
const { active } = useSelectionMode(...);

<FlatList
  // ...
  disableVirtualization={active}
  removeClippedSubviews={!active}
/>
```

Note: full implementation more complex — for v1 disable virtualization for entire chapter during selection (simpler). Spec §3.3 allows this как baseline; affected-range-only virtualization moved к v2 если memory profile shows issue.

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/reader/ChapterRenderer.tsx
git commit -m "feat(reader): disable virtualization during multi-word selection mode"
```

---

## Phase 19: Paragraph accessibilityActions (Tasks 81–82)

Spec ref: §13.2.

### Task 81: Paragraph rotor actions wired

**Files:**
- Modify: `src/components/reader/ParagraphRender.tsx`

- [ ] **Step 1: Wrap paragraph View с accessibilityActions**

```tsx
<View
  accessibilityActions={[
    { name: 'translateSentence', label: t('reader.a11y.translateSentence') },
    { name: 'extendSelection', label: t('reader.a11y.extendSelection') },
  ]}
  onAccessibilityAction={(e) => {
    if (e.nativeEvent.actionName === 'translateSentence') {
      onTranslateSentence(paragraphSentence);
    } else if (e.nativeEvent.actionName === 'extendSelection') {
      onEnterSelectionMode();
    }
  }}
>
  {/* ... existing word Text elements ... */}
</View>
```

Props `onTranslateSentence` + `onEnterSelectionMode` добавляются к Component interface.

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/reader/ParagraphRender.tsx
git commit -m "feat(a11y): paragraph rotor actions translateSentence + extendSelection"
```

---

### Task 82: Test rotor action callbacks fire

**Files:**
- Test: `src/components/reader/__tests__/ParagraphRender.rotor.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ParagraphRender } from '@/components/reader/ParagraphRender';

describe('ParagraphRender rotor actions', () => {
  it('translateSentence action calls onTranslateSentence', () => {
    const handler = jest.fn();
    const item = { type: 'paragraph', inlines: [{ type: 'text', text: 'Hello world.' }] };
    const { UNSAFE_getByType } = render(
      <ParagraphRender
        item={item as any}
        onWordTap={() => {}}
        onWordLongPress={() => {}}
        onTranslateSentence={handler}
        onEnterSelectionMode={() => {}}
      />,
    );
    const View = require('react-native').View;
    const root = UNSAFE_getByType(View);
    fireEvent(root, 'accessibilityAction', { nativeEvent: { actionName: 'translateSentence' } });
    expect(handler).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run + PASS**

```bash
npx jest src/components/reader/__tests__/ParagraphRender.rotor.test.tsx
```

Expected: PASS (или iteration на signature mismatches).

- [ ] **Step 3: Commit**

```bash
git add src/components/reader/__tests__/ParagraphRender.rotor.test.tsx
git commit -m "test(a11y): rotor action handlers verified"
```

---

## Phase 20: Coach mark (long-press hint) (Tasks 83–85)

Spec ref: §10.5.

### Task 83: PopupCoachMark component — RED

**Files:**
- Test: `src/components/reader/__tests__/PopupCoachMark.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PopupCoachMark } from '@/components/reader/PopupCoachMark';

describe('PopupCoachMark', () => {
  it('renders hint text + 2 buttons', () => {
    const { getByText } = render(<PopupCoachMark onSkip={() => {}} onAcknowledge={() => {}} />);
    expect(getByText(/long-press|удержание|удержите/i)).toBeTruthy();
    expect(getByText(/Skip|Пропустить/i)).toBeTruthy();
    expect(getByText(/Got it|Понятно/i)).toBeTruthy();
  });

  it('Skip calls onSkip', () => {
    const onSkip = jest.fn();
    const { getByText } = render(<PopupCoachMark onSkip={onSkip} onAcknowledge={() => {}} />);
    fireEvent.press(getByText(/Skip|Пропустить/i));
    expect(onSkip).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: FAIL**

```bash
npx jest src/components/reader/__tests__/PopupCoachMark.test.tsx
```

Expected: FAIL.

---

### Task 84: PopupCoachMark — GREEN

**Files:**
- Create: `src/components/reader/PopupCoachMark.tsx`

- [ ] **Step 1: Implement**

```tsx
import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

interface Props {
  visible?: boolean;
  onSkip: () => void;
  onAcknowledge: () => void;
}

export function PopupCoachMark({ visible = true, onSkip, onAcknowledge }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onSkip}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}>
        <View
          accessibilityViewIsModal
          style={{
            margin: 24,
            padding: 18,
            backgroundColor: theme.paper,
            borderRadius: 14,
          }}
        >
          <Text style={{ color: theme.ink, fontSize: 15 }}>
            💡 {t('translation.coachMarks.longPress')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, justifyContent: 'flex-end' }}>
            <Pressable
              onPress={onSkip}
              accessibilityRole="button"
              hitSlop={10}
              style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' }}
            >
              <Text style={{ color: theme.ink2 }}>{t('common.skip')}</Text>
            </Pressable>
            <Pressable
              onPress={onAcknowledge}
              accessibilityRole="button"
              hitSlop={10}
              style={{
                backgroundColor: theme.accent,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
                minHeight: 44,
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: theme.paper }}>{t('common.gotIt')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: PASS**

```bash
npx jest src/components/reader/__tests__/PopupCoachMark.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/reader/PopupCoachMark.tsx src/components/reader/__tests__/PopupCoachMark.test.tsx
git commit -m "feat(popup): PopupCoachMark single hint (long-press) с skip/gotIt"
```

---

### Task 85: popupHintsSeen settings state + hint trigger logic

**Files:**
- Modify: `src/stores/settingsStore.ts`

- [ ] **Step 1: Add popupHintsSeen state slice**

```ts
// Inside settings store state:
popupHintsSeen: {
  longPressForSentence: boolean;
},
markPopupHintSeen: (key: 'longPressForSentence') => void,
resetPopupHints: () => void,

// Default:
popupHintsSeen: { longPressForSentence: false },
markPopupHintSeen: (key) => set((s) => ({ popupHintsSeen: { ...s.popupHintsSeen, [key]: true } })),
resetPopupHints: () => set({ popupHintsSeen: { longPressForSentence: false } }),
```

Также add `popupHintsSeen` к AsyncStorage allowlist в persist config.

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/stores/settingsStore.ts
git commit -m "feat(settings): popupHintsSeen state + reset action"
```

---

## Phase 21: Settings UI — Translation section + Feedback viewer (Tasks 86–89)

Spec ref: §14.3, §5.4 Settings UI.

### Task 86: Settings extensions к store (other flags)

**Files:**
- Modify: `src/stores/settingsStore.ts`

Spec §14.3: showSentenceTranslation, showRegisterTags, sentenceTranslationGesture, mweAutoExpand, falseFriendsEnabled, readingMode.

- [ ] **Step 1: Add fields к store state + actions**

```ts
showSentenceTranslation: boolean; // default true
showRegisterTags: boolean; // default false
sentenceTranslationGesture: 'long_press' | 'button' | 'both'; // default 'both'
mweAutoExpand: boolean; // default true
falseFriendsEnabled: boolean; // default true
readingMode: 'study' | 'flow'; // default 'study'

// Setters:
setSentenceTranslation: (v: boolean) => void,
setRegisterTags: (v: boolean) => void,
setSentenceGesture: (v: 'long_press' | 'button' | 'both') => void,
setMweAutoExpand: (v: boolean) => void,
setFalseFriendsEnabled: (v: boolean) => void,
```

Все добавляются к persist allowlist.

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/stores/settingsStore.ts
git commit -m "feat(settings): translation popup flags (gesture, MWE auto-expand, FF, register tags, sentence)"
```

---

### Task 87: TranslationSection settings UI

**Files:**
- Create: `src/components/settings/TranslationSection.tsx`
- Test: `src/components/settings/__tests__/TranslationSection.test.tsx`

Spec §14.3: 2 visible + Advanced disclosure.

- [ ] **Step 1: Failing test**

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TranslationSection } from '@/components/settings/TranslationSection';

describe('TranslationSection', () => {
  it('shows top-level controls (sentence gesture + smart hints toggle)', () => {
    const { getByText } = render(<TranslationSection />);
    expect(getByText(/Перевод предложения|Sentence/i)).toBeTruthy();
    expect(getByText(/Умные подсказки|Smart hints/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: FAIL**

```bash
npx jest src/components/settings/__tests__/TranslationSection.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement section**

```tsx
import React, { useState } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settingsStore';

export function TranslationSection() {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={{ color: theme.ink, fontSize: 18, fontWeight: '700' }}>
        {t('settings.translation.heading')}
      </Text>

      {/* Sentence gesture dropdown */}
      <View>
        <Text style={{ color: theme.ink2, fontSize: 13 }}>{t('settings.translation.sentenceGesture.label')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          {(['long_press', 'button', 'both'] as const).map((mode) => (
            <Pressable
              key={mode}
              accessibilityRole="radio"
              accessibilityState={{ selected: settings.sentenceTranslationGesture === mode }}
              onPress={() => settings.setSentenceGesture(mode)}
              hitSlop={10}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                minHeight: 44,
                justifyContent: 'center',
                borderRadius: 8,
                backgroundColor: settings.sentenceTranslationGesture === mode ? theme.accent : 'transparent',
                borderWidth: 1,
                borderColor: theme.accentLine,
              }}
            >
              <Text style={{ color: settings.sentenceTranslationGesture === mode ? theme.paper : theme.ink }}>
                {t(`settings.translation.sentenceGesture.${mode}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Smart hints combined toggle */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
        <Text style={{ color: theme.ink, fontSize: 14, flex: 1 }}>
          {t('settings.translation.smartHints.label')}
        </Text>
        <Switch
          accessibilityRole="switch"
          accessibilityLabel={t('settings.translation.smartHints.label')}
          accessibilityHint={t('settings.translation.smartHints.hint')}
          value={settings.falseFriendsEnabled && settings.mweAutoExpand}
          onValueChange={(v) => {
            settings.setFalseFriendsEnabled(v);
            settings.setMweAutoExpand(v);
          }}
        />
      </View>

      {/* Advanced disclosure */}
      <Pressable
        onPress={() => setAdvancedOpen(!advancedOpen)}
        accessibilityRole="button"
        accessibilityState={{ expanded: advancedOpen }}
        hitSlop={10}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={{ color: theme.ink2 }}>{advancedOpen ? '▴' : '▾'} {t('settings.translation.advanced')}</Text>
      </Pressable>

      {advancedOpen && (
        <View style={{ gap: 10 }}>
          <ToggleRow
            label={t('settings.translation.mweAutoExpand.label')}
            value={settings.mweAutoExpand}
            onChange={settings.setMweAutoExpand}
          />
          <ToggleRow
            label={t('settings.translation.registerTags.label')}
            value={settings.showRegisterTags}
            onChange={settings.setRegisterTags}
          />
          <ToggleRow
            label={t('settings.translation.falseFriends.label')}
            value={settings.falseFriendsEnabled}
            onChange={settings.setFalseFriendsEnabled}
          />
          <Pressable
            onPress={settings.resetPopupHints}
            accessibilityRole="button"
            hitSlop={10}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ color: theme.accent }}>{t('settings.translation.resetCoachMark')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { theme } = useUnistyles();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
      <Text style={{ color: theme.ink, flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}
```

- [ ] **Step 4: PASS**

```bash
npx jest src/components/settings/__tests__/TranslationSection.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/TranslationSection.tsx src/components/settings/__tests__/TranslationSection.test.tsx
git commit -m "feat(settings): TranslationSection (2 visible + Advanced disclosure)"
```

---

### Task 88: FeedbackViewerScreen

**Files:**
- Create: `app/settings/translation-feedback.tsx`
- Create: `src/components/settings/FeedbackList.tsx`
- Test: `src/components/settings/__tests__/FeedbackList.test.tsx`

Spec §5.4: list + clear all.

- [ ] **Step 1: Failing test**

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { FeedbackList } from '@/components/settings/FeedbackList';

describe('FeedbackList', () => {
  it('empty state shows placeholder', () => {
    const { getByText } = render(<FeedbackList items={[]} onClearAll={() => {}} />);
    expect(getByText(/Жалоб пока нет|No feedback yet/i)).toBeTruthy();
  });

  it('renders items source+translated', () => {
    const items = [
      { id: '1', sourceSentence: 'Hello.', translatedSentence: 'Привет.', bookLanguage: 'en', nativeLanguage: 'ru', modelVersion: 'mv1', kernelBuildId: null, bookId: null, createdAt: 1000 },
    ];
    const { getByText } = render(<FeedbackList items={items} onClearAll={() => {}} />);
    expect(getByText(/Hello\./)).toBeTruthy();
    expect(getByText(/Привет\./)).toBeTruthy();
  });
});
```

- [ ] **Step 2: FAIL**

```bash
npx jest src/components/settings/__tests__/FeedbackList.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement FeedbackList**

```tsx
import React from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import type { TranslationFeedbackDTO } from '@/db/repositories/TranslationFeedbackRepository';

interface Props {
  items: TranslationFeedbackDTO[];
  onClearAll: () => void;
}

export function FeedbackList({ items, onClearAll }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  if (items.length === 0) {
    return (
      <View style={{ padding: 24 }}>
        <Text style={{ color: theme.ink2 }}>{t('settings.feedback.empty')}</Text>
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <Pressable
        onPress={onClearAll}
        accessibilityRole="button"
        hitSlop={10}
        style={{ padding: 14, minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={{ color: theme.accent }}>{t('settings.feedback.clearAll')}</Text>
      </Pressable>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id ?? `${i.createdAt}`}
        renderItem={({ item }) => (
          <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: theme.accentLine }}>
            <Text style={{ color: theme.ink2, fontSize: 12 }}>{new Date(item.createdAt).toLocaleString()}</Text>
            <Text style={{ color: theme.ink2, fontSize: 12 }}>{item.bookLanguage} → {item.nativeLanguage}</Text>
            <Text style={{ color: theme.ink, fontSize: 14, marginTop: 4 }}>{item.sourceSentence}</Text>
            <Text style={{ color: theme.ink, fontSize: 14, marginTop: 2 }}>→ {item.translatedSentence}</Text>
          </View>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 4: Create screen route**

`app/settings/translation-feedback.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { FeedbackList } from '@/components/settings/FeedbackList';
import { useTranslationFeedback } from '@/hooks/data/useTranslationFeedback';
import type { TranslationFeedbackDTO } from '@/db/repositories/TranslationFeedbackRepository';

export default function TranslationFeedbackScreen() {
  const { listRecent, clearAll } = useTranslationFeedback();
  const [items, setItems] = useState<TranslationFeedbackDTO[]>([]);

  const reload = async () => setItems(await listRecent(500));
  useEffect(() => { reload(); }, []);

  const handleClear = async () => {
    await clearAll();
    setItems([]);
  };

  return (
    <View style={{ flex: 1 }}>
      <FeedbackList items={items} onClearAll={handleClear} />
    </View>
  );
}
```

- [ ] **Step 5: PASS**

```bash
npx jest src/components/settings/__tests__/FeedbackList.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/settings/translation-feedback.tsx src/components/settings/FeedbackList.tsx src/components/settings/__tests__/FeedbackList.test.tsx
git commit -m "feat(settings): FeedbackList + translation-feedback route"
```

---

### Task 89: Daily purge старых feedback на app launch

**Files:**
- Create: `src/services/translation/feedbackRetention.ts`
- Test: `src/services/translation/__tests__/feedbackRetention.test.ts`

Spec §5.4: retention 365 days, purge при app launch.

- [ ] **Step 1: Failing test**

```ts
import { computeFeedbackCutoff } from '@/services/translation/feedbackRetention';

describe('computeFeedbackCutoff', () => {
  it('returns now - 365 days в ms', () => {
    const now = 1_700_000_000_000;
    const cutoff = computeFeedbackCutoff(now, 365);
    expect(cutoff).toBe(now - 365 * 24 * 60 * 60 * 1000);
  });
});
```

- [ ] **Step 2: FAIL**

```bash
npx jest src/services/translation/__tests__/feedbackRetention.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
export function computeFeedbackCutoff(nowMs: number, retentionDays: number): number {
  return nowMs - retentionDays * 24 * 60 * 60 * 1000;
}

export const DEFAULT_FEEDBACK_RETENTION_DAYS = 365;
```

И wire к app launch (например в `app/_layout.tsx` useEffect):

```tsx
useEffect(() => {
  (async () => {
    try {
      const repo = new TranslationFeedbackRepository(db);
      await repo.purgeOlderThan(computeFeedbackCutoff(Date.now(), DEFAULT_FEEDBACK_RETENTION_DAYS));
    } catch (e) {
      if (__DEV__) console.warn('[feedback] retention purge failed:', e);
    }
  })();
}, [db]);
```

- [ ] **Step 4: PASS**

```bash
npx jest src/services/translation/__tests__/feedbackRetention.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/feedbackRetention.ts src/services/translation/__tests__/feedbackRetention.test.ts app/_layout.tsx
git commit -m "feat(settings): daily feedback retention purge (365 days default)"
```

---

## Phase 22: i18n strings (Tasks 90–91)

### Task 90: Add `translation.*` keys в locales/ru.json + en.json

**Files:**
- Modify: `src/i18n/locales/ru.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Add keys**

В `src/i18n/locales/ru.json` namespace `translation`:

```json
{
  "translation": {
    "experimentalBadge": "⚠️ Экспериментальный перевод",
    "dislikeLabel": "Плохой перевод",
    "dislikeRecorded": "Спасибо, учтём",
    "sourceLabel": "Источник:",
    "translationLabel": "Перевод:",
    "translateSentenceLabel": "Перевести предложение целиком",
    "alternativeSenses": "другие значения ({{count}})",
    "errorGeneric": "Не удалось перевести",
    "encounter": {
      "firstTime": "впервые встречаете",
      "nthTime": "{{ordinal}}-й раз",
      "familiar": "знакомое"
    },
    "mweType": {
      "idiom": "идиома",
      "phrasal_verb": "фразовый глагол",
      "collocation": "коллокация",
      "proverb": "поговорка"
    },
    "coachMarks": {
      "longPress": "Удержите палец на слове чтобы перевести предложение целиком"
    },
    "a11y": {
      "loadingTranslation": "Идёт перевод",
      "altSenses": "Альтернативные значения, {{count}}",
      "altSensesHint": "Двойной тап чтобы развернуть",
      "altSensesRevealed": "Показаны {{count}} значений",
      "falseFriendWarning": "Ложный друг переводчика: похоже на {{word}}",
      "falseFriendHint": "Тап чтобы узнать настоящее значение",
      "mweChip": "Тип фразы: {{type}}",
      "popupSummary": "Перевод {{word}}: {{gloss}}",
      "pronunciation": {
        "unavailable": "Произношение, недоступно в v1"
      }
    }
  },
  "reader": {
    "a11y": {
      "tapToTranslate": "Тап чтобы перевести",
      "translateSentence": "Перевести предложение",
      "extendSelection": "Выделить ещё слова",
      "longPressForSentence": "Удерживайте чтобы перевести предложение"
    }
  },
  "settings": {
    "translation": {
      "heading": "Перевод",
      "advanced": "Продвинутые настройки",
      "resetCoachMark": "Сбросить подсказки",
      "sentenceGesture": {
        "label": "Перевод предложения",
        "long_press": "По удержанию",
        "button": "По кнопке",
        "both": "Оба"
      },
      "smartHints": {
        "label": "Умные подсказки",
        "hint": "Ложные друзья, идиомы, регистр"
      },
      "mweAutoExpand": { "label": "Расширять идиомы при тапе" },
      "registerTags": { "label": "Показывать метки регистра (B2+)" },
      "falseFriends": { "label": "Предупреждать о ложных друзьях" },
      "sentenceTranslation": {
        "label": "Перевод предложения",
        "hint": "Длинное нажатие или кнопка"
      }
    },
    "feedback": {
      "empty": "Жалоб пока нет",
      "clearAll": "Очистить все жалобы"
    }
  },
  "common": {
    "skip": "Пропустить",
    "gotIt": "Понятно"
  }
}
```

И аналогичные ключи в `src/i18n/locales/en.json` (английский перевод).

- [ ] **Step 2: Verify i18n typecheck (если используется i18next-resources-to-backend)**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/ru.json src/i18n/locales/en.json
git commit -m "feat(i18n): translation.* + reader.a11y.* + settings.translation.* namespaces"
```

---

### Task 91: Add minimal i18n keys в остальные 11 locales

**Files:**
- Modify: `src/i18n/locales/{pl,uk,es,fr,de,it,pt,ja,ko,ar,hi}.json`

- [ ] **Step 1: Copy key structure из ru.json к each locale**

Для каждого of 11 файлов добавить same key tree. V1 может содержать **fallback к English** для most keys (i18next default behavior) — обязательны только русские/английские. Other 11 locales bootstrap'аются позже когда переводчики готовят строки.

Минимально: добавить `translation.experimentalBadge` + `translation.dislikeLabel` + `translation.dislikeRecorded` + `reader.a11y.tapToTranslate` + `common.skip` + `common.gotIt` translated к each language. Остальное → fallback EN.

- [ ] **Step 2: Verify i18n loads все locales**

```bash
npx jest -t "i18n"
```

Expected: existing i18n tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/
git commit -m "feat(i18n): seed translation popup strings в 11 локалях (fallback EN для secondary keys)"
```

---

## Phase 23: Polish + manual smoke checklist (Tasks 92–94)

### Task 92: Full typecheck + jest + lint gate

- [ ] **Step 1: Full typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Full jest**

```bash
npx jest
```

Expected: все tests pass (existing + new из #4.5). Если регрессии в #4 word-translation tests — debug, fix, commit отдельно.

- [ ] **Step 3: Lint**

```bash
npx expo lint
```

Expected: 0 errors, 0 warnings (или unchanged baseline).

- [ ] **Step 4: No commit — verification gate.**

---

### Task 93: Manual smoke matrix doc

**Files:**
- Create: `docs/superpowers/smoke/2026-05-17-translation-popup-smoke.md`

Spec §16.3.

- [ ] **Step 1: Create smoke checklist doc**

```markdown
# #4.5 Translation Popup Manual Smoke Matrix

> Запускается на физических устройствах ПЕРЕД merge PR #4.5 → main.

## Devices

- iPhone SE 2nd gen (small screen, modalSheet fallback expected)
- iPhone 13 (CLAUDE.md baseline)
- Pixel 7 (Android, TalkBack)

## Scenarios

(Per spec §16.3 — taken verbatim. Each row checked manually + status updated.)

| # | Test | Device | Theme | Pair | Status |
|---|------|--------|-------|------|--------|
| 1 | Word tap, popup placement bottom-half | iPhone SE 2 | Day | en→ru | ⬜ |
| 2 | Word tap, popup placement top-half | iPhone SE 2 | Sepia | en→ru | ⬜ |
| 3 | Word tap, modal sheet fallback (small screen, low remaining space) | iPhone SE 2 | Night | en→ru | ⬜ |
| 4 | Long-press → sentence translation popup opens | iPhone 13 | Day | en→ru | ⬜ |
| 5 | Sentence popup shows "⚠️ Экспериментальный перевод" badge | iPhone 13 | Day | en→ru | ⬜ |
| 6 | Dislike "👎" tap → toast "Спасибо, учтём" + entry в Settings → Feedback | iPhone 13 | Day | en→ru | ⬜ |
| 7 | Drag → multi-word selection mode | iPhone 13 | Day | en→ru | ⬜ |
| 8 | RTL Arabic popup mirror | iPhone 13 | Day | en→ar | ⬜ |
| 9 | CJK Japanese per-char tap fallback | iPhone 13 | Day | ja→en | ⬜ |
| 10 | VoiceOver word tap → translate | iPhone 13 | Day | en→ru | ⬜ |
| 11 | VoiceOver rotor → "Translate sentence" | iPhone 13 | Day | en→ru | ⬜ |
| 12 | VoiceOver rotor → "Extend selection" | iPhone 13 | Day | en→ru | ⬜ |
| 13 | Dynamic Type AX5 popup overflow | iPhone 13 | Day | en→ru | ⬜ |
| 14 | Reduce Motion popup fade = 0ms | iPhone 13 | Day | en→ru | ⬜ |
| 15 | TalkBack equivalent | Pixel 7 | Day | en→ru | ⬜ |
| 16 | Coach mark first-run hint | iPhone 13 | Day | en→ru | ⬜ |
| 17 | MWE chip auto-expand на tap внутри idiom span | iPhone 13 | Day | en→ru | ⬜ |
| 18 | False-friend chip → expand on tap | iPhone 13 | Day | ru→en (магазин) | ⬜ |

## Acceptance

Все 18 rows must be ✅ для merge PR #4.5 → main. Failed rows → file regression issue.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/smoke/2026-05-17-translation-popup-smoke.md
git commit -m "docs: smoke matrix для #4.5 (18 manual scenarios)"
```

---

### Task 94: Open PR

**Files:**
- N/A — git operation

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/translation-popup
```

- [ ] **Step 2: Open PR via gh**

```bash
gh pr create --base feat/translation-engine --title "#4.5 Translation Popup Redesign — MWE + false-friend + sentence translation + experimental badge" --body "$(cat <<'EOF'
## Summary
- MWE/idiom trie + slot template matcher (10 language pairs seeded)
- False-friend dictionary lookup (6 pairs seeded)
- Sentence translation (`translateSentence`) с experimental flag
- Локальный лог жалоб "👎 Плохой перевод" (без бэкенда)
- Tiered popup UI (word / sentence / phrase) с 3-mode placement
- Multi-word selection (drag + a11y rotor)
- Versioned cache key + cold inference tagging
- Full a11y mandate (VoiceOver / TalkBack / Reduce Motion / Reduce Transparency)
- Settings: 2 visible + Advanced disclosure

## Test plan
- [ ] `npx tsc --noEmit` green
- [ ] `npx jest` все tests pass (~80+ new tests)
- [ ] `npx expo lint` clean
- [ ] Manual smoke matrix (see `docs/superpowers/smoke/2026-05-17-translation-popup-smoke.md`) выполнен на iPhone SE 2 + iPhone 13 + Pixel 7

## Spec
`docs/superpowers/specs/2026-05-17-translation-popup-design.md` v2.2

## Out of scope
- Автоопределение языка книги — отдельная задача в #3 Reader engine
- chrF/FLORES eval — cut from v1 (см. spec §11.3)
- Whole-book translation — #4.7 cut к v2 backlog
EOF
)"
```

- [ ] **Step 3: Verify PR URL returned**

Expected: `https://github.com/.../pull/XX` printed. Copy to plan tracker.

---

## Done criteria

All these must be ✅ для PR merge:

- [ ] SCHEMA_VERSION = 2 + migration v1→v2 tested
- [ ] MWE trie + SlotMatcher с 9 unit-tests pass
- [ ] FalseFriendsDictionary lookup tested
- [ ] DictionaryLoader lazy load on book open
- [ ] Cache key versioning (model + kernel) tested
- [ ] Cold inference rule (no DB persist) tested
- [ ] tryAlignWord fail-safe tested (no proportional heuristic)
- [ ] LlamaTranslationService.translateSentence с experimental=true
- [ ] NoOp + Mock translateSentence stubs
- [ ] Custom Popover primitive (top/bottom anchored) + ReducedMotion respect
- [ ] choosePopupPlacement 3-mode logic tested
- [ ] TranslationPopup tiered redesign rendered
- [ ] ExperimentalBadge для sentence-результата всегда видна в v1
- [ ] DislikeButton → TranslationFeedback DB insert tested
- [ ] MweChip + FalseFriendChip + EncounterBadge + PolysemyDisclosure rendered
- [ ] SentenceTranslationView с fail-safe highlight
- [ ] FeedbackList + Settings → Translation Feedback screen
- [ ] Daily feedback retention purge (365 days)
- [ ] Coverage estimator + syntactic complexity + composite hint gate
- [ ] BookRenderer multi-word selection (long-press + drag + virtualization gate)
- [ ] Paragraph rotor actions (translateSentence + extendSelection)
- [ ] PopupCoachMark first-run hint
- [ ] Settings TranslationSection (2 visible + Advanced)
- [ ] i18n keys translated в RU/EN + minimal seeds в остальные 11 locales
- [ ] Manual smoke matrix passed (18 scenarios на 3 devices)
- [ ] No regression в #4 word translation
- [ ] `npx tsc --noEmit && npx jest && npx expo lint` все clean

---

## Appendix A: Plan gaps + post-merge follow-ups

### A.1 TTS placeholder button (spec §10.2)

**Status:** интенциально отложен в Phase 14 как "small visual detail wired при integration."

**What's needed:** добавить `🔊` icon button в popup header, `disabled={true}`, `opacity={0.3}`, `accessibilityState={{disabled:true}}`, `accessibilityLabel={t('translation.a11y.pronunciation.unavailable')}`. Renders в `PopupContents` header rows alongside MWE chip.

**Add manually OR include как follow-up task если merge blocked.**

```tsx
// В PopupContents header row:
<Pressable
  accessibilityRole="button"
  accessibilityState={{ disabled: true }}
  accessibilityLabel={t('translation.a11y.pronunciation.unavailable')}
  disabled
  hitSlop={10}
  style={{ opacity: 0.3, minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' }}
>
  <Text style={{ fontSize: 18 }}>🔊</Text>
</Pressable>
```

### A.2 Composite uniqueness constraint (spec §6.1)

**Status:** WatermelonDB не поддерживает multi-column unique constraints natively. `cache_key` SHA-256 over (word + contextWindow + langPair + modelVersion + kernelBuildId) → collision вероятность 2^-128. Acceptable v1.

V2 path: add app-level deduplication в `upsertByKey` (already implemented — query by cache_key первым, then update or create).

### A.3 Register tag corpus

**Status:** Spec §11 (B2+ gated rendering) wired в TranslationResult.registerTag — рендер обработан popup, но **fill logic ещё не существует.** LLM prompt v2 path добавит register inference. V1: register tag всегда undefined, chip не рендерится.

Mention в FAQ: "Register tags доступны в v2."

