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
  linkType?: string  // 'note' для сносок FB2
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
