// FB2 parser entry point. См. spec §6.
import { DOMParser, type Document as XmlDocument } from '@xmldom/xmldom';
import { assertSafeXml } from '@/services/xml/safeParser';
import { decodeBytes, detectXmlEncoding } from './shared/decodeEncoding';
import { countCharsInItems } from './shared/countChars';
import { parseTitleInfo } from './fb2/titleInfo';
import { parseChapters } from './fb2/body';
import { parseFootnotes } from './fb2/footnotes';
import { parseBinaries } from './fb2/binary';
import { ParserError, type IParser, type ParsedBook } from './types';

const MAX_FB2_FILE_SIZE = 50 * 1024 * 1024;

export class Fb2Parser implements IParser {
  async parse(bytes: Uint8Array): Promise<ParsedBook> {
    if (bytes.length > MAX_FB2_FILE_SIZE) {
      throw new ParserError(
        'FILE_TOO_LARGE',
        `FB2 размер ${bytes.length} > ${MAX_FB2_FILE_SIZE}`,
      );
    }
    const encoding = detectXmlEncoding(bytes);
    const xml = decodeBytes(bytes, encoding);
    try {
      assertSafeXml(xml);
    } catch (e) {
      throw new ParserError('XML_UNSAFE', (e as Error).message);
    }
    let doc: XmlDocument;
    try {
      doc = new DOMParser({
        onError: (level, msg) => {
          if (level === 'fatalError') throw new Error(msg);
        },
      }).parseFromString(xml, 'text/xml');
    } catch (e) {
      throw new ParserError('FB2_INVALID_XML', (e as Error).message);
    }
    const meta = parseTitleInfo(doc);
    const chapters = parseChapters(doc);
    const footnotes = parseFootnotes(doc);
    const images = parseBinaries(doc);
    const totalChars = chapters.reduce((s, ch) => s + countCharsInItems(ch.items), 0);
    return { ...meta, chapters, footnotes, images, totalChars };
  }
}
