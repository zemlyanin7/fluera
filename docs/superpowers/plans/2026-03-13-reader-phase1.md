# Reader Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a working reader that opens FB2 and EPUB books, lets users tap words for AI translation, save words to dictionary, and manage a mini-library of imported books.

**Architecture:** FB2 rendered natively via FlashList (virtualized) with `WordTappable` per word. EPUB rendered in WebView via `@epubjs-react-native` with JS bridge for word taps. Shared `TranslationPopup` bottom sheet for both formats. Mini-library on Library tab with `expo-document-picker` for file import. All word data persisted in WatermelonDB.

**Tech Stack:** React Native (Expo 55), Tamagui, FlashList, WatermelonDB, Reanimated 3, @epubjs-react-native, jszip, fast-xml-parser, Zustand, i18next

**Spec:** `docs/superpowers/specs/2026-03-13-reader-phase1-design.md`

---

## Chunk 1: Database Migration + Store Updates + Dependencies

### Task 1: Install Missing Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install @shopify/flash-list and jszip**

```bash
npx expo install @shopify/flash-list
npm install jszip
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('@shopify/flash-list'); console.log('flash-list OK')"
node -e "require('jszip'); console.log('jszip OK')"
```

Expected: Both print OK.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install flash-list and jszip for reader phase 1"
```

---

### Task 2: WatermelonDB Schema Migration (v1 → v2)

Add `last_position` column to `books` table for reading position persistence.

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/migrations/index.ts`
- Modify: `src/db/models/Book.ts`

- [ ] **Step 1: Add migration in `src/db/migrations/index.ts`**

Current file is empty migrations. Replace with:

```typescript
import { addColumns, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'books',
          columns: [
            { name: 'last_position', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
```

- [ ] **Step 2: Update schema version and add column in `src/db/schema.ts`**

Change `version: 1` → `version: 2` and add `{ name: 'last_position', type: 'string', isOptional: true }` to the `books` tableSchema columns array.

- [ ] **Step 3: Add field to Book model in `src/db/models/Book.ts`**

Add to imports: `import { field } from '@nozbe/watermelondb/decorators';` (if not already).

Add field declaration alongside existing fields:

```typescript
@field('last_position') lastPosition!: string | null;
```

- [ ] **Step 4: Wire migrations into database init in `src/db/index.ts`**

Open `src/db/index.ts` and ensure the adapter config includes the `migrations` import. The adapter should look like:

```typescript
import migrations from './migrations';

const adapter = new SQLiteAdapter({
  schema,
  migrations,  // ← add this line if missing
  jsi: true,
  onSetUpError: (error) => {
    console.error('Database setup error:', error);
  },
});
```

If `migrations` is already imported but not passed to the adapter, add it to the config object.

- [ ] **Step 5: Verify app still starts**

```bash
npx expo start --dev-client --ios
```

Check Metro logs for `[SQLite] Database migrated to version 2` or no errors.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/db/migrations/index.ts src/db/models/Book.ts src/db/index.ts
git commit -m "feat: add last_position column to books table (migration v1→v2)"
```

---

### Task 3: Update Zustand Stores

Add missing setters to `settingsStore` and fix position loading in `readerStore`.

**Files:**
- Modify: `src/stores/settingsStore.ts`
- Modify: `src/stores/readerStore.ts`

- [ ] **Step 1: Add lineHeight and fontFamily to settingsStore**

In `src/stores/settingsStore.ts`, add to the state interface and initial state:

```typescript
// Add to state:
lineHeight: number;
fontFamily: string;

// Add to initial values:
lineHeight: 1.6,
fontFamily: 'System',

// Add setters:
setLineHeight: (lineHeight: number) => set({ lineHeight }),
setFontFamily: (fontFamily: string) => set({ fontFamily }),
```

These must be inside the `persist()` middleware so they survive app restarts.

- [ ] **Step 2: Clarify readerStore scroll position flow**

The `readerStore.openBook()` action resets `scrollPosition: 0` — this is intentional. The in-memory scroll position tracks the current session only. Position persistence works differently:

- **Save:** Reader components write position to `Book.lastPosition` in WatermelonDB (via `book.update()`) on unmount/background
- **Restore:** Reader components read `book.lastPosition` from DB on mount and pass to FlashList's `initialScrollIndex` or epub.js `display(cfi)`

No changes needed to `openBook()` — the store stays simple. Components handle DB read/write directly.

- [ ] **Step 3: Commit**

```bash
git add src/stores/settingsStore.ts src/stores/readerStore.ts
git commit -m "feat: add lineHeight/fontFamily to settings, update reader store"
```

---

## Chunk 2: Hooks + Reader Route

### Task 4: useBook Hook

**Files:**
- Create: `src/hooks/useBook.ts`
- Create: `__tests__/hooks/useBook.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// __tests__/hooks/useBook.test.ts
import { useBook } from '../../src/hooks/useBook';

