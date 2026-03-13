# MVP Phase 1: Reader + Translation — Design Specification

**Date:** 2026-03-13
**Status:** Approved
**Version:** 1.1
**Parent spec:** `docs/superpowers/specs/2026-03-13-fluera-design.md`

## 1. Scope

First user-facing feature phase after Phase 0 foundation. Delivers the core reading experience: open a book (FB2 or EPUB), read it, tap words for AI translation, save words to dictionary.

**In scope:**
- FB2 reader (native RN components)
- EPUB reader (WebView + epub.js)
- Translation popup (shared between both readers)
- Word status system (color-coded word knowledge)
- Mini-library (file upload + book list)
- Reader settings (font, theme, line height)

**Out of scope (future phases):**
- OPDS catalog browsing
- Full library with search/sort/filter
- SRS review
- Statistics
- Account/sync/backend
- PDF support

## 2. Architecture Overview

### Approach: Bottom-Up

Build order optimizes for fastest usable result:

1. FB2 reader + renderer (native taps, easiest to debug)
2. Translation popup (shared component, tested with FB2)
3. Word highlighting + status system
4. EPUB reader (WebView bridge, reuses popup)
5. Mini-library (file picker + book cards)
6. Reader settings sheet

### Data Flow

```
Open book → load Book from DB → parse file → render
                                                ↓
                                  WordStatus batch query
                                                ↓
                                  Color words by status
                                                ↓
                             Tap → TranslationService → Popup
                                                ↓
                             Save → WordStatus + WordOccurrence
```

### Key Dependencies (from Phase 0)

| Dependency | Location | Status |
|-----------|----------|--------|
| Fb2Parser | `src/services/parser/Fb2Parser.ts` | ✅ Done |
| TranslationService | `src/services/translation/TranslationService.ts` | ✅ Done |
| TranslationCache | `src/services/translation/TranslationCache.ts` | ✅ Done |
| DeepSeekProvider | `src/services/translation/DeepSeekProvider.ts` | ✅ Done |
| GeminiProvider | `src/services/translation/GeminiProvider.ts` | ✅ Done |
| WatermelonDB schema | `src/db/schema.ts` | ✅ Done (Book, WordStatus, WordOccurrence tables) |
| Zustand stores | `src/stores/` | ✅ Done (readerStore, settingsStore) — **Note:** `settingsStore` needs `setLineHeight` and `setFontFamily` setters added in this phase |
| Tamagui themes | `src/theme/` | ✅ Done (light, dark, sepia) |
| WORD_STATUS_COLORS | `src/utils/constants.ts` | ✅ Done |

## 3. FB2 Reader

### Route

`app/reader/[bookId].tsx` — full-screen reader, hides tab bar.

The route component:
1. Loads `Book` record from WatermelonDB by `bookId` param
2. Reads file from `FileSystem.documentDirectory` using `book.file_path`
3. Determines format (`fb2` or `epub`) from `book.format`
4. Renders `Fb2Reader` or `EpubReader` accordingly

### Components

**`src/components/reader/Fb2Reader.tsx`**
- Receives raw FB2 XML string
- Calls `Fb2Parser.parse(xml)` to get structured tree
- Flattens parsed sections into a flat array of renderable items (sections + paragraphs)
- Renders via `FlashList` (from `@shopify/flash-list`) for virtualization of large books
- Each item rendered by `Fb2Renderer` based on type
- Manages scroll position via `FlashList.onScroll`
- Saves/restores reading position (see Scroll and Progress section below)

**`src/components/reader/Fb2Renderer.tsx`**
- Renders individual items from the flat list produced by `Fb2Reader`
- **Section titles** come from `Fb2Section.title` (a `string | null` field, NOT a `Fb2Paragraph`). Rendered as `Text` with heading style (`fontSize: '$8'`, `fontWeight: 'bold'`).
- **Paragraph type mapping** (from `Fb2Paragraph.type`):
  - `'p'` → paragraph container with `WordTappable` children
  - `'subtitle'` → `Text` (subheading style)
  - `'epigraph'` → `YStack` with indent + italic style
  - `'poem'`, `'stanza'`, `'v'` → verse layout
  - `'cite'`, `'annotation'` → styled containers
  - `'empty-line'` → spacer
