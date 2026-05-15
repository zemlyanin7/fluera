# Единые темы и настройки ридера

**Дата:** 2026-03-14
**Статус:** Утверждена

## Проблема

EPUB и FB2 ридеры выглядят и ведут себя по-разному:
- EPUB открывается в тёмной теме с горизонтальной пагинацией; FB2 — в светлой теме с вертикальным скроллом
- FB2 игнорирует настройку `readerTheme` — использует системный Tamagui-контекст
- Содержимое FB2 перекрывает Dynamic Island (захардкоженный `paddingTop: 60`)
- У EPUB белая полоса внизу в тёмной теме (несоответствие фона контейнера)
- Всего 3 темы (light, dark, sepia); пользователи хотят больше разнообразия
- Нет автоматического переключения день/ночь, привязанного к системной теме

## Решение

Единая система тем с 8 темами ридера, автоматическим переключением день/ночь, согласованными режимами скролла/пагинации и панелью быстрых настроек.

---

## 1. Реестр тем ридера

**Файл:** `src/theme/readerThemes.ts`

Единый реестр из 8 тем. Каждая тема определяет все цвета, необходимые обоим ридерам, TopBar и TranslationPopup.

```typescript
type ThemeGroup = 'light' | 'dark';

interface ReaderThemeDefinition {
  id: string;
  nameKey: string;           // ключ i18n: 'settings.theme.white'
  group: ThemeGroup;
  colors: {
    background: string;      // фон контента ридера
    text: string;            // основной текст
    textSecondary: string;   // вторичный/приглушённый текст
    surface: string;         // карточки, попапы внутри ридера
    border: string;          // разделители
    topBarBg: string;        // фон TopBar
    popupBg: string;         // фон TranslationPopup
  };
  preview: string;           // hex для кружка в UI
}
```

### Определения тем

| ID | Название (ключ i18n) | Группа | background | text | Примечания |
|----|---------------------|--------|-----------|------|------------|
| `white` | settings.theme.white | light | #FFFFFF | #1A1A2E | Классическая белая |
| `sepia` | settings.theme.sepia | light | #FBF0D9 | #5F4B32 | В стиле Kindle, -25% нагрузка на глаза |
| `parchment` | settings.theme.parchment | light | #F5F1E8 | #3D3426 | Мягкая слоновая кость, как качественная бумага |
| `sage` | settings.theme.sage | light | #E8EDDF | #3D4A2E | Приглушённый зелёный, аналог Kindle Green |
| `dark` | settings.theme.dark | dark | #1A1A2E | #E0E0E0 | Стандартная тёмно-синяя |
| `amoled` | settings.theme.amoled | dark | #000000 | #CCCCCC | Чисто чёрная для OLED |
| `coffee` | settings.theme.coffee | dark | #2A2118 | #D4C4A8 | Тёплая тёмно-коричневая, ночная сепия |
| `graphite` | settings.theme.graphite | dark | #262626 | #D0D0D0 | Нейтральный серый, без цветового оттенка |

### Полная таблица цветов

Все hex-значения по темам:

| ID | background | text | textSecondary | surface | border | topBarBg | popupBg |
|----|-----------|------|---------------|---------|--------|----------|---------|
| `white` | #FFFFFF | #1A1A2E | #666666 | #F5F5F5 | #E0E0E0 | #FFFFFF | #FFFFFF |
| `sepia` | #FBF0D9 | #5F4B32 | #7A6952 | #F0E6CF | #D4C9B0 | #FBF0D9 | #F5EACD |
| `parchment` | #F5F1E8 | #3D3426 | #6B5D4E | #EDE8DD | #DDD5C5 | #F5F1E8 | #EFE9DE |
| `sage` | #E8EDDF | #3D4A2E | #5C6B4E | #DEE4D5 | #C8D0BE | #E8EDDF | #E2E8D8 |
| `dark` | #1A1A2E | #E0E0E0 | #AAAAAA | #252540 | #333355 | #1A1A2E | #252540 |
| `amoled` | #000000 | #CCCCCC | #888888 | #111111 | #222222 | #000000 | #111111 |
| `coffee` | #2A2118 | #D4C4A8 | #A08B6F | #362C22 | #4A3D30 | #2A2118 | #362C22 |
| `graphite` | #262626 | #D0D0D0 | #999999 | #333333 | #444444 | #262626 | #333333 |

`preview` для кружков в UI равен `background`.

### Экспортируемый API

