# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полностью переинициализировать Fluera-проект, собрать визуально-навигационный каркас по дизайн-спеке: 3 темы + 6 script variants через Unistyles v3, 12 UI-примитивов, 26 иконок, навигация Expo Router, все шрифты embed через config-plugin, settings store + canonical types для следующих sub-projects.

**Architecture:** Single-package Expo SDK 55 + RN 0.83 + React 19 на New Architecture. Стилизация через `react-native-unistyles` v3 (ShadowTree-driven themes + runtime script variants без re-render). Файловая навигация Expo Router с группами `(onboarding)`, `(tabs)`, `(playground)`. Все шрифты (~38 .ttf) встраиваются через `expo-font` config plugin при native-сборке. TDD для утилит/стора, smoke-валидация UI на iOS + Android dev-client.

**Tech Stack:** Expo SDK 55, React 19, RN 0.83, TypeScript strict, `expo-router` ~5.x, `react-native-unistyles` ^3, `react-native-svg` ^15, `@gorhom/bottom-sheet` ^5, `expo-blur`, `expo-font` (config plugin), `expo-linear-gradient`, `expo-localization`, `expo-status-bar`, `expo-splash-screen`, `react-native-safe-area-context`, `react-native-screens`, `react-native-gesture-handler`, `react-native-reanimated` ^3.16, `zustand` ^5, `i18next` + `react-i18next`, Jest + `@testing-library/react-native`.

**Спецификация:** [`docs/superpowers/specs/2026-05-15-foundation-design.md`](../specs/2026-05-15-foundation-design.md)

---

## Файловая структура

```
app/
  _layout.tsx, +not-found.tsx
  (onboarding)/_layout.tsx + index/book-lang/native-lang.tsx
  (tabs)/_layout.tsx + index/deck/stats/settings.tsx
  (playground)/_layout.tsx + index.tsx        # dev-only
  reader/[bookId].tsx, word/[wordId].tsx, deck/session.tsx, import.tsx

src/
  theme/   tokens.ts, scripts.ts, unistyles.ts, bridge.ts, index.ts
  types/   content.ts, settings.ts, index.ts
  stores/  settingsStore.ts
  components/
    ui/    Button, Pill, Card, Sheet, IconBtn, Hairline, BookCover, Headline,
           SectionLabel, Stat, TabBar, PhoneShell, ProgressBar, index.ts
    icons/ Icon.tsx, paths.ts, index.tsx
  fixtures/ borges.ts
  i18n/    index.ts + locales/{en,ru,pl,uk}.json
  utils/   splitWords.ts, constants.ts

assets/fonts/                         38 .ttf
__tests__/                            scripts/settingsStore/splitWords/Button/Sheet/TabBar
```

См. спеку §4 для подробностей.

---

## Phase 0: Backup и Wipe

### Task 1: Backup-тег + новая ветка

**Files:** git only.

- [ ] **Step 1:** Создать тег и ветку

```bash
git tag pre-rewrite-2026-05-15
git checkout -b feat/foundation-rewrite
git branch --show-current
```

Expected: ветка `feat/foundation-rewrite`.

---

### Task 2: Удалить старый код

**Files:** delete старые директории и конфиги. Keep: `docs/`, `CLAUDE.md`, `.git/`, `.claude/`, `.superpowers/`, `doc/`, `.env.example`.

- [ ] **Step 1:** Удалить директории

```bash
rm -rf app src __tests__ assets ios node_modules .expo patches
```

- [ ] **Step 2:** Удалить конфиги

```bash
rm -f package.json package-lock.json tsconfig.json eslint.config.js \
      babel.config.js jest.config.js jest.setup.js tamagui.config.ts \
      app.json .gitignore .DS_Store
```

- [ ] **Step 3:** Проверить

```bash
ls -la
```

Expected: видны `.git`, `.claude`, `.env.example`, `.superpowers`, `CLAUDE.md`, `doc/`, `docs/`.

- [ ] **Step 4:** Коммит

```bash
git add -A
git commit -m "chore: wipe legacy code for full rewrite (Foundation #1)"
```

---

## Phase 1: Project Init

### Task 3: create-expo-app

- [x] **Step 1:** Шаблон в /tmp

```bash
cd /tmp && npx create-expo-app@latest fluera-init --template blank-typescript
```

- [x] **Step 2:** Скопировать в репо

```bash
cd /Users/andrei/development/Mobile/Fluera
cp -r /tmp/fluera-init/{app,assets,App.tsx,index.ts,app.json,package.json,tsconfig.json,babel.config.js,.gitignore} .
```

- [x] **Step 3:** Скрипты в `package.json` — заменить блок `scripts`:

```json
"scripts": {
  "start": "expo start --dev-client",
  "ios": "expo run:ios",
  "android": "expo run:android",
  "test": "jest",
  "test:watch": "jest --watch",
  "lint": "expo lint",
  "typecheck": "tsc --noEmit",
  "prebuild": "expo prebuild --clean"
}
```

Также установить `"name": "fluera"`, `"main": "expo-router/entry"`.

- [x] **Step 4:** Удалить tmp + коммит

```bash
rm -rf /tmp/fluera-init
git add -A
git commit -m "chore: init fresh Expo SDK 55 + TypeScript project"
```

---

### Task 4: Установить все зависимости

- [x] **Step 1:** Runtime deps через expo install

```bash
npx expo install expo-router expo-blur expo-font expo-linear-gradient \
  expo-localization expo-splash-screen expo-status-bar expo-constants \
  react-native-safe-area-context react-native-screens \
  react-native-gesture-handler react-native-reanimated \
  react-native-svg
```

- [x] **Step 2:** Styling/state/i18n через npm

```bash
npm install react-native-unistyles@^3 @gorhom/bottom-sheet@^5 \
  zustand@^5 i18next react-i18next
```

- [x] **Step 3:** Dev-deps

```bash
npm install --save-dev jest jest-expo @testing-library/react-native \
  @types/jest @types/react ts-jest @babel/plugin-proposal-decorators \
  babel-plugin-module-resolver eslint@^9 eslint-config-expo@~55.0.0
```

- [x] **Step 4:** Проверка совместимости

```bash
npx expo doctor
```

Expected: OK либо некритичные warnings.

- [x] **Step 5:** Коммит

```bash
git add package.json package-lock.json
git commit -m "chore: install runtime + dev dependencies"
```

---

### Task 5: TypeScript strict + path alias

- [x] **Step 1:** Заменить `tsconfig.json`

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "bundler",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"],
  "exclude": ["node_modules"]
}
```

- [x] **Step 2:** Проверка

```bash
npm run typecheck
```

Expected: 0 errors.

- [x] **Step 3:** Коммит

```bash
git add tsconfig.json
git commit -m "chore: TypeScript strict + @/* path alias"
```

---

### Task 6: Babel config с Reanimated + alias

- [x] **Step 1:** Заменить `babel.config.js`

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      ['module-resolver', { root: ['./'], alias: { '@': './src' } }],
      'react-native-reanimated/plugin',
    ],
  };
};
```

- [x] **Step 2:** Коммит

```bash
git add babel.config.js
git commit -m "chore: Babel config + Reanimated plugin + alias"
```

---

### Task 7: Jest конфиг + моки

- [x] **Step 1:** `jest.config.js`

```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?@?react-native|@react-native-community|@react-navigation|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-native-svg|react-native-unistyles|@gorhom/.*|react-native-reanimated)',
  ],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
};
```

- [x] **Step 2:** `jest.setup.js`

```javascript
jest.mock('react-native-unistyles', () => ({
  StyleSheet: {
    configure: jest.fn(),
    create: (factory) => {
      const result = typeof factory === 'function'
        ? factory({ ink: '#000', paper: '#fff', accent: '#c0392b' }, {})
        : factory;
      return Object.assign(result, { useVariants: jest.fn() });
    },
  },
  UnistylesRuntime: {
    setTheme: jest.fn(),
    setAdaptiveThemes: jest.fn(),
    colorScheme: 'light',
  },
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: ({ children }) => RN.createElement(RN.View, null, children),
    BottomSheetView: ({ children }) => RN.createElement(RN.View, null, children),
    BottomSheetBackdrop: () => null,
  };
});

jest.mock('react-native-svg', () => {
  const RN = require('react-native');
  const PT = ({ children }) => RN.createElement(RN.View, null, children);
  return { Svg: PT, Path: PT, Circle: PT, Rect: PT, G: PT, Defs: PT,
           LinearGradient: PT, Stop: PT };
});

jest.mock('expo-blur', () => {
  const RN = require('react-native');
  return { BlurView: ({ children }) => RN.createElement(RN.View, null, children) };
});

jest.mock('expo-linear-gradient', () => {
  const RN = require('react-native');
  return { LinearGradient: ({ children }) => RN.createElement(RN.View, null, children) };
});

jest.mock('expo-font', () => ({ useFonts: () => [true, null], isLoaded: () => true }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }], locale: 'en-US' }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
```

- [x] **Step 3:** Проверить

```bash
npm test
```

Expected: 0 tests / OK.

- [x] **Step 4:** Коммит

```bash
git add jest.config.js jest.setup.js
git commit -m "chore: Jest configuration with native-module mocks"
```

---

### Task 8: ESLint flat config

- [x] **Step 1:** `eslint.config.js`

```javascript
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['node_modules/', '.expo/', 'ios/', 'android/', 'assets/', 'dist/'],
    rules: {
      'react/jsx-no-undef': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
]);
```

- [x] **Step 2:** Lint

```bash
npm run lint
```

Expected: 0 errors.

- [x] **Step 3:** Коммит

```bash
git add eslint.config.js
git commit -m "chore: ESLint flat config"
```

---

### Task 9: Скаффолд директорий

- [x] **Step 1:** Создать структуру

```bash
mkdir -p \
  src/theme src/types src/stores \
  src/components/ui src/components/icons \
  src/fixtures src/i18n/locales src/utils \
  assets/fonts \
  __tests__/theme __tests__/stores __tests__/utils __tests__/components/ui
```

- [x] **Step 2:** .gitkeep для пустых директорий

```bash
find src __tests__ assets -type d -empty -exec touch {}/.gitkeep \;
```

- [x] **Step 3:** Расширить `.gitignore`:

```
.expo/
dist/
web-build/
expo-env.d.ts
ios/Pods/
ios/build/
android/build/
android/.gradle/
android/app/build/
node_modules/
*.tgz
*.log
.DS_Store
.env
.env.local
.vscode/
.idea/
coverage/
```

- [x] **Step 4:** Коммит

```bash
git add -A
git commit -m "chore: scaffold src/ tree + .gitignore"
```

---

## Phase 2: Theme System

### Task 10: tokens.ts

- [x] **Step 1:** Создать `src/theme/tokens.ts`:

```typescript
export const palettes = {
  light: { paper: '#F5EFE4', paper2: '#EDE5D5', ink: '#1F1A14', ink2: '#564E42', ink3: '#8A8170' },
  sepia: { paper: '#ECDFC6', paper2: '#DBCBAA', ink: '#2A2117', ink2: '#5E513D', ink3: '#8E7E62' },
  dark:  { paper: '#16130E', paper2: '#221E17', ink: '#EDE6D6', ink2: '#B5AB97', ink3: '#786E5C' },
} as const;

export const semanticBase = {
  accent: 'oklch(0.62 0.14 40)', accentSoft: 'oklch(0.62 0.14 40 / 0.12)',
  accentLine: 'oklch(0.62 0.14 40 / 0.35)',
  known: 'oklch(0.68 0.06 140)', knownSoft: 'oklch(0.68 0.06 140 / 0.18)',
  learning: 'oklch(0.78 0.12 75)', learningSoft: 'oklch(0.78 0.12 75 / 0.22)',
  newSoft: 'oklch(0.62 0.14 40 / 0.18)',
};

export const semanticDark = {
  accent: 'oklch(0.72 0.12 40)', accentSoft: 'oklch(0.72 0.12 40 / 0.18)',
  accentLine: 'oklch(0.72 0.12 40 / 0.35)',
  known: 'oklch(0.74 0.07 140)', knownSoft: 'oklch(0.74 0.07 140 / 0.22)',
  learning: 'oklch(0.82 0.13 75)', learningSoft: 'oklch(0.82 0.13 75 / 0.25)',
  newSoft: 'oklch(0.72 0.12 40 / 0.22)',
};

export const scriptTypography = {
  latin: { fontReading: 'SourceSerif4-Regular', fontReadingItalic: 'SourceSerif4-Italic',
           fontUi: 'Inter-Regular', fontMono: 'GeistMono-Regular',
           readingLeading: 1.65, readingLetterSpacing: -0.005, isRTL: false },
  cyrillic: { fontReading: 'Lora-Regular', fontReadingItalic: 'Lora-Italic',
              fontUi: 'Inter-Regular', fontMono: 'GeistMono-Regular',
              readingLeading: 1.6, readingLetterSpacing: 0, isRTL: false },
  cjk_jp: { fontReading: 'ShipporiMinchoB1-Regular', fontReadingItalic: 'ShipporiMinchoB1-Regular',
            fontUi: 'NotoSansJP-Regular', fontMono: 'GeistMono-Regular',
            readingLeading: 1.85, readingLetterSpacing: 0.02, isRTL: false },
  cjk_kr: { fontReading: 'NotoSerifKR-Regular', fontReadingItalic: 'NotoSerifKR-Regular',
            fontUi: 'NotoSansKR-Regular', fontMono: 'GeistMono-Regular',
            readingLeading: 1.75, readingLetterSpacing: 0, isRTL: false },
  arabic: { fontReading: 'Amiri-Regular', fontReadingItalic: 'Amiri-Italic',
            fontUi: 'NotoSansArabic-Regular', fontMono: 'GeistMono-Regular',
            readingLeading: 1.95, readingLetterSpacing: 0, isRTL: true },
  devanagari: { fontReading: 'TiroDevanagariHindi-Regular', fontReadingItalic: 'TiroDevanagariHindi-Italic',
                fontUi: 'NotoSansDevanagari-Regular', fontMono: 'GeistMono-Regular',
                readingLeading: 1.85, readingLetterSpacing: 0, isRTL: false },
} as const;

export const sizes = {
  readingDefault: 19, readingMin: 15, readingMax: 26,
  radii: { sm: 3, md: 12, lg: 14, xl: 18, xxl: 22, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 28 },
  iconBtn: 36, statusbarH: 54, tabbarH: 60,
} as const;

export type PaletteId = keyof typeof palettes;
export type ScriptTypographyId = keyof typeof scriptTypography;
```

