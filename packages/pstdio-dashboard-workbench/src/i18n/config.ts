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
      zh: ["zh-Hans"], // Map generic Chinese to Simplified Chinese
      default: ["en"],
    },
    defaultNS: "common",
    debug: import.meta.env.DEV,
    // Include 'zh' + Traditional Chinese locales for browser detection
    supportedLngs: [...SUPPORTED_I18N_CODES, "zh", "zh-TW", "zh-HK", "zh-MO"],
    nonExplicitSupportedLngs: true, // Accept zh -> zh-Hans mapping
    load: "currentOnly", // Load exact language code

    interpolation: {
      escapeValue: false, // React already escapes
    },

    react: {
      useSuspense: false, // Avoid suspense for now to simplify initial setup
    },

    detection: {
      order: ["navigator", "htmlTag"],
      caches: [], // Disable localStorage cache - we'll handle this via config
    },
  });

export default i18n;
