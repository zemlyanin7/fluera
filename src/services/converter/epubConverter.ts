import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'
import { saveImage } from './chapterStorage'
import { decodeHtmlEntities } from './htmlEntities'
import type { BookChapter, ContentItem, InlineNode, BookFootnotes } from '../parser/types'

// ─── Публичные типы ──────────────────────────────────────────────────────────

/** Результат конвертации EPUB */
export interface EpubConvertResult {
  chapters: BookChapter[]
  footnotes: BookFootnotes
  coverImageBase64: string | null
  title: string
  author: string
  language: string
}

// ─── Внутренние типы ─────────────────────────────────────────────────────────

/** Элемент манифеста EPUB */
interface ManifestItem {
  id: string
  href: string
  mediaType: string
  properties?: string
}

/** Упорядоченный элемент spine */
interface SpineItemRef {
  idref: string
  linear?: boolean
}

/** Распарсенные данные OPF */
interface OpfData {
  title: string
  author: string
  language: string
  manifest: Map<string, ManifestItem>
  spine: SpineItemRef[]
  tocId?: string
  coverItemId?: string
}

// ─── Парсеры ─────────────────────────────────────────────────────────────────

/** Создаёт XMLParser с preserveOrder для обхода HTML/XML с сохранением порядка */
function makeOrderedParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    preserveOrder: true,
    allowBooleanAttributes: true,
    parseAttributeValue: false,
  })
}

/** Создаёт XMLParser без preserveOrder для доступа по ключу */
function makeKeyedParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    isArray: (name) => ['item', 'itemref', 'navPoint', 'li'].includes(name),
    parseAttributeValue: false,
  })
}

// ─── Основная функция конвертации ─────────────────────────────────────────────

/**
 * Конвертирует EPUB ZIP в BookChapter[].
 * @param epubData — содержимое EPUB файла как ArrayBuffer
 * @param bookId — ID книги для сохранения изображений
 */
export async function convertEpub(
  epubData: ArrayBuffer,
  bookId: string,
): Promise<EpubConvertResult> {
  // 1. Открыть ZIP
  const zip = await JSZip.loadAsync(epubData)

  // 2. Найти rootfile через META-INF/container.xml
  const rootfilePath = await findRootfilePath(zip)
  if (!rootfilePath) {
    throw new Error('EPUB: не найден rootfile в META-INF/container.xml')
  }

  // Базовый путь OPF (для разрешения относительных путей)
  const opfBasePath = rootfilePath.includes('/')
    ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1)
    : ''

  // 3. Распарсить OPF
  const opfData = await parseOpf(zip, rootfilePath, opfBasePath)

  // 4. Построить карту TOC (имя файла → заголовок главы)
  const tocMap = await buildTocMap(zip, opfData)

  // 5. Извлечь изображения
  const coverBase64 = await extractImages(zip, opfData, bookId)

  // 6. Конвертировать главы
  const chapters = await convertChapters(zip, opfData, tocMap)

  return {
    chapters,
    footnotes: {},
    coverImageBase64: coverBase64,
    title: opfData.title,
    author: opfData.author,
    language: opfData.language,
  }
}

// ─── Шаг 2: Найти rootfile ────────────────────────────────────────────────────

/** Парсит META-INF/container.xml и возвращает путь к OPF rootfile */
async function findRootfilePath(zip: JSZip): Promise<string | null> {
  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) return null

  const xml = await containerFile.async('string')
  const parser = makeKeyedParser()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = parser.parse(xml) as any

  try {
    const container = doc?.container ?? doc?.['container']
    const rootfiles = container?.rootfiles?.rootfile
    if (Array.isArray(rootfiles) && rootfiles.length > 0) {
      return rootfiles[0]['@_full-path'] as string
    }
    if (rootfiles?.['@_full-path']) {
      return rootfiles['@_full-path'] as string
    }
  } catch {
    // Игнорируем ошибки парсинга
  }

  // Фолбэк: ищем full-path через регулярное выражение
  const fullPathMatch = /full-path="([^"]+)"/.exec(xml)
  return fullPathMatch ? fullPathMatch[1] : null
}

// ─── Шаг 3: Парсинг OPF ──────────────────────────────────────────────────────