- [x] **Step 2:** Коммит

```bash
git add src/theme/tokens.ts
git commit -m "feat(theme): palette + semantic + scriptTypography tokens"
```

---

### Task 11: scripts.ts (TDD)

- [x] **Step 1:** Тест `__tests__/theme/scripts.test.ts`

```typescript
import { scriptForLang } from '@/theme/scripts';

describe('scriptForLang', () => {
  test.each([['en','latin'],['es','latin'],['fr','latin'],['de','latin'],
    ['it','latin'],['pt','latin'],['pl','latin']])('%s → latin', (lang, exp) => {
    expect(scriptForLang(lang)).toBe(exp);
  });
  test.each([['ru','cyrillic'],['uk','cyrillic'],['be','cyrillic'],['sr','cyrillic']])
    ('%s → cyrillic', (lang, exp) => expect(scriptForLang(lang)).toBe(exp));
  test('ja → cjk_jp', () => expect(scriptForLang('ja')).toBe('cjk_jp'));
  test('ko → cjk_kr', () => expect(scriptForLang('ko')).toBe('cjk_kr'));
  test.each([['ar','arabic'],['fa','arabic'],['ur','arabic']])
    ('%s → arabic', (lang, exp) => expect(scriptForLang(lang)).toBe(exp));
  test.each([['hi','devanagari'],['mr','devanagari'],['sa','devanagari']])
    ('%s → devanagari', (lang, exp) => expect(scriptForLang(lang)).toBe(exp));
  test('unknown → latin', () => {
    expect(scriptForLang('xx')).toBe('latin');
    expect(scriptForLang('')).toBe('latin');
  });
});
```

- [x] **Step 2:** Запустить — FAIL

```bash
npm test -- __tests__/theme/scripts.test.ts
```

- [x] **Step 3:** `src/theme/scripts.ts`

```typescript
import { scriptTypography } from './tokens';

export type ScriptId = keyof typeof scriptTypography;

const langToScript: Record<string, ScriptId> = {
  en: 'latin', es: 'latin', fr: 'latin', de: 'latin',
  it: 'latin', pt: 'latin', pl: 'latin',
  ru: 'cyrillic', uk: 'cyrillic', be: 'cyrillic', sr: 'cyrillic',
  ja: 'cjk_jp', ko: 'cjk_kr',
  ar: 'arabic', fa: 'arabic', ur: 'arabic',
  hi: 'devanagari', mr: 'devanagari', sa: 'devanagari',
};

export function scriptForLang(lang: string): ScriptId {
  return langToScript[lang] ?? 'latin';
}
```

- [x] **Step 4:** PASS — 20 tests

```bash
npm test -- __tests__/theme/scripts.test.ts
```

- [x] **Step 5:** Коммит

```bash
git add __tests__/theme/scripts.test.ts src/theme/scripts.ts
git commit -m "feat(theme): scriptForLang BCP-47 mapping + tests"
```

---

### Task 12: unistyles.ts конфиг + module augmentation

- [x] **Step 1:** Создать `src/theme/unistyles.ts`

```typescript
import { StyleSheet } from 'react-native-unistyles';
import { palettes, semanticBase, semanticDark, sizes } from './tokens';

const lightTheme = { ...palettes.light, ...semanticBase, sizes };
const sepiaTheme = { ...palettes.sepia, ...semanticBase, sizes };
const darkTheme  = { ...palettes.dark,  ...semanticDark, sizes };

const appThemes = { light: lightTheme, sepia: sepiaTheme, dark: darkTheme };
const breakpoints = { xs: 0, sm: 360, md: 400, lg: 720 } as const;

type AppThemes = typeof appThemes;
type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesThemes extends AppThemes {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  themes: appThemes,
  breakpoints,
  settings: { initialTheme: 'light', adaptiveThemes: false },
});

export { appThemes };
```

- [x] **Step 2:** Typecheck

```bash
npm run typecheck
```

- [x] **Step 3:** Коммит

```bash
git add src/theme/unistyles.ts
git commit -m "feat(theme): Unistyles v3 config + module augmentation"
```

---

### Task 13: bridge.ts + barrel

- [x] **Step 1:** `src/theme/bridge.ts`

```typescript
import { UnistylesRuntime } from 'react-native-unistyles';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Подписка Settings → UnistylesRuntime.
 * Возвращает unsubscribe — обязательно вызывать в cleanup useEffect.
 * Threading: JS thread only, не из Reanimated worklet.
 */
export function attachThemeBridge(): () => void {
  return useSettingsStore.subscribe(
    (s) => ({ id: s.themeId, auto: s.themeAuto }),
    ({ id, auto }) => {
      if (auto) {
        UnistylesRuntime.setAdaptiveThemes(true);
      } else {
        UnistylesRuntime.setAdaptiveThemes(false);
        UnistylesRuntime.setTheme(id);
      }
    },
    { fireImmediately: true },
  );
}
```

- [x] **Step 2:** `src/theme/index.ts` — barrel

```typescript
export * from './tokens';
export * from './scripts';
export * from './bridge';
import './unistyles'; // side-effect: StyleSheet.configure
```

- [x] **Step 3:** Typecheck

```bash
npm run typecheck
```

- [x] **Step 4:** Коммит

```bash
git add src/theme/bridge.ts src/theme/index.ts
git commit -m "feat(theme): bridge + barrel export"
```

---

## Phase 3: Canonical Types

### Task 14: content.ts (ContentItem / InlineNode / BookChapter / BookFootnotes)

- [x] **Step 1:** `src/types/content.ts` — полный код из спеки §6.1. Включает:
  - InlineNode (text, bold, italic, link, sup, sub, footnote-ref)
  - ParagraphStyle
  - ContentItem (heading.id, image.aspectRatio, blockquote.items: ContentItem[], list.items: ContentItem[][], separator, table-row)
  - BookChapter (index, title, items, lang)
  - BookFootnotes (id → ContentItem[])
  - MAX_INLINE_DEPTH = 20

```typescript
export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'italic'; children: InlineNode[] }
  | { type: 'link'; href: string; children: InlineNode[] }
  | { type: 'sup'; children: InlineNode[] }
  | { type: 'sub'; children: InlineNode[] }
  | { type: 'footnote-ref'; id: string; label: string };

export interface ParagraphStyle {
  textAlign?: 'left' | 'center' | 'right';
  indent?: boolean;
  italic?: boolean;
}

export type ContentItem =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; id?: string; inlines: InlineNode[] }
  | { type: 'paragraph'; inlines: InlineNode[]; style?: ParagraphStyle }
  | { type: 'image'; src: string; alt?: string; width?: number; height?: number; aspectRatio?: number }
  | { type: 'blockquote'; items: ContentItem[] }
  | { type: 'list'; ordered: boolean; items: ContentItem[][] }
  | { type: 'separator' }
  | { type: 'table-row'; cells: InlineNode[][] };

export interface BookChapter {
  index: number;
  title: string | null;
  items: ContentItem[];
  lang?: string | null;
}

export interface BookFootnotes {
  [id: string]: ContentItem[];
}

export const MAX_INLINE_DEPTH = 20;
```

- [x] **Step 2:** Коммит

```bash
git add src/types/content.ts
git commit -m "feat(types): canonical ContentItem / InlineNode / BookChapter / BookFootnotes"
```

---

### Task 15: settings.ts + types barrel

- [x] **Step 1:** `src/types/settings.ts` — полный код из спеки §6.2:

```typescript
export type ThemeId = 'light' | 'sepia' | 'dark';
export type FontFamilyMode = 'serif' | 'sans';
export type ScrollMode = 'page' | 'scroll';
export type ProficiencyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'auto';
export type TapToTranslateBehavior = 'instant' | 'delay' | 'long-press';
export type AutoAddToDeck = 'always' | 'never' | 'ask';

export const SUPPORTED_NATIVE_LANGUAGES = ['en','ru','pl','uk','es','fr','de'] as const;
export type NativeLanguage = (typeof SUPPORTED_NATIVE_LANGUAGES)[number];
export const SUPPORTED_BOOK_LANGUAGES = ['en','ru','pl','uk','es','fr','de','it','pt','ja','ko','ar','hi'] as const;
export type BookLanguage = (typeof SUPPORTED_BOOK_LANGUAGES)[number];
export type UILanguage = 'en' | 'ru' | 'pl' | 'uk';

export interface SettingsState {
  uiLanguage: UILanguage;
  nativeLanguage: NativeLanguage;
  bookLanguage: BookLanguage;
  themeId: ThemeId;
  themeAuto: boolean;
  fontFamilyMode: FontFamilyMode;
  fontSize: number;
  scrollMode: ScrollMode;
  highlightUnknown: boolean;
  showSentenceTranslation: boolean;
  pageFlipAnim: boolean;
  bookLanguageLevel: ProficiencyLevel;
  tapToTranslateBehavior: TapToTranslateBehavior;
  autoAddToDeck: AutoAddToDeck;
  showPhonetics: boolean;
  lookupHistoryEnabled: boolean;
  readingSessionGoalMinutes: number;
  onboardingCompleted: boolean;
}

export const DEFAULT_SETTINGS: SettingsState = {
  uiLanguage: 'en', nativeLanguage: 'ru', bookLanguage: 'en',
  themeId: 'light', themeAuto: false,
  fontFamilyMode: 'serif', fontSize: 19, scrollMode: 'scroll',
  highlightUnknown: false, showSentenceTranslation: false, pageFlipAnim: true,
  bookLanguageLevel: 'auto', tapToTranslateBehavior: 'instant',
  autoAddToDeck: 'ask', showPhonetics: false,
  lookupHistoryEnabled: true, readingSessionGoalMinutes: 15,
  onboardingCompleted: false,
};
```

- [x] **Step 2:** `src/types/index.ts`

```typescript
export * from './content';
export * from './settings';
```

- [x] **Step 3:** Коммит

```bash
git add src/types/
git commit -m "feat(types): SettingsState + branded language types"
```

---

### Task 16: splitWords.ts (TDD)

- [x] **Step 1:** Тест `__tests__/utils/splitWords.test.ts`

```typescript
import { splitWords } from '@/utils/splitWords';

describe('splitWords', () => {
  test('empty → []', () => expect(splitWords('')).toEqual([]));
  test('one word', () => expect(splitWords('hello')).toEqual([{ kind: 'word', text: 'hello' }]));
  test('two words', () => expect(splitWords('hello world')).toEqual([
    { kind: 'word', text: 'hello' }, { kind: 'space', text: ' ' }, { kind: 'word', text: 'world' },
  ]));
  test('punct separate', () => expect(splitWords('Hi, you.')).toEqual([
    { kind: 'word', text: 'Hi' }, { kind: 'punct', text: ',' }, { kind: 'space', text: ' ' },
    { kind: 'word', text: 'you' }, { kind: 'punct', text: '.' },
  ]));
  test('latin diacritic', () => expect(splitWords('café')).toEqual([{ kind: 'word', text: 'café' }]));
  test('cyrillic', () => expect(splitWords('Привет мир')).toEqual([
    { kind: 'word', text: 'Привет' }, { kind: 'space', text: ' ' }, { kind: 'word', text: 'мир' },
  ]));
  test("apostrophe inside word", () => expect(splitWords("don't")).toEqual([{ kind: 'word', text: "don't" }]));
});
```

- [x] **Step 2:** FAIL

```bash
npm test -- __tests__/utils/splitWords.test.ts
```

- [x] **Step 3:** `src/utils/splitWords.ts`

```typescript
export type WordToken =
  | { kind: 'word'; text: string }
  | { kind: 'space'; text: string }
  | { kind: 'punct'; text: string };

const TOKEN_RE = /([A-Za-zÀ-ɏЀ-ӿ']+)|(\s+)|([^A-Za-zÀ-ɏЀ-ӿ'\s]+)/g;

export function splitWords(input: string): WordToken[] {
  const result: WordToken[] = [];
  if (!input) return result;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(input)) !== null) {
    if (m[1] !== undefined) result.push({ kind: 'word', text: m[1] });
    else if (m[2] !== undefined) result.push({ kind: 'space', text: m[2] });
    else if (m[3] !== undefined) result.push({ kind: 'punct', text: m[3] });
  }
  return result;
}
```