- **Inline markup** within paragraphs (`Fb2Inline` items):
  - `emphasis` → wraps `WordTappable` children in italic `Text`
  - `strong` → wraps `WordTappable` children in bold `Text`
  - `link` → tappable text
  - `plain` → `WordTappable` children directly
  - All inline types tokenize their `text` field into words, each wrapped in `WordTappable`
- **Images** (`Fb2Image`): rendered as `Image` component using base64 data from FB2 binary

**`src/components/reader/WordTappable.tsx`**
- Wraps a single word in `<Text onPress>`
- Props: `word: string`, `sentenceContext: string`, `onWordTap: (word, sentence) => void`
- Text color determined by word status from `useWordStatus` hook
- Colors from `WORD_STATUS_COLORS`: blue=new (status 1), yellow shades=learning (2-4), `'transparent'`=known (status 5, renders in default theme text color with no highlight)

**`src/components/reader/ReaderTopBar.tsx`**
- Back button (router.back)
- Chapter title (center)
- Progress percentage (right)
- Semi-transparent background, hides on scroll, shows on tap

**`src/components/reader/ReaderSettingsSheet.tsx`**
- Bottom sheet triggered by settings icon in top bar
- Font size slider (14-28)
- Theme selector: light / dark / sepia (toggles Tamagui theme + settingsStore)
- Line height slider (1.2 - 2.0)
- Font family picker (system, serif, sans-serif)

### Scroll and Progress

- `FlashList` with `onScroll` throttled to 500ms
- Scroll offset saved to `readerStore.scrollPosition` (in-memory for active session)
- **Persistent position:** On book close (or app background), save scroll offset index to WatermelonDB by storing the current visible item index in a new `Book.last_position` field (string, stores JSON `{ index: number, offset: number }` for FlashList, or CFI string for EPUB). This survives app restarts.
- On book open: read `Book.last_position` from DB, pass to `FlashList.initialScrollIndex` (FB2) or epub.js `display(cfi)` (EPUB)
- Progress calculated as `scrollOffset / contentHeight * 100`, saved to `Book.progress`
- **Note:** `readerStore.openBook()` currently resets `scrollPosition: 0` — implementation must load from `Book.last_position` instead

**Schema change required:** Add `last_position` column (string, nullable) to `Book` table. WatermelonDB migration from version 1 → 2 in `src/db/migrations/`: `addColumns({ table: 'books', columns: [{ name: 'last_position', type: 'string', isOptional: true }] })`. Update schema version to 2 in `src/db/schema.ts`.

### Sentence Extraction

When a word is tapped, the containing sentence is needed for context:
- Walk backward/forward from word position in the text node until hitting sentence boundary (`.`, `!`, `?`, `\n`)
- Return the full sentence with the tapped word marked
- Sentence passed to TranslationService as context

## 4. Translation Popup

### Component

**`src/components/reader/TranslationPopup.tsx`**

Bottom sheet using Reanimated 3. Shared by both FB2 and EPUB readers.

### Props

```typescript
interface TranslationPopupProps {
  visible: boolean;
  word: string;
  sentence: string;
  bookLanguage: string;
  nativeLanguage: string;
  isPhrase: boolean;
  onClose: () => void;
  onStatusChange: (word: string, status: WordStatusValue) => void;
}
```

### Content Layout

From top to bottom:
1. **Word** — large text, the tapped word/phrase
2. **Translation** — primary translation from TranslationService
3. **Grammar note** — brief grammatical info (part of speech, form, case) from LLM response
4. **Context sentence** — the sentence where the word was found, with the word highlighted
5. **Word status selector** — 5 colored dots (1=new → 5=known), tap to change status
6. **Save button** — saves WordOccurrence to WatermelonDB

### States

