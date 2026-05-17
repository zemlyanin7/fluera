# Fluera #4.5.1: Translation Popup Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Polish #4.5 popup после first smoke на iPhone: per-language sentence cap, race-safe rapid-tap, Nation-2001 encounter thresholds, save heart с 3s undo, symmetric highlight, source inline formatting (italic/bold/sup из книги), false-friend + polysemy chips, MWE explainer, progressive loading.

**Architecture:** Заменяем `extractSentence` (наивный split `.!?`) на `extractContextForWord` возвращающий `InlineNode[]` + plain + offsets. Race fix через `generation` token. UI расширяется примитивами (HeartButton, TargetSkeleton, PolysemyChip, ParagraphInlineRender) в существующий TranslationPopup. DB v2→v3 добавляет `word_status.saved_to_deck`.

**Tech Stack:** TypeScript 5 strict, RN 0.81.5 + Expo SDK 54, WatermelonDB 0.28, Reanimated 4 worklets, react-native-unistyles v3, Jest 29.

**Spec:** `docs/superpowers/specs/2026-05-18-translation-popup-polish-design.md` v2.

**Branch:** `feat/translation-popup-polish` (stack поверх main).

---

## Conventions

TDD: RED → GREEN → commit per task. Conventional commits в RU теле. Verification: `npx tsc --noEmit && npx jest -- <path>` перед commit. Russian user-facing strings, English code.

---

## Phase 0: Setup (Tasks 1–2)

### Task 1: Branch
- [ ] `git status` clean on main
- [ ] `git pull --ff-only origin main && git checkout -b feat/translation-popup-polish`

### Task 2: Dirs
- [ ] `mkdir -p assets/polysemy && touch assets/polysemy/.gitkeep`
- [ ] `git add assets/polysemy && git commit -m "chore(structure): assets/polysemy для #4.5.1"`

---

## Phase 1: DB v2→v3 (Tasks 3–6)

### Task 3: SCHEMA_VERSION + word_status columns — RED

**Files:** `src/db/schema.ts`, `src/db/__tests__/schema.test.ts`

Tests:
```ts
describe('schema v3', () => {
  it('SCHEMA_VERSION = 3', () => expect(SCHEMA_VERSION).toBe(3));
  it('word_status имеет saved_to_deck + saved_at', () => {
    const t = schema.tables.word_status;
    const names = t.columns.map((c: any) => c.name);
    expect(names).toContain('saved_to_deck');
    expect(names).toContain('saved_at');
  });
});
```

Run: `npx jest src/db/__tests__/schema.test.ts -t "schema v3"` → FAIL.

### Task 4: GREEN
- [ ] Bump `SCHEMA_VERSION = 3`
- [ ] Append columns к `word_status` tableSchema: `{ name: 'saved_to_deck', type: 'boolean' }` + `{ name: 'saved_at', type: 'number', isOptional: true }`
- [ ] Test PASS
- [ ] Commit: `feat(db): SCHEMA_VERSION=3 + word_status saved fields`

### Task 5: Migration v2→v3

**Files:** `src/db/migrations.ts`, `src/db/__tests__/migrations.test.ts`

Failing test:
```ts
it('содержит migration toVersion: 3', () => {
  const v3 = migrations.migrations.find((m: any) => m.toVersion === 3);
  expect(v3).toBeDefined();
  expect(v3!.steps.length).toBeGreaterThan(0);
});
```

GREEN: add migration step с `addColumns({ table: 'word_status', columns: [saved_to_deck, saved_at] })`.

Commit: `feat(db): миграция v2→v3 — word_status saved fields`

### Task 6: WordStatusRepository.save/unsave

**Files:** `src/db/models/WordStatus.ts`, `src/db/repositories/WordStatusRepository.ts`, test file.

Test scenarios:
1. `save({word, bookLanguage})` устанавливает savedToDeck=true + savedAt=ms
2. `unsave` сбрасывает savedToDeck=false + savedAt=null

Add `@field('saved_to_deck') savedToDeck` + `@field('saved_at') savedAt` к model.

