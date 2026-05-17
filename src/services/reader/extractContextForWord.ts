import type { InlineNode } from '@/types/content';
import type { BookLanguage } from '@/types/settings';
import type { ExtractedContext } from './extractContextForWord.types';
import {
  flattenWithIndex,
  splitSentencesSmartly,
  type InlineMapEntry,
  type SentenceSpan,
} from './inlineSlicing';

// ─── Per-language hard cap (chars) ──────────────────────────────────────────

const HARD_CAP_CHARS: Partial<Record<BookLanguage, number>> = {
  en: 150, fr: 150, es: 150, it: 150, pt: 150,
  ru: 200, uk: 200, pl: 200, de: 200,
  ja: 90,  ko: 90,
  ar: 170, hi: 180,
};
const DEFAULT_CAP = 180;

const WORD_WINDOW_TOKENS = 15;

const SECONDARY_BOUNDARY_RE = /[;—–]/g;

const SOFT_CLAUSE_RE =
  /,\s+(which|that|who|whom|when|where|because|since|if|unless|although|though|and|but|or|so|yet|и|который|которая|которое|которые|когда|пока|если|потому|хотя|чтобы)\b/gi;

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Извлекает контекстный фрагмент (обычно одно предложение) вокруг тапнутого
 * слова из массива InlineNode[], сохраняя форматирование (italic/bold/sup).
 *
 * Алгоритм (spec §2.4):
 * 1. Flatten → plainText + inlineMap
 * 2. splitSentencesSmartly → найти предложение, содержащее word
 * 3. Если sentence.length ≤ cap — вернуть его
 * 4. Escalation 1: разбить по secondary boundary (;—–)
 * 5. Escalation 2: разбить по soft clause (",which", ",и" и т.д.)
 * 6. Hard fallback: word-window ±15 tokens
 */