| State | Trigger | UI |
|-------|---------|-----|
| `loading` | Translation request in flight | Skeleton placeholder |
| `success` | Translation received | Full card with all fields |
| `cached` | Cache hit (fromCache=true) | Full card, instant — no loading skeleton shown. Visually identical to `success` final state but skips the loading animation. This is a performance path, not a separate visual state. |
| `error` | Both primary + fallback failed | Error message + Retry button |

### Animation

- Slide-up from bottom edge using `useSharedValue` + `useAnimatedStyle` (Reanimated 3)
- Swipe-down gesture to close (`PanGestureHandler`)
- Adaptive height — content determines sheet height
- Backdrop: semi-transparent overlay, tap to close

### Phrase Translation

- **FB2:** Uses React Native's native text selection. Paragraph `Text` components rendered with `selectable={true}`. Selection captured via `onSelectionChange` event → extracts selected phrase text → `onPhraseSelect(phrase, sentence)`. This aligns with the parent spec's approach and leverages OS-native selection handles.
- **EPUB:** `selectionchange` event in WebView → `window.getSelection().toString()` → `postMessage({ type: 'phraseSelect', phrase, sentence })`
- Same popup, `isPhrase: true` changes the TranslationService prompt
- Max 10 words per phrase (enforced in popup, truncate with warning)

## 5. EPUB Reader

### Component

**`src/components/reader/EpubReader.tsx`**

Wraps `@epubjs-react-native/core` (epub.js in WebView). Reuses `ReaderTopBar`, `ReaderSettingsSheet`, `TranslationPopup`.

### JavaScript Bridge

Core architecture for EPUB: all word interaction happens via JavaScript injected into the WebView.

**`src/services/reader/epubBridgeScript.ts`** — generates the JS code to inject:

1. **Word tap detection:**
   - Adds `click` listener on `document`
   - On click: `document.caretRangeFromPoint(e.clientX, e.clientY)` to find word under cursor
   - Extracts word boundaries from text node
   - Extracts sentence context (walks to sentence boundaries)
   - Sends: `window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'wordTap', word, sentence }))`

2. **Phrase selection:**
   - Listens to `selectionchange` event
   - On selection end: `window.getSelection().toString()`
   - Sends: `postMessage({ type: 'phraseSelect', phrase, sentence })`

3. **Word highlighting (color by status):**
   - RN side injects word status map: `{ [word]: colorHex }`
   - Bridge script wraps each text word in `<span style="color: {color}">`
   - Re-runs on chapter navigation and status updates
   - Uses `TreeWalker` API for efficient DOM traversal
   - Debounced: if multiple status updates fire within 200ms, batch into single re-highlight pass
   - Chapter navigation cancels any in-flight highlighting via AbortController pattern

4. **Location tracking:**
   - epub.js fires `relocated` events with CFI (Canonical Fragment Identifier)
   - Sends: `postMessage({ type: 'locationChange', cfi, progress })` — throttled to max 1 message per 500ms in bridge script
   - `progress` from epub.js used directly for `Book.progress`; `cfi` stored as `Book.last_position`
   - Stale CFI handling: if `display(cfi)` fails on open (e.g. book file changed), fall back to start of book

**RN Side (`EpubReader.tsx`):**
- `onMessage` handler dispatches by message type
- `wordTap` / `phraseSelect` → opens TranslationPopup
- `locationChange` → updates `readerStore` + saves to WatermelonDB
- `injectJavaScript()` to send word status colors after batch query

### Theme Integration

- Light/dark/sepia themes applied via epub.js `themes.override()` API
- CSS variables for background, text color, link color
- Font size via `themes.fontSize()`
- Font family via `themes.font()`
- Theme changes from `ReaderSettingsSheet` immediately injected into WebView

### Navigation

- epub.js handles chapter navigation and pagination
- Swipe left/right for page turns (epub.js built-in)
- Table of contents accessible from `ReaderTopBar` menu
- Progress calculated by epub.js (percentage-based)

## 6. Word Status System

### Hooks