Repository methods: see spec §4.3.

Commit: `feat(db): WordStatusRepository.save/unsave`

---

## Phase 2: extractContextForWord (Tasks 7–14)

### Task 7: ExtractedContext types

**File:** `src/services/reader/extractContextForWord.types.ts`

```ts
import type { InlineNode } from '@/types/content';
import type { BookLanguage } from '@/types/settings';

export interface ExtractedContext {
  inlines: InlineNode[];
  plainText: string;
  wordOffsetInPlain: number;
  wordLength: number;
  wasCapped: boolean;
  startOffsetInParagraph: number;
  endOffsetInParagraph: number;
}
```

Commit: `feat(reader): ExtractedContext типы`

### Task 8-9: flattenWithIndex

**File:** `src/services/reader/inlineSlicing.ts`, test file.

Tests:
- Plain text concat с offsets
- Italic preserved в inlineMap (wrappers)
- Nested formatting (bold inside italic)
- footnote-ref skipped

Implementation per spec §2.5: walk InlineNode[], track plainStart/plainEnd + wrappers.

Commit: `feat(reader): flattenWithIndex — InlineNode[] → plainText + map`

### Task 10-11: splitSentencesSmartly

**File:** `src/services/reader/inlineSlicing.ts` (append), test file.

Edge cases (9 tests):
- Basic .!? split
- Mr. Smith / Dr. abbreviations preserved
- 3.14 decimal preserved
- Wait... ellipsis as single boundary
- "Hi! Bye." quoted speech — no split inside
- これは。文。 CJK punctuation
- أين؟ Arabic punctuation
- ASCII `...` → unicode `…` normalize
- RU `г.` `стр.` abbreviations

Implementation: walk text, check PERIOD_CHARS not preceded by ABBREV, not in decimal, not inside quotes, treat ellipsis как boundary.

Commit: `feat(reader): splitSentencesSmartly abbrev/decimal/quoted/CJK aware`

### Task 12-13: extractContextForWord main

**File:** `src/services/reader/extractContextForWord.ts`, test file.

Tests (7 scenarios):
- Returns sentence containing word
- Caps long sentence per-language (Latin 150)
- Cyrillic cap 200
- CJK cap 90
- Italic formatting preserved
- wordOffsetInPlain correct
- Escalation by semicolon when sentence too long

Algorithm:
1. flattenWithIndex → plainText + inlineMap
2. splitSentencesSmartly → sentences
3. Find sentence containing offset
4. If ≤ cap → done
5. Escalation 1: split by `;` `—`
6. Escalation 2: split by `,` + subordinator
7. Hard fallback: word ±15 tokens

Per-lang HARD_CAP: en/fr/es/it/pt 150, ru/uk/pl/de 200, ja/ko 90, ar 170, hi 180.

Commit: `feat(reader): extractContextForWord per-lang cap + clause escalation`

### Task 14: Inline-aware slice

**File:** `src/services/reader/extractContextForWord.ts` (modify buildSlice)

Rewrite `buildSlice` к reconstruct InlineNode[] from inlineMap entries overlapping [start, end] range. Preserve wrapper hierarchy (italic/bold/sup/sub/link).

Italic preservation test PASS.

Commit: `feat(reader): buildSlice — reconstruct InlineNode[] preserving formatting`

---

## Phase 3: Cache key + kernelBuildId (Tasks 15–17)

### Task 15: inlineHash

**File:** `src/services/translation/inlineHash.ts`, test file.

Tests: stable 16-char hex; italic vs plain → different hash.

Implementation: serialize InlineNode[] structure → JSON → SHA-256 → slice 16.

Commit: `feat(translation): inlineHash 16-char from InlineNode[]`

### Task 16: cacheKey extend inlineHash

**File:** `src/services/translation/cacheKey.ts`

Add optional `inlineHash` field к SentenceCacheKeyInput. Different inlineHash → different cache key.

Commit: `feat(translation): cacheKey принимает inlineHash`

### Task 17: kernelBuildId bump

