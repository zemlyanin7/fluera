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
| Состояние UI | Zustand (`zustand` + middleware `subscribeWithSelector`) | Из CLAUDE.md, легче чем Redux |
| Иконки | `react-native-svg` (port дизайн-иконок 1:1) | Pixel-perfect, нет зависимости от стороннего icon-pack |
| Blur | `expo-blur` (BlurView) + `experimentalBlurMethod="dimezisBlurViewSdk31Plus"` на Android | Лучшая perf чем `dimezisBlurView`: на Android <12 blur пропускается вместо RenderScript-CPU |
| Bottom sheet | `@gorhom/bottom-sheet` v5+ | Production-grade drag, snap-points, keyboard handling. Hand-rolled = переоткрытие edge-кейсов |
| Жесты | `react-native-gesture-handler` + `react-native-reanimated` | Peer deps `@gorhom/bottom-sheet` |
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
    [bookId].tsx                      # default push, full-screen
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
    splitWords.ts                     # минимальный regex split для Foundation smoke
                                      # (полноценный word tokenizer — в #4)

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

// Single subscriber на изменения themeId / themeAuto в Zustand.
// Возвращает unsubscribe — обязательно вызывать в cleanup useEffect.
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
    { fireImmediately: true },
  );
}
```

Вызов в `app/_layout.tsx`:

```typescript
useEffect(() => {
  const unsubscribe = attachThemeBridge();
  return unsubscribe;  // cleanup при unmount root layout
}, []);
```

**Threading:** Zustand subscriptions работают на JS thread. `UnistylesRuntime.setTheme`/`setAdaptiveThemes` диспатчят в ShadowTree внутренне. Бридж **нельзя** вызывать из Reanimated worklet.

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

### 5.7. Использование в компонентах (Unistyles v3 API)

**Важно:** в Unistyles v3 `useStyles(stylesheet, variants)` **удалён**. Стили
читаются напрямую с экспортированного объекта, варианты применяются через
`styles.useVariants({ script })` ВНУТРИ компонента. Порядок имеет значение:
`useVariants` вызывается **до** чтения свойств.

```typescript
import { StyleSheet } from 'react-native-unistyles';
import { Text } from 'react-native';
import { useSettingsStore } from '@/stores/settingsStore';
import { scriptForLang } from '@/theme/scripts';

