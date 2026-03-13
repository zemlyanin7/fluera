# Fluera Phase 0 + MVP Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the Expo project, validate two critical technical spikes (FB2 parser, OPDS catalog parser), then build the MVP foundation (project structure, database, themes, navigation, core services, translation pipeline). Epub reader spike and DeepSeek end-to-end integration spike are deferred to the next plan since they require device testing.

**Note:** WatermelonDB requires native modules. This plan uses `expo-dev-client` for development builds. Steps marked "verify app runs" require a simulator/device, not Expo Go.

**Architecture:** Expo Router file-based navigation, Zustand for client state, React Query for server state, WatermelonDB for offline-first persistence, Tamagui for themed UI components. Translation via DeepSeek V3.2 with Gemini fallback.

**Tech Stack:** React Native (Expo SDK 52+), TypeScript strict, Expo Router, Zustand, TanStack React Query, Tamagui, WatermelonDB, fast-xml-parser, @epubjs-react-native/core, i18next, Sentry, PostHog.

**Spec:** `docs/superpowers/specs/2026-03-13-fluera-design.md`

---

## File Structure

```
fluera/
├── app/
│   ├── _layout.tsx                    # Root layout: providers (Tamagui, QueryClient, i18n, DB)
│   ├── +not-found.tsx                 # 404 screen
│   ├── (tabs)/
│   │   ├── _layout.tsx                # Tab navigator (Library, Dictionary, Stats, Settings)
│   │   ├── index.tsx                  # Library screen
│   │   ├── dictionary.tsx             # Dictionary screen (placeholder for MVP foundation)
│   │   ├── stats.tsx                  # Stats screen (placeholder)
│   │   └── settings.tsx               # Settings screen
│   ├── reader/
│   │   └── [bookId].tsx               # Reader screen (routes to Epub or FB2 reader)
│   └── catalog/
│       ├── index.tsx                  # OPDS catalog list
│       └── [catalogId].tsx            # Single catalog browser
│
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   └── ScreenContainer.tsx    # Shared screen wrapper with safe area
│   │   ├── reader/
│   │   │   ├── EpubReader.tsx         # Epub WebView wrapper
│   │   │   ├── Fb2Reader.tsx          # FB2 native renderer
│   │   │   ├── TranslationPopup.tsx   # Translation bottom sheet
│   │   │   └── WordHighlighter.tsx    # Word status color overlay
│   │   ├── library/
│   │   │   ├── BookCard.tsx           # Book card component
│   │   │   ├── BookList.tsx           # Book list with FlatList
│   │   │   └── DifficultyBadge.tsx    # % unknown words badge
│   │   └── dictionary/
│   │       ├── WordCard.tsx           # Word entry card
│   │       └── WordStatusBadge.tsx    # Status color badge
│   │
│   ├── services/
│   │   ├── translation/
│   │   │   ├── TranslationService.ts  # Orchestrator: cache → primary → fallback
│   │   │   ├── DeepSeekProvider.ts    # DeepSeek V3.2 API client
│   │   │   ├── GeminiProvider.ts      # Gemini Flash-Lite API client
│   │   │   ├── TranslationCache.ts    # SQLite cache with LRU eviction
│   │   │   └── types.ts              # TranslationResult, TranslationProvider interfaces
│   │   ├── parser/
│   │   │   ├── Fb2Parser.ts           # FB2 XML → structured data
│   │   │   ├── Fb2Renderer.tsx        # Structured data → React Native components
│   │   │   ├── OpdsParser.ts          # OPDS Atom/XML → catalog entries
│   │   │   └── types.ts              # Fb2Book, Fb2Section, OpdsEntry, OpdsCatalog
│   │   └── sync/
│   │       └── SyncService.ts         # Backend sync (push/pull)
│   │
│   ├── stores/
│   │   ├── readerStore.ts             # Current book, position, font settings
│   │   ├── settingsStore.ts           # Language pair, theme, preferences
│   │   └── appStore.ts                # Auth state, online status
│   │
│   ├── db/
│   │   ├── schema.ts                  # WatermelonDB schema definition
│   │   ├── index.ts                   # Database initialization
│   │   ├── models/
│   │   │   ├── Book.ts
│   │   │   ├── Chapter.ts
│   │   │   ├── WordStatus.ts
│   │   │   ├── WordOccurrence.ts
│   │   │   ├── TranslationCacheEntry.ts
│   │   │   ├── OpdsCatalog.ts
│   │   │   ├── ReadingStats.ts
│   │   │   └── UserSettings.ts
│   │   └── migrations/
│   │       └── index.ts               # Migration definitions
│   │
│   ├── hooks/
│   │   ├── useTranslation.ts          # Translate word/phrase, manage loading state
│   │   ├── useWordStatus.ts           # Get/update word status for reader
│   │   ├── useBookProgress.ts         # Track reading position
│   │   └── useDatabase.ts             # DB provider hook
│   │
│   ├── i18n/
│   │   ├── config.ts                  # i18next initialization
│   │   └── locales/
│   │       ├── en.json
│   │       ├── ru.json
│   │       ├── pl.json
│   │       └── uk.json
│   │
│   ├── theme/
│   │   ├── config.ts                  # Tamagui config (tokens, themes)
│   │   ├── tokens.ts                  # Color, spacing, font tokens
│   │   └── themes.ts                  # light, dark, sepia theme definitions
│   │
│   └── utils/
│       ├── constants.ts               # API URLs, OPDS presets, limits
│       └── types.ts                   # Shared TypeScript types
│
├── __tests__/
│   ├── services/
│   │   ├── translation/
│   │   │   ├── TranslationService.test.ts
│   │   │   ├── DeepSeekProvider.test.ts
│   │   │   └── TranslationCache.test.ts
│   │   └── parser/
│   │       ├── Fb2Parser.test.ts
│   │       └── OpdsParser.test.ts
│   ├── db/
│   │   └── models.test.ts
│   └── hooks/
│       └── useTranslation.test.ts
│
├── assets/
│   └── fonts/                         # Custom fonts if needed
│
├── .env.example                       # Environment variable template
├── .gitignore
├── app.json                           # Expo config
├── babel.config.js
├── tamagui.config.ts                  # Tamagui entry point (re-exports src/theme/config)
├── tsconfig.json
├── package.json
├── CLAUDE.md
└── docs/
    └── superpowers/
        ├── specs/
        │   └── 2026-03-13-fluera-design.md
        └── plans/
            └── 2026-03-13-fluera-phase0-mvp.md
```

---

## Chunk 1: Project Initialization + Tamagui + Navigation

### Task 1: Initialize Expo Project

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create Expo project with TypeScript template**

```bash
cd /Users/andrei/development/Mobile/Fluera
npx create-expo-app@latest . --template blank-typescript --yes
```

This will scaffold the Expo project in the current directory. Since we already have files (docs, CLAUDE.md), it will merge.

- [ ] **Step 2: Verify project scaffolding works**

```bash
npx tsc --noEmit
```

Expected: No TypeScript errors. Full app verification with WatermelonDB requires `npx expo prebuild` and simulator testing (deferred to Task 12).

- [ ] **Step 3: Update tsconfig.json for decorators and strict mode**

Ensure `tsconfig.json` includes:
```json
{
  "compilerOptions": {
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": false
  }
}
```

- [ ] **Step 4: Update .gitignore for Expo**

Add to existing `.gitignore`:

```
node_modules/
.expo/
dist/
*.tsbuildinfo
.env
.env.local
web-build/
ios/
android/
```

- [ ] **Step 5: Update .env.example**

```bash
# LLM API Keys
DEEPSEEK_API_KEY=your_deepseek_key
GEMINI_API_KEY=your_gemini_key

# Backend
API_BASE_URL=http://localhost:3000/api/v1

# Analytics
SENTRY_DSN=
POSTHOG_API_KEY=
```

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json app.json babel.config.js .env.example .gitignore app/ && git commit -m "chore: initialize Expo project with TypeScript template"
```

---

### Task 2: Install Core Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Expo Router + navigation dependencies**

```bash
npx expo install expo-router expo-linking expo-constants expo-status-bar react-native-safe-area-context react-native-screens react-native-gesture-handler expo-dev-client
```

- [ ] **Step 2: Install Tamagui**

```bash
npx expo install @tamagui/core @tamagui/config @tamagui/themes @tamagui/font-inter @tamagui/animations-react-native
npx expo install tamagui
```

- [ ] **Step 3: Install state management + data fetching**

```bash
npm install zustand @tanstack/react-query
```

- [ ] **Step 4: Install i18n**

```bash
npm install i18next react-i18next
npx expo install expo-localization
```

- [ ] **Step 5: Install utilities**

```bash
npm install fast-xml-parser @epubjs-react-native/core
npx expo install expo-file-system expo-document-picker expo-crypto react-native-webview
```

- [ ] **Step 6: Install dev dependencies**

```bash
npm install -D @types/react @testing-library/react-native jest-expo @react-native-async-storage/async-storage
```

- [ ] **Step 7: Verify install succeeds**

```bash
npx expo doctor
```

Expected: No critical issues.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json && git commit -m "chore: install core dependencies (router, tamagui, zustand, i18n)"
```

