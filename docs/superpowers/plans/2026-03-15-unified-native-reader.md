# Единый нативный ридер — план реализации

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить два отдельных ридера (FB2 нативный + EPUB WebView) единым нативным ридером, который рендерит все форматы из предварительно сконвертированных JSON-файлов глав.

**Architecture:** При импорте книги конвертер (fb2Converter / epubConverter) преобразует исходный формат в массив `BookChapter[]` — JSON-файлы по одному на главу. UnifiedReader загружает главы через `useChapterLoader` и рендерит `ContentItem[]` через `UnifiedRenderer`. Парсинг XML/HTML происходит один раз при импорте; при открытии книги — только `JSON.parse()`.

**Tech Stack:** React Native (Expo), TypeScript, FlashList, FlatList, fast-xml-parser, JSZip, WatermelonDB, expo-file-system

**Спецификация:** `docs/superpowers/specs/2026-03-15-unified-native-reader-design.md`

---

## Структура файлов

### Новые файлы

| Файл | Ответственность |
|------|----------------|
| `src/services/parser/types.ts` | + типы `ContentItem`, `InlineNode`, `BookChapter`, `ParagraphStyle`, `BookFootnotes` |
| `src/services/converter/chapterStorage.ts` | Чтение/запись/удаление JSON-файлов глав и сносок |
| `src/services/converter/fb2Converter.ts` | FB2 XML → `BookChapter[]` + изображения + сноски |
| `src/services/converter/epubConverter.ts` | EPUB ZIP → `BookChapter[]` + изображения + TOC |
| `src/services/converter/htmlEntities.ts` | Маппинг ~180 HTML-сущностей → Unicode-кодпоинты (Latin-1 + типографика + греческие) |
| `src/hooks/useChapterLoader.ts` | Ленивая загрузка глав из JSON с предзагрузкой ±1 |
| `src/components/reader/UnifiedReader.tsx` | Единый ридер (замена Fb2Reader + EpubReader) |
| `src/components/reader/UnifiedRenderer.tsx` | Рендер `ContentItem` → нативные компоненты (замена Fb2Renderer) |
| `src/components/reader/FootnoteSheet.tsx` | Bottom sheet для отображения содержимого сносок |
| `src/utils/textTokenizer.ts` | Утилиты `tokenizeIntoWords` и `extractSentence` (извлечены из Fb2Renderer) |

### Изменяемые файлы

| Файл | Изменения |
|------|-----------|
| `src/services/parser/Fb2Parser.ts` | Рекурсивные children в `parseInlinesOrdered()`, `linkType` в Fb2Inline, новый метод `parseAllBodies()` |
| `src/services/parser/types.ts` | Добавить `linkType?: string` в `Fb2Inline` |
| `src/db/schema.ts` | Версия 2→3, добавить `total_chapters` + `content_version` в таблицу `books` |
| `src/db/migrations/index.ts` | Добавить миграцию v2→v3 |
| `src/db/models/Book.ts` | Добавить поля `totalChapters`, `contentVersion` |
| `src/services/library/BookImporter.ts` | Интеграция конвертеров + прогрессивный импорт |
| `app/reader/[bookId].tsx` | Упрощение до одного `<UnifiedReader>` |

### Удаляемые файлы (Task 14 — после извлечения tokenizeIntoWords в утилиту)

| Файл | Причина |
|------|---------|
| `src/components/reader/EpubReader.tsx` | Заменён UnifiedReader |
| `src/components/reader/Fb2Reader.tsx` | Заменён UnifiedReader |
| `src/components/reader/Fb2Renderer.tsx` | Заменён UnifiedRenderer (tokenizeIntoWords → `src/utils/textTokenizer.ts`) |
| `src/services/reader/epubBridgeScript.ts` | Больше не нужен (нет WebView) |
| `src/services/reader/useFileSystemLegacy.ts` | Устарел |
| `src/services/parser/fb2Cache.ts` | Заменён JSON-файлами глав |
| `epubjs-react-native.d.ts` | Файл деклараций для удалённой зависимости |
| Зависимость `@epubjs-react-native` | Удалить из package.json (npm uninstall) |

---

## Chunk 1: Типы, хранилище глав, миграция БД

### Task 1: Добавить новые типы в parser/types.ts

**Files:**
- Modify: `src/services/parser/types.ts`

- [ ] **Step 1: Добавить типы `InlineNode`, `ContentItem`, `ParagraphStyle`, `BookChapter`, `BookFootnotes`**

В конец файла `src/services/parser/types.ts` (после существующих типов) добавить:

```typescript
// ─── Unified Reader Types ───────────────────────────────────────────────────

/** Инлайновый текстовый элемент с поддержкой вложенного форматирования */
export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'italic'; children: InlineNode[] }
  | { type: 'link'; href: string; children: InlineNode[] }
  | { type: 'sup'; children: InlineNode[] }
  | { type: 'sub'; children: InlineNode[] }
  | { type: 'footnote-ref'; id: string; label: string }

export interface ParagraphStyle {
  textAlign?: 'left' | 'center' | 'right'
  indent?: boolean
  italic?: boolean
}

/** Блочный элемент контента */
export type ContentItem =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; inlines: InlineNode[] }
  | { type: 'paragraph'; inlines: InlineNode[]; style?: ParagraphStyle }
  | { type: 'image'; src: string; alt?: string; width?: number; height?: number }
  | { type: 'blockquote'; inlines: InlineNode[]; nestedItems?: ContentItem[] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] }
  | { type: 'separator' }
  | { type: 'table-row'; cells: InlineNode[][] }

/** Одна глава сконвертированной книги */
export interface BookChapter {
  index: number
  title: string | null
  items: ContentItem[]
}

/** Сноски на уровне книги */
export interface BookFootnotes {
  [id: string]: InlineNode[]
}
```

- [ ] **Step 2: Добавить `linkType` в Fb2Inline**

В `src/services/parser/types.ts` в интерфейсе `Fb2Inline` добавить поле `linkType`:

```typescript
export interface Fb2Inline {
  type: 'text' | 'emphasis' | 'strong' | 'link' | 'image'
  text?: string
  href?: string
  imageId?: string
  children?: Fb2Inline[]
  linkType?: string  // 'note' для сносок FB2
}
```

- [ ] **Step 3: Проверить, что проект компилируется**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Без ошибок (или только существующие ошибки, не связанные с новым кодом)

- [ ] **Step 4: Коммит**

```
git add src/services/parser/types.ts
git commit -m "feat: add ContentItem, InlineNode, BookChapter types for unified reader"
```

---

### Task 2: Хранилище глав — chapterStorage.ts

**Files:**
- Create: `src/services/converter/chapterStorage.ts`

- [ ] **Step 1: Создать файл chapterStorage.ts**

