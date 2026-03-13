export interface Fb2Book {
  title: string
  author: string
  lang: string
  annotation: string | null
  coverBase64: string | null
  sections: Fb2Section[]
}

export interface Fb2Section {
  title: string | null
  paragraphs: Fb2Paragraph[]
}

export interface Fb2Paragraph {
  type: 'p' | 'title' | 'subtitle' | 'epigraph' | 'poem' | 'stanza' | 'v' | 'cite' | 'annotation' | 'empty-line'
  children: Fb2Inline[]
}

export interface Fb2Inline {
  type: 'text' | 'emphasis' | 'strong' | 'link' | 'image'
  text?: string
  href?: string
  imageId?: string
  children?: Fb2Inline[]
}

export interface OpdsEntry {
  id: string
  title: string
  author: string | null
  summary: string | null
  language: string | null
  coverUrl: string | null
  downloadLinks: OpdsLink[]
  updated: string | null
}

export interface OpdsLink {
  href: string
  type: string
  rel: string | null
}

export interface OpdsCatalogData {
  title: string
  entries: OpdsEntry[]
  nextUrl: string | null
}
