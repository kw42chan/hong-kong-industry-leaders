import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getMockResult, isMockEnabled } from "@/components/search/mock-result";
import { SearchView } from "@/components/search/search-view";
import type { Locale } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Search" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale as Locale);
  const { mock } = await searchParams;

  const mockVariant = typeof mock === "string" && isMockEnabled() ? mock : null;
  const mockResult = mockVariant
    ? { ...getMockResult(mockVariant), token }
    : undefined;

  return <SearchView token={token} mockResult={mockResult} />;
}