```typescript
import * as FileSystem from 'expo-file-system/legacy'
import type { BookChapter, BookFootnotes } from '../parser/types'

const BOOKS_DIR = `${FileSystem.documentDirectory}books/`

/** Путь к директории глав книги */
function chaptersDir(bookId: string): string {
  return `${BOOKS_DIR}${bookId}/chapters/`
}

/** Путь к файлу конкретной главы */
function chapterPath(bookId: string, index: number): string {
  return `${chaptersDir(bookId)}${index}.json`
}

/** Путь к файлу сносок книги */
function footnotesPath(bookId: string): string {
  return `${BOOKS_DIR}${bookId}/footnotes.json`
}

/** Путь к директории изображений книги */
export function imagesDir(bookId: string): string {
  return `${BOOKS_DIR}${bookId}/images/`
}

/** Путь к исходному файлу книги */
export function sourcePath(bookId: string, ext: string): string {
  return `${BOOKS_DIR}${bookId}/source${ext}`
}

/** Создать директории для книги (chapters/ + images/) */
export async function ensureBookDirs(bookId: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(chaptersDir(bookId), { intermediates: true })
  await FileSystem.makeDirectoryAsync(imagesDir(bookId), { intermediates: true })
}

/** Сохранить массив глав на диск */
export async function saveChapters(bookId: string, chapters: BookChapter[]): Promise<void> {
  for (const chapter of chapters) {
    await FileSystem.writeAsStringAsync(
      chapterPath(bookId, chapter.index),
      JSON.stringify(chapter),
    )
  }
}

/** Загрузить одну главу из JSON */
export async function loadChapter(bookId: string, index: number): Promise<BookChapter> {
  const path = chapterPath(bookId, index)
  const json = await FileSystem.readAsStringAsync(path)
  return JSON.parse(json) as BookChapter
}

/** Проверить, существует ли файл главы */
export async function chapterExists(bookId: string, index: number): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(chapterPath(bookId, index))
  return info.exists
}

/** Сохранить сноски на диск */
export async function saveFootnotes(bookId: string, footnotes: BookFootnotes): Promise<void> {
  if (Object.keys(footnotes).length === 0) return
  await FileSystem.writeAsStringAsync(
    footnotesPath(bookId),
    JSON.stringify(footnotes),
  )
}

/** Загрузить сноски книги */
export async function loadFootnotes(bookId: string): Promise<BookFootnotes> {
  try {
    const json = await FileSystem.readAsStringAsync(footnotesPath(bookId))
    return JSON.parse(json) as BookFootnotes
  } catch {
    return {}
  }
}

/** Сохранить изображение (base64) в директорию images/ */
export async function saveImage(bookId: string, filename: string, base64: string): Promise<void> {
  await FileSystem.writeAsStringAsync(
    `${imagesDir(bookId)}${filename}`,
    base64,
    { encoding: FileSystem.EncodingType.Base64 },
  )
}

/** Удалить всю директорию книги */
export async function deleteBookDir(bookId: string): Promise<void> {
  await FileSystem.deleteAsync(`${BOOKS_DIR}${bookId}/`, { idempotent: true })
}

/** Заменить относительные src изображений на абсолютные пути (рекурсивно, включая nestedItems) */
export function resolveImagePaths(chapter: BookChapter, bookId: string): BookChapter {
  const base = `${BOOKS_DIR}${bookId}/`

  function resolveItems(items: ContentItem[]): ContentItem[] {
    return items.map((item) => {
      if (item.type === 'image' && item.src && !item.src.startsWith('file://')) {
        return { ...item, src: `${base}${item.src}` }
      }
      if (item.type === 'blockquote' && item.nestedItems) {
        return { ...item, nestedItems: resolveItems(item.nestedItems) }
      }
      return item
    })
  }

  return { ...chapter, items: resolveItems(chapter.items) }
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Без новых ошибок

- [ ] **Step 3: Коммит**

```
git add src/services/converter/chapterStorage.ts
git commit -m "feat: add chapterStorage for JSON chapter file I/O"
```

---

### Task 3: Миграция базы данных v2→v3

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/migrations/index.ts`
- Modify: `src/db/models/Book.ts`

- [ ] **Step 1: Добавить колонки в схему БД**

В `src/db/schema.ts` изменить `version: 2` → `version: 3` и добавить в таблицу `books` две новые колонки после `last_position`:

```typescript
{ name: 'total_chapters', type: 'number', isOptional: true },
{ name: 'content_version', type: 'number', isOptional: true },
```

`isOptional: true` — чтобы существующие записи не ломались (у них будет `null`).

- [ ] **Step 2: Добавить миграцию v2→v3**

В `src/db/migrations/index.ts` добавить вторую миграцию в массив `migrations`:

```typescript
{
  toVersion: 3,
  steps: [
    addColumns({
      table: 'books',
      columns: [
        { name: 'total_chapters', type: 'number', isOptional: true },
        { name: 'content_version', type: 'number', isOptional: true },
      ],
    }),
  ],
},
```

- [ ] **Step 3: Добавить поля в модель Book**

В `src/db/models/Book.ts` добавить два поля после `lastPosition`:

```typescript
@field('total_chapters') totalChapters!: number | null
@field('content_version') contentVersion!: number | null
```

- [ ] **Step 4: Проверить компиляцию**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Без ошибок

- [ ] **Step 5: Коммит**

```
git add src/db/schema.ts src/db/migrations/index.ts src/db/models/Book.ts
git commit -m "feat: add totalChapters and contentVersion to Book model (DB v3)"
```

---

## Chunk 2: FB2 конвертер

### Task 4: Обновить Fb2Parser — рекурсивные children + linkType + parseAllBodies

**Files:**
- Modify: `src/services/parser/Fb2Parser.ts`

- [ ] **Step 1: Сделать `parseInlinesOrdered()` публичным и обновить для рекурсивных children**

В `src/services/parser/Fb2Parser.ts`:

**Сначала** изменить модификатор доступа метода с `private static` на `public static` (строка 146):
```typescript
// Было:
private static parseInlinesOrdered(nodes: Record<string, unknown>[]): Fb2Inline[]
// Стало:
static parseInlinesOrdered(nodes: Record<string, unknown>[]): Fb2Inline[]
```

Это необходимо, т.к. `fb2Converter.ts` (Task 5) и `convertFootnotes` вызывают `Fb2Parser.parseInlinesOrdered()` из внешнего файла.

**Затем** заменить обработку `emphasis` и `strong` (строки 152-165) — вместо `text: extractOrderedText(...)` вернуть `children: parseInlinesOrdered(...)`:

```typescript
if ('emphasis' in node) {
  const emChildren = (node.emphasis ?? []) as Record<string, unknown>[]
  inlines.push({
    type: 'emphasis',
    children: Fb2Parser.parseInlinesOrdered(emChildren),
  })
}
if ('strong' in node) {
  const strChildren = (node.strong ?? []) as Record<string, unknown>[]
  inlines.push({
    type: 'strong',
    children: Fb2Parser.parseInlinesOrdered(strChildren),
  })
}
```

Заменить обработку `a` (строки 166-174) — добавить `children` и `linkType`:

```typescript
if ('a' in node) {
  const attrs = (node[':@'] ?? {}) as Record<string, string>
  const linkChildren = (node.a ?? []) as Record<string, unknown>[]
  inlines.push({
    type: 'link',
    children: Fb2Parser.parseInlinesOrdered(linkChildren),
    href: attrs['@_href'] ?? attrs['@_l:href'] ?? '',
    linkType: attrs['@_type'] ?? undefined,
  })
}
```

**Важно:** `emphasis` и `strong` теперь имеют `children` вместо `text`. Это breaking change для `Fb2Renderer.tsx`, но Fb2Renderer уже обрабатывает `children` (строки 143-179), так что всё совместимо. Поле `text` у emphasis/strong больше не устанавливается.

- [ ] **Step 2: Добавить метод `parseAllBodies()`**

Добавить новый публичный статический метод в класс `Fb2Parser` (после `parseSectionsOnly`):

```typescript
/**
 * Извлекает все <body> элементы — основной контент и сноски.
 * Для FB2 конвертера, который должен обработать и основной body, и body name="notes".
 */
static parseAllBodies(xml: string): {
  mainBody: Record<string, unknown>[]
  notesBodies: Record<string, unknown>[][]
} {
  const orderedDoc = bodyParser.parse(xml)
  const fbNode = orderedDoc.find((n: Record<string, unknown>) => 'FictionBook' in n)
  const fbChildren = fbNode?.FictionBook ?? []

  const allBodies = fbChildren.filter((n: Record<string, unknown>) => 'body' in n)

  const mainBody: Record<string, unknown>[] = []
  const notesBodies: Record<string, unknown>[][] = []

  for (const bodyNode of allBodies) {
    const attrs = (bodyNode[':@'] ?? {}) as Record<string, string>
    const children = (bodyNode.body ?? []) as Record<string, unknown>[]
    if (attrs['@_name'] === 'notes') {
      notesBodies.push(children)
    } else {
      mainBody.push(...children)
    }
  }

  return { mainBody, notesBodies }
}
```

- [ ] **Step 3: Проверить компиляцию**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Без ошибок

- [ ] **Step 4: Коммит**

```
git add src/services/parser/Fb2Parser.ts
git commit -m "feat: recursive children in parseInlinesOrdered, add linkType and parseAllBodies"
```

---

### Task 5: FB2 конвертер — fb2Converter.ts

**Files:**
- Create: `src/services/converter/fb2Converter.ts`

- [ ] **Step 1: Создать fb2Converter.ts**

