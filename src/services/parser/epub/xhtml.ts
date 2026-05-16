// EPUB XHTML body → ContentItem[]. См. spec §5.4.
import {
  DOMParser,
  type Element as XmlElement,
  type Node as XmlNode,
} from '@xmldom/xmldom';
import type { ContentItem, InlineNode } from '@/types/content';
import { appendInlineSafe } from '../shared/flattenInline';
import { sanitizeImageId } from '../shared/sanitizeImageId';
import { assertSafeXmlPermissive } from '@/services/xml/safeParser';

const DROP_TAGS = new Set(['script', 'style', 'head', 'title', 'meta', 'link', 'svg']);
const TRANSPARENT_TAGS = new Set([
  'div', 'section', 'article', 'span', 'nav', 'aside', 'header', 'footer',
]);

function parseInline(node: XmlNode, depth: number): InlineNode[] {
  if (node.nodeType === 3) {
    const text = node.nodeValue ?? '';
    return text.length > 0 ? [{ type: 'text', text }] : [];
  }
  if (node.nodeType !== 1) return [];
  const el = node as XmlElement;
  const tag = el.tagName.toLowerCase();
  if (DROP_TAGS.has(tag)) return [];
  if (tag === 'br') return [{ type: 'text', text: '\n' }];

  const childInlines: InlineNode[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const c = el.childNodes[i];
    if (!c) continue;
    for (const inl of parseInline(c, depth + 1)) {
      appendInlineSafe(childInlines, inl, depth);
    }
  }
  switch (tag) {
    case 'em':
    case 'i':
      return [{ type: 'italic', children: childInlines }];
    case 'strong':
    case 'b':
      return [{ type: 'bold', children: childInlines }];
    case 'sup':
      return [{ type: 'sup', children: childInlines }];
    case 'sub':
      return [{ type: 'sub', children: childInlines }];
    case 'a': {
      const href = el.getAttribute('href') ?? '';
      return [{ type: 'link', href, children: childInlines }];
    }
    default:
      return childInlines;
  }
}

function inlinesOf(el: XmlElement, depth: number): InlineNode[] {
  const out: InlineNode[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const c = el.childNodes[i];
    if (!c) continue;
    for (const inl of parseInline(c, depth + 1)) {
      appendInlineSafe(out, inl, depth);
    }
  }
  return out;
}

function parseBlocks(parent: XmlElement, out: ContentItem[]): void {
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i];
    if (!child || child.nodeType !== 1) continue;
    const el = child as XmlElement;
    const tag = el.tagName.toLowerCase();
    if (DROP_TAGS.has(tag)) continue;
    if (TRANSPARENT_TAGS.has(tag)) {
      parseBlocks(el, out);
      continue;
    }
    if (/^h[1-6]$/.test(tag)) {
      const lvl = parseInt(tag[1] ?? '1', 10);
      const level = (Math.max(1, Math.min(6, lvl)) as 1 | 2 | 3 | 4 | 5 | 6);
      const id = el.getAttribute('id') ?? undefined;
      const inlines = inlinesOf(el, 0);
      out.push(id ? { type: 'heading', level, id, inlines } : { type: 'heading', level, inlines });
    } else if (tag === 'p') {
      // EPUB иногда заворачивает <img> в <p> для центрирования. Выбираем
      // img-ы отдельным image-блоком; оставшийся text — paragraph.
      const imgs = el.getElementsByTagName('img');
      for (let j = 0; j < imgs.length; j++) {
        const img = imgs[j];
        if (!img) continue;
        const src = img.getAttribute('src') ?? '';
        const alt = img.getAttribute('alt') ?? undefined;
        if (src) {
          const last = src.split('/').pop() ?? src;
          out.push({ type: 'image', src: sanitizeImageId(last), alt });
        }
      }
      const inlines = inlinesOf(el, 0);
      if (inlines.length > 0) {
        const hasText = inlines.some(
          (n) => n.type === 'text' && n.text.trim().length > 0,
        );
        if (hasText) out.push({ type: 'paragraph', inlines });
      }
    } else if (tag === 'hr') {
      out.push({ type: 'separator' });
    } else if (tag === 'img') {
      const src = el.getAttribute('src') ?? '';
      const alt = el.getAttribute('alt') ?? undefined;
      if (src) {
        const last = src.split('/').pop() ?? src;
        out.push({ type: 'image', src: sanitizeImageId(last), alt });
      }
    } else if (tag === 'blockquote') {
      const items: ContentItem[] = [];
      parseBlocks(el, items);
      out.push({ type: 'blockquote', items });
    } else if (tag === 'ul' || tag === 'ol') {
      const liItems: ContentItem[][] = [];
      const lis = el.getElementsByTagName('li');
      for (let j = 0; j < lis.length; j++) {
        const li = lis[j];
        if (!li) continue;
        const sub: ContentItem[] = [];
        parseBlocks(li, sub);
        if (sub.length === 0) sub.push({ type: 'paragraph', inlines: inlinesOf(li, 0) });
        liItems.push(sub);
      }
      out.push({ type: 'list', ordered: tag === 'ol', items: liItems });
    } else if (tag === 'table') {
      const trs = el.getElementsByTagName('tr');
      for (let j = 0; j < trs.length; j++) {
        const tr = trs[j];
        if (!tr) continue;
        const tds = tr.getElementsByTagName('td');
        const cells: InlineNode[][] = [];
        for (let k = 0; k < tds.length; k++) {
          const td = tds[k];
          if (td) cells.push(inlinesOf(td, 0));
        }
        if (cells.length > 0) out.push({ type: 'table-row', cells });
      }
    }
  }
}

export function parseXhtmlBody(xhtmlText: string): ContentItem[] {
  assertSafeXmlPermissive(xhtmlText);
  const doc = new DOMParser({
    onError: (level, msg) => {
      if (level === 'fatalError') throw new Error(msg);
    },
  }).parseFromString(xhtmlText, 'text/xml');
  const bodies = doc.getElementsByTagName('body');
  if (bodies.length === 0) return [];
  const body = bodies[0];
  if (!body) return [];
  const out: ContentItem[] = [];
  parseBlocks(body, out);
  return out;
}
