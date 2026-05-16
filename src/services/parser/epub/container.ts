// EPUB META-INF/container.xml → path до OPF файла. См. spec §5.2 шаг 4.
import { DOMParser } from '@xmldom/xmldom';
import { ParserError } from '../types';

export function findOpfPath(containerXml: string): string {
  const doc = new DOMParser({
    onError: (level, msg) => {
      if (level === 'fatalError') throw new Error(msg);
    },
  }).parseFromString(containerXml, 'text/xml');
  const roots = doc.getElementsByTagName('rootfile');
  if (roots.length === 0) {
    throw new ParserError('EPUB_BAD_CONTAINER', 'META-INF/container.xml без rootfile');
  }
  const first = roots[0];
  const fullPath = first?.getAttribute('full-path');
  if (!fullPath) throw new ParserError('EPUB_BAD_CONTAINER', 'rootfile без full-path');
  return fullPath;
}
