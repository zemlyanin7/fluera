# Unified Reader Themes & Settings — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify EPUB and FB2 readers with 8 color themes, auto day/night switching, consistent scroll/pagination modes, and fix existing visual bugs.

**Architecture:** A centralized theme registry (`readerThemes.ts`) defines 8 themes. A `useReaderTheme()` hook resolves the active theme based on auto/manual mode + system appearance. Both readers, TopBar, and TranslationPopup consume this hook. Settings store migrates from single `readerTheme` field to `lightThemeId`/`darkThemeId`/`autoTheme`/`manualThemeId`/`scrollMode`.

**Tech Stack:** React Native (Expo 55), TypeScript, Zustand (with persist middleware + migration), Tamagui, react-native-reanimated, i18next, useSafeAreaInsets, @epubjs-react-native, FlashList/FlatList

**Spec:** `docs/superpowers/specs/2026-03-14-unified-reader-themes-design.md`

---

## Chunk 1: Foundation — Theme Registry + Settings Store + Hook + i18n

> **Execution order:** Task 1 → Task 3 → Task 2 → Task 4. Task 2 (hook) depends on Task 3 (store) because it imports the new settings fields.

### Task 1: Create Reader Theme Registry

**Files:**
- Create: `src/theme/readerThemes.ts`

- [ ] **Step 1: Create the theme registry file**

```typescript
// src/theme/readerThemes.ts

export type ThemeGroup = 'light' | 'dark';

export interface ReaderThemeDefinition {
  id: string;
  nameKey: string;
  group: ThemeGroup;
  colors: {
    background: string;
    text: string;
    textSecondary: string;
    surface: string;
    border: string;
    topBarBg: string;
    popupBg: string;
  };
  preview: string;
}

const THEMES_LIST: ReaderThemeDefinition[] = [
  {
    id: 'white',
    nameKey: 'settings.themes.white',
    group: 'light',
    colors: {
      background: '#FFFFFF',
      text: '#1A1A2E',
      textSecondary: '#666666',
      surface: '#F5F5F5',
      border: '#E0E0E0',
      topBarBg: '#FFFFFF',
      popupBg: '#FFFFFF',
    },
    preview: '#FFFFFF',
  },
  {
    id: 'sepia',
    nameKey: 'settings.themes.sepia',
    group: 'light',
    colors: {
      background: '#FBF0D9',
      text: '#5F4B32',
      textSecondary: '#7A6952',
      surface: '#F0E6CF',
      border: '#D4C9B0',
      topBarBg: '#FBF0D9',
      popupBg: '#F5EACD',
    },
    preview: '#FBF0D9',
  },
  {
    id: 'parchment',
    nameKey: 'settings.themes.parchment',
    group: 'light',
    colors: {
      background: '#F5F1E8',
      text: '#3D3426',
      textSecondary: '#6B5D4E',
      surface: '#EDE8DD',
      border: '#DDD5C5',
      topBarBg: '#F5F1E8',
      popupBg: '#EFE9DE',
    },
    preview: '#F5F1E8',
  },
  {
    id: 'sage',
    nameKey: 'settings.themes.sage',
    group: 'light',
    colors: {
      background: '#E8EDDF',
      text: '#3D4A2E',
      textSecondary: '#5C6B4E',
      surface: '#DEE4D5',
      border: '#C8D0BE',
      topBarBg: '#E8EDDF',
      popupBg: '#E2E8D8',
    },
    preview: '#E8EDDF',
  },
  {
    id: 'dark',
    nameKey: 'settings.themes.dark',
    group: 'dark',
    colors: {
      background: '#1A1A2E',
      text: '#E0E0E0',
      textSecondary: '#AAAAAA',
      surface: '#252540',
      border: '#333355',
      topBarBg: '#1A1A2E',
      popupBg: '#252540',
    },
    preview: '#1A1A2E',
  },
  {
    id: 'amoled',
    nameKey: 'settings.themes.amoled',
    group: 'dark',
    colors: {
      background: '#000000',
      text: '#CCCCCC',
      textSecondary: '#888888',
      surface: '#111111',
      border: '#222222',
      topBarBg: '#000000',
      popupBg: '#111111',
    },
    preview: '#000000',
  },
  {
    id: 'coffee',
    nameKey: 'settings.themes.coffee',
    group: 'dark',
    colors: {
      background: '#2A2118',
      text: '#D4C4A8',
      textSecondary: '#A08B6F',
      surface: '#362C22',
      border: '#4A3D30',
      topBarBg: '#2A2118',
      popupBg: '#362C22',
    },
    preview: '#2A2118',
  },
  {
    id: 'graphite',
    nameKey: 'settings.themes.graphite',
    group: 'dark',
    colors: {
      background: '#262626',
      text: '#D0D0D0',
      textSecondary: '#999999',
      surface: '#333333',
      border: '#444444',
      topBarBg: '#262626',
      popupBg: '#333333',
    },
    preview: '#262626',
  },
];

export const READER_THEMES: Record<string, ReaderThemeDefinition> = {};
for (const theme of THEMES_LIST) {
  READER_THEMES[theme.id] = theme;
}

export const LIGHT_THEMES: ReaderThemeDefinition[] = THEMES_LIST.filter(
  (t) => t.group === 'light',
);
export const DARK_THEMES: ReaderThemeDefinition[] = THEMES_LIST.filter(
  (t) => t.group === 'dark',
);

export function getThemeById(id: string): ReaderThemeDefinition {
  return READER_THEMES[id] ?? READER_THEMES['white'];
}
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors from this file

- [ ] **Step 3: Commit**

```bash
git add src/theme/readerThemes.ts
git commit -m "feat: add reader theme registry with 8 themes"
```

---

### Task 2: Create `useReaderTheme` Hook

**Files:**
- Create: `src/hooks/useReaderTheme.ts`

**Depends on:** Task 1 (readerThemes.ts), Task 3 (settingsStore — must be completed first)

> **Important:** Task 3 MUST be completed before this task. The hook imports `autoTheme`, `lightThemeId`, `darkThemeId`, `manualThemeId` from the settings store, which are added in Task 3.

- [ ] **Step 1: Create the hook file**

```typescript
// src/hooks/useReaderTheme.ts

import { useColorScheme } from 'react-native';
import { useSettingsStore } from '../stores/settingsStore';
import { getThemeById } from '../theme/readerThemes';
import type { ReaderThemeDefinition } from '../theme/readerThemes';

/**
 * Single source of truth for the active reader theme.
 *
 * - autoTheme ON: follows system appearance (light → lightThemeId, dark → darkThemeId)
 * - autoTheme OFF: uses manualThemeId
 */
