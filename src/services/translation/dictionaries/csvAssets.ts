// Static registry of bundled CSV assets.
// Hermes does not support dynamic require paths — all require() calls must be static.
// Metro resolves *.csv assets as numeric module IDs (AssetModule).
type AssetModule = number;

interface CsvAssetMap {
  mwe: Record<string, AssetModule>;
  falseFriends: Record<string, AssetModule>;
}

const mweAssets: Record<string, AssetModule> = {
  /* eslint-disable @typescript-eslint/no-var-requires */
  'en-ru': require('../../../../assets/mwe/en-ru.csv') as unknown as number,
  'en-es': require('../../../../assets/mwe/en-es.csv') as unknown as number,
  'en-fr': require('../../../../assets/mwe/en-fr.csv') as unknown as number,
  'en-de': require('../../../../assets/mwe/en-de.csv') as unknown as number,
  'en-pt': require('../../../../assets/mwe/en-pt.csv') as unknown as number,
  'en-it': require('../../../../assets/mwe/en-it.csv') as unknown as number,
  'ja-en': require('../../../../assets/mwe/ja-en.csv') as unknown as number,
  'ko-en': require('../../../../assets/mwe/ko-en.csv') as unknown as number,
  'ru-en': require('../../../../assets/mwe/ru-en.csv') as unknown as number,
  'es-en': require('../../../../assets/mwe/es-en.csv') as unknown as number,
  /* eslint-enable @typescript-eslint/no-var-requires */
};

const falseFriendsAssets: Record<string, AssetModule> = {
  /* eslint-disable @typescript-eslint/no-var-requires */
  'en-ru': require('../../../../assets/false_friends/en-ru.csv') as unknown as number,
  'ru-en': require('../../../../assets/false_friends/ru-en.csv') as unknown as number,
  'en-es': require('../../../../assets/false_friends/en-es.csv') as unknown as number,
  'es-en': require('../../../../assets/false_friends/es-en.csv') as unknown as number,
  'en-fr': require('../../../../assets/false_friends/en-fr.csv') as unknown as number,
  'fr-en': require('../../../../assets/false_friends/fr-en.csv') as unknown as number,
  /* eslint-enable @typescript-eslint/no-var-requires */
};

export const csvAssets: CsvAssetMap = { mwe: mweAssets, falseFriends: falseFriendsAssets };

export function getMweAsset(srcLang: string, dstLang: string): AssetModule | null {
  return mweAssets[`${srcLang}-${dstLang}`] ?? null;
}

export function getFalseFriendsAsset(srcLang: string, dstLang: string): AssetModule | null {
  return falseFriendsAssets[`${srcLang}-${dstLang}`] ?? null;
}
