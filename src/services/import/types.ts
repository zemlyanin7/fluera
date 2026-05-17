// ImportPipeline contracts. См. spec §7.1.
import type { BookLanguage } from '@/types/settings';

export interface ImportFile {
  uri: string;
  name: string;
  size: number;
  mimeType?: string;
}

export interface ImportResult {
  bookId: string;
  filePath: string;
  chapterCount: number;
  /** null если язык не определён — Library UI попросит юзера. */
  languageDetected: BookLanguage | null;
}
