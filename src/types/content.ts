export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'italic'; children: InlineNode[] }
  | { type: 'link'; href: string; children: InlineNode[] }
  | { type: 'sup'; children: InlineNode[] }
  | { type: 'sub'; children: InlineNode[] }
  | { type: 'footnote-ref'; id: string; label: string };

export interface ParagraphStyle {
  textAlign?: 'left' | 'center' | 'right';
  indent?: boolean;
  italic?: boolean;
}

/**
 * Блочный элемент контента.
 *
 * Поля для разрешения:
 * - `heading.id`: anchor для оглавления (TOC) и для EPUB `#fragment` ссылок.
 *   Заполняется парсерами в #3 (например, slug из заголовка).
 * - `image.aspectRatio`: высоту в момент парсинга мы не всегда знаем (EPUB,
 *   удалённые изображения), но aspect-ratio часто доступен — используется в #4
 *   чтобы избежать layout-jank. Если неизвестен — рендерится плейсхолдер
 *   фиксированной высоты, описанный в #4.
 * - `list.items: ContentItem[][]` — каждый item списка может содержать
 *   подбоки (вложенные списки, параграфы внутри пункта).
 * - `blockquote.items`: всегда блоки. Inline-цитаты заворачиваются парсером в
 *   `paragraph` внутри `blockquote.items`. Это убирает двойную репрезентацию.
 */
export type ContentItem =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; id?: string; inlines: InlineNode[] }
  | { type: 'paragraph'; inlines: InlineNode[]; style?: ParagraphStyle }
  | { type: 'image'; src: string; alt?: string; width?: number; height?: number; aspectRatio?: number }
  | { type: 'blockquote'; items: ContentItem[] }
  | { type: 'list'; ordered: boolean; items: ContentItem[][] }
  | { type: 'separator' }
  | { type: 'table-row'; cells: InlineNode[][] };

export interface BookChapter {
  index: number;
  title: string | null;
  items: ContentItem[];
  /**
   * Per-chapter override языка чтения (например, EPUB `xml:lang` на section).
   * Если `null` — используется `Book.language` (книги-метаданные в #2).
   */
  lang?: string | null;
}

/**
 * Сноски на уровне книги. В отличие от inline-нод, тело сноски может содержать
 * несколько параграфов (EPUB), поэтому значение — массив блоков `ContentItem[]`.
 */
export interface BookFootnotes {
  [id: string]: ContentItem[];
}

/**
 * Максимальная глубина вложенности `InlineNode.children`.
 *
 * Контракт: парсеры (#3) обязаны обрезать вложенность на этой глубине,
 * сохраняя текстовый контент через flatten. Рендерер (#4) полагается на
 * этот контракт и не имеет защиты от patalogical EPUB.
 */
export const MAX_INLINE_DEPTH = 20;