export function useReaderTheme(): ReaderThemeDefinition {
  const { autoTheme, lightThemeId, darkThemeId, manualThemeId } =
    useSettingsStore();
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null

  if (autoTheme) {
    const isDark = systemScheme === 'dark';
    return getThemeById(isDark ? darkThemeId : lightThemeId);
  }

  return getThemeById(manualThemeId);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useReaderTheme.ts
git commit -m "feat: add useReaderTheme hook for auto day/night switching"
```

---

### Task 3: Update Settings Store

**Files:**
- Modify: `src/stores/settingsStore.ts`

- [ ] **Step 1: Rewrite settingsStore.ts with new fields and migration**

Replace the entire contents of `src/stores/settingsStore.ts` with:

```typescript
// src/stores/settingsStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  // Language
  nativeLanguage: string;
  bookLanguage: string;

  // Reader themes (replaces old readerTheme field)
  lightThemeId: string;
  darkThemeId: string;
  autoTheme: boolean;
  manualThemeId: string;

  // Reader display
  scrollMode: 'paginated' | 'scroll';
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  showWordColors: boolean;

  // Actions
  setNativeLanguage: (lang: string) => void;
  setBookLanguage: (lang: string) => void;
  setLightThemeId: (id: string) => void;
  setDarkThemeId: (id: string) => void;
  setAutoTheme: (auto: boolean) => void;
  setManualThemeId: (id: string) => void;
  setScrollMode: (mode: 'paginated' | 'scroll') => void;
  setFontSize: (size: number) => void;
  setFontFamily: (fontFamily: string) => void;
  setLineHeight: (lineHeight: number) => void;
  setShowWordColors: (show: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      nativeLanguage: 'ru',
      bookLanguage: 'en',

      lightThemeId: 'white',
      darkThemeId: 'dark',
      autoTheme: true,
      manualThemeId: 'white',

      scrollMode: 'paginated',
      fontSize: 18,
      fontFamily: 'Georgia',
      lineHeight: 1.8,
      showWordColors: true,

      setNativeLanguage: (lang) => set({ nativeLanguage: lang }),
      setBookLanguage: (lang) => set({ bookLanguage: lang }),
      setLightThemeId: (id) => set({ lightThemeId: id }),
      setDarkThemeId: (id) => set({ darkThemeId: id }),
      setAutoTheme: (auto) => set({ autoTheme: auto }),
      setManualThemeId: (id) => set({ manualThemeId: id }),
      setScrollMode: (mode) => set({ scrollMode: mode }),
      setFontSize: (size) => set({ fontSize: size }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setShowWordColors: (show) => set({ showWordColors: show }),
    }),
    {
      name: 'fluera-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;

        if (version === 0 || version === undefined) {
          // Migrate from old readerTheme: 'light' | 'dark' | 'sepia'
          const oldTheme = state.readerTheme as string | undefined;

          if (oldTheme === 'sepia') {
            state.lightThemeId = 'sepia';
            state.darkThemeId = 'dark';
            state.autoTheme = false;
            state.manualThemeId = 'sepia';
          } else {
            state.lightThemeId = 'white';
            state.darkThemeId = 'dark';
            state.autoTheme = true;
            state.manualThemeId = 'white';
          }

          // Set new defaults for fields that didn't exist
          if (state.scrollMode === undefined) {
            state.scrollMode = 'paginated';
          }

          // Remove old field
          delete state.readerTheme;
        }

        return state as SettingsState;
      },
    },
  ),
);
```

- [ ] **Step 2: Remove `ReaderTheme` type from types.ts**

In `src/utils/types.ts`, remove the line:
```
export type ReaderTheme = 'light' | 'dark' | 'sepia'
```

The file should become:
```typescript
export type BookFormat = 'epub' | 'fb2' | 'pdf'
export type BookSource = 'opds' | 'file' | 'catalog'
export type WordStatusValue = 1 | 2 | 3 | 4 | 5
export type SupportedUILanguage = 'en' | 'ru' | 'pl' | 'uk'
```

- [ ] **Step 3: Fix any remaining imports of `ReaderTheme`**

Search for `ReaderTheme` imports across the codebase and remove them:

Run: `grep -r "ReaderTheme" src/ --include="*.ts" --include="*.tsx" -l`

The old `settingsStore.ts` imported it — now removed. If other files reference it, remove those imports too. The old `ReaderSettingsSheet.tsx` used `settings.setReaderTheme()` — that file will be rewritten in Task 10, so any type errors there are expected until then.

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: Errors only in files not yet updated (ReaderSettingsSheet.tsx, EpubReader.tsx referencing `settings.readerTheme`). These will be fixed in later tasks.

- [ ] **Step 5: Commit**

```bash
git add src/stores/settingsStore.ts src/utils/types.ts
git commit -m "feat: update settings store with theme pair + auto switching + migration"
```

---

### Task 4: Update i18n Locale Files

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/ru.json`
- Modify: `src/i18n/locales/pl.json`
- Modify: `src/i18n/locales/uk.json`

- [ ] **Step 1: Update en.json**

Add new keys to the `"settings"` section and update `"reader.settings"`:

```json
{
  "settings": {
    "title": "Settings",
    "language": "Interface language",
    "bookLanguage": "Book language",
    "nativeLanguage": "Translation language",
    "themes": {
      "white": "White",
      "sepia": "Sepia",
      "parchment": "Parchment",
      "sage": "Sage",
      "dark": "Dark",
      "amoled": "AMOLED",
      "coffee": "Coffee",
      "graphite": "Graphite"
    },
    "reading": "Reading",
    "dayTheme": "Day theme",
    "nightTheme": "Night theme",
    "autoTheme": "Auto day / night",
    "autoThemeSubtitle": "Follow system setting",
    "scrollMode": "Page mode",
    "scrollModePaginated": "Pages",
    "scrollModeScroll": "Scroll",
    "fontSize": "Font size",
    "font": "Font",
    "fontSystem": "System",
    "fontSerif": "Serif",
    "fontSansSerif": "Sans-serif",
    "lineHeight": "Line height"
  },
  "reader": {
    "loading": "Loading...",
    "settings": {
      "fontSize": "Font size",
      "theme": "Theme",
      "dayTheme": "Day theme ☀️",
      "nightTheme": "Night theme 🌙",
      "autoTheme": "Auto day / night",
      "autoThemeSubtitle": "Follow system setting",
      "lineHeight": "Line height",
      "fontFamily": "Font"
    }
  }
}
```

Merge these keys into the existing file. **Keep all existing keys intact** — only add/replace where needed. Specifically:
- Remove old `"reader.settings.theme_light"`, `"reader.settings.theme_dark"`, `"reader.settings.theme_sepia"` keys
- Remove old `"settings.themes"` object (the old 3-theme version)
- **DO NOT remove** existing keys `"reader.settings.lineHeight"` and `"reader.settings.fontFamily"` — they are still used by other components
- The `"settings.theme"` key (string, not object) can be kept or removed — it's replaced by the new `"settings.themes"` object

- [ ] **Step 2: Update ru.json**

Same structure with Russian translations:

```json
{
  "settings": {
    "themes": {
      "white": "Белая",
      "sepia": "Сепия",
      "parchment": "Пергамент",
      "sage": "Шалфей",
      "dark": "Тёмная",
      "amoled": "AMOLED",
      "coffee": "Кофейная",
      "graphite": "Графит"
    },
    "reading": "Чтение",
    "dayTheme": "Дневная тема",
    "nightTheme": "Ночная тема",
    "autoTheme": "Авто день / ночь",
    "autoThemeSubtitle": "Следовать за системой",
    "scrollMode": "Режим листания",
    "scrollModePaginated": "Постранично",
    "scrollModeScroll": "Скролл",
    "fontSize": "Размер шрифта",
    "font": "Шрифт",
    "fontSystem": "Системный",
    "fontSerif": "С засечками",
    "fontSansSerif": "Без засечек",
    "lineHeight": "Межстрочный интервал"
  },
  "reader": {
    "loading": "Загрузка...",
    "settings": {
      "fontSize": "Размер шрифта",
      "theme": "Тема",
      "dayTheme": "Дневная тема ☀️",
      "nightTheme": "Ночная тема 🌙",
      "autoTheme": "Авто день / ночь",
      "autoThemeSubtitle": "Следовать за системой",
      "lineHeight": "Межстрочный интервал",
      "fontFamily": "Шрифт"
    }
  }
}
```

- [ ] **Step 3: Update pl.json**

Polish translations:

```json
{
  "settings": {
    "themes": {
      "white": "Biały",
      "sepia": "Sepia",
      "parchment": "Pergamin",
      "sage": "Szałwia",
      "dark": "Ciemny",
      "amoled": "AMOLED",
      "coffee": "Kawowy",
      "graphite": "Grafitowy"
    },
    "reading": "Czytanie",
    "dayTheme": "Motyw dzienny",
    "nightTheme": "Motyw nocny",
    "autoTheme": "Auto dzień / noc",
    "autoThemeSubtitle": "Podążaj za systemem",
    "scrollMode": "Tryb stron",
    "scrollModePaginated": "Stronami",
    "scrollModeScroll": "Przewijanie",
    "fontSize": "Rozmiar czcionki",
    "font": "Czcionka",
    "fontSystem": "Systemowa",
    "fontSerif": "Szeryfowa",
    "fontSansSerif": "Bezszeryfowa",
    "lineHeight": "Odstęp między wierszami"
  },
  "reader": {
    "loading": "Ładowanie...",
    "settings": {
      "fontSize": "Rozmiar czcionki",
      "theme": "Motyw",
      "dayTheme": "Motyw dzienny ☀️",
      "nightTheme": "Motyw nocny 🌙",
      "autoTheme": "Auto dzień / noc",
      "autoThemeSubtitle": "Podążaj za systemem",
      "lineHeight": "Odstęp między wierszami",
      "fontFamily": "Czcionka"
    }
  }
}
```

