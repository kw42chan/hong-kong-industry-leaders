import { getTranslations } from "next-intl/server";

export default async function SearchPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  const t = await getTranslations({ locale, namespace: "Search" });
  const tDisclaimer = await getTranslations({ locale, namespace: "Disclaimer" });

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="font-mono text-sm opacity-60">{token}</p>
      <p>{t("processing")}</p>
      <p className="text-xs opacity-60">{tDisclaimer("text")}</p>
    </section>
  );
}
