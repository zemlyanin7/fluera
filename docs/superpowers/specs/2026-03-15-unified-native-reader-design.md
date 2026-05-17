# Единый нативный ридер — дизайн-спецификация

## Проблема

1. **FB2 тормозит при открытии** — XML парсится каждый раз при открытии (500-2000ms)
2. **Два отдельных ридера** — `Fb2Reader.tsx` (639 строк, нативный) и `EpubReader.tsx` (238 строк, WebView). Каждая фича (темы, настройки, подсветка слов) реализуется дважды
3. **Word tap в WebView ненадёжный** — `caretRangeFromPoint` в EPUB bridge script работает нестабильно. Нативные Pressable в FB2 ридере точнее

## Решение

Единый нативный ридер на базе FlashList с конвертацией всех форматов в общий JSON при импорте.

### Принципы

- **Парсинг = один раз при импорте.** При открытии книги — только `JSON.parse()`
- **Нативный рендер.** Каждое слово — `<Text onPress>`, точный word tap
- **Прогрессивный импорт.** Первые ~5 глав быстро (async), остальные в фоне
- **Один компонент.** `UnifiedReader` заменяет и `Fb2Reader`, и `EpubReader`

---

## Общий формат данных

### InlineNode — текст с вложенным форматированием

```typescript
// src/services/parser/types.ts (новые типы)

/** Инлайновый текстовый элемент с поддержкой вложенного форматирования */
export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'italic'; children: InlineNode[] }
  | { type: 'link'; href: string; children: InlineNode[] }
  | { type: 'sup'; children: InlineNode[] }
  | { type: 'sub'; children: InlineNode[] }
  | { type: 'footnote-ref'; id: string; label: string }
```

**Почему children, а не плоский text:** В реальных книгах форматирование вложенное — `<em><strong>text</strong></em>`. Плоский text потерял бы вложенность. Текущий `Fb2Inline` уже имеет `children?: Fb2Inline[]` по этой причине.

**Рендер:** Рекурсивно обходим дерево InlineNode (макс. глубина: 20 — для защиты от патологического EPUB). На каждом leaf-узле (`type: 'text'`) — `tokenizeIntoWords()` → `<WordTappable>`. Родительские узлы задают стиль (fontWeight, fontStyle).

### ContentItem — единица рендеринга

```typescript
/** Блочный элемент контента */
export type ContentItem =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; inlines: InlineNode[] }
  | { type: 'paragraph'; inlines: InlineNode[]; style?: ParagraphStyle }
  | { type: 'image'; src: string; alt?: string; width?: number; height?: number }
  | { type: 'blockquote'; inlines: InlineNode[]; nestedItems?: ContentItem[] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] }
  | { type: 'separator' }
  | { type: 'table-row'; cells: InlineNode[][] }

export interface ParagraphStyle {
  textAlign?: 'left' | 'center' | 'right'
  indent?: boolean    // отступ первой строки
  italic?: boolean    // весь параграф курсивом (эпиграф, стихи)
}

/** Одна глава сконвертированной книги */
export interface BookChapter {
  index: number         // номер главы (начиная с 0)
  title: string | null  // название главы (из оглавления или первого заголовка)
  items: ContentItem[]  // элементы контента
}

/** Сноски на уровне книги (отдельный файл, не по главам) */
export interface BookFootnotes {
  [id: string]: InlineNode[]  // id сноски → содержимое
}
```

**Блочная цитата (blockquote):** Рендерится как один FlashList item. `inlines` для простых цитат (одна строка), `nestedItems` для сложных (несколько параграфов внутри `<blockquote>`). **Правило приоритета:** если `nestedItems` присутствует и не пуст, `inlines` игнорируется. Конвертеры должны заполнять только одно из двух полей. Вложенные items рендерятся рекурсивно внутри одного рендер-вызова.

**Таблица:** Вместо потери структуры, каждая строка таблицы — отдельный `table-row` ContentItem. Ячейки отображаются через `|` разделитель для визуальной связности.

**Сноски:** Хранятся в отдельном файле `books/{bookId}/footnotes.json` (на уровне книги, не по главам), поскольку в FB2 все сноски находятся в отдельном `<body name="notes">`, а ссылки на них могут быть в любой главе. При нажатии на `footnote-ref` → поиск в `BookFootnotes[id]` → bottom sheet с содержимым.

