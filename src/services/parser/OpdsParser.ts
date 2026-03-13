import { XMLParser } from 'fast-xml-parser'
import type { OpdsCatalogData, OpdsEntry, OpdsLink } from './types'

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => ['entry', 'link'].includes(name),
})

interface OpdsRawLink {
  '@_rel'?: string
  '@_href'?: string
  '@_type'?: string
}

interface OpdsRawEntry {
  id?: string
  title?: string
  author?: { name?: string }
  summary?: string
  'dc:language'?: string
  link?: OpdsRawLink[]
  updated?: string
}

export class OpdsParser {
  static parse(xml: string): OpdsCatalogData {
    const doc = xmlParser.parse(xml)
    const feed = doc.feed
    if (!feed) throw new Error('Invalid OPDS: missing feed root element')

    const entries = ((feed.entry ?? []) as OpdsRawEntry[]).map(OpdsParser.parseEntry)
    const nextLink = OpdsParser.findNextLink((feed.link ?? []) as OpdsRawLink[])

    return {
      title: feed.title ?? 'Catalog',
      entries,
      nextUrl: nextLink,
    }
  }

  private static parseEntry(entry: OpdsRawEntry): OpdsEntry {
    const links: OpdsRawLink[] = entry.link ?? []
    const downloadLinks: OpdsLink[] = links
      .filter((l) => l['@_rel']?.includes('acquisition'))
      .map((l) => ({
        href: l['@_href'] ?? '',
        type: l['@_type'] ?? 'application/octet-stream',
        rel: l['@_rel'] ?? null,
      }))

    const coverLink = links.find(
      (l) => l['@_rel']?.includes('image') || l['@_rel']?.includes('thumbnail')
    )

    return {
      id: entry.id ?? '',
      title: entry.title ?? 'Untitled',
      author: entry.author?.name ?? null,
      summary: entry.summary ?? null,
      language: entry['dc:language'] ?? null,
      coverUrl: coverLink?.['@_href'] ?? null,
      downloadLinks,
      updated: entry.updated ?? null,
    }
  }

  private static findNextLink(links: OpdsRawLink[]): string | null {
    const next = links.find((l) => l['@_rel'] === 'next')
    return next?.['@_href'] ?? null
  }
}
