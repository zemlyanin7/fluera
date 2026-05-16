// FB2 <binary> теги → ParsedImage. Base64 декодирование с size cap.
// См. spec §6.4.
import type { Document as XmlDocument } from '@xmldom/xmldom';
import { base64Decode } from '../shared/base64Decode';
import { sanitizeImageId } from '../shared/sanitizeImageId';
import { ParserError, type ParsedImage } from '../types';

const MAX_IMAGE_DECODED = 10 * 1024 * 1024;

export function parseBinaries(doc: XmlDocument): ParsedImage[] {
  const bins = doc.getElementsByTagName('binary');
  const result: ParsedImage[] = [];
  for (let i = 0; i < bins.length; i++) {
    const node = bins[i];
    if (!node) continue;
    const rawId = node.getAttribute('id');
    if (!rawId) continue;
    const id = sanitizeImageId(rawId);
    const mime = node.getAttribute('content-type') ?? 'image/jpeg';
    const base64Text = (node.textContent ?? '').trim();
    if (!base64Text) continue;
    let bytes: Uint8Array;
    try {
      bytes = base64Decode(base64Text);
    } catch {
      continue;
    }
    if (bytes.length > MAX_IMAGE_DECODED) {
      throw new ParserError('IMAGE_TOO_LARGE', `Image ${id} превышает ${MAX_IMAGE_DECODED} байт`);
    }
    result.push({ id, bytes, mime });
  }
  return result;
}