const styles = StyleSheet.create((theme, rt) => ({
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
  styles.useVariants({ script: scriptForLang(bookLang) });
  return <Text style={styles.reading}>{children}</Text>;
}
```

**Типизация вариантов:** Unistyles v3 автоматически выводит варианты из
`StyleSheet.create`. Утилитарный тип `UnistylesVariants<typeof styles>` доступен
для prop-передачи. Дополнительная module augmentation для `UnistylesVariants`
**не требуется** — оставляем только `UnistylesThemes` и `UnistylesBreakpoints` (§5.4).

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

/**
 * Блочный элемент контента.
 *
 * Поля для разрешения:
 * - `heading.id`: anchor для оглавления (TOC) и для EPUB `#fragment` ссылок.
 *   Заполняется парсерами в #3 (например, slug из заголовка).
 * - `image.aspectRatio`: высоту в момент парсинга мы не всегда знаем (EPUB,
 *   удалённые изображения), но aspect-ratio часто доступен — используется в #4
 *   чтобы избежать layout-jank. Если неизвестен — рендерится плейсхолдер
 *   фиксированной высоты, описанный в #4.
 * - `list.items: ContentItem[][]` — каждый item списка может содержать
 *   подбоки (вложенные списки, параграфы внутри пункта).
 * - `blockquote.items`: всегда блоки. Inline-цитаты заворачиваются парсером в
 *   `paragraph` внутри `blockquote.items`. Это убирает двойную репрезентацию.
 */
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
  /**
   * Per-chapter override языка чтения (например, EPUB `xml:lang` на section).
   * Если `null` — используется `Book.language` (книги-метаданные в #2).
   */
  lang?: string | null;
}

/**
 * Сноски на уровне книги. В отличие от inline-нод, тело сноски может содержать
 * несколько параграфов (EPUB), поэтому значение — массив блоков `ContentItem[]`.
 */
export interface BookFootnotes {
  [id: string]: ContentItem[];
}

/**
 * Максимальная глубина вложенности `InlineNode.children`.
 *
 * Контракт: парсеры (#3) обязаны обрезать вложенность на этой глубине,
 * сохраняя текстовый контент через flatten. Рендерер (#4) полагается на
 * этот контракт и не имеет защиты от patalogical EPUB.
 */
export const MAX_INLINE_DEPTH = 20;
```

### 6.2. `src/types/settings.ts`

**Семантика `bookLanguage`.** В `SettingsState` это поле = "язык по умолчанию для
новых импортов" (книги без явного метаданных-языка). **Не** runtime-состояние
открытой книги — за это отвечает `readerStore.activeBookLanguage`, который создаётся
в #4. Foundation использует `SettingsState.bookLanguage` только в smoke-сцене.

**Бренд-тип `NativeLanguage`.** Переводчик Hy-MT поддерживает ограниченный набор
пар. Чтобы онбординг не предлагал Klingon и не падал в #5, оборачиваем тип в
branded `NativeLanguage`. Конкретный набор пар уточняется в #5; здесь — рамка.

```typescript
export type ThemeId = 'light' | 'sepia' | 'dark';
export type FontFamilyMode = 'serif' | 'sans';
export type ScrollMode = 'page' | 'scroll';
export type ProficiencyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'auto';
export type TapToTranslateBehavior = 'instant' | 'delay' | 'long-press';
export type AutoAddToDeck = 'always' | 'never' | 'ask';

/**
 * BCP-47 коды для пар перевода, реально поддерживаемых моделью Hy-MT в #5.
 * Финальный список заполняется при интеграции llama.rn в #5.
 */
export const SUPPORTED_NATIVE_LANGUAGES = ['en', 'ru', 'pl', 'uk', 'es', 'fr', 'de'] as const;
export type NativeLanguage = (typeof SUPPORTED_NATIVE_LANGUAGES)[number];
export const SUPPORTED_BOOK_LANGUAGES = ['en', 'ru', 'pl', 'uk', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'ar', 'hi'] as const;
export type BookLanguage = (typeof SUPPORTED_BOOK_LANGUAGES)[number];

export interface SettingsState {
  // ─── Languages ───
  uiLanguage: 'en' | 'ru' | 'pl' | 'uk';
  nativeLanguage: NativeLanguage;     // для перевода в (тип сужен)
  bookLanguage: BookLanguage;         // default для новых импортов, НЕ runtime

  // ─── Theme ───
  themeId: ThemeId;
  themeAuto: boolean;                 // auto sepia не работает (см. §19)

  // ─── Reading ───
  fontFamilyMode: FontFamilyMode;
  fontSize: number;                   // px, clamp 15..26, default 19
  scrollMode: ScrollMode;
  highlightUnknown: boolean;          // см. §19 — рендеринг определит #4
  showSentenceTranslation: boolean;
  pageFlipAnim: boolean;              // косметика, не learner-default

  // ─── Pedagogy (UX рендерится в #4/#5/#6, но persistence-shape фиксируем здесь) ───
  bookLanguageLevel: ProficiencyLevel;       // 'auto' = эвристика по WordStatus в #6
  tapToTranslateBehavior: TapToTranslateBehavior;  // активная retrieval vs. instant
  autoAddToDeck: AutoAddToDeck;
  showPhonetics: boolean;             // критично для AR/JP/HI/KR
  lookupHistoryEnabled: boolean;      // трекинг частых тапов без save (#6)
  readingSessionGoalMinutes: number;  // gamification target (#7)

  // ─── Onboarding ───
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
  highlightUnknown: false,            // ИЗМЕНЕНО: для A1-A2 wall-of-color вредит
  showSentenceTranslation: false,
  pageFlipAnim: true,
  bookLanguageLevel: 'auto',
  tapToTranslateBehavior: 'instant',  // дефолт; pedagogy-эксперимент в #5
  autoAddToDeck: 'ask',
  showPhonetics: false,
  lookupHistoryEnabled: true,
  readingSessionGoalMinutes: 15,
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
  setNativeLanguage: (v: NativeLanguage) => void;
  setBookLanguage: (v: BookLanguage) => void;
  setTheme: (id: SettingsState['themeId'], auto?: boolean) => void;
  setFontFamilyMode: (v: SettingsState['fontFamilyMode']) => void;
  setFontSize: (v: number) => void;
  setScrollMode: (v: SettingsState['scrollMode']) => void;
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
    setBookLanguageLevel: (v) => set({ bookLanguageLevel: v }),
    setTapToTranslateBehavior: (v) => set({ tapToTranslateBehavior: v }),
    setAutoAddToDeck: (v) => set({ autoAddToDeck: v }),
    toggleShowPhonetics: () => set((s) => ({ showPhonetics: !s.showPhonetics })),
    toggleLookupHistoryEnabled: () => set((s) => ({ lookupHistoryEnabled: !s.lookupHistoryEnabled })),
    setReadingSessionGoalMinutes: (v) => set({ readingSessionGoalMinutes: Math.max(5, Math.min(120, v)) }),
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

### 8.2. Загрузка — `expo-font` config plugin (build-time embed)

С 35+ шрифтами `useFonts()` runtime-загрузка даёт ощутимый FOUT при первом
рендере + увеличивает cold start. Expo SDK 55 рекомендует **config plugin**
для нативного встраивания: шрифты прописываются в `app.json`, при сборке
попадают в native bundle и доступны мгновенно без хука.

```json
// app.json
{
  "expo": {
    "plugins": [
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
    ]
  }
}
```

Имена fontFamily в RN = имя файла без расширения. `useFonts()` хук НЕ
используется. `expo prebuild` + `eas build` пересобирают native code с этими
шрифтами.

В `app/_layout.tsx` остаётся только Splash:

```typescript
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Шрифты уже встроены в native bundle. Просто скрываем splash.
    SplashScreen.hideAsync();
    const unsubscribe = attachThemeBridge();
    return unsubscribe;
  }, []);
  return <Stack>{/* ... */}</Stack>;
}
```

---

## 9. Icons

### 9.1. Принцип

Из `icons.jsx` дизайна берём 26 SVG-path данных. Каждая иконка =
24×24 viewBox, stroke 1.8, `currentColor`, `strokeLinecap/Join: round`.

### 9.2. `src/components/icons/Icon.tsx`

**Важно:** `currentColor` — web-CSS, в `react-native-svg` не существует. Цвет
передаётся всегда явно. Дефолт берём из `theme.ink` через Unistyles, либо
явный prop.

```typescript
import React from 'react';
import { Svg } from 'react-native-svg';
import { StyleSheet } from 'react-native-unistyles';

export interface IconProps {
  size?: number;        // default 22
  color?: string;       // default — theme.ink
  strokeWidth?: number; // default 1.8
  fill?: string;        // default 'none'
}

const styles = StyleSheet.create((theme) => ({
  defaultColor: theme.ink,
}));

export const Icon = ({
  size = 22,
  color,
  strokeWidth = 1.8,
  fill = 'none',
  children,
}: IconProps & { children: React.ReactNode }) => {
  const resolvedColor = color ?? styles.defaultColor;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={resolvedColor}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
};
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

26 экспортов. `Path` импортируется из `react-native-svg`:

```typescript
import { Path, Circle, Rect } from 'react-native-svg';
import { Icon, type IconProps } from './Icon';
import { PATHS } from './paths';

export const IcChevronLeft  = (p: IconProps) =>
  <Icon {...p}><Path d={PATHS.chevronLeft}/></Icon>;
export const IcChevronRight = (p: IconProps) =>
  <Icon {...p}><Path d={PATHS.chevronRight}/></Icon>;
// ... 24 остальных. Некоторые иконки используют <Circle> или <Rect> (см. icons.jsx)
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
| `Sheet` (обёртка над `@gorhom/bottom-sheet`) | `visible`, `onClose`, `snapPoints?`, `children` | open/closing (animated через native gorhom) |
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
  `experimentalBlurMethod="dimezisBlurViewSdk31Plus"`. Тени из дизайна
  (`box-shadow`) через RN `shadow*` props на iOS + `elevation` на Android.
  Активная иконка = `theme.ink`, неактивная = `theme.ink3`. Точка-индикатор
  под активной = `theme.accent` 4×4 круг.
- **`Sheet`** = тонкая обёртка над `<BottomSheet>` из `@gorhom/bottom-sheet`.
  Преимущества vs. ручной: правильная клавиатура, snap-points, scroll внутри
  sheet, native swipe-feel. Backdrop через `<BottomSheetBackdrop>` с
  `disappearsOnIndex={-1}`. Хелпер `useRef<BottomSheet>` экспортируется через
  props для управления извне.
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

1. Запуск → splash → 3-step онбординг (порядок шагов уточняется в #8 — см. §19).
   Все опции работают, Continue заполнен.
2. После онбординга → Library с **hardcoded** карточкой "The Garden of
   Forking Paths"
3. Тап на карточку → Reader (push) с **hardcoded Borges-параграфом**.
   Параграф приходит как pre-split `InlineNode[]` фикстура в
   `src/fixtures/borges.ts` (не парсим runtime — это smoke). `splitWords.ts`
   обрабатывает только конкретный массив строк параграфа из дизайна.
   Один экран — без пагинации, без скролла фокусируемся на стилях.
4. Тап на слово → подсветка `is-active` (terracotta solid), повторный тап
   снимает
5. Кнопка "FontSize" в Reader top-bar → `Sheet` (gorhom) поднимается с тремя
   темами (Day/Sepia/Night) — мгновенное переключение цветов без re-mount
   Reader-стека (стек сохраняется при tab-switch, проверяется явно)
6. Settings tab → BookLanguage picker (en/ru/ja/ar/ko/hi). Возврат в Reader
   меняет шрифт (Latin → Cyrillic → JP → Arabic с RTL → Korean → Devanagari).
   **RTL-инвариант:** в Arabic меняется только `writingDirection`/`textAlign`,
   `paper`/`ink` цвета НЕ инвертируются.
7. Tab-bar swipe между 4 табами — blur не лагает на Android (Pixel 7)
8. Cold-start timing: `console.time('cold-start')` в первой строке
   `app/_layout.tsx`, `console.timeEnd` после первого рендера Library.
   Бюджет: **<1500ms** на Pixel 7 (release build), **<2500ms** на iPhone 13.

### Целевые устройства

- iOS: iPhone 13 (Simulator + реальное при возможности)
- Android: Pixel 7 / эмулятор API 33+
- Optionally: low-end Android (Helio G99 / 4GB RAM) — проверка
  blur-производительности

### Что считать pass

- Темы переключаются мгновенно (≤ 50ms)
- Шрифты применяются без FOUT (config-plugin native embed, §8.2)
- Word tap имеет hit-area ≥ 32×32 (padding на `<Text>` обязателен)
- Tab-bar blur ≥ 55 FPS на Pixel 7
- Cold-start укладывается в бюджет (§14, шаг 8)
- RTL не инвертирует цветовую схему (§14, шаг 6)

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

- `react-native-unistyles` — заглушки `StyleSheet.create` (возвращает объект со
  свойством `useVariants: () => void`), `UnistylesRuntime` (setTheme/setAdaptiveThemes — no-op)
- `@gorhom/bottom-sheet` — `BottomSheet`/`BottomSheetBackdrop` → `View`/`View`
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
- [ ] Unistyles v3 настроен с 3 themes + `script` variants; module augmentation
  `UnistylesThemes` и `UnistylesBreakpoints` компилируется без ошибок;
  `styles.useVariants({...})` в компоненте возвращает типизированные значения
  без `any`
- [ ] SettingsStore рабочий: все actions меняют свои поля; `setFontSize` clamp
  на границах 15 и 26; `setReadingSessionGoalMinutes` clamp 5..120; reset
  возвращает `DEFAULT_SETTINGS`
- [ ] 12 UI-примитивов + 26 иконок имплементированы и видны в dev-only
  playground-роуте `app/(playground)/index.tsx` (за `__DEV__` guard). Без
  snapshot-тестов для иконок
- [ ] i18n инициализирован, en/ru/pl/uk JSON-файлы с базовыми ключами из §13.2
- [ ] Vertical-slice smoke (§14) проходит на iOS Simulator + Android emulator,
  включая RTL-инвариант и cold-start budget
- [ ] Unit tests (§15) — конкретные тест-кейсы (НЕ coverage threshold):
  `scriptForLang` для всех 18 mapped langs + 2 unknown; `setFontSize` clamping
  15 и 26; все 17 actions SettingsStore меняют ровно своё поле; Button рендерит
  все варианты; Sheet open/close через ref
- [ ] `tsc --noEmit` без ошибок (`expo lint` НЕ запускает tsc отдельно)
- [ ] `npx expo lint` без warnings
- [ ] README обновлён с инструкциями запуска dev-client (`eas build --profile
  development` + `expo start --dev-client`)

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

1. **Onboarding порядок шагов.** Текущий дизайн: UI-lang → book-lang →
   native-lang. Language-teaching ревью рекомендует: book-lang → native-lang →
   UI-lang (UI default = native, опциональный override). Финально решается в
   #8 (Onboarding polish). Foundation создаёт три роута стабов, переименовать
   при необходимости в #8.
2. **`fontFamilyMode: 'serif' | 'sans'`** — применяется только к reading
   контенту в Reader (#4). UI всегда `Inter`/`Geist`. Решено: только reading.
3. **Sepia + adaptiveThemes несовместимы.** Когда `themeAuto=true`, sepia
   автоматически выключается. Документировать в Settings UI (#8).
4. **Word-tap hit area** в дизайне = `padding: 0 .04em` (~1px). Возможно
   нужно больше для удобства тапа на тонких CJK-шрифтах. Решить в #4.
5. **Финальный supported set пар `NativeLanguage`/`BookLanguage`.** Заполнен
   placeholder-значениями. Точный список — после интеграции Hy-MT в #5.
6. **`highlightUnknown` рендеринг.** Foundation хранит флаг, рендер в #4.
   Pedagogy-рекомендация: показывать только `learning` (амбер) по умолчанию;
   `new` (терракот) только при `highlightUnknown=true` И `level >= B1`;
   `known` (сейдж) никогда не подсвечивается (знание не actionable).
   Финализировать в #4.
7. **L2 reading leading.** Pedagogy-ревью указывает: 1.65 для Latin — нижняя
   граница комфорта для L2. Можно поднять до 1.7–1.75. Эксперимент в #4.
8. **`readingMeasure` (max line width per script).** L2 reader страдает от
   длинных строк (>50ch). Добавить в #4 как часть Reader-настроек.
9. **`bookLanguage` semantic.** В `SettingsState` = "default для новых
   импортов". Runtime-состояние открытой книги — отдельный `readerStore`
   (создаётся в #4). Foundation НЕ создаёт `readerStore`; smoke использует
   `SettingsState.bookLanguage` напрямую.
10. **`heading.id` генерация.** Парсеры в #3 должны генерировать stable
    slug-id для каждого heading. Алгоритм (slugify? hash от текста? incrementing
    counter?) — решается в #3.
11. **`bookLanguageLevel: 'auto'`** — эвристика по WordStatus реализуется в #6
    SRS. Foundation хранит флаг.

---

_Конец Foundation spec._