### Маппинг форматов → ContentItem

| Источник (FB2) | Источник (EPUB HTML) | ContentItem |
|---|---|---|
| `<section><title>` | `<h1>-<h6>` | `heading` |
| `<p>` | `<p>` | `paragraph` |
| `<emphasis>` | `<em>`, `<i>` | `InlineNode { type: 'italic', children }` |
| `<strong>` | `<strong>`, `<b>` | `InlineNode { type: 'bold', children }` |
| `<a>` | `<a>` | `InlineNode { type: 'link', children }` |
| `<a type="note">` | — | `InlineNode { type: 'footnote-ref' }` |
| `<image>` | `<img>` | `image` (src = путь к извлечённому файлу) |
| `<empty-line>` | `<hr>`, `<br><br>` | `separator` |
| `<epigraph>`, `<poem>`, `<v>` | — | `paragraph` с `style.italic: true` |
| `<subtitle>` | — | `heading` уровня 3 |
| `<cite>` | `<blockquote>` | `blockquote` |
| — | `<ol>`, `<ul>` | `list` |
| — | `<sup>` | `InlineNode { type: 'sup' }` |
| — | `<sub>` | `InlineNode { type: 'sub' }` |
| — | `<table>` | `table-row` (по одному на `<tr>`) |
| — | `<div>`, `<span>` | Прозрачные контейнеры, содержимое извлекается |
| `<body name="notes">` | — | `footnotes.json` (на уровне книги) |

---

## Хранение на диске

```
${documentDirectory}/books/{bookId}/
  ├── chapters/
  │   ├── 0.json          # BookChapter в формате JSON
  │   ├── 1.json
  │   └── ...
  ├── images/
  │   ├── cover.jpg
  │   ├── img_001.png
  │   └── ...
  ├── footnotes.json            # сноски (на уровне книги)
  └── source.fb2 / source.epub  # оригинальный файл
```

- Каждая глава — отдельный JSON-файл (~50-200 КБ для типичной главы)
- Картинки извлекаются при импорте, хранятся как файлы
- Наличие файла `chapters/{n}.json` = глава сконвертирована (не нужен отдельный meta.json для отслеживания прогресса)
- Оригинальный файл книги сохраняется для возможной переконвертации

### Версионирование формата

В `Book` модели WatermelonDB добавляется поле `contentVersion: number`. При обновлении формата `ContentItem` — инкрементируем целевую версию, и при первом открытии книга автоматически переконвертируется.

### Определение общего числа глав и прогресса конвертации

Общее число глав сохраняется в `Book` модели: `totalChapters: number`. Число сконвертированных глав определяется по наличию файлов `chapters/{n}.json` (проверка через `FileSystem.getInfoAsync`). Это устраняет race condition при конкурентном доступе — каждый файл записывается атомарно.

### Удаление книг

При удалении книги из библиотеки: `FileSystem.deleteAsync(books/{bookId}/, { idempotent: true })` — рекурсивно удаляет директорию со всем содержимым (главы, картинки, исходный файл).

---

## Конвертеры

### FB2 → BookChapter[]

**Файл:** `src/services/converter/fb2Converter.ts`

Использует существующий `Fb2Parser.parse(xml)` (НЕ `parseSectionsOnly` — нужен доступ к `<binary>` элементам для извлечения изображений). Затем маппит `Fb2Book` → `BookChapter[]`:

```
Fb2Section.title       → heading { level: 2, inlines: [...] }
Fb2Paragraph.type='p'  → paragraph { inlines: mapInlines(children) }
Fb2Inline.type='text'  → InlineNode { type: 'text', text }
Fb2Inline.type='emphasis' → InlineNode { type: 'italic', children: mapInlines(inline.children) }
Fb2Inline.type='strong'   → InlineNode { type: 'bold', children: mapInlines(inline.children) }
Fb2Inline.type='link' + type="note" → InlineNode { type: 'footnote-ref', id, label }
Fb2Inline.type='image' → ContentItem { type: 'image', src: 'images/{imageId}.{ext}' }
```

**Обработка `<binary>` элементов:** `Fb2Parser.parse()` через `metaParser` даёт доступ к бинарным данным. Конвертер извлекает base64, записывает в `books/{bookId}/images/{id}.{ext}`.

