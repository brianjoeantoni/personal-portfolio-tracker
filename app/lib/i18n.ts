import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/app/locales/en/common.json";
import id from "@/app/locales/id/common.json";

export const locales = ["en", "id"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_STORAGE_KEY = "personal-portfolio-tracker-locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.includes(value as Locale);
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { en: { common: en }, id: { common: id } },
    lng: defaultLocale,
    fallbackLng: defaultLocale,
    supportedLngs: locales,
    defaultNS: "common",
    initImmediate: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export default i18n;