- [ ] **Step 4: Update uk.json**

Ukrainian translations:

```json
{
  "settings": {
    "themes": {
      "white": "Біла",
      "sepia": "Сепія",
      "parchment": "Пергамент",
      "sage": "Шавлія",
      "dark": "Темна",
      "amoled": "AMOLED",
      "coffee": "Кавова",
      "graphite": "Графіт"
    },
    "reading": "Читання",
    "dayTheme": "Денна тема",
    "nightTheme": "Нічна тема",
    "autoTheme": "Авто день / ніч",
    "autoThemeSubtitle": "Слідувати за системою",
    "scrollMode": "Режим гортання",
    "scrollModePaginated": "Посторінково",
    "scrollModeScroll": "Скрол",
    "fontSize": "Розмір шрифту",
    "font": "Шрифт",
    "fontSystem": "Системний",
    "fontSerif": "Із засічками",
    "fontSansSerif": "Без засічок",
    "lineHeight": "Міжрядковий інтервал"
  },
  "reader": {
    "loading": "Завантаження...",
    "settings": {
      "fontSize": "Розмір шрифту",
      "theme": "Тема",
      "dayTheme": "Денна тема ☀️",
      "nightTheme": "Нічна тема 🌙",
      "autoTheme": "Авто день / ніч",
      "autoThemeSubtitle": "Слідувати за системою",
      "lineHeight": "Міжрядковий інтервал",
      "fontFamily": "Шрифт"
    }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json src/i18n/locales/uk.json
git commit -m "feat: add i18n keys for 8 reader themes and settings labels"
```

---

## Chunk 2: Reader Integration — EPUB + FB2 + TopBar + TranslationPopup

### Task 5: Update EPUB Reader to Use `useReaderTheme`

**Files:**
- Modify: `src/components/reader/EpubReader.tsx`

**Context:** The current `EpubReader.tsx` has a hardcoded `THEME_STYLES` object mapping `'light'|'dark'|'sepia'` to body CSS. It also has no `backgroundColor` on the container View (causing white bar bug) and no `flow` prop (always paginated).

- [ ] **Step 1: Remove `THEME_STYLES` and add `useReaderTheme` import**

In `src/components/reader/EpubReader.tsx`:

Remove lines 22-26 (the `THEME_STYLES` constant):
```typescript
// DELETE THIS:
const THEME_STYLES: Record<string, { body: { background: string; color: string } }> = {
  light: { body: { background: '#ffffff', color: '#1a1a1a' } },
  dark: { body: { background: '#1a1a1a', color: '#e0e0e0' } },
  sepia: { body: { background: '#f4ecd8', color: '#5b4636' } },
};
```

Add import at top:
```typescript
import { useReaderTheme } from '../../hooks/useReaderTheme';
```

- [ ] **Step 2: Add `useReaderTheme()` call and update `handleReady`**

Inside `EpubReaderInner`, after `const settings = useSettingsStore();`, add:
```typescript
const readerTheme = useReaderTheme();
```

Replace the `handleReady` callback:

```typescript
const handleReady = useCallback(() => {
  changeTheme({
    body: {
      background: readerTheme.colors.background,
      color: readerTheme.colors.text,
    },
  });
  changeFontSize(`${settings.fontSize}px`);

  if (book.lastPosition && book.lastPosition.startsWith('epubcfi(')) {
    try {
      goToLocation(book.lastPosition);
    } catch {
      goToLocation('');
    }
  }
}, [book.lastPosition, readerTheme, settings.fontSize, changeTheme, changeFontSize, goToLocation]);
```

- [ ] **Step 3: Re-apply theme when `readerTheme` changes**

Add a `useEffect` after `handleReady` to re-apply theme on changes:

```typescript
// Re-apply theme when reader theme changes (auto day/night or manual switch)
useEffect(() => {
  changeTheme({
    body: {
      background: readerTheme.colors.background,
      color: readerTheme.colors.text,
    },
  });
}, [readerTheme, changeTheme]);
```

- [ ] **Step 4: Fix white bar — add backgroundColor to container**

Change the container View style from:
```typescript
<View style={styles.container}>
```
to:
```typescript
<View style={[styles.container, { backgroundColor: readerTheme.colors.background }]}>
```

- [ ] **Step 5: Add scroll mode via `flow` prop**

On the `<Reader>` component, add the `flow` prop:

```typescript
<Reader
  src={fileUri}
  fileSystem={useFileSystem}
  width={screenWidth}
  height={readerHeight}
  enableSelection
  flow={settings.scrollMode === 'scroll' ? 'scrolled' : 'paginated'}
  onReady={handleReady}
  onWebViewMessage={handleWebViewMessage}
  injectedJavascript={bridgeScript}
  onPress={handlePress}
/>
```

- [ ] **Step 6: Clean up unused import**

The old `import type { ReaderTheme } from '../../utils/types'` was already removed when settingsStore was updated. If `settings.readerTheme` is still referenced anywhere in this file, replace those references. After Task 3, `settings.readerTheme` no longer exists — all theme access goes through `readerTheme` from the hook.

- [ ] **Step 7: Commit**

```bash
git add src/components/reader/EpubReader.tsx
git commit -m "feat: EPUB reader uses useReaderTheme, fixes white bar, adds scroll mode"
```

---

### Task 6: Add Color Props to FB2 Renderer and WordTappable

**Files:**
- Modify: `src/components/reader/Fb2Renderer.tsx`
- Modify: `src/components/reader/WordTappable.tsx`

**Context:** Currently `Fb2Renderer` and `WordTappable` inherit text color from Tamagui theme context. When `color` is `'transparent'` (known words), the word renders in whatever Tamagui provides — which may not match the reader theme. We need to pass explicit `textColor` so known words render in the reader theme's text color.

- [ ] **Step 1: Add `textColor` prop to `WordTappable`**

Update `src/components/reader/WordTappable.tsx`:

```typescript
import React, { useCallback } from 'react';
import { Text } from 'tamagui';

interface WordTappableProps {
  word: string;
  sentenceContext: string;
  onWordTap: (word: string, sentence: string) => void;
  color: string;
  textColor?: string; // Reader theme text color for known (transparent) words
}

export const WordTappable = React.memo(function WordTappable({
  word,
  sentenceContext,
  onWordTap,
  color,
  textColor,
}: WordTappableProps) {
  const handlePress = useCallback(() => {
    onWordTap(word, sentenceContext);
  }, [word, sentenceContext, onWordTap]);

  // If color is 'transparent' (known word), use the reader theme text color
  const resolvedColor = color === 'transparent' ? textColor : color;

  return (
    <Text
      onPress={handlePress}
      color={resolvedColor || undefined}
      fontSize="$4"
    >
      {word}
    </Text>
  );
});
```

- [ ] **Step 2: Add `textColor` prop to `Fb2RendererItem` interface and pass through**

In `src/components/reader/Fb2Renderer.tsx`, update the `Fb2RendererItem` interface:

```typescript
export interface Fb2RendererItem {
  item: string | Fb2Paragraph;
  onWordTap: (word: string, sentence: string) => void;
  wordColors: Map<string, WordStatusValue>;
  fontSize?: number;
  lineHeight?: number;
  fontFamily?: string;
  textColor?: string;      // NEW
  backgroundColor?: string; // NEW (for future use)
}
```

- [ ] **Step 3: Add `textColor` to `InlineRendererProps` and pass to `WordTappable`**

Update `InlineRendererProps`:
```typescript
interface InlineRendererProps {
  inlines: Fb2Inline[];
  fullText: string;
  onWordTap: (word: string, sentence: string) => void;
  wordColors: Map<string, WordStatusValue>;
  fontSize?: number;
  fontFamily?: string;
  italic?: boolean;
  bold?: boolean;
  textColor?: string; // NEW
}
```

In `InlineRenderer`, destructure `textColor` and pass it to every `<WordTappable>`:
```typescript
function InlineRenderer({
  inlines, fullText, onWordTap, wordColors,
  fontSize, fontFamily, italic = false, bold = false,
  textColor, // NEW
}: InlineRendererProps): React.ReactElement {
```