**Обработка сносок:** Если в FB2 есть `<body name="notes">`, его секции парсятся и складываются в `books/{bookId}/footnotes.json` (на уровне книги). Текущий `Fb2Parser.parseBodyOrdered()` использует `.find()` и находит только первый `<body>`. FB2 конвертер должен использовать `bodyParser` (ordered) с `.filter()` вместо `.find()` для извлечения всех `<body>` элементов, различая основной body (без атрибута `name`) и notes body (`name="notes"`) по атрибуту `:@.@_name`.

**Разделение на главы:** Каждая `Fb2Section` с `title` → отдельная глава. Секции без title группируются с предыдущей.

### EPUB → BookChapter[]

**Файл:** `src/services/converter/epubConverter.ts`

#### Пайплайн

1. Распаковать EPUB (JSZip — уже используется)
2. Прочитать `META-INF/container.xml` → найти OPF
3. Прочитать OPF → получить spine (порядок глав) + manifest (ресурсы)
4. **Прочитать оглавление**: `toc.ncx` (EPUB 2) или `nav.xhtml` (EPUB 3) → маппинг spine-item → title для `BookChapter.title`
5. Для каждой главы из spine:
   a. Прочитать XHTML контент
   b. **Санитизация XHTML** (см. ниже)
   c. Парсить через `fast-xml-parser` (preserveOrder: true)
   d. Рекурсивно обойти DOM-дерево, конвертируя HTML-элементы в `ContentItem[]`
   e. Извлечь referenced изображения из ZIP → сохранить как файлы
6. Сохранить каждую главу как отдельный JSON

#### Санитизация XHTML (шаг 5b)

EPUB XHTML не всегда валидный XML. Перед парсингом через `fast-xml-parser` нужна предобработка:

```typescript
import { HTML_ENTITIES } from './htmlEntities' // Map<string, string> ~250 именованных HTML-сущностей

function sanitizeXhtml(xhtml: string): string {
  return xhtml
    // Удалить DOCTYPE (XML-парсер не понимает HTML DTD)
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    // Заменить ВСЕ именованные HTML-сущности на числовые XML-совместимые
    // Универсальная замена: конвертирует &nbsp; → &#160;, &hellip; → &#8230;, &rsquo; → &#8217; и т.д.
    .replace(/&([a-zA-Z]+);/g, (match, name) => {
      const codepoint = HTML_ENTITIES[name]
      return codepoint ? `&#${codepoint};` : match // неизвестные оставляем как есть
    })
    // Закрыть void-теги (<br>, <img>, <hr>)
    // Ленивое совпадение для атрибутов, чтобы \s*\/? захватил завершающий слеш если есть
    .replace(/<(br|hr|img|meta|link)(\s[^>]*?)?\s*\/?>/gi, '<$1$2/>')
    // Удалить <script> и <style> блоки
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
}
```

`htmlEntities.ts` — статический маппинг ~250 стандартных именованных HTML-сущностей → Unicode-кодпоинты. Генерируется из спецификации HTML.

#### Откат при ошибке парсинга

Если парсинг конкретной главы падает (невалидный XML даже после санитизации):
1. Логируем ошибку: `console.warn('[EpubConverter] Ошибка парсинга главы N:', err)`
2. Создаём fallback-главу с одним параграфом: `"[Глава не может быть отображена]"`
3. Конвертация остальных глав продолжается

#### Парсинг HTML → ContentItem

```typescript
function htmlToContentItems(nodes: OrderedNode[]): ContentItem[] {
  const items: ContentItem[] = []
  for (const node of nodes) {
    if ('p' in node)          → paragraph { inlines: parseInlines(node.p) }
    if ('h1' in node)         → heading { level: 1, inlines: parseInlines(node.h1) }
    if ('h2' in node)         → heading { level: 2, ... }
    if ('h3'-'h6' in node)    → heading { level: N, ... }
    if ('img' in node)        → image { src, width, height из атрибутов }
    if ('blockquote' in node) → blockquote { nestedItems: htmlToContentItems(node.blockquote) }
    if ('ol' in node)         → list { ordered: true, items: parseListItems(node.ol) }
    if ('ul' in node)         → list { ordered: false, items: parseListItems(node.ul) }
    if ('hr' in node)         → separator
    if ('table' in node)      → ...каждый <tr> → table-row { cells: [...] }
    if ('div' in node)        → htmlToContentItems(node.div) // прозрачный контейнер
    if ('section' in node)    → htmlToContentItems(node.section)
  }
  return items
}
```

#### Инлайновый парсинг (с вложенностью)

```typescript
function parseInlines(nodes: OrderedNode[]): InlineNode[] {
  const inlines: InlineNode[] = []
  for (const node of nodes) {
    if ('#text' in node)    → { type: 'text', text: node['#text'] }
    if ('em'/'i' in node)   → { type: 'italic', children: parseInlines(node.em) }
    if ('strong'/'b' in node) → { type: 'bold', children: parseInlines(node.strong) }
    if ('a' in node)        → { type: 'link', href: attrs.href, children: parseInlines(node.a) }
    if ('sup' in node)      → { type: 'sup', children: parseInlines(node.sup) }
    if ('sub' in node)      → { type: 'sub', children: parseInlines(node.sub) }
    if ('span' in node)     → ...parseInlines(node.span) // прозрачный, раскрываем дочерние
    if ('br' in node)       → { type: 'text', text: '\n' }
  }
  return inlines
}
```

---

## Прогрессивный импорт

### При импорте книги (BookImporter.importFile)

1. Сохраняем оригинальный файл в `books/{bookId}/source.{ext}`
2. Определяем формат → выбираем конвертер
3. Для EPUB: распаковываем ZIP, парсим OPF/оглавление → определяем spine и общее число глав
4. **Асинхронно** конвертируем первые 5 глав (через `async/await`, не синхронно — чтобы не блокировать UI)
5. Создаём запись Book в WatermelonDB с `totalChapters`, `contentVersion`
6. Книга появляется в библиотеке с обложкой и заголовком
7. Запускаем фоновую конвертацию оставшихся глав через `InteractionManager.runAfterInteractions`

### Пользовательский интерфейс при импорте

- Пользователь видит книгу в библиотеке **сразу** (обложка + заголовок извлекаются первыми)
- При нажатии «Открыть» до готовности первых глав → лоадер «Подготовка книги...»
- Типичное время конвертации первых 5 глав: ~200-500мс (генерация JSON быстрая после парсинга)

### При открытии книги

1. Проверяем наличие `chapters/0.json` — если нет, запускаем миграцию (см. ниже)
2. Загружаем текущую главу из JSON
3. Если пользователь долистал до ещё не сконвертированной главы:
   a. Показываем короткий лоадер
   b. Конвертируем эту главу на лету
   c. Сохраняем JSON
4. Фоновая конвертация продолжается автоматически

### Для маленьких книг (< 10 глав)

Конвертируем всё сразу при импорте. Прогрессивный режим не нужен.

---

## UnifiedReader — компонент ридера

**Файл:** `src/components/reader/UnifiedReader.tsx`

### Свойства (Props)

```typescript
interface UnifiedReaderProps {
  book: Book
  bookLanguage: string
  nativeLanguage: string
}
```

Больше не принимает `xml` или `fileUri` — загружает данные из JSON-файлов напрямую.

### Внутренняя логика

Основан на текущем `Fb2Reader.tsx`, но:

1. **Загрузка по главам** (через хук `useChapterLoader`):
   - Загружает текущую и ±1 соседних глав
   - При прокрутке — подгружает следующую/предыдущую главу
   - Массив `items` наполняется инкрементально
   - Если глава не сконвертирована — конвертирует на лету с лоадером

2. **Позиция** сохраняется как `{ chapter: number, charOffset: number }`:
   - `chapter` — номер главы (начиная с 0)
   - `charOffset` — смещение в символах от начала главы
   - `charOffset` стабилен при переконвертации (текст не меняется, меняется только разбиение на ContentItem)
   - Для восстановления позиции: находим ContentItem, содержащий charOffset, по суммарной длине текста

3. **Рендеринг** через расширенный `UnifiedItemRenderer` (см. ниже)

4. **Всё остальное** — идентично текущему Fb2Reader:
   - `FlashList` для режима прокрутки
   - `FlatList` горизонтальный для постраничного режима
   - Замер страниц через off-screen `MeasureContainer`
   - `TranslationPopup`, `ReaderTopBar`, `ReaderSettingsSheet` — без изменений
   - `useWordStatusBatch` — без изменений
   - Отложенное сохранение позиции (debounced) — с обновлённым форматом позиции

### Упрощение [bookId].tsx

```typescript
// Было: два разных ридера + загрузка файла для FB2
if (book.format === 'epub') return <EpubReader fileUri={...} ... />
if (book.format === 'fb2') return <Fb2Reader xml={content} ... />