---

### Task 3: Configure Tamagui Theme System

**Files:**
- Create: `src/theme/tokens.ts`, `src/theme/themes.ts`, `src/theme/config.ts`, `tamagui.config.ts`

- [ ] **Step 1: Create color and spacing tokens**

```typescript
// src/theme/tokens.ts
import { createTokens } from '@tamagui/core'

export const tokens = createTokens({
  color: {
    // Brand
    primary: '#6c63ff',
    primaryLight: '#8b83ff',
    primaryDark: '#5449e6',

    // Reader word status
    wordNew: '#4a90d9',
    wordLearning: '#f5c842',
    wordLearning70: 'rgba(245, 200, 66, 0.7)',
    wordLearning40: 'rgba(245, 200, 66, 0.4)',

    // Semantic
    success: '#4caf50',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',

    // Light theme
    lightBg: '#ffffff',
    lightSurface: '#f8f9fa',
    lightCard: '#ffffff',
    lightText: '#1a1a2e',
    lightTextSecondary: '#666666',
    lightTextMuted: '#999999',
    lightBorder: '#e5e7eb',

    // Dark theme
    darkBg: '#1a1a2e',
    darkSurface: '#2d2d4e',
    darkCard: '#2d2d4e',
    darkText: '#e0e0e0',
    darkTextSecondary: '#aaaaaa',
    darkTextMuted: '#666666',
    darkBorder: '#333333',

    // Sepia theme
    sepiaBg: '#f5f0e1',
    sepiaSurface: '#ece6d3',
    sepiaCard: '#ece6d3',
    sepiaText: '#5b4636',
    sepiaTextSecondary: '#7a6952',
    sepiaTextMuted: '#a08b6f',
    sepiaBorder: '#d4cbb8',

    // Translation popup
    popupBgLight: '#f3f0ff',
    popupBgDark: '#2d2d4e',
    popupBgSepia: '#ece6d3',
  },
  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
  },
  size: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
  },
  radius: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    full: 9999,
  },
  zIndex: {
    0: 0,
    1: 100,
    2: 200,
    5: 500,
  },
})
```

- [ ] **Step 2: Create theme definitions**

```typescript
// src/theme/themes.ts
export const lightTheme = {
  background: '#ffffff',
  backgroundHover: '#f8f9fa',
  backgroundPress: '#f0f0f0',
  backgroundFocus: '#f8f9fa',
  color: '#1a1a2e',
  colorHover: '#000000',
  colorPress: '#000000',
  colorFocus: '#1a1a2e',
  borderColor: '#e5e7eb',
  borderColorHover: '#d1d5db',
  shadowColor: 'rgba(0,0,0,0.1)',
  surface: '#f8f9fa',
  card: '#ffffff',
  textSecondary: '#666666',
  textMuted: '#999999',
  primary: '#6c63ff',
  primaryText: '#ffffff',
  popupBg: '#f3f0ff',
}

export const darkTheme = {
  background: '#1a1a2e',
  backgroundHover: '#2d2d4e',
  backgroundPress: '#1f1f3a',
  backgroundFocus: '#2d2d4e',
  color: '#e0e0e0',
  colorHover: '#ffffff',
  colorPress: '#ffffff',
  colorFocus: '#e0e0e0',
  borderColor: '#333333',
  borderColorHover: '#444444',
  shadowColor: 'rgba(0,0,0,0.3)',
  surface: '#2d2d4e',
  card: '#2d2d4e',
  textSecondary: '#aaaaaa',
  textMuted: '#666666',
  primary: '#6c63ff',
  primaryText: '#ffffff',
  popupBg: '#2d2d4e',
}

export const sepiaTheme = {
  background: '#f5f0e1',
  backgroundHover: '#ece6d3',
  backgroundPress: '#e3dcc8',
  backgroundFocus: '#ece6d3',
  color: '#5b4636',
  colorHover: '#3d2e22',
  colorPress: '#3d2e22',
  colorFocus: '#5b4636',
  borderColor: '#d4cbb8',
  borderColorHover: '#c4b8a2',
  shadowColor: 'rgba(91,70,54,0.1)',
  surface: '#ece6d3',
  card: '#ece6d3',
  textSecondary: '#7a6952',
  textMuted: '#a08b6f',
  primary: '#6c63ff',
  primaryText: '#ffffff',
  popupBg: '#ece6d3',
}
```

- [ ] **Step 3: Create Tamagui config**

```typescript
// src/theme/config.ts
import { createTamagui } from '@tamagui/core'
import { createInterFont } from '@tamagui/font-inter'
import { createAnimations } from '@tamagui/animations-react-native'
import { tokens } from './tokens'
import { lightTheme, darkTheme, sepiaTheme } from './themes'

const interFont = createInterFont()

const animations = createAnimations({
  fast: { type: 'spring', damping: 20, stiffness: 250 },
  medium: { type: 'spring', damping: 15, stiffness: 150 },
  slow: { type: 'spring', damping: 15, stiffness: 100 },
})

export const config = createTamagui({
  tokens,
  themes: {
    light: lightTheme,
    dark: darkTheme,
    sepia: sepiaTheme,
  },
  fonts: {
    heading: interFont,
    body: interFont,
  },
  animations,
})

export type AppConfig = typeof config

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends AppConfig {}
}
```

- [ ] **Step 4: Create tamagui.config.ts entry point**

```typescript
// tamagui.config.ts
export { config } from './src/theme/config'
export default config
```

- [ ] **Step 5: Commit**

```bash
git add src/theme/ tamagui.config.ts && git commit -m "feat: configure Tamagui theme system (light/dark/sepia)"
```

---

### Task 4: Configure Expo Router + Tab Navigation

**Files:**
- Create: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/dictionary.tsx`, `app/(tabs)/stats.tsx`, `app/(tabs)/settings.tsx`, `app/+not-found.tsx`
- Modify: `app.json`, `package.json` (main entry)

- [ ] **Step 1: Update app.json for Expo Router**

```json
{
  "expo": {
    "name": "Fluera",
    "slug": "fluera",
    "version": "0.1.0",
    "orientation": "portrait",
    "scheme": "fluera",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.fluera.app"
    },
    "android": {
      "package": "com.fluera.app",
      "adaptiveIcon": {
        "backgroundColor": "#6c63ff"
      }
    },
    "plugins": [
      "expo-router"
    ]
  }
}
```

- [ ] **Step 2: Update package.json main field**

Add to `package.json`:
```json
{
  "main": "expo-router/entry"
}
```

- [ ] **Step 3: Create root layout with providers**

```typescript
// app/_layout.tsx
import { Stack } from 'expo-router'
import { TamaguiProvider, Theme } from '@tamagui/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider'
import config from '../tamagui.config'
import { database } from '../src/db'
import '../src/i18n/config'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 2 },
  },
})

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const theme = colorScheme === 'dark' ? 'dark' : 'light'

  return (
    <DatabaseProvider database={database}>
      <TamaguiProvider config={config}>
        <Theme name={theme}>
          <QueryClientProvider client={queryClient}>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="reader/[bookId]" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="catalog" />
            </Stack>
          </QueryClientProvider>
        </Theme>
      </TamaguiProvider>
    </DatabaseProvider>
  )
}
```

- [ ] **Step 4: Create tab layout**

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router'
import { useTheme } from '@tamagui/core'

export default function TabLayout() {
  const theme = useTheme()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary.val,
        tabBarInactiveTintColor: theme.textMuted.val,
        tabBarStyle: {
          backgroundColor: theme.background.val,
          borderTopColor: theme.borderColor.val,
        },
        headerStyle: {
          backgroundColor: theme.background.val,
        },
        headerTintColor: theme.color.val,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Library', tabBarLabel: 'Library' }}
      />
      <Tabs.Screen
        name="dictionary"
        options={{ title: 'Dictionary', tabBarLabel: 'Dictionary' }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Stats', tabBarLabel: 'Stats' }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarLabel: 'Settings' }}
      />
    </Tabs>
  )
}
```

- [ ] **Step 5: Create placeholder tab screens**

```typescript
// app/(tabs)/index.tsx
import { YStack, Text } from 'tamagui'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function LibraryScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
        <Text fontSize="$8" fontWeight="bold">Library</Text>
        <Text color="$textSecondary" marginTop="$2">Your books will appear here</Text>
      </YStack>
    </SafeAreaView>
  )
}
```

