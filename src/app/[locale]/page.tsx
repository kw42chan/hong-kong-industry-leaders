import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import type { Locale } from "@/i18n/routing";

export default function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);
  const t = useTranslations("Home");

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <p className="text-lg opacity-80">{t("subtitle")}</p>
      <p className="text-sm opacity-60">{t("placeholder")}</p>
    </section>
  );
}
