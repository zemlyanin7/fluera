# #4.6 Plan v1 Review Findings (18 P0 + 24 P1)

> Findings от 3 параллельных reviewers (architecture / RN-Expo / TDD plan quality).
> План v1: `docs/superpowers/plans/2026-05-18-translation-prefetch.md` (4086 lines, 47 tasks, 9 phases).
> Spec: `docs/superpowers/specs/2026-05-17-translation-prefetch-design.md` (v2.1).

---

## Environment facts (verified)

- Expo SDK 54, `expo: ~54.0.33`, `expo-crypto: ~15.0.9`, `expo-file-system: ~19.0.22`
- `expo-battery` NOT installed (Phase 0 must `npx expo install expo-battery`)
- `expo-secure-store` IS installed
- DB SCHEMA_VERSION already = 3 → plan does v3 → v4 migration
- `inference_context` column уже в v3 schema → migration 0004 adds только `source`, `ttl_days`, `chrf_score`
- `createLlamaLoader` уже имеет `n_ctx: 2048` → Phase 8 adds только `cache_prompt: true`
- llama.rn adapter signature: `LlamaContextAdapter.completion(promptOrMessages: string | ChatMsg[], config: InferenceConfig)` — 2 positional args

---

## Architecture P0s (5)

### A0-1: "Priority queue" фактически FIFO, не priority queue

Task 2.2 implements `this.serial = this.serial.then(...)` — single Promise chain. User tap behind 49 prefetch jobs ждёт все. Нет concept of priority insertion. Test only validates "serializes user calls", не "user preempts prefetch" — entire UX guarantee v2.1 rests on this.

**Fix**: replace `serial` with two FIFO sub-queues (`userQueue[]` + `prefetchQueue[]`) + `drain()` dispatcher that always shifts from userQueue first. Add explicit preemption test: enqueue 5 prefetch jobs, then user job mid-flight, verify user runs as job 4 (not job 6).

### A0-2: Word-mode 32-token cap НЕ implemented нигде

Spec §6.7 и v2.1 changelog hinge on cap (3s SLA for user preemption). Task 5.2 calls `translation.translate(...)` без `max_tokens` override. Task 8.1 `createLlamaLoader` не pins. Nothing splits long sentences. **Без cap'а sentence prefetch блокирует user tap на 5-15s — priority inversion v2.1 заявляет fixed, но не fixed.**

**Fix**: in `runInference(prompt, config, priority)`, when `priority === 'prefetch'`, apply `max_tokens: Math.min(config.max_tokens ?? 32, 32)`. PrefetchScheduler splits sentence prefetch per-sentence (one job each).

### A0-3: `INFERRING → UNLOADED` transition missing entirely

Spec §3.2 mandates on memory pressure or background during INFERRING, finish ≤3s job then unload. Plan has:
- `AppStateBridge` (Task 3.1) calls `void this.lifecycle.unload()` directly без wait-for-inferring logic.
- `unload()` in Task 2.1 sets `state = 'unloaded'` and calls `ctx.release()` regardless of in-flight `completion()`.

Result: `ctx.release()` runs while `ctx.completion()` pending → **llama.rn native crash or hang**. Highest-risk runtime bug.

**Fix**: `unload()` must:
1. Set `state = 'unloading'`.
2. Mark all queued jobs `aborted = true`.
3. Wait `while (this.draining) await sleep(50)` until current in-flight completes.
4. THEN `await ctx.release()`.

### A0-4: `unload()` races with `runInference()`

Task 2.1's `unload()` nulls `this.context` synchronously. Task 2.2's `runInference` captures `const ctx = this.context!` *before* await. If `unload()` between capture и `ctx.completion()`, inference runs against released context.

**Fix**: A0-1 dispatcher captures `this.context` *inside* drain loop, not before. Combined with A0-3 the race vanishes.

### A0-5: "Consecutive" load failure semantics undefined

3 concurrent failed taps trigger ONE increment of `consecutiveLoadFailures` (all wait on same `loading` promise). Permanent-disable threshold (3) никогда не trips reliably. Plus: spec silent on whether app restart resets counter.

**Fix**:
- Counter in-memory only (volatile).
- Resets on: successful load, `clearPermanentDisable()`, app restart (counter starts 0).
- `llm_permanently_disabled` flag в SecureStore persists across restarts.
- One-shot guard so concurrent waiters increment counter exactly once per failed promise.

---

## Architecture P1s (highlights, 9 total)