```typescript
// app/(tabs)/dictionary.tsx
import { YStack, Text } from 'tamagui'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function DictionaryScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
        <Text fontSize="$8" fontWeight="bold">Dictionary</Text>
        <Text color="$textSecondary" marginTop="$2">Your words will appear here</Text>
      </YStack>
    </SafeAreaView>
  )
}
```

```typescript
// app/(tabs)/stats.tsx
import { YStack, Text } from 'tamagui'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function StatsScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
        <Text fontSize="$8" fontWeight="bold">Stats</Text>
        <Text color="$textSecondary" marginTop="$2">Coming in v2</Text>
      </YStack>
    </SafeAreaView>
  )
}
```

```typescript
// app/(tabs)/settings.tsx
import { YStack, Text } from 'tamagui'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function SettingsScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
        <Text fontSize="$8" fontWeight="bold">Settings</Text>
        <Text color="$textSecondary" marginTop="$2">Language, theme, account</Text>
      </YStack>
    </SafeAreaView>
  )
}
```

```typescript
// app/+not-found.tsx
import { Link, Stack } from 'expo-router'
import { YStack, Text } from 'tamagui'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
        <Text fontSize="$8">Page not found</Text>
        <Link href="/" style={{ marginTop: 16 }}>
          <Text color="$primary">Go to Library</Text>
        </Link>
      </YStack>
    </>
  )
}
```

- [ ] **Step 6: Verify TypeScript compiles with navigation**

```bash
npx tsc --noEmit
```

Expected: No TypeScript errors. Visual verification requires simulator (post-prebuild).

- [ ] **Step 7: Commit**

```bash
git add app/ app.json package.json && git commit -m "feat: configure Expo Router with tab navigation and placeholder screens"
```

---

### Task 5: Configure i18n

**Files:**
- Create: `src/i18n/config.ts`, `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`, `src/i18n/locales/uk.json`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Create locale files**

```json
// src/i18n/locales/en.json
{
  "tabs": {
    "library": "Library",
    "dictionary": "Dictionary",
    "stats": "Stats",
    "settings": "Settings"
  },
  "library": {
    "title": "Library",
    "empty": "Your books will appear here",
    "myBooks": "My Books",
    "catalogs": "Catalogs",
    "upload": "Upload"
  },
  "dictionary": {
    "title": "Dictionary",
    "empty": "Your words will appear here",
    "review": "Review",
    "exportAnki": "Export to Anki"
  },
  "reader": {
    "translation": {
      "loading": "Translating...",
      "error": "Could not translate. Check connection and try again.",
      "rateLimited": "Too many requests. Please wait a moment.",
      "addToDict": "Add to dictionary",
      "grammar": "Grammar",
      "tts": "Listen"
    },
    "wordStatus": {
      "new": "New",
      "recognized": "Recognized",
      "familiar": "Familiar",
      "learned": "Learned",
      "known": "Known"
    }
  },
  "settings": {
    "title": "Settings",
    "language": "Interface language",
    "bookLanguage": "Book language",
    "nativeLanguage": "Translation language",
    "theme": "Theme",
    "themes": {
      "light": "Light",
      "dark": "Dark",
      "sepia": "Sepia"
    }
  },
  "common": {
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "retry": "Retry"
  }
}
```

```json
// src/i18n/locales/ru.json
{
  "tabs": {
    "library": "Библиотека",
    "dictionary": "Словарь",
    "stats": "Статистика",
    "settings": "Настройки"
  },
  "library": {
    "title": "Библиотека",
    "empty": "Ваши книги появятся здесь",
    "myBooks": "Мои книги",
    "catalogs": "Каталоги",
    "upload": "Загрузить"
  },
  "dictionary": {
    "title": "Словарь",
    "empty": "Ваши слова появятся здесь",
    "review": "Повторить",
    "exportAnki": "Экспорт в Anki"
  },
  "reader": {
    "translation": {
      "loading": "Перевожу...",
      "error": "Не удалось перевести. Проверьте соединение и попробуйте снова.",
      "rateLimited": "Слишком много запросов. Подождите немного.",
      "addToDict": "В словарь",
      "grammar": "Грамматика",
      "tts": "Слушать"
    },
    "wordStatus": {
      "new": "Новое",
      "recognized": "Узнаю",
      "familiar": "Знакомое",
      "learned": "Выучено",
      "known": "Знаю"
    }
  },
  "settings": {
    "title": "Настройки",
    "language": "Язык интерфейса",
    "bookLanguage": "Язык книг",
    "nativeLanguage": "Язык перевода",
    "theme": "Тема",
    "themes": {
      "light": "Светлая",
      "dark": "Тёмная",
      "sepia": "Сепия"
    }
  },
  "common": {
    "cancel": "Отмена",
    "save": "Сохранить",
    "delete": "Удалить",
    "retry": "Повторить"
  }
}
```

```json
// src/i18n/locales/pl.json
{
  "tabs": {
    "library": "Biblioteka",
    "dictionary": "Słownik",
    "stats": "Statystyki",
    "settings": "Ustawienia"
  },
  "library": {
    "title": "Biblioteka",
    "empty": "Twoje książki pojawią się tutaj",
    "myBooks": "Moje książki",
    "catalogs": "Katalogi",
    "upload": "Wgraj"
  },
  "dictionary": {
    "title": "Słownik",
    "empty": "Twoje słowa pojawią się tutaj",
    "review": "Powtórz",
    "exportAnki": "Eksport do Anki"
  },
  "reader": {
    "translation": {
      "loading": "Tłumaczę...",
      "error": "Nie udało się przetłumaczyć. Sprawdź połączenie i spróbuj ponownie.",
      "rateLimited": "Zbyt wiele zapytań. Poczekaj chwilę.",
      "addToDict": "Do słownika",
      "grammar": "Gramatyka",
      "tts": "Posłuchaj"
    },
    "wordStatus": {
      "new": "Nowe",
      "recognized": "Rozpoznane",
      "familiar": "Znajome",
      "learned": "Wyuczone",
      "known": "Znane"
    }
  },
  "settings": {
    "title": "Ustawienia",
    "language": "Język interfejsu",
    "bookLanguage": "Język książek",
    "nativeLanguage": "Język tłumaczenia",
    "theme": "Motyw",
    "themes": {
      "light": "Jasny",
      "dark": "Ciemny",
      "sepia": "Sepia"
    }
  },
  "common": {
    "cancel": "Anuluj",
    "save": "Zapisz",
    "delete": "Usuń",
    "retry": "Ponów"
  }
}
```

```json
// src/i18n/locales/uk.json
{
  "tabs": {
    "library": "Бібліотека",
    "dictionary": "Словник",
    "stats": "Статистика",
    "settings": "Налаштування"
  },
  "library": {
    "title": "Бібліотека",
    "empty": "Ваші книги з'являться тут",
    "myBooks": "Мої книги",
    "catalogs": "Каталоги",
    "upload": "Завантажити"
  },
  "dictionary": {
    "title": "Словник",
    "empty": "Ваші слова з'являться тут",
    "review": "Повторити",
    "exportAnki": "Експорт в Anki"
  },
  "reader": {
    "translation": {
      "loading": "Перекладаю...",
      "error": "Не вдалося перекласти. Перевірте з'єднання та спробуйте знову.",
      "rateLimited": "Забагато запитів. Зачекайте трохи.",
      "addToDict": "До словника",
      "grammar": "Граматика",
      "tts": "Слухати"
    },
    "wordStatus": {
      "new": "Нове",
      "recognized": "Впізнаю",
      "familiar": "Знайоме",
      "learned": "Вивчено",
      "known": "Знаю"
    }
  },
  "settings": {
    "title": "Налаштування",
    "language": "Мова інтерфейсу",
    "bookLanguage": "Мова книг",
    "nativeLanguage": "Мова перекладу",
    "theme": "Тема",
    "themes": {
      "light": "Світла",
      "dark": "Темна",
      "sepia": "Сепія"
    }
  },
  "common": {
    "cancel": "Скасувати",
    "save": "Зберегти",
    "delete": "Видалити",
    "retry": "Повторити"
  }
}
```

- [ ] **Step 2: Create i18n config**

```typescript
// src/i18n/config.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import * as Localization from 'expo-localization'

import en from './locales/en.json'
import ru from './locales/ru.json'
import pl from './locales/pl.json'
import uk from './locales/uk.json'

const resources = { en: { translation: en }, ru: { translation: ru }, pl: { translation: pl }, uk: { translation: uk } }

const deviceLang = Localization.getLocales()[0]?.languageCode ?? 'en'
const supportedLang = Object.keys(resources).includes(deviceLang) ? deviceLang : 'en'

i18n.use(initReactI18next).init({
  resources,
  lng: supportedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
```

- [ ] **Step 3: Commit**

Note: i18n is already imported in root layout (`app/_layout.tsx`).

```bash
git add src/i18n/ && git commit -m "feat: configure i18n with 4 languages (en, ru, pl, uk)"
```