// Стало: один ридер, без загрузки файла
return <UnifiedReader book={book} ... />
```

### Хук useChapterLoader

**Файл:** `src/hooks/useChapterLoader.ts`

```typescript
interface ChapterRange {
  chapter: number
  startIndex: number    // индекс в объединённом массиве items
  endIndex: number      // не включительно
  charOffset: number    // общее число символов до этой главы
}

interface UseChapterLoaderResult {
  items: ContentItem[]           // объединённые items из загруженных глав
  chapterRanges: ChapterRange[]  // границы глав в массиве items
  loading: boolean               // true пока загружается начальная глава
  footnotes: Record<string, InlineNode[]>  // сноски на уровне книги
  currentChapter: number
  totalChapters: number
  loadChapter: (index: number) => Promise<void>
}

function useChapterLoader(bookId: string, initialChapter: number): UseChapterLoaderResult
```

Внутри:
- Кэширует загруженные главы в `Map<number, BookChapter>`
- `chapterRanges` — маппинг индексов `items[]` → номер главы (для сохранения позиции, поиска сносок, отображения прогресса)
- При `onViewableItemsChanged` — проверяем `chapterRanges`: если видимые items в последних 20% загруженного диапазона → предзагрузка следующей главы
- Мержит `items` из загруженных глав в один массив для FlashList
- Загружает `footnotes.json` один раз при инициализации

---

## UnifiedItemRenderer — рендер элементов

**Файл:** `src/components/reader/UnifiedRenderer.tsx`

Расширение текущего `Fb2Renderer.tsx` с поддержкой новых типов `ContentItem`.

### Маппинг ContentItem → нативный компонент

| ContentItem | Компонент | Стиль |
|---|---|---|
| `heading` уровня 1 | `<Text>` | fontSize + 8, жирный, paddingVertical $4 |
| `heading` уровня 2 | `<Text>` | fontSize + 4, жирный, paddingVertical $3 |
| `heading` уровня 3 | `<Text>` | fontSize + 2, fontWeight 600, paddingVertical $2 |
| `heading` уровней 4-6 | `<Text>` | fontSize, жирный, paddingVertical $1 |
| `paragraph` | `<XStack flexWrap>` | InlineRenderer → `<WordTappable>` |
| `paragraph` курсив | `<XStack flexWrap>` | fontStyle: italic |
| `paragraph` отступ | `<XStack flexWrap>` | Невидимый спейсер `<View width={fontSize*2}>` перед первым словом |
| `paragraph` по центру | `<XStack flexWrap justifyContent center>` | |
| `image` | `<Image>` | width: 100%, aspectRatio: width/height или fallback 4:3, resizeMode contain |
| `blockquote` | `<YStack>` | borderLeftWidth 3, borderLeftColor, paddingLeft $4. Вложенные items рендерятся рекурсивно |
| `list` нумерованный | `<YStack>` | Каждый пункт: "1. " + InlineRenderer → WordTappable |
| `list` маркированный | `<YStack>` | Каждый пункт: "• " + InlineRenderer → WordTappable |
| `table-row` | `<XStack>` | Ячейки разделены `" | "`, каждая ячейка → InlineRenderer |
| `separator` | `<YStack>` | height $2 (пустой отступ) |

### InlineNode → рекурсивный рендер слов

```typescript
function renderInlines(nodes: InlineNode[], context: InlineContext): React.ReactNode[] {
  return nodes.flatMap(node => {
    if (node.type === 'text') {
      // Leaf-узел → токенизация → WordTappable
      return tokenizeIntoWords(node.text).map(token => (
        <Text fontStyle={context.italic} fontWeight={context.bold}>
          <WordTappable word={token.word} ... />
        </Text>
      ))
    }
    if (node.type === 'bold') {
      return renderInlines(node.children, { ...context, bold: 'bold' })
    }
    if (node.type === 'italic') {
      return renderInlines(node.children, { ...context, italic: 'italic' })
    }
    if (node.type === 'footnote-ref') {
      return <Text onPress={() => showFootnote(node.id)} style={styles.footnoteRef}>
        {node.label}
      </Text>
    }
    // ... link, sup, sub аналогично
  })
}
```

Контекст `InlineContext` передаёт накопленные стили вниз по дереву:
```typescript
interface InlineContext {
  bold?: 'bold'
  italic?: 'italic'
  textColor: string
  fontSize: number
  fontFamily: string
}
```

### Отображение сносок

При нажатии на `footnote-ref` → показываем bottom sheet (`@gorhom/bottom-sheet` или простой `Modal`) с содержимым сноски из `footnotes[id]` (сноски загружаются через `useChapterLoader` из `books/{bookId}/footnotes.json`).

### WordTappable

Без изменений — текущий `WordTappable.tsx` остаётся как есть.

---

## Изменения в BookImporter

### Вспомогательные функции конвертации

**Файл:** `src/services/converter/chapterStorage.ts`

```typescript
/** Конвертирует первые N глав книги, возвращает результат.
 *  Если maxChapters не указан — конвертирует все главы (для книг < 10 глав). */