- **P1-A**: Idle timer never re-arms after `INFERRING → READY`. `setTimeout` callback fires during INFERRING, sees inferring, does nothing, never re-arms → model stays loaded forever.
- **P1-B**: `PrefetchScheduler.runBatch` re-entry possible. Add `currentBatch: Promise<void> | null` guard.
- **P1-C**: Cancellation requeue missing. Plan drops aborted words instead of requeue.
- **P1-D**: Atomic upgrade `.partial` startup orphan cleanup undefined. Resume vs restart not chosen.
- **P1-E**: Disk-space purge не coordinates с in-flight prefetch — purge entries только что written.
- **P1-F**: `onMemoryPressure` в API но no bridge/test/wiring. Spec §5.1 = "v1 AppState only" → remove from API.
- **P1-G**: TTL 30d boundary не implemented. User reading day 31 starts cache miss mid-session. Add lazy purge in `CacheLayer.lookup`.
- **P1-H**: Concurrent `onAppBackground` + `onMemoryPressure` not tested. Both call `unload()`.
- **P1-I**: `inference_context` vs `source` rule muddled. Add one-line invariant: `inference_context = 'cold' → skip persist; source determines TTL only when persisting`.

---

## RN/Expo P0s (6)

### E0-1: `Battery.getPowerStateAsync()` REMOVED в SDK 52+

Plan uses `Battery.getPowerStateAsync()` в `BatteryBridge.start()`. SDK 54 НЕ имеет такого API → runtime `TypeError`. Jest mock papers over → tests pass, prod crashes.

**Fix**: compose:
```typescript
const [pct, state, lowPower] = await Promise.all([
  Battery.getBatteryLevelAsync(),
  Battery.getBatteryStateAsync(),
  Battery.isLowPowerModeEnabledAsync(),
]);
const charging = state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
```

Update jest mock accordingly.

### E0-2: SHA-256 of 700MB GGUF — `expo-crypto.digestStringAsync` берёт STRING

700MB файл нельзя загрузить как string. `digestStringAsync` ломается. Per-chunk digests не composable.

**Fix**: install `js-sha256` (Phase 0 new task), chunked file read via legacy `expo-file-system.readAsStringAsync({ encoding: 'base64', position, length })` + Uint8Array (atob), update hasher per chunk.

```typescript
import { sha256 } from 'js-sha256';
import * as FileSystem from 'expo-file-system';

export async function sha256OfFile(path: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists || !info.size) throw new Error('file_not_found');
  const hasher = sha256.create();
  const CHUNK = 1024 * 1024;
  let position = 0;
  while (position < info.size) {
    const length = Math.min(CHUNK, info.size - position);
    const b64 = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.Base64, position, length,
    });
    const bin = globalThis.atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    hasher.update(bytes);
    position += length;
  }
  return hasher.hex();
}
```

### E0-3: `expo-file-system@19.x` API split — legacy vs `/next`

SDK 54 ships BOTH legacy (`getInfoAsync`/`moveAsync`) AND `/next` (`new File(uri).move()`). План не pins. Android cross-volume `moveAsync` не atomic (copy+delete).

**Fix**: pin legacy для `moveAsync`/`deleteAsync`. `/next` reserved только для `Paths.availableDiskSpace`. Document Android cross-volume non-atomicity, mitigated via SHA-verify on next launch.

### E0-4: `getFreeDiskStorageAsync` не в `expo-file-system`

Legacy не expose. RN `PlatformConstants` только Android. iOS требует `expo-file-system/next` `Paths.availableDiskSpace`.

**Fix**: use `expo-file-system/next` `Paths.availableDiskSpace` (cross-platform SDK 54).

### E0-5: SecureStore mock missing из jest.setup.js

Phase 0 only adds `expo-battery` mock. Permanent-disable test `expo-secure-store.setItemAsync` → `Cannot find module`.

**Fix**: new Task 0.4 adds mock:
```javascript
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));
```

### E0-6: `LowPowerModeEvent` type cast hides shape

`(e: any)` masks actual type. Use `Battery.LowPowerModeEvent`.

---

## RN/Expo P1s (highlights)

- **P1-K**: AppState `'inactive'` triggers unload too aggressively. iOS fires `inactive` on Control Center pull, app switcher peek, Face ID. Plan unloads on both `background` AND `inactive`. **Fix**: only `background` unloads. `'inactive'` pauses prefetch only.
- **P1-L**: `accessibilityLiveRegion` Android-only. iOS silent. Plan имеет ТОЛЬКО liveRegion → no audible announce on iOS. **Fix**: also `AccessibilityInfo.announceForAccessibility(text)` в useEffect.
- **P1-M**: Shimmer animation actually static View. Misnamed. Rename `LazyReloadIndicator` OR add Reanimated worklet `useAnimatedStyle` + `withRepeat` + `'worklet'` directive.
- **P1-N**: `useEffect([book?.id])` scheduler cleanup pattern leaks on hot-reload. Cleanup must be в SAME `useEffect` as creation.
- **P1-O**: KeepReady "dropdown" — fake Pressable cycle. Screen reader broken. Use radio group OR @gorhom/bottom-sheet picker.
- **P1-P**: Plural rules missing. Russian имеет `_one`/`_few`/`_many`/`_other`. Use i18next `count` interpolation.

