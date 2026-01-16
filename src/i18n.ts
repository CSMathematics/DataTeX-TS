import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enHelpers from "./locales/en/translation.json";
import elHelpers from "./locales/el/translation.json";
import itHelpers from "./locales/it/translation.json";
import frHelpers from "./locales/fr/translation.json";
import deHelpers from "./locales/de/translation.json";
import esHelpers from "./locales/es/translation.json";
import zhCNHelpers from "./locales/zh-CN/translation.json";
import ptHelpers from "./locales/pt/translation.json";
import ruHelpers from "./locales/ru/translation.json";
import jaHelpers from "./locales/ja/translation.json";

// Initialize i18next
i18n
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languagedetector
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    debug: true,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    resources: {
      en: {
        translation: enHelpers,
      },
      el: {
        translation: elHelpers,
      },
      it: {
        translation: itHelpers,
      },
      fr: {
        translation: frHelpers,
      },
      de: {
        translation: deHelpers,
      },
      es: {
        translation: esHelpers,
      },
      "zh-CN": {
        translation: zhCNHelpers,
      },
      pt: {
        translation: ptHelpers,
      },
      ru: {
        translation: ruHelpers,
      },
      ja: {
        translation: jaHelpers,
      },
    },
  });

export default i18n;
