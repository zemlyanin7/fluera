# Sub-project #4.7 — Whole-Book Auto-Translation

> User triggers translation целой книги — background batch translates all
> unique words + selected sentences offline. Cache fully populated, reading
> session с zero-latency popups. Extends #4.6 prefetch architecture для
> book-scale batches.

**Дата:** 2026-05-17
**Версия:** v1
**Зависимости:** #4 Translation engine, #4.5 Popup redesign, #4.6 Prefetch + Lifecycle.
**Ветка:** `feat/whole-book-translation`
**Стэк:** поверх `feat/translation-prefetch` (#4.6).

---

## 0. Executive summary

Текущий prefetch (#4.6) translate'ит ближайшие N+1..N+5 pages во время чтения. Whole-book translation **до начала чтения** обрабатывает всю книгу как single batch job:

- User Library → tap book → "Перевести книгу заранее" CTA.
- Background process extracts все unique unknown words + (опционально) все sentences.
- Lifecycle manager loads model, processes batch, unloads после complete.
- Progress bar в Library / Reader header.
- Pause/resume/cancel.
- Battery/thermal/disk gating.
- Cache fully populated → reading session **полностью offline + zero latency** для популярных слов.

**Use case scenarios:**

1. **Перелёт без сети** — pre-translate книгу дома, читать в самолёте.
2. **Низкое качество inference** — pre-translate с warm context (better quality), результаты cached.
3. **Чтение бумажной книги** — нет, это другой scenario. Здесь только e-books.
4. **Серьёзный учебный проект** — pre-translate ключевой текст, focus on reading.

**Key constraint:** наша 1.25-bit модель slow (~2s/word warm, ~10s/sentence). 500-word unique vocab × 2s = ~17 min word-only batch. 200 sentence × 10s = ~33 min sentences. Total ~50min per book — нужно plugged-in + foreground.

---

## 1. Scope

### 1.1 Что входит

1. **Library "Translate book" CTA** + per-book progress indicator.
2. **`WholeBookTranslator`** service — extends `PrefetchScheduler` для book-scale batch.
3. **Pre-extraction pipeline** — extract all unique unknown words + candidate sentences from book's ContentItem tree.
4. **Background batch processing** через ModelLifecycleManager priority queue.
5. **Pause/resume/cancel** controls.
6. **Progress reporting** — Library card + Reader header banner.
7. **Battery / thermal / disk guards** — extends #4.6 gates.
8. **Completion notification** — local notification "Book translated" при done.
9. **Per-book cache stats** — Settings → Storage section показывает size + can wipe per-book.

### 1.2 Out of scope

- ❌ Bilingual side-by-side rendering целой книги (отдельная фича, deferred).
- ❌ TTS audio prefetch — с TTS sub-project.
- ❌ Background OS task (BGProcessingTask iOS) — foreground only v1.
- ❌ Pre-translate ВСЕ words (включая known) — только unknown candidates.
- ❌ MWE / idiom detection across whole book (использует существующий #4.5 trie).
- ❌ Sentence translation для chrF-failing pairs (gating from #4.5 §11.3).
- ❌ User-editable phrase list для batch (custom inclusions).

---

## 2. UX flow

### 2.1 Library entry point

В Library screen — per-book card:

```
┌──────────────────────────────────────┐
│  [cover]  War and Peace                │
│           Leo Tolstoy                  │
│           65% read · 1247 pages       │
│                                        │
│  [📖 Continue]  [🌐 Pre-translate]    │
└──────────────────────────────────────┘
```

Tap "🌐 Pre-translate":

```
┌──────────────────────────────────────┐
│  Pre-translate War and Peace?         │
│                                        │
│  Estimated unique words: ~4,200       │
│  Estimated sentences: ~1,800           │
│  Estimated time: ~50 minutes           │
│  Storage: ~15 MB cache                │
│                                        │
│  Requirements:                         │
│    ✓ Charging or battery > 50%        │
│    ✓ Foreground app                   │
│    ⚠ Will use ~3% battery             │
│                                        │
│  [Words only (~20 min)]                │
│  [Words + sentences (~50 min)]        │
│  [Cancel]                              │
└──────────────────────────────────────┘
```

After start: book card shows progress badge:

```
┌──────────────────────────────────────┐
│  [cover]  War and Peace                │
│           Translating: 1245/4200 ⏸ ✕  │
└──────────────────────────────────────┘
```

### 2.2 Reader entry point

Если user opens book during translation:

```
┌──────────────────────────────────────────┐
│  ←  Ch. 1                  AA   📖  ⋮  │  Header
│  🌐 Pre-translating: 1245/4200 [pause]  │  Translation banner
├──────────────────────────────────────────┤
│  Chapter content...                       │
└──────────────────────────────────────────┘
```

Reading продолжается normally. Prefetch runs одновременно с reading (priority queue: user taps preempt batch).

### 2.3 Completion

Local notification:

```
Fluera • now
Translation ready
War and Peace pre-translated. Tap to start reading.
```

И в Library card:

```
┌──────────────────────────────────────┐
│  [cover]  War and Peace                │
│           65% read · 1247 pages       │
│           ✓ Pre-translated · 15MB    │
└──────────────────────────────────────┘
```

### 2.4 Settings → Storage

```
Translation cache
─────────────────
Total: 47 MB across 3 books
Per book:
  War and Peace          15 MB  [🗑]
  Anna Karenina           18 MB  [🗑]
  Crime and Punishment   14 MB  [🗑]

[Clear all translation cache]
```

---

## 3. Implementation architecture

### 3.1 `WholeBookTranslator` service

```typescript
// src/services/translation/WholeBookTranslator.ts

export interface BookTranslationJob {
  bookId: string;
  bookTitle: string;
  estimatedWords: number;
  estimatedSentences: number;
  mode: 'words_only' | 'words_and_sentences';
  startedAt: number;
  pausedAt: number | null;
  completedAt: number | null;
  wordsProcessed: number;
  sentencesProcessed: number;
  totalWords: number;
  totalSentences: number;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
  failureReason: string | null;
}

export class WholeBookTranslator {
  private static singleton: WholeBookTranslator | null = null;
  private currentJob: BookTranslationJob | null = null;

  static instance(): WholeBookTranslator;

  // Lifecycle
  async estimate(bookId: string, mode: BookTranslationJob['mode']): Promise<TranslationEstimate>;
  async start(bookId: string, mode: BookTranslationJob['mode']): Promise<void>;
  async pause(): Promise<void>;
  async resume(): Promise<void>;
  async cancel(): Promise<void>;

  // State
  getCurrentJob(): BookTranslationJob | null;
  getJobHistory(): Promise<BookTranslationJob[]>;
  isBookTranslated(bookId: string): Promise<boolean>;

  // Events
  onProgress(cb: (job: BookTranslationJob) => void): () => void;
}
```

### 3.2 Pipeline

```
1. Estimate phase (fast, <2s):
   - Load book ContentItems
   - Extract all unique tokens
   - Run lemmatize heuristic per-language
   - Filter known (freqlist cutoff + WordStatus history)
   - Count: candidates_words, candidates_sentences (если mode=='words_and_sentences')
   - Show estimate dialog

2. Execute phase:
   - Persist BookTranslationJob row в DB (state='queued')
   - Wake ModelLifecycleManager.ensureLoaded()
   - For each candidate word:
     a. Check cache → skip if hit
     b. Submit batch sub-job to prefetch queue (priority='prefetch')
     c. Increment job.wordsProcessed, emit progress event
   - For each candidate sentence (если mode):
     a. Check chrF gate для pair → skip pair если below threshold
     b. Check cache → skip if hit
     c. Submit batch sub-job
     d. Increment job.sentencesProcessed
   - On user tap during execute: user priority preempts (≤3s for current word completion)

3. Completion phase:
   - Mark job state='completed'
   - Local notification
   - Update book card в Library с translated indicator
   - Trigger ModelLifecycleManager idle countdown → eventual unload
```

### 3.3 Pause/resume

Pause requirements:
- User explicit pause button.
- Battery < 20% AND not charging → auto-pause.
- LowPowerMode enabled → auto-pause.
- Thermal serious+ → auto-pause (v2).
- App background → auto-pause + persist job state.

Resume requirements:
- User explicit resume button.
- Battery restored OR plugged in.
- Foreground app.

Job state persisted в DB через `BookTranslationJob` table. Survives app restart.

### 3.4 Cancel

User explicit cancel:
- Current word completion finishes (≤3s).
- Job state='cancelled', completedAt=now.
- Cache entries already written **preserved** (no wipe — useful even partial).
- Reset for re-start later.

### 3.5 Notification

Local notification via `expo-notifications`:
- Permission requested на first batch start.
- Triggers on completion OR на failure.
- Tap → open book Reader.

Если permission denied: no notification, completion silent (Library card update only).

---

## 4. Data types

### 4.1 Estimate

```typescript
export interface TranslationEstimate {
  bookId: string;
  uniqueWords: number;
  candidateUnknownWords: number;  // after lemmatize + filter
  candidateSentences: number;
  estimatedDurationSec: number;
  estimatedStorageBytes: number;
  warningLowBattery: boolean;
  warningLowDisk: boolean;
  chrFFailingPairs: string[];     // sentence translation unavailable для этих pairs
}
```

### 4.2 DB schema

```sql
CREATE TABLE book_translation_jobs (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  book_title TEXT NOT NULL,
  mode TEXT NOT NULL,                  -- 'words_only' | 'words_and_sentences'
  started_at INTEGER NOT NULL,
  paused_at INTEGER,
  completed_at INTEGER,
  cancelled_at INTEGER,
  words_processed INTEGER NOT NULL DEFAULT 0,
  sentences_processed INTEGER NOT NULL DEFAULT 0,
  total_words INTEGER NOT NULL,
  total_sentences INTEGER NOT NULL,
  status TEXT NOT NULL,                -- queued | running | paused | completed | cancelled | failed
  failure_reason TEXT,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  FOREIGN KEY(book_id) REFERENCES books(id)
);
CREATE INDEX idx_book_translation_jobs_book ON book_translation_jobs(book_id);
CREATE INDEX idx_book_translation_jobs_status ON book_translation_jobs(status);
```

### 4.3 Status store

```typescript
interface BookTranslationStore {
  activeJob: BookTranslationJob | null;
  pauseReason: 'user' | 'battery' | 'low_power' | 'thermal' | 'background' | null;
  recentJobs: BookTranslationJob[];

  start: (bookId: string, mode: BookTranslationJob['mode']) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
}
```

---

## 5. Files plan

### 5.1 Создаём

- `src/services/translation/WholeBookTranslator.ts`.
- `src/services/translation/bookTranslationPipeline.ts` — extract candidates from ContentItems.
- `src/services/translation/__tests__/WholeBookTranslator.test.ts`.
- `src/services/translation/__tests__/bookTranslationPipeline.test.ts`.
- `src/db/migrations/0005-book-translation-jobs.ts`.
- `src/db/models/BookTranslationJob.ts`.
- `src/db/repositories/BookTranslationJobRepository.ts`.
- `src/stores/bookTranslationStore.ts` — Zustand store.
- `src/components/library/BookCard.tsx` — extend с pre-translate CTA + progress.
- `src/components/library/PreTranslateDialog.tsx` — estimate + confirm.
- `src/components/reader/TranslationBanner.tsx` — header banner showing batch progress.
- `src/components/settings/StorageSection.tsx` — extends Settings с per-book cache stats.
- `src/services/translation/cacheStatsByBook.ts` — query cache rows grouped by book_id.
- `src/services/translation/notifications.ts` — wrapper around `expo-notifications`.

### 5.2 Изменяем

- `src/services/translation/PrefetchScheduler.ts` — accept WholeBookTranslator submissions in same priority queue (single queue, two callers).
- `src/services/translation/ModelLifecycleManager.ts` — add `runBookTranslationInference(prompt, config)` method (same priority as 'prefetch' but tracked separately for diagnostic).
- `src/db/models/TranslationCache.ts` — add `book_id` foreign key column для per-book stats.
- `src/db/schema.ts` — schema v4 (BookTranslationJobs + book_id on cache).
- `src/screens/Library.tsx` — wire BookCard CTA + progress display.
- `app/_layout.tsx` — request notification permission on first batch start.

---

## 6. Resource gating

### 6.1 Pre-start checks

```typescript
async function canStartBookTranslation(bookId: string): Promise<{ ok: boolean; reasons: string[] }> {
  const reasons: string[] = [];

  // Battery
  const batteryLevel = await Battery.getBatteryLevelAsync();
  const charging = (await Battery.getPowerStateAsync()).batteryState === Battery.BatteryState.CHARGING;
  if (batteryLevel < 0.5 && !charging) reasons.push('battery_low');

  // LowPowerMode
  const lowPower = (await Battery.getPowerStateAsync()).lowPowerMode;
  if (lowPower) reasons.push('low_power_mode');

  // Disk space
  const free = await FileSystem.getFreeDiskStorageAsync();
  const estimate = estimateStorageForBook(bookId);
  if (free < estimate * 3) reasons.push('disk_low');  // 3x safety margin

  // Permanent disable (from #4.6)
  if (await ModelLifecycleManager.instance().isPermanentlyDisabled()) {
    reasons.push('permanently_disabled');
  }

  return { ok: reasons.length === 0, reasons };
}
```

User sees friendly version в PreTranslateDialog. Can override "Charging or battery > 50%" с warning.

### 6.2 Runtime auto-pause

Subscriber pattern:

```typescript
Battery.addBatteryLevelListener(({ batteryLevel }) => {
  const job = WholeBookTranslator.instance().getCurrentJob();
  if (!job || job.status !== 'running') return;
  if (batteryLevel < 0.2 && !charging) {
    WholeBookTranslator.instance().pause(); // pauseReason: 'battery'
  }
});
```

AppState listener: background → auto-pause.

Auto-resume when conditions improve (если pause cause was non-user):

```typescript
function tryAutoResume() {
  const job = WholeBookTranslator.instance().getCurrentJob();
  if (!job || job.status !== 'paused') return;
  const store = useBookTranslationStore.getState();
  if (store.pauseReason === 'user') return; // never auto-resume user pauses
  // check conditions met
  if (conditionsOK()) {
    WholeBookTranslator.instance().resume();
  }
}
```

---

## 7. Performance budget

| Operation | Per-book typical | Per-book worst case |
|-----------|------------------|---------------------|
| Estimate | 1-2s | 5s (very long books) |
| Words-only batch (4000 words) | 17 min | 35 min |
| Words + sentences batch (4000 + 1500) | 50 min | 90 min |
| Pause/resume latency | <100ms | <500ms |
| Cancel latency | ≤3s (wait current word) | ≤3s |
| Cache storage per book | 5-20 MB | 50 MB |
| Battery drain (50min batch) | ~3-5% | ~8% |

**Acceptance**: words-only batch < 25 min for typical novel. Sentences mode optional (slower).

---

## 8. Errors

| Code | Trigger | UI / Behavior |
|------|---------|---------------|
| BOOK_NOT_FOUND | bookId invalid | Dialog: "Book not found" |
| CHRF_PAIR_NOT_SUPPORTED | Sentence mode + pair below chrF threshold | Estimate shows "Sentence translation unavailable. Words only available." |
| ESTIMATE_TOO_LARGE | Estimate > 500MB storage | Dialog: "Book too large. Try words-only mode." |
| BATTERY_TOO_LOW | <20% at start AND not charging | PreTranslateDialog shows warning, requires explicit "Start anyway" |
| PERMANENTLY_DISABLED | LLM permanently disabled (от #4.6) | CTA disabled: "Translation unavailable on this device" |
| MODEL_LOAD_FAILED_DURING_BATCH | Mid-batch lifecycle failure | Job status='failed', resume button surfaced |
| INSUFFICIENT_DISK_SPACE | <200MB free during batch | Auto-pause, surface "Low disk — pause until cleared" |
| NOTIFICATION_PERMISSION_DENIED | First batch + permission denied | Silent — no notification, badge update only |

---

## 9. Settings UI

### 9.1 В Library

Per-book card:
- "Pre-translate" CTA если book НЕ translated.
- "Translating: X/Y" badge с pause/cancel buttons если active job.
- "✓ Pre-translated · 15MB" badge если completed.

### 9.2 В Settings → Storage

```
Translation cache
─────────────────
Total: 47 MB across 3 books

War and Peace
  Words: 4,123 cached
  Sentences: 1,847 cached
  Size: 15 MB
  [Re-translate] [Wipe]

Anna Karenina
  Words: 3,892 cached
  Sentences: 0 (words only)
  Size: 8 MB
  [Complete sentences] [Wipe]

Crime and Punishment
  Words: 4,201 cached
  Sentences: 1,663 cached
  Size: 14 MB
  [Re-translate] [Wipe]

[Clear all]
```

Re-translate: confirms then re-runs batch (model evolved? force refresh).
Wipe: deletes cache for this book only.
Complete sentences: if was words-only, run sentence batch separately.

### 9.3 В Reader

При open book с active translation job:

```
🌐 Pre-translating: 1245/4200 (29%) · ~22 min left  [⏸ pause] [✕]
```

Banner collapsible. Doesn't block reading.

---

## 10. Tests

### 10.1 Unit

- `bookTranslationPipeline.test.ts`: extract candidates from various ContentItem shapes (paragraphs, lists, blockquotes), lemmatize correctness per-language.
- `WholeBookTranslator.test.ts`: start/pause/resume/cancel state machine, persistence через DB.
- `cacheStatsByBook.test.ts`: aggregate cache rows по book_id correctly.
- `notifications.test.ts`: permission flow, schedule correctness.

### 10.2 Integration

- Full flow: tap CTA → estimate dialog → confirm → batch progresses → pause → resume → complete → notification → Library badge updated.
- User reads book during batch → user tap preempts → ≤3s wait → user gets translation → batch resumes.
- Battery drop <20% mid-batch → auto-pause → recharge → auto-resume.
- App background mid-batch → auto-pause → foreground → manual resume.
- Cancel mid-batch → state cancelled, partial cache preserved.
- Multiple books queued (only one active at a time — second waits).

### 10.3 Manual smoke

- Translate "Война и Мир" (~4000 unique words) end-to-end on iPhone 13. Measure actual time.
- Pause/resume через UI работает.
- Local notification fires.
- Library card обновляется.
- Sentence translation chrF gate respected (skip pairs below threshold).

---

## 11. Done criteria

- [ ] `WholeBookTranslator` service implemented + tested.
- [ ] BookTranslationJob persistence + state machine.
- [ ] Library BookCard pre-translate CTA + progress display.
- [ ] PreTranslateDialog с estimate, gating, mode select.
- [ ] Reader TranslationBanner с pause/cancel.
- [ ] Settings → Storage section с per-book stats + wipe.
- [ ] Battery / LowPowerMode / thermal auto-pause working.
- [ ] AppState background → auto-pause.
- [ ] Pause/resume preserves state across app restart.
- [ ] Cancel preserves partial cache.
- [ ] Local notification fires on completion (если permission granted).
- [ ] Sentence translation gated by chrF threshold per pair.
- [ ] User tap during batch preempts (≤3s).
- [ ] DB migration v3 → v4 tested.
- [ ] Translate full "War and Peace" successfully на iPhone 13.
- [ ] No regression в #4.5 popup / #4.6 prefetch flows.

---

## 12. Out of scope (для #4.7)

- ❌ Background OS task scheduling (BGProcessingTask).
- ❌ Side-by-side bilingual book rendering (отдельная фича).
- ❌ TTS audio pre-generation.
- ❌ User-curated additional phrase list.
- ❌ Crowd-sourced cache sharing (other users' translations).
- ❌ Translation quality post-edit (user корректирует cache entries).
- ❌ Batch translation across multiple books concurrently (one at a time).
- ❌ Smart sentence selection (всё подряд vs heuristic-selected).
- ❌ Auto-trigger pre-translate без user explicit CTA.

---

## 13. Open questions

1. **iOS BGProcessingTask viability** для true background batch — Apple gates restrictive (device idle + plugged + charging). MVP foreground only; v2 evaluate.

2. **Notification permission timing** — request на first batch start vs onboarding? **MVP**: at first batch start (just-in-time, less friction).

3. **Storage estimate accuracy** — until we measure 1.25-bit Hy-MT output average length per word/sentence, estimate ±50%. Refine after real-device benchmarks.

4. **Sentence selection heuristic** — translate ALL sentences (expensive)? Or select "complex" sentences only (subjective)? **MVP**: ALL sentences containing candidate unknown word. Skips trivial all-known sentences.

5. **Concurrent book batches** — UX? Queue OR reject second? **MVP**: queue (one at a time), surface "Pending: 2 books queued".

6. **Cache invalidation on model upgrade** — book pre-translated с v1.5, model upgraded к v1.6. Re-translate prompt user? **MVP**: silent invalidate (#4.5 §6.1 hash includes version) → cache treated as miss → user options Re-translate button.

7. **Time-of-day scheduling** — auto-pause overnight? **MVP**: nope, user controls.

8. **Per-chapter granularity** — translate only chapters не yet read? **MVP**: всё подряд. User cancel когда reach known territory.

9. **Storage cap per device** — max combined cache size? **MVP**: 500MB cap, auto-evict oldest pre-translated book when exceeded.

10. **Reading position tracking during batch** — user reads N+1 chapter while batch processes pages 1-N. UX OK? **MVP**: yes, no interaction. Reader uses cached translations as they become available.
