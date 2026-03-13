import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import * as Localization from 'expo-localization'

import en from './locales/en.json'
import ru from './locales/ru.json'
import pl from './locales/pl.json'
import uk from './locales/uk.json'

const resources = { en: { translation: en }, ru: { translation: ru }, pl: { translation: pl }, uk: { translation: uk } }

const deviceLang = Localization.getLocales()[0]?.languageCode ?? 'en'
const supportedLang = Object.keys(resources).includes(deviceLang) ? deviceLang : 'en'

i18n.use(initReactI18next).init({
  resources,
  lng: supportedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
