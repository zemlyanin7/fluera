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
  // Парсинг 1 (preserveOrder): секции + сноски — один вызов bodyParser
  const { mainBody, notesBodies } = Fb2Parser.parseAllBodies(xml)
  const sections = Fb2Parser.parseSectionsOrdered(mainBody)

  // Парсинг 2 (metaParser): метаданные + бинарные данные — один вызов
  const meta = Fb2Parser.parseMetadataOnly(xml)

  // Извлечь изображения из уже распарсенных бинарных данных (без повторного парсинга)
  await extractImagesFromBinaries(meta.binaries, bookId)

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
    title: meta.title,
    author: meta.author,
    coverBase64: meta.coverBase64,
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

/** Извлечь изображения из уже распарсенных binary-элементов (без повторного парсинга XML) */
async function extractImagesFromBinaries(
  binaries: Array<Record<string, string>> | undefined,
  bookId: string,
): Promise<void> {
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
 *  Использует parseInlinesOrdered + mapInlines для поддержки форматирования внутри сносок */
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
