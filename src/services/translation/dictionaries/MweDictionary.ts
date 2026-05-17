// Public-facing MWE lookup combining trie (contiguous) + SlotMatcher (discontinuous).
// Loaded once per book open для current (srcLang, dstLang) pair.
import { tokenize } from './tokenize';
import { MweTrie, type MwePayload } from './MweTrie';
import { SlotMatcher } from './SlotMatcher';

export interface MweEntry {
  phrase: string;
  translationEquivalent: string;
  literalGloss: string | null;
  mweType: string | null;
  gapPattern: string | null; // '' | null = contiguous; '__≤N' = discontinuous
  domain: string;
}

export interface MweLookupResult {
  payload: MwePayload;
  /** Number of tokens matched starting from the token containing `charOffset`. */
  matchedTokens: number;
  /** Index of first matched token in tokenized sentence. */
  matchStartTokenIdx: number;
}

export class MweDictionary {
  private trie = new MweTrie();
  private slotMatcher = new SlotMatcher();
  private loaded = false;

  load(entries: MweEntry[]): void {
    this.trie = new MweTrie();
    this.slotMatcher = new SlotMatcher();
    for (const e of entries) {
      const payload: MwePayload = {
        phrase: e.phrase,
        translationEquivalent: e.translationEquivalent,
        literalGloss: e.literalGloss,
        mweType: e.mweType,
        domain: e.domain,
      };
      if (e.gapPattern && e.gapPattern.startsWith('__')) {
        // discontinuous
        const tokens = tokenize(e.phrase);
        const gapMax = parseInt(e.gapPattern.match(/≤(\d+)/)?.[1] ?? '3', 10);
        this.slotMatcher.addPattern({ tokens, gapMax, payload });
      } else {
        // contiguous
        this.trie.insert(tokenize(e.phrase), payload);
      }
    }
    this.loaded = true;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Lookup MWE containing char position `charOffset` в sentence.
   * Returns longest match across trie + slot matcher.
   */
  lookup(sentence: string, charOffset: number): MweLookupResult | null {
    if (!this.loaded) return null;
    const tokens = tokenize(sentence);
    // Locate which token contains charOffset
    const tokenStartIdx = this.tokenAtChar(sentence, charOffset);
    if (tokenStartIdx < 0) return null;

    // Try matches starting from tokenStartIdx and up to 3 tokens before
    // (in case MWE starts earlier than tapped word).
    let best: MweLookupResult | null = null;
    for (let start = Math.max(0, tokenStartIdx - 3); start <= tokenStartIdx; start++) {
      const trieHit = this.trie.findLongestAt(tokens, start);
      const slotHit = this.slotMatcher.findAt(tokens, start);
      const candidates: Array<{ length: number; payload: MwePayload }> = [];
      if (trieHit) candidates.push(trieHit);
      if (slotHit) candidates.push(slotHit);
      for (const c of candidates) {
        const endIdx = start + c.length;
        if (endIdx <= tokenStartIdx) continue; // match must cover tapped token
        if (!best || c.length > best.matchedTokens) {
          best = { payload: c.payload, matchedTokens: c.length, matchStartTokenIdx: start };
        }
      }
    }
    return best;
  }

  private tokenAtChar(sentence: string, charOffset: number): number {
    // Walk through original sentence, tracking which whitespace-separated token contains charOffset.
    let inToken = false;
    let tokenIdx = -1;
    for (let i = 0; i < sentence.length; i++) {
      const c = sentence[i] ?? '';
      if (/\s/.test(c)) {
        inToken = false;
      } else {
        if (!inToken) {
          tokenIdx++;
          inToken = true;
        }
      }
      if (i === charOffset) return tokenIdx;
    }
    return tokenIdx;
  }
}