In every `<WordTappable>` instance inside `InlineRenderer`, add:
```typescript
textColor={textColor}
```

There are two places where `WordTappable` is rendered:
1. Direct text tokens (around line 122)
2. Emphasis/strong child tokens (around line 155)

Also update the `<Text>` spacer elements to use `textColor` if provided:
```typescript
<Text key={`${inlineIndex}-${tokenIndex}-space`} fontSize={fontSize} color={textColor || undefined}>
  {token.trailing}
</Text>
```

- [ ] **Step 4: Pass `textColor` through `Fb2ItemRenderer`**

In `Fb2ItemRenderer`, destructure the new props:
```typescript
export function Fb2ItemRenderer({
  item, onWordTap, wordColors,
  fontSize = 16, lineHeight = 24, fontFamily,
  textColor,
}: Fb2RendererItem): React.ReactElement {
```

For section titles (string items), add `color`:
```typescript
if (typeof item === 'string') {
  return (
    <Text
      fontWeight="bold"
      fontSize={fontSize + 4}
      lineHeight={lineHeight + 6}
      fontFamily={fontFamily as any}
      paddingVertical="$3"
      paddingHorizontal="$4"
      color={textColor || undefined}
    >
      {item}
    </Text>
  );
}
```

For subtitles, add `color={textColor || undefined}`.

Pass `textColor` to every `<InlineRenderer>` call:
```typescript
<InlineRenderer
  inlines={paragraph.children}
  fullText={fullText}
  onWordTap={onWordTap}
  wordColors={wordColors}
  fontSize={fontSize}
  fontFamily={fontFamily}
  textColor={textColor}
/>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/WordTappable.tsx src/components/reader/Fb2Renderer.tsx
git commit -m "feat: add textColor prop to Fb2Renderer and WordTappable"
```

---

### Task 7: Update FB2 Reader to Use `useReaderTheme` + Fix SafeArea

**Files:**
- Modify: `src/components/reader/Fb2Reader.tsx`

**Context:** Currently `Fb2Reader` uses Tamagui `YStack` which inherits system theme colors, has hardcoded `paddingTop: 60` and `paddingBottom: 40`, and only supports vertical scroll.

- [ ] **Step 1: Add imports**

Add to `src/components/reader/Fb2Reader.tsx`:
```typescript
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReaderTheme } from '../../hooks/useReaderTheme';
```

Remove `YStack` from the `tamagui` import (it will no longer be used as the outer container).

- [ ] **Step 2: Add hook calls**

Inside the component, after `const settings = useSettingsStore();`, add:
```typescript
const readerTheme = useReaderTheme();
const insets = useSafeAreaInsets();
```

Define the TOP_BAR_HEIGHT constant at the top of the file (before the component):
```typescript
const TOP_BAR_HEIGHT = 44;
```

- [ ] **Step 3: Fix SafeArea padding**

Replace the hardcoded contentContainerStyle:
```typescript
// OLD:
contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40 }}

// NEW:
contentContainerStyle={{
  paddingHorizontal: 16,
  paddingTop: insets.top + TOP_BAR_HEIGHT,
  paddingBottom: insets.bottom,
}}
```

- [ ] **Step 4: Replace outer container with View + theme background**

Change the outer `YStack` wrapper to a `Pressable` with explicit backgroundColor:

```typescript
// OLD:
import { YStack } from 'tamagui';
// ...
return (
  <YStack flex={1} onPress={handleReaderPress}>
    <FlashList ... />
    ...
  </YStack>
);

// NEW:
import { View, StyleSheet, Pressable } from 'react-native';
// Remove the entire `import { YStack } from 'tamagui'` line (YStack is the only import from it).
// ...
return (
  <Pressable
    style={[styles.container, { backgroundColor: readerTheme.colors.background }]}
    onPress={handleReaderPress}
  >
    <FlashList ... />
    <ReaderTopBar ... />
    <TranslationPopup ... />
  </Pressable>
);
```

> **Important:** Do NOT use `View` with `onTouchEnd` — it fires during scrolls, causing unintended TopBar toggling. `Pressable.onPress` only fires for taps, not scrolls.

Add styles at bottom:
```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
```

- [ ] **Step 5: Pass textColor to Fb2ItemRenderer**

Update the `renderItem` callback to pass `textColor`:

```typescript
const renderItem = useCallback(
  ({ item }: { item: FlatItem }) => {
    if (item.type === 'section-title') {
      return (
        <Fb2ItemRenderer
          item={item.title}
          onWordTap={handleWordTap}
          wordColors={wordColors}
          fontSize={settings.fontSize}
          lineHeight={settings.lineHeight}
          fontFamily={settings.fontFamily}
          textColor={readerTheme.colors.text}
        />
      );
    }
    return (
      <Fb2ItemRenderer
        item={item.data}
        onWordTap={handleWordTap}
        wordColors={wordColors}
        fontSize={settings.fontSize}
        lineHeight={settings.lineHeight}
        fontFamily={settings.fontFamily}
        textColor={readerTheme.colors.text}
      />
    );
  },
  [handleWordTap, wordColors, settings.fontSize, settings.lineHeight, settings.fontFamily, readerTheme.colors.text],
);
```

- [ ] **Step 6: Commit**

```bash
git add src/components/reader/Fb2Reader.tsx
git commit -m "feat: FB2 reader uses useReaderTheme, fixes Dynamic Island overlap"
```

---

### Task 8: Update TopBar to Use `useReaderTheme`

**Files:**
- Modify: `src/components/reader/ReaderTopBar.tsx`

- [ ] **Step 1: Add import and hook call**

Add import:
```typescript
import { useReaderTheme } from '../../hooks/useReaderTheme';
```

Inside the component, add:
```typescript
const readerTheme = useReaderTheme();
```

- [ ] **Step 2: Replace Tamagui color tokens with theme colors**

Change:
```typescript
backgroundColor="$background"
```
to:
```typescript
backgroundColor={readerTheme.colors.topBarBg}
```

Change the title `<Text>` to have explicit color:
```typescript
<Text fontSize="$3" numberOfLines={1} flex={1} textAlign="center" marginHorizontal="$2" color={readerTheme.colors.text}>
```

Change progress text:
```typescript
<Text fontSize="$2" color={readerTheme.colors.textSecondary}>{Math.round(progress)}%</Text>
```

Change back arrow:
```typescript
<Text fontSize={18} color={readerTheme.colors.text}>←</Text>
```

Change settings icon:
```typescript
<Text fontSize={18} color={readerTheme.colors.text}>⚙</Text>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/reader/ReaderTopBar.tsx
git commit -m "feat: TopBar uses useReaderTheme for consistent colors"
```

---

### Task 9: Update TranslationPopup to Use `useReaderTheme`

**Files:**
- Modify: `src/components/reader/TranslationPopup.tsx`

- [ ] **Step 1: Add import and hook call**

Add import:
```typescript
import { useReaderTheme } from '../../hooks/useReaderTheme';
```

Inside the component, add:
```typescript
const readerTheme = useReaderTheme();
```

- [ ] **Step 2: Replace Tamagui color tokens**

On the main container YStack (line 140):
```typescript
// OLD:
backgroundColor="$popupBg"
// NEW:
backgroundColor={readerTheme.colors.popupBg}
```

For the word text:
```typescript
<Text fontSize={22} fontWeight="bold" color={readerTheme.colors.text}>{word}</Text>
```

For translation text:
```typescript
<Text fontSize={17} color={readerTheme.colors.text}>{result.translation}</Text>
```

For grammar text:
```typescript
<Text fontSize={13} color={readerTheme.colors.textSecondary}>{result.grammar}</Text>
```

For the sentence rendering function, replace `color="$textSecondary"`:
```typescript
const renderSentence = () => {
  const idx = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (idx === -1) return <Text fontSize={13} color={readerTheme.colors.textSecondary}>{sentence}</Text>;
  const before = sentence.slice(0, idx);
  const match = sentence.slice(idx, idx + word.length);
  const after = sentence.slice(idx + word.length);
  return (
    <Text fontSize={13} color={readerTheme.colors.textSecondary}>
      {before}<Text fontWeight="bold" color={readerTheme.colors.text}>{match}</Text>{after}
    </Text>
  );
};
```