```typescript
import { XMLParser } from 'fast-xml-parser'
import { Fb2Parser } from '../parser/Fb2Parser'
import { saveImage } from './chapterStorage'
import type {
  Fb2Section, Fb2Paragraph, Fb2Inline,
  BookChapter, ContentItem, InlineNode, BookFootnotes,
} from '../parser/types'

/** Результат конвертации FB2 */
export interface Fb2ConvertResult {
  chapters: BookChapter[]
  totalChapters: number
  title: string
  author: string
  coverBase64: string | null
  footnotes: BookFootnotes
}

/**
 * Конвертирует FB2 XML в BookChapter[].
 * @param xml — содержимое FB2 файла
 * @param bookId — ID книги для сохранения изображений
 * @param maxChapters — макс. число глав для конвертации (undefined = все)
 */
export async function convertFb2(
  xml: string,
  bookId: string,
  maxChapters?: number,
): Promise<Fb2ConvertResult> {
  // Полный парсинг для метаданных + бинарных данных
  const parsed = Fb2Parser.parse(xml)

  // Извлечь все body (основной + сноски)
  const { notesBodies } = Fb2Parser.parseAllBodies(xml)

  // Основные секции
  const sections = Fb2Parser.parseSectionsOnly(xml)

  // Извлечь изображения из binary-элементов
  await extractImages(xml, bookId)

  // Конвертировать секции в главы
  const allChapters = sectionsToChapters(sections)
  const totalChapters = allChapters.length

  // Ограничить если указано maxChapters
  const chapters = maxChapters != null
    ? allChapters.slice(0, maxChapters)
    : allChapters

  // Конвертировать сноски
  const footnotes = convertFootnotes(notesBodies)

  return {
    chapters,
    totalChapters,
    title: parsed.title,
    author: parsed.author,
    coverBase64: parsed.coverBase64,
    footnotes,
  }
}

/** Конвертирует секции FB2 в главы */
function sectionsToChapters(sections: Fb2Section[]): BookChapter[] {
  const chapters: BookChapter[] = []
  let pendingItems: ContentItem[] = []
  let chapterIndex = 0

  for (const section of sections) {
    if (section.title && pendingItems.length > 0) {
      chapters.push({ index: chapterIndex++, title: null, items: pendingItems })
      pendingItems = []
    }

    const items = sectionToContentItems(section)

    if (section.title) {
      chapters.push({ index: chapterIndex++, title: section.title, items })
    } else if (chapters.length > 0 && !section.title) {
      chapters[chapters.length - 1].items.push(...items)
    } else {
      pendingItems.push(...items)
    }
  }

  if (pendingItems.length > 0) {
    chapters.push({ index: chapterIndex++, title: null, items: pendingItems })
  }

  if (chapters.length === 0 && sections.length > 0) {
    const allItems = sections.flatMap(sectionToContentItems)
    chapters.push({ index: 0, title: null, items: allItems })
  }

  chapters.forEach((ch, i) => { ch.index = i })
  return chapters
}

/** Конвертирует одну секцию FB2 в массив ContentItem */
function sectionToContentItems(section: Fb2Section): ContentItem[] {
  const items: ContentItem[] = []

  if (section.title) {
    items.push({
      type: 'heading',
      level: 2,
      inlines: [{ type: 'text', text: section.title }],
    })
  }

  for (const para of section.paragraphs) {
    items.push(...paragraphToContentItems(para))
  }

  return items
}

/** Конвертирует один Fb2Paragraph в ContentItem(s) */
function paragraphToContentItems(para: Fb2Paragraph): ContentItem[] {
  switch (para.type) {
    case 'empty-line':
      return [{ type: 'separator' }]

    case 'subtitle':
      return [{
        type: 'heading',
        level: 3,
        inlines: mapInlines(para.children),
      }]

    case 'epigraph':
    case 'poem':
    case 'stanza':
    case 'v':
      return [{
        type: 'paragraph',
        inlines: mapInlines(para.children),
        style: { italic: true },
      }]

    case 'cite':
      return [{
        type: 'blockquote',
        inlines: mapInlines(para.children),
      }]

    case 'title':
      return [{
        type: 'heading',
        level: 2,
        inlines: mapInlines(para.children),
      }]

    default:
      return [{
        type: 'paragraph',
        inlines: mapInlines(para.children),
      }]
  }
}

/** Маппит Fb2Inline[] → InlineNode[] */
function mapInlines(inlines: Fb2Inline[]): InlineNode[] {
  const result: InlineNode[] = []

  for (const inline of inlines) {
    switch (inline.type) {
      case 'text':
        if (inline.text) {
          result.push({ type: 'text', text: inline.text })
        }
        break

      case 'emphasis':
        if (inline.children && inline.children.length > 0) {
          result.push({ type: 'italic', children: mapInlines(inline.children) })
        }
        break

      case 'strong':
        if (inline.children && inline.children.length > 0) {
          result.push({ type: 'bold', children: mapInlines(inline.children) })
        }
        break

      case 'link':
        if (inline.linkType === 'note' && inline.href) {
          const id = inline.href.replace('#', '')
          const label = inline.children
            ? extractText(inline.children)
            : inline.text ?? id
          result.push({ type: 'footnote-ref', id, label })
        } else if (inline.children && inline.children.length > 0) {
          result.push({
            type: 'link',
            href: inline.href ?? '',
            children: mapInlines(inline.children),
          })
        }
        break

      case 'image':
        break
    }
  }

  return result
}

/** Извлечь текст из Fb2Inline[] (рекурсивно) */
function extractText(inlines: Fb2Inline[]): string {
  return inlines
    .map((i) => i.text ?? (i.children ? extractText(i.children) : ''))
    .join('')
}

/** Извлечь binary-изображения из FB2 XML и сохранить как файлы.
 *  Использует отдельный экземпляр XMLParser (не preserveOrder) для доступа к бинарным данным. */
async function extractImages(xml: string, bookId: string): Promise<void> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    isArray: (name: string) => name === 'binary',
  })
  const doc = parser.parse(xml)
  const fb = doc.FictionBook
  if (!fb) return

  const binaries = fb.binary as Array<Record<string, string>> | undefined
  if (!binaries) return

  for (const bin of binaries) {
    const id = bin['@_id']
    const contentType = bin['@_content-type'] ?? 'image/jpeg'
    const base64 = bin['#text']
    if (!id || !base64) continue

    const ext = contentType.includes('png') ? '.png'
      : contentType.includes('gif') ? '.gif'
      : '.jpg'
    const cleanBase64 = base64.replace(/\s/g, '')
    await saveImage(bookId, `${id}${ext}`, cleanBase64)
  }
}

/** Конвертирует body name="notes" в BookFootnotes.
 *  Использует parseInlinesOrdered + mapInlines для поддержки форматирования внутри сносок
 *  (курсив, жирный, ссылки и т.д.) */
function convertFootnotes(notesBodies: Record<string, unknown>[][]): BookFootnotes {
  const footnotes: BookFootnotes = {}

  for (const body of notesBodies) {
    for (const node of body) {
      if ('section' in node) {
        const children = (node.section ?? []) as Record<string, unknown>[]
        const attrs = (node[':@'] ?? {}) as Record<string, string>
        const sectionId = attrs['@_id'] ?? ''

        const inlines: InlineNode[] = []
        for (const child of children) {
          // Пропускаем title в сносках — обычно содержит номер сноски,
          // который уже отображается в footnote-ref
          if ('title' in child) continue

          if ('p' in child) {
            const pChildren = (child.p ?? []) as Record<string, unknown>[]
            // Используем Fb2Parser.parseInlinesOrdered для поддержки
            // вложенного форматирования (emphasis, strong, links)
            const fb2Inlines = Fb2Parser.parseInlinesOrdered(pChildren)
            inlines.push(...mapInlines(fb2Inlines))
          }
        }

        if (sectionId && inlines.length > 0) {
          footnotes[sectionId] = inlines
        }
      }
    }
  }

  return footnotes
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Без ошибок

- [ ] **Step 3: Коммит**

```
git add src/services/converter/fb2Converter.ts
git commit -m "feat: add fb2Converter — FB2 XML to BookChapter[] conversion"
```

---

## Chunk 3: UnifiedRenderer

### Task 6: Создать UnifiedRenderer.tsx

**Files:**
- Create: `src/components/reader/UnifiedRenderer.tsx`

Основан на `src/components/reader/Fb2Renderer.tsx` (312 строк), но рендерит `ContentItem` вместо `Fb2Paragraph`. Утилиты `tokenizeIntoWords` и `extractSentence` переиспользуются из `Fb2Renderer.tsx` (они экспортированы).

- [ ] **Step 1: Создать UnifiedRenderer.tsx**

Файл содержит:
- `UnifiedItemRenderer` — главный экспортируемый компонент, рендерит один `ContentItem`
- `renderInlines()` — рекурсивный рендер `InlineNode[]` с передачей контекста стилей
- `extractInlineText()` / `extractItemText()` — извлечение текста для sentence extraction
- Переиспользует `tokenizeIntoWords` из `./Fb2Renderer`
- Переиспользует `WordTappable` из `./WordTappable`

Пропсы `UnifiedRendererProps`:
```typescript
interface UnifiedRendererProps {
  item: ContentItem
  onWordTap: (word: string, sentence: string) => void
  wordColors: Map<string, WordStatusValue>
  fontSize?: number
  lineHeight?: number
  fontFamily?: string
  textColor?: string
  backgroundColor?: string
  footnotes?: BookFootnotes
  onFootnotePress?: (id: string) => void
}
```

Маппинг ContentItem → нативный компонент:
- `heading` → `<Text>` с fontSize + addSize, bold, paddingVertical
- `paragraph` → `<YStack><XStack flexWrap>` с InlineRenderer → WordTappable. Поддержка style.italic, style.textAlign, style.indent
- `image` → `<Image>` с aspectRatio из width/height
- `blockquote` → `<YStack borderLeftWidth={3}>` с рекурсивным рендером nestedItems
- `list` → `<YStack>` с маркерами "1. " / "• " + InlineRenderer для каждого пункта
- `table-row` → `<XStack>` с разделителями " | " между ячейками
- `separator` → `<YStack height="$2" />`
- `footnote-ref` → `<Text onPress>` с color="#6c63ff"
- `sup`/`sub` → `<Text fontSize={fontSize * 0.7}>`

InlineContext передаёт накопленные стили вниз по рекурсии:
```typescript
interface InlineContext {
  bold?: 'bold'
  italic?: 'italic'
  textColor: string
  fontSize: number
  fontFamily?: string
}
```

MAX_INLINE_DEPTH = 20 для защиты от патологического EPUB.

Полный код: см. `src/components/reader/UnifiedRenderer.tsx` (будет создан агентом-исполнителем по спецификации выше с использованием паттернов из `Fb2Renderer.tsx`).

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Без ошибок

- [ ] **Step 3: Коммит**

```
git add src/components/reader/UnifiedRenderer.tsx
git commit -m "feat: add UnifiedRenderer for ContentItem rendering"
```

---

## Chunk 4: useChapterLoader + UnifiedReader

### Task 7: Хук useChapterLoader

**Files:**
- Create: `src/hooks/useChapterLoader.ts`

- [ ] **Step 1: Создать useChapterLoader.ts**

Экспортирует:
```typescript
/** Колбэк для on-the-fly конвертации ещё не сконвертированных глав */
type ConvertChapterFn = (chapterIndex: number) => Promise<BookChapter>

