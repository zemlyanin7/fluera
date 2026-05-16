// FB2 <body> → BookChapter[]. См. spec §6.2, §6.3.
import type {
  Document as XmlDocument,
  Element as XmlElement,
  Node as XmlNode,
} from '@xmldom/xmldom';
import type { BookChapter, ContentItem, InlineNode } from '@/types/content';
import { ParserError } from '../types';
import { appendInlineSafe } from '../shared/flattenInline';
import { sanitizeImageId } from '../shared/sanitizeImageId';

function findMainBody(doc: XmlDocument): XmlElement | null {
  const bodies = doc.getElementsByTagName('body');
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (b && !b.getAttribute('name')) return b;
  }
  return null;
}

function getXlinkHref(el: XmlElement): string {
  return (
    el.getAttribute('l:href') ??
    el.getAttributeNS?.('http://www.w3.org/1999/xlink', 'href') ??
    el.getAttribute('xlink:href') ??
    ''
  );
}

function parseInline(node: XmlNode, depth: number): InlineNode[] {
  if (node.nodeType === 3) {
    const text = node.nodeValue ?? '';
    return text.length > 0 ? [{ type: 'text', text }] : [];
  }
  if (node.nodeType !== 1) return [];
  const el = node as XmlElement;
  const tag = el.tagName.toLowerCase();
  const childInlines: InlineNode[] = [];
  const collect = () => {
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i];
      if (!child) continue;
      for (const inl of parseInline(child, depth + 1)) {
        appendInlineSafe(childInlines, inl, depth);
      }
    }
  };
  switch (tag) {
    case 'emphasis':
      collect();
      return [{ type: 'italic', children: childInlines }];
    case 'strong':
      collect();
      return [{ type: 'bold', children: childInlines }];
    case 'sup':
      collect();
      return [{ type: 'sup', children: childInlines }];
    case 'sub':
      collect();
      return [{ type: 'sub', children: childInlines }];
    case 'a': {
      const type = el.getAttribute('type');
      const href = getXlinkHref(el);
      collect();
      if (type === 'note' && href.startsWith('#')) {
        const label =
          childInlines.length > 0 && childInlines[0]?.type === 'text'
            ? (childInlines[0] as { type: 'text'; text: string }).text
            : '';
        return [{ type: 'footnote-ref', id: href.slice(1), label }];
      }
      return [{ type: 'link', href, children: childInlines }];
    }
    default:
      collect();
      return childInlines;
  }
}

function inlinesOf(el: XmlElement, depth: number): InlineNode[] {
  const out: InlineNode[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (!child) continue;
    for (const inl of parseInline(child, depth + 1)) {
      appendInlineSafe(out, inl, depth);
    }
  }
  return out;
}

function extractHeadingText(titleEl: XmlElement): InlineNode[] {
  const ps = titleEl.getElementsByTagName('p');
  if (ps.length === 0) return inlinesOf(titleEl, 0);
  const first = ps[0];
  return first ? inlinesOf(first, 0) : [];
}

function parseSection(section: XmlElement, level: number, items: ContentItem[]): void {
  const clampedLevel = Math.min(6, level) as 1 | 2 | 3 | 4 | 5 | 6;
  for (let i = 0; i < section.childNodes.length; i++) {
    const child = section.childNodes[i];
    if (!child || child.nodeType !== 1) continue;
    const el = child as XmlElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'title') {
      items.push({ type: 'heading', level: clampedLevel, inlines: extractHeadingText(el) });
    } else if (tag === 'p') {
      items.push({ type: 'paragraph', inlines: inlinesOf(el, 0) });
    } else if (tag === 'subtitle') {
      items.push({ type: 'heading', level: 3, inlines: inlinesOf(el, 0) });
    } else if (tag === 'empty-line') {
      items.push({ type: 'separator' });
    } else if (tag === 'image') {
      const href = getXlinkHref(el);
      const id = href.startsWith('#') ? href.slice(1) : href;
      if (id) items.push({ type: 'image', src: sanitizeImageId(id) });
    } else if (tag === 'section') {
      parseSection(el, level + 1, items);
    } else if (tag === 'cite') {
      const sub: ContentItem[] = [];
      parseSection(el, level, sub);
      items.push({ type: 'blockquote', items: sub });
    } else if (tag === 'epigraph' || tag === 'poem' || tag === 'stanza') {
      const sub: ContentItem[] = [];
      parseSection(el, level, sub);
      for (const s of sub) {
        if (s.type === 'paragraph') {
          items.push({ ...s, style: { ...(s.style ?? {}), italic: true } });
        } else {
          items.push(s);
        }
      }
    } else if (tag === 'v') {
      items.push({ type: 'paragraph', inlines: inlinesOf(el, 0), style: { italic: true } });
    }
  }
}

export function parseChapters(doc: XmlDocument): BookChapter[] {
  const body = findMainBody(doc);
  if (!body) throw new ParserError('FB2_NO_BODY', 'FB2 без <body>');

  const topSections: XmlElement[] = [];
  for (let i = 0; i < body.childNodes.length; i++) {
    const child = body.childNodes[i];
    if (child && child.nodeType === 1 && (child as XmlElement).tagName.toLowerCase() === 'section') {
      topSections.push(child as XmlElement);
    }
  }

  if (topSections.length === 0) {
    const items: ContentItem[] = [];
    parseSection(body, 1, items);
    return [{ index: 0, title: null, items }];
  }

  return topSections.map((section, index): BookChapter => {
    const items: ContentItem[] = [];
    parseSection(section, 1, items);
    const firstHeading = items.find((i) => i.type === 'heading');
    let title: string | null = null;
    if (firstHeading?.type === 'heading') {
      title =
        firstHeading.inlines
          .filter((n) => n.type === 'text')
          .map((n) => (n.type === 'text' ? n.text : ''))
          .join('') || null;
    }
    return { index, title, items };
  });
}