// Mock WatermelonDB
jest.mock('../../src/db', () => ({
  database: {
    get: jest.fn(() => ({
      find: jest.fn(),
    })),
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
}));

describe('useBook', () => {
  it('should export useBook function', () => {
    expect(typeof useBook).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/hooks/useBook.test.ts --no-cache
```

Expected: FAIL — `useBook` not found.

- [ ] **Step 3: Implement useBook**

```typescript
// src/hooks/useBook.ts
import { useState, useEffect } from 'react';
import { database } from '../db';
import * as FileSystem from 'expo-file-system';
import type Book from '../db/models/Book';

interface UseBookResult {
  book: Book | null;
  loading: boolean;
  error: 'book_not_found' | 'file_missing' | null;
}

export function useBook(bookId: string | undefined): UseBookResult {
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UseBookResult['error']>(null);

  useEffect(() => {
    if (!bookId) {
      setLoading(false);
      setError('book_not_found');
      return;
    }

    let cancelled = false;

    async function loadBook() {
      try {
        const booksCollection = database.get<Book>('books');
        const record = await booksCollection.find(bookId!);

        if (cancelled) return;

        // Validate file exists on disk
        const fileInfo = await FileSystem.getInfoAsync(record.filePath);
        if (!fileInfo.exists) {
          setError('file_missing');
          setLoading(false);
          return;
        }

        setBook(record);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('book_not_found');
          setLoading(false);
        }
      }
    }

    loadBook();
    return () => { cancelled = true; };
  }, [bookId]);

  return { book, loading, error };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/hooks/useBook.test.ts --no-cache
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useBook.ts __tests__/hooks/useBook.test.ts
git commit -m "feat: add useBook hook for loading books from DB"
```

---

### Task 5: useWordStatus and useWordStatusBatch Hooks

**Files:**
- Create: `src/hooks/useWordStatus.ts`
- Create: `src/hooks/useWordStatusBatch.ts`
- Create: `__tests__/hooks/useWordStatus.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// __tests__/hooks/useWordStatus.test.ts
import { useWordStatus } from '../../src/hooks/useWordStatus';
import { useWordStatusBatch } from '../../src/hooks/useWordStatusBatch';

jest.mock('../../src/db', () => ({
  database: {
    get: jest.fn(() => ({
      query: jest.fn(() => ({
        observe: jest.fn(() => ({
          subscribe: jest.fn((cb: (val: unknown[]) => void) => {
            cb([]);
            return { unsubscribe: jest.fn() };
          }),
        })),
        fetch: jest.fn().mockResolvedValue([]),
      })),
    })),
  },
}));

describe('useWordStatus', () => {
  it('should export useWordStatus function', () => {
    expect(typeof useWordStatus).toBe('function');
  });
});

describe('useWordStatusBatch', () => {
  it('should export useWordStatusBatch function', () => {
    expect(typeof useWordStatusBatch).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/hooks/useWordStatus.test.ts --no-cache
```

- [ ] **Step 3: Implement useWordStatus**

```typescript
// src/hooks/useWordStatus.ts
import { useState, useEffect } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import type WordStatus from '../db/models/WordStatus';
import type { WordStatusValue } from '../utils/types';

interface UseWordStatusResult {
  status: WordStatusValue | null;
  wordRecord: WordStatus | null;
}

export function useWordStatus(
  word: string,
  bookLanguage: string,
  nativeLanguage: string,
): UseWordStatusResult {
  const [wordRecord, setWordRecord] = useState<WordStatus | null>(null);

  useEffect(() => {
    const collection = database.get<WordStatus>('word_statuses');
    const query = collection.query(
      Q.where('word', word.toLowerCase()),
      Q.where('book_language', bookLanguage),
      Q.where('native_language', nativeLanguage),
    );

    const subscription = query.observe().subscribe((results) => {
      setWordRecord(results.length > 0 ? results[0] : null);
    });

    return () => subscription.unsubscribe();
  }, [word, bookLanguage, nativeLanguage]);

  return {
    status: wordRecord ? (wordRecord.status as WordStatusValue) : null,
    wordRecord,
  };
}
```

- [ ] **Step 4: Implement useWordStatusBatch**

```typescript
// src/hooks/useWordStatusBatch.ts
import { useState, useEffect, useRef } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import type WordStatus from '../db/models/WordStatus';
import type { WordStatusValue } from '../utils/types';

export function useWordStatusBatch(
  words: string[],
  bookLanguage: string,
  nativeLanguage: string,
): Map<string, WordStatusValue> {
  const [statusMap, setStatusMap] = useState<Map<string, WordStatusValue>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (words.length === 0) {
      setStatusMap(new Map());
      return;
    }

    // Debounce 300ms
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const collection = database.get<WordStatus>('word_statuses');
        const lowerWords = words.map((w) => w.toLowerCase());
        const results = await collection
          .query(
            Q.where('word', Q.oneOf(lowerWords)),
            Q.where('book_language', bookLanguage),
            Q.where('native_language', nativeLanguage),
          )
          .fetch();

        const map = new Map<string, WordStatusValue>();
        for (const record of results) {
          map.set(record.word, record.status as WordStatusValue);
        }
        setStatusMap(map);
      } catch {
        // Silently fail — words will render with default (new) color
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [words.join(','), bookLanguage, nativeLanguage]);

  return statusMap;
}
```

- [ ] **Step 5: Run tests**

```bash
npx jest __tests__/hooks/useWordStatus.test.ts --no-cache
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useWordStatus.ts src/hooks/useWordStatusBatch.ts __tests__/hooks/useWordStatus.test.ts
git commit -m "feat: add useWordStatus and useWordStatusBatch hooks"
```

---

### Task 6: Reader Route Screen

**Files:**
- Create: `app/reader/[bookId].tsx`

- [ ] **Step 1: Create the reader route**

```typescript
// app/reader/[bookId].tsx
import { useLocalSearchParams } from 'expo-router';
import { YStack, Text, Spinner, Button } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useBook } from '../../src/hooks/useBook';

export default function ReaderScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const { book, loading, error } = useBook(bookId);
  const { t } = useTranslation();
  const router = useRouter();

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" />
      </YStack>
    );
  }

  if (error || !book) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" gap="$4">
        <Text fontSize="$6" color="$red10">
          {error === 'file_missing'
            ? t('reader.error.fileMissing')
            : t('reader.error.bookNotFound')}
        </Text>
        <Button size="$4" onPress={() => router.back()}>
          {t('reader.error.backToLibrary')}
        </Button>
      </YStack>
    );
  }

  // Format-specific reader will be added in Tasks 8 (FB2) and 12 (EPUB)
  return (
    <YStack flex={1} justifyContent="center" alignItems="center">
      <Text fontSize="$6">{book.title}</Text>
      <Text fontSize="$4" color="$gray10">{book.format} reader coming soon</Text>
    </YStack>
  );
}
```

- [ ] **Step 2: Add i18n keys for reader errors**

Add to `src/i18n/locales/en.json` under the `reader` key:

```json
"error": {
  "bookNotFound": "Book not found",
  "fileMissing": "Book file is missing from device",
  "backToLibrary": "Back to Library"
}
```

Add to `ru.json`:
```json
"error": {
  "bookNotFound": "Книга не найдена",
  "fileMissing": "Файл книги отсутствует на устройстве",
  "backToLibrary": "Назад в библиотеку"
}
```

Add to `pl.json`:
```json
"error": {
  "bookNotFound": "Nie znaleziono książki",
  "fileMissing": "Brak pliku książki na urządzeniu",
  "backToLibrary": "Powrót do biblioteki"
}
```

Add to `uk.json`:
```json
"error": {
  "bookNotFound": "Книгу не знайдено",
  "fileMissing": "Файл книги відсутній на пристрої",
  "backToLibrary": "Назад до бібліотеки"
}
```

- [ ] **Step 3: Verify route works**

Start the app, navigate to `/reader/fake-id` — should see "Book not found" error screen.

- [ ] **Step 4: Commit**

```bash
git add app/reader/[bookId].tsx src/i18n/locales/
git commit -m "feat: add reader route screen with book loading and error handling"
```

---

## Chunk 3: FB2 Reader Components

### Task 7: WordTappable Component

The atomic unit of interactable text in the FB2 reader.

**Files:**
- Create: `src/components/reader/WordTappable.tsx`
- Create: `__tests__/components/reader/WordTappable.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// __tests__/components/reader/WordTappable.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { WordTappable } from '../../../src/components/reader/WordTappable';

// Mock Tamagui
jest.mock('tamagui', () => ({
  Text: ({ children, onPress, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text onPress={onPress} {...props}>{children}</Text>;
  },
}));

describe('WordTappable', () => {
  it('renders the word text', () => {
    const { getByText } = render(
      <WordTappable
        word="hello"
        sentenceContext="Say hello to the world."
        onWordTap={jest.fn()}
        color="#4a90d9"
      />,
    );
    expect(getByText('hello')).toBeTruthy();
  });

  it('calls onWordTap with word and sentence when pressed', () => {
    const onTap = jest.fn();
    const { getByText } = render(
      <WordTappable
        word="hello"
        sentenceContext="Say hello to the world."
        onWordTap={onTap}
        color="#4a90d9"
      />,
    );
    fireEvent.press(getByText('hello'));
    expect(onTap).toHaveBeenCalledWith('hello', 'Say hello to the world.');
  });
});
```

- [ ] **Step 2: Run test — should fail**

```bash
npx jest __tests__/components/reader/WordTappable.test.tsx --no-cache
```

- [ ] **Step 3: Implement WordTappable**

```typescript
// src/components/reader/WordTappable.tsx
import React, { useCallback } from 'react';
import { Text } from 'tamagui';

interface WordTappableProps {
  word: string;
  sentenceContext: string;
  onWordTap: (word: string, sentence: string) => void;
  color: string; // From WORD_STATUS_COLORS
}

export const WordTappable = React.memo(function WordTappable({
  word,
  sentenceContext,
  onWordTap,
  color,
}: WordTappableProps) {
  const handlePress = useCallback(() => {
    onWordTap(word, sentenceContext);
  }, [word, sentenceContext, onWordTap]);

  return (
    <Text
      onPress={handlePress}
      color={color === 'transparent' ? undefined : color}
      fontSize="$4"
    >
      {word}
    </Text>
  );
});
```

- [ ] **Step 4: Run test — should pass**

```bash
npx jest __tests__/components/reader/WordTappable.test.tsx --no-cache
```

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/WordTappable.tsx __tests__/components/reader/WordTappable.test.tsx
git commit -m "feat: add WordTappable component for tappable words in reader"
```

---

### Task 8: Fb2Renderer Component

Renders individual FB2 items (paragraphs, titles, images) using Tamagui components.

**Files:**
- Create: `src/components/reader/Fb2Renderer.tsx`
- Create: `__tests__/components/reader/Fb2Renderer.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// __tests__/components/reader/Fb2Renderer.test.tsx
import { tokenizeIntoWords, extractSentence } from '../../../src/components/reader/Fb2Renderer';

describe('Fb2Renderer utilities', () => {
  describe('tokenizeIntoWords', () => {
    it('splits text into words preserving spaces', () => {
      const tokens = tokenizeIntoWords('Hello world');
      expect(tokens).toEqual([
        { word: 'Hello', trailing: ' ' },
        { word: 'world', trailing: '' },
      ]);
    });

    it('handles punctuation attached to words', () => {
      const tokens = tokenizeIntoWords('Hello, world!');
      expect(tokens).toEqual([
        { word: 'Hello,', trailing: ' ' },
        { word: 'world!', trailing: '' },
      ]);
    });
  });

  describe('extractSentence', () => {
    it('extracts sentence containing the word', () => {
      const text = 'First sentence. Second sentence with target word. Third sentence.';
      const sentence = extractSentence(text, 'target');
      expect(sentence).toBe('Second sentence with target word.');
    });

    it('returns full text if no sentence boundary found', () => {
      const text = 'Just one long text without period';
      const sentence = extractSentence(text, 'long');
      expect(sentence).toBe('Just one long text without period');
    });
  });
});
```

- [ ] **Step 2: Run test — should fail**

```bash
npx jest __tests__/components/reader/Fb2Renderer.test.tsx --no-cache
```

- [ ] **Step 3: Implement Fb2Renderer**

Create `src/components/reader/Fb2Renderer.tsx` with:

1. **`tokenizeIntoWords(text: string)`** — splits text by whitespace, returns `{ word, trailing }[]` preserving spaces for layout.

2. **`extractSentence(fullText: string, word: string)`** — finds the sentence containing the word by walking to `.!?\n` boundaries.

3. **`Fb2ItemRenderer` component** — renders a single flat list item:
   - If item is a section title string → `Text` with heading style
   - If item is an `Fb2Paragraph`:
     - `type === 'p'` → renders inline content with `WordTappable` children
     - `type === 'subtitle'` → subheading `Text`
     - `type === 'epigraph'` → indented italic container
     - `type === 'poem'`/`'stanza'`/`'v'` → verse layout
     - `type === 'empty-line'` → spacer `YStack` with `height: '$2'`
   - Inline rendering: iterates `Fb2Inline[]`, for each:
     - `style === 'emphasis'` → italic wrapper
     - `style === 'strong'` → bold wrapper
     - `style === 'plain'` → no wrapper
     - Inside each: tokenize `text` → `WordTappable` per word

4. **Props:** `item`, `onWordTap`, `wordColors: Map<string, WordStatusValue>`, `fontSize`, `lineHeight`, `fontFamily`

- [ ] **Step 4: Run test — should pass**

```bash
npx jest __tests__/components/reader/Fb2Renderer.test.tsx --no-cache
```

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/Fb2Renderer.tsx __tests__/components/reader/Fb2Renderer.test.tsx
git commit -m "feat: add Fb2Renderer with word tokenization and sentence extraction"
```

---

### Task 9: ReaderTopBar Component

**Files:**
- Create: `src/components/reader/ReaderTopBar.tsx`

- [ ] **Step 1: Implement ReaderTopBar**

```typescript
// src/components/reader/ReaderTopBar.tsx
import React from 'react';
import { XStack, Text, Button } from 'tamagui';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface ReaderTopBarProps {
  title: string;
  progress: number; // 0-100
  visible: boolean;
  onSettingsPress: () => void;
}

const AnimatedXStack = Animated.createAnimatedComponent(XStack);

export function ReaderTopBar({ title, progress, visible, onSettingsPress }: ReaderTopBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, { duration: 200 }),
    transform: [{ translateY: withTiming(visible ? 0 : -60, { duration: 200 }) }],
  }));

  return (
    <AnimatedXStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      paddingTop={insets.top}
      paddingHorizontal="$3"
      paddingBottom="$2"
      backgroundColor="$backgroundTransparent"
      justifyContent="space-between"
      alignItems="center"
      zIndex={100}
      style={animatedStyle}
    >
      <Button size="$3" chromeless onPress={() => router.back()}>
        ←
      </Button>
      <Text fontSize="$3" numberOfLines={1} flex={1} textAlign="center" marginHorizontal="$2">
        {title}
      </Text>
      <XStack alignItems="center" gap="$2">
        <Text fontSize="$2" color="$gray10">{Math.round(progress)}%</Text>
        <Button size="$3" chromeless onPress={onSettingsPress}>
          ⚙
        </Button>
      </XStack>
    </AnimatedXStack>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/reader/ReaderTopBar.tsx
git commit -m "feat: add ReaderTopBar with animated show/hide"
```

---

### Task 10: TranslationPopup Component

**Files:**
- Create: `src/components/reader/TranslationPopup.tsx`
- Create: `__tests__/components/reader/TranslationPopup.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// __tests__/components/reader/TranslationPopup.test.tsx
import { TranslationPopup } from '../../../src/components/reader/TranslationPopup';

describe('TranslationPopup', () => {
  it('should export TranslationPopup component', () => {
    expect(typeof TranslationPopup).toBe('function');
  });
});
```

- [ ] **Step 2: Run test — should fail**

```bash
npx jest __tests__/components/reader/TranslationPopup.test.tsx --no-cache
```

- [ ] **Step 3: Implement TranslationPopup**

Create `src/components/reader/TranslationPopup.tsx`:

**Props:**
```typescript
interface TranslationPopupProps {
  visible: boolean;
  word: string;
  sentence: string;
  bookLanguage: string;
  nativeLanguage: string;
  isPhrase: boolean;
  onClose: () => void;
  onSave: (word: string, translation: string, grammar: string, sentence: string) => void;
  onStatusChange: (status: WordStatusValue) => void;
}
```

**Implementation skeleton:**

```typescript
// src/components/reader/TranslationPopup.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { YStack, XStack, Text, Button, Spinner } from 'tamagui';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import { TranslationService } from '../../services/translation/TranslationService';
import { WORD_STATUS_COLORS } from '../../utils/constants';
import type { WordStatusValue } from '../../utils/types';

type PopupState = 'idle' | 'loading' | 'success' | 'error';

interface TranslationResult {
  translation: string;
  grammarNote: string;
  fromCache: boolean;
}

export function TranslationPopup({
  visible, word, sentence, bookLanguage, nativeLanguage,
  isPhrase, onClose, onSave, onStatusChange,
}: TranslationPopupProps) {
  const [state, setState] = useState<PopupState>('idle');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<WordStatusValue>(1);
  const translateY = useSharedValue(400);

  // Slide-up animation
  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 20, stiffness: 150 });
      fetchTranslation();
    } else {
      translateY.value = withTiming(400, { duration: 200 });
      setState('idle');
      setResult(null);
    }
  }, [visible, word]);

  const fetchTranslation = useCallback(async () => {
    setState('loading');
    try {
      const res = await TranslationService.translate({
        word, sentence, bookLanguage, nativeLanguage, isPhrase,
      });
      // If cached, skip loading skeleton (instant)
      setResult({ translation: res.translation, grammarNote: res.grammarNote, fromCache: res.fromCache });
      setState('success');
    } catch {
      setState('error');
    }
  }, [word, sentence, bookLanguage, nativeLanguage, isPhrase]);

  // Swipe-down gesture: close if dragged > 100pt down
  const onGestureEvent = useCallback((event: PanGestureHandlerGestureEvent) => {
    const { translationY } = event.nativeEvent;
    if (translationY > 0) {
      translateY.value = translationY;
    }
  }, []);

  const onGestureEnd = useCallback((event: PanGestureHandlerGestureEvent) => {
    const { translationY, velocityY } = event.nativeEvent;
    if (translationY > 100 || velocityY > 300) {
      translateY.value = withTiming(400, { duration: 200 }, () => runOnJS(onClose)());
    } else {
      translateY.value = withSpring(0);
    }
  }, [onClose]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleSave = useCallback(() => {
    if (result) {
      onSave(word, result.translation, result.grammarNote, sentence);
      // Close popup after save
      onClose();
    }
  }, [word, result, sentence, onSave, onClose]);

  const handleStatusChange = useCallback((status: WordStatusValue) => {
    setSelectedStatus(status);
    onStatusChange(status);
  }, [onStatusChange]);

  // Render context sentence with tapped word in bold
  const renderSentence = () => {
    const idx = sentence.toLowerCase().indexOf(word.toLowerCase());
    if (idx === -1) return <Text fontSize="$3" color="$gray10">{sentence}</Text>;
    const before = sentence.slice(0, idx);
    const match = sentence.slice(idx, idx + word.length);
    const after = sentence.slice(idx + word.length);
    return (
      <Text fontSize="$3" color="$gray10">
        {before}<Text fontWeight="bold">{match}</Text>{after}
      </Text>
    );
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
      </Pressable>

      {/* Sheet */}
      <PanGestureHandler onGestureEvent={onGestureEvent} onEnded={onGestureEnd}>
        <Animated.View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0 }, animatedStyle]}>
          <YStack backgroundColor="$background" borderTopLeftRadius="$4" borderTopRightRadius="$4" padding="$4" gap="$3">
            {/* Word */}
            <Text fontSize="$7" fontWeight="bold">{word}</Text>

            {/* Content by state */}
            {state === 'loading' && <Spinner size="small" />}
            {state === 'error' && (
              <YStack gap="$2">
                <Text color="$red10">Translation failed</Text>
                <Button size="$3" onPress={fetchTranslation}>Retry</Button>
              </YStack>
            )}
            {state === 'success' && result && (
              <YStack gap="$3">
                <Text fontSize="$5">{result.translation}</Text>
                {result.grammarNote ? <Text fontSize="$3" color="$gray10">{result.grammarNote}</Text> : null}
                {renderSentence()}

                {/* Word status selector — 5 colored dots */}
                <XStack gap="$2" justifyContent="center">
                  {([1, 2, 3, 4, 5] as WordStatusValue[]).map((status) => (
                    <Pressable key={status} onPress={() => handleStatusChange(status)}>
                      <YStack
                        width={32} height={32} borderRadius={16}
                        backgroundColor={WORD_STATUS_COLORS[status] === 'transparent' ? '$gray5' : WORD_STATUS_COLORS[status]}
                        borderWidth={selectedStatus === status ? 2 : 0}
                        borderColor="$blue10"
                      />
                    </Pressable>
                  ))}
                </XStack>

                <Button size="$4" theme="blue" onPress={handleSave}>Save</Button>
              </YStack>
            )}
          </YStack>
        </Animated.View>
      </PanGestureHandler>
    </>
  );
}
```

**Post-save UX:** Popup closes automatically after save. User can reopen by tapping the word again.
**Error retry:** Retry button calls `TranslationService.translate()` again (cache is checked first, so if a previous partial result was cached it'll be used).
**Gesture thresholds:** Close if swipe > 100pt down OR velocity > 300pt/s. Otherwise snap back to full height.

- [ ] **Step 4: Run test — should pass**

```bash
npx jest __tests__/components/reader/TranslationPopup.test.tsx --no-cache
```

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/TranslationPopup.tsx __tests__/components/reader/TranslationPopup.test.tsx
git commit -m "feat: add TranslationPopup with LLM translation and word status"
```

