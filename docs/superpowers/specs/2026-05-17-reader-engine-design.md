# Sub-project #3 — Reader Engine: дизайн-спецификация

**Дата:** 2026-05-17
**Версия:** 1.0
**Статус:** Утверждена (готова к плану)
**Зависимости:** #1 Foundation, #2 Data layer (см. их спеки)
**Канонический design-doc:** `docs/superpowers/specs/2026-03-13-fluera-design.md` (частично устарел)
**Предыдущие итерации:** `2026-03-13-reader-phase1-design.md`, `2026-03-15-unified-native-reader-design.md` — **устарели** (эра Tamagui/WebView/cloud-LLM)

---

## 1. Цель и scope

Sub-project #3 поставляет **движок чтения** — компонент приложения, способный открыть локальный EPUB/FB2 файл, разобрать его в каноническое дерево `ContentItem[]` (определено в Foundation), и отрендерить нативными React Native примитивами с поддержкой tap-on-word. Перевод тапнутого слова — через `ITranslationService` (NoOp-стаб из #2 в данной фазе; реальная LLM-реализация — sub-project #4).

### 1.1 In scope

- **EPUB parser** (EPUB 2 + 3.x, pure-JS zip + XHTML парсинг)
- **FB2 parser** (FB2 1.x, pure-JS XML парсинг, FictionBook namespace, binary images)
- **ImportPipeline** — захват файла → формат → парсинг → запись в `books`/`chapters` (метаданные) + `books/{bookId}/images/` + position 0
- **Reader Engine** — экран чтения (`app/reader/[bookId].tsx` уже есть стаб)
- **Scroll-mode rendering** через `FlatList` с виртуализацией ContentItem[] одной главы
- **Word-tap** — nested `<Text onPress>` per word (MVP — accept Android background-glyph limitation)
- **Position persistence** — `reading_positions` (chapter_index + character_offset, сохраняется на scroll-end)
- **Chapter navigation** — кнопки prev/next по spine (TOC UI — позже)
- **Translation popup** — простой Sheet с loading-state, использует `ITranslationService` (NoOp → возвращает `status: 'pending'`)

### 1.2 Out of scope (отложено на следующие фазы)