For the drag handle:
```typescript
<YStack width={40} height={4} backgroundColor={readerTheme.colors.border} borderRadius="$2" opacity={0.5} />
```

For the `$borderColor` token on the separator/border YStack:
```typescript
// OLD:
borderColor="$borderColor"
// NEW:
borderColor={readerTheme.colors.border}
```

For the `$primary` accent color used on status buttons / active indicators:
```typescript
// OLD:
backgroundColor="$primary"
// or color="$primary"
// NEW:
backgroundColor="#6c63ff"
// or color="#6c63ff"
```

> **Note:** `$primary` is the app-wide accent color (`#6c63ff`). Since it's not theme-dependent (accent stays the same across reader themes), hardcoding is intentional. If a future task adds an `accent` property to `ReaderThemeDefinition`, replace this hardcoded value then.

For status label text:
```typescript
// OLD:
color="$color"
// NEW:
color={readerTheme.colors.text}

// OLD:
color="$textMuted"
// NEW:
color={readerTheme.colors.textSecondary}
```

For the word status circle fallback color (where `WORD_STATUS_COLORS[status]` returns `'transparent'` for known words):
```typescript
// OLD:
const bgColor = WORD_STATUS_COLORS[status] === 'transparent'
  ? '$borderColor'
  : WORD_STATUS_COLORS[status];

// NEW:
const bgColor = WORD_STATUS_COLORS[status] === 'transparent'
  ? readerTheme.colors.border
  : WORD_STATUS_COLORS[status];
```

- [ ] **Step 3: Commit**

```bash
git add src/components/reader/TranslationPopup.tsx
git commit -m "feat: TranslationPopup uses useReaderTheme for consistent colors"
```

---

## Chunk 3: UI Components — ReaderSettingsSheet + Settings Tab

### Task 10: Rewrite ReaderSettingsSheet

**Files:**
- Rewrite: `src/components/reader/ReaderSettingsSheet.tsx`

**Context:** Complete rewrite. New sheet has: font size A-/A+, 8 theme circles, auto day/night switch, paired theme row (opposite group when auto is ON).

- [ ] **Step 1: Rewrite the file**

```typescript
// src/components/reader/ReaderSettingsSheet.tsx

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text } from 'tamagui';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { useReaderTheme } from '../../hooks/useReaderTheme';
import {
  READER_THEMES,
  LIGHT_THEMES,
  DARK_THEMES,
  getThemeById,
} from '../../theme/readerThemes';
import type { ReaderThemeDefinition } from '../../theme/readerThemes';

interface ReaderSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

const ALL_THEMES = [...LIGHT_THEMES, ...DARK_THEMES];

function ThemeCircle({
  theme,
  isActive,
  onPress,
  borderColorForInactive,
}: {
  theme: ReaderThemeDefinition;
  isActive: boolean;
  onPress: () => void;
  borderColorForInactive: string;
}) {
  return (
    <Pressable onPress={onPress}>
      <View
        style={[
          styles.themeCircle,
          {
            backgroundColor: theme.preview,
            borderColor: isActive ? '#6c63ff' : borderColorForInactive,
            borderWidth: isActive ? 3 : 2,
          },
        ]}
      >
        {isActive && (
          <Text
            fontSize={14}
            color={theme.group === 'dark' ? '#FFFFFF' : '#333333'}
            style={styles.checkmark}
          >
            ✓
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function ReaderSettingsSheet({ visible, onClose }: ReaderSettingsSheetProps) {
  const settings = useSettingsStore();
  const readerTheme = useReaderTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(400);

  React.useEffect(() => {
    translateY.value = visible
      ? withSpring(0, { damping: 20 })
      : withTiming(400, { duration: 200 });
  }, [visible, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // ─── Font size handlers ───
  const handleFontDecrease = useCallback(() => {
    if (settings.fontSize > 14) {
      settings.setFontSize(settings.fontSize - 1);
    }
  }, [settings]);

  const handleFontIncrease = useCallback(() => {
    if (settings.fontSize < 28) {
      settings.setFontSize(settings.fontSize + 1);
    }
  }, [settings]);

  // ─── Theme selection ───
  const handleThemeSelect = useCallback(
    (themeId: string) => {
      const selected = getThemeById(themeId);

      // Update the appropriate theme slot
      if (selected.group === 'light') {
        settings.setLightThemeId(themeId);
      } else {
        settings.setDarkThemeId(themeId);
      }

      // Always track as manual selection
      settings.setManualThemeId(themeId);
    },
    [settings],
  );

  const handlePairedThemeSelect = useCallback(
    (themeId: string) => {
      const selected = getThemeById(themeId);
      if (selected.group === 'light') {
        settings.setLightThemeId(themeId);
      } else {
        settings.setDarkThemeId(themeId);
      }
    },
    [settings],
  );

  const handleAutoThemeToggle = useCallback(
    (value: boolean) => {
      settings.setAutoTheme(value);
    },
    [settings],
  );

  if (!visible) return null;

  // Determine active theme ID for the main row
  const activeThemeId = readerTheme.id;

  // Determine paired theme row
  const showPairedRow = settings.autoTheme;
  const pairedThemes = readerTheme.group === 'dark' ? LIGHT_THEMES : DARK_THEMES;
  const pairedLabel =
    readerTheme.group === 'dark'
      ? t('reader.settings.dayTheme')
      : t('reader.settings.nightTheme');
  const pairedActiveId =
    readerTheme.group === 'dark' ? settings.lightThemeId : settings.darkThemeId;

  const circleBorder = readerTheme.colors.border;

  return (
    <>
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
        />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={[styles.sheetContainer, animatedStyle]}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: readerTheme.colors.surface,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: readerTheme.colors.border }]} />
          </View>

          {/* Font size */}
          <View style={styles.row}>
            <Text fontSize={13} color={readerTheme.colors.textSecondary}>
              {t('reader.settings.fontSize')}
            </Text>
            <View style={styles.fontSizeControls}>
              <Pressable
                onPress={handleFontDecrease}
                style={[styles.fontButton, { backgroundColor: readerTheme.colors.background }]}
              >
                <Text fontSize={14} fontWeight="600" color={readerTheme.colors.text}>
                  A-
                </Text>
              </Pressable>
              <Text fontSize={15} fontWeight="500" color={readerTheme.colors.text}>
                {settings.fontSize}
              </Text>
              <Pressable
                onPress={handleFontIncrease}
                style={[styles.fontButton, { backgroundColor: readerTheme.colors.background }]}
              >
                <Text fontSize={18} fontWeight="600" color={readerTheme.colors.text}>
                  A+
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Theme label */}
          <Text
            fontSize={13}
            color={readerTheme.colors.textSecondary}
            style={styles.sectionLabel}
          >
            {t('reader.settings.theme')}
          </Text>

          {/* 8 theme circles */}
          <View style={styles.themesRow}>
            {ALL_THEMES.map((theme) => (
              <ThemeCircle
                key={theme.id}
                theme={theme}
                isActive={activeThemeId === theme.id}
                onPress={() => handleThemeSelect(theme.id)}
                borderColorForInactive={circleBorder}
              />
            ))}
          </View>

          {/* Auto day/night switch */}
          <View style={[styles.switchRow, { borderTopColor: readerTheme.colors.border }]}>
            <View>
              <Text fontSize={14} color={readerTheme.colors.text}>
                {t('reader.settings.autoTheme')}
              </Text>
              <Text fontSize={11} color={readerTheme.colors.textSecondary}>
                {t('reader.settings.autoThemeSubtitle')}
              </Text>
            </View>
            <Switch
              value={settings.autoTheme}
              onValueChange={handleAutoThemeToggle}
              trackColor={{ false: readerTheme.colors.border, true: '#6c63ff' }}
            />
          </View>

          {/* Paired theme row (visible only when auto is ON) */}
          {showPairedRow && (
            <View style={[styles.pairedSection, { borderTopColor: readerTheme.colors.border }]}>
              <Text
                fontSize={13}
                color={readerTheme.colors.textSecondary}
                style={styles.sectionLabel}
              >
                {pairedLabel}
              </Text>
              <View style={styles.themesRow}>
                {pairedThemes.map((theme) => (
                  <ThemeCircle
                    key={theme.id}
                    theme={theme}
                    isActive={pairedActiveId === theme.id}
                    onPress={() => handlePairedThemeSelect(theme.id)}
                    borderColorForInactive={circleBorder}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handleRow: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  fontSizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fontButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    marginBottom: 8,
  },
  themesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  themeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  pairedSection: {
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/reader/ReaderSettingsSheet.tsx
git commit -m "feat: rewrite ReaderSettingsSheet with 8 themes and auto day/night"
```

