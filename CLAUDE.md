# Fluera — Правила разработки

## Общие правила

- **Язык**: вся документация, комментарии в коде и общение — на русском языке
- Никогда не выдумывать информацию — если не уверен, прямо говори об этом

## Обзор проекта

Fluera — мультиязычное мобильное приложение-читалка для изучения языков через
чтение. **Полностью локальное** приложение: бэкенда в v1 НЕТ, всё работает
на устройстве (книги, БД, перевод через on-device LLM).

- **Канонический design-doc:** `docs/superpowers/specs/2026-03-13-fluera-design.md`
  (исходный, частично устаревший — актуальные решения см. в sub-project спеках ниже)
- **Foundation (готов):** `docs/superpowers/specs/2026-05-15-foundation-design.md`
- **Sub-projects roadmap:**
  - #1 Foundation (готов) — темы, шрифты, навигация, primitives
  - #2 Data layer (в работе) — WatermelonDB, модели, persist
  - #3 Reader engine — EPUB/FB2 парсеры с нуля
  - #4 Translation — Hy-MT1.5-1.8B on-device LLM
  - #5 Library — OPDS, импорт файлов
  - #6 Deck — FSRS-6 SRS
  - #7 Stats — графики, streak
  - #8 Onboarding/Settings polish

## Технологический стек

- **Фреймворк:** React Native 0.81.5 + Expo SDK 54 (Expo Router для навигации)
- **Язык:** TypeScript (strict mode)
- **Состояние:** Zustand v5 + AsyncStorage persist (клиентское состояние)
- **UI:** react-native-unistyles v3 (темы + StyleSheet.create). НЕ Tamagui.
- **База данных:** WatermelonDB (offline-first SQLite, без sync в v1)
- **Анимации:** Reanimated 4
- **i18n:** i18next + react-i18next + expo-localization
- **Тестирование:** Jest + @testing-library/react-native
- **Шрифты:** expo-font (39 .ttf в bundle, 7 семейств для 6 script-вариантов)
- **Иконки:** react-native-svg (25 кастомных Port из дизайна)
- **Sheet:** @gorhom/bottom-sheet v5
- **Бэкенд:** НЕТ. Не планируется и в v1, и в v2. Это отдельное приложение.

## Правила архитектуры

### Структура файлов
- Роуты располагаются в `app/` (файловая маршрутизация Expo Router)
- Весь код, не относящийся к роутам, — в `src/`
- Компоненты организованы по доменам: `src/components/reader/`, `src/components/library/` и т.д.
- Общие UI-компоненты — в `src/components/ui/`
- Иконки SVG — в `src/components/icons/`
- Бизнес-логика и сервисы — в `src/services/`
- Zustand-сторы — в `src/stores/`
- Кастомные хуки — в `src/hooks/`
- Схема и модели базы данных — в `src/db/` (schema, models, migrations, repositories)
- Темы и токены — в `src/theme/`
- Типы — в `src/types/`
- i18n локали — в `src/i18n/locales/`
- Фикстуры для разработки/тестов — в `src/fixtures/`

### Custom entry
- `index.js` (корень) импортирует `@/theme` ДО `expo-router/entry`, чтобы
  `StyleSheet.configure` выполнился до того, как Metro/expo-router начнут
  загружать роуты с `StyleSheet.create((theme) => ...)` на верхнем уровне.

### Управление состоянием
- **Zustand v5 + persist middleware** — UI-состояние И персистентные настройки.
  Persist через `@react-native-async-storage/async-storage`. Без Redux.
- **WatermelonDB** — для офлайн-данных приложения (книги, слова, прогресс,
  словарь, OPDS-каталоги, статистика). Доступ через model + repository слой,
  компоненты используют hooks (`useBookList`, `useWordStatus`, ...).
- **НЕ TanStack Query** в v1 — нет сервера. WatermelonDB observables дают
  реактивность сами по себе.
- НЕ смешивать слои состояния. Компонент должен использовать либо Zustand,
  либо БД-хук для конкретного куска данных, но не оба одновременно.

