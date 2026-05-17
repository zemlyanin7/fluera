// FB2 <body name="notes"> → BookFootnotes (id → ContentItem[]). См. spec §6.1.
import type { Document as XmlDocument, Element as XmlElement } from '@xmldom/xmldom';
import type { BookFootnotes, ContentItem } from '@/types/content';
import { parseChapters } from './body';

function findNotesBody(doc: XmlDocument): XmlElement | null {
  const bodies = doc.getElementsByTagName('body');
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (b && b.getAttribute('name') === 'notes') return b;
  }
  return null;
}

export function parseFootnotes(doc: XmlDocument): BookFootnotes {
  const notesBody = findNotesBody(doc);
  if (!notesBody) return {};
  const result: BookFootnotes = {};
  const sections = notesBody.getElementsByTagName('section');
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    if (!sec) continue;
    const id = sec.getAttribute('id');
    if (!id) continue;
    // Создаём fake-doc с одной секцией для переиспользования parseChapters.
    const fakeDoc = doc.implementation.createDocument(null, 'FictionBook', null);
    const fakeBody = fakeDoc.createElement('body');
    const fakeSection = sec.cloneNode(true) as XmlElement;
    fakeBody.appendChild(fakeSection);
    fakeDoc.documentElement?.appendChild(fakeBody);
    const items: ContentItem[] = [];
    try {
      const chs = parseChapters(fakeDoc);
      if (chs.length > 0 && chs[0]) items.push(...chs[0].items);
    } catch {
      // skip broken note
    }
    result[id] = items;
  }
  return result;
}