function convertBook(
  format: BookFormat, sourcePath: string, bookId: string, maxChapters?: number
): Promise<{
  chapters: BookChapter[];
  totalChapters: number;
  title: string;
  author: string;
  coverBase64: string | null;
}>

/** Сохраняет массив глав на диск */
function saveChapters(bookId: string, chapters: BookChapter[]): Promise<void>

/** Конвертирует оставшиеся главы в фоне (безопасен для fire-and-forget) */
function convertRemainingChapters(
  bookId: string, format: BookFormat, sourcePath: string, startFrom: number, total: number
): Promise<void>
```

`convertBook` вызывает соответствующий конвертер (fb2Converter/epubConverter) и также извлекает метаданные (заголовок, автора, обложку). Весь блок извлечения метаданных из текущего `importFile` (строки 55-75) заменяется на `convertBook()`. `record.filePath` обновляется до нового пути `books/{bookId}/source.{ext}`.

### importFile()

Здесь `bookId` — это ID книги, сгенерированный в `importFile` (`Date.now().toString(36) + Math.random()...`), который затем становится `book.id` в WatermelonDB (передаётся через `record._raw.id = bookId`). Для миграции старых книг — `bookId` = `book.id` из WatermelonDB.

```diff
  // Создание директории книги
+ await FileSystem.makeDirectoryAsync(`${BOOKS_DIR}${bookId}/chapters/`, { intermediates: true })
+ await FileSystem.makeDirectoryAsync(`${BOOKS_DIR}${bookId}/images/`, { intermediates: true })
  // Сохранение оригинального файла
  const destPath = `${BOOKS_DIR}${bookId}/source${ext}`
+
+ // Конвертация во внутренний формат (асинхронно, первые 5 глав)
+ const { chapters, totalChapters, coverBase64 } = await convertBook(format, destPath, bookId)
+ await saveChapters(bookId, chapters)
+
  // Создание записи Book
  const book = await database.write(async () => {
    return booksCollection.create((record) => {
      ...
      record.format = format
+     record.totalChapters = totalChapters
+     record.contentVersion = CURRENT_CONTENT_VERSION
    })
  })