### Паттерны компонентов
- Только функциональные компоненты. Без классов.
- Использовать обычные React Native компоненты (`View`, `Text`, `Pressable`)
  стилизованные через `react-native-unistyles`. НЕ Tamagui.
- Использовать `theme.*` через `useUnistyles()` хук inline или
  `StyleSheet.create((theme) => ({...}))`. НЕ хардкодить hex.
- Цветовые токены (paper, ink, accent, ...) определены в `src/theme/tokens.ts`.
  6 script-вариантов типографики в `scriptTypography`.
- Предпочитать `const`-экспорты для компонентов. Использовать `React.memo()`
  только когда профилирование показало необходимость.
- Компоненты — не более 200 строк. Выделять подкомпоненты/хуки при приближении.

### TypeScript
- Strict mode включён. Никаких `any`, кроме обёрток над сторонними библиотеками.
- Использовать `interface` для описания объектов, `type` — для объединений.
- Экспортировать типы из файла, где они определены, а не из barrel-файлов.
- Предпочитать `unknown` вместо `any` для нетипизированных внешних данных,
  затем сужать тип через type guards.

### Темы (react-native-unistyles v3)
- 3 темы: `light` (Day), `sepia` (Sepia), `dark` (Night). Auto = system colorScheme.
- Семантические токены: `paper`, `paper2`, `ink`, `ink2`, `ink3`, `accent`,
  `accentSoft`, `accentLine`, `known`, `knownSoft`, `learning`, `learningSoft`,
  `newSoft`. ВСЕ цвета в sRGB hex/rgba (oklch ломает native ShadowTree на iOS).
- При смене темы используем `applyTheme()` синхронно в action `setTheme`
  (см. `src/theme/applyTheme.ts`), бридж как fallback для persist-rehydration.
- **Известная проблема**: native ShadowTree binding не всегда обновляет
  закэшированные `StyleSheet.create((theme) => ...)`. Для компонентов с
  театоо-зависимыми цветами читать theme inline через
  `const { theme } = useUnistyles()` (см. PhoneShell, TabBar, Headline и др.).
- Babel-плагин: `['react-native-unistyles/plugin', { root: 'src',
  autoProcessImports: ['react-native-unistyles', '@/theme'] }]`.

### Переводы (i18n)
- Все строки для пользователя ОБЯЗАНЫ использовать функцию `t()` из i18next.
- Ключи переводов используют точечную нотацию: `library.bookCard.progress`.
- Файлы локалей — в `src/i18n/locales/{lang}.json`.
- Языки для MVP: `en`, `ru`, `pl`, `uk`.
- `bookLanguage` + `nativeLanguage` всегда параметризованы — никогда не
  предполагать конкретную языковую пару.

### Читалка (sub-project #3)
- EPUB парсер пишем С НУЛЯ: zip-распаковка + XHTML-парсинг → ContentItem[].
  НЕ используем @epubjs-react-native (WebView-based, тяжёлый).
- FB2 парсер пишем С НУЛЯ: XML-парсинг → ContentItem[]. НЕ используем
  fast-xml-parser (хотим контроль над namespace + binary-image handling).
- Рендеринг через нативные React Native компоненты (НЕ WebView).
- Канонические типы рендера: `ContentItem`, `InlineNode`, `BookChapter`,
  `BookFootnotes` в `src/types/content.ts` (определены в Foundation).
- Подсветка слов и обработка тапов — общий слой над ContentItem-деревом.
- Попап перевода — общий компонент.

