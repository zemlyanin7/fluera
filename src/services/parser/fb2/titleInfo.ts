// FB2 <description>/<title-info> → metadata (title, author, lang, cover).
// См. spec §6.1, §6.3.
import type { Document as XmlDocument, Element as XmlElement } from '@xmldom/xmldom';
import { SUPPORTED_BOOK_LANGUAGES, type BookLanguage } from '@/types/settings';

export interface Fb2TitleInfo {
  title: string;
  author: string | null;
  language: BookLanguage | null;
  coverId: string | null;
}

function textOf(el: XmlElement | null): string {
  return (el?.textContent ?? '').trim();
}

function firstByTag(parent: XmlElement | XmlDocument, tag: string): XmlElement | null {
  const list = (parent as XmlElement).getElementsByTagName?.(tag);
  return list && list.length > 0 ? (list[0] ?? null) : null;
}

export function parseTitleInfo(doc: XmlDocument): Fb2TitleInfo {
  const root = doc.documentElement;
  if (!root) return { title: 'Untitled', author: null, language: null, coverId: null };
  const ti = firstByTag(root, 'title-info');
  if (!ti) return { title: 'Untitled', author: null, language: null, coverId: null };

  const title = textOf(firstByTag(ti, 'book-title')) || 'Untitled';

  const authorEl = firstByTag(ti, 'author');
  let author: string | null = null;
  if (authorEl) {
    const fn = textOf(firstByTag(authorEl, 'first-name'));
    const ln = textOf(firstByTag(authorEl, 'last-name'));
    author = [fn, ln].filter(Boolean).join(' ') || null;
  }

  const langRaw = textOf(firstByTag(ti, 'lang')).toLowerCase();
  const language = (SUPPORTED_BOOK_LANGUAGES as readonly string[]).includes(langRaw)
    ? (langRaw as BookLanguage)
    : null;

  const coverEl = firstByTag(ti, 'coverpage');
  let coverId: string | null = null;
  if (coverEl) {
    const img = firstByTag(coverEl, 'image');
    const href =
      img?.getAttribute('l:href') ??
      img?.getAttributeNS?.('http://www.w3.org/1999/xlink', 'href') ??
      '';
    coverId = href.startsWith('#') ? href.slice(1) : (href || null);
  }

  return { title, author, language, coverId };
}