**`src/hooks/useBook.ts`**
- Input: `bookId: string`
- Output: `{ book: Book | null, loading: boolean, error: string | null }`
- Loads `Book` record from WatermelonDB by ID using `database.get('books').find(bookId)`
- Uses WatermelonDB's `observe()` for reactive updates
- **Error handling:** If book not found (deleted/corrupted), returns `error: 'book_not_found'`. Reader route shows error screen with "Book not found" message and "Back to Library" button.
- **File validation:** After loading Book record, checks that `book.file_path` exists via `FileSystem.getInfoAsync()`. If file missing, returns `error: 'file_missing'`.

**`src/hooks/useWordStatus.ts`**
- Input: `word: string`, `bookLanguage: string`, `nativeLanguage: string`
- Output: `WordStatus | null` from WatermelonDB
- Uses WatermelonDB's `observe()` for reactive updates
- Returns null if word not in database (= new/unknown word)

**`src/hooks/useWordStatusBatch.ts`**
- Input: `words: string[]`, `bookLanguage`, `nativeLanguage`
- Output: `Map<string, WordStatusValue>`
- Queries WatermelonDB with `Q.where('word', Q.oneOf(words))` + language pair filter
- Used by both renderers to color words efficiently
- **Debounce strategy:** Re-queries with 300ms debounce when the `words` array changes (triggered by FlashList's `onViewableItemsChanged` for FB2, or chapter navigation for EPUB). The 300ms debounce works alongside the 500ms scroll throttle — scroll fires position updates, viewable items change fires word status queries.
- **Batch size:** Queries limited to words in currently visible items (typically 20-50 unique words per screen). Not the full book.

### Word Status Lifecycle

1. **New word (not in DB):** Displayed with blue color (`WORD_STATUS_COLORS[1]`)
2. **First tap:** TranslationPopup opens. Default status: 1 (new).
3. **User changes status:** Taps status dot in popup → updates `WordStatus.status` in DB
4. **Save to dictionary:** Creates `WordOccurrence` with book context
5. **Status colors update:** Reactive via WatermelonDB observers → re-renders affected words

### Saving Words

When user taps "Save" in TranslationPopup:

```
1. Check if WordStatus exists for (word, bookLang, nativeLang)
   - Yes: update translation, grammar_note, updated_at
   - No: create new WordStatus with status=1 (new)
2. Create WordOccurrence:
   - word_status_id: FK to WordStatus
   - book_id: current book
   - chapter_title: current chapter
   - context_sentence: the sentence
3. Update word color in reader (reactive via observer)
```

## 7. Mini-Library

### Modified Screen

`app/(tabs)/index.tsx` — replaces placeholder with functional library.

### Components

**`src/components/library/BookCard.tsx`**
- Cover image (extracted from book or placeholder)
- Title + author
- Progress bar (0-100%)
- Difficulty badge (% unknown words, calculated on first open)
- Format badge (EPUB / FB2)
- `onPress` → `router.push('/reader/${bookId}')`

**`src/components/library/AddBookButton.tsx`**
- FAB (floating action button) or prominent card
- Triggers `expo-document-picker` with file type filter

**`src/services/library/BookImporter.ts`**

Service for importing books into the app:

```typescript
interface BookImporter {
  importFile(uri: string): Promise<Book>;
}
```

Steps:
1. Detect format from file extension (`.epub`, `.fb2`, `.fb2.zip`)
2. For `.fb2.zip`: extract using `expo-file-system` + zip utility (e.g., `jszip`)
3. Copy file to `FileSystem.documentDirectory/books/`
4. Parse metadata:
   - **FB2:** `Fb2Parser.parse()` → extract `<title-info>` (title, author, cover image from `<binary>`)
   - **EPUB:** Pure JS extraction without WebView — EPUB is a ZIP file. Use `jszip` to read ZIP, extract `META-INF/container.xml` → find `content.opf` path → parse OPF XML with `fast-xml-parser` → extract `<dc:title>`, `<dc:creator>`, cover image href. No epub.js/WebView needed for metadata.
5. Save cover image to `FileSystem.documentDirectory/covers/`
6. Create `Book` record in WatermelonDB
7. Return the created Book

**New dependency:** `jszip` — for EPUB ZIP extraction and `.fb2.zip` support.

**Error handling:** If any step fails (corrupt ZIP, missing OPF, invalid XML, missing cover), the import should still succeed with fallback metadata: title defaults to filename, author to "Unknown", cover to placeholder image. Show a toast warning: "Some metadata could not be extracted". Only fail import entirely if the file cannot be read at all.

### Empty State

When no books added yet:
- Illustration or icon
- Text: "Add your first book" (i18n key: `library.emptyState.title`)
- Prominent "Add Book" button

## 8. New Files Summary

### Route
- `app/reader/[bookId].tsx` — reader screen

### Components
- `src/components/reader/Fb2Reader.tsx`
- `src/components/reader/Fb2Renderer.tsx`
- `src/components/reader/WordTappable.tsx`
- `src/components/reader/EpubReader.tsx`
- `src/components/reader/TranslationPopup.tsx`
- `src/components/reader/ReaderTopBar.tsx`
- `src/components/reader/ReaderSettingsSheet.tsx`
- `src/components/library/BookCard.tsx`
- `src/components/library/AddBookButton.tsx`

### Services
- `src/services/reader/epubBridgeScript.ts`
- `src/services/library/BookImporter.ts`

### Hooks
- `src/hooks/useWordStatus.ts`
- `src/hooks/useWordStatusBatch.ts`
- `src/hooks/useBook.ts` (load book from DB)

### Modified Files
- `app/(tabs)/index.tsx` — Library screen (replace placeholder)
- `app/(tabs)/_layout.tsx` — may need reader route config
- `app/_layout.tsx` — add reader/[bookId] stack route

## 9. Testing Strategy

### Unit Tests
- `Fb2Renderer` — snapshot tests for tag mapping
- `WordTappable` — tap callback fires with correct word/sentence
- `BookImporter` — metadata extraction with mock files
- `useWordStatus` — returns correct status from mock DB
- `epubBridgeScript` — generated JS is valid, message types correct

### Integration Tests
- FB2 reader: load sample FB2 → renders text → tap word → popup opens
- Translation flow: tap → TranslationService called → popup shows result
- Word status: save word → status updates → color changes

### Manual Testing
- Load real FB2 book (Russian), verify rendering
- Load real EPUB book (English), verify rendering
- Tap words, verify translation quality
- Theme switching (light/dark/sepia)
- Scroll position persistence
- Long-press phrase selection

## 10. Dependencies to Install

- `expo-document-picker` — file selection for book import
- `@epubjs-react-native/core` — EPUB rendering in WebView
- `@shopify/flash-list` — virtualized list for FB2 reader
- `jszip` — ZIP extraction for EPUB metadata and `.fb2.zip` support
- `react-native-gesture-handler` — already installed (used by expo-router)
- `react-native-reanimated` — already installed

## 11. Performance Considerations

- **FB2 virtualization:** Uses `FlashList` with a flat array of renderable items (sections flattened into paragraphs + titles). This handles books of any size — only visible items are rendered.
- **Word batch queries:** Load word statuses via `useWordStatusBatch` for visible items only (20-50 unique words), debounced at 300ms.
- **EPUB bridge word highlighting:** Runs per-chapter (not per-book). Uses `requestAnimationFrame` batching — wraps words in `<span>` in chunks of 500 to avoid blocking WebView main thread on large chapters. Re-runs on chapter navigation and after word status changes.
- **Translation popup:** Appears in <500ms (cache hit) or <3s (API call) as per spec.
- **Scroll/position persistence:** Throttled to 500ms. DB writes use `InteractionManager.runAfterInteractions()`.
- **Book difficulty calculation:** Deferred to future phase (full library). BookCard shows difficulty badge only if `Book.difficulty` is already calculated; otherwise shows no badge.