interface ChapterRange {
  chapter: number
  startIndex: number    // индекс в объединённом массиве items
  endIndex: number      // не включительно
  charOffset: number    // общее число символов до этой главы
}

interface UseChapterLoaderResult {
  items: ContentItem[]
  chapterRanges: ChapterRange[]
  loading: boolean
  footnotes: BookFootnotes
  currentChapter: number
  totalChapters: number
  loadChapterByIndex: (index: number) => Promise<void>
}

/**
 * @param bookId — ID книги
 * @param initialChapter — начальная глава
 * @param totalChapters — общее число глав
 * @param convertChapter — колбэк для on-the-fly конвертации, когда JSON главы ещё не существует.
 *   Вызывается из UnifiedReader, который знает формат и путь к исходному файлу книги.
 */
function useChapterLoader(
  bookId: string,
  initialChapter: number,
  totalChapters: number,
  convertChapter?: ConvertChapterFn,
): UseChapterLoaderResult
```

Внутренняя логика:
- `loadedChapters = useRef<Map<number, BookChapter>>()` — кэш загруженных глав
- `rebuildItems()` — пересобирает `items[]` и `chapterRanges[]` из loadedChapters, сортируя по номеру главы. Вызывает `resolveImagePaths()` для каждой главы.
- `loadChapterByIndex(index)` — сначала пытается загрузить из JSON (`chapterExists()` + `loadChapter()`). Если JSON не существует и передан `convertChapter` — вызывает его, сохраняет результат через `saveChapters()`, затем `rebuildItems()`. Это обеспечивает on-the-fly конвертацию глав, которые ещё не были сконвертированы (пользователь долистал до конца сконвертированного диапазона, а фоновая конвертация не успела).
- `useEffect` на маунт — загружает initialChapter + ±1 соседних + footnotes.json
- `countItemChars(item)` / `countInlineChars(nodes)` — подсчёт символов для charOffset

Полный код: см. `src/hooks/useChapterLoader.ts` (будет создан агентом по спецификации выше).

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Коммит**

```
git add src/hooks/useChapterLoader.ts
git commit -m "feat: add useChapterLoader hook for lazy chapter loading"
```

---

### Task 8: UnifiedReader.tsx

**Files:**
- Create: `src/components/reader/UnifiedReader.tsx`

Основан на `Fb2Reader.tsx` (639 строк). Ключевые отличия:
- Не принимает `xml` — загружает JSON-главы через `useChapterLoader`
- Рендерит `ContentItem` через `UnifiedItemRenderer` вместо `Fb2ItemRenderer`
- Позиция: `{ chapter, charOffset }` вместо `{ index }`
- Предзагрузка следующей главы при приближении к концу текущей

- [ ] **Step 1: Создать UnifiedReader.tsx**

Пропсы:
```typescript
interface UnifiedReaderProps {
  book: Book
  bookLanguage: string
  nativeLanguage: string
}
```

Компонент включает:
- `useChapterLoader(book.id, initialChapter, totalChapters)` для загрузки контента
- Ту же логику пагинации и замера из `Fb2Reader.tsx` (MeasureContainer, chunked measurement, page building)
- `handleViewableItemsChanged` — отслеживание видимых слов + предзагрузка следующей главы (когда пользователь в последних 20% загруженного диапазона)
- Позиция сохраняется как `{ chapter, charOffset }` (debounced 1500ms)
- `extractWordsFromInlines()` / `extractWordsFromItem()` — извлечение слов для `useWordStatusBatch`
- Те же UI элементы: ReaderTopBar, TranslationPopup, ReaderSettingsSheet
- Те же режимы: scroll (FlashList) и paginated (горизонтальный FlatList)

Полный код: см. `src/components/reader/UnifiedReader.tsx` (будет создан агентом по паттернам из `Fb2Reader.tsx`).

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Коммит**

```
git add src/components/reader/UnifiedReader.tsx
git commit -m "feat: add UnifiedReader component with chapter-based loading"
```

---

### Task 9: Компонент отображения сносок (FootnoteSheet)

**Files:**
- Create: `src/components/reader/FootnoteSheet.tsx`

Спецификация (раздел «Отображение сносок»): при нажатии на `footnote-ref` → показать bottom sheet с содержимым сноски из `footnotes[id]`.

- [ ] **Step 1: Создать FootnoteSheet.tsx**

Простой компонент на основе React Native `Modal` (без дополнительных зависимостей):

```typescript
import React from 'react'
import { Modal, Pressable } from 'react-native'
import { YStack, XStack, Text, ScrollView } from 'tamagui'
import type { InlineNode } from '../../services/parser/types'

interface FootnoteSheetProps {
  visible: boolean
  footnoteId: string | null
  content: InlineNode[] | null
  onClose: () => void
  textColor: string
  backgroundColor: string
  fontSize: number
}

export const FootnoteSheet: React.FC<FootnoteSheetProps> = ({
  visible, footnoteId, content, onClose,
  textColor, backgroundColor, fontSize,
}) => {
  if (!content) return null

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <YStack flex={1} justifyContent="flex-end">
          <YStack
            backgroundColor={backgroundColor}
            borderTopLeftRadius="$4"
            borderTopRightRadius="$4"
            padding="$4"
            maxHeight="40%"
            borderTopWidth={1}
            borderTopColor={textColor + '20'}
          >
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
              <Text color={textColor} fontSize={fontSize - 2} opacity={0.6}>
                {footnoteId}
              </Text>
              <Pressable onPress={onClose}>
                <Text color={textColor} fontSize={fontSize}>✕</Text>
              </Pressable>
            </XStack>
            <ScrollView>
              {/* Рендер InlineNode[] через renderInlines из UnifiedRenderer */}
              {/* Передаётся как renderContent проп или рендерится inline */}
            </ScrollView>
          </YStack>
        </YStack>
      </Pressable>
    </Modal>
  )
}
```

**Интеграция:** В `UnifiedReader.tsx` добавить состояние `footnoteId`, `showFootnote`, и передать `onFootnotePress` в `UnifiedItemRenderer`. При нажатии на `footnote-ref` — найти содержимое в `footnotes[id]` из `useChapterLoader`, показать `<FootnoteSheet>`.

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Коммит**

```
git add src/components/reader/FootnoteSheet.tsx
git commit -m "feat: add FootnoteSheet component for footnote display"
```

---

## Chunk 5: EPUB конвертер

### Task 10: HTML Entities маппинг

**Files:**
- Create: `src/services/converter/htmlEntities.ts`

- [ ] **Step 1: Создать htmlEntities.ts**

Статический маппинг HTML-сущностей — Latin-1 Supplement (192-255), типографика, стрелки, пробелы:

```typescript
/** Маппинг HTML-сущностей → Unicode-кодпоинты.
 *  Включает: Latin-1 Supplement (160-255), типографику, стрелки, пробелы, символы. */
