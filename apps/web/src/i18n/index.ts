import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import HttpBackend from 'i18next-http-backend'

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: ['en', 'zh'],
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'pages', 'components', 'validation', 'git-sync'],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'prism-language',
      caches: ['localStorage'],
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  })

// Keep document.documentElement.lang in sync
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng.startsWith('zh') ? 'zh' : 'en'
})

export default i18n
