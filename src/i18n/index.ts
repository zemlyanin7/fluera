import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './locales/en.json';
import ru from './locales/ru.json';
import pl from './locales/pl.json';
import uk from './locales/uk.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';
import pt from './locales/pt.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import ar from './locales/ar.json';
import hi from './locales/hi.json';

export const SUPPORTED = [
  'en','ru','pl','uk','es','fr','de','it','pt','ja','ko','ar','hi',
] as const;
type SupportedLang = (typeof SUPPORTED)[number];

function detectInitialLang(): SupportedLang {
  // v2.2.1: дефолт RU — проект русскоязычный, основной рынок изначально русский.
  // Юзер может сменить UI-язык в Settings → Language. iOS Simulator по дефолту
  // English → без этого фикса юзер видит EN-строки.
  const sys = Localization.getLocales()[0]?.languageCode ?? 'ru';
  return (SUPPORTED as readonly string[]).includes(sys) ? (sys as SupportedLang) : 'ru';
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
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
    it: { translation: it },
    pt: { translation: pt },
    ja: { translation: ja },
    ko: { translation: ko },
    ar: { translation: ar },
    hi: { translation: hi },
  },
  lng: detectInitialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
