import { XMLParser } from 'fast-xml-parser'
import type { Fb2Book, Fb2Section, Fb2Paragraph, Fb2Inline } from './types'

// Use a non-ordered parser for metadata extraction (simpler)
const metaParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => ['section', 'p', 'binary'].includes(name),
})

// Use preserveOrder parser for body content to maintain mixed content order
const bodyParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  preserveOrder: true,
})

// Tag names that map to FB2 paragraph-level types
const BLOCK_TAGS = new Set(['p', 'subtitle', 'epigraph', 'poem', 'stanza', 'v', 'cite', 'annotation', 'empty-line'])
const INLINE_TAGS = new Set(['emphasis', 'strong', 'a', 'image'])

export class Fb2Parser {
  static parse(xml: string): Fb2Book {
    const metaDoc = metaParser.parse(xml)
    const metaFb = metaDoc.FictionBook
    if (!metaFb) throw new Error('Invalid FB2: missing FictionBook root element')

    const titleInfo = metaFb.description?.['title-info']

    // Parse body with order-preserving parser for correct inline ordering
    const bodyChildren = Fb2Parser.parseBodyOrdered(xml)

    return {
      title: titleInfo?.['book-title'] ?? 'Untitled',
      author: Fb2Parser.parseAuthor(titleInfo?.author),
      lang: titleInfo?.lang ?? 'unknown',
      annotation: Fb2Parser.extractMetaText(titleInfo?.annotation?.p),
      coverBase64: Fb2Parser.findCover(metaFb),
      sections: Fb2Parser.parseSectionsOrdered(bodyChildren),
    }
  }

  /** Быстрый парсинг только метаданных (без body) — один вызов metaParser */
  static parseMetadataOnly(xml: string): {
    title: string; author: string; coverBase64: string | null;
    binaries: Array<Record<string, string>> | undefined;
  } {
    const metaDoc = metaParser.parse(xml)
    const metaFb = metaDoc.FictionBook
    if (!metaFb) return { title: 'Untitled', author: 'Unknown', coverBase64: null, binaries: undefined }

    const titleInfo = metaFb.description?.['title-info']
    return {
      title: titleInfo?.['book-title'] ?? 'Untitled',
      author: Fb2Parser.parseAuthor(titleInfo?.author),
      coverBase64: Fb2Parser.findCover(metaFb),
      binaries: metaFb.binary as Array<Record<string, string>> | undefined,
    }
  }

  /**
   * Fast path: parse only the body sections (single XML pass).
   * Use this in the reader where metadata is already available from the DB.
   */
  static parseSectionsOnly(xml: string): Fb2Section[] {
    const bodyChildren = Fb2Parser.parseBodyOrdered(xml)
    return Fb2Parser.parseSectionsOrdered(bodyChildren)
  }

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

  private static parseBodyOrdered(xml: string): Record<string, unknown>[] {
    const orderedDoc = bodyParser.parse(xml)
    const fbNode = orderedDoc.find((n: Record<string, unknown>) => 'FictionBook' in n)
    const fbChildren = fbNode?.FictionBook ?? []
    const bodyNode = fbChildren.find((n: Record<string, unknown>) => 'body' in n)
    return (bodyNode?.body ?? []) as Record<string, unknown>[]
  }

  private static parseAuthor(author: Record<string, string> | undefined): string {
    if (!author) return 'Unknown'
    const first = author['first-name'] ?? ''
    const last = author['last-name'] ?? ''
    return `${first} ${last}`.trim() || 'Unknown'
  }

  private static extractMetaText(node: unknown): string | null {
    if (!node) return null
    if (typeof node === 'string') return node
    if (Array.isArray(node)) return node.map(n => Fb2Parser.extractMetaText(n)).join(' ')
    if (typeof node === 'object' && node !== null && '#text' in node) {
      return (node as Record<string, string>)['#text']
    }
    return null
  }

  private static findCover(fb: Record<string, unknown>): string | null {
    const binaries = fb.binary as Record<string, string>[] | Record<string, string> | undefined
    if (!binaries) return null
    const arr = Array.isArray(binaries) ? binaries : [binaries]
    const coverBin = arr.find((b) => b['@_id']?.includes('cover'))
    return coverBin?.['#text'] ?? null
  }

  static parseSectionsOrdered(nodes: Record<string, unknown>[]): Fb2Section[] {
    const sections: Fb2Section[] = []

    // Parse direct block elements at this level (paragraphs outside sections)
    const directParagraphs = Fb2Parser.parseBlockElements(nodes)
    if (directParagraphs.length > 0) {
      sections.push({ title: null, paragraphs: directParagraphs })
    }

    for (const node of nodes) {
      if ('section' in node) {
        const children = (node.section ?? []) as Record<string, unknown>[]
        const titleNode = children.find((c) => 'title' in c)
        let title: string | null = null
        if (titleNode) {
          const titleChildren = (titleNode.title ?? []) as Record<string, unknown>[]
          const pNode = titleChildren.find((c) => 'p' in c)
          if (pNode) {
            title = Fb2Parser.extractOrderedText((pNode.p ?? []) as Record<string, unknown>[])
          }
        }

        // Parse block elements directly in this section (not in nested sections)
        const paragraphs = Fb2Parser.parseBlockElements(children)

        if (paragraphs.length > 0) {
          sections.push({ title, paragraphs })
        }

        // Recursively parse nested sections — filter to only section nodes
        // to avoid re-collecting the same block elements via parseBlockElements
        const nestedSectionNodes = children.filter(c => 'section' in c)
        if (nestedSectionNodes.length > 0) {
          const nestedSections = Fb2Parser.parseSectionsOrdered(nestedSectionNodes)
          sections.push(...nestedSections)
        }
      }
    }

    return sections
  }

  private static parseBlockElements(nodes: Record<string, unknown>[]): Fb2Paragraph[] {
    const paragraphs: Fb2Paragraph[] = []
    for (const node of nodes) {
      for (const tag of BLOCK_TAGS) {
        if (tag in node) {
          paragraphs.push({
            type: tag as Fb2Paragraph['type'],
            children: Fb2Parser.parseInlinesOrdered(
              (node[tag] ?? []) as Record<string, unknown>[]
            ),
          })
        }
      }
    }
    return paragraphs
  }

  static parseInlinesOrdered(nodes: Record<string, unknown>[]): Fb2Inline[] {
    const inlines: Fb2Inline[] = []
    for (const node of nodes) {
      if ('#text' in node) {
        inlines.push({ type: 'text', text: String(node['#text']) })
      }
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
      if ('image' in node) {
        const attrs = (node[':@'] ?? {}) as Record<string, string>
        inlines.push({
          type: 'image',
          imageId: attrs['@_l:href']?.replace('#', '') ?? '',
        })
      }
    }
    return inlines
  }

  private static extractOrderedText(nodes: Record<string, unknown>[]): string {
    return nodes
      .filter((n) => '#text' in n)
      .map((n) => String(n['#text']))
      .join('')
  }
}
