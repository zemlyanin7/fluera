import type { InlineNode } from '@/types/content';

// ─── flattenWithIndex ────────────────────────────────────────────────────────

export interface InlineMapEntry {
  plainText: string;
  plainStart: number;
  plainEnd: number;
  wrappers: string[];
  /** href сохраняется для link-нод, чтобы buildSlice мог восстановить их корректно */
  linkHrefs: (string | undefined)[];
}

export interface FlattenResult {
  plainText: string;
  inlineMap: InlineMapEntry[];
}

/**
 * Разворачивает дерево InlineNode[] в плоский plainText и inlineMap —
 * массив записей с offsets в plain и списком обёрток (italic/bold/sup/…).
 * footnote-ref нодs пропускаются (не дают текста).
 */
export function flattenWithIndex(inlines: InlineNode[]): FlattenResult {
  const map: InlineMapEntry[] = [];
  let plain = '';

  function walk(
    nodes: InlineNode[],
    wrappers: string[],
    linkHrefs: (string | undefined)[],
  ): void {
    for (const node of nodes) {
      if (node.type === 'text') {
        const start = plain.length;
        plain += node.text;
        map.push({
          plainText: node.text,
          plainStart: start,
          plainEnd: plain.length,
          wrappers: [...wrappers],
          linkHrefs: [...linkHrefs],
        });
      } else if (node.type === 'footnote-ref') {
        // skip — не добавляет текст в plain
      } else if (node.type === 'link') {
        walk(node.children, [...wrappers, 'link'], [...linkHrefs, node.href]);
      } else if ('children' in node) {
        walk(node.children, [...wrappers, node.type], [...linkHrefs, undefined]);
      }
    }
  }

  walk(inlines, [], []);
  return { plainText: plain, inlineMap: map };
}

// ─── splitSentencesSmartly ──────────────────────────────────────────────────

const PERIOD_CHARS_RE = /[.!?…。！？؟۔]/;

const ABBREV_TOKENS = [
  'Mr','Mrs','Ms','Dr','Prof','Capt','Gen','Rev','Sgt','St','Jr','Sr',
  'vs','etc','Mme','Mlle','vol','no','ch','p','pp','cf',
  'i.e','e.g',
  'т.е','т.к','т.д','т.п','и.т.д','и.т.п',
  'г','стр','см','гл','др',
];

// Используем (?:^|[\s ]) вместо \b, чтобы корректно работать с кириллицей
// (JS \b не распознаёт Cyrillic-символы как word chars, поэтому \bг не матчится).
const ABBREV_RE = new RegExp(
  `(?:^|[\\s ])(${ABBREV_TOKENS.map((t) => t.replace(/\./g, '\\.')).join('|')})\\.\\s*$`,
  'i',
);

const QUOTE_PAIRS: Record<string, string> = {
  '"': '”', // "…"
  '«': '»',
  '„': '“', // „…"
  '“': '”', // "…"
  '「': '」', // 「…」
  '『': '』', // 『…』
  "'": "'",
};

export interface SentenceSpan {
  text: string;
  startOffset: number;
  endOffset: number;
}

/**
 * Разбивает текст на предложения с учётом:
 * - десятичных чисел (3.14 → не разрыв)
 * - аббревиатур (Mr. Dr. г. стр. → не разрыв)
 * - кавычек ("Hi!" → не разрывать внутри)
 * - CJK punct (。！？)
 * - Arabic (؟ ۔)
 * - ASCII ... → нормализация к …
 */
export function splitSentencesSmartly(text: string): SentenceSpan[] {
  if (!text) return [];

  // Нормализуем ASCII-ellipsis к unicode
  const normalized = text.replace(/\.{3,}/g, '…');

  const sentences: SentenceSpan[] = [];
  let currentStart = 0;
  let i = 0;

  while (i < normalized.length) {
    const c = normalized[i];
    if (PERIOD_CHARS_RE.test(c)) {
      if (
        !isDecimalContext(normalized, i) &&
        !isAbbreviation(normalized, i) &&
        !insideQuotes(normalized, i)
      ) {
        // Поглощаем следующие знаки конца предложения (множественный пунктуатор)
        let endIdx = i + 1;
        while (endIdx < normalized.length && PERIOD_CHARS_RE.test(normalized[endIdx])) {
          endIdx++;
        }
        // Пропускаем whitespace после пунктуатора
        let afterWs = endIdx;
        while (afterWs < normalized.length && /\s/.test(normalized[afterWs])) {
          afterWs++;
        }
        const sentText = normalized.slice(currentStart, endIdx).trim();
        if (sentText) {
          sentences.push({
            text: sentText,
            startOffset: currentStart,
            endOffset: endIdx,
          });
        }
        currentStart = afterWs;
        i = afterWs;
        continue;
      }
    }
    i++;
  }

  // Хвост без конечного пунктуатора
  if (currentStart < normalized.length) {
    const tail = normalized.slice(currentStart).trim();
    if (tail) {
      sentences.push({
        text: tail,
        startOffset: currentStart,
        endOffset: normalized.length,
      });
    }
  }

  return sentences;
}

function isDecimalContext(text: string, idx: number): boolean {
  if (idx === 0 || idx === text.length - 1) return false;
  return /\d/.test(text[idx - 1]!) && /\d/.test(text[idx + 1]!);
}

function isAbbreviation(text: string, idx: number): boolean {
  const segment = text.slice(Math.max(0, idx - 10), idx + 1);
  return ABBREV_RE.test(segment);
}

function insideQuotes(text: string, idx: number): boolean {
  const stack: string[] = [];
  for (let i = 0; i < idx; i++) {
    const c = text[i]!;
    if (Object.prototype.hasOwnProperty.call(QUOTE_PAIRS, c)) {
      // Это открывающая кавычка
      const last = stack[stack.length - 1];
      if (last !== undefined && QUOTE_PAIRS[last] === c) {
        // Иногда один и тот же символ может быть и открывающим, и закрывающим
        stack.pop();
      } else {
        stack.push(c);
      }
    } else if (Object.values(QUOTE_PAIRS).includes(c)) {
      // Закрывающая кавычка
      const last = stack[stack.length - 1];
      if (last !== undefined && QUOTE_PAIRS[last] === c) {
        stack.pop();
      }
    }
  }
  return stack.length > 0;
}