---

## Chunk 2: Database + Zustand Stores

### Task 6: Set Up WatermelonDB Schema and Models

**Files:**
- Create: `src/db/schema.ts`, `src/db/index.ts`, `src/db/models/Book.ts`, `src/db/models/Chapter.ts`, `src/db/models/WordStatus.ts`, `src/db/models/WordOccurrence.ts`, `src/db/models/TranslationCacheEntry.ts`, `src/db/models/OpdsCatalog.ts`, `src/db/models/ReadingStats.ts`, `src/db/models/UserSettings.ts`, `src/db/migrations/index.ts`

**Note:** WatermelonDB requires native module setup for React Native. Install:

- [ ] **Step 1: Install WatermelonDB**

```bash
npm install @nozbe/watermelondb
npm install -D @babel/plugin-proposal-decorators
```

Update `babel.config.js`:
```javascript
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [['@babel/plugin-proposal-decorators', { legacy: true }]],
  }
}
```

- [ ] **Step 2: Create database schema**

```typescript
// src/db/schema.ts
import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'books',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'author', type: 'string' },
        { name: 'language', type: 'string' },
        { name: 'format', type: 'string' },
        { name: 'file_path', type: 'string' },
        { name: 'cover_path', type: 'string', isOptional: true },
        { name: 'source', type: 'string' },
        { name: 'opds_url', type: 'string', isOptional: true },
        { name: 'progress', type: 'number' },
        { name: 'total_words', type: 'number' },
        { name: 'difficulty', type: 'number', isOptional: true },
        { name: 'added_at', type: 'number' },
        { name: 'last_read_at', type: 'number', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'chapters',
      columns: [
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'order_index', type: 'number' },
        { name: 'progress', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'word_statuses',
      columns: [
        { name: 'word', type: 'string', isIndexed: true },
        { name: 'book_language', type: 'string' },
        { name: 'native_language', type: 'string' },
        // Compound key for application-level uniqueness enforcement.
        // WatermelonDB lacks native compound unique indexes.
        // Before insert, query by word_lang_key to check existence.
        { name: 'word_lang_key', type: 'string', isIndexed: true },
        { name: 'status', type: 'number' },
        { name: 'translation', type: 'string' },
        { name: 'srs_interval', type: 'number' },
        { name: 'srs_ease_factor', type: 'number' },
        { name: 'srs_next_review', type: 'number', isOptional: true, isIndexed: true },
        { name: 'srs_repetitions', type: 'number' },
        { name: 'grammar_note', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'word_occurrences',
      columns: [
        { name: 'word_status_id', type: 'string', isIndexed: true },
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'chapter_title', type: 'string' },
        { name: 'context_sentence', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'translation_cache',
      columns: [
        { name: 'cache_key', type: 'string', isIndexed: true },
        { name: 'word', type: 'string' },
        { name: 'context', type: 'string' },
        { name: 'book_lang', type: 'string' },
        { name: 'native_lang', type: 'string' },
        { name: 'translation', type: 'string' },
        { name: 'grammar', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'opds_catalogs',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'url', type: 'string' },
        { name: 'catalog_type', type: 'string' },
        { name: 'last_fetched_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'reading_stats',
      columns: [
        { name: 'date', type: 'string', isIndexed: true },
        { name: 'book_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'words_read', type: 'number' },
        { name: 'words_learned', type: 'number' },
        { name: 'time_reading_sec', type: 'number' },
        { name: 'translations_made', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'user_settings',
      columns: [
        { name: 'native_language', type: 'string' },
        { name: 'book_language', type: 'string' },
        { name: 'theme', type: 'string' },
        { name: 'font_size', type: 'number' },
        { name: 'font_family', type: 'string' },
        { name: 'line_height', type: 'number' },
        { name: 'show_word_colors', type: 'boolean' },
      ],
    }),
  ],
})
```

- [ ] **Step 3: Create model classes**

```typescript
// src/db/models/Book.ts
import { Model } from '@nozbe/watermelondb'
import { field, date, children } from '@nozbe/watermelondb/decorators'

export class Book extends Model {
  static table = 'books'
  static associations = {
    chapters: { type: 'has_many' as const, foreignKey: 'book_id' },
    word_occurrences: { type: 'has_many' as const, foreignKey: 'book_id' },
    reading_stats: { type: 'has_many' as const, foreignKey: 'book_id' },
  }

  @field('title') title!: string
  @field('author') author!: string
  @field('language') language!: string
  @field('format') format!: string
  @field('file_path') filePath!: string
  @field('cover_path') coverPath!: string | null
  @field('source') source!: string
  @field('opds_url') opdsUrl!: string | null
  @field('progress') progress!: number
  @field('total_words') totalWords!: number
  @field('difficulty') difficulty!: number | null
  @date('added_at') addedAt!: Date
  @date('last_read_at') lastReadAt!: Date
}
```

```typescript
// src/db/models/Chapter.ts
import { Model } from '@nozbe/watermelondb'
import { field, relation } from '@nozbe/watermelondb/decorators'

export class Chapter extends Model {
  static table = 'chapters'
  static associations = {
    books: { type: 'belongs_to' as const, key: 'book_id' },
  }

  @field('book_id') bookId!: string
  @field('title') title!: string
  @field('order_index') orderIndex!: number
  @field('progress') progress!: number
}
```

```typescript
// src/db/models/WordStatus.ts
import { Model } from '@nozbe/watermelondb'
import { field, children } from '@nozbe/watermelondb/decorators'

export class WordStatus extends Model {
  static table = 'word_statuses'
  static associations = {
    word_occurrences: { type: 'has_many' as const, foreignKey: 'word_status_id' },
  }

  @field('word') word!: string
  @field('book_language') bookLanguage!: string
  @field('native_language') nativeLanguage!: string
  // Compound key: `${word.toLowerCase()}:${bookLanguage}:${nativeLanguage}`
  // Used for application-level uniqueness since WatermelonDB lacks compound unique indexes
  @field('word_lang_key') wordLangKey!: string
  @field('status') status!: number
  @field('translation') translation!: string
  @field('srs_interval') srsInterval!: number
  @field('srs_ease_factor') srsEaseFactor!: number
  @field('srs_next_review') srsNextReview!: number | null
  @field('srs_repetitions') srsRepetitions!: number
  @field('grammar_note') grammarNote!: string | null
  @field('created_at') createdAt!: number
  @field('updated_at') updatedAt!: number

  static buildWordLangKey(word: string, bookLang: string, nativeLang: string): string {
    return `${word.toLowerCase()}:${bookLang}:${nativeLang}`
  }
}
```

```typescript
// src/db/models/WordOccurrence.ts
import { Model } from '@nozbe/watermelondb'
import { field, relation } from '@nozbe/watermelondb/decorators'

export class WordOccurrence extends Model {
  static table = 'word_occurrences'
  static associations = {
    word_statuses: { type: 'belongs_to' as const, key: 'word_status_id' },
    books: { type: 'belongs_to' as const, key: 'book_id' },
  }

  @field('word_status_id') wordStatusId!: string
  @field('book_id') bookId!: string
  @field('chapter_title') chapterTitle!: string
  @field('context_sentence') contextSentence!: string
  @field('created_at') createdAt!: number
}
```

```typescript
// src/db/models/TranslationCacheEntry.ts
import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export class TranslationCacheEntry extends Model {
  static table = 'translation_cache'

  @field('cache_key') cacheKey!: string
  @field('word') word!: string
  @field('context') context!: string
  @field('book_lang') bookLang!: string
  @field('native_lang') nativeLang!: string
  @field('translation') translation!: string
  @field('grammar') grammar!: string | null
  @field('created_at') createdAt!: number
}
```

```typescript
// src/db/models/OpdsCatalog.ts
import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export class OpdsCatalog extends Model {
  static table = 'opds_catalogs'

  @field('name') name!: string
  @field('url') url!: string
  @field('catalog_type') catalogType!: string
  @field('last_fetched_at') lastFetchedAt!: number | null
}
```

```typescript
// src/db/models/ReadingStats.ts
import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export class ReadingStats extends Model {
  static table = 'reading_stats'

  @field('date') date!: string
  @field('book_id') bookId!: string | null
  @field('words_read') wordsRead!: number
  @field('words_learned') wordsLearned!: number
  @field('time_reading_sec') timeReadingSec!: number
  @field('translations_made') translationsMade!: number
}
```

```typescript
// src/db/models/UserSettings.ts
import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export class UserSettings extends Model {
  static table = 'user_settings'

  @field('native_language') nativeLanguage!: string
  @field('book_language') bookLanguage!: string
  @field('theme') theme!: string
  @field('font_size') fontSize!: number
  @field('font_family') fontFamily!: string
  @field('line_height') lineHeight!: number
  @field('show_word_colors') showWordColors!: boolean
}
```

