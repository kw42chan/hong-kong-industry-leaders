import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["zh-HK", "en"],
  defaultLocale: "zh-HK",
});

export type Locale = (typeof routing.locales)[number];

/** Each locale's name in its own language, for the locale switcher. */
export const localeLabels: Record<Locale, string> = {
  "zh-HK": "繁體中文",
  en: "English",
};
