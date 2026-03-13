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
    const orderedDoc = bodyParser.parse(xml)
    const fbNode = orderedDoc.find((n: Record<string, unknown>) => 'FictionBook' in n)
    const fbChildren = fbNode?.FictionBook ?? []
    const bodyNode = fbChildren.find((n: Record<string, unknown>) => 'body' in n)
    const bodyChildren = bodyNode?.body ?? []

    return {
      title: titleInfo?.['book-title'] ?? 'Untitled',
      author: Fb2Parser.parseAuthor(titleInfo?.author),
      lang: titleInfo?.lang ?? 'unknown',
      annotation: Fb2Parser.extractMetaText(titleInfo?.annotation?.p),
      coverBase64: Fb2Parser.findCover(metaFb),
      sections: Fb2Parser.parseSectionsOrdered(bodyChildren),
    }
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

  private static parseSectionsOrdered(nodes: Record<string, unknown>[]): Fb2Section[] {
    return nodes
      .filter((n) => 'section' in n)
      .map((sectionNode) => {
        const children = (sectionNode.section ?? []) as Record<string, unknown>[]
        const titleNode = children.find((c) => 'title' in c)
        let title: string | null = null
        if (titleNode) {
          const titleChildren = (titleNode.title ?? []) as Record<string, unknown>[]
          const pNode = titleChildren.find((c) => 'p' in c)
          if (pNode) {
            title = Fb2Parser.extractOrderedText((pNode.p ?? []) as Record<string, unknown>[])
          }
        }
        return {
          title,
          paragraphs: Fb2Parser.parseBlockElements(children),
        }
      })
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

  private static parseInlinesOrdered(nodes: Record<string, unknown>[]): Fb2Inline[] {
    const inlines: Fb2Inline[] = []
    for (const node of nodes) {
      if ('#text' in node) {
        inlines.push({ type: 'text', text: String(node['#text']) })
      }
      if ('emphasis' in node) {
        const emChildren = (node.emphasis ?? []) as Record<string, unknown>[]
        inlines.push({
          type: 'emphasis',
          text: Fb2Parser.extractOrderedText(emChildren),
        })
      }
      if ('strong' in node) {
        const strChildren = (node.strong ?? []) as Record<string, unknown>[]
        inlines.push({
          type: 'strong',
          text: Fb2Parser.extractOrderedText(strChildren),
        })
      }
      if ('a' in node) {
        const attrs = (node[':@'] ?? {}) as Record<string, string>
        const linkChildren = (node.a ?? []) as Record<string, unknown>[]
        inlines.push({
          type: 'link',
          text: Fb2Parser.extractOrderedText(linkChildren),
          href: attrs['@_href'] ?? attrs['@_l:href'] ?? '',
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
