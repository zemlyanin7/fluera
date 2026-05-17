# Device benchmark protocol

> Real-device perf measurement для Hy-MT 1.5 1.8B 1.25-bit on iPhone 13 + Pixel 7
> (CLAUDE.md floor targets). Required blocking action item.

## Setup

1. Build app на target device (not simulator):

```bash
# iPhone 13 (connected via USB or wireless)
npm run ios -- --device "iPhone 13"

# Pixel 7
npm run android
```

2. Open Settings → Translation Model.
3. Download model (440 MB, one-time).
4. Wait until status = "Готово" (warmup complete).

## Measurement scenarios

### S1: Warm word translation latency

1. Open book (any).
2. Tap 10 different words (one at a time).
3. Observe Metro console logs:

```
[translate] start "word" prompt=XXXch
[translate] done "word" XXXXms → "translation"
```

Record latency per word. Compute median + p95.

**Target**: median ≤ 3000ms (CLAUDE.md SLA <3s).

### S2: Cold reload + first inference

1. After S1, leave app idle 6+ minutes (idle unload timer 5min).
2. Verify Settings status = "Установлена" (unloaded).
3. Open book, tap word.
4. Observe sequence:

```
[llm] load start
[llm] load done XXXXms
[llm] warmup start
[llm] warmup done XXXXms text=""
[translate] start "word" prompt=XXXch
[translate] done "word" XXXXms → "translation"
```

Total cold latency = load + warmup + translate.

**Target**: total ≤ 10s.

### S3: Sustained translation (battery + thermal)

1. After warmup, tap 50 different words rapidly (every 2-3s).
2. Monitor:
   - iPhone: Settings → Battery → Battery Level over 10min.
   - Android: Battery stats via `adb shell dumpsys batterystats`.
3. Thermal: feel device + watch for app frame drops.

**Target**:
- Battery drain ≤ 5% per 50 translations.
- No thermal throttling within 50 translations.

### S4: Sentence translation (если pair passes chrF)

After Hy-MT chrF baseline confirmed, repeat S1/S2 для:

```typescript
service.translateSentence({
  sentence: "The quick brown fox jumps over the lazy dog.",
  bookLanguage: 'en',
  nativeLanguage: 'ru',
});
```

**Target**: warm sentence translation ≤ 15s, cold ≤ 25s.

### S5: Prefetch throughput

(After #4.6 prefetch implementation.)

1. Open book.
2. Idle 20+ sec — prefetch triggers.
3. Console:

```
[prefetch] batch start, 42 words
[prefetch] batch done, 42 words, 67432ms
```

Compute: words/sec sustained.

**Target**: ≥ 0.5 words/sec sustained (iPhone 13) for 50-word batches.

## Data collection

Record в `scripts/eval/device-results.json`:

```json
{
  "device": "iPhone 13 Pro, iOS 17.5, 4GB RAM",
  "measuredAt": "2026-05-17T22:00:00Z",
  "modelLoadMs": 2840,
  "warmupMs": 1855,
  "warmTranslate": {
    "median": 1842,
    "p95": 2756,
    "samples": 10
  },
  "coldTranslate": {
    "totalMs": 8932,
    "loadMs": 2840,
    "warmupMs": 1855,
    "firstInferenceMs": 4237
  },
  "battery": {
    "before": 87,
    "after": 84,
    "samples": 50
  },
  "thermal": {
    "observed": "warm but no throttle",
    "frameDrops": "none observed"
  },
  "sentence": {
    "warmMs": 12340,
    "coldMs": 22186,
    "samples": 5
  },
  "prefetch": {
    "wordsPerSec": 0.67,
    "samples": 50
  }
}
```

## Pass/fail criteria

Block #4.5 / #4.6 implementation если:

- Warm word translation median > 5000ms (target 3000ms — 67% headroom).
- Cold reload total > 20s (target 10s — 100% headroom).
- Battery drain > 10% per 50 translations.
- Thermal throttling observed within 50 translations.
- Prefetch < 0.2 words/sec sustained.

Failure mode → revisit Hy-MT model choice (Q4_K_M alternative, etc).

## Why iPhone 13 + Pixel 7

CLAUDE.md performance floor:
- "60fps на Pixel 7 / iPhone 13".
- iPhone 13 = A15 Bionic, 4GB RAM (smallest iPhone we target).
- Pixel 7 = Tensor G2, 8GB RAM (representative mid-range Android 2022).

Real testing на newer devices (iPhone 15+, Pixel 8+) shows aspirational best-case,
not minimum. Validate floor before ship.