---

### Task 11: Fb2Reader Component (Main FB2 Reader)

Integrates FlashList, Fb2Renderer, WordTappable, TranslationPopup, ReaderTopBar.

**Files:**
- Create: `src/components/reader/Fb2Reader.tsx`

- [ ] **Step 1: Implement Fb2Reader**

Create `src/components/reader/Fb2Reader.tsx`:

**Props:**
```typescript
interface Fb2ReaderProps {
  xml: string;
  book: Book; // WatermelonDB model
  bookLanguage: string;
  nativeLanguage: string;
}
```

**Implementation:**

1. **Parse and flatten:** Call `Fb2Parser.parse(xml)` → flatten `Fb2Section[]` into a flat array of renderable items. Each section produces:
   - A title item (if section has title)
   - All paragraphs as individual items
   - Recursively flatten nested sections

2. **FlashList rendering:**
   - `estimatedItemSize={80}`
   - `renderItem` → `Fb2ItemRenderer` from Task 8
   - `onViewableItemsChanged` → collect visible words → feed to `useWordStatusBatch`
   - `getItemType` → return paragraph type for FlashList optimization

3. **Word tap handling:**
   - `onWordTap(word, sentence)` → set `selectedWord` in local state → open TranslationPopup

4. **Scroll position:**
   - `onScroll` throttled 500ms → update `readerStore.setScrollPosition`
   - On mount: if `book.lastPosition` exists, parse JSON `{index, offset}` and pass to `FlashList.initialScrollIndex`
   - On unmount/background: save current position to `Book.lastPosition` via WatermelonDB `book.update()`
   - Calculate progress: `firstVisibleIndex / totalItems * 100` → update `Book.progress`