/** Читает и парсит OPF файл, возвращает метаданные + манифест + spine */
async function parseOpf(zip: JSZip, rootfilePath: string, opfBasePath: string): Promise<OpfData> {
  const opfFile = zip.file(rootfilePath)
  if (!opfFile) {
    throw new Error(`EPUB: OPF файл не найден: ${rootfilePath}`)
  }

  const xml = await opfFile.async('string')
  const parser = makeKeyedParser()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = parser.parse(xml) as any

  // OPF может называться <package> с namespace
  const pkg = doc?.package ?? doc?.['opf:package'] ?? Object.values(doc)[0] ?? {}

  // --- Метаданные ---
  const meta = pkg?.metadata ?? pkg?.['opf:metadata'] ?? {}
  const title = extractMeta(meta, ['dc:title', 'title']) ?? 'Без названия'
  const author = extractMeta(meta, ['dc:creator', 'creator']) ?? 'Неизвестный автор'
  const language = extractMeta(meta, ['dc:language', 'language']) ?? 'en'

  // --- Манифест ---
  const manifestRaw = pkg?.manifest ?? pkg?.['opf:manifest'] ?? {}
  const items: ManifestItem[] = []
  const rawItems = Array.isArray(manifestRaw?.item) ? manifestRaw.item : []
  for (const item of rawItems) {
    const id = item['@_id'] as string | undefined
    const href = item['@_href'] as string | undefined
    const mediaType = item['@_media-type'] as string | undefined
    const properties = item['@_properties'] as string | undefined
    if (id && href) {
      items.push({
        id,
        href: opfBasePath + href,
        mediaType: mediaType ?? '',
        properties,
      })
    }
  }
  const manifest = new Map<string, ManifestItem>(items.map((i) => [i.id, i]))

  // --- Spine ---
  const spineRaw = pkg?.spine ?? pkg?.['opf:spine'] ?? {}
  const tocId = spineRaw['@_toc'] as string | undefined
  const rawItemrefs = Array.isArray(spineRaw?.itemref) ? spineRaw.itemref : []
  const spine: SpineItemRef[] = rawItemrefs.map((ref: Record<string, string>) => ({
    idref: ref['@_idref'],
    linear: ref['@_linear'] !== 'no',
  }))

  // --- Cover item ID ---
  const coverItemId = findCoverItemId(meta)

  return { title, author, language, manifest, spine, tocId, coverItemId }
}

/** Извлекает строковое значение мета-поля (с поддержкой нескольких вариантов имён) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMeta(meta: any, keys: string[]): string | null {
  for (const key of keys) {
    const val = meta?.[key]
    if (typeof val === 'string') return val.trim()
    if (Array.isArray(val) && val.length > 0) {
      const first = val[0]
      if (typeof first === 'string') return first.trim()
      if (typeof first === 'object' && '#text' in first) return String(first['#text']).trim()
    }
    if (typeof val === 'object' && val !== null && '#text' in val) {
      return String(val['#text']).trim()
    }
  }
  return null
}

/** Ищет ID элемента обложки в metadata (EPUB 2: meta name="cover") */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findCoverItemId(meta: any): string | undefined {
  const metaItems = meta?.meta
  const items = Array.isArray(metaItems) ? metaItems : metaItems ? [metaItems] : []
  for (const item of items) {
    if (item?.['@_name'] === 'cover' && item?.['@_content']) {
      return item['@_content'] as string
    }
  }
  return undefined
}

// ─── Шаг 4: Построение TOC ───────────────────────────────────────────────────

/** Строит карту: имя файла главы → заголовок главы */
async function buildTocMap(
  zip: JSZip,
  opfData: OpfData,
): Promise<Map<string, string>> {
  // Попытка 1: EPUB 3 nav document
  const navItem = Array.from(opfData.manifest.values()).find(
    (i) => i.properties?.includes('nav'),
  )
  if (navItem) {
    const navFile = zip.file(navItem.href)
    if (navFile) {
      const html = await navFile.async('string')
      const map = parseEpub3Nav(html)
      if (map.size > 0) return map
    }
  }

  // Попытка 2: EPUB 2 toc.ncx
  let ncxItem: ManifestItem | undefined
  if (opfData.tocId) {
    ncxItem = opfData.manifest.get(opfData.tocId)
  }
  if (!ncxItem) {
    ncxItem = Array.from(opfData.manifest.values()).find(
      (i) => i.mediaType === 'application/x-dtbncx+xml' || i.href.endsWith('.ncx'),
    )
  }
  if (ncxItem) {
    const ncxFile = zip.file(ncxItem.href)
    if (ncxFile) {
      const xml = await ncxFile.async('string')
      return parseNcx(xml)
    }
  }

  return new Map()
}