- [ ] **Step 4: Create database initialization**

```typescript
// src/db/index.ts
import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { schema } from './schema'
import { Book } from './models/Book'
import { Chapter } from './models/Chapter'
import { WordStatus } from './models/WordStatus'
import { WordOccurrence } from './models/WordOccurrence'
import { TranslationCacheEntry } from './models/TranslationCacheEntry'
import { OpdsCatalog } from './models/OpdsCatalog'
import { ReadingStats } from './models/ReadingStats'
import { UserSettings } from './models/UserSettings'

const adapter = new SQLiteAdapter({
  schema,
  jsi: true,
  onSetUpError: (error) => {
    console.error('Database setup error:', error)
  },
})

export const database = new Database({
  adapter,
  modelClasses: [
    Book,
    Chapter,
    WordStatus,
    WordOccurrence,
    TranslationCacheEntry,
    OpdsCatalog,
    ReadingStats,
    UserSettings,
  ],
})
```

```typescript
// src/db/migrations/index.ts
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations'

export const migrations = schemaMigrations({ migrations: [] })
```

- [ ] **Step 5: Commit**

```bash
git add src/db/ babel.config.js && git commit -m "feat: set up WatermelonDB schema with all MVP models"
```

---

### Task 7: Create Zustand Stores

**Files:**
- Create: `src/stores/settingsStore.ts`, `src/stores/readerStore.ts`, `src/stores/appStore.ts`

- [ ] **Step 1: Create settings store**

```typescript
// src/stores/settingsStore.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ReaderTheme } from '../utils/types'

interface SettingsState {
  nativeLanguage: string
  bookLanguage: string
  readerTheme: ReaderTheme
  fontSize: number
  fontFamily: string
  lineHeight: number
  showWordColors: boolean

  setNativeLanguage: (lang: string) => void
  setBookLanguage: (lang: string) => void
  setReaderTheme: (theme: ReaderTheme) => void
  setFontSize: (size: number) => void
  setShowWordColors: (show: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      nativeLanguage: 'ru',
      bookLanguage: 'en',
      readerTheme: 'dark',
      fontSize: 18,
      fontFamily: 'Georgia',
      lineHeight: 1.8,
      showWordColors: true,

      setNativeLanguage: (lang) => set({ nativeLanguage: lang }),
      setBookLanguage: (lang) => set({ bookLanguage: lang }),
      setReaderTheme: (theme) => set({ readerTheme: theme }),
      setFontSize: (size) => set({ fontSize: size }),
      setShowWordColors: (show) => set({ showWordColors: show }),
    }),
    {
      name: 'fluera-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
```

- [ ] **Step 2: Create reader store**

```typescript
// src/stores/readerStore.ts
import { create } from 'zustand'

interface ReaderState {
  currentBookId: string | null
  currentChapter: number
  scrollPosition: number
  isTranslationOpen: boolean
  selectedWord: string | null
  selectedPhrase: string | null
  selectedSentence: string | null

  openBook: (bookId: string) => void
  closeBook: () => void
  setChapter: (chapter: number) => void
  setScrollPosition: (position: number) => void
  selectWord: (word: string, sentence: string) => void
  selectPhrase: (phrase: string, sentence: string) => void
  clearSelection: () => void
}

export const useReaderStore = create<ReaderState>((set) => ({
  currentBookId: null,
  currentChapter: 0,
  scrollPosition: 0,
  isTranslationOpen: false,
  selectedWord: null,
  selectedPhrase: null,
  selectedSentence: null,

  openBook: (bookId) => set({ currentBookId: bookId, currentChapter: 0, scrollPosition: 0 }),
  closeBook: () => set({ currentBookId: null, selectedWord: null, selectedPhrase: null, isTranslationOpen: false }),
  setChapter: (chapter) => set({ currentChapter: chapter }),
  setScrollPosition: (position) => set({ scrollPosition: position }),
  selectWord: (word, sentence) => set({ selectedWord: word, selectedPhrase: null, selectedSentence: sentence, isTranslationOpen: true }),
  selectPhrase: (phrase, sentence) => set({ selectedWord: null, selectedPhrase: phrase, selectedSentence: sentence, isTranslationOpen: true }),
  clearSelection: () => set({ selectedWord: null, selectedPhrase: null, selectedSentence: null, isTranslationOpen: false }),
}))
```

- [ ] **Step 3: Create app store**

```typescript
// src/stores/appStore.ts
import { create } from 'zustand'

interface AppState {
  isAuthenticated: boolean
  userId: string | null
  isOnline: boolean

  setAuth: (userId: string) => void
  clearAuth: () => void
  setOnline: (online: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: false,
  userId: null,
  isOnline: true,

  setAuth: (userId) => set({ isAuthenticated: true, userId }),
  clearAuth: () => set({ isAuthenticated: false, userId: null }),
  setOnline: (online) => set({ isOnline: online }),
}))
```

- [ ] **Step 4: Commit**

```bash
git add src/stores/ && git commit -m "feat: create Zustand stores (settings, reader, app)"
```

---

## Chunk 3: Phase 0 Spikes — FB2 Parser + OPDS Parser

> **Scope note:** This plan covers 2 of 4 Phase 0 spikes (FB2 parser, OPDS parser). The epub reader spike requires device testing (@epubjs-react-native/core in WebView) and the DeepSeek end-to-end spike requires API key and network access. Both are deferred to the next plan which builds on this foundation.

### Task 8: FB2 Parser Service

**Files:**
- Create: `src/services/parser/types.ts`, `src/services/parser/Fb2Parser.ts`
- Create: `__tests__/services/parser/Fb2Parser.test.ts`

- [ ] **Step 1: Create parser types**

```typescript
// src/services/parser/types.ts
export interface Fb2Book {
  title: string
  author: string
  lang: string
  annotation: string | null
  coverBase64: string | null
  sections: Fb2Section[]
}

export interface Fb2Section {
  title: string | null
  paragraphs: Fb2Paragraph[]
}

export interface Fb2Paragraph {
  type: 'p' | 'title' | 'subtitle' | 'epigraph' | 'poem' | 'stanza' | 'v' | 'cite' | 'annotation' | 'empty-line'
  children: Fb2Inline[]
}

export interface Fb2Inline {
  type: 'text' | 'emphasis' | 'strong' | 'link' | 'image'
  text?: string
  href?: string
  imageId?: string
  children?: Fb2Inline[]
}

export interface OpdsEntry {
  id: string
  title: string
  author: string | null
  summary: string | null
  language: string | null
  coverUrl: string | null
  downloadLinks: OpdsLink[]
  updated: string | null
}

export interface OpdsLink {
  href: string
  type: string
  rel: string | null
}

export interface OpdsCatalogData {
  title: string
  entries: OpdsEntry[]
  nextUrl: string | null
}
```

- [ ] **Step 2: Write failing FB2 parser test**

```typescript
// __tests__/services/parser/Fb2Parser.test.ts
import { Fb2Parser } from '../../../src/services/parser/Fb2Parser'

const SAMPLE_FB2 = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <genre>fiction</genre>
      <author><first-name>Jane</first-name><last-name>Austen</last-name></author>
      <book-title>Pride and Prejudice</book-title>
      <lang>en</lang>
      <annotation><p>A classic novel.</p></annotation>
    </title-info>
  </description>
  <body>
    <section>
      <title><p>Chapter 1</p></title>
      <p>It is a truth universally acknowledged, that a <emphasis>single man</emphasis> in possession of a good fortune, must be in want of a wife.</p>
      <p>However little known the feelings or views of such a man may be.</p>
    </section>
  </body>
</FictionBook>`

describe('Fb2Parser', () => {
  it('parses book metadata', () => {
    const book = Fb2Parser.parse(SAMPLE_FB2)
    expect(book.title).toBe('Pride and Prejudice')
    expect(book.author).toBe('Jane Austen')
    expect(book.lang).toBe('en')
  })

  it('parses sections and paragraphs', () => {
    const book = Fb2Parser.parse(SAMPLE_FB2)
    expect(book.sections).toHaveLength(1)
    expect(book.sections[0].title).toBe('Chapter 1')
    expect(book.sections[0].paragraphs).toHaveLength(2)
  })

  it('parses inline formatting (emphasis)', () => {
    const book = Fb2Parser.parse(SAMPLE_FB2)
    const firstPara = book.sections[0].paragraphs[0]
    const emphasisChild = firstPara.children.find(c => c.type === 'emphasis')
    expect(emphasisChild).toBeDefined()
    expect(emphasisChild!.text).toBe('single man')
  })

  it('throws on invalid XML', () => {
    expect(() => Fb2Parser.parse('not xml')).toThrow()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest __tests__/services/parser/Fb2Parser.test.ts --no-cache
```

Expected: FAIL — cannot find module `Fb2Parser`

- [ ] **Step 4: Implement FB2 parser**

```typescript
// src/services/parser/Fb2Parser.ts
import { XMLParser } from 'fast-xml-parser'
import type { Fb2Book, Fb2Section, Fb2Paragraph, Fb2Inline } from './types'

// Use a non-ordered parser for metadata extraction (simpler)
const metaParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => ['section', 'p', 'binary'].includes(name),
})

// Use preserveOrder parser for body content to maintain mixed content order
const bodyParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  preserveOrder: true,
})