- **Paginated mode** (page-flip с измерением break-points) — после scroll-mode стабилизируется
- **TOC drawer** (полноценный side-panel с навигацией по главам)
- **Bookmarks UI** (модель `bookmarks` уже в #2 — UI отдельно)
- **Word-status colouring** (FSRS-6 цвета `known/learning/new`) — требует #4 (для пополнения словаря) и #6 (для приоритезации)
- **Footnote popup** (`InlineNode.footnote-ref` → bottom sheet с содержимым) — modelled, рендер позже
- **Inline images interaction** (zoom, alt-text popup) — статичный рендер достаточен
- **Range-based word-tap** (parent `<Text>` onPress + coordinate math) — после MVP, фикс для Android
- **Per-chapter persisted JSON** на диске (старая спека `2026-03-15` предлагала кэшировать parsed chapters — отложено, см. §10.3)

### 1.3 Нефункциональные требования

- **Открытие книги:** < 1.5 секунды от tap по обложке до видимого первого параграфа на iPhone 13 / Pixel 7 (тест-файл: «The Alchemist» EPUB ~600KB).
- **Скролл:** 60fps на Pixel 7 / iPhone 13. JS-thread frame не превышает 16ms при normal scroll, drop до 8ms tolerable во время инициальной windowing.
- **Парсинг крупной книги:** «Лорд с планеты Земля» (~2.5MB FB2) парсится < 5 секунд на iPhone 13 при импорте. UI **не блокируется** — парсинг в `InteractionManager.runAfterInteractions()` + chunked progress callback.
- **Память:** одна книга в reader-сессии — ≤ 100MB heap (включая ContentItem-tree, LRU-кэш чаптеров, parsed binary images). Memory pressure → drop LRU.
- **Не использовать WebView.** Все рендеры — нативные RN компоненты.

---

## 2. Архитектурные принципы

### 2.1 Слои

```
┌────────────────────────────────────────────────────────────────┐
│ UI layer:  app/reader/[bookId].tsx                             │
│            components/reader/ReaderScreen, ChapterRenderer,    │
│                              ContentItemRenderer,              │
│                              TranslationPopup, ReaderControls  │
├────────────────────────────────────────────────────────────────┤
│ Services:  ReaderEngine — управление life-cycle reader-сессии  │
│            ParserRegistry — диспетчер по book.format           │
│            EpubParser / Fb2Parser — формат-специфика           │
│            ImportPipeline — file → Book record + assets        │
├────────────────────────────────────────────────────────────────┤
│ Data layer (из #2):                                            │
│   BookRepository, ChapterRepository, ReadingPositionRepository │
│   useBookProgress, useReadingPosition hooks                    │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Single source of truth для ContentItem

`src/types/content.ts` (определён в Foundation) — **канонические** типы `ContentItem`, `InlineNode`, `BookChapter`, `BookFootnotes`. Никакие parser-внутренние типы не утекают наружу. Каждый парсер выдаёт **только** эти типы.

### 2.3 Парсеры — без external dependencies на ContentItem-уровне

EpubParser и Fb2Parser:
- **Input:** raw bytes (для FB2 — XML string после декодирования; для EPUB — `Uint8Array` ZIP-архива).
- **Output:** `ParsedBook` (см. §4.1).
- Не пишут на диск напрямую — это делает `ImportPipeline`.
- Не зависят от WatermelonDB / React Native modules (тестируются в Node).
- Pure functions относительно input — двойной вызов даёт идентичный результат.

### 2.4 ImportPipeline — единая точка побочных эффектов

ImportPipeline:
1. Принимает `file: { uri: string; name: string; size: number }` от `expo-document-picker`.
2. Определяет формат через MIME / magic bytes / расширение (см. §6.2).
3. Читает файл в память (с лимитом, см. §11.1).
4. Делегирует парсеру → `ParsedBook`.
5. Атомарно: создаёт запись `Book`, записывает изображения в `FileSystem.documentDirectory/books/{bookId}/images/`, создаёт N записей `Chapter` (метаданные), пишет `reading_position` = `{chapter_index: 0, character_offset: 0}`.
6. При ошибке на любом шаге — rollback (удалить созданные файлы + запись Book).

Парсер вызывается **внутри** `db.write()` транзакции (метаданные), но запись файлов происходит **до** транзакции БД (идемпотентность: если транзакция упадёт, файлы можно удалить отдельно, а запись Book — нет).

### 2.5 Reader engine — отдельный сервис от UI

`ReaderEngine` — TypeScript-класс (state machine), хранит:
- `book: BookRecord` (из `BookRepository.findById`)
- `currentChapter: BookChapter | null` (parsed на-demand)
- `chapterCache: LRU<number, BookChapter>` (max 3, см. §10.2)
- `sourceBytes: Uint8Array | string | null` (raw file content, держится в памяти на время сессии)

UI-компонент (`ReaderScreen`) подписывается на изменения через React state (или Zustand-store). Engine изолирован от render-кода — тестируется отдельно. На MVP — допустимо реализовать engine через `useReducer` + custom hook вместо отдельного класса (см. §7.3).

### 2.6 Re-parse on open

Каноническое решение (см. CLAUDE.md «Chapter content: re-parse on-demand + LRU 3»): при открытии книги парсер пробегает весь файл повторно, ничего не кэшируется на диске между сессиями (за исключением извлечённых изображений). Это упрощает миграции `ContentItem` (изменение типов не ломает старые книги) и снимает вопрос про дисковое потребление JSON-чанков.

**Trade-off:** холодное открытие книги — это полный парсинг. Для крупных FB2 (~5MB) это ~3-4 секунды на iPhone 13. Если в v2 проявится UX-боль — можно добавить on-disk кэш как оптимизацию, не меняя ContentItem-контракт. См. §10.3.

---

## 3. Зависимости

### 3.1 Внешние библиотеки (новые)

| Пакет | Версия | Назначение | Why |
|---|---|---|---|
| `@xmldom/xmldom` | `^0.9` | XML DOM parser для FB2 + EPUB XHTML | Pure JS, namespace-aware, ~50KB, работает в Hermes. Не использовать `fast-xml-parser` (CLAUDE.md). |
| `fflate` | `^0.8` | ZIP-распаковка EPUB | Pure JS, sync API, ~17KB, самая быстрая среди pure-JS. |
| `expo-document-picker` | `~15.x` | Выбор файла из системного пикера | Стандарт Expo SDK 54. |

**НЕ устанавливаем:**
- `@epubjs-react-native` — WebView-based, запрещён CLAUDE.md.
- `react-native-zip-archive` — native module, добавляет complexity к New Arch. fflate достаточно для размера файлов в нашем сценарии.
- `@shopify/flash-list` — выгоднее performance, но FlatList достаточен для scroll-mode MVP. Перейдём при наличии измеренных проблем.

### 3.2 Зависимости из #2 Data layer

| Объект | Использование |
|---|---|
| `BookRepository.create` | ImportPipeline создаёт запись после парсинга |
| `BookRepository.updateProgress` | Reader engine при смене главы |
| `BookRepository.findById` | ReaderScreen при mount |
| `ChapterRepository.bulkCreate` | ImportPipeline записывает метаданные глав |
| `ReadingPositionRepository.upsert` | Reader engine при scroll-end (throttled) |
| `ReadingPositionRepository.findByBookId` | ReaderScreen при mount (восстановление) |
| `useBookProgress`, `useReadingPosition` | Library + Reader UI |
| `ITranslationService` (NoOp) | Word-tap popup |

### 3.3 Зависимости из #1 Foundation

| Объект | Использование |
|---|---|
| `ContentItem`, `InlineNode`, `BookChapter`, `BookFootnotes` | Канонические типы |
| `MAX_INLINE_DEPTH` (=20) | Защита от patalogical EPUB nesting |
| `PhoneShell`, `Sheet`, `IconBtn`, `Headline` | UI-компоненты |
| `splitWords` (`src/utils/splitWords.ts`) | Tokenization для word-tap |
| `scriptForLang`, `scriptTypography` | Font-family + lineHeight по book.language |
| `BORGES_SAMPLE` | Fixture для smoke-теста |

---

## 4. Канонические типы (расширения Foundation)

### 4.1 ParsedBook — output парсеров

```typescript
// src/services/parser/types.ts (новый файл)

import type { BookChapter, BookFootnotes } from '@/types/content';
import type { BookLanguage } from '@/types/settings';

export interface ParsedImage {
  /** ID, на который ссылаются ContentItem.image.src */
  id: string;
  /** Декодированные байты — пишется в FileSystem пайплайном */
  bytes: Uint8Array;
  /** MIME — определяется по magic bytes (image/jpeg, image/png, ...) */
  mime: string;
}

export interface ParsedBook {
  /** Метаданные */
  title: string;
  author: string | null;
  /**
   * Язык книги. Определяется парсером из метаданных файла:
   * - EPUB: `<dc:language>` в OPF
   * - FB2: `<lang>` в `<title-info>`
   * Если не указано или unknown → fallback на `null` (Library UI попросит юзера).
   */
  language: BookLanguage | null;
  /**
   * Cover image — id одного из `images`. Если null — обложки нет.
   * Парсеры заполняют, исходя из metadata (EPUB OPF `<meta name="cover">`, FB2 `<coverpage>`).
   */
  coverId: string | null;
  /** Главы книги */
  chapters: BookChapter[];
  /** Footnotes (FB2 — обязательно из <body name="notes">; EPUB — пусто в v1) */
  footnotes: BookFootnotes;
  /** Изображения, упомянутые в `ContentItem.image.src` */
  images: ParsedImage[];
  /** Сумма символов всех `paragraph.inlines` для прогресс-метрики */
  totalChars: number;
}
```

### 4.2 ImportResult

```typescript
// src/services/import/types.ts

export interface ImportResult {
  bookId: string;
  /** Куда был сохранён файл (для дебага и эксклюзии из backup) */
  filePath: string;
  /** Полное число глав (для прогресс-индикатора в Library) */
  chapterCount: number;
  /** Если язык не определился — Library UI спросит пользователя */
  languageDetected: BookLanguage | null;
}
```

### 4.3 ReaderEngine state shape

```typescript
// src/services/reader/types.ts

export interface ReaderState {
  /** Текущая открытая книга (null до bootstrap) */
  book: BookRecord | null;
  /** Список глав (только метаданные — title + index) */
  chapterMeta: Array<{ index: number; title: string | null }>;
  /** Текущий индекс главы */
  currentChapterIndex: number;
  /** Распарсенная текущая глава (lazy-loaded) */
  currentChapter: BookChapter | null;
  /** Восстановленный character_offset для скролла к позиции */
  initialOffset: number;
  /** Loading state */
  status: 'idle' | 'loading' | 'parsing' | 'ready' | 'error';
  error: string | null;
}
```

### 4.4 Translation popup state

```typescript
// src/components/reader/translationPopupState.ts

export type TranslationPopupState =
  | { kind: 'closed' }
  | { kind: 'opening'; word: string; sentence: string }
  | { kind: 'pending'; word: string; sentence: string }
  | { kind: 'success'; word: string; translation: string; partOfSpeech?: string }
  | { kind: 'error'; word: string; reason: string };
```

---

## 5. EPUB parser

### 5.1 Структура EPUB

EPUB — это ZIP-архив с фиксированной структурой:

```
mimetype                          ← обязательный первый файл, "application/epub+zip"
META-INF/container.xml            ← указывает path до OPF
META-INF/encryption.xml           ← (опционально) — DRM, **отвергаем** если есть
OEBPS/                            ← или другой root (определяется container.xml)
  content.opf                     ← OPF: metadata, manifest, spine
  toc.ncx или nav.xhtml          ← TOC (EPUB 2 / 3)
  chapter01.xhtml                 ← XHTML главы
  chapter02.xhtml
  ...
  images/cover.jpg
  styles/main.css                 ← мы CSS игнорируем
```

### 5.2 Алгоритм парсинга

```typescript
// src/services/parser/EpubParser.ts

class EpubParser {
  async parse(bytes: Uint8Array): Promise<ParsedBook> {
    // 1. Распаковать архив через fflate.unzipSync (или async)
    //    Лимит: распакованный размер ≤ 100MB (см. §11.2 zip bomb).
    const archive = unzipSync(bytes);

    // 2. Проверить mimetype: первый файл должен быть exactly "application/epub+zip"
    assertEpubMimetype(archive);

    // 3. Отвергнуть зашифрованный EPUB (META-INF/encryption.xml присутствует)
    if (archive['META-INF/encryption.xml']) {
      throw new ParserError('EPUB_ENCRYPTED', 'DRM-защищённые EPUB не поддерживаются');
    }

    // 4. Распарсить META-INF/container.xml → найти path до OPF
    //    assertSafeXml() перед парсингом (XXE protection из #2)
    const opfPath = findOpfPath(archive);

    // 5. Распарсить OPF → metadata + manifest (id → href) + spine (ordered itemrefs)
    const opf = parseOpf(archive[opfPath], opfPath);

    // 6. Для каждого spine item — распарсить XHTML → ContentItem[]
    const chapters: BookChapter[] = [];
    for (let i = 0; i < opf.spine.length; i++) {
      const href = opf.manifest[opf.spine[i]];
      const xhtmlBytes = archive[resolveHref(opfPath, href)];
      if (!xhtmlBytes) continue; // missing — skip с warning
      const items = parseXhtml(decodeUtf8(xhtmlBytes), opf.manifest);
      chapters.push({
        index: i,
        title: extractFirstHeading(items) ?? opf.spineLabels[i] ?? null,
        items,
        lang: opf.spineLang[i] ?? null,
      });
    }

    // 7. Извлечь все image-файлы из манифеста (mime-type "image/*")
    const images = extractImages(archive, opf.manifest);

    // 8. Подсчитать totalChars
    const totalChars = chapters.reduce(
      (sum, ch) => sum + countCharsInItems(ch.items),
      0,
    );

    return {
      title: opf.metadata.title ?? 'Untitled',
      author: opf.metadata.creator ?? null,
      language: normalizeLanguage(opf.metadata.language),
      coverId: opf.metadata.coverId,
      chapters,
      footnotes: {}, // EPUB v1: footnotes отдельной поддержки нет
      images,
      totalChars,
    };
  }
}
```

### 5.3 OPF parsing

```typescript
// src/services/parser/epub/opf.ts

interface OpfData {
  metadata: {
    title: string | null;
    creator: string | null;
    language: string | null;
    coverId: string | null;
  };
  /** manifest item id → href (relative to OPF location) */
  manifest: Record<string, string>;
  /** ordered list of spine item ids */
  spine: string[];
  /** title of each spine item (если есть в TOC) */
  spineLabels: Array<string | null>;
  /** xml:lang override per spine item */
  spineLang: Array<string | null>;
}
```

Метаданные читаются из `<metadata>` namespace `http://www.idpf.org/2007/opf` + Dublin Core `<dc:*>`. Обработать оба EPUB 2 cover-стиля:
- EPUB 2: `<meta name="cover" content="cover-image-id" />` → найти в manifest по id.
- EPUB 3: `<item ... properties="cover-image" />` → найти в manifest напрямую.

### 5.4 XHTML → ContentItem[]

Парсим XHTML через `@xmldom/xmldom` (DOMParser, mimeType `application/xhtml+xml`). Игнорируем `<html>`/`<head>` — берём содержимое `<body>`.

Маппинг тегов:

| XHTML | ContentItem |
|---|---|
| `<h1>` ... `<h6>` | `{type: 'heading', level, id, inlines}` |
| `<p>` | `{type: 'paragraph', inlines}` |
| `<blockquote>` | `{type: 'blockquote', items}` (recurse) |
| `<ol>` / `<ul>` | `{type: 'list', ordered, items: [[children]]}` |
| `<li>` | элемент `list.items` |
| `<img>` | `{type: 'image', src, alt?, aspectRatio?}` (src — id из manifest) |
| `<hr>` | `{type: 'separator'}` |
| `<table>` → каждый `<tr>` | `{type: 'table-row', cells}` |
| `<div>`, `<section>`, `<article>` | прозрачный — recurse children |
| `<span>` | прозрачный — собирается в inline |
| `<em>`, `<i>` | `{type: 'italic', children}` |
| `<strong>`, `<b>` | `{type: 'bold', children}` |
| `<a href>` | `{type: 'link', href, children}` |
| `<sup>` / `<sub>` | `{type: 'sup' / 'sub', children}` |
| `<br>` | разделитель inline-ноды в текущем параграфе (вставить `text: '\n'`) |
| `<script>`, `<style>`, `<head>` | drop |

**Anchor `id`:** для `<h*>` атрибут `id` нужен для footnote/TOC-навигации (`href="#fragment"`). Заполняем `ContentItem.heading.id`.

**Image src resolution:** `<img src="../images/cover.jpg" />` → resolve относительно XHTML-файла → найти в manifest → `image.src = "${imageId}"` (id из manifest). При рендере reader заменит на `file://...` URI после ImportPipeline извлечёт.

**Депth-limit:** при вложенности `InlineNode.children` > `MAX_INLINE_DEPTH` (20) — flatten в текст (см. §5.5).

### 5.5 Flatten защита

```typescript
function appendInline(parent: InlineNode[], child: InlineNode, depth: number) {
  if (depth >= MAX_INLINE_DEPTH) {
    // Сплющиваем — извлекаем весь текст из child и его потомков
    parent.push({ type: 'text', text: flattenText(child) });
    return;
  }
  parent.push(child);
}
```

### 5.6 EPUB-specific edge cases

- **mimetype** должен быть **первым** файлом и **не сжат** (stored, not deflated). fflate возвращает все entries — проверяем существование файла, не порядок.
- **Multiple `<body>` тегов** — невалидно, но встречается. Берём первый.
- **`<title>` в `<head>`** XHTML — игнорируем (это HTML-title, не глава).
- **Inline SVG** — не поддерживаем в MVP, рендерим placeholder text «[SVG]» (или skip).
- **Nested tables** — `<table>` внутри `<td>` — flatten в текст.
- **EPUB с одной главой** (всё в spine[0]) — поддерживается, рендерится как одна большая глава.

---

## 6. FB2 parser

### 6.1 Структура FB2

FB2 — один XML-файл (намного проще EPUB):

```xml
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <book-title>...</book-title>
      <author><first-name>...</first-name><last-name>...</last-name></author>
      <lang>ru</lang>
      <coverpage><image l:href="#cover.jpg"/></coverpage>
    </title-info>
  </description>

  <body>                                  ← основной текст
    <section>
      <title><p>Chapter 1</p></title>
      <p>Lorem ipsum <emphasis>foo</emphasis>.</p>
      ...
      <section>...</section>              ← может быть вложенным
    </section>
  </body>

  <body name="notes">                     ← сноски (опционально)
    <section id="n1"><title>...</title><p>...</p></section>
  </body>

  <binary id="cover.jpg" content-type="image/jpeg">
    iVBORw0KGgo...                        ← base64
  </binary>
</FictionBook>
```

### 6.2 Алгоритм парсинга

```typescript
// src/services/parser/Fb2Parser.ts

class Fb2Parser {
  async parse(xmlBytes: Uint8Array): Promise<ParsedBook> {
    // 1. Определить encoding (XML <?xml encoding="..."> или UTF-8 default)
    const xml = decodeWithEncoding(xmlBytes);

    // 2. assertSafeXml() — XXE protection
    assertSafeXml(xml, { maxSize: 50 * 1024 * 1024 });

    // 3. Распарсить через @xmldom/xmldom
    const doc = parseXml(xml);

    // 4. Извлечь metadata из <description>/<title-info>
    const meta = parseTitleInfo(doc);

    // 5. Найти <body> без атрибута name — основной текст
    const mainBody = findMainBody(doc);
    if (!mainBody) throw new ParserError('FB2_NO_BODY', 'FB2 без <body>');

    // 6. Главы — top-level <section> внутри основного body
    //    Если main body состоит из <p> без секций — одна глава.
    const chapters = parseChapters(mainBody);

    // 7. Footnotes — <body name="notes">
    const footnotes = parseFootnotes(doc);

    // 8. Binary — все <binary> теги
    const images = parseBinaries(doc);

    return { ...meta, chapters, footnotes, images, totalChars: ... };
  }
}
```

### 6.3 FB2 element mapping

| FB2 | ContentItem / InlineNode |
|---|---|
| `<section><title>` | `{type: 'heading', level: depth+1, inlines, id?}` |
| `<section>` без `<title>` | внутренние элементы напрямую |
| `<p>` | `{type: 'paragraph', inlines}` |
| `<subtitle>` | `{type: 'heading', level: 3, inlines}` |
| `<epigraph>` | прозрачный — recurse дети с `style.italic: true` на параграфы |
| `<cite>` | `{type: 'blockquote', items}` |
| `<text-author>` (внутри cite/epigraph) | `paragraph` с `style.textAlign: 'right'` |
| `<poem>` | прозрачный — recurse |
| `<stanza>` | прозрачный — добавляем `separator` между stanzas |
| `<v>` (стихотворная строка) | `paragraph` с `style.italic: true`, без indent |
| `<empty-line>` | `{type: 'separator'}` |
| `<image l:href="#imageId">` | `{type: 'image', src: imageId}` |
| `<emphasis>` | `{type: 'italic', children}` |
| `<strong>` | `{type: 'bold', children}` |
| `<a l:href="#target" type="note">` | `{type: 'footnote-ref', id: 'target', label: text}` |
| `<a l:href="...">` (без type) | `{type: 'link', href, children}` |
| `<sup>` / `<sub>` | `{type: 'sup' / 'sub', children}` |
| `<table>`, `<tr>`, `<td>` | как EPUB — `table-row` |
| `<style name="...">` | прозрачный — игнорируем имя стиля (наш темизатор управляет всем) |

**Heading levels:** nested `<section>` — `<section level=1>` → `heading.level: 1`, ..., `<section level=6>` → `heading.level: 6`. Глубже — clamp на 6.

**Image href:** FB2 использует XLink — `l:href="#cover.jpg"`. ID после `#` совпадает с `<binary id="cover.jpg">`.

### 6.4 FB2 binary images

```typescript
function parseBinaries(doc: Document): ParsedImage[] {
  const binaries = doc.getElementsByTagName('binary');
  const result: ParsedImage[] = [];
  for (let i = 0; i < binaries.length; i++) {
    const node = binaries[i];
    const id = node.getAttribute('id');
    const mime = node.getAttribute('content-type') ?? 'image/jpeg';
    const base64Text = node.textContent?.trim() ?? '';
    if (!id || !base64Text) continue;
    const bytes = base64Decode(base64Text);
    result.push({ id, bytes, mime });
  }
  return result;
}
```

Размер: лимит decoded image — 10MB, чтобы 100MB FB2 с одним 50MB изображением не сожрал память.

### 6.5 FB2-specific edge cases

- **encoding declaration:** `<?xml version="1.0" encoding="windows-1251"?>` встречается в русских FB2. Декодируем через `TextDecoder('windows-1251')` (есть в Hermes). Fallback на UTF-8.
- **Namespace declarations:** `xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"` и `xmlns:l="http://www.w3.org/1999/xlink"`. xmldom обрабатывает namespaces — мы можем читать `node.getElementsByTagNameNS('*', 'p')` для namespace-agnostic чтения.
- **Multiple `<body>`:** один без атрибута (main), один с `name="notes"` (footnotes), могут быть с `name="comments"` — последний игнорируем.
- **Inline whitespace в `<p>`:** preserve, не collapse — иначе пропадают табы/пробелы в стихах.
- **Self-closing namespaced tags:** xmldom v0.9 корректно их обрабатывает.

---

## 7. ImportPipeline

### 7.1 Контракт

```typescript
// src/services/import/ImportPipeline.ts

export interface ImportFile {
  uri: string;       // file:// URI от document picker
  name: string;      // оригинальное имя файла (для display)
  size: number;      // байты
  mimeType?: string; // от document picker (не доверять — определяем сами)
}

export class ImportPipeline {
  constructor(
    private db: Database,
    private parsers: ParserRegistry,
  ) {}

  async import(file: ImportFile): Promise<ImportResult> {
    // 1. Pre-checks: размер, расширение
    assertFileSize(file.size);

    // 2. Скопировать файл в documentDirectory/books/_tmp/{uuid}.{ext}
    //    (мы не оставляем книги вне Books/ — но во время парсинга может упасть)
    const tmpPath = await stagingCopy(file);

    try {
      // 3. Определить формат
      const format = await detectFormat(tmpPath, file.name);

      // 4. Прочитать в память
      const bytes = await readBytes(tmpPath);

      // 5. Парсинг
      const parser = this.parsers.get(format);
      const parsed = await parser.parse(bytes);

      // 6. Создать bookId (UUID v4 через expo-crypto)
      const bookId = generateBookId();
      const finalPath = `${docsDir}/books/${bookId}/source.${format}`;

      // 7. Создать директорию + переместить файл + извлечь изображения
      await ensureDir(`${docsDir}/books/${bookId}/images/`);
      await moveFile(tmpPath, finalPath);
      await writeImages(`${docsDir}/books/${bookId}/images/`, parsed.images);
      const coverPath = parsed.coverId
        ? `${docsDir}/books/${bookId}/images/${parsed.coverId}`
        : null;

      // 8. Атомарная транзакция БД
      await this.db.write(async () => {
        await BookRepository(this.db).createWithId({
          id: bookId,
          title: parsed.title,
          author: parsed.author,
          language: parsed.language ?? 'en', // fallback — Library UI попросит
          format,
          filePath: finalPath,
          coverPath,
          source: 'import',
          totalChars: parsed.totalChars,
        });
        await ChapterRepository(this.db).bulkCreate(
          bookId,
          parsed.chapters.map((ch) => ({
            index: ch.index,
            title: ch.title,
            charOffset: computeCharOffset(parsed.chapters, ch.index),
            charCount: countCharsInItems(ch.items),
          })),
        );
        // Position не записываем — нет до первого скролла (по дефолту 0/0)
      });

      return {
        bookId,
        filePath: finalPath,
        chapterCount: parsed.chapters.length,
        languageDetected: parsed.language,
      };
    } catch (e) {
      // Cleanup: удалить tmpPath + создавать books/{bookId}/ если успели
      await cleanupOnFailure(tmpPath);
      throw e;
    }
  }
}
```

### 7.2 Format detection

```typescript
async function detectFormat(path: string, originalName: string): Promise<'epub' | 'fb2'> {
  // Magic bytes (приоритет): EPUB начинается с "PK\x03\x04" (zip),
  // FB2 — с "<?xml" или "\xEF\xBB\xBF<?xml" (UTF-8 BOM)
  const head = await readFirstBytes(path, 64);
  if (head[0] === 0x50 && head[1] === 0x4B) return 'epub';
  if (looksLikeXml(head)) {
    // Дополнительная проверка: содержит "FictionBook" в первых 4KB
    const sample = await readFirstBytes(path, 4096);
    if (decodeUtf8(sample).includes('FictionBook')) return 'fb2';
  }
  // Fallback на расширение
  const ext = originalName.toLowerCase().split('.').pop();
  if (ext === 'epub') return 'epub';
  if (ext === 'fb2') return 'fb2';
  throw new ParserError('UNKNOWN_FORMAT', 'Файл не похож на EPUB или FB2');
}
```

### 7.3 Path safety

ImportPipeline пишет **только** в `${documentDirectory}/books/{bookId}/`. Все пути формируются из проверенного `bookId` (UUID) и whitelisted имён (`source.epub`, `images/{imageId}`). `imageId` из manifest sanitize-ится (см. §11.4).

### 7.4 Cover extraction

Если `parsed.coverId !== null` и изображение успешно извлечено — `coverPath` устанавливается в Library card. Если cover отсутствует — Library показывает placeholder с буквой названия.

### 7.5 Rollback на failure

При любой ошибке после создания временной директории — `cleanupOnFailure` удаляет:
- `tmpPath` (если ещё существует)
- `${docsDir}/books/{bookId}/` (если создана)

Запись `Book` в БД делается **последней** — если БД-write упадёт, файлы уже на диске остались, но это исправляется отдельной задачей `pruneOrphanedBookDirs()` (запуск при app start, см. §10.5).

---

## 8. Reader Engine — life cycle

### 8.1 Mount flow

```
ReaderScreen mount (route param: bookId)
  ↓
useReaderEngine(bookId):
  1. BookRepository.findById(bookId)
  2. ChapterRepository.listByBookId(bookId)  ← только metadata, items не загружены
  3. ReadingPositionRepository.findByBookId(bookId)  ← {chapter_index, character_offset}
  4. Загрузить sourceBytes из FileSystem.readAsBytesAsync(book.filePath)
  5. Распарсить весь файл → ParsedBook (см. §2.6 — re-parse on open)
  6. Положить chapter[currentChapterIndex] в state, initialOffset = position.character_offset
  ↓
status = 'ready' → ScrollView рендерится → scrollToOffset(initialOffset)
```

Шаги 4-5 выполняются в `InteractionManager.runAfterInteractions()` чтобы не блокировать UI-thread первого рендера loading-screen.

**Loading skeleton:** между mount и `status === 'ready'` показываем skeleton (placeholder параграфы — серые прямоугольники).

### 8.2 Chapter switch

При тапе кнопки next/prev:
1. Decrement/increment `currentChapterIndex`.
2. Из in-memory parsed book — получить `chapters[newIndex]`.
3. Обновить state, scroll-to-top.
4. Записать `reading_position` (debounced).

Парсинг происходит **один раз при open** — переключение глав не пересчитывает ничего, просто меняет указатель.

### 8.3 Scroll → position save

`onScroll` на FlatList — throttled 500ms. Берём currently visible item, вычисляем character_offset через `chapters[i].items[0..visibleIndex].forEach(countChars)`. Пишем в `ReadingPositionRepository.upsert`.

### 8.4 Word tap → translation

```
User taps word "ephemeral"
  ↓
onTap(word, sentence):
  setTranslationPopup({ kind: 'opening', word, sentence })
  ↓
useEffect (kind === 'opening'):
  translationService.translate({ word, sentence, sourceLang, targetLang })
    .then(res => setTranslationPopup({ kind: 'success' / 'pending' / 'error', ... }))
  ↓
Popup отрисовывается как Sheet (Foundation primitive)
```

`ITranslationService` из #2 — NoOp возвращает `{status: 'pending'}`. UI показывает:
- `'pending'` → spinner с текстом «Перевод недоступен (sub-project #4 не реализован)».
- `'success'` → translation text + part of speech.
- `'error'` → ошибка с retry-кнопкой.

Sentence для контекста — параграф, в котором было tapped слово. Извлекаем при tap из visible ContentItem.

### 8.5 Sentence extraction для контекста перевода

```typescript
function extractSentence(item: ContentItem, tappedWordIndex: number): string {
  if (item.type !== 'paragraph') return '';
  const fullText = flattenInlines(item.inlines);
  const sentences = splitIntoSentences(fullText); // регулярка по [.!?] + \s
  // Найти sentence, в котором лежит tappedWordIndex
  let charsCount = 0;
  for (const s of sentences) {
    charsCount += s.length;
    if (charsCount > tappedWordIndex) return s.trim();
  }
  return fullText; // fallback
}
```

---

## 9. Rendering

### 9.1 Компонентная иерархия

```
<ReaderScreen>                    ← app/reader/[bookId].tsx
  <PhoneShell>
    <ReaderTopBar>                ← chapter title, back, settings icon
    <ChapterRenderer>             ← основной FlatList контента
      <FlatList data={items}>
        <ContentItemRenderer item={item}>
          ↓
          paragraph → <TappableText> ← рекурсивный inline-render
          heading → <Headline level={...}>
          image → <BookImage src={...}>
          list → <BookList ordered={...}>
          blockquote → <BookBlockquote items={...}>
          separator → <View height={...}>
          table-row → <View row>
    <ReaderControlsSheet>         ← font size, theme switcher
    <TranslationPopup>            ← Sheet с переводом
    <ChapterNavBar>               ← prev/next + chapter progress
```

### 9.2 ContentItemRenderer

```typescript
// src/components/reader/ContentItemRenderer.tsx

interface Props {
  item: ContentItem;
  /** for word-tap callback */
  onWordTap: (word: string, sentence: string) => void;
}

export const ContentItemRenderer = React.memo(function ContentItemRenderer({
  item,
  onWordTap,
}: Props) {
  switch (item.type) {
    case 'paragraph':
      return <ParagraphRender inlines={item.inlines} style={item.style} onWordTap={onWordTap} />;
    case 'heading':
      return <HeadingRender level={item.level} inlines={item.inlines} />;
    case 'image':
      return <ImageRender src={item.src} alt={item.alt} aspectRatio={item.aspectRatio} />;
    case 'blockquote':
      return <BlockquoteRender items={item.items} onWordTap={onWordTap} />;
    case 'list':
      return <ListRender ordered={item.ordered} items={item.items} onWordTap={onWordTap} />;
    case 'separator':
      return <SeparatorRender />;
    case 'table-row':
      return <TableRowRender cells={item.cells} onWordTap={onWordTap} />;
  }
});
```

`React.memo` важен — FlatList re-renders при каждом scroll-update, memoизация по item-reference предотвращает.

### 9.3 ParagraphRender — word-tap

```typescript
function ParagraphRender({ inlines, style, onWordTap }) {
  const { theme, rt } = useUnistyles();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const bookLang = ... // from ReaderContext
  const script = scriptForLang(bookLang);
  const leading = scriptTypography[script].readingLeading;

  return (
    <Text style={{
      color: theme.ink,
      fontSize,
      lineHeight: fontSize * leading,
      fontFamily: scriptToFont[script],
      textAlign: style?.textAlign,
      fontStyle: style?.italic ? 'italic' : 'normal',
      // indent: style?.indent — через ::before или leading space
    }}>
      {inlines.map((node, i) => renderInline(node, [i], onWordTap))}
    </Text>
  );
}

function renderInline(node, path, onWordTap, parentBold=false, parentItalic=false) {
  switch (node.type) {
    case 'text':
      const tokens = splitWords(node.text);
      return tokens.map((tok, ti) => {
        if (tok.kind !== 'word') return tok.text;
        const key = path.concat(ti).join('-');
        return (
          <Text key={key} onPress={() => onWordTap(tok.text, sentence /* TODO */)}>
            {tok.text}
          </Text>
        );
      });
    case 'bold':
      return <Text style={{fontWeight: 'bold'}}>{node.children.map(...)}</Text>;
    case 'italic':
      return <Text style={{fontStyle: 'italic'}}>{node.children.map(...)}</Text>;
    case 'link':
      return <Text style={{color: theme.accent}} onPress={() => /* TBD */}>{node.children.map(...)}</Text>;
    case 'footnote-ref':
      return <Text style={{color: theme.accent}}>[{node.label}]</Text>;
    case 'sup':
      return <Text style={{fontSize: fontSize * 0.7, /* superscript via lineHeight tricks */}}>{...}</Text>;
    case 'sub':
      // similarly
  }
}
```

**Sentence в onWordTap:** на момент tap извлекаем из текущего параграфа через §8.5 — параграф известен из contextного state.

### 9.4 Active word highlight

После `onWordTap` reader engine хранит `activeWord: string | null` (id). При re-render same word — apply `wordActive` стиль (background = accent).

### 9.5 ImageRender

```typescript
function ImageRender({ src, alt, aspectRatio }) {
  // src — image id из manifest (для EPUB) или FB2 binary id
  // Reader engine знает bookId — формирует URL
  const { bookId } = useReaderContext();
  const uri = `${docsDir}/books/${bookId}/images/${sanitizeImageId(src)}`;

  return (
    <View style={{ marginVertical: 16 }}>
      <Image
        source={{ uri: `file://${uri}` }}
        style={{
          width: '100%',
          aspectRatio: aspectRatio ?? 1.5, // fallback если неизвестно
        }}
        resizeMode="contain"
        accessibilityLabel={alt}
      />
    </View>
  );
}
```

### 9.6 BlockquoteRender, ListRender, TableRowRender

- **Blockquote** — `View` с `borderLeftWidth: 3`, `borderLeftColor: theme.accentLine`, `paddingLeft: 12`, recurse `items`.
- **List** — `<View>` с маркером (`'•'` для unordered, `'1.'` для ordered) и indent. Items — recursive ContentItemRenderer.
- **Table-row** — minimal: `<View>` с горизонтальным flex, cells через `|` separator. Это temporary — настоящий table-render во v2.

### 9.7 Theme-aware styling

Reader UI **должен** читать тему inline через `useUnistyles()`:

```typescript
const { theme } = useUnistyles();
// Использовать theme.ink, theme.paper, theme.accent, etc. напрямую.
```

Это в обход известного бага StyleSheet.create((theme) => …) caching (см. CLAUDE.md #1179). Глобальный page background (paper) контролируется `PhoneShell` (Foundation), мы внутри получаем правильный текст.

### 9.8 Virtualization

`FlatList`:
- `data={chapter.items}`
- `keyExtractor={(item, idx) => `${chapter.index}-${idx}`}` (память chapter-switch стабильно работает)
- `renderItem={({item}) => <ContentItemRenderer item={item} onWordTap={onWordTap} />}`
- `initialNumToRender={20}`
- `windowSize={5}`
- `maxToRenderPerBatch={10}`
- `removeClippedSubviews={true}` (на Android)
- `getItemLayout=` — **не используем** (item высоты переменные).
- `onEndReachedThreshold={0.8}` + auto-advance к следующей главе **в v2**.

### 9.9 Восстановление скролла

При re-mount: `initialOffset` в characters. Конвертация в FlatList offset:

1. Найти `paragraphIndex` через cumsum `countCharsInItem(items[i])`.
2. `flatListRef.scrollToIndex({index: paragraphIndex, animated: false})`.

Если `scrollToIndex` падает (item не measured) — fallback на `scrollToOffset` через approximate avg-height-per-paragraph.

---

## 10. Memory, performance, LRU

### 10.1 Парсинг — на UI-startup, не blocking

```typescript
useEffect(() => {
  let cancelled = false;
  const task = InteractionManager.runAfterInteractions(async () => {
    try {
      const bytes = await readBytes(book.filePath);
      const parsed = await parser.parse(bytes);
      if (!cancelled) setParsedBook(parsed);
    } catch (e) {
      if (!cancelled) setError(e);
    }
  });
  return () => {
    cancelled = true;
    task.cancel();
  };
}, [book.filePath]);
```

### 10.2 Chapter LRU

В MVP — **не нужен**. Re-parse on-open даёт всю книгу в памяти. ContentItem-tree ~ 1-5MB для типичной книги (200 KB FB2 → ~1MB tree). Хранить всё разумно.

LRU важен для случая, когда reader engine управляет **несколькими** книгами (например, последние 3 открытые) — но это не MVP-сценарий.

### 10.3 On-disk кэш (отложено)

В v2 можно добавить:
```
books/{bookId}/parsed/0.json
books/{bookId}/parsed/1.json
...
books/{bookId}/parsed/_version.txt   ← версия формата ContentItem
```

При open: проверить version, если совпадает с текущей — `JSON.parse` вместо re-parse. При несовпадении — re-parse + перезаписать.

В MVP — **не реализуем**, оставляем re-parse on open. Возврат к решению после измерения боли.

### 10.4 Heap discipline

- `sourceBytes` (raw file) — освобождаем после `parser.parse()` через `setSourceBytes(null)`. ParsedBook содержит готовое дерево.
- ParsedBook извлечённые изображения — `parsed.images: ParsedImage[]` — освобождаем после `writeImages()` (только bytes, остальное в Book/Chapter записях).
- Reader engine при unmount — освобождает `parsedBook`.

### 10.5 Orphaned book directories

При app cold-start (`ReaderEngine.initialize()`) — пробежать по всем директориям в `${docsDir}/books/` и удалить те, для которых нет соответствующей записи `Book` в БД (могут остаться от failed import-ов). Это идемпотентный cleanup, выполняется в фоне.

---

## 11. Безопасность

### 11.1 Лимиты размера

```typescript
const MAX_EPUB_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_FB2_FILE_SIZE = 50 * 1024 * 1024;   // 50 MB (FB2 — XML, expand больше)
const MAX_EPUB_UNCOMPRESSED = 200 * 1024 * 1024; // 200 MB после распаковки
const MAX_IMAGE_DECODED = 10 * 1024 * 1024;   // 10 MB на одно изображение
const MAX_TOTAL_IMAGES_PER_BOOK = 1000;        // штуки
const MAX_TOTAL_CHARS_PER_BOOK = 10_000_000;   // 10M символов = ~50 нормальных книг
```

При превышении — отвергаем с `ParserError('FILE_TOO_LARGE', ...)`.

### 11.2 ZIP bomb protection

В fflate проверяем сумму `decompressedSize` всех entries **до** распаковки. Если превышает `MAX_EPUB_UNCOMPRESSED` — abort. fflate.unzip с callback по entry — позволяет abort mid-stream.

### 11.3 XXE / billion laughs

Используем `assertSafeXml()` из #2 (`src/services/xml/safeParser.ts`):
- Отвергает любые `<!DOCTYPE` (REJECT-ANY-DOCTYPE policy).
- Применяется **перед** передачей в xmldom.

xmldom сам по себе по умолчанию не resolve entities (`processEntities: false` через `DOMParser({errorHandler})` — проверить и тестово зафиксировать). Но REJECT-ANY-DOCTYPE — first line.

### 11.4 Path traversal в image-id

`<image l:href="../../etc/passwd" />` (FB2) или EPUB image href с `..` — не должен выходить за `books/{bookId}/images/`. Sanitize:

```typescript
function sanitizeImageId(id: string): string {
  // Только [a-zA-Z0-9._-], отвергаем pathseparators
  return id.replace(/[^a-zA-Z0-9._-]/g, '_');
}
```

Если sanitized != original — image-id переименовывается. Reference в ContentItem.image.src обновляется соответственно.

### 11.5 EPUB encryption rejection

```typescript
if (archive['META-INF/encryption.xml']) {
  throw new ParserError('EPUB_ENCRYPTED', '...');
}
```

DRM-защищённые EPUB не поддерживаются — показываем пользователю ясное сообщение в Library.

### 11.6 SVG content

EPUB content с inline SVG — потенциальный вектор JS (через `<script>` в SVG). На MVP — отвергаем все `<svg>` теги (заменяем на placeholder text). В будущем — sanitize через `xss`-style allowlist.

---

## 12. Error handling

### 12.1 ParserError

```typescript
export class ParserError extends Error {
  constructor(
    public code: ParserErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ParserError';
  }
}

