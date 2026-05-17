// Loads MWE + false-friend dictionaries lazily on book open for the current lang pair.
// Uses constructor-injected CSV readers so tests can supply in-memory data without
// hitting expo-asset / expo-file-system.
//
// Note: expo-asset is a transitive dep of expo (not declared directly). We import it
// via a type-only declaration to avoid tsc errors; at runtime Metro resolves it fine.
import * as FileSystem from 'expo-file-system/legacy';
import { MweDictionary } from './MweDictionary';
import { FalseFriendsDictionary } from './FalseFriendsDictionary';
import { parseMweCsv } from './parseMweCsv';
import { parseFalseFriendsCsv } from './parseFalseFriendsCsv';
import { getMweAsset, getFalseFriendsAsset } from './csvAssets';

export interface DictionaryLoaderDeps {
  mweDictionary: MweDictionary;
  falseFriendsDictionary: FalseFriendsDictionary;
  /** Return CSV string for this lang pair, or null if no asset available. */
  readMweCsv: (src: string, dst: string) => Promise<string | null>;
  /** Return CSV string for this lang pair, or null if no asset available. */
  readFalseFriendsCsv: (src: string, dst: string) => Promise<string | null>;
}

export class DictionaryLoader {
  private currentPair: string | null = null;

  constructor(private deps: DictionaryLoaderDeps) {}

  /**
   * Load dictionaries for the given language pair.
   * Idempotent — calling again with the same pair is a no-op.
   * On missing asset the dictionary is loaded with an empty list (degraded mode).
   */
  async loadPair(srcLang: string, dstLang: string): Promise<void> {
    const key = `${srcLang}-${dstLang}`;
    if (this.currentPair === key) return;

    const [mweCsv, ffCsv] = await Promise.all([
      this.deps.readMweCsv(srcLang, dstLang),
      this.deps.readFalseFriendsCsv(srcLang, dstLang),
    ]);

    this.deps.mweDictionary.load(mweCsv ? parseMweCsv(mweCsv) : []);
    this.deps.falseFriendsDictionary.load(
      ffCsv ? parseFalseFriendsCsv(ffCsv, srcLang, dstLang) : [],
    );
    this.currentPair = key;
  }
}

// ---------------------------------------------------------------------------
// Runtime helpers for bundled CSV asset access via expo-asset + expo-file-system
// ---------------------------------------------------------------------------

export async function readBundledCsvAsset(assetModule: number | null): Promise<string | null> {
  if (assetModule === null) return null;
  // expo-asset is a transitive dep of expo — require lazily to avoid tsc import errors.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Asset } = require('expo-asset') as { Asset: { fromModule: (m: number) => { localUri: string | null; downloadAsync: () => Promise<void> } } };
  const asset = Asset.fromModule(assetModule);
  if (!asset.localUri) {
    await asset.downloadAsync();
  }
  if (!asset.localUri) return null;
  return await FileSystem.readAsStringAsync(asset.localUri);
}

export function makeRealMweReader(): (src: string, dst: string) => Promise<string | null> {
  return async (src: string, dst: string) => readBundledCsvAsset(getMweAsset(src, dst));
}

export function makeRealFalseFriendsReader(): (src: string, dst: string) => Promise<string | null> {
  return async (src: string, dst: string) => readBundledCsvAsset(getFalseFriendsAsset(src, dst));
}