```typescript
export const READER_THEMES: Record<string, ReaderThemeDefinition>;
export const LIGHT_THEMES: ReaderThemeDefinition[];  // отфильтрованные по группе
export const DARK_THEMES: ReaderThemeDefinition[];
export function getThemeById(id: string): ReaderThemeDefinition; // при невалидном ID возвращает 'white'
```

---

## 2. Изменения в Settings Store

**Файл:** `src/stores/settingsStore.ts`

### Новые/изменённые поля

```typescript
interface SettingsState {
  // Без изменений
  nativeLanguage: string;        // по умолчанию 'ru'
  bookLanguage: string;          // по умолчанию 'en'
  fontSize: number;              // по умолчанию 18, диапазон 14-28
  fontFamily: string;            // по умолчанию 'Georgia'
  lineHeight: number;            // по умолчанию 1.8
  showWordColors: boolean;       // по умолчанию true

  // ЗАМЕНЕНО: readerTheme → пара ID тем
  lightThemeId: string;          // по умолчанию 'white'
  darkThemeId: string;           // по умолчанию 'dark'
  autoTheme: boolean;            // по умолчанию true (следовать за системой)
  manualThemeId: string;         // по умолчанию 'white' — отслеживает последнюю вручную выбранную тему (используется когда autoTheme=false)

  // НОВОЕ
  scrollMode: 'paginated' | 'scroll';  // по умолчанию 'paginated'

  // Экшены (сеттеры)
  setLightThemeId: (id: string) => void;
  setDarkThemeId: (id: string) => void;
  setAutoTheme: (auto: boolean) => void;
  setManualThemeId: (id: string) => void;
  setScrollMode: (mode: 'paginated' | 'scroll') => void;
}
```

### Миграция

Функция `migrate` middleware `persist` в Zustand обрабатывает старый формат:
- `readerTheme: 'light'` → `lightThemeId: 'white'`, `darkThemeId: 'dark'`, `autoTheme: true`
- `readerTheme: 'dark'` → `lightThemeId: 'white'`, `darkThemeId: 'dark'`, `autoTheme: true`
- `readerTheme: 'sepia'` → `lightThemeId: 'sepia'`, `darkThemeId: 'dark'`, `autoTheme: false`, `manualThemeId: 'sepia'`

Старый тип `ReaderTheme` в `src/utils/types.ts` удаляется.

Версия увеличивается с 0 → 1.

---

## 3. Хук `useReaderTheme()`

**Файл:** `src/hooks/useReaderTheme.ts`

Единый источник истины для активной темы ридера.

```typescript
function useReaderTheme(): ReaderThemeDefinition
```

Логика:
1. Если `autoTheme === true`:
   - Читаем `useColorScheme()` (системная тема)
   - Системная `'dark'` → возвращаем `getThemeById(darkThemeId)`
   - Системная `'light'` → возвращаем `getThemeById(lightThemeId)`
2. Если `autoTheme === false`:
   - Возвращаем тему, которая была последней выбрана вручную
   - Отслеживается через `manualThemeId` в сторе (устанавливается при нажатии на кружок темы)

Оба ридера (EPUB и FB2) используют этот хук. TopBar и TranslationPopup тоже его потребляют.

---

## 4. Унификация ридеров

### EPUB Reader (`src/components/reader/EpubReader.tsx`)

**Тема:**
- Удалить захардкоженный объект `THEME_STYLES`
- `changeTheme()` использует цвета из `useReaderTheme()`:
  ```typescript
  const theme = useReaderTheme();
  changeTheme({ body: { background: theme.colors.background, color: theme.colors.text } });
  ```
- Переприменять тему при каждом изменении значения `useReaderTheme()`

**Исправление белой полосы:**
- Контейнерный `View` получает `backgroundColor: theme.colors.background` (сейчас прозрачный/белый)

**Режим скролла:**
- Передаём `flow={settings.scrollMode === 'scroll' ? 'scrolled' : 'paginated'}` в `Reader`
- EPUB уже поддерживает оба режима через проп `flow` epub.js
- Примечание: bridge script (определение нажатия на слово) нужно протестировать в режиме `scrolled` — обработка координат касания может отличаться от режима `paginated`

### FB2 Reader (`src/components/reader/Fb2Reader.tsx`)

**Тема:**
- Получать цвета из `useReaderTheme()` вместо Tamagui-контекста
- Контейнер `FlashList`/`FlatList`: `backgroundColor: theme.colors.background`
- Передавать пропсы `textColor` и `backgroundColor` в `Fb2Renderer` / `Fb2ItemRenderer` / `WordTappable` (в эти компоненты нужно добавить новые пропсы — сейчас они наследуют цвета из Tamagui-контекста)

