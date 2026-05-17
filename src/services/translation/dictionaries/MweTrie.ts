export interface MwePayload {
  phrase: string;
  translationEquivalent?: string;
  literalGloss?: string | null;
  mweType?: string | null;
  domain?: string;
}

interface TrieNode {
  children: Map<string, TrieNode>;
  payload: MwePayload | null;
}

export interface TrieMatch {
  payload: MwePayload;
  length: number;
}

export class MweTrie {
  private root: TrieNode = { children: new Map(), payload: null };

  insert(tokens: string[], payload: MwePayload): void {
    let node = this.root;
    for (const t of tokens) {
      let next = node.children.get(t);
      if (!next) {
        next = { children: new Map(), payload: null };
        node.children.set(t, next);
      }
      node = next;
    }
    node.payload = payload;
  }

  findLongestAt(tokens: string[], startIdx: number): TrieMatch | null {
    let node = this.root;
    let bestMatch: TrieMatch | null = null;
    for (let i = startIdx; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok === undefined) break;
      const next = node.children.get(tok);
      if (!next) break;
      node = next;
      if (node.payload) {
        bestMatch = { payload: node.payload, length: i - startIdx + 1 };
      }
    }
    return bestMatch;
  }
}