**File:** `src/services/translation/kernelBuildId.ts`

Add `EXTRACTION_VERSION = 'extract-v2-clause'` suffix. Test verifies suffix present.

Commit: `chore(translation): kernelBuildId += extract-v2-clause invalidation`

---

## Phase 4: Race-safe (Tasks 18–20)

### Task 18: ITranslationService types — generation + abortSentence

**File:** `src/services/translation/ITranslationService.ts`

Add к SentenceTranslationInput:
- `generation?: number`
- `sourceInlines?: InlineNode[]`

Add к SentenceTranslationResult:
- `generation?: number`
- `hasMultipleSenses?: boolean`
- `falseFriend?: { looksLike: string; actualMeaning: string }`

Add к interface:
- `abortSentence(generation: number): void`

Commit: `feat(translation): types — generation + abortSentence`

### Task 19: GenerationTokenManager

**File:** `src/services/translation/generationToken.ts`, test file.

```ts
export class GenerationTokenManager {
  private current = 0;
  private aborted = new Set<number>();
  next(): number { this.current += 1; return this.current; }
  isStale(token: number): boolean { return token !== this.current || this.aborted.has(token); }
  abort(token: number): void { this.aborted.add(token); }
}
```

Tests: next() increments, isStale, abort revokes.

Commit: `feat(translation): GenerationTokenManager race-safe`

### Task 20: LlamaTranslationService.abortSentence wired

**Files:** LlamaTranslationService, NoOp, Mock.

Inject GenerationTokenManager в LlamaTranslationService. translateSentence получает gen из input OR next(). After cache lookup и inference complete — проверка isStale → discard. abortSentence(gen) → tokens.abort(gen).

NoOp + Mock: no-op stub.

Commit: `feat(translation): translateSentence generation echo + abortSentence реализован`

---

## Phase 5: Heart UI (Tasks 21–24)

### Task 21: HeartButton

**File:** `src/components/reader/HeartButton.tsx`, test.

Props: `{ saved: boolean; onToggle: () => void }`. Outline `♡` outline, filled `♥` accent. accessibilityRole button + accessibilityState selected.

Commit: `feat(popup): HeartButton outline/filled`

### Task 22: HeartUndoChip

**File:** `src/components/reader/HeartUndoChip.tsx`, test.

Props: `{ visible: boolean; onUndo: () => void }`. Renders "↶ Отменить" button. Auto-dismiss через 3000ms (setTimeout).

Commit: `feat(popup): HeartUndoChip 3s undo affordance`

### Task 23: HeartFirstTimeHint

**File:** `src/components/reader/HeartFirstTimeHint.tsx`, test.

Props: `{ shown: boolean; onDismiss: () => void }`. Tooltip "💡 Тап ♡ чтобы сохранить" с accentSoft background.

Commit: `feat(popup): HeartFirstTimeHint onboarding tooltip`

### Task 24: Settings store savedToDeckHintShown

**Files:** `src/types/settings.ts`, `src/stores/settingsStore.ts`.

Add field `savedToDeckHintShown: boolean` (default false). Setter `markSavedToDeckHintShown()`. Add к persist allowlist.

Commit: `feat(settings): savedToDeckHintShown flag`

---

## Phase 6: Skeleton + Chips (Tasks 25–28)

### Task 25: TargetSkeleton

**File:** `src/components/reader/TargetSkeleton.tsx`, test.

Props: `{ sourceLength: number }`. Compute `lines = min(3, max(1, ceil(sourceLength / 60)))`. Render lines с widths ['100%', '92%', '64%'].slice(0, lines). Reanimated worklet opacity shimmer 0.3→0.7 repeat.

Commit: `feat(popup): TargetSkeleton sized lines + shimmer`

### Task 26: PolysemyChip

**File:** `src/components/reader/PolysemyChip.tsx`, test.

Tap → expand explainer. Tests: chip renders, tap expands.

Commit: `feat(popup): PolysemyChip awareness`

### Task 27: FalseFriendChip verify amber

**File:** test append.

