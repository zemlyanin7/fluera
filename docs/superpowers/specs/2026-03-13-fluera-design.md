# Fluera — Design Specification

**Date:** 2026-03-13
**Status:** Approved
**Version:** 1.0

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

## 2. Architecture

### 2.1 Technology Stack

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

### 2.2 System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    FLUERA CLIENT                        │
│  Expo (React Native)                                    │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Reader   │ │ Library  │ │ Dictionary│ │ SRS Review│  │
│  │ (epub/   │ │ (OPDS +  │ │ (words + │ │ (SM-2/    │  │
│  │  fb2/pdf)│ │  files)  │ │  context) │ │  FSRS)    │  │
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
│  ┌────────────────────────────┐ ┌────────────────────┐  │
│  │ RevenueCat (subscriptions) │ │ Reanimated 3       │  │
│  └────────────────────────────┘ │ (animations)       │  │
│                                 └────────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API
┌──────────────────────┴──────────────────────────────────┐
│                   BACKEND (v2+)                         │
│  Fastify + PostgreSQL + Redis                           │
│  • Sync (progress, dictionary)                          │
│  • Accounts (email/OAuth)                               │
│  • RevenueCat webhooks                                  │
│  • Curated catalog (v3)                                 │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Translation Pipeline

```
User taps word/phrase
  → Check TranslationCache (SQLite)
    → HIT: return cached translation
    → MISS:
      → Build prompt: {word} in context "{sentence}", {bookLang}→{nativeLang}
      → Call DeepSeek V3.2
        → FAIL: fallback to Gemini Flash-Lite
      → Cache result: hash(word + 5_words_context + lang_pair)
      → Return translation + optional grammar note
```

**Economics (DeepSeek V3.2):**
- 1 translation: ~$0.00005 (~150-200 tokens)
- 100 translations/day per user: $0.15/month
- With caching: real costs 40-60% lower
- Margin at $4.99/month subscription: >95%

## 3. UI/UX Design

### 3.1 Design Direction

**Hybrid style** — Beelinguapp's visual polish with LingQ's functionality depth. Modern, clean UI that doesn't overwhelm but provides access to powerful features through progressive disclosure.

### 3.2 Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#6c63ff` | Buttons, accents, brand |
| Dark BG | `#1a1a2e` | Reader dark theme |
| New Word | `#4a90d9` | Blue — unknown words (status 1) |
| Learning | `#f5c842` | Yellow — words being learned (status 2-4, opacity varies) |
| Progress | `#4caf50` | Progress bars, success states |
| Sepia BG | `#f5f0e1` | Reader sepia theme |

### 3.3 Reader Themes

- **Light:** White background, dark text
- **Dark:** `#1a1a2e` background, `#e0e0e0` text
- **Sepia:** `#f5f0e1` background, `#5b4636` text

### 3.4 Word Status Color System (LingQ-inspired)

| Status | Color | Visual | Meaning |
|--------|-------|--------|---------|
| 1 (New) | `#4a90d9` blue | Solid highlight | Never seen before |
| 2 (Recognized) | `#f5c842` yellow, 100% | Solid yellow | Looked up once |
| 3 (Familiar) | `#f5c842` yellow, 70% | Lighter yellow | Seen multiple times |
| 4 (Learned) | `#f5c842` yellow, 40% | Faint yellow | Almost known |
| Known | No highlight | Plain text | Fully known |

### 3.5 Key Screens

**Reader:** Central text area with word highlighting. Tap triggers bottom sheet with translation, context, TTS button, grammar button, "add to dictionary" button. Top bar: back, chapter title, progress %, settings gear.

**Library:** Tab bar (My Books / Catalogs / Upload). Book cards with cover, title, author, progress bar, word count, difficulty badge (% new words).

**Dictionary:** List of saved words with context sentences, word status badges, source book. Action buttons: Review (SRS count), Export to Anki.

**Statistics (v2):** Words learned chart, reading time, books completed, streak.

### 3.6 Navigation Structure

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

## 4. Data Model (WatermelonDB)

### 4.1 Tables

**Book**
- `id`, `title`, `author`, `language`, `format` (epub/fb2/pdf)
- `file_path`, `cover_path`, `source` (opds/file/catalog), `opds_url`
- `progress` (0-100), `total_words`, `known_pct`, `difficulty`
- `added_at`, `last_read_at`

**Chapter**
- `id`, `book_id` (FK), `title`, `order_index`, `progress`

**WordEntry**
- `id`, `word` (indexed), `translation`, `context_sentence`
- `book_id` (FK), `chapter_title`
- `book_language`, `native_language`
- `status` (1-4 or 'known')
- SRS fields: `srs_interval`, `srs_ease_factor`, `srs_next_review`, `srs_repetitions`
- `grammar_note` (nullable, AI-generated)
- `created_at`, `updated_at`