- [x] **Step 4:** PASS — 7 tests

- [x] **Step 5:** Коммит

```bash
git add __tests__/utils/splitWords.test.ts src/utils/splitWords.ts
git commit -m "feat(utils): splitWords minimal tokenizer (TDD)"
```

---

### Task 17: constants.ts

- [x] **Step 1:** `src/utils/constants.ts`

```typescript
export const APP_NAME = 'Fluera';
export const HIT_SLOP_DEFAULT = { top: 8, right: 8, bottom: 8, left: 8 } as const;
export const SAFE_PADDING_X = 22;
export const TABBAR_HEIGHT = 60;
export const TABBAR_INSET = 14;
export const TABBAR_BOTTOM = 18;
```

- [x] **Step 2:** Коммит

```bash
git add src/utils/constants.ts
git commit -m "feat(utils): layout constants"
```

---

## Phase 4: Settings Store

### Task 18: settingsStore.ts (TDD, 19 tests)

- [ ] **Step 1:** Тест `__tests__/stores/settingsStore.test.ts` — 19 кейсов:

```typescript
import { useSettingsStore } from '@/stores/settingsStore';
import { DEFAULT_SETTINGS } from '@/types/settings';

describe('settingsStore', () => {
  beforeEach(() => useSettingsStore.getState().reset());

  test('initial state equals DEFAULT_SETTINGS', () => {
    const s = useSettingsStore.getState();
    expect(s.themeId).toBe(DEFAULT_SETTINGS.themeId);
    expect(s.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(s.highlightUnknown).toBe(DEFAULT_SETTINGS.highlightUnknown);
  });

  test('setTheme', () => {
    useSettingsStore.getState().setTheme('sepia', false);
    expect(useSettingsStore.getState().themeId).toBe('sepia');
    useSettingsStore.getState().setTheme('dark', true);
    expect(useSettingsStore.getState().themeAuto).toBe(true);
  });

  test('setFontSize clamp low', () => {
    useSettingsStore.getState().setFontSize(10);
    expect(useSettingsStore.getState().fontSize).toBe(15);
  });
  test('setFontSize clamp high', () => {
    useSettingsStore.getState().setFontSize(40);
    expect(useSettingsStore.getState().fontSize).toBe(26);
  });
  test('setFontSize in range', () => {
    useSettingsStore.getState().setFontSize(20);
    expect(useSettingsStore.getState().fontSize).toBe(20);
  });
  test('setReadingSessionGoalMinutes clamp', () => {
    useSettingsStore.getState().setReadingSessionGoalMinutes(1);
    expect(useSettingsStore.getState().readingSessionGoalMinutes).toBe(5);
    useSettingsStore.getState().setReadingSessionGoalMinutes(500);
    expect(useSettingsStore.getState().readingSessionGoalMinutes).toBe(120);
  });

  test.each([
    'toggleHighlightUnknown','toggleShowSentenceTranslation','togglePageFlipAnim',
    'toggleShowPhonetics','toggleLookupHistoryEnabled',
  ] as const)('%s toggles', (action) => {
    const key = action.replace(/^toggle/,'').replace(/^./, c => c.toLowerCase()) as keyof ReturnType<typeof useSettingsStore.getState>;
    const before = (useSettingsStore.getState() as any)[key];
    (useSettingsStore.getState() as any)[action]();
    expect((useSettingsStore.getState() as any)[key]).toBe(!before);
  });

  test('completeOnboarding', () => {
    expect(useSettingsStore.getState().onboardingCompleted).toBe(false);
    useSettingsStore.getState().completeOnboarding();
    expect(useSettingsStore.getState().onboardingCompleted).toBe(true);
  });

  test('language setters', () => {
    useSettingsStore.getState().setUiLanguage('ru');
    useSettingsStore.getState().setNativeLanguage('en');
    useSettingsStore.getState().setBookLanguage('ja');
    const s = useSettingsStore.getState();
    expect(s.uiLanguage).toBe('ru');
    expect(s.nativeLanguage).toBe('en');
    expect(s.bookLanguage).toBe('ja');
  });

  test('setFontFamilyMode', () => {
    useSettingsStore.getState().setFontFamilyMode('sans');
    expect(useSettingsStore.getState().fontFamilyMode).toBe('sans');
  });
  test('setScrollMode', () => {
    useSettingsStore.getState().setScrollMode('page');
    expect(useSettingsStore.getState().scrollMode).toBe('page');
  });
  test('setBookLanguageLevel', () => {
    useSettingsStore.getState().setBookLanguageLevel('B2');
    expect(useSettingsStore.getState().bookLanguageLevel).toBe('B2');
  });
  test('setTapToTranslateBehavior', () => {
    useSettingsStore.getState().setTapToTranslateBehavior('delay');
    expect(useSettingsStore.getState().tapToTranslateBehavior).toBe('delay');
  });
  test('setAutoAddToDeck', () => {
    useSettingsStore.getState().setAutoAddToDeck('always');
    expect(useSettingsStore.getState().autoAddToDeck).toBe('always');
  });
  test('reset', () => {
    useSettingsStore.getState().setTheme('dark', true);
    useSettingsStore.getState().setFontSize(25);
    useSettingsStore.getState().completeOnboarding();
    useSettingsStore.getState().reset();
    const s = useSettingsStore.getState();
    expect(s.themeId).toBe(DEFAULT_SETTINGS.themeId);
    expect(s.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(s.onboardingCompleted).toBe(DEFAULT_SETTINGS.onboardingCompleted);
  });
});
```

- [ ] **Step 2:** FAIL

```bash
npm test -- __tests__/stores/settingsStore.test.ts
```

- [ ] **Step 3:** `src/stores/settingsStore.ts`

```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  DEFAULT_SETTINGS, SettingsState, NativeLanguage, BookLanguage, UILanguage,
  ThemeId, FontFamilyMode, ScrollMode, ProficiencyLevel,
  TapToTranslateBehavior, AutoAddToDeck,
} from '@/types/settings';

interface SettingsActions {
  setUiLanguage: (v: UILanguage) => void;
  setNativeLanguage: (v: NativeLanguage) => void;
  setBookLanguage: (v: BookLanguage) => void;
  setTheme: (id: ThemeId, auto?: boolean) => void;
  setFontFamilyMode: (v: FontFamilyMode) => void;
  setFontSize: (v: number) => void;
  setScrollMode: (v: ScrollMode) => void;
  toggleHighlightUnknown: () => void;
  toggleShowSentenceTranslation: () => void;
  togglePageFlipAnim: () => void;
  setBookLanguageLevel: (v: ProficiencyLevel) => void;
  setTapToTranslateBehavior: (v: TapToTranslateBehavior) => void;
  setAutoAddToDeck: (v: AutoAddToDeck) => void;
  toggleShowPhonetics: () => void;
  toggleLookupHistoryEnabled: () => void;
  setReadingSessionGoalMinutes: (v: number) => void;
  completeOnboarding: () => void;
  reset: () => void;
}

export type SettingsStore = SettingsState & SettingsActions;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const useSettingsStore = create<SettingsStore>()(
  subscribeWithSelector((set) => ({
    ...DEFAULT_SETTINGS,
    setUiLanguage: (v) => set({ uiLanguage: v }),
    setNativeLanguage: (v) => set({ nativeLanguage: v }),
    setBookLanguage: (v) => set({ bookLanguage: v }),
    setTheme: (id, auto = false) => set({ themeId: id, themeAuto: auto }),
    setFontFamilyMode: (v) => set({ fontFamilyMode: v }),
    setFontSize: (v) => set({ fontSize: clamp(v, 15, 26) }),
    setScrollMode: (v) => set({ scrollMode: v }),
    toggleHighlightUnknown: () => set((s) => ({ highlightUnknown: !s.highlightUnknown })),
    toggleShowSentenceTranslation: () => set((s) => ({ showSentenceTranslation: !s.showSentenceTranslation })),
    togglePageFlipAnim: () => set((s) => ({ pageFlipAnim: !s.pageFlipAnim })),
    setBookLanguageLevel: (v) => set({ bookLanguageLevel: v }),
    setTapToTranslateBehavior: (v) => set({ tapToTranslateBehavior: v }),
    setAutoAddToDeck: (v) => set({ autoAddToDeck: v }),
    toggleShowPhonetics: () => set((s) => ({ showPhonetics: !s.showPhonetics })),
    toggleLookupHistoryEnabled: () => set((s) => ({ lookupHistoryEnabled: !s.lookupHistoryEnabled })),
    setReadingSessionGoalMinutes: (v) => set({ readingSessionGoalMinutes: clamp(v, 5, 120) }),
    completeOnboarding: () => set({ onboardingCompleted: true }),
    reset: () => set(DEFAULT_SETTINGS),
  })),
);
```

- [ ] **Step 4:** PASS

- [ ] **Step 5:** Коммит

```bash
git add __tests__/stores/settingsStore.test.ts src/stores/settingsStore.ts
git commit -m "feat(stores): settingsStore с clamping + 19 tests"
```

---

## Phase 5: Icons (3 task)

### Task 19: paths.ts — 26 SVG path strings

- [ ] **Step 1:** `src/components/icons/paths.ts`

```typescript
/** SVG path data для 26 иконок Fluera (port 1:1 из icons.jsx handoff). */
export const PATHS: Record<string, string> = {
  chevronLeft:  'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown:  'M6 9l6 6 6-6',
  closeP1: 'M6 6l12 12',
  closeP2: 'M6 18L18 6',
  searchPath: 'M20 20l-3.5-3.5',
  plusP1: 'M12 5v14',
  plusP2: 'M5 12h14',
  bookP1: 'M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 0-2 2V5z',
  bookP2: 'M4 19h14',
  libraryP1: 'M17 5l3 1-2 14-3-1z',
  sparkle: 'M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z',
  flame: 'M12 3c1 3 4 4 4 8a4 4 0 1 1-8 0c0-1.5.5-2.5 1.5-3.5C10 9 11 6 12 3z',
  graphP1: 'M4 19h16',
  graphP2: 'M6 16V9',
  graphP3: 'M11 16V5',
  graphP4: 'M16 16v-4',
  graphP5: 'M21 16V11',
  cardsP1: 'M7 3h13a1 1 0 0 1 1 1v13',
  play: 'M6 4l14 8-14 8z',
  volumeP1: 'M11 5L6 9H3v6h3l5 4z',
  volumeP2: 'M16 9c1.5 1 1.5 5 0 6',
  bookmark: 'M6 4h12v17l-6-4-6 4z',
  star: 'M12 3l2.7 5.5 6 .9-4.4 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.3 9.4l6-.9z',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  check: 'M5 12l5 5 9-11',
  arrowRightP1: 'M5 12h14',
  arrowRightP2: 'M13 6l6 6-6 6',
  globeP1: 'M3 12h18',
  globeP2: 'M12 3c3 3 3 15 0 18',
  globeP3: 'M12 3c-3 3-3 15 0 18',
  fontSizeP1: 'M3 18l5-12 5 12',
  fontSizeP2: 'M5 14h6',
  fontSizeP3: 'M14 18l4-8 4 8',
  fontSizeP4: 'M15.5 15h5',
  moon: 'M20 14a8 8 0 1 1-10-10 6 6 0 0 0 10 10z',
  layersP1: 'M12 3l9 5-9 5-9-5 9-5z',
  layersP2: 'M3 13l9 5 9-5',
  layersP3: 'M3 17l9 5 9-5',
  settingsGear: 'M19 12a7 7 0 0 0-.2-1.6l2-1.6-2-3.4-2.4.8a7 7 0 0 0-2.8-1.6L13 2h-4l-.6 2.6A7 7 0 0 0 5.6 6.2L3.2 5.4l-2 3.4 2 1.6A7 7 0 0 0 3 12c0 .6.1 1.1.2 1.6l-2 1.6 2 3.4 2.4-.8a7 7 0 0 0 2.8 1.6L9 22h4l.6-2.6a7 7 0 0 0 2.8-1.6l2.4.8 2-3.4-2-1.6c.1-.5.2-1 .2-1.6z',
};
```

Композитные иконки (close, plus, book, arrowRight, fontSize, layers, и т.д.) используют несколько path-ключей с суффиксами P1/P2/... Структура «icon → используемые path-ключи + Circle/Rect» жёстко закодирована в Task 21.

- [ ] **Step 2:** Коммит

```bash
git add src/components/icons/paths.ts
git commit -m "feat(icons): 26 SVG paths from design bundle"
```

---

### Task 20: Icon.tsx — base component

- [ ] **Step 1:** `src/components/icons/Icon.tsx`

```typescript
import React from 'react';
import { Svg } from 'react-native-svg';
import { StyleSheet } from 'react-native-unistyles';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}

const styles = StyleSheet.create((theme) => ({ defaultColor: theme.ink }));

export const Icon: React.FC<IconProps & { children: React.ReactNode }> = ({
  size = 22, color, strokeWidth = 1.8, fill = 'none', children,
}) => {
  const resolvedColor = color ?? styles.defaultColor;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24"
         fill={fill} stroke={resolvedColor} strokeWidth={strokeWidth}
         strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
};
```

- [ ] **Step 2:** Коммит

```bash
git add src/components/icons/Icon.tsx
git commit -m "feat(icons): base Icon component (theme-aware color)"
```

---

### Task 21: index.tsx — 26 named exports