Test verifies background color уже learningSoft (amber), не red. Component из #4.5 уже корректен.

Commit: `test(popup): FalseFriendChip amber не red`

### Task 28: MweChip explainer

**File:** `src/components/reader/MweChip.tsx`, test.

Add expanded state, tap toggles. Render explainer ниже chip с fallback text per type (idiom/phrasal_verb/collocation/proverb).

Commit: `feat(popup): MweChip explainer expand`

---

## Phase 7: EncounterBadge thresholds (Tasks 29–30)

### Task 29: Refined tests — RED

**File:** `src/components/reader/__tests__/EncounterBadge.test.tsx`

6 tests per Nation 2001:
- 0 → "впервые встречаете"
- 1 → "2-й раз"
- 3 → "4-й раз, формируется узнавание"
- 6 → "7-й раз — закрепляется" (milestone)
- 10 → "хорошо знакомо"
- 15 → hidden

### Task 30: Implementation — GREEN

**File:** `src/components/reader/EncounterBadge.tsx`

Update thresholds: 0 / 1-2 / 3-5 / 6-9 / 10-14 / 15+. Milestone 6-9 uses theme.ink (более prominent).

Commit: `feat(popup): EncounterBadge Nation 2001 6-9 milestone`

---

## Phase 8: ParagraphInlineRender (Tasks 31–32)

### Task 31: Tests — RED

**File:** `src/components/reader/__tests__/ParagraphInlineRender.test.tsx`

4 tests:
- Plain text
- Italic с fontStyle italic
- Bold с fontWeight 700
- Word highlight range применяется с accentSoft + accent

### Task 32: Implementation

**File:** `src/components/reader/ParagraphInlineRender.tsx`

Walk InlineNode[] recursively. Build text node hierarchy с inherited styles. Track globalOffset через render context. При intersection с highlightRange → wrap segment в accentSoft + accent + bold styled <Text>.

Commit: `feat(popup): ParagraphInlineRender InlineNode[] с highlight`

---

## Phase 9: SentenceTranslationView v2 (Tasks 33–34)

### Task 33: Tests — RED

**File:** `src/components/reader/__tests__/SentenceTranslationView.test.tsx`

New tests:
- accepts sourceInlines, preserves italic
- wasCapped → "…" markers visible

### Task 34: Implementation — GREEN

**File:** `src/components/reader/SentenceTranslationView.tsx`

Props extended: sourceInlines, sourcePlainText, wordOffsetInPlain, wordLength, wasCapped.

Source card: paper2 bg, ParagraphInlineRender с highlight.
Target card: paper2 bg + 3px accentLine border-top.
Both target word highlights: accentSoft bg + accent bold.
Truncated markers "…" leading/trailing если wasCapped.

Commit: `feat(popup): SentenceTranslationView v2 inline + symmetric + border + truncated`

---

## Phase 10: TranslationPopup integration (Tasks 35–37)

### Task 35: PopupViewState extended

**File:** `src/components/reader/TranslationPopup.tsx`

Add к PopupViewState: sourceInlines, sourcePlainText, wordOffsetInPlain, wordLength, wasCapped, savedToDeck, hasMultipleSenses, falseFriend, generation.

Commit: `refactor(popup): PopupViewState extended`

### Task 36: Header — word 16pt + heart + chips

In PopupContents header:
- Sentence mode: "Слово: {word}" 16pt bold ink2
- Word mode: word 22pt bold ink (unchanged)
- After word: HeartButton, MweChip, PolysemyChip (if hasMultipleSenses), FalseFriendChip (if falseFriend)
- Add prop `onHeartToggle`

Commit: `feat(popup): header — 16pt sentence mode + heart + chips`

### Task 37: Progressive loading

Replace loading block с `<ProgressiveLoading sourceLength={state.sourcePlainText.length} />` helper component.

ProgressiveLoading tracks elapsed via setInterval. Subtitle changes 0-5/5-10/10-15/15+ seconds. Renders TargetSkeleton sized к source.

Commit: `feat(popup): progressive loading + TargetSkeleton`