/** Парсит EPUB 3 nav document, возвращает Map<filename → title> */
function parseEpub3Nav(html: string): Map<string, string> {
  const map = new Map<string, string>()

  // Ищем <nav epub:type="toc"> ... </nav>
  const navMatch = /<nav[^>]*epub:type="toc"[^>]*>([\s\S]*?)<\/nav>/i.exec(html)
  if (!navMatch) return map

  const navContent = navMatch[1]

  // Ищем все <a href="...">...</a> внутри nav
  const linkPattern = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  let match = linkPattern.exec(navContent)
  while (match !== null) {
    const href = match[1].trim()
    const rawTitle = match[2].replace(/<[^>]+>/g, '').trim()
    const title = decodeHtmlEntities(rawTitle)
    if (href && title) {
      // Сохраняем только имя файла (без fragment)
      const hrefWithoutFragment = href.split('#')[0]
      const filename = hrefWithoutFragment.split('/').pop() ?? hrefWithoutFragment
      if (filename) map.set(filename, title)
    }
    match = linkPattern.exec(navContent)
  }

  return map
}

/** Парсит EPUB 2 toc.ncx, возвращает Map<filename → title> */
function parseNcx(xml: string): Map<string, string> {
  const map = new Map<string, string>()
  const parser = makeKeyedParser()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = parser.parse(xml) as any
  const ncx = doc?.ncx ?? doc?.['ncx:ncx'] ?? {}
  const navMap = ncx?.navMap ?? {}
  const navPoints = Array.isArray(navMap?.navPoint) ? navMap.navPoint : []

  function processNavPoints(points: unknown[]): void {
    for (const point of points) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = point as any
      const labelText = p?.navLabel?.text
      const src = p?.content?.['@_src'] as string | undefined
      const title = typeof labelText === 'string' ? labelText.trim() : ''
      if (src && title) {
        const srcWithoutFragment = src.split('#')[0]
        const filename = srcWithoutFragment.split('/').pop() ?? srcWithoutFragment
        if (filename) map.set(filename, title)
      }
      // Рекурсивно обрабатываем вложенные navPoint
      const nested = Array.isArray(p?.navPoint) ? p.navPoint : []
      if (nested.length > 0) processNavPoints(nested)
    }
  }

  processNavPoints(navPoints)
  return map
}

// ─── Шаг 5: Конвертация глав ─────────────────────────────────────────────────

/** Конвертирует spine в массив BookChapter[] */
async function convertChapters(
  zip: JSZip,
  opfData: OpfData,
  tocMap: Map<string, string>,
): Promise<BookChapter[]> {
  const chapters: BookChapter[] = []
  let chapterIndex = 0

  for (const spineItem of opfData.spine) {
    const manifestItem = opfData.manifest.get(spineItem.idref)
    if (!manifestItem) continue

    // Пропускаем не-HTML элементы (изображения, CSS и т.д.)
    if (
      manifestItem.mediaType !== 'application/xhtml+xml' &&
      manifestItem.mediaType !== 'text/html'
    ) continue

    const file = zip.file(manifestItem.href)
    if (!file) continue

    const html = await file.async('string')

    // Определяем заголовок из TOC map
    const filename = manifestItem.href.split('/').pop() ?? manifestItem.href
    const title = tocMap.get(filename) ?? null

    // Парсим HTML в ContentItem[]
    const items = parseHtmlToContentItems(html)

    // Пропускаем полностью пустые главы (навигационные страницы)
    if (items.length === 0) continue

    chapters.push({ index: chapterIndex++, title, items })
  }

  // Переиндексируем
  chapters.forEach((ch, i) => { ch.index = i })
  return chapters
}

// ─── Шаг 6: Извлечение изображений ───────────────────────────────────────────

/**
 * Извлекает все изображения из манифеста и сохраняет на диск.
 * Возвращает base64 обложки (если найдена).
 */
