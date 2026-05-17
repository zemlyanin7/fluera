// Service-locator pattern для translation service. RootLayout вешает
// провайдер; reader screen / popup читают через useTranslationService().
// Позволяет swap NoOp / Mock / Llama в одном месте без рефакторинга UI.
import React, { createContext, useContext, useMemo } from 'react';
import type { ITranslationService } from './ITranslationService';
import { MweDictionary } from './dictionaries/MweDictionary';
import { FalseFriendsDictionary } from './dictionaries/FalseFriendsDictionary';
import {
  DictionaryLoader,
  makeRealMweReader,
  makeRealFalseFriendsReader,
} from './dictionaries/DictionaryLoader';

// ---------------------------------------------------------------------------
// Translation service context (existing)
// ---------------------------------------------------------------------------

const Ctx = createContext<ITranslationService | null>(null);

export function TranslationServiceProvider({
  service,
  children,
}: {
  service: ITranslationService;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={service}>{children}</Ctx.Provider>;
}

export function useTranslationService(): ITranslationService {
  const v = useContext(Ctx);
  if (!v)
    throw new Error('useTranslationService must be used within TranslationServiceProvider');
  return v;
}

// ---------------------------------------------------------------------------
// Dictionary context (additive — Phase 5/6)
// ---------------------------------------------------------------------------

interface DictionaryContextValue {
  mweDictionary: MweDictionary;
  falseFriendsDictionary: FalseFriendsDictionary;
  dictionaryLoader: DictionaryLoader;
}

const DictCtx = createContext<DictionaryContextValue | null>(null);

/**
 * Provides MweDictionary, FalseFriendsDictionary and DictionaryLoader.
 * Wrap at the same level as TranslationServiceProvider (e.g. in RootLayout).
 */
export function DictionaryProvider({ children }: { children: React.ReactNode }) {
  const mweDictionary = useMemo(() => new MweDictionary(), []);
  const falseFriendsDictionary = useMemo(() => new FalseFriendsDictionary(), []);
  const dictionaryLoader = useMemo(
    () =>
      new DictionaryLoader({
        mweDictionary,
        falseFriendsDictionary,
        readMweCsv: makeRealMweReader(),
        readFalseFriendsCsv: makeRealFalseFriendsReader(),
      }),
    [mweDictionary, falseFriendsDictionary],
  );

  const value = useMemo(
    () => ({ mweDictionary, falseFriendsDictionary, dictionaryLoader }),
    [mweDictionary, falseFriendsDictionary, dictionaryLoader],
  );

  return <DictCtx.Provider value={value}>{children}</DictCtx.Provider>;
}

export function useDictionaryLoader(): DictionaryLoader {
  const v = useContext(DictCtx);
  if (!v) throw new Error('useDictionaryLoader must be used within DictionaryProvider');
  return v.dictionaryLoader;
}

export function useMweDictionary(): MweDictionary {
  const v = useContext(DictCtx);
  if (!v) throw new Error('useMweDictionary must be used within DictionaryProvider');
  return v.mweDictionary;
}

export function useFalseFriendsDictionary(): FalseFriendsDictionary {
  const v = useContext(DictCtx);
  if (!v) throw new Error('useFalseFriendsDictionary must be used within DictionaryProvider');
  return v.falseFriendsDictionary;
}
