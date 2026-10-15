import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { KeywordForm } from "@/components/keyword-form";
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
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-lg opacity-80">{t("subtitle")}</p>
      </div>
      <KeywordForm examples={t.raw("examples") as string[]} />
      <p className="text-sm opacity-70">{t("howItWorks")}</p>
    </section>
  );
}
