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
// I6: первоначальный язык берём из device locale, дальнейшие смены — через
// settingsStore.setUiLanguage (см. I5).
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