export const HTML_ENTITIES: Record<string, number> = {
  // Latin-1 Supplement: символы (160-191)
  nbsp: 160, iexcl: 161, cent: 162, pound: 163, curren: 164,
  yen: 165, brvbar: 166, sect: 167, uml: 168, copy: 169,
  ordf: 170, laquo: 171, not: 172, shy: 173, reg: 174,
  macr: 175, deg: 176, plusmn: 177, sup2: 178, sup3: 179,
  acute: 180, micro: 181, para: 182, middot: 183, cedil: 184,
  sup1: 185, ordm: 186, raquo: 187, frac14: 188, frac12: 189,
  frac34: 190, iquest: 191,

  // Latin-1 Supplement: буквы (192-255) — критичны для EPUB на европейских языках
  Agrave: 192, Aacute: 193, Acirc: 194, Atilde: 195, Auml: 196,
  Aring: 197, AElig: 198, Ccedil: 199, Egrave: 200, Eacute: 201,
  Ecirc: 202, Euml: 203, Igrave: 204, Iacute: 205, Icirc: 206,
  Iuml: 207, ETH: 208, Ntilde: 209, Ograve: 210, Oacute: 211,
  Ocirc: 212, Otilde: 213, Ouml: 214, times: 215, Oslash: 216,
  Ugrave: 217, Uacute: 218, Ucirc: 219, Uuml: 220, Yacute: 221,
  THORN: 222, szlig: 223,
  agrave: 224, aacute: 225, acirc: 226, atilde: 227, auml: 228,
  aring: 229, aelig: 230, ccedil: 231, egrave: 232, eacute: 233,
  ecirc: 234, euml: 235, igrave: 236, iacute: 237, icirc: 238,
  iuml: 239, eth: 240, ntilde: 241, ograve: 242, oacute: 243,
  ocirc: 244, otilde: 245, ouml: 246, divide: 247, oslash: 248,
  ugrave: 249, uacute: 250, ucirc: 251, uuml: 252, yacute: 253,
  thorn: 254, yuml: 255,

  // Типографика
  ndash: 8211, mdash: 8212, lsquo: 8216, rsquo: 8217,
  sbquo: 8218, ldquo: 8220, rdquo: 8221, bdquo: 8222,
  dagger: 8224, Dagger: 8225, bull: 8226, hellip: 8230,
  permil: 8240, prime: 8242, Prime: 8243,
  lsaquo: 8249, rsaquo: 8250, oline: 8254, frasl: 8260,
  euro: 8364, trade: 8482,

  // Математические и стрелки
  minus: 8722, lowast: 8727, radic: 8730, infin: 8734,
  larr: 8592, uarr: 8593, rarr: 8594, darr: 8595,

  // Пробелы и невидимые символы
  ensp: 8194, emsp: 8195, thinsp: 8201, zwnj: 8204, zwj: 8205,
  lrm: 8206, rlm: 8207,

  // Греческие (частые в научных EPUB)
  Alpha: 913, Beta: 914, Gamma: 915, Delta: 916, Epsilon: 917,
  Zeta: 918, Eta: 919, Theta: 920, Iota: 921, Kappa: 922,
  Lambda: 923, Mu: 924, Nu: 925, Xi: 926, Omicron: 927,
  Pi: 928, Rho: 929, Sigma: 931, Tau: 932, Upsilon: 933,
  Phi: 934, Chi: 935, Psi: 936, Omega: 937,
  alpha: 945, beta: 946, gamma: 947, delta: 948, epsilon: 949,
  zeta: 950, eta: 951, theta: 952, iota: 953, kappa: 954,
  lambda: 955, mu: 956, nu: 957, xi: 958, omicron: 959,
  pi: 960, rho: 961, sigmaf: 962, sigma: 963, tau: 964,
  upsilon: 965, phi: 966, chi: 967, psi: 968, omega: 969,
}
```

- [ ] **Step 2: Коммит**

```
git add src/services/converter/htmlEntities.ts
git commit -m "feat: add HTML entities mapping for EPUB sanitization"
```

---

### Task 11: EPUB конвертер — epubConverter.ts

**Files:**
- Create: `src/services/converter/epubConverter.ts`

- [ ] **Step 1: Создать epubConverter.ts**

Экспортирует:
```typescript
interface EpubConvertResult {
  chapters: BookChapter[]
  totalChapters: number
  title: string
  author: string
  coverBase64: string | null
  footnotes: BookFootnotes
}

async function convertEpub(epubPath: string, bookId: string, maxChapters?: number): Promise<EpubConvertResult>
```

Пайплайн:
1. Распаковать EPUB через JSZip (уже есть в зависимостях)
2. Прочитать `META-INF/container.xml` → найти OPF путь
3. Прочитать OPF → spine (порядок глав) + manifest (ресурсы)
4. Прочитать оглавление:
   - **EPUB 2**: `toc.ncx` (найти через manifest item с `@_media-type="application/x-dtbncx+xml"`)
   - **EPUB 3**: `nav.xhtml` (найти через manifest item с `@_properties="nav"`) → парсить `<nav epub:type="toc">` → извлечь `<li><a href="...">Title</a></li>`
   - Приоритет: `nav.xhtml` → `toc.ncx` (EPUB 3 может содержать оба)
   - Результат: маппинг spine-item href → title для `BookChapter.title`
5. Для каждой главы из spine:
   a. Прочитать XHTML из ZIP
   b. `sanitizeXhtml()` — удалить DOCTYPE, заменить HTML-сущности через `HTML_ENTITIES`, закрыть void-теги, удалить script/style
   c. Парсить через `fast-xml-parser` (preserveOrder: true)
   d. `htmlToContentItems()` — рекурсивный обход DOM → ContentItem[]
   e. Извлечь referenced изображения из ZIP → сохранить как файлы
6. Извлечь обложку (та же логика что в `BookImporter.extractEpubMetadata`)

`htmlToContentItems()` — маппинг HTML-элементов:
- `p` → paragraph
- `h1`-`h6` → heading с соответствующим level
- `img` → image (src из атрибутов)
- `blockquote` → blockquote с nestedItems (рекурсия)
- `ol`/`ul` → list (ordered/unordered)
- `hr` → separator
- `table` → table-row (по одному на `<tr>`)
- `div`/`section`/`article`/`aside`/`header`/`footer` → прозрачные контейнеры (рекурсия)

`parseInlines()` — маппинг инлайнов:
- `#text` → text (если не пустой)
- `em`/`i` → italic с children
- `strong`/`b` → bold с children
- `a` → link с href + children
- `sup`/`sub` → sup/sub с children
- `span` → прозрачный (раскрываем children)
- `br` → text с '\n'