async function extractImages(
  zip: JSZip,
  opfData: OpfData,
  bookId: string,
): Promise<string | null> {
  let coverBase64: string | null = null

  // Определяем элемент обложки
  // EPUB 3: properties="cover-image"
  const coverByProperties = Array.from(opfData.manifest.values()).find(
    (i) => i.properties?.includes('cover-image'),
  )
  // EPUB 2: coverItemId из meta или id="cover-image"
  const coverById = opfData.coverItemId
    ? opfData.manifest.get(opfData.coverItemId)
    : opfData.manifest.get('cover-image')

  const coverItem = coverByProperties ?? coverById

  for (const item of opfData.manifest.values()) {
    if (!item.mediaType.startsWith('image/')) continue

    const file = zip.file(item.href)
    if (!file) continue

    const base64 = await file.async('base64')
    const filename = item.href.split('/').pop() ?? item.id
    await saveImage(bookId, filename, base64)

    // Сохраняем обложку
    if (coverItem && item.id === coverItem.id && coverBase64 === null) {
      coverBase64 = base64
    }
  }

  // Если обложка не найдена явно — берём первое изображение
  if (coverBase64 === null) {
    const firstImage = Array.from(opfData.manifest.values()).find(
      (i) => i.mediaType.startsWith('image/'),
    )
    if (firstImage) {
      const file = zip.file(firstImage.href)
      if (file) coverBase64 = await file.async('base64')
    }
  }

  return coverBase64
}

// ─── HTML → ContentItem[] ─────────────────────────────────────────────────────

/**
 * Парсит XHTML главы в массив ContentItem[].
 * Использует fast-xml-parser с preserveOrder: true.
 */
function parseHtmlToContentItems(html: string): ContentItem[] {
  const normalized = normalizeHtml(html)

  const parser = makeOrderedParser()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let doc: any[]
  try {
    doc = parser.parse(normalized) as unknown[]
  } catch {
    return []
  }

  // Найти <body> в дереве
  const bodyNodes = findBodyNodes(doc)
  return parseHtmlBlock(bodyNodes)
}

/** Нормализует HTML/XHTML для совместимого XML-парсинга */
function normalizeHtml(html: string): string {
  return html
    // Удаляем DOCTYPE
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    // Убираем XML declaration
    .replace(/<\?xml[^?]*\?>/gi, '')
    // Self-closing теги без /
    .replace(/<(br|hr|img|meta|link|input)(\s[^>]*)?>(?!\/)/gi, '<$1$2/>')
    // Заменяем неизвестные HTML-сущности через decodeHtmlEntities
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)(\w+);/g, (_, name: string) =>
      decodeHtmlEntities(`&${name};`),
    )
}

/** Находит дочерние узлы тега body в дереве с preserveOrder */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findBodyNodes(nodes: any[]): any[] {
  for (const node of nodes) {
    if ('html' in node) {
      const htmlChildren = node.html ?? []
      for (const child of htmlChildren) {
        if ('body' in child) return child.body ?? []
      }
      return findBodyNodes(htmlChildren)
    }
    if ('body' in node) return node.body ?? []
  }
  return nodes
}