- [ ] **Step 1:** `src/components/icons/index.tsx`

```typescript
import React from 'react';
import { Path, Circle, Rect } from 'react-native-svg';
import { Icon, type IconProps } from './Icon';
import { PATHS } from './paths';

const P = (d: string) => <Path d={d} />;

export const IcChevronLeft  = (p: IconProps) => <Icon {...p}>{P(PATHS.chevronLeft!)}</Icon>;
export const IcChevronRight = (p: IconProps) => <Icon {...p}>{P(PATHS.chevronRight!)}</Icon>;
export const IcChevronDown  = (p: IconProps) => <Icon {...p}>{P(PATHS.chevronDown!)}</Icon>;
export const IcClose = (p: IconProps) => (
  <Icon {...p}>{P(PATHS.closeP1!)}{P(PATHS.closeP2!)}</Icon>
);
export const IcSearch = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={11} cy={11} r={7} />
    {P(PATHS.searchPath!)}
  </Icon>
);
export const IcPlus = (p: IconProps) => (
  <Icon {...p}>{P(PATHS.plusP1!)}{P(PATHS.plusP2!)}</Icon>
);
export const IcBook = (p: IconProps) => (
  <Icon {...p}>{P(PATHS.bookP1!)}{P(PATHS.bookP2!)}</Icon>
);
export const IcLibrary = (p: IconProps) => (
  <Icon {...p}>
    <Rect x={3} y={4} width={6} height={16} rx={1.5} />
    <Rect x={11} y={4} width={4} height={16} rx={1.5} />
    {P(PATHS.libraryP1!)}
  </Icon>
);
export const IcSparkle = (p: IconProps) => <Icon {...p}>{P(PATHS.sparkle!)}</Icon>;
export const IcFlame   = (p: IconProps) => <Icon {...p}>{P(PATHS.flame!)}</Icon>;
export const IcGraph = (p: IconProps) => (
  <Icon {...p}>
    {P(PATHS.graphP1!)}{P(PATHS.graphP2!)}{P(PATHS.graphP3!)}
    {P(PATHS.graphP4!)}{P(PATHS.graphP5!)}
  </Icon>
);
export const IcCards = (p: IconProps) => (
  <Icon {...p}>
    <Rect x={3} y={6} width={13} height={14} rx={2} />
    {P(PATHS.cardsP1!)}
  </Icon>
);
export const IcPlay = (p: IconProps) => (
  <Icon {...p} fill={p.color}>
    <Path d={PATHS.play!} stroke="none" fill={p.color} />
  </Icon>
);
export const IcVolume = (p: IconProps) => (
  <Icon {...p}>{P(PATHS.volumeP1!)}{P(PATHS.volumeP2!)}</Icon>
);
export const IcBookmark = (p: IconProps) => <Icon {...p}>{P(PATHS.bookmark!)}</Icon>;
export const IcStar     = (p: IconProps) => <Icon {...p}>{P(PATHS.star!)}</Icon>;
export const IcHeart    = (p: IconProps) => <Icon {...p}>{P(PATHS.heart!)}</Icon>;
export const IcCheck    = (p: IconProps) => <Icon {...p}>{P(PATHS.check!)}</Icon>;
export const IcArrowRight = (p: IconProps) => (
  <Icon {...p}>{P(PATHS.arrowRightP1!)}{P(PATHS.arrowRightP2!)}</Icon>
);
export const IcGlobe = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={12} cy={12} r={9} />
    {P(PATHS.globeP1!)}{P(PATHS.globeP2!)}{P(PATHS.globeP3!)}
  </Icon>
);
export const IcFontSize = (p: IconProps) => (
  <Icon {...p}>
    {P(PATHS.fontSizeP1!)}{P(PATHS.fontSizeP2!)}
    {P(PATHS.fontSizeP3!)}{P(PATHS.fontSizeP4!)}
  </Icon>
);
export const IcMoon = (p: IconProps) => <Icon {...p}>{P(PATHS.moon!)}</Icon>;
export const IcMore = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={5}  cy={12} r={1.2} fill={p.color} />
    <Circle cx={12} cy={12} r={1.2} fill={p.color} />
    <Circle cx={19} cy={12} r={1.2} fill={p.color} />
  </Icon>
);
export const IcLayers = (p: IconProps) => (
  <Icon {...p}>{P(PATHS.layersP1!)}{P(PATHS.layersP2!)}{P(PATHS.layersP3!)}</Icon>
);
export const IcSettings = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={12} cy={12} r={3} />
    {P(PATHS.settingsGear!)}
  </Icon>
);

export type { IconProps };
```

- [ ] **Step 2:** Typecheck + коммит

```bash
npm run typecheck
git add src/components/icons/index.tsx
git commit -m "feat(icons): 26 named icon exports (1:1 design bundle)"
```

---

## Phase 6: UI Primitives (14 task)

Каждая задача = один файл + опц. тест + коммит.

### Task 22: Hairline

```typescript
// src/components/ui/Hairline.tsx
import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
const styles = StyleSheet.create((theme) => ({
  hairline: { height: 1, backgroundColor: theme.ink, opacity: 0.1 },
}));
export const Hairline: React.FC = () => <View style={styles.hairline} />;
```

Коммит: `feat(ui): Hairline divider`

---

### Task 23: SectionLabel

```typescript
// src/components/ui/SectionLabel.tsx
import React from 'react';
import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
const styles = StyleSheet.create((theme) => ({
  label: {
    fontFamily: 'Inter-SemiBold', fontSize: 11, fontWeight: '600',
    letterSpacing: 0.88, textTransform: 'uppercase', color: theme.ink3,
  },
}));
export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  <Text style={styles.label}>{children}</Text>;
```

Коммит: `feat(ui): SectionLabel`

---

### Task 24: Headline H1/H2/H3

```typescript
// src/components/ui/Headline.tsx
import React from 'react';
import { Text, TextStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  h1: { fontFamily: 'SourceSerif4-Medium', fontSize: 30, lineHeight: 33, letterSpacing: -0.6, color: theme.ink, fontWeight: '500' } satisfies TextStyle,
  h2: { fontFamily: 'SourceSerif4-Medium', fontSize: 22, lineHeight: 26, letterSpacing: -0.22, color: theme.ink, fontWeight: '500' } satisfies TextStyle,
  h3: { fontFamily: 'Inter-SemiBold', fontSize: 16, letterSpacing: -0.16, color: theme.ink, fontWeight: '600' } satisfies TextStyle,
}));

export const Headline: React.FC<{ level: 1|2|3; children: React.ReactNode }> = ({ level, children }) => {
  const style = level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3;
  return <Text style={style}>{children}</Text>;
};
```

Коммит: `feat(ui): Headline H1/H2/H3`

---

### Task 25: Card

```typescript
// src/components/ui/Card.tsx
import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  card: { backgroundColor: `${theme.ink}0A`, borderRadius: 18 } satisfies ViewStyle,
}));

interface Props { children: React.ReactNode; padding?: number; style?: StyleProp<ViewStyle>; }
export const Card: React.FC<Props> = ({ children, padding = 16, style }) =>
  <View style={[styles.card, { padding }, style]}>{children}</View>;
```

Коммит: `feat(ui): Card container`

---

### Task 26: Pill (tone variants)

```typescript
// src/components/ui/Pill.tsx
import React from 'react';
import { View, Text, ViewStyle, TextStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export type PillTone = 'neutral' | 'accent' | 'known' | 'learning';

const styles = StyleSheet.create((theme) => ({
  base: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, alignSelf: 'flex-start' } satisfies ViewStyle,
  text: { fontFamily: 'Inter-Medium', fontSize: 12, fontWeight: '500', letterSpacing: 0.12 } satisfies TextStyle,
  neutralBg:  { backgroundColor: `${theme.ink}0F` },
  neutralFg:  { color: theme.ink2 },
  accentBg:   { backgroundColor: theme.accentSoft },
  accentFg:   { color: theme.accent },
  knownBg:    { backgroundColor: theme.knownSoft },
  knownFg:    { color: theme.known },
  learningBg: { backgroundColor: theme.learningSoft },
  learningFg: { color: theme.learning },
}));

export const Pill: React.FC<{ tone?: PillTone; icon?: React.ReactNode; children: React.ReactNode }> = ({ tone = 'neutral', icon, children }) => {
  const bg = (styles as any)[`${tone}Bg`];
  const fg = (styles as any)[`${tone}Fg`];
  return (
    <View style={[styles.base, bg]}>
      {icon}
      <Text style={[styles.text, fg]}>{children}</Text>
    </View>
  );
};
```

Коммит: `feat(ui): Pill с tone variants`

---

### Task 27: Button (TDD, 7 tests)

- [ ] **Step 1:** Тест `__tests__/components/ui/Button.test.tsx`

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/ui/Button';
import { Text } from 'react-native';

