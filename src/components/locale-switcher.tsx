"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeLabels, routing, type Locale } from "@/i18n/routing";

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onChange(nextLocale: Locale) {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{t("label")}</span>
      <select
        className="rounded border border-current/20 bg-transparent px-2 py-1"
        defaultValue={locale}
        disabled={isPending}
        onChange={(e) => onChange(e.target.value as Locale)}
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {localeLabels[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