/**
 * Рекурсивно парсит массив узлов в ContentItem[].
 * Обрабатывает блочные теги: заголовки, параграфы, списки, таблицы и т.д.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseHtmlBlock(nodes: any[]): ContentItem[] {
  const items: ContentItem[] = []

  for (const node of nodes) {
    if (typeof node === 'string') continue

    const keys = Object.keys(node).filter((k) => k !== ':@')
    if (keys.length === 0) continue
    const tag = keys[0]
    const children = node[tag] ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attrs = (node[':@'] ?? {}) as Record<string, any>

    switch (tag.toLowerCase()) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        const level = parseInt(tag[1], 10) as 1 | 2 | 3 | 4 | 5 | 6
        const inlines = parseHtmlInlines(children)
        if (inlines.length > 0) {
          items.push({ type: 'heading', level, inlines })
        }
        break
      }

      case 'p': {
        const inlines = parseHtmlInlines(children)
        if (inlines.length > 0) {
          items.push({ type: 'paragraph', inlines })
        }
        break
      }

      case 'blockquote': {
        const nested = parseHtmlBlock(children)
        if (nested.length === 1 && nested[0].type === 'paragraph') {
          // Разворачиваем одиночный параграф в blockquote с инлайнами
          items.push({ type: 'blockquote', inlines: nested[0].inlines })
        } else if (nested.length > 0) {
          items.push({ type: 'blockquote', inlines: [], nestedItems: nested })
        } else {
          const inlines = parseHtmlInlines(children)
          if (inlines.length > 0) {
            items.push({ type: 'blockquote', inlines })
          }
        }
        break
      }

      case 'ul':
      case 'ol': {
        const ordered = tag.toLowerCase() === 'ol'
        const listItems: InlineNode[][] = []
        for (const child of children) {
          if (typeof child !== 'object') continue
          const childKeys = Object.keys(child).filter((k) => k !== ':@')
          if (childKeys[0]?.toLowerCase() === 'li') {
            listItems.push(parseHtmlInlines(child[childKeys[0]] ?? []))
          }
        }
        if (listItems.length > 0) {
          items.push({ type: 'list', ordered, items: listItems })
        }
        break
      }

      case 'hr':
        items.push({ type: 'separator' })
        break

      case 'br':
        // br вне параграфа — пустой параграф
        items.push({ type: 'paragraph', inlines: [{ type: 'text', text: '' }] })
        break

      case 'img': {
        const src = (attrs['@_src'] ?? attrs['@_xlink:href'] ?? '') as string
        const alt = (attrs['@_alt'] ?? '') as string
        const widthAttr = attrs['@_width']
        const heightAttr = attrs['@_height']
        const width = widthAttr ? parseInt(widthAttr, 10) : undefined
        const height = heightAttr ? parseInt(heightAttr, 10) : undefined
        // Сохраняем только имя файла (без пути), т.к. изображения хранятся в images/
        const imgFilename = src.split('/').pop() ?? src
        if (imgFilename) {
          items.push({
            type: 'image',
            src: `images/${imgFilename}`,
            alt: alt || undefined,
            width: width !== undefined && !isNaN(width) ? width : undefined,
            height: height !== undefined && !isNaN(height) ? height : undefined,
          })
        }
        break
      }

      case 'table':
        items.push(...parseTableRows(children))
        break

      // Прозрачные контейнеры — рекурсируем в дочерние
      case 'div':
      case 'section':
      case 'article':
      case 'main':
      case 'header':
      case 'footer':
      case 'aside':
      case 'figure':
      case 'figcaption':
      case 'nav':
      case 'address':
        items.push(...parseHtmlBlock(children))
        break

      // Теги, которые игнорируем
      case 'head':
      case 'style':
      case 'script':
      case 'meta':
      case 'link':
      case 'title':
        break

      case '#text': {
        // Текст на верхнем уровне (вне параграфа) — оборачиваем если не пустой
        const rawText = node['#text']
        if (typeof rawText === 'string') {
          const text = decodeHtmlEntities(rawText).trim()
          if (text) {
            items.push({ type: 'paragraph', inlines: [{ type: 'text', text }] })
          }
        }
        break
      }

      default:
        // Неизвестные теги — пытаемся рекурсивно обработать дочерние
        if (Array.isArray(children) && children.length > 0) {
          items.push(...parseHtmlBlock(children))
        }
        break
    }
  }

  return items
}

/** Парсит строки таблицы в ContentItem[] */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTableRows(nodes: any[]): ContentItem[] {
  const items: ContentItem[] = []

  for (const node of nodes) {
    if (typeof node !== 'object') continue
    const keys = Object.keys(node).filter((k) => k !== ':@')
    const tag = keys[0]?.toLowerCase()

    if (tag === 'tr') {
      const cells: InlineNode[][] = []
      const rowChildren = node[keys[0]] ?? []
      for (const cell of rowChildren) {
        if (typeof cell !== 'object') continue
        const cellKeys = Object.keys(cell).filter((k) => k !== ':@')
        const cellTag = cellKeys[0]?.toLowerCase()
        if (cellTag === 'td' || cellTag === 'th') {
          cells.push(parseHtmlInlines(cell[cellKeys[0]] ?? []))
        }
      }
      if (cells.length > 0) {
        items.push({ type: 'table-row', cells })
      }
    } else if (tag === 'thead' || tag === 'tbody' || tag === 'tfoot') {
      items.push(...parseTableRows(node[keys[0]] ?? []))
    }
  }

  return items
}

// ─── Парсинг инлайн-элементов ─────────────────────────────────────────────────