// Tag names that map to FB2 paragraph-level types
const BLOCK_TAGS = new Set(['p', 'subtitle', 'epigraph', 'poem', 'stanza', 'v', 'cite', 'annotation', 'empty-line'])
const INLINE_TAGS = new Set(['emphasis', 'strong', 'a', 'image'])

export class Fb2Parser {
  static parse(xml: string): Fb2Book {
    const metaDoc = metaParser.parse(xml)
    const metaFb = metaDoc.FictionBook
    if (!metaFb) throw new Error('Invalid FB2: missing FictionBook root element')

    const titleInfo = metaFb.description?.['title-info']

    // Parse body with order-preserving parser for correct inline ordering
    const orderedDoc = bodyParser.parse(xml)
    const fbNode = orderedDoc.find((n: Record<string, unknown>) => 'FictionBook' in n)
    const fbChildren = fbNode?.FictionBook ?? []
    const bodyNode = fbChildren.find((n: Record<string, unknown>) => 'body' in n)
    const bodyChildren = bodyNode?.body ?? []

    return {
      title: titleInfo?.['book-title'] ?? 'Untitled',
      author: Fb2Parser.parseAuthor(titleInfo?.author),
      lang: titleInfo?.lang ?? 'unknown',
      annotation: Fb2Parser.extractMetaText(titleInfo?.annotation?.p),
      coverBase64: Fb2Parser.findCover(metaFb),
      sections: Fb2Parser.parseSectionsOrdered(bodyChildren),
    }
  }

  private static parseAuthor(author: Record<string, string> | undefined): string {
    if (!author) return 'Unknown'
    const first = author['first-name'] ?? ''
    const last = author['last-name'] ?? ''
    return `${first} ${last}`.trim() || 'Unknown'
  }

  private static extractMetaText(node: unknown): string | null {
    if (!node) return null
    if (typeof node === 'string') return node
    if (Array.isArray(node)) return node.map(n => Fb2Parser.extractMetaText(n)).join(' ')
    if (typeof node === 'object' && node !== null && '#text' in node) {
      return (node as Record<string, string>)['#text']
    }
    return null
  }

  private static findCover(fb: Record<string, unknown>): string | null {
    const binaries = fb.binary as Record<string, string>[] | Record<string, string> | undefined
    if (!binaries) return null
    const arr = Array.isArray(binaries) ? binaries : [binaries]
    const coverBin = arr.find((b) => b['@_id']?.includes('cover'))
    return coverBin?.['#text'] ?? null
  }

  private static parseSectionsOrdered(nodes: Record<string, unknown>[]): Fb2Section[] {
    return nodes
      .filter((n) => 'section' in n)
      .map((sectionNode) => {
        const children = (sectionNode.section ?? []) as Record<string, unknown>[]
        const titleNode = children.find((c) => 'title' in c)
        let title: string | null = null
        if (titleNode) {
          const titleChildren = (titleNode.title ?? []) as Record<string, unknown>[]
          const pNode = titleChildren.find((c) => 'p' in c)
          if (pNode) {
            title = Fb2Parser.extractOrderedText((pNode.p ?? []) as Record<string, unknown>[])
          }
        }
        return {
          title,
          paragraphs: Fb2Parser.parseBlockElements(children),
        }
      })
  }

  private static parseBlockElements(nodes: Record<string, unknown>[]): Fb2Paragraph[] {
    const paragraphs: Fb2Paragraph[] = []
    for (const node of nodes) {
      for (const tag of BLOCK_TAGS) {
        if (tag in node) {
          paragraphs.push({
            type: tag as Fb2Paragraph['type'],
            children: Fb2Parser.parseInlinesOrdered(
              (node[tag] ?? []) as Record<string, unknown>[]
            ),
          })
        }
      }
    }
    return paragraphs
  }

  private static parseInlinesOrdered(nodes: Record<string, unknown>[]): Fb2Inline[] {
    const inlines: Fb2Inline[] = []
    for (const node of nodes) {
      if ('#text' in node) {
        inlines.push({ type: 'text', text: String(node['#text']) })
      }
      if ('emphasis' in node) {
        const emChildren = (node.emphasis ?? []) as Record<string, unknown>[]
        inlines.push({
          type: 'emphasis',
          text: Fb2Parser.extractOrderedText(emChildren),
        })
      }
      if ('strong' in node) {
        const strChildren = (node.strong ?? []) as Record<string, unknown>[]
        inlines.push({
          type: 'strong',
          text: Fb2Parser.extractOrderedText(strChildren),
        })
      }
      if ('a' in node) {
        const attrs = (node[':@'] ?? {}) as Record<string, string>
        const linkChildren = (node.a ?? []) as Record<string, unknown>[]
        inlines.push({
          type: 'link',
          text: Fb2Parser.extractOrderedText(linkChildren),
          href: attrs['@_href'] ?? attrs['@_l:href'] ?? '',
        })
      }
      if ('image' in node) {
        const attrs = (node[':@'] ?? {}) as Record<string, string>
        inlines.push({
          type: 'image',
          imageId: attrs['@_l:href']?.replace('#', '') ?? '',
        })
      }
    }
    return inlines
  }