---

## TDD Plan format P0s (7)

### T0-1: Task 6.4 "or wherever app version renders"

> `Modify: src/components/settings/AboutSection.tsx (or wherever app version renders — search for MODEL_MANIFEST.version or app.json version display)`

Fresh subagent в isolation не resolve "or wherever". Pin exact path или create new `AboutSection.tsx` с explicit code.

### T0-2: Task 5.4 reader wire-up hand-wavy

> "In app/reader/[bookId].tsx, near other reader hooks, add (find the JSX root and the scroll/tap handler areas):"

No surrounding context. Subagent не knows where to inject `prefetch.onScroll()`. **Fix**: read actual `[bookId].tsx` и show explicit `Edit` patches с real `old_string`/`new_string`.

### T0-3: Task 5.4 `extractPageTexts: async () => []` stub

> `extractPageTexts: async () => [], // wired by caller via deps replacement в future task`

"Future task" never named. Prefetch system inert. **Fix**: implement in Task 5.4a using `state.chapters` shape:
```typescript
function extractPageTexts(chapters, currentIdx, lookahead) {
  const out = [];
  for (let i = currentIdx + 1; i <= currentIdx + lookahead && i < chapters.length; i++) {
    const text = chapters[i].items
      .map(item => 'inlines' in item ? item.inlines.map(n => 'text' in n ? n.text : '').join('') : '')
      .join('\n');
    out.push(text);
  }
  return out;
}
```

### T0-4: Task 4.3 freq lists "Continue with ~500 entries"

Subagent invents 13 word lists from scratch — violates "never hallucinate". **Fix**: `scripts/generate-freq-fixtures.ts` с hand-picked seed table (50 words × 13 langs = 650 inline). Production curation deferred к v2 backlog.

### T0-5: Task 6.2 11-langs "fallback to English verbatim"

Violates "never hallucinate". **Fix**: 11 langs get keys с English fallback values + `"_NEEDS_TRANSLATION": true` marker. v2 backlog: "Professional translation pass for 11 remaining locales".

### T0-6: Task 8.4 "if callers remain"

> "If callers remain, replace each with ModelLifecycleManager.instance() API"

Judgment call mid-task. **Fix**: Task 8.3 explicitly enumerates references via `grep -rn "LlamaContextManager" src/ app/`. Task 8.4 just deletes — no condition.

### T0-7: Task 7.3 test rewritten after impl

Step 1 writes test. Step 3 says "Adjust test expectations: explicit `contextLoadSucceeded: false` в third test". Anti-TDD. **Fix**: write correct test в Step 1, drop Step 3 adjustment.

---

## TDD Plan P1s (highlights)

- Cross-task file overlap: `en.json` modified by Task 3.4 + Task 6.1.
- Cross-task file overlap: `TranslationCacheRepository.ts` written by Task 1.4 AND modified by 1.5. Subagent isolation = potential conflict.
- Task 3.4 commits LazyReloadShimmer с `t('translation.lazyReload.preparing')` но `ru.json` не updated → QA в non-English locale crash between Task 3.4 и 6.2.
- Task 7.1 verify-kernel script calls `ctx.completion({messages, jinja, ...c})` (single-object) но adapter signature `(messages, config)` two-arg.
- Task 3.2 idle timer impl не shown inline.
- Task 8.5 markdown patch без explicit before/after pair.

---

## P2 (low priority, apply if trivial)

- Debounce `onScroll` 200ms via setTimeout.
- Dynamic `await import()` для frequency lists (avoid eager 2.6MB parse).
- `InteractionManager.runAfterInteractions` для candidate extraction.
- Zustand selector usage в DevOverlay (avoid full-state re-renders).
- `gh auth status` precheck before `gh pr create`.

---

## Summary table

| Category | P0 | P1 | P2 |
|----------|----|----|----|
| Architecture | 5 | 9 | 5 |
| RN/Expo | 6 | 6 | 4 |
| TDD Plan format | 7 | 9 | 5 |
| **Total** | **18** | **24** | **14** |
