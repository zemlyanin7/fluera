// Service-locator pattern для translation service. RootLayout вешает
// провайдер; reader screen / popup читают через useTranslationService().
// Позволяет swap NoOp / Mock / Llama в одном месте без рефакторинга UI.
import React, { createContext, useContext } from 'react';
import type { ITranslationService } from './ITranslationService';

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
