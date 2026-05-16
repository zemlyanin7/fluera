# Translation Engine — Design Spec (sub-project #4)

**Версия:** 1.0
**Дата:** 2026-05-17
**Branch:** `feat/translation-engine` (стэк на #3 reader-engine)
**Статус:** draft → approved → implementation

---

## 1. Цель

Подключить on-device LLM-перевод одного слова в контексте предложения. Из
reader UI (TranslationPopup) → out-of-the-box работает без сети, без
API-ключей. Cache hit <500ms, cold inference <3s (Pixel 7 / iPhone 13).

**Поведенческая граница** в #4:
- IN: TranslationService реализация поверх `llama.rn` + Hy-MT1.5-1.8B-1.25bit-GGUF.
- IN: Модель скачивается при первом запуске (download flow).
- IN: TranslationCache (in-memory LRU + WatermelonDB persist).
- IN: Warm-up на старте после splash.
- IN: Settings hooks (re-download model, clear cache).
- IN: TranslationPopup UI улучшения (pending/streaming/error states).
- OUT: FSRS-6 deck (sub-project #6).
- OUT: Stats (sub-project #7).

---

## 2. Архитектурный обзор

```
┌─────────────────────────────────────────────────────────────────┐
│                        Reader Screen                            │
│                                                                 │
│   ContentItemRenderer.onWordTap                                 │
│              │                                                  │
│              ▼                                                  │
│   TranslationPopup (state machine: opening → pending →          │
│                     success/error/closed)                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
                  ┌────────────────────┐
                  │ TranslationService │ <─── interface (used by UI)
                  │     interface      │
                  └────────┬───────────┘
                           │
            ┌──────────────┴───────────────┐
            ▼                              ▼
┌──────────────────────┐         ┌─────────────────────┐
│ NoOpTranslationSvc   │         │ LlamaTranslationSvc │
│ (dev/test fallback)  │         │ (production)        │
└──────────────────────┘         └────────┬────────────┘
                                          │
              ┌───────────────────────────┼───────────────────────┐
              ▼                           ▼                       ▼
   ┌──────────────────┐        ┌──────────────────┐    ┌──────────────────┐
   │  CacheLayer      │        │ PromptBuilder    │    │  LlamaRuntime    │
   │  - InMemoryLRU   │        │  - lang pairs    │    │  (llama.rn)      │
   │  - SQLite persist│        │  - context win   │    │  - model ctx     │
   │  - LRU evict     │        │  - 13×13 prompts │    │  - inference     │
   └──────────────────┘        └──────────────────┘    └──────────────────┘
              │                                                  │
              ▼                                                  ▼
   ┌──────────────────┐                              ┌──────────────────┐
   │ WatermelonDB     │                              │ ModelStore       │
   │ TranslationCache │                              │ - Documents/llm  │
   │ table            │                              │ - integrity SHA  │
   └──────────────────┘                              └──────────────────┘
                                                              │
                                                              ▼
                                                   ┌──────────────────┐
                                                   │ ModelDownloader  │
                                                   │ - HF mirror      │
                                                   │ - resume support │
                                                   │ - progress UI    │
                                                   └──────────────────┘
```

**Главное правило слоёв:**

- UI знает только `TranslationService` interface.
- `LlamaTranslationService` оркестрирует Cache + PromptBuilder + LlamaRuntime.
- ModelStore + ModelDownloader работают независимо, dispatch'ат события
  через ModelStatus store (Zustand).
- Warm-up через отдельный manager (LlamaWarmup).

---

## 3. Технологический стек

| Слой               | Технология                                | Версия           |
|--------------------|-------------------------------------------|------------------|
| LLM runtime        | `llama.rn`                                | `^0.5.x`         |
| Model format       | GGUF (llama.cpp)                          | —                |
| Quantization       | IQ1_S (1.25-bit)                          | —                |
| Model              | Hy-MT1.5-1.8B-1.25bit-GGUF (tencent)      | ~700MB           |
| Download           | `expo-file-system` `downloadAsync`        | SDK 54           |
| Integrity          | `expo-crypto` SHA-256                     | SDK 54           |
| Cache (memory)     | self-built LRU Map (~500 entries)         | —                |
| Cache (persist)    | WatermelonDB `translation_cache` table    | (из #2)          |
| Cache key hash     | `expo-crypto` SHA-256 truncated 32 chars  | (из #2)          |
| State              | Zustand store `useLlmStatusStore`         | v5               |

**Native build:**

- `llama.rn` требует pod install (iOS) + gradle sync (Android). Dev-client
  rebuild обязателен (новые pods/aars).
- iOS Metal GPU acceleration: `n_gpu_layers: -1` (offload max).
- Android: CPU только. Vulkan backend в llama.cpp есть но llama.rn binding
  на 2026-05 нестабильный для Vulkan — сидим на CPU.

---

## 4. Model lifecycle

### 4.1 Download flow

**Когда:** при первом запуске после онбординга, ИЛИ при `re-download`
из Settings.

**Где:** `src/services/translation/ModelDownloader.ts`.

**Источник:** HuggingFace mirror.
- Primary: `https://huggingface.co/tencent/Hunyuan-MT-1.5B-1.8B-1.25bit-GGUF/resolve/main/Hy-MT1.5-1.8B-1.25bit.gguf`
- Fallback: тот же mirror, retry с exponential backoff.

**Поток:**

1. `ModelStore.getStatus()` → `not_installed` (нет файла + нет SHA-mark в SecureStore).
2. Onboarding flow или Settings → "Download model" CTA.
3. `ModelDownloader.start()`:
   - Создаёт `Documents/llm/Hy-MT1.5-1.8B.gguf.partial`.
   - `FileSystem.createDownloadResumable(url, partialPath, { md5: false })`.
   - Прогресс callback каждые ~500ms → `useLlmStatusStore.setProgress(0..1)`.
   - При success → переименовывает `.partial` → `.gguf`.
4. Integrity check:
   - SHA-256 файла → сравнение с expected (hardcoded constant).
   - При mismatch → delete файл, throw integrity error.
   - При match → сохранить mark в SecureStore: `llm:model-installed-v1 = sha256`.
5. `ModelStore.setStatus('installed')`.

**Pause/resume:**

- `expo-file-system.createDownloadResumable` поддерживает pause/resume через
  `pauseAsync()` / `resumeAsync()`.
- При app background → автоматическая pause iOS, Android продолжает в background
  (если `notifications` permission есть). MVP: pause при background, resume
  при foreground.

**Error handling:**

- Network error → retry max 3 раза с backoff 1s/3s/10s.
- Disk full (errno -36) → cleanup partial, user message "Освободите ~1GB места".
- Checksum mismatch → cleanup, user message "Файл повреждён — повторите".
- User cancel → cleanup partial, status `not_installed`.

### 4.2 Storage

**Path:** `${FileSystem.documentDirectory}llm/Hy-MT1.5-1.8B.gguf`
- iOS: `~/Library/Documents/llm/...` (НЕ Cloud — backup excluded см. §11).
- Android: `app-data/files/llm/...`.

**Backup exclusion (см. CLAUDE.md):**
- iOS: установить `NSURLIsExcludedFromBackupKey=true` через
  `FileSystem.getInfoAsync` + native helper (или через `expo-file-system`
  `setItemValueAsync` API если доступен; иначе через JSI).
- Android: `<full-backup-content>` exclude правило для `files/llm/**`.

**Integrity store:**
- Expected SHA-256 хардкодим в `src/services/translation/modelManifest.ts`:
  ```typescript
  export const MODEL_MANIFEST = {
    name: 'Hy-MT1.5-1.8B-1.25bit',
    version: 1,
    sha256: '<32-byte hex>',
    sizeBytes: 700_000_000, // approx
    url: 'https://huggingface.co/...',
  } as const;
  ```
- Установленная mark в SecureStore: `llm:model-installed-v1`.

### 4.3 Reinstall

**Trigger:**
- Settings → "Re-download model".
- Update version (manifest.version изменился) — wipe + re-download.

**Поток:**
1. Delete `Documents/llm/*.gguf`.
2. Delete SecureStore key `llm:model-installed-v1`.
3. `ModelStore.setStatus('not_installed')`.
4. Запустить download flow заново.

### 4.4 Disk pressure

**При low storage (<100MB free):**
- Block download — показать ошибку "Недостаточно места".
- Если модель уже установлена + кэш растёт — auto-purge TranslationCache
  (см. §5.3).

---

## 5. Cache layer

### 5.1 Cache key

```typescript
function cacheKey(word: string, contextWindow: string, langPair: string): string {
  const input = `${word.toLowerCase().trim()}::${contextWindow.trim()}::${langPair}`;
  return sha256(input).slice(0, 32); // truncated 32 hex chars
}
```

- `word` — само слово (без пунктуации, lowercase).
- `contextWindow` — sentence до 200 chars (см. §6.2).
- `langPair` — `${bookLanguage}-${nativeLanguage}` (например `en-ru`).

Hash через `expo-crypto.digestStringAsync(SHA256, input)` (уже использовался
в #2 для `cacheKey.ts`).

### 5.2 Lookup

```
lookup(word, ctx, langPair):
  key = cacheKey(...)
  inMemory = lru.get(key)
  if inMemory: return { source: 'memory', value: inMemory } ← <50ms
  fromDb = await translationCacheRepo.findByKey(key)
  if fromDb:
    lru.set(key, fromDb.translation)
    return { source: 'db', value: fromDb.translation } ← <200ms
  return null
```

### 5.3 Eviction

**In-memory LRU:**
- Capacity: 500 entries (configurable).
- Eviction: LRU (least recently used).
- Реализация: `Map` + дельта-tracking (Map preserves insertion order, при
  `get` удаляем + переustanавливаем для refresh).

**WatermelonDB persist:**
- Time-based purge: TTL 90 дней (см. CLAUDE.md).
  - Запускается на старте через `purgeOldTranslations()`.
  - Удаляет записи где `created_at < now - 90 days`.
- Size cap: 10,000 записей. При превышении — удаление 10% самых старых.
- "Clear translation history" action в Settings:
  - Wipe вся table + reset in-memory LRU.

### 5.4 Write

```
write(word, ctx, langPair, translation):
  key = cacheKey(...)
  lru.set(key, translation) ← O(1)
  fire-and-forget: translationCacheRepo.create({key, word, ctx, langPair, translation})
```

Запись в DB async — не блокирует UI. Дубликаты в DB предотвращаем через
unique constraint на `key` column (см. schema #2). При collision — ignore.

---

## 6. Prompt design

### 6.1 Template (per language pair)

**Базовый шаблон для всех 13×13 пар:**

```
You are a precise translator. Given a word in {SOURCE_LANG} and the sentence
it appears in, return the {TARGET_LANG} translation of the word ONLY, in its
contextual meaning. No explanation, no transliteration, no synonyms list.

Sentence: «{SENTENCE}»
Word: {WORD}

{TARGET_LANG} translation of «{WORD}»:
```

**Параметры подстановки:**
- `{SOURCE_LANG}` — human-readable label (`English`, `Russian`, ...).
- `{TARGET_LANG}` — то же.
- `{SENTENCE}` — context window из reader (см. §6.2).
- `{WORD}` — тапнутое слово (lowercase, без знаков препинания).

**Special-cases per script:**
- RTL pairs (Arabic source/target): не меняем template, llama.cpp обрабатывает
  RTL правильно через токенизацию.
- CJK pairs (Japanese, Korean, Chinese): убираем кавычки `«»` (плохо токенизируются)
  → используем `「」` или просто двоеточие.

**Manifest:**

```typescript
// src/services/translation/promptTemplates.ts
export const PROMPT_TEMPLATES: Record<LangPair, string> = { ... };
export const LANG_LABELS: Record<BookLanguage, string> = {
  en: 'English', ru: 'Russian', ... // 13 labels
};
```

### 6.2 Context window

**Source:** уже есть `src/services/reader/extractSentence.ts` из #3 (Task 35).

**Длина:** до 200 chars (как в spec #3). Усечение по word boundary.

**Включаем в prompt:** только `sentence` (без paragraph/chapter context — увеличит prompt значительно без качественного буста).

### 6.3 Inference parameters

```typescript
const INFERENCE_CONFIG = {
  temperature: 0.2,        // детерминированно для перевода
  top_p: 0.9,
  top_k: 40,
  repeat_penalty: 1.1,
  max_tokens: 32,           // перевод одного слова — короткий
  stop: ['\n', '.', ',', '«', '»', '"', '«', ':', ';'],
  n_threads: 4,             // CPU threads для Android
};
```

**Stop tokens:** разрезаем на новой строке или знаке препинания — модель часто
расширяет ответ ("translated word, also similar..."), стопаем рано.

### 6.4 Post-processing

```typescript
function cleanTranslation(raw: string): string {
  return raw
    .trim()
    .replace(/^["'«»"":,.\s]+|["'«»"":,.\s]+$/g, '') // strip leading/trailing punct
    .replace(/\s+/g, ' ')
    .slice(0, 200); // safety cap
}
```

**Reject если:**
- Empty after cleanup → fallback `pending` state.
- Содержит `\n` (модель ушла в multi-line) → take first line.
- Длиннее 200 chars → truncate.

---

## 7. Warm-up

### 7.1 Зачем

Cold-start первого инференса 5-8s. Если первый user-initiated tap = cold
inference — UX плохой. Warm-up в background → первый user tap идёт на тёплую
модель.

### 7.2 Когда

1. После `SplashScreen.hideAsync()` в RootLayout — через `InteractionManager.runAfterInteractions()`.
2. Только если model installed (status `installed`).
3. Только один раз за app session.

### 7.3 Что

```typescript
async function warmup(service: LlamaTranslationService) {
  await service.translate({
    word: 'hello',
    contextWindow: 'hello world',
    bookLanguage: 'en',
    nativeLanguage: 'ru',
  });
  // Результат игнорируем — нужно только прогреть KV-cache + Metal pipeline.
}
```

### 7.4 Failure

При неудаче warm-up:
- Logging `console.warn('[llm] warmup failed', e)`.
- Не показываем user error — silent.
- При первом реальном tap → нормальная full инференс.

---

## 8. TranslationService interface

### 8.1 Контракт

```typescript
// src/services/translation/TranslationService.ts
export interface TranslateInput {
  word: string;
  contextWindow: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
}

export interface TranslateResult {
  status: 'ok' | 'pending' | 'error';
  translation?: string;
  source?: 'memory' | 'db' | 'inference';
  errorMessage?: string;
  errorCode?: TranslationErrorCode;
}

export type TranslationErrorCode =
  | 'MODEL_NOT_INSTALLED'
  | 'MODEL_LOADING'
  | 'INFERENCE_TIMEOUT'
  | 'INFERENCE_FAILED'
  | 'EMPTY_RESPONSE'
  | 'UNSUPPORTED_PAIR';

export interface TranslationService {
  translate(input: TranslateInput): Promise<TranslateResult>;
}
```

### 8.2 Implementations

**NoOpTranslationService** (уже есть из #3):
- Возвращает `{ status: 'pending' }` всегда.
- Использовался в reader UI до подключения реальной модели.

**MockTranslationService** (новый, для тестов):
- Принимает `Map<string, string>` для предсказуемых ответов.
- Fallback: возвращает `${input.word}-translated-${nativeLanguage}`.
- Симулирует delay через `await sleep(opts.delay ?? 0)`.

**LlamaTranslationService** (production):
- Зависит от: `LlamaContext` (llama.rn ctx), `CacheLayer`, `PromptBuilder`, `LlamaStatusStore`.
- Flow:
  1. Проверка `LlamaStatusStore.status === 'ready'`. Если нет → return MODEL_NOT_INSTALLED / MODEL_LOADING.
  2. `cacheLayer.lookup()` → если hit, return.
  3. `promptBuilder.build(input)` → string.
  4. `llamaCtx.completion(prompt, INFERENCE_CONFIG)` с timeout 5s.
  5. Post-process result.
  6. `cacheLayer.write()` (fire-and-forget).
  7. Return `{ status: 'ok', translation, source: 'inference' }`.

### 8.3 Timeout

5s hard timeout на `completion()`. После — abort через `llamaCtx.stopCompletion()`
+ return `INFERENCE_TIMEOUT`.

### 8.4 Concurrency

llama.cpp + llama.rn НЕ поддерживает concurrent inference (один KV-cache на
context). Сериализуем через mutex-queue:

```typescript
class InferenceQueue {
  private queue: Promise<unknown> = Promise.resolve();
  async run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => {});
    return next;
  }
}
```

Если user тапает 2 слова подряд — второй ждёт первого.

---

## 9. State management

### 9.1 LlmStatusStore (Zustand)

```typescript
// src/stores/llmStatusStore.ts
type LlmStatus =
  | 'not_installed'         // нет файла модели
  | 'downloading'           // прогресс ниже
  | 'paused'                // user pause или background pause
  | 'verifying'             // SHA check
  | 'installed'             // file ok, не загружен в RAM
  | 'loading'               // llama.cpp загружает в RAM
  | 'warming_up'            // первая dummy inference
  | 'ready'                 // готов к user requests
  | 'error';                // unrecoverable

interface LlmStatusStore {
  status: LlmStatus;
  progress: number; // 0..1, only во время downloading
  errorMessage: string | null;
  setStatus: (s: LlmStatus) => void;
  setProgress: (p: number) => void;
  setError: (msg: string | null) => void;
}
```

**Persist:** НЕТ. Status — runtime-only. Установка модели определяется по
наличию файла + SecureStore mark.

### 9.2 Lifecycle

1. App start:
   - RootLayout → check `ModelStore.getStatus()` → если `installed`, dispatch `loading`.
   - LlamaContextManager.init() → setStatus('loading') → load model → setStatus('warming_up').
   - Warmup → setStatus('ready').
2. User taps "Download model" → setStatus('downloading') → progress → setStatus('verifying') → setStatus('installed') → setStatus('loading') → ...

### 9.3 Reader integration

```typescript
// app/reader/[bookId].tsx (refactor onWordTap)
const llmStatus = useLlmStatusStore((s) => s.status);
const translation = useTranslationService();

const onWordTap = async (word: string, sentence: string) => {
  setPopup({ kind: 'opening', word, sentence });

  if (llmStatus !== 'ready') {
    setPopup({ kind: 'pending', word, sentence, reason: llmStatus });
    return;
  }

  const res = await translation.translate({...});
  // ... existing handling
};
```

---

## 10. UI

### 10.1 TranslationPopup states

**Существующий компонент** из #3 имеет `kind: 'opening' | 'pending' | 'success' | 'error' | 'closed'`.

**Расширение:**

```typescript
type TranslationPopupState =
  | { kind: 'closed' }
  | { kind: 'opening'; word: string; sentence: string }
  | { kind: 'pending'; word: string; sentence: string; reason?: 'loading' | 'downloading' | 'inferring' }
  | { kind: 'success'; word: string; translation: string; source?: 'memory' | 'db' | 'inference' }
  | { kind: 'error'; word: string; reason: string; code?: TranslationErrorCode };
```

**UI flow:**

- `opening` → spinner + word.
- `pending(loading)` → "Loading model…" + ActivityIndicator.
- `pending(downloading)` → "Downloading translation model…" + ссылка на Settings.
- `pending(inferring)` → spinner + word (cold inference в процессе).
- `success` → translation + word + (если cache hit) маленький badge `cached`.
- `error` → user-friendly message + Retry button.

### 10.2 Settings screen

**Новая секция "Translation" в Settings (sub-project #8):**

- Status: badge `Ready` / `Not installed` / `Loading`.
- "Download model" / "Re-download model" CTA.
- "Clear translation history" CTA (wipe TranslationCache).
- "Storage used" — размер модели + cache.

В #4 — минимальный hook (placeholder UI), полная реализация в #8.

### 10.3 Onboarding integration

После #1 онбординг flow заканчивается → если модель не установлена,
auto-trigger download (с возможностью пропустить):

- Screen: "Скачать языковую модель"
  - Текст: "1.8B параметров, ~700MB. Нужен Wi-Fi."
  - "Download now" / "Skip (download later)".
- Skip → app работает в `model not installed` mode (tap → "Установите модель в Settings").

В #4 — placeholder; реальная интеграция в #8 onboarding polish.

---

## 11. Security & Privacy

### 11.1 PII в логах

**НЕТ** в production logs:
- `WordOccurrence.context_sentence` content.
- Translation results.
- User-imported book content.

**ОК** в DEV (`__DEV__`):
- `[llm] inference word=X timing=Yms` — без context.
- `[llm] cache hit/miss` — без word.

### 11.2 Network

- Download URL hardcoded → HuggingFace mirror. Только HTTPS.
- Cert pinning v1: НЕТ. Опционально v2.
- НЕТ telemetry. НЕТ Sentry в v1.

### 11.3 Backup

- Model file: excluded from iOS iCloud / Android backup.
- TranslationCache: excluded from backup (см. CLAUDE.md).

### 11.4 Model integrity

- SHA-256 verification после download — обязательно.
- Mismatch → wipe файл, user message, не использовать.

### 11.5 Sandbox

- Модель в private app sandbox. Нет file system permissions кроме своего sandbox.

---

## 12. Performance

### 12.1 Targets (Pixel 7 / iPhone 13)

| Сценарий                       | Target    | Реалистично       |
|--------------------------------|-----------|-------------------|
| Cache memory hit               | <50ms     | <20ms             |
| Cache DB hit (cold session)    | <500ms    | ~100ms            |
| Inference (warm, 1 word)       | <3s       | 1.5-2.5s          |
| Inference (cold)               | <10s      | 5-8s              |
| Warm-up post-splash            | <8s       | 5-7s              |
| Download 700MB on Wi-Fi 100Mbps| ~60s      | ~60s              |

### 12.2 Memory

- Model context KV-cache: ~150-200MB RAM при загрузке.
- iOS 6GB+ RAM (iPhone 13+) → ОК.
- Android low-end: при <3GB RAM → recommend offline only, или показать warning.

### 12.3 Battery

- Inference Metal GPU (iOS) ~3-5W во время inference (короткие burst).
- Android CPU ~5-7W.
- 100 переводов за чтение сессию = ~5min total inference = ~1% battery.

### 12.4 Optimization

**Уже:**
- Inference queue для serial execution.
- In-memory LRU предотвращает повторный inference.
- Warm-up отрезает cold-start.

**v2:**
- Streaming completion для visual feedback.
- Speculative decoding.
- Quantization tuning (Q4_K_M для качества, IQ1_S для скорости — текущий выбор).

---

## 13. Errors

| Code                  | Trigger                              | UI message                                                |
|-----------------------|--------------------------------------|-----------------------------------------------------------|
| MODEL_NOT_INSTALLED   | Tap до download                      | "Установите языковую модель в Настройках"                |
| MODEL_LOADING         | Tap во время `loading`/`warming_up`  | "Модель загружается…"                                    |
| INFERENCE_TIMEOUT     | 5s превышен                          | "Не удалось перевести вовремя. Повторите."               |
| INFERENCE_FAILED      | llama.rn `.completion()` exception   | "Ошибка перевода. Повторите."                            |
| EMPTY_RESPONSE        | Модель вернула empty/whitespace      | "Не удалось перевести «WORD». Попробуйте контекст шире." |
| UNSUPPORTED_PAIR      | langPair не в supported set          | "Перевод {SRC}→{DST} пока не поддерживается"             |

---

## 14. Settings hooks (v4 stubs)

### 14.1 SettingsStore extensions

В `settingsStore.ts` (из #1) добавляем:

```typescript
// Эти поля ПЕРСИСТЯТСЯ через AsyncStorage allowlist (см. CLAUDE.md).
modelAutoDownload: boolean; // true: качаем сразу после onboarding
showSentenceTranslation: boolean; // (уже есть из #1, integration с #4)
translateOnWifiOnly: boolean; // только Wi-Fi для download (mobile data блок)
```

### 14.2 Actions

- `setModelAutoDownload(v: boolean)`.
- `setTranslateOnWifiOnly(v: boolean)`.

### 14.3 UI (placeholder в #4, real в #8)

- Settings screen: section "Translation Model".
- Cards: status, download/re-download, clear cache, settings toggles.

---

## 15. Database

### 15.1 TranslationCache table (уже определён в #2)

```sql
CREATE TABLE translation_cache (
  id TEXT PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  word TEXT NOT NULL,
  context_sentence TEXT NOT NULL,
  lang_pair TEXT NOT NULL,
  translation TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_translation_cache_key ON translation_cache(cache_key);
CREATE INDEX idx_translation_cache_created_at ON translation_cache(created_at);
```

### 15.2 TranslationCacheRepository (новый в #4)

```typescript
// src/db/repositories/TranslationCacheRepository.ts
export class TranslationCacheRepository {
  constructor(private db: Database) {}

  async findByKey(cacheKey: string): Promise<TranslationCacheRecord | null>;
  async create(input: CreateTranslationInput): Promise<TranslationCacheRecord>;
  async purgeOlderThan(timestampMs: number): Promise<number>; // returns deleted count
  async deleteAll(): Promise<void>;
  async count(): Promise<number>;
}
```

---

## 16. Test strategy

### 16.1 Unit (Jest)

- **CacheLayer**:
  - `cacheKey()` deterministic.
  - LRU eviction order.
  - lookup memory hit → не вызывает DB.
  - lookup DB hit → populate memory.
  - write does NOT block on DB.
- **PromptBuilder**:
  - Templates per language pair.
  - Sentence + word substitution.
  - CJK pairs use different quotes.
- **LlamaTranslationService**:
  - Mock `LlamaContext` interface.
  - `translate()` happy path → cache → no cache.
  - Timeout handling.
  - InferenceQueue serializes.
- **ModelManifest validation**:
  - SHA hex valid format.
  - URL is HTTPS.
- **ModelDownloader** (logic, не реальный download):
  - Pause/resume state machine.
  - SHA mismatch → error.
  - Network error retry policy.
- **LlmStatusStore**:
  - State transitions valid.

**MockLlamaContext interface:**
```typescript
interface LlamaContext {
  completion: (prompt: string, opts: InferenceConfig) => Promise<{ text: string }>;
  release: () => Promise<void>;
}
```

В тестах — простой Map-driven mock возвращает фиксированные ответы.

### 16.2 Integration (Jest)

- Full TranslationService flow с in-memory WatermelonDB + MockLlamaContext.
- Cache hit second request.
- Concurrent translate() запросы — order preserved.

### 16.3 Manual smoke (on device)

- Скачать модель (Wi-Fi).
- Open EPUB → tap word → translation popup.
- Tap same word второй раз → cache hit (badge).
- Tap новое слово → inference ~2s.
- Background app → reopen → cache survives.
- Settings → Clear cache → re-tap → inference опять.

---

## 17. Out of scope (для #4)

- ❌ FSRS-6 deck (это #6).
- ❌ Per-paragraph / per-sentence translation (только per-word).
- ❌ Streaming UI (одним блоком).
- ❌ Sentry / telemetry.
- ❌ Cert pinning.
- ❌ Multiple models / model switching.
- ❌ Cloud fallback.
- ❌ Tokenizer optimizations.
- ❌ Custom prompts per user.
- ❌ Background download notifications (iOS).

---

## 18. Open questions

1. **Hardcoded SHA-256?** Модель Hy-MT1.5-1.8B-1.25bit-GGUF — нужно достать
   реальный SHA-256 с HuggingFace. Поставлю placeholder в manifest, заменим
   перед smoke.

2. **App Store review:** автоматический download 700MB при первом запуске
   может вызвать review issues. Add explicit user CTA в onboarding.

3. **Android low-end devices:** что делать при <3GB RAM? Show warning / disable
   feature / suggest cloud-light alternative? **MVP: показываем warning,
   позволяем продолжить.**

4. **Network type detection:** `expo-network` API для Wi-Fi-only download.
   Доступно в SDK 54. Использовать для блокировки на mobile data.

5. **Resume after kill:** если app killed во время download — resume на cold
   start или restart with progress? **MVP: resume автоматически если
   `.partial` существует.**

---

## 19. Done criteria

- [x] PR #3 reader-engine merged or rebased (предусловие).
- [ ] `llama.rn` установлен + pod install + gradle sync.
- [ ] ModelDownloader реализован + tested.
- [ ] LlamaContextManager singleton реализован.
- [ ] CacheLayer (in-memory + DB) реализован + tested.
- [ ] PromptBuilder с 13×13 templates реализован + tested.
- [ ] LlamaTranslationService реализован + tested.
- [ ] LlmStatusStore (Zustand) реализован + tested.
- [ ] TranslationCacheRepository реализован + tested.
- [ ] Warmup integration в RootLayout.
- [ ] TranslationPopup states расширены.
- [ ] Settings placeholder UI (Re-download, Clear cache).
- [ ] Onboarding placeholder (Download model step).
- [ ] `npx tsc --noEmit && npx jest` clean.
- [ ] Smoke на симуляторе с MockLlamaContext.
- [ ] Smoke на iOS device с реальной моделью (отдельно после merge).
- [ ] PR #4 opened, stacked on #3.
