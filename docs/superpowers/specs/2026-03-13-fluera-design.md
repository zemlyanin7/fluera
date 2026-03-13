# Fluera — Design Specification

**Date:** 2026-03-13
**Status:** Approved
**Version:** 1.1

Multilingual reader app for learning languages through reading. Users open books in their target language, tap words/phrases for contextual AI translation, and build vocabulary with spaced repetition.

## 1. Vision

Fluera is a mobile reader (iOS/Android) for learning any language through reading books. The user opens a book in their target language, taps a word or phrase and gets contextual AI translation into their native language. Words are saved to a personal dictionary with context.

**Key differentiator:** Open content architecture (OPDS + WebDAV + Google Books/Open Library + own catalog + file upload) + multilingual AI translation via cheap LLMs + cross-platform sync.

### Evolution in Four Waves

| Wave | Books in | UI Languages / Translate to | Markets |
|------|----------|----------------------------|---------|
| 1 | English | RU, PL, UK | Russia/CIS, Poland, Ukraine |
| 2 | English | + ES, IT, FR, DE, PT | Spain, Italy, France, Germany, Portugal |
| 3 | English | + TR, JA, KO, PT-BR, AR | Turkey, Japan, Korea, Brazil, Arab countries |
| 4 | Any | Any → Any | Global |

`bookLanguage` + `nativeLanguage` are parameterized from day one — Wave 4 requires no rewrite.

## 2. Competitive Context

No product combines: open catalogs + file upload (epub+fb2+pdf) + multilingual AI translation + OPDS/WebDAV. This is an unoccupied niche.

| Feature | LingQ | Beelinguapp | EWA | Smart Book | **Fluera** |
|---------|-------|-------------|-----|------------|------------|
| Files epub/fb2/pdf | epub | No | No | epub | epub+fb2+pdf |
| OPDS catalogs | No | No | No | No | Yes |
| WebDAV | No | No | No | No | v2 |
| AI contextual translation | No | No | No | No | DeepSeek |
| Cross-platform subscription | Yes | No | Partial | No | RevenueCat |
| Sync | Yes | No | No | No | Backend+cloud |
| Multi-language books | Yes | No | No | No | Wave 4 |
| Modern UX | Weak | Good | Good | Basic | Target |

**Why this niche exists:** LingQ has the richest functionality but outdated UX and $12.99/month. Beelinguapp is beautiful but closed-content only. EWA is gamification-over-learning. Smart Book is close but lacks catalogs and AI. Fluera targets the intersection of open content + AI translation + modern UX at $4.99/month.

## 3. Architecture

### 3.1 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | React Native (Expo) | Cross-platform mobile |
| Navigation | Expo Router | File-based routing, deep linking |
| State (client) | Zustand | UI state (theme, reader position, settings) |
| State (server) | React Query (TanStack Query) | Server data, OPDS catalogs, API calls |
| UI Components | Tamagui | Themed components, dark/light/sepia |
| Animations | Reanimated 3 | Smooth reader transitions |
| Database | WatermelonDB (SQLite) | Offline-first, lazy queries |
| Epub Reader | @epubjs-react-native/core | Epub rendering in WebView |
| FB2 Parser | fast-xml-parser | FB2 XML parsing to React components |
| OPDS Parser | fast-xml-parser | Atom/XML OPDS catalog parsing |
| i18n | i18next + react-i18next | UI localization |
| Subscriptions | RevenueCat SDK | Cross-platform entitlements |
| LLM (primary) | DeepSeek V3.2 (OpenAI-compatible) | Contextual translation |
| LLM (fallback) | Gemini 2.0 Flash-Lite | Fallback + free tier |
| LLM (premium) | Claude Haiku 4.5 | Premium deep explanations (v2) |
| Analytics | PostHog (or Mixpanel) | User behavior analytics |
| Crash Reporting | Sentry | Error tracking and crash reports |

