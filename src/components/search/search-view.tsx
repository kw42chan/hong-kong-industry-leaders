"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Disclaimer } from "@/components/disclaimer";
import { Link } from "@/i18n/navigation";
import type { SearchResultDTO } from "@/lib/types";
import { ResultsReady } from "./results-ready";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_INTERVAL_MS = 15000;

type ViewState =
  | { kind: "loading" }
  | { kind: "result"; result: SearchResultDTO }
  | { kind: "notFound" };

function NewSearchLink() {
  const t = useTranslations("Search");
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-5 font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      {t("newSearch")}
    </Link>
  );
}

function Processing({ status }: { status: "loading" | "queued" | "running" }) {
  const t = useTranslations("Search");
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-current/15 p-6">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="size-5 animate-spin rounded-full border-2 border-current/20 border-t-blue-600 motion-reduce:animate-none"
        />
        <h2 className="text-lg font-semibold">{t("processingTitle")}</h2>
      </div>
      <p className="opacity-80">{t("processingBody")}</p>
      {status !== "loading" && (
        <span className="rounded-full bg-current/10 px-3 py-1 text-xs font-medium">
          {status === "queued" ? t("statusQueued") : t("statusRunning")}
        </span>
      )}
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border border-current/15 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="opacity-80">{body}</p>
      <NewSearchLink />
    </div>
  );
}

export function SearchView({
  token,
  mockResult,
}: {
  token: string;
  /** When set (dev only), rendered as-is and polling is skipped. */
  mockResult?: SearchResultDTO;
}) {
  const t = useTranslations("Search");
  const [state, setState] = useState<ViewState>(
    mockResult ? { kind: "result", result: mockResult } : { kind: "loading" },
  );
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    if (mockResult) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = POLL_INTERVAL_MS;

    async function poll() {
      try {
        const res = await fetch(`/api/searches/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status === 404) {
          setState({ kind: "notFound" });
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = (await res.json()) as SearchResultDTO;
        if (cancelled) return;
        setNetworkError(false);
        setState({ kind: "result", result });
        delay = POLL_INTERVAL_MS;
        if (result.status === "ready" || result.status === "failed") return;
      } catch {
        if (cancelled) return;
        setNetworkError(true);
        delay = Math.min(delay * 2, MAX_POLL_INTERVAL_MS);
      }
      timer = setTimeout(poll, delay);
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, mockResult]);

  const result = state.kind === "result" ? state.result : null;
  const status = result?.status;

  let body: React.ReactNode;
  if (state.kind === "notFound") {
    body = <Message title={t("notFoundTitle")} body={t("notFoundBody")} />;
  } else if (status === "failed") {
    body = <Message title={t("failedTitle")} body={t("failedBody")} />;
  } else if (result && status === "ready") {
    body = <ResultsReady result={result} />;
  } else {
    body = <Processing status={status === "queued" || status === "running" ? status : "loading"} />;
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium opacity-70">{t("title")}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {result ? t("keywordHeading", { keyword: result.keyword }) : t("title")}
        </h1>
        {mockResult && (
          <p>
            <span className="rounded-full bg-purple-600/15 px-3 py-1 text-xs font-medium text-purple-800 dark:text-purple-300">
              {t("mockBadge")}
            </span>
          </p>
        )}
      </header>

      <div aria-live="polite" aria-busy={status !== "ready" && status !== "failed" && state.kind !== "notFound"}>
        {body}
      </div>

      {networkError && (
        <p role="status" className="text-sm text-amber-800 dark:text-amber-300">
          {t("networkError")}
        </p>
      )}

      {status === "ready" && (
        <div>
          <NewSearchLink />
        </div>
      )}

      <Disclaimer />
    </section>
  );
}
