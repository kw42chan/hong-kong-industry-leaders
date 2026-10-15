"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";

const MAX_KEYWORD_LENGTH = 60;

export function KeywordForm({ examples }: { examples: string[] }) {
  const t = useTranslations("SearchForm");
  const tHome = useTranslations("Home");
  const locale = useLocale();
  const router = useRouter();
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isNavigating, startTransition] = useTransition();
  const busy = submitting || isNavigating;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = keyword.trim();
    if (!trimmed) {
      setError(t("errorEmpty"));
      return;
    }
    if (trimmed.length > MAX_KEYWORD_LENGTH) {
      setError(t("errorTooLong", { max: MAX_KEYWORD_LENGTH }));
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: trimmed, locale }),
      });
      if (!res.ok) {
        setError(res.status === 429 ? t("errorRateLimited") : t("errorGeneric"));
        return;
      }
      const data = (await res.json()) as { token?: unknown };
      if (typeof data.token !== "string" || !data.token) {
        setError(t("errorGeneric"));
        return;
      }
      const token = data.token;
      startTransition(() => {
        router.push(`/search/${encodeURIComponent(token)}`);
      });
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <label htmlFor={inputId} className="text-sm font-medium">
        {t("label")}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={inputId}
          name="keyword"
          type="text"
          inputMode="search"
          autoComplete="off"
          enterKeyHint="search"
          maxLength={MAX_KEYWORD_LENGTH * 2}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={t("placeholder")}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          aria-invalid={error ? true : undefined}
          disabled={busy}
          className="min-h-12 flex-1 rounded-lg border border-current/25 bg-transparent px-4 text-base outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/40 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-12 rounded-lg bg-blue-700 px-6 font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? t("submitting") : t("submit")}
        </button>
      </div>
      <p id={hintId} className="text-sm opacity-70">
        {t("hint")}
      </p>
      <p
        id={errorId}
        role="alert"
        className="min-h-5 text-sm font-medium text-red-700 dark:text-red-400"
      >
        {error}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="opacity-70">{tHome("examplesLabel")}</span>
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            disabled={busy}
            onClick={() => {
              setKeyword(example);
              setError(null);
            }}
            className="rounded-full border border-current/20 px-3 py-1 hover:bg-current/5 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            {example}
          </button>
        ))}
      </div>
    </form>
  );
}