**LLM model selection rationale:** Qwen 2.5 (SiliconFlow, $0.05/$0.05) and GPT-5 nano ($0.05/$0.40) were evaluated but excluded from the initial architecture. DeepSeek V3.2 offers better quality for slavic/CJK languages at comparable cost. Gemini Flash-Lite provides a free tier. These models remain candidates for future A/B testing or additional fallback tiers if DeepSeek quality degrades for specific language pairs.

**Tamagui note:** Pin to Tamagui v2.x stable. Validate WebView compatibility during Phase 0 epub spike since Tamagui styles don't apply inside WebView (epub reader uses its own CSS).

### 3.2 System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    FLUERA CLIENT                        │
│  Expo (React Native)                                    │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Reader   │ │ Library  │ │ Dictionary│ │ SRS Review│  │
│  │ (epub/   │ │ (OPDS +  │ │ (words + │ │ (SM-2)    │  │
│  │  fb2/pdf)│ │  files)  │ │  context) │ │           │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬──────┘  │
│       │             │            │             │         │
│  ┌────┴─────────────┴────────────┴─────────────┴──────┐ │
│  │              State Layer (Zustand + React Query)    │ │
│  └────┬──────────────────────────────────────────┬────┘ │
│       │                                          │      │
│  ┌────┴──────┐                           ┌───────┴────┐ │
│  │WatermelonDB│                           │LLM Service │ │
│  │ (offline  │                           │(DeepSeek/  │ │
│  │  SQLite)  │                           │ Gemini)    │ │
│  └───────────┘                           └────────────┘ │
│                                                         │
│  ┌────────────┐ ┌────────────┐ ┌────────────────────┐   │
│  │ Expo Router│ │  Tamagui   │ │  i18next           │   │
│  │(navigation)│ │ (UI/themes)│ │ (RU,PL,UK,EN)      │   │
│  └────────────┘ └────────────┘ └────────────────────┘   │
│                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐  │
│  │ RevenueCat   │ │ Reanimated 3 │ │ Sentry+PostHog │  │
│  │(subscriptions│ │ (animations) │ │ (monitoring)   │  │
│  └──────────────┘ └──────────────┘ └────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API
┌──────────────────────┴──────────────────────────────────┐
│                      BACKEND (MVP)                      │
│  Fastify + PostgreSQL + Redis                           │
│  • Auth (email/OAuth, JWT)                              │
│  • Sync (progress, dictionary)                          │
│  • RevenueCat webhooks                                  │
│  • Curated catalog (v3)                                 │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Translation Pipeline

```
User taps word or selects phrase
  → Check TranslationCache (SQLite)
    cache_key = SHA-256(lowercase(word) + context_window + lang_pair), truncated to 32 chars
    context_window = up to 5 words before and after; at sentence boundary use available words
    → HIT: return cached translation (< 5ms)
    → MISS:
      → Build prompt:
        - Single word: "Translate '{word}' in context '{sentence}', {bookLang}→{nativeLang}.
          Give: translation, brief explanation, example."
        - Phrase: "Translate phrase '{phrase}' in context '{sentence}', {bookLang}→{nativeLang}.
          Give: translation, meaning as a whole."
      → Call DeepSeek V3.2 (timeout: 3s)
        → On HTTP 429/500/timeout: retry once after 1s
        → On second failure: fallback to Gemini Flash-Lite (timeout: 5s)
          → On Gemini failure: show user "Translation unavailable" with retry button
      → Cache result (eviction: LRU, max 100,000 entries per language pair)
      → Return translation + optional grammar note
```

**Phrase selection mechanism:**
- **Epub (WebView):** JavaScript bridge. Inject `window.getSelection()` listener via `postMessage`. When user long-presses and drags to select, WebView sends selected text + surrounding sentence to React Native via `onMessage`. Max phrase length: 10 words.
- **FB2 (native):** Use React Native `Text` component with `selectable={true}`. Capture selection via `onSelectionChange` event. Extract selected range and surrounding sentence from parsed FB2 data.

**Error states visible to user:**
- Loading: shimmer animation in translation popup
- Timeout/failure: "Could not translate. Check connection and try again." + retry button
- Rate limited: "Too many requests. Please wait a moment." + auto-retry after delay

**Economics (DeepSeek V3.2):**
- 1 translation: ~$0.00005 (~150-200 tokens)
- 100 translations/day per user: $0.15/month
- With caching: real costs 40-60% lower
- Margin at $4.99/month subscription: >95%

### 3.4 Backend API (MVP)

**Auth endpoints:**
- `POST /auth/register` — email + password → JWT tokens
- `POST /auth/login` — email + password → JWT tokens
- `POST /auth/refresh` — refresh token → new access token
- `POST /auth/oauth/{provider}` — OAuth callback (Google, Apple)

**Sync endpoints:**
- `POST /sync/push` — client sends changes since last sync (progress, dictionary, settings)
- `GET /sync/pull?since={timestamp}` — server returns changes since timestamp
- `GET /sync/full` — full state dump (first sync or conflict resolution)

**Conflict resolution:** Last-write-wins based on `updated_at` timestamp. Each syncable record carries `updated_at` and `device_id`. On conflict, the most recent `updated_at` wins. This is simple and sufficient for single-user data (progress, dictionary). If a user edits the same word entry on two devices offline, the last synced version wins.

**RevenueCat:**
- `POST /webhooks/revenuecat` — subscription lifecycle events

**API versioning:** URL prefix `/api/v1/`. Breaking changes increment version.

## 4. UI/UX Design

### 4.1 Design Direction

**Hybrid style** — Beelinguapp's visual polish with LingQ's functionality depth. Modern, clean UI that doesn't overwhelm but provides access to powerful features through progressive disclosure.

### 4.2 Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#6c63ff` | Buttons, accents, brand |
| Dark BG | `#1a1a2e` | Reader dark theme |
| New Word | `#4a90d9` | Blue — unknown words (status 1) |
| Learning | `#f5c842` | Yellow — words being learned (status 2-4, opacity varies) |
| Progress | `#4caf50` | Progress bars, success states |
| Sepia BG | `#f5f0e1` | Reader sepia theme |

### 4.3 Reader Themes

- **Light:** White background, dark text
- **Dark:** `#1a1a2e` background, `#e0e0e0` text
- **Sepia:** `#f5f0e1` background, `#5b4636` text

### 4.4 Word Status Color System (LingQ-inspired)

| Status | Color | Visual | Meaning |
|--------|-------|--------|---------|
| 1 (New) | `#4a90d9` blue | Solid highlight | Never seen before |
| 2 (Recognized) | `#f5c842` yellow, 100% | Solid yellow | Looked up once |
| 3 (Familiar) | `#f5c842` yellow, 70% | Lighter yellow | Seen multiple times |
| 4 (Learned) | `#f5c842` yellow, 40% | Faint yellow | Almost known |
| Known | No highlight | Plain text | Fully known |

**Accessibility:** Word status colors meet WCAG 2.1 AA contrast ratios against all three reader themes. Blue `#4a90d9` on dark `#1a1a2e` = 4.7:1. Yellow `#f5c842` on dark = 10.5:1. All interactive elements have VoiceOver/TalkBack labels. Dynamic Type scaling supported for reader text. `prefers-reduced-motion` respected for animations.

### 4.5 Key Screens

**Reader:** Central text area with word highlighting. Tap triggers bottom sheet with translation, context, TTS button, grammar button, "add to dictionary" button. Top bar: back, chapter title, progress %, settings gear.

**Library:** Tab bar (My Books / Catalogs / Upload). Book cards with cover, title, author, progress bar, word count, difficulty badge (% new words).

**Dictionary:** List of saved words with context sentences, word status badges, source book. Action buttons: Review (SRS count), Export to Anki.

**Statistics (v2):** Words learned chart, reading time, books completed, streak.

### 4.6 Navigation Structure

```
(tabs)
├── Library (index)        — Book list, catalogs, file upload
├── Dictionary             — Saved words, search, filter by status
├── Stats                  — Reading statistics (v2)
└── Settings               — Language, theme, account, subscription

Modals/Stacks:
├── reader/[bookId]        — Full-screen reader
├── catalog/[catalogId]    — OPDS catalog browser
└── review/                — SRS review session (v2)
```

**Deep linking scheme:**
- `fluera://book/{id}` — open specific book in reader
- `fluera://catalog/{encodedUrl}` — add and open OPDS catalog
- `fluera://review` — start SRS review session

## 5. Data Model (WatermelonDB)

### 5.1 Tables

**Book**
- `id`, `title`, `author`, `language`, `format` (epub/fb2/pdf)
- `file_path`, `cover_path`, `source` (opds/file/catalog), `opds_url`
- `progress` (0-100), `total_words`
- `difficulty` (cached % unknown words, recalculated on open)
- `added_at`, `last_read_at`

**Chapter**
- `id`, `book_id` (FK), `title`, `order_index`, `progress`

**WordStatus** (global word knowledge — one entry per unique word per language pair)
- `id`, `word` (indexed), `book_language`, `native_language`
- `status` (1=new, 2=recognized, 3=familiar, 4=learned, 5=known)
- `translation` (primary/most recent translation)
- SRS fields: `srs_interval`, `srs_ease_factor`, `srs_next_review`, `srs_repetitions`
- `grammar_note` (nullable, AI-generated)
- `created_at`, `updated_at`
- **Unique constraint:** `(word, book_language, native_language)`

**WordOccurrence** (per-book context — tracks where a word was encountered)
- `id`, `word_status_id` (FK to WordStatus)
- `book_id` (FK), `chapter_title`, `context_sentence`
- `created_at`

**TranslationCache**
- `id`, `cache_key` (SHA-256 truncated to 32 chars)
- `word`, `context`, `book_lang`, `native_lang`
- `translation`, `grammar`
- `created_at`
- **Eviction:** LRU, max 100,000 entries per language pair

**OPDSCatalog**
- `id`, `name`, `url`, `type` (preset/custom), `last_fetched_at`

**ReadingStats**
- `id`, `date`, `book_id` (FK, nullable), `words_read`, `words_learned`
- `time_reading_sec`, `translations_made`

**UserSettings**
- `id`, `native_language`, `book_language`
- `theme` (light/dark/sepia), `font_size`, `font_family`, `line_height`
- `show_word_colors` (boolean)

Note: `native_language` and `book_language` represent the currently active pair. The app switches between pairs via settings. Multiple pairs are supported through `WordStatus` unique constraint on `(word, book_language, native_language)`.

### 5.2 Key Indexes

- `WordStatus(word, book_language, native_language)` — unique, fast reader lookup
- `WordStatus(srs_next_review)` — SRS review queue
- `WordStatus(status, book_language)` — filter by learning status
- `WordOccurrence(word_status_id)` — find all contexts for a word
- `WordOccurrence(book_id)` — find all words from a book
- `TranslationCache(cache_key)` — cache hits
- `ReadingStats(date, book_id)` — daily/per-book stats
- `Book(last_read_at)` — library sorting

## 6. Format Support

### 6.1 Epub

Rendered via `@epubjs-react-native/core` (epub.js in WebView). Word highlighting and tap-to-translate via JavaScript bridge (`postMessage`/`onMessage`).

### 6.2 FB2

Rendered natively as React Native components. Parser built on `fast-xml-parser`.

**Supported elements:** `<body>`, `<section>`, `<title>`, `<subtitle>`, `<p>`, `<emphasis>`, `<strong>`, `<a>` (links), `<image>` (references to `<binary>`), `<epigraph>`, `<poem>`, `<stanza>`, `<v>` (verse line), `<annotation>`, `<cite>`.

**Image handling:** FB2 embeds images as base64 in `<binary>` tags. Parser extracts binary data, decodes base64, writes to temp file, renders via `<Image>` component.

**Footnotes/endnotes:** FB2 uses `<a type="note">` linking to `<section>` in `<body name="notes">`. Rendered as tappable superscript → bottom sheet with note content.

**Archive support:** `.fb2.zip` files (common in RU/UA market) are detected by extension and extracted before parsing. Single-file archives only.

### 6.3 Text Difficulty Calculation

When a book is first opened, difficulty is calculated and cached in `Book.difficulty`:

1. **Sample strategy:** Analyze the first 10% of text (or first 3 chapters, whichever is smaller) to avoid blocking UI on large books.
2. **Tokenize** sample text into words (split by whitespace + punctuation).
3. **Lookup** each unique word against `WordStatus` table for the active language pair.
4. **Calculate** `difficulty = unknown_words / total_unique_words * 100`.
5. **Cache** result in `Book.difficulty`. Invalidated and recalculated on next open if `WordStatus` table has changes since last calculation (tracked via max `updated_at`).
6. **Performance:** Runs in background thread via `InteractionManager.runAfterInteractions()`. UI shows placeholder badge until calculation completes.

## 7. Feature Roadmap

### 7.0 Phase 0: Technical Validation (3-4 days)

Four spikes to validate critical technical risks before MVP development:

1. **FB2 parser spike (1 day):** fast-xml-parser + mapping FB2 tags to React components. Test: load a book, render text, intercept word tap. Validate `.fb2.zip` support.
2. **Epub reader spike (1 day):** Expo + @epubjs-react-native + book from Gutenberg. Test: `onTextSelected`, word highlighting injection, phrase selection via `getSelection()`, performance on 500-page book.
3. **DeepSeek translation spike (0.5 day):** Prompt engineering for contextual translation. Test on 3 pairs: EN→RU, EN→PL, EN→ES. Measure latency (target: <2s for single word) and quality.
4. **OPDS PoC (0.5 day):** Parse Gutenberg catalog, display book list, download epub. Validate OPDS XML structure with fast-xml-parser.

**Go/no-go:** If all four spikes succeed, proceed to MVP. If any spike reveals a blocker, reassess the affected technology choice.

### 7.1 MVP (2-3 months) — Wave 1

**Goal:** User finds an EN book in catalog or uploads their own (epub/fb2), reads it and gets AI translation to RU/PL/UK.

- Epub reader (@epubjs-react-native, fonts, dark/light/sepia theme)
- FB2 reader (custom parser with fast-xml-parser, .fb2.zip support)
- Tap-to-translate: tap → DeepSeek API → contextual translation
- Phrase translation: long-press + drag to select phrase → translate (max 10 words)
- Word status color system: blue=new, yellow=learning (4 levels), none=known
- OPDS catalogs: Project Gutenberg + Standard Ebooks + custom URL form
- File upload (epub, fb2) from device
- Dictionary with context sentences and word statuses
- Library with reading progress
- Text difficulty indicator (% unknown words, sampled from first 10%)
- i18n: RU, PL, UK, EN
- Offline-first: books and translation cache stored locally
- Account (email/OAuth) + backend sync for progress/dictionary
- RevenueCat: Free + Premium subscription
- Sentry crash reporting + PostHog analytics

### 7.2 v2 (+2-3 months) — Wave 2 + Retention

- SRS (Spaced Repetition): SM-2 algorithm for word review
- AI grammar: grammatical form explanation via LLM (new — not in original research brief)
- Sentence mode: read one sentence at a time with full translation (new)
- Export to Anki: dictionary export to Anki/CSV
- Parallel translation: paragraph-level side-by-side
- TTS: text-to-speech
- Karaoke highlighting: text highlighting synced with audio playback
- WebDAV client: NAS/Nextcloud connection
- Google Books API / Open Library API
- PDF support (react-native-pdf)
- Statistics: words, time, progress (per-book and aggregate)
- +5 UI languages (ES, IT, FR, DE, PT)
- iCloud Drive + Google Drive file sync
- Premium translation tier: Claude Haiku for deep explanations

**SRS algorithm note:** MVP ships with SM-2 (well-understood, fields: `interval`, `ease_factor`, `next_review`, `repetitions`). If user feedback indicates SM-2 is insufficient, migration to FSRS in v2.x is possible via schema migration adding `difficulty`, `stability`, `retrievability` fields to `WordStatus`.

### 7.3 v3 (+3-4 months) — Waves 3-4 + Scale

- Curated catalog: books by level (A1-C2)
- Wave 4: books in any language
- +10 UI languages (TR, JA, KO, PT-BR, AR...)
- RTL support (Arabic, Hebrew)
- Dropbox + own cloud storage (S3/R2) for Premium
- Web import: share extension for articles
- Social features: notes, reviews
- OPDS 2.0 (JSON)
- ASO optimization for all supported languages

## 8. Project Structure

```
fluera/
├── app/                          # Expo Router
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Library
│   │   ├── dictionary.tsx
│   │   ├── stats.tsx
│   │   └── settings.tsx
│   ├── reader/[bookId].tsx
│   ├── catalog/
│   │   ├── index.tsx
│   │   └── [catalogId].tsx
│   ├── review/index.tsx          # SRS (v2)
│   ├── _layout.tsx
│   └── +not-found.tsx
├── src/
│   ├── components/
│   │   ├── reader/               # EpubReader, Fb2Reader, TranslationPopup, WordHighlighter
│   │   ├── library/              # BookCard, BookList, DifficultyBadge
│   │   ├── dictionary/           # WordCard, WordStatusBadge
│   │   └── ui/                   # Shared Tamagui components
│   ├── services/
│   │   ├── translation/          # TranslationService, DeepSeekProvider, GeminiProvider, Cache
│   │   ├── parser/               # EpubParser, Fb2Parser, OpdsParser
│   │   ├── srs/                  # SM2Algorithm (v2)
│   │   └── sync/                 # SyncService
│   ├── stores/                   # Zustand: readerStore, settingsStore, appStore
│   ├── db/                       # WatermelonDB: schema, models, migrations
│   ├── hooks/                    # useTranslation, useWordStatus, useBookProgress
│   ├── i18n/                     # Config + locales (en, ru, pl, uk)
│   ├── theme/                    # Tamagui: config, light, dark, sepia
│   └── utils/                    # Constants, types
├── assets/
├── app.json
├── tamagui.config.ts
├── tsconfig.json
├── package.json
└── CLAUDE.md
```

## 9. Cross-Platform Subscriptions

RevenueCat stores subscription status across all platforms (Apple + Google + Stripe/Web).

1. User registers (email/OAuth) → gets `appUserId`
2. Purchases subscription on iPhone via Apple IAP → RevenueCat records entitlement
3. Logs in with same account on Android → SDK checks entitlements by `appUserId`
4. RevenueCat sees active subscription → unlocks Premium
5. All renewals/cancellations tracked server-side via webhooks

## 10. Sync Strategy

### 10.1 Data Layer (own backend — MVP scope)

Syncs: reading progress, dictionary with context, settings, catalog list, statistics.
Tech: Fastify + PostgreSQL + Redis. REST API. Lightweight data (kilobytes per user).
Conflict resolution: last-write-wins by `updated_at` timestamp.

### 10.2 File Layer (cloud storage, v2+)

User chooses storage. App does not store books on its own servers.
- iCloud Drive (iOS): native integration
- Google Drive (Android): via API
- Dropbox (cross-platform, v2+)
- WebDAV (self-hosted, v2+)

## 11. Apple App Store Compatibility

OPDS is an open standard (Atom/XML), not a store and not bypassing Apple payments.
Preset catalogs: only legal — Project Gutenberg, Standard Ebooks, Open Library.
Custom URL: user-entered form + OPDS XML validation.
Precedent: Readest, KyBook 2/3 all have OPDS/WebDAV and are live in App Store.

## 12. LLM Economics

| Metric | Value |
|--------|-------|
| Model (primary) | DeepSeek V3.2 ($0.14/$0.28 per 1M tokens) |
| 1 word translation | ~$0.00005 |
| 100 translations/day/user | $0.15/month |
| 1K DAU | $150/month |
| With caching | 40-60% lower |
| Margin at $4.99/month | >95% |