### База данных (WatermelonDB)
- Изменения схемы требуют миграций в `src/db/migrations/`.
- Версионирование схемы через `SCHEMA_VERSION` в `src/db/schema.ts`.
- Таблицы (см. спеку #2 Data layer):
  - `Book`, `Chapter`, `ReadingPosition`, `Bookmark`
  - `WordStatus` (FSRS-6 поля), `WordOccurrence`, `ReviewLog`
  - `TranslationCache`
  - `OPDSCatalog` (URL без креденшлов; креды в SecureStore)
  - `ReadingStats`
- НЕТ `UserSettings` таблицы — настройки в Zustand SettingsStore с persist.
- Никогда не делать запросы к БД напрямую из компонентов — использовать хуки
  (`useWordStatus`, `useBookProgress`, `useDeckQueue`, и т.д.).
- Доступ к моделям через repository-слой (`src/db/repositories/`).

### LLM-перевод (sub-project #4)
- Локальная on-device модель: Hy-MT1.5-1.8B-1.25bit-GGUF (tencent).
- Все вызовы LLM проходят через `src/services/translation/TranslationService.ts`.
- TranslationCache — обязательная проверка перед инференсом.
- Ключ кэша: `SHA-256(lowercase(word) + context_window + lang_pair)`,
  усечённый до 32 символов.
- НЕТ API-ключей, НЕТ облачных fallback в v1.

## Качество кода

### Тестирование
- Писать тесты для сервисов, бизнес-логики, моделей.
- Файлы тестов в `__tests__/` mirror'ируют структуру `src/` (как в Foundation).
- Использовать `@testing-library/react-native` для тестов компонентов.
- Тестировать сервис перевода с замоканной LLM-сессией.
- Тестировать модели WatermelonDB с in-memory адаптером.
- Запускать `npx tsc --noEmit && npx jest && npx expo lint` перед коммитом.
- TDD-дисциплина: RED → GREEN → REFACTOR для бизнес-логики.

### Соглашения Git
- Именование веток: `feat/`, `fix/`, `refactor/`, `docs/`, `chore/`.
- Сообщения коммитов: conventional commits (`feat:`, `fix:`, `docs:`,
  `refactor:`, `test:`, `chore:`).
- Коммиты атомарные — одно логическое изменение на коммит.
- НЕТ co-author трейлеров без явной просьбы.

### Безопасность
- НЕТ API-ключей и секретов в коде (всё локально, ключей нет).
- Валидировать весь OPDS XML перед парсингом (защита от XXE).
- Санитизировать URL каталогов: parse → strip userinfo → store креды в
  SecureStore (`expo-secure-store`), а URL без креденшлов в БД.
- Использовать HTTPS для всех HTTP-вызовов (OPDS-каталоги).
- Исключить SQLite + книги из iCloud/Android Auto Backup:
  `NSURLIsExcludedFromBackupKey=true` (iOS), `android:allowBackup="false"`.
- TranslationCache: time-based purge (90 дней) + "Clear data" action в Settings.
- НЕ SQLCipher в v1 (sandbox encryption достаточно).
- Запускать OWASP mobile security checker
  (`.claude/skills/owasp-mobile-security-checker/`) перед релизами.

### Производительность
- Читалка должна работать плавно — никаких подвисаний при скролле или
  подсветке слов.
- Попап перевода: <500мс на cache hit, <3с на on-device LLM inference.
- Расчёт сложности книги в фоновом потоке (`InteractionManager.runAfterInteractions()`).
- Использовать `React.lazy` для некритичных экранов (Статистика, Настройки).
- Профилировать через React DevTools перед оптимизацией.
- Chapter content: re-parse on-demand + LRU 3 чаптера в памяти (НЕ JSON в БД).

## Команды

```bash
# Разработка
npm start                         # alias: expo start --dev-client
npm run ios                       # expo run:ios
npm run android                   # expo run:android

# Тестирование
npm test                          # jest
npm run typecheck                 # tsc --noEmit
npm run lint                      # expo lint

# Сборка
npx eas build --platform ios
npx eas build --platform android
```

## Локальные skills проекта

`.claude/skills/`:
- `react-native-expert` — архитектура RN, Expo Router, платформенная обработка
- `react-expert` — паттерны React, хуки, управление состоянием
- `typescript-pro` — продвинутые типы TypeScript
- `javascript-pro` — современный JS, асинхронные паттерны
- `api-designer` — паттерны проектирования REST API (только для OPDS-клиента)
- `architecture-designer` — архитектурные решения
- `code-reviewer` — чеклист код-ревью
- `database-optimizer` — оптимизация SQLite-запросов и индексов
- `test-master` — методология TDD/BDD
- `owasp-mobile-security-checker` — аудит мобильной безопасности