5. **Top bar:**
   - `ReaderTopBar` with current section title and progress
   - Tap on reader area toggles top bar visibility
   - Scroll down hides, scroll up shows (direction-based)

6. **TranslationPopup:**
   - `onSave` → create/update `WordStatus` + create `WordOccurrence` in WatermelonDB
   - `onStatusChange` → update `WordStatus.status`
   - `onClose` → clear `selectedWord`

7. **Settings:** Read `fontSize`, `lineHeight`, `fontFamily` from `useSettingsStore()` and pass to `Fb2ItemRenderer` as props. The `ReaderSettingsSheet` component (Task 14) mutates these values; since Zustand is reactive, changes apply immediately. Add `const settings = useSettingsStore();` and pass `fontSize={settings.fontSize}`, `lineHeight={settings.lineHeight}`, `fontFamily={settings.fontFamily}` to each rendered item.

- [ ] **Step 2: Wire FB2 reader into route**

Update `app/reader/[bookId].tsx`: when `book.format === 'fb2'`, read the file contents and render `<Fb2Reader xml={content} book={book} ... />`.

```typescript
import * as FileSystem from 'expo-file-system';
import { Fb2Reader } from '../../src/components/reader/Fb2Reader';

// Inside component, after book loaded:
const [content, setContent] = useState<string | null>(null);

useEffect(() => {
  if (book) {
    FileSystem.readAsStringAsync(book.filePath).then(setContent);
  }
}, [book]);

// In render:
if (book.format === 'fb2' && content) {
  return (
    <Fb2Reader
      xml={content}
      book={book}
      bookLanguage={settingsStore.bookLanguage}
      nativeLanguage={settingsStore.nativeLanguage}
    />
  );
}
```

- [ ] **Step 3: Test manually**

To test: need a sample FB2 file. Create a minimal test FB2 in `assets/test/sample.fb2` for development:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <author><first-name>Test</first-name><last-name>Author</last-name></author>
      <book-title>Test Book</book-title>
      <lang>en</lang>
    </title-info>
  </description>
  <body>
    <section>
      <title><p>Chapter One</p></title>
      <p>The quick brown fox jumps over the lazy dog. This is a <emphasis>test</emphasis> of the FB2 reader.</p>
      <p>Another paragraph with <strong>bold text</strong> and more words to test scrolling.</p>
    </section>
  </body>
