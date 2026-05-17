// EPUB OPF (content.opf) → metadata + manifest + spine. См. spec §5.3.
import { DOMParser } from '@xmldom/xmldom';
import { ParserError } from '../types';

export interface OpfData {
  metadata: {
    title: string | null;
    creator: string | null;
    language: string | null;
    coverId: string | null;
  };
  manifest: Record<string, string>;
  /** mediaType по id — для извлечения images */
  manifestMime: Record<string, string>;
  spine: string[];
  /** Папка OPF — для resolveHref */
  opfDir: string;
}

function textOfFirst(parent: Element, tag: string): string | null {
  const items = parent.getElementsByTagName(tag);
  if (items.length === 0) return null;
  const first = items[0];
  return ((first?.textContent ?? '').trim()) || null;
}

export function parseOpf(opfXml: string, opfPath: string): OpfData {
  const doc = new DOMParser({
    onError: (level, msg) => {
      if (level === 'fatalError') throw new Error(msg);
    },
  }).parseFromString(opfXml, 'text/xml');

  const pkg = doc.documentElement;
  if (!pkg) throw new ParserError('EPUB_NO_OPF', 'OPF пустой');

  const metaEls = pkg.getElementsByTagName('metadata');
  const metaEl = metaEls.length > 0 ? metaEls[0] : null;
  if (!metaEl) throw new ParserError('EPUB_NO_OPF', 'OPF без <metadata>');

  const title = textOfFirst(metaEl as unknown as Element, 'dc:title')
    ?? textOfFirst(metaEl as unknown as Element, 'title')
    ?? 'Untitled';
  const creator = textOfFirst(metaEl as unknown as Element, 'dc:creator')
    ?? textOfFirst(metaEl as unknown as Element, 'creator');
  const language = textOfFirst(metaEl as unknown as Element, 'dc:language')
    ?? textOfFirst(metaEl as unknown as Element, 'language');

  const manifestEls = pkg.getElementsByTagName('manifest');
  const manifestEl = manifestEls.length > 0 ? manifestEls[0] : null;
  if (!manifestEl) throw new ParserError('EPUB_NO_OPF', 'OPF без <manifest>');

  const manifest: Record<string, string> = {};
  const manifestMime: Record<string, string> = {};
  let epub3CoverId: string | null = null;
  const items = manifestEl.getElementsByTagName('item');
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    const mime = item.getAttribute('media-type') ?? '';
    const props = item.getAttribute('properties') ?? '';
    if (id && href) {
      manifest[id] = href;
      manifestMime[id] = mime;
      if (props.split(/\s+/).includes('cover-image')) epub3CoverId = id;
    }
  }

  let coverId: string | null = epub3CoverId;
  if (!coverId) {
    const metas = metaEl.getElementsByTagName('meta');
    for (let i = 0; i < metas.length; i++) {
      const m = metas[i];
      if (m?.getAttribute('name') === 'cover') {
        coverId = m.getAttribute('content');
        break;
      }
    }
  }

  const spineEls = pkg.getElementsByTagName('spine');
  const spineEl = spineEls.length > 0 ? spineEls[0] : null;
  if (!spineEl) throw new ParserError('EPUB_NO_SPINE', 'OPF без <spine>');
  const refs = spineEl.getElementsByTagName('itemref');
  const spine: string[] = [];
  for (let i = 0; i < refs.length; i++) {
    const idref = refs[i]?.getAttribute('idref');
    if (idref) spine.push(idref);
  }
  if (spine.length === 0) throw new ParserError('EPUB_NO_SPINE', 'Spine пуст');

  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';

  return {
    metadata: { title, creator, language, coverId },
    manifest,
    manifestMime,
    spine,
    opfDir,
  };
}

export function resolveOpfHref(opfDir: string, href: string): string {
  if (opfDir === '') return href;
  return `${opfDir}/${href}`;
}
