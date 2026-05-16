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

- **Фреймворк:** React Native 0.81.5 + Expo SDK 54 (Expo Router для навигации).
  SDK 54 выбран как RN 0.81.5 baseline для Foundation; SDK 55 (Nov 2025) —
  upgrade-кандидат в v2 без блокирующих причин остаться.
- **New Architecture:** включена (`newArchEnabled: true`). **Обязательное**
  требование для Reanimated 4, react-native-unistyles v3 (ShadowTree),
  @gorhom/bottom-sheet v5. Не выключать.
- **JS engine:** Hermes (дефолт SDK 54). Учитывать при выборе libs (особенно
  для парсеров в #3 — некоторые npm-пакеты падают под Hermes).
- **Язык:** TypeScript (strict mode). `tsconfig.json` paths `@/* → src/*`
  ОБЯЗАТЕЛЬНО синхронизированы с `babel-plugin-module-resolver` (иначе
  `npx tsc --noEmit` падает на @-импортах).
- **Состояние:** Zustand v5. Persist middleware **будет добавлен в #2**
  Data layer вместе с `@react-native-async-storage/async-storage`.
  В Foundation persist отсутствует — настройки сбрасываются при рестарте.
- **UI:** react-native-unistyles v3 (темы + StyleSheet.create). НЕ Tamagui.
- **База данных:** WatermelonDB (offline-first SQLite, без sync в v1).
  **Будет установлена в #2** Data layer (пакет `@nozbe/watermelondb`).
- **Анимации:** Reanimated 4. Требует `react-native-worklets@^0.5`
  (отдельный peer dep). Worklets — обязательная `'worklet'` директива
  для UI-thread кода.
- **i18n:** i18next + react-i18next + expo-localization
- **Тестирование:** Jest 29 + `jest-expo@54` + `@testing-library/react-native@13`.
  Закреплено через `package.json` — Jest 30 имеет известные проблемы с RN 0.81.
- **Шрифты:** expo-font config plugin (39 .ttf в bundle, 7 семейств для 6
  script-вариантов). Загрузка через build-time embed — НЕТ FOUT/FOIT, шрифты
  доступны до первого render.
- **Иконки:** react-native-svg (25 кастомных Port из дизайна)
- **Sheet:** @gorhom/bottom-sheet v5. Требует `GestureHandlerRootView` в корне
  + Reanimated worklets. Snap points + background blur — см. примеры в Foundation.
- **SecureStore:** `expo-secure-store` **будет добавлена в #2** для OPDS-креденшлов.
- **Бэкенд:** НЕТ. Не планируется и в v1, и в v2. Это отдельное приложение.
- **EAS build:** `eas.json` ещё НЕ настроен. Будет добавлен перед первым
  релизом. Для dev-build используется `npx expo run:ios` / `run:android`.

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
  **AsyncStorage allowlist для persist** (что МОЖНО хранить в plaintext):
  - UI preferences: `themeId`, `themeAuto`, `fontFamilyMode`, `fontSize`,
    `scrollMode`, `highlightUnknown`, `showSentenceTranslation`,
    `pageFlipAnim`, `showPhonetics`, `lookupHistoryEnabled`.
  - Language pair: `uiLanguage`, `nativeLanguage`, `bookLanguage`.
  - Pedagogy: `bookLanguageLevel`, `tapToTranslateBehavior`, `autoAddToDeck`,
    `readingSessionGoalMinutes`.
  - Onboarding state: `onboardingCompleted`.
  - **НЕЛЬЗЯ** хранить в AsyncStorage: OPDS-credentials, auth-токены,
    хешированные идентификаторы, любые секреты. Это ВСЁ → `expo-secure-store`.
- **WatermelonDB** — для офлайн-данных приложения (книги, слова, прогресс,
  словарь, OPDS-каталоги, статистика). Доступ через model + repository слой,
  компоненты используют hooks (`useBookList`, `useWordStatus`, ...).
- **Граница Zustand vs WatermelonDB** для статистики:
  - В Zustand: `readingSessionGoalMinutes` (цель пользователя — это
    предпочтение, persist через AsyncStorage).
  - В WatermelonDB: `ReadingStats` (фактические агрегаты — `time_reading_sec`,
    `words_read`, `words_learned`, `translations_made` по датам/книгам).
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
- **Известная проблема (#1179)**: native ShadowTree binding не всегда обновляет
  закэшированные `StyleSheet.create((theme) => ...)`. Для компонентов с
  тема-зависимыми цветами читать theme inline через
  `const { theme } = useUnistyles()` (см. PhoneShell, TabBar, Headline и др.).
- Babel-плагин: `['react-native-unistyles/plugin', { root: 'src',
  autoProcessImports: ['react-native-unistyles', '@/theme'] }]`.
- **Порядок плагинов в `babel.config.js` важен**:
  `module-resolver` → `react-native-unistyles/plugin` →
  `react-native-reanimated/plugin`. `reanimated/plugin` ОБЯЗАН быть последним
  (transform-аут зависит от уже разрешённых импортов).

### Safe-area и edge-to-edge
- `app.json`: `android.edgeToEdgeEnabled: true`,
  `android.predictiveBackGestureEnabled: false`.
- На корне дерева `_layout.tsx` оборачивать в `SafeAreaProvider` (Foundation).
- Inset-значения брать ЛИБО через `useSafeAreaInsets()` (react-native-
  safe-area-context), ЛИБО через `useUnistyles().rt.insets` (Unistyles
  runtime — единый источник для тем + insets).
- StatusBar содержание (light/dark) — через `expo-status-bar` `style="auto"`
  на корне. Не дублировать на дочерних экранах.

### Accessibility (a11y)
- Все интерактивные элементы (Pressable/Button/TabBar items) ОБЯЗАНЫ иметь
  `accessibilityLabel` (i18n через `t()`) и `accessibilityRole`.
- Минимальная hit-area: 44×44 pt (iOS HIG) / 48×48 dp (Material). При меньшем
  визуальном размере использовать `hitSlop` для расширения зоны.
- Контраст текста соответствует WCAG AA (≥4.5:1 для body, ≥3:1 для large).
  Темы Day/Sepia/Night проверены — не менять `ink/paper` без re-audit.
- Тестировать VoiceOver (iOS) / TalkBack (Android) на ключевых флоу
  (онбординг, тап-перевод, перелистывание чаптера).

### Переводы (i18n) и языки
- Все строки для пользователя ОБЯЗАНЫ использовать функцию `t()` из i18next.
- Ключи переводов используют точечную нотацию: `library.bookCard.progress`.
- Файлы локалей — в `src/i18n/locales/{lang}.json`.
- **UILanguage (язык интерфейса)** MVP: 13 — `en`, `ru`, `pl`, `uk`, `es`,
  `fr`, `de`, `it`, `pt`, `ja`, `ko`, `ar`, `hi`
  (см. `SUPPORTED_UI_LANGUAGES`). Все 13 имеют переводы UI-строк в
  `src/i18n/locales/`.
- **BookLanguage (язык книги)** MVP: 13 — тот же набор
  (см. `SUPPORTED_BOOK_LANGUAGES`).
  Локальная LLM #4 поддерживает все пары `bookLanguage × nativeLanguage`.
- **NativeLanguage (родной)** v1: 7 — `en`, `ru`, `pl`, `uk`, `es`, `fr`, `de`
  (см. `SUPPORTED_NATIVE_LANGUAGES`). Расширение до 13 — в v2 или раньше
  (зависит от качества LLM-перевода для оставшихся пар).
- `bookLanguage` + `nativeLanguage` всегда параметризованы — никогда не
  предполагать конкретную языковую пару в коде/тестах.
- Для RTL-языков (`ar` в UI и Book) использовать `I18nManager.isRTL` +
  layout-direction flip. Темы Foundation уже содержат `isRTL: true` в
  `arabic` script-варианте — типографика RTL работает out-of-the-box.

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
- **`jest.setup.js`** (Foundation) содержит моки для: `react-native-unistyles`
  (включая нетривиальный `useVariants` shim, выполняющий реальный merge),
  `useUnistyles`, `@gorhom/bottom-sheet`, `react-native-svg`, `expo-blur`,
  `expo-linear-gradient`, `expo-font`, `expo-localization`,
  `expo-splash-screen`, `react-i18next`, `react-native-reanimated`.
  Не дублировать моки в отдельных файлах — расширять `jest.setup.js`.

### Соглашения Git
- Именование веток: `feat/`, `fix/`, `refactor/`, `docs/`, `chore/`.
- Сообщения коммитов: conventional commits (`feat:`, `fix:`, `docs:`,
  `refactor:`, `test:`, `chore:`).
- Коммиты атомарные — одно логическое изменение на коммит.
- НЕТ co-author трейлеров без явной просьбы.

### Безопасность
- НЕТ API-ключей и секретов в коде (всё локально, ключей нет).
- **OPDS XML / FB2 XXE защита** (actionable правила, не "validate before parse"):
  - Парсер ОБЯЗАН отключить DTD-resolution (`processEntities: false` или
    эквивалент в выбранной библиотеке).
  - Отвергать XML с `<!DOCTYPE` если есть `ENTITY`/`SYSTEM`/`PUBLIC` —
    бросать ошибку до парсинга.
  - Размер XML-payload до парсинга ограничить cap'ом (например, 50 MB
    для FB2, 5 MB для OPDS feed).
  - Защита от billion laughs / quadratic blowup: лимит на entity-expansion
    (≤1000) и max depth XML-дерева (≤100).
- **Санитизация URL OPDS-каталогов**: parse → strip userinfo → store креды
  в SecureStore (`expo-secure-store`) c ключом `opds:{catalog_id}`, URL без
  креденшлов в БД (`OPDSCatalog.url`). Креды в логах и crash reports НЕ
  логировать.
- **HTTPS-only для OPDS**: по умолчанию принимать только `https://`. Если
  пользователь добавляет `http://` (self-hosted Calibre на LAN) — показывать
  предупреждение и требовать явного подтверждения (опт-ин per catalog).
- **Granular backup exclusion** (не all-or-nothing):
  - **Исключаем** из iCloud / Android Auto Backup: SQLite-файл WatermelonDB,
    `TranslationCache` директорию (если выделена отдельно), `expo-secure-store`
    данные (по дефолту уже в Keychain/Keystore — не бэкапится).
    iOS: `NSURLIsExcludedFromBackupKey=true` на db-file. Android:
    `<full-backup-content>` XML с `<exclude>` правилами для SQLite + кэша.
  - **Сохраняем** в backup: книги (`Documents/Books/`). Это user-data,
    при device migration пользователь не должен терять свою библиотеку.
- **TranslationCache privacy**:
  - Time-based purge (90 дней) + "Clear translation history" action в Settings.
  - "Clear all my data" reset: wipe `TranslationCache` +
    `WordOccurrence.context_sentence` + `ReadingStats`.
- **AsyncStorage**: хранит ТОЛЬКО non-credential preferences (см. allowlist
  выше). Любые секреты — в SecureStore, никогда в AsyncStorage.
- **SQLCipher НЕ используем в v1** — sandbox encryption + backup exclusion
  достаточно для нашего threat model.
- **Deep linking** (`scheme: 'fluera'`): валидировать пути роутов
  (allowlist). Отвергать `file://`, `javascript:`, произвольные `http(s)://`
  URL из внешних линков (только pre-defined routes app/).
- Запускать OWASP mobile security checker
  (`.claude/skills/owasp-mobile-security-checker/`) перед релизами.

### Производительность
- Читалка должна работать плавно — никаких подвисаний при скролле или
  подсветке слов (60fps на Pixel 7 / iPhone 13).
- Попап перевода: <500мс на cache hit, <3с на on-device LLM inference
  (Hy-MT1.5-1.8B на Pixel 7 / iPhone 13). Условия:
  - **Cache hit <500ms**: in-memory LRU поверх AsyncStorage/SQLite (читать
    из памяти первым, dehydrate в storage в фоне). AsyncStorage round-trip
    в hot-path — слишком медленно.
  - **LLM inference <3s per word**: per-word + small context window
    (~80 chars). Per-sentence/per-paragraph — отдельная UX (loading state).
  - **LLM warm-up**: первый инференс на холодной модели >3s. На старте
    приложения выполнять warm-up инференс с пустым/sentinel-запросом
    в фоне после `splash.hideAsync()`.
- Расчёт сложности книги в фоновом потоке (`InteractionManager.runAfterInteractions()`).
- Использовать `React.lazy` для некритичных экранов (Статистика, Настройки).
- Профилировать через React DevTools перед оптимизацией.
- Chapter content: re-parse on-demand + LRU 3 чаптера в памяти (НЕ JSON в БД).

### Observability и crash-reporting (политика)
- В v1 НЕ интегрируем Sentry / Bugsnag / Firebase Crashlytics. App полностью
  локальный, нет PII-уровня логов — облачная телеметрия избыточна.
- Локальная диагностика: `console.warn`/`console.error` для нештатных
  ситуаций. В production builds — silent fail с user-visible сообщением
  через t('errors.X').
- Если в v2 будет добавлен Sentry: ОБЯЗАТЕЛЬНО opt-in флаг в Settings +
  PII-scrubbing (никаких `WordOccurrence.context_sentence`, переводов,
  user-imported book content в breadcrumbs).
- Performance metrics локально через React DevTools/Flipper. Не отправлять
  на сервер.

## Команды

```bash
# Разработка
npm start                         # alias: expo start --dev-client
npm run ios                       # expo run:ios (требует Xcode локально)
npm run android                   # expo run:android (требует Android SDK)

# Перед первым запуском после клона:
# 1. npm install
# 2. cd ios && pod install (только macOS, для iOS-сборки)
# 3. npm run ios ИЛИ npm run android — создаст dev-client

# Тестирование
npm test                          # jest
npm run typecheck                 # tsc --noEmit
npm run lint                      # expo lint

# Сборка
# eas.json ЕЩЁ НЕ настроен — будет в v1 release prep
# npx eas build --platform ios
# npx eas build --platform android
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