</FictionBook>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/reader/Fb2Reader.tsx app/reader/[bookId].tsx assets/test/sample.fb2
git commit -m "feat: add Fb2Reader with FlashList virtualization and word taps"
```

---

## Chunk 4: EPUB Reader + Bridge

### Task 12: EPUB Bridge Script

JavaScript code injected into the EPUB WebView for word taps and highlighting.

**Files:**
- Create: `src/services/reader/epubBridgeScript.ts`
- Create: `__tests__/services/reader/epubBridgeScript.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// __tests__/services/reader/epubBridgeScript.test.ts
import { generateBridgeScript } from '../../../src/services/reader/epubBridgeScript';

describe('epubBridgeScript', () => {
  it('generates valid JavaScript string', () => {
    const script = generateBridgeScript();
    expect(typeof script).toBe('string');
    expect(script.length).toBeGreaterThan(100);
  });

  it('contains wordTap message handler', () => {
    const script = generateBridgeScript();
    expect(script).toContain('wordTap');
    expect(script).toContain('postMessage');
  });

  it('contains phraseSelect handler', () => {
    const script = generateBridgeScript();
    expect(script).toContain('phraseSelect');
    expect(script).toContain('getSelection');
  });

  it('contains locationChange handler', () => {
    const script = generateBridgeScript();
    expect(script).toContain('locationChange');
  });
});
```

- [ ] **Step 2: Run test — should fail**

```bash
npx jest __tests__/services/reader/epubBridgeScript.test.ts --no-cache
```

- [ ] **Step 3: Implement bridge script**

Create `src/services/reader/epubBridgeScript.ts`:

```typescript
export function generateBridgeScript(): string {
  return `
    (function() {
      // --- Word Tap Detection ---
      document.addEventListener('click', function(e) {
        // Ignore if text is selected (phrase mode)
        if (window.getSelection().toString().length > 0) return;

        var range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (!range || !range.startContainer || range.startContainer.nodeType !== 3) return;

        var textNode = range.startContainer;
        var text = textNode.textContent;
        var offset = range.startOffset;

        // Extract word boundaries
        // Unicode-aware word boundary: Latin + Cyrillic + Polish diacritics
        var wordChar = /[a-zA-Z\\u00C0-\\u024F\\u0400-\\u04FF\\w]/;
        var start = offset;
        var end = offset;
        while (start > 0 && wordChar.test(text[start - 1])) start--;
        while (end < text.length && wordChar.test(text[end])) end++;

        var word = text.substring(start, end).trim();
        if (!word) return;

        // Extract sentence
        var sentence = extractSentence(textNode, word);

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'wordTap',
          word: word,
          sentence: sentence,
        }));
      });

      // --- Phrase Selection ---
      var selectionTimeout;
      document.addEventListener('selectionchange', function() {
        clearTimeout(selectionTimeout);
        selectionTimeout = setTimeout(function() {
          var sel = window.getSelection();
          var phrase = sel.toString().trim();
          if (phrase && phrase.split(/\\s+/).length >= 2) {
            var sentence = '';
            if (sel.anchorNode) {
              sentence = extractSentence(sel.anchorNode, phrase);
            }
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'phraseSelect',
              phrase: phrase,
              sentence: sentence,
            }));
          }
        }, 500);
      });

      // --- Sentence Extraction ---
      function extractSentence(node, word) {
        var el = node.nodeType === 3 ? node.parentElement : node;
        var block = el;
        while (block && !['P', 'DIV', 'SECTION', 'ARTICLE'].includes(block.tagName)) {
          block = block.parentElement;
        }
        var fullText = (block || el).textContent || '';
        var wordIndex = fullText.toLowerCase().indexOf(word.toLowerCase());
        if (wordIndex === -1) return fullText.substring(0, 200);

        var sentenceStart = fullText.lastIndexOf('.', wordIndex);
        var qStart = fullText.lastIndexOf('?', wordIndex);
        var eStart = fullText.lastIndexOf('!', wordIndex);
        sentenceStart = Math.max(sentenceStart, qStart, eStart) + 1;

        var sentenceEnd = fullText.indexOf('.', wordIndex + word.length);
        var qEnd = fullText.indexOf('?', wordIndex + word.length);
        var eEnd = fullText.indexOf('!', wordIndex + word.length);
        var ends = [sentenceEnd, qEnd, eEnd].filter(function(e) { return e !== -1; });
        sentenceEnd = ends.length > 0 ? Math.min.apply(null, ends) + 1 : fullText.length;

        return fullText.substring(sentenceStart, sentenceEnd).trim();
      }

      // --- Word Highlighting ---
      window.highlightWords = function(wordColors) {
        var walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        var textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        var batch = 0;
        function processBatch() {
          var end = Math.min(batch + 500, textNodes.length);
          for (var i = batch; i < end; i++) {
            var node = textNodes[i];
            if (!node.parentElement || node.parentElement.classList.contains('fluera-highlighted')) continue;

            var words = node.textContent.split(/(\\s+)/);
            if (words.length <= 1 && !wordColors[words[0].toLowerCase()]) continue;

            var frag = document.createDocumentFragment();
            var hasHighlight = false;

            words.forEach(function(part) {
              var lower = part.toLowerCase().replace(/[^a-zA-Z\\u00C0-\\u024F\\u0400-\\u04FF]/g, '');
              var color = wordColors[lower];
              if (color && color !== 'transparent') {
                var span = document.createElement('span');
                span.textContent = part;
                span.style.color = color;
                span.className = 'fluera-highlighted';
                frag.appendChild(span);
                hasHighlight = true;
              } else {
                frag.appendChild(document.createTextNode(part));
              }
            });

            if (hasHighlight) {
              node.parentElement.replaceChild(frag, node);
            }
          }
          batch = end;
          if (batch < textNodes.length) {
            requestAnimationFrame(processBatch);
          }
        }
        requestAnimationFrame(processBatch);
      };

      // --- Location Tracking (throttled 500ms) ---
      var lastLocationTime = 0;
      if (typeof book !== 'undefined' && book.rendition) {
        book.rendition.on('relocated', function(location) {
          var now = Date.now();
          if (now - lastLocationTime < 500) return;
          lastLocationTime = now;

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'locationChange',
            cfi: location.start.cfi,
            progress: location.start.percentage || 0,
          }));
        });
      }
    })();
  `;
}
```

- [ ] **Step 4: Run test — should pass**

```bash
npx jest __tests__/services/reader/epubBridgeScript.test.ts --no-cache
```

- [ ] **Step 5: Commit**

```bash
git add src/services/reader/epubBridgeScript.ts __tests__/services/reader/epubBridgeScript.test.ts
git commit -m "feat: add EPUB WebView bridge script for word taps and highlighting"
```

---

### Task 13: EpubReader Component

**Files:**
- Create: `src/components/reader/EpubReader.tsx`

- [ ] **Step 1: Implement EpubReader**

Create `src/components/reader/EpubReader.tsx`:

**Props:**
```typescript
interface EpubReaderProps {
  fileUri: string; // Path to .epub file
  book: Book;
  bookLanguage: string;
  nativeLanguage: string;
}
```

**Implementation:**

```typescript
// src/components/reader/EpubReader.tsx
import React, { useState, useCallback, useRef } from 'react';
import { YStack } from 'tamagui';
import { Reader, useReader } from '@epubjs-react-native/core';
import { useFileSystem } from '@epubjs-react-native/expo-file-system';
import { generateBridgeScript } from '../../services/reader/epubBridgeScript';
import { TranslationPopup } from './TranslationPopup';
import { ReaderTopBar } from './ReaderTopBar';
import { useSettingsStore } from '../../stores/settingsStore';
import { useReaderStore } from '../../stores/readerStore';
import type Book from '../../db/models/Book';
import type { WordStatusValue } from '../../utils/types';

