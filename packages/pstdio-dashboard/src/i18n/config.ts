import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { SUPPORTED_I18N_CODES } from "./languages";
import resources from "./resources";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: {
      "zh-TW": ["zh-Hant"],
      "zh-HK": ["zh-Hant"],
      "zh-MO": ["zh-Hant"],
      zh: ["zh-Hans"],
      default: ["en"],
    },
    defaultNS: "common",
    fallbackNS: "common",
    debug: import.meta.env.DEV,
    supportedLngs: [...SUPPORTED_I18N_CODES, "zh", "zh-TW", "zh-HK", "zh-MO"],
    nonExplicitSupportedLngs: true,
    load: "all",
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    detection: {
      order: ["navigator", "htmlTag"],
      caches: [],
    },
  });

export default i18n;