Откат при ошибке парсинга главы: `[Глава N не может быть отображена]`

Полный код: см. `src/services/converter/epubConverter.ts` (будет создан агентом по спецификации).

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Коммит**

```
git add src/services/converter/epubConverter.ts
git commit -m "feat: add epubConverter — EPUB to BookChapter[] conversion"
```

---

## Chunk 6: Интеграция (BookImporter + [bookId].tsx)

### Task 12: Обновить BookImporter — интеграция конвертеров

**Files:**
- Modify: `src/services/library/BookImporter.ts`

- [ ] **Step 1: Добавить импорты и константу версии**

В начало файла `BookImporter.ts`, после существующих импортов добавить:

```typescript
import { convertFb2 } from '../converter/fb2Converter'
import { convertEpub } from '../converter/epubConverter'
import { ensureBookDirs, saveChapters, saveFootnotes, sourcePath } from '../converter/chapterStorage'
import { InteractionManager } from 'react-native'

const CURRENT_CONTENT_VERSION = 1
```

- [ ] **Step 2: Обновить метод `importFile()`**

Ключевые изменения в `importFile()`:
1. Путь файла: `books/{bookId}/source.{ext}` вместо `books/{bookId}.{ext}`
2. Создать директории `chapters/` и `images/` через `ensureBookDirs(bookId)`
3. Вызвать `convertFb2()`/`convertEpub()`:
   - **Маленькие книги (< 10 глав):** конвертировать все главы сразу (без `maxChapters`). Определяется после первого прохода конвертера, который возвращает `totalChapters`.
   - **Большие книги (≥ 10 глав):** конвертировать первые 5 глав (`maxChapters: 5`), остальные — в фоне.
4. `record._raw.id = bookId` — чтобы ID книги в БД совпадал с именем директории
5. Добавить `record.totalChapters` и `record.contentVersion` в create
6. Запустить фоновую конвертацию оставшихся глав через `InteractionManager.runAfterInteractions` (только если `chapters.length < totalChapters`)

Удалить неиспользуемый импорт:
```typescript
// Удалить строку:
import { flattenSections, saveFb2Cache } from '../parser/fb2Cache';
```

- [ ] **Step 3: Проверить компиляцию**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Коммит**

```
git add src/services/library/BookImporter.ts
git commit -m "feat: integrate converters into BookImporter with progressive import"
```

---

### Task 13: Упростить [bookId].tsx

**Files:**
- Modify: `app/reader/[bookId].tsx`

- [ ] **Step 1: Заменить содержимое [bookId].tsx**

Ключевые изменения:
1. Убрать импорты `Fb2Reader` и `EpubReader`
2. Убрать `useState` для `content` (XML больше не нужен)
3. Добавить проверку `chapterExists(book.id, 0)` — если нет, запустить миграцию
4. Миграция:
   - `convertFb2()`/`convertEpub()` первых 5 глав (или всех, если < 10 глав)
   - Обновить `totalChapters` и `contentVersion` в БД
   - **Сбросить `lastPosition`** на `''` (пустую строку), т.к. старый формат позиции (`{"index": N}` для FB2, `epubcfi(...)` для EPUB) несовместим с новым `{"chapter": N, "charOffset": M}`. Пользователь потеряет закладку один раз при миграции (см. спецификацию, раздел «Формат позиции»)
5. Единственный рендер: `<UnifiedReader book={book} ... />`

- [ ] **Step 2: Добавить ключ перевода `reader.preparingBook`**

В файлы `src/i18n/locales/`:
- `en.json`: добавить `"preparingBook": "Preparing book..."` в секцию `"reader"`
- `ru.json`: добавить `"preparingBook": "Подготовка книги..."` в секцию `"reader"`
- `pl.json`: добавить `"preparingBook": "Przygotowanie książki..."` в секцию `"reader"`
- `uk.json`: добавить `"preparingBook": "Підготовка книги..."` в секцию `"reader"`

- [ ] **Step 3: Проверить компиляцию**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Коммит**

```
git add app/reader/[bookId].tsx src/i18n/locales/
git commit -m "feat: simplify [bookId].tsx to single UnifiedReader with auto-migration"
```

---

## Chunk 7: Очистка и верификация

### Task 14: Извлечь tokenizeIntoWords в утилиту и удалить устаревший код

**Files:**
- Create: `src/utils/textTokenizer.ts`
- Modify: `src/components/reader/UnifiedRenderer.tsx` (обновить импорт)
- Delete: `src/components/reader/EpubReader.tsx`
- Delete: `src/components/reader/Fb2Reader.tsx`
- Delete: `src/components/reader/Fb2Renderer.tsx`
- Delete: `src/services/reader/epubBridgeScript.ts`
- Delete: `src/services/reader/useFileSystemLegacy.ts`
- Delete: `src/services/parser/fb2Cache.ts`
- Delete: `epubjs-react-native.d.ts` (файл деклараций типов, если существует)
- Modify: `package.json` (удалить зависимость `@epubjs-react-native`)

- [ ] **Step 1: Извлечь tokenizeIntoWords и extractSentence в утилиту**

Создать `src/utils/textTokenizer.ts` — перенести функции `tokenizeIntoWords()` и `extractSentence()` из `Fb2Renderer.tsx` (строки 14-75). Обновить импорт в `UnifiedRenderer.tsx`:

```typescript
// src/utils/textTokenizer.ts
// Перенести tokenizeIntoWords и extractSentence из Fb2Renderer.tsx
```

- [ ] **Step 2: Обновить импорт в UnifiedRenderer.tsx**

```typescript
// Было:
import { tokenizeIntoWords, extractSentence } from './Fb2Renderer'
// Стало:
import { tokenizeIntoWords, extractSentence } from '../../utils/textTokenizer'
```

- [ ] **Step 3: Удалить устаревшие файлы**