interface EpubReaderProps {
  fileUri: string;
  book: Book;
  bookLanguage: string;
  nativeLanguage: string;
}

// Theme CSS for epub.js
const THEME_STYLES = {
  light: { body: { background: '#ffffff', color: '#1a1a1a' } },
  dark: { body: { background: '#1a1a1a', color: '#e0e0e0' } },
  sepia: { body: { background: '#f4ecd8', color: '#5b4636' } },
};

export function EpubReader({ fileUri, book, bookLanguage, nativeLanguage }: EpubReaderProps) {
  const { goToLocation, injectJavascript, changeTheme, changeFontSize } = useReader();
  const settings = useSettingsStore();
  const readerStore = useReaderStore();

  const [popupVisible, setPopupVisible] = useState(false);
  const [selectedWord, setSelectedWord] = useState('');
  const [selectedSentence, setSelectedSentence] = useState('');
  const [isPhrase, setIsPhrase] = useState(false);
  const [topBarVisible, setTopBarVisible] = useState(true);
  const [progress, setProgress] = useState(book.progress || 0);
  const [chapterTitle, setChapterTitle] = useState('');

  const handleReady = useCallback(() => {
    // Inject bridge script for word taps/highlighting
    injectJavascript(generateBridgeScript());

    // Apply theme
    changeTheme(THEME_STYLES[settings.readerTheme] || THEME_STYLES.light);
    changeFontSize(`${settings.fontSize}px`);

    // Restore position from DB
    if (book.lastPosition && book.lastPosition.startsWith('epubcfi(')) {
      try {
        goToLocation(book.lastPosition);
      } catch {
        // Stale CFI — fall back to start
        goToLocation('');
      }
    }
  }, [book.lastPosition, settings.readerTheme, settings.fontSize]);

  const handleMessage = useCallback((message: string) => {
    try {
      const data = JSON.parse(message);
      switch (data.type) {
        case 'wordTap':
          setSelectedWord(data.word);
          setSelectedSentence(data.sentence);
          setIsPhrase(false);
          setPopupVisible(true);
          break;
        case 'phraseSelect':
          setSelectedWord(data.phrase);
          setSelectedSentence(data.sentence);
          setIsPhrase(true);
          setPopupVisible(true);
          break;
        case 'locationChange':
          setProgress(data.progress * 100);
          readerStore.setScrollPosition(data.progress);
          // Save CFI to DB
          book.update((b) => {
            b.lastPosition = data.cfi;
            b.progress = data.progress * 100;
            b.lastReadAt = Date.now();
          });
          break;
      }
    } catch { /* ignore malformed messages */ }
  }, [book, readerStore]);

  const handleSave = useCallback(async (word: string, translation: string, grammar: string, sentence: string) => {
    // Create/update WordStatus + WordOccurrence in DB
    // (same logic as Fb2Reader — extracted to a shared util in future refactor)
  }, [book, bookLanguage, nativeLanguage]);

  return (
    <YStack flex={1}>
      <Reader
        src={fileUri}
        fileSystem={useFileSystem}
        onReady={handleReady}
        onMessage={handleMessage}
        onPress={() => setTopBarVisible((v) => !v)}
      />
      <ReaderTopBar
        title={chapterTitle}
        progress={progress}
        visible={topBarVisible}
        onSettingsPress={() => {/* open ReaderSettingsSheet */}}
      />
      <TranslationPopup
        visible={popupVisible}
        word={selectedWord}
        sentence={selectedSentence}
        bookLanguage={bookLanguage}
        nativeLanguage={nativeLanguage}
        isPhrase={isPhrase}
        onClose={() => setPopupVisible(false)}
        onSave={handleSave}
        onStatusChange={(status: WordStatusValue) => {/* update WordStatus in DB */}}
      />
    </YStack>
  );
}
```

- [ ] **Step 2: Wire into reader route**

Update `app/reader/[bookId].tsx`: when `book.format === 'epub'`, render `<EpubReader fileUri={book.filePath} book={book} ... />`.

- [ ] **Step 3: Commit**

```bash
git add src/components/reader/EpubReader.tsx app/reader/[bookId].tsx
git commit -m "feat: add EpubReader with WebView bridge and translation popup"
```

---

### Task 14: ReaderSettingsSheet Component

**Files:**
- Create: `src/components/reader/ReaderSettingsSheet.tsx`

- [ ] **Step 1: Implement settings sheet**

Create `src/components/reader/ReaderSettingsSheet.tsx`:

**Props:** `visible: boolean`, `onClose: () => void`

**Implementation:**

```typescript
// src/components/reader/ReaderSettingsSheet.tsx
import React, { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { YStack, XStack, Text, Button, Slider } from 'tamagui';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from 'react-i18next';

interface ReaderSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

const THEMES = ['light', 'dark', 'sepia'] as const;
const FONTS = ['System', 'serif', 'sans-serif'] as const;

export function ReaderSettingsSheet({ visible, onClose }: ReaderSettingsSheetProps) {
  const settings = useSettingsStore();
  const { t } = useTranslation();
  const translateY = useSharedValue(300);

  React.useEffect(() => {
    translateY.value = visible
      ? withSpring(0, { damping: 20 })
      : withTiming(300, { duration: 200 });
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
      </Pressable>

      <Animated.View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0 }, animatedStyle]}>
        <YStack backgroundColor="$background" borderTopLeftRadius="$4" borderTopRightRadius="$4" padding="$4" gap="$4">
          {/* Font size */}
          <YStack gap="$2">
            <Text fontSize="$3" fontWeight="bold">{t('reader.settings.fontSize')}</Text>
            <XStack alignItems="center" gap="$2">
              <Text fontSize="$2">A</Text>
              <Slider
                flex={1} min={14} max={28} step={1}
                value={[settings.fontSize]}
                onValueChange={([v]) => settings.setFontSize(v)}
              >
                <Slider.Track><Slider.TrackActive /></Slider.Track>
                <Slider.Thumb index={0} circular size="$1" />
              </Slider>
              <Text fontSize="$5">A</Text>
            </XStack>
          </YStack>

          {/* Theme */}
          <YStack gap="$2">
            <Text fontSize="$3" fontWeight="bold">{t('reader.settings.theme')}</Text>
            <XStack gap="$2">
              {THEMES.map((theme) => (
                <Button
                  key={theme} flex={1} size="$3"
                  theme={settings.readerTheme === theme ? 'blue' : undefined}
                  onPress={() => settings.setReaderTheme(theme)}
                >
                  {t(`reader.settings.theme_${theme}`)}
                </Button>
              ))}
            </XStack>
          </YStack>

          {/* Line height */}
          <YStack gap="$2">
            <Text fontSize="$3" fontWeight="bold">{t('reader.settings.lineHeight')}</Text>
            <Slider
              min={12} max={20} step={1}
              value={[Math.round(settings.lineHeight * 10)]}
              onValueChange={([v]) => settings.setLineHeight(v / 10)}
            >
              <Slider.Track><Slider.TrackActive /></Slider.Track>
              <Slider.Thumb index={0} circular size="$1" />
            </Slider>
          </YStack>

          {/* Font family */}
          <YStack gap="$2">
            <Text fontSize="$3" fontWeight="bold">{t('reader.settings.fontFamily')}</Text>
            <XStack gap="$2">
              {FONTS.map((font) => (
                <Button
                  key={font} flex={1} size="$3"
                  theme={settings.fontFamily === font ? 'blue' : undefined}
                  onPress={() => settings.setFontFamily(font)}
                >
                  {font}
                </Button>
              ))}
            </XStack>
          </YStack>
        </YStack>
      </Animated.View>
    </>
  );
}
```

All changes apply immediately — Zustand state updates trigger re-renders in the reader components.

- [ ] **Step 2: Integrate into Fb2Reader and EpubReader**

Both readers: add settings icon to `ReaderTopBar` → `onSettingsPress` opens sheet. Settings values read from `settingsStore` and applied to rendering.

- [ ] **Step 3: Commit**

```bash
git add src/components/reader/ReaderSettingsSheet.tsx src/components/reader/Fb2Reader.tsx src/components/reader/EpubReader.tsx
git commit -m "feat: add ReaderSettingsSheet with font, theme, and layout controls"
```

---

## Chunk 5: Mini-Library + Book Import

### Task 15: BookImporter Service

**Files:**
- Create: `src/services/library/BookImporter.ts`
- Create: `__tests__/services/library/BookImporter.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// __tests__/services/library/BookImporter.test.ts
import { BookImporter } from '../../../src/services/library/BookImporter';