---

## Phase 11: Reader screen (Tasks 38–41)

### Task 38: extractContextForWord wired

**File:** `app/reader/[bookId].tsx`

In onWordTap: use `extractContextForWord(inlines, word, charOffset, bookLang)` returning ExtractedContext. Pass ctx.inlines, ctx.plainText, ctx.wordOffsetInPlain, ctx.wasCapped в PopupViewState.

Initial integration uses sentence param как inline fallback. Proper ContentItem pass-through в Task 41.

Commit: `feat(reader): wire extractContextForWord initial`

### Task 39: Generation token

In ReaderScreen body: `const generationRef = useRef(0)`. In onWordTap начало: `const gen = ++generationRef.current`. Pass к translateSentence. После result: `if (gen !== generationRef.current) return`.

handleSheetClose calls `translation.abortSentence(generationRef.current)` then sets popup.visible=false.

Commit: `feat(reader): generation token + abortSentence`

### Task 40: Heart toggle handler

```tsx
const handleHeartToggle = useCallback(async () => {
  const word = popup.word;
  if (!word) return;
  if (popup.savedToDeck) {
    await wordStatusRepo.unsave({ word, bookLanguage: bookLang });
  } else {
    await wordStatusRepo.save({ word, bookLanguage: bookLang });
    if (!savedToDeckHintShown) markSavedToDeckHintShown();
  }
  setPopup((p) => ({ ...p, savedToDeck: !p.savedToDeck }));
}, [popup, wordStatusRepo, bookLang, savedToDeckHintShown, markSavedToDeckHintShown]);
```

Pass к TranslationPopup `onHeartToggle`.

Commit: `feat(reader): heart toggle → WordStatusRepository`

### Task 41: Pass ContentItem inlines

**Files:** ParagraphRender, BookRenderer, ChapterRenderer, app/reader/[bookId].tsx.

Extend onWordTap signature к accept (word, sentence, inlines, charOffset). Cascade через component tree. ReaderScreen uses inlines + charOffset в extractContextForWord.

Commit: `feat(reader): pass InlineNode[] + charOffset cascade`

---

## Phase 12: Stale cache purge (Tasks 42–43)

### Task 42: purgeStaleKernelEntries

**File:** `src/services/translation/purgeStaleKernelEntries.ts`, test.

Test: insert 2 cache entries с different kernel_build_id, purge с current returns count of stale removed.

Implementation: query `where('kernel_build_id', Q.notEq(currentKb))`, batch destroyPermanently, return count.

Commit: `feat(translation): purgeStaleKernelEntries`

### Task 43: Wire в LlmBootstrap

In LlmBootstrap useEffect (db dependency): fire-and-forget `purgeStaleKernelEntries(db, getKernelBuildId())` через Promise.resolve().then(). Catch errors silently with __DEV__ warn.

Commit: `feat(translation): LlmBootstrap auto-purge на startup`

---

## Phase 13: i18n (Task 44)

### Task 44: Add keys ru.json + en.json

**Files:** `src/i18n/locales/ru.json`, `src/i18n/locales/en.json`

Add namespaces:
- `translation.wordLabel`: "Слово:"
- `translation.sourceLabel`: "ОРИГИНАЛ"
- `translation.translationLabel`: "ПЕРЕВОД"
- `translation.loading.{short,medium,long,veryLong}`: progressive subtitles
- `translation.cancelLabel`: "Отменить"
- `translation.tryAgain`: "Повторить"
- `translation.heart.{label,firstTimeHint}`
- `translation.polysemy.{chip,explainer}`
- `translation.falseFriend.chip`
- `translation.mweExplainer.{idiom,phrasal_verb,collocation,proverb}.fallback`
- `translation.encounter.{forming,consolidating,wellKnown}`
- `common.undo`: "Отменить"

EN equivalents: SOURCE, TRANSLATION, Translating..., Refining translation..., Long sentence..., Taking longer..., Save to Deck, Tap heart to save..., polysemy chip, false friend chip, etc.

