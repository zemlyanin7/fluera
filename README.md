# Fluera

> 🇬🇧 English (default) — [🇷🇺 Русская версия](./README.ru.md)

A multilingual mobile reading app that helps you learn languages by reading.
Tap a word, get an **on-device translation** (no backend), drag to select a
phrase, hold for a sentence-level translation, save to your spaced-repetition
deck. Supports EPUB and FB2, 13 UI languages, fully offline.

**Stack:** React Native 0.81 · Expo SDK 54 · TypeScript strict · Zustand v5 ·
WatermelonDB 0.28 · react-native-unistyles v3 · @gorhom/bottom-sheet v5 ·
Reanimated 4 · llama.rn (vendored fork with STQ1_0 patch) · Hy-MT1.5-1.8B
GGUF at 1.25-bit quantisation.

---

## What works today

Roadmap status:

| # | Sub-project | Status | Notes |
|---|-------------|--------|-------|
| 1 | Foundation | ✅ done | Theming (3 themes × 6 script variants), 12 UI primitives, 26 icons, Expo Router, embedded fonts. |
| 2 | Data layer | ✅ done | WatermelonDB 0.28 schema (currently v4), repositories, Zustand persist for preferences. |
| 3 | Reader engine | ✅ done | EPUB and FB2 parsers written from scratch — no WebView. Native render via `ContentItem[]` / `InlineNode[]`. |
| 4 | Translation core | ✅ done | On-device LLM (Hy-MT1.5-1.8B-1.25bit) via vendored llama.rn fork. Covers all 13 × 13 = 169 language pairs. |
| 4.5 | Popup redesign | ✅ done | Tiered popup (word / phrase / sentence), MWE detection, false friends, polysemy, race-safe taps. |
| **4.6** | **Prefetch + Lifecycle** | 🚧 in progress | Phase 0+1 shipped (DB v4 with `source`/`ttl_days`/`chrf_score` on `translation_cache`, cache provenance/TTL by source, `js-sha256` for chunked model SHA verification, `expo-battery` installed). Remaining: `ModelLifecycleManager` state machine, `PrefetchScheduler`, Settings UI, kernel-verify CI. |
| 5 | Library | ⏳ planned | OPDS catalogues + local file import. |
| 6 | Deck | ⏳ planned | FSRS-6 spaced repetition, driven by reading-session encounters. |
| 7 | Stats | ⏳ planned | Reading streak, words learned, charts. |
| 8 | Onboarding / Settings polish | ⏳ planned | First-run flow, lookup history, OPDS credentials, redownload. |

**v2 backlog:** whole-book batch translation, gamification, TTS audio,
diagnostic bundle export, heavyweight lemmatisation for ru/uk/pl/de/ar/hi/ja/ko.

---

## Product vision

Reading-first app. The user opens a book in a foreign language and reads;
instant per-word, per-phrase, and per-sentence translation is always one tap
away. Vocabulary acquisition happens organically through reading — it is
**not** the primary KPI. The whole experience runs on-device: no API keys,
no cloud fallback, no backend in v1 or v2.

---

## Languages

UI language, book language, and native language are fully symmetric. 13
languages supported in v1:

`en` · `ru` · `pl` · `uk` · `es` · `fr` · `de` · `it` · `pt` · `ja` · `ko` ·
`ar` · `hi`

The on-device model is required to cover all 169 pairs; quality varies per
pair but a baseline translation is always available.

---

## Getting started (dev)

```bash
# 1. Install JS dependencies
npm install

# 2. iOS only: install CocoaPods (macOS + Xcode required)
cd ios && pod install && cd ..

# 3. Native prebuild (only needed after changing config plugins or native deps)
npx expo prebuild --clean

# 4. Run a dev-client build
npx expo run:ios       # macOS host required
npx expo run:android   # any host with Android SDK

# 5. After the dev-client is installed, you can iterate on JS only:
npx expo start --dev-client
```

> Expo Go is **not supported** — Fluera has native modules (llama.rn fork,
> WatermelonDB, secure store, blur, etc).

---

## Test + quality gates

```bash
npm test               # Jest unit tests
npm run typecheck      # tsc --noEmit
npm run lint           # expo lint
```

Run all three before committing. The CI workflow at
`.github/workflows/kernel-verify.yml` additionally runs a kernel-fidelity
check on every llama.rn bump.

---

## App size

The bundle contains ~38 fonts (~15–25 MB) so all 6 script variants render
offline without FOUT/FOIT. This is a deliberate trade-off in favour of
offline reading. APK splits and lazy script loading are on the v2 backlog.

The Hy-MT GGUF model (~462 MB) is downloaded **on first launch**, not
bundled, so the App Store / Play Store binary stays small.

---

## Repository layout

```
app/                              # Expo Router routes
  reader/[bookId].tsx             # core reader screen
  library/                        # library + import
  settings/                       # preferences

src/
  components/                     # UI, organised by feature domain
    reader/                       # popup, sentence card, encounter badge, …
    settings/                     # settings sections
    ui/                           # primitives
    icons/                        # 26 custom SVG icons

  services/
    reader/                       # EPUB/FB2 parsers + sentence extraction
    translation/                  # llama.rn adapter, cache, prefetch, MWE
    library/                      # OPDS + file import (planned)

  stores/                         # Zustand stores (with persist)
  db/                             # WatermelonDB schema, models, repositories
  theme/                          # tokens + Unistyles config
  i18n/                           # 13 locale JSONs
  types/                          # canonical render types
  fixtures/                       # dev/test fixtures

vendor/llama.rn/                  # vendored fork with STQ1_0 patch
assets/                           # icons, splash, fonts (build-time)
docs/superpowers/                 # specs, plans, smoke matrices, handoff notes
```

---

## Documentation

- **Canonical design doc:** `docs/superpowers/specs/2026-03-13-fluera-design.md`
  (original; partial sections superseded by per-sub-project specs below).
- **Foundation:** `docs/superpowers/specs/2026-05-15-foundation-design.md`
- **Translation popup (#4.5):**
  `docs/superpowers/specs/2026-05-17-translation-popup-design.md`
- **Prefetch + Lifecycle (#4.6):**
  `docs/superpowers/specs/2026-05-17-translation-prefetch-design.md`
- **Project standards:** [`CLAUDE.md`](./CLAUDE.md) — coding conventions,
  AsyncStorage allowlist, theming rules, security policies, observability
  decisions.

---

## License & data

- Code: see `LICENSE` (TBD before public release).
- Books: not shipped with the app. The user imports their own files or
  connects an OPDS catalogue (#5).
- Translation cache: stored locally only. "Clear translation history" in
  Settings purges it; "Clear all my data" also wipes
  `WordOccurrence.context_sentence` and `ReadingStats`.

No telemetry, no analytics, no remote crash reporting in v1.