describe('BookImporter', () => {
  it('detects FB2 format from extension', () => {
    expect(BookImporter.detectFormat('book.fb2')).toBe('fb2');
    expect(BookImporter.detectFormat('book.FB2')).toBe('fb2');
  });

  it('detects EPUB format from extension', () => {
    expect(BookImporter.detectFormat('book.epub')).toBe('epub');
  });

  it('detects FB2 ZIP format', () => {
    expect(BookImporter.detectFormat('book.fb2.zip')).toBe('fb2');
  });

  it('returns null for unsupported format', () => {
    expect(BookImporter.detectFormat('book.pdf')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — should fail**

```bash
npx jest __tests__/services/library/BookImporter.test.ts --no-cache
```

- [ ] **Step 3: Implement BookImporter**

Create `src/services/library/BookImporter.ts`:

```typescript
import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { database } from '../../db';
import Book from '../../db/models/Book';
import { Fb2Parser } from '../parser/Fb2Parser';
import type { BookFormat } from '../../utils/types';

const BOOKS_DIR = `${FileSystem.documentDirectory}books/`;
const COVERS_DIR = `${FileSystem.documentDirectory}covers/`;

export class BookImporter {
  static detectFormat(filename: string): BookFormat | null {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.fb2.zip') || lower.endsWith('.fb2')) return 'fb2';
    if (lower.endsWith('.epub')) return 'epub';
    return null;
  }

  static async importFile(sourceUri: string, filename: string): Promise<Book> {
    const format = this.detectFormat(filename);
    if (!format) throw new Error(`Unsupported format: ${filename}`);

    // Ensure directories exist
    await FileSystem.makeDirectoryAsync(BOOKS_DIR, { intermediates: true });
    await FileSystem.makeDirectoryAsync(COVERS_DIR, { intermediates: true });

    const bookId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const ext = format === 'fb2' ? '.fb2' : '.epub';
    const destPath = `${BOOKS_DIR}${bookId}${ext}`;

    // Handle .fb2.zip: extract first
    let filePath = destPath;
    if (filename.toLowerCase().endsWith('.fb2.zip')) {
      const zipData = await FileSystem.readAsStringAsync(sourceUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const zip = await JSZip.loadAsync(zipData, { base64: true });
      const fb2File = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith('.fb2'));
      if (!fb2File) throw new Error('No .fb2 file found in archive');
      const content = await zip.files[fb2File].async('string');
      await FileSystem.writeAsStringAsync(destPath, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } else {
      await FileSystem.copyAsync({ from: sourceUri, to: destPath });
    }

    // Extract metadata
    let title = filename.replace(/\.\w+$/, '');
    let author = 'Unknown';
    let coverPath: string | null = null;

    try {
      if (format === 'fb2') {
        const content = await FileSystem.readAsStringAsync(filePath);
        const parsed = Fb2Parser.parse(content);
        if (parsed.title) title = parsed.title;
        if (parsed.author) author = parsed.author;
        // Cover extraction from binary data can be added later
      } else if (format === 'epub') {
        const result = await this.extractEpubMetadata(filePath);
        if (result.title) title = result.title;
        if (result.author) author = result.author;
      }
    } catch {
      // Fallback: use filename as title, keep defaults
    }

    // Create Book record in WatermelonDB
    const booksCollection = database.get<Book>('books');
    const book = await database.write(async () => {
      return booksCollection.create((record) => {
        record.title = title;
        record.author = author;
        record.language = ''; // Set by user later
        record.format = format;
        record.filePath = filePath;
        record.coverPath = coverPath || '';
        record.source = 'file';
        record.opdsUrl = '';
        record.progress = 0;
        record.totalWords = 0;
        record.difficulty = 0;
        record.addedAt = Date.now();
        record.lastReadAt = 0;
      });
    });

    return book;
  }

  private static async extractEpubMetadata(
    epubPath: string,
  ): Promise<{ title: string | null; author: string | null }> {
    const data = await FileSystem.readAsStringAsync(epubPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const zip = await JSZip.loadAsync(data, { base64: true });

    // Read container.xml to find OPF path
    const containerXml = await zip.files['META-INF/container.xml']?.async('string');
    if (!containerXml) return { title: null, author: null };

    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const container = parser.parse(containerXml);
    const rootfile = container?.container?.rootfiles?.rootfile;
    const opfPath = rootfile?.['@_full-path'] || rootfile?.[0]?.['@_full-path'];
    if (!opfPath) return { title: null, author: null };

    // Parse OPF
    const opfXml = await zip.files[opfPath]?.async('string');
    if (!opfXml) return { title: null, author: null };

    const opf = parser.parse(opfXml);
    const metadata = opf?.package?.metadata;

    const title = metadata?.['dc:title'] || null;
    const author = metadata?.['dc:creator']?.['#text'] || metadata?.['dc:creator'] || null;

    return { title, author };
  }
}
```

- [ ] **Step 4: Run test — should pass**

```bash
npx jest __tests__/services/library/BookImporter.test.ts --no-cache
```

- [ ] **Step 5: Commit**

```bash
git add src/services/library/BookImporter.ts __tests__/services/library/BookImporter.test.ts
git commit -m "feat: add BookImporter with FB2/EPUB metadata extraction"
```

---

### Task 16: BookCard and AddBookButton Components

**Files:**
- Create: `src/components/library/BookCard.tsx`
- Create: `src/components/library/AddBookButton.tsx`

- [ ] **Step 1: Implement BookCard**

```typescript
// src/components/library/BookCard.tsx
import React from 'react';
import { YStack, XStack, Text, Image } from 'tamagui';
import { useRouter } from 'expo-router';
import type Book from '../../db/models/Book';

interface BookCardProps {
  book: Book;
}

export function BookCard({ book }: BookCardProps) {
  const router = useRouter();

  return (
    <XStack
      padding="$3"
      backgroundColor="$background"
      borderRadius="$3"
      marginBottom="$2"
      pressStyle={{ opacity: 0.8 }}
      onPress={() => router.push(`/reader/${book.id}`)}
      gap="$3"
    >
      {book.coverPath ? (
        <Image
          source={{ uri: book.coverPath }}
          width={60}
          height={90}
          borderRadius="$2"
        />
      ) : (
        <YStack
          width={60}
          height={90}
          backgroundColor="$gray5"
          borderRadius="$2"
          justifyContent="center"
          alignItems="center"
        >
          <Text fontSize="$2" color="$gray10">
            {book.format.toUpperCase()}
          </Text>
        </YStack>
      )}

      <YStack flex={1} justifyContent="space-between">
        <YStack>
          <Text fontSize="$5" fontWeight="bold" numberOfLines={2}>
            {book.title}
          </Text>
          <Text fontSize="$3" color="$gray10" numberOfLines={1}>
            {book.author}
          </Text>
        </YStack>

        <XStack alignItems="center" gap="$2">
          {/* Progress bar */}
          <YStack flex={1} height={4} backgroundColor="$gray5" borderRadius="$1">
            <YStack
              height={4}
              width={`${book.progress}%`}
              backgroundColor="$blue10"
              borderRadius="$1"
            />
          </YStack>
          <Text fontSize="$2" color="$gray10">
            {Math.round(book.progress)}%
          </Text>
        </XStack>
      </YStack>
    </XStack>
  );
}
```

- [ ] **Step 2: Implement AddBookButton**

```typescript
// src/components/library/AddBookButton.tsx
import React from 'react';
import { Alert } from 'react-native';
import { Button } from 'tamagui';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { BookImporter } from '../../services/library/BookImporter';

export function AddBookButton() {
  const { t } = useTranslation();

  const handlePress = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/epub+zip', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const format = BookImporter.detectFormat(asset.name);
      if (!format) {
        Alert.alert(
          t('library.import.errorTitle'),
          t('library.import.unsupportedFormat'),
        );
        return;
      }

      await BookImporter.importFile(asset.uri, asset.name);
      // WatermelonDB observe() in LibraryScreen auto-updates the list
    } catch (error) {
      console.error('Import failed:', error);
      Alert.alert(
        t('library.import.errorTitle'),
        t('library.import.failed'),
      );
    }
  };

  return (
    <Button
      size="$4"
      theme="blue"
      onPress={handlePress}
    >
      {t('library.addBook')}
    </Button>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/library/BookCard.tsx src/components/library/AddBookButton.tsx
git commit -m "feat: add BookCard and AddBookButton components"
```

---

### Task 17: Library Screen (Replace Placeholder)

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Implement Library screen**

Replace the placeholder in `app/(tabs)/index.tsx` with a functional library:

```typescript
// app/(tabs)/index.tsx
import React, { useState } from 'react';
import { FlatList } from 'react-native';
import { YStack, Text } from 'tamagui';
import { Q } from '@nozbe/watermelondb';
import { useTranslation } from 'react-i18next';
import { database } from '../../src/db';
import Book from '../../src/db/models/Book';
import { BookCard } from '../../src/components/library/BookCard';
import { AddBookButton } from '../../src/components/library/AddBookButton';

export default function LibraryScreen() {
  const { t } = useTranslation();
  const [books, setBooks] = useState<Book[]>([]);

  // Load books from DB — WatermelonDB's observe() is reactive,
  // so the list updates automatically when books are added/modified/deleted
  React.useEffect(() => {
    const collection = database.get<Book>('books');
    const subscription = collection
      .query(Q.sortBy('last_read_at', Q.desc))
      .observe()
      .subscribe(setBooks);

    return () => subscription.unsubscribe();
  }, []);

  if (books.length === 0) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" gap="$4">
        <Text fontSize="$7" textAlign="center">📚</Text>
        <Text fontSize="$5" textAlign="center" color="$gray11">
          {t('library.emptyState.title')}
        </Text>
        <Text fontSize="$3" textAlign="center" color="$gray10">
          {t('library.emptyState.subtitle')}
        </Text>
        <AddBookButton />
      </YStack>
    );
  }

  return (
    <YStack flex={1} padding="$3">
      <FlatList
        data={books}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <BookCard book={item} />}
        ListHeaderComponent={
          <YStack marginBottom="$3">
            <AddBookButton />
          </YStack>
        }
      />
    </YStack>
  );
}
```

- [ ] **Step 2: Add i18n keys**

Add to `src/i18n/locales/en.json`:

```json
"library": {
  "addBook": "Add Book",
  "emptyState": {
    "title": "Your library is empty",
    "subtitle": "Add your first book to start reading"
  },
  "import": {
    "errorTitle": "Import Error",
    "unsupportedFormat": "This file format is not supported. Please select an EPUB or FB2 file.",
    "failed": "Failed to import book. The file may be corrupted."
  }
}
```

Also add reader settings keys to `en.json`:
```json
"reader": {
  "settings": {
    "fontSize": "Font Size",
    "theme": "Theme",
    "theme_light": "Light",
    "theme_dark": "Dark",
    "theme_sepia": "Sepia",
    "lineHeight": "Line Height",
    "fontFamily": "Font"
  }
}
```

Add to `ru.json`:
```json
"library": {
  "addBook": "Добавить книгу",
  "emptyState": {
    "title": "Библиотека пуста",
    "subtitle": "Добавьте первую книгу, чтобы начать чтение"
  },
  "import": {
    "errorTitle": "Ошибка импорта",
    "unsupportedFormat": "Формат файла не поддерживается. Выберите файл EPUB или FB2.",
    "failed": "Не удалось импортировать книгу. Файл может быть повреждён."
  }
},
"reader": {
  "settings": {
    "fontSize": "Размер шрифта",
    "theme": "Тема",
    "theme_light": "Светлая",
    "theme_dark": "Тёмная",
    "theme_sepia": "Сепия",
    "lineHeight": "Межстрочный интервал",
    "fontFamily": "Шрифт"
  }
}
```

Add to `pl.json`:
```json
"library": {
  "addBook": "Dodaj książkę",
  "emptyState": {
    "title": "Biblioteka jest pusta",
    "subtitle": "Dodaj pierwszą książkę, aby rozpocząć czytanie"
  },
  "import": {
    "errorTitle": "Błąd importu",
    "unsupportedFormat": "Ten format pliku nie jest obsługiwany. Wybierz plik EPUB lub FB2.",
    "failed": "Nie udało się zaimportować książki. Plik może być uszkodzony."
  }
}
```

Add to `uk.json`:
```json
"library": {
  "addBook": "Додати книгу",
  "emptyState": {
    "title": "Бібліотека порожня",
    "subtitle": "Додайте першу книгу, щоб почати читання"
  },
  "import": {
    "errorTitle": "Помилка імпорту",
    "unsupportedFormat": "Цей формат файлу не підтримується. Виберіть файл EPUB або FB2.",
    "failed": "Не вдалося імпортувати книгу. Файл може бути пошкодженим."
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\\(tabs\\)/index.tsx src/i18n/locales/
git commit -m "feat: implement Library screen with book list and file import"
```

---

## Chunk 6: Integration + Final Verification

### Task 18: Run All Tests

- [ ] **Step 1: Run full test suite**

```bash
npx jest --no-cache
```

Expected: All tests pass (existing + new).

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run linter**

```bash
npx expo lint
```

Expected: No critical errors.

- [ ] **Step 4: Fix any issues found in steps 1-3**

If any tests fail or type errors exist, fix them before proceeding.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve test/type/lint issues from integration"
```

---

### Task 19: Manual End-to-End Test

- [ ] **Step 1: Start the app**

```bash
npx expo start --dev-client --ios
```

- [ ] **Step 2: Test Library screen**

1. App opens to Library tab → should show empty state with "Add Book" button
2. Tap "Add Book" → file picker opens
3. Select a `.fb2` file → book appears in library
4. Select a `.epub` file → book appears in library

- [ ] **Step 3: Test FB2 reader**

1. Tap FB2 book card → reader opens
2. Text renders with proper formatting (headings, paragraphs, emphasis)
3. Scroll through text → smooth, no jank
4. Tap a word → TranslationPopup appears with translation
5. Change word status → color updates
6. Tap Save → word saved to dictionary
7. Close reader → progress saved
8. Reopen reader → scroll position restored

- [ ] **Step 4: Test EPUB reader**

1. Tap EPUB book card → reader opens
2. Text renders in WebView
3. Tap a word → TranslationPopup appears
4. Swipe to change pages
5. Close and reopen → position restored

- [ ] **Step 5: Test settings**

1. Open settings sheet in reader
2. Change font size → text resizes immediately
3. Change theme (dark/light/sepia) → colors update
4. Change line height → spacing adjusts

- [ ] **Step 6: Commit verification result**

Create a brief note of any issues found and commit:

```bash
git add -A
git commit -m "chore: complete Reader Phase 1 implementation"
```
