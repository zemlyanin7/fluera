// Диспетчер парсеров по формату. Регистрируется при app startup или в тестах.
import type { BookFormat } from '@/services/import/detectFormat';
import { ParserError, type IParser } from './types';

export class ParserRegistry {
  private parsers = new Map<BookFormat, IParser>();

  register(format: BookFormat, parser: IParser): void {
    this.parsers.set(format, parser);
  }

  get(format: BookFormat): IParser {
    const p = this.parsers.get(format);
    if (!p) throw new ParserError('UNKNOWN_FORMAT', `Нет парсера для формата: ${format}`);
    return p;
  }
}