describe('Button', () => {
  test('renders children', () => {
    const { getByText } = render(<Button onPress={() => {}}>Click me</Button>);
    expect(getByText('Click me')).toBeTruthy();
  });
  test('onPress fires', () => {
    const fn = jest.fn();
    const { getByText } = render(<Button onPress={fn}>Tap</Button>);
    fireEvent.press(getByText('Tap'));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  test('disabled prevents onPress', () => {
    const fn = jest.fn();
    const { getByText } = render(<Button onPress={fn} disabled>Tap</Button>);
    fireEvent.press(getByText('Tap'));
    expect(fn).not.toHaveBeenCalled();
  });
  test('icon renders', () => {
    const { getByTestId } = render(
      <Button onPress={() => {}} icon={<Text testID="ic">*</Text>}>Save</Button>
    );
    expect(getByTestId('ic')).toBeTruthy();
  });
  test.each(['primary','accent','ghost'] as const)('variant=%s', (variant) => {
    const { getByText } = render(<Button onPress={() => {}} variant={variant}>Btn</Button>);
    expect(getByText('Btn')).toBeTruthy();
  });
});
```

- [ ] **Step 2:** FAIL

- [ ] **Step 3:** `src/components/ui/Button.tsx`

```typescript
import React from 'react';
import { Pressable, Text, ViewStyle, TextStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export type ButtonVariant = 'primary' | 'accent' | 'ghost';

interface Props {
  variant?: ButtonVariant;
  block?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  onPress: () => void;
  children: React.ReactNode;
}

const styles = StyleSheet.create((theme) => ({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18 } satisfies ViewStyle,
  block: { width: '100%', paddingVertical: 16 } satisfies ViewStyle,
  text: { fontFamily: 'Inter-SemiBold', fontSize: 15, fontWeight: '600', letterSpacing: -0.15 } satisfies TextStyle,
  blockText: { fontSize: 16 } satisfies TextStyle,
  primaryBg:   { backgroundColor: theme.ink },
  primaryText: { color: theme.paper },
  accentBg:    { backgroundColor: theme.accent },
  accentText:  { color: '#FFFFFF' },
  ghostBg:     { backgroundColor: 'transparent', borderWidth: 1, borderColor: `${theme.ink}26` } satisfies ViewStyle,
  ghostText:   { color: theme.ink },
  pressed:  { opacity: 0.7 },
  disabled: { opacity: 0.4 },
}));

export const Button: React.FC<Props> = ({
  variant = 'primary', block = false, disabled = false, icon, onPress, children,
}) => {
  const bg = (styles as any)[`${variant}Bg`];
  const fg = (styles as any)[`${variant}Text`];
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base, bg,
        block && styles.block,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {icon}
      <Text style={[styles.text, fg, block && styles.blockText]}>{children}</Text>
    </Pressable>
  );
};
```

- [ ] **Step 4:** PASS — 7 tests

- [ ] **Step 5:** Коммит `feat(ui): Button primary/accent/ghost + tests`

---

### Task 28: IconBtn

```typescript
// src/components/ui/IconBtn.tsx
import React from 'react';
import { Pressable, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { HIT_SLOP_DEFAULT } from '@/utils/constants';

interface Props {
  onPress: () => void;
  solid?: boolean;
  accent?: boolean;
  children: React.ReactNode;
  accessibilityLabel?: string;
}

const styles = StyleSheet.create((theme) => ({
  base: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${theme.ink}0F` } satisfies ViewStyle,
  solid:  { backgroundColor: theme.ink },
  accent: { backgroundColor: theme.accent },
  pressed: { opacity: 0.6 },
}));

export const IconBtn: React.FC<Props> = ({ onPress, solid = false, accent = false, children, accessibilityLabel }) => (
  <Pressable
    onPress={onPress}
    hitSlop={HIT_SLOP_DEFAULT}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    style={({ pressed }) => [
      styles.base,
      solid && styles.solid,
      accent && styles.accent,
      pressed && styles.pressed,
    ]}
  >
    {children}
  </Pressable>
);
```

Коммит: `feat(ui): IconBtn 36x36 c solid/accent`

---

### Task 29: ProgressBar

```typescript
// src/components/ui/ProgressBar.tsx
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export type ProgressTone = 'ink' | 'accent';
interface Props { value: number; height?: number; tone?: ProgressTone; }

const styles = StyleSheet.create((theme) => ({
  track: { width: '100%', backgroundColor: `${theme.ink}1A`, borderRadius: 999, overflow: 'hidden' } satisfies ViewStyle,
  fillInk:    { backgroundColor: theme.ink, height: '100%', borderRadius: 999 } as ViewStyle,
  fillAccent: { backgroundColor: theme.accent, height: '100%', borderRadius: 999 } as ViewStyle,
}));

export const ProgressBar: React.FC<Props> = ({ value, height = 3, tone = 'accent' }) => {
  const clamped = Math.max(0, Math.min(1, value));
  const fill = tone === 'accent' ? styles.fillAccent : styles.fillInk;
  return (
    <View style={[styles.track, { height }]}>
      <View style={[fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
};
```

Коммит: `feat(ui): ProgressBar`

---

### Task 30: Stat

```typescript
// src/components/ui/Stat.tsx
import React from 'react';
import { View, Text, ViewStyle, TextStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface Props { num: string|number; label: string; delta?: string; deltaTone?: 'known'|'learning'|'ink2'; }

const styles = StyleSheet.create((theme) => ({
  wrap: { flexDirection: 'column', gap: 2 } satisfies ViewStyle,
  row:  { flexDirection: 'row', alignItems: 'baseline', gap: 4 } satisfies ViewStyle,
  num:  { fontFamily: 'SourceSerif4-Medium', fontSize: 32, fontWeight: '500', letterSpacing: -0.64, color: theme.ink } satisfies TextStyle,
  label:{ fontFamily: 'Inter-SemiBold', fontSize: 11, fontWeight: '600', letterSpacing: 0.88, textTransform: 'uppercase', color: theme.ink3 } satisfies TextStyle,
  delta:{ fontFamily: 'Inter-SemiBold', fontSize: 12, fontWeight: '600' } satisfies TextStyle,
  dKnown:    { color: theme.known },
  dLearning: { color: theme.learning },
  dInk2:     { color: theme.ink2 },
}));

export const Stat: React.FC<Props> = ({ num, label, delta, deltaTone = 'known' }) => {
  const tone = deltaTone === 'known' ? styles.dKnown : deltaTone === 'learning' ? styles.dLearning : styles.dInk2;
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Text style={styles.num}>{num}</Text>
        {delta && <Text style={[styles.delta, tone]}>{delta}</Text>}
      </View>
    </View>
  );
};
```

Коммит: `feat(ui): Stat numeric card`

---

### Task 31: PhoneShell

```typescript
// src/components/ui/PhoneShell.tsx
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  shell: { flex: 1, backgroundColor: theme.paper } satisfies ViewStyle,
}));

export const PhoneShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  return <View style={[styles.shell, { paddingTop: insets.top }]}>{children}</View>;
};
```

Коммит: `feat(ui): PhoneShell SafeArea wrapper`

---

### Task 32: BookCover (gradient via expo-linear-gradient)

```typescript
// src/components/ui/BookCover.tsx
import React from 'react';
import { View, Text, ViewStyle, TextStyle, StyleSheet as RN } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export interface BookCoverData {
  title: string;
  author: string;
  gradient: readonly [string, string, ...string[]];
  angle?: number;
}

interface Props { book: BookCoverData; w?: number; h?: number; }

const local = RN.create({
  wrap: { overflow: 'hidden', borderRadius: 6 } satisfies ViewStyle,
  gradient: { ...RN.absoluteFillObject } satisfies ViewStyle,
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '6%', backgroundColor: 'rgba(0,0,0,0.15)' } satisfies ViewStyle,
  title: { position: 'absolute', left: 8, right: 8, top: 10, fontSize: 10, color: 'rgba(255,255,255,0.9)', fontFamily: 'SourceSerif4-Medium', lineHeight: 12 } satisfies TextStyle,
  author:{ position: 'absolute', left: 8, right: 8, bottom: 10, fontSize: 7, color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter-SemiBold', letterSpacing: 0.42, textTransform: 'uppercase' } satisfies TextStyle,
});

function angleToPoints(deg: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  const x = Math.cos(rad), y = Math.sin(rad);
  return { start: { x: 0.5 - x / 2, y: 0.5 - y / 2 }, end: { x: 0.5 + x / 2, y: 0.5 + y / 2 } };
}

export const BookCover: React.FC<Props> = ({ book, w = 78, h = 108 }) => {
  const { start, end } = angleToPoints(book.angle ?? 160);
  return (
    <View style={[local.wrap, { width: w, height: h }]}>
      <LinearGradient colors={book.gradient as any} start={start} end={end} style={local.gradient} />
      <View style={local.spine} />
      <Text style={local.title} numberOfLines={3}>{book.title}</Text>
      <Text style={local.author} numberOfLines={1}>{book.author}</Text>
    </View>
  );
};
```

Коммит: `feat(ui): BookCover gradient + spine + title/author`

---

### Task 33: Sheet (TDD, 2 tests) — gorhom wrapper

- [ ] **Step 1:** Тест `__tests__/components/ui/Sheet.test.tsx`

```typescript
import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Sheet, SheetRef } from '@/components/ui/Sheet';

describe('Sheet', () => {
  test('renders children', () => {
    const { getByText } = render(<Sheet snapPoints={['50%']}><Text>Inside</Text></Sheet>);
    expect(getByText('Inside')).toBeTruthy();
  });
  test('ref pass-through', () => {
    const ref = React.createRef<SheetRef>();
    render(<Sheet ref={ref} snapPoints={['50%']}><Text>x</Text></Sheet>);
    expect(ref).toBeTruthy();
  });
});
```

- [ ] **Step 2:** FAIL

- [ ] **Step 3:** `src/components/ui/Sheet.tsx`

```typescript
import React, { forwardRef, useCallback } from 'react';
import { ViewStyle } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetBackdropProps, BottomSheetView } from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';

export type SheetRef = BottomSheet;
interface Props { snapPoints: readonly (string|number)[]; onClose?: () => void; children: React.ReactNode; }

const styles = StyleSheet.create((theme) => ({
  bg: { backgroundColor: theme.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28 } satisfies ViewStyle,
  handle: { backgroundColor: `${theme.ink}2E`, width: 36, height: 4, borderRadius: 99 } satisfies ViewStyle,
  content: { paddingHorizontal: 22, paddingBottom: 32 } satisfies ViewStyle,
}));

export const Sheet = forwardRef<SheetRef, Props>(({ snapPoints, onClose, children }, ref) => {
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.15} />
    ),
    [],
  );
  const handleChange = useCallback((i: number) => { if (i === -1) onClose?.(); }, [onClose]);
  return (
    <BottomSheet ref={ref} snapPoints={snapPoints as (string|number)[]} index={-1}
      enablePanDownToClose backgroundStyle={styles.bg} handleIndicatorStyle={styles.handle}
      backdropComponent={renderBackdrop} onChange={handleChange}>
      <BottomSheetView style={styles.content}>{children}</BottomSheetView>
    </BottomSheet>
  );
});
Sheet.displayName = 'Sheet';
```

- [ ] **Step 4:** PASS

- [ ] **Step 5:** Коммит `feat(ui): Sheet wrapper над gorhom bottom-sheet + tests`

---

### Task 34: TabBar (TDD, 2 tests) — blur tab-bar

- [ ] **Step 1:** Установить `@react-navigation/bottom-tabs` (для типа)

```bash
npx expo install @react-navigation/native @react-navigation/bottom-tabs
```

- [ ] **Step 2:** Тест `__tests__/components/ui/TabBar.test.tsx`

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TabBar } from '@/components/ui/TabBar';

const stub = {
  state: { index: 0, routes: [
    { key: 'index', name: 'index' }, { key: 'deck', name: 'deck' },
    { key: 'stats', name: 'stats' }, { key: 'settings', name: 'settings' },
  ]},
  descriptors: {} as any,
  navigation: {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
  } as any,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

describe('TabBar', () => {
  test('renders 4 tabs', () => {
    const { getByText } = render(<TabBar {...(stub as any)} />);
    expect(getByText('READ')).toBeTruthy();
    expect(getByText('DECK')).toBeTruthy();
    expect(getByText('STATS')).toBeTruthy();
    expect(getByText('YOU')).toBeTruthy();
  });
  test('tap calls navigation.navigate', () => {
    const props = { ...stub, navigation: { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() } as any };
    const { getByText } = render(<TabBar {...(props as any)} />);
    fireEvent.press(getByText('DECK'));
    expect(props.navigation.navigate).toHaveBeenCalledWith('deck');
  });
});
```

- [ ] **Step 3:** FAIL

- [ ] **Step 4:** `src/components/ui/TabBar.tsx`

```typescript
import React from 'react';
import { Pressable, Text, View, ViewStyle, TextStyle, Platform, StyleSheet as RN } from 'react-native';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native-unistyles';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { IcBook, IcCards, IcGraph, IcSettings } from '@/components/icons';

const TAB_META: Record<string, { label: string; Ic: React.FC<{ size?: number; color?: string }> }> = {
  index:    { label: 'READ',  Ic: IcBook },
  deck:     { label: 'DECK',  Ic: IcCards },
  stats:    { label: 'STATS', Ic: IcGraph },
  settings: { label: 'YOU',   Ic: IcSettings },
};

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    position: 'absolute',
    left: 14, right: 14,
    bottom: 18 + rt.insets.bottom,
    height: 60,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  } satisfies ViewStyle,
  blurBg: {
    ...RN.absoluteFillObject,
    backgroundColor: `${theme.paper}E0`,
  } satisfies ViewStyle,
  row: { flex: 1, flexDirection: 'row', paddingHorizontal: 6 } satisfies ViewStyle,
  tab: {
    flex: 1, flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 2, paddingVertical: 6, borderRadius: 14,
  } satisfies ViewStyle,
  label: {
    fontFamily: 'Inter-SemiBold', fontSize: 10, fontWeight: '600',
    letterSpacing: 0.2, color: theme.ink3,
  } satisfies TextStyle,
  labelActive: { color: theme.ink },
  dot: { width: 4, height: 4, borderRadius: 99, backgroundColor: 'transparent', marginTop: 2 } satisfies ViewStyle,
  dotActive: { backgroundColor: theme.accent },
}));

export const TabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => (
  <View style={styles.container}>
    <BlurView
      intensity={80}
      tint="default"
      experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : 'none'}
      style={RN.absoluteFillObject}
    />
    <View style={styles.blurBg} />
    <View style={styles.row}>
      {state.routes.map((route, index) => {
        const meta = TAB_META[route.name];
        if (!meta) return null;
        const isActive = state.index === index;
        const onPress = () => {
          const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isActive && !ev.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable key={route.key} onPress={onPress} style={styles.tab}>
            <meta.Ic size={20} />
            <Text style={[styles.label, isActive && styles.labelActive]}>{meta.label}</Text>
            <View style={[styles.dot, isActive && styles.dotActive]} />
          </Pressable>
        );
      })}
    </View>
  </View>
);
```

- [ ] **Step 5:** PASS, коммит `feat(ui): TabBar 4-tab floating с blur (TDD)`

---

### Task 35: ui/index.ts barrel

```typescript
export { Button } from './Button';
export type { ButtonVariant } from './Button';
export { Pill } from './Pill';
export type { PillTone } from './Pill';
export { Card } from './Card';
export { Sheet } from './Sheet';
export type { SheetRef } from './Sheet';
export { IconBtn } from './IconBtn';
export { Hairline } from './Hairline';
export { BookCover } from './BookCover';
export type { BookCoverData } from './BookCover';
export { Headline } from './Headline';
export { SectionLabel } from './SectionLabel';
export { Stat } from './Stat';
export { TabBar } from './TabBar';
export { PhoneShell } from './PhoneShell';
export { ProgressBar } from './ProgressBar';
export type { ProgressTone } from './ProgressBar';
```

Коммит: `feat(ui): barrel export`

---

## Phase 7: i18n

### Task 36: locale JSON-файлы en/ru/pl/uk

- [ ] **Step 1:** Создать 4 JSON в `src/i18n/locales/`. Минимальный набор ключей:
  - `common.*` (continue/skip/next/back/close)
  - `tabs.*` (read/deck/stats/you)
  - `onboarding.step1.title`, `step2.title`, `step3.title`
  - `settings.theme.*` (title/day/sepia/night/auto)
  - `settings.font.*` (title/size/typeface/serif/sans)
  - `library.empty`

Шаблон en.json (остальные — переводы):

```json
{
  "common": { "continue": "Continue", "skip": "Skip", "next": "Next", "back": "Back", "close": "Close" },
  "tabs": { "read": "READ", "deck": "DECK", "stats": "STATS", "you": "YOU" },
  "onboarding": {
    "step1": { "title": "Welcome to Fluera" },
    "step2": { "title": "I am reading in..." },
    "step3": { "title": "Translate to..." }
  },
  "settings": {
    "theme": { "title": "Paper", "day": "Day", "sepia": "Sepia", "night": "Night", "auto": "Auto Day/Night" },
    "font":  { "title": "Reading", "size": "Size", "typeface": "Typeface", "serif": "Source Serif", "sans": "Geist" }
  },
  "library": { "empty": "No books yet" }
}
```

`src/i18n/locales/ru.json`:

```json
{
  "common": { "continue": "Продолжить", "skip": "Пропустить", "next": "Далее", "back": "Назад", "close": "Закрыть" },
  "tabs": { "read": "ЧТЕНИЕ", "deck": "КАРТЫ", "stats": "СТАТ.", "you": "ВЫ" },
  "onboarding": {
    "step1": { "title": "Добро пожаловать в Fluera" },
    "step2": { "title": "Я читаю на..." },
    "step3": { "title": "Переводить на..." }
  },
  "settings": {
    "theme": { "title": "Бумага", "day": "День", "sepia": "Сепия", "night": "Ночь", "auto": "Авто День/Ночь" },
    "font":  { "title": "Чтение", "size": "Размер", "typeface": "Шрифт", "serif": "Source Serif", "sans": "Geist" }
  },
  "library": { "empty": "Книг пока нет" }
}
```

`src/i18n/locales/pl.json`:

```json
{
  "common": { "continue": "Kontynuuj", "skip": "Pomiń", "next": "Dalej", "back": "Wstecz", "close": "Zamknij" },
  "tabs": { "read": "CZYTAJ", "deck": "TALIA", "stats": "STAT.", "you": "TY" },
  "onboarding": {
    "step1": { "title": "Witaj w Fluera" },
    "step2": { "title": "Czytam w..." },
    "step3": { "title": "Tłumacz na..." }
  },
  "settings": {
    "theme": { "title": "Papier", "day": "Dzień", "sepia": "Sepia", "night": "Noc", "auto": "Auto Dzień/Noc" },
    "font":  { "title": "Czytanie", "size": "Rozmiar", "typeface": "Krój pisma", "serif": "Source Serif", "sans": "Geist" }
  },
  "library": { "empty": "Brak książek" }
}
```

`src/i18n/locales/uk.json`:

```json
{
  "common": { "continue": "Продовжити", "skip": "Пропустити", "next": "Далі", "back": "Назад", "close": "Закрити" },
  "tabs": { "read": "ЧИТАННЯ", "deck": "КАРТКИ", "stats": "СТАТ.", "you": "ВИ" },
  "onboarding": {
    "step1": { "title": "Ласкаво просимо до Fluera" },
    "step2": { "title": "Я читаю мовою..." },
    "step3": { "title": "Перекладати на..." }
  },
  "settings": {
    "theme": { "title": "Папір", "day": "День", "sepia": "Сепія", "night": "Ніч", "auto": "Авто День/Ніч" },
    "font":  { "title": "Читання", "size": "Розмір", "typeface": "Шрифт", "serif": "Source Serif", "sans": "Geist" }
  },
  "library": { "empty": "Книг ще немає" }
}
```

- [ ] **Step 2:** Коммит `feat(i18n): локали en/ru/pl/uk`

---

### Task 37: i18n/index.ts

```typescript
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './locales/en.json';
import ru from './locales/ru.json';
import pl from './locales/pl.json';
import uk from './locales/uk.json';