```bash
rm src/components/reader/EpubReader.tsx
rm src/components/reader/Fb2Reader.tsx
rm src/components/reader/Fb2Renderer.tsx
rm src/services/reader/epubBridgeScript.ts
rm src/services/reader/useFileSystemLegacy.ts
rm src/services/parser/fb2Cache.ts
```

- [ ] **Step 4: Удалить зависимость @epubjs-react-native**

```bash
npm uninstall @epubjs-react-native
```

Также удалить `epubjs-react-native.d.ts` из корня проекта (если существует).

- [ ] **Step 5: Удалить все broken imports удалённых файлов**

Проверить: `BookImporter.ts`, `[bookId].tsx`, любые другие файлы — убрать import если остались.

- [ ] **Step 6: Проверить компиляцию**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Без ошибок. Если ошибки — исправить broken imports.

- [ ] **Step 7: Коммит**

```
git add -A
git commit -m "refactor: extract textTokenizer, remove deprecated readers and epubjs dependency"
```

---

### Task 15: Верификация — проверить линтинг и сборку

- [ ] **Step 1: Запустить линтер**

Run: `npx expo lint 2>&1 | tail -30`
Expected: Без критических ошибок.

- [ ] **Step 2: Проверить TypeScript компиляцию**

Run: `npx tsc --noEmit 2>&1`
Expected: Без ошибок

- [ ] **Step 3: Итоговый коммит (если были исправления)**

```
git add -A
git commit -m "fix: address lint and type errors from unified reader implementation"
```

---

## Chunk 8: Тесты

### Task 16: Тесты конвертеров и хранилища глав

**Files:**
- Create: `src/services/converter/fb2Converter.test.ts`
- Create: `src/services/converter/epubConverter.test.ts`
- Create: `src/services/converter/chapterStorage.test.ts`
- Create: `src/utils/textTokenizer.test.ts`

- [ ] **Step 1: Тесты fb2Converter**

Создать `src/services/converter/fb2Converter.test.ts`:

```typescript
import { convertFb2 } from './fb2Converter'

// Минимальный FB2 XML для тестирования
const MINIMAL_FB2 = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <author><first-name>Тест</first-name><last-name>Автор</last-name></author>
      <book-title>Тестовая книга</book-title>
    </title-info>
  </description>
  <body>
    <section>
      <title><p>Глава 1</p></title>
      <p>Текст первой главы.</p>
      <p><emphasis>Курсив</emphasis> и <strong>жирный</strong>.</p>
    </section>
    <section>
      <title><p>Глава 2</p></title>
      <p>Текст второй главы.</p>
    </section>
  </body>
</FictionBook>`

describe('convertFb2', () => {
  it('должен разбить на главы по секциям с заголовками', async () => {
    const result = await convertFb2(MINIMAL_FB2, 'test-book')
    expect(result.totalChapters).toBe(2)
    expect(result.chapters).toHaveLength(2)
    expect(result.chapters[0].title).toBe('Глава 1')
    expect(result.chapters[1].title).toBe('Глава 2')
  })

  it('должен конвертировать параграфы с инлайновым форматированием', async () => {
    const result = await convertFb2(MINIMAL_FB2, 'test-book')
    const ch1 = result.chapters[0]
    const para = ch1.items.find(i => i.type === 'paragraph' && i.inlines.length > 1)
    expect(para).toBeDefined()
    // Проверяем наличие italic и bold InlineNode
    if (para && para.type === 'paragraph') {
      const italic = para.inlines.find(i => i.type === 'italic')
      const bold = para.inlines.find(i => i.type === 'bold')
      expect(italic).toBeDefined()
      expect(bold).toBeDefined()
    }
  })

  it('должен ограничивать число глав через maxChapters', async () => {
    const result = await convertFb2(MINIMAL_FB2, 'test-book', 1)
    expect(result.chapters).toHaveLength(1)
    expect(result.totalChapters).toBe(2)
  })

  it('должен извлекать метаданные', async () => {
    const result = await convertFb2(MINIMAL_FB2, 'test-book')
    expect(result.title).toBe('Тестовая книга')
    expect(result.author).toContain('Автор')
  })
})
```

- [ ] **Step 2: Тесты chapterStorage**

Создать `src/services/converter/chapterStorage.test.ts`:

```typescript
import { resolveImagePaths } from './chapterStorage'
import type { BookChapter } from '../parser/types'

describe('resolveImagePaths', () => {
  it('должен заменить относительные пути изображений на абсолютные', () => {
    const chapter: BookChapter = {
      index: 0,
      title: 'Test',
      items: [
        { type: 'image', src: 'images/test.jpg' },
        { type: 'paragraph', inlines: [{ type: 'text', text: 'hello' }] },
      ],
    }
    const resolved = resolveImagePaths(chapter, 'book1')
    const img = resolved.items[0]
    expect(img.type).toBe('image')
    if (img.type === 'image') {
      expect(img.src).toContain('books/book1/images/test.jpg')
    }
  })

  it('должен обрабатывать изображения в nestedItems blockquote', () => {
    const chapter: BookChapter = {
      index: 0,
      title: 'Test',
      items: [
        {
          type: 'blockquote',
          inlines: [],
          nestedItems: [
            { type: 'image', src: 'images/nested.png' },
          ],
        },
      ],
    }
    const resolved = resolveImagePaths(chapter, 'book1')
    const bq = resolved.items[0]
    if (bq.type === 'blockquote' && bq.nestedItems) {
      const img = bq.nestedItems[0]
      if (img.type === 'image') {
        expect(img.src).toContain('books/book1/images/nested.png')
      }
    }
  })
})
```

- [ ] **Step 3: Тесты textTokenizer**

Создать `src/utils/textTokenizer.test.ts` — перенести/адаптировать существующие тесты из `Fb2Renderer`:

```typescript
import { tokenizeIntoWords, extractSentence } from './textTokenizer'

describe('tokenizeIntoWords', () => {
  it('должен разбить текст на слова и пробелы', () => {
    const tokens = tokenizeIntoWords('Hello world!')
    expect(tokens.length).toBeGreaterThanOrEqual(3)
    expect(tokens[0].word).toBe('Hello')
  })
})

describe('extractSentence', () => {
  it('должен извлечь предложение содержащее слово', () => {
    const text = 'First sentence. Second sentence here. Third.'
    const sentence = extractSentence(text, 'Second')
    expect(sentence).toContain('Second')
  })
})
```

- [ ] **Step 4: Запустить тесты**

Run: `npx jest --testPathPattern="(fb2Converter|chapterStorage|textTokenizer)" --verbose 2>&1 | tail -30`
Expected: Все тесты проходят.

- [ ] **Step 5: Коммит**

```
git add src/services/converter/fb2Converter.test.ts src/services/converter/chapterStorage.test.ts src/utils/textTokenizer.test.ts
git commit -m "test: add tests for fb2Converter, chapterStorage, textTokenizer"
```