+
+ // Фоновая конвертация оставшихся глав
+ if (chapters.length < totalChapters) {
+   InteractionManager.runAfterInteractions(() =>
+     convertRemainingChapters(bookId, format, destPath, chapters.length, totalChapters)
+   )
+ }
```

### Миграция существующих книг

При первом открытии книги без директории `chapters/` (определяется в `useChapterLoader`):
1. Проверяем `FileSystem.getInfoAsync(books/{bookId}/chapters/0.json)` → не существует
2. Показываем лоадер «Подготовка книги...»
3. Считываем оригинальный файл из `book.filePath` (старый формат: `books/abc123.fb2`)
4. Создаём директорию `books/{bookId}/`
5. **Не перемещаем** оригинальный файл — оставляем по старому пути (`book.filePath` не меняется). Конвертер читает из `book.filePath` напрямую.
6. Конвертируем первые 5 глав, показываем контент
7. Остальные главы — в фоне
8. Новые книги уже сохраняются в `books/{bookId}/source.{ext}`

Таким образом старые книги работают без миграции файловой структуры — конвертер просто читает из `book.filePath` и пишет главы в `books/{bookId}/chapters/`.

### Изменения в модели Book

Новые поля в WatermelonDB:
```typescript
@field('total_chapters') totalChapters!: number
@field('content_version') contentVersion!: number
```

Требуется миграция схемы БД (версия 2 → 3) в `src/db/migrations/`:
```typescript
{
  toVersion: 3,
  steps: [
    addColumns({
      table: 'books',
      columns: [
        { name: 'total_chapters', type: 'number' },
        { name: 'content_version', type: 'number' },
      ],
    }),
  ],
}
```

### Существующая таблица `chapters` в БД

В схеме БД (версия 2) уже есть таблица `chapters` с полями `book_id`, `title`, `order_index`, `progress`. Эта таблица **не используется** для хранения содержимого глав — содержимое хранится в JSON-файлах на файловой системе.

Таблица `chapters` в БД может использоваться для **метаданных навигации** (оглавление, прогресс по главам) в будущем. На данном этапе она не задействована в unified reader — оглавление берётся из `BookChapter.title` в JSON-файлах. Таблица сохраняется в схеме (удаление не нужно).

---

## Удаляемый код

После полной реализации и тестирования:

| Файл | Действие |
|---|---|
| `src/components/reader/EpubReader.tsx` | Удалить |
| `src/components/reader/Fb2Reader.tsx` | Заменить на `UnifiedReader.tsx` |
| `src/components/reader/Fb2Renderer.tsx` | Заменить на `UnifiedRenderer.tsx` |
| `src/services/reader/epubBridgeScript.ts` | Удалить |
| `src/services/reader/useFileSystemLegacy.ts` | Удалить |
| `src/services/parser/fb2Cache.ts` | Удалить (заменяется JSON-файлами глав) |
| `@epubjs-react-native` зависимость | Удалить из package.json |

### Сохраняемый код

| Файл | Статус |
|---|---|
| `src/components/reader/WordTappable.tsx` | Без изменений |
| `src/components/reader/TranslationPopup.tsx` | Без изменений |
| `src/components/reader/ReaderTopBar.tsx` | Без изменений |
| `src/components/reader/ReaderSettingsSheet.tsx` | Без изменений |
| `src/services/parser/Fb2Parser.ts` | Используется FB2 конвертером |
| `src/services/parser/types.ts` | Расширяется новыми типами |
| `src/hooks/useReaderTheme.ts` | Без изменений |
| `src/hooks/useWordStatusBatch.ts` | Без изменений |
| `src/stores/settingsStore.ts` | Без изменений |

---

## Формат позиции (Book.lastPosition)

```typescript
// Было (FB2):   '{"index": 42}'
// Было (EPUB):  'epubcfi(/6/14!/4/2/1:0)'