**Исправление Dynamic Island:**
- Заменить захардкоженный `paddingTop: 60` на `paddingTop: insets.top + TOP_BAR_HEIGHT` через `useSafeAreaInsets()`
- Заменить `paddingBottom: 40` на `paddingBottom: insets.bottom`

**Режим скролла — постраничный (горизонтальный FlatList):**
- Когда `scrollMode === 'paginated'`:
  - Переключаемся с `FlashList` (вертикальный скролл) на горизонтальный `FlatList` с `pagingEnabled`
  - Предварительно рассчитываем разрывы страниц: рендерим параграфы, замеряем высоты через `onLayout` в скрытом замерочном проходе, группируем в страницы, пока суммарная высота ≤ `pageHeight`
  - `pageHeight = screenHeight - insets.top - TOP_BAR_HEIGHT - insets.bottom`
  - Каждая «страница» — это `View` точного размера `{width: screenWidth, height: pageHeight}`, содержащий свои параграфы
  - Свайп влево/вправо для перелистывания (соответствует поведению EPUB)
- Когда `scrollMode === 'scroll'`:
  - Текущее поведение `FlashList` (непрерывный вертикальный скролл)

**Алгоритм пагинации FB2:**
1. Начальный рендер: показываем спиннер загрузки во время замера
2. Замер высот параграфов: рендерим параграфы в скрытом замерочном контейнере (за пределами экрана, не `opacity: 0` — чтобы избежать затрат на layout в видимом дереве). Замеряем порциями по ~50 параграфов, чтобы не создавать давление на память при больших книгах.
3. После замера всех параграфов группируем их в страницы:
   ```
   currentPage = [], currentHeight = 0
   for each paragraph:
     if currentHeight + paragraph.height > pageHeight:
       pages.push(currentPage)
       currentPage = [paragraph], currentHeight = paragraph.height
     else:
       currentPage.push(paragraph)
       currentHeight += paragraph.height
   pages.push(currentPage) // последняя страница
   ```
4. Заменяем спиннер загрузки горизонтальным `FlatList` страниц
5. Перезамеряем при изменении размера шрифта, межстрочного интервала или размеров экрана (с debounce, показываем спиннер во время перезамера)

**Сохранение позиции в постраничном режиме:**
- Сохраняем позицию как `{ pageIndex: number, firstParagraphIndex: number }` — индекс страницы для отображения, индекс параграфа для совместимости между режимами
- При переключении скролл → постраничный: находим страницу, содержащую сохранённый индекс параграфа
- При переключении постраничный → скролл: скроллим к сохранённому индексу параграфа
- Обратная совместимость: старые позиции `{ index: number }` соответствуют индексу параграфа в обоих режимах

### TopBar (`src/components/reader/ReaderTopBar.tsx`)

- Заменить `backgroundColor="$background"` и `color="$color"` на цвета из `useReaderTheme()`
- Это гарантирует, что TopBar соответствует контенту ридера и в EPUB, и в FB2

### TranslationPopup (`src/components/reader/TranslationPopup.tsx`)

- Заменить `backgroundColor="$popupBg"` на `theme.colors.popupBg`
- Цвета текста из `theme.colors.text` / `theme.colors.textSecondary`

---

## 5. Панель быстрых настроек

**Файл:** `src/components/reader/ReaderSettingsSheet.tsx` (переписать)

Нижняя панель, вызываемая по ⚙️ в TopBar. Минимальный набор управления для настроек прямо в ридере.

### Макет

```
┌──────────────────────────────┐
│  Размер шрифта    [A-] 18 [A+]│
│                                │
│  Тема                          │
│  ○ ○ ○ ○ │ ● ○ ○ ○            │ ← 8 кружков, активный с ✓
│                                │
│  Авто день / ночь    [═══●]    │ ← Переключатель
│  Следовать за системой         │
│                                │
│  Ночная тема 🌙                │ ← только когда переключатель ВКЛ
│  ● ○ ○ ○                       │ ← только противоположная группа
└──────────────────────────────┘
```

### Поведение

1. **Размер шрифта:** кнопки `A-` / `A+`, шаг 1px, диапазон 14-28
2. **Кружки тем:** ряд из 8, все темы. Нажатие → мгновенное переключение темы. Активная с ✓ + акцентная рамка
3. **Авто-переключение:** Вкл/Выкл

Примечание: Межстрочный интервал, семейство шрифта и режим скролла намеренно исключены из быстрой панели — это редко меняемые настройки, доступные на вкладке «Настройки». Быстрая панель фокусируется на двух вещах, которые читатели меняют чаще всего: размер шрифта и тема.
   - ВЫКЛ: нет ряда парной темы, ручной режим
   - ВКЛ: показывать ряд парной темы