Commit: `feat(i18n): #4.5.1 keys loading/heart/encounter/polysemy/mwe`

---

## Phase 14: Verification + PR (Tasks 45–47)

### Task 45: Full gate

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx jest --testPathIgnorePatterns="vendor/"` → all pass (или pre-existing #4.5 failures)
- [ ] `npx expo lint` → 0 errors

No commit unless fixes needed.

### Task 46: Update smoke matrix

**File:** `docs/superpowers/smoke/2026-05-17-translation-popup-smoke.md`

Append 10 scenarios:
- Long sentence wasCapped + "…" markers
- Italic preserved в source
- Rapid 3 taps → only last result
- Heart filled → 3s undo chip → revert
- Loading 5s subtitle change
- Loading 10s subtitle change
- EncounterBadge 6-й encounter "закрепляется" prominent
- MweChip explainer expand
- Sentence header "Слово:" 16pt
- Swipe-down → abortSentence triggered

Commit: `docs(smoke): добавить 10 сценариев для #4.5.1`

### Task 47: PR

- [ ] `git push -u origin feat/translation-popup-polish`
- [ ] `gh pr create --base main --title "#4.5.1 Translation Popup Polish — sentence extraction + UX fixes"` с body summarizing changes (см. spec).

---

## Done criteria

- [ ] SCHEMA_VERSION = 3, migration v2→v3 tested
- [ ] WordStatusRepository.save/unsave работают
- [ ] flattenWithIndex preserves wrappers (italic/bold/sup)
- [ ] splitSentencesSmartly handles 9 edge cases
- [ ] extractContextForWord respects per-language HARD_CAP (Latin 150, Cyrillic 200, CJK 90, AR 170, HI 180)
- [ ] extractContextForWord preserves italic/bold/sup
- [ ] inlineHash deterministic + sensitive к структуре
- [ ] kernelBuildId includes extract-v2-clause
- [ ] GenerationTokenManager race-safe (3 tests)
- [ ] abortSentence реализован
- [ ] HeartButton outline → filled
- [ ] HeartUndoChip auto-dismiss 3s
- [ ] HeartFirstTimeHint shows once
- [ ] TargetSkeleton 1-3 lines sized к source
- [ ] PolysemyChip expandable
- [ ] FalseFriendChip amber (not red)
- [ ] MweChip explainer expand
- [ ] EncounterBadge thresholds Nation 2001 (0/1-2/3-5/6-9/10-14/15+)
- [ ] ParagraphInlineRender italic/bold/sup + word highlight
- [ ] SentenceTranslationView v2 (InlineNode[] source + paper2 target + accentLine border + truncated)
- [ ] TranslationPopup header word 16pt sentence mode + heart + chips
- [ ] Progressive loading 0-5/5-10/10-15/15+
- [ ] Reader onWordTap uses extractContextForWord
- [ ] Generation token race-safe
- [ ] handleSheetClose triggers abortSentence
- [ ] handleHeartToggle → WordStatusRepository
- [ ] purgeStaleKernelEntries on app start
- [ ] i18n RU + EN strings added
- [ ] Smoke matrix updated с 10 new scenarios
- [ ] `npx tsc --noEmit && npx jest && npx expo lint` clean

---

## Plan gaps (followups)

### A.1 Polysemy data source
`state.hasMultipleSenses` всегда false. Reserved. Next: bundle curated `assets/polysemy/{pair}.csv` top-50 high-polysemy words per pair.

### A.2 Cancel button [Отменить] на 15+s
Сейчас swipe-down = soft abort. UX expert советует explicit [Отменить] button после 15s. Next: ProgressiveLoading renders button после 15s elapsed.

### A.3 ParagraphRender charOffset accuracy
Task 41 cascade. Verify offset properly tracked в smoke. Next: ensure word render context tracks paragraph offset.

### A.4 First-time hint timing
Show только когда heart visible AND popup ready (не loading).

### A.5 Stale kernel cleanup telemetry
Add __DEV__ log purged count в purgeStaleKernelEntries.