// Стало (единый):  '{"chapter": 3, "charOffset": 1250}'
```

- `charOffset` — смещение в символах от начала главы. Стабилен при переконвертации (текст главы не меняется, меняется только разбиение на ContentItem).
- Подсчёт символов: суммируется весь leaf-level текст (`type: 'text'`) внутри каждого ContentItem, включая `nestedItems` (blockquote) и `items` (list), рекурсивно. Один ContentItem = один FlashList item = один шаг в суммировании. Маркеры списков («1. », «• ») не входят в подсчёт — они добавляются при рендере и не являются InlineNode.
- Для восстановления позиции: суммируем длину текста ContentItem'ов пока не достигнем `charOffset` → этот item = `initialScrollIndex`.

Миграция: при первом открытии с новым ридером — сбрасываем позицию на начало. Пользователь потеряет закладку один раз.

---

## Обработка картинок

### FB2

Картинки хранятся как `<binary id="img1">` base64 внутри XML.

При конвертации:
1. `Fb2Parser.parse()` извлекает бинарные данные через `findCover()` и `metaParser`
2. Конвертер записывает base64 → файл в `books/{bookId}/images/{id}.{ext}`
3. В `ContentItem` на диске ставим `src: 'images/{id}.{ext}'` (относительный путь)
4. `useChapterLoader` при загрузке главы заменяет относительные `src` на абсолютные URI: `${documentDirectory}books/${bookId}/${src}`. Таким образом рендереру не нужен `bookId` — он получает готовые абсолютные пути

### EPUB

Картинки хранятся как файлы внутри EPUB ZIP.

При конвертации:
1. Находим referenced `<img src="...">` в HTML
2. Извлекаем файл из ZIP (`zip.files[resolvedPath].async('base64')`)
3. Записываем в `books/{bookId}/images/`
4. В `ContentItem` на диске ставим `src` с относительным путём (аналогично FB2, `useChapterLoader` заменяет на абсолютный при загрузке)
5. Для `<img width="..." height="...">` — сохраняем размеры в ContentItem для `aspectRatio`

---

## Ограничения

### Что НЕ поддерживается в нативном рендере

- **Кастомные шрифты из EPUB** — используются настройки приложения (Georgia, System и т.д.)
- **Сложные CSS-раскладки** (float, flexbox, grid, position) — игнорируются
- **SVG-графика** — не рендерится (можно добавить позже через `react-native-svg`)
- **CSS-анимации, трансформации** — игнорируются
- **Встроенное аудио/видео** — не поддерживается
- **JavaScript в EPUB** — игнорируется
- **MathML** — не поддерживается

### Что поддерживается

- Текст с вложенным форматированием (жирный, курсив, жирный в курсиве и т.д.)
- Заголовки 6 уровней
- Параграфы с выравниванием и отступами
- Изображения (с корректным соотношением сторон)
- Ссылки
- Списки (нумерованные + маркированные) с пословным нажатием
- Цитаты (blockquote) с визуальным маркером
- Верхний/нижний индексы (sup/sub)
- Разделители (hr, empty-line)
- Таблицы (строка за строкой с разделителями `|`)
- Сноски (footnotes) с bottom sheet
- Оглавление (из EPUB TOC / заголовков секций FB2)

---

## Файловая структура (новые/изменённые файлы)

```
src/
  services/
    converter/
      fb2Converter.ts       # FB2 → BookChapter[]
      epubConverter.ts       # EPUB → BookChapter[]
      chapterStorage.ts      # Сохранение/загрузка/удаление JSON-файлов глав
  services/
    parser/
      types.ts               # + ContentItem, InlineNode, BookChapter, ParagraphStyle
  components/
    reader/
      UnifiedReader.tsx      # Заменяет Fb2Reader + EpubReader
      UnifiedRenderer.tsx    # Заменяет Fb2Renderer
  hooks/
    useChapterLoader.ts      # Загрузка глав из JSON с подгрузкой соседних
```

---

## Порядок реализации

1. **Типы** — `ContentItem`, `InlineNode`, `BookChapter`, `ParagraphStyle` в `parser/types.ts`
2. **Хранилище глав** — `chapterStorage.ts`: save/load/delete/exists для JSON-файлов глав
3. **FB2-конвертер** — маппинг Fb2Book → BookChapter[], включая изображения и сноски. Необходимые изменения в `Fb2Parser`:
   - `parseInlinesOrdered()` сейчас сплющивает `emphasis`/`strong`/`link` в `{ type: 'emphasis', text: extractOrderedText(...) }` вместо рекурсивных `children`. Нужно обновить метод, чтобы он возвращал `children: Fb2Inline[]` (рекурсивно вызывая себя для вложенных узлов)
   - Для ссылок: `parseInlinesOrdered()` не читает атрибут `@_type` (FB2: `<a type="note">`). Нужно расширить `Fb2Inline` полем `linkType?: string` и обновить парсер, чтобы он считывал `attrs['@_type']`. Конвертер использует `linkType === 'note'` для маппинга в `footnote-ref`
   - Для извлечения всех `<body>` (основной + сноски): добавить новый публичный метод `parseAllBodies()` в `Fb2Parser`, который возвращает `{ mainBody: ..., notesBodies: ... }` через `bodyParser` с `.filter()`. Существующий `parseBodyOrdered()` не меняется (обратная совместимость для `parseSectionsOnly()`)
4. **UnifiedRenderer** — расширение Fb2Renderer для ContentItem с рекурсивным InlineRenderer
5. **useChapterLoader** — хук для загрузки глав из JSON с ленивой подгрузкой
6. **UnifiedReader** — рефакторинг Fb2Reader для работы с useChapterLoader
7. **EPUB-конвертер** — парсинг EPUB HTML → BookChapter[], включая санитизацию, оглавление, изображения
8. **BookImporter** — интеграция конвертеров + прогрессивный импорт + миграция схемы БД
9. **[bookId].tsx** — упрощение до одного UnifiedReader
10. **Миграция** — автоконвертация существующих книг при первом открытии
11. **Удаление** — EpubReader, Fb2Reader, bridge script, зависимость epubjs
12. **Тесты** — конвертеры, рендерер, хранилище глав
