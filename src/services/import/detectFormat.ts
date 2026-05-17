// Format detection по magic bytes + extension fallback. См. spec §7.2.
import { ParserError } from '@/services/parser/types';

export type BookFormat = 'epub' | 'fb2';

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
const UTF8_BOM = [0xef, 0xbb, 0xbf];

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((b, i) => bytes[i] === b);
}

export function detectFormatFromBytes(bytes: Uint8Array, originalName: string): BookFormat {
  if (startsWith(bytes, ZIP_MAGIC)) return 'epub';
  let xmlStart = bytes;
  if (startsWith(bytes, UTF8_BOM)) xmlStart = bytes.subarray(UTF8_BOM.length);
  const head = String.fromCharCode(...xmlStart.subarray(0, Math.min(4096, xmlStart.length)));
  if (head.includes('<?xml') && head.includes('FictionBook')) return 'fb2';
  const ext = originalName.toLowerCase().split('.').pop();
  if (ext === 'epub') return 'epub';
  if (ext === 'fb2') return 'fb2';
  throw new ParserError('UNKNOWN_FORMAT', `Файл не похож на EPUB или FB2: ${originalName}`);
}
