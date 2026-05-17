// Test helper: builds EPUB-compatible zip in-memory через fflate.
// Используется во всех EPUB unit-тестах.
import { zipSync } from 'fflate';

export interface EpubBuildInput {
  manifest: { id: string; href: string; mediaType: string }[];
  spine: string[];
  metadata?: { title?: string; creator?: string; language?: string; coverId?: string };
  files: Record<string, string | Uint8Array>;
  encrypted?: boolean;
}

export function buildEpub(input: EpubBuildInput): Uint8Array {
  const opfPath = 'OEBPS/content.opf';
  const mimetype = 'application/epub+zip';
  const containerXml = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

  const meta = input.metadata ?? {};
  const manifestXml = input.manifest
    .map(
      (m) =>
        `<item id="${m.id}" href="${m.href}" media-type="${m.mediaType}"${
          m.id === meta.coverId ? ' properties="cover-image"' : ''
        }/>`,
    )
    .join('\n    ');
  const spineXml = input.spine.map((id) => `<itemref idref="${id}"/>`).join('\n    ');
  const metaCover = meta.coverId ? `<meta name="cover" content="${meta.coverId}"/>` : '';
  const opf = `<?xml version="1.0"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">id-1</dc:identifier>
    <dc:title>${meta.title ?? 'X'}</dc:title>
    <dc:creator>${meta.creator ?? ''}</dc:creator>
    <dc:language>${meta.language ?? 'en'}</dc:language>
    ${metaCover}
  </metadata>
  <manifest>
    ${manifestXml}
  </manifest>
  <spine>
    ${spineXml}
  </spine>
</package>`;

  const enc = new TextEncoder();
  const archive: Record<string, Uint8Array> = {
    'mimetype': enc.encode(mimetype),
    'META-INF/container.xml': enc.encode(containerXml),
    [opfPath]: enc.encode(opf),
  };
  if (input.encrypted) archive['META-INF/encryption.xml'] = enc.encode('<encryption/>');
  for (const [path, content] of Object.entries(input.files)) {
    archive[`OEBPS/${path}`] = typeof content === 'string' ? enc.encode(content) : content;
  }
  return zipSync(archive);
}

export function simpleXhtml(body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body>${body}</body></html>`;
}
