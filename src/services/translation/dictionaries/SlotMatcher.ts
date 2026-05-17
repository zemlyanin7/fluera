import type { MwePayload } from './MweTrie';

export interface SlotPattern {
  tokens: string[];
  gapMax: number;
  payload: MwePayload;
}

export interface SlotMatch {
  payload: MwePayload;
  length: number;
}

export class SlotMatcher {
  private patterns: SlotPattern[] = [];
  private byHead: Map<string, SlotPattern[]> = new Map();

  addPattern(p: SlotPattern): void {
    this.patterns.push(p);
    const head = p.tokens[0];
    if (head === undefined || head === '__') return;
    const list = this.byHead.get(head) ?? [];
    list.push(p);
    this.byHead.set(head, list);
  }

  findAt(tokens: string[], startIdx: number): SlotMatch | null {
    const head = tokens[startIdx];
    if (head === undefined) return null;
    const candidates = this.byHead.get(head);
    if (!candidates) return null;
    let best: SlotMatch | null = null;
    for (const p of candidates) {
      const m = this.tryMatchPattern(tokens, startIdx, p);
      if (m && (!best || m.length > best.length)) best = m;
    }
    return best;
  }

  private tryMatchPattern(tokens: string[], startIdx: number, p: SlotPattern): SlotMatch | null {
    let srcIdx = startIdx;
    for (let patIdx = 0; patIdx < p.tokens.length; patIdx++) {
      const tok = p.tokens[patIdx];
      if (tok === '__') {
        const nextPatTok = p.tokens[patIdx + 1];
        if (nextPatTok === undefined) return null;
        let foundAt = -1;
        for (let gap = 1; gap <= p.gapMax && srcIdx + gap < tokens.length; gap++) {
          if (tokens[srcIdx + gap] === nextPatTok) {
            foundAt = srcIdx + gap;
            break;
          }
        }
        if (foundAt === -1) return null;
        srcIdx = foundAt + 1;
        patIdx++;
      } else {
        if (tokens[srcIdx] !== tok) return null;
        srcIdx++;
      }
    }
    return { payload: p.payload, length: srcIdx - startIdx };
  }
}