**TranslationCache**
- `id`, `cache_key` (hash), `word`, `context`
- `book_lang`, `native_lang`, `translation`, `grammar`
- `created_at`

**OPDSCatalog**
- `id`, `name`, `url`, `type` (preset/custom), `last_fetched_at`

**ReadingStats**
- `id`, `date`, `words_read`, `words_learned`
- `time_reading_sec`, `books_opened`, `translations_made`

**UserSettings**
- `id`, `native_language`, `book_language`
- `theme` (light/dark/sepia), `font_size`, `font_family`, `line_height`
- `show_word_colors` (boolean)

### 4.2 Key Indexes

- `WordEntry.word` — fast lookup for word status in reader
- `WordEntry.srs_next_review` — SRS queue
- `TranslationCache.cache_key` — cache hits
- `Book.last_read_at` — library sorting

## 5. Feature Roadmap

### 5.1 MVP (2-3 months) — Wave 1

**Goal:** User finds an EN book in catalog or uploads their own (epub/fb2), reads it and gets AI translation to RU/PL/UK.

- Epub reader (@epubjs-react-native, fonts, dark/light/sepia theme)
- FB2 reader (custom parser with fast-xml-parser)
- Tap-to-translate: tap → DeepSeek API → contextual translation
- Phrase translation: select multiple words → translate phrase
- Word status color system: blue=new, yellow=learning (4 levels), none=known
- OPDS catalogs: Project Gutenberg + Standard Ebooks + custom URL form
- File upload (epub, fb2) from device
- Dictionary with context sentences and word statuses
- Library with reading progress
- Text difficulty indicator (% unknown words before reading)
- i18n: RU, PL, UK, EN
- Offline-first: books and translation cache stored locally
- Account (email/OAuth) + backend sync for progress/dictionary
- RevenueCat: Free + Premium subscription

### 5.2 v2 (+2-3 months) — Wave 2 + Retention

- SRS (Spaced Repetition): SM-2/FSRS word review
- AI grammar: grammatical form explanation via LLM
- Sentence mode: read one sentence at a time with full translation
- Export to Anki: dictionary export to Anki/CSV
- Parallel translation: paragraph-level side-by-side
- TTS: text-to-speech
- Karaoke highlighting: text highlighting synced with audio playback
- WebDAV client: NAS/Nextcloud connection
- Google Books API / Open Library API
- PDF support (react-native-pdf)
- Statistics: words, time, progress
- +5 UI languages (ES, IT, FR, DE, PT)
- iCloud Drive + Google Drive file sync
- Premium translation tier: Claude Haiku for deep explanations

### 5.3 v3 (+3-4 months) — Waves 3-4 + Scale

- Curated catalog: books by level (A1-C2)
- Wave 4: books in any language
- +10 UI languages (TR, JA, KO, PT-BR, AR...)
- RTL support (Arabic, Hebrew)
- Dropbox + own cloud storage (S3/R2) for Premium
- Web import: share extension for articles
- Social features: notes, reviews
- OPDS 2.0 (JSON)

## 6. Project Structure

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

## 7. Cross-Platform Subscriptions

RevenueCat stores subscription status across all platforms (Apple + Google + Stripe/Web).

1. User registers (email/OAuth) → gets `appUserId`
2. Purchases subscription on iPhone via Apple IAP → RevenueCat records entitlement
3. Logs in with same account on Android → SDK checks entitlements by `appUserId`
4. RevenueCat sees active subscription → unlocks Premium
5. All renewals/cancellations tracked server-side via webhooks

## 8. Sync Strategy

### 8.1 Data Layer (own backend)

Syncs: reading progress, dictionary with context, settings, catalog list, statistics.
Tech: Fastify + PostgreSQL + Redis. REST API. Lightweight data (kilobytes per user).

### 8.2 File Layer (cloud storage, v2+)

User chooses storage. App does not store books on its own servers.
- iCloud Drive (iOS): native integration
- Google Drive (Android): via API
- Dropbox (cross-platform, v2+)
- WebDAV (self-hosted, v2+)

## 9. Apple App Store Compatibility

OPDS is an open standard (Atom/XML), not a store and not bypassing Apple payments.
Preset catalogs: only legal — Project Gutenberg, Standard Ebooks, Open Library.
Custom URL: user-entered form + OPDS XML validation.
Precedent: Readest, KyBook 2/3 all have OPDS/WebDAV and are live in App Store.

## 10. LLM Economics

| Metric | Value |
|--------|-------|
| Model (primary) | DeepSeek V3.2 ($0.14/$0.28 per 1M tokens) |
| 1 word translation | ~$0.00005 |
| 100 translations/day/user | $0.15/month |
| 1K DAU | $150/month |
| With caching | 40-60% lower |
| Margin at $4.99/month | >95% |