4. **Ряд парной темы:**
   - Если активная тема тёмная → надпись «Дневная тема ☀️», показать 4 светлых кружка
   - Если активная тема светлая → надпись «Ночная тема 🌙», показать 4 тёмных кружка
5. **Фон панели** адаптируется к цветам текущей темы ридера

### Подключение

- TopBar `onSettingsPress` → `setSettingsSheetVisible(true)`
- Оба ридера (EPUB и FB2) рендерят `<ReaderSettingsSheet>` когда видимый

---

## 6. Экран настроек (вкладка)

**Файл:** `app/(tabs)/settings.tsx` (переписать из заглушки)

Полный экран настроек с секцией «Чтение»:

1. **Дневная тема** — ряд из 4 кружков светлых тем
2. **Ночная тема** — ряд из 4 кружков тёмных тем
3. **Авто день / ночь** — переключатель с подписью «Следовать за системой»
4. **Режим листания** — сегментированный контрол: Постранично / Скролл
5. **Размер шрифта** — слайдер 14-28 с меткой текущего значения
6. **Шрифт** — кнопки: System / Serif / Sans-serif
7. **Межстрочный интервал** — слайдер 1.2-2.0

Все изменения сохраняются мгновенно через settingsStore. Активные ридеры реагируют в реальном времени.

---

## 7. Исправления багов (включены в реализацию)

| Баг | Корневая причина | Исправление |
|-----|-----------------|-------------|
| FB2 перекрывает Dynamic Island | Захардкоженный `paddingTop: 60` в contentContainerStyle FlashList | Использовать `useSafeAreaInsets().top + TOP_BAR_HEIGHT` |
| Белая полоса внизу EPUB | У контейнерного View нет явного backgroundColor | Установить `backgroundColor: theme.colors.background` на контейнер |
| FB2 игнорирует тему ридера | Использует Tamagui-контекст (системную тему), а не settingsStore | Использовать `useReaderTheme()` для всех цветов |
| EPUB/FB2 выглядят по-разному | Независимые реализации тем/скролла | Оба используют `useReaderTheme()` + `settings.scrollMode` |

---

## 8. Сводка изменений файлов

| Файл | Действие |
|------|----------|
| `src/theme/readerThemes.ts` | **НОВЫЙ** — 8 определений тем + реестр |
| `src/hooks/useReaderTheme.ts` | **НОВЫЙ** — хук активной темы |
| `src/stores/settingsStore.ts` | **ИЗМЕНИТЬ** — новые поля, миграция |
| `src/components/reader/EpubReader.tsx` | **ИЗМЕНИТЬ** — использовать `useReaderTheme()`, исправить белую полосу, добавить проп `flow` |
| `src/components/reader/Fb2Reader.tsx` | **ИЗМЕНИТЬ** — использовать `useReaderTheme()`, исправить SafeArea, добавить режим пагинации |
| `src/components/reader/ReaderTopBar.tsx` | **ИЗМЕНИТЬ** — цвета из `useReaderTheme()` |
| `src/components/reader/TranslationPopup.tsx` | **ИЗМЕНИТЬ** — цвета из `useReaderTheme()` |
| `src/components/reader/ReaderSettingsSheet.tsx` | **ПЕРЕПИСАТЬ** — быстрые настройки с кружками тем + авто-переключение |
| `app/(tabs)/settings.tsx` | **ПЕРЕПИСАТЬ** — полный экран настроек |
| `src/components/reader/Fb2Renderer.tsx` | **ИЗМЕНИТЬ** — добавить пропсы `textColor`/`backgroundColor` в `Fb2ItemRenderer` и `WordTappable` |
| `src/utils/types.ts` | **ИЗМЕНИТЬ** — удалить старый тип `ReaderTheme` |
| `src/i18n/locales/en.json` | **ИЗМЕНИТЬ** — ключи названий тем, метки настроек |
| `src/i18n/locales/ru.json` | **ИЗМЕНИТЬ** — ключи названий тем, метки настроек |
| `src/i18n/locales/pl.json` | **ИЗМЕНИТЬ** — ключи названий тем, метки настроек |
| `src/i18n/locales/uk.json` | **ИЗМЕНИТЬ** — ключи названий тем, метки настроек |

---

## 9. Вне скоупа

- Пользовательские темы (выбор цвета)
- Индивидуальная тема для каждой книги
- Переключение по расписанию (по времени, а не по системной теме)
- Адаптация по датчику освещённости
- Настройка жирности шрифта
- Настройка отступов/полей