export function extractContextForWord(
  itemInlines: InlineNode[],
  word: string,
  paragraphCharOffset: number,
  lang: BookLanguage,
): ExtractedContext {
  const { plainText, inlineMap } = flattenWithIndex(itemInlines);

  if (!plainText) {
    return emptyContext();
  }

  const cap = HARD_CAP_CHARS[lang] ?? DEFAULT_CAP;
  const sentences = splitSentencesSmartly(plainText);

  if (sentences.length === 0) {
    return buildSlice(plainText, inlineMap, 0, plainText.length, word, paragraphCharOffset, false);
  }

  // Найти предложение, в котором лежит offset
  const sentence = sentences.find(
    (s) => paragraphCharOffset >= s.startOffset && paragraphCharOffset < s.endOffset,
  );

  if (!sentence) {
    // Fallback на последнее предложение (offset за концом текста)
    const last = sentences[sentences.length - 1]!;
    return buildSlice(plainText, inlineMap, last.startOffset, last.endOffset, word, paragraphCharOffset, false);
  }

  // Sentence fits в cap — возвращаем как есть
  if (sentence.text.length <= cap) {
    return buildSlice(
      plainText, inlineMap,
      sentence.startOffset, sentence.endOffset,
      word, paragraphCharOffset, false,
    );
  }

  // ── Escalation 1: вторичные границы (;—–) ────────────────────────────────
  const subClauses = splitByBoundary(sentence.text, sentence.startOffset, SECONDARY_BOUNDARY_RE);
  const foundSub = subClauses.find(
    (c) =>
      paragraphCharOffset >= c.startOffset &&
      paragraphCharOffset < c.endOffset &&
      c.text.includes(word),
  );
  if (foundSub && foundSub.text.length <= cap) {
    return buildSlice(
      plainText, inlineMap,
      foundSub.startOffset, foundSub.endOffset,
      word, paragraphCharOffset, true,
    );
  }

  // ── Escalation 2: soft clause (",which", ",и" ...) ───────────────────────
  const softClauses = splitByBoundary(sentence.text, sentence.startOffset, SOFT_CLAUSE_RE);
  const foundSoft = softClauses.find(
    (c) =>
      paragraphCharOffset >= c.startOffset &&
      paragraphCharOffset < c.endOffset &&
      c.text.includes(word),
  );
  if (foundSoft && foundSoft.text.length <= cap) {
    return buildSlice(
      plainText, inlineMap,
      foundSoft.startOffset, foundSoft.endOffset,
      word, paragraphCharOffset, true,
    );
  }

  // ── Hard fallback: word-window ±15 tokens (с cap-enforce) ───────────────
  const win = extractWordWindow(plainText, paragraphCharOffset, WORD_WINDOW_TOKENS, cap);
  return buildSlice(
    plainText, inlineMap,
    win.startOffset, win.endOffset,
    word, paragraphCharOffset, true,
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function splitByBoundary(
  text: string,
  baseOffset: number,
  boundary: RegExp,
): SentenceSpan[] {
  const out: SentenceSpan[] = [];
  let current = 0;
  const re = new RegExp(
    boundary.source,
    boundary.flags.includes('g') ? boundary.flags : boundary.flags + 'g',
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const end = m.index + m[0].length;
    const segText = text.slice(current, end).trim();
    if (segText) {
      out.push({
        text: segText,
        startOffset: baseOffset + current,
        endOffset: baseOffset + end,
      });
    }
    current = end;
  }
  if (current < text.length) {
    const tail = text.slice(current).trim();
    if (tail) {
      out.push({
        text: tail,
        startOffset: baseOffset + current,
        endOffset: baseOffset + text.length,
      });
    }
  }
  return out;
}

function extractWordWindow(
  text: string,
  offset: number,
  windowTokens: number,
  cap: number,
): SentenceSpan {
  const words: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (i === 0 || /\s/.test(text[i - 1]!)) {
      words.push(i);
    }
  }

  // CJK и другие языки без пробелов — только 1 "слово" (весь текст).
  // В этом случае центрируемся на offset и обрезаем до cap символов.
  if (words.length <= 1) {
    const half = Math.floor(cap / 2);
    const start = Math.max(0, offset - half);
    const end = Math.min(text.length, start + cap);
    return { text: text.slice(start, end).trim(), startOffset: start, endOffset: end };
  }

  let wordIdx = 0;
  for (let j = 0; j < words.length; j++) {
    if (words[j]! <= offset) wordIdx = j;
    else break;
  }
  const leftIdx = Math.max(0, wordIdx - windowTokens);
  const rightIdx = Math.min(words.length, wordIdx + windowTokens + 1);
  const start = words[leftIdx] ?? 0;
  const end = rightIdx < words.length ? words[rightIdx]! : text.length;
  return { text: text.slice(start, end).trim(), startOffset: start, endOffset: end };
}

function buildSlice(
  plainText: string,
  inlineMap: InlineMapEntry[],
  start: number,
  end: number,
  word: string,
  paragraphCharOffset: number,
  wasCapped: boolean,
): ExtractedContext {
  const sliceText = plainText.slice(start, end);
  const wordOffsetInPlain = Math.max(0, paragraphCharOffset - start);

  // Reconstruct InlineNode[] preserving wrappers (Task 14)
  const inlines: InlineNode[] = [];
  for (const entry of inlineMap) {
    if (entry.plainEnd <= start || entry.plainStart >= end) continue;
    const overlapStart = Math.max(entry.plainStart, start);
    const overlapEnd = Math.min(entry.plainEnd, end);
    const offsetInEntry = overlapStart - entry.plainStart;
    const lenInEntry = overlapEnd - overlapStart;
    const segText = entry.plainText.slice(offsetInEntry, offsetInEntry + lenInEntry);
    if (!segText) continue;

    let node: InlineNode = { type: 'text', text: segText };
    for (let i = entry.wrappers.length - 1; i >= 0; i--) {
      const wrapper = entry.wrappers[i] as 'bold' | 'italic' | 'sup' | 'sub';
      node = { type: wrapper, children: [node] };
    }
    inlines.push(node);
  }

  return {
    inlines: inlines.length > 0 ? inlines : [{ type: 'text', text: sliceText }],
    plainText: sliceText,
    wordOffsetInPlain,
    wordLength: word.length,
    wasCapped,
    startOffsetInParagraph: start,
    endOffsetInParagraph: end,
  };
}

function emptyContext(): ExtractedContext {
  return {
    inlines: [],
    plainText: '',
    wordOffsetInPlain: 0,
    wordLength: 0,
    wasCapped: false,
    startOffsetInParagraph: 0,
    endOffsetInParagraph: 0,
  };
}
