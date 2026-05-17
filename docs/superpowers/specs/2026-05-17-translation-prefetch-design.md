# Sub-project #4.6 — Translation Prefetch + Idle Unload (v2.1)

> Расширение #4 Translation engine: prefetch following pages в фоне, idle
> unload model из RAM, memory-pressure / battery throttle. Цель — instant
> translation popup + low resident memory footprint. v2.1 incorporates TWO
> rounds of expert review.

**Дата:** 2026-05-17
**Версия:** v2.1 (после round-2 review)
**Зависимости:** #4 Translation engine, #4.5 Popup redesign (для sentence translation в prefetch batch).
**Ветка:** `feat/translation-prefetch`
**Стэк:** поверх `feat/translation-popup` (#4.5).

---

## Changelog v2 → v2.1 (round-2 review)

**Bug fixes**:

- **Priority inversion (ML round-2 BLOCK)**: sentence prefetch 5-15s блокировало user tap (≤3s contract). **Fix**: cap any single batch inference к word-mode budget (max 32 tokens, ~3s) per individual job. Long sentences split к multiple jobs. User tap preempts at job boundary, не mid-decode (acceptable — within 3s).
- **"Always" в "Keep translator ready" copy contradiction**: "Always" never unloads → conflict с background force-unload rule. **Fix**: dropdown options reduced к "5 min after use (recommended) / Only when needed". Removed "Always" — contradicted §3.2.
- **Lemmatization scope reduced**: ship heuristic только для 5 languages с precision ≥75% (en, es, fr, it, pt). For ru/uk/pl/de/ar/hi/ja/ko — surface form only (accepted prefetch waste 20-60%). Honest precision claim vs "we tried" theater.
- **JA/KO prefetch default OFF**: 60% surface variants cached as wrong-form authoritative = learners get poisoned. User can opt in for raw cache speed via Advanced.

**Scope cuts** (contrarian):

- **CUT diagnostic bundle export** — нет backend, no support inbox. Replace с standard React Native console.log access via dev menu (Cmd+D iOS sim, Cmd+M Android emulator). Production users без troubleshooting path acknowledged; if real demand, add back v2.
- **SIMPLIFY atomic model upgrade** — drop "test-load-before-commit" step. Sequence: download → SHA verify → atomic rename → on next app launch если context fails to load, revert pointer + surface error. Saves one model load на upgrade path.

**Pedagogy refinements** (SLA round-2):

- **`WordStatus.encounters` schema split**: `lookup_count` (popup tap-driven) + `passive_encounters` (viewport-render-driven). Migration handled в #6 Deck. v2.1 #4.6 placeholder reads schema, writes only к `lookup_count` increment via popup. `passive_encounters` increment owned by #6.
- **Prefetch eviction by `last_user_tap_at` per book** (round-2 SLA finding) — оставляем active reading book's cache, evict by tap recency, not insert time.

**Translation correctness** (translator round-2):

- **Atomic upgrade cache invalidation softer**: keep old cache labeled `model_version_obsolete` (per #4.5 §6.1). User-driven re-translate via Settings, not silent purge.
- **Per-pair chrF threshold table from #4.5 §11.3** — sentence prefetch honors per-pair thresholds (pair below threshold → skip sentences, words only).

**A11y**:

- **Battery low/LowPower indicator role="alert"** — first appearance announced.
- **Shimmer LiveRegion debounce 300ms** — only announce если loading >800ms (avoid flicker noise on warm reload).
- **Permanent disable error в Settings** — `accessibilityRole="alert"` на first appearance, static thereafter.

---

## Changelog v1 → v2

**Принятые findings:**

- **Lemmatization plan** explicit: suffix-stripping heuristic + ~70% precision documented для RU/UK/PL/AR/HI/JA/KO. Hunspell/Sudachi too heavy для v1.
- **Cache poisoning protection**: prefetch results tagged `source: 'prefetch'`, shorter TTL (30 days vs 90 для on-demand), optional verification on user tap.
- **MWE prefetch**: prefetch также enqueues MWE matches найденные в upcoming pages, не только single lemmas.
- **n_ctx 4096 + cache_prompt: true** — biggest perf win, был omitted. Bumped via createLlamaLoader.
- **Cache row math fixed**: 200k cap, не 10k (realistic at 125k+ across 50 books).
- **Composite uniqueness** key для collision safety.
- **MWE trie lazy load per-pair при book open**.
- **Atomic model upgrade**: .partial → SHA verify → rename + delete old.
- **Permanent disable** после 3 consecutive load failures (SecureStore flag, survives "clear data").
- **Disk space runtime purge policy**: < 200MB free → auto-purge sentence cache → trim words → prompt delete model.
- **Export diagnostic bundle** action (replaces missing telemetry) — redacted JSON: last 50 cache misses (hash-only), inference durations, lifecycle, thermal/battery snapshots, model SHA, kernel build.
- **Kernel verification script** в CI на каждый llama.rn bump.
- **Real-device benchmarks** — blocking action item ДО implementation start.
- **Prefetch progress UI**: production = binary indicator only ("ready" / "paused"). Numeric progress dev-only behind hidden flag.
- **"Idle unload" copy**: rewrite to "Keep translator ready: Always / 5min after use / Only when needed".
- **Encounter badge data source**: WordStatus.encounters incremented at popup open (debounced 5s).

**Отклонённые findings** (под reading-first product vision):
- **Encounter-gated prefetch**: defeats prefetch purpose. Замена — encounter badge в popup (#4.5).
- **Coverage-gated UX prominence**: hostile pattern.
- **Halve CEFR cutoffs** (lemma→family): academic, more popup spam.
- **Flow mode UI**: schema field reserved only.

---

## 0. Executive summary

#4 держит модель в RAM постоянно (~500MB-1GB включая KV cache). Это:

- Risks **jetsam на 3-4GB devices** (iPhone SE 2/3, base 13/14, low-end Android).
- Wastes **battery** (Metal/CPU contexts idle but mapped).
- Hurts other apps (memory pressure → OS kills background apps).

#4.6 решает через **lifecycle state machine** с triggers:

1. **5min foreground idle** → unload context, keep file mapped.
2. **App background** → unload immediately (WWDC18 recommendation).
3. **Memory pressure** → unload unconditionally (v1: AppState fallback; v2: native module).
4. **Lazy reload** на first cache miss → shimmer popup → ready.

**Prefetch** populate'ит cache из background:

- Reader idle ≥ 20s + model loaded/loading → batch-translate pages N+1..N+3 (N+5 if charging/battery>50%).
- 30-50 words per batch.
- User tap **preempts** prefetch — cancel current job, requeue.
- Thermal/battery throttle.
- **Foreground only** в v1 (BGTaskScheduler iOS gates too restrictive).
- **Tagged provenance**: `source: 'prefetch'`, shorter TTL.

После prefetch batch + 5min idle → unload → cache populated → user reads с zero latency.

---

## 1. Scope

### 1.1 Что входит

1. **`ModelLifecycleManager`** — state machine с lifecycle triggers.
2. **Idle timer** — 5min без user inference → unload.
3. **AppState integration** — background → immediate unload.
4. **Lazy reload** flow + shimmer UI.
5. **Priority inference queue** — user > prefetch.
6. **`PrefetchScheduler`** — extracts upcoming pages, batches words + MWE.
7. **Unknown-word detection v1** — CEFR cutoff + WordStatus history + lemmatization heuristic.
8. **Lemmatization heuristic** — suffix-stripping for Slavic, prefix-stripping for Arabic, surface forms для CJK.
9. **Frequency lists** bundle для 13 languages.
10. **Thermal + battery throttle** через `expo-battery` (thermal deferred to v2).
11. **Cache poisoning protection** — tag prefetch source + shorter TTL.
12. **Atomic model upgrade** (.partial → SHA → rename).
13. **Permanent disable** after 3 load failures.
14. **Disk space runtime purge policy**.
15. **Export diagnostic bundle** action.
16. **Kernel verification script** + CI integration.
17. **MWE prefetch** — также enqueue MWE matches.
18. **n_ctx 4096 + cache_prompt: true** для KV reuse.
19. **WordStatus.encounters increment** при popup open (debounced).

### 1.2 Out of scope

- ❌ BGTaskScheduler iOS background prefetch (v2).
- ❌ Pre-translate sentences для всей книги — это **#4.7**.
- ❌ Cloud fallback при cold model (v2).
- ❌ Multi-context inference (single context v1).
- ❌ Audio TTS prefetch (deferred с TTS feature).
- ❌ FSRS encounter tracking SRS — это #6 Deck.
- ❌ Custom memory pressure native module (v1: AppState fallback).
- ❌ Custom thermal native module (v1: skip throttle, accept jetsam risk).
- ❌ Heavy lemmatizers (Hunspell/Sudachi) — heuristic only.
- ❌ Per-genre prefetch tuning.

### 1.3 Что НЕ меняем

- llama.rn integration / sampling.
- MWE / false-friend lookups (#4.5).
- Popup UI (#4.5).
- Download / install flow (#4).

---

## 2. Research basis

### 2.1 Mobile LLM lifecycle (best practice)

- **Apple WWDC18 Session 416 "iOS Memory Deep Dive"** — release large resources на `didEnterBackground`. ~50% memory budget cut в background.
- **Apple `applicationDidReceiveMemoryWarning`** — proactive release before jetsam.
- **Android `ComponentCallbacks2.onTrimMemory`** — phased: `TRIM_MEMORY_UI_HIDDEN` → `TRIM_MEMORY_RUNNING_LOW`+ → `TRIM_MEMORY_COMPLETE`.
- **iOS jetsam** unpublished device-specific limits, ~1GB resident risky на 3-4GB devices.

### 2.2 Prefetch + reading patterns

- Page-dwell median **15-25s** mobile → 20s prefetch trigger.
- **Sweet spot pattern**: warm-up + reactive cache > blind batch. Our extension: gated batch с user signals.

### 2.3 Production ML systems

- Cold inference output drift → tag + don't persist к DB.
- Cache versioning required при model upgrades (#4.5 §6.1).
- KV cache reuse через `cache_prompt: true` = single biggest perf win.
- No telemetry → in-app diagnostic export replaces.

### 2.4 Lemmatization realism

- **Hunspell** mobile: JNI complexity + ~5MB per language dict — too heavy v1.
- **Sudachi (JA)** Java-only — JNI bridge needed.
- **mecab-lite**, surface-form fallback acceptable для unknown-word detection precision ~70%.
- **Suffix stripping** для Slavic langs (RU/UK/PL): простой algorithmic approach, false-positive rate ~15-25%.
- **Prefix stripping** для AR/HI: similar tradeoff.
- **Surface forms only** for JA/KO: accept 2-3x prefetch waste, document.

---

## 3. State machine

### 3.1 States

```
UNLOADED  — нет context в RAM, файл mapped on disk
LOADING   — initLlama в полёте
READY     — context loaded, idle
INFERRING — inference в полёте
ERROR     — load failed; recover via user action OR permanent disable
```

### 3.2 Transitions

```
UNLOADED ─(user tap | prefetch trigger)→ LOADING
LOADING  ─(success)→ READY
LOADING  ─(error, attempt < 3)→ ERROR (recoverable)
LOADING  ─(error, attempt ≥ 3)→ ERROR_PERMANENT (SecureStore flag)
READY    ─(user inference enqueued)→ INFERRING (resets idle timer)
READY    ─(prefetch inference enqueued)→ INFERRING (NOT reset idle timer)
INFERRING ─(complete)→ READY
READY    ─(5min idle | background | memory pressure)→ UNLOADED
INFERRING ─(memory pressure | background)→ INFERRING then UNLOADED
                                            (current job ≤3s, then unload)
ERROR    ─(resetError CTA | retry trigger)→ UNLOADED
ERROR_PERMANENT ─(user manual clear flag)→ UNLOADED
```

### 3.3 Implementation

```typescript
// src/services/translation/ModelLifecycleManager.ts
type LifecycleState = 'unloaded' | 'loading' | 'ready' | 'inferring' | 'error' | 'error_permanent';

export class ModelLifecycleManager {
  private static singleton: ModelLifecycleManager | null = null;
  private state: LifecycleState = 'unloaded';
  private context: LlamaContext | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private idleMs = 5 * 60 * 1000;
  private consecutiveLoadFailures = 0;
  private serial: Promise<unknown> = Promise.resolve();
  private prefetchQueue: PrefetchJob[] = [];

  // Triggers
  onUserTap(): void { /* preempt prefetch, ensure loaded, reset idle */ }
  onAppBackground(): void { /* force unload */ }
  onMemoryPressure(): void { /* force unload */ }
  onIdleTimeout(): void { /* unload if ready */ }
  onBatteryStateChange(pct: number, charging: boolean, lowPower: boolean): void { /* gate prefetch */ }
  onThermalStateChange(level: ThermalLevel): void { /* throttle prefetch (v2) */ }

  // Inference API
  async runUserInference(prompt: string, config: InferenceConfig): Promise<InferenceResult> {
    await this.ensureLoaded();
    this.resetIdleTimer();
    const ctx = this.context!;
    return this.serializedRun('user', () => ctx.completion(prompt, config));
  }

  async runPrefetchInference(prompt: string, config: InferenceConfig): Promise<InferenceResult | null> {
    if (!this.canPrefetch()) return null;
    await this.ensureLoaded();
    // НЕ reset idle timer — prefetch doesn't count as user activity
    const ctx = this.context!;
    return this.serializedRun('prefetch', () => ctx.completion(prompt, config));
  }

  getSnapshot(): LifecycleSnapshot { /* state + battery + thermal + idle elapsed */ }

  // Permanent disable
  async checkPermanentDisable(): Promise<boolean> {
    return (await SecureStore.getItemAsync('llm_permanently_disabled')) === '1';
  }

  async clearPermanentDisable(): Promise<void> {
    await SecureStore.deleteItemAsync('llm_permanently_disabled');
    this.consecutiveLoadFailures = 0;
    this.state = 'unloaded';
  }
}
```

### 3.4 Idempotency

- `ensureLoaded()` deduplicates concurrent LOADING.
- `unload()` no-op if UNLOADED.
- `onMemoryPressure()` aborts pending prefetch jobs.
- 3 consecutive load failures → set `llm_permanently_disabled` in SecureStore, surface UI "Translation unavailable on this device. See Settings to retry."

---

## 4. Idle unload mechanics

### 4.1 Timer reset rules

- User inference → reset timer.
- Prefetch inference → **does NOT** reset timer.
- Reader scroll (debounced) → reset timer (user активен).
- Background → force unload (regardless of timer).

### 4.2 Unload implementation

```typescript
async unload(): Promise<void> {
  if (this.state === 'unloaded' || this.state === 'unloading') return;
  this.state = 'unloading';
  if (this.context) {
    await this.context.release();
    this.context = null;
  }
  this.state = 'unloaded';
  useLlmStatusStore.getState().setStatus('installed');
}
```

### 4.3 Lazy reload UX (shimmer)

User tap после unload:

1. Translate service `lookup()` → cache miss.
2. Status `installed` → call `ensureLoaded()`.
3. State `unloaded → loading` → Popup status `loading` → render shimmer "Готовлю переводчик…" + `accessibilityLiveRegion="polite"` announcement.
4. Load done → status `ready` → translate proceeds.

Visible latency: **5-8s** на cold reload. Shimmer animation + LiveRegion announce, НЕ blocking spinner.

**Reduce Motion**: shimmer → static "Загрузка переводчика…" text.

### 4.4 Atomic model upgrade (v2.1 simplified)

```
Old model: Documents/llm/Hy-MT1.5-1.8B-1.25bit.gguf (current)

Upgrade process (simplified per contrarian round-2):
1. Download new model → Documents/llm/Hy-MT1.6.gguf.partial
2. Verify SHA-256 (size + bytes match new manifest)
3. If verify passes:
   a. Atomic rename: .partial → Hy-MT1.6.gguf
   b. Update model manifest pointer
   c. Mark old cache rows `model_version_obsolete` (не purge)
   d. Schedule old file deletion на next app launch
4. On next app launch:
   a. Try load new model.
   b. Success → delete old Hy-MT1.5 file.
   c. Failure → revert pointer (manifest fallback), keep old file, surface error.
5. If step 2 verify fails: delete .partial, keep current.
```

**v2.1 change**: removed "test-load-before-commit" step. Saves one model load on upgrade path. Acceptable: на next-launch failure user gets one error, falls back к prev model. Не bricked state.

**Cache invalidation softer** (translator round-2): old cache labeled `model_version_obsolete`, не silent purge. User sees per-book "translated by older model — re-translate?" prompt. Avoids 150MB+ data loss surprise.

---

## 5. Memory pressure integration

### 5.1 V1 simplification

**AppState only** в v1. Memory pressure handler deferred к v2 unless real-device testing shows jetsam issues.

```typescript
AppState.addEventListener('change', (next) => {
  if (next === 'background' || next === 'inactive') {
    ModelLifecycleManager.instance().onAppBackground();
  }
});
```

### 5.2 V2 native module

`modules/MemoryPressure/`:

**iOS** (`MemoryPressureObserver.m`):
```objc
[[NSNotificationCenter defaultCenter]
  addObserver:self selector:@selector(handleMemoryWarning)
  name:UIApplicationDidReceiveMemoryWarningNotification object:nil];
```

**Android** (`MemoryPressureModule.java`):
```java
public void onTrimMemory(int level) {
  if (level >= TRIM_MEMORY_RUNNING_LOW) {
    sendEvent("memory_pressure", { level });
  }
}
```

Bridge → `ModelLifecycleManager.onMemoryPressure()`.

---

## 6. Prefetch scheduler

### 6.1 Trigger conditions (ALL must be true)

1. Reader screen mounted + book loaded.
2. No scroll event ≥ 20s.
3. Model state `ready` OR queued для load.
4. Battery: charging OR > 20%.
5. `LowPowerMode` (iOS) / `PowerSaveMode` (Android) OFF.
6. Thermal state < `serious` (iOS) / < `MODERATE` (Android) — v2 (v1 skip throttle).
7. App в foreground.
8. Prefetch не in progress.
9. **`llm_permanently_disabled` flag not set**.

### 6.2 Unknown-word detection v1 (heuristic)

```typescript
async function findCandidateWords(
  pages: ChapterContent[],
  bookLanguageLevel: CEFRLevel,
  knownWords: Set<string>,
  language: BookLanguage,
): Promise<{ words: string[], mwes: MwePhrase[] }> {
  const freqList = await loadFrequencyList(language);
  const cutoff = freqCutoffByCEFR(bookLanguageLevel);
  // A1=500, A2=1000, B1=3000, B2=6000, C1=10000, C2=20000 (heuristic, documented)
  const knownByLevel = new Set(freqList.slice(0, cutoff));

  const wordCandidates = new Set<string>();
  const mweCandidates = new Map<string, MwePhrase>();

  for (const page of pages) {
    const text = extractText(page);

    // Stage 1: MWE matches via current book's pair trie
    const mweHits = mweTrie.scan(text);
    for (const hit of mweHits) {
      mweCandidates.set(hit.phrase, hit);
    }

    // Stage 2: Single-word lemmas
    for (const word of extractWords(text)) {
      // Lemmatization heuristic (per-language)
      const lemma = lemmatizeHeuristic(word, language);
      // Proper noun filter (capitalized + not sentence-initial)
      if (isProperNounHeuristic(word, text)) continue;
      if (knownByLevel.has(lemma)) continue;
      if (knownWords.has(lemma)) continue;
      wordCandidates.add(lemma);
    }
  }

  return { words: Array.from(wordCandidates), mwes: Array.from(mweCandidates.values()) };
}
```

`knownWords` = WordStatus rows с `state IN ('known', 'mastered', 'learning')`.

### 6.3 Lemmatization heuristic — 5 languages only (v2.1 scope cut)

Per contrarian round-2 finding: lemmatization heuristic для langs с precision <75% = engineer pride + battery cost без user value. **v2.1 ships heuristic ТОЛЬКО для 5 languages**. Остальные 8 — surface form fallback с documented acceptance of prefetch waste.

```typescript
function lemmatizeHeuristic(word: string, lang: BookLanguage): string {
  const lower = word.toLowerCase();
  switch (lang) {
    case 'en':
      // English: strip common suffixes (-ing, -ed, -s, -es, -ies). Precision ~85%.
      return stripEnglishSuffix(lower);
    case 'es':
    case 'fr':
    case 'it':
    case 'pt':
      // Romance: strip conjugation/plural. Precision ~80%.
      return stripRomanceSuffix(lower);

    // v2.1: NO heuristic для следующих langs — surface form only.
    // Rationale: precision <75% wastes battery without meaningful improvement.
    // Future v2 path: lightweight per-lang lemmatizer (hunspell affixtable, etc).
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

**Documented precision** (only shipped langs):
- en: ~85% (well-known suffix patterns)
- es/fr/it/pt: ~80% (regular conjugation)

**Surface-form-only langs** (documented prefetch waste estimate):
- ru/uk/pl: 2-3x waste (rich morphology)
- de: 2x waste (compounds + plural)
- ar/hi: 2-3x waste (multi-prefix)
- ja/ko: 3-4x waste (no whitespace, agglutinative)

**JA/KO prefetch default OFF** v2.1: 60% surface variants cache as wrong-form authoritative для learners. User can opt-in via Advanced settings flag `enableJaKoPrefetch: false` (default false).

### 6.4 Proper noun filter

```typescript
function isProperNounHeuristic(word: string, sentenceText: string): boolean {
  // Capitalized + not sentence-initial = likely proper noun
  if (word[0] !== word[0].toUpperCase()) return false;
  // Check if word is at sentence start (skip filter)
  const wordIdx = sentenceText.indexOf(word);
  if (wordIdx <= 1 || sentenceText[wordIdx - 2] === '.') return false;
  return true;
}
```

False positives: проблема для немецкого (все Nouns capitalized) → disable filter для DE. Документировано.

### 6.5 Frequency lists

`assets/freq/{lang}.txt` — top 20k lemmas. Sources:
- **English**: subtitle corpus (OpenSubtitles, CC).
- **Russian**: НКРЯ public freq lists.
- Other 11: equivalent open corpora or Wiktionary frequency lists.

Size: 20k × ~10 bytes × 13 langs ≈ 2.6MB. Bundle.

**Curation pass**: pre-bundle filter — strip top-1k personal names ("Pierre", "Анна"), strip article-only entries, manual audit per language. Documented в `scripts/freq-curate.ts`.

### 6.6 Batch sizing + cadence

- Batch: **30-50 words OR 5-10 MWE** per scheduling tick.
- Tick interval: на batch complete, schedule next ~1s later (yield event loop).
- Stop conditions: pages N+1..N+5 fully translated OR user scroll OR throttle trigger.

### 6.7 Cancellation

User tap → user-priority job inserted at queue head. Current prefetch:
- **V2.1 capped jobs**: every batch inference job capped к **word-mode budget** (max 32 tokens, ~3s warm). Long sentence prefetch (~10-15s) split к multiple jobs (one per sentence). User tap preempts at job boundary, не mid-decode — within 3s SLA.
- **V2+ ideal**: `llama_decode` interrupt mid-token (investigate llama.rn API).

Cancelled prefetch word **requeued** at end of queue (not lost).

### 6.8 Sentence prefetch (depends on #4.5)

Если #4.5 chrF gate passed для pair: enqueue **unique sentences** containing candidate words. Translate via `translateSentence` API. Populates sentence cache.

**Per-pair gating**: только pairs с chrF ≥ 40 (#4.5 §11.3).

### 6.9 Cache poisoning protection

Per #4.5 §6.2: prefetch inference tagged `source: 'prefetch'`.

```typescript
interface CacheRow {
  cache_key: string;
  word: string;
  // ... existing fields
  source: 'on_demand' | 'prefetch';
  inference_context: InferenceContext;
  ttl_days: number;  // 90 для on_demand, 30 для prefetch
}
```

**Rule**: prefetch entries TTL 30 days vs on-demand 90 days. Purge job aware of source.

**Optional verification** (v2): on user tap → если cache hit `source: 'prefetch'` AND popup mode = sentence → re-verify по second pass. Тут v1 пока accept prefetch as authoritative (latency win > theoretical poison risk).

---

## 7. Native modules для thermal + battery

### 7.1 Battery (`expo-battery`)

Available SDK 54.

```typescript
import * as Battery from 'expo-battery';

const subscription = Battery.addBatteryLevelListener((event) => {
  ModelLifecycleManager.instance().onBatteryStateChange(
    event.batteryLevel,
    /* charging */ await Battery.getPowerStateAsync().lowPowerMode,
  );
});
```

### 7.2 Thermal — v2 deferred

iOS `ProcessInfo.thermalState`, Android `PowerManager.getCurrentThermalStatus` — custom native module nontrivial.

**v1**: skip throttle. Accept that prefetch может потеплить device. If real-device benchmarks показывают thermal jetsam, add module v2.

**Workaround**: low-priority (NSQualityOfServiceUtility / Android `THREAD_PRIORITY_BACKGROUND`) thread для prefetch — partial thermal mitigation.

---

## 8. Inference parameter updates (для sentence prefetch)

### 8.1 createLlamaLoader bump

```typescript
export async function createLlamaLoader(): Promise<LlamaContext> {
  const native = await initLlama({
    model: getModelLocalPath(),
    n_ctx: 2048,        // bumped from 1024 для sentence support (#4.5 §11.2)
    n_gpu_layers: 99,
    n_threads: 4,
    cache_prompt: true, // v2: KV cache reuse across batched sentence translations
  });
  return new LlamaContextAdapter(native);
}
```

**KV cache reuse через `cache_prompt: true`** — single biggest perf optimization. Без него каждое sentence translation re-tokenizes system prompt + sentence start. С ним — prompt prefix shared in KV cache → 30-50% faster prompt eval.

### 8.2 Sentence prefetch n_ctx requirement

Prompt + sentence (200 chars max) + 200 output tokens ≈ 800 tokens. `n_ctx 2048` provides комфортный headroom for batched sentence translations within same context lifetime.

---

## 9. Diagnostic — v1 dev console only

**v2.1 scope cut** (contrarian): diagnostic bundle export action removed. Нет backend, no support inbox → zero usage anticipated.

**V1 dev diagnostic path**: standard React Native dev menu (Cmd+D iOS sim, Cmd+M Android emulator) gives console access. `__DEV__ console.log` outputs lifecycle/inference events. Production users без troubleshooting path acknowledged — re-evaluate need в v2 если support volume warrants.

---

## 10. Kernel verification + CI

### 10.1 Verification script

`scripts/verify-kernel.ts`:

```typescript
const FIXTURE_PROMPTS = [
  { prompt: "Translate to Russian: hello", expectedOutput: "привет" },
  { prompt: "Translate to Russian: world", expectedOutput: "мир" },
  // 10 fixtures total, hand-curated, temp=0, n_predict=8
];

async function verifyKernel() {
  const ctx = await initLlama({ model: MODEL_PATH, n_ctx: 512 });
  for (const fixture of FIXTURE_PROMPTS) {
    const result = await ctx.completion({
      messages: [{ role: 'user', content: fixture.prompt }],
      jinja: true,
      temperature: 0.0,
      top_k: 1,
      n_predict: 8,
    });
    const normalized = result.text.trim().toLowerCase();
    if (normalized !== fixture.expectedOutput) {
      console.error(`MISMATCH: prompt="${fixture.prompt}" expected="${fixture.expectedOutput}" got="${normalized}"`);
      process.exit(1);
    }
  }
  console.log('All kernel verification fixtures passed');
}
```

### 10.2 CI integration

`.github/workflows/kernel-verify.yml`:

```yaml
on:
  pull_request:
    paths:
      - 'vendor/llama.rn/cpp/**'
      - 'src/services/translation/modelManifest.ts'

jobs:
  verify-kernel:
    runs-on: macos-14
    steps:
      - checkout
      - setup-node
      - install dependencies
      - build llama.rn cpp/
      - run scripts/verify-kernel.ts
```

PR blocked unless verification passes.

---

## 11. FLORES eval harness (cross-reference #4.5 §11.3)

Shared с #4.5 sentence translation gate. Re-stated here для prefetch context:

- `scripts/eval/translate-flores.ts` — 200 FLORES dev sentences per pair.
- Gate: chrF ≥ 40 для shipping sentence translation.
- **Sentence prefetch** в #4.6 §6.8 honors per-pair gate — only enqueue sentences для pairs ≥ threshold.

---

## 12. Data types

### 12.1 LifecycleManager API

```typescript
// src/services/translation/ModelLifecycleManager.ts

export type ThermalLevel = 'nominal' | 'fair' | 'serious' | 'critical';
export type InferencePriority = 'user' | 'prefetch';
export type LifecycleState = 'unloaded' | 'loading' | 'ready' | 'inferring' | 'error' | 'error_permanent';

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
  static instance(opts?: LifecycleManagerOptions): ModelLifecycleManager;
  runInference(prompt: string, config: InferenceConfig, priority: InferencePriority): Promise<InferenceResult>;
  ensureLoaded(): Promise<void>;
  unload(): Promise<void>;
  canPrefetch(): boolean;
  getSnapshot(): LifecycleSnapshot;
  exportDiagnosticBundle(): Promise<DiagnosticBundle>;
  clearPermanentDisable(): Promise<void>;
}
```

### 12.2 PrefetchScheduler API

```typescript
// src/services/translation/PrefetchScheduler.ts

export interface PrefetchSchedulerDeps {
  lifecycle: ModelLifecycleManager;
  translation: ITranslationService;
  bookRepository: BookRepository;
  wordStatusRepository: WordStatusRepository;
  mweRepository: MweRepository;
  loadFrequencyList: (lang: BookLanguage) => Promise<string[]>;
}

export class PrefetchScheduler {
  start(bookId: string, currentChapterIndex: number, currentFlatIndex: number): void;
  pause(): void;
  resume(): void;
  stop(): void;

  onScroll(): void;
  onUserTap(): void;
  onBatteryChange(snapshot: { pct: number; charging: boolean; lowPower: boolean }): void;
  onThermalChange(level: ThermalLevel): void;

  getProgress(): { done: number; total: number; status: 'idle' | 'active' | 'paused' };
}
```

### 12.3 Status store extensions

```typescript
// src/stores/llmStatusStore.ts

interface LlmStatusStore {
  // existing fields...
  lifecycleState: LifecycleState;
  prefetchActive: boolean;
  prefetchPaused: boolean;
  prefetchPauseReason: 'battery_low' | 'low_power_mode' | 'thermal' | 'user' | null;
  permanentlyDisabled: boolean;
}
```

---

## 13. Files plan

### 13.1 Создаём

- `src/services/translation/ModelLifecycleManager.ts` (replaces `LlamaContextManager`).
- `src/services/translation/PrefetchScheduler.ts`.
- `src/services/translation/frequencyLists.ts` — loader.
- `src/services/translation/lemmatizeHeuristic.ts` — per-language stripping.
- `src/services/translation/properNounHeuristic.ts`.
- `src/services/translation/diagnosticBundle.ts` — export action.
- `src/services/translation/AppStateBridge.ts`.
- `src/services/translation/BatteryBridge.ts`.
- `src/services/translation/__tests__/ModelLifecycleManager.test.ts`.
- `src/services/translation/__tests__/PrefetchScheduler.test.ts`.
- `src/services/translation/__tests__/lemmatizeHeuristic.test.ts`.
- `src/services/translation/__tests__/frequencyLists.test.ts`.
- `assets/freq/{en,ru,es,fr,de,it,pt,pl,uk,ja,ko,ar,hi}.txt`.
- `scripts/freq-curate.ts` — curation pipeline.
- `scripts/verify-kernel.ts`.
- `scripts/eval/translate-flores.ts` (shared с #4.5).
- `scripts/eval/flores-corpus/` — bundled FLORES sample.
- `.github/workflows/kernel-verify.yml`.

### 13.2 Изменяем

- `src/services/translation/LlamaContextManager.ts` → **deprecated**, replaced by `ModelLifecycleManager`. Internal: lifecycle wraps existing context manager + adds state machine + queues.
- `src/services/translation/LlamaTranslationService.ts` — route через lifecycle с priority.
- `src/services/translation/createLlamaLoader.ts` — bump n_ctx 2048 + cache_prompt: true.
- `src/services/translation/LlmBootstrap.tsx` — wire AppState + battery + PrefetchScheduler instantiation.
- `src/services/translation/useModelLifecycle.ts` — extend with snapshot, manual reload, export diagnostic.
- `src/components/settings/TranslationSection.tsx` — display lifecycle status + diagnostic export button + advanced disclosure.
- `src/services/translation/CacheLayer.ts` — TTL по source ('prefetch' vs 'on_demand').
- `src/db/models/TranslationCache.ts` — add source, inference_context, ttl_days columns.
- `src/db/schema.ts` — schema v3 (migration adding cache cols + indexes).

---

## 14. Settings UI

### 14.1 Production Settings (v2.1 simplified)

В Settings → Translation Model section:

```
Translation Model: [статус]
─────────────────────────────────
[✓] Pre-translate following pages
   (auto-pauses на low battery / thermal)

Keep translator ready: [5 min after use ▾]
   options:
     5 min after use (recommended)
     Only when needed (saves battery, slower first tap)

[Очистить кэш переводов: 47MB]                    ← single-line, no per-book
─────────────────────────────────
▾ Advanced
  [✓] Enable Japanese/Korean prefetch (slower, can cache wrong forms)
  [Reset coach mark hint]
  [Удалить и скачать заново]
```

**Cut from v2.1** (scope per contrarian):
- "Always" option в "Keep translator ready" — contradicted background force-unload rule.
- Export diagnostic bundle — нет support backend.
- Per-book Storage breakdown — replaced "Clear cache 47MB" single line.

**Anti-pattern avoided**: no numeric progress meter in production. Status bar shows binary:

```
Pre-translation: Ready
```

OR

```
Pre-translation: Paused — low battery
```

### 14.2 Dev overlay (hidden behind dev-flag)

```
LLM lifecycle: ready (loaded 3m 42s ago)
Prefetch: 18/45 words, page N+2
Memory: 612MB resident
Thermal: nominal
Battery: 67% (not charging)
Consecutive load failures: 0
```

Enabled via long-press на app version в About screen (developer toggle).

---

## 15. Performance budget

| Operation | Cold (unloaded) | Warm (ready) |
|-----------|----------------|--------------|
| User tap (cache hit) | <50ms | <50ms |
| User tap (cache miss, gloss) | 5-10s (reload) | 1-3s |
| Sentence translation | 6-15s (reload) | 5-15s |
| Prefetch batch (50 words) | N/A | 30-60s |
| Idle unload | — | <100ms |
| Memory pressure unload | — | <500ms |
| Diagnostic bundle export | — | <500ms |

**RAM footprint:**
- Unloaded: ~50MB.
- Loaded: 500MB-1GB (context + KV cache).
- Trimmed (file mapped, context released): ~80MB.

**Battery target:** prefetch < 2% per 15-min reading session (measure on iPhone 13).

---

## 16. Errors

| Code | Trigger | UI / Behavior |
|------|---------|---------------|
| LIFECYCLE_LOAD_FAILED | initLlama exception (recoverable) | Settings error state + retry CTA |
| LIFECYCLE_PERMANENTLY_DISABLED | 3 consecutive load failures | Settings: "Translation unavailable on this device. [Retry]" — clears flag |
| PREFETCH_THROTTLED_BATTERY | battery <20% not charging | Settings indicator |
| PREFETCH_THROTTLED_LOWPOWER | LowPowerMode enabled | Settings indicator |
| MEMORY_PRESSURE_UNLOAD | OS warning | Log; silent unload |
| MODEL_UPGRADE_FAILED | .partial verify fail | Settings: "Upgrade failed, keeping current model" |
| DISK_SPACE_LOW | <200MB free | Settings: "Disk space low — auto-purge enabled" |

---

## 17. Migration / Rollout

### 17.1 От #4 к #4.6

1. Add new `ModelLifecycleManager` файл.
2. ModelLifecycleManager wraps existing context manager internally + adds state machine + queues.
3. Service code switches от `LlamaContextManager.instance().getContext()` к `ModelLifecycleManager.instance().runInference(...)`.
4. Delete `LlamaContextManager` после migration tests pass.

### 17.2 DB schema v2 → v3

```typescript
// src/db/migrations/0004-cache-versioning-and-source.ts
schemaMigrations({
  migrations: [
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'translation_cache',
          columns: [
            { name: 'source', type: 'string' },           // 'on_demand' | 'prefetch'
            { name: 'inference_context', type: 'string' }, // 'cold' | 'warm' | 'thermal_throttled'
            { name: 'ttl_days', type: 'number', isOptional: false },
            { name: 'chrf_score', type: 'number', isOptional: true },
          ],
        }),
        // After column add, run one-shot purge for legacy entries (different model version)
        // Implemented as separate db.write block in migration runner.
      ],
    },
  ],
});
```

---

## 18. Done criteria

- [ ] `ModelLifecycleManager` implemented + tested (state machine + idempotency).
- [ ] AppState background → unload working.
- [ ] 5min idle timer → unload working.
- [ ] Lazy reload с shimmer + LiveRegion announcement.
- [ ] Battery throttle через `expo-battery` integrated.
- [ ] `PrefetchScheduler` implemented + tested.
- [ ] Frequency lists bundled + curated (13 languages).
- [ ] Lemmatization heuristic per-language tested + precision documented.
- [ ] Proper noun filter applied (disabled DE).
- [ ] 20s idle reader trigger fires prefetch.
- [ ] User tap preempts prefetch (≤3s for current word completion, then user).
- [ ] MWE prefetch также enqueued.
- [ ] Sentence prefetch gated by chrF threshold per pair.
- [ ] Prefetch tagged `source: 'prefetch'` + TTL 30 days.
- [ ] Cold inference tagged + not persisted к DB.
- [ ] `n_ctx 2048 + cache_prompt: true` integrated.
- [ ] Atomic model upgrade tested (power-off resilient).
- [ ] Permanent disable after 3 failures (SecureStore flag).
- [ ] Disk space runtime purge policy implemented (<200MB → auto-purge).
- [x] Diagnostic bundle CUT v2.1 (dev console only).
- [ ] Kernel verification script + CI workflow.
- [ ] Settings UI: production binary indicator + advanced disclosure.
- [ ] Dev overlay hidden behind long-press About.
- [ ] Real-device benchmark iPhone 13: prefetch throughput documented.
- [ ] Real-device benchmark Pixel 7: same.
- [ ] No regression в #4 / #4.5 translation flow.

---

## 19. Out of scope (для #4.6)

- ❌ BGTaskScheduler iOS background prefetch.
- ❌ Custom memory pressure native module (v2 — only AppState v1).
- ❌ Thermal throttle (v2 — defer).
- ❌ Cloud fallback при slow cold load (v2).
- ❌ Multi-context inference (single context v1).
- ❌ Sentence prefetch для chrF-failing pairs.
- ❌ Pre-decode TTS audio (с TTS sub-project).
- ❌ Heavy lemmatizers (Hunspell/Sudachi/MeCab — heuristic only).
- ❌ Whole-book translation — **CUT from v1 to v2 backlog** (см. canonical roadmap).

---

## 20. Open questions

1. **Custom memory pressure module** — worth complexity для v1? **MVP: AppState only**. Add native module если real-device testing shows jetsam.

2. **Prefetch mid-token interrupt** — `llama_decode` cancellable? Investigate llama.rn API. **V1**: wait for current word (≤3s).

3. **Frequency list curation** — public corpora имеют биас. **Action**: pre-bundle audit per language, document gaps в README.

4. **bookLanguageLevel** default if user skipped onboarding — **A2** (conservative, overpredicts unknown).

5. **Prefetch scope: N+3 vs N+5** — depends на real device throughput. Benchmark iPhone 13 first.

6. **Sentence prefetch размер** — sentence translation 5-15s. 50 sentences = 4-12 min. **V1**: prefetch только unique words (skip sentences) unless device plugged in. **#4.7** (whole-book) handles batch sentence translation explicitly.

7. **Lemmatization quality for JA/KO** — surface-form only = ~40% precision. Should we ship JA/KO prefetch disabled by default? **MVP: enable, accept waste, document.**

8. **Diagnostic bundle privacy** — hash-based word identifiers prevent reverse-lookup. Verify SHA truncation OK for privacy review.

9. **Kernel verification fixture coverage** — 10 prompts thin. Need broader fixture set per major language. **MVP: 10 fixtures, expand с feedback.**

10. **chrF threshold per-pair calibration** — 40 universal? Some pairs (JA-EN, AR-EN) inherently harder; threshold may need per-pair tuning. **Action**: measure baseline pre-implementation, set per-pair thresholds.