---

### Task 11: Wire Up ReaderSettingsSheet in Both Readers

**Files:**
- Modify: `src/components/reader/EpubReader.tsx`
- Modify: `src/components/reader/Fb2Reader.tsx`

**Context:** Both readers have `onSettingsPress={() => {/* TODO */}}`. Wire them to show/hide `ReaderSettingsSheet`.

- [ ] **Step 1: Wire settings sheet in EpubReader**

In `src/components/reader/EpubReader.tsx`:

Add import:
```typescript
import { ReaderSettingsSheet } from './ReaderSettingsSheet';
```

Add state:
```typescript
const [settingsVisible, setSettingsVisible] = useState(false);
```

Replace the TODO in onSettingsPress:
```typescript
<ReaderTopBar
  title={book.title}
  progress={progress}
  visible={topBarVisible}
  onSettingsPress={() => setSettingsVisible(true)}
/>
```

Add `<ReaderSettingsSheet>` inside the overlay View, after `<TranslationPopup>`:
```typescript
<ReaderSettingsSheet
  visible={settingsVisible}
  onClose={() => setSettingsVisible(false)}
/>
```

Also update `handlePress` (the tap handler that toggles TopBar) to skip when settings sheet is open:
```typescript
const handlePress = useCallback(() => {
  if (settingsVisible) return; // Don't toggle TopBar while settings sheet is open
  setTopBarVisible((prev) => !prev);
}, [settingsVisible]);
```

- [ ] **Step 2: Wire settings sheet in Fb2Reader**

In `src/components/reader/Fb2Reader.tsx`:

Add import:
```typescript
import { ReaderSettingsSheet } from './ReaderSettingsSheet';
```

Add state:
```typescript
const [settingsVisible, setSettingsVisible] = useState(false);
```

Replace the TODO in onSettingsPress:
```typescript
<ReaderTopBar
  title={book.title}
  progress={progress}
  visible={topBarVisible}
  onSettingsPress={() => setSettingsVisible(true)}
/>
```

Add `<ReaderSettingsSheet>` after `<TranslationPopup>`:
```typescript
<ReaderSettingsSheet
  visible={settingsVisible}
  onClose={() => setSettingsVisible(false)}
/>
```

Also update `handleReaderPress` to skip when settings sheet is open:
```typescript
const handleReaderPress = useCallback(() => {
  if (settingsVisible) return; // Don't toggle TopBar while settings sheet is open
  setTopBarVisible((prev) => !prev);
}, [settingsVisible]);
```

- [ ] **Step 3: Commit**

```bash
git add src/components/reader/EpubReader.tsx src/components/reader/Fb2Reader.tsx
git commit -m "feat: wire ReaderSettingsSheet in both EPUB and FB2 readers"
```

---

### Task 12: Rewrite Settings Tab Screen

**Files:**
- Rewrite: `app/(tabs)/settings.tsx`

**Context:** Currently a stub. Needs full settings screen with Reading section: day/night themes, auto switch, scroll mode, font size, font family, line height.

- [ ] **Step 1: Rewrite settings.tsx**

```typescript
// app/(tabs)/settings.tsx

import React from 'react';
import { ScrollView, Pressable, StyleSheet, Switch, View, useColorScheme } from 'react-native';
import { Text } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../src/stores/settingsStore';
import {
  LIGHT_THEMES,
  DARK_THEMES,
  getThemeById,
} from '../../src/theme/readerThemes';
import type { ReaderThemeDefinition } from '../../src/theme/readerThemes';

function ThemeCircle({
  theme,
  isActive,
  onPress,
  borderColorForInactive,
}: {
  theme: ReaderThemeDefinition;
  isActive: boolean;
  onPress: () => void;
  borderColorForInactive: string;
}) {
  const { t } = useTranslation();

  return (
    <Pressable onPress={onPress} style={styles.themeCircleWrapper}>
      <View
        style={[
          styles.themeCircle,
          {
            backgroundColor: theme.preview,
            borderColor: isActive ? '#6c63ff' : borderColorForInactive,
            borderWidth: isActive ? 3 : 2,
          },
        ]}
      >
        {isActive && (
          <Text
            fontSize={14}
            color={theme.group === 'dark' ? '#FFFFFF' : '#333333'}
          >
            ✓
          </Text>
        )}
      </View>
      <Text fontSize={10} color="$textSecondary" textAlign="center" numberOfLines={1}>
        {t(theme.nameKey)}
      </Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const settings = useSettingsStore();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Adaptive colors for Settings screen (follows system theme, NOT reader theme)
  const colors = {
    bg: isDark ? '#1c1c1e' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#8e8e93' : '#6b6b6b',
    surface: isDark ? '#2c2c2e' : '#f0f0f0',
    circleBorder: isDark ? '#555555' : '#cccccc',
  };

  const fontSizeStep = (delta: number) => {
    const next = settings.fontSize + delta;
    if (next >= 14 && next <= 28) {
      settings.setFontSize(next);
    }
  };

  const lineHeightStep = (delta: number) => {
    const next = Math.round((settings.lineHeight + delta) * 10) / 10;
    if (next >= 1.2 && next <= 2.0) {
      settings.setLineHeight(next);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text fontSize={24} fontWeight="bold" marginBottom={24} color={colors.text}>
          {t('settings.title')}
        </Text>

        {/* ─── Reading section ─── */}
        <Text fontSize={18} fontWeight="600" marginBottom={16} color={colors.text}>
          {t('settings.reading')}
        </Text>

        {/* Day theme */}
        <Text fontSize={14} color={colors.textSecondary} marginBottom={8}>
          {t('settings.dayTheme')}
        </Text>
        <View style={styles.themesRow}>
          {LIGHT_THEMES.map((theme) => (
            <ThemeCircle
              key={theme.id}
              theme={theme}
              isActive={settings.lightThemeId === theme.id}
              onPress={() => settings.setLightThemeId(theme.id)}
              borderColorForInactive={colors.circleBorder}
            />
          ))}
        </View>

        {/* Night theme */}
        <Text fontSize={14} color={colors.textSecondary} marginBottom={8} marginTop={8}>
          {t('settings.nightTheme')}
        </Text>
        <View style={styles.themesRow}>
          {DARK_THEMES.map((theme) => (
            <ThemeCircle
              key={theme.id}
              theme={theme}
              isActive={settings.darkThemeId === theme.id}
              onPress={() => settings.setDarkThemeId(theme.id)}
              borderColorForInactive={colors.circleBorder}
            />
          ))}
        </View>

        {/* Auto day/night */}
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text fontSize={16} color={colors.text}>{t('settings.autoTheme')}</Text>
            <Text fontSize={12} color={colors.textSecondary}>
              {t('settings.autoThemeSubtitle')}
            </Text>
          </View>
          <Switch
            value={settings.autoTheme}
            onValueChange={settings.setAutoTheme}
            trackColor={{ false: colors.circleBorder, true: '#6c63ff' }}
          />
        </View>

        {/* Scroll mode */}
        <Text fontSize={14} color={colors.textSecondary} marginBottom={8} marginTop={16}>
          {t('settings.scrollMode')}
        </Text>
        <View style={styles.segmentRow}>
          <Pressable
            style={[
              styles.segmentButton,
              { backgroundColor: colors.surface },
              settings.scrollMode === 'paginated' && styles.segmentActive,
            ]}
            onPress={() => settings.setScrollMode('paginated')}
          >
            <Text
              fontSize={14}
              color={settings.scrollMode === 'paginated' ? '#FFFFFF' : colors.text}
            >
              {t('settings.scrollModePaginated')}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segmentButton,
              { backgroundColor: colors.surface },
              settings.scrollMode === 'scroll' && styles.segmentActive,
            ]}
            onPress={() => settings.setScrollMode('scroll')}
          >
            <Text
              fontSize={14}
              color={settings.scrollMode === 'scroll' ? '#FFFFFF' : colors.text}
            >
              {t('settings.scrollModeScroll')}
            </Text>
          </Pressable>
        </View>

        {/* Font size */}
        <Text fontSize={14} color={colors.textSecondary} marginBottom={8} marginTop={16}>
          {t('settings.fontSize')}
        </Text>
        <View style={styles.stepperRow}>
          <Pressable style={[styles.stepperButton, { backgroundColor: colors.surface }]} onPress={() => fontSizeStep(-1)}>
            <Text fontSize={16} fontWeight="600" color={colors.text}>A-</Text>
          </Pressable>
          <Text fontSize={18} fontWeight="500" color={colors.text}>{settings.fontSize}</Text>
          <Pressable style={[styles.stepperButton, { backgroundColor: colors.surface }]} onPress={() => fontSizeStep(1)}>
            <Text fontSize={20} fontWeight="600" color={colors.text}>A+</Text>
          </Pressable>
        </View>

        {/* Font family */}
        <Text fontSize={14} color={colors.textSecondary} marginBottom={8} marginTop={16}>
          {t('settings.font')}
        </Text>
        <View style={styles.segmentRow}>
          {([
            { value: 'System', label: t('settings.fontSystem') },
            { value: 'Georgia', label: t('settings.fontSerif') },
            { value: 'sans-serif', label: t('settings.fontSansSerif') },
          ] as const).map(({ value, label }) => (
            <Pressable
              key={value}
              style={[
                styles.segmentButton,
                { backgroundColor: colors.surface },
                settings.fontFamily === value && styles.segmentActive,
              ]}
              onPress={() => settings.setFontFamily(value)}
            >
              <Text
                fontSize={14}
                color={settings.fontFamily === value ? '#FFFFFF' : colors.text}
                fontFamily={value as any}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Line height */}
        <Text fontSize={14} color={colors.textSecondary} marginBottom={8} marginTop={16}>
          {t('settings.lineHeight')}
        </Text>
        <View style={styles.stepperRow}>
          <Pressable style={[styles.stepperButton, { backgroundColor: colors.surface }]} onPress={() => lineHeightStep(-0.1)}>
            <Text fontSize={16} fontWeight="600" color={colors.text}>−</Text>
          </Pressable>
          <Text fontSize={18} fontWeight="500" color={colors.text}>{settings.lineHeight.toFixed(1)}</Text>
          <Pressable style={[styles.stepperButton, { backgroundColor: colors.surface }]} onPress={() => lineHeightStep(0.1)}>
            <Text fontSize={16} fontWeight="600" color={colors.text}>+</Text>
          </Pressable>
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  themesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  themeCircleWrapper: {
    alignItems: 'center',
    gap: 4,
    width: 44,
  },
  themeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  switchLabel: {
    flex: 1,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#6c63ff',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 8,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 2: Verify the import paths**

Since this is in `app/(tabs)/settings.tsx`, imports from `src/` must use `../../src/`:
- `../../src/stores/settingsStore`
- `../../src/theme/readerThemes`

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/settings.tsx
git commit -m "feat: rewrite Settings tab with full reading preferences"
```