const SUPPORTED = ['en','ru','pl','uk'] as const;
type SupportedLang = (typeof SUPPORTED)[number];

function detectInitialLang(): SupportedLang {
  const sys = Localization.getLocales()[0]?.languageCode ?? 'en';
  return (SUPPORTED as readonly string[]).includes(sys) ? (sys as SupportedLang) : 'en';
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ru: { translation: ru },
               pl: { translation: pl }, uk: { translation: uk } },
  lng: detectInitialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
```

Коммит: `feat(i18n): i18next init + expo-localization detection`

---

## Phase 8: Borges Fixture

### Task 38: src/fixtures/borges.ts

```typescript
import type { BookChapter, InlineNode } from '@/types/content';

const text = (s: string): InlineNode => ({ type: 'text', text: s });

export const BORGES_SAMPLE: BookChapter = {
  index: 0,
  title: 'I.',
  items: [
    { type: 'paragraph', inlines: [text('On a pale October morning, the tide withdrew further than anyone could remember, leaving the wharf of Vigàta open to the sky like the page of an old atlas.')] },
    { type: 'paragraph', inlines: [text('Stephen wandered between the abandoned boats, counting the small pebbles his daughter had once arranged in the shape of a constellation. He had not been here since the autumn she left.')] },
    { type: 'paragraph', inlines: [text('It was, he thought, the kind of silence that exists only in places that have surrendered their use.')] },
  ],
};

