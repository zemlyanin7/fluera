# Foundation — дизайн-спецификация (sub-project #1)

**Дата:** 2026-05-15
**Статус:** Draft → на ревью спецов
**Sub-project:** 1 из 8 (Foundation)
**Зависимости:** —
**Блокирует:** все последующие sub-projects (#2–#8)

---

## 1. Контекст

Fluera — мобильная читалка для изучения языков через чтение книг. Пользователь
тапает по слову → видит перевод в родной язык, слово попадает в SRS-колоду.
EPUB и FB2 рендерятся одинаково (нативно).

Дизайн пришёл как handoff-бандл из Claude Design (HTML/CSS/JSX-прототип).
Этот документ описывает **только Foundation** — первый из 8 sub-projects.
Остальные подсистемы (data layer, parsers, reader engine, translation, SRS,
stats, library polish) идут отдельными spec/plan/impl циклами.

### Декомпозиция всего проекта

| # | Sub-project | Что входит |
|---|---|---|
| **1** | **Foundation** (этот документ) | `create-expo-app`, theme/token system, UI-примитивы, navigation shell, fonts, icons, canonical types, settings store skeleton |
| 2 | Data layer | DB (WatermelonDB), persistence, миграции |
| 3 | Import + parsers | FB2 + EPUB → `ContentItem[]`, BookImporter, Import screen |
| 4 | Reader engine | Нативная пагинация, word tokenizer, ContentItem renderer, settings/footnote sheets |
| 5 | Translation UX | Локальная нейросеть Hy-MT1.5-1.8B (GGUF) через `llama.rn`, popup-варианты |
| 6 | Word knowledge + Deck | Состояния слов, SRS (SM-2 или FSRS), Flashcards, Word Card |
| 7 | Stats + gamification | Streak, чтение, ачивки, экран Progress |
| 8 | Onboarding + Library polish | 3-step онбординг, Continue reading, Shelf |

### Связь с дизайном

- HTML-прототип: `Fluera.html` + `screens.jsx` + `screen-reader.jsx`
- Токены: `tokens.css` (paper/ink/accent/known/learning + per-`data-lang`
  переопределения шрифтов)
- Иконки: `icons.jsx` (26 SVG, stroke 1.8, currentColor, 24×24 viewBox)
- Чаты: `chats/chat1.md` (общая концепция) + `chats/chat2.md` (типографика
  для разных скриптов)

---

## 2. Цель Foundation

В конце Foundation у нас есть **визуально-навигационный каркас** на котором
строятся остальные sub-projects. Бизнес-логики (книги, переводы, SRS) нет —
только UI-примитивы, темизация, навигация и инфраструктура.

### Что входит

1. Свежий Expo-проект (`npx create-expo-app`) — wipe всего существующего кода
2. Token/theme система через `react-native-unistyles v3`
3. Канонические типы `ContentItem`/`InlineNode`/`BookChapter` (используют #2–#8)
4. Settings store skeleton (Zustand) — без persistence
5. UI-примитивы (12 компонентов) точно по дизайну
6. 26 иконок (port 1:1 из `icons.jsx` через `react-native-svg`)
7. Все шрифты (Latin + Cyrillic + JP + KR + AR + HI) в bundle
8. Файловая навигация Expo Router (роуты-стабы для всех экранов)
9. i18n bootstrap (en/ru/pl/uk локали)
10. Vertical-slice smoke на iOS + Android (проверка темизации, шрифтов, тапа)

### Что НЕ входит

- Парсинг EPUB/FB2 (#3)
- Реальный reader-engine с пагинацией (#4)
- Перевод (#5)
- SRS-логика (#6)
- WatermelonDB-схема и миграции (#2)
- AsyncStorage/MMKV persistence для settings (#2)
- Реальный контент книг — только заглушки и hardcoded Borges-сэмпл
- llama.rn интеграция (#5)

---

## 3. Технологический стек (зафиксирован)

| Что | Чем | Почему |
|---|---|---|
| Bootstrap | `npx create-expo-app@latest` | Expo SDK 55, New Arch default |
| Язык | TypeScript strict | Из CLAUDE.md |
| Навигация | Expo Router (file-based) | Уже знакома, deep linking из коробки |
| Стили | `react-native-unistyles v3` | Поддержка theme-cascade без re-render через ShadowTree, runtime variants для `data-lang`-эквивалента, требует New Arch — совпадает с Expo 55 |
| Состояние UI | Zustand | Из CLAUDE.md, легче чем Redux |
| Иконки | `react-native-svg` (port дизайн-иконок 1:1) | Pixel-perfect, нет зависимости от стороннего icon-pack |
| Blur | `expo-blur` (BlurView) + `experimentalBlurMethod="dimezisBlurView"` на Android | Tab-bar дизайн использует `backdrop-filter: blur(20px)` |
| Жесты | `react-native-gesture-handler` + `reanimated` | Для Sheet drag-to-dismiss |
| i18n | `i18next` + `react-i18next` + `expo-localization` | Совместимо с существующими планами |
| Тесты | `jest-expo` + `@testing-library/react-native` | Стандарт Expo |
| Шрифты | `expo-font` (bundle) | Загрузка на старте через `useFonts()` |

### Dev workflow

С Foundation сразу собираем **custom dev-client** (`eas build --profile development`).
Причина: в #5 добавится `llama.rn` (native binding к llama.cpp) — Expo Go перестанет работать
после `expo prebuild`. Лучше принять это сейчас, чтобы не переделывать dev-workflow.

---

## 4. Структура файлов

```
app/
  _layout.tsx                         # root Stack
  +not-found.tsx
  (onboarding)/
    _layout.tsx                       # Stack
    index.tsx                         # Step 1 — UI language
    book-lang.tsx                     # Step 2 — reading language
    native-lang.tsx                   # Step 3 — native language
  (tabs)/
    _layout.tsx                       # Tabs (custom TabBar)
    index.tsx                         # Library (заглушка)
    deck.tsx                          # Deck (заглушка)
    stats.tsx                         # Stats (заглушка)
    settings.tsx                      # YOU/Settings (с реальным ThemePicker)
  reader/
    [bookId].tsx                      # presentation: 'card' (push, full-screen)
  word/
    [wordId].tsx                      # presentation: 'transparentModal'
  deck/
    session.tsx                       # presentation: 'fullScreenModal'
  import.tsx                          # presentation: 'modal'

src/
  theme/
    tokens.ts                         # цвета, типографические значения
    unistyles.ts                      # StyleSheet.configure({themes, variants})
    scripts.ts                        # маппинг bookLanguage → script variant
    index.ts                          # export всего
  types/
    content.ts                        # ContentItem, InlineNode, BookChapter, BookFootnotes
    settings.ts                       # SettingsState, ThemeId, ScriptId, FontFamilyMode
    index.ts
  stores/
    settingsStore.ts                  # Zustand skeleton (без persistence)
  components/
    ui/
      Button.tsx                      # primary | accent | ghost | block
      Pill.tsx
      Card.tsx
      Sheet.tsx                       # bottom-sheet с drag-handle, GH+Reanimated
      IconBtn.tsx                     # 36×36 кнопка
      Hairline.tsx                    # 1px divider
      BookCover.tsx                   # gradient + spine + title overlay
      Headline.tsx                    # H1, H2, H3
      SectionLabel.tsx                # uppercase, letter-spacing 0.08em
      Stat.tsx                        # numeric card
      TabBar.tsx                      # 4-tab floating glass с blur
      PhoneShell.tsx                  # SafeAreaView wrapper
      ProgressBar.tsx                 # 2-3px полоса
      index.ts
    icons/
      Icon.tsx                        # базовый <Svg> + общие props
      paths.ts                        # 26 path-данных как константы
      index.tsx                       # 26 exported компонентов
  i18n/
    index.ts                          # i18next init
    locales/
      en.json
      ru.json
      pl.json
      uk.json
  utils/
    constants.ts                      # числовые константы, regex
    tokenizer.ts                      # пока stub — реальная импл в #4

assets/
  fonts/                              # ~30 .ttf файлов (см. §8)

__tests__/
  theme/
    unistyles.test.ts
    scripts.test.ts
  components/ui/
    Button.test.tsx
    Sheet.test.tsx
    TabBar.test.tsx
  stores/
    settingsStore.test.ts

# config
app.json
package.json
tsconfig.json
eslint.config.js
babel.config.js
jest.config.js
jest.setup.js
.eslintignore
.gitignore
.env.example
README.md
CLAUDE.md                             # копия из существующего проекта
```

---

## 5. Token / Theme система

### 5.1. Источник правды — `tokens.css`

Цвета и значения берём из `tokens.css` 1:1 без интерпретации.

### 5.2. Архитектура: themes + script variants

В Unistyles v3 темы и per-language шрифты **разделены**:

- `themes` (3 шт) — `light`, `sepia`, `dark` — содержат только `paper*` и `ink*`
  цвета + семантические (`accent`, `known`, `learning`, `new`)
- `variants.script` (6 шт) — `latin`, `cyrillic`, `cjk_jp`, `cjk_kr`, `arabic`,
  `devanagari` — содержат `fontReading`, `fontUi`, `fontMono`, `readingLeading`,
  `readingLetterSpacing`, `isRTL`

**Почему не одна 3×6 матрица:** темы и скрипты ортогональны. Пользователь может
читать арабскую книгу в sepia, японскую в dark. 3×6 матрица = 18 веток с
дублированием.

### 5.3. Tokens (`src/theme/tokens.ts`)

```typescript
// Палитры (1:1 из tokens.css)
export const palettes = {
  light: {
    paper:    '#F5EFE4',
    paper2:   '#EDE5D5',
    ink:      '#1F1A14',
    ink2:     '#564E42',
    ink3:     '#8A8170',
  },
  sepia: {
    paper:    '#ECDFC6',
    paper2:   '#DBCBAA',
    ink:      '#2A2117',
    ink2:     '#5E513D',
    ink3:     '#8E7E62',
  },
  dark: {
    paper:    '#16130E',
    paper2:   '#221E17',
    ink:      '#EDE6D6',
    ink2:     '#B5AB97',
    ink3:     '#786E5C',
  },
} as const;

// Семантические — общие для light/sepia, переопределяются для dark
export const semantic = {
  base: {
    accent:        'oklch(0.62 0.14 40)',
    accentSoft:    'oklch(0.62 0.14 40 / 0.12)',
    accentLine:    'oklch(0.62 0.14 40 / 0.35)',
    known:         'oklch(0.68 0.06 140)',
    knownSoft:     'oklch(0.68 0.06 140 / 0.18)',
    learning:      'oklch(0.78 0.12 75)',
    learningSoft:  'oklch(0.78 0.12 75 / 0.22)',
    newSoft:       'oklch(0.62 0.14 40 / 0.18)',
  },
  darkOverrides: {
    accent:        'oklch(0.72 0.12 40)',
    accentSoft:    'oklch(0.72 0.12 40 / 0.18)',
    known:         'oklch(0.74 0.07 140)',
    knownSoft:     'oklch(0.74 0.07 140 / 0.22)',
    learning:      'oklch(0.82 0.13 75)',
    learningSoft:  'oklch(0.82 0.13 75 / 0.25)',
  },
} as const;

// Шрифты per script
export const scriptTypography = {
  latin: {
    fontReading: 'SourceSerif4-Regular',
    fontReadingItalic: 'SourceSerif4-Italic',
    fontUi: 'Inter-Regular',
    fontMono: 'GeistMono-Regular',
    readingLeading: 1.65,
    readingLetterSpacing: -0.005,
    isRTL: false,
  },
  cyrillic: {
    fontReading: 'Lora-Regular',
    fontReadingItalic: 'Lora-Italic',
    fontUi: 'Inter-Regular',
    fontMono: 'GeistMono-Regular',
    readingLeading: 1.6,
    readingLetterSpacing: 0,
    isRTL: false,
  },
  cjk_jp: {
    fontReading: 'ShipporiMinchoB1-Regular',
    fontUi: 'NotoSansJP-Regular',
    fontMono: 'GeistMono-Regular',
    readingLeading: 1.85,
    readingLetterSpacing: 0.02,
    isRTL: false,
  },
  cjk_kr: {
    fontReading: 'NotoSerifKR-Regular',
    fontUi: 'NotoSansKR-Regular',
    fontMono: 'GeistMono-Regular',
    readingLeading: 1.75,
    readingLetterSpacing: 0,
    isRTL: false,
  },
  arabic: {
    fontReading: 'Amiri-Regular',
    fontReadingItalic: 'Amiri-Italic',
    fontUi: 'NotoSansArabic-Regular',
    fontMono: 'GeistMono-Regular',
    readingLeading: 1.95,
    readingLetterSpacing: 0,
    isRTL: true,
  },
  devanagari: {
    fontReading: 'TiroDevanagariHindi-Regular',
    fontReadingItalic: 'TiroDevanagariHindi-Italic',
    fontUi: 'NotoSansDevanagari-Regular',
    fontMono: 'GeistMono-Regular',
    readingLeading: 1.85,
    readingLetterSpacing: 0,
    isRTL: false,
  },
} as const;

// Размеры (из tokens.css)
export const sizes = {
  readingDefault: 19,         // px, --reading-size
  reading: { min: 15, max: 26 },
  radii: { sm: 3, md: 12, lg: 14, xl: 18, xxl: 22, pill: 999 },
} as const;
```

### 5.4. Unistyles config (`src/theme/unistyles.ts`)

```typescript
import { StyleSheet } from 'react-native-unistyles';
import { palettes, semantic, scriptTypography } from './tokens';

const makeTheme = (id: 'light' | 'sepia' | 'dark') => ({
  ...palettes[id],
  ...semantic.base,
  ...(id === 'dark' ? semantic.darkOverrides : {}),
});

const appThemes = {
  light: makeTheme('light'),
  sepia: makeTheme('sepia'),
  dark:  makeTheme('dark'),
};

const breakpoints = { xs: 0, sm: 360, md: 400, lg: 720 } as const;

type AppThemes = { [K in keyof typeof appThemes]: typeof appThemes[K] };
type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  themes: appThemes,
  breakpoints,
  settings: {
    initialTheme: 'light',
    adaptiveThemes: false,   // переключаем сами через SettingsStore.themeAuto
  },
});

// Экспортируем scriptTypography отдельно — используем через runtime variant
export { scriptTypography };
```

### 5.5. Bridge: SettingsStore → Unistyles

```typescript
// src/theme/bridge.ts
import { UnistylesRuntime } from 'react-native-unistyles';
import { useSettingsStore } from '@/stores/settingsStore';

// Single subscriber на изменения themeId / themeAuto в Zustand
export function attachThemeBridge() {
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
  );
}
```

Бридж вызывается один раз в `app/_layout.tsx` после mount.

### 5.6. Маппинг язык → script (`src/theme/scripts.ts`)

```typescript
export type ScriptId = keyof typeof scriptTypography;

const langToScript: Record<string, ScriptId> = {
  en: 'latin', es: 'latin', fr: 'latin', de: 'latin',
  it: 'latin', pt: 'latin', pl: 'latin',
  ru: 'cyrillic', uk: 'cyrillic', be: 'cyrillic', sr: 'cyrillic',
  ja: 'cjk_jp',
  ko: 'cjk_kr',
  ar: 'arabic', fa: 'arabic', ur: 'arabic',
  hi: 'devanagari', mr: 'devanagari', sa: 'devanagari',
};

export const scriptForLang = (lang: string): ScriptId =>
  langToScript[lang] ?? 'latin';
```

### 5.7. Использование в компонентах

```typescript
import { StyleSheet, useStyles } from 'react-native-unistyles';
import { Text } from 'react-native';
import { useSettingsStore } from '@/stores/settingsStore';
import { scriptForLang } from '@/theme/scripts';

const stylesheet = StyleSheet.create((theme, rt) => ({
  reading: {
    color: theme.ink,
    backgroundColor: theme.paper,
    variants: {
      script: {
        latin:      { fontFamily: 'SourceSerif4-Regular',  lineHeight: 19 * 1.65 },
        cyrillic:   { fontFamily: 'Lora-Regular',          lineHeight: 19 * 1.6 },
        cjk_jp:     { fontFamily: 'ShipporiMinchoB1-Regular', lineHeight: 19 * 1.85 },
        cjk_kr:     { fontFamily: 'NotoSerifKR-Regular',   lineHeight: 19 * 1.75 },
        arabic:     { fontFamily: 'Amiri-Regular',         lineHeight: 19 * 1.95, writingDirection: 'rtl', textAlign: 'right' },
        devanagari: { fontFamily: 'TiroDevanagariHindi-Regular', lineHeight: 19 * 1.85 },
      },
    },
  },
}));

function ReadingText({ children }: { children: string }) {
  const bookLang = useSettingsStore((s) => s.bookLanguage);
  const styles = useStyles(stylesheet, { script: scriptForLang(bookLang) });
  return <Text style={styles.reading}>{children}</Text>;
}
```

### 5.8. Тёмная тема — авто Day/Night

`SettingsStore.themeAuto = true` → `UnistylesRuntime.setAdaptiveThemes(true)` →
система сама переключает по `useColorScheme()` (Unistyles мапит `light` ⇄
`dark`; `sepia` доступна только при выключенном auto).

### 5.9. RTL стратегия

`I18nManager.forceRTL` **не используем** — он глобальный, требует перезапуска,
блокирует поддержку нескольких языков в одной сессии.

Вместо этого:
- `writingDirection: 'rtl'` + `textAlign: 'right'` на reader-контейнерах
  при `script === 'arabic'`
- App chrome (tab-bar, headers, settings) всегда LTR
- На Android `<TextInput>` игнорирует `writingDirection` < API 33 — оставляем
  `textAlign` обязательным

---

## 6. Canonical types (перенос из #2)

**Причина переноса:** code-architect-фидбек: если canonical types появятся в
#2, схема WatermelonDB будет переделана 2+ раза. Лучше зафиксировать формат
данных в #1.

### 6.1. `src/types/content.ts`

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
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; inlines: InlineNode[] }
  | { type: 'paragraph'; inlines: InlineNode[]; style?: ParagraphStyle }
  | { type: 'image'; src: string; alt?: string; width?: number; height?: number }
  | { type: 'blockquote'; inlines: InlineNode[]; nestedItems?: ContentItem[] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] }
  | { type: 'separator' }
  | { type: 'table-row'; cells: InlineNode[][] };

export interface BookChapter {
  index: number;
  title: string | null;
  items: ContentItem[];
}

export interface BookFootnotes {
  [id: string]: InlineNode[];
}

export const MAX_INLINE_DEPTH = 20;
```

### 6.2. `src/types/settings.ts`

```typescript
export type ThemeId = 'light' | 'sepia' | 'dark';
export type FontFamilyMode = 'serif' | 'sans';
export type ScrollMode = 'page' | 'scroll';

export interface SettingsState {
  // languages
  uiLanguage: 'en' | 'ru' | 'pl' | 'uk';
  nativeLanguage: string;             // BCP-47, целевой перевода
  bookLanguage: string;               // BCP-47, текущая открытая книга

  // theme
  themeId: ThemeId;
  themeAuto: boolean;

  // reading
  fontFamilyMode: FontFamilyMode;
  fontSize: number;                   // px, default 19
  scrollMode: ScrollMode;
  highlightUnknown: boolean;
  showSentenceTranslation: boolean;
  pageFlipAnim: boolean;

  // onboarding
  onboardingCompleted: boolean;
}

export const DEFAULT_SETTINGS: SettingsState = {
  uiLanguage: 'en',
  nativeLanguage: 'ru',
  bookLanguage: 'en',
  themeId: 'light',
  themeAuto: false,
  fontFamilyMode: 'serif',
  fontSize: 19,
  scrollMode: 'scroll',
  highlightUnknown: true,
  showSentenceTranslation: false,
  pageFlipAnim: true,
  onboardingCompleted: false,
};
```

---

## 7. Settings Store (skeleton)

`src/stores/settingsStore.ts`:

```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_SETTINGS, SettingsState } from '@/types/settings';

interface SettingsActions {
  setUiLanguage: (v: SettingsState['uiLanguage']) => void;
  setNativeLanguage: (v: string) => void;
  setBookLanguage: (v: string) => void;
  setTheme: (id: SettingsState['themeId'], auto?: boolean) => void;
  setFontFamilyMode: (v: SettingsState['fontFamilyMode']) => void;
  setFontSize: (v: number) => void;
  setScrollMode: (v: SettingsState['scrollMode']) => void;
  toggleHighlightUnknown: () => void;
  toggleShowSentenceTranslation: () => void;
  togglePageFlipAnim: () => void;
  completeOnboarding: () => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  subscribeWithSelector((set) => ({
    ...DEFAULT_SETTINGS,
    setUiLanguage: (v) => set({ uiLanguage: v }),
    setNativeLanguage: (v) => set({ nativeLanguage: v }),
    setBookLanguage: (v) => set({ bookLanguage: v }),
    setTheme: (id, auto = false) => set({ themeId: id, themeAuto: auto }),
    setFontFamilyMode: (v) => set({ fontFamilyMode: v }),
    setFontSize: (v) => set({ fontSize: Math.max(15, Math.min(26, v)) }),
    setScrollMode: (v) => set({ scrollMode: v }),
    toggleHighlightUnknown: () => set((s) => ({ highlightUnknown: !s.highlightUnknown })),
    toggleShowSentenceTranslation: () => set((s) => ({ showSentenceTranslation: !s.showSentenceTranslation })),
    togglePageFlipAnim: () => set((s) => ({ pageFlipAnim: !s.pageFlipAnim })),
    completeOnboarding: () => set({ onboardingCompleted: true }),
    reset: () => set(DEFAULT_SETTINGS),
  })),
);
```

**Persistence** — в #2 (MMKV или AsyncStorage). Сейчас стейт теряется при
перезапуске; это нормально для Foundation-smoke.

---

## 8. Fonts

### 8.1. Список (bundle)

Все `.ttf` в `assets/fonts/`. Имена файлов = имена `fontFamily` в RN.

**Latin (Geist family — UI):**
- `Geist-Regular.ttf` (400)
- `Geist-Medium.ttf` (500)
- `Geist-SemiBold.ttf` (600)
- `Geist-Bold.ttf` (700)
- `GeistMono-Regular.ttf` (400)
- `GeistMono-Medium.ttf` (500)

**Latin (Source Serif 4 — reading):**
- `SourceSerif4-Regular.ttf`
- `SourceSerif4-Medium.ttf`
- `SourceSerif4-SemiBold.ttf`
- `SourceSerif4-Italic.ttf`
- `SourceSerif4-MediumItalic.ttf`

**Latin (Inter — UI fallback):**
- `Inter-Regular.ttf`
- `Inter-Medium.ttf`
- `Inter-SemiBold.ttf`
- `Inter-Bold.ttf`

**Cyrillic (Lora — reading):**
- `Lora-Regular.ttf`
- `Lora-Medium.ttf`
- `Lora-SemiBold.ttf`
- `Lora-Italic.ttf`
- `Lora-MediumItalic.ttf`

**Japanese:**
- `ShipporiMinchoB1-Regular.ttf`
- `ShipporiMinchoB1-Medium.ttf`
- `NotoSansJP-Regular.ttf`
- `NotoSansJP-Medium.ttf`
- `NotoSansJP-Bold.ttf`

**Korean:**
- `NotoSerifKR-Regular.ttf`
- `NotoSerifKR-Medium.ttf`
- `NotoSansKR-Regular.ttf`
- `NotoSansKR-Medium.ttf`
- `NotoSansKR-Bold.ttf`

**Arabic (RTL):**
- `Amiri-Regular.ttf`
- `Amiri-Italic.ttf`
- `Amiri-Bold.ttf`
- `NotoSansArabic-Regular.ttf`
- `NotoSansArabic-Medium.ttf`

**Devanagari:**
- `TiroDevanagariHindi-Regular.ttf`
- `TiroDevanagariHindi-Italic.ttf`
- `NotoSansDevanagari-Regular.ttf`
- `NotoSansDevanagari-Medium.ttf`

Итого: **~35 файлов**, ожидаемый размер **15–25 MB** в bundle.

**Известный риск:** Noto Sans JP / Noto Serif KR / Noto Sans KR full = 5–8 MB
каждый. Это увеличит install size. Решение: оставляем как есть в v1 (явный
выбор пользователя — приоритет офлайн-чтения). В README документируем.

### 8.2. Загрузка

`app/_layout.tsx`:

```typescript
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

const FONT_MAP = {
  'Geist-Regular': require('../assets/fonts/Geist-Regular.ttf'),
  // ... все остальные
};

export default function RootLayout() {
  const [loaded, error] = useFonts(FONT_MAP);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return <Stack>{/* ... */}</Stack>;
}
```

---

## 9. Icons

### 9.1. Принцип

Из `icons.jsx` дизайна берём 26 SVG-path данных. Каждая иконка =
24×24 viewBox, stroke 1.8, `currentColor`, `strokeLinecap/Join: round`.

### 9.2. `src/components/icons/Icon.tsx`

```typescript
import { Svg, SvgProps } from 'react-native-svg';

export interface IconProps {
  size?: number;        // default 22
  color?: string;       // default 'currentColor' — берём из props.color
  strokeWidth?: number; // default 1.8
  fill?: string;        // default 'none'
}

export const Icon = ({
  size = 22,
  color = 'currentColor',
  strokeWidth = 1.8,
  fill = 'none',
  children,
}: IconProps & { children: React.ReactNode }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </Svg>
);
```

### 9.3. `src/components/icons/paths.ts`

26 path-данных как константы (1:1 из `icons.jsx`):

```typescript
export const PATHS = {
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  // ... 24 остальных
};
```

### 9.4. `src/components/icons/index.tsx`

26 экспортов:

```typescript
export const IcChevronLeft  = (p: IconProps) =>
  <Icon {...p}><Path d={PATHS.chevronLeft}/></Icon>;
// ...
```

---

## 10. UI Primitives

Список + краткое описание + ключевые состояния. Реализуются как
функциональные компоненты, не более 60 строк каждый.

| Компонент | Props | Состояния |
|---|---|---|
| `Button` | `variant: 'primary'\|'accent'\|'ghost'`, `block?`, `icon?`, `onPress`, `children` | normal, pressed (opacity 0.7) |
| `Pill` | `tone?: 'neutral'\|'accent'\|'known'\|'learning'`, `icon?`, `children` | static |
| `Card` | `children`, `padding?: number` | static |
| `Sheet` | `visible`, `onClose`, `children`, `paddingBottom?` | open/closing (animated) |
| `IconBtn` | `Icon`, `onPress`, `solid?: boolean`, `accent?: boolean` | normal, pressed |
| `Hairline` | — | static |
| `BookCover` | `book: {title, author, cover (gradient), lang}`, `w`, `h` | static |
| `Headline` | `level: 1\|2\|3`, `children` | static (использует `font-reading`) |
| `SectionLabel` | `children` | static (uppercase, tracking 0.08em) |
| `Stat` | `num`, `label`, `delta?` | static |
| `TabBar` | `active: 'library'\|'deck'\|'stats'\|'you'`, `onPress(id)` | active per tab |
| `PhoneShell` | `children` | static (SafeAreaView + статус-bar inset) |
| `ProgressBar` | `value: 0..1`, `height?: number`, `tone?` | static |

### Особенности

- **`PhoneShell`** не рисует фейковый status bar. Только `SafeAreaView` +
  `useSafeAreaInsets()`. Реальное системное время/батарея показывает iOS/Android.
- **`TabBar`** = `expo-blur` `<BlurView intensity={80}>` + на Android
  `experimentalBlurMethod="dimezisBlurView"`. Тени из дизайна (`box-shadow`)
  через RN `shadow*` props на iOS + `elevation` на Android. Активная иконка =
  `theme.ink`, неактивная = `theme.ink3`. Точка-индикатор под активной =
  `theme.accent` 4×4 круг.
- **`Sheet`** = react-native-gesture-handler `PanGestureHandler` +
  `reanimated` `useSharedValue` для y-translation. Spring back если drag < 100,
  dismiss если >= 100. Backdrop = `rgba(0,0,0,0.15)` пресс закрывает.
- **`Button.block`** = full-width, padding 16, font-size 16, остальные =
  padding 12/18, font-size 15.
- **`BookCover`** = `LinearGradient` (через `expo-linear-gradient`) с
  параметрами из дизайна + позиционированный spine (`width: 6%`) + title
  overlay (`font-reading` 10px) + author overlay (`font-ui` 7px uppercase).

---

## 11. Navigation

### 11.1. Root layout (`app/_layout.tsx`)

```typescript
import { Stack } from 'expo-router';

export default function RootLayout() {
  // ... fonts + bridge
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="reader/[bookId]" />
      <Stack.Screen
        name="word/[wordId]"
        options={{ presentation: 'transparentModal', animation: 'fade' }}
      />
      <Stack.Screen
        name="deck/session"
        options={{ presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name="import"
        options={{ presentation: 'modal' }}
      />
    </Stack>
  );
}
```

### 11.2. Tabs (`app/(tabs)/_layout.tsx`)

Используем `Tabs` из expo-router **с кастомным TabBar** (через `tabBar` prop).
Стандартный TabBar не повторяет дизайн (floating glass + blur + 4 кнопки
с индикатор-точкой).

```typescript
import { Tabs } from 'expo-router';
import { TabBar } from '@/components/ui/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="index"    options={{ title: 'READ' }} />
      <Tabs.Screen name="deck"     options={{ title: 'DECK' }} />
      <Tabs.Screen name="stats"    options={{ title: 'STATS' }} />
      <Tabs.Screen name="settings" options={{ title: 'YOU' }} />
    </Tabs>
  );
}
```

### 11.3. Entry decision

В `app/_layout.tsx` после mount читаем `useSettingsStore(s => s.onboardingCompleted)`:
- `false` → `router.replace('/(onboarding)')`
- `true`  → `router.replace('/(tabs)')`

Делаем это в `useEffect`, не в render — Expo Router требует mount Stack
сначала.

---

## 12. Status bar / Safe area

- `expo-status-bar` `<StatusBar style="dark"/>` (или `light` для `dark` темы)
- Высота 54px в дизайне = `useSafeAreaInsets().top` + ~10px бренд-полоса.
  Бренд-полоса опциональна; берём `top` inset и сверху рисуем экран контента.
- **Нет** фейкового времени/иконок батареи (iOS App Store reject)

---

## 13. i18n

### 13.1. `src/i18n/index.ts`

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './locales/en.json';
import ru from './locales/ru.json';
import pl from './locales/pl.json';
import uk from './locales/uk.json';

const SUPPORTED = ['en', 'ru', 'pl', 'uk'] as const;

const initial = (() => {
  const sys = Localization.getLocales()[0]?.languageCode ?? 'en';
  return SUPPORTED.includes(sys as any) ? sys : 'en';
})();

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ru: { translation: ru },
              pl: { translation: pl }, uk: { translation: uk } },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
```

### 13.2. Ключи (минимальный набор для Foundation)

```
common.continue, common.skip, common.next, common.back, common.close
tabs.read, tabs.deck, tabs.stats, tabs.you
onboarding.step1.title, onboarding.step2.title, onboarding.step3.title
settings.theme.title, settings.theme.day, settings.theme.sepia,
settings.theme.night, settings.theme.auto
settings.font.title, settings.font.size, settings.font.typeface
settings.font.serif, settings.font.sans
library.empty
```

---

## 14. Vertical-slice smoke (риск-чек)

В конце Foundation на устройстве работает следующий поток. Это не unit test —
это ручной smoke на iOS + Android.

### Шаги

1. Запуск → splash → 3-step онбординг (выбор UI / book / native lang, все
   опции работают, Continue заполнен)
2. После онбординга → Library с **hardcoded** карточкой "The Garden of
   Forking Paths"
3. Тап на карточку → Reader stack с **hardcoded Borges-параграфом** из
   `screen-reader.jsx` (`READER_SAMPLE.paragraphs[0]`). Один экран — без
   пагинации, без скролла фокусируемся на стилях.
4. Тап на слово → подсветка `is-active` (terracotta solid), повторный тап
   снимает
5. Кнопка "FontSize" в Reader top-bar → `Sheet` поднимается с тремя темами
   (Day/Sepia/Night) — мгновенное переключение цветов без re-mount
6. Settings tab → BookLanguage picker (en/ru/ja/ar/ko/hi). Возврат в Reader
   меняет шрифт (Latin → Cyrillic → JP → Arabic с RTL → Korean → Devanagari)
7. Tab-bar swipe между 4 табами — blur не лагает на Android (Pixel 7)

### Целевые устройства

- iOS: iPhone 13 (Simulator + реальное при возможности)
- Android: Pixel 7 / эмулятор API 33+
- Optionally: low-end Android (Helio G99 / 4GB RAM) — проверка
  blur-производительности

### Что считать pass

- Темы переключаются мгновенно (≤ 50ms)
- Шрифты применяются без FOUT (preload до первого рендера)
- Word tap имеет hit-area ≥ 32×32 (CSS-padding не обязателен, главное — попадание)
- Tab-bar blur ≥ 55 FPS на Pixel 7

---

## 15. Тесты (Foundation scope)

### Unit

- `theme/scripts.test.ts` — `scriptForLang` для всех известных и неизвестных языков
- `stores/settingsStore.test.ts` — все actions меняют state корректно, defaults,
  `setFontSize` clamping (15..26)
- `components/ui/Button.test.tsx` — рендер вариантов, onPress
- `components/ui/Sheet.test.tsx` — open/close, backdrop press вызывает onClose
- `components/ui/TabBar.test.tsx` — active state, onPress per tab

### Smoke

- `__tests__/smoke/foundation.smoke.tsx` — рендерит RootLayout с минимальными
  моками expo-font, проверяет что Tabs появляются (для `onboardingCompleted=true`)

### Mocks (`jest.setup.js`)

- `react-native-unistyles` — заглушки `StyleSheet.create`, `useStyles`, `UnistylesRuntime`
- `expo-blur` — `BlurView` → `View`
- `expo-font` — `useFonts` → `[true, null]`
- `react-native-svg` — `Svg`, `Path` → `View`, `View`
- `react-native-gesture-handler` — стандартный setup
- `expo-localization` — `getLocales` → `[{ languageCode: 'en' }]`

---

## 16. Definition of Done

Foundation считается завершённым когда:

- [ ] `npx create-expo-app` инициализирован, старый код удалён
- [ ] `package.json` содержит все deps из §3
- [ ] `app/` структура из §4 создана, все роуты — стабы рендерят свой заголовок
- [ ] Все 30+ шрифтов в `assets/fonts/`, грузятся через `useFonts`
- [ ] Unistyles v3 настроен с 3 themes + `script` variants, types сужены
- [ ] SettingsStore рабочий, все actions меняют state
- [ ] 12 UI-примитивов + 26 иконок имплементированы и снапшотятся в Storybook-стиле
  (либо просто в smoke-экране `/playground` за feature-flag)
- [ ] i18n инициализирован, en/ru/pl/uk JSON-файлы с базовыми ключами
- [ ] Vertical-slice smoke (§14) проходит на iOS Simulator + Android emulator
- [ ] Unit tests (§15) проходят, coverage ≥ 60% на `src/theme/` и `src/stores/`
- [ ] `npx expo lint` без ошибок
- [ ] README обновлён с инструкциями запуска dev-client

---

## 17. Риски и митигации

| # | Риск | Вероятность | Митигация |
|---|---|---|---|
| 1 | Unistyles v3 + New Arch несовместимость с какими-то deps | средняя | Smoke-чек на этапе init; fallback на ThemeContext если что |
| 2 | Bundle size 15-25 MB неприятен пользователям | высокая | Документируем в README; в v2 — APK splits + lazy-load JP/KR/AR/HI |
| 3 | `experimentalBlurMethod="dimezisBlurView"` будет нестабилен на разных Android | средняя | Fallback: semi-transparent solid background для tab-bar если detect lag |
| 4 | Reanimated worklets читают `useStyles()` → краш | низкая | Документируем правило: только JS thread; review-чеклист |
| 5 | RTL в Arabic ломает layout reader-контейнеров | средняя | Smoke включает арабский тест; ограничиваем RTL только reader-областью |
| 6 | Per-language шрифты дают FOUT при первом switch | низкая | Все шрифты в bundle и preload через `useFonts` |
| 7 | Изменение Expo SDK в течение разработки ломает что-то | низкая | Фиксируем точную версию SDK 55.x в package.json |

---

## 18. Outputs для следующих sub-projects

Что Foundation отдаёт следующим в цепочке:

| Sub-project | Получает от Foundation |
|---|---|
| #2 Data layer | Canonical types (`ContentItem`, `BookChapter`), SettingsStore-shape для persistence |
| #3 Import | UI-примитивы (Button, Card, Sheet, Headline), Icons, i18n-ключи |
| #4 Reader engine | `<ReadingText>` шаблон через Unistyles variants, theme bridge, `PhoneShell`, `TabBar` |
| #5 Translation | `<Sheet>` с handle для popup, IconBtn |
| #6 Deck/SRS | Card-шаблон, Pill, Button-accent |
| #7 Stats | Card, Stat, SectionLabel, BookCover, ProgressBar |
| #8 Onboarding polish | Структура (onboarding) роутов, Button-block, language picker layout |

---

## 19. Открытые вопросы (для ревью)

Эти моменты не закрыты в дизайне — оставляю как TODO для последующих specs:

1. **Onboarding step 1 — UI language picker.** В дизайне показан только step 2
   ("I'm reading in..."). Step 1 и 3 нужно дизайнить совместно при #8.
2. **`fontFamilyMode: 'serif' | 'sans'`** — переключатель в reader-settings.
   Применяется к `--font-reading`. Уточнить в #4: меняет только reading
   контент или весь UI?
3. **Sepia + adaptiveThemes несовместимы.** Когда `themeAuto=true`, sepia
   автоматически выключается. Документировать в Settings UI (#8).
4. **Word-tap hit area** в дизайне = `padding: 0 .04em` (~1px). Возможно
   нужно больше для удобства тапа на тонких CJK-шрифтах. Решить в #4.
5. **`nativeLanguage` scope.** Сейчас `string` (BCP-47) — теоретически любой
   язык. Но переводчик Hy-MT1.5-1.8B имеет ограниченный набор пар. Уточнить
   в #5 — какой реальный supported set + сужать ли тип.

---

_Конец Foundation spec._
