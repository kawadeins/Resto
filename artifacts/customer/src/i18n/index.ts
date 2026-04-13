import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import translations from "./translations";

export const SUPPORTED_LANGUAGES = ["de", "en", "fr", "it", "es", "nl", "pt", "tr"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<string, string> = {
  de: "Deutsch",
  en: "English",
  fr: "Français",
  it: "Italiano",
  es: "Español",
  nl: "Nederlands",
  pt: "Português",
  tr: "Türkçe",
};

export const LANGUAGE_FLAGS: Record<string, string> = {
  de: "🇩🇪",
  en: "🇬🇧",
  fr: "🇫🇷",
  it: "🇮🇹",
  es: "🇪🇸",
  nl: "🇳🇱",
  pt: "🇵🇹",
  tr: "🇹🇷",
};

const resources = Object.fromEntries(
  Object.entries(translations).map(([lang, t]) => [lang, { translation: t }])
);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    fallbackLng: "de",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "restosmart_customer_lang",
    },
    returnNull: false,
    returnEmptyString: false,
  });

export default i18n;