/**
 * Рекурсивно парсит массив узлов в InlineNode[].
 * Обрабатывает инлайновые теги: b, strong, i, em, cite, a, sup, sub, span и #text.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseHtmlInlines(nodes: any[]): InlineNode[] {
  const result: InlineNode[] = []

  for (const node of nodes) {
    if (node === null || node === undefined) continue

    if (typeof node === 'string') {
      const text = decodeHtmlEntities(node)
      if (text) result.push({ type: 'text', text })
      continue
    }

    if (typeof node !== 'object') continue

    // Прямой текстовый узел в preserveOrder формате
    if ('#text' in node) {
      const raw = String(node['#text'])
      const text = decodeHtmlEntities(raw)
      if (text) result.push({ type: 'text', text })
      continue
    }

    const keys = Object.keys(node).filter((k) => k !== ':@')
    if (keys.length === 0) continue
    const tag = keys[0].toLowerCase()
    const children = node[keys[0]] ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attrs = (node[':@'] ?? {}) as Record<string, any>

    switch (tag) {
      case 'b':
      case 'strong': {
        const inner = parseHtmlInlines(children)
        if (inner.length > 0) result.push({ type: 'bold', children: inner })
        break
      }

      case 'i':
      case 'em':
      case 'cite': {
        const inner = parseHtmlInlines(children)
        if (inner.length > 0) result.push({ type: 'italic', children: inner })
        break
      }

      case 'a': {
        const href = (attrs['@_href'] ?? '') as string
        const inner = parseHtmlInlines(children)
        if (href.startsWith('#') || isFootnoteRef(href, attrs)) {
          // Ссылка-сноска
          const fragIndex = href.indexOf('#')
          const id = fragIndex !== -1 ? href.substring(fragIndex + 1) : href
          const label = extractInlineText(inner) || id
          if (id) result.push({ type: 'footnote-ref', id, label })
        } else {
          if (inner.length > 0) {
            result.push({ type: 'link', href, children: inner })
          } else {
            const text = decodeHtmlEntities(href)
            if (text) result.push({ type: 'link', href, children: [{ type: 'text', text }] })
          }
        }
        break
      }

      case 'sup': {
        const inner = parseHtmlInlines(children)
        if (inner.length > 0) result.push({ type: 'sup', children: inner })
        break
      }

      case 'sub': {
        const inner = parseHtmlInlines(children)
        if (inner.length > 0) result.push({ type: 'sub', children: inner })
        break
      }

      // Прозрачные инлайновые контейнеры
      case 'span':
      case 'abbr':
      case 'acronym':
      case 'dfn':
      case 'q':
      case 'samp':
      case 'code':
      case 'kbd':
      case 'var':
      case 'mark':
      case 'u':
      case 's':
      case 'del':
      case 'ins':
      case 'ruby':
      case 'rt':
      case 'rp':
      case 'bdi':
      case 'bdo':
      case 'wbr':
        result.push(...parseHtmlInlines(children))
        break

      case 'br':
        result.push({ type: 'text', text: '\n' })
        break

      // Блочные теги в инлайн-контексте — рекурсивно извлекаем содержимое
      case 'p':
      case 'div':
      case 'section':
      case 'blockquote':
        result.push(...parseHtmlInlines(children))
        break

      // Изображения в инлайн-контексте — пропускаем (обрабатываются блочным парсером)
      case 'img':
        break

      // Игнорируемые теги
      case 'script':
      case 'style':
        break

      default:
        // Неизвестные инлайновые теги — извлекаем содержимое
        result.push(...parseHtmlInlines(children))
        break
    }
  }

  return result
}

/** Проверяет, является ли ссылка ссылкой на сноску по epub:type или классу */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isFootnoteRef(href: string, attrs: Record<string, any>): boolean {
  const epubType = (attrs['@_epub:type'] ?? '') as string
  const className = (attrs['@_class'] ?? '') as string
  return (
    href.includes('#') ||
    epubType.includes('noteref') ||
    epubType.includes('footnote') ||
    className.includes('footnote') ||
    className.includes('noteref')
  )
}

/** Извлекает плоский текст из массива InlineNode[] */
function extractInlineText(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === 'text') return n.text
      if ('children' in n && n.children) return extractInlineText(n.children)
      return ''
    })
    .join('')
}