export const BORGES_DICT: Record<string, string> = {
  on: 'на', a: '(артикль)', pale: 'бледный', october: 'октябрь',
  morning: 'утро', the: '(артикль)', tide: 'прилив', withdrew: 'отступил',
  further: 'дальше', than: 'чем', anyone: 'кто-либо', could: 'мог',
  remember: 'помнить', leaving: 'оставляя', wharf: 'пристань', of: '(предлог)',
  open: 'открытый', to: '(предлог)', sky: 'небо', like: 'как',
  page: 'страница', an: '(артикль)', old: 'старый', atlas: 'атлас',
  stephen: 'Стивен', wandered: 'бродил', between: 'между',
  abandoned: 'заброшенный', boats: 'лодки', counting: 'считая',
  small: 'маленькие', pebbles: 'галька', his: 'его', daughter: 'дочь',
  had: '(вспом.)', once: 'однажды', arranged: 'расставила', in: 'в',
  shape: 'форма', constellation: 'созвездие', he: 'он', not: 'не',
  been: 'был', here: 'здесь', since: 'с тех пор как', autumn: 'осень',
  she: 'она', left: 'ушла', it: 'это', was: 'было', thought: 'подумал',
  kind: 'вид', silence: 'тишина', that: 'который', exists: 'существует',
  only: 'только', places: 'места', have: 'имеют', surrendered: 'сдались',
  their: 'их', use: 'использование',
};
```

Коммит: `feat(fixtures): Borges-сэмпл BookChapter + RU-словарь`

---

## Phase 9: Fonts

### Task 39: Скачать 38 .ttf

Ручная операция. Скачать и положить в `assets/fonts/`:

| Семейство | Источник | Файлы |
|---|---|---|
| Geist (UI Latin) | vercel.com/font | Geist-{Regular,Medium,SemiBold,Bold}.ttf, GeistMono-{Regular,Medium}.ttf |
| Source Serif 4 | Google Fonts | SourceSerif4-{Regular,Medium,SemiBold,Italic,MediumItalic}.ttf |
| Inter | Google Fonts | Inter-{Regular,Medium,SemiBold,Bold}.ttf |
| Lora (Cyrillic) | Google Fonts | Lora-{Regular,Medium,SemiBold,Italic,MediumItalic}.ttf |
| Shippori Mincho B1 | Google Fonts | ShipporiMinchoB1-{Regular,Medium}.ttf |
| Noto Sans JP | Google Fonts | NotoSansJP-{Regular,Medium,Bold}.ttf |
| Noto Serif KR | Google Fonts | NotoSerifKR-{Regular,Medium}.ttf |
| Noto Sans KR | Google Fonts | NotoSansKR-{Regular,Medium,Bold}.ttf |
| Amiri (AR) | Google Fonts | Amiri-{Regular,Italic,Bold}.ttf |
| Noto Sans Arabic | Google Fonts | NotoSansArabic-{Regular,Medium}.ttf |
| Tiro Devanagari Hindi | Google Fonts | TiroDevanagariHindi-{Regular,Italic}.ttf |
| Noto Sans Devanagari | Google Fonts | NotoSansDevanagari-{Regular,Medium}.ttf |

- [ ] **Step 1:** Скачать архивы с указанных источников, распаковать `.ttf` в `assets/fonts/` с указанными именами (переименовать если архив содержит вариативные шрифты).

- [ ] **Step 2:** Проверить число файлов

```bash
ls assets/fonts/*.ttf | wc -l
```

Expected: 38.

- [ ] **Step 3:** Коммит

```bash
git add assets/fonts/*.ttf
git commit -m "chore(assets): 38 .ttf шрифтов для 6 скриптов"
```

---

### Task 40: app.json — expo-font config plugin

- [ ] **Step 1:** Заменить `app.json`:

```json
{
  "expo": {
    "name": "Fluera",
    "slug": "fluera",
    "version": "0.1.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "fluera",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#F5EFE4"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.fluera.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#F5EFE4"
      },
      "package": "com.fluera.app",
      "edgeToEdgeEnabled": true
    },
    "web": { "favicon": "./assets/favicon.png", "bundler": "metro" },
    "plugins": [
      "expo-router",
      ["expo-font", {
        "fonts": [
          "./assets/fonts/Geist-Regular.ttf",
          "./assets/fonts/Geist-Medium.ttf",
          "./assets/fonts/Geist-SemiBold.ttf",
          "./assets/fonts/Geist-Bold.ttf",
          "./assets/fonts/GeistMono-Regular.ttf",
          "./assets/fonts/GeistMono-Medium.ttf",
          "./assets/fonts/SourceSerif4-Regular.ttf",
          "./assets/fonts/SourceSerif4-Medium.ttf",
          "./assets/fonts/SourceSerif4-SemiBold.ttf",
          "./assets/fonts/SourceSerif4-Italic.ttf",
          "./assets/fonts/SourceSerif4-MediumItalic.ttf",
          "./assets/fonts/Inter-Regular.ttf",
          "./assets/fonts/Inter-Medium.ttf",
          "./assets/fonts/Inter-SemiBold.ttf",
          "./assets/fonts/Inter-Bold.ttf",
          "./assets/fonts/Lora-Regular.ttf",
          "./assets/fonts/Lora-Medium.ttf",
          "./assets/fonts/Lora-SemiBold.ttf",
          "./assets/fonts/Lora-Italic.ttf",
          "./assets/fonts/Lora-MediumItalic.ttf",
          "./assets/fonts/ShipporiMinchoB1-Regular.ttf",
          "./assets/fonts/ShipporiMinchoB1-Medium.ttf",
          "./assets/fonts/NotoSansJP-Regular.ttf",
          "./assets/fonts/NotoSansJP-Medium.ttf",
          "./assets/fonts/NotoSansJP-Bold.ttf",
          "./assets/fonts/NotoSerifKR-Regular.ttf",
          "./assets/fonts/NotoSerifKR-Medium.ttf",
          "./assets/fonts/NotoSansKR-Regular.ttf",
          "./assets/fonts/NotoSansKR-Medium.ttf",
          "./assets/fonts/NotoSansKR-Bold.ttf",
          "./assets/fonts/Amiri-Regular.ttf",
          "./assets/fonts/Amiri-Italic.ttf",
          "./assets/fonts/Amiri-Bold.ttf",
          "./assets/fonts/NotoSansArabic-Regular.ttf",
          "./assets/fonts/NotoSansArabic-Medium.ttf",
          "./assets/fonts/TiroDevanagariHindi-Regular.ttf",
          "./assets/fonts/TiroDevanagariHindi-Italic.ttf",
          "./assets/fonts/NotoSansDevanagari-Regular.ttf",
          "./assets/fonts/NotoSansDevanagari-Medium.ttf"
        ]
      }]
    ],
    "experiments": { "typedRoutes": true }
  }
}
```

В `package.json` должно быть `"main": "expo-router/entry"`.

- [ ] **Step 2:** Удалить App.tsx и index.ts (expo-router использует app/ entry)

```bash
rm -f App.tsx index.ts
```

- [ ] **Step 3:** Коммит

```bash
git add app.json package.json
git commit -m "chore: app.json с expo-router + expo-font config plugin (38 fonts)"
```

---

## Phase 10: Navigation Shell

### Task 41: app/_layout.tsx — root Stack + bridge mount

- [ ] **Step 1:** Создать `app/_layout.tsx` (полный код в спеке §11.1 + bridge mount + routing decision):

```typescript
import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';

import '@/theme';                                 // side-effect: StyleSheet.configure
import { attachThemeBridge } from '@/theme/bridge';
import { useSettingsStore } from '@/stores/settingsStore';
import '@/i18n';                                  // side-effect: i18next init

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);

  useEffect(() => {
    const unsubscribe = attachThemeBridge();
    void SplashScreen.hideAsync();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (onboardingCompleted) router.replace('/(tabs)');
    else router.replace('/(onboarding)');
  }, [onboardingCompleted, router]);

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(playground)" />
          <Stack.Screen name="reader/[bookId]" />
          <Stack.Screen name="word/[wordId]" options={{ presentation: 'transparentModal', animation: 'fade' }} />
          <Stack.Screen name="deck/session" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="import" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 2:** Коммит `feat(app): root layout + bridge mount + routing decision`

---

### Task 42: +not-found.tsx

```typescript
// app/+not-found.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Link } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: theme.paper },
  text: { color: theme.ink, fontFamily: 'SourceSerif4-Medium', fontSize: 22, marginBottom: 12 },
  link: { color: theme.accent, fontFamily: 'Inter-SemiBold', fontSize: 15 },
}));

export default function NotFound() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>Страница не найдена</Text>
      <Link href="/(tabs)" style={styles.link}>Вернуться</Link>
    </View>
  );
}
```

Коммит: `feat(app): +not-found stub`

---

### Task 43: (onboarding) — 3 step stubs

- [ ] **Step 1:** `app/(onboarding)/_layout.tsx`

```typescript
import { Stack } from 'expo-router';
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2:** `app/(onboarding)/index.tsx`

```typescript
import React from 'react';
import { View, Text } from 'react-native';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import { PhoneShell, Headline, SectionLabel, Button } from '@/components/ui';

const styles = StyleSheet.create((theme) => ({
  content: { flex: 1, padding: 22, justifyContent: 'space-between' },
  inner: { gap: 12 },
  hint: { color: theme.ink2, fontFamily: 'SourceSerif4-Regular', fontSize: 16, marginTop: 6 },
}));

export default function OnboardingStep1() {
  const { t } = useTranslation();
  return (
    <PhoneShell>
      <View style={styles.content}>
        <View style={styles.inner}>
          <SectionLabel>Step 1 / 3</SectionLabel>
          <Headline level={1}>{t('onboarding.step1.title')}</Headline>
          <Text style={styles.hint}>Stub — финальный UI-lang picker в #8.</Text>
        </View>
        <Link href="/(onboarding)/book-lang" asChild>
          <Button block onPress={() => {}}>{t('common.continue')}</Button>
        </Link>
      </View>
    </PhoneShell>
  );
}
```

- [ ] **Step 3:** `app/(onboarding)/book-lang.tsx` — копия шага 1, но:
  - `SectionLabel`: "Step 2 / 3"
  - `Headline`: `t('onboarding.step2.title')`
  - `hint`: "Stub — book-lang picker реализуется в #8."
  - `Link href="/(onboarding)/native-lang"`

- [ ] **Step 4:** `app/(onboarding)/native-lang.tsx`

```typescript
import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import { PhoneShell, Headline, SectionLabel, Button } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';

const styles = StyleSheet.create((theme) => ({
  content: { flex: 1, padding: 22, justifyContent: 'space-between' },
  inner: { gap: 12 },
  hint: { color: theme.ink2, fontFamily: 'SourceSerif4-Regular', fontSize: 16, marginTop: 6 },
}));

export default function OnboardingStep3() {
  const { t } = useTranslation();
  const router = useRouter();
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const onFinish = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };
  return (
    <PhoneShell>
      <View style={styles.content}>
        <View style={styles.inner}>
          <SectionLabel>Step 3 / 3</SectionLabel>
          <Headline level={1}>{t('onboarding.step3.title')}</Headline>
          <Text style={styles.hint}>Stub — native-lang picker в #8. Press Finish to enter app.</Text>
        </View>
        <Button block onPress={onFinish}>Finish</Button>
      </View>
    </PhoneShell>
  );
}
```

- [ ] **Step 5:** Коммит `feat(app): (onboarding) 3-step stub flow`

---

### Task 44: (tabs) layout + 4 экрана

- [ ] **Step 1:** `app/(tabs)/_layout.tsx`

```typescript
import { Tabs } from 'expo-router';
import { TabBar } from '@/components/ui/TabBar';
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <TabBar {...p} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="deck" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
```

- [ ] **Step 2:** `app/(tabs)/index.tsx` — Library

```typescript
import React from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import {
  PhoneShell, Headline, SectionLabel, BookCover, Pill, ProgressBar,
} from '@/components/ui';

const styles = StyleSheet.create((theme) => ({
  header: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12 },
  cardWrap: { paddingHorizontal: 18, paddingBottom: 14 },
  card: {
    backgroundColor: theme.paper2, borderRadius: 22, padding: 18,
    flexDirection: 'row', gap: 16,
  },
  meta: { flex: 1, justifyContent: 'space-between' },
  pills: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
}));

export default function LibraryScreen() {
  const router = useRouter();
  return (
    <PhoneShell>
      <View style={styles.header}>
        <SectionLabel>Tuesday, 15 May</SectionLabel>
        <View style={{ height: 2 }} />
        <Headline level={1}>Library</Headline>
      </View>
      <View style={styles.cardWrap}>
        <Pressable onPress={() => router.push('/reader/borges')} style={styles.card}>
          <BookCover
            book={{
              title: 'The Garden of Forking Paths',
              author: 'J. L. Borges',
              gradient: ['#C0392B', '#8B2A1F', '#5C1810'],
            }}
            w={92}
            h={130}
          />
          <View style={styles.meta}>
            <View>
              <Headline level={3}>{'The Garden of Forking Paths'}</Headline>
              <View style={styles.pills}>
                <Pill>EN</Pill>
                <Pill tone="accent">14-day streak</Pill>
              </View>
            </View>
            <View style={styles.bottom}>
              <View style={{ flex: 1 }}><ProgressBar value={0.13} tone="accent" /></View>
            </View>
          </View>
        </Pressable>
      </View>
    </PhoneShell>
  );
}
```

- [ ] **Step 3:** `app/(tabs)/deck.tsx`

```typescript
import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { PhoneShell, Headline, SectionLabel } from '@/components/ui';

const styles = StyleSheet.create((theme) => ({
  content: { padding: 22, gap: 8 },
  hint: { color: theme.ink2, fontFamily: 'SourceSerif4-Regular', fontSize: 16, marginTop: 6 },
}));

export default function DeckScreen() {
  return (
    <PhoneShell>
      <View style={styles.content}>
        <SectionLabel>Foundation stub</SectionLabel>
        <Headline level={1}>Deck</Headline>
        <Text style={styles.hint}>SRS flashcards — sub-project #6.</Text>
      </View>
    </PhoneShell>
  );
}
```

- [ ] **Step 4:** `app/(tabs)/stats.tsx` — структура идентична deck.tsx, заменить:
  - `Headline`: "Your reading"
  - `hint`: "Streaks/charts/achievements — sub-project #7."

- [ ] **Step 5:** `app/(tabs)/settings.tsx`

```typescript
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { PhoneShell, Headline, SectionLabel } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  ThemeId, BookLanguage, SUPPORTED_BOOK_LANGUAGES,
} from '@/types/settings';

const themes: { id: ThemeId; name: string }[] = [
  { id: 'light', name: 'Day'   },
  { id: 'sepia', name: 'Sepia' },
  { id: 'dark',  name: 'Night' },
];

const styles = StyleSheet.create((theme) => ({
  content: { padding: 22, gap: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: `${theme.ink}0F` },
  chipActive: { backgroundColor: theme.ink },
  chipText: { color: theme.ink, fontFamily: 'Inter-SemiBold' },
  chipTextActive: { color: theme.paper },
}));

export default function SettingsScreen() {
  const themeId   = useSettingsStore((s) => s.themeId);
  const themeAuto = useSettingsStore((s) => s.themeAuto);
  const setTheme  = useSettingsStore((s) => s.setTheme);
  const bookLang  = useSettingsStore((s) => s.bookLanguage);
  const setLang   = useSettingsStore((s) => s.setBookLanguage);

  return (
    <PhoneShell>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <SectionLabel>Paper</SectionLabel>
          <View style={[styles.row, { marginTop: 8 }]}>
            {themes.map(t => {
              const active = !themeAuto && themeId === t.id;
              return (
                <Pressable key={t.id} onPress={() => setTheme(t.id, false)}
                  style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.name}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setTheme(themeId, !themeAuto)}
              style={[styles.chip, themeAuto && styles.chipActive]}>
              <Text style={[styles.chipText, themeAuto && styles.chipTextActive]}>Auto</Text>
            </Pressable>
          </View>
        </View>

        <View>
          <SectionLabel>Book language (smoke)</SectionLabel>
          <View style={[styles.row, { marginTop: 8 }]}>
            {SUPPORTED_BOOK_LANGUAGES.map(l => {
              const active = bookLang === l;
              return (
                <Pressable key={l} onPress={() => setLang(l as BookLanguage)}
                  style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{l}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Headline level={3}>Остальные настройки → sub-project #8 Onboarding polish.</Headline>
      </ScrollView>
    </PhoneShell>
  );
}
```

- [ ] **Step 6:** Коммит `feat(app): (tabs) layout + Library card + Settings ThemePicker`

---

### Task 45: app/reader/[bookId].tsx — Reader smoke

- [ ] **Step 1:** `app/reader/[bookId].tsx`

```typescript
import React, { useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import {
  PhoneShell, IconBtn, Sheet, SheetRef, Headline, SectionLabel,
} from '@/components/ui';
import { IcChevronLeft, IcFontSize } from '@/components/icons';
import { BORGES_SAMPLE } from '@/fixtures/borges';
import { useSettingsStore } from '@/stores/settingsStore';
import { scriptForLang } from '@/theme/scripts';
import { splitWords } from '@/utils/splitWords';
import { scriptTypography } from '@/theme/tokens';
import type { InlineNode, ContentItem, ThemeId } from '@/types';

const stylesheet = StyleSheet.create((theme) => ({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 8,
  },
  centerLabel: { textAlign: 'center' as const },
  chapterNum: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: theme.ink, fontWeight: '600' as const },
  bookName:   { fontFamily: 'SourceSerif4-Italic', fontStyle: 'italic' as const, fontSize: 12, color: theme.ink3 },
  content:    { padding: 28, paddingBottom: 80, flexGrow: 1 },
  reading: {
    color: theme.ink,
    variants: {
      script: {
        latin:      { fontFamily: 'SourceSerif4-Regular' },
        cyrillic:   { fontFamily: 'Lora-Regular' },
        cjk_jp:     { fontFamily: 'ShipporiMinchoB1-Regular' },
        cjk_kr:     { fontFamily: 'NotoSerifKR-Regular' },
        arabic:     { fontFamily: 'Amiri-Regular', writingDirection: 'rtl' as const, textAlign: 'right' as const },
        devanagari: { fontFamily: 'TiroDevanagariHindi-Regular' },
      },
    },
  },
  paragraph: { marginBottom: 14 },
  word:       { paddingHorizontal: 1, borderRadius: 3 },
  wordActive: { backgroundColor: theme.accent, color: theme.paper },
  sheetTitle: { marginBottom: 12 },
  sheetRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  themeChip: {
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14,
    minWidth: 90, alignItems: 'center', backgroundColor: theme.paper2,
  },
  themeChipActive: { borderWidth: 2, borderColor: theme.accent },
  themeChipText:   { fontFamily: 'Inter-SemiBold', fontSize: 13, color: theme.ink },
}));

const THEMES: { id: ThemeId; name: string }[] = [
  { id: 'light', name: 'Day'   },
  { id: 'sepia', name: 'Sepia' },
  { id: 'dark',  name: 'Night' },
];

export default function ReaderScreen() {
  const router = useRouter();
  const bookLang = useSettingsStore((s) => s.bookLanguage);
  const themeId  = useSettingsStore((s) => s.themeId);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const script   = scriptForLang(bookLang);

  stylesheet.useVariants({ script });

  const sheetRef = useRef<SheetRef>(null);
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const onTap = (id: string) => setActiveWord(prev => prev === id ? null : id);

  const renderInline = (node: InlineNode, pi: number, ii: number): React.ReactNode => {
    if (node.type !== 'text') return null;
    const tokens = splitWords(node.text);
    return tokens.map((tok, ti) => {
      if (tok.kind !== 'word') return <Text key={`${pi}-${ii}-${ti}-x`}>{tok.text}</Text>;
      const id = `${pi}-${ii}-${ti}`;
      const isActive = activeWord === id;
      return (
        <Text key={id} onPress={() => onTap(id)} style={[stylesheet.word, isActive && stylesheet.wordActive]}>
          {tok.text}
        </Text>
      );
    });
  };

  const renderItem = (item: ContentItem, pi: number): React.ReactNode => {
    if (item.type !== 'paragraph') return null;
    const leading = scriptTypography[script].readingLeading;
    return (
      <Text key={pi} style={[stylesheet.reading, stylesheet.paragraph, { fontSize, lineHeight: fontSize * leading }]}>
        {item.inlines.map((n, ii) => renderInline(n, pi, ii))}
      </Text>
    );
  };

  return (
    <PhoneShell>
      <View style={stylesheet.topBar}>
        <IconBtn onPress={() => router.back()} accessibilityLabel="Back">
          <IcChevronLeft size={18} />
        </IconBtn>
        <View>
          <Text style={[stylesheet.centerLabel, stylesheet.chapterNum]}>Ch. {BORGES_SAMPLE.index + 1}</Text>
          <Text style={[stylesheet.centerLabel, stylesheet.bookName]}>The Garden of Forking Paths</Text>
        </View>
        <IconBtn onPress={() => sheetRef.current?.expand()} accessibilityLabel="Settings">
          <IcFontSize size={18} />
        </IconBtn>
      </View>

      <ScrollView contentContainerStyle={stylesheet.content}>
        <SectionLabel>Chapter</SectionLabel>
        <View style={{ height: 4 }} />
        <Headline level={1}>{BORGES_SAMPLE.title}</Headline>
        <View style={{ height: 14 }} />
        {BORGES_SAMPLE.items.map((item, pi) => renderItem(item, pi))}
      </ScrollView>

      <Sheet ref={sheetRef} snapPoints={['40%']}>
        <View style={stylesheet.sheetTitle}>
          <Headline level={2}>Reading</Headline>
        </View>
        <SectionLabel>Paper</SectionLabel>
        <View style={{ height: 8 }} />
        <View style={stylesheet.sheetRow}>
          {THEMES.map(t => {
            const active = themeId === t.id;
            return (
              <Pressable key={t.id} onPress={() => setTheme(t.id, false)}
                style={[stylesheet.themeChip, active && stylesheet.themeChipActive]}>
                <Text style={stylesheet.themeChipText}>{t.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </PhoneShell>
  );
}
```

- [ ] **Step 2:** Коммит `feat(app): Reader smoke c Borges, tap-highlight, theme sheet`

---

### Task 46: word + deck/session + import stubs

- [ ] **Step 1:** `app/word/[wordId].tsx`

```typescript
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: theme.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 22, minHeight: 220,
  },
  word: { fontFamily: 'SourceSerif4-Medium', fontSize: 30, color: theme.ink },
  hint: { fontFamily: 'Inter-Regular', fontSize: 14, color: theme.ink2, marginTop: 10 },
}));

export default function WordModal() {
  const router = useRouter();
  const { wordId } = useLocalSearchParams<{ wordId: string }>();
  return (
    <Pressable style={styles.overlay} onPress={() => router.back()}>
      <View style={styles.card}>
        <Text style={styles.word}>{wordId}</Text>
        <Text style={styles.hint}>Word card detail — sub-project #6.</Text>
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 2:** `app/deck/session.tsx`

```typescript
import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { PhoneShell, IconBtn, Headline } from '@/components/ui';
import { IcClose } from '@/components/icons';

const styles = StyleSheet.create(() => ({
  top: { flexDirection: 'row', justifyContent: 'space-between', padding: 22 },
  content: { padding: 22, alignItems: 'center', gap: 8 },
}));

export default function DeckSession() {
  const router = useRouter();
  return (
    <PhoneShell>
      <View style={styles.top}>
        <IconBtn onPress={() => router.back()} accessibilityLabel="Close">
          <IcClose size={18} />
        </IconBtn>
      </View>
      <View style={styles.content}>
        <Headline level={2}>Flashcards session</Headline>
        <Text>Sub-project #6 — SRS implementation.</Text>
      </View>
    </PhoneShell>
  );
}
```

- [ ] **Step 3:** `app/import.tsx`

```typescript
import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { PhoneShell, IconBtn, Headline } from '@/components/ui';
import { IcChevronLeft } from '@/components/icons';

const styles = StyleSheet.create(() => ({
  top: { flexDirection: 'row', alignItems: 'center', padding: 22, gap: 12 },
  content: { padding: 22, gap: 8 },
}));

export default function ImportModal() {
  const router = useRouter();
  return (
    <PhoneShell>
      <View style={styles.top}>
        <IconBtn onPress={() => router.back()} accessibilityLabel="Back">
          <IcChevronLeft size={18} />
        </IconBtn>
        <Headline level={3}>Add a book</Headline>
      </View>
      <View style={styles.content}>
        <Text>EPUB/FB2 import — sub-project #3.</Text>
      </View>
    </PhoneShell>
  );
}
```

- [ ] **Step 4:** Коммит `feat(app): word/deck/import stubs c правильными presentation modes`

---

### Task 47: (playground) — UI showcase

- [ ] **Step 1:** `app/(playground)/_layout.tsx`

```typescript
import { Stack, Redirect } from 'expo-router';
export default function PlaygroundLayout() {
  if (!__DEV__) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2:** `app/(playground)/index.tsx`

```typescript
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import {
  PhoneShell, Headline, SectionLabel, Button, Pill, Card, IconBtn,
  Hairline, BookCover, Stat, ProgressBar,
} from '@/components/ui';
import * as Icons from '@/components/icons';

const ICON_LIST: [string, React.ComponentType<{ size?: number }>][] = [
  ['ChevronLeft', Icons.IcChevronLeft], ['ChevronRight', Icons.IcChevronRight],
  ['ChevronDown', Icons.IcChevronDown], ['Close', Icons.IcClose],
  ['Search', Icons.IcSearch], ['Plus', Icons.IcPlus],
  ['Book', Icons.IcBook], ['Library', Icons.IcLibrary],
  ['Sparkle', Icons.IcSparkle], ['Flame', Icons.IcFlame],
  ['Graph', Icons.IcGraph], ['Cards', Icons.IcCards],
  ['Play', Icons.IcPlay], ['Volume', Icons.IcVolume],
  ['Bookmark', Icons.IcBookmark], ['Star', Icons.IcStar],
  ['Heart', Icons.IcHeart], ['Check', Icons.IcCheck],
  ['ArrowRight', Icons.IcArrowRight], ['Globe', Icons.IcGlobe],
  ['FontSize', Icons.IcFontSize], ['Moon', Icons.IcMoon],
  ['More', Icons.IcMore], ['Layers', Icons.IcLayers],
  ['Settings', Icons.IcSettings],
];

const styles = StyleSheet.create((theme) => ({
  content: { padding: 22, gap: 22 },
  section: { gap: 10 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  iconCell: { width: 64, alignItems: 'center', gap: 4 },
  iconLabel: { fontFamily: 'Inter-Regular', fontSize: 10, color: theme.ink3, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
}));

export default function Playground() {
  return (
    <PhoneShell>
      <ScrollView contentContainerStyle={styles.content}>
        <Headline level={1}>Playground</Headline>

        <View style={styles.section}>
          <SectionLabel>Headlines</SectionLabel>
          <Headline level={1}>H1 Source Serif 4</Headline>
          <Headline level={2}>H2 Source Serif 4</Headline>
          <Headline level={3}>H3 Inter SemiBold</Headline>
        </View>

        <View style={styles.section}>
          <SectionLabel>Buttons</SectionLabel>
          <View style={styles.row}>
            <Button variant="primary" onPress={() => {}}>Primary</Button>
            <Button variant="accent" onPress={() => {}}>Accent</Button>
            <Button variant="ghost" onPress={() => {}}>Ghost</Button>
          </View>
          <Button block onPress={() => {}}>Block Primary</Button>
        </View>

        <View style={styles.section}>
          <SectionLabel>Pills</SectionLabel>
          <View style={styles.row}>
            <Pill>EN</Pill>
            <Pill tone="accent">14-day streak</Pill>
            <Pill tone="known">Finished</Pill>
            <Pill tone="learning">Learning</Pill>
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>Card + Stat + ProgressBar</SectionLabel>
          <Card><Stat num={428} label="Words learned" delta="+12" /></Card>
          <ProgressBar value={0.4} tone="accent" />
        </View>

        <Hairline />

        <View style={styles.section}>
          <SectionLabel>IconBtn</SectionLabel>
          <View style={styles.row}>
            <IconBtn onPress={() => {}}><Icons.IcSearch size={18} /></IconBtn>
            <IconBtn onPress={() => {}} solid><Icons.IcPlus size={18} /></IconBtn>
            <IconBtn onPress={() => {}} accent><Icons.IcHeart size={18} /></IconBtn>
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>BookCover</SectionLabel>
          <View style={styles.row}>
            <BookCover book={{ title: 'The Garden of Forking Paths', author: 'J. L. Borges', gradient: ['#C0392B', '#5C1810'] }} w={78} h={108} />
            <BookCover book={{ title: 'Hojas en el Viento', author: 'Ana Lima', gradient: ['#E5B85F', '#7B5C18'] }} w={78} h={108} />
            <BookCover book={{ title: 'Une saison à Lyon', author: 'Marc Duval', gradient: ['#3F5B8F', '#0F2143'] }} w={78} h={108} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>All 26 icons</SectionLabel>
          <View style={styles.iconGrid}>
            {ICON_LIST.map(([name, Ic]) => (
              <View key={name} style={styles.iconCell}>
                <Ic size={22} />
                <Text style={styles.iconLabel}>{name}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </PhoneShell>
  );
}
```

- [ ] **Step 3:** Коммит `feat(app): (playground) dev-only showcase`

---

## Phase 11: Финальная валидация

### Task 48: Финальный typecheck/lint/tests

- [ ] **Step 1:** Полный тест-прогон

```bash
npm test
```

Expected: PASS, ~57+ tests (scripts 20, splitWords 7, settingsStore 19, Button 7, Sheet 2, TabBar 2).

- [ ] **Step 2:** Typecheck

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3:** Lint

```bash
npm run lint
```

Expected: 0 errors, warnings допустимы в config-файлах.

- [ ] **Step 4:** Sentinel-коммит

```bash
git commit --allow-empty -m "chore: tests + typecheck + lint pass"
```

---

### Task 49: Prebuild + dev-client build

- [ ] **Step 1:** Установить eas-cli глобально (если нет)

```bash
npm install -g eas-cli
```

- [ ] **Step 2:** `eas.json`

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview":    { "distribution": "internal" },
    "production": {}
  }
}
```

- [ ] **Step 3:** Локальный prebuild

```bash
npx expo prebuild --clean --no-install
```

Expected: создаются `ios/` и `android/`, шрифты копируются в нативные проекты.

- [ ] **Step 4:** Коммит `chore: eas.json для dev-client`

- [ ] **Step 5:** Сборка iOS dev-client (macOS)

```bash
npx expo run:ios
```

- [ ] **Step 6:** Сборка Android dev-client

```bash
npx expo run:android
```

---

### Task 50: Manual smoke checklist (§14 spec)

Запускаем dev-client. Каждый шаг — pass/fail; fail → fix → retest.

- [ ] Cold start < 1500ms на Pixel 7 / < 2500ms на iPhone 13
- [ ] Онбординг 3-step flow (Continue работает на каждом, Finish → tabs)
- [ ] Library → Reader (push, swipe-back работает)
- [ ] Word tap toggles is-active highlight (terracotta solid)
- [ ] Reader top-bar IcFontSize → Sheet поднимается, Day/Sepia/Night мгновенно меняют paper/ink
- [ ] Settings → bookLanguage en→ja→ar→ko→hi → Reader font меняется per script. Arabic: RTL `writingDirection`, paper/ink цвета НЕ инвертируются
- [ ] Tab-bar blur на Pixel 7 ≥ 55 FPS
- [ ] `/(playground)` показывает все 12 примитивов + 26 иконок

После прохождения — `git commit --allow-empty -m "chore: vertical-slice smoke passed"`

---

### Task 51: README + финальный DoD

- [ ] **Step 1:** Заменить `README.md`:

````markdown
# Fluera

Мобильная читалка для изучения языков через чтение. Тап по слову → перевод в
родной язык → сохранение в SRS-колоду. Поддержка EPUB + FB2, перевод
on-device (без бэкенда).

## Sub-project статус

**#1 Foundation — завершён.** Визуально-навигационный каркас:
3 темы × 6 script variants через Unistyles v3, 12 UI-примитивов, 26 иконок,
navigation Expo Router, шрифты embed через config plugin.

Следующие: #2 Data layer, #3 Import + parsers, #4 Reader engine,
#5 Translation UX, #6 Word knowledge + Deck, #7 Stats, #8 Library polish.

## Запуск (dev)

```bash
# Установка
npm install

# Native prebuild (требуется после изменения plugins / нативных deps)
npx expo prebuild --clean

# Локальный dev-client (Expo Go НЕ работает — у нас native modules)
npx expo run:ios     # macOS
npx expo run:android

# Дальше Metro можно запускать без пересборки:
npx expo start --dev-client
```

## Тесты + качество

```bash
npm test               # Jest unit-тесты
npm run typecheck      # tsc --noEmit
npm run lint           # expo lint
```

## Размер app

⚠️ В bundle лежат 38 шрифтов (~15-25 MB) для поддержки 6 скриптов offline.
Сознательный trade-off в пользу offline-чтения. В v2 рассмотрим APK splits
или lazy-load JP/KR/AR/HI.

## Документация

- Спека Foundation: `docs/superpowers/specs/2026-05-15-foundation-design.md`
- План реализации: `docs/superpowers/plans/2026-05-15-foundation.md`
- Стандарты проекта: `CLAUDE.md`
````

- [ ] **Step 2:** Финальная проверка DoD §16 спеки — все 13 пунктов должны быть зелёные:
  - [ ] create-expo-app + старый код удалён → Tasks 2-3
  - [ ] deps из §3 → Task 4
  - [ ] app/ структура → Tasks 41-47
  - [ ] 38 шрифтов в bundle → Tasks 39-40
  - [ ] Unistyles v3 c themes+variants → Tasks 10-13
  - [ ] SettingsStore рабочий → Task 18
  - [ ] 12 примитивов + 26 иконок видны в playground → Tasks 19-35, 47
  - [ ] i18n en/ru/pl/uk → Tasks 36-37
  - [ ] Smoke на iOS + Android → Tasks 49-50
  - [ ] Unit tests → Task 48
  - [ ] tsc --noEmit → Task 48
  - [ ] expo lint → Task 48
  - [ ] README → Task 51

- [ ] **Step 3:** Финальный коммит + тег

```bash
git commit --allow-empty -m "feat: Foundation sub-project #1 complete (DoD passed)"
git tag foundation-v1
```

- [ ] **Step 4:** Готовы переходить на sub-project #2 (Data layer) — отдельный spec + plan цикл.

---

## Self-Review Notes

1. **Test-first** в задачах с "(TDD)" — пишем тест, видим FAIL, реализуем, видим PASS. Реально запускаем `npm test`, не имитируем.
2. **Каждый шаг — коммит** если контекст логически отделим. Granular rollback.
3. **`@/` path alias** работает через `babel-plugin-module-resolver` + `tsconfig.json` paths + `jest.config.js moduleNameMapper`.
4. **Unistyles v3 особенности:**
   - `styles.useVariants({...})` вызывается ВНУТРИ компонента до доступа к стилям
   - Объект `styles` — proxy, нельзя деструктурировать заранее
   - `StyleSheet.create((theme, rt) => ...)` — rt: insets/colorScheme/breakpoints
5. **gorhom bottom-sheet** требует `GestureHandlerRootView` в root layout (Task 41) и Reanimated 3 babel-plugin (Task 6).
6. **Expo prebuild** требуется после `expo-font` config plugin. `ios/`/`android/` игнорятся в git (Task 9).
7. **Theme switch без re-mount** — Unistyles v3 обновляет ShadowTree через JSI без re-render React-дерева. Работает только с New Architecture (Task 40 включает).