---

## Chunk 4: FB2 Pagination Mode

### Task 13: Add Horizontal Pagination to FB2 Reader

**Files:**
- Modify: `src/components/reader/Fb2Reader.tsx`

**Context:** When `settings.scrollMode === 'paginated'`, FB2 should switch from vertical FlashList to horizontal `FlatList` with `pagingEnabled`. This requires measuring paragraph heights to group them into pages.

> **Note:** This is the most complex task. The pagination algorithm requires:
> 1. Measuring paragraph heights in a hidden container
> 2. Grouping paragraphs into pages
> 3. Rendering pages in a horizontal FlatList
> 4. Position saving/restoring across modes

- [ ] **Step 1: Add imports for FlatList and Dimensions**

Add to imports in `Fb2Reader.tsx`:
```typescript
import { View, StyleSheet, FlatList, useWindowDimensions } from 'react-native';
```

- [ ] **Step 2: Add pagination state and types**

Add type for a page:
```typescript
interface PageData {
  pageIndex: number;
  items: FlatItem[];
  firstParagraphIndex: number; // Index into the flat `items` array — for position saving
}
```

Add state inside the component:
```typescript
const { width: screenWidth, height: screenHeight } = useWindowDimensions();
const pageHeight = screenHeight - insets.top - TOP_BAR_HEIGHT - insets.bottom;

// Pagination state
const [pages, setPages] = useState<PageData[]>([]);
const [measureBatchIndex, setMeasureBatchIndex] = useState(0); // current batch being measured
const itemHeightsRef = useRef<Map<number, number>>(new Map()); // useRef to avoid O(N²) re-renders
const [measurementComplete, setMeasurementComplete] = useState(false);
const paginatedListRef = useRef<FlatList>(null);
const remeasureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const MEASURE_BATCH_SIZE = 50; // Measure ~50 paragraphs at a time per spec
```

- [ ] **Step 3: Create chunked measurement component**

Render items off-screen in batches of ~50 to measure heights, avoiding memory pressure on large books (per spec). Do NOT use `opacity: 0` — position off-screen only:

```typescript
// Calculate which batch of items to measure
const batchStart = measureBatchIndex * MEASURE_BATCH_SIZE;
const batchEnd = Math.min(batchStart + MEASURE_BATCH_SIZE, items.length);
const currentBatchItems = items.slice(batchStart, batchEnd);

// Track measurements for current batch
const batchMeasuredRef = useRef(0);

const handleItemLayout = useCallback(
  (globalIndex: number, height: number) => {
    itemHeightsRef.current.set(globalIndex, height);
    batchMeasuredRef.current += 1;

    // When current batch is fully measured, advance to next batch or finish
    if (batchMeasuredRef.current >= currentBatchItems.length) {
      batchMeasuredRef.current = 0;
      if (batchEnd >= items.length) {
        // All batches measured
        setMeasurementComplete(true);
      } else {
        // Advance to next batch
        setMeasureBatchIndex((prev) => prev + 1);
      }
    }
  },
  [currentBatchItems.length, batchEnd, items.length],
);

// Render items off-screen to measure heights (only during measurement phase)
const MeasureContainer = useMemo(() => {
  if (settings.scrollMode !== 'paginated' || measurementComplete) return null;
  if (items.length === 0) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: -9999,
        left: 0,
        width: screenWidth - 32, // account for paddingHorizontal
      }}
      pointerEvents="none"
    >
      {currentBatchItems.map((item, idx) => {
        const globalIndex = batchStart + idx;
        return (
          <View
            key={`measure-${globalIndex}`}
            onLayout={(event) => {
              handleItemLayout(globalIndex, event.nativeEvent.layout.height);
            }}
          >
            <Fb2ItemRenderer
              item={item.type === 'section-title' ? item.title : item.data}
              onWordTap={() => {}}
              wordColors={wordColors}
              fontSize={settings.fontSize}
              lineHeight={settings.lineHeight}
              fontFamily={settings.fontFamily}
              textColor={readerTheme.colors.text}
            />
          </View>
        );
      })}
    </View>
  );
}, [settings.scrollMode, measurementComplete, items.length, currentBatchItems, batchStart, screenWidth, wordColors, settings.fontSize, settings.lineHeight, settings.fontFamily, readerTheme.colors.text, handleItemLayout]);
```

- [ ] **Step 4: Build pages when all measurements are done**

Add effect to group into pages once measurement is complete:

```typescript
useEffect(() => {
  if (settings.scrollMode !== 'paginated') {
    setPages([]);
    return;
  }

  if (!measurementComplete || items.length === 0) return;

  // Group items into pages using measured heights
  const heights = itemHeightsRef.current;
  const builtPages: PageData[] = [];
  let currentItems: FlatItem[] = [];
  let currentHeight = 0;
  let pageIndex = 0;
  let pageStartIndex = 0;

  for (let i = 0; i < items.length; i++) {
    const h = heights.get(i) || 40;
    if (currentHeight + h > pageHeight && currentItems.length > 0) {
      builtPages.push({
        pageIndex,
        items: currentItems,
        firstParagraphIndex: pageStartIndex,
      });
      pageIndex++;
      pageStartIndex = i;
      currentItems = [items[i]];
      currentHeight = h;
    } else {
      currentItems.push(items[i]);
      currentHeight += h;
    }
  }
  if (currentItems.length > 0) {
    builtPages.push({
      pageIndex,
      items: currentItems,
      firstParagraphIndex: pageStartIndex,
    });
  }

  setPages(builtPages);
}, [measurementComplete, items, pageHeight, settings.scrollMode]);
```

- [ ] **Step 5: Render page component**

```typescript
const renderPage = useCallback(
  ({ item: page }: { item: PageData }) => {
    return (
      <View style={{ width: screenWidth, height: pageHeight, paddingHorizontal: 16 }}>
        {page.items.map((flatItem, idx) => (
          <Fb2ItemRenderer
            key={`${page.pageIndex}-${idx}`}
            item={flatItem.type === 'section-title' ? flatItem.title : flatItem.data}
            onWordTap={handleWordTap}
            wordColors={wordColors}
            fontSize={settings.fontSize}
            lineHeight={settings.lineHeight}
            fontFamily={settings.fontFamily}
            textColor={readerTheme.colors.text}
          />
        ))}
      </View>
    );
  },
  [screenWidth, pageHeight, handleWordTap, wordColors, settings.fontSize, settings.lineHeight, settings.fontFamily, readerTheme.colors.text],
);
```

- [ ] **Step 6: Update position saving for paginated mode**

Update the position saving logic to use `firstParagraphIndex` from PageData:

```typescript
const handlePageChange = useCallback(
  (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const pageIdx = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    const page = pages[pageIdx];
    if (page) {
      // Use pre-computed firstParagraphIndex for O(1) position tracking
      firstVisibleIndex.current = page.firstParagraphIndex;

      const pct = pages.length > 0 ? ((pageIdx + 1) / pages.length) * 100 : 0;
      setProgress(Math.min(100, pct));
      savePosition();
    }
  },
  [pages, screenWidth, savePosition],
);
```

- [ ] **Step 7: Find initial page from saved position**

```typescript
const initialPageIndex = useMemo(() => {
  if (settings.scrollMode !== 'paginated' || pages.length === 0) return 0;
  const savedIdx = initialScrollIndex;

  // Binary-search style: find the last page whose firstParagraphIndex <= savedIdx
  for (let p = pages.length - 1; p >= 0; p--) {
    if (pages[p].firstParagraphIndex <= savedIdx) {
      return p;
    }
  }
  return 0;
}, [pages, initialScrollIndex, settings.scrollMode]);
```

- [ ] **Step 8: Conditional render — FlashList (scroll) vs FlatList (paginated)**

Update the return JSX to conditionally render. This replaces the full return block from Task 7:

> **Note:** The outer `<Pressable>` with `handleReaderPress` was set up in Task 7. This step replaces the FlashList-only body with conditional scroll/paginated rendering.

```typescript
return (
  <Pressable
    style={[styles.container, { backgroundColor: readerTheme.colors.background }]}
    onPress={handleReaderPress}
  >
    {/* Measurement container (hidden, only during measurement phase) */}
    {MeasureContainer}

    {settings.scrollMode === 'scroll' ? (
      // Vertical scroll mode — existing FlashList
      <FlashList
        ref={listRef}
        data={items}
        renderItem={renderItem}
        {...{ estimatedItemSize: 80 } as any}
        getItemType={getItemType}
        keyExtractor={(_, index) => String(index)}
        onScroll={handleScroll}
        scrollEventThrottle={500}
        initialScrollIndex={initialScrollIndex > 0 ? initialScrollIndex : undefined}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 10 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: insets.top + TOP_BAR_HEIGHT,
          paddingBottom: insets.bottom,
        }}
      />
    ) : pages.length > 0 ? (
      // Paginated mode — horizontal FlatList
      <FlatList
        ref={paginatedListRef}
        data={pages}
        renderItem={renderPage}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(page) => String(page.pageIndex)}
        onMomentumScrollEnd={handlePageChange}
        initialScrollIndex={initialPageIndex > 0 ? initialPageIndex : undefined}
        getItemLayout={(_, index) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
        style={{ marginTop: insets.top + TOP_BAR_HEIGHT }}
      />
    ) : settings.scrollMode === 'paginated' && items.length > 0 ? (
      // Measuring phase — show loading
      <View style={styles.loadingContainer}>
        <Text color={readerTheme.colors.textSecondary}>{t('reader.loading')}</Text>
      </View>
    ) : null}

    <ReaderTopBar
      title={book.title}
      progress={progress}
      visible={topBarVisible}
      onSettingsPress={() => setSettingsVisible(true)}
    />
    <TranslationPopup
      visible={popupVisible}
      word={selectedWord}
      sentence={selectedSentence}
      bookLanguage={bookLanguage}
      nativeLanguage={nativeLanguage}
      isPhrase={false}
      onClose={handlePopupClose}
      onSave={handleSave}
      onStatusChange={handleStatusChange}
    />
    <ReaderSettingsSheet
      visible={settingsVisible}
      onClose={() => setSettingsVisible(false)}
    />
  </Pressable>
);
```

Add to the existing `styles` object (from Task 7):
```typescript
// Add this alongside the existing `container: { flex: 1 }` from Task 7:
loadingContainer: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
},
```

- [ ] **Step 9: Reset measurement when font/lineHeight/screen changes (debounced)**

Add debounced effect to re-measure when display settings or screen dimensions change:

```typescript
// Debounced re-measurement when display settings change in paginated mode
useEffect(() => {
  if (settings.scrollMode !== 'paginated') return;

  // Debounce re-measurement to avoid rapid re-renders when holding A-/A+ button
  if (remeasureTimerRef.current) {
    clearTimeout(remeasureTimerRef.current);
  }

  remeasureTimerRef.current = setTimeout(() => {
    setPages([]);
    itemHeightsRef.current = new Map();
    setMeasureBatchIndex(0);
    setMeasurementComplete(false);
  }, 300); // 300ms debounce

  return () => {
    if (remeasureTimerRef.current) {
      clearTimeout(remeasureTimerRef.current);
    }
  };
}, [settings.fontSize, settings.lineHeight, settings.fontFamily, screenWidth, screenHeight, settings.scrollMode]);
```

> **Why screen dimensions?** On device rotation, `screenWidth`/`screenHeight` change, which affects `pageHeight` and per-item widths. Paragraphs may wrap differently, requiring full re-measurement.

- [ ] **Step 10: Commit**

```bash
git add src/components/reader/Fb2Reader.tsx
git commit -m "feat: add horizontal pagination mode to FB2 reader"
```

---

### Task 14: Final Verification

- [ ] **Step 1: Type check the entire project**

```bash
npx tsc --noEmit 2>&1 | head -50
```

Expected: No errors. If there are errors, fix them.

- [ ] **Step 2: Run linter**

```bash
npx expo lint 2>&1 | head -30
```

Expected: No new lint errors.

- [ ] **Step 3: Run tests**

```bash
npx jest 2>&1 | tail -20
```

Expected: All existing tests pass.

- [ ] **Step 4: Manual smoke test**

Open the app in simulator:
```bash
npx expo start --ios
```

Test:
1. Open an EPUB book → should display with correct theme
2. Open FB2 book → should display with correct theme, no Dynamic Island overlap
3. Tap ⚙️ in TopBar → quick settings sheet opens with 8 themes
4. Tap different themes → instant switch
5. Toggle auto day/night → paired row appears/disappears
6. Go to Settings tab → full settings with all controls
7. Change scroll mode to "Pages" → FB2 should paginate horizontally
8. Change scroll mode to "Scroll" → FB2 returns to vertical scroll
9. Change system appearance (dark/light) → reader theme auto-switches

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address final issues from unified themes implementation"
```
