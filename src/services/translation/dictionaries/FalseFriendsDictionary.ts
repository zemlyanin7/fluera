// Lookup table for false-friend entries for a given (sourceLang, targetLang) pair.
// Loaded lazily on book open by DictionaryLoader.

export interface FalseFriendEntry {
  sourceLang: string;
  targetLang: string;
  sourceWord: string;
  looksLikeNative: string;
  actualMeaning: string;
  confidence: 'high' | 'medium';
  domain: string;
}

export class FalseFriendsDictionary {
  private map = new Map<string, FalseFriendEntry>();
  private loaded = false;

  load(entries: FalseFriendEntry[]): void {
    this.map = new Map();
    for (const e of entries) {
      this.map.set(e.sourceWord.toLowerCase().trim(), e);
    }
    this.loaded = true;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  lookup(word: string): FalseFriendEntry | null {
    return this.map.get(word.toLowerCase().trim()) ?? null;
  }
}
