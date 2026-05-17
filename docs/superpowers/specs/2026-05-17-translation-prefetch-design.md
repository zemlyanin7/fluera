# Sub-project #4.6 — Translation Prefetch + Idle Unload

> Расширение #4 Translation engine: prefetch следующих pages в фоне,
> idle unload модели из RAM, memory-pressure / thermal / battery throttle.
> Цель — instant translation popup + low resident memory footprint.

**Дата:** 2026-05-17
**Зависимости:** #4 Translation engine, #4.5 Popup redesign (для sentence translation в prefetch batch).
**Цель ветка:** `feat/translation-prefetch`
**Стэк:** поверх `feat/translation-popup` (#4.5).

---

## 0. Executive summary

#4 держит модель в RAM постоянно (~500MB-1GB включая KV cache). Это:

- Risks **jetsam на 3-4GB devices** (iPhone SE 2/3, base 13/14, low-end Android).
- Wastes **battery** (Metal/CPU contexts idle but mapped).
- Hurts other apps (memory pressure → OS kills background apps user expects warm).

#4.6 решает через **lifecycle state machine** с triggers:

1. **5min foreground idle** → unload context, keep file mapped.
2. **App background** → unload immediately (Apple WWDC18 Memory Deep Dive recommendation).
3. **Memory pressure** (`didReceiveMemoryWarning` / `TRIM_MEMORY_RUNNING_LOW`+) → unload unconditionally.
4. **Lazy reload** на first cache miss → shimmer popup `Готовлю переводчик…` → ready.

**Prefetch** populate'ит cache из background:

- Reader idle >= 20s + model loaded/loading → batch-translate pages N+1..N+3 (or N+5 if charging/battery>50%).
- 30-50 words per batch.
- User tap **preempts** prefetch — cancel current word, requeue.
- Thermal/battery throttle.
- **Foreground only** в v1 (BGTaskScheduler iOS gates too restrictive).

После prefetch batch + 5min idle → unload → cache populated → user reads с zero latency.

---

## 1. Scope

### 1.1 Что входит

1. **`ModelLifecycleManager`** — state machine с lifecycle triggers.
2. **Idle timer** — 5min без inference → unload.
3. **AppState integration** — background → immediate unload.
4. **Memory pressure handler** — native subscription.
5. **Lazy reload** flow на cache miss.
6. **Priority inference queue** — user > prefetch.
7. **`PrefetchScheduler`** — extracts upcoming pages, batches translations.
8. **Unknown-word detection v1** — combine bookLanguageLevel frequency cutoff + `WordStatus` history.
9. **Thermal + battery throttle** через native modules.

### 1.2 Out of scope

- ❌ BGTaskScheduler iOS background prefetch (v2).
- ❌ Pre-translate sentences для всей книги (storage-prohibitive).
- ❌ Cloud fallback при cold model (v2).
- ❌ Multi-context inference (2 contexts → 2x KV cache RAM, не оправдано).
- ❌ Audio TTS prefetch (deferred с TTS feature).
- ❌ FSRS encounter tracking (это #6 Deck — мы используем `WordStatus.state` only).

### 1.3 Что НЕ меняем

- llama.rn integration / sampling.
- MWE / false-friend lookups (#4.5).
- Popup UI (#4.5).
- Download / install flow (#4).

---

## 2. Research basis

### 2.1 Mobile LLM lifecycle (best practice)

- **Apple WWDC18 Session 416 "iOS Memory Deep Dive"** — release large resources на `didEnterBackground`. ~50% memory budget cut в background, 30s до suspension.
- **Apple `applicationDidReceiveMemoryWarning`** docs — proactive release before jetsam.
- **Android `ComponentCallbacks2.onTrimMemory`** — phased: `TRIM_MEMORY_UI_HIDDEN` (app backgrounded) → `TRIM_MEMORY_RUNNING_LOW`+ → `TRIM_MEMORY_COMPLETE`.
- **iOS jetsam** unpublished device-specific limits, ~1GB resident risky на 3-4GB devices.

### 2.2 Prefetch trade-offs (UX research)

- **Pre-fetch less common than reactive** в category. Trade-off: pre-translation = instant popup + battery cost + wasted work на untapped words.
- **Sweet spot pattern**: warm-up + reactive cache > blind batch.
- **Our extension**: page-ahead batch but throttled by user signals (idle time, battery, thermal).

### 2.3 Reading patterns

- Page-dwell median **15-25s** mobile (per category research).
- Prefetch trigger: idle **20s** — after typical page consumption, before user impatience.

### 2.4 Performance baseline

- Public llama.cpp mobile reports: 2B-class @ Q4 → **15-40 tok/s gen** на flagship SoCs.
- 1.25-bit Sherry — non-standard, no published mobile numbers.
- **Action item**: benchmark на iPhone 13 (A15, 4GB — Fluera's floor target per CLAUDE.md) и Pixel 7 перед finalizing defaults.

---

## 3. State machine

### 3.1 States

```
UNLOADED  — нет context в RAM, файл mapped on disk
LOADING   — `initLlama` в полёте
READY     — context loaded, idle, ready to infer
INFERRING — inference в полёте
ERROR     — load failed; recover via user action
```

### 3.2 Transitions

```
UNLOADED ─(user tap | prefetch trigger)→ LOADING
LOADING  ─(success)→ READY
LOADING  ─(error)→ ERROR
READY    ─(inference enqueued)→ INFERRING
INFERRING ─(complete)→ READY
READY    ─(5min idle | background | memory pressure)→ UNLOADED
INFERRING ─(memory pressure | background)→ INFERRING then UNLOADED
                                            (current job завершается ≤3s, потом unload)
ERROR    ─(resetError CTA | retry trigger)→ UNLOADED
```

### 3.3 Implementation

```typescript
// src/services/translation/ModelLifecycleManager.ts
type LifecycleState = 'unloaded' | 'loading' | 'ready' | 'inferring' | 'error';

export class ModelLifecycleManager {
  private static singleton: ModelLifecycleManager | null = null;
  private state: LifecycleState = 'unloaded';
  private context: LlamaContext | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly idleMs = 5 * 60 * 1000; // 5min

  // Triggers
  onUserTap(): void { /* preempt prefetch если есть, ensure model loaded */ }
  onAppBackground(): void { /* force unload */ }
  onMemoryPressure(): void { /* force unload */ }
  onIdleTimeout(): void { /* unload если state==ready */ }
  onThermalStateChange(level: ThermalLevel): void { /* throttle prefetch */ }
  onBatteryStateChange(pct: number, charging: boolean): void { /* gate prefetch */ }

  // Inference API
  async runUserInference(prompt: string, config: InferenceConfig): Promise<InferenceResult> {
    await this.ensureLoaded();
    return this.executeWithPriority('user', () => this.context!.completion(prompt, config));
  }

  async runPrefetchInference(prompt: string, config: InferenceConfig): Promise<InferenceResult | null> {
    if (!this.canPrefetch()) return null;
    await this.ensureLoaded();
    return this.executeWithPriority('prefetch', () => this.context!.completion(prompt, config));
  }
}
```

### 3.4 Идемпотентность

- `ensureLoaded()` deduplicates concurrent `LOADING` requests.
- `unload()` no-op если уже UNLOADED.
- `onMemoryPressure()` aborts pending prefetch jobs.

---

## 4. Idle unload mechanics

### 4.1 Timer reset

- Каждая user inference сbrasывает таймер.
- Prefetch inference **НЕ сбрасывает** таймер — это background work, не user activity.
- Reader scroll (отдельный signal) — сбрасывает (user активен с книгой).

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
  useLlmStatusStore.getState().setStatus('installed'); // file present, not loaded
}
```

### 4.3 Lazy reload UX

User tap после unload:

1. Translate service `lookup()` → cache miss.
2. Status `installed` → call `ensureLoaded()`.
3. State `unloaded → loading` → Popup status `loading` → render shimmer "Готовлю переводчик…".
4. Load done → status `ready` → translate proceeds → popup shows result.

Visible latency: **5-8s** на cold reload. Show progress / animated shimmer NOT blocking spinner.

---

## 5. Memory pressure integration

### 5.1 iOS

Native module bridge (новый Expo module или use `react-native-memory-event` если экзистует):

```objc
// MemoryPressureObserver.m
[[NSNotificationCenter defaultCenter]
  addObserver:self selector:@selector(handleMemoryWarning)
  name:UIApplicationDidReceiveMemoryWarningNotification object:nil];
```

Bridge emits event → JS subscriber → `ModelLifecycleManager.onMemoryPressure()`.

### 5.2 Android

```java
class MemoryPressureModule extends ReactContextBaseJavaModule implements ComponentCallbacks2 {
  public void onTrimMemory(int level) {
    if (level >= TRIM_MEMORY_RUNNING_LOW) {
      sendEvent("memory_pressure", { level });
    }
  }
}
```

### 5.3 V1 simplification

Если custom native module слишком много work для v1 — fall back на `AppState` events ONLY (background → unload). Memory pressure handler — TODO к v2.

**MVP decision**: AppState only. Memory pressure deferred unless real-device testing shows jetsam issues.

---

## 6. Prefetch scheduler

### 6.1 Trigger conditions (ALL true)

1. Reader screen mounted + book loaded.
2. No scroll event ≥ 20s.
3. Model state `ready` OR queued для load.
4. Battery: charging OR > 20%.
5. `LowPowerMode` (iOS) / `PowerSaveMode` (Android) OFF.
6. Thermal state < `serious` (iOS) / < `MODERATE` (Android).
7. App в foreground.
8. Prefetch не in progress.

### 6.2 Unknown-word detection v1

```typescript
async function findCandidateWords(
  pages: ChapterContent[],
  bookLanguageLevel: CEFRLevel,
  knownWords: Set<string>,
): Promise<string[]> {
  const freqList = await loadFrequencyList(book.language); // assets/freq/{lang}.txt
  const cutoff = freqCutoffByCEFR(bookLanguageLevel);
  // A1=500, A2=1000, B1=3000, B2=6000, C1=10000, C2=20000
  const knownByLevel = new Set(freqList.slice(0, cutoff));

  const candidates = new Set<string>();
  for (const page of pages) {
    for (const word of extractWords(page)) {
      const lemma = normalizeWord(word);
      if (knownByLevel.has(lemma)) continue;
      if (knownWords.has(lemma)) continue;
      candidates.add(lemma);
    }
  }
  return Array.from(candidates);
}
```

`knownWords` = `WordStatus.state IN ('known', 'mastered')` rows.

### 6.3 Frequency lists

`assets/freq/{lang}.txt` — top 20k lemmas per language. Sources:
- **English**: subtitle corpus (OpenSubtitles, CC).
- **Russian**: НКРЯ (Russian National Corpus) — public freq lists.
- Other 11 supported languages: equivalent corpus or Wiktionary frequency lists.

Size: 20k lines × ~10 bytes/line × 13 langs ≈ 2.6MB. Bundle.

### 6.4 Batch sizing + cadence

- Batch: **30-50 words** per scheduling tick.
- Tick interval: при batch complete, schedule next ~1s later (yield event loop).
- Stop conditions: pages N+1..N+5 fully translated OR user scroll detected OR throttle trigger fires.

### 6.5 Cancellation

User tap → `priority='user'` job inserted at queue head → current prefetch job cancelled mid-inference (abort token loop) → user request proceeds. Cancelled word requeued at end of prefetch queue.

llama.cpp completion is hard to cancel mid-token. V1 simpler: `cancelOnCompleteOf` flag — wait for current word's tokens to finish (≤3s), then user job. Acceptable UX trade-off.

### 6.6 Sentence prefetch (если #4.5 ready)

В дополнение к word prefetch: collect все **unique sentences** containing candidate words. Translate sentences через `translateSentence` API. Populates sentence cache (#4.5 §7) для instant sentence-translation popup.

---

## 7. Native modules для thermal + battery

### 7.1 iOS

```swift
let thermalState = ProcessInfo.processInfo.thermalState
// .nominal | .fair | .serious | .critical

let battery = UIDevice.current.batteryLevel  // 0.0-1.0
let charging = UIDevice.current.batteryState == .charging
let lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
```

Subscribe via `NSProcessInfoThermalStateDidChangeNotification`,
`UIDeviceBatteryLevelDidChangeNotification`,
`NSProcessInfoPowerStateDidChangeNotification`.

### 7.2 Android

```kotlin
val thermal = (context.getSystemService(POWER_SERVICE) as PowerManager).currentThermalStatus
// THERMAL_STATUS_NONE | LIGHT | MODERATE | SEVERE | CRITICAL | EMERGENCY | SHUTDOWN

val battery = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
val charging = batteryManager.isCharging
val powerSave = (context.getSystemService(POWER_SERVICE) as PowerManager).isPowerSaveMode
```

### 7.3 Library / V1 simplification

`expo-battery` covers battery + lowPowerMode (iOS + Android). Thermal — нужен custom module.

**MVP decision**: battery-only через `expo-battery`. Thermal throttle deferred — добавить если real-device testing показывает throttling issues.

---

## 8. Data types

### 8.1 LifecycleManager API

```typescript
// src/services/translation/ModelLifecycleManager.ts

export type ThermalLevel = 'nominal' | 'fair' | 'serious' | 'critical';
export type InferencePriority = 'user' | 'prefetch';

export interface LifecycleSnapshot {
  state: LifecycleState;
  loadedAt: number | null;
  idleSinceMs: number;
  thermalLevel: ThermalLevel;
  batteryPct: number;
  charging: boolean;
  lowPowerMode: boolean;
}

export interface LifecycleManagerOptions {
  loader: () => Promise<LlamaContext>;
  idleTimeoutMs?: number;  // default 5min
  prefetchBatteryFloor?: number; // default 0.2
}

export class ModelLifecycleManager {
  static instance(opts?: LifecycleManagerOptions): ModelLifecycleManager;

  // Inference (priority-aware)
  runInference(prompt: string, config: InferenceConfig, priority: InferencePriority): Promise<InferenceResult>;

  // Lifecycle
  ensureLoaded(): Promise<void>;
  unload(): Promise<void>;
  canPrefetch(): boolean;
  getSnapshot(): LifecycleSnapshot;
}
```

### 8.2 PrefetchScheduler

```typescript
// src/services/translation/PrefetchScheduler.ts

export interface PrefetchSchedulerDeps {
  lifecycle: ModelLifecycleManager;
  translation: ITranslationService;
  bookRepository: BookRepository;
  wordStatusRepository: WordStatusRepository;
  loadFrequencyList: (lang: BookLanguage) => Promise<string[]>;
}

export class PrefetchScheduler {
  start(bookId: string, currentChapterIndex: number, currentFlatIndex: number): void;
  pause(): void;
  resume(): void;
  stop(): void;

  onScroll(): void;        // reset idle timer
  onUserTap(): void;       // cancel current batch
  onBatteryChange(snapshot: BatteryState): void;
  onThermalChange(level: ThermalLevel): void;
}
```

### 8.3 Status store extensions

```typescript
// src/stores/llmStatusStore.ts

interface LlmStatusStore {
  // existing fields...
  lifecycleState: LifecycleState;
  prefetchActive: boolean;
  prefetchProgress: { done: number; total: number } | null;
}
```

---

## 9. Files plan

### 9.1 Создаём

- `src/services/translation/ModelLifecycleManager.ts` (replaces `LlamaContextManager` ownership).
- `src/services/translation/PrefetchScheduler.ts`.
- `src/services/translation/frequencyLists.ts` — loader.
- `src/services/translation/__tests__/ModelLifecycleManager.test.ts`.
- `src/services/translation/__tests__/PrefetchScheduler.test.ts`.
- `src/services/translation/__tests__/frequencyLists.test.ts`.
- `assets/freq/{en,ru,es,fr,de,it,pt,pl,uk,ja,ko,ar,hi}.txt` — top 20k lemmas per lang.
- `modules/MemoryPressure/` — Expo native module (если v1 решает делать). Иначе TODO.
- `src/services/translation/AppStateBridge.ts` — RN AppState → lifecycle wire.
- `src/services/translation/BatteryBridge.ts` — `expo-battery` → lifecycle wire.

### 9.2 Изменяем

- `src/services/translation/LlamaContextManager.ts` → **deprecated**, replaced by `ModelLifecycleManager`. Migration removes old singleton.
- `src/services/translation/LlamaTranslationService.ts` — route through lifecycle manager с priority.
- `src/services/translation/LlmBootstrap.tsx` — wire up:
  - AppState listener → lifecycle.onAppBackground.
  - Battery listener → lifecycle.onBatteryStateChange.
  - PrefetchScheduler instantiated.
  - Reader screen onMount → scheduler.start(bookId, page).
- `src/services/translation/useModelLifecycle.ts` — extend с idle status, manual reload action.
- `src/components/settings/TranslationSection.tsx` — display lifecycle state.

---

## 10. Tests

### 10.1 Unit

- `ModelLifecycleManager.test.ts`:
  - State transitions UNLOADED → LOADING → READY → INFERRING → READY → (5min) → UNLOADED.
  - Memory pressure forces UNLOADED.
  - Background forces UNLOADED.
  - Idle timer reset на user inference.
  - `canPrefetch()` returns false при battery < 20%.
- `PrefetchScheduler.test.ts`:
  - 20s idle trigger fires.
  - Scroll resets timer.
  - User tap cancels batch.
  - Battery <20% pauses scheduler.
  - Candidate word extraction по level.
- `frequencyLists.test.ts` — load + lookup correctness.

### 10.2 Integration

- App start → no model → user tap → load → translate → 5min idle → unload → tap again → reload → translate.
- Reader scroll → prefetch starts → tap → prefetch yields → user gets result → prefetch resumes.
- Background app → unload → foreground → tap → reload.

---

## 11. Settings UI

В Settings → Translation:

```
Translation Model: [статус]
[ ] Pre-translate following pages
   (will use battery — disabled on low battery)
Idle unload after: [5 min ▼]   (3 / 5 / 10 / Never)
```

`Never` для power users / dev — disables idle unload entirely.

В runtime debug overlay (dev builds only):

```
LLM lifecycle: ready (loaded 3m ago)
Prefetch: 18/45 words, page N+2
Memory: 612MB resident
Thermal: nominal
Battery: 67% (not charging)
```

---

## 12. Performance budget

| Operation                    | Cold (unloaded) | Warm (ready)  |
|-----------------------------|----------------|---------------|
| User tap (cache hit)         | <50ms          | <50ms         |
| User tap (cache miss, gloss) | 5-10s (reload) | 1-3s          |
| Sentence translation         | 6-15s (reload) | 5-15s         |
| Prefetch batch (50 words)    | N/A             | 30-60s        |
| Idle unload                  | —              | <100ms        |
| Memory pressure unload       | —              | <500ms        |

**RAM footprint:**

- Unloaded: ~50MB (app + JS only).
- Loaded: 500MB-1GB (context + KV cache).
- Trimmed (idle but file mapped): ~80MB.

**Battery target:** prefetch <2% per 15-min reading session.

---

## 13. Errors

| Code                            | Trigger                              | UI / Behavior                                              |
|--------------------------------|--------------------------------------|------------------------------------------------------------|
| LIFECYCLE_LOAD_FAILED          | initLlama exception                 | Settings TranslationSection error state                    |
| PREFETCH_THROTTLED_THERMAL     | thermal >= serious                  | (silent — pause scheduler)                                 |
| PREFETCH_THROTTLED_BATTERY     | battery <20% not charging           | Settings indicator "Prefetch paused — low battery"         |
| PREFETCH_THROTTLED_LOWPOWER    | iOS LowPowerMode enabled            | Settings indicator                                          |
| MEMORY_PRESSURE_UNLOAD         | OS memory warning                   | Log; silent unload                                          |

Существующие #4 errors наследуются.

---

## 14. Migration / Rollout

### 14.1 От #4 к #4.6

Существующий `LlamaContextManager` — singleton с simple load/unload. Заменяем на `ModelLifecycleManager` с richer state machine. Migration:

1. Add new `ModelLifecycleManager` файл.
2. Internal: ModelLifecycleManager wraps existing `LlamaContextManager` (или прямо replaces).
3. Service code switches от `LlamaContextManager.instance().getContext()` к `ModelLifecycleManager.instance().runInference(...)`.
4. Delete `LlamaContextManager` после migration tests pass.

### 14.2 Backward compat

Никакого user-visible data migration. Только internal refactor. Cache schema без изменений.

---

## 15. Done criteria

- [ ] `ModelLifecycleManager` implemented + tested.
- [ ] AppState background → unload working.
- [ ] 5min idle timer → unload working.
- [ ] Lazy reload на user tap, shimmer UI.
- [ ] Battery throttle через `expo-battery` integrated.
- [ ] `PrefetchScheduler` implemented + tested.
- [ ] Frequency lists bundled (13 languages, 20k lemmas each).
- [ ] Unknown-word detection v1 (level cutoff + WordStatus) working.
- [ ] 20s idle reader trigger fires prefetch.
- [ ] User tap preempts prefetch (waits for current word, then user).
- [ ] Settings: idle timeout dropdown + prefetch toggle.
- [ ] No regression в #4 / #4.5 translation flow.
- [ ] iPhone 13 benchmark: real numbers для batch sizing.
- [ ] Pixel 7 benchmark: same.

---

## 16. Out of scope (для #4.6)

- ❌ BGTaskScheduler iOS — true background prefetch (v2).
- ❌ Custom memory pressure module (use AppState fallback v1).
- ❌ Thermal throttle (defer до measured need).
- ❌ Cloud fallback при slow cold load (v2).
- ❌ Multi-context inference (single context v1).
- ❌ Sentence prefetch (если #4.5 не ready — separate ticket).
- ❌ Pre-decode N+chapters worth of TTS audio (TTS deferred to v3).

---

## 17. Open questions

1. **Custom native module для memory pressure** — worth complexity для v1? Или `AppState` only достаточно? **MVP: AppState only**. Add native module если real-device testing shows jetsam.

2. **Прерывание prefetch mid-token** — llama.cpp completion не cancellable mid-token easily. V1 trade-off: wait for current word completion (≤3s). Если UX feedback недостаточный — investigate `llama_decode` interrupt.

3. **Frequency list curation** — public OpenSubtitles / Tatoeba corpora имеют биас. Может потребоваться cleanup ('the', 'a' top-1 OK; rare proper nouns в top-1k — bad). Audit before bundle.

4. **bookLanguageLevel** не set для user который skip onboarding. **Default**: A2 (conservative — overpredicts unknown, more prefetch). User can adjust в Settings.

5. **Prefetch scope: N+3 vs N+5** — depends на real device throughput. Benchmark iPhone 13 first.

6. **WordStatus dependency** — `WordStatus` table из #2 Data layer. Migration: первый запуск нет word_status rows → conservative (prefetch все candidate). После user reading sessions → table populated.

7. **Sentence prefetch размер** — sentence translation 5-15s/sentence. 50 sentences = 4-12 min. Probably too slow для full chapter prefetch. **V1**: prefetch только **unique unknown words**, не sentences. Sentences через on-demand long-press.