  private static extractOrderedText(nodes: Record<string, unknown>[]): string {
    return nodes
      .filter((n) => '#text' in n)
      .map((n) => String(n['#text']))
      .join('')
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest __tests__/services/parser/Fb2Parser.test.ts --no-cache
```

Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/parser/ __tests__/services/parser/Fb2Parser.test.ts && git commit -m "feat: implement FB2 parser with fast-xml-parser"
```

---

### Task 9: OPDS Parser Service

**Files:**
- Create: `src/services/parser/OpdsParser.ts`
- Create: `__tests__/services/parser/OpdsParser.test.ts`

- [ ] **Step 1: Write failing OPDS parser test**

```typescript
// __tests__/services/parser/OpdsParser.test.ts
import { OpdsParser } from '../../../src/services/parser/OpdsParser'

const SAMPLE_OPDS = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
  <title>Project Gutenberg</title>
  <entry>
    <id>urn:gutenberg:book:1342</id>
    <title>Pride and Prejudice</title>
    <author><name>Jane Austen</name></author>
    <summary>A classic novel of manners.</summary>
    <updated>2024-01-01T00:00:00Z</updated>
    <link rel="http://opds-spec.org/acquisition" type="application/epub+zip" href="/books/1342.epub"/>
    <link rel="http://opds-spec.org/image" type="image/jpeg" href="/covers/1342.jpg"/>
  </entry>
  <link rel="next" type="application/atom+xml" href="/catalog?page=2"/>
</feed>`

describe('OpdsParser', () => {
  it('parses catalog title', () => {
    const catalog = OpdsParser.parse(SAMPLE_OPDS)
    expect(catalog.title).toBe('Project Gutenberg')
  })

  it('parses entries', () => {
    const catalog = OpdsParser.parse(SAMPLE_OPDS)
    expect(catalog.entries).toHaveLength(1)
    expect(catalog.entries[0].title).toBe('Pride and Prejudice')
    expect(catalog.entries[0].author).toBe('Jane Austen')
  })

  it('parses download links', () => {
    const catalog = OpdsParser.parse(SAMPLE_OPDS)
    const entry = catalog.entries[0]
    expect(entry.downloadLinks).toHaveLength(1)
    expect(entry.downloadLinks[0].type).toBe('application/epub+zip')
    expect(entry.downloadLinks[0].href).toBe('/books/1342.epub')
  })

  it('parses cover URL', () => {
    const catalog = OpdsParser.parse(SAMPLE_OPDS)
    expect(catalog.entries[0].coverUrl).toBe('/covers/1342.jpg')
  })

  it('parses pagination (next link)', () => {
    const catalog = OpdsParser.parse(SAMPLE_OPDS)
    expect(catalog.nextUrl).toBe('/catalog?page=2')
  })

  it('throws on invalid XML', () => {
    expect(() => OpdsParser.parse('not xml at all')).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/services/parser/OpdsParser.test.ts --no-cache
```

Expected: FAIL

- [ ] **Step 3: Implement OPDS parser**

```typescript
// src/services/parser/OpdsParser.ts
import { XMLParser } from 'fast-xml-parser'
import type { OpdsCatalogData, OpdsEntry, OpdsLink } from './types'

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => ['entry', 'link'].includes(name),
})

interface OpdsRawLink {
  '@_rel'?: string
  '@_href'?: string
  '@_type'?: string
}

interface OpdsRawEntry {
  id?: string
  title?: string
  author?: { name?: string }
  summary?: string
  'dc:language'?: string
  link?: OpdsRawLink[]
  updated?: string
}

export class OpdsParser {
  static parse(xml: string): OpdsCatalogData {
    const doc = xmlParser.parse(xml)
    const feed = doc.feed
    if (!feed) throw new Error('Invalid OPDS: missing feed root element')

    const entries = ((feed.entry ?? []) as OpdsRawEntry[]).map(OpdsParser.parseEntry)
    const nextLink = OpdsParser.findNextLink((feed.link ?? []) as OpdsRawLink[])

    return {
      title: feed.title ?? 'Catalog',
      entries,
      nextUrl: nextLink,
    }
  }

  private static parseEntry(entry: OpdsRawEntry): OpdsEntry {
    const links: OpdsRawLink[] = entry.link ?? []
    const downloadLinks: OpdsLink[] = links
      .filter((l) => l['@_rel']?.includes('acquisition'))
      .map((l) => ({
        href: l['@_href'] ?? '',
        type: l['@_type'] ?? 'application/octet-stream',
        rel: l['@_rel'] ?? null,
      }))

    const coverLink = links.find(
      (l) => l['@_rel']?.includes('image') || l['@_rel']?.includes('thumbnail')
    )

    return {
      id: entry.id ?? '',
      title: entry.title ?? 'Untitled',
      author: entry.author?.name ?? null,
      summary: entry.summary ?? null,
      language: entry['dc:language'] ?? null,
      coverUrl: coverLink?.['@_href'] ?? null,
      downloadLinks,
      updated: entry.updated ?? null,
    }
  }

  private static findNextLink(links: OpdsRawLink[]): string | null {
    const next = links.find((l) => l['@_rel'] === 'next')
    return next?.['@_href'] ?? null
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest __tests__/services/parser/OpdsParser.test.ts --no-cache
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/parser/OpdsParser.ts __tests__/services/parser/OpdsParser.test.ts && git commit -m "feat: implement OPDS catalog parser"
```

---

## Chunk 4: Translation Service

### Task 10: Translation Service with Cache + Fallback

**Files:**
- Create: `src/services/translation/types.ts`, `src/services/translation/DeepSeekProvider.ts`, `src/services/translation/GeminiProvider.ts`, `src/services/translation/TranslationCache.ts`, `src/services/translation/TranslationService.ts`
- Create: `__tests__/services/translation/TranslationService.test.ts`, `__tests__/services/translation/DeepSeekProvider.test.ts`

- [ ] **Step 1: Create translation types**

```typescript
// src/services/translation/types.ts
export interface TranslationResult {
  translation: string
  grammar: string | null
  fromCache: boolean
}

export interface TranslationProvider {
  translate(params: TranslateParams): Promise<TranslationResult>
}

export interface TranslateParams {
  word: string
  sentence: string
  bookLanguage: string
  nativeLanguage: string
  isPhrase: boolean
}
```

- [ ] **Step 2: Write failing translation service test**

```typescript
// __tests__/services/translation/TranslationService.test.ts
import { TranslationService } from '../../../src/services/translation/TranslationService'
import type { TranslationProvider, TranslateParams, TranslationResult } from '../../../src/services/translation/types'

class MockProvider implements TranslationProvider {
  callCount = 0
  shouldFail = false

  async translate(params: TranslateParams): Promise<TranslationResult> {
    this.callCount++
    if (this.shouldFail) throw new Error('API error')
    return { translation: `translated: ${params.word}`, grammar: null, fromCache: false }
  }
}

class MockCache {
  private store = new Map<string, TranslationResult>()

  async get(key: string): Promise<TranslationResult | null> {
    return this.store.get(key) ?? null
  }

  async set(key: string, result: TranslationResult): Promise<void> {
    this.store.set(key, result)
  }

  buildKey(word: string, sentence: string, bookLang: string, nativeLang: string): string {
    return `${word}:${bookLang}:${nativeLang}`
  }
}

describe('TranslationService', () => {
  let primary: MockProvider
  let fallback: MockProvider
  let cache: MockCache
  let service: TranslationService

  beforeEach(() => {
    primary = new MockProvider()
    fallback = new MockProvider()
    cache = new MockCache()
    service = new TranslationService(primary, fallback, cache as any)
  })

  const params: TranslateParams = {
    word: 'fireplace',
    sentence: 'sat by the fireplace',
    bookLanguage: 'en',
    nativeLanguage: 'ru',
    isPhrase: false,
  }

  it('returns cached result if available', async () => {
    await cache.set(cache.buildKey('fireplace', 'sat by the fireplace', 'en', 'ru'), {
      translation: 'камин', grammar: null, fromCache: true,
    })
    const result = await service.translate(params)
    expect(result.translation).toBe('камин')
    expect(result.fromCache).toBe(true)
    expect(primary.callCount).toBe(0)
  })

  it('calls primary provider on cache miss', async () => {
    const result = await service.translate(params)
    expect(result.translation).toBe('translated: fireplace')
    expect(primary.callCount).toBe(1)
  })

  it('falls back to secondary on primary failure', async () => {
    primary.shouldFail = true
    const result = await service.translate(params)
    expect(result.translation).toBe('translated: fireplace')
    expect(primary.callCount).toBeGreaterThanOrEqual(1)
    expect(fallback.callCount).toBe(1)
  })

  it('throws when both providers fail', async () => {
    primary.shouldFail = true
    fallback.shouldFail = true
    await expect(service.translate(params)).rejects.toThrow()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest __tests__/services/translation/TranslationService.test.ts --no-cache
```

Expected: FAIL

- [ ] **Step 4: Implement TranslationService**

```typescript
// src/services/translation/TranslationService.ts
import type { TranslationProvider, TranslateParams, TranslationResult } from './types'

interface TranslationCacheInterface {
  get(key: string): Promise<TranslationResult | null>
  set(key: string, result: TranslationResult): Promise<void>
  buildKey(word: string, sentence: string, bookLang: string, nativeLang: string): string
}

export class TranslationService {
  constructor(
    private primary: TranslationProvider,
    private fallback: TranslationProvider,
    private cache: TranslationCacheInterface,
  ) {}

  async translate(params: TranslateParams): Promise<TranslationResult> {
    const cacheKey = this.cache.buildKey(
      params.word, params.sentence, params.bookLanguage, params.nativeLanguage
    )

    const cached = await this.cache.get(cacheKey)
    if (cached) return { ...cached, fromCache: true }

    const result = await this.callWithFallback(params)

    await this.cache.set(cacheKey, result).catch(() => {})

    return result
  }

  private async callWithFallback(params: TranslateParams): Promise<TranslationResult> {
    try {
      return await this.callWithRetry(this.primary, params, 1)
    } catch {
      return await this.callWithRetry(this.fallback, params, 0)
    }
  }

  private async callWithRetry(
    provider: TranslationProvider,
    params: TranslateParams,
    retries: number,
  ): Promise<TranslationResult> {
    let lastError: Error | undefined
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await provider.translate(params)
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        if (attempt < retries) await new Promise((r) => setTimeout(r, 1000))
      }
    }
    throw lastError
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npx jest __tests__/services/translation/TranslationService.test.ts --no-cache
```

Expected: 4 tests PASS

- [ ] **Step 6: Implement TranslationCache**

```typescript
// src/services/translation/TranslationCache.ts
import * as Crypto from 'expo-crypto'
import type { TranslationResult } from './types'

interface CacheStore {
  get(key: string): Promise<TranslationResult | null>
  set(key: string, value: TranslationResult): Promise<void>
}

/**
 * In-memory LRU cache for translations.
 * For MVP, this lives in memory. When WatermelonDB integration is wired up
 * for the full reader flow, this will delegate to the TranslationCacheEntry table.
 */
export class TranslationCache implements CacheStore {
  private cache = new Map<string, TranslationResult>()
  private maxEntries: number

  constructor(maxEntries = 100_000) {
    this.maxEntries = maxEntries
  }

  async get(key: string): Promise<TranslationResult | null> {
    const entry = this.cache.get(key)
    if (!entry) return null
    // LRU: move to end
    this.cache.delete(key)
    this.cache.set(key, entry)
    return { ...entry, fromCache: true }
  }

  async set(key: string, result: TranslationResult): Promise<void> {
    if (this.cache.size >= this.maxEntries) {
      // Evict oldest (first entry in Map)
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) this.cache.delete(oldest)
    }
    this.cache.set(key, result)
  }

  buildKey(word: string, sentence: string, bookLang: string, nativeLang: string): string {
    const input = `${word.toLowerCase()}:${sentence.toLowerCase()}:${bookLang}:${nativeLang}`
    // Synchronous hash for cache key. SHA-256 via expo-crypto is async,
    // so we use a simple deterministic hash for the in-memory cache.
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return `tc_${Math.abs(hash).toString(36)}_${bookLang}_${nativeLang}`
  }
}
```

- [ ] **Step 7: Implement DeepSeek provider**

```typescript
// src/services/translation/DeepSeekProvider.ts
import type { TranslationProvider, TranslateParams, TranslationResult } from './types'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

/** Extract JSON from LLM response that may be wrapped in markdown code blocks */
function extractJson(raw: string): Record<string, unknown> {
  // Strip markdown code block wrappers if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  return JSON.parse(cleaned)
}

export class DeepSeekProvider implements TranslationProvider {
  constructor(private apiKey: string) {}

  async translate(params: TranslateParams): Promise<TranslationResult> {
    // Prompts aligned with spec Section 3.3
    const prompt = params.isPhrase
      ? `Translate phrase '${params.word}' in context '${params.sentence}', ${params.bookLanguage}→${params.nativeLanguage}. Give: translation, meaning as a whole. Respond in JSON: {"translation": "...", "grammar": null}`
      : `Translate '${params.word}' in context '${params.sentence}', ${params.bookLanguage}→${params.nativeLanguage}. Give: translation, brief explanation, example. Respond in JSON: {"translation": "...", "grammar": "..."}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000) // 3s timeout per spec

    try {
      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'You are a language learning assistant. Respond only with valid JSON, no markdown.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 200,
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`)

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content ?? ''
      const parsed = extractJson(content)

      return {
        translation: String(parsed.translation ?? content),
        grammar: parsed.grammar ? String(parsed.grammar) : null,
        fromCache: false,
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}
```

- [ ] **Step 8: Implement Gemini provider (same interface, different URL/model)**

```typescript
// src/services/translation/GeminiProvider.ts
import type { TranslationProvider, TranslateParams, TranslationResult } from './types'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent'

/** Extract JSON from LLM response that may be wrapped in markdown code blocks */
function extractJson(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  return JSON.parse(cleaned)
}

export class GeminiProvider implements TranslationProvider {
  constructor(private apiKey: string) {}

  async translate(params: TranslateParams): Promise<TranslationResult> {
    const prompt = params.isPhrase
      ? `Translate phrase '${params.word}' in context '${params.sentence}', ${params.bookLanguage}→${params.nativeLanguage}. Give: translation, meaning as a whole. Respond in JSON: {"translation": "...", "grammar": null}`
      : `Translate '${params.word}' in context '${params.sentence}', ${params.bookLanguage}→${params.nativeLanguage}. Give: translation, brief explanation, example. Respond in JSON: {"translation": "...", "grammar": "..."}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5s timeout for fallback per spec

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`Gemini API error: ${response.status}`)

      const data = await response.json()
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const parsed = extractJson(content)

      return {
        translation: String(parsed.translation ?? content),
        grammar: parsed.grammar ? String(parsed.grammar) : null,
        fromCache: false,
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}
```

- [ ] **Step 9: Write DeepSeekProvider unit test**

```typescript
// __tests__/services/translation/DeepSeekProvider.test.ts
import { DeepSeekProvider } from '../../../src/services/translation/DeepSeekProvider'

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('DeepSeekProvider', () => {
  const provider = new DeepSeekProvider('test-api-key')
  const params = {
    word: 'fireplace',
    sentence: 'sat by the fireplace',
    bookLanguage: 'en',
    nativeLanguage: 'ru',
    isPhrase: false,
  }

  afterEach(() => mockFetch.mockReset())

  it('returns parsed translation from API response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"translation": "камин", "grammar": "noun"}' } }],
      }),
    })
    const result = await provider.translate(params)
    expect(result.translation).toBe('камин')
    expect(result.grammar).toBe('noun')
    expect(result.fromCache).toBe(false)
  })

  it('handles JSON wrapped in markdown code blocks', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '```json\n{"translation": "камин", "grammar": null}\n```' } }],
      }),
    })
    const result = await provider.translate(params)
    expect(result.translation).toBe('камин')
  })

  it('throws on non-OK HTTP response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 })
    await expect(provider.translate(params)).rejects.toThrow('DeepSeek API error: 429')
  })

  it('sends correct Authorization header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"translation": "t", "grammar": null}' } }],
      }),
    })
    await provider.translate(params)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
        }),
      }),
    )
  })
})
```

- [ ] **Step 10: Run all translation tests**

```bash
npx jest __tests__/services/translation/ --no-cache
```

Expected: All tests pass (TranslationService + DeepSeekProvider).

- [ ] **Step 11: Commit**

```bash
git add src/services/translation/ __tests__/services/translation/ && git commit -m "feat: implement translation service with DeepSeek/Gemini + cache + fallback"
```

---

### Task 11: Constants and Utility Types

**Files:**
- Create: `src/utils/constants.ts`, `src/utils/types.ts`

- [ ] **Step 1: Create constants**

```typescript
// src/utils/constants.ts
export const OPDS_PRESETS = [
  {
    name: 'Project Gutenberg',
    url: 'https://www.gutenberg.org/ebooks/search/?format=opds',
  },
  {
    name: 'Standard Ebooks',
    url: 'https://standardebooks.org/feeds/opds',
  },
] as const

export const WORD_STATUS = {
  NEW: 1,
  RECOGNIZED: 2,
  FAMILIAR: 3,
  LEARNED: 4,
  KNOWN: 5,
} as const

export const WORD_STATUS_COLORS = {
  [WORD_STATUS.NEW]: '#4a90d9',
  [WORD_STATUS.RECOGNIZED]: 'rgba(245, 200, 66, 1)',
  [WORD_STATUS.FAMILIAR]: 'rgba(245, 200, 66, 0.7)',
  [WORD_STATUS.LEARNED]: 'rgba(245, 200, 66, 0.4)',
  [WORD_STATUS.KNOWN]: 'transparent',
} as const

export const SUPPORTED_BOOK_LANGUAGES = ['en'] as const
export const SUPPORTED_UI_LANGUAGES = ['en', 'ru', 'pl', 'uk'] as const
export const SUPPORTED_FORMATS = ['epub', 'fb2'] as const

export const TRANSLATION_CACHE_MAX = 100_000
export const TEXT_DIFFICULTY_SAMPLE_RATIO = 0.1
```

```typescript
// src/utils/types.ts
export type BookFormat = 'epub' | 'fb2' | 'pdf'
export type BookSource = 'opds' | 'file' | 'catalog'
export type WordStatusValue = 1 | 2 | 3 | 4 | 5
export type ReaderTheme = 'light' | 'dark' | 'sepia'
export type SupportedUILanguage = 'en' | 'ru' | 'pl' | 'uk'
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/ && git commit -m "feat: add constants (OPDS presets, word statuses, colors) and shared types"
```

---

### Task 12: Final Integration Verification

- [ ] **Step 1: Run all tests**

```bash
npx jest --no-cache
```

Expected: All tests pass (FB2 parser, OPDS parser, TranslationService).

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No TypeScript errors. Full app verification (with WatermelonDB and navigation) requires `npx expo prebuild && npx expo run:ios` on a simulator.

- [ ] **Step 3: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 4: Verify on GitHub**

Check https://github.com/zemlyanin7/fluera — all files present, 3 test suites passing.

---

## Summary

This plan covers:
1. **Project init** — Expo + TypeScript (strict + decorators) + expo-dev-client + all dependencies
2. **Theme system** — Tamagui with light/dark/sepia + all color tokens
3. **Navigation** — Expo Router with 4 tabs + reader/catalog routes + DatabaseProvider
4. **i18n** — 4 languages (en, ru, pl, uk) with full translation keys
5. **Database** — WatermelonDB with 8 tables (books, chapters, word_statuses, word_occurrences, translation_cache, opds_catalogs, reading_stats, user_settings) + compound index strategy
6. **State management** — 3 Zustand stores (settings with AsyncStorage persist, reader, app)
7. **FB2 parser** — fast-xml-parser with preserveOrder for correct mixed content, handles all spec FB2 elements, tested
8. **OPDS parser** — Atom/XML parser, tested
9. **Translation service** — DeepSeek primary + Gemini fallback + in-memory LRU cache + retry + JSON extraction, tested (including DeepSeekProvider unit tests)
10. **Constants** — OPDS presets, word status colors, shared types

**Phase 0 spikes covered:** FB2 parser, OPDS parser (2/4).
**Phase 0 spikes deferred to next plan:** Epub reader spike (requires device/simulator), DeepSeek end-to-end spike (requires API key).

**Not covered (next plan):** Epub reader integration, FB2 renderer component, Library UI, Dictionary UI, Translation popup UI, file upload, OPDS catalog browsing UI, backend sync, auth, RevenueCat, expo prebuild + device testing.
