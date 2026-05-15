import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './locales/en.json';
import ru from './locales/ru.json';
import pl from './locales/pl.json';
import uk from './locales/uk.json';

const SUPPORTED = ['en', 'ru', 'pl', 'uk'] as const;
type SupportedLang = (typeof SUPPORTED)[number];

function detectInitialLang(): SupportedLang {
  const sys = Localization.getLocales()[0]?.languageCode ?? 'en';
  return (SUPPORTED as readonly string[]).includes(sys) ? (sys as SupportedLang) : 'en';
}

// I4: экспортируем Promise готовности i18n, чтобы корневой layout мог await его
// до SplashScreen.hideAsync(). Без этого пользователь видит мигание ключей.
//
// I6: первоначальный язык i18n берём из device locale (detectInitialLang),
// чтобы НЕ зависеть от ещё не инициализированного store. Дальнейшие смены —
// через settingsStore.setUiLanguage (см. I5), которая вызывает changeLanguage.
// Когда подключим persist (#2), при cold-start вызывать syncI18nFromStore()
// один раз после гидрации стора — это поднимет сохранённый UI-язык.
export function syncI18nFromStore(uiLanguage: SupportedLang): void {
  // eslint-disable-next-line import/no-named-as-default-member
  void i18n.changeLanguage(uiLanguage);
}

// Экспорт детектора для onboarding (#8): «по умолчанию выставить UI-язык
// детектированный с устройства, если пользователь не выбрал ничего».
export { detectInitialLang };
// eslint-disable-next-line import/no-named-as-default-member
export const i18nReady: Promise<unknown> = i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
    pl: { translation: pl },
    uk: { translation: uk },
  },
  lng: detectInitialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
