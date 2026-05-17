# #4.5.1 Translation Popup Polish — Design Spec

> **Version:** v2 (после ревью 2 спецов + user feedback)
> **Date:** 2026-05-18
> **Project:** Fluera
> **Stacks on:** main (после #4.5 ship)
> **Branch:** `feat/translation-popup-polish`

## 0. Контекст

Sub-project #4.5 (Translation Popup Redesign) поставлен в main 2026-05-17. После 1-го smoke-тест на iPhone симуляторе:

**Что работает:**
- Bottom sheet снизу (вместо anchored popup)
- Single-tap → sentence translation с MWE highlighting
- Hy-MT 1.25-bit on-device
- DictionaryProvider lazy-load на book open

**Что фиксим в этой spec:**
1. Длинные предложения (200-400 char "монстры")
2. Дизайн popup улучшить
3. Race conditions при rapid tap
4. Encounter thresholds (Nation 2001 misalignment)
5. **Сохранение форматирования source** (italic/bold/superscript из книги)

**Цель:** консолидировать findings 2-х экспертов (UX + Teacher) + user requirements в **minimal viable polish** перед #4.6.

---

## 1. Scope

### 1.1 In scope (все из findings P0+P1+P2)

**Sentence extraction (CRITICAL):**
1. Clause-level splitting с per-language `HARD_CAP_CHARS`
2. Abbreviation blacklist (EN + RU)
3. Quoted speech / em-dash parenthetical / parenthesis handling
4. CJK + Arabic punctuation
5. Normalize `...` → `…`
6. Ellipsis / decimal numbers preservation

**Race-safe translation flow (CRITICAL):**
7. `requestId` / AbortController при rapid taps
8. Out-of-order result discarding

**Popup UX:**
9. Save heart icon (top-right, silent fill, 3s undo affordance)
10. First-time heart hint (onboarding tooltip)
11. Symmetric target word highlight (accentSoft в обеих картах)
12. Target card → paper2 (parallel weight), accent border-top
13. Word title 16pt bold (compromise) в sentence mode
14. EncounterBadge — both modes, separate line, ink3 muted color
15. EncounterBadge thresholds refined (Nation 2001 6-9 milestone)
16. Loading progressive states (no "Hy-MT" branding)
17. Skeleton estimate lines from source.length
18. Cross-fade adjacent word tap (race-safe re-use cached target if sentence same)
19. MweChip explainer tooltip (context-grounded если literal data есть)
20. False-friend warning chip (boolean indicator для close pairs)
21. Polysemy awareness chip (`+полисемия` без full disclosure)
22. Sentence mode "Тапнуто" → "Слово:" copy fix
23. Truncated indicator (`wasCapped=true` → "…" markers + opacity)
24. Swipe-down sheet = soft cancel triggers AbortController

**Source formatting preservation (USER REQUIREMENT):**
25. extractContextForWord возвращает **InlineNode[]** (не string) — preserve italic/bold/superscript/links
26. SentenceTranslationView рендерит source с original formatting + target word highlight поверх
27. Cache key включает hash of inline structure (italic alone vs plain — разные cache entries)

**DB + invalidation:**
28. WordStatus.saved_to_deck + saved_at columns (migration v2→v3)
29. kernelBuildId bump (EXTRACTION_VERSION)
30. Lazy cache cleanup task (delete entries с old kernel_build_id)

**SLA gaps acknowledged (backlog reminders):**
- Mini-concordance examples из same book → v2
- Reading session lookup density tracking → v2
- "I know this word" scroll-past signal → v2
- Highlight unknown integration с popup → v2
- POS auto-detection (lemmatization gap) → v2
- CEFR auto-detection → v2
- IPA / TTS → v3

### 1.2 Defer to future iterations

- ❌ Full polysemy disclosure ("Other senses ▾" с list) — нужен curated lexicon (chip awareness signal — да, full disclosure — defer)
- ❌ Full false-friend UI (curated lists per pair, detail meaning explanation) — boolean indicator только
- ❌ Idiom literal etymology dual-display — нужно literal в DB
- ❌ Reading flow integration: highlight unknown words pre-tap
- ❌ POS detection (требует lemma dict)
- ❌ CEFR chip (требует curated CSV per language)
- ❌ Concordance examples
- ❌ TTS / IPA
- ❌ Long-tap heart → deck selector mini-menu

### 1.3 Не затрагивается

- Sheet primitive
- DictionaryLoader / lookup logic
- LlamaTranslationService.translateSentence
- TranslationFeedback (dislike) storage
- Existing DB tables кроме `word_status`

---

## 2. Sentence extraction algorithm (rewritten v2)

### 2.1 Public API

```ts
// src/services/reader/extractContextForWord.ts
import type { ContentItem, InlineNode } from '@/types/content';

export interface ExtractedContext {
  /** Inline structure preserving formatting (italic/bold/etc) from source. */
  inlines: InlineNode[];
  /** Plain text равен concatенации `flattenInlineText(inlines)` — для LLM prompt. */
  plainText: string;
  /** Char offset тапнутого слова в plainText. */
  wordOffsetInPlain: number;
  /** Length of tapped word/expression in chars. */
  wordLength: number;
  /** True если sentence > HARD_CAP и пришлось cap-нуть. UI рендерит "…" leading/trailing. */
  wasCapped: boolean;
  /** Source char offset в оригинальном paragraph (для cache key). */
  startOffsetInParagraph: number;
  endOffsetInParagraph: number;
}

export function extractContextForWord(
  item: ContentItem,
  word: string,
  paragraphCharOffset: number,
  lang: BookLanguage,
): ExtractedContext;
```

### 2.2 Per-language HARD_CAP_CHARS

```ts
const HARD_CAP_CHARS: Record<string, number> = {
  // Latin scripts: avg 5-6 char/word → 150 ≈ 25-30 слов
  en: 150, fr: 150, es: 150, it: 150, pt: 150,
  // Cyrillic / German: longer words → 200 ≈ 25-30 слов
  ru: 200, uk: 200, pl: 200, de: 200,
  // CJK: char-dense (1 char ≈ 1 meaningful glyph) → 90 ≈ 30-60 chars
  ja: 90, ko: 90,
  // Arabic: vowels + connectors → 170
  ar: 170,
  // Devanagari
  hi: 180,
};

const DEFAULT_CAP = 180;
function capForLang(lang: BookLanguage): number {
  return HARD_CAP_CHARS[lang] ?? DEFAULT_CAP;
}
```

### 2.3 Constants

```ts
const PERIOD_CHARS = /[.!?…。！？؟۔]/;
const ABBREV_PATTERN = /\b(Mr|Mrs|Ms|Dr|Prof|Capt|Gen|Rev|Sgt|St|Jr|Sr|vs|etc|i\.e|e\.g|Mme|Mlle|vol|no|ch|p|pp|cf|т\.е|т\.к|т\.д|и\.т\.д|г|стр|см|гл|др|и\.т\.п)\.\s/i;
const SECONDARY_BOUNDARY = /[;—–]/;
const SOFT_CLAUSE = /,\s+(which|that|who|whom|when|where|because|since|if|unless|although|though|and|but|or|so|yet|и|который|которая|которое|которые|когда|пока|если|потому|хотя|пока|чтобы|чтобы)\b/i;
const WORD_WINDOW = 15; // ±15 tokens — minimum 30-token clause-unit
const NORMALIZE_ELLIPSIS_RE = /\.{3,}/g; // ASCII triple-dot → unicode …
```

### 2.4 Algorithm

```ts
export function extractContextForWord(item, word, paragraphCharOffset, lang) {
  if (item.type !== 'paragraph') {
    return emptyContext();
  }

  // Step 1: build plain text + inline structure index
  const { plainText, inlineMap } = flattenWithIndex(item.inlines);
  const normalized = plainText.replace(NORMALIZE_ELLIPSIS_RE, '…');
  // inlineMap: array of { plainStart, plainEnd, inlineNodeRef } для каждого text run

  // Step 2: smart sentence split (abbrev-aware, CJK/AR-aware)
  const sentences = splitSentencesSmartly(normalized);

  // Step 3: find sentence containing wordCharOffset
  const sentence = findContaining(sentences, paragraphCharOffset);
  if (!sentence) return fullParagraphContext(item);

  const cap = capForLang(lang);

  // Step 4: если sentence ≤ cap → done, build inline subset
  if (sentence.text.length <= cap) {
    return buildContextSlice(item, inlineMap, sentence, paragraphCharOffset, word, false);
  }

  // Step 5: escalation 1 — semicolons / em-dashes
  let clauses = splitOnBoundary(sentence.text, SECONDARY_BOUNDARY);
  // Strip parenthetical em-dash content "Alice — tired — sat" → "Alice sat" если parenthetical короче 30 chars
  clauses = stripParentheticals(clauses, sentence.startOffset);
  const found = findContainingClauseWithWord(clauses, paragraphCharOffset, word);
  if (found && found.text.length <= cap) {
    return buildContextSlice(item, inlineMap, found, paragraphCharOffset, word, true);
  }

  // Step 6: escalation 2 — comma + subordinator
  const softClauses = splitOnBoundary(sentence.text, SOFT_CLAUSE);
  const found2 = findContainingClauseWithWord(softClauses, paragraphCharOffset, word);
  if (found2 && found2.text.length <= cap) {
    return buildContextSlice(item, inlineMap, found2, paragraphCharOffset, word, true);
  }

  // Step 7: hard window fallback — ±WORD_WINDOW tokens с word-boundary trim
  const window = extractWordWindow(normalized, paragraphCharOffset, WORD_WINDOW);
  return buildContextSlice(item, inlineMap, window, paragraphCharOffset, word, true);
}
```

### 2.5 Key helper functions

**`splitSentencesSmartly`**: walks text, finds PERIOD_CHARS that ARE boundaries:
- NOT preceded by ABBREV_PATTERN
- NOT inside decimal (`\d\.\d`)
- NOT inside quoted speech (`"…"`, `«…»`, `„…"`, `'…'`, `「…」`)
- `…` (unicode ellipsis) = single boundary
- Returns array `{ text, startOffset, endOffset }` в оригинальном тексте

**`flattenWithIndex`**: walks `InlineNode[]` recursively, builds:
- `plainText` (string concat)
- `inlineMap`: `Array<{ plainStart, plainEnd, node, depth }>` — позиции каждого text run в plain

**`buildContextSlice`**: учитывая `{ startOffset, endOffset }` в plain:
- Walks `inlineMap` к find all nodes overlapping range
- Clones / truncates nodes к build new `InlineNode[]` with formatting preserved
- Computes `wordOffsetInPlain` relative к slice start
- Returns `ExtractedContext`

**`stripParentheticals`**: removes `— text —` or `(text)` segments если text < 30 chars (they're insertions, not key info).

**`extractWordWindow`**: takes word offset, finds nearest word boundaries ±WORD_WINDOW tokens. Adds `…` markers leading/trailing. Returns `{ text: "…window with target…", startOffset, endOffset }`.

### 2.6 Edge cases (всего 12 ситуаций для tests)

| Case | Input | Expected |
|------|-------|----------|
| Mr. Smith | `"Mr. Smith arrived. He waved."` tap "Smith" | `"Mr. Smith arrived."` |
| Decimal | `"Pi is 3.14 approximately."` tap "Pi" | `"Pi is 3.14 approximately."` |
| Ellipsis | `"Wait... no."` tap "no" | `"no."` (ellipsis = boundary) |
| Quoted speech | `She said, "Hi!" and left.` tap "Hi" | `She said, "Hi!" and left.` (no split inside quotes) |
| CJK | `これは。文。` tap "文" | `"文。"` |
| Arabic | `أين؟ هنا.` tap "هنا" | `"هنا."` |
| Em-dash parenthetical | `Alice — who was tired — sat down.` tap "sat" | `Alice sat down.` (parenthetical stripped) |
| 280-char Wonderland | long with semicolons | clause containing word, ≤cap |
| Single mega-clause >cap | rare | ±WORD_WINDOW window with `…` |
| RU abbrev `г.` | `Москва, г. Москва, далее.` tap "Москва" | first instance с full sentence |
| Inline formatting | `<i>She</i> walked.` tap "walked" | InlineNode[] preserving italic on "She" |
| First-paragraph indent | ` First sentence.` (em-space indent) | normalize ws |

---

## 3. Race-safe translation flow

### 3.1 Problem

Rapid tap → 3 translations queue. First може finish ПОСЛЕ второго → target card shows wrong sentence translation. UX expert flagged как high-severity.

### 3.2 Solution

**ITranslationService extension:**
```ts
export interface SentenceTranslationInput {
  // ... existing ...
  /** Generation token — incremented per tap. Result игнорируется если token изменился. */
  generation?: number;
}

export interface ITranslationService {
  // ... existing ...
  /** Aborts pending sentence translation (if any). Currently best-effort — llama.rn doesn't expose abort; this just marks result as stale. */
  abortSentence(generation: number): void;
}
```

**Reader screen handler:**
```ts
const generationRef = useRef(0);

const onWordTap = useCallback(async (word, sentence) => {
  const gen = ++generationRef.current;
  // ... compute base state ...
  setPopup(base);

  const res = await translation.translateSentence({ ..., generation: gen });

  // Discard stale result
  if (gen !== generationRef.current) return;

  // Apply result
  setPopup({ ...base, status: 'ready', result: ... });
}, [translation, ...]);
```

**Soft cancel via swipe-down:**
```ts
const handleSheetClose = useCallback(() => {
  translation.abortSentence(generationRef.current);
  setPopup((p) => ({ ...p, visible: false }));
}, [translation]);
```

`abortSentence` в v1.5 — just increments internal counter, доabandонed inference completes silently (no UI update, no DB cache write).

### 3.3 Cross-fade при adjacent word

Если `gen` changed, popup state updates с new word, **не закрывая sheet**. Previous request becomes stale, ignored when finishes.

Source sentence highlight перемещается via Reanimated layout animation OR простой re-render с new offset (cheaper).

**Если sentence тот же** (adjacent word в том же предложении):
- Re-use cached `result.translatedSentence` instantly
- Только обновить `translatedWordOffset` (recompute через tryAlignWord для нового word)
- Skip skeleton + LLM fetch

---

## 4. UI changes

### 4.1 Popup header

**Word mode:**
```
[WORD 22pt bold]              [♡] [MweChip] [+полисемия] [⚠ false friend]
```

**Sentence mode:**
```
[Слово: word 16pt bold ink2]   [♡] [MweChip] [+полисемия] [⚠ false friend]
✦ 6-й раз — закрепляется               ← EncounterBadge separate line, ink3
```

Copy: "Тапнуто:" → "Слово:" (per UX expert P fix).

### 4.2 Chips visibility rules

| Chip | Show when | Hide when |
|------|-----------|-----------|
| `♡` heart | Always | — |
| `MweChip` | Tapped word часть MWE | Single word |
| `+полисемия` (boolean awareness) | `hasMultipleSenses=true` (from polysemy hint в dict OR future LLM signal) | Single-sense |
| `⚠ false friend` (boolean warning) | FalseFriendsDictionary returns hit для (lang, word) | No hit |

POS, CEFR, IPA — **all deferred** (нет data source).

### 4.3 Save-to-deck heart

**Behavior:**
- Tap heart → immediate save (no modal, no toast)
- Icon morphs outline → filled accent (200ms)
- **3-second undo affordance**: subtle text "Отменить ↶" appears inline под header, auto-disappears через 3с
- Long-tap heart (v2): deck selector menu

**First-time hint (onboarding):**
- При первом popup open (любом) с `savedToDeckHintShown=false` в settings → tooltip arrow указывает на heart "Тап ♡ чтобы сохранить в Deck"
- Tap → flag `savedToDeckHintShown=true` в persist
- Auto-dismiss через 3с если игнор

**DB schema (migration v2→v3):**
```sql
ALTER TABLE word_status ADD COLUMN saved_to_deck BOOLEAN DEFAULT FALSE;
ALTER TABLE word_status ADD COLUMN saved_at INTEGER; -- unix ms, NULL если not saved
```

### 4.4 Source + Translation cards

**Old:**
- Source: paper2 bg, target word: accent + accentSoft bg
- Target: accentSoft bg, target word: accent only

**New (symmetric mapping + role differentiation):**
- Source: paper2 bg
- Target: paper2 bg + **3px accentLine border-top** (subtle "это перевод" indicator)
- Target word highlight в **обеих**: accentSoft background + accent text + bold

```tsx
<View style={{
  backgroundColor: theme.paper2,
  padding: 14,
  borderRadius: 12,
  borderTopWidth: isTarget ? 3 : 0,
  borderTopColor: theme.accentLine,
}}>
  ...
</View>
```

### 4.5 Source formatting preservation

**Old:** `SentenceTranslationView` принимает `sourceSentence: string`, рендерит plain.

**New:** принимает `sourceInlines: InlineNode[]`, рендерит via `<ParagraphInlineRender>` (новый компонент, shared с ParagraphRender word-tap base) с:
- `italic` → fontStyle: 'italic'
- `bold` → fontWeight: '700'
- `sup`/`sub` → fontSize: 12 + lineHeight offset
- `link` → accent color но НЕ tappable в popup
- `footnote-ref` → grayed out, NOT renders [n] link
- Target word range overlaid с accentSoft bg + bold accent color (стандартный highlight)

**Если книга italicized слова "spring" в source paragraph** → юзер видит italicized "spring" в popup тоже. Понятнее: матчится visual с book reading.

Translation rendering остаётся plain text (Hy-MT output не содержит markup).

### 4.6 EncounterBadge thresholds (Nation 2001 refined)

| Total (lookup+passive) | Russian text | Color |
|------------------------|--------------|-------|
| 0 | "впервые встречаете" | accent |
| 1-2 | "{N+1}-й раз" | ink2 |
| 3-5 | "{N+1}-й раз, формируется узнавание" | ink2 |
| **6-9** | **"{N+1}-й раз — закрепляется"** | **ink** (более prominent чем ink2 — milestone celebration) |
| 10-14 | "хорошо знакомо" | ink3 |
| 15+ | hidden | — |

Placement: separate line под header chips, before source card. Font: 12pt, ink3 base (override per threshold выше).

### 4.7 Loading progressive

| Elapsed | Subtitle | Skeleton |
|---------|----------|----------|
| 0ms | "Переводим..." | Sized к source length |
| 5-9s | "Подбираем точный перевод..." | shimmer continues |
| 10-14s | "Длинное предложение, ещё момент..." | shimmer continues |
| 15+s | "Дольше обычного" + [Отменить] button | shimmer continues |
| Cold model (status='warming_up' OR 'loading') | "Загружаем модель..." | shimmer |
| Cancel via swipe-down OR [Отменить] | Sheet closes, abortSentence(gen) | — |
| Timeout (45s) | "Не удалось перевести" + [Повторить] | — |

**Skeleton sizing:**
```tsx
const estimatedLines = Math.min(3, Math.max(1, Math.ceil(sourcePlainText.length / 60)));
```

**Skeleton component:**
```tsx
function TargetSkeleton({ lines }: { lines: number }) {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    'worklet';
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, []);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const widths = ['100%', '92%', '64%'].slice(0, lines);
  return (
    <View style={{ gap: 6 }}>
      {widths.map((w, i) => (
        <Animated.View key={i} style={[
          { height: 18, borderRadius: 4, width: w, backgroundColor: theme.accentSoft },
          animStyle,
        ]} />
      ))}
    </View>
  );
}
```

### 4.8 Truncated indicator

Если `wasCapped=true`:
- Source card: leading "…" если sliced from middle (startOffset > 0)
- Source card: trailing "…" если sliced before end (endOffset < paragraph.length)
- Opacity 0.6 на "…" чтобы distinguish от content

### 4.9 MweChip explainer tooltip

Tap MweChip → inline expand под chip с context-grounded text если literal data есть:

```
[идиома ▾]
↓ tap
[идиома ▴]
↳ "kick the bucket" — идиома. Дословно "ударить ведро", но значит "умереть".
   Запоминайте целиком, по словам не переводится.
```

**Fallback** если `literalGloss` отсутствует (most MWE seed):
```
↳ Идиома — значение не складывается из отдельных слов.
   Запоминайте целиком.
```

i18n keys:
- `translation.mweExplainer.idiom.withLiteral`: `"{phrase}" — идиома. Дословно "{literal}", но значит "{idiomatic}". Запоминайте целиком.`
- `translation.mweExplainer.idiom.fallback`: `Идиома — значение не складывается из отдельных слов. Запоминайте целиком.`
- `translation.mweExplainer.phrasal_verb.fallback`: `Предлог меняет смысл глагола. Учите как одну единицу.`
- `translation.mweExplainer.collocation.fallback`: `Слова часто употребляются вместе.`
- `translation.mweExplainer.proverb.fallback`: `Пословица — фиксированное выражение народной мудрости.`

### 4.10 False-friend chip

Если `FalseFriendsDictionary.lookup(word)` возвращает hit:
```
[⚠ ложный друг ▾]
↓ tap
[⚠ ложный друг ▴]
↳ Похоже на родное слово, но значение другое.
   Не "{looksLike}", а "{actualMeaning}".
```

Color: `learning` (amber, не red — per teacher).
Position: между MweChip и +полисемия.
Default state: collapsed.
Show only one time per session per word (cache в memory, не DB persistent).

### 4.11 +полисемия awareness chip

Boolean signal `hasMultipleSenses: boolean` в `TranslationResult`. v1.5 источник: будущая enrichment из dictionary OR LLM. **Если нет источника к ship — chip не отображается** (degrade gracefully).

Если показывается:
```
[+полисемия ▾]
↓ tap
[+полисемия ▴]
↳ У этого слова несколько значений. В этом контексте — primary translation выше.
   Полный список будет в v2.
```

Color: `paper2` background, `ink2` text (subtle).
**Defer full disclosure** — Other senses list требует curated lexicon.

---

## 5. Cache key + invalidation

### 5.1 Key change

`buildCacheKey` теперь включает source `inlineHash` (хеш sequence of `{type, text}` для каждого inline node):

```ts
async function inlineHash(inlines: InlineNode[]): Promise<string> {
  const stringified = JSON.stringify(inlines.map(n => ({
    t: n.type,
    x: n.type === 'text' ? n.text : undefined,
    c: 'children' in n ? n.children.length : undefined,
  })));
  return (await Crypto.digestStringAsync(SHA256, stringified)).slice(0, 16);
}
```

Cache key normalized:
```
[word, plainContext, langPair, modelVersion, kernelBuildId, inlineHash]
```

### 5.2 Kernel build ID bump

```ts
// src/services/translation/kernelBuildId.ts
const LLAMA_RN_VERSION = '0-12-0';
const STQ_PATCH_ID = 'pr22836-stq1-0';
const EXTRACTION_VERSION = 'extract-v2-clause'; // bump для invalidation старых длинных entries

export function getKernelBuildId(): string {
  return `${LLAMA_RN_VERSION}-${STQ_PATCH_ID}-${EXTRACTION_VERSION}`;
}
```

### 5.3 Lazy cache cleanup

При app start (background task):
```ts
async function purgeStaleKernelEntries() {
  const currentKb = getKernelBuildId();
  await db.write(async () => {
    const stale = await db.get('translation_cache')
      .query(Q.where('kernel_build_id', Q.notEq(currentKb)))
      .fetch();
    await db.batch(...stale.map(s => s.prepareDestroyPermanently()));
  });
}
```

Триггерится в `LlmBootstrap` после model load (low priority, fire-and-forget).

---

## 6. Data types

### 6.1 InlineNode (existing — ничего не меняем)

`src/types/content.ts` already defines `InlineNode` discriminated union: `text | italic | bold | link | sup | sub | footnote-ref`. Используем as-is.

### 6.2 ExtractedContext (new)

См. §2.1.

### 6.3 PopupViewState additions

```ts
export interface PopupViewState {
  // ... existing ...

  // v1.5 additions:
  /** InlineNode slice источника для preserving italic/bold. */
  sourceInlines: InlineNode[];
  /** Plain text equivalent (for accessibility + alignment computations). */
  sourcePlainText: string;
  /** Char offset тапнутого слова в sourcePlainText. */
  wordOffsetInPlain: number;
  /** Length of word/expression in chars. */
  wordLength: number;
  /** True если context был cap-нут — UI рендерит "…" markers. */
  wasCapped: boolean;
  /** True если юзер сохранил слово в Deck (heart filled). */
  savedToDeck: boolean;
  /** True если слово has multiple senses (для +полисемия chip). */
  hasMultipleSenses: boolean;
  /** False-friend info (если detected). */
  falseFriend: { looksLike: string; actualMeaning: string } | null;
  /** Generation token (для race-safe result handling). */
  generation: number;
}
```

### 6.4 WordStatus model

`src/db/models/WordStatus.ts` — add fields:
```ts
@field('saved_to_deck') savedToDeck!: boolean;
@field('saved_at') savedAt!: number | null;
```

---

## 7. Files plan

### 7.1 Создаём

- `src/services/reader/extractContextForWord.ts` — new
- `src/services/reader/__tests__/extractContextForWord.test.ts` — 12+ tests
- `src/services/reader/inlineSlicing.ts` — helper для buildContextSlice + inlineHash
- `src/components/reader/HeartButton.tsx`
- `src/components/reader/HeartUndoChip.tsx` — 3s undo affordance
- `src/components/reader/HeartFirstTimeHint.tsx` — onboarding tooltip
- `src/components/reader/TargetSkeleton.tsx`
- `src/components/reader/CrossfadeContent.tsx`
- `src/components/reader/PolysemyChip.tsx`
- `src/components/reader/FalseFriendChip.tsx` (если ещё нет — replace existing если есть)
- `src/components/reader/ParagraphInlineRender.tsx` — render InlineNode[] с word highlight (shared с ParagraphRender)
- `src/components/reader/__tests__/*.test.tsx` (по одному на компонент)
- `src/services/translation/__tests__/cacheKey.inlineHash.test.ts`
- `src/services/translation/abortSentence.ts` — generation token manager

### 7.2 Изменяем

- `src/services/reader/extractSentence.ts` — DEPRECATED alias к new function
- `src/components/reader/TranslationPopup.tsx`:
  - Header: word 22pt (word mode) / 16pt bold ink2 "Слово: word" (sentence mode)
  - Add heart, +полисемия, false-friend chips
  - EncounterBadge always shown, separate line, ink3
  - Loading: progressive subtitle + skeleton + cancel button
  - Cross-fade wrapper
- `src/components/reader/SentenceTranslationView.tsx`:
  - Accept `sourceInlines: InlineNode[]` вместо `sourceSentence: string`
  - Render via `ParagraphInlineRender` с word highlight
  - Target card: paper2 + accentLine border-top
  - Symmetric highlight (accentSoft bg target word в обеих картах)
  - Truncated `…` markers если wasCapped
- `src/components/reader/MweChip.tsx`:
  - Add inline explainer expand on tap
- `src/components/reader/EncounterBadge.tsx`:
  - Thresholds refined (Nation 2001 6-9 milestone)
  - Default color ink3, override prominence для milestones
- `src/services/translation/kernelBuildId.ts`:
  - Add EXTRACTION_VERSION
- `src/services/translation/cacheKey.ts`:
  - Add inlineHash к input
- `src/services/translation/LlamaTranslationService.ts`:
  - Accept `generation` param
  - Return result includes generation
- `src/services/translation/ITranslationService.ts`:
  - Add `abortSentence(generation: number): void`
  - Add `hasMultipleSenses?: boolean`, `falseFriend?: { ... }` к result
- `src/services/translation/LlmBootstrap.tsx`:
  - On model ready: fire-and-forget `purgeStaleKernelEntries()`
- `src/db/models/WordStatus.ts`:
  - Add saved_to_deck, saved_at fields
- `src/db/repositories/WordStatusRepository.ts`:
  - Add `save(wordId)`, `unsave(wordId)`
- `src/db/schema.ts`:
  - SCHEMA_VERSION 2→3, add columns к word_status
- `src/db/migrations.ts`:
  - Add toVersion 3
- `src/stores/settingsStore.ts`:
  - Add `savedToDeckHintShown: boolean` к persist allowlist
- `app/reader/[bookId].tsx`:
  - Use extractContextForWord
  - Maintain `generationRef`
  - Race-safe result handling
  - Cross-fade при adjacent word
  - Save heart action
  - Re-use cached target если sentence тот же
- `src/i18n/locales/ru.json`, `en.json`:
  - Add `translation.wordLabel`, `translation.loading.*`, `translation.mweExplainer.*`, `translation.encounter.*`, `translation.falseFriend.*`, `translation.polysemy.chip`, `translation.heart.firstTimeHint`, `translation.cancelLabel`, `translation.tryAgain`, `common.undo` keys

---

## 8. Performance budget

| Operation | Target |
|-----------|--------|
| `extractContextForWord` 500-char paragraph | <5ms iPhone 13 |
| Sentence boundary cache (WeakMap) lookup | <1ms |
| `flattenWithIndex` traverse | <2ms на 200-inline paragraph |
| `inlineHash` SHA-256 на 30 inlines | <8ms |
| Heart save DB write | <50ms |
| Cross-fade transition | 200ms |
| Skeleton frame budget | 16ms (UI thread worklet) |

---

## 9. Tests (estimated count)

### 9.1 Unit (40+ tests)

- `extractContextForWord` — 12 scenarios (см. §2.6)
- `inlineSlicing` — 8 tests (slice preserving formatting, hash stability)
- `HeartButton` — 4 tests (outline/filled, save, unsave, accessibility)
- `HeartUndoChip` — 2 tests (appears 3s, undo handler)
- `HeartFirstTimeHint` — 3 tests (shows once, dismiss flag persists)
- `TargetSkeleton` — 2 tests (1/2/3 lines)
- `CrossfadeContent` — 3 tests (fade duration, content updates)
- `MweChip` — 3 tests (explainer expand, fallback text, context-grounded if literal)
- `FalseFriendChip` — 3 tests (chip shows on hit, expand explainer, ink color amber)
- `PolysemyChip` — 2 tests (shows if hasMultipleSenses, hidden otherwise)
- `EncounterBadge` — 5 tests (thresholds 0/1-2/3-5/6-9/10-14/15+)
- `cacheKey` с inlineHash — 3 tests (same plain different inlines → different keys)
- `generation` token race-safety — 3 tests (stale result discarded)

### 9.2 Integration (8 tests)

- Tap word → popup opens, heart outline, source с italic preserved
- Tap heart → DB row updated, icon filled, undo chip appears 3s
- Tap heart twice rapidly → only one save, undo affordance reflects latest
- Long sentence book (Lewis Carroll) → wasCapped=true, `…` markers visible
- Adjacent word tap → cross-fade, no flicker
- Adjacent word same sentence → reuses cached target
- Different sentence → new skeleton + fetch
- Rapid 3 taps → only last result applied

### 9.3 Manual smoke (~10 scenarios)

- iPhone SE 2 + iPhone 13 + Pixel 7
- All 3 themes (Day/Sepia/Night) contrast audit
- 6 language scripts (en/ru/ja/ar/hi/de)
- Italic / bold / superscript preservation в popup source

---

## 10. Done criteria

- [ ] `extractContextForWord` passes 12+ unit tests
- [ ] Italic/bold/superscript preserved в source card popup
- [ ] HARD_CAP per-language (Latin 150, Cyrillic 200, CJK 90, AR 170, HI 180)
- [ ] Abbreviations (`Mr.`, `Dr.`, `Prof.`, `г.`, `стр.`, etc) not split
- [ ] Quoted speech / em-dash parenthetical / parenthesis handled
- [ ] Heart icon top-right, outline→filled, 3s undo chip, no toast
- [ ] First-time heart hint shown once, flag persisted
- [ ] Symmetric word highlight (accentSoft в обеих картах)
- [ ] Target card: paper2 bg + accentLine border-top
- [ ] Word title 16pt bold ink2 в sentence mode (NOT 22pt)
- [ ] EncounterBadge в обоих режимах, ink3 base, 6-9 milestone prominent
- [ ] Loading: 0-4s/5-9s/10-14s/15+ progressive subtitles
- [ ] Skeleton sized к source length (1-3 lines)
- [ ] Cross-fade adjacent word, race-safe (generation token)
- [ ] Re-use cached target если sentence тот же
- [ ] Swipe-down sheet = abortSentence triggers
- [ ] MweChip tap → explainer with context-grounded text when literal available
- [ ] FalseFriendChip shows boolean warning indicator
- [ ] PolysemyChip +полисемия if hasMultipleSenses
- [ ] Cache key includes inlineHash
- [ ] kernelBuildId bumped → old long-sentence entries unreachable
- [ ] Lazy purge задача после model load
- [ ] DB SCHEMA_VERSION 2→3 migration tested
- [ ] WordStatus.saved_to_deck + saved_at columns persist
- [ ] WCAG AA contrast audit passes all 3 themes
- [ ] Manual smoke matrix pass

---

## 11. Open questions

1. **`hasMultipleSenses` source**: где взять boolean? Variants:
   - Hardcoded curated list top-100 polysemy words per pair (en-ru, en-es) — `assets/polysemy/{pair}.csv` ~5KB
   - LLM augmentation prompt (extra inference call) — slower
   - **Decision**: bundle minimal curated list (top-50 high-polysemy English words) для en→{ru,es} pairs. Defer prompt augmentation к v2.

2. **Heart icon contrast в Night theme**: outline heart `ink2` vs paper background — может проседать. Audit required. Если <3:1 → bumpni к `ink` outline в Night.

3. **Cross-fade implementation**: CrossfadeContent через 2 mounted children с opacity transitions vs single child с state change + key-based remount. Decision: state change + Reanimated layout (cheaper, less code).

4. **Stale cache cleanup priority**: P0 (always run после model ready) vs P1 (lazy on user idle). Decision: P0 fire-and-forget, low priority (Promise.resolve().then() chain), background безусловно.

5. **`abortSentence` actual cancellation**: v1.5 — generation-token-based (silent discard). v2 — `llama.rn ctx.stopCompletion(requestId)` integration. Add note в spec backlog reminder.

---

## 12. Out of scope reminder

См. §1.2. Defer:
- Full polysemy "Other senses ▾" list
- Full false-friend curated UI
- Idiom literal etymology dual-display
- Highlight unknown integration
- POS auto-detection
- CEFR auto-detection
- Concordance "Other usages ▾"
- TTS / IPA
- Long-tap heart → deck selector
- "I know this" / scroll-past signal
- Reading session density tracking

Backlog reminder: эти SLA gaps добавить в next iteration (#4.7 polish OR #6 Deck encounter ingestion).