export type ParserErrorCode =
  | 'FILE_TOO_LARGE'
  | 'UNKNOWN_FORMAT'
  | 'EPUB_ENCRYPTED'
  | 'EPUB_BAD_MIMETYPE'
  | 'EPUB_BAD_CONTAINER'
  | 'EPUB_NO_OPF'
  | 'EPUB_NO_SPINE'
  | 'EPUB_ZIP_BOMB'
  | 'FB2_NO_BODY'
  | 'FB2_INVALID_XML'
  | 'XML_UNSAFE'           // из assertSafeXml
  | 'IMAGE_TOO_LARGE'
  | 'IO_ERROR';
```

### 12.2 Сообщения пользователю

В Library/Reader UI ловим `ParserError` и показываем локализованное сообщение через `t('reader.errors.{code}')`. Технические details — только в `console.error` для dev.

### 12.3 Partial parsing

Парсеры не должны падать на одной плохой главе. Если глава n не парсится — добавляем `{title: 'Chapter n (corrupted)', items: [{ type: 'paragraph', inlines: [{type: 'text', text: '⚠️ Не удалось разобрать главу'}]}]}` и продолжаем. Лог через `console.warn`.

### 12.4 Восстановление после crash

Если приложение упало во время чтения — `ReadingPosition` сохраняется на каждом scroll-end (throttled 500ms). При перезапуске — последняя сохранённая позиция восстанавливается. Macro: max потеря — 500ms скролла.

---

## 13. Тестовая стратегия

### 13.1 Unit (Jest)

**Парсеры:**
- `EpubParser.test.ts` — фикстуры в `src/services/parser/__tests__/fixtures/epub/`:
  - `minimal.epub` — 1 глава, без images, без TOC.
  - `multi-chapter.epub` — 5 глав, 2 image.
  - `nested-italic.epub` — `<em><strong><em>text</em></strong></em>` depth=3.
  - `pathological-nesting.epub` — depth=25 (проверка flatten).
  - `encrypted.epub` — META-INF/encryption.xml присутствует.
- `Fb2Parser.test.ts` — фикстуры в `fixtures/fb2/`:
  - `minimal.fb2` — 1 секция, базовая metadata.
  - `multi-section.fb2` — 3 главы.
  - `with-binary.fb2` — embedded image.
  - `windows-1251.fb2` — encoding declaration.
  - `with-footnotes.fb2` — `<body name="notes">`.
  - `poem.fb2` — stanzas/v.
- `formatDetection.test.ts` — magic bytes для всех combinations.
- `assertSafeXml` уже тестировано в #2 — re-test integration в парсерах.
- `sanitizeImageId.test.ts` — path-traversal vectors.

**Rendering:**
- `ContentItemRenderer.test.tsx` (RTL) — каждый тип ContentItem рендерит правильно.
- `ParagraphRender.test.tsx` — onWordTap вызывается с правильными аргументами.
- `extractSentence.test.ts` — sentence boundary detection.

**ImportPipeline:**
- `ImportPipeline.test.ts` — mock parser + БД, проверка rollback на разных ошибках.

### 13.2 Integration (Jest with in-memory DB)

- Импорт «borges.fb2» fixture → Book record создан → 1 глава.
- Импорт + reader engine mount → state.status='ready' через 3 ticks.
- Word-tap callback вызывается, popup state переходит в 'pending' (NoOp).

### 13.3 Manual smoke (после merge plan)

На iPhone 17 simulator + Pixel 7 emulator:
1. Импорт `books/The Alchemist by Paulo Coelho.epub` через document picker → видна обложка в Library.
2. Тап обложки → reader открывается, видны первые параграфы (< 2 сек).
3. Скролл — 60fps, без jank.
4. Smena главы prev/next — мгновенно.
5. Tap слова → popup, текст «Перевод недоступен (sub-project #4)».
6. Kill app → restart → reader открывается на той же позиции.
7. Импорт `books/Лорд с планеты Земля.fb2` (windows-1251 encoding, large) → кириллица читается правильно.

---

## 14. Файловая структура (новое)

```
src/
  services/
    parser/
      types.ts                          ← ParsedBook, ParsedImage, ParserError
      ParserRegistry.ts                 ← диспетчер по format
      EpubParser.ts                     ← entry point
      Fb2Parser.ts                      ← entry point
      shared/
        flattenInline.ts                ← MAX_INLINE_DEPTH-safe inline construction
        countChars.ts                   ← length calc для positions
        decodeEncoding.ts               ← TextDecoder helpers
        sanitizeImageId.ts              ← path safety
      epub/
        container.ts                    ← parse META-INF/container.xml
        opf.ts                          ← parse content.opf
        xhtml.ts                        ← parse XHTML body → ContentItem[]
        manifest.ts                     ← image-id ↔ href mapping
      fb2/
        titleInfo.ts                    ← <description>/<title-info>
        body.ts                         ← <body> sections → ContentItem[]
        footnotes.ts                    ← <body name="notes">
        binary.ts                       ← <binary> → ParsedImage
      __tests__/
        fixtures/
          epub/
            minimal.epub
            multi-chapter.epub
            nested-italic.epub
            pathological-nesting.epub
            encrypted.epub
          fb2/
            minimal.fb2
            multi-section.fb2
            with-binary.fb2
            windows-1251.fb2
            with-footnotes.fb2
            poem.fb2
        EpubParser.test.ts
        Fb2Parser.test.ts
        formatDetection.test.ts
        sanitizeImageId.test.ts
    import/
      ImportPipeline.ts
      types.ts                          ← ImportFile, ImportResult
      stagingCopy.ts
      detectFormat.ts
      cleanupOnFailure.ts
      __tests__/
        ImportPipeline.test.ts
    reader/
      ReaderEngine.ts                   ← class или useReducer + hook
      useReaderEngine.ts                ← React hook wrapper
      extractSentence.ts
      __tests__/
        useReaderEngine.test.tsx
        extractSentence.test.ts

  components/
    reader/
      ChapterRenderer.tsx               ← FlatList wrapper
      ContentItemRenderer.tsx           ← switch по type
      ParagraphRender.tsx               ← inline + word-tap
      HeadingRender.tsx
      BlockquoteRender.tsx
      ListRender.tsx
      ImageRender.tsx
      SeparatorRender.tsx
      TableRowRender.tsx
      TranslationPopup.tsx              ← Sheet с translation state machine
      ReaderTopBar.tsx                  ← back + chapter title
      ReaderControlsSheet.tsx           ← font size, theme
      ChapterNavBar.tsx                 ← prev/next + progress
      __tests__/
        ContentItemRenderer.test.tsx
        ParagraphRender.test.tsx
        TranslationPopup.test.tsx

