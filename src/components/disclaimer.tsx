import { useTranslations } from "next-intl";

export function Disclaimer() {
  const t = useTranslations("Disclaimer");
  return (
    <aside
      aria-labelledby="disclaimer-heading"
      className="rounded-lg border border-amber-600/30 bg-amber-500/10 p-4 text-sm"
    >
      <h2 id="disclaimer-heading" className="mb-1 font-semibold">
        {t("heading")}
      </h2>
      <p className="opacity-90">{t("text")}</p>
    </aside>
  );
}
