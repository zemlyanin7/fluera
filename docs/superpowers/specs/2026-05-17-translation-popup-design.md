# Sub-project #4.5 — Translation Popup Redesign

> Расширение #4 Translation engine: tiered popup, sentence-level translation
> в контексте, MWE/идиома pre-filter, false-friend detection, polysemy
> resolution с sense-aware кэшем.

**Дата:** 2026-05-17
**Зависимости:** #4 Translation engine (`LlamaTranslationService`, `CacheLayer`, `PromptBuilder`).
**Цель ветка:** `feat/translation-popup`
**Стэк:** поверх `feat/translation-engine` (PR #4).

---

## 0. Executive summary

#4 даёт MVP: тыкаешь слово → видишь one-word gloss. Этого мало по трём причинам:

1. **Translation theory** (Baker, Newmark, Nida): word не stable unit of meaning. *spring* = season / coil / verb / source. Контекст ОБЯЗАТЕЛЕН.
2. **SLA research** (Krashen, Lewis, Nation): vocab acquired через **chunks** (collocations, phrasal verbs), не single words. "Kick the bucket" не = {kick, the, bucket}.
3. **UX category**: gross gloss list overwhelms; raw "no context" answer wrong на 30%+ polysemous words.

#4.5 решает:

- **MWE/idiom pre-filter** — tap на word в идиоме → translate всё выражение.
- **Tiered popup** — gloss (context-resolved) → sentence translation w/ highlight → alternative senses.
- **Sense-aware cache** — cache key + sense_hash, не lemma.
- **False-friend chip** — warn при confident-wrong guess (Russian *магазин* ≠ magazine).
- **Multi-word selection** — drag/long-press для chunks.
- **Register tags** — `arch.`, `colloq.` (B2+ user level).

Сентенс-translation feature — opt-in secondary tap, не default (защищает noticing per Schmidt 1990; gloss + context-rich лучше для retention чем full L1 sentence dump — Hulstijn 1996).

---

## 1. Scope

### 1.1 Что входит

1. **MWE dictionary** seed (~3-10k per pair) + lookup pre-filter.
2. **Tiered TranslationPopup** UI redesign.
3. **Sentence-level translation** через explicit gesture (long-press / "?" affordance).
4. **Word-in-translated-sentence highlight** — show sentence both source/target с visible корреспонденцией.
5. **Polysemy sense resolution** + sense-aware cache key.
6. **False-friend table** + chip indicator.
7. **Multi-word selection** API в reader.
8. **Register tag** rendering в popup.

### 1.2 Out of scope

- ❌ Audio TTS (deferred → v3 roadmap).
- ❌ Etymology / IPA в popup (overload per UX research).
- ❌ Custom user-defined idiom additions (v2).
- ❌ Cross-language alignment learning (word-alignment ML model — too heavy).
- ❌ Per-genre/per-author prompt tuning.
- ❌ FSRS encounter-gating — это #6 Deck territory.

### 1.3 Что НЕ затрагивается из #4

- Model lifecycle (load/unload) — это #4.6.
- llama.rn integration / sampling params.
- Download flow / model storage.

---

## 2. Research basis (что говорят эксперты)

### 2.1 Translation theory (Mona Baker, Newmark, Nida)

- **Per-word без контекста = inadequate.** Baker *In Other Words* Ch.2 → 4 проблемы: propositional vs expressive, presupposed, evoked, lexical-set.
- **Idioms категорически fail на word-level.** Baker Ch.3. "Kick the bucket" не assembled из частей.
- **CAT-tool playbook** (Trados, memoQ): segmentation → termbase (MWE) → fragment match → word fallback. Stable профессиональный pattern.
- **Polysemy** — show **context-resolved sense first**, ranked alternatives second. Не raw dump.
- **Register preservation** — mark, не flatten. Tags типа `arch.`, `colloq.`.

### 2.2 SLA research (Krashen, Lewis, Nation, Schmitt)

- **Lexical chunks** (Lewis 1993 *The Lexical Approach*) — fluency built на pre-fabricated multi-word units, не on-the-fly composition.
- **Multi-word selection critical gap** в большинстве apps.
- **Involvement Load Hypothesis** (Laufer & Hulstijn 2001) — retention scales с Need + Search + Evaluation. *Evaluating* gloss vs context > passive gloss.
- **Noticing hypothesis** (Schmidt 1990) — form must be consciously noticed. Sentence translation **competes** с word-level encoding → readers offload meaning и skip noticing L2 form.
- **Hulstijn et al 1996**: L1 marginal glosses > no gloss. Sentence translation = high comprehension / low acquisition.
- **Encounter count** for acquisition: Webb 2007, Pellicer-Sánchez & Schmitt 2010 → 8-12 meaningful encounters. Range 6-20 (Nation 2013).

### 2.3 UX category

- **Two-tier disclosure** popup: min на tap + "more" gesture для full card. Anti-pattern: cramming everything в first tier.
- **Word-in-context default**, sentence translation secondary. Anti-pattern: always-on parallel paragraph display flattens cognitive challenge.
- **SRS auto-add WITH undo**. Without undo → deck pollution от accidental taps.
- **Popup covers tapped word** = anti-pattern. Forces re-tap для верификации.

### 2.4 Implication для нас

- Default: **short gloss (context-resolved)** на tap.
- Secondary gesture (long-press OR "?" button в popup): **sentence translation** w/ bilingual highlight.
- Disclosure: **alternative senses** (frequency-ranked).
- Chip: **false-friend warn** где applicable.
- Cache: key = `SHA256(lemma + sense_hash + lang_pair)`.

---

## 3. UI design

### 3.1 Popup states

```
┌────────────────────────────────────────┐
│  [WORD]                          ✕     │  ← header: tapped word, close
│  context: «..sentence..»               │  ← muted, sentence где word
│                                         │
│  gloss (resolved sense)         🚩 fr  │  ← Line 1: gloss + flag (false-friend)
│  • alt sense 1 (frequency-ranked)      │  ← collapsed by default
│  • alt sense 2                         │
│                                         │
│  [?] Перевести предложение целиком     │  ← affordance for sentence translation
│                                         │
│  [✓ Знаю] [📚 В словарь] [⏭ Дальше]  │  ← actions
└────────────────────────────────────────┘
```

После tap "[?]":

```
┌────────────────────────────────────────┐
│  [WORD]                          ✕     │
│                                         │
│  Source:  «...the spring of life...»  │  ← highlight WORD в source
│  Translation: «...источник жизни...» │  ← highlight TRANSLATED WORD в target
│                                         │
│  gloss: источник                       │
│  ...                                    │
└────────────────────────────────────────┘
```

### 3.2 Anti-patterns avoided

- **Popup НЕ ОТКРЫВАЕТСЯ поверх tapped word.** Position-aware: если tap в верхней половине → popup снизу; иначе сверху.
- **Tap-outside dismisses** + explicit close button. Consistent.
- **Min height** — НЕ shrink при collapsed disclosure.

### 3.3 Multi-word selection

User long-presses → drag handles появляются (как в native iOS text selection). Drag по word boundaries → selection range. Release → popup для **выделенного фразового перевода** (использует `translatePhrase` flow, всегда с sentence context).

### 3.4 Register tag rendering

Если cache result содержит `registerTag` (`arch.`, `colloq.`, `lit.`, `vulg.`) AND user.bookLanguageLevel >= B2 → render small chip справа от gloss line.

A1-B1: tag hidden (информационная перегрузка).

---

## 4. MWE / idiom dictionary

### 4.1 Source data

Seed CSV per language pair: `assets/mwe/{srcLang}-{dstLang}.csv` format:

```csv
mwe,translation,type,note
"kick the bucket","сыграть в ящик","idiom","euphemism for die"
"put up with","терпеть","phrasal_verb",""
"piece of cake","раз плюнуть","idiom",""
"in spite of","несмотря на","collocation",""
```

Source: Wiktionary "category:Idioms by language" + Russian Wiktionary "idiomatic expressions" (CC-BY-SA license — credit в About screen).

V1 размер: en→ru, ru→en, en→es, es→en, en→fr, fr→en, en→de, de→en, ja→en, ko→en — 10 pairs × ~5000 entries = ~50k rows. CSV bundle ~3MB compressed.

Other pairs: empty MWE — fallback на pure word translation.

### 4.2 Lookup algorithm

При tap на word `W` в sentence `S` с char position `pos`:

1. Build trie from MWE table at app startup (in-memory, 50k entries ~5MB RAM).
2. На tap: extract `±4 words` window around `W`.
3. Trie greedy longest-match: для каждого start position в window, ищем longest mwe spanning `pos`.
4. Если HIT: expand selection visually + использовать MWE translation как gloss.
5. Else: fall back to single-word translate с sentence context.

### 4.3 Storage

WatermelonDB новая таблица `MwePhrase`:

```sql
CREATE TABLE mwe_phrases (
  id TEXT PRIMARY KEY,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  phrase TEXT NOT NULL,
  translation TEXT NOT NULL,
  mwe_type TEXT,        -- 'idiom' | 'phrasal_verb' | 'collocation'
  note TEXT,
  source_attribution TEXT  -- 'wiktionary' для CC license tracking
);
CREATE INDEX idx_mwe_lang ON mwe_phrases(source_lang, target_lang);
CREATE INDEX idx_mwe_phrase ON mwe_phrases(phrase);
```

Seed на app first run из bundled CSV. WatermelonDB migration #N добавляет таблицу.

---

## 5. False-friend table

### 5.1 Source data

`assets/false_friends/{srcLang}-{dstLang}.csv`:

```csv
source_word,looks_like_native,actual_meaning
"магазин","magazine","shop (not magazine — that's журнал)"
"симпатичный","sympathetic","good-looking (not sympathetic)"
"фамилия","family","surname (not family — that's семья)"
```

Курация: Chamizo Domínguez 2008 *Semantics and Pragmatics of False Friends* + Wiktionary "category:false cognates".

Size: ~200-500 entries per pair, ~50KB compressed bundle.

### 5.2 UI

В popup line 1 (после gloss): если `(source_word, target_lang)` matches → render `🚩 false friend with «{looks_like_native}»` chip. Tap chip → expand `actual_meaning` note.

### 5.3 Storage

```sql
CREATE TABLE false_friends (
  id TEXT PRIMARY KEY,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  source_word TEXT NOT NULL,
  looks_like_native TEXT NOT NULL,
  actual_meaning TEXT NOT NULL
);
CREATE INDEX idx_ff_word ON false_friends(source_lang, target_lang, source_word);
```

---

## 6. Sense-aware cache

### 6.1 Problem

Текущий cache key (#4): `SHA256(word + context_window + lang_pair)`. Совпадение полного contextWindow → cache hit. Но: в разных книгах "spring" в похожих sentences про season → разный context_window → cache miss → re-inference. Wasteful.

### 6.2 Solution

Cache key = `SHA256(lemma + sense_id + lang_pair)`. Sense_id derived from LLM:

```
prompt = `Identify the sense of "{word}" in context "{sentence}".
Reply with single short label (season, coil, verb_jump, water_source, ...).`
```

LLM возвращает sense label → нормализуем (lowercase, strip whitespace) → use as sense_id.

**Сложность:** 1.25-bit Hy-MT 1.8B unreliable for sense labeling. Defer this до v2 if quality плохое.

### 6.3 V1 compromise

Cache key = `SHA256(word + first_3_content_words_of_sentence + lang_pair)`. Cheaper hash, more cache hits chем full-sentence, less granular чем sense_id.

`first_3_content_words`: extract via stopword filter (use лёгкий per-language stopword list from `assets/stopwords/{lang}.txt`).

### 6.4 Cache schema migration

```sql
ALTER TABLE translation_cache ADD COLUMN sense_hash TEXT;
ALTER TABLE translation_cache ADD COLUMN context_snippet TEXT;  -- for debugging
CREATE INDEX idx_cache_sense ON translation_cache(cache_key, sense_hash);
```

---

## 7. Sentence-level translation

### 7.1 Trigger

- Long-press на word (>500ms) → popup opens с sentence translation mode preselected.
- Short tap → popup с word mode.
- В word-popup есть "[?] Перевести предложение целиком" affordance — explicit gesture.

### 7.2 Implementation

```typescript
async translateSentence(input: SentenceTranslationInput): Promise<SentenceTranslationResult> {
  // 1. Cache lookup: SHA256(sentence + lang_pair)
  // 2. LLM prompt: `Translate to {dst}, preserve formatting:\n«{sentence}»`
  // 3. Cache write
  // 4. Return { sourceSentence, translatedSentence }
}
```

### 7.3 Word-in-sentence highlight

После sentence translation готова:

- Source: highlight tapped word position (already known).
- Target: **fuzzy alignment heuristic** — найти word в target sentence что:
  1. Matches word-level translation result (если есть).
  2. Иначе — character index proportional to source position.
  3. Fallback: highlight весь sentence.

Не используем ML word alignment (heavy + offline data).

---

## 8. Data types

### 8.1 Расширение `TranslationResult`

```typescript
// src/services/translation/ITranslationService.ts
export interface TranslationResult {
  status: TranslationStatus;
  translation?: string;
  /** Alternative senses ranked by frequency. */
  alternativeSenses?: Array<{ sense: string; translation: string }>;
  /** Register marker. */
  registerTag?: 'arch' | 'colloq' | 'lit' | 'vulg' | 'tech';
  /** False-friend warning. */
  falseFriend?: { looksLike: string; actualMeaning: string };
  /** Если перевод MWE/idiom — span в source sentence. */
  mwePhrase?: { phrase: string; type: 'idiom' | 'phrasal_verb' | 'collocation' };
  source?: TranslationSource;
  errorCode?: TranslationErrorCode;
  errorMessage?: string;
}

export interface SentenceTranslationInput {
  sentence: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
  /** Optional: highlight position в source. */
  wordOffset?: number;
}

export interface SentenceTranslationResult {
  status: 'ok' | 'error';
  sourceSentence?: string;
  translatedSentence?: string;
  /** Best-effort word position в target sentence для highlight. */
  translatedWordOffset?: number;
  errorCode?: TranslationErrorCode;
  errorMessage?: string;
}

export interface ITranslationService {
  translate(input: TranslationInput): Promise<TranslationResult>;
  translateSentence(input: SentenceTranslationInput): Promise<SentenceTranslationResult>;
  clearCache(): Promise<void>;
}
```

### 8.2 Расширения State Store

В Reader screen extended `popupState`:

```typescript
type PopupMode = 'word' | 'sentence';

interface PopupState {
  mode: PopupMode;
  word: string;
  sourceSentence: string;
  wordOffsetInSentence: number;
  status: 'loading' | 'ready' | 'error';
  result: TranslationResult | SentenceTranslationResult | null;
}
```

---

## 9. Files plan

### 9.1 Создаём

- `src/services/translation/mweDictionary.ts` — trie loader + lookup.
- `src/services/translation/falseFriendsDictionary.ts` — table loader + check.
- `src/services/translation/senseHash.ts` — `first_3_content_words` helper.
- `src/services/translation/stopwords.ts` — per-lang stopword loader.
- `src/db/migrations/0003-mwe-false-friends.ts` — new tables.
- `src/db/models/MwePhrase.ts`, `FalseFriend.ts` — WatermelonDB models.
- `src/db/repositories/MweRepository.ts`, `FalseFriendRepository.ts`.
- `assets/mwe/en-ru.csv`, ... (10 language pairs).
- `assets/false_friends/en-ru.csv`, ...
- `assets/stopwords/{en,ru,es,fr,de,it,pt,pl,uk,ja,ko,ar,hi}.txt`.
- `src/services/translation/seedDictionaries.ts` — first-run seeder.
- `src/components/reader/TranslationPopup.tsx` — redesign (replace existing minimal popup).
- `src/components/reader/SentenceTranslationView.tsx` — sentence display + highlight.
- `src/components/reader/PolysemyDisclosure.tsx` — collapsed alternative senses.

### 9.2 Изменяем

- `src/services/translation/LlamaTranslationService.ts` — add `translateSentence`, MWE pre-filter, sense-aware key.
- `src/services/translation/CacheLayer.ts` — sense_hash в key.
- `src/services/translation/PromptBuilder.ts` — sentence translation prompt, sense-resolution prompt (deferred).
- `src/services/translation/ITranslationService.ts` — extended types.
- `src/services/translation/NoOpTranslationService.ts`, `MockTranslationService.ts` — add `translateSentence` stub.
- `src/db/schema.ts` — schema version bump, add MWE + false_friends tables.
- `src/components/reader/BookRenderer.tsx` — multi-word selection (long-press drag handles).

---

## 10. Tests

### 10.1 Unit

- `mweDictionary.test.ts` — trie lookup correctness (greedy longest match, exact word boundaries, case-insensitive).
- `falseFriendsDictionary.test.ts` — lookup, missing entries.
- `senseHash.test.ts` — stopword filtering, hash stability.
- `TranslationPopup.test.tsx` — render все 3 tiers, collapse/expand, tap gestures.
- `SentenceTranslationView.test.tsx` — word highlight position calc, fuzzy alignment fallback.
- `LlamaTranslationService.test.ts` — MWE hit returns expanded phrase; sense-aware cache key; sentence translate path.

### 10.2 Integration

- Full popup flow: short tap → word mode → "[?]" → sentence mode → cache populated.
- Long-press → multi-word selection → phrase translate.
- False-friend chip rendering при applicable pair.

---

## 11. Inference parameters

### 11.1 Word translation (existing)

Greedy, max_tokens 64, repeat_penalty 1.3 (наследуется из #4 fixes).

### 11.2 Sentence translation (new)

- temperature: 0.3 (allow slight variation for fluency)
- top_p: 0.95
- max_tokens: 200 (sentence + buffer)
- repeat_penalty: 1.15 (looser — sentences naturally repeat structural tokens)
- stop: `['\n\n']` (paragraph break only)

Timeout: **45s** (longer chем word — context-rich, ~100-300 tokens out на typical sentence).

### 11.3 Sense resolution (deferred v2)

Не реализуем в v1 #4.5. Используем `first_3_content_words` proxy для cache key.

---

## 12. Performance budget

| Operation                          | Cache hit | Cache miss (inference) |
|-----------------------------------|-----------|------------------------|
| Word tap (no MWE)                  | <50ms     | 1-3s (warm) / 8s cold  |
| Word tap (MWE hit)                 | <100ms    | 1-3s                    |
| Sentence translation               | <100ms    | 5-15s (warm) / 25s cold|
| MWE trie lookup                    | <5ms      | —                       |
| False-friend lookup                | <5ms      | —                       |

MWE/FF lookups synchronous in JS — таблицы in-memory.

---

## 13. Privacy + Security

- MWE + false-friend tables — read-only, bundled, no PII.
- Sense-hash в cache key — content-derived, не user-identifying.
- Sentence translation cache stores user's reading content. Subject к 90-day purge (already в #4 flow).
- "Clear all my data" reset wipes sentence cache + MWE seeds preserved.

---

## 14. Settings extensions

В `SettingsStore`:

```typescript
// AsyncStorage allowlist additions:
showSentenceTranslation: boolean;        // existing — wire up
showRegisterTags: boolean;               // new, default false; auto-true at B2+
sentenceTranslationGesture: 'long_press' | 'button' | 'both'; // default 'both'
mweAutoExpand: boolean;                  // tap inside MWE auto-expands selection, default true
falseFriendsEnabled: boolean;            // default true
```

В Settings panel → Translation section: добавить под Translation Model:

```
[ ] Показывать перевод предложения по long-press
[ ] Помечать ложные друзья переводчика
[ ] Показывать регистр (формальность)
```

A1-B1 user: register hidden by default. B2+: shown.

---

## 15. Errors

| Code                          | Trigger                                  | UI message                                          |
|-------------------------------|------------------------------------------|-----------------------------------------------------|
| SENTENCE_TOO_LONG             | sentence > 500 chars                     | "Слишком длинное предложение. Выберите фрагмент."   |
| MWE_TABLE_NOT_LOADED          | MWE bundle missing для pair              | "Идиомы для {pair} пока недоступны"                |
| ALIGNMENT_FAILED              | word position в target не найдена        | (silent — highlight весь sentence)                  |

Существующие из #4 (MODEL_NOT_INSTALLED, MODEL_LOADING, INFERENCE_TIMEOUT, INFERENCE_FAILED, EMPTY_RESPONSE) — наследуются.

---

## 16. Migration plan

### 16.1 DB migration

Schema version bump (#2 had 1, #4 had 1 → now 2):

```typescript
// src/db/schema.ts
export const SCHEMA_VERSION = 2;
```

`src/db/migrations/0003-mwe-false-friends.ts`:

```typescript
import { schemaMigrations, createTable, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        createTable({
          name: 'mwe_phrases',
          columns: [
            { name: 'source_lang', type: 'string' },
            { name: 'target_lang', type: 'string' },
            { name: 'phrase', type: 'string', isIndexed: true },
            { name: 'translation', type: 'string' },
            { name: 'mwe_type', type: 'string' },
            { name: 'note', type: 'string', isOptional: true },
            { name: 'source_attribution', type: 'string' },
          ],
        }),
        createTable({
          name: 'false_friends',
          columns: [
            { name: 'source_lang', type: 'string' },
            { name: 'target_lang', type: 'string' },
            { name: 'source_word', type: 'string', isIndexed: true },
            { name: 'looks_like_native', type: 'string' },
            { name: 'actual_meaning', type: 'string' },
          ],
        }),
        addColumns({
          table: 'translation_cache',
          columns: [
            { name: 'sense_hash', type: 'string', isOptional: true },
            { name: 'context_snippet', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
```

### 16.2 First-run seeder

`seedDictionaries.ts` запускается из `LlmBootstrap` если `mwe_phrases.count() === 0`:

```typescript
async function seedMweDictionaries(db: Database): Promise<void> {
  const supported = ['en-ru', 'ru-en', 'en-es', 'es-en', /* ... */];
  for (const pair of supported) {
    const csv = await loadAsset(`mwe/${pair}.csv`);
    const rows = parseCsv(csv);
    await db.batch(rows.map(row => /* prepareCreate ... */));
  }
}
```

Idempotent — checks count first.

---

## 17. Done criteria

- [ ] MWE table seeded для 10 language pairs.
- [ ] False-friend table seeded для top 6 pairs (en-ru, en-es, en-fr, en-de, ru-en, es-en).
- [ ] TranslationPopup redesigned (tiered: gloss → senses disclosure → sentence affordance).
- [ ] `translateSentence` метод implemented + tested.
- [ ] Long-press → sentence mode trigger working.
- [ ] Multi-word selection (drag) → phrase translate working.
- [ ] Sense-aware cache key migrated (`first_3_content_words` proxy).
- [ ] Register tags rendering (gated by user level).
- [ ] False-friend chip + expand on tap.
- [ ] Settings toggles wired up (showSentenceTranslation, falseFriendsEnabled, showRegisterTags).
- [ ] Unit tests passing (MWE trie, false-friend lookup, sense hash).
- [ ] Integration test: short tap → word mode; long-press → sentence mode.
- [ ] DB migration 1 → 2 tested.
- [ ] CSV assets bundled + first-run seed verified.
- [ ] No regression в #4 word translation flow.

---

## 18. Out of scope (для #4.5)

- ❌ ML word alignment (использует heuristic offset).
- ❌ User-editable MWE additions.
- ❌ Audio TTS pronunciation.
- ❌ Etymology / morphology display.
- ❌ Per-genre prompt tuning.
- ❌ Encounter-count gating SRS (это #6 Deck).
- ❌ Two-mode reading (Study vs Flow) — #4.7 candidate.
- ❌ Optional inference delay / "guess first" — #4.7 candidate.

---

## 19. Open questions

1. **Intl.Segmenter availability в Hermes (SDK 54)?** Translation theory recommends ICU segmentation для sentence boundary detection. Если Hermes не поддерживает — fallback regex + per-language abbreviation list. **Verify** перед commit.

2. **MWE bundle size**: 10 pairs × ~5000 entries CSV bundle ≈ 3MB. App bundle currently ~25MB without model. +3MB acceptable? Альтернатива: download MWE по требованию первого запуска. **MVP: bundle.**

3. **Hy-MT 1.25bit квалифицирована для sentence translation?** Word-level OK с tuning. Sentence-level — больше output tokens, sampling noise multiplies. Возможно требуется fallback на cloud для sentences. **Test первое — defer cloud fallback до confirmed boundary.**

4. **False-friend chip — clickable expand или inline?** Compact: inline `🚩 ≠ magazine`. Disclosure: `🚩 false friend` → tap → full explanation. **MVP: tap-to-expand** (matches UX two-tier disclosure pattern).

5. **Register tag tie к bookLanguageLevel** — currently CEFR A1-C2. Use Foundation setting. Auto-show B2+. User can override (settings toggle `showRegisterTags`).