app/reader/[bookId].tsx                 ← переписать поверх ReaderEngine

  types/
    content.ts                          ← (уже есть в Foundation)
```

---

## 15. Открытые вопросы

| # | Вопрос | Предлагаемое решение |
|---|---|---|
| 1 | **EPUB 3 navigation document** (`nav.xhtml`) использовать для TOC vs OPF spine? | MVP: spine order = chapter order. nav.xhtml игнорируем — TOC UI не делаем. |
| 2 | **EPUB media-overlays** (синхронизация с audio) | Skip — не наш use case. |
| 3 | **CSS из EPUB** игнорировать или применить subset (font-style, font-weight)? | Игнорируем — наш theme источник истины для всех визуальных свойств. |
| 4 | **FB2 `<custom-info>`** (произвольные метаданные) | Игнорируем — не используем. |
| 5 | **Right-to-left** для арабских книг — кто детектит direction? | По `book.language === 'ar'` reader выставляет `writingDirection: 'rtl'`. Парсер не вмешивается. |
| 6 | **Вертикальные CJK** (`text-orientation: vertical`) | Out of scope. Все CJK книги рендерим горизонтально. |
| 7 | **Drop caps** (большая буква первого параграфа) | Out of scope в MVP. |
| 8 | **Footnote popup UI** — bottom sheet vs inline expansion? | Bottom sheet (Foundation primitive Sheet). Реализуется в фазе после MVP. |
| 9 | **Длина sentence для контекста LLM** — параграф или один sentence? | Один sentence из splitBySentence(). Параграф fallback. |
| 10 | **Поиск в книге** | Out of scope sub-project #3. Возможно sub-project отдельный. |
| 11 | **Chapter title display** на pages где chapter heading scrolled off | TopBar показывает текущий chapter title. Обновляется по visible item. |

---

## 16. Acceptance criteria для готовности #3

- [ ] EpubParser проходит все unit-тесты (≥ 10 fixtures покрывают edge cases)
- [ ] Fb2Parser проходит все unit-тесты (≥ 6 fixtures)
- [ ] ImportPipeline проходит integration test с in-memory DB
- [ ] Ручной smoke: импорт обеих тестовых книг (`The Alchemist.epub`, `Лорд.fb2`) на iPhone 17 + Pixel 7
- [ ] Открытие книги < 1.5 сек на iPhone 13 simulator
- [ ] Скролл 60fps на 200-страничной книге
- [ ] Tap слова → popup открывается ≤ 200ms (Foundation animation)
- [ ] Reading position восстанавливается после kill/restart app
- [ ] 0 typecheck errors, 0 lint warnings
- [ ] Все безопасностные правила (§11) реализованы и протестированы
- [ ] Reader UI работает во всех 3 темах (Day/Sepia/Night) с корректным контрастом
- [ ] Reader UI работает с font-size 15-26 (range из Foundation settings)

---

## 17. Roll-out

После merge #3:
- Sub-project **#4 Translation** заменит `NoOpTranslationService` на реальный LLM-сервис. Reader popup начнёт показывать переводы автоматически.
- Sub-project **#5 Library** добавит UI для импорта (сейчас в `app/import.tsx` стаб) — ImportPipeline уже готов.
- Sub-project **#6 Deck** добавит «Add to deck» кнопку в TranslationPopup.

---

**Конец спецификации.**
